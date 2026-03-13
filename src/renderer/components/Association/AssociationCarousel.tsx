import React, { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Donateur, Don } from '../../types/Association';
import { Transaction } from '../../types/Transaction';
import { CategoriesConfig } from '../../types/Category';
import { Project, CategoryChargesData } from '../../types/ProjectManagement';
import { ProjectionService } from '../../services/ProjectionService';
import DonCategoryDistributionChart from './Charts/DonCategoryDistributionChart';
import TopDonateursChart from './Charts/TopDonateursChart';
import DonsChargesChart from './Charts/DonsChargesChart';
import DonateurDrillDownModal, { DonateurDetail } from './DonateurDrillDownModal';

interface AssociationCarouselProps {
  donateurs: Donateur[];
  transactions: Transaction[];
  transactionMapping: Record<string, string>;
  categories: CategoriesConfig;
  project: Project | null;
  dons: Don[];
  categoryChargesData?: CategoryChargesData | null;
}

export const AssociationCarousel: React.FC<AssociationCarouselProps> = ({
  donateurs,
  transactions,
  transactionMapping,
  categories,
  project,
  dons,
  categoryChargesData,
}) => {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [drillDown, setDrillDown] = useState<{ title: string; donateurs: DonateurDetail[] } | null>(null);

  const handleOpenDrillDown = useCallback((title: string, donateurs: DonateurDetail[]) => {
    setDrillDown({ title, donateurs });
  }, []);

  const handleCloseDrillDown = useCallback(() => {
    setDrillDown(null);
  }, []);

  const pages = [
    { index: 0, label: t('association.carousel.page1') },
    { index: 1, label: t('association.carousel.page2') },
  ];

  const linkedTxIds = useMemo(() => new Set(Object.keys(transactionMapping)), [transactionMapping]);

  const linkedTransactions = useMemo(() => {
    return transactions.filter((tx) => linkedTxIds.has(tx.id) && tx.amount > 0);
  }, [transactions, linkedTxIds]);

  const chargesByMonth = useMemo(() => {
    if (categoryChargesData && Object.keys(categoryChargesData.totalByMonth).length > 0) {
      const map = new Map<string, number>();
      for (const [key, val] of Object.entries(categoryChargesData.totalByMonth)) {
        if (val > 0) map.set(key, Math.round(val * 100) / 100);
      }
      return map;
    }

    if (!project || project.subscriptions.length === 0) return new Map<string, number>();

    try {
      const projectionData = ProjectionService.calculateProjection(
        project.subscriptions,
        project.projectionConfig
      );
      const aggregated = ProjectionService.aggregateByMonth(projectionData);
      const map = new Map<string, number>();
      for (let i = 0; i < aggregated.months.length; i++) {
        const absDebit = Math.abs(aggregated.debits[i]);
        if (absDebit > 0) {
          map.set(aggregated.months[i], Math.round(absDebit * 100) / 100);
        }
      }
      return map;
    } catch {
      return new Map<string, number>();
    }
  }, [project, categoryChargesData]);

  const stats = useMemo(() => {
    const totalDons = linkedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const activeDonateurs = new Set(Object.values(transactionMapping)).size;
    const donMoyen = linkedTransactions.length > 0 ? totalDons / linkedTransactions.length : 0;
    const chargesMoyen =
      chargesByMonth.size > 0
        ? Math.round(
            (Array.from(chargesByMonth.values()).reduce((a, b) => a + b, 0) / chargesByMonth.size) *
              100
          ) / 100
        : null;

    return {
      totalDons,
      activeDonateurs,
      donMoyen,
      chargesMoyen,
    };
  }, [linkedTransactions, transactionMapping, chargesByMonth]);

  const statsPage2 = useMemo(() => {
    const activeDonateurIds = new Set(Object.values(transactionMapping));
    const activeDonateurs = donateurs.filter((d) => activeDonateurIds.has(d.id));
    const nbParticuliers = activeDonateurs.filter((d) => d.type === 'particulier').length;
    const nbEntreprises = activeDonateurs.filter((d) => d.type === 'entreprise').length;
    const plusGrosDon =
      linkedTransactions.length > 0
        ? Math.max(...linkedTransactions.map((tx) => tx.amount))
        : 0;
    const categoryCodes = new Set(
      activeDonateurs.map((d) => d.categoryCode).filter((c): c is string => !!c && c !== '__none__')
    );
    const nbCategories = categoryCodes.size;

    return { nbParticuliers, nbEntreprises, plusGrosDon, nbCategories };
  }, [donateurs, transactionMapping, linkedTransactions]);

  const hasCharges = chargesByMonth.size > 0;

  const formatCurrency = (v: number) => `${v.toFixed(2)} €`;

  const graphTitle = hasCharges
    ? t('association.carousel.donsChargesMensuels')
    : t('association.carousel.donsMensuels');

  return (
    <div className="invoicing-carousel-container">
      <div className="invoicing-carousel-viewport">
        <div
          className="invoicing-carousel-track"
          style={{ transform: `translateX(-${page * 50}%)` }}
        >
          <div className="invoicing-carousel-page">
            <div className="invoicing-page-content">
              <div className="invoicing-info-boxes-column">
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">{t('association.carousel.totalDons')}</div>
                  <div className="invoicing-info-box-value positive">{formatCurrency(stats.totalDons)}</div>
                </div>
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">{t('association.carousel.nbDonateurs')}</div>
                  <div className="invoicing-info-box-value">{stats.activeDonateurs}</div>
                </div>
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">{t('association.carousel.donMoyen')}</div>
                  <div className="invoicing-info-box-value">{formatCurrency(stats.donMoyen)}</div>
                </div>
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">{t('association.carousel.chargesMoyen')}</div>
                  <div className="invoicing-info-box-value">
                    {stats.chargesMoyen != null ? formatCurrency(stats.chargesMoyen) : '—'}
                  </div>
                </div>
              </div>

              <div className="invoicing-graph-section">
                <div className="invoicing-graph-card">
                  <h3 className="invoicing-graph-card-title">{graphTitle}</h3>
                  <div className="invoicing-graph-card-content">
                    {linkedTransactions.length === 0 && !hasCharges ? (
                      <div className="invoicing-empty" style={{ padding: 40, textAlign: 'center' }}>
                        {t('association.carousel.aucunDon')}
                      </div>
                    ) : (
                      <DonsChargesChart
                        linkedTransactions={linkedTransactions}
                        project={project}
                        categoryChargesData={categoryChargesData}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="invoicing-carousel-page">
            <div className="invoicing-page-content">
              <div className="invoicing-info-boxes-column">
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">{t('association.carousel.nbParticuliers')}</div>
                  <div className="invoicing-info-box-value">{statsPage2.nbParticuliers}</div>
                </div>
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">{t('association.carousel.nbEntreprises')}</div>
                  <div className="invoicing-info-box-value">{statsPage2.nbEntreprises}</div>
                </div>
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">{t('association.carousel.plusGrosDon')}</div>
                  <div className="invoicing-info-box-value positive">{formatCurrency(statsPage2.plusGrosDon)}</div>
                </div>
                <div className="invoicing-info-box">
                  <div className="invoicing-info-box-label">{t('association.carousel.nbCategories')}</div>
                  <div className="invoicing-info-box-value">{statsPage2.nbCategories}</div>
                </div>
              </div>

              <div className="invoicing-graph-section invoicing-graph-section-grid">
                <div className="invoicing-graph-card">
                  <h3 className="invoicing-graph-card-title">{t('association.carousel.repartitionDonsCategories')}</h3>
                  <div className="invoicing-graph-card-content">
                    <DonCategoryDistributionChart
                      donateurs={donateurs}
                      linkedTransactions={linkedTransactions}
                      transactionMapping={transactionMapping}
                      categories={categories}
                      project={project}
                      categoryChargesData={categoryChargesData}
                      onOpenDrillDown={handleOpenDrillDown}
                    />
                  </div>
                </div>
                <div className="invoicing-graph-card">
                  <h3 className="invoicing-graph-card-title">{t('association.carousel.repartitionDonsParDonateurs')}</h3>
                  <div className="invoicing-graph-card-content">
                    <TopDonateursChart
                      donateurs={donateurs}
                      linkedTransactions={linkedTransactions}
                      transactionMapping={transactionMapping}
                      dons={dons}
                    />
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

      {drillDown && page === 1 && (
        <DonateurDrillDownModal
          isOpen={true}
          onClose={handleCloseDrillDown}
          title={drillDown.title}
          donateurs={drillDown.donateurs}
        />
      )}
    </div>
  );
};
