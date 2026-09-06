import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TransactionListRow, TransactionSortKey, SortDirection } from '../../services/StatsService';
import { formatFrDate } from '../../utils/dateFormats';
import { formatMoney } from '../../utils/amounts';

interface TransactionsTableProps {
  rows: TransactionListRow[];
  sortKey: TransactionSortKey;
  sortDir: SortDirection;
  onSort: (key: TransactionSortKey) => void;
}

const SORT_COLUMNS: Array<{ key: TransactionSortKey; labelKey: string }> = [
  { key: 'date', labelKey: 'upload.colDate' },
  { key: 'accountCode', labelKey: 'upload.account' },
  { key: 'label', labelKey: 'upload.colLabel' },
  { key: 'debit', labelKey: 'upload.colDebit' },
  { key: 'credit', labelKey: 'upload.colCredit' },
  { key: 'categoryCode', labelKey: 'settings.tabs.categories' },
];

const SortIcon: React.FC<{ active: boolean; dir: SortDirection }> = ({ active, dir }) => {
  if (!active) return <ArrowUpDown size={12} className="opacity-40" />;
  return dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
};

const TransactionsTable: React.FC<TransactionsTableProps> = React.memo(
  ({ rows, sortKey, sortDir, onSort }) => {
    const { t } = useTranslation();

    return (
      <div className="overflow-auto" style={{ maxHeight: 360 }}>
        <table className="ct-table">
          <thead className="sticky top-0" style={{ background: 'var(--invoicing-gray-50)' }}>
            <tr>
              {SORT_COLUMNS.map((col) => (
                <th key={col.key}>
                  <button
                    type="button"
                    className="flex items-center gap-1 bg-transparent border-0 cursor-pointer font-semibold"
                    style={{ color: 'inherit' }}
                    onClick={() => onSort(col.key)}
                  >
                    {t(col.labelKey)}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6" style={{ color: 'var(--invoicing-gray-500)' }}>
                  {t('dashboard.noData')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatFrDate(row.date)}</td>
                  <td>{row.accountCode}</td>
                  <td>{row.label}</td>
                  <td>{row.debit ? formatMoney(row.debit) : '—'}</td>
                  <td>{row.credit ? formatMoney(row.credit) : '—'}</td>
                  <td>{row.categoryCode ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }
);

TransactionsTable.displayName = 'TransactionsTable';
export default TransactionsTable;
