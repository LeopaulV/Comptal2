import React, { useState, useCallback, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectionData, ProjectionDataByAccount, Subscription, ProjectionConfig } from '../../types/ProjectManagement';
import { CategoriesConfig } from '../../types/Category';
import { formatCurrency } from '../../utils/format';
import { useZoom } from '../../hooks/useZoom';
import BalanceStackedProjectionChart from './BalanceStackedProjectionChart';
import DebitCreditComparisonChart from './DebitCreditComparisonChart';
import CategoryBreakdownChart from './CategoryBreakdownChart';
import CategoryDistributionChart from './CategoryDistributionChart';
import CategoryDrillDownModal from './CategoryDrillDownModal';

interface Stats {
  totalDebits: number;
  totalCredits: number;
  finalBalance: number;
  netFlow: number;
}

interface GraphCarouselProps {
  projectionData: ProjectionData[];
  projectionDataByAccount?: ProjectionDataByAccount[];
  stats: Stats;
  subscriptions: Subscription[];
  projectionConfig: ProjectionConfig;
  categories: CategoriesConfig;
  accountColors?: Record<string, string>;
  accountNames?: Record<string, string>;
}

interface SubscriptionDetail {
  id: string;
  name: string;
  amount: number;
  color: string;
}

interface DrillDownData {
  title: string;
  subscriptions: SubscriptionDetail[];
}

const GraphCarousel: React.FC<GraphCarouselProps> = ({ 
  projectionData, 
  projectionDataByAccount,
  stats, 
  subscriptions, 
  projectionConfig, 
  categories,
  accountColors = {},
  accountNames = {},
}) => {
  const { t } = useTranslation();
  const { zoomLevel } = useZoom();
  const [currentPage, setCurrentPage] = useState(0);
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);

  const pages = [
    { index: 0, label: t('projectManagement.carousel.page1', 'Dashboard') },
    { index: 1, label: t('projectManagement.carousel.page2', 'Répartition') },
  ];

  const handlePrevious = useCallback(() => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : pages.length - 1));
  }, [pages.length]);

  const handleNext = useCallback(() => {
    setCurrentPage((prev) => (prev < pages.length - 1 ? prev + 1 : 0));
  }, [pages.length]);

  // Navigation au clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext]);

  // Fermer la modale si on change de page
  useEffect(() => {
    if (drillDown) {
      setDrillDown(null);
    }
  }, [currentPage]);

  // Les graphiques Chart.js de cette page réagissent mal au zoom CSS.
  // On force un recalcul après changement de zoom pour réaligner les canvases.
  useEffect(() => {
    const fireResize = () => window.dispatchEvent(new Event('resize'));
    fireResize();
    const frameId = window.requestAnimationFrame(fireResize);
    const timeoutId = window.setTimeout(fireResize, 180);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [zoomLevel]);

  const handleOpenDrillDown = useCallback((data: DrillDownData) => {
    setDrillDown(data);
  }, []);

  const handleCloseDrillDown = useCallback(() => {
    setDrillDown(null);
  }, []);

  return (
    <div
      className="graph-carousel-container"
    >
      {/* Viewport : contraint la zone visible et permet l'adaptation au conteneur */}
      <div className="graph-carousel-viewport">
        <div
          className="graph-carousel-track"
          style={{ 
            // Même formule exacte que StatsCarousel pour la cohérence zoom/dézoom
            transform: `translateX(-${currentPage * (100 / pages.length)}%)` 
          }}
        >
        {/* Page 1 : Boxes info + 2 premiers graphiques */}
        <div className="graph-carousel-page">
          <div className="graph-page-content">
            {/* Boxes d'information en colonne */}
            <div className="info-boxes-column">
              <div className="info-box">
                <div className="info-box-label">
                  {t('projectManagement.dashboard.totalDebits', 'Total Débits')}
                </div>
                <div className="info-box-value info-box-value-debit">
                  {formatCurrency(stats.totalDebits)}
                </div>
              </div>
              <div className="info-box">
                <div className="info-box-label">
                  {t('projectManagement.dashboard.totalCredits', 'Total Crédits')}
                </div>
                <div className="info-box-value info-box-value-credit">
                  {formatCurrency(stats.totalCredits)}
                </div>
              </div>
              <div className="info-box">
                <div className="info-box-label">
                  {t('projectManagement.dashboard.netFlow', 'Flux net')}
                </div>
                <div className={`info-box-value ${stats.netFlow >= 0 ? 'info-box-value-credit' : 'info-box-value-debit'}`}>
                  {formatCurrency(stats.netFlow)}
                </div>
              </div>
              <div className="info-box">
                <div className="info-box-label">
                  {t('projectManagement.dashboard.finalBalance', 'Solde final')}
                </div>
                <div className={`info-box-value ${stats.finalBalance >= 0 ? 'info-box-value-credit' : 'info-box-value-debit'}`}>
                  {formatCurrency(stats.finalBalance)}
                </div>
              </div>
            </div>

            {/* Graphiques */}
            <div className="graphs-section">
              <div className="graph-card">
                <h3 className="graph-card-title">
                  {t('projectManagement.charts.cashFlow', 'Évolution du solde')}
                </h3>
                <div className="graph-card-content">
                  {projectionDataByAccount && projectionDataByAccount.length > 0 && projectionConfig.accountConfigs && projectionConfig.accountConfigs.length > 0 ? (
                    <BalanceStackedProjectionChart
                      key={`balance-stacked-${zoomLevel}`}
                      data={projectionDataByAccount}
                      accountConfigs={projectionConfig.accountConfigs}
                      accountColors={accountColors}
                      accountNames={accountNames}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
                      <p>{t('projectManagement.charts.configureAccounts', 'Configurez les comptes de projection pour voir le graphique')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="graph-card">
                <h3 className="graph-card-title">
                  {t('projectManagement.charts.debitCreditComparison', 'Débits vs Crédits')}
                </h3>
                <div className="graph-card-content">
                  <DebitCreditComparisonChart
                    key={`debit-credit-${zoomLevel}`}
                    data={projectionData}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page 2 : Graphiques par catégories */}
        <div className="graph-carousel-page">
          <div className="graph-page-content">
            <div className="graphs-section graphs-section-full">
              <div className="graph-card">
                <h3 className="graph-card-title">
                  {t('projectManagement.charts.lineBreakdown', 'Répartition par Ligne')}
                </h3>
                <div className="graph-card-content">
                  <CategoryBreakdownChart 
                    key={`category-breakdown-${zoomLevel}`}
                    subscriptions={subscriptions}
                    projectionConfig={projectionConfig}
                    categories={categories}
                    onOpenDrillDown={handleOpenDrillDown}
                  />
                </div>
              </div>

              <div className="graph-card">
                <h3 className="graph-card-title">
                  {t('projectManagement.charts.categoryBreakdown', 'Répartition par catégorie')}
                </h3>
                <div className="graph-card-content">
                  <CategoryDistributionChart 
                    key={`category-distribution-${zoomLevel}`}
                    subscriptions={subscriptions}
                    projectionConfig={projectionConfig}
                    categories={categories}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Controles "par page" (modèle Entreprise/Association) */}
      <div className="graph-carousel-controls">
        {pages.map(({ index, label }) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrentPage(index)}
            className={`graph-carousel-tab ${currentPage === index ? 'active' : ''}`}
            aria-label={t('projectManagement.carousel.goToPage', {
              page: index + 1,
              defaultValue: `Go to page ${index + 1}`,
            })}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Modale de drill-down */}
      {drillDown && currentPage === 1 && (
        <CategoryDrillDownModal
          isOpen={true}
          onClose={handleCloseDrillDown}
          title={drillDown.title}
          subscriptions={drillDown.subscriptions}
        />
      )}
    </div>
  );
};

export default memo(GraphCarousel);
