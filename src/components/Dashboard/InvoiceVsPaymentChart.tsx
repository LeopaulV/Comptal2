import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';
import { formatMoney } from '../../utils/amounts';
import { useTheme } from '../../hooks/useTheme';
import { InvoicePeriodSeries } from '../../types/dashboard';
import { dashboardChartTheme, dashboardTooltipOptions } from '../../utils/dashboardChartTheme';
import '../../utils/registerCharts';

interface InvoiceVsPaymentChartProps {
  series: InvoicePeriodSeries;
}

const InvoiceVsPaymentChart: React.FC<InvoiceVsPaymentChartProps> = ({ series }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const colors = dashboardChartTheme(isDarkMode);

  const hasData = series.labels.length > 0 && (
    series.invoiced.some((value) => value > 0) || series.collected.some((value) => value > 0)
  );

  const chartData = useMemo(
    () =>
      ({
        labels: series.labels,
        datasets: [
          {
            type: 'bar' as const,
            label: t('dashboard.invoicing.invoiced'),
            data: series.invoiced,
            backgroundColor: colors.primary,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            type: 'bar' as const,
            label: t('dashboard.invoicing.collected'),
            data: series.collected,
            backgroundColor: colors.muted,
            borderColor: colors.primaryLight,
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            type: 'line' as const,
            label: t('dashboard.invoicing.collectionRate'),
            data: series.collectionRate,
            borderColor: colors.pastelAccent,
            backgroundColor: colors.pastelAccent,
            borderWidth: 3,
            yAxisID: 'y1',
            tension: 0.25,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: colors.pastelAccent,
            pointBorderColor: colors.primary,
            pointBorderWidth: 2,
          },
        ],
      }) as ChartData<'bar'>,
    [series, colors, t]
  );

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: colors.text, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          ...dashboardTooltipOptions(colors),
          callbacks: {
            label(context) {
              const label = context.dataset.label ?? '';
              const value = Number(context.parsed.y ?? 0);
              if (context.dataset.yAxisID === 'y1') {
                return `${label} : ${value.toFixed(1)} %`;
              }
              return `${label} : ${formatMoney(value)}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: colors.text, maxRotation: 45 }, grid: { color: colors.grid } },
        y: {
          beginAtZero: true,
          ticks: { color: colors.text, callback: (value) => formatMoney(Number(value)) },
          grid: { color: colors.grid },
        },
        y1: {
          beginAtZero: true,
          max: 100,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: colors.text, callback: (value) => `${value} %` },
        },
      },
    }),
    [colors]
  );

  if (!hasData) {
    return <div className="chart-empty"><p>{t('dashboard.noChartData')}</p></div>;
  }

  return (
    <div className="chart-canvas-wrap">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default InvoiceVsPaymentChart;
