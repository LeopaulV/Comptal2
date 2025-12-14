import React from 'react';
import { TransactionStats } from '../../types/Transaction';
import { formatCurrency } from '../../utils/format';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react';

interface StatsGridProps {
  stats: TransactionStats;
}

const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
  const savingsRate = stats.totalIncome > 0 
    ? ((stats.netBalance / stats.totalIncome) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Transactions */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <Activity size={32} className="opacity-80" />
          <span className="text-2xl font-bold">{stats.totalTransactions}</span>
        </div>
        <p className="text-blue-100 text-sm font-medium">Total Transactions</p>
      </div>

      {/* Revenus */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <TrendingUp size={32} className="opacity-80" />
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(stats.totalIncome)}</p>
          </div>
        </div>
        <p className="text-green-100 text-sm font-medium">Total Revenus</p>
      </div>

      {/* Dépenses */}
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <TrendingDown size={32} className="opacity-80" />
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(stats.totalExpenses)}</p>
          </div>
        </div>
        <p className="text-red-100 text-sm font-medium">Total Dépenses</p>
      </div>

      {/* Balance Nette */}
      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <DollarSign size={32} className="opacity-80" />
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(stats.netBalance)}</p>
          </div>
        </div>
        <p className="text-purple-100 text-sm font-medium">Balance Nette</p>
      </div>

      {/* Taux d'épargne */}
      <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <TrendingUp size={32} className="opacity-80" />
          <div className="text-right">
            <p className="text-2xl font-bold">{savingsRate}%</p>
          </div>
        </div>
        <p className="text-teal-100 text-sm font-medium">Taux d'Épargne</p>
      </div>

      {/* Moyenne par transaction */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <Activity size={32} className="opacity-80" />
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(stats.averageTransaction)}</p>
          </div>
        </div>
        <p className="text-orange-100 text-sm font-medium">Moyenne / Transaction</p>
      </div>

      {/* Plus gros revenu */}
      {stats.largestIncome && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-green-500">
          <div className="flex items-start justify-between mb-4">
            <ArrowUpCircle size={32} className="text-green-500" />
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(stats.largestIncome.amount)}
              </p>
            </div>
          </div>
          <p className="text-green-600 dark:text-green-400 text-sm font-medium mb-1">
            Plus Gros Revenu
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {stats.largestIncome.description}
          </p>
        </div>
      )}

      {/* Plus grosse dépense */}
      {stats.largestExpense && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-red-500">
          <div className="flex items-start justify-between mb-4">
            <ArrowDownCircle size={32} className="text-red-500" />
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(Math.abs(stats.largestExpense.amount))}
              </p>
            </div>
          </div>
          <p className="text-red-600 dark:text-red-400 text-sm font-medium mb-1">
            Plus Grosse Dépense
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {stats.largestExpense.description}
          </p>
        </div>
      )}
    </div>
  );
};

export default StatsGrid;

