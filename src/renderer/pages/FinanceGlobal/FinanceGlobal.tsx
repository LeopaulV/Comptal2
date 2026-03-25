import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faChartArea, faChartBar, faSearchPlus, faSearchMinus, faBalanceScale } from '@fortawesome/free-solid-svg-icons';
import { Loading, EmptyState } from '../../components/Common';
import { DataService, ChartGranularity, getPeriodLabel, sortPeriodKeys, parsePeriodKeyToDate } from '../../services/DataService';
import { ConfigService } from '../../services/ConfigService';
import { ProjectionService } from '../../services/ProjectionService';
import { CategorySummary } from '../../types/Category';
import { AccountSummary } from '../../types/Account';
import { formatCurrency } from '../../utils/format';
import MonthlyBarChart from '../../components/FinanceGlobal/MonthlyBarChart';
import BalanceStackedChart from '../../components/FinanceGlobal/BalanceStackedChart';
import ProjectionVsRealityChart from '../../components/FinanceGlobal/ProjectionVsRealityChart';
import BilanCharts from '../../components/FinanceGlobal/BilanCharts';
import '../../styles/finance-global-custom.css';

const GRANULARITY_LABELS: Record<ChartGranularity, string> = {
  day: 'granularityDay',
  week: 'granularityWeek',
  month: 'granularityMonth',
  quarter: 'granularityQuarter',
  semester: 'granularitySemester',
  year: 'granularityYear',
};

const FinanceGlobal: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [activeChart, setActiveChart] = useState<'monthly' | 'balance' | 'projectionVsReality' | 'bilan'>('monthly');
  const [granularity, setGranularity] = useState<ChartGranularity>('month');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [dateInputStart, setDateInputStart] = useState<string>('');
  const [dateInputEnd, setDateInputEnd] = useState<string>('');
  
  // Projection contre Réalité
  const [selectedProjectCode, setSelectedProjectCode] = useState<string | null>(null);
  const [projectsList, setProjectsList] = useState<{ code: string; name: string }[]>([]);
  const [projectionVsRealityData, setProjectionVsRealityData] = useState<{
    monthLabels: string[];
    unifiedKeys: string[];
    categories: string[];
    categoryColors: Record<string, string>;
    realityByCategory: number[][];
    projectionByCategory: Record<string, number[]>;
    realityTotals: number[];
    projectionTotals: number[];
  } | null>(null);
  
  // Données pour les graphiques
  const [monthlyCategoryData, setMonthlyCategoryData] = useState<{
    months: string[];
    periodKeys: string[];
    categories: string[];
    monthlyData: number[][];
    categoryColors: Record<string, string>;
  } | null>(null);

  const [monthlyAccountData, setMonthlyAccountData] = useState<{
    months: string[];
    accounts: string[];
    monthlyData: number[][];
    accountColors: Record<string, string>;
  } | null>(null);

  // Données Bilan (crédits / débits par catégorie et période)
  const [bilanData, setBilanData] = useState<{
    periodKeys: string[];
    months: string[];
    categoriesWithCredits: string[];
    categoriesWithDebits: string[];
    creditsByCategory: Record<string, number[]>;
    debitsByCategory: Record<string, number[]>;
    categoryColors: Record<string, string>;
  } | null>(null);
  const [bilanLoading, setBilanLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dateFrom = dateRange.start;
      const dateTo = dateRange.end;
      const filter = (dateFrom || dateTo) ? { startDate: dateFrom ?? undefined, endDate: dateTo ?? undefined } : undefined;
      const [categoriesData, accountsData, categoryChartData, accountChartData] = await Promise.all([
        DataService.getCategorySummaries(filter),
        DataService.getAccountSummaries(),
        DataService.getCategoryChartData(granularity, dateFrom, dateTo),
        DataService.getAccountChartData(granularity, dateFrom, dateTo),
      ]);

      setCategories(categoriesData);
      setAccounts(accountsData);
      setMonthlyCategoryData(categoryChartData);
      setMonthlyAccountData(accountChartData);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setIsLoading(false);
    }
  }, [granularity, dateRange.start, dateRange.end]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Charger la liste des projets quand l'onglet Projection contre Réalité est actif
  useEffect(() => {
    if (activeChart !== 'projectionVsReality') return;
    ConfigService.loadSelectableProjects()
      .then((config) => {
        const list = Object.entries(config).map(([code, p]) => ({ code, name: p.name }));
        setProjectsList(list);
        const codes = list.map((p) => p.code);
        if (list.length > 0) {
          if (!selectedProjectCode || !codes.includes(selectedProjectCode)) {
            setSelectedProjectCode(list[0].code);
          }
        } else if (selectedProjectCode) {
          setSelectedProjectCode(null);
        }
      })
      .catch((err) => console.error('Erreur chargement projets:', err));
  }, [activeChart]);

  // Calculer les données Projection vs Réalité quand projet sélectionné ou données changent
  useEffect(() => {
    if (activeChart !== 'projectionVsReality' || !selectedProjectCode) {
      setProjectionVsRealityData(null);
      return;
    }
    const run = async () => {
      try {
        const project = await ConfigService.loadProject(selectedProjectCode);
        if (!project) {
          setProjectionVsRealityData(null);
          setSelectedProjectCode(null);
          return;
        }
        const dateFrom = dateRange.start ?? project.projectionConfig.startDate;
        const dateTo = dateRange.end ?? project.projectionConfig.endDate;
        // Charger les données réelles SANS filtre de date pour avoir toutes les données (sinon
        // on n'a que la plage du projet et souvent aucune transaction = Data invisibles).
        const [categoryDataFiltered, categoriesConfig] = await Promise.all([
          DataService.getCategoryChartData(granularity, null, null),
          ConfigService.loadCategories(),
        ]);
        const realityKeys = categoryDataFiltered.periodKeys || [];
        const projectionData = ProjectionService.calculateProjection(
          project.subscriptions,
          project.projectionConfig
        );
        const aggregated = ProjectionService.aggregateByPeriod(projectionData, granularity);
        const projectionMonths = aggregated.months;
        const allKeys = new Set<string>([...realityKeys, ...projectionMonths]);
        let unifiedKeys = sortPeriodKeys(Array.from(allKeys), granularity);
        // Limiter à la plage dateFrom/dateTo pour l'affichage
        const rangeStart = dateFrom instanceof Date ? dateFrom.getTime() : (dateFrom ? new Date(dateFrom).getTime() : null);
        const rangeEnd = dateTo instanceof Date ? dateTo.getTime() : (dateTo ? new Date(dateTo).getTime() : null);
        if (rangeStart != null && rangeEnd != null) {
          unifiedKeys = unifiedKeys.filter((key) => {
            const t = parsePeriodKeyToDate(key, granularity).getTime();
            return t >= rangeStart && t <= rangeEnd;
          });
        }
        const realityIdx = new Map(realityKeys.map((k, i) => [k, i]));

        // Union des catégories : réalité + projection (via categoryCode des abonnements)
        const categoryNamesSet = new Set<string>(categoryDataFiltered.categories || []);
        const flatSubs = ProjectionService.getAllFlatSubscriptions(project.subscriptions);
        flatSubs.forEach((sub) => {
          const catName = sub.categoryCode
            ? (categoriesConfig[sub.categoryCode]?.name || sub.categoryCode)
            : '_NO_CAT_';
          categoryNamesSet.add(catName);
        });
        const categories = Array.from(categoryNamesSet);
        const categoryColors: Record<string, string> = { ...categoryDataFiltered.categoryColors };
        categories.forEach((catName) => {
          if (!categoryColors[catName]) {
            const code = Object.entries(categoriesConfig).find(([, c]) => c.name === catName)?.[0];
            categoryColors[catName] = code ? categoriesConfig[code]?.color || '#808080' : '#808080';
          }
        });

        // Reality par catégorie : [catIndex][monthIndex]
        const realityByCategory: number[][] = categories.map((catName) => {
          const catIndex = categoryDataFiltered.categories?.indexOf(catName) ?? -1;
          if (catIndex < 0) return unifiedKeys.map(() => 0);
          return unifiedKeys.map((key) => {
            const ri = realityIdx.get(key);
            return ri !== undefined ? (categoryDataFiltered.monthlyData[catIndex]?.[ri] ?? 0) : 0;
          });
        });

        // Projection par catégorie : Record<catName, number[]>
        const projectionByCategory: Record<string, number[]> = {};
        flatSubs.forEach((sub) => {
          const catName = sub.categoryCode
            ? (categoriesConfig[sub.categoryCode]?.name || sub.categoryCode)
            : '_NO_CAT_';
          if (!projectionByCategory[catName]) {
            projectionByCategory[catName] = unifiedKeys.map(() => 0);
          }
          const subAgg = ProjectionService.aggregateByPeriod(
            ProjectionService.calculateProjection([sub], project.projectionConfig),
            granularity
          );
          const subIdx = new Map(subAgg.months.map((k, i) => [k, i]));
          unifiedKeys.forEach((key, ki) => {
            const pi = subIdx.get(key);
            if (pi !== undefined) {
              projectionByCategory[catName][ki] += subAgg.netFlows[pi] ?? 0;
            }
          });
        });

        const realityTotals: number[] = unifiedKeys.map((_, ki) =>
          realityByCategory.reduce((s, row) => s + (row[ki] ?? 0), 0)
        );
        const projectionTotals: number[] = unifiedKeys.map((_, ki) => {
          let sum = 0;
          for (const arr of Object.values(projectionByCategory)) {
            sum += arr[ki] ?? 0;
          }
          return sum;
        });

        const monthLabels = unifiedKeys.map((k) => getPeriodLabel(k, granularity));
        setProjectionVsRealityData({
          monthLabels,
          unifiedKeys,
          categories,
          categoryColors,
          realityByCategory,
          projectionByCategory,
          realityTotals,
          projectionTotals,
        });
      } catch (err) {
        console.error('Erreur calcul projection vs réalité:', err);
        setProjectionVsRealityData(null);
      }
    };
    run();
  }, [activeChart, selectedProjectCode, dateRange.start, dateRange.end, granularity]);

  // Charger les données Bilan quand l'onglet Bilan est actif
  useEffect(() => {
    if (activeChart !== 'bilan') {
      setBilanData(null);
      return;
    }
    setBilanLoading(true);
    DataService.getBilanChartData(granularity, dateRange.start, dateRange.end)
      .then(setBilanData)
      .catch((err) => {
        console.error('Erreur chargement Bilan:', err);
        setBilanData(null);
      })
      .finally(() => setBilanLoading(false));
  }, [activeChart, granularity, dateRange.start, dateRange.end]);

  const handleZoomIn = () => {
    const next = DataService.getNextGranularity(granularity);
    if (next) setGranularity(next);
  };

  const handleZoomOut = () => {
    const prev = DataService.getPreviousGranularity(granularity);
    if (prev) setGranularity(prev);
  };

  const handleDateRangeApply = () => {
    const start = dateInputStart ? new Date(dateInputStart) : null;
    const end = dateInputEnd ? new Date(dateInputEnd) : null;
    if (start && end && start > end) {
      setDateRange({ start: end, end: start });
      setDateInputStart(dateInputEnd);
      setDateInputEnd(dateInputStart);
    } else {
      setDateRange({ start, end });
    }
  };

  const handleDateRangeReset = () => {
    setDateInputStart('');
    setDateInputEnd('');
    setDateRange({ start: null, end: null });
  };

  const canZoomIn = DataService.getNextGranularity(granularity) !== null;
  const canZoomOut = DataService.getPreviousGranularity(granularity) !== null;

  if (isLoading) {
    return <Loading message={t('financeGlobal.loading')} />;
  }

  // Détecter l'absence de données
  const hasNoData = categories.length === 0 && accounts.length === 0;
  const hasNoChartData = (!monthlyCategoryData || monthlyCategoryData.months.length === 0) && 
                         (!monthlyAccountData || monthlyAccountData.months.length === 0);

  // Afficher EmptyState si aucune donnée n'est disponible
  if (hasNoData || hasNoChartData) {
    return (
      <div className="finance-global-page">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('financeGlobal.title')}</h1>
        </div>
        <EmptyState
          title={t('financeGlobal.noDataTitle', 'Aucune donnée financière disponible')}
          message={t('financeGlobal.noDataMessage', 'Importez des fichiers CSV pour visualiser vos analyses financières')}
          actionLabel={t('financeGlobal.importData', 'Importer des données')}
        />
      </div>
    );
  }

  // Fonction pour obtenir un style de couleur dégradé professionnel (adapté au thème sombre)
  const getColorStyle = (value: number) => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    if (value === 0) {
      return isDarkMode 
        ? { backgroundColor: '#334155', color: '#e2e8f0' }
        : { backgroundColor: '#ffffff', color: '#1e293b' };
    }
    
    // Intensités plus subtiles et professionnelles
    const maxIntensity = 0.25;
    const minIntensity = 0.04;
    const normalizedValue = Math.min(Math.abs(value) / 10000, 1);
    const intensity = minIntensity + (normalizedValue * (maxIntensity - minIntensity));
    
    // Couleurs professionnelles : vert succès (#10b981) et rouge danger (#ef4444)
    const backgroundColor = value > 0 
      ? `rgba(16, 185, 129, ${intensity})` // Vert professionnel
      : `rgba(239, 68, 68, ${intensity})`; // Rouge professionnel
    
    // Meilleur contraste pour le texte selon l'intensité et le thème
    let textColor: string;
    if (isDarkMode) {
      textColor = intensity > 0.12 ? '#ffffff' : '#cbd5e1';
    } else {
      textColor = intensity > 0.15 ? '#ffffff' : '#1e293b';
    }
    
    return { backgroundColor, color: textColor };
  };

  return (
    <div className="finance-global-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('financeGlobal.title')}</h1>
      </div>

      {/* Onglets des graphiques */}
      <div className="chart-tabs-container">
        <div className="chart-tabs">
          <button
            className={`chart-tab ${activeChart === 'monthly' ? 'active' : ''}`}
            onClick={() => setActiveChart('monthly')}
          >
            <FontAwesomeIcon icon={faChartLine} className="mr-2" />
            {t('financeGlobal.monthlyChart')}
          </button>
          <button
            className={`chart-tab ${activeChart === 'balance' ? 'active' : ''}`}
            onClick={() => setActiveChart('balance')}
          >
            <FontAwesomeIcon icon={faChartArea} className="mr-2" />
            {t('financeGlobal.balanceChart')}
          </button>
          <button
            className={`chart-tab ${activeChart === 'projectionVsReality' ? 'active' : ''}`}
            onClick={() => setActiveChart('projectionVsReality')}
          >
            <FontAwesomeIcon icon={faChartBar} className="mr-2" />
            {t('financeGlobal.projectionVsRealityChart')}
          </button>
          <button
            className={`chart-tab ${activeChart === 'bilan' ? 'active' : ''}`}
            onClick={() => setActiveChart('bilan')}
          >
            <FontAwesomeIcon icon={faBalanceScale} className="mr-2" />
            {t('financeGlobal.bilanTab')}
          </button>
        </div>
      </div>

      {/* Barre d'outils : zoom et plage de temps */}
      <div className="finance-global-chart-toolbar">
        <div className="chart-toolbar-zoom">
          <div className="chart-toolbar-zoom-buttons">
            <button
              type="button"
              className="chart-toolbar-btn"
              onClick={handleZoomOut}
              disabled={!canZoomOut}
              title={t('financeGlobal.zoomOut')}
              aria-label={t('financeGlobal.zoomOut')}
            >
              <FontAwesomeIcon icon={faSearchMinus} />
            </button>
            <span className="chart-toolbar-granularity">{t(`financeGlobal.${GRANULARITY_LABELS[granularity]}`)}</span>
            <button
              type="button"
              className="chart-toolbar-btn"
              onClick={handleZoomIn}
              disabled={!canZoomIn}
              title={t('financeGlobal.zoomIn')}
              aria-label={t('financeGlobal.zoomIn')}
            >
              <FontAwesomeIcon icon={faSearchPlus} />
            </button>
          </div>
        </div>
        <div className="chart-toolbar-daterange">
          <span className="chart-toolbar-label">{t('financeGlobal.dateRange')}</span>
          <label>
            <span className="chart-toolbar-datelabel">{t('financeGlobal.dateFrom')}</span>
            <input
              type="date"
              className="chart-toolbar-dateinput"
              value={dateInputStart}
              onChange={(e) => setDateInputStart(e.target.value)}
            />
          </label>
          <label>
            <span className="chart-toolbar-datelabel">{t('financeGlobal.dateTo')}</span>
            <input
              type="date"
              className="chart-toolbar-dateinput"
              value={dateInputEnd}
              onChange={(e) => setDateInputEnd(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="chart-toolbar-btn chart-toolbar-btn-apply"
            onClick={handleDateRangeApply}
          >
            {t('financeGlobal.apply')}
          </button>
          <button
            type="button"
            className="chart-toolbar-btn chart-toolbar-btn-reset"
            onClick={handleDateRangeReset}
          >
            {t('financeGlobal.all')}
          </button>
        </div>
      </div>

      {/* Sélecteur de projet (onglet Projection contre Réalité) */}
      {activeChart === 'projectionVsReality' && (
        <div className="projection-vs-reality-selector mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('financeGlobal.selectProject')}
          </label>
          <select
            value={selectedProjectCode || ''}
            onChange={(e) => setSelectedProjectCode(e.target.value || null)}
            className="projection-project-select px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
            disabled={projectsList.length === 0}
          >
            {projectsList.length === 0 ? (
              <option value="">{t('financeGlobal.noProjectsAvailable')}</option>
            ) : (
              projectsList.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Conteneur des graphiques */}
      <div className="finance-global-chart-container chart-container-with-toolbar">
        {activeChart === 'monthly' && monthlyCategoryData && monthlyCategoryData.months.length > 0 && monthlyCategoryData.monthlyData.length > 0 && (
          <div className="chart active">
            <MonthlyBarChart
              months={monthlyCategoryData.months}
              categories={monthlyCategoryData.categories}
              monthlyData={monthlyCategoryData.monthlyData}
              categoryColors={monthlyCategoryData.categoryColors}
            />
          </div>
        )}
        {activeChart === 'balance' && monthlyAccountData && monthlyAccountData.months.length > 0 && monthlyAccountData.monthlyData.length > 0 && (
          <div className="chart active">
            <BalanceStackedChart
              months={monthlyAccountData.months}
              accounts={monthlyAccountData.accounts}
              monthlyData={monthlyAccountData.monthlyData}
              accountColors={monthlyAccountData.accountColors}
            />
          </div>
        )}
        {activeChart === 'projectionVsReality' && (
          <div className="chart active">
            {!selectedProjectCode || projectsList.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500 dark:text-gray-400">
                <p>{t('financeGlobal.noProjectSelected')}</p>
              </div>
            ) : projectionVsRealityData ? (
              projectionVsRealityData.monthLabels.length > 0 ? (
                <ProjectionVsRealityChart
                  monthLabels={projectionVsRealityData.monthLabels}
                  categories={projectionVsRealityData.categories}
                  categoryColors={projectionVsRealityData.categoryColors}
                  realityByCategory={projectionVsRealityData.realityByCategory}
                  projectionByCategory={projectionVsRealityData.projectionByCategory}
                  categoryLabels={{ _NO_CAT_: t('financeGlobal.uncategorized') }}
                />
              ) : (
                <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500 dark:text-gray-400">
                  <p>{t('financeGlobal.noDataToDisplay')}</p>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full min-h-[300px] text-gray-500 dark:text-gray-400">
                <p>{t('financeGlobal.loading')}</p>
              </div>
            )}
          </div>
        )}
        {activeChart === 'bilan' && (
          <div className="chart active bilan-charts-wrapper">
            {bilanLoading ? (
              <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500 dark:text-gray-400">
                <p>{t('financeGlobal.loading')}</p>
              </div>
            ) : bilanData ? (
              <BilanCharts data={bilanData} />
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] text-gray-500 dark:text-gray-400">
                <p>{t('financeGlobal.bilanTab')} — {t('financeGlobal.dateRange')} : {t(`financeGlobal.${GRANULARITY_LABELS[granularity]}`)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Onglet Bilan : tableau Crédit/Débit + récap */}
      {activeChart === 'bilan' && bilanData && (
        <>
          {(bilanData.categoriesWithCredits.length > 0 || bilanData.categoriesWithDebits.length > 0) && bilanData.months.length > 0 ? (
            <>
              <div className="finance-global-table-container finance-global-table-bilan">
                <div className="table-wrapper">
                  <table className="finance-table bilan-table">
                    <thead>
                      <tr>
                        <th className="fixed-column column-1 bilan-col-type">{t('financeGlobal.credit')} / {t('financeGlobal.debit')}</th>
                        <th className="fixed-column column-2">{t('financeGlobal.category')}</th>
                        {bilanData.months.map((m, i) => (
                          <th key={i}>{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bilanData.categoriesWithCredits.map((catName, rowIndex) => (
                        <tr key={`credit-${catName}`} className={`bilan-section-credit ${rowIndex % 2 !== 0 ? 'odd-row' : 'even-row'}`}>
                          <td className="fixed-column column-1 bilan-type-credit">{t('financeGlobal.credit')}</td>
                          <td className="fixed-column column-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: bilanData.categoryColors[catName] || '#808080' }} />
                              {catName}
                            </div>
                          </td>
                          {(bilanData.creditsByCategory[catName] || []).map((val, i) => (
                            <td key={i} className="text-right text-green-600 dark:text-green-400">
                              {val !== 0 ? formatCurrency(val) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {bilanData.categoriesWithCredits.length > 0 && bilanData.categoriesWithDebits.length > 0 && (
                        <tr className="bilan-separator-row">
                          <td colSpan={2 + bilanData.months.length} className="bilan-separator-cell" />
                        </tr>
                      )}
                      {bilanData.categoriesWithDebits.map((catName, rowIndex) => (
                        <tr key={`debit-${catName}`} className={`bilan-section-debit ${rowIndex % 2 !== 0 ? 'odd-row' : 'even-row'}`}>
                          <td className="fixed-column column-1 bilan-type-debit">{t('financeGlobal.debit')}</td>
                          <td className="fixed-column column-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: bilanData.categoryColors[catName] || '#808080' }} />
                              {catName}
                            </div>
                          </td>
                          {(bilanData.debitsByCategory[catName] || []).map((val, i) => (
                            <td key={i} className="text-right text-red-600 dark:text-red-400">
                              {val !== 0 ? formatCurrency(val) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {bilanData.categoriesWithCredits.length > 0 && (
                        <tr className="total-row bilan-total-credits">
                          <td className="fixed-column column-1" colSpan={2}>{t('financeGlobal.totalCredits')}</td>
                          {bilanData.months.map((_, i) => {
                            const total = bilanData.categoriesWithCredits.reduce((s, cat) => s + (bilanData.creditsByCategory[cat]?.[i] ?? 0), 0);
                            return (
                              <td key={i} className="text-right font-medium text-green-600 dark:text-green-400">
                                {total !== 0 ? formatCurrency(total) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                      {bilanData.categoriesWithDebits.length > 0 && (
                        <tr className="total-row bilan-total-debits">
                          <td className="fixed-column column-1" colSpan={2}>{t('financeGlobal.totalDebits')}</td>
                          {bilanData.months.map((_, i) => {
                            const total = bilanData.categoriesWithDebits.reduce((s, cat) => s + (bilanData.debitsByCategory[cat]?.[i] ?? 0), 0);
                            return (
                              <td key={i} className="text-right font-medium text-red-600 dark:text-red-400">
                                {total !== 0 ? formatCurrency(total) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bilan-recap-section mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t('financeGlobal.bilanPdfTitle')} — {t('financeGlobal.total')}</h3>
                <div className="finance-global-table-container bilan-recap-table">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th className="fixed-column column-1"></th>
                        {Array.from(new Set([...bilanData.categoriesWithCredits, ...bilanData.categoriesWithDebits])).map((catName) => (
                          <th key={catName} className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {catName}
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: bilanData.categoryColors[catName] || '#808080' }} />
                            </div>
                          </th>
                        ))}
                        <th className="text-right">{t('financeGlobal.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bilan-section-credit total-row">
                        <td className="fixed-column column-1 bilan-type-credit">{t('financeGlobal.credit')}</td>
                        {Array.from(new Set([...bilanData.categoriesWithCredits, ...bilanData.categoriesWithDebits])).map((catName) => {
                          const totalCredits = (bilanData.creditsByCategory[catName] || []).reduce((a, b) => a + b, 0);
                          return (
                            <td key={catName} className="text-right text-green-600 dark:text-green-400">
                              {totalCredits !== 0 ? formatCurrency(totalCredits) : '-'}
                            </td>
                          );
                        })}
                        <td className="text-right font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(
                            Object.keys(bilanData.creditsByCategory).reduce((s, cat) => s + (bilanData.creditsByCategory[cat] || []).reduce((a, b) => a + b, 0), 0)
                          )}
                        </td>
                      </tr>
                      <tr className="bilan-section-debit total-row">
                        <td className="fixed-column column-1 bilan-type-debit">{t('financeGlobal.debit')}</td>
                        {Array.from(new Set([...bilanData.categoriesWithCredits, ...bilanData.categoriesWithDebits])).map((catName) => {
                          const totalDebits = (bilanData.debitsByCategory[catName] || []).reduce((a, b) => a + b, 0);
                          return (
                            <td key={catName} className="text-right text-red-600 dark:text-red-400">
                              {totalDebits !== 0 ? formatCurrency(totalDebits) : '-'}
                            </td>
                          );
                        })}
                        <td className="text-right font-medium text-red-600 dark:text-red-400">
                          {formatCurrency(
                            Object.keys(bilanData.debitsByCategory).reduce((s, cat) => s + (bilanData.debitsByCategory[cat] || []).reduce((a, b) => a + b, 0), 0)
                          )}
                        </td>
                      </tr>
                      <tr className="total-row">
                        <td className="fixed-column column-1 font-medium">{t('financeGlobal.total')}</td>
                        {Array.from(new Set([...bilanData.categoriesWithCredits, ...bilanData.categoriesWithDebits])).map((catName) => {
                          const totalCredits = (bilanData.creditsByCategory[catName] || []).reduce((a, b) => a + b, 0);
                          const totalDebits = (bilanData.debitsByCategory[catName] || []).reduce((a, b) => a + b, 0);
                          const net = totalCredits + totalDebits;
                          return (
                            <td key={catName} className="text-right font-medium">
                              <span className={net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                {net !== 0 ? formatCurrency(net) : '-'}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-right font-medium">
                          <span className={
                            (Object.keys(bilanData.creditsByCategory).reduce((s, cat) => s + (bilanData.creditsByCategory[cat] || []).reduce((a, b) => a + b, 0), 0) +
                            Object.keys(bilanData.debitsByCategory).reduce((s, cat) => s + (bilanData.debitsByCategory[cat] || []).reduce((a, b) => a + b, 0), 0)
                          ) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            {formatCurrency(
                              Object.keys(bilanData.creditsByCategory).reduce((s, cat) => s + (bilanData.creditsByCategory[cat] || []).reduce((a, b) => a + b, 0), 0) +
                              Object.keys(bilanData.debitsByCategory).reduce((s, cat) => s + (bilanData.debitsByCategory[cat] || []).reduce((a, b) => a + b, 0), 0)
                            )}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <p>{t('financeGlobal.bilanNoData')}</p>
            </div>
          )}
        </>
      )}

      {/* Tableau : mensuel/solde = catégories en lignes ; projection vs réalité = périodes en lignes, catégories en colonnes */}
      {activeChart === 'projectionVsReality' && projectionVsRealityData ? (
      <div className="finance-global-table-container finance-global-table-projection-vs-reality">
        <div className="table-wrapper">
          <table className="finance-table">
            <thead>
              <tr>
                <th className="fixed-column column-1" rowSpan={2}>{t('financeGlobal.period')}</th>
                {projectionVsRealityData.categories.map((catName) => (
                  <th key={catName} colSpan={2} className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: projectionVsRealityData.categoryColors[catName] || '#808080' }}
                      />
                      {catName === '_NO_CAT_' ? t('financeGlobal.uncategorized') : catName}
                    </div>
                  </th>
                ))}
                <th colSpan={2} className="text-center fixed-column-total">{t('financeGlobal.total')}</th>
              </tr>
              <tr>
                {projectionVsRealityData.categories.flatMap((catName) => [
                  <th key={`${catName}-data`} className="text-right sub-col">{t('financeGlobal.basedOnData')}</th>,
                  <th key={`${catName}-projet`} className="text-right sub-col">{t('financeGlobal.basedOnProject')}</th>,
                ])}
                <th className="text-right sub-col fixed-column-total">{t('financeGlobal.basedOnData')}</th>
                <th className="text-right sub-col fixed-column-total">{t('financeGlobal.basedOnProject')}</th>
              </tr>
            </thead>
            <tbody>
              {projectionVsRealityData.monthLabels.map((monthLabel, monthIndex) => {
                const isOdd = monthIndex % 2 !== 0;
                return (
                  <tr key={monthIndex} className={isOdd ? 'odd-row' : 'even-row'}>
                    <td className="fixed-column column-1 font-medium">{monthLabel}</td>
                    {projectionVsRealityData.categories.map((_, catIndex) => (
                      <React.Fragment key={catIndex}>
                        <td
                          className="text-right"
                          style={getColorStyle(projectionVsRealityData.realityByCategory[catIndex]?.[monthIndex] ?? 0)}
                        >
                          <span className={(projectionVsRealityData.realityByCategory[catIndex]?.[monthIndex] ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {(projectionVsRealityData.realityByCategory[catIndex]?.[monthIndex] ?? 0) !== 0
                              ? formatCurrency(projectionVsRealityData.realityByCategory[catIndex]?.[monthIndex] ?? 0)
                              : '-'}
                          </span>
                        </td>
                        <td
                          className="text-right"
                          style={getColorStyle(projectionVsRealityData.projectionByCategory[projectionVsRealityData.categories[catIndex]]?.[monthIndex] ?? 0)}
                        >
                          <span className={(projectionVsRealityData.projectionByCategory[projectionVsRealityData.categories[catIndex]]?.[monthIndex] ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {(projectionVsRealityData.projectionByCategory[projectionVsRealityData.categories[catIndex]]?.[monthIndex] ?? 0) !== 0
                              ? formatCurrency(projectionVsRealityData.projectionByCategory[projectionVsRealityData.categories[catIndex]]?.[monthIndex] ?? 0)
                              : '-'}
                          </span>
                        </td>
                      </React.Fragment>
                    ))}
                    <td
                      className="text-right fixed-column-total"
                      style={getColorStyle(projectionVsRealityData.realityTotals[monthIndex] ?? 0)}
                    >
                      <span className={(projectionVsRealityData.realityTotals[monthIndex] ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {(projectionVsRealityData.realityTotals[monthIndex] ?? 0) !== 0
                          ? formatCurrency(projectionVsRealityData.realityTotals[monthIndex] ?? 0)
                          : '-'}
                      </span>
                    </td>
                    <td
                      className="text-right fixed-column-total"
                      style={getColorStyle(projectionVsRealityData.projectionTotals[monthIndex] ?? 0)}
                    >
                      <span className={(projectionVsRealityData.projectionTotals[monthIndex] ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {(projectionVsRealityData.projectionTotals[monthIndex] ?? 0) !== 0
                          ? formatCurrency(projectionVsRealityData.projectionTotals[monthIndex] ?? 0)
                          : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      ) : (activeChart === 'monthly' || activeChart === 'balance') ? (
      <div className="finance-global-table-container">
        <div className="table-wrapper">
          <table className="finance-table">
            <thead>
              <tr>
                <th className="fixed-column column-1">{t('financeGlobal.abbreviation')}</th>
                <th className="fixed-column column-2">{t('financeGlobal.fullName')}</th>
                <th className="fixed-column column-3">{t('financeGlobal.average')}</th>
                <th className="fixed-column column-4">
                  {activeChart === 'monthly' ? t('financeGlobal.sum') : t('financeGlobal.currentBalance')}
                </th>
                {((activeChart === 'monthly' ? monthlyCategoryData?.months : monthlyAccountData?.months) || []).map((month, index) => (
                  <th key={index}>{month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeChart === 'monthly' ? (
                <>
                  {categories.map((category, rowIndex) => {
                    const avgAmount = category.totalAmount / (category.transactionCount || 1);
                    const isOdd = rowIndex % 2 !== 0;
                    
                    return (
                      <tr key={category.categoryCode} className={isOdd ? 'odd-row' : 'even-row'}>
                        <td className="fixed-column column-1">{category.categoryCode}</td>
                        <td className="fixed-column column-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.categoryName}
                          </div>
                        </td>
                        <td className="fixed-column column-3 text-right">
                          <span className={avgAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(avgAmount)}
                          </span>
                        </td>
                        <td className="fixed-column column-4 text-right">
                          <span className={category.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(category.totalAmount)}
                          </span>
                        </td>
                        {(monthlyCategoryData?.months || []).map((month, index) => {
                          // Trouver l'index de cette catégorie dans les données
                          const catIndex = monthlyCategoryData?.categories.indexOf(category.categoryName) ?? -1;
                          const monthIndex = monthlyCategoryData?.months.indexOf(month) ?? -1;
                          const value = (catIndex >= 0 && monthIndex >= 0 && monthlyCategoryData?.monthlyData[catIndex]) 
                            ? (monthlyCategoryData.monthlyData[catIndex][monthIndex] || 0)
                            : 0;
                          
                          return (
                            <td 
                              key={index} 
                              className="text-right"
                              style={getColorStyle(value)}
                            >
                              <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {value !== 0 ? formatCurrency(value) : '-'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Ligne Total pour les catégories */}
                  {monthlyCategoryData && monthlyCategoryData.months.length > 0 && monthlyCategoryData.monthlyData.length > 0 && (() => {
                    const totalRow = {
                      categoryCode: 'Total',
                      categoryName: 'Total',
                      avgAmount: categories.length > 0 ? categories.reduce((sum, cat) => {
                        const avg = cat.totalAmount / (cat.transactionCount || 1);
                        return sum + avg;
                      }, 0) / categories.length : 0,
                      totalAmount: categories.reduce((sum, cat) => sum + cat.totalAmount, 0),
                      monthlyValues: monthlyCategoryData.months.map((_, monthIndex) => 
                        monthlyCategoryData.monthlyData.reduce((sum, catData) => 
                          sum + ((catData && catData[monthIndex]) || 0), 0
                        )
                      ),
                    };
                    
                    return (
                      <tr key="total" className={`total-row ${categories.length % 2 === 0 ? 'odd-row' : 'even-row'}`}>
                        <td className="fixed-column column-1">{t('financeGlobal.total')}</td>
                        <td className="fixed-column column-2">{t('financeGlobal.total')}</td>
                        <td className="fixed-column column-3 text-right">
                          <span className={totalRow.avgAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(totalRow.avgAmount)}
                          </span>
                        </td>
                        <td className="fixed-column column-4 text-right">
                          <span className={totalRow.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(totalRow.totalAmount)}
                          </span>
                        </td>
                        {totalRow.monthlyValues.map((value, index) => (
                          <td 
                            key={index} 
                            className="text-right"
                            style={getColorStyle(value)}
                          >
                            <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {value !== 0 ? formatCurrency(value) : '-'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })()}
                </>
              ) : (
                <>
                  {accounts.map((account, rowIndex) => {
                    // Calculer la moyenne des soldes mensuels pour ce compte
                    const accountIndex = monthlyAccountData?.accounts.indexOf(account.accountName) ?? -1;
                    const monthlyValues = accountIndex >= 0 && monthlyAccountData?.monthlyData[accountIndex]
                      ? monthlyAccountData.monthlyData[accountIndex]
                      : [];
                    const avgBalance = monthlyValues.length > 0
                      ? monthlyValues.reduce((sum, val) => sum + val, 0) / monthlyValues.length
                      : account.balance;
                    const currentBalance = monthlyValues.length > 0 
                      ? monthlyValues[monthlyValues.length - 1] 
                      : account.balance;
                    const isOdd = rowIndex % 2 !== 0;
                    
                    return (
                      <tr key={account.accountCode} className={isOdd ? 'odd-row' : 'even-row'}>
                        <td className="fixed-column column-1">{account.accountCode}</td>
                        <td className="fixed-column column-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: account.color }}
                            />
                            {account.accountName}
                          </div>
                        </td>
                        <td className="fixed-column column-3 text-right">
                          <span className={avgBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(avgBalance)}
                          </span>
                        </td>
                        <td className="fixed-column column-4 text-right">
                          <span className={currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(currentBalance)}
                          </span>
                        </td>
                        {(monthlyAccountData?.months || []).map((_, index) => {
                          const value = (accountIndex >= 0 && monthlyAccountData?.monthlyData[accountIndex] && monthlyAccountData.monthlyData[accountIndex][index] !== undefined)
                            ? (monthlyAccountData.monthlyData[accountIndex][index] || 0)
                            : 0;
                          
                          return (
                            <td 
                              key={index} 
                              className="text-right"
                              style={getColorStyle(value)}
                            >
                              <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {value !== 0 ? formatCurrency(value) : '-'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Ligne Total pour les comptes */}
                  {monthlyAccountData && monthlyAccountData.months.length > 0 && monthlyAccountData.monthlyData.length > 0 && (() => {
                    const totalMonthlyValues = monthlyAccountData.months.map((_, monthIndex) => 
                      monthlyAccountData.monthlyData.reduce((sum, accountData) => 
                        sum + ((accountData && accountData[monthIndex]) || 0), 0
                      )
                    );
                    const totalAvgBalance = totalMonthlyValues.length > 0
                      ? totalMonthlyValues.reduce((sum, val) => sum + val, 0) / totalMonthlyValues.length
                      : 0;
                    const totalCurrentBalance = totalMonthlyValues.length > 0
                      ? totalMonthlyValues[totalMonthlyValues.length - 1]
                      : 0;
                    
                    return (
                      <tr key="total" className={`total-row ${accounts.length % 2 === 0 ? 'odd-row' : 'even-row'}`}>
                        <td className="fixed-column column-1">{t('financeGlobal.total')}</td>
                        <td className="fixed-column column-2">{t('financeGlobal.total')}</td>
                        <td className="fixed-column column-3 text-right">
                          <span className={totalAvgBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(totalAvgBalance)}
                          </span>
                        </td>
                        <td className="fixed-column column-4 text-right">
                          <span className={totalCurrentBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(totalCurrentBalance)}
                          </span>
                        </td>
                        {totalMonthlyValues.map((value, index) => (
                          <td 
                            key={index} 
                            className="text-right"
                            style={getColorStyle(value)}
                          >
                            <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {value !== 0 ? formatCurrency(value) : '-'}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })()}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}
    </div>
  );
};

export default FinanceGlobal;

