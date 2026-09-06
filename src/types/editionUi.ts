export const EDITION_COLUMNS = [
  'date',
  'value_date',
  'account_id',
  'label',
  'debit',
  'credit',
  'category_code',
  'actions',
] as const;

export type EditionColumnKey = (typeof EDITION_COLUMNS)[number];

export const DEFAULT_EDITION_COLUMN_WIDTHS: Record<EditionColumnKey, number> = {
  date: 112,
  value_date: 112,
  account_id: 72,
  label: 280,
  debit: 96,
  credit: 96,
  category_code: 88,
  actions: 40,
};

export interface EditionUiPrefs {
  columnWidths: Partial<Record<EditionColumnKey, number>>;
}

export function mergeColumnWidths(
  saved: Partial<Record<EditionColumnKey, number>> | undefined
): Record<EditionColumnKey, number> {
  return { ...DEFAULT_EDITION_COLUMN_WIDTHS, ...(saved ?? {}) };
}
