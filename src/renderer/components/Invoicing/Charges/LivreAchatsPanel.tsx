import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileExport } from '@fortawesome/free-solid-svg-icons';
import { AchatRegistreEntry } from '../../../types/Stock';
import { StockService } from '../../../services/StockService';

export const LivreAchatsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AchatRegistreEntry[]>([]);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      const data = await StockService.getAchatsForRegistre(filterYear);
      setEntries(data);
    };
    load();
  }, [filterYear]);

  const years = useMemo(() => {
    const allYears = new Set<number>();
    allYears.add(new Date().getFullYear());
    entries.forEach((e) => allYears.add(e.date.getFullYear()));
    return Array.from(allYears).sort((a, b) => b - a);
  }, [entries]);

  const totalHT = entries.reduce((sum, item) => sum + item.montantHT, 0);
  const totalTVA = entries.reduce((sum, item) => sum + item.tva, 0);
  const totalTTC = entries.reduce((sum, item) => sum + item.montantTTC, 0);

  const formatDate = (date: Date) =>
    date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const modeLabel = (value: string) => t(`invoicing.gestion.paymentMode.${value}`, value);

  const handleExportCSV = () => {
    const headers = [
      'N°',
      'Date',
      'Designation',
      'Fournisseur',
      'Ref Facture',
      'Montant HT',
      'TVA',
      'Montant TTC',
      'Mode',
      'Categorie',
    ];
    const lines = [
      headers.join(';'),
      ...entries.map((item, index) =>
        [
          index + 1,
          formatDate(item.date),
          item.designation,
          item.fournisseur,
          item.referenceFacture,
          item.montantHT.toFixed(2),
          item.tva.toFixed(2),
          item.montantTTC.toFixed(2),
          modeLabel(item.modePaiement),
          item.categorie,
        ].join(';'),
      ),
      ['', '', '', 'TOTAL', '', totalHT.toFixed(2), totalTVA.toFixed(2), totalTTC.toFixed(2), '', ''].join(';'),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registre_achats_${filterYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="livre-recettes-panel">
      <div className="tva-dashboard-header">
        <div>
          <h2>{t('invoicing.stock.purchaseRegisterTitle')}</h2>
          <p className="livre-recettes-subtitle">{t('invoicing.stock.purchaseRegisterSubtitle')}</p>
        </div>
        <div className="tva-dashboard-controls">
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="tva-select">
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button className="tva-export-btn" onClick={handleExportCSV} title={t('invoicing.stock.exportCsv')}>
            <FontAwesomeIcon icon={faFileExport} />
            {t('common.export')}
          </button>
        </div>
      </div>

      <div className="tva-summary-boxes">
        <div className="tva-summary-box">
          <div className="tva-summary-label">{t('invoicing.stock.totalHT')}</div>
          <div className="tva-summary-value">{totalHT.toFixed(2)} EUR</div>
        </div>
        <div className="tva-summary-box">
          <div className="tva-summary-label">{t('invoicing.stock.totalTVA')}</div>
          <div className="tva-summary-value">{totalTVA.toFixed(2)} EUR</div>
        </div>
        <div className="tva-summary-box">
          <div className="tva-summary-label">{t('invoicing.stock.totalTTC')}</div>
          <div className="tva-summary-value positive">{totalTTC.toFixed(2)} EUR</div>
        </div>
      </div>

      <div className="tva-table-container">
        <table className="tva-table livre-recettes-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'center', width: 40 }}>N°</th>
              <th>{t('invoicing.stock.acquisitionDate')}</th>
              <th>{t('invoicing.stock.designation')}</th>
              <th>{t('invoicing.stock.supplier')}</th>
              <th>{t('invoicing.stock.invoiceRef')}</th>
              <th>{t('invoicing.stock.amountHT')}</th>
              <th>{t('invoicing.stock.colTVA')}</th>
              <th>{t('invoicing.stock.amountTTC')}</th>
              <th>{t('invoicing.stock.paymentMode')}</th>
              <th>{t('invoicing.stock.category')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={10} className="tva-empty">
                  {t('invoicing.stock.emptyPurchaseRegister')}
                </td>
              </tr>
            ) : (
              entries.map((item, index) => (
                <tr key={item.id}>
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.designation}</td>
                  <td>{item.fournisseur}</td>
                  <td>{item.referenceFacture}</td>
                  <td>{item.montantHT.toFixed(2)} EUR</td>
                  <td>{item.tva.toFixed(2)} EUR</td>
                  <td>{item.montantTTC.toFixed(2)} EUR</td>
                  <td>{modeLabel(item.modePaiement)}</td>
                  <td>{item.categorie}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
