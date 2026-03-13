import { Transaction } from '../types/Transaction';
import { CategoriesConfig } from '../types/Category';
import { CategoryChargesData, CategoryMonthData } from '../types/ProjectManagement';
import { ChartGranularity } from '../services/DataService';
import { format, startOfMonth, endOfMonth, isWithinInterval, differenceInMonths, parse } from 'date-fns';

/**
 * Calcule les données de charges par catégorie à partir des transactions réelles.
 */
export function computeCategoryChargesData(
  transactions: Transaction[],
  selectedCategories: string[],
  referencePeriod: { startDate: Date; endDate: Date },
  categories: CategoriesConfig
): CategoryChargesData {
  const startDate = startOfMonth(referencePeriod.startDate);
  const endDate = endOfMonth(referencePeriod.endDate);
  const monthsInPeriod = Math.max(1, differenceInMonths(endDate, startDate) + 1);

  const categoryMap = new Map<string, CategoryMonthData>();
  const totalByMonth: Record<string, number> = {};

  for (const code of selectedCategories) {
    const cat = categories[code];
    const monthlyAmounts: Record<string, number> = {};
    let total = 0;
    const codeNorm = code.trim();

    const filtered = transactions.filter((t) => {
      const tCat = (t.category || '').trim();
      if (!tCat || tCat !== codeNorm) return false;
      const txDate = new Date(t.date);
      return isWithinInterval(txDate, { start: startDate, end: endDate });
    });

    for (const t of filtered) {
      const amount = t.amount < 0 ? Math.abs(t.amount) : 0;
      if (amount <= 0) continue;

      const monthKey = format(new Date(t.date), 'yyyy-MM');
      monthlyAmounts[monthKey] = (monthlyAmounts[monthKey] || 0) + amount;
      total += amount;
    }

    const average = total / monthsInPeriod;

    for (const [monthKey, amt] of Object.entries(monthlyAmounts)) {
      totalByMonth[monthKey] = (totalByMonth[monthKey] || 0) + amt;
    }

    categoryMap.set(code, {
      code,
      name: cat?.name || code,
      color: cat?.color || '#0ea5e9',
      monthlyAmounts,
      total,
      average,
    });
  }

  return {
    categories: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
    referencePeriod: { startDate, endDate },
    totalByMonth,
  };
}

function monthKeyToPeriodKey(monthKey: string, granularity: ChartGranularity): string {
  const [y, m] = monthKey.split('-').map(Number);
  switch (granularity) {
    case 'month':
      return monthKey;
    case 'quarter':
      return `${y}-Q${Math.ceil(m / 3)}`;
    case 'semester':
      return `${y}-S${m <= 6 ? 1 : 2}`;
    case 'year':
      return String(y);
    default:
      return monthKey;
  }
}

/**
 * Convertit CategoryChargesData au format attendu par BilanFinancierChart
 * (équivalent à aggregateChargesBySubscriptionAndPeriod).
 */
export function categoryChargesToBilanFormat(
  data: CategoryChargesData,
  granularity: ChartGranularity,
  dateFrom?: Date | null,
  dateTo?: Date | null
): {
  periodKeys: string[];
  categories: string[];
  monthlyData: number[][];
  categoryColors: Record<string, string>;
} {
  if (data.categories.length === 0) {
    return { periodKeys: [], categories: [], monthlyData: [], categoryColors: {} };
  }

  let monthKeys = Object.keys(data.totalByMonth).sort();
  if (dateFrom || dateTo) {
    monthKeys = monthKeys.filter((pk) => {
      const d = parse(pk + '-01', 'yyyy-MM-dd', new Date());
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }

  const periodAgg = new Map<string, Map<string, number>>();
  for (const mk of monthKeys) {
    const pk = monthKeyToPeriodKey(mk, granularity);
    if (!periodAgg.has(pk)) periodAgg.set(pk, new Map());
    const periodData = periodAgg.get(pk)!;
    for (const cat of data.categories) {
      const val = cat.monthlyAmounts[mk] ?? 0;
      periodData.set(cat.name, (periodData.get(cat.name) ?? 0) + val);
    }
  }

  const periodKeys = [...periodAgg.keys()].sort();
  const categories = data.categories.map((c) => c.name);
  const categoryColors: Record<string, string> = {};
  data.categories.forEach((c) => {
    categoryColors[c.name] = c.color;
  });

  const monthlyData = data.categories.map((cat) =>
    periodKeys.map((pk) => periodAgg.get(pk)?.get(cat.name) ?? 0)
  );

  return {
    periodKeys,
    categories,
    monthlyData,
    categoryColors,
  };
}
