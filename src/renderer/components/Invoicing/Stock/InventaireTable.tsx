import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ArticleStock, StockCategorie } from '../../../types/Stock';
import { StockService } from '../../../services/StockService';
import { UNITES_MESURE } from '../../../constants/invoicingConstants';

/** Colonnes filtrables (index) — exclut colonne couleur 0 */
const FILTERABLE_COLUMNS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Numéro ISO de la semaine (1-53) et année pour une date */
function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

/** Lundi de la semaine ISO */
function getMondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayOffset = 1 - dayOfWeek;
  const firstMonday = new Date(year, 0, 4 + mondayOffset);
  firstMonday.setDate(firstMonday.getDate() + (week - 1) * 7);
  return firstMonday;
}

/** Nombre de semaines ISO dans l'année */
function getWeeksInYear(year: number): number {
  const dec31 = new Date(year, 11, 31);
  const w = getISOWeek(dec31);
  return w.week >= 52 ? w.week : 52;
}

function toWeekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Données inventaire : stockées dans stock_articles.json (ArticleStock, type stock/consommable, consommationHebdo clé "YYYY-Www") */

interface InventaireTableProps {
  articles: ArticleStock[];
  categories: StockCategorie[];
  onRefresh: () => void;
  onEditArticle: (article: ArticleStock) => void;
}

export const InventaireTable: React.FC<InventaireTableProps> = ({
  articles,
  categories,
  onRefresh,
  onEditArticle,
}) => {
  const { t } = useTranslation();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editsConsommationHebdo, setEditsConsommationHebdo] = useState<
    Record<string, Record<string, number | undefined>>
  >({});
  const [justSavedIds, setJustSavedIds] = useState<Set<string>>(new Set());
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const WEEKS_PER_PAGE = 13; /* trimestre ≈ 13 semaines */
  const [filterColumn, setFilterColumn] = useState<number | null>(null);
  const [filterSelections, setFilterSelections] = useState<Record<number, Set<string> | null>>({});
  const [filterSearch, setFilterSearch] = useState('');
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterHeaderRef = useRef<HTMLTableCellElement | null>(null);
  const [filterPanelPosition, setFilterPanelPosition] = useState<{ top: number; left: number } | null>(null);
  const [tooltip, setTooltip] = useState<{ label: string; x: number; y: number } | null>(null);

  const inventaireArticles = useMemo(
    () => articles.filter((a) => a.type === 'stock' || a.type === 'consommable'),
    [articles],
  );

  // Quand la prop `articles` est mise à jour par le parent (après onRefresh),
  // on efface les edits des articles qui viennent d'être sauvegardés.
  useEffect(() => {
    if (justSavedIds.size === 0) return;
    setEditsConsommationHebdo((prev) => {
      const next = { ...prev };
      for (const id of justSavedIds) {
        delete next[id];
      }
      return next;
    });
    setJustSavedIds(new Set());
  }, [articles]); // eslint-disable-line react-hooks/exhaustive-deps

  const { year: todayYear, week: todayWeek } = useMemo(() => getISOWeek(new Date()), []);

  const weeksForYear = useMemo(() => {
    const n = getWeeksInYear(selectedYear);
    return Array.from({ length: n }, (_, i) => {
      const w = i + 1;
      const monday = getMondayOfISOWeek(selectedYear, w);
      return {
        key: toWeekKey(selectedYear, w),
        year: selectedYear,
        week: w,
        monday,
        isCurrent: selectedYear === todayYear && w === todayWeek,
      };
    });
  }, [selectedYear, todayYear, todayWeek]);

  const categoryName = useCallback(
    (categorieId?: string) => {
      if (!categorieId) return '—';
      const cat = categories.find((c) => c.id === categorieId);
      return cat?.nom ?? '—';
    },
    [categories],
  );

  const unitLabel = useCallback((unite?: string) => {
    if (!unite) return '—';
    const found = UNITES_MESURE.find((u) => u.value === unite);
    return found ? found.label : unite;
  }, []);

  const getEffectiveConsommationHebdo = useCallback(
    (article: ArticleStock): Record<string, number> => {
      const base = article.consommationHebdo || {};
      const edits = editsConsommationHebdo[article.id] || {};
      const merged: Record<string, number> = {};
      for (const k of new Set([...Object.keys(base), ...Object.keys(edits)])) {
        const v = k in edits ? edits[k] : base[k];
        if (typeof v === 'number') merged[k] = v;
      }
      return merged;
    },
    [editsConsommationHebdo],
  );

  const avgConsumption = useCallback(
    (article: ArticleStock): number => {
      const hebdo = getEffectiveConsommationHebdo(article);
      const weekKeys = Object.keys(hebdo).sort();
      if (weekKeys.length < 2) return 0;

      let sum = 0;
      let count = 0;
      for (let i = 0; i < weekKeys.length - 1; i += 1) {
        const current = hebdo[weekKeys[i]];
        const next = hebdo[weekKeys[i + 1]];
        if (typeof current !== 'number' || typeof next !== 'number') continue;
        sum += current - next;
        count += 1;
      }
      return count > 0 ? sum / count : 0;
    },
    [getEffectiveConsommationHebdo],
  );

  const getCurrentQty = useCallback(
    (article: ArticleStock): number | null => {
      const hebdo = getEffectiveConsommationHebdo(article);
      const weekKeys = Object.keys(hebdo).sort();
      if (weekKeys.length > 0) {
        const lastWeekKey = weekKeys[weekKeys.length - 1];
        const lastQty = hebdo[lastWeekKey];
        if (typeof lastQty === 'number') return lastQty;
      }
      return typeof article.quantite === 'number' ? article.quantite : null;
    },
    [getEffectiveConsommationHebdo],
  );

  const getCellValue = useCallback(
    (col: number, article: ArticleStock): string => {
      switch (col) {
        case 0:
          return article.couleur || categories.find((c) => c.id === article.categorieId)?.couleur || '#dbeafe';
        case 1:
          return article.reference || '—';
        case 2:
          return categoryName(article.categorieId);
        case 3:
          return article.designation;
        case 4:
          return article.fournisseur || '—';
        case 5:
          return unitLabel(article.unite);
        case 6:
          return String(article.nbElementsParRef ?? '—');
        case 7:
          return String(article.besoin ?? '—');
        case 8:
          return String(getCurrentQty(article) ?? '—');
        case 9:
          return avgConsumption(article).toFixed(1);
        case 10: {
          const besoin = article.besoin ?? 0;
          const currentQty = getCurrentQty(article) ?? 0;
          const aCommander = currentQty - besoin;
          return aCommander < 0 ? '0' : aCommander.toFixed(1);
        }
        default:
          return '—';
      }
    },
    [categoryName, unitLabel, getCurrentQty, avgConsumption, categories],
  );

  const uniqueValuesByColumn = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (const col of FILTERABLE_COLUMNS) {
      const set = new Set<string>();
      for (const a of inventaireArticles) {
        set.add(getCellValue(col, a));
      }
      map[col] = Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
    }
    return map;
  }, [inventaireArticles, getCellValue]);

  const filteredArticles = useMemo(() => {
    return inventaireArticles.filter((article) => {
      for (const col of FILTERABLE_COLUMNS) {
        const sel = filterSelections[col];
        if (sel === null || sel === undefined) continue;
        if (sel.size === 0) return false;
        const val = getCellValue(col, article);
        if (!sel.has(val)) return false;
      }
      return true;
    });
  }, [inventaireArticles, filterSelections, getCellValue]);

  const toggleFilterColumn = useCallback((col: number) => {
    setFilterColumn((prev) => (prev === col ? null : col));
    setFilterSearch('');
  }, []);

  const toggleFilterValue = useCallback(
    (col: number, value: string) => {
      const allUniques = uniqueValuesByColumn[col] ?? [];
      setFilterSelections((prev) => {
        const current = prev[col];
        const next = new Set(current ?? allUniques);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return { ...prev, [col]: next.size === allUniques.length ? null : next };
      });
    },
    [uniqueValuesByColumn],
  );

  const setSelectAll = useCallback((col: number, checked: boolean) => {
    setFilterSelections((prev) => ({
        ...prev,
        [col]: checked ? null : new Set(),
      }));
  }, []);

  const handleConsommationChange = useCallback((article: ArticleStock, weekKey: string, value: string) => {
    const num = value === '' || isNaN(parseFloat(value)) ? undefined : parseFloat(value);
    setEditsConsommationHebdo((prev) => {
      const articleEdits = { ...(prev[article.id] || {}) };
      if (num === undefined) articleEdits[weekKey] = undefined;
      else articleEdits[weekKey] = num;
      const next = { ...prev };
      if (Object.keys(articleEdits).length > 0) next[article.id] = articleEdits;
      else delete next[article.id];
      return next;
    });
  }, []);

  const handleConsommationBlur = useCallback(
    async (article: ArticleStock) => {
      if (!(article.id in editsConsommationHebdo)) return;
      const effectiveHebdo = getEffectiveConsommationHebdo(article);
      setSavingId(article.id);
      try {
        await StockService.upsertArticle({ ...article, consommationHebdo: effectiveHebdo });
        // On marque l'article comme sauvegardé ; le useEffect ci-dessus
        // effacera ses edits dès que la prop articles sera mise à jour.
        setJustSavedIds((prev) => new Set([...prev, article.id]));
        await onRefresh();
        toast.success(t('invoicing.stock.inventaireSaved'));
      } catch {
        toast.error(t('invoicing.stock.inventaireSaveError'));
      } finally {
        setSavingId(null);
      }
    },
    [editsConsommationHebdo, getEffectiveConsommationHebdo, onRefresh, t],
  );

  const yearOptions = useMemo(() => {
    const opts: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 1; y++) opts.push(y);
    return opts;
  }, [currentYear]);

  const weekPageStart = useMemo(() => {
    if (selectedYear === todayYear) {
      const todayWeekIndex = Math.max(0, todayWeek - 1);
      return Math.floor(todayWeekIndex / WEEKS_PER_PAGE) * WEEKS_PER_PAGE;
    }
    return 0;
  }, [selectedYear, todayWeek, todayYear]);

  const [weekOffset, setWeekOffset] = useState(weekPageStart);

  useEffect(() => {
    setWeekOffset(weekPageStart);
  }, [weekPageStart]);

  useEffect(() => {
    if (filterColumn === null) {
      setFilterPanelPosition(null);
      return;
    }
    const updatePosition = () => {
      if (filterHeaderRef.current) {
        const rect = filterHeaderRef.current.getBoundingClientRect();
        setFilterPanelPosition({ top: rect.bottom, left: rect.left });
      }
    };
    updatePosition();
    const scrollParent = filterHeaderRef.current?.closest('.inventaire-excel-scroll');
    scrollParent?.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
    return () => {
      scrollParent?.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [filterColumn]);

  useEffect(() => {
    if (filterColumn === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.inventaire-excel-th-filter-trigger')) setFilterColumn(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [filterColumn]);

  const maxWeekOffset = useMemo(() => {
    return Math.max(0, weeksForYear.length - WEEKS_PER_PAGE);
  }, [weeksForYear.length]);

  const visibleWeeks = useMemo(() => {
    return weeksForYear.slice(weekOffset, weekOffset + WEEKS_PER_PAGE);
  }, [weekOffset, weeksForYear]);

  const goToPreviousWeeks = useCallback(() => {
    setWeekOffset((prev) => Math.max(0, prev - WEEKS_PER_PAGE));
  }, []);

  const goToNextWeeks = useCallback(() => {
    setWeekOffset((prev) => Math.min(maxWeekOffset, prev + WEEKS_PER_PAGE));
  }, [maxWeekOffset]);

  const weekWindowLabel = useMemo(() => {
    if (visibleWeeks.length === 0) return '—';
    const first = visibleWeeks[0];
    const last = visibleWeeks[visibleWeeks.length - 1];
    const firstMonth = first.monday.toLocaleDateString('fr-FR', { month: 'short' });
    const lastMonth = last.monday.toLocaleDateString('fr-FR', { month: 'short' });
    const monthPart = firstMonth === lastMonth ? firstMonth : `${firstMonth} - ${lastMonth}`;
    return `S${first.week} - S${last.week} (${monthPart} ${selectedYear})`;
  }, [selectedYear, visibleWeeks]);

  if (inventaireArticles.length === 0) {
    return (
      <div className="invoicing-empty" style={{ padding: 24 }}>
        {t('invoicing.stock.emptyInventaire')}
      </div>
    );
  }

  return (
    <div className="inventaire-excel-root">
      <div className="inventaire-excel-toolbar">
        <label className="inventaire-excel-year-label">
          {t('invoicing.stock.year')}
          <select
            className="inventaire-excel-year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <div className="inventaire-excel-week-nav">
          <button
            type="button"
            className="secondary inventaire-excel-nav-btn"
            onClick={goToPreviousWeeks}
            disabled={weekOffset === 0}
          >
            ←
          </button>
          <span className="inventaire-excel-period-label">{weekWindowLabel}</span>
          <button
            type="button"
            className="secondary inventaire-excel-nav-btn"
            onClick={goToNextWeeks}
            disabled={weekOffset >= maxWeekOffset}
          >
            →
          </button>
        </div>
        <span className="inventaire-excel-storage-hint">
          Inventaire enregistré automatiquement
        </span>
      </div>

      <div className="inventaire-excel-scroll">
        <table className="inventaire-excel-table">
          <thead>
            <tr>
              {[
                { short: t('invoicing.stock.color'), full: t('invoicing.stock.color') },
                { short: t('invoicing.stock.referenceShort'), full: t('invoicing.stock.reference') },
                { short: t('invoicing.stock.categoryShort'), full: t('invoicing.stock.category') },
                { short: t('invoicing.stock.productShort'), full: t('invoicing.stock.product') },
                { short: t('invoicing.stock.supplierShort'), full: t('invoicing.stock.supplier') },
                { short: t('invoicing.stock.volumeTypeShort'), full: t('invoicing.stock.volumeType') },
                { short: t('invoicing.stock.nbElementsPerRefShort'), full: t('invoicing.stock.nbElementsPerRef') },
                { short: t('invoicing.stock.needShort'), full: t('invoicing.stock.need') },
                { short: t('invoicing.stock.currentQtyShort'), full: t('invoicing.stock.currentQty') },
                { short: t('invoicing.stock.avgConsumptionShort'), full: t('invoicing.stock.avgConsumption') },
                { short: t('invoicing.stock.aCommanderShort'), full: t('invoicing.stock.aCommander') },
              ].map(({ short: labelShort, full: labelFull }, col) => (
                <th
                  key={col}
                  ref={filterColumn === col ? filterHeaderRef : null}
                  className={`inventaire-excel-sticky inventaire-excel-sticky-${col} ${col > 0 ? 'inventaire-excel-th-filterable' : ''}`}
                >
                  {col === 0 ? (
                    <span className="inventaire-excel-th-label">{labelShort}</span>
                  ) : (
                    <div
                      className="inventaire-excel-th-filter-wrapper"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({ label: labelFull, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <button
                        type="button"
                        className="inventaire-excel-th-filter-trigger"
                        onClick={() => toggleFilterColumn(col)}
                        aria-label={labelFull}
                      >
                        {labelShort}
                        <span className="inventaire-excel-th-filter-icon">▾</span>
                      </button>
                    </div>
                  )}
                </th>
              ))}
              {visibleWeeks.map((w) => (
                <th
                  key={w.key}
                  className={`inventaire-excel-week-th ${w.isCurrent ? 'inventaire-excel-week-current' : ''}`}
                >
                  <span className="inventaire-excel-week-num">{selectedYear} S{w.week}</span>
                  <span className="inventaire-excel-week-date">
                    {w.monday.getDate().toString().padStart(2, '0')}/
                    {(w.monday.getMonth() + 1).toString().padStart(2, '0')}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {            filteredArticles.length === 0 ? (
              <tr>
                <td colSpan={11 + visibleWeeks.length} className="inventaire-excel-empty-filter">
                  {inventaireArticles.length > 0
                    ? t('invoicing.stock.filterNoResults')
                    : t('invoicing.stock.emptyInventaire')}
                </td>
              </tr>
            ) : (
              filteredArticles.map((article) => (
              <tr key={`${article.id}-${article.updatedAt?.getTime() ?? 0}`}>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-0 inventaire-excel-color-cell">
                  <input
                    type="color"
                    value={article.couleur || categories.find((c) => c.id === article.categorieId)?.couleur || '#dbeafe'}
                    onChange={async (e) => {
                      const updated = { ...article, couleur: e.target.value };
                      try {
                        await StockService.upsertArticle(updated);
                        await onRefresh();
                      } catch {
                        /* ignore */
                      }
                    }}
                    className="inventaire-excel-color-input"
                    title={t('invoicing.stock.color')}
                  />
                </td>
                <td className="invoicing-excel-sticky inventaire-excel-sticky-1">
                  <span
                    className="inventaire-excel-cell-ref"
                    onClick={() => onEditArticle(article)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onEditArticle(article)}
                  >
                    {article.reference || '—'}
                  </span>
                </td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-2">{categoryName(article.categorieId)}</td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-3">{article.designation}</td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-4">{article.fournisseur || '—'}</td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-5">{unitLabel(article.unite)}</td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-6">
                  <span className="inventaire-excel-cell-readonly">{article.nbElementsParRef ?? '—'}</span>
                </td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-7">
                  <span className="inventaire-excel-cell-readonly">{article.besoin ?? '—'}</span>
                </td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-8">
                  <span className="inventaire-excel-cell-readonly">{getCurrentQty(article) ?? '—'}</span>
                </td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-8 inventaire-excel-avg">
                  {avgConsumption(article).toFixed(1)}
                </td>
                <td className="inventaire-excel-sticky inventaire-excel-sticky-10">
                  {(() => {
                    const besoin = article.besoin ?? 0;
                    const currentQty = getCurrentQty(article) ?? 0;
                    const aCommander = currentQty - besoin;
                    if (aCommander < 0) {
                      return <span className="inventaire-excel-acommander-warn">0</span>;
                    }
                    return <span className="inventaire-excel-cell-readonly">{aCommander.toFixed(1)}</span>;
                  })()}
                </td>
                {visibleWeeks.map((w) => {
                  const effectiveHebdo = getEffectiveConsommationHebdo(article);
                  const cellValue = effectiveHebdo[w.key];
                  return (
                    <td
                      key={w.key}
                      className={w.isCurrent ? 'inventaire-excel-week-current' : ''}
                    >
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        className="inventaire-excel-input-week"
                        value={typeof cellValue === 'number' ? cellValue : ''}
                        onChange={(e) => handleConsommationChange(article, w.key, e.target.value)}
                        onBlur={() => handleConsommationBlur(article)}
                        disabled={savingId === article.id}
                      />
                    </td>
                  );
                })}
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {tooltip &&
        createPortal(
          <div
            className="inventaire-excel-th-tooltip inventaire-excel-th-tooltip-portal"
            role="tooltip"
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {tooltip.label}
          </div>,
          document.body,
        )}
      {filterColumn !== null && filterPanelPosition && (
        <div
          ref={filterPanelRef}
          className="inventaire-excel-filter-panel inventaire-excel-filter-panel-floating"
          style={{
            position: 'fixed',
            top: filterPanelPosition.top,
            left: filterPanelPosition.left,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            className="inventaire-excel-filter-search"
            placeholder={t('invoicing.stock.filterSearch')}
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            autoFocus
          />
          <label className="inventaire-excel-filter-select-all">
            <input
              type="checkbox"
              checked={
                filterSelections[filterColumn] == null ||
                ((uniqueValuesByColumn[filterColumn]?.length ?? 0) > 0 &&
                  filterSelections[filterColumn]?.size === uniqueValuesByColumn[filterColumn]?.length)
              }
              onChange={(e) => setSelectAll(filterColumn, e.target.checked)}
            />
            {t('invoicing.stock.filterSelectAll')}
          </label>
          <div className="inventaire-excel-filter-list">
            {(uniqueValuesByColumn[filterColumn] ?? [])
              .filter((v) =>
                filterSearch
                  ? String(v).toLowerCase().includes(filterSearch.toLowerCase())
                  : true,
              )
              .map((value) => {
                const sel = filterSelections[filterColumn];
                const checked = sel == null || sel.has(value);
                return (
                  <label key={value} className="inventaire-excel-filter-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFilterValue(filterColumn, value)}
                    />
                    <span>{value}</span>
                  </label>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
