import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigService } from '../../services/ConfigService';
import { BalanceService } from '../../services/BalanceService';
import { AccountProjectionConfig } from '../../types/ProjectManagement';
import { AccountsConfig } from '../../types/Account';
import { formatCurrency } from '../../utils/format';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons';

interface AccountProjectionManagerProps {
  accountConfigs: AccountProjectionConfig[];
  onConfigsChange: (configs: AccountProjectionConfig[]) => void;
  isEditing?: boolean; // Contrôle externe de l'édition
}

interface AccountOption {
  code: string;
  name: string;
  color: string;
}

const AccountProjectionManager: React.FC<AccountProjectionManagerProps> = ({
  accountConfigs,
  onConfigsChange,
  isEditing = false,
}) => {
  const { t } = useTranslation();
  const [tempConfigs, setTempConfigs] = useState<AccountProjectionConfig[]>(accountConfigs);
  const [availableAccounts, setAvailableAccounts] = useState<AccountOption[]>([]);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [accountBalances, setAccountBalances] = useState<Record<string, number | null>>({});

  // Charger les comptes disponibles
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accountsConfig: AccountsConfig = await ConfigService.loadAccounts();
        const accountsList: AccountOption[] = Object.entries(accountsConfig).map(([code, account]) => ({
          code,
          name: account.name,
          color: account.color,
        }));
        accountsList.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
        setAvailableAccounts(accountsList);

        // Charger les soldes pour tous les comptes
        const balances: Record<string, number | null> = {};
        for (const account of accountsList) {
          balances[account.code] = await BalanceService.getLastKnownBalance(account.code);
        }
        setAccountBalances(balances);
      } catch (error) {
        console.error('Erreur lors du chargement des comptes:', error);
      }
    };

    loadAccounts();
  }, []);

  // Synchroniser tempConfigs avec accountConfigs quand ils changent ou quand on entre/sort du mode édition
  useEffect(() => {
    if (isEditing) {
      setTempConfigs(accountConfigs);
    }
  }, [accountConfigs, isEditing]);

  const handleAddAccount = useCallback((accountCode: string) => {
    const account = availableAccounts.find(a => a.code === accountCode);
    if (!account) return;

    // Vérifier si le compte n'est pas déjà ajouté
    if (tempConfigs.some(c => c.accountCode === accountCode)) {
      return;
    }

    const newPriority = tempConfigs.length > 0 
      ? Math.max(...tempConfigs.map(c => c.priority)) + 1 
      : 1;

    const autoBalance = accountBalances[accountCode] || 0;

    const newConfig: AccountProjectionConfig = {
      accountCode: account.code,
      ceiling: Infinity, // Par défaut illimité
      priority: newPriority,
      initialBalance: autoBalance,
      useAutoBalance: true,
    };

    const newConfigs = [...tempConfigs, newConfig];
    setTempConfigs(newConfigs);
    onConfigsChange(newConfigs);
    setIsAccountDialogOpen(false);
  }, [tempConfigs, availableAccounts, accountBalances, onConfigsChange]);

  const handleRemoveAccount = useCallback((index: number) => {
    const newConfigs = tempConfigs.filter((_, i) => i !== index);
    // Réajuster les priorités
    const reorderedConfigs = newConfigs.map((config, i) => ({
      ...config,
      priority: i + 1,
    }));
    setTempConfigs(reorderedConfigs);
    onConfigsChange(reorderedConfigs);
  }, [tempConfigs, onConfigsChange]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newConfigs = [...tempConfigs];
    [newConfigs[index - 1], newConfigs[index]] = [newConfigs[index], newConfigs[index - 1]];
    // Réajuster les priorités
    const reorderedConfigs = newConfigs.map((config, i) => ({
      ...config,
      priority: i + 1,
    }));
    setTempConfigs(reorderedConfigs);
    onConfigsChange(reorderedConfigs);
  }, [tempConfigs, onConfigsChange]);

  const handleMoveDown = useCallback((index: number) => {
    if (index === tempConfigs.length - 1) return;
    const newConfigs = [...tempConfigs];
    [newConfigs[index], newConfigs[index + 1]] = [newConfigs[index + 1], newConfigs[index]];
    // Réajuster les priorités
    const reorderedConfigs = newConfigs.map((config, i) => ({
      ...config,
      priority: i + 1,
    }));
    setTempConfigs(reorderedConfigs);
    onConfigsChange(reorderedConfigs);
  }, [tempConfigs, onConfigsChange]);

  const handleConfigChange = useCallback((index: number, field: keyof AccountProjectionConfig, value: any) => {
    const newConfigs = [...tempConfigs];
    newConfigs[index] = { ...newConfigs[index], [field]: value };
    
    // Si on change useAutoBalance à true, mettre à jour le solde initial
    if (field === 'useAutoBalance' && value === true) {
      const accountCode = newConfigs[index].accountCode;
      newConfigs[index].initialBalance = accountBalances[accountCode] || 0;
    }
    
    setTempConfigs(newConfigs);
    // Sauvegarder immédiatement les changements
    onConfigsChange(newConfigs);
  }, [tempConfigs, accountBalances, onConfigsChange]);

  // Les fonctions handleSave et handleCancel sont gérées par le parent
  // On met juste à jour tempConfigs et on appelle onConfigsChange immédiatement

  const getAccountName = (accountCode: string) => {
    return availableAccounts.find(a => a.code === accountCode)?.name || accountCode;
  };

  const getAccountColor = (accountCode: string) => {
    return availableAccounts.find(a => a.code === accountCode)?.color || '#808080';
  };

  const getAvailableAccountsForSelection = () => {
    return availableAccounts.filter(account => 
      !tempConfigs.some(config => config.accountCode === account.code)
    );
  };

  // Ne rien afficher si on n'est pas en mode édition
  if (!isEditing) {
    return null;
  }

  return (
    <div className="account-projection-manager mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="mb-3">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          {t('projectManagement.accountProjection.title', 'Configuration des comptes de projection')}
        </h4>
      </div>
      <div className="space-y-3">
        {tempConfigs.length === 0 ? (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                {t('projectManagement.accountProjection.noAccounts', 'Aucun compte configuré')}
              </div>
            ) : (
              <div className="space-y-2">
                {/* En-têtes du tableau */}
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="col-span-1">{t('projectManagement.accountProjection.priority', 'Priorité')}</div>
                  <div className="col-span-3">{t('projectManagement.accountProjection.account', 'Compte')}</div>
                  <div className="col-span-2">{t('projectManagement.accountProjection.ceiling', 'Plafond')}</div>
                  <div className="col-span-3">{t('projectManagement.accountProjection.initialBalance', 'Solde initial')}</div>
                  <div className="col-span-3"></div>
                </div>

                {/* Lignes de configuration */}
                {tempConfigs.map((config, index) => {
                  const accountName = getAccountName(config.accountCode);
                  const accountColor = getAccountColor(config.accountCode);
                  const autoBalance = accountBalances[config.accountCode] || 0;

                  return (
                    <div
                      key={`${config.accountCode}-${index}`}
                      className="grid grid-cols-12 gap-2 items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded"
                    >
                      {/* Priorité avec flèches */}
                      <div className="col-span-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-medium">{config.priority}</span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('projectManagement.accountProjection.moveUp', 'Monter')}
                          >
                            <FontAwesomeIcon icon={faChevronUp} />
                          </button>
                          <button
                            onClick={() => handleMoveDown(index)}
                            disabled={index === tempConfigs.length - 1}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('projectManagement.accountProjection.moveDown', 'Descendre')}
                          >
                            <FontAwesomeIcon icon={faChevronDown} />
                          </button>
                        </div>
                      </div>

                      {/* Compte */}
                      <div className="col-span-3 flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: accountColor }}
                        />
                        <span className="text-sm text-gray-900 dark:text-gray-100 truncate" title={accountName}>
                          {accountName}
                        </span>
                      </div>

                      {/* Plafond */}
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          value={config.ceiling === Infinity ? '' : config.ceiling}
                          onChange={(e) => {
                            const value = e.target.value === '' ? Infinity : parseFloat(e.target.value) || 0;
                            handleConfigChange(index, 'ceiling', value);
                          }}
                          placeholder={t('projectManagement.accountProjection.unlimited', 'Illimité')}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                        />
                      </div>

                      {/* Solde initial */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={config.useAutoBalance}
                              onChange={(e) => handleConfigChange(index, 'useAutoBalance', e.target.checked)}
                              className="w-3 h-3"
                            />
                            <span className="text-gray-600 dark:text-gray-400">
                              {t('projectManagement.accountProjection.autoBalance', 'Auto')}
                            </span>
                          </label>
                          {!config.useAutoBalance && (
                            <input
                              type="number"
                              step="0.01"
                              value={config.initialBalance}
                              onChange={(e) => handleConfigChange(index, 'initialBalance', parseFloat(e.target.value) || 0)}
                              className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                            />
                          )}
                          {config.useAutoBalance && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatCurrency(autoBalance)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-3 flex justify-end">
                        <button
                          onClick={() => handleRemoveAccount(index)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title={t('common.delete', 'Supprimer')}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bouton ajouter compte */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              {isAccountDialogOpen ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                    {t('projectManagement.accountProjection.selectAccount', 'Sélectionner un compte')}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {getAvailableAccountsForSelection().length === 0 ? (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                        {t('projectManagement.accountProjection.allAccountsAdded', 'Tous les comptes sont déjà ajoutés')}
                      </div>
                    ) : (
                      getAvailableAccountsForSelection().map(account => (
                        <button
                          key={account.code}
                          onClick={() => handleAddAccount(account.code)}
                          className="w-full flex items-center gap-2 p-2 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: account.color }}
                          />
                          <span className="text-sm text-gray-900 dark:text-gray-100">{account.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">({account.code})</span>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setIsAccountDialogOpen(false)}
                    className="text-xs text-gray-600 hover:text-gray-700 dark:text-gray-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t('common.cancel', 'Annuler')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAccountDialogOpen(true)}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 px-3 py-2 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>{t('projectManagement.accountProjection.addAccount', 'Ajouter un compte')}</span>
                </button>
              )}
            </div>
      </div>
    </div>
  );
};

export default AccountProjectionManager;
