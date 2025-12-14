import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountSummary } from '../../types/Account';
import { formatCurrency } from '../../utils/format';

interface MiniAccountCardsProps {
  accounts: AccountSummary[];
  balances?: Record<string, number>; // Soldes dynamiques à une date donnée
}

const MiniAccountCards: React.FC<MiniAccountCardsProps> = ({ accounts, balances }) => {
  const { t } = useTranslation();
  // Utiliser les balances dynamiques si disponibles, sinon utiliser les balances des accounts
  const accountBalances = useMemo(() => {
    if (balances) {
      return balances;
    }
    const result: Record<string, number> = {};
    accounts.forEach(acc => {
      result[acc.accountCode] = acc.balance;
    });
    return result;
  }, [accounts, balances]);

  // Calculer le solde total
  const totalBalance = useMemo(() => {
    return Object.values(accountBalances).reduce((sum, bal) => sum + bal, 0);
  }, [accountBalances]);

  return (
    <div className="account-cards">
      {/* Carte du solde total */}
      <div className="mini-card total-card">
        <div className="mini-card-body">
          <span className="account-name">{t('dashboard.totalBalance')}</span>
          <span className="account-balance">{formatCurrency(totalBalance)}</span>
        </div>
      </div>

      {/* Cartes individuelles des comptes */}
      {accounts.map((account) => {
        const balance = accountBalances[account.accountCode] || 0;
        return (
          <div 
            key={account.accountCode} 
            className="mini-card"
            style={{ borderLeftColor: account.color }}
          >
            <div className="mini-card-body">
              <span className="account-name">{account.accountCode}</span>
              <span className="account-balance">{formatCurrency(balance)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MiniAccountCards;

