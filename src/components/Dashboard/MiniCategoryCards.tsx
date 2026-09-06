import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Category } from '../../types/models';
import { CategoryTotal } from '../../services/StatsService';
import { formatMoney } from '../../utils/amounts';
import { formatFrDate } from '../../utils/dateFormats';

interface MiniCategoryCardsProps {
  totals: CategoryTotal[];
  categories: Category[];
  months: number;
  totalExpenses: number;
  dateStart: string;
  dateEnd: string;
  onExplain: (text: string) => void;
}

const MiniCategoryCards: React.FC<MiniCategoryCardsProps> = React.memo(
  ({ totals, categories, months, totalExpenses, dateStart, dateEnd, onExplain }) => {
    const { t } = useTranslation();
    const divisor = Math.max(months, 1);
    const byCode = useMemo(() => new Map(categories.map((c) => [c.code, c])), [categories]);
    const from = formatFrDate(dateStart);
    const to = formatFrDate(dateEnd);

    const filtered = totals.filter(
      (item) => item.categoryCode && item.categoryCode !== 'X' && item.categoryCode !== 'Y'
    );

    if (filtered.length === 0) return null;

    return (
      <div className="account-cards">
        {filtered.slice(0, 12).map((item) => {
          const cat = item.categoryCode ? byCode.get(item.categoryCode) : undefined;
          const avg = item.net / divisor;
          const expenseShare =
            totalExpenses > 0 && item.expenses > 0
              ? ((item.expenses / totalExpenses) * 100).toFixed(1)
              : '0';
          const isPositive = avg >= 0;
          const name = cat?.name ?? item.categoryCode ?? '';

          return (
            <button
              type="button"
              key={item.categoryCode}
              className="mini-card"
              style={{ borderLeftColor: cat?.color ?? 'var(--invoicing-gray-400)' }}
              onMouseEnter={() =>
                onExplain(
                  t('dashboard.explain.category', {
                    name,
                    from,
                    to,
                    amount: formatMoney(avg),
                    total: formatMoney(item.net),
                    pct: expenseShare,
                    count: item.txCount ?? 0,
                  })
                )
              }
            >
              <div className="mini-card-body">
                <span className="mini-card-name">{name}</span>
                <span className={`mini-card-value ${isPositive ? 'positive' : 'negative'}`}>
                  {formatMoney(avg)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);

MiniCategoryCards.displayName = 'MiniCategoryCards';
export default MiniCategoryCards;
