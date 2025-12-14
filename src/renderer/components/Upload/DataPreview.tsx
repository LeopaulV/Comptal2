import React from 'react';
import { Transaction } from '../../types/Transaction';
import { formatCurrency, formatDate } from '../../utils/format';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface DataPreviewProps {
  transactions: Transaction[];
  duplicates?: number;
  errors?: string[];
}

const DataPreview: React.FC<DataPreviewProps> = ({ 
  transactions, 
  duplicates = 0,
  errors = []
}) => {
  const hasIssues = duplicates > 0 || errors.length > 0;

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
            Transactions détectées
          </p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            {transactions.length}
          </p>
        </div>

        {duplicates > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
              Doublons possibles
            </p>
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
              {duplicates}
            </p>
          </div>
        )}

        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">
              Erreurs
            </p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-300">
              {errors.length}
            </p>
          </div>
        )}
      </div>

      {/* Messages d'erreur */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 dark:text-red-200 mb-2">
                Erreurs détectées
              </h4>
              <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Statut */}
      {!hasIssues && transactions.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
            <p className="text-green-900 dark:text-green-200 font-medium">
              Les données sont prêtes à être importées
            </p>
          </div>
        </div>
      )}

      {/* Aperçu des transactions */}
      {transactions.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            Aperçu des transactions (10 premières)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Date</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Description</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Compte</th>
                  <th className="px-4 py-2 text-right text-gray-700 dark:text-gray-300">Montant</th>
                  <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300">Catégorie</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map((transaction, index) => (
                  <tr 
                    key={index}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 text-gray-900 dark:text-white">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white max-w-xs truncate">
                      {transaction.description}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      {transaction.accountCode}
                    </td>
                    <td 
                      className={`px-4 py-2 text-right font-medium ${
                        transaction.amount > 0 
                          ? 'text-green-600 dark:text-green-400' 
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      {transaction.category || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length > 10 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
              ... et {transactions.length - 10} transaction(s) supplémentaire(s)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DataPreview;

