import { TransactionRow } from '../types/models';
import { EditionHistoryAction, EditionUpdateFields } from '../types/editionHistory';

const UPDATE_KEYS: (keyof EditionUpdateFields)[] = [
  'date',
  'valueDate',
  'debit',
  'credit',
  'label',
  'categoryCode',
  'accountId',
  'tag',
];

export function buildUpdateHistoryAction(
  id: number,
  prev: TransactionRow | undefined,
  fields: EditionUpdateFields
): EditionHistoryAction | null {
  if (!prev) return null;
  const before: EditionUpdateFields = {};
  const after: EditionUpdateFields = {};
  for (const key of UPDATE_KEYS) {
    if (fields[key] === undefined) continue;
    const nextVal = fields[key];
    const prevVal = prev[key];
    if (nextVal !== prevVal) {
      (before as Record<string, unknown>)[key] = prevVal;
      (after as Record<string, unknown>)[key] = nextVal;
    }
  }
  if (Object.keys(before).length === 0) return null;
  return { kind: 'update', id, before, after };
}
