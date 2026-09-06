import React from 'react';
import { useTranslation } from 'react-i18next';
import { Category } from '../../types/models';
import { CategoryTotal, KpiStats } from '../../services/StatsService';
import { ChartGranularity } from '../../types/projection';
import { DashboardChartWidgets, DashboardInsights, DonationsByDonorMode } from '../../types/dashboard';
import CategoryExpensesBarChart from './CategoryExpensesBarChart';
import IncomePieChart from './IncomePieChart';
import AccountBalanceLineChart from './AccountBalanceLineChart';
import ChartGranularityZoom from '../Common/ChartGranularityZoom';
import InvoiceVsPaymentChart from './InvoiceVsPaymentChart';
import InvoiceAgingChart from './InvoiceAgingChart';
import DonationsByDonorChart from './DonationsByDonorChart';

interface DashboardChartsPanelProps {
  catTotals: CategoryTotal[];
  categories: Category[];
  kpis: KpiStats;
  lineLabels: string[];
  lineSeries: Array<{ label: string; color: string; data: number[] }>;
  granularity: ChartGranularity;
  onGranularityChange: (granularity: ChartGranularity) => void;
  charts: DashboardChartWidgets;
  insights: DashboardInsights;
  donationsByDonorMode: DonationsByDonorMode;
  unlinkedInvoices: number;
  unlinkedDonations: number;
}

const DashboardChartsPanel: React.FC<DashboardChartsPanelProps> = ({
  catTotals,
  categories,
  kpis,
  lineLabels,
  lineSeries,
  granularity,
  onGranularityChange,
  charts,
  insights,
  donationsByDonorMode,
  unlinkedInvoices,
  unlinkedDonations,
}) => {
  const { t } = useTranslation();
  const showTreasuryRow = charts.expensesByCategory || charts.incomePie;

  return (
    <div className="dashboard-charts-section">
      {showTreasuryRow && (
        <div className="dashboard-charts-row-top">
          {charts.expensesByCategory && (
            <div className="chart-container chart-container-bar">
              <h2>{t('dashboard.chart.expensesByCategory')}</h2>
              <CategoryExpensesBarChart
                totals={catTotals}
                categories={categories}
                totalExpenses={Math.abs(kpis.expenses)}
              />
            </div>
          )}
          {charts.incomePie && (
            <div className="chart-container chart-container-pie">
              <h2>{t('dashboard.pieIncome')}</h2>
              <IncomePieChart income={kpis.income} expenses={kpis.expenses} />
            </div>
          )}
        </div>
      )}

      {charts.accountBalances && (
        <div className="chart-container chart-container-line full-width">
          <div className="chart-container-header">
            <h2>{t('dashboard.accountBalances')}</h2>
            <ChartGranularityZoom granularity={granularity} onChange={onGranularityChange} />
          </div>
          <AccountBalanceLineChart labels={lineLabels} series={lineSeries} granularity={granularity} />
        </div>
      )}

      {(charts.invoiceVsPayment || charts.invoiceAging) && (
        <div className={`dashboard-charts-row-invoicing${charts.invoiceVsPayment && charts.invoiceAging ? '' : ' is-single'}`}>
          {charts.invoiceVsPayment && (
            <div className="chart-container chart-container-line">
              <div className="chart-container-header">
                <h2>{t('dashboard.chart.invoiceVsPayment')}</h2>
                <ChartGranularityZoom granularity={granularity} onChange={onGranularityChange} />
              </div>
              {unlinkedInvoices > 0 && (
                <p className="dashboard-filter-notice">
                  {t('dashboard.filterNotice.invoices', { count: unlinkedInvoices })}
                </p>
              )}
              <InvoiceVsPaymentChart series={insights.invoicing.series} />
            </div>
          )}
          {charts.invoiceAging && (
            <div className="chart-container chart-container-aging">
              <h2>{t('dashboard.chart.invoiceAging')}</h2>
              <InvoiceAgingChart aging={insights.invoicing.aging} />
            </div>
          )}
        </div>
      )}

      {charts.donationsByDonor && (
        <div className="chart-container chart-container-line full-width">
          <div className="chart-container-header">
            <h2>
              {donationsByDonorMode === 'cumulative'
                ? t('dashboard.chart.donationsByDonorCumulative')
                : t('dashboard.chart.donationsByDonor')}
            </h2>
            <ChartGranularityZoom granularity={granularity} onChange={onGranularityChange} />
          </div>
          {unlinkedDonations > 0 && (
            <p className="dashboard-filter-notice">
              {t('dashboard.filterNotice.donations', { count: unlinkedDonations })}
            </p>
          )}
          <DonationsByDonorChart labels={insights.association.labels} donors={insights.association.donors} />
        </div>
      )}
    </div>
  );
};

export default DashboardChartsPanel;
