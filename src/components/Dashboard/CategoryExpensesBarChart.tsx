import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { useTranslation } from 'react-i18next';
import { Category } from '../../types/models';
import { CategoryTotal } from '../../services/StatsService';
import { formatMoney } from '../../utils/amounts';
import { useTheme } from '../../hooks/useTheme';
import { dashboardChartTheme, dashboardTooltipOptions } from '../../utils/dashboardChartTheme';
import '../../utils/registerCharts';

interface CategoryExpensesBarChartProps {
  totals: CategoryTotal[];
  categories: Category[];
  totalExpenses: number;
}

const CategoryExpensesBarChart: React.FC<CategoryExpensesBarChartProps> = React.memo(
  ({ totals, categories, totalExpenses }) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    const colors = dashboardChartTheme(isDarkMode);
    const byCode = useMemo(() => new Map(categories.map((c) => [c.code, c])), [categories]);

    const filtered = useMemo(
      () =>
        totals
          .filter((item) => item.categoryCode && item.categoryCode !== 'X' && item.categoryCode !== 'Y')
          .map((item) => ({ ...item, expenseAmount: Math.abs(item.expenses) }))
          .filter((item) => item.expenseAmount > 0)
          .sort((a, b) => b.expenseAmount - a.expenseAmount),
      [totals]
    );

    const chartHeight = Math.min(Math.max(filtered.length * 40, 200), 400);

    const chartData = useMemo(
      () => ({
        labels: filtered.map(
          (item) => byCode.get(item.categoryCode ?? '')?.name ?? item.categoryCode ?? ''
        ),
        datasets: [
          {
            data: filtered.map((item) => item.expenseAmount),
            backgroundColor: filtered.map(
              (item) => byCode.get(item.categoryCode ?? '')?.color ?? colors.primaryLight
            ),
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      }),
      [filtered, byCode, colors.primaryLight]
    );

    const options = useMemo<ChartOptions<'bar'>>(
      () => ({
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...dashboardTooltipOptions(colors),
            callbacks: {
              label: (ctx) => {
                const value = ctx.parsed.x ?? 0;
                const pct =
                  totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : '0';
                return t('chart.tooltipLabelWithPercentage', {
                  label: ctx.label ?? '',
                  value: formatMoney(value),
                  percentage: pct,
                });
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: colors.text,
              callback: (value) => formatMoney(Number(value)),
            },
            grid: {
              color: colors.grid,
            },
          },
          y: {
            ticks: {
              color: colors.text,
              autoSkip: false,
              font: { size: 11 },
            },
            grid: { display: false },
          },
        },
      }),
      [totalExpenses, t, isDarkMode, colors]
    );

    if (filtered.length === 0) {
      return (
        <div className="chart-empty-state">
          <p>{t('dashboard.noChartData')}</p>
        </div>
      );
    }

    return (
      <div className="chart-scroll-wrapper" style={{ maxHeight: 400 }}>
        <div style={{ height: chartHeight, minHeight: 200 }}>
          <Bar data={chartData} options={options} />
        </div>
      </div>
    );
  }
);

CategoryExpensesBarChart.displayName = 'CategoryExpensesBarChart';
export default CategoryExpensesBarChart;
