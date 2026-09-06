import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Category } from '../../types/models';
import { CategoryTotal } from '../../services/StatsService';
import { formatMoney } from '../../utils/amounts';
import InfoTooltip from '../Common/InfoTooltip';

interface TopCategoriesListProps {
  totals: CategoryTotal[];
  categories: Category[];
  totalExpenses: number;
  limit?: number;
}

const TopCategoriesList: React.FC<TopCategoriesListProps> = React.memo(
  ({ totals, categories, totalExpenses, limit = 5 }) => {
    const { t } = useTranslation();
    const byCode = useMemo(() => new Map(categories.map((c) => [c.code, c])), [categories]);

    const top = useMemo(
      () =>
        totals
          .filter((item) => item.categoryCode && item.categoryCode !== 'X' && item.categoryCode !== 'Y')
          .map((item) => ({ ...item, expenseAmount: Math.abs(item.expenses) }))
          .filter((item) => item.expenseAmount > 0)
          .sort((a, b) => b.expenseAmount - a.expenseAmount)
          .slice(0, limit),
      [totals, limit]
    );

    if (top.length === 0) {
      return <p className="ct-hint">{t('dashboard.noChartData')}</p>;
    }

    const maxExpense = top[0]?.expenseAmount ?? 1;

    return (
      <div className="top-categories-list">
        {top.map((item) => {
          const cat = item.categoryCode ? byCode.get(item.categoryCode) : undefined;
          const pct =
            totalExpenses > 0
              ? ((item.expenseAmount / Math.abs(totalExpenses)) * 100).toFixed(1)
              : '0';
          const barWidth = maxExpense > 0 ? (item.expenseAmount / maxExpense) * 100 : 0;

          return (
            <InfoTooltip
              key={item.categoryCode}
              content={
                <div>
                  <div>
                    <strong>{cat?.name ?? item.categoryCode}</strong>
                  </div>
                  <div>{t('dashboard.tooltip.categoryTotal', { amount: formatMoney(item.net) })}</div>
                  <div>{t('dashboard.tooltip.categoryExpenseShare', { pct })}</div>
                  <div>{t('dashboard.tooltip.categoryTxCount', { count: item.txCount ?? 0 })}</div>
                </div>
              }
            >
              <div className="top-category-row">
                <div className="top-category-row-header">
                  <span className="top-category-name">
                    <span
                      className="top-category-dot"
                      style={{ backgroundColor: cat?.color ?? 'var(--invoicing-gray-400)' }}
                    />
                    <span>{cat?.name ?? item.categoryCode}</span>
                  </span>
                  <span className="top-category-amount">{formatMoney(item.expenseAmount)}</span>
                </div>
                <div className="top-category-bar-track">
                  <div
                    className="top-category-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: cat?.color ?? 'var(--invoicing-primary)',
                    }}
                  />
                </div>
              </div>
            </InfoTooltip>
          );
        })}
      </div>
    );
  }
);

TopCategoriesList.displayName = 'TopCategoriesList';
export default TopCategoriesList;
