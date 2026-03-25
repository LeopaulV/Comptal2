import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, Trash2, FileText, RefreshCw, ExternalLink } from 'lucide-react';
import { ReceiptEntry } from '../../types/Association';
import { RegistreRecusService } from '../../services/RegistreRecusService';

const NATURE_LABELS: Record<string, string> = {
  numeraire: 'Numéraire',
  nature: 'Nature',
  mecenat_competences: 'Mécénat compétences',
};

const MODE_LABELS: Record<string, string> = {
  virement: 'Virement',
  cheque: 'Chèque',
  especes: 'Espèces',
  cb: 'Carte bancaire',
  prelevement: 'Prélèvement',
  autre: 'Autre',
};

const formatCurrency = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
};

const isBilan = (e: ReceiptEntry) => e.donateurId === 'RECAP';

interface RegistreRecusPanelProps {
  /** Quand true, le panneau est visible (onglet actif) — déclenche un rechargement des données */
  isVisible?: boolean;
}

export const RegistreRecusPanel: React.FC<RegistreRecusPanelProps> = ({ isVisible = true }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ReceiptEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeTab, setTypeTab] = useState<'recus' | 'bilans'>('recus');
  const [filter, setFilter] = useState<'tous' | 'actifs' | 'annules'>('actifs');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await RegistreRecusService.loadRegistre();
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const prevVisibleRef = useRef(isVisible);
  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) {
      load();
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible, load]);

  const handleAnnuler = async (entry: ReceiptEntry) => {
    const confirm = window.confirm(
      t('association.registre.confirmAnnuler', { numero: entry.numero, donateur: entry.donateurLabel })
    );
    if (!confirm) return;
    await RegistreRecusService.annulerRecu(entry.id);
    await load();
  };

  const handleSupprimer = async (entry: ReceiptEntry) => {
    const confirm = window.confirm(
      t('association.registre.confirmSupprimer', { numero: entry.numero })
    );
    if (!confirm) return;
    await RegistreRecusService.deleteEntry(entry.id);
    await load();
  };

  const handleOuvrirPdf = async (entry: ReceiptEntry) => {
    if (!entry.pdfPath || !window.electronAPI?.openPath) return;
    const result = await window.electronAPI.openPath(entry.pdfPath);
    if (!result.success && result.error) {
      console.warn('Ouverture PDF:', result.error);
    }
  };

  const canOuvrirPdf = typeof window !== 'undefined' && typeof window.electronAPI?.openPath === 'function';

  const entriesByType = typeTab === 'recus'
    ? entries.filter((e) => !isBilan(e))
    : entries.filter((e) => isBilan(e));

  const filtered = entriesByType.filter((e) => {
    if (filter === 'actifs') return !e.annule;
    if (filter === 'annules') return !!e.annule;
    return true;
  });

  const totalActifs = entriesByType
    .filter((e) => !e.annule)
    .reduce((s, e) => s + e.montant, 0);

  if (loading) {
    return (
      <div className="association-registre-panel">
        <div className="association-registre-loading">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="association-registre-panel">
      <div className="association-registre-header">
        <div>
          <h3 className="association-registre-title">{t('association.registre.title')}</h3>
          <p className="association-registre-subtitle">{t('association.registre.subtitle')}</p>
        </div>
        <div className="association-registre-actions">
          <button type="button" className="secondary association-registre-refresh" onClick={load} title={t('common.refresh')}>
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Onglets Reçus / Bilans */}
      <div className="association-registre-type-tabs">
        <button
          type="button"
          className={`association-registre-type-tab ${typeTab === 'recus' ? 'active' : ''}`}
          onClick={() => setTypeTab('recus')}
        >
          {t('association.registre.tabRecus')}
        </button>
        <button
          type="button"
          className={`association-registre-type-tab ${typeTab === 'bilans' ? 'active' : ''}`}
          onClick={() => setTypeTab('bilans')}
        >
          {t('association.registre.tabBilans')}
        </button>
      </div>

      {/* Statistiques */}
      <div className="association-registre-stats">
        <div className="association-registre-stat">
          <span className="association-registre-stat-value">{entriesByType.filter((e) => !e.annule).length}</span>
          <span className="association-registre-stat-label">{t('association.registre.statActifs')}</span>
        </div>
        <div className="association-registre-stat">
          <span className="association-registre-stat-value">{formatCurrency(totalActifs)}</span>
          <span className="association-registre-stat-label">{t('association.registre.statTotal')}</span>
        </div>
        <div className="association-registre-stat association-registre-stat--annule">
          <span className="association-registre-stat-value">{entriesByType.filter((e) => e.annule).length}</span>
          <span className="association-registre-stat-label">{t('association.registre.statAnnules')}</span>
        </div>
      </div>

      {/* Filtres */}
      <div className="association-registre-filters">
        {(['tous', 'actifs', 'annules'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`association-registre-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {t(`association.registre.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="association-registre-empty">
          <FileText size={40} className="association-registre-empty-icon" />
          <p>{typeTab === 'recus' ? t('association.registre.emptyRecus') : t('association.registre.emptyBilans')}</p>
        </div>
      ) : (
        <div className="association-registre-table-wrapper">
          <table className="association-registre-table">
            <thead>
              <tr>
                <th>{t('association.registre.colNumero')}</th>
                <th>{t('association.registre.colDonateur')}</th>
                <th>{t('association.registre.colMontant')}</th>
                <th>{t('association.registre.colNature')}</th>
                <th>{t('association.registre.colMode')}</th>
                <th>{t('association.registre.colDateEmission')}</th>
                <th>{t('association.registre.colStatut')}</th>
                <th>{t('association.registre.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className={entry.annule ? 'association-registre-row--annule' : ''}>
                  <td className="association-registre-numero">
                    <span className="association-registre-numero-badge">{entry.numero}</span>
                  </td>
                  <td>{entry.donateurLabel}</td>
                  <td className="association-registre-montant">{formatCurrency(entry.montant)}</td>
                  <td>{entry.natureDon ? (NATURE_LABELS[entry.natureDon] || entry.natureDon) : '—'}</td>
                  <td>{entry.modeVersement ? (MODE_LABELS[entry.modeVersement] || entry.modeVersement) : '—'}</td>
                  <td>{formatDate(entry.dateEmission)}</td>
                  <td>
                    {entry.annule ? (
                      <span className="association-registre-badge association-registre-badge--annule">
                        {t('association.registre.statutAnnule')}
                        {entry.dateAnnulation && (
                          <span className="association-registre-badge-date"> ({formatDate(entry.dateAnnulation)})</span>
                        )}
                      </span>
                    ) : (
                      <span className="association-registre-badge association-registre-badge--actif">
                        {t('association.registre.statutActif')}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="association-registre-row-actions">
                      {canOuvrirPdf && entry.pdfPath && (
                        <button
                          type="button"
                          className="association-registre-btn association-registre-btn--ouvrir"
                          onClick={() => handleOuvrirPdf(entry)}
                          title={t('association.registre.btnOuvrirPdf')}
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                      {!entry.annule && (
                        <button
                          type="button"
                          className="association-registre-btn association-registre-btn--annuler"
                          onClick={() => handleAnnuler(entry)}
                          title={t('association.registre.btnAnnuler')}
                        >
                          <Ban size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="association-registre-btn association-registre-btn--supprimer"
                        onClick={() => handleSupprimer(entry)}
                        title={t('association.registre.btnSupprimer')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="association-registre-footer">
        <p>{t('association.registre.footerNote')}</p>
      </div>
    </div>
  );
};
