import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faChartArea } from '@fortawesome/free-solid-svg-icons';
import { Loading, EmptyState } from '../../components/Common';
import { DataService } from '../../services/DataService';
import { CategorySummary } from '../../types/Category';
import { AccountSummary } from '../../types/Account';
import { formatCurrency } from '../../utils/format';
import MonthlyBarChart from '../../components/FinanceGlobal/MonthlyBarChart';
import BalanceStackedChart from '../../components/FinanceGlobal/BalanceStackedChart';
import '../../styles/finance-global-custom.css';

const FinanceGlobal: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [activeChart, setActiveChart] = useState<'monthly' | 'balance'>('monthly');
  
  // Données pour les graphiques
  const [monthlyCategoryData, setMonthlyCategoryData] = useState<{
    months: string[];
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [categoriesData, accountsData, categoryChartData, accountChartData] = await Promise.all([
        DataService.getCategorySummaries(),
        DataService.getAccountSummaries(),
        DataService.getMonthlyCategoryData(),
        DataService.getMonthlyAccountData(),
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
  };

  if (isLoading) {
    return <Loading message={t('financeGlobal.loading')} />;
  }

  // Détecter l'absence de données
  const hasNoData = categories.length === 0 && accounts.length === 0;

  // Afficher EmptyState si aucune donnée n'est disponible
  if (hasNoData) {
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
        </div>
      </div>

      {/* Conteneur des graphiques */}
      <div className="finance-global-chart-container">
        {activeChart === 'monthly' && monthlyCategoryData && (
          <div className="chart active">
            <MonthlyBarChart
              months={monthlyCategoryData.months}
              categories={monthlyCategoryData.categories}
              monthlyData={monthlyCategoryData.monthlyData}
              categoryColors={monthlyCategoryData.categoryColors}
            />
          </div>
        )}
        {activeChart === 'balance' && monthlyAccountData && (
          <div className="chart active">
            <BalanceStackedChart
              months={monthlyAccountData.months}
              accounts={monthlyAccountData.accounts}
              monthlyData={monthlyAccountData.monthlyData}
              accountColors={monthlyAccountData.accountColors}
            />
          </div>
        )}
      </div>

      {/* Tableau des catégories ou comptes selon l'onglet actif */}
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
                {(activeChart === 'monthly' ? monthlyCategoryData?.months : monthlyAccountData?.months)?.map((month, index) => (
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
                        {monthlyCategoryData?.months.map((month, index) => {
                          // Trouver l'index de cette catégorie dans les données
                          const catIndex = monthlyCategoryData.categories.indexOf(category.categoryName);
                          const value = catIndex >= 0 && monthlyCategoryData.monthlyData[catIndex] 
                            ? monthlyCategoryData.monthlyData[catIndex][monthlyCategoryData.months.indexOf(month)] || 0
                            : 0;
                          
                          return (
                            <td 
                              key={index} 
                              className="text-right"
                              style={getColorStyle(value)}
                            >
                              <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {value !== 0 ? formatCurrency(Math.abs(value)) : '-'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Ligne Total pour les catégories */}
                  {monthlyCategoryData && (() => {
                    const totalRow = {
                      categoryCode: 'Total',
                      categoryName: 'Total',
                      avgAmount: categories.reduce((sum, cat) => {
                        const avg = cat.totalAmount / (cat.transactionCount || 1);
                        return sum + avg;
                      }, 0) / (categories.length || 1),
                      totalAmount: categories.reduce((sum, cat) => sum + cat.totalAmount, 0),
                      monthlyValues: monthlyCategoryData.months.map((_, monthIndex) => 
                        monthlyCategoryData.monthlyData.reduce((sum, catData) => 
                          sum + (catData[monthIndex] || 0), 0
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
                              {value !== 0 ? formatCurrency(Math.abs(value)) : '-'}
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
                        {monthlyAccountData?.months.map((_, index) => {
                          const value = accountIndex >= 0 && monthlyAccountData.monthlyData[accountIndex]
                            ? monthlyAccountData.monthlyData[accountIndex][index] || 0
                            : 0;
                          
                          return (
                            <td 
                              key={index} 
                              className="text-right"
                              style={getColorStyle(value)}
                            >
                              <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {value !== 0 ? formatCurrency(Math.abs(value)) : '-'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Ligne Total pour les comptes */}
                  {monthlyAccountData && (() => {
                    const totalMonthlyValues = monthlyAccountData.months.map((_, monthIndex) => 
                      monthlyAccountData.monthlyData.reduce((sum, accountData) => 
                        sum + (accountData[monthIndex] || 0), 0
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
                              {value !== 0 ? formatCurrency(Math.abs(value)) : '-'}
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
    </div>
  );
};

export default FinanceGlobal;

