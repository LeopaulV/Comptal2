import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataService } from '../../services/DataService';
import { ConfigService } from '../../services/ConfigService';
import { Transaction } from '../../types/Transaction';
import { CategoriesConfig } from '../../types/Category';
import { Subscription, Periodicity } from '../../types/ProjectManagement';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '../../utils/format';

interface TransactionSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onValidate: (subscription: Subscription) => void;
}

const TransactionSearchDialog: React.FC<TransactionSearchDialogProps> = ({
  isOpen,
  onClose,
  onValidate,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  const [aggregationMode, setAggregationMode] = useState<'sum' | 'average'>('sum');
  const [periodicity, setPeriodicity] = useState<Periodicity>('monthly');

  // Charger les transactions et catégories au montage
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen) return;
      
      setIsLoading(true);
      try {
        const [transactions, cats] = await Promise.all([
          DataService.getTransactions(),
          ConfigService.loadCategories(),
        ]);
        setAllTransactions(transactions);
        setCategories(cats);
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [isOpen]);

  // Filtrer les transactions selon le terme de recherche
  const filteredTransactions = useMemo(() => {
    if (!searchTerm.trim()) {
      return [];
    }

    const lowerSearch = searchTerm.toLowerCase().trim();
    return allTransactions
      .filter(t => 
        t.description.toLowerCase().includes(lowerSearch)
      )
      .slice(0, 20) // Limiter à 20 résultats
      .sort((a, b) => b.date.getTime() - a.date.getTime()); // Plus récentes en premier
  }, [searchTerm, allTransactions]);

  const selectedTransactions = useMemo(() => {
    if (selectedTransactionIds.size === 0) return [];
    const idSet = selectedTransactionIds;
    return allTransactions.filter(t => idSet.has(t.id));
  }, [allTransactions, selectedTransactionIds]);

  const isAllFilteredSelected = useMemo(() => {
    if (filteredTransactions.length === 0) return false;
    return filteredTransactions.every(t => selectedTransactionIds.has(t.id));
  }, [filteredTransactions, selectedTransactionIds]);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedTransactionIds(prev => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        filteredTransactions.forEach(t => next.delete(t.id));
      } else {
        filteredTransactions.forEach(t => next.add(t.id));
      }
      return next;
    });
  }, [filteredTransactions, isAllFilteredSelected]);

  const handleToggleSelectTransaction = useCallback((transaction: Transaction) => {
    setSelectedTransactionIds(prev => {
      const next = new Set(prev);
      if (next.has(transaction.id)) {
        next.delete(transaction.id);
      } else {
        next.add(transaction.id);
      }
      return next;
    });
  }, []);

  const handleValidateSelection = useCallback(() => {
    if (selectedTransactions.length === 0) return;

    const signedTotal = selectedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const signedValue = aggregationMode === 'average'
      ? signedTotal / selectedTransactions.length
      : signedTotal;

    const type = signedValue < 0 ? 'debit' : 'credit';
    const amount = Math.abs(signedValue);

    // Si toutes les transactions ont la même catégorie, l'utiliser
    const uniqueCategories = new Set(selectedTransactions.map(t => t.category).filter(Boolean));
    const categoryCode = uniqueCategories.size === 1 ? Array.from(uniqueCategories)[0] as string : undefined;
    const category = categoryCode ? categories[categoryCode] : null;

    const label = aggregationMode === 'average'
      ? t('projectManagement.subscriptionTable.transactionSearchDialog.averageLabel', 'Moyenne transactions')
      : t('projectManagement.subscriptionTable.transactionSearchDialog.sumLabel', 'Somme transactions');

    const newSubscription: Subscription = {
      id: `sub_${Date.now()}`,
      name: `${label} (${selectedTransactions.length})`,
      amount,
      periodicity,
      type,
      startDate: new Date(),
      categoryCode,
      color: category?.color || '#0ea5e9',
    };

    onValidate(newSubscription);
    // Réinitialiser
    setSearchTerm('');
    setSelectedTransactionIds(new Set());
    setAggregationMode('sum');
    setPeriodicity('monthly');
    onClose();
  }, [selectedTransactions, aggregationMode, periodicity, categories, onValidate, onClose, t]);

  const handleClose = useCallback(() => {
    setSearchTerm('');
    setSelectedTransactionIds(new Set());
    setAggregationMode('sum');
    setPeriodicity('monthly');
    onClose();
  }, [onClose]);

  const periodicityOptions: { value: Periodicity; label: string }[] = [
    { value: 'daily', label: t('projectManagement.periodicity.daily', 'Journalier') },
    { value: 'weekly', label: t('projectManagement.periodicity.weekly', 'Hebdomadaire') },
    { value: 'monthly', label: t('projectManagement.periodicity.monthly', 'Mensuel') },
    { value: 'quarterly', label: t('projectManagement.periodicity.quarterly', 'Trimestriel') },
    { value: 'yearly', label: t('projectManagement.periodicity.yearly', 'Annuel') },
    { value: 'unique', label: t('projectManagement.periodicity.unique', 'Unique') },
  ];

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('projectManagement.subscriptionTable.transactionSearchDialog.title', 'Rechercher une transaction')}
        </h2>

        {/* Barre de recherche */}
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

        {/* Options de création */}
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('projectManagement.subscriptionTable.transactionSearchDialog.mode', 'Mode')}
            </label>
            <select
              value={aggregationMode}
              onChange={(e) => setAggregationMode(e.target.value as 'sum' | 'average')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="sum">{t('projectManagement.subscriptionTable.transactionSearchDialog.sum', 'Somme')}</option>
              <option value="average">{t('projectManagement.subscriptionTable.transactionSearchDialog.average', 'Moyenne')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('projectManagement.subscriptionTable.transactionSearchDialog.frequency', 'Fréquence')}
            </label>
            <select
              value={periodicity}
              onChange={(e) => setPeriodicity(e.target.value as Periodicity)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {periodicityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    {t('projectManagement.subscriptionTable.transactionSearchDialog.selectedCount', 'Sélection')}
                  </div>
                  <div className="font-semibold">
                    {selectedTransactions.length}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  disabled={filteredTransactions.length === 0}
                  className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAllFilteredSelected
                    ? t('projectManagement.subscriptionTable.transactionSearchDialog.unselectAll', 'Tout désélectionner')
                    : t('projectManagement.subscriptionTable.transactionSearchDialog.selectAll', 'Tout sélectionner')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des résultats */}
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
              {filteredTransactions.map((transaction) => {
                const categoryCode = transaction.category;
                const category = categoryCode ? categories[categoryCode] : null;
                const isSelected = selectedTransactionIds.has(transaction.id);
                
                return (
                  <button
                    key={transaction.id}
                    onClick={() => handleToggleSelectTransaction(transaction)}
                    className={`w-full text-left p-3 border rounded-lg transition-colors ${
                      isSelected
                        ? 'border-primary-400'
                        : 'border-gray-300 dark:border-gray-600'
                    } hover:bg-gray-50 dark:hover:bg-gray-700`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                          />
                          <p className="font-medium text-gray-900 dark:text-white mb-1">
                            {transaction.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                          <span>{format(transaction.date, 'dd/MM/yyyy', { locale: fr })}</span>
                          {category && (
                            <>
                              <span>•</span>
                              <span 
                                className="px-2 py-0.5 rounded text-xs"
                                style={{ 
                                  backgroundColor: category.color + '20',
                                  color: category.color 
                                }}
                              >
                                {category.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <p className={`font-semibold ${transaction.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          {formatCurrency(transaction.amount)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Boutons */}
        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-300 dark:border-gray-600">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTransactions.length > 0 && (
              <>
                {aggregationMode === 'average'
                  ? t('projectManagement.subscriptionTable.transactionSearchDialog.averagePreview', { defaultValue: 'Moyenne' })
                  : t('projectManagement.subscriptionTable.transactionSearchDialog.sumPreview', { defaultValue: 'Somme' })}
                : {formatCurrency(
                  aggregationMode === 'average'
                    ? selectedTransactions.reduce((sum, t) => sum + t.amount, 0) / selectedTransactions.length
                    : selectedTransactions.reduce((sum, t) => sum + t.amount, 0)
                )}
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {t('projectManagement.subscriptionTable.transactionSearchDialog.cancel', 'Annuler')}
            </button>
            <button
              onClick={handleValidateSelection}
              disabled={selectedTransactions.length === 0}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('projectManagement.subscriptionTable.transactionSearchDialog.validate', 'Créer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionSearchDialog;
