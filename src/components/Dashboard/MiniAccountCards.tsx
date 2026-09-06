import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Account } from '../../types/models';
import { AccountBalance } from '../../services/StatsService';
import { formatMoney } from '../../utils/amounts';
import { formatFrDate } from '../../utils/dateFormats';

interface MiniAccountCardsProps {
  accounts: AccountBalance[];
  accountConfigs: Account[];
  dateEnd: string;
  onExplain: (text: string) => void;
}

const MiniAccountCards: React.FC<MiniAccountCardsProps> = React.memo(
  ({ accounts, accountConfigs, dateEnd, onExplain }) => {
    const { t } = useTranslation();
    const total = accounts.reduce((s, a) => s + a.balance, 0);
    const initialById = useMemo(
      () => new Map(accountConfigs.map((a) => [a.id, a.initialBalance])),
      [accountConfigs]
    );
    const atDate = formatFrDate(dateEnd);

    return (
      <div className="account-cards">
        <button
          type="button"
          className="mini-card total-card"
          onMouseEnter={() =>
            onExplain(
              t('dashboard.explain.accountTotal', {
                date: atDate,
                amount: formatMoney(total),
              })
            )
          }
        >
          <div className="mini-card-body">
            <span className="mini-card-name">{t('dashboard.totalBalance')}</span>
            <span className="mini-card-value">{formatMoney(total)}</span>
          </div>
        </button>
        {accounts.map((a) => {
          const pct = total !== 0 ? ((a.balance / total) * 100).toFixed(1) : '0';
          const initial = initialById.get(a.accountId) ?? 0;
          return (
            <button
              type="button"
              key={a.accountId}
              className="mini-card"
              style={{ borderLeftColor: a.color }}
              onMouseEnter={() =>
                onExplain(
                  t('dashboard.explain.account', {
                    name: `${a.code} — ${a.name}`,
                    date: atDate,
                    amount: formatMoney(a.balance),
                    pct,
                    initial: formatMoney(initial),
                  })
                )
              }
            >
              <div className="mini-card-body">
                <span className="mini-card-name">{a.code}</span>
                <span className="mini-card-value">{formatMoney(a.balance)}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);

MiniAccountCards.displayName = 'MiniAccountCards';
export default MiniAccountCards;
