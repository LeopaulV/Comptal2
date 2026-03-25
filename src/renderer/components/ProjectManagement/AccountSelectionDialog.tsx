import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigService } from '../../services/ConfigService';
import { BalanceService } from '../../services/BalanceService';
import { AccountsConfig } from '../../types/Account';
import { formatCurrency } from '../../utils/format';

interface AccountSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (totalBalance: number) => void;
}

interface AccountWithBalance {
  code: string;
  name: string;
  color: string;
  balance: number | null;
}

const AccountSelectionDialog: React.FC<AccountSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Charger les comptes et leurs soldes au montage
  useEffect(() => {
    const loadAccounts = async () => {
      if (!isOpen) return;

      setIsLoading(true);
      try {
        const accountsConfig: AccountsConfig = await ConfigService.loadAccounts();
        const accountsList: AccountWithBalance[] = [];

        // Pour chaque compte, récupérer le dernier solde connu
        for (const [code, account] of Object.entries(accountsConfig)) {
          const balance = await BalanceService.getLastKnownBalance(code);
          accountsList.push({
            code,
            name: account.name,
            color: account.color,
            balance,
          });
        }

        // Trier par nom
        accountsList.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
        setAccounts(accountsList);
        setSelectedAccounts(new Set());
      } catch (error) {
        console.error('Erreur lors du chargement des comptes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccounts();
  }, [isOpen]);

  // Calculer le total des soldes sélectionnés
  const totalBalance = accounts
    .filter(account => selectedAccounts.has(account.code))
    .reduce((sum, account) => sum + (account.balance || 0), 0);

  const handleToggleAccount = useCallback((accountCode: string) => {
    setSelectedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountCode)) {
        newSet.delete(accountCode);
      } else {
        newSet.add(accountCode);
      }
      return newSet;
    });
  }, []);

  const handleValidate = useCallback(() => {
    if (selectedAccounts.size === 0) {
      return;
    }
    onSelect(totalBalance);
    setSelectedAccounts(new Set());
    onClose();
  }, [selectedAccounts, totalBalance, onSelect, onClose]);

  const handleClose = useCallback(() => {
    setSelectedAccounts(new Set());
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('projectManagement.accountSelectionDialog.title', 'Sélectionner des comptes pour le solde de départ')}
        </h2>

        <div className="flex-1 overflow-y-auto mb-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>{t('common.loading', 'Chargement...')}</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>{t('projectManagement.accountSelectionDialog.noAccounts', 'Aucun compte disponible')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(account => {
                const isSelected = selectedAccounts.has(account.code);
                const hasBalance = account.balance !== null;

                return (
                  <label
                    key={account.code}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleAccount(account.code)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: account.color }}
                        />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {account.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          ({account.code})
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {hasBalance ? (
                          <span>{formatCurrency(account.balance!)}</span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 italic">
                            {t('projectManagement.accountSelectionDialog.noBalance', 'Solde non disponible')}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Affichage du total */}
        {selectedAccounts.size > 0 && (
          <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('projectManagement.accountSelectionDialog.total', 'Total sélectionné')} ({selectedAccounts.size} {t('projectManagement.accountSelectionDialog.account', 'compte')}{selectedAccounts.size > 1 ? 's' : ''}):
              </span>
              <span className="text-lg font-semibold text-primary-600 dark:text-primary-400">
                {formatCurrency(totalBalance)}
              </span>
            </div>
          </div>
        )}

        {/* Boutons */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel', 'Annuler')}
          </button>
          <button
            onClick={handleValidate}
            disabled={selectedAccounts.size === 0}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('projectManagement.accountSelectionDialog.apply', 'Appliquer')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountSelectionDialog;
