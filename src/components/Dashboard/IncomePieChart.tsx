import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pie } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { formatMoney } from '../../utils/amounts';
import { useTheme } from '../../hooks/useTheme';
import { dashboardChartTheme, dashboardTooltipOptions } from '../../utils/dashboardChartTheme';
import '../../utils/registerCharts';

interface IncomePieChartProps {
  income: number;
  expenses: number;
}

const IncomePieChart: React.FC<IncomePieChartProps> = React.memo(({ income, expenses }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const colors = dashboardChartTheme(isDarkMode);
  const incomeColor = isDarkMode ? colors.primaryLight : colors.primary;
  const expensesColor = colors.muted;
  const absExpenses = Math.abs(expenses);

  const chartData = useMemo(
    () => ({
      labels: [t('chart.incomeLabel'), t('chart.expensesLabel')],
      datasets: [
        {
          data: [income, absExpenses],
          backgroundColor: [incomeColor, expensesColor],
          borderColor: [incomeColor, expensesColor],
          borderWidth: 2,
        },
      ],
    }),
    [income, absExpenses, incomeColor, expensesColor, t]
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
              const total = income + absExpenses;
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
    [isDarkMode, colors, t, income, absExpenses]
  );

  if (income === 0 && absExpenses === 0) {
    return (
      <div className="chart-empty">
        <p>{t('dashboard.noChartData')}</p>
      </div>
    );
  }

  return (
    <div className="chart-canvas-wrap" style={{ height: 280 }}>
      <Pie data={chartData} options={options} />
    </div>
  );
});

IncomePieChart.displayName = 'IncomePieChart';
export default IncomePieChart;
