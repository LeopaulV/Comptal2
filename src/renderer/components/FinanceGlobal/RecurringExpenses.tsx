import React from 'react';
import { Transaction } from '../../types/Transaction';
import { formatCurrency } from '../../utils/format';
import { RepeatIcon } from 'lucide-react';

interface RecurringExpense {
  description: string;
  averageAmount: number;
  frequency: number;
  lastDate: Date;
}

interface RecurringExpensesProps {
  transactions: Transaction[];
}

const RecurringExpenses: React.FC<RecurringExpensesProps> = ({ transactions }) => {
  // Analyser les transactions pour détecter les dépenses récurrentes
  const detectRecurring = (): RecurringExpense[] => {
    const descriptionMap = new Map<string, Transaction[]>();

    // Grouper par description similaire
    transactions
      .filter(t => t.amount < 0)
      .forEach(t => {
        const key = t.description.toLowerCase().trim();
        if (!descriptionMap.has(key)) {
          descriptionMap.set(key, []);
        }
        descriptionMap.get(key)!.push(t);
      });

    // Identifier les récurrents (au moins 3 occurrences)
    const recurring: RecurringExpense[] = [];
    descriptionMap.forEach((txs) => {
      if (txs.length >= 3) {
        const avgAmount = Math.abs(
          txs.reduce((sum, t) => sum + t.amount, 0) / txs.length
        );
        const lastDate = new Date(Math.max(...txs.map(t => t.date.getTime())));
        
        recurring.push({
          description: txs[0].description,
          averageAmount: avgAmount,
          frequency: txs.length,
          lastDate,
        });
      }
    });

    // Trier par montant moyen décroissant
    return recurring.sort((a, b) => b.averageAmount - a.averageAmount).slice(0, 10);
  };

  const recurringExpenses = detectRecurring();

  if (recurringExpenses.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        Aucune dépense récurrente détectée
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recurringExpenses.map((expense, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg
                   hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
              <RepeatIcon className="text-orange-600 dark:text-orange-400" size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {expense.description}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {expense.frequency} occurrence{expense.frequency > 1 ? 's' : ''} 
                {' • '}
                Dernière: {expense.lastDate.toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <p className="font-semibold text-red-600 dark:text-red-400">
              {formatCurrency(expense.averageAmount)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              moyenne
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecurringExpenses;

