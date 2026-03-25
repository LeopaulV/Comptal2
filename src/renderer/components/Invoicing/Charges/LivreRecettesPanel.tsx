import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons';
import { Facture, Client } from '../../../types/Invoice';
import { InvoiceService } from '../../../services/InvoiceService';
import { ClientService } from '../../../services/ClientService';

interface RecetteEntry {
  date: Date;
  nature: string;
  clientName: string;
  factureNumero: string;
  montantHT: number;
  tva: number;
  montantTTC: number;
  modePaiement: string;
  reference: string;
}

export const LivreRecettesPanel: React.FC = () => {
  const { t } = useTranslation();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      const [loadedFactures, loadedClients] = await Promise.all([
        InvoiceService.loadFactures(),
        ClientService.loadClients(),
      ]);
      setFactures(loadedFactures.filter(f => !f.supprime));
      setClients(loadedClients);
    };
    load();
  }, []);

  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => map.set(c.id, c));
    return map;
  }, [clients]);

  const getClientName = (clientId: string): string => {
    const client = clientMap.get(clientId);
    if (!client) return t('invoicing.gestion.unknown');
    if (client.denominationSociale) return client.denominationSociale;
    return [client.prenom, client.nom].filter(Boolean).join(' ') || t('invoicing.gestion.unknownClient');
  };

  const recettes = useMemo((): RecetteEntry[] => {
    const entries: RecetteEntry[] = [];

    factures.forEach(facture => {
      if (!facture.paiements || facture.paiements.length === 0) return;

      facture.paiements.forEach(paiement => {
        const date = new Date(paiement.datePaiement);
        if (date.getFullYear() !== filterYear) return;

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
  }, [factures, clientMap, filterYear, t]);

  const years = useMemo(() => {
    const allYears = new Set<number>();
    allYears.add(new Date().getFullYear());
    factures.forEach(f => {
      f.paiements?.forEach(p => allYears.add(new Date(p.datePaiement).getFullYear()));
    });
    return Array.from(allYears).sort((a, b) => b - a);
  }, [factures]);

  const totalRecettes = recettes.reduce((s, r) => s + r.montantTTC, 0);
  const totalHT = recettes.reduce((s, r) => s + r.montantHT, 0);
  const totalTVA = recettes.reduce((s, r) => s + r.tva, 0);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleExportCSV = () => {
    const headers = ['N°', 'Date', 'Nature', 'Client', 'Montant HT', 'TVA', 'Montant TTC', 'Mode', 'Référence'];
    const lines = [
      headers.join(';'),
      ...recettes.map((r, i) =>
        [
          i + 1,
          formatDate(r.date),
          r.nature,
          r.clientName,
          r.montantHT.toFixed(2),
          r.tva.toFixed(2),
          r.montantTTC.toFixed(2),
          r.modePaiement,
          r.reference,
        ].join(';')
      ),
      ['', '', '', 'TOTAL', totalHT.toFixed(2), totalTVA.toFixed(2), totalRecettes.toFixed(2), '', ''].join(';'),
    ];
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livre_recettes_${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="livre-recettes-panel">
        <div className="tva-dashboard-header">
          <div>
            <h2>{t('invoicing.charges.livreRecettes.title')}</h2>
            <p className="livre-recettes-subtitle">
              {t('invoicing.charges.livreRecettes.subtitle')}
            </p>
          </div>
          <div className="tva-dashboard-controls">
            <select
              value={filterYear}
              onChange={e => setFilterYear(Number(e.target.value))}
              className="tva-select"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              className="tva-export-btn"
              onClick={handleExportCSV}
              title={t('invoicing.charges.livreRecettes.exportPdf')}
            >
              <FontAwesomeIcon icon={faFileExport} />
              {t('common.export')}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="tva-summary-boxes">
          <div className="tva-summary-box">
            <div className="tva-summary-label">{t('invoicing.charges.livreRecettes.totalRecettes')}</div>
            <div className="tva-summary-value positive">{totalRecettes.toFixed(2)} €</div>
          </div>
          <div className="tva-summary-box">
            <div className="tva-summary-label">{t('invoicing.charges.livreRecettes.colMontantHT')}</div>
            <div className="tva-summary-value">{totalHT.toFixed(2)} €</div>
          </div>
          <div className="tva-summary-box">
            <div className="tva-summary-label">{t('invoicing.charges.livreRecettes.colTVA')}</div>
            <div className="tva-summary-value">{totalTVA.toFixed(2)} €</div>
          </div>
        </div>

        {/* Table */}
        <div className="tva-table-container">
          <table className="tva-table livre-recettes-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: 40 }}>N°</th>
                <th>{t('invoicing.charges.livreRecettes.colDate')}</th>
                <th>{t('invoicing.charges.livreRecettes.colNature')}</th>
                <th>{t('invoicing.charges.livreRecettes.colClient')}</th>
                <th>{t('invoicing.charges.livreRecettes.colMontantHT')}</th>
                <th>{t('invoicing.charges.livreRecettes.colTVA')}</th>
                <th>{t('invoicing.charges.livreRecettes.colMontantTTC')}</th>
                <th>{t('invoicing.charges.livreRecettes.colMode')}</th>
                <th>{t('invoicing.charges.livreRecettes.colReference')}</th>
              </tr>
            </thead>
            <tbody>
              {recettes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="tva-empty">
                    {t('invoicing.charges.livreRecettes.empty')}
                  </td>
                </tr>
              ) : (
                recettes.map((r, i) => (
                  <tr key={`${r.factureNumero}-${i}`}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td style={{ textAlign: 'left' }}>{formatDate(r.date)}</td>
                    <td style={{ textAlign: 'left' }}>{r.nature}</td>
                    <td style={{ textAlign: 'left' }}>{r.clientName}</td>
                    <td>{r.montantHT.toFixed(2)} €</td>
                    <td>{r.tva.toFixed(2)} €</td>
                    <td className="positive">{r.montantTTC.toFixed(2)} €</td>
                    <td style={{ textAlign: 'left' }}>{r.modePaiement}</td>
                    <td style={{ textAlign: 'left' }}>{r.reference}</td>
                  </tr>
                ))
              )}
            </tbody>
            {recettes.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}><strong>TOTAL</strong></td>
                  <td><strong>{totalHT.toFixed(2)} €</strong></td>
                  <td><strong>{totalTVA.toFixed(2)} €</strong></td>
                  <td className="positive"><strong>{totalRecettes.toFixed(2)} €</strong></td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
    </div>
  );
};
