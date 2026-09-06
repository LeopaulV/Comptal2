import React from 'react';
import { formatMoney } from '../../utils/amounts';
import { getColorStyle } from '../../utils/financeColorStyle';

export interface FinanceTableColumn {
  key: string;
  label: string;
  sticky?: boolean;
  width?: number;
  align?: 'left' | 'right' | 'center';
}

export interface FinanceTableRow {
  id: string;
  cells: Array<{
    content: React.ReactNode;
    value?: number;
    colorize?: boolean;
    align?: 'left' | 'right' | 'center';
    className?: string;
  }>;
  isTotal?: boolean;
  isOdd?: boolean;
}

interface FinanceTableProps {
  columns: FinanceTableColumn[];
  rows: FinanceTableRow[];
  stickyOffsets?: number[];
  className?: string;
}

const FinanceTable: React.FC<FinanceTableProps> = ({
  columns,
  rows,
  stickyOffsets,
  className,
}) => {
  const offsets =
    stickyOffsets ??
    columns.reduce<number[]>((acc, col, i) => {
      if (!col.sticky) return acc;
      const prev = acc.length > 0 ? acc[acc.length - 1]! + (columns[i - 1]?.width ?? 140) : 0;
      acc.push(prev);
      return acc;
    }, []);

  let stickyIndex = 0;

  return (
    <div className={`finance-global-table-container ${className ?? ''}`}>
      <table className="finance-table finance-sticky-table">
        <thead>
          <tr>
            {columns.map((col, i) => {
              const isSticky = col.sticky;
              const left = isSticky ? offsets[stickyIndex++] : undefined;
              return (
                <th
                  key={col.key}
                  className={isSticky ? 'sticky-col' : undefined}
                  style={{
                    left,
                    minWidth: col.width ?? (isSticky ? 140 : 90),
                    textAlign: col.align ?? 'left',
                  }}
                >
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`${row.isTotal ? 'total-row' : ''} ${row.isOdd ? 'odd-row' : ''}`}
            >
              {row.cells.map((cell, ci) => {
                const col = columns[ci];
                const isSticky = col?.sticky;
                const stickyColIndex = columns
                  .slice(0, ci + 1)
                  .filter((c) => c.sticky).length - 1;
                const left =
                  isSticky && stickyColIndex >= 0 ? offsets[stickyColIndex] : undefined;
                const style =
                  cell.colorize && cell.value !== undefined
                    ? getColorStyle(cell.value)
                    : undefined;
                return (
                  <td
                    key={ci}
                    className={`${isSticky ? 'sticky-col' : ''} ${cell.className ?? ''}`}
                    style={{
                      left,
                      minWidth: col?.width ?? (isSticky ? 140 : 90),
                      textAlign: cell.align ?? col?.align ?? 'left',
                      ...style,
                    }}
                  >
                    {cell.content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export function formatCellMoney(value: number): React.ReactNode {
  if (value === 0) return '-';
  const cls = value > 0 ? 'text-positive' : 'text-negative';
  return <span className={cls}>{formatMoney(value)}</span>;
}

export default FinanceTable;
