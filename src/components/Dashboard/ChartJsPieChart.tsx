import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pie } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { Category } from '../../types/models';
import { CategoryTotal } from '../../services/StatsService';
import { formatMoney } from '../../utils/amounts';
import { useTheme } from '../../hooks/useTheme';
import { dashboardChartTheme, dashboardTooltipOptions } from '../../utils/dashboardChartTheme';
import '../../utils/registerCharts';

interface ChartJsPieChartProps {
  totals: CategoryTotal[];
  categories: Category[];
}

const ChartJsPieChart: React.FC<ChartJsPieChartProps> = React.memo(({ totals, categories }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const colors = dashboardChartTheme(isDarkMode);
  const byCode = useMemo(() => new Map(categories.map((c) => [c.code, c])), [categories]);
  const filtered = totals.filter(
    (item) => item.categoryCode && item.categoryCode !== 'X' && item.categoryCode !== 'Y'
  );

  const chartData = useMemo(
    () => ({
      labels: filtered.map((item) => byCode.get(item.categoryCode ?? '')?.name ?? item.categoryCode ?? ''),
      datasets: [
        {
          data: filtered.map((item) => Math.abs(item.expenses || item.net)),
          backgroundColor: filtered.map(
            (item) => byCode.get(item.categoryCode ?? '')?.color ?? colors.primaryLight
          ),
          borderColor: filtered.map(
            (item) => byCode.get(item.categoryCode ?? '')?.color ?? colors.primaryLight
          ),
          borderWidth: 2,
        },
      ],
    }),
    [filtered, byCode, colors.primaryLight]
  );

  const options: ChartOptions<'pie'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 15,
            padding: 15,
            font: { size: 12 },
            color: colors.text,
          },
        },
        tooltip: {
          ...dashboardTooltipOptions(colors),
          padding: 10,
          callbacks: {
            label(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return t('chart.tooltipLabelWithPercentage', {
                label,
                value: formatMoney(value),
                percentage,
              });
            },
          },
        },
      },
      animation: {
        animateScale: true,
        animateRotate: true,
      },
    }),
    [isDarkMode, colors, t]
  );

  if (filtered.length === 0) {
    return (
      <div className="chart-empty">
        <p>{t('dashboard.noChartData')}</p>
      </div>
    );
  }

  return (
    <div className="chart-canvas-wrap">
      <Pie data={chartData} options={options} />
    </div>
  );
});

ChartJsPieChart.displayName = 'ChartJsPieChart';
export default ChartJsPieChart;
