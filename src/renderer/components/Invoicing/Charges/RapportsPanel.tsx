import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilePdf, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Facture, Emetteur, Client } from '../../../types/Invoice';
import { Project } from '../../../types/ProjectManagement';
import { ProjectionService } from '../../../services/ProjectionService';
import { InvoiceService } from '../../../services/InvoiceService';
import { ClientService } from '../../../services/ClientService';
import { StockService } from '../../../services/StockService';
import {
  EntreprisePDFService,
  RecetteEntry,
  TVAReportData,
} from '../../../services/EntreprisePDFService';
import { CategoryChargesData } from '../../../types/ProjectManagement';

type TVAPeriodMode = 'monthly' | 'quarterly' | 'yearly';

interface RapportsPanelProps {
  factures: Facture[];
  entrepriseProject: Project | null;
  emetteur: Emetteur | null;
  categoryChargesData?: CategoryChargesData | null;
}

function getPeriodKey(date: Date, mode: TVAPeriodMode): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  switch (mode) {
    case 'monthly': return `${String(month + 1).padStart(2, '0')}/${year}`;
    case 'quarterly': return `T${Math.floor(month / 3) + 1} ${year}`;
    case 'yearly': return `${year}`;
  }
}

function getMonthlyEquivalent(amount: number, periodicity: string): number {
  switch (periodicity) {
    case 'daily': return amount * 30;
    case 'weekly': return amount * 4.33;
    case 'monthly': return amount;
    case 'quarterly': return amount / 3;
    case 'yearly': return amount / 12;
    case 'unique': return 0;
    default: return amount;
  }
}

export const RapportsPanel: React.FC<RapportsPanelProps> = ({
  factures,
  entrepriseProject,
  emetteur,
  categoryChargesData,
}) => {
  const { t } = useTranslation();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [tvaPeriod, setTvaPeriod] = useState<TVAPeriodMode>('quarterly');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const years = useMemo(() => {
    const allYears = new Set<number>();
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 5; y <= currentYear + 1; y++) allYears.add(y);
    factures.forEach(f => {
      allYears.add(new Date(f.dateEmission).getFullYear());
      f.paiements?.forEach(p => allYears.add(new Date(p.datePaiement).getFullYear()));
    });
    return Array.from(allYears).sort((a, b) => b - a);
  }, [factures]);

  const loadAchatsForYear = async (year: number) => {
    return StockService.getAchatsForRegistre(year);
  };

  const isMicroBIC = emetteur?.regimeFiscal === 'micro_bic';

  const buildRecettes = async (): Promise<RecetteEntry[]> => {
    const [loadedFactures, loadedClients] = await Promise.all([
      InvoiceService.loadFactures(),
      ClientService.loadClients(),
    ]);
    const active = loadedFactures.filter(f => !f.supprime);
    const clientMap = new Map<string, Client>();
    loadedClients.forEach(c => clientMap.set(c.id, c));

    const getClientName = (clientId: string): string => {
      const client = clientMap.get(clientId);
      if (!client) return 'Inconnu';
      if (client.denominationSociale) return client.denominationSociale;
      return [client.prenom, client.nom].filter(Boolean).join(' ') || 'Client';
    };

    const entries: RecetteEntry[] = [];
    active.forEach(facture => {
      if (!facture.paiements || facture.paiements.length === 0) return;
      facture.paiements.forEach(paiement => {
        const date = new Date(paiement.datePaiement);
        if (date.getFullYear() !== selectedYear) return;
        const tvaTotal = Object.values(facture.totalTVA).reduce((s, v) => s + v, 0);
        const tvaRatio = facture.totalTTC > 0 ? paiement.montant / facture.totalTTC : 0;
        entries.push({
          date,
          nature: facture.intituleSecondaire || facture.numero,
          clientName: getClientName(facture.clientId),
          factureNumero: facture.numero,
          montantHT: paiement.montant - (tvaTotal * tvaRatio),
          tva: tvaTotal * tvaRatio,
          montantTTC: paiement.montant,
          modePaiement: t(`invoicing.gestion.paymentMode.${paiement.modePaiement}`, paiement.modePaiement),
          reference: paiement.reference || facture.numero,
        });
      });
    });
    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const buildTVAData = (): TVAReportData => {
    const periods: Record<string, { collected: number; deductible: number }> = {};

    factures.forEach(f => {
      const date = new Date(f.dateEmission);
      if (date.getFullYear() !== selectedYear) return;
      const key = getPeriodKey(date, tvaPeriod);
      if (!periods[key]) periods[key] = { collected: 0, deductible: 0 };
      const tva = Object.values(f.totalTVA).reduce((s, v) => s + v, 0);
      periods[key].collected += tva;
    });

    if (entrepriseProject && entrepriseProject.subscriptions.length > 0) {
      const flat = ProjectionService.getAllFlatSubscriptions(entrepriseProject.subscriptions);
      const debitsWithTva = flat.filter(s => s.type === 'debit' && s.tvaRate && s.tvaRate > 0);
      debitsWithTva.forEach(sub => {
        const tvaRate = (sub.tvaRate || 0) / 100;
        const monthlyAmount = getMonthlyEquivalent(sub.amount, sub.periodicity);
        const monthlyTva = monthlyAmount * tvaRate;
        for (let m = 0; m < 12; m++) {
          const date = new Date(selectedYear, m, 15);
          if (sub.startDate && date < new Date(sub.startDate)) continue;
          if (sub.endDate && date > new Date(sub.endDate)) continue;
          const key = getPeriodKey(date, tvaPeriod);
          if (!periods[key]) periods[key] = { collected: 0, deductible: 0 };
          periods[key].deductible += monthlyTva;
        }
      });
    }

    const totalCollected = Object.values(periods).reduce((s, p) => s + p.collected, 0);
    const totalDeductible = Object.values(periods).reduce((s, p) => s + p.deductible, 0);

    return {
      periods,
      totalCollected,
      totalDeductible,
      tvaToPay: totalCollected - totalDeductible,
    };
  };

  const handleGenerate = async (reportId: string) => {
    if (!emetteur) return;
    setLoadingId(reportId);
    try {
      switch (reportId) {
        case 'livre-recettes': {
          const entries = await buildRecettes();
          await EntreprisePDFService.generateLivreRecettesPDF(entries, selectedYear, emetteur);
          break;
        }
        case 'tva-report': {
          const data = buildTVAData();
          await EntreprisePDFService.generateTVAReportPDF(data, selectedYear, tvaPeriod, emetteur);
          break;
        }
        case 'registre-achats': {
          const entries = await loadAchatsForYear(selectedYear);
          await EntreprisePDFService.generateRegistreAchatsPDF(entries, selectedYear, emetteur);
          break;
        }
        case 'rapport-activite': {
          const subs = entrepriseProject?.subscriptions || [];
          const achatsStock = await StockService.getAchatsForRegistre(selectedYear);
          await EntreprisePDFService.generateRapportActivitePDF(
            factures,
            subs,
            achatsStock,
            selectedYear,
            emetteur,
            entrepriseProject,
            categoryChargesData ?? null
          );
          break;
        }
      }
    } catch (err) {
      console.error('Erreur génération PDF:', err);
    } finally {
      setLoadingId(null);
    }
  };

  const rapports = [
    {
      id: 'livre-recettes',
      title: t('invoicing.rapports.livreRecettes.title'),
      description: t('invoicing.rapports.livreRecettes.description'),
      legal: t('invoicing.rapports.livreRecettes.legal'),
      obligatoire: true,
      regimes: t('invoicing.rapports.livreRecettes.regimes'),
    },
    {
      id: 'tva-report',
      title: t('invoicing.rapports.tvaReport.title'),
      description: t('invoicing.rapports.tvaReport.description'),
      legal: t('invoicing.rapports.tvaReport.legal'),
      obligatoire: emetteur?.regimeTVA !== 'franchise',
      regimes: t('invoicing.rapports.tvaReport.regimes'),
      extra: (
        <select
          className="rapport-card-select"
          value={tvaPeriod}
          onChange={e => setTvaPeriod(e.target.value as TVAPeriodMode)}
        >
          <option value="monthly">{t('invoicing.charges.tva.monthly')}</option>
          <option value="quarterly">{t('invoicing.charges.tva.quarterly')}</option>
          <option value="yearly">{t('invoicing.charges.tva.yearly')}</option>
        </select>
      ),
    },
    {
      id: 'registre-achats',
      title: t('invoicing.rapports.registreAchats.title'),
      description: t('invoicing.rapports.registreAchats.description'),
      legal: t('invoicing.rapports.registreAchats.legal'),
      obligatoire: isMicroBIC,
      regimes: t('invoicing.rapports.registreAchats.regimes'),
    },
    {
      id: 'rapport-activite',
      title: t('invoicing.rapports.rapportActivite.title'),
      description: t('invoicing.rapports.rapportActivite.description'),
      legal: t('invoicing.rapports.rapportActivite.legal'),
      obligatoire: false,
      regimes: t('invoicing.rapports.rapportActivite.regimes'),
    },
  ];

  if (!emetteur) {
    return (
      <div className="rapports-empty">
        <p>{t('invoicing.rapports.noEmetteur')}</p>
      </div>
    );
  }

  return (
    <div className="rapports-panel">
      <div className="rapports-year-selector">
        <label>{t('invoicing.rapports.year')}</label>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="rapport-card-select"
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="rapports-grid">
        {rapports.map(rapport => (
          <div key={rapport.id} className="rapport-card">
            <div className="rapport-card-header">
              <h4 className="rapport-card-title">{rapport.title}</h4>
              <span className={`rapport-card-badge ${rapport.obligatoire ? 'obligatoire' : 'optionnel'}`}>
                {rapport.obligatoire ? t('invoicing.rapports.obligatoire') : t('invoicing.rapports.optionnel')}
              </span>
            </div>
            <p className="rapport-card-description">{rapport.description}</p>
            <p className="rapport-card-legal">{rapport.legal}</p>
            <p className="rapport-card-regimes">{rapport.regimes}</p>
            <div className="rapport-card-actions">
              {rapport.extra}
              <button
                className="rapport-card-btn"
                onClick={() => handleGenerate(rapport.id)}
                disabled={loadingId !== null}
              >
                <FontAwesomeIcon icon={loadingId === rapport.id ? faSpinner : faFilePdf} spin={loadingId === rapport.id} />
                {t('invoicing.rapports.generate')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
