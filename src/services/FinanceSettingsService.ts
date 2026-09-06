import {
  DEFAULT_FINANCE_TABS,
  FINANCE_CHART_TABS_KEY,
  FINANCE_TAB_CATALOG,
  FinanceTabConfig,
  FinanceTabId,
} from '../types/finance';
import { Db } from './db';
import { withLog } from './logger';

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeFinanceTabs(stored?: FinanceTabConfig[]): FinanceTabConfig[] {
  const allowed = new Set<FinanceTabId>(FINANCE_TAB_CATALOG);
  const byId = new Map<FinanceTabId, FinanceTabConfig>();
  for (const tab of stored ?? []) {
    if (!allowed.has(tab.id)) continue;
    byId.set(tab.id, tab);
  }
  const merged = FINANCE_TAB_CATALOG.map((id, index) => {
    const existing = byId.get(id);
    return {
      id,
      visible: existing?.visible ?? true,
      order: existing?.order ?? index,
    };
  }).sort((a, b) => a.order - b.order || FINANCE_TAB_CATALOG.indexOf(a.id) - FINANCE_TAB_CATALOG.indexOf(b.id));
  const normalized = merged.map((tab, order) => ({ ...tab, order }));
  if (!normalized.some((tab) => tab.visible)) {
    const monthly = normalized.find((tab) => tab.id === 'monthly');
    if (monthly) monthly.visible = true;
    else normalized[0]!.visible = true;
  }
  return normalized;
}

async function ensureTable(): Promise<void> {
  await Db.execute(
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`
  );
}

export const FinanceSettingsService = {
  defaults: (): FinanceTabConfig[] => DEFAULT_FINANCE_TABS.map((tab) => ({ ...tab })),

  async load(): Promise<FinanceTabConfig[]> {
    return withLog('FinanceSettingsService.load', async () => {
      await ensureTable();
      const rows = await Db.select<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ?',
        [FINANCE_CHART_TABS_KEY]
      );
      if (!rows[0]?.value) return FinanceSettingsService.defaults();
      return normalizeFinanceTabs(parseJson<FinanceTabConfig[]>(rows[0].value, []));
    });
  },

  async save(tabs: FinanceTabConfig[]): Promise<void> {
    return withLog('FinanceSettingsService.save', async () => {
      await ensureTable();
      const payload = JSON.stringify(normalizeFinanceTabs(tabs));
      await Db.execute(
        `INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [FINANCE_CHART_TABS_KEY, payload]
      );
    });
  },
};
