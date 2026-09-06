import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  format,
  getISOWeek,
  getISOWeekYear,
  getWeek,
  getYear,
  isValid,
  parse,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChartGranularity } from '../types/projection';

export function getPeriodKey(date: Date, granularity: ChartGranularity): string {
  switch (granularity) {
    case 'day':
      return format(date, 'yyyy-MM-dd');
    case 'week':
      return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
    case 'month':
      return format(date, 'yyyy-MM');
    case 'quarter':
      return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    case 'semester':
      return `${date.getFullYear()}-S${date.getMonth() < 6 ? 1 : 2}`;
    case 'year':
      return String(date.getFullYear());
  }
}

export const GRANULARITY_ORDER: ChartGranularity[] = [
  'day',
  'week',
  'month',
  'quarter',
  'semester',
  'year',
];

export function getNextGranularity(current: ChartGranularity): ChartGranularity | null {
  const idx = GRANULARITY_ORDER.indexOf(current);
  return idx > 0 ? GRANULARITY_ORDER[idx - 1]! : null;
}

export function getPreviousGranularity(current: ChartGranularity): ChartGranularity | null {
  const idx = GRANULARITY_ORDER.indexOf(current);
  return idx >= 0 && idx < GRANULARITY_ORDER.length - 1 ? GRANULARITY_ORDER[idx + 1]! : null;
}

export function parsePeriodKeyToDate(key: string, granularity: ChartGranularity): Date {
  switch (granularity) {
    case 'day':
      return parse(key, 'yyyy-MM-dd', new Date());
    case 'week': {
      const match = key.match(/^(\d{4})-W(\d{2})$/);
      if (match) {
        const year = Number(match[1]);
        const week = Number(match[2]);
        const jan4 = new Date(year, 0, 4);
        const day = jan4.getDay() || 7;
        const weekStart = new Date(jan4);
        weekStart.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
        return weekStart;
      }
      return parse(key, 'yyyy-MM-dd', new Date());
    }
    case 'month':
      return parse(`${key}-01`, 'yyyy-MM-dd', new Date());
    case 'quarter': {
      const [y, q] = key.split('-Q').map(Number);
      return new Date(y, (q - 1) * 3, 1);
    }
    case 'semester': {
      const [y, s] = key.split('-S').map(Number);
      return new Date(y, (s - 1) * 6, 1);
    }
    case 'year':
      return new Date(parseInt(key, 10), 0, 1);
    default:
      return new Date(key);
  }
}

export function sortPeriodKeys(keys: string[], granularity: ChartGranularity): string[] {
  return [...keys].sort((a, b) => {
    return parsePeriodKeyToDate(a, granularity).getTime() - parsePeriodKeyToDate(b, granularity).getTime();
  });
}

export function getPeriodLabel(key: string, granularity: ChartGranularity): string {
  try {
    switch (granularity) {
      case 'day':
        return format(parse(key, 'yyyy-MM-dd', new Date()), 'd MMM yyyy', { locale: fr });
      case 'week': {
        const d = parsePeriodKeyToDate(key, granularity);
        const weekNum = getWeek(d, { weekStartsOn: 1, firstWeekContainsDate: 4 });
        return `Sem. ${weekNum} ${getYear(d)}`;
      }
      case 'month':
        return format(parse(`${key}-01`, 'yyyy-MM-dd', new Date()), 'MMM yyyy', { locale: fr });
      case 'quarter':
        return key.replace('-Q', ' T');
      case 'semester':
        return key.replace('-S', ' S');
      case 'year':
        return key;
      default:
        return key;
    }
  } catch {
    return key;
  }
}

export function enumeratePeriodKeys(
  dateStart: string,
  dateEnd: string,
  granularity: ChartGranularity
): string[] {
  const start = parseISO(dateStart);
  const end = parseISO(dateEnd);
  if (!isValid(start) || !isValid(end) || start > end) return [];
  const keys: string[] = [];
  const seen = new Set<string>();
  let cursor = start;
  for (let i = 0; i < 1200; i += 1) {
    if (cursor > end) break;
    const key = getPeriodKey(cursor, granularity);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    if (granularity === 'day') cursor = addDays(cursor, 1);
    else if (granularity === 'week') cursor = addWeeks(cursor, 1);
    else if (granularity === 'month') cursor = addMonths(cursor, 1);
    else if (granularity === 'quarter') cursor = addMonths(cursor, 3);
    else if (granularity === 'semester') cursor = addMonths(cursor, 6);
    else cursor = addYears(cursor, 1);
  }
  return keys;
}

export function filterPeriodKeysInRange(
  keys: string[],
  granularity: ChartGranularity,
  dateStart?: string,
  dateEnd?: string
): string[] {
  if (!dateStart || !dateEnd) return sortPeriodKeys(keys, granularity);
  const start = new Date(dateStart).getTime();
  const end = new Date(dateEnd).getTime();
  return sortPeriodKeys(
    keys.filter((key) => {
      const t = parsePeriodKeyToDate(key, granularity).getTime();
      return t >= start && t <= end;
    }),
    granularity
  );
}
