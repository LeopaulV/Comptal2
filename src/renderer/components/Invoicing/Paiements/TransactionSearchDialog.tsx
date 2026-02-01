import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataService } from '../../../services/DataService';
import { Transaction } from '../../../types/Transaction';
import { formatCurrency, formatDate } from '../../../utils/format';

interface TransactionSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (transaction: Transaction) => void;
  excludeTransactionIds?: string[];
}

export const TransactionSearchDialog: React.FC<TransactionSearchDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  excludeTransactionIds = [],
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!isOpen) return;
      setIsLoading(true);
      try {
        const transactions = await DataService.getTransactions();
        setAllTransactions(transactions);
      } catch (error) {
        console.error('Erreur lors du chargement des transactions:', error);
        setAllTransactions([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  const excludedIds = useMemo(() => new Set(excludeTransactionIds), [excludeTransactionIds]);

  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) {
      return [];
    }
    const lowerSearch = searchTerm.toLowerCase().trim();
    return allTransactions
      .filter((transaction) => {
        if (excludedIds.has(transaction.id)) return false;
        if (transaction.amount <= 0) return false;
        const description = transaction.description?.toLowerCase() || '';
        const accountCode = transaction.accountCode?.toLowerCase() || '';
        const accountName = transaction.accountName?.toLowerCase() || '';
        const amountStr = Math.abs(transaction.amount).toString();
        return (
          description.includes(lowerSearch) ||
          accountCode.includes(lowerSearch) ||
          accountName.includes(lowerSearch) ||
          amountStr.includes(lowerSearch)
        );
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 25);
  }, [searchTerm, allTransactions, excludedIds]);

  const handleClose = () => {
    setSearchTerm('');
    onClose();
  };

  const handleSelect = (transaction: Transaction) => {
    onSelect(transaction);
    setSearchTerm('');
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('invoicing.payments.searchTransaction')}
        </h2>
        <div className="mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('projectManagement.subscriptionTable.transactionSearchDialog.searchPlaceholder', 'Rechercher dans les libellés...')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('projectManagement.subscriptionTable.transactionSearchDialog.loading', 'Chargement...')}
            </div>
          ) : searchTerm.trim() === '' ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('projectManagement.subscriptionTable.transactionSearchDialog.searchPlaceholder', 'Rechercher dans les libellés...')}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {t('projectManagement.subscriptionTable.transactionSearchDialog.noResults', 'Aucun résultat')}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => handleSelect(transaction)}
                  className="w-full text-left p-3 border rounded-lg border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <span>{formatDate(transaction.date)}</span>
                        <span>•</span>
                        <span>{transaction.accountCode}</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end items-center pt-4 mt-4 border-t border-gray-300 dark:border-gray-600">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t('projectManagement.subscriptionTable.transactionSearchDialog.cancel', 'Annuler')}
          </button>
        </div>
      </div>
    </div>
  );
};
