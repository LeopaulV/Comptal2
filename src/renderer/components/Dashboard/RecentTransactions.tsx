import React from 'react';
import { Transaction } from '../../types/Transaction';
import { formatCurrency, formatDate } from '../../utils/format';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface RecentTransactionsProps {
  transactions: Transaction[];
  limit?: number;
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ 
  transactions, 
  limit = 10 
}) => {
  const recentTransactions = transactions.slice(0, limit);

  return (
    <div className="space-y-3">
      {recentTransactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between p-3 rounded-lg 
                     hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div 
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                transaction.amount > 0 
                  ? 'bg-green-100 dark:bg-green-900' 
                  : 'bg-red-100 dark:bg-red-900'
              }`}
            >
              {transaction.amount > 0 ? (
                <ArrowUpRight className="text-green-600 dark:text-green-400" size={20} />
              ) : (
                <ArrowDownRight className="text-red-600 dark:text-red-400" size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {transaction.description}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDate(transaction.date)}</span>
                <span>•</span>
                <span>{transaction.accountName || transaction.accountCode}</span>
                {transaction.category && (
                  <>
                    <span>•</span>
                    <span>{transaction.category}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <p 
              className={`font-semibold ${
                transaction.amount > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(transaction.amount)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentTransactions;

