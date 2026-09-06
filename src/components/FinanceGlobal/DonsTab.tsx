import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import { AssociationInsights } from '../../types/dashboard';
import { formatMoney } from '../../utils/amounts';
import { useTheme } from '../../hooks/useTheme';
import {
  chartAxisColor,
  chartGridColor,
  chartPastel,
  chartPastelNamed,
  chartSurfaceColor,
  chartTooltipTheme,
} from '../../utils/chartPastel';
import '../../utils/registerCharts';
import FinanceInsightKpis from './FinanceInsightKpis';

interface DonsTabProps {
  data: AssociationInsights;
}

const DonsTab: React.FC<DonsTabProps> = ({ data }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axis = chartAxisColor(isDark);
  const grid = chartGridColor(isDark);
  const tooltip = chartTooltipTheme(isDark);
  const surface = chartSurfaceColor(isDark);

  const topDonors = useMemo(
    () =>
      [...data.donors]
        .map((donor) => ({ ...donor, total: donor.data.reduce((sum, value) => sum + value, 0) }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    [data.donors]
  );

  const barData = useMemo(
    () => ({
      labels: data.labels,
      datasets: topDonors.map((donor, index) => ({
        label: donor.label,
        data: donor.data,
        backgroundColor: chartPastel(index),
        borderWidth: 0,
      })),
    }),
    [data.labels, topDonors, isDark]
  );

  const barOptions: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { color: axis, boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          ...tooltip,
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label} : ${formatMoney(Number(ctx.parsed.y ?? 0))}`;
            },
          },
        },
      },
      scales: {
        x: { ticks: { color: axis, maxRotation: 45 }, grid: { color: grid } },
        y: {
          beginAtZero: true,
          ticks: { color: axis, callback: (value) => formatMoney(Number(value)) },
          grid: { color: grid },
        },
      },
    }),
    [axis, grid, tooltip]
  );

  const issued = Math.max(0, data.count - data.receiptsPending);
  const doughnutValues = [issued, data.receiptsPending];
  const doughnutTotal = doughnutValues.reduce((sum, value) => sum + value, 0);
  const doughnutData = useMemo(() => {
    const labels = [t('financeGlobal.receiptsIssued'), t('dashboard.association.receiptsPending')];
    const colors = [chartPastelNamed('green'), chartPastelNamed('orange')];
    const chartLabels: string[] = [];
    const chartValues: number[] = [];
    const chartColors: string[] = [];
    const sep = doughnutTotal * 0.015;
    doughnutValues.forEach((value, index) => {
      if (value <= 0) return;
      chartLabels.push(labels[index]!);
      chartValues.push(value);
      chartColors.push(colors[index]!);
      if (sep > 0) {
        chartLabels.push('');
        chartValues.push(sep);
        chartColors.push(surface);
      }
    });
    return {
      labels: chartLabels,
      datasets: [{ data: chartValues, backgroundColor: chartColors, borderWidth: 0 }],
    };
  }, [doughnutTotal, doughnutValues, surface, t, isDark]);

  const doughnutOptions: ChartOptions<'doughnut'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: axis,
            filter: (item) => Boolean(item.text),
          },
        },
        tooltip: {
          ...tooltip,
          filter: (item) => Boolean(item.label),
          callbacks: {
            label(ctx) {
              const value = Number(ctx.parsed);
              const pct = doughnutTotal > 0 ? ((value / doughnutTotal) * 100).toFixed(1) : '0';
              return `${ctx.label} : ${value} (${pct} %)`;
            },
          },
        },
      },
    }),
    [axis, tooltip, doughnutTotal]
  );

  const hasBars = topDonors.some((donor) => donor.total > 0);

  return (
    <div className="finance-insight-tab">
      <FinanceInsightKpis
        items={[
          { id: 'total', label: t('dashboard.association.total'), value: formatMoney(data.total) },
          { id: 'count', label: t('dashboard.association.section'), value: String(data.count) },
          { id: 'donors', label: t('dashboard.association.donors'), value: String(data.donorCount) },
          { id: 'average', label: t('dashboard.association.average'), value: formatMoney(data.average) },
          {
            id: 'retention',
            label: t('dashboard.association.retention'),
            value: data.retentionRate == null ? '—' : `${data.retentionRate.toFixed(1)} %`,
          },
        ]}
      />
      <div className="finance-insight-charts">
        <div className="finance-global-chart-container finance-insight-chart">
          <h3>{t('financeGlobal.donorsEvolution')}</h3>
          {hasBars ? (
            <div className="finance-insight-canvas">
              <Bar data={barData} options={barOptions} />
            </div>
          ) : (
            <p className="finance-empty-inline">{t('dashboard.noChartData')}</p>
          )}
        </div>
        <div className="finance-global-chart-container finance-insight-chart">
          <h3>{t('financeGlobal.receiptsSplit')}</h3>
          {doughnutTotal > 0 ? (
            <div className="finance-insight-canvas">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          ) : (
            <p className="finance-empty-inline">{t('dashboard.noChartData')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DonsTab;
