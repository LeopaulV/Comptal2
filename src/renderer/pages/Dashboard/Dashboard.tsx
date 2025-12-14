import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWallet, 
  faMoneyBillWave, 
  faCoins,
  faFileExport,
  faCalendarAlt,
  faRefresh,
  faUniversity,
  faTags
} from '@fortawesome/free-solid-svg-icons';
import { Loading, EmptyState } from '../../components/Common';
import MiniAccountCards from '../../components/Dashboard/MiniAccountCards';
import DateRangeSlider from '../../components/Common/DateRangeSlider';
import ChartJsPieChart from '../../components/Dashboard/ChartJsPieChart';
import IncomePieChart from '../../components/Dashboard/IncomePieChart';
import SortableTable from '../../components/Common/SortableTable';
import FilterBox from '../../components/Dashboard/FilterBox';
import SearchBar from '../../components/Dashboard/SearchBar';
import { DataService } from '../../services/DataService';
import { CSVService } from '../../services/CSVService';
import { ConfigService } from '../../services/ConfigService';
import { AccountSummary } from '../../types/Account';
import { CategorySummary } from '../../types/Category';
import { Transaction, TransactionStats } from '../../types/Transaction';
import { formatCurrency } from '../../utils/format';
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
  
  // Abréviations pour l'affichage
  const [accountAbbreviations, setAccountAbbreviations] = useState<Record<string, string>>({});
  const [categoryAbbreviations, setCategoryAbbreviations] = useState<Record<string, string>>({});

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

      // Mettre à jour tous les états
      setFilteredTransactions(result.transactions);
      setStats(result.stats);
      setFilteredCategories(result.categorySummaries);
      setAccountBalances(balances);
      
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

  const handleRefresh = async () => {
    await DataService.reload();
    await loadInitialData();
  };

  const handleExport = async () => {
    try {
      const filename = `export_dashboard_${new Date().toISOString().split('T')[0]}.csv`;
      await CSVService.exportToCSV(filteredTransactions, `data/${filename}`);
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
      {/* Colonne Gauche - 60% */}
      <div className="left-column">
        {/* Header avec bouton d'export */}
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
          <button 
            onClick={handleExport}
            className="export-button"
            title={t('dashboard.exportTitle')}
          >
            <FontAwesomeIcon icon={faFileExport} size="lg" />
          </button>
        </div>

        {/* Cartes principales de statistiques */}
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

        {/* Mini-cartes de soldes par compte */}
        <MiniAccountCards accounts={allAccounts} balances={accountBalances} />

        {/* Filtres */}
        <div className="filters">
          {/* Barre de recherche - En haut pour plus de visibilité */}
          <div className="search-row">
            <SearchBar onSearch={handleSearch} />
          </div>

          <div className="filters-row">
            {/* Filtre Comptes */}
            <div className="filter-column accounts-filter">
              <FilterBox
                title={t('dashboard.accounts')}
                icon={faUniversity}
                items={accountFilterItems}
                onToggle={handleAccountToggle}
                onToggleAll={handleAccountToggleAll}
              />
            </div>

            {/* Date Range Slider */}
            <div className="filter-column date-range-filter">
              <div className="date-range-wrapper">
                <div className="date-range-header">
                  <h5 className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendarAlt} className="text-primary-600" />
                    {t('dashboard.dateRange')}
                  </h5>
                  <button 
                    onClick={handleRefresh}
                    className="refresh-button"
                    title={t('dashboard.refreshTitle')}
                  >
                    <FontAwesomeIcon icon={faRefresh} className="text-[12px]" />
                  </button>
                </div>
                <div className="date-range-slider"><DateRangeSlider
                    minDate={minDate}
                    maxDate={maxDate}
                    onChange={handleDateRangeChange}
                  /></div>
              </div>
            </div>

            {/* Filtre Catégories */}
            <div className="filter-column categories-filter">
              <FilterBox
                title={t('dashboard.categories')}
                icon={faTags}
                items={categoryFilterItems}
                onToggle={handleCategoryToggle}
                onToggleAll={handleCategoryToggleAll}
              />
            </div>
          </div>
        </div>

        {/* Indicateur de filtrage */}
        {isFiltering && (
          <div className="filtering-indicator">
            <Loading message={t('dashboard.filtering')} />
          </div>
        )}

        {/* Tableau des transactions triable */}
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
      </div>

      {/* Colonne Droite - 40% */}
      <div className="right-column">
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
      </div>
    </div>
  );
};

export default Dashboard;
