import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWallet, 
  faMoneyBillWave, 
  faCoins,
  faFileExport,
  faCalendarAlt,
  faUniversity,
  faTags,
  faChevronLeft,
  faChevronRight,
  faChevronDown,
  faChevronUp
} from '@fortawesome/free-solid-svg-icons';
import { Loading, EmptyState } from '../../components/Common';
import MiniAccountCards from '../../components/Dashboard/MiniAccountCards';
import MiniCategoryCards from '../../components/Dashboard/MiniCategoryCards';
import DateRangeSlider from '../../components/Common/DateRangeSlider';
import ChartJsPieChart from '../../components/Dashboard/ChartJsPieChart';
import IncomePieChart from '../../components/Dashboard/IncomePieChart';
import AccountBalanceLineChart from '../../components/Dashboard/AccountBalanceLineChart';
import SortableTable from '../../components/Common/SortableTable';
import FilterBox from '../../components/Dashboard/FilterBox';
import SearchBar from '../../components/Dashboard/SearchBar';
import PeriodFilterButtons from '../../components/Dashboard/PeriodFilterButtons';
import { DataService } from '../../services/DataService';
import { CSVService } from '../../services/CSVService';
import { ProfilePaths } from '../../services/ProfilePaths';
import { ConfigService } from '../../services/ConfigService';
import { AccountSummary } from '../../types/Account';
import { CategorySummary } from '../../types/Category';
import { Transaction, TransactionStats } from '../../types/Transaction';
import { formatCurrency } from '../../utils/format';
import { format, differenceInMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import '../../styles/dashboard-custom.css';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  
  // Données initiales
  const [allAccounts, setAllAccounts] = useState<AccountSummary[]>([]);
  const [allCategories, setAllCategories] = useState<CategorySummary[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  
  // Données filtrées
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [filteredCategories, setFilteredCategories] = useState<CategorySummary[]>([]);
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});
  
  // Filtres
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  
  // Données pour le graphique de soldes
  const [accountBalanceChartData, setAccountBalanceChartData] = useState<{
    periods: string[];
    accounts: string[];
    balanceData: number[][];
    accountColors: Record<string, string>;
    granularity: 'day' | 'week' | 'month';
  } | null>(null);
  
  // Abréviations pour l'affichage
  const [accountAbbreviations, setAccountAbbreviations] = useState<Record<string, string>>({});
  const [categoryAbbreviations, setCategoryAbbreviations] = useState<Record<string, string>>({});
  
  // État pour la sidebar rétractable
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // États pour les sections de filtre rétractables
  const [isAccountFilterCollapsed, setIsAccountFilterCollapsed] = useState(false);
  const [isCategoryFilterCollapsed, setIsCategoryFilterCollapsed] = useState(false);
  const [isPeriodFilterCollapsed, setIsPeriodFilterCollapsed] = useState(false);

  // États pour les sections principales rétractables (Infos / Graphiques / Tableau)
  const [isInfoCardsCollapsed, setIsInfoCardsCollapsed] = useState(false);
  const [isChartsCollapsed, setIsChartsCollapsed] = useState(false);
  const [isTableCollapsed, setIsTableCollapsed] = useState(false);

  const CollapsibleSection = ({
    title,
    icon,
    isCollapsed,
    onToggle,
    contentId,
    children,
  }: {
    title: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon?: any;
    isCollapsed: boolean;
    onToggle: () => void;
    contentId: string;
    children: React.ReactNode;
  }) => {
    return (
      <section className="dashboard-collapsible-section">
        <div className="dashboard-collapsible-header">
          <div className="dashboard-collapsible-title">
            {icon && <FontAwesomeIcon icon={icon} />}
            <h2>{title}</h2>
          </div>

          <button
            type="button"
            className="dashboard-collapsible-toggle-button"
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            aria-controls={contentId}
            title={isCollapsed ? t('dashboard.expand', 'Déplier') : t('dashboard.collapse', 'Replier')}
          >
            <FontAwesomeIcon icon={isCollapsed ? faChevronDown : faChevronUp} />
          </button>
        </div>

        <div
          id={contentId}
          className={`dashboard-collapsible-content ${isCollapsed ? 'collapsed' : ''}`}
        >
          {children}
        </div>
      </section>
    );
  };

  // Charger les données initiales
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [accountsData, categoriesData, transactionsData, accountsConfig, categoriesConfig] = await Promise.all([
        DataService.getAccountSummaries(),
        DataService.getCategorySummaries(),
        DataService.getTransactions(),
        ConfigService.loadAccounts(),
        ConfigService.loadCategories(),
      ]);

      setAllAccounts(accountsData);
      setAllCategories(categoriesData);
      setAllTransactions(transactionsData);
      
      // Initialiser les sélections (tout sélectionné par défaut)
      setSelectedAccounts(accountsData.map(acc => acc.accountCode));
      setSelectedCategories(categoriesData.map(cat => cat.categoryCode));
      
      // Créer les maps d'abréviations
      const accAbbr: Record<string, string> = {};
      accountsData.forEach(acc => {
        accAbbr[acc.accountCode] = accountsConfig[acc.accountCode]?.name || acc.accountCode;
      });
      setAccountAbbreviations(accAbbr);
      
      const catAbbr: Record<string, string> = {};
      categoriesData.forEach(cat => {
        catAbbr[cat.categoryCode] = categoriesConfig[cat.categoryCode]?.name || cat.categoryCode;
      });
      setCategoryAbbreviations(catAbbr);
      
      // Initialiser la plage de dates (toutes les transactions)
      if (transactionsData.length > 0) {
        const minDate = new Date(Math.min(...transactionsData.map(t => t.date.getTime())));
        const maxDate = new Date(Math.max(...transactionsData.map(t => t.date.getTime())));
        setDateRange({ start: minDate, end: maxDate });
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction applyFilters centralisée avec gestion stricte des filtres
  const applyFilters = useCallback(async () => {
    if (!dateRange) return;
    
    setIsFiltering(true);
    try {
      // Préparer les filtres de manière stricte
      // Si aucun compte n'est sélectionné, on ne filtre pas par compte (undefined)
      // Si des comptes sont sélectionnés, on applique le filtre strictement
      const accountFilter = selectedAccounts.length > 0 ? selectedAccounts : undefined;
      
      // Même logique pour les catégories
      const categoryFilter = selectedCategories.length > 0 ? selectedCategories : undefined;
      
      // Pour le terme de recherche, on nettoie et on ignore les chaînes vides
      const cleanSearchTerm = searchTerm.trim();
      const searchFilter = cleanSearchTerm.length > 0 ? cleanSearchTerm : undefined;
      
      // Log pour débogage (optionnel, peut être retiré en production)
      console.log('Filtres appliqués:', {
        comptes: accountFilter?.length || 'tous',
        catégories: categoryFilter?.length || 'toutes',
        recherche: searchFilter || 'aucune',
        dates: `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
      });

      // Appeler filterTransactionsAdvanced avec tous les filtres
      const result = await DataService.filterTransactionsAdvanced({
        accountCodes: accountFilter,
        categoryCodes: categoryFilter,
        startDate: dateRange.start,
        endDate: dateRange.end,
        searchTerm: searchFilter,
      });

      // Calculer les soldes à la date de fin
      const balances = await DataService.getAccountBalancesAtDate(dateRange.end);

      // Charger les données pour le graphique de soldes (filtrer selon les comptes sélectionnés)
      const balanceChartData = await DataService.getAccountBalancesOverPeriod(
        dateRange.start,
        dateRange.end,
        accountFilter // Passer les comptes sélectionnés (ou undefined si tous)
      );

      // Mettre à jour tous les états
      setFilteredTransactions(result.transactions);
      setStats(result.stats);
      setFilteredCategories(result.categorySummaries);
      setAccountBalances(balances);
      setAccountBalanceChartData(balanceChartData);
      
      // Log du résultat
      console.log(`${result.transactions.length} transaction(s) après filtrage`);
    } catch (error) {
      console.error('Erreur lors de l\'application des filtres:', error);
    } finally {
      setIsFiltering(false);
    }
  }, [selectedAccounts, selectedCategories, searchTerm, dateRange]);

  // Appliquer les filtres quand ils changent
  useEffect(() => {
    if (dateRange && !isLoading) {
      applyFilters();
    }
  }, [selectedAccounts, selectedCategories, searchTerm, dateRange, applyFilters, isLoading]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleDateRangeChange = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
  }, []);

  const handleAccountToggle = useCallback((accountCode: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountCode) 
        ? prev.filter(a => a !== accountCode)
        : [...prev, accountCode]
    );
  }, []);

  const handleAccountToggleAll = useCallback(() => {
    setSelectedAccounts(prev => 
      prev.length === allAccounts.length 
        ? [] 
        : allAccounts.map(acc => acc.accountCode)
    );
  }, [allAccounts]);

  const handleCategoryToggle = useCallback((categoryCode: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryCode) 
        ? prev.filter(c => c !== categoryCode)
        : [...prev, categoryCode]
    );
  }, []);

  const handleCategoryToggleAll = useCallback(() => {
    setSelectedCategories(prev => 
      prev.length === allCategories.length 
        ? [] 
        : allCategories.map(cat => cat.categoryCode)
    );
  }, [allCategories]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const handleExport = async () => {
    try {
      const filename = `export_dashboard_${new Date().toISOString().split('T')[0]}.csv`;
      const dataDir = await ProfilePaths.getDataDirectory();
      await CSVService.exportToCSV(filteredTransactions, `${dataDir}/${filename}`);
      alert(`Export réussi: ${filename}`);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export');
    }
  };

  // Calculer le solde total : (Total des revenus) - (Total des dépenses)
  const totalBalance = useMemo(() => {
    if (!stats) return 0;
    return (stats.totalIncome || 0) - (stats.totalExpenses || 0);
  }, [stats]);

  // Préparer les items pour FilterBox
  const accountFilterItems = useMemo(() => 
    allAccounts.map(acc => ({
      value: acc.accountCode,
      label: accountAbbreviations[acc.accountCode] || acc.accountCode,
      checked: selectedAccounts.includes(acc.accountCode),
    })),
    [allAccounts, accountAbbreviations, selectedAccounts]
  );

  const categoryFilterItems = useMemo(() => 
    allCategories.map(cat => ({
      value: cat.categoryCode,
      label: categoryAbbreviations[cat.categoryCode] || cat.categoryName,
      checked: selectedCategories.includes(cat.categoryCode),
    })),
    [allCategories, categoryAbbreviations, selectedCategories]
  );

  const minDate = useMemo(() => {
    if (allTransactions.length === 0) return new Date();
    return new Date(Math.min(...allTransactions.map(t => t.date.getTime())));
  }, [allTransactions]);

  const maxDate = useMemo(() => {
    if (allTransactions.length === 0) return new Date();
    return new Date(Math.max(...allTransactions.map(t => t.date.getTime())));
  }, [allTransactions]);

  // Filtrer les catégories pour le graphique : exclure "Y" (Salaires) uniquement pour l'affichage
  const categoriesForChart = useMemo(() => {
    return filteredCategories.filter(cat => cat.categoryCode !== 'Y');
  }, [filteredCategories]);

  // Calculer les moyennes mensuelles par catégorie
  const categoryAverages = useMemo(() => {
    if (!dateRange || !filteredTransactions.length) return [];
    
    const categoryMap = new Map<string, { total: number; count: number }>();
    
    // Grouper par catégorie et sommer (sans absolu pour préserver le signe)
    filteredTransactions.forEach(t => {
      if (!t.category) return;
      const current = categoryMap.get(t.category) || { total: 0, count: 0 };
      categoryMap.set(t.category, {
        total: current.total + t.amount, // Signe préservé (négatif = dépense, positif = revenu)
        count: current.count + 1
      });
    });
    
    // Calculer le nombre de mois dans la période
    const months = differenceInMonths(dateRange.end, dateRange.start) + 1;
    
    // Créer le tableau de résultats avec moyenne mensuelle
    return Array.from(categoryMap.entries())
      .map(([code, data]) => ({
        categoryCode: code,
        categoryName: categoryAbbreviations[code] || code,
        color: allCategories.find(c => c.categoryCode === code)?.color || '#cccccc',
        averageAmount: months > 0 ? data.total / months : 0
      }))
      .sort((a, b) => Math.abs(b.averageAmount) - Math.abs(a.averageAmount)); // Trier par valeur absolue décroissante
  }, [filteredTransactions, dateRange, categoryAbbreviations, allCategories]);

  // Détecter l'absence de données
  const hasNoData = useMemo(() => {
    return allTransactions.length === 0;
  }, [allTransactions]);

  if (isLoading) {
    return <Loading message={t('dashboard.loading')} />;
  }

  // Afficher EmptyState si aucune donnée n'est disponible
  if (hasNoData) {
    return (
      <div className="dashboard-container">
        <EmptyState
          title={t('dashboard.noDataTitle', 'Aucune transaction disponible')}
          message={t('dashboard.noDataMessage', 'Importez des fichiers CSV pour commencer à analyser vos transactions')}
          actionLabel={t('dashboard.importData', 'Importer des données')}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar avec filtres */}
      <aside className={`dashboard-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!isSidebarCollapsed && <h3>{t('dashboard.filters', 'Filtres')}</h3>}
          <button
            className="sidebar-collapse-button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? t('dashboard.expandSidebar', 'Afficher les filtres') : t('dashboard.collapseSidebar', 'Masquer les filtres')}
          >
            <FontAwesomeIcon icon={isSidebarCollapsed ? faChevronRight : faChevronLeft} />
          </button>
        </div>
        
        {!isSidebarCollapsed && (
          <>
            {/* Filtre par Compte */}
            <div className="sidebar-filter-section">
              <div className="filter-section-header" onClick={() => setIsAccountFilterCollapsed(!isAccountFilterCollapsed)}>
                <h5>
                  <FontAwesomeIcon icon={faUniversity} className="mr-2" />
                  {t('dashboard.accounts')}
                </h5>
                <FontAwesomeIcon 
                  icon={isAccountFilterCollapsed ? faChevronDown : faChevronUp} 
                  className="collapse-icon"
                />
              </div>
              {!isAccountFilterCollapsed && (
                <FilterBox
                  title=""
                  icon={faUniversity}
                  items={accountFilterItems}
                  onToggle={handleAccountToggle}
                  onToggleAll={handleAccountToggleAll}
                />
              )}
            </div>

            {/* Filtre par Catégorie */}
            <div className="sidebar-filter-section">
              <div className="filter-section-header" onClick={() => setIsCategoryFilterCollapsed(!isCategoryFilterCollapsed)}>
                <h5>
                  <FontAwesomeIcon icon={faTags} className="mr-2" />
                  {t('dashboard.categories')}
                </h5>
                <FontAwesomeIcon 
                  icon={isCategoryFilterCollapsed ? faChevronDown : faChevronUp} 
                  className="collapse-icon"
                />
              </div>
              {!isCategoryFilterCollapsed && (
                <FilterBox
                  title=""
                  icon={faTags}
                  items={categoryFilterItems}
                  onToggle={handleCategoryToggle}
                  onToggleAll={handleCategoryToggleAll}
                />
              )}
            </div>

            {/* Filtre par Période */}
            <div className="sidebar-filter-section">
              <div className="filter-section-header" onClick={() => setIsPeriodFilterCollapsed(!isPeriodFilterCollapsed)}>
                <h5>
                  <FontAwesomeIcon icon={faCalendarAlt} className="mr-2" />
                  {t('dashboard.period', 'Période')}
                </h5>
                <FontAwesomeIcon 
                  icon={isPeriodFilterCollapsed ? faChevronDown : faChevronUp} 
                  className="collapse-icon"
                />
              </div>
              {!isPeriodFilterCollapsed && (
                <div className="filter-box">
                  <PeriodFilterButtons 
                    minDate={minDate}
                    maxDate={maxDate}
                    onPeriodChange={handleDateRangeChange} 
                  />
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {/* Contenu principal */}
      <main className="dashboard-main-content">
        {/* Header avec titre et bouton d'export */}
        <div className="dashboard-header">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
          <button 
            onClick={handleExport}
            className="export-button"
            title={t('dashboard.exportTitle')}
          >
            <FontAwesomeIcon icon={faFileExport} size="lg" />
          </button>
        </div>

        {/* 1. Barre de Recherche avec plage de dates */}
        <div className="dashboard-search-section">
          {dateRange && (
            <div className="date-range-display-badge">
              <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
                <i className="fas fa-calendar-check text-[10px]"></i>
              </div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 px-2 py-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm dark:shadow-md text-center transition-all duration-200 whitespace-nowrap">
                {format(dateRange.start, 'dd/MM/yyyy', { locale: fr })}
              </div>
              <div className="text-primary-600 dark:text-primary-400 font-bold text-[10px]">→</div>
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 px-2 py-1 bg-white dark:bg-gray-700 rounded-lg shadow-sm dark:shadow-md text-center transition-all duration-200 whitespace-nowrap">
                {format(dateRange.end, 'dd/MM/yyyy', { locale: fr })}
              </div>
              <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
                <i className="fas fa-calendar-check text-[10px]"></i>
              </div>
            </div>
          )}
          <div className="search-bar-wrapper">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>

        {/* 2. Slide de période */}
        {dateRange && (
          <div className="dashboard-date-slider-section">
            <DateRangeSlider
              minDate={minDate}
              maxDate={maxDate}
              startDate={dateRange.start}
              endDate={dateRange.end}
              onChange={handleDateRangeChange}
            />
          </div>
        )}

        {/* 3. Ligne : Solde Total - Total des dépenses - Total des Revenus */}
        <CollapsibleSection
          title={t('dashboard.infoBoxes', 'Infos')}
          icon={faWallet}
          isCollapsed={isInfoCardsCollapsed}
          onToggle={() => setIsInfoCardsCollapsed(!isInfoCardsCollapsed)}
          contentId="dashboard-info-cards-content"
        >
          <div className="main-cards">
            {/* Carte Solde Total */}
            <div className="stat-card stat-card-balance">
              <div className="stat-card-body">
                <h5 className="stat-card-title">
                  <FontAwesomeIcon icon={faWallet} />
                  {t('dashboard.totalBalance')}
                </h5>
                <p className="stat-card-value">{formatCurrency(totalBalance)}</p>
              </div>
            </div>

            {/* Carte Dépenses */}
            <div className="stat-card stat-card-expenses">
              <div className="stat-card-body">
                <h5 className="stat-card-title">
                  <FontAwesomeIcon icon={faMoneyBillWave} />
                  {t('dashboard.totalExpenses')}
                </h5>
                <p className="stat-card-value">{formatCurrency(stats?.totalExpenses || 0)}</p>
              </div>
            </div>

            {/* Carte Revenus */}
            <div className="stat-card stat-card-income">
              <div className="stat-card-body">
                <h5 className="stat-card-title">
                  <FontAwesomeIcon icon={faCoins} />
                  {t('dashboard.totalIncome')}
                </h5>
                <p className="stat-card-value">{formatCurrency(stats?.totalIncome || 0)}</p>
              </div>
            </div>
          </div>

          {/* 4. Lignes : Moyennes mensuelles par catégorie */}
          {categoryAverages.length > 0 && (
            <div className="dashboard-accounts-section">
              <MiniCategoryCards categories={categoryAverages} />
            </div>
          )}

          {/* 5. Lignes : Solde des comptes */}
          <div className="dashboard-accounts-section">
            <MiniAccountCards accounts={allAccounts} balances={accountBalances} />
          </div>
        </CollapsibleSection>

        {/* Indicateur de filtrage */}
        {isFiltering && (
          <div className="filtering-indicator">
            <Loading message={t('dashboard.filtering')} />
          </div>
        )}

        {/* 6. Graphique */}
        <CollapsibleSection
          title={t('dashboard.chartsSection', 'Graphiques')}
          icon={faCalendarAlt}
          isCollapsed={isChartsCollapsed}
          onToggle={() => setIsChartsCollapsed(!isChartsCollapsed)}
          contentId="dashboard-charts-content"
        >
          <div className="dashboard-charts-section">
            {/* Graphique Dépenses par catégorie */}
            <div className="chart-container">
              <h2>{t('dashboard.expensesByCategory')}</h2>
              {categoriesForChart.length > 0 ? (
                <ChartJsPieChart data={categoriesForChart} title={t('dashboard.expensesByCategory')} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">{t('common.loading')}</p>
                </div>
              )}
            </div>

            {/* Graphique Salaire vs Dépenses */}
            <div className="chart-container">
              <h2>{t('dashboard.incomeByCategory')}</h2>
              {stats ? (
                <IncomePieChart
                  income={stats.totalIncome}
                  expenses={stats.totalExpenses}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">{t('common.loading')}</p>
                </div>
              )}
            </div>

            {/* Graphique Évolution des soldes par compte */}
            <div className="chart-container">
              <h2>{t('dashboard.accountBalances')}</h2>
              {accountBalanceChartData && accountBalanceChartData.periods.length > 0 && accountBalanceChartData.balanceData.length > 0 ? (
                <AccountBalanceLineChart
                  periods={accountBalanceChartData.periods}
                  accounts={accountBalanceChartData.accounts}
                  balanceData={accountBalanceChartData.balanceData}
                  accountColors={accountBalanceChartData.accountColors}
                  granularity={accountBalanceChartData.granularity}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">{t('common.loading')}</p>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* 6. Tableau */}
        <CollapsibleSection
          title={t('dashboard.tableSection', 'Tableau')}
          icon={faTags}
          isCollapsed={isTableCollapsed}
          onToggle={() => setIsTableCollapsed(!isTableCollapsed)}
          contentId="dashboard-table-content"
        >
          <div className="table-section">
            <div className="table-header">
              <span className="transaction-count">
                {t('dashboard.displayingTransactions', { count: filteredTransactions.length })}
              </span>
            </div>
            <SortableTable
              key={`transactions-${filteredTransactions.length}-${filteredTransactions[0]?.id || 'empty'}`}
              transactions={filteredTransactions}
            />
          </div>
        </CollapsibleSection>
      </main>
    </div>
  );
};

export default Dashboard;
