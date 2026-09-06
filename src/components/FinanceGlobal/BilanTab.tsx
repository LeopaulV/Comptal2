import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BilanChartData } from '../../services/StatsService';
import { formatMoney } from '../../utils/amounts';
import BilanCharts from './BilanCharts';
import FinanceTable, { FinanceTableColumn, FinanceTableRow } from './FinanceTable';

interface BilanTabProps {
  data: BilanChartData | null;
  loading: boolean;
}

const BilanTab: React.FC<BilanTabProps> = ({ data, loading }) => {
  const { t } = useTranslation();

  const allCategories = useMemo(() => {
    if (!data) return [];
    return Array.from(
      new Set([...data.categoriesWithCredits, ...data.categoriesWithDebits])
    );
  }, [data]);

  const detailColumns: FinanceTableColumn[] = useMemo(() => {
    if (!data) return [];
    return [
      { key: 'type', label: `${t('financeGlobal.credit')} / ${t('financeGlobal.debit')}`, sticky: true, width: 90 },
      { key: 'cat', label: t('financeGlobal.category'), sticky: true, width: 200 },
      ...data.months.map((m, i) => ({ key: `m-${i}`, label: m, align: 'right' as const })),
    ];
  }, [data, t]);

  const detailRows: FinanceTableRow[] = useMemo(() => {
    if (!data) return [];
    const rows: FinanceTableRow[] = [];

    data.categoriesWithCredits.forEach((catName, rowIndex) => {
      rows.push({
        id: `c-${catName}`,
        isOdd: rowIndex % 2 !== 0,
        cells: [
          { content: t('financeGlobal.credit'), className: 'bilan-type-credit' },
          {
            content: (
              <span className="flex items-center gap-2">
                <span className="finance-color-dot" style={{ backgroundColor: data.categoryColors[catName] }} />
                {catName}
              </span>
            ),
          },
          ...(data.creditsByCategory[catName] || []).map((val) => ({
            content: val !== 0 ? formatMoney(val) : '-',
            align: 'right' as const,
            className: 'text-positive',
          })),
        ],
      });
    });

    if (data.categoriesWithCredits.length > 0 && data.categoriesWithDebits.length > 0) {
      rows.push({
        id: 'sep',
        cells: [
          { content: '' },
          { content: '' },
          ...data.months.map(() => ({ content: '' })),
        ],
      });
    }

    data.categoriesWithDebits.forEach((catName, rowIndex) => {
      rows.push({
        id: `d-${catName}`,
        isOdd: rowIndex % 2 !== 0,
        cells: [
          { content: t('financeGlobal.debit'), className: 'bilan-type-debit' },
          {
            content: (
              <span className="flex items-center gap-2">
                <span className="finance-color-dot" style={{ backgroundColor: data.categoryColors[catName] }} />
                {catName}
              </span>
            ),
          },
          ...(data.debitsByCategory[catName] || []).map((val) => ({
            content: val !== 0 ? formatMoney(val) : '-',
            align: 'right' as const,
            className: 'text-negative',
          })),
        ],
      });
    });

    if (data.categoriesWithCredits.length > 0) {
      rows.push({
        id: 'total-credits',
        isTotal: true,
        cells: [
          { content: t('financeGlobal.totalCredits') },
          { content: '' },
          ...data.months.map((_, i) => {
            const total = data.categoriesWithCredits.reduce(
              (s, cat) => s + (data.creditsByCategory[cat]?.[i] ?? 0),
              0
            );
            return {
              content: total !== 0 ? formatMoney(total) : '-',
              align: 'right' as const,
              className: 'text-positive',
            };
          }),
        ],
      });
    }

    if (data.categoriesWithDebits.length > 0) {
      rows.push({
        id: 'total-debits',
        isTotal: true,
        cells: [
          { content: t('financeGlobal.totalDebits') },
          { content: '' },
          ...data.months.map((_, i) => {
            const total = data.categoriesWithDebits.reduce(
              (s, cat) => s + (data.debitsByCategory[cat]?.[i] ?? 0),
              0
            );
            return {
              content: total !== 0 ? formatMoney(total) : '-',
              align: 'right' as const,
              className: 'text-negative',
            };
          }),
        ],
      });
    }

    return rows;
  }, [data, detailColumns.length, t]);

  const recapColumns: FinanceTableColumn[] = useMemo(() => {
    if (!data) return [];
    return [
      { key: 'type', label: '', sticky: true, width: 90 },
      ...allCategories.map((c) => ({ key: c, label: c, align: 'right' as const })),
      { key: 'total', label: t('financeGlobal.total'), align: 'right' as const },
    ];
  }, [data, allCategories, t]);

  const recapRows: FinanceTableRow[] = useMemo(() => {
    if (!data) return [];
    const creditCells = allCategories.map((catName) => {
      const total = (data.creditsByCategory[catName] || []).reduce((a, b) => a + b, 0);
      return {
        content: total !== 0 ? formatMoney(total) : '-',
        align: 'right' as const,
        className: 'text-positive',
      };
    });
    const debitCells = allCategories.map((catName) => {
      const total = (data.debitsByCategory[catName] || []).reduce((a, b) => a + b, 0);
      return {
        content: total !== 0 ? formatMoney(total) : '-',
        align: 'right' as const,
        className: 'text-negative',
      };
    });
    const netCells = allCategories.map((catName) => {
      const credits = (data.creditsByCategory[catName] || []).reduce((a, b) => a + b, 0);
      const debits = (data.debitsByCategory[catName] || []).reduce((a, b) => a + b, 0);
      const net = credits + debits;
      return {
        content: net !== 0 ? formatMoney(net) : '-',
        align: 'right' as const,
        className: net >= 0 ? 'text-positive' : 'text-negative',
      };
    });

    const totalCredits = Object.values(data.creditsByCategory).reduce(
      (s, arr) => s + arr.reduce((a, b) => a + b, 0),
      0
    );
    const totalDebits = Object.values(data.debitsByCategory).reduce(
      (s, arr) => s + arr.reduce((a, b) => a + b, 0),
      0
    );

    return [
      {
        id: 'recap-credit',
        isTotal: true,
        cells: [
          { content: t('financeGlobal.credit'), className: 'bilan-type-credit' },
          ...creditCells,
          { content: formatMoney(totalCredits), align: 'right', className: 'text-positive' },
        ],
      },
      {
        id: 'recap-debit',
        isTotal: true,
        cells: [
          { content: t('financeGlobal.debit'), className: 'bilan-type-debit' },
          ...debitCells,
          { content: formatMoney(totalDebits), align: 'right', className: 'text-negative' },
        ],
      },
      {
        id: 'recap-net',
        isTotal: true,
        cells: [
          { content: t('financeGlobal.total') },
          ...netCells,
          {
            content: formatMoney(totalCredits + totalDebits),
            align: 'right',
            className: totalCredits + totalDebits >= 0 ? 'text-positive' : 'text-negative',
          },
        ],
      },
    ];
  }, [data, allCategories, t]);

  if (loading) {
    return (
      <div className="finance-empty">
        <p>{t('financeGlobal.loading')}</p>
      </div>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <div className="finance-empty">
        <p>{t('financeGlobal.bilanNoData')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="finance-global-chart-container" style={{ height: 'auto', minHeight: 360 }}>
        <BilanCharts data={data} />
      </div>
      <FinanceTable
        columns={detailColumns}
        rows={detailRows}
        stickyOffsets={[0, 90]}
        className="finance-global-table-bilan"
      />
      <div className="bilan-recap-section">
        <h3>
          {t('financeGlobal.bilanPdfTitle')} — {t('financeGlobal.total')}
        </h3>
        <FinanceTable
          columns={recapColumns}
          rows={recapRows}
          stickyOffsets={[0]}
          className="bilan-recap-table"
        />
      </div>
    </div>
  );
};

export default BilanTab;
