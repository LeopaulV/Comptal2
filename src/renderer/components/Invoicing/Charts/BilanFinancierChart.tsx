import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearchPlus, faSearchMinus } from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Devis, Facture } from '../../../types/Invoice';
import { Transaction } from '../../../types/Transaction';
import { Project, CategoryChargesData } from '../../../types/ProjectManagement';
import {
  ChartGranularity,
  getPeriodKey,
  getPeriodLabel,
  getPeriodKeysInRange,
  sortPeriodKeys,
  DataService,
} from '../../../services/DataService';
import { ProjectionService } from '../../../services/ProjectionService';
import { categoryChargesToBilanFormat } from '../../../utils/categoryCharges';
import { StockService } from '../../../services/StockService';
import { formatCurrency } from '../../../utils/format';
import '../../../styles/finance-global-custom.css';

ChartJS.register(...registerables);

/** Motif hachuré diagonal pour distinguer les dépenses des recettes */
function createHatchingPattern(
  ctx: CanvasRenderingContext2D,
  baseColor: string,
  isDarkMode: boolean
): CanvasPattern | null {
  const size = 10;
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = size;
  patternCanvas.height = size;
  const pctx = patternCanvas.getContext('2d');
  if (!pctx) return null;

  pctx.fillStyle = baseColor;
  pctx.fillRect(0, 0, size, size);

  const lineColor = isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.55)';
  pctx.strokeStyle = lineColor;
  pctx.lineWidth = 1.2;
  pctx.beginPath();
  pctx.moveTo(0, 0);
  pctx.lineTo(size, size);
  pctx.moveTo(size / 2, 0);
  pctx.lineTo(size, size / 2);
  pctx.moveTo(0, size / 2);
  pctx.lineTo(size / 2, size);
  pctx.stroke();

  return ctx.createPattern(patternCanvas, 'repeat');
}

const GRANULARITY_LABELS: Record<ChartGranularity, string> = {
  day: 'granularityDay',
  week: 'granularityWeek',
  month: 'granularityMonth',
  quarter: 'granularityQuarter',
  semester: 'granularitySemester',
  year: 'granularityYear',
};

interface BilanFinancierChartProps {
  devis: Devis[];
  factures: Facture[];
  transactions?: Transaction[];
  entrepriseProject?: Project | null;
  categoryChargesData?: CategoryChargesData | null;
}

interface PeriodData {
  periodKey: string;
  devisAmount: number;
  invoicesAmount: number;
  paymentsAmount: number;
  chargesByCategory: Record<string, number>;
  achatsAmount: number;
}

const BilanFinancierChart: React.FC<BilanFinancierChartProps> = ({
  devis = [],
  factures,
  transactions = [],
  entrepriseProject,
  categoryChargesData,
}) => {
  const { t } = useTranslation();
  const [granularity, setGranularity] = useState<ChartGranularity>('month');
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [dateInputStart, setDateInputStart] = useState<string>('');
  const [dateInputEnd, setDateInputEnd] = useState<string>('');
  const [achatsByPeriod, setAchatsByPeriod] = useState<{ periodKeys: string[]; amounts: number[] } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    StockService.getAchatsByPeriod(granularity, dateRange.start, dateRange.end).then(setAchatsByPeriod);
  }, [granularity, dateRange.start, dateRange.end]);

  const handleZoomIn = useCallback(() => {
    const next = DataService.getNextGranularity(granularity);
    if (next) setGranularity(next);
  }, [granularity]);

  const handleZoomOut = useCallback(() => {
    const prev = DataService.getPreviousGranularity(granularity);
    if (prev) setGranularity(prev);
  }, [granularity]);

  const handleDateRangeApply = useCallback(() => {
    const start = dateInputStart ? new Date(dateInputStart) : null;
    const end = dateInputEnd ? new Date(dateInputEnd) : null;
    if (start && end && start > end) {
      setDateRange({ start: end, end: start });
      setDateInputStart(dateInputEnd);
      setDateInputEnd(dateInputStart);
    } else {
      setDateRange({ start, end });
    }
  }, [dateInputStart, dateInputEnd]);

  const handleDateRangeReset = useCallback(() => {
    setDateInputStart('');
    setDateInputEnd('');
    setDateRange({ start: null, end: null });
  }, []);

  const canZoomIn = DataService.getNextGranularity(granularity) !== null;
  const canZoomOut = DataService.getPreviousGranularity(granularity) !== null;

  const periodData = useMemo((): PeriodData[] => {
    const dateFrom = dateRange.start;
    const dateTo = dateRange.end;

    let periodKeys: string[];
    if (dateFrom && dateTo) {
      periodKeys = getPeriodKeysInRange(dateFrom, dateTo, granularity);
    } else {
      const keysSet = new Set<string>();
      devis.filter((d) => !d.supprime).forEach((d) => keysSet.add(getPeriodKey(new Date(d.dateEmission), granularity)));
      factures.forEach((f) => keysSet.add(getPeriodKey(new Date(f.dateEmission), granularity)));
      factures.forEach((f) =>
        f.paiements.forEach((p) => keysSet.add(getPeriodKey(new Date(p.datePaiement), granularity)))
      );
      if (categoryChargesData?.totalByMonth && Object.keys(categoryChargesData.totalByMonth).length > 0) {
        const agg = categoryChargesToBilanFormat(categoryChargesData, granularity, null, null);
        agg.periodKeys.forEach((k) => keysSet.add(k));
      } else if (entrepriseProject?.subscriptions?.length) {
        try {
          const proj = ProjectionService.calculateProjection(
            entrepriseProject.subscriptions,
            entrepriseProject.projectionConfig
          );
          proj.forEach((p) => keysSet.add(getPeriodKey(p.date, granularity)));
        } catch {
          // ignore
        }
      }
      if (achatsByPeriod?.periodKeys?.length) {
        achatsByPeriod.periodKeys.forEach((k) => keysSet.add(k));
      }
      periodKeys = sortPeriodKeys(Array.from(keysSet), granularity);
      if (periodKeys.length === 0) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        periodKeys = getPeriodKeysInRange(start, now, granularity);
      }
    }

    const dataMap = new Map<string, PeriodData>();
    periodKeys.forEach((k) =>
      dataMap.set(k, {
        periodKey: k,
        devisAmount: 0,
        invoicesAmount: 0,
        paymentsAmount: 0,
        chargesByCategory: {},
        achatsAmount: 0,
      })
    );

    devis.filter((d) => !d.supprime).forEach((d) => {
      const k = getPeriodKey(new Date(d.dateEmission), granularity);
      const entry = dataMap.get(k);
      if (entry) entry.devisAmount += d.totalTTC;
    });

    factures.forEach((f) => {
      const k = getPeriodKey(new Date(f.dateEmission), granularity);
      const entry = dataMap.get(k);
      if (entry) entry.invoicesAmount += f.totalTTC;
    });

    factures.forEach((f) => {
      f.paiements.forEach((p) => {
        const k = getPeriodKey(new Date(p.datePaiement), granularity);
        const entry = dataMap.get(k);
        if (entry) entry.paymentsAmount += p.montant;
      });
    });

    if (categoryChargesData && categoryChargesData.categories.length > 0) {
      const agg = categoryChargesToBilanFormat(
        categoryChargesData,
        granularity,
        dateFrom,
        dateTo
      );
      agg.periodKeys.forEach((pk, pi) => {
        const entry = dataMap.get(pk);
        if (entry) {
          agg.categories.forEach((cat, ci) => {
            const val = agg.monthlyData[ci]?.[pi] ?? 0;
            if (val > 0) {
              entry.chargesByCategory[cat] = (entry.chargesByCategory[cat] ?? 0) + val;
            }
          });
        }
      });
    } else if (entrepriseProject?.subscriptions?.length) {
      try {
        const agg = ProjectionService.aggregateChargesBySubscriptionAndPeriod(
          entrepriseProject.subscriptions,
          entrepriseProject.projectionConfig,
          granularity,
          dateFrom,
          dateTo
        );
        agg.periodKeys.forEach((pk, pi) => {
          const entry = dataMap.get(pk);
          if (entry) {
            agg.categories.forEach((cat, ci) => {
              const val = agg.monthlyData[ci]?.[pi] ?? 0;
              if (val > 0) {
                entry.chargesByCategory[cat] = (entry.chargesByCategory[cat] ?? 0) + val;
              }
            });
          }
        });
      } catch {
        // ignore
      }
    }

    if (achatsByPeriod?.periodKeys?.length) {
      achatsByPeriod.periodKeys.forEach((k, i) => {
        const entry = dataMap.get(k);
        if (entry) entry.achatsAmount += achatsByPeriod.amounts[i] ?? 0;
      });
    }

    return periodKeys.map((k) => dataMap.get(k)!);
  }, [
    devis,
    factures,
    entrepriseProject,
    categoryChargesData,
    granularity,
    dateRange.start,
    dateRange.end,
    achatsByPeriod,
  ]);

  const monthLabels = useMemo(
    () => periodData.map((p) => getPeriodLabel(p.periodKey, granularity)),
    [periodData, granularity]
  );

  const chargesBreakdown = useMemo(() => {
    if (categoryChargesData && categoryChargesData.categories.length > 0) {
      const agg = categoryChargesToBilanFormat(
        categoryChargesData,
        granularity,
        dateRange.start,
        dateRange.end
      );
      return { categories: agg.categories, colors: agg.categoryColors };
    }
    if (!entrepriseProject?.subscriptions?.length) {
      return { categories: [] as string[], colors: {} as Record<string, string> };
    }
    try {
      const agg = ProjectionService.aggregateChargesBySubscriptionAndPeriod(
        entrepriseProject.subscriptions,
        entrepriseProject.projectionConfig,
        granularity,
        dateRange.start,
        dateRange.end
      );
      return { categories: agg.categories, colors: agg.categoryColors };
    } catch {
      return { categories: [], colors: {} };
    }
  }, [entrepriseProject, categoryChargesData, granularity, dateRange.start, dateRange.end]);

  const colors = useMemo(
    () => ({
      devis: isDarkMode ? '#94a3b8' : '#94a3b8',
      invoices: isDarkMode ? '#93c5fd' : '#bfdbfe',
      payments: isDarkMode ? '#3b82f6' : '#2563eb',
      achats: isDarkMode ? '#64748b' : '#475569',
    }),
    [isDarkMode]
  );

  const chartData = useMemo(() => {
    const datasets: {
      label: string;
      data: number[];
      backgroundColor: string | ((ctx: { chart: { ctx: CanvasRenderingContext2D } }) => CanvasPattern | string);
      borderColor: string;
      borderWidth: number;
      stack: string;
      barPercentage: number;
      categoryPercentage: number;
    }[] = [
      {
        label: t('invoicing.charts.devisGenerated', 'Devis générés'),
        data: periodData.map((d) => d.devisAmount),
        backgroundColor: colors.devis,
        borderColor: colors.devis,
        borderWidth: 1,
        borderRadius: 6,
        stack: 'recettes',
        barPercentage: 0.98,
        categoryPercentage: 0.98,
      },
      {
        label: t('invoicing.charts.invoicesIssued', 'Factures émises'),
        data: periodData.map((d) => d.invoicesAmount),
        backgroundColor: colors.invoices,
        borderColor: colors.invoices,
        borderWidth: 1,
        borderRadius: 6,
        stack: 'recettes',
        barPercentage: 0.98,
        categoryPercentage: 0.98,
      },
      {
        label: t('invoicing.charts.paymentsReceived', 'Paiements perçus'),
        data: periodData.map((d) => d.paymentsAmount),
        backgroundColor: colors.payments,
        borderColor: colors.payments,
        borderWidth: 1,
        borderRadius: 6,
        stack: 'recettes',
        barPercentage: 0.98,
        categoryPercentage: 0.98,
      },
    ];

    chargesBreakdown.categories.forEach((cat) => {
      const baseColor = chargesBreakdown.colors[cat] || '#808080';
      datasets.push({
        label: cat,
        data: periodData.map((d) => d.chargesByCategory[cat] ?? 0),
        backgroundColor: (context: { chart?: { ctx?: CanvasRenderingContext2D } }) => {
          const chart = context.chart;
          if (!chart?.ctx) return baseColor;
          return createHatchingPattern(chart.ctx, baseColor, isDarkMode) || baseColor;
        },
        borderColor: baseColor,
        borderWidth: 1,
        borderRadius: 6,
        stack: 'depenses',
        barPercentage: 0.98,
        categoryPercentage: 0.98,
      });
    });

    datasets.push({
      label: t('invoicing.charts.stockPurchases', 'Achats stock'),
      data: periodData.map((d) => d.achatsAmount),
      backgroundColor: (context: { chart?: { ctx?: CanvasRenderingContext2D } }) => {
        const chart = context.chart;
        if (!chart?.ctx) return colors.achats;
        return createHatchingPattern(chart.ctx, colors.achats, isDarkMode) || colors.achats;
      },
      borderColor: colors.achats,
      borderWidth: 1,
      borderRadius: 6,
      stack: 'depenses',
      barPercentage: 0.98,
      categoryPercentage: 0.98,
    });

    return {
      labels: monthLabels,
      datasets,
    };
  }, [periodData, monthLabels, colors, chargesBreakdown, isDarkMode, t]);

  const options: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index' as const, intersect: false },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: {
            color: isDarkMode ? '#94a3b8' : '#64748b',
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: {
            color: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(203, 213, 225, 0.5)',
          },
          ticks: {
            color: isDarkMode ? '#94a3b8' : '#64748b',
            font: { size: 11 },
            callback: (value) => formatCurrency(value as number),
          },
        },
      },
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            boxWidth: 12,
            padding: 15,
            font: { size: 12 },
            color: isDarkMode ? '#cbd5e1' : '#1e293b',
          },
        },
        tooltip: {
          backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDarkMode ? '#e2e8f0' : '#333',
          bodyColor: isDarkMode ? '#cbd5e1' : '#666',
          borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y || 0;
              return `${label}: ${formatCurrency(value)}`;
            },
          },
        },
      },
    }),
    [isDarkMode]
  );

  return (
    <div className="bilan-financier-chart-wrapper">
      <div className="finance-global-chart-toolbar">
        <div className="chart-toolbar-zoom">
          <div className="chart-toolbar-zoom-buttons">
            <button
              type="button"
              className="chart-toolbar-btn"
              onClick={handleZoomOut}
              disabled={!canZoomOut}
              title={t('financeGlobal.zoomOut')}
              aria-label={t('financeGlobal.zoomOut')}
            >
              <FontAwesomeIcon icon={faSearchMinus} />
            </button>
            <span className="chart-toolbar-granularity">{t(`financeGlobal.${GRANULARITY_LABELS[granularity]}`)}</span>
            <button
              type="button"
              className="chart-toolbar-btn"
              onClick={handleZoomIn}
              disabled={!canZoomIn}
              title={t('financeGlobal.zoomIn')}
              aria-label={t('financeGlobal.zoomIn')}
            >
              <FontAwesomeIcon icon={faSearchPlus} />
            </button>
          </div>
        </div>
        <div className="chart-toolbar-daterange">
          <span className="chart-toolbar-label">{t('financeGlobal.dateRange')}</span>
          <label>
            <span className="chart-toolbar-datelabel">{t('financeGlobal.dateFrom')}</span>
            <input
              type="date"
              className="chart-toolbar-dateinput"
              value={dateInputStart}
              onChange={(e) => setDateInputStart(e.target.value)}
            />
          </label>
          <label>
            <span className="chart-toolbar-datelabel">{t('financeGlobal.dateTo')}</span>
            <input
              type="date"
              className="chart-toolbar-dateinput"
              value={dateInputEnd}
              onChange={(e) => setDateInputEnd(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="chart-toolbar-btn chart-toolbar-btn-apply"
            onClick={handleDateRangeApply}
          >
            {t('financeGlobal.apply')}
          </button>
          <button
            type="button"
            className="chart-toolbar-btn chart-toolbar-btn-reset"
            onClick={handleDateRangeReset}
          >
            {t('financeGlobal.all')}
          </button>
        </div>
      </div>
      <div style={{ width: '100%', height: '100%', minHeight: 0 }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default BilanFinancierChart;
