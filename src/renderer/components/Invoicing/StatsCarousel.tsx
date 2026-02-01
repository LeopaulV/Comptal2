import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Facture } from '../../types/Invoice';
import { Transaction } from '../../types/Transaction';
import InvoiceVsPaymentChart from './Charts/InvoiceVsPaymentChart';

interface StatsCarouselProps {
  factures: Facture[];
  transactions?: Transaction[];
}

export const StatsCarousel: React.FC<StatsCarouselProps> = ({ factures, transactions = [] }) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const stats = useMemo(() => {
    const totalTTC = factures.reduce((sum, f) => sum + f.totalTTC, 0);
    const paid = factures.filter((f) => f.statut === 'payee');
    const pending = factures.filter((f) => f.statut !== 'payee');
    const paidAmount = paid.reduce((sum, f) => sum + f.totalTTC, 0);
    const pendingAmount = pending.reduce((sum, f) => sum + f.totalTTC, 0);
    const recoveryRate = totalTTC > 0 ? ((paidAmount / totalTTC) * 100) : 0;
    
    return {
      totalTTC,
      paidAmount,
      pendingAmount,
      recoveryRate,
      paidCount: paid.length,
      pendingCount: pending.length,
    };
  }, [factures]);

  return (
    <div className="invoicing-carousel-container">
      <div className="invoicing-carousel-track" style={{ transform: `translateX(-${page * 50}%)` }}>
        {/* Page 1 : Info boxes + Graphique */}
        <div className="invoicing-carousel-page">
          <div className="invoicing-page-content">
            {/* Colonne de gauche : Info boxes */}
            <div className="invoicing-info-boxes-column">
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stats.totalAmount', 'Montant Total TTC')}
                </div>
                <div className="invoicing-info-box-value">
                  {stats.totalTTC.toFixed(2)} €
                </div>
              </div>
              
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stats.paidAmount', 'Montant Payé')}
                </div>
                <div className="invoicing-info-box-value positive">
                  {stats.paidAmount.toFixed(2)} €
                </div>
              </div>
              
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stats.pendingAmount', 'Montant en Attente')}
                </div>
                <div className="invoicing-info-box-value negative">
                  {stats.pendingAmount.toFixed(2)} €
                </div>
              </div>
              
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stats.recoveryRate', 'Taux de Recouvrement')}
                </div>
                <div className={`invoicing-info-box-value ${stats.recoveryRate >= 70 ? 'positive' : 'negative'}`}>
                  {stats.recoveryRate.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Section graphique */}
            <div className="invoicing-graph-section">
              <div className="invoicing-graph-card">
                <h3 className="invoicing-graph-card-title">
                  {t('invoicing.charts.invoiceVsPayment', 'Factures Émises vs Paiements Perçus')}
                </h3>
                <div className="invoicing-graph-card-content">
                  <InvoiceVsPaymentChart factures={factures} transactions={transactions} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 : Stats additionnelles */}
        <div className="invoicing-carousel-page">
          <div className="invoicing-stats-grid">
            <div className="invoicing-stat-card">
              <div className="label">{t('invoicing.stats.paidInvoices', 'Factures Payées')}</div>
              <div className="value">{stats.paidCount}</div>
            </div>
            <div className="invoicing-stat-card">
              <div className="label">{t('invoicing.stats.pendingInvoices', 'Factures en Attente')}</div>
              <div className="value">{stats.pendingCount}</div>
            </div>
            <div className="invoicing-stat-card">
              <div className="label">{t('invoicing.stats.totalInvoices', 'Total Factures')}</div>
              <div className="value">{factures.length}</div>
            </div>
            <div className="invoicing-stat-card">
              <div className="label">{t('invoicing.stats.averageInvoice', 'Facture Moyenne')}</div>
              <div className="value">
                {factures.length ? (stats.totalTTC / factures.length).toFixed(2) : '0.00'} €
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="invoicing-carousel-controls">
        <button 
          type="button" 
          onClick={() => setPage(0)} 
          className={page === 0 ? 'active' : ''}
          aria-label={t('invoicing.carousel.page1', 'Page 1')}
        />
        <button 
          type="button" 
          onClick={() => setPage(1)} 
          className={page === 1 ? 'active' : ''}
          aria-label={t('invoicing.carousel.page2', 'Page 2')}
        />
      </div>
    </div>
  );
};
