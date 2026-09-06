import { TransactionRow } from './models';

export type EditionUpdateFields = Partial<
  Pick<
    TransactionRow,
    'date' | 'valueDate' | 'debit' | 'credit' | 'label' | 'categoryCode' | 'accountId' | 'tag'
  >
>;

export type EditionHistoryAction =
  | { kind: 'update'; id: number; before: EditionUpdateFields; after: EditionUpdateFields }
  | { kind: 'insert'; row: TransactionRow }
  | { kind: 'delete'; row: TransactionRow }
  | {
      kind: 'bulkUpdate';
      items: Array<{ id: number; before: EditionUpdateFields; after: EditionUpdateFields }>;
    }
  | { kind: 'bulkDelete'; rows: TransactionRow[] };
