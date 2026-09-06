export type FinanceTabId =
  | 'monthly'
  | 'balance'
  | 'projection'
  | 'bilan'
  | 'facturation'
  | 'dons'
  | 'contacts';

export interface FinanceTabConfig {
  id: FinanceTabId;
  visible: boolean;
  order: number;
}

export const FINANCE_TAB_CATALOG: FinanceTabId[] = [
  'monthly',
  'balance',
  'projection',
  'bilan',
  'facturation',
  'dons',
  'contacts',
];

export const DEFAULT_FINANCE_TABS: FinanceTabConfig[] = FINANCE_TAB_CATALOG.map((id, order) => ({
  id,
  visible: true,
  order,
}));

export const FINANCE_TAB_I18N: Record<FinanceTabId, string> = {
  monthly: 'financeGlobal.monthlyChart',
  balance: 'financeGlobal.balanceChart',
  projection: 'financeGlobal.projectionVsRealityChart',
  bilan: 'financeGlobal.bilanTab',
  facturation: 'financeGlobal.facturationTab',
  dons: 'financeGlobal.donsTab',
  contacts: 'financeGlobal.contactsTab',
};

export const FINANCE_CHART_TABS_KEY = 'finance_chart_tabs';
