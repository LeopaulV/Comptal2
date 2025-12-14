import React from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { AccountSummary } from '@types/Account';
import { formatCurrency } from '../../utils/format';

interface AccountCardProps {
  account: AccountSummary;
}

const AccountCard: React.FC<AccountCardProps> = ({ account }) => {
  const netAmount = account.income - account.expenses;
  const isPositive = netAmount >= 0;

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 
                 hover:shadow-lg transition-shadow duration-200"
      style={{ borderLeftColor: account.color }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: account.color + '30' }}
          >
            <Wallet size={20} style={{ color: account.color }} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {account.accountName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {account.accountCode}
            </p>
          </div>
        </div>
      </div>

      {/* Solde */}
      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Solde actuel</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatCurrency(account.balance)}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
            <TrendingUp size={16} />
            <span className="text-xs font-medium">Revenus</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(account.income)}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400 mb-1">
            <TrendingDown size={16} />
            <span className="text-xs font-medium">Dépenses</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {formatCurrency(account.expenses)}
          </p>
        </div>
      </div>

      {/* Net */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Net</span>
          <span 
            className={`font-semibold ${
              isPositive 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatCurrency(netAmount)}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {account.transactionCount} transaction{account.transactionCount > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

export default AccountCard;

