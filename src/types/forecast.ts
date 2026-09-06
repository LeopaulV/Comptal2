import { ChartGranularity } from './projection';

export type ForecastWidgetType =
  | 'stats'
  | 'balance'
  | 'debitCredit'
  | 'category'
  | 'lines'
  | 'cashflow'
  | 'groupBreakdown';

export type ForecastColumnId =
  | 'name'
  | 'group'
  | 'type'
  | 'amount'
  | 'periodicity'
  | 'startDate'
  | 'endDate'
  | 'category'
  | 'color';

export const FORECAST_COLUMN_CATALOG: ForecastColumnId[] = [
  'name',
  'group',
  'type',
  'amount',
  'periodicity',
  'startDate',
  'endDate',
  'category',
  'color',
];

export const DEFAULT_FORECAST_COLUMNS: ForecastColumnId[] = [
  'name',
  'group',
  'type',
  'amount',
  'periodicity',
  'startDate',
  'endDate',
];

export const DEFAULT_COLUMN_WIDTHS: Record<ForecastColumnId, number> = {
  name: 200,
  group: 150,
  type: 96,
  amount: 110,
  periodicity: 128,
  startDate: 118,
  endDate: 118,
  category: 150,
  color: 88,
};

export interface ForecastWidgetConfig {
  id: string;
  type: ForecastWidgetType;
  enabled: boolean;
  order: number;
}

export interface ForecastWidgetLayout {
  widgets: ForecastWidgetConfig[];
  chartGranularity: ChartGranularity;
  splitRatio: number;
  columns: ForecastColumnId[];
  columnWidths: Partial<Record<ForecastColumnId, number>>;
}

export interface ProjectionData {
  date: Date;
  balance: number;
  totalDebits: number;
  totalCredits: number;
  netFlow: number;
  cumulativeImpact: number;
}

export interface ProjectionStats {
  totalDebits: number;
  totalCredits: number;
  netFlow: number;
  finalBalance: number;
}

export interface PeriodAggregate {
  periods: string[];
  balances: number[];
  debits: number[];
  credits: number[];
  netFlows: number[];
}

export interface BreakdownSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface BreakdownDetail {
  label: string;
  value: number;
}

export interface BalanceSeries {
  labels: string[];
  balances: number[];
  debits: number[];
  credits: number[];
}

export interface ForecastComputed {
  projectionData: ProjectionData[];
  aggregates: PeriodAggregate;
  stats: ProjectionStats;
  balanceSeries: BalanceSeries;
  debitCredit: BreakdownSlice[];
  categories: BreakdownSlice[];
  lines: BreakdownSlice[];
  groups: BreakdownSlice[];
  categoryDetails: Record<string, BreakdownDetail[]>;
  groupDetails: Record<string, BreakdownDetail[]>;
}

export const DEFAULT_SPLIT_RATIO = 0.58;
export const SPLIT_RATIO_STORAGE_KEY = 'previsionnel.splitRatio';

export const DEFAULT_WIDGET_LAYOUT: ForecastWidgetLayout = {
  chartGranularity: 'month',
  splitRatio: DEFAULT_SPLIT_RATIO,
  columns: [...DEFAULT_FORECAST_COLUMNS],
  columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
  widgets: [
    { id: 'stats', type: 'stats', enabled: true, order: 0 },
    { id: 'balance', type: 'balance', enabled: true, order: 1 },
    { id: 'debitCredit', type: 'debitCredit', enabled: true, order: 2 },
    { id: 'category', type: 'category', enabled: true, order: 3 },
    { id: 'lines', type: 'lines', enabled: true, order: 4 },
    { id: 'cashflow', type: 'cashflow', enabled: false, order: 5 },
    { id: 'groupBreakdown', type: 'groupBreakdown', enabled: false, order: 6 },
  ],
};

const FORECAST_WIDGET_TYPES = new Set<ForecastWidgetType>(
  DEFAULT_WIDGET_LAYOUT.widgets.map((widget) => widget.type)
);

export function normalizeForecastWidgets(widgets?: ForecastWidgetConfig[]): ForecastWidgetConfig[] {
  const current = (widgets ?? []).filter((widget) => FORECAST_WIDGET_TYPES.has(widget.type));
  const present = new Set(current.map((widget) => widget.type));
  for (const def of DEFAULT_WIDGET_LAYOUT.widgets) {
    if (!present.has(def.type)) current.push({ ...def, order: current.length });
  }
  return current.map((widget, order) => ({ ...widget, order }));
}

export function clampSplitRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SPLIT_RATIO;
  return Math.min(0.75, Math.max(0.35, value));
}

export function normalizeForecastColumns(columns?: string[]): ForecastColumnId[] {
  const allowed = new Set<string>(FORECAST_COLUMN_CATALOG);
  const next = (columns ?? DEFAULT_FORECAST_COLUMNS).filter((c): c is ForecastColumnId =>
    allowed.has(c)
  );
  if (!next.includes('name')) next.unshift('name');
  const legacyDefault =
    !next.includes('group') &&
    next.length === 6 &&
    next[0] === 'name' &&
    next[1] === 'type';
  if (legacyDefault) next.splice(1, 0, 'group');
  return next.length ? next : [...DEFAULT_FORECAST_COLUMNS];
}
