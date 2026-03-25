import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Devis, Facture } from '../../types/Invoice';
import { Transaction } from '../../types/Transaction';
import { Project, CategoryChargesData } from '../../types/ProjectManagement';
import { ArticleStock } from '../../types/Stock';
import { ProjectionService } from '../../services/ProjectionService';
import BilanFinancierChart from './Charts/BilanFinancierChart';
import PosteDistributionChart from './Charts/PosteDistributionChart';
import PosteBreakdownChart from './Charts/PosteBreakdownChart';
import StockEvolutionChart from './Charts/StockEvolutionChart';

interface StatsCarouselProps {
  devis?: Devis[];
  factures: Facture[];
  transactions?: Transaction[];
  entrepriseProject?: Project | null;
  stockArticles: ArticleStock[];
  categoryChargesData?: CategoryChargesData | null;
}

export const StatsCarousel: React.FC<StatsCarouselProps> = ({ devis = [], factures, transactions = [], entrepriseProject, stockArticles = [], categoryChargesData }) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const pages = [
    { index: 0, label: t('invoicing.carousel.page1', 'Bilan financier') },
    { index: 1, label: t('invoicing.carousel.page2', 'Répartition des bénéfices') },
    { index: 2, label: t('invoicing.carousel.page3', 'Stock et achats') },
  ];

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

  const chargesStats = useMemo(() => {
    if (categoryChargesData && Object.keys(categoryChargesData.totalByMonth).length > 0) {
      const total = Object.values(categoryChargesData.totalByMonth).reduce((a, b) => a + b, 0);
      const monthCount = Object.keys(categoryChargesData.totalByMonth).length || 1;
      return { monthlyAvg: total / monthCount, monthCount };
    }
    if (!entrepriseProject || entrepriseProject.subscriptions.length === 0) {
      return { monthlyAvg: 0, monthCount: 0 };
    }
    try {
      const projectionData = ProjectionService.calculateProjection(
        entrepriseProject.subscriptions,
        entrepriseProject.projectionConfig
      );
      const aggregated = ProjectionService.aggregateByMonth(projectionData);
      const totalDebits = aggregated.debits.reduce((s, d) => s + d, 0);
      const monthCount = aggregated.months.length || 1;
      return { monthlyAvg: totalDebits / monthCount, monthCount };
    } catch {
      return { monthlyAvg: 0, monthCount: 0 };
    }
  }, [entrepriseProject, categoryChargesData]);

  const getCurrentQty = (article: ArticleStock): number => {
    const hebdo = article.consommationHebdo || {};
    const keys = Object.keys(hebdo).sort();
    if (keys.length > 0) {
      const last = hebdo[keys[keys.length - 1]];
      if (typeof last === 'number') return last;
    }
    return typeof article.quantite === 'number' ? article.quantite : 0;
  };

  const stockStats = useMemo(() => {
    const inventoryArticles = stockArticles.filter((a) => a.type === 'stock' || a.type === 'consommable');
    const articleCount = inventoryArticles.length;
    const totalCurrentQty = inventoryArticles.reduce((sum, a) => sum + getCurrentQty(a), 0);
    const totalPurchaseHT = inventoryArticles.reduce((sum, a) => sum + a.valeurAcquisitionHT, 0);
    const totalPurchaseTTC = inventoryArticles.reduce(
      (sum, a) => sum + a.valeurAcquisitionHT * (1 + (a.tauxTVA || 0) / 100),
      0
    );

    return {
      inventoryArticles,
      articleCount,
      totalCurrentQty,
      totalPurchaseHT,
      totalPurchaseTTC,
    };
  }, [stockArticles]);

  return (
    <div className="invoicing-carousel-container">
      <div className="invoicing-carousel-viewport">
        <div
          className="invoicing-carousel-track"
          style={{ transform: `translateX(-${page * (100 / pages.length)}%)` }}
        >
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

              {chargesStats.monthlyAvg > 0 && (
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">
                    {t('invoicing.charges.monthlyAvg')}
                  </div>
                  <div className="invoicing-info-box-value negative">
                    {chargesStats.monthlyAvg.toFixed(2)} €
                  </div>
                </div>
              )}
            </div>

            {/* Section graphique */}
            <div className="invoicing-graph-section">
              <div className="invoicing-graph-card">
                <h3 className="invoicing-graph-card-title">
                  {t('invoicing.charts.invoiceVsPayment', 'Factures Émises vs Paiements Perçus')}
                </h3>
                <div className="invoicing-graph-card-content">
                  <BilanFinancierChart
                    devis={devis}
                    factures={factures}
                    transactions={transactions}
                    entrepriseProject={entrepriseProject}
                    categoryChargesData={categoryChargesData}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 : Info boxes à gauche + graphiques postes */}
        <div className="invoicing-carousel-page">
          <div className="invoicing-page-content">
            {/* Colonne de gauche : Info boxes */}
            <div className="invoicing-info-boxes-column">
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stats.paidInvoices', 'Factures Payées')}
                </div>
                <div className="invoicing-info-box-value">{stats.paidCount}</div>
              </div>
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stats.pendingInvoices', 'Factures en Attente')}
                </div>
                <div className="invoicing-info-box-value">{stats.pendingCount}</div>
              </div>
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stats.totalInvoices', 'Total Factures')}
                </div>
                <div className="invoicing-info-box-value">{factures.length}</div>
              </div>
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stats.averageInvoice', 'Facture Moyenne')}
                </div>
                <div className="invoicing-info-box-value">
                  {factures.length ? (stats.totalTTC / factures.length).toFixed(2) : '0.00'} €
                </div>
              </div>
            </div>

            {/* Section graphique : diagramme circulaire + histogramme */}
            <div className="invoicing-graph-section invoicing-graph-section-grid">
              <div className="invoicing-graph-card">
                <h3 className="invoicing-graph-card-title">
                  {t('invoicing.charts.posteDistribution', 'Répartition des bénéfices par type de poste')}
                </h3>
                <div className="invoicing-graph-card-content">
                  <PosteDistributionChart devis={devis} factures={factures} />
                </div>
              </div>
              <div className="invoicing-graph-card">
                <h3 className="invoicing-graph-card-title">
                  {t('invoicing.charts.posteBreakdown', 'Occurrences par poste')}
                </h3>
                <div className="invoicing-graph-card-content">
                  <PosteBreakdownChart devis={devis} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page 3 : Stock et achats */}
        <div className="invoicing-carousel-page">
          <div className="invoicing-page-content">
            <div className="invoicing-info-boxes-column">
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stock.carousel.articleCount', "Articles d'inventaire")}
                </div>
                <div className="invoicing-info-box-value">
                  {stockStats.articleCount}
                </div>
              </div>
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stock.carousel.totalCurrentQty', 'Quantité totale actuelle')}
                </div>
                <div className="invoicing-info-box-value">
                  {stockStats.totalCurrentQty.toFixed(2)}
                </div>
              </div>
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stock.carousel.totalPurchaseHT', 'Valeur achats HT')}
                </div>
                <div className="invoicing-info-box-value">
                  {stockStats.totalPurchaseHT.toFixed(2)} €
                </div>
              </div>
              <div className="invoicing-info-box">
                <div className="invoicing-info-box-label">
                  {t('invoicing.stock.carousel.totalPurchaseTTC', 'Valeur achats TTC')}
                </div>
                <div className="invoicing-info-box-value positive">
                  {stockStats.totalPurchaseTTC.toFixed(2)} €
                </div>
              </div>
            </div>
            <div className="invoicing-graph-section">
              <div className="invoicing-graph-card">
                <h3 className="invoicing-graph-card-title">
                  {t('invoicing.stock.chart.title', "Evolution temporelle de l'inventaire")}
                </h3>
                <div className="invoicing-graph-card-content">
                  <StockEvolutionChart articles={stockStats.inventoryArticles} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      
      <div className="invoicing-carousel-controls">
        {pages.map(({ index, label }) => (
          <button
            key={index}
            type="button"
            onClick={() => setPage(index)}
            className={`invoicing-carousel-tab ${page === index ? 'active' : ''}`}
            aria-label={label}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
