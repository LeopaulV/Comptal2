import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { formatMoney } from '../../utils/amounts';
import { useTheme } from '../../hooks/useTheme';
import { InvoiceAgingBuckets } from '../../types/dashboard';
import { agingColors, dashboardChartTheme, dashboardTooltipOptions } from '../../utils/dashboardChartTheme';
import '../../utils/registerCharts';

interface InvoiceAgingChartProps {
  aging: InvoiceAgingBuckets;
}

const InvoiceAgingChart: React.FC<InvoiceAgingChartProps> = ({ aging }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const colors = dashboardChartTheme(isDarkMode);
  const bucketColors = agingColors(isDarkMode);
  const total = aging.current + aging.d1to30 + aging.d31to60 + aging.d61to90 + aging.d90plus;

  const chartData = useMemo(
    () => ({
      labels: [t('dashboard.invoicing.outstanding')],
      datasets: [
        {
          label: t('dashboard.invoicing.aging.current'),
          data: [aging.current],
          backgroundColor: bucketColors[0],
        },
        {
          label: t('dashboard.invoicing.aging.d1to30'),
          data: [aging.d1to30],
          backgroundColor: bucketColors[1],
        },
        {
          label: t('dashboard.invoicing.aging.d31to60'),
          data: [aging.d31to60],
          backgroundColor: bucketColors[2],
        },
        {
          label: t('dashboard.invoicing.aging.d61to90'),
          data: [aging.d61to90],
          backgroundColor: bucketColors[3],
        },
        {
          label: t('dashboard.invoicing.aging.d90plus'),
          data: [aging.d90plus],
          backgroundColor: bucketColors[4],
        },
      ],
    }),
    [aging, bucketColors, t]
  );

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: colors.text, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          ...dashboardTooltipOptions(colors),
          callbacks: {
            label(context) {
              const value = Number(context.parsed.x ?? 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `${context.dataset.label} : ${formatMoney(value)} (${pct} %)`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: colors.text, callback: (value) => formatMoney(Number(value)) },
          grid: { color: colors.grid },
        },
        y: { stacked: true, ticks: { color: colors.text }, grid: { display: false } },
      },
    }),
    [colors, total]
  );

  if (total <= 0) {
    return <div className="chart-empty"><p>{t('dashboard.noChartData')}</p></div>;
  }

  return (
    <div className="chart-canvas-wrap chart-canvas-wrap-aging">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default InvoiceAgingChart;
