import { Category } from '../types/models';
import {
  DEFAULT_SUBSCRIPTION_COLOR,
  FlowType,
  Periodicity,
  PERIODICITY_VALUES,
  Project,
  ProjectSubscription,
  ChartGranularity,
} from '../types/projection';
import {
  BalanceSeries,
  BreakdownDetail,
  BreakdownSlice,
  ForecastComputed,
  ForecastWidgetLayout,
} from '../types/forecast';
import { getPeriodLabel } from '../utils/periodKeys';
import {
  aggregateByPeriod,
  calculateProjection,
  calculateStats,
  getAllFlatSubscriptions,
  getAllGroupLines,
} from './ProjectionService';

export const EMPTY_TAIL_ROWS = 4;

export interface ForecastGridRow {
  id: number | null;
  parentId: number | null;
  isGroup: boolean;
  depth: number;
  name: string;
  groupName: string;
  type: FlowType;
  amount: number;
  periodicity: Periodicity;
  startDate: string;
  endDate: string;
  categoryCode: string;
  color: string;
}

export function calculateGroupAmount(sub: ProjectSubscription): { amount: number; type: FlowType } {
  if (!sub.isGroup || !sub.children || sub.children.length === 0) {
    return { amount: sub.amount, type: sub.type };
  }
  let total = 0;
  for (const child of sub.children) {
    const childTotals = calculateGroupAmount(child);
    const signed = childTotals.type === 'debit' ? -Math.abs(childTotals.amount) : Math.abs(childTotals.amount);
    total += signed;
  }
  return { amount: Math.abs(total), type: total >= 0 ? 'credit' : 'debit' };
}

export function treeToGridRows(
  tree: ProjectSubscription[],
  extraEmpty = EMPTY_TAIL_ROWS
): ForecastGridRow[] {
  const rows: ForecastGridRow[] = [];
  const walk = (nodes: ProjectSubscription[], depth: number, parentName: string) => {
    for (const node of nodes) {
      const totals = node.isGroup ? calculateGroupAmount(node) : { amount: node.amount, type: node.type };
      rows.push({
        id: node.id,
        parentId: node.parentId,
        isGroup: node.isGroup,
        depth,
        name: node.name,
        groupName: parentName,
        type: totals.type,
        amount: totals.amount,
        periodicity: node.periodicity,
        startDate: node.startDate,
        endDate: node.endDate ?? '',
        categoryCode: node.categoryCode ?? '',
        color: node.color || DEFAULT_SUBSCRIPTION_COLOR,
      });
      if (node.children?.length) walk(node.children, depth + 1, node.name);
    }
  };
  walk(tree, 0, '');
  for (let i = 0; i < extraEmpty; i += 1) {
    rows.push({
      id: null,
      parentId: null,
      isGroup: false,
      depth: 0,
      name: '',
      groupName: '',
      type: 'debit',
      amount: 0,
      periodicity: 'monthly',
      startDate: '',
      endDate: '',
      categoryCode: '',
      color: DEFAULT_SUBSCRIPTION_COLOR,
    });
  }
  return rows;
}

export function parsePeriodicity(raw: unknown): Periodicity {
  const value = String(raw ?? '').trim().toLowerCase();
  const aliases: Record<string, Periodicity> = {
    unique: 'unique',
    ponctuel: 'unique',
    daily: 'daily',
    journalier: 'daily',
    weekly: 'weekly',
    hebdomadaire: 'weekly',
    monthly: 'monthly',
    mensuel: 'monthly',
    quarterly: 'quarterly',
    trimestriel: 'quarterly',
    yearly: 'yearly',
    annuel: 'yearly',
  };
  if (PERIODICITY_VALUES.includes(value as Periodicity)) return value as Periodicity;
  return aliases[value] ?? 'monthly';
}

export function parseFlowType(raw: unknown): FlowType {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'credit' || value === 'crédit') return 'credit';
  return 'debit';
}

export function collectDescendantIds(tree: ProjectSubscription[], rootId: number): Set<number> {
  const ids = new Set<number>();
  const find = (nodes: ProjectSubscription[]): ProjectSubscription | null => {
    for (const n of nodes) {
      if (n.id === rootId) return n;
      if (n.children?.length) {
        const found = find(n.children);
        if (found) return found;
      }
    }
    return null;
  };
  const walk = (n: ProjectSubscription) => {
    for (const child of n.children ?? []) {
      ids.add(child.id);
      walk(child);
    }
  };
  const root = find(tree);
  if (root) walk(root);
  return ids;
}

export function computeForecast(
  project: Project,
  tree: ProjectSubscription[],
  categories: Category[],
  granularity: ChartGranularity
): ForecastComputed {
  const projectionData = calculateProjection(tree, {
    startDate: project.startDate,
    endDate: project.endDate,
    initialBalance: project.initialBalance,
  });
  const aggregates = aggregateByPeriod(projectionData, granularity);
  const stats = calculateStats(projectionData, project.initialBalance);
  const balanceSeries: BalanceSeries = {
    labels: aggregates.periods.map((p) => getPeriodLabel(p, granularity)),
    balances: aggregates.balances,
    debits: aggregates.debits,
    credits: aggregates.credits,
  };

  const debitCredit: BreakdownSlice[] = [
    { id: 'debit', label: 'Débits', value: Math.abs(stats.totalDebits), color: '#ef4444' },
    { id: 'credit', label: 'Crédits', value: Math.abs(stats.totalCredits), color: '#10b981' },
  ].filter((s) => s.value > 0);

  const leaves = getAllFlatSubscriptions(tree);
  const byCat = new Map<string, BreakdownSlice>();
  const categoryDetails: Record<string, BreakdownDetail[]> = {};
  for (const leaf of leaves) {
    const code = leaf.categoryCode ?? '—';
    const cat = categories.find((c) => c.code === code);
    const label = cat?.name ?? (code === '—' ? 'Sans catégorie' : code);
    const color = leaf.color || cat?.color || DEFAULT_SUBSCRIPTION_COLOR;
    const signed = leaf.type === 'debit' ? -Math.abs(leaf.amount) : Math.abs(leaf.amount);
    const existing = byCat.get(code);
    if (existing) existing.value += signed;
    else byCat.set(code, { id: code, label, value: signed, color });
    const details = categoryDetails[code] ?? [];
    details.push({ label: leaf.name, value: signed });
    categoryDetails[code] = details;
  }

  const lines: BreakdownSlice[] = leaves
    .filter((l) => l.amount !== 0)
    .map((l) => ({
      id: String(l.id),
      label: l.name,
      value: l.type === 'debit' ? -Math.abs(l.amount) : Math.abs(l.amount),
      color: l.color || DEFAULT_SUBSCRIPTION_COLOR,
    }));

  const groups: BreakdownSlice[] = [];
  const groupDetails: Record<string, BreakdownDetail[]> = {};
  let ungroupedValue = 0;
  const ungroupedDetails: BreakdownDetail[] = [];
  for (const node of tree) {
    if (node.isGroup) {
      const groupLeaves = getAllGroupLines(node);
      const details = groupLeaves.map((leaf) => ({
        label: leaf.name,
        value: leaf.type === 'debit' ? -Math.abs(leaf.amount) : Math.abs(leaf.amount),
      }));
      const value = details.reduce((sum, item) => sum + Math.abs(item.value), 0);
      if (value === 0 && details.length === 0) continue;
      groups.push({
        id: String(node.id),
        label: node.name,
        value,
        color: node.color || DEFAULT_SUBSCRIPTION_COLOR,
      });
      groupDetails[String(node.id)] = details;
    } else {
      const signed = node.type === 'debit' ? -Math.abs(node.amount) : Math.abs(node.amount);
      if (node.amount === 0) continue;
      ungroupedValue += Math.abs(signed);
      ungroupedDetails.push({ label: node.name, value: signed });
    }
  }
  if (ungroupedValue > 0) {
    groups.push({
      id: '__ungrouped',
      label: 'Sans groupe',
      value: ungroupedValue,
      color: DEFAULT_SUBSCRIPTION_COLOR,
    });
    groupDetails.__ungrouped = ungroupedDetails;
  }

  return {
    projectionData,
    aggregates,
    stats,
    balanceSeries,
    debitCredit,
    categories: Array.from(byCat.values()),
    lines,
    groups,
    categoryDetails,
    groupDetails,
  };
}

export function cloneLayout(layout: ForecastWidgetLayout): ForecastWidgetLayout {
  return {
    chartGranularity: layout.chartGranularity,
    splitRatio: layout.splitRatio,
    columns: [...layout.columns],
    columnWidths: { ...layout.columnWidths },
    widgets: layout.widgets.map((w) => ({ ...w })),
  };
}
