import React, { useState, useCallback, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { ProjectionData, ProjectionDataByAccount, Subscription, ProjectionConfig } from '../../types/ProjectManagement';
import { CategoriesConfig } from '../../types/Category';
import { formatCurrency } from '../../utils/format';
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
  const [currentPage, setCurrentPage] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);

  const totalPages = 2;

  const handlePrevious = useCallback(() => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
  }, [totalPages]);

  const handleNext = useCallback(() => {
    setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : 0));
  }, [totalPages]);

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

  const handleOpenDrillDown = useCallback((data: DrillDownData) => {
    setDrillDown(data);
  }, []);

  const handleCloseDrillDown = useCallback(() => {
    setDrillDown(null);
  }, []);

  return (
    <div
      className="graph-carousel-container"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Flèches de navigation */}
      {isHovering && (
        <>
          <button
            className="carousel-arrow carousel-arrow-left"
            onClick={handlePrevious}
            aria-label={t('projectManagement.carousel.previous', 'Page précédente')}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <button
            className="carousel-arrow carousel-arrow-right"
            onClick={handleNext}
            aria-label={t('projectManagement.carousel.next', 'Page suivante')}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </>
      )}

      {/* Viewport : contraint la zone visible et permet l'adaptation au conteneur */}
      <div className="graph-carousel-viewport">
        <div className="graph-carousel-track" style={{ transform: `translateX(-${currentPage * 50}%)` }}>
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
                  <DebitCreditComparisonChart data={projectionData} />
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

      {/* Indicateurs de page */}
      <div className="carousel-indicators">
        {Array.from({ length: totalPages }).map((_, index) => (
          <button
            key={index}
            className={`carousel-indicator ${currentPage === index ? 'active' : ''}`}
            onClick={() => setCurrentPage(index)}
            aria-label={t('projectManagement.carousel.goToPage', { page: index + 1, defaultValue: `Aller à la page ${index + 1}` })}
          />
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
