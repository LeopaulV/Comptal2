import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { CategorySummary } from '../../services/StatsService';
import { formatMoney } from '../../utils/amounts';
import {
  chartAxisColor,
  chartGridCallback,
  chartTooltipTheme,
} from '../../utils/chartPastel';
import FinanceTable, { formatCellMoney, FinanceTableColumn, FinanceTableRow } from './FinanceTable';
import '../../utils/registerCharts';

type MixedDataset = {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  type?: 'bar' | 'line';
  order?: number;
  barPercentage?: number;
  categoryPercentage?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
  fill?: boolean;
  tension?: number;
};

interface MonthlyChartProps {
  periodLabels: string[];
  categories: string[];
  categoryColors: Record<string, string>;
  monthlyData: number[][];
  summaries: CategorySummary[];
}

const MonthlyChart: React.FC<MonthlyChartProps> = ({
  periodLabels,
  categories,
  categoryColors,
  monthlyData,
  summaries,
}) => {
  const { t } = useTranslation();
  const chartRef = useRef<ChartJS<'bar'>>(null);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const calculateYAxisLimits = useCallback((datasets: MixedDataset[]) => {
    const numMonths = datasets[0]?.data.length || 0;
    const monthlyTotals: { positive: number; negative: number }[] = [];
    for (let monthIndex = 0; monthIndex < numMonths; monthIndex++) {
      let positiveSum = 0;
      let negativeSum = 0;
      datasets.forEach((dataset) => {
        if (dataset.type === 'line') return;
        const value = dataset.data[monthIndex];
        if (value > 0) positiveSum += value;
        else negativeSum += value;
      });
      monthlyTotals.push({ positive: positiveSum, negative: negativeSum });
    }
    const maxPositive = Math.max(...monthlyTotals.map((x) => x.positive), 0);
    const minNegative = Math.min(...monthlyTotals.map((x) => x.negative), 0);
    const range = maxPositive - minNegative || 1;
    return { min: minNegative - range * 0.02, max: maxPositive + range * 0.02 };
  }, []);

  const monthlyTotals = useMemo(
    () =>
      periodLabels.map((_, monthIndex) =>
        monthlyData.reduce((total, cat) => total + (cat[monthIndex] || 0), 0)
      ),
    [monthlyData, periodLabels]
  );

  const barDatasets: MixedDataset[] = useMemo(
    () =>
      categories.map((category, index) => ({
        label: category,
        data: monthlyData[index] ?? [],
        backgroundColor: categoryColors[category] || '#808080',
        borderColor: 'rgba(0, 0, 0, 0.3)',
        borderWidth: 1,
        type: 'bar' as const,
        order: 1,
        barPercentage: 0.98,
        categoryPercentage: 0.98,
      })),
    [categories, monthlyData, categoryColors]
  );

  const lineDataset: MixedDataset = useMemo(
    () => ({
      label: t('financeGlobal.total'),
      data: monthlyTotals,
      backgroundColor: monthlyTotals.map((v) =>
        v >= 0 ? 'rgba(40, 167, 69, 0.6)' : 'rgba(220, 53, 69, 0.6)'
      ),
      borderColor: monthlyTotals.map((v) =>
        v >= 0 ? 'rgba(40, 167, 69, 0.8)' : 'rgba(220, 53, 69, 0.8)'
      ),
      borderWidth: 2,
      type: 'line' as const,
      pointRadius: 6,
      pointHoverRadius: 8,
      fill: false,
      order: 0,
      tension: 0.4,
    }),
    [monthlyTotals, t]
  );

  const initialLimits = useMemo(
    () => calculateYAxisLimits([...barDatasets, lineDataset]),
    [barDatasets, lineDataset, calculateYAxisLimits]
  );

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: chartAxisColor(isDarkMode),
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          stacked: true,
          min: initialLimits.min,
          max: initialLimits.max,
          ticks: {
            color: chartAxisColor(isDarkMode),
            callback: (value) => formatMoney(value as number),
          },
          grid: {
            color: chartGridCallback(isDarkMode),
            lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1),
          },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          onClick(e, legendItem, legend) {
            ChartJS.defaults.plugins.legend.onClick?.call(this, e, legendItem, legend);
            const chart = legend.chart;
            if (!chart) return;
            const visible = chart.data.datasets.filter((_, i) => !chart.getDatasetMeta(i).hidden);
            const limits = calculateYAxisLimits(visible as MixedDataset[]);
            if (chart.options.scales?.y) {
              chart.options.scales.y.min = limits.min;
              chart.options.scales.y.max = limits.max;
            }
            chart.update();
          },
          labels: { color: chartAxisColor(isDarkMode) },
        },
        tooltip: {
          ...chartTooltipTheme(isDarkMode),
          callbacks: {
            label(ctx) {
              const label = ctx.dataset.label || '';
              if (ctx.parsed.y !== null) return `${label}: ${formatMoney(Math.abs(ctx.parsed.y))}`;
              return label;
            },
          },
        },
      },
    }),
    [initialLimits, calculateYAxisLimits, isDarkMode]
  );

  const tableColumns: FinanceTableColumn[] = useMemo(
    () => [
      { key: 'code', label: t('financeGlobal.abbreviation'), sticky: true, width: 80 },
      { key: 'name', label: t('financeGlobal.fullName'), sticky: true, width: 200 },
      { key: 'avg', label: t('financeGlobal.average'), sticky: true, width: 110, align: 'right' },
      { key: 'sum', label: t('financeGlobal.sum'), sticky: true, width: 110, align: 'right' },
      ...periodLabels.map((label, i) => ({
        key: `p-${i}`,
        label,
        align: 'right' as const,
      })),
    ],
    [periodLabels, t]
  );

  const tableRows: FinanceTableRow[] = useMemo(() => {
    const rows: FinanceTableRow[] = summaries.map((cat, rowIndex) => {
      const catName = cat.categoryName;
      const dataRow = monthlyData[categories.indexOf(catName)] ?? [];
      const avg = cat.transactionCount > 0 ? cat.totalAmount / cat.transactionCount : 0;
      return {
        id: cat.categoryCode,
        isOdd: rowIndex % 2 !== 0,
        cells: [
          { content: cat.categoryCode },
          {
            content: (
              <span className="flex items-center gap-2">
                <span className="finance-color-dot" style={{ backgroundColor: cat.color }} />
                {cat.categoryName}
              </span>
            ),
          },
          { content: formatCellMoney(avg), align: 'right' },
          { content: formatCellMoney(cat.totalAmount), align: 'right' },
          ...dataRow.map((v) => ({
            content: formatCellMoney(v),
            value: v,
            colorize: true,
            align: 'right' as const,
          })),
        ],
      };
    });

    if (periodLabels.length > 0 && monthlyData.length > 0) {
      const totals = periodLabels.map((_, i) =>
        monthlyData.reduce((s, row) => s + (row[i] ?? 0), 0)
      );
      const grandTotal = totals.reduce((a, b) => a + b, 0);
      rows.push({
        id: 'total',
        isTotal: true,
        cells: [
          { content: t('financeGlobal.total'), align: 'left' },
          { content: '' },
          { content: '' },
          { content: formatCellMoney(grandTotal), align: 'right' },
          ...totals.map((v) => ({
            content: formatCellMoney(v),
            value: v,
            colorize: true,
            align: 'right' as const,
          })),
        ],
      });
    }
    return rows;
  }, [summaries, monthlyData, categories, periodLabels, t]);

  return (
    <>
      <div className="finance-global-chart-container chart-container-with-toolbar">
        <div className="chart active">
          <Bar
            ref={chartRef}
            data={{ labels: periodLabels, datasets: [...barDatasets, lineDataset] as never }}
            options={options}
          />
        </div>
      </div>
      <FinanceTable
        columns={tableColumns}
        rows={tableRows}
        stickyOffsets={[0, 80, 280, 390]}
      />
    </>
  );
};

export default MonthlyChart;
