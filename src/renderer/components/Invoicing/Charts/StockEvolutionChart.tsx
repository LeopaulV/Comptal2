import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearchPlus, faSearchMinus, faChevronDown, faChevronUp, faCalendarAlt, faFilter } from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, ChartOptions, registerables } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ArticleStock } from '../../../types/Stock';
import {
  getPeriodKey,
  getPeriodLabel,
  getPeriodKeysInRange,
  parsePeriodKeyToDate,
  sortPeriodKeys,
} from '../../../services/DataService';
import '../../../styles/finance-global-custom.css';

ChartJS.register(...registerables);

type StockGranularity = 'week' | 'month' | 'quarter' | 'semester' | 'year';

const GRANULARITY_ORDER: StockGranularity[] = ['week', 'month', 'quarter', 'semester', 'year'];
const GRANULARITY_LABELS: Record<StockGranularity, string> = {
  week: 'granularityWeek',
  month: 'granularityMonth',
  quarter: 'granularityQuarter',
  semester: 'granularitySemester',
  year: 'granularityYear',
};

const CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#0d9488',
  '#d946ef',
];

interface StockEvolutionChartProps {
  articles: ArticleStock[];
}

interface MonthlyEntry {
  date: Date;
  qty: number;
}

function parseIsoWeekKey(weekKey: string): Date | null {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const target = new Date(mondayWeek1);
  target.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return new Date(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
}

function buildArticleEntries(article: ArticleStock): MonthlyEntry[] {
  const hebdo = article.consommationHebdo || {};
  const entries: MonthlyEntry[] = [];

  Object.entries(hebdo).forEach(([weekKey, qty]) => {
    if (typeof qty !== 'number') return;
    const weekDate = parseIsoWeekKey(weekKey);
    if (!weekDate) return;
    entries.push({ date: weekDate, qty });
  });

  if (entries.length === 0 && typeof article.quantite === 'number') {
    const fallback = article.updatedAt || article.dateAcquisition || new Date();
    const fallbackDate = new Date(fallback);
    entries.push({
      date: new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), 1),
      qty: article.quantite,
    });
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
}

const StockEvolutionChart: React.FC<StockEvolutionChartProps> = ({ articles }) => {
  const { t } = useTranslation();
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  const [granularity, setGranularity] = useState<StockGranularity>('month');

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
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null,
  });
  const [dateInputStart, setDateInputStart] = useState<string>('');
  const [dateInputEnd, setDateInputEnd] = useState<string>('');
  const [articleFilter, setArticleFilter] = useState('');
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [temporalCollapsed, setTemporalCollapsed] = useState(false);
  const [filterCollapsed, setFilterCollapsed] = useState(false);

  const inventoryArticles = useMemo(
    () => articles.filter((a) => a.type === 'stock' || a.type === 'consommable'),
    [articles]
  );

  const monthlyEntriesByArticle = useMemo(() => {
    const map = new Map<string, MonthlyEntry[]>();
    inventoryArticles.forEach((article) => {
      map.set(article.id, buildArticleEntries(article));
    });
    return map;
  }, [inventoryArticles]);

  useEffect(() => {
    setSelectedArticleIds((prev) => {
      const allIds = inventoryArticles.map((a) => a.id);
      if (allIds.length === 0) return [];
      if (prev.length === 0) return allIds;
      const kept = prev.filter((id) => allIds.includes(id));
      return kept.length > 0 ? kept : allIds;
    });
  }, [inventoryArticles]);

  const periodKeys = useMemo(() => {
    if (dateRange.start && dateRange.end) {
      return getPeriodKeysInRange(dateRange.start, dateRange.end, granularity);
    }

    const set = new Set<string>();
    monthlyEntriesByArticle.forEach((entries) => {
      entries.forEach((entry) => set.add(getPeriodKey(entry.date, granularity)));
    });

    const keys = sortPeriodKeys(Array.from(set), granularity);
    if (keys.length > 0) return keys;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return getPeriodKeysInRange(start, now, granularity);
  }, [dateRange.start, dateRange.end, granularity, monthlyEntriesByArticle]);

  const visibleArticles = useMemo(() => {
    const term = articleFilter.trim().toLowerCase();
    return inventoryArticles.filter((article) => {
      const label = `${article.reference || ''} ${article.designation}`.toLowerCase();
      if (term && !label.includes(term)) return false;
      return true;
    });
  }, [inventoryArticles, articleFilter]);

  const selectedArticles = useMemo(() => {
    const selected = new Set(selectedArticleIds);
    return inventoryArticles.filter((article) => selected.has(article.id));
  }, [inventoryArticles, selectedArticleIds]);

  const monthLabels = useMemo(
    () => periodKeys.map((k) => getPeriodLabel(k, granularity)),
    [periodKeys, granularity]
  );

  const chartData = useMemo(() => {
    const datasets = selectedArticles.map((article, index) => {
      const entries = monthlyEntriesByArticle.get(article.id) || [];
      const byPeriod = new Map<string, MonthlyEntry>();

      entries.forEach((entry) => {
        const periodKey = getPeriodKey(entry.date, granularity);
        const existing = byPeriod.get(periodKey);
        if (!existing || entry.date.getTime() >= existing.date.getTime()) {
          byPeriod.set(periodKey, entry);
        }
      });

      let lastKnown: number | null = null;
      if (periodKeys.length > 0) {
        const firstStart = parsePeriodKeyToDate(periodKeys[0], granularity);
        const before = entries.filter((e) => e.date.getTime() < firstStart.getTime());
        if (before.length > 0) {
          lastKnown = before[before.length - 1].qty;
        }
      }

      const series = periodKeys.map((periodKey) => {
        const current = byPeriod.get(periodKey);
        if (current) lastKnown = current.qty;
        return lastKnown;
      });

      const color = article.couleur || CHART_COLORS[index % CHART_COLORS.length];
      return {
        label: article.reference
          ? `${article.reference} - ${article.designation}`
          : article.designation,
        data: series,
        borderColor: color,
        backgroundColor: color,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.2,
        spanGaps: true,
      };
    });

    return {
      labels: monthLabels,
      datasets,
    };
  }, [selectedArticles, monthlyEntriesByArticle, granularity, periodKeys, monthLabels]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 10,
            usePointStyle: true,
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
              const value = context.parsed.y;
              if (value == null) return `${context.dataset.label}: —`;
              return `${context.dataset.label}: ${value.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: true,
            color: isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(203, 213, 225, 0.5)',
          },
          ticks: {
            color: isDarkMode ? '#94a3b8' : '#64748b',
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 45,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDarkMode ? 'rgba(148, 163, 184, 0.15)' : 'rgba(203, 213, 225, 0.5)',
          },
          ticks: {
            color: isDarkMode ? '#94a3b8' : '#64748b',
            font: { size: 11 },
          },
          title: {
            display: true,
            text: t('invoicing.stock.chart.yAxisQty', 'Quantité en stock'),
            color: isDarkMode ? '#94a3b8' : '#64748b',
            font: { size: 11 },
          },
        },
      },
    }),
    [t, isDarkMode]
  );

  const handleZoomIn = useCallback(() => {
    const idx = GRANULARITY_ORDER.indexOf(granularity);
    if (idx > 0) setGranularity(GRANULARITY_ORDER[idx - 1]);
  }, [granularity]);

  const handleZoomOut = useCallback(() => {
    const idx = GRANULARITY_ORDER.indexOf(granularity);
    if (idx < GRANULARITY_ORDER.length - 1) setGranularity(GRANULARITY_ORDER[idx + 1]);
  }, [granularity]);

  const handleDateRangeApply = useCallback(() => {
    const start = dateInputStart ? new Date(`${dateInputStart}-01T00:00:00`) : null;
    const end = dateInputEnd
      ? (() => {
          const [year, month] = dateInputEnd.split('-').map(Number);
          return new Date(year, month, 0, 23, 59, 59, 999);
        })()
      : null;

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

  const canZoomIn = GRANULARITY_ORDER.indexOf(granularity) > 0;
  const canZoomOut = GRANULARITY_ORDER.indexOf(granularity) < GRANULARITY_ORDER.length - 1;
  const allVisibleSelected =
    visibleArticles.length > 0 && visibleArticles.every((a) => selectedArticleIds.includes(a.id));

  const toggleArticle = (articleId: string) => {
    setSelectedArticleIds((prev) =>
      prev.includes(articleId) ? prev.filter((id) => id !== articleId) : [...prev, articleId]
    );
  };

  const toggleVisibleSelection = () => {
    setSelectedArticleIds((prev) => {
      const visibleIds = visibleArticles.map((a) => a.id);
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  if (inventoryArticles.length === 0) {
    return (
      <div className="invoicing-empty" style={{ padding: 40, textAlign: 'center' }}>
        {t('invoicing.stock.emptyInventaire')}
      </div>
    );
  }

  return (
    <div className="bilan-financier-chart-wrapper stock-evolution-chart-wrapper">
      <div className="stock-evolution-chart-main">
        <div className="stock-evolution-chart-area">
          {temporalCollapsed ? (
            <button
              type="button"
              className="stock-evolution-collapse-trigger"
              onClick={() => setTemporalCollapsed(false)}
              title={t('invoicing.stock.chart.temporalPanel', 'Période et plage')}
            >
              <FontAwesomeIcon icon={faCalendarAlt} />
              <span>{t('invoicing.stock.chart.temporalPanel', 'Période et plage')}</span>
              <FontAwesomeIcon icon={faChevronDown} className="stock-evolution-collapse-chevron" />
            </button>
          ) : (
            <div className="finance-global-chart-toolbar stock-evolution-toolbar">
              <button
                type="button"
                className="stock-evolution-collapse-close"
                onClick={() => setTemporalCollapsed(true)}
                title={t('invoicing.stock.chart.collapseTemporal', 'Rétracter la sélection temporelle')}
                aria-label={t('invoicing.stock.chart.collapseTemporal', 'Rétracter la sélection temporelle')}
              >
                <FontAwesomeIcon icon={faChevronUp} />
              </button>
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
                  <span className="chart-toolbar-granularity">
                    {t(`financeGlobal.${GRANULARITY_LABELS[granularity]}`)}
                  </span>
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
                    type="month"
                    className="chart-toolbar-dateinput"
                    value={dateInputStart}
                    onChange={(e) => setDateInputStart(e.target.value)}
                  />
                </label>
                <label>
                  <span className="chart-toolbar-datelabel">{t('financeGlobal.dateTo')}</span>
                  <input
                    type="month"
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
          )}

          <div className="stock-evolution-chart-canvas" style={{ width: '100%', height: '100%', minHeight: 0 }}>
            <Line data={chartData} options={options} />
          </div>
        </div>

        <div className={`stock-series-filter-panel ${filterCollapsed ? 'stock-series-filter-panel-collapsed' : ''}`}>
          <button
            type="button"
            className="stock-series-filter-panel-toggle"
            onClick={() => setFilterCollapsed(!filterCollapsed)}
            title={filterCollapsed ? t('invoicing.stock.chart.expandFilter', 'Afficher le filtre') : t('invoicing.stock.chart.collapseFilter', 'Rétracter le filtre')}
            aria-expanded={!filterCollapsed}
          >
            <FontAwesomeIcon icon={faFilter} />
            <span className="stock-series-filter-panel-toggle-label">
              {t('invoicing.stock.chart.articleFilter', 'Articles affichés')}
            </span>
            <span className="stock-series-filter-count-inline">
              {selectedArticles.length}/{inventoryArticles.length}
            </span>
            <FontAwesomeIcon
              icon={filterCollapsed ? faChevronDown : faChevronUp}
              className="stock-series-filter-panel-chevron"
            />
          </button>
          {!filterCollapsed && (
            <div className="stock-series-filter">
              <div className="stock-series-filter-controls">
                <input
                  type="text"
                  value={articleFilter}
                  onChange={(e) => setArticleFilter(e.target.value)}
                  className="stock-series-filter-input"
                  placeholder={t('invoicing.stock.filterSearch')}
                />
                <label className="stock-series-filter-select-all">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSelection} />
                  {t('invoicing.stock.filterSelectAll')}
                </label>
              </div>
              <div className="stock-series-filter-list">
                {visibleArticles.map((article) => {
                  const checked = selectedArticleIds.includes(article.id);
                  return (
                    <label key={article.id} className="stock-series-filter-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleArticle(article.id)}
                      />
                      <span
                        className="stock-series-filter-color"
                        style={{
                          backgroundColor:
                            article.couleur ||
                            CHART_COLORS[inventoryArticles.findIndex((a) => a.id === article.id) % CHART_COLORS.length],
                        }}
                      />
                      <span className="stock-series-filter-item-label">
                        {article.reference
                          ? `${article.reference} - ${article.designation}`
                          : article.designation}
                      </span>
                    </label>
                  );
                })}
                {visibleArticles.length === 0 && (
                  <div className="stock-series-filter-empty">{t('invoicing.stock.filterNoResults')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockEvolutionChart;
