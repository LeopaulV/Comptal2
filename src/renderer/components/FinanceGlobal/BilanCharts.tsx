import { useMemo, useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, ChartOptions, registerables } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { formatCurrency } from '../../utils/format';

ChartJS.register(ArcElement, Tooltip, Legend, ...registerables);

export interface BilanChartsData {
  categoriesWithCredits: string[];
  categoriesWithDebits: string[];
  creditsByCategory: Record<string, number[]>;
  debitsByCategory: Record<string, number[]>;
  categoryColors: Record<string, string>;
}

export interface BilanChartsRef {
  prepareForPdfExport(): Promise<void>;
  getChartImages(): string[];
  getChartLegends(): { title?: string; items: { label: string; color: string }[] }[];
  resetAfterPdfExport(): void;
}

interface BilanChartsProps {
  data: BilanChartsData;
}

const BilanCharts = forwardRef<BilanChartsRef, BilanChartsProps>(function BilanCharts({ data }, ref) {
  const { t } = useTranslation();
  const doughnutRef = useRef<ChartJS<'doughnut'>>(null);
  const creditsBarRef = useRef<ChartJS<'bar'>>(null);
  const debitsBarRef = useRef<ChartJS<'bar'>>(null);


  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [forPdfExport, setForPdfExport] = useState(false);
  const [legendFilter, setLegendFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [legendOffset, setLegendOffset] = useState(0);

  const LEGEND_PAGE_SIZE = 8;

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

  const effectiveDarkMode = isDarkMode && !forPdfExport;
  const textColor = effectiveDarkMode ? '#cbd5e1' : '#1e293b';
  const gridColor = effectiveDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

  // Répartition par ligne : Crédits, séparateur, Débits, séparateur (comme Gestion et Projet)
  const repartitionData = useMemo(() => {
    const labels: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    const segmentTypes: ('credit' | 'debit' | 'separator')[] = [];

    data.categoriesWithCredits.forEach((cat) => {
      const totalCredits = (data.creditsByCategory[cat] || []).reduce((a, b) => a + b, 0);
      if (totalCredits > 0) {
        labels.push(cat);
        values.push(totalCredits);
        colors.push(data.categoryColors[cat] || '#10b981');
        segmentTypes.push('credit');
      }
    });

    const totalCreditsSum = values.reduce((a, b) => a + b, 0);
    const totalDebitsSum = data.categoriesWithDebits.reduce(
      (s, cat) => s + (data.debitsByCategory[cat] || []).reduce((a, b) => a + b, 0),
      0
    );
    // Débits agrégés sont négatifs : volume total pour le camembert = crédits + |débits|
    const grandTotal = totalCreditsSum + Math.abs(totalDebitsSum);
    const needsSeparator = data.categoriesWithCredits.length > 0 && data.categoriesWithDebits.length > 0 && grandTotal > 0;
    const separatorSize = needsSeparator ? Math.max(grandTotal * 0.02, 1) : 0;
    const separatorColor = effectiveDarkMode ? '#1e293b' : '#f8fafc';

    if (needsSeparator) {
      labels.push('');
      values.push(separatorSize);
      colors.push(separatorColor);
      segmentTypes.push('separator');
    }

    data.categoriesWithDebits.forEach((cat) => {
      const totalDebits = (data.debitsByCategory[cat] || []).reduce((a, b) => a + b, 0);
      if (totalDebits < 0) {
        labels.push(cat);
        values.push(Math.abs(totalDebits));
        colors.push(data.categoryColors[cat] || '#ef4444');
        segmentTypes.push('debit');
      }
    });

    if (needsSeparator) {
      labels.push('');
      values.push(separatorSize);
      colors.push(separatorColor);
      segmentTypes.push('separator');
    }

    return { labels, values, colors, segmentTypes };
  }, [data, effectiveDarkMode]);

  const doughnutChartData = useMemo(
    () => ({
      labels: repartitionData.labels,
      datasets: [
        {
          data: repartitionData.values,
          backgroundColor: repartitionData.colors,
          borderColor: repartitionData.colors.map((c, i) =>
            repartitionData.segmentTypes[i] === 'separator' ? c : c
          ),
          borderWidth: repartitionData.colors.map((_, i) =>
            repartitionData.segmentTypes[i] === 'separator' ? 0 : 2
          ),
          hoverOffset: 6,
        },
      ],
    }),
    [repartitionData]
  );

  const doughnutOptions: ChartOptions<'doughnut'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: effectiveDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: effectiveDarkMode ? '#e2e8f0' : '#333',
          bodyColor: effectiveDarkMode ? '#cbd5e1' : '#666',
          borderColor: effectiveDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 10,
          filter(tooltipItem) {
            const label = tooltipItem.label || '';
            return label !== '';
          },
          callbacks: {
            label(ctx) {
              const value = (ctx.parsed as number) ?? 0;
              const type = repartitionData.segmentTypes[ctx.dataIndex];
              if (type === 'separator') return undefined;
              const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              const prefix = type === 'credit' ? t('financeGlobal.credit') : t('financeGlobal.debit');
              const catName = repartitionData.labels[ctx.dataIndex];
              const displayAmount = type === 'debit' ? formatCurrency(-value) : formatCurrency(value);
              return `${prefix} — ${catName}: ${displayAmount} (${pct} %)`;
            },
          },
        },
      },
    }),
    [effectiveDarkMode, textColor, repartitionData.segmentTypes, t]
  );

  // Labels pour la légende : "Crédit — Cat" / "Débit — Cat"
  const doughnutLegendLabels = useMemo(
    () =>
      repartitionData.labels.map((label, i) => {
        const type = repartitionData.segmentTypes[i];
        if (type === 'separator') return '—';
        const prefix = type === 'credit' ? t('financeGlobal.credit') : t('financeGlobal.debit');
        return `${prefix} — ${label}`;
      }),
    [repartitionData.labels, repartitionData.segmentTypes, t]
  );

  const doughnutChartDataWithLegend = useMemo(
    () => ({
      ...doughnutChartData,
      labels: doughnutLegendLabels,
    }),
    [doughnutChartData, doughnutLegendLabels]
  );

  const legendItems = useMemo(
    () =>
      repartitionData.labels
        .map((_, i) => ({
          label: doughnutLegendLabels[i],
          color: repartitionData.colors[i],
          type: repartitionData.segmentTypes[i],
        }))
        .filter((x) => x.type !== 'separator'),
    [repartitionData, doughnutLegendLabels]
  );

  const filteredLegendItems = useMemo(() => {
    if (legendFilter === 'credit') return legendItems.filter((x) => x.type === 'credit');
    if (legendFilter === 'debit') return legendItems.filter((x) => x.type === 'debit');
    return legendItems;
  }, [legendItems, legendFilter]);

  const maxLegendOffset = Math.max(0, Math.ceil(filteredLegendItems.length / LEGEND_PAGE_SIZE) - 1);
  const visibleLegendItems = useMemo(
    () =>
      filteredLegendItems.slice(
        legendOffset * LEGEND_PAGE_SIZE,
        legendOffset * LEGEND_PAGE_SIZE + LEGEND_PAGE_SIZE
      ),
    [filteredLegendItems, legendOffset]
  );

  useEffect(() => {
    setLegendOffset(0);
  }, [legendFilter]);

  // Histogramme crédits par catégorie
  const creditsBarData = useMemo(() => {
    const labels = data.categoriesWithCredits;
    const values = labels.map(
      (cat) => (data.creditsByCategory[cat] || []).reduce((a, b) => a + b, 0)
    );
    const colors = labels.map((cat) => data.categoryColors[cat] || '#10b981');
    return { labels, values, colors };
  }, [data]);

  const creditsChartData = useMemo(
    () => ({
      labels: creditsBarData.labels,
      datasets: [
        {
          label: t('financeGlobal.totalCredits'),
          data: creditsBarData.values,
          backgroundColor: creditsBarData.colors,
          borderColor: creditsBarData.colors.map((c) => c),
          borderWidth: 1,
          barPercentage: 0.75,
          categoryPercentage: 0.85,
        },
      ],
    }),
    [creditsBarData, t]
  );

  // Histogramme débits par catégorie
  const debitsBarData = useMemo(() => {
    const labels = data.categoriesWithDebits;
    const values = labels.map(
      (cat) => (data.debitsByCategory[cat] || []).reduce((a, b) => a + b, 0)
    );
    const colors = labels.map((cat) => data.categoryColors[cat] || '#ef4444');
    return { labels, values, colors };
  }, [data]);

  useImperativeHandle(ref, () => ({
    async prepareForPdfExport(): Promise<void> {
      setForPdfExport(true);
      await new Promise((r) => setTimeout(r, 200));
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));
    },
    resetAfterPdfExport(): void {
      setForPdfExport(false);
    },
    getChartImages(): string[] {
      const scale = 4;
      const toHighRes = (canvas: HTMLCanvasElement): string => {
        const w = canvas.width;
        const h = canvas.height;
        if (w === 0 || h === 0) return canvas.toDataURL('image/jpeg', 0.9);
        const off = document.createElement('canvas');
        off.width = w * scale;
        off.height = h * scale;
        const ctx = off.getContext('2d');
        if (!ctx) return canvas.toDataURL('image/jpeg', 0.9);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, off.width, off.height);
        ctx.scale(scale, scale);
        ctx.drawImage(canvas, 0, 0);
        return off.toDataURL('image/jpeg', 0.92);
      };
      const out: string[] = [];
      const d = doughnutRef.current?.canvas;
      const c = creditsBarRef.current?.canvas;
      const b = debitsBarRef.current?.canvas;
      if (d) out.push(toHighRes(d));
      if (c) out.push(toHighRes(c));
      if (b) out.push(toHighRes(b));
      return out;
    },
    getChartLegends(): { title?: string; items: { label: string; color: string }[] }[] {
      return [
        { items: legendItems.map((x) => ({ label: x.label, color: x.color })) },
        { items: creditsBarData.labels.map((l, j) => ({ label: l, color: creditsBarData.colors[j] ?? '#888' })) },
        { items: debitsBarData.labels.map((l, j) => ({ label: l, color: debitsBarData.colors[j] ?? '#888' })) },
      ];
    },
  }), [legendItems, creditsBarData, debitsBarData]);

  const debitsChartData = useMemo(
    () => ({
      labels: debitsBarData.labels,
      datasets: [
        {
          label: t('financeGlobal.totalDebits'),
          data: debitsBarData.values,
          backgroundColor: debitsBarData.colors,
          borderColor: debitsBarData.colors.map((c) => c),
          borderWidth: 1,
          barPercentage: 0.75,
          categoryPercentage: 0.85,
        },
      ],
    }),
    [debitsBarData, t]
  );

  const barOptionsBase: ChartOptions<'bar'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: forPdfExport ? 14 : 11 },
            callback(value) {
              return formatCurrency(Number(value));
            },
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: textColor,
            font: { size: forPdfExport ? 14 : 11 },
            maxRotation: 0,
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: effectiveDarkMode ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: effectiveDarkMode ? '#e2e8f0' : '#333',
          bodyColor: effectiveDarkMode ? '#cbd5e1' : '#666',
          borderColor: effectiveDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label(ctx) {
              const v = ctx.parsed?.x ?? 0;
              return formatCurrency(v);
            },
          },
        },
      },
    }),
    [effectiveDarkMode, forPdfExport, textColor, gridColor]
  );

  const hasRepartition = repartitionData.values.some((v) => v > 0);
  const hasCredits = creditsBarData.values.some((v) => v > 0);
  const hasDebits = debitsBarData.values.some((v) => v !== 0);

  return (
    <div className="bilan-charts-grid">
      <div className="bilan-chart-cell bilan-chart-repartition">
        <h3 className="bilan-chart-title">{t('financeGlobal.bilanChartRepartitionByLine')}</h3>
        <div className="bilan-repartition-content">
          <div className="bilan-chart-inner" style={forPdfExport ? { backgroundColor: '#ffffff' } : undefined}>
            {hasRepartition ? (
              <Doughnut ref={doughnutRef} data={doughnutChartDataWithLegend} options={doughnutOptions} />
            ) : (
              <div className="bilan-chart-empty">{t('financeGlobal.bilanNoData')}</div>
            )}
          </div>
          {hasRepartition && (
            <div className="bilan-legend-custom">
              <div className="bilan-legend-filters">
                <button
                  type="button"
                  className={`bilan-legend-btn ${legendFilter === 'credit' ? 'active' : ''}`}
                  onClick={() => setLegendFilter((f) => (f === 'credit' ? 'all' : 'credit'))}
                >
                  {t('financeGlobal.credit')}
                </button>
                <button
                  type="button"
                  className={`bilan-legend-btn ${legendFilter === 'debit' ? 'active' : ''}`}
                  onClick={() => setLegendFilter((f) => (f === 'debit' ? 'all' : 'debit'))}
                >
                  {t('financeGlobal.debit')}
                </button>
              </div>
              <div className="bilan-legend-list">
                {visibleLegendItems.map((item, i) => (
                  <div key={`${item.label}-${i}`} className="bilan-legend-item">
                    <span
                      className="bilan-legend-color"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="bilan-legend-label">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="bilan-legend-arrows">
                <button
                  type="button"
                  className="bilan-legend-arrow"
                  onClick={() => setLegendOffset((o) => Math.max(0, o - 1))}
                  disabled={legendOffset === 0}
                  title={t('financeGlobal.previous')}
                  aria-label={t('financeGlobal.previous')}
                >
                  <FontAwesomeIcon icon={faChevronUp} />
                </button>
                <span className="bilan-legend-page">
                  {filteredLegendItems.length > 0
                    ? `${legendOffset * LEGEND_PAGE_SIZE + 1}-${Math.min(
                        legendOffset * LEGEND_PAGE_SIZE + LEGEND_PAGE_SIZE,
                        filteredLegendItems.length
                      )} / ${filteredLegendItems.length}`
                    : '0'}
                </span>
                <button
                  type="button"
                  className="bilan-legend-arrow"
                  onClick={() => setLegendOffset((o) => Math.min(maxLegendOffset, o + 1))}
                  disabled={legendOffset >= maxLegendOffset}
                  title={t('financeGlobal.next')}
                  aria-label={t('financeGlobal.next')}
                >
                  <FontAwesomeIcon icon={faChevronDown} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="bilan-chart-cell bilan-chart-credits">
        <h3 className="bilan-chart-title">{t('financeGlobal.bilanChartCreditsByCategory')}</h3>
        <div className="bilan-chart-inner" style={forPdfExport ? { backgroundColor: '#ffffff' } : undefined}>
          {hasCredits ? (
            <Bar ref={creditsBarRef} data={creditsChartData} options={barOptionsBase} />
          ) : (
            <div className="bilan-chart-empty">{t('financeGlobal.bilanNoData')}</div>
          )}
        </div>
      </div>
      <div className="bilan-chart-cell bilan-chart-debits">
        <h3 className="bilan-chart-title">{t('financeGlobal.bilanChartDebitsByCategory')}</h3>
        <div className="bilan-chart-inner" style={forPdfExport ? { backgroundColor: '#ffffff' } : undefined}>
          {hasDebits ? (
            <Bar ref={debitsBarRef} data={debitsChartData} options={barOptionsBase} />
          ) : (
            <div className="bilan-chart-empty">{t('financeGlobal.bilanNoData')}</div>
          )}
        </div>
      </div>
    </div>
  );
});

export default BilanCharts;
