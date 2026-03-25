import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Card, Button } from '../Common';
import { AccountsConfig } from '../../types/Account';
import { TransformedRow } from '../../types/ColumnMapping';
import { BalanceService } from '../../services/BalanceService';
import { parse, format, isValid } from 'date-fns';

interface ManualRow {
  id: string;
  dateValue: string; // Format DD/MM/YYYY
  libelle: string;
  debit: number;
  credit: number;
  solde: number; // Calculé automatiquement
}

interface ManualDataCreatorProps {
  accounts: AccountsConfig;
  onConfirm: (rows: TransformedRow[], accountCode: string, initialBalance: number) => void;
  onCancel: () => void;
  onOpenCreateAccount?: () => void;
  newlyCreatedAccountCode?: string | null;
  onClearNewlyCreated?: () => void;
}

const ManualDataCreator: React.FC<ManualDataCreatorProps> = ({
  accounts,
  onConfirm,
  onCancel,
  onOpenCreateAccount,
  newlyCreatedAccountCode,
  onClearNewlyCreated,
}) => {
  const { t } = useTranslation();
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('');
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [rows, setRows] = useState<ManualRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Générer un ID unique pour chaque ligne
  const generateRowId = () => `row-${Date.now()}-${Math.random()}`;

  // Appliquer le compte nouvellement créé depuis la modal parente
  useEffect(() => {
    if (newlyCreatedAccountCode) {
      setSelectedAccountCode(newlyCreatedAccountCode);
      onClearNewlyCreated?.();
    }
  }, [newlyCreatedAccountCode, onClearNewlyCreated]);

  // Récupérer le solde initial quand le compte est sélectionné
  useEffect(() => {
    const fetchInitialBalance = async () => {
      if (!selectedAccountCode) {
        setInitialBalance(0);
        return;
      }

      setIsLoadingBalance(true);
      try {
        // Récupérer le dernier solde connu du compte, quelle que soit la date
        const balance = await BalanceService.getLastKnownBalance(selectedAccountCode);
        
        if (balance !== null) {
          setInitialBalance(balance);
        } else {
          // Si aucun solde n'est trouvé, utiliser 0
          setInitialBalance(0);
        }
      } catch (error: any) {
        console.error('Erreur lors de la récupération du solde initial:', error);
        setInitialBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchInitialBalance();
  }, [selectedAccountCode]);

  // Calculer les soldes et trier par date
  const sortedRowsWithBalance = useMemo(() => {
    // Créer une copie des lignes pour le tri
    const rowsCopy = [...rows].map(row => ({ ...row }));
    
    // Trier par date
    rowsCopy.sort((a, b) => {
      const dateA = parse(a.dateValue, 'dd/MM/yyyy', new Date());
      const dateB = parse(b.dateValue, 'dd/MM/yyyy', new Date());
      if (!isValid(dateA) || !isValid(dateB)) return 0;
      return dateA.getTime() - dateB.getTime();
    });

    // Calculer les soldes de manière incrémentale
    let currentBalance = initialBalance;
    rowsCopy.forEach((row) => {
      // Normaliser débit (négatif ou 0) et crédit (positif ou 0)
      const debit = row.debit < 0 ? row.debit : -Math.abs(row.debit || 0);
      const credit = row.credit > 0 ? row.credit : Math.abs(row.credit || 0);
      
      // Calculer le solde : solde = solde_précédent + crédit + débit
      currentBalance = currentBalance + credit + debit;
      row.solde = Math.round(currentBalance * 100) / 100;
    });

    return rowsCopy;
  }, [rows, initialBalance]);

  // Ajouter une nouvelle ligne
  const handleAddRow = () => {
    const today = format(new Date(), 'dd/MM/yyyy');
    const newRow: ManualRow = {
      id: generateRowId(),
      dateValue: today,
      libelle: '',
      debit: 0,
      credit: 0,
      solde: 0,
    };
    setRows([...rows, newRow]);
  };

  // Supprimer une ligne
  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
    // Supprimer aussi l'erreur associée
    const newErrors = { ...errors };
    delete newErrors[id];
    setErrors(newErrors);
  };

  // Mettre à jour une ligne
  const handleUpdateRow = (id: string, field: keyof ManualRow, value: string | number) => {
    // Créer une nouvelle copie du tableau pour forcer la mise à jour
    const updatedRows = rows.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    });
    setRows(updatedRows);

    // Supprimer l'erreur pour ce champ
    const errorKey = `${id}-${field}`;
    const newErrors = { ...errors };
    delete newErrors[errorKey];
    setErrors(newErrors);
  };

  // Valider une ligne
  const validateRow = (row: ManualRow): string[] => {
    const rowErrors: string[] = [];

    // Valider la date
    const date = parse(row.dateValue, 'dd/MM/yyyy', new Date());
    if (!isValid(date)) {
      rowErrors.push('dateValue');
    }

    // Valider le libellé
    if (!row.libelle || row.libelle.trim() === '') {
      rowErrors.push('libelle');
    }

    // Valider qu'au moins un montant est renseigné
    if (row.debit === 0 && row.credit === 0) {
      rowErrors.push('amount');
    }

    return rowErrors;
  };

  // Valider toutes les lignes
  const validateAllRows = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    sortedRowsWithBalance.forEach((row) => {
      const rowErrors = validateRow(row);
      if (rowErrors.length > 0) {
        isValid = false;
        rowErrors.forEach(error => {
          newErrors[`${row.id}-${error}`] = t(`upload.manualCreate.error.${error}`);
        });
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  // Convertir en TransformedRow[]
  const convertToTransformedRows = (): TransformedRow[] => {
    const account = accounts[selectedAccountCode];
    if (!account) return [];

    return sortedRowsWithBalance.map((row, index) => {
      const date = parse(row.dateValue, 'dd/MM/yyyy', new Date());
      
      // Normaliser débit et crédit
      const debit = row.debit < 0 ? row.debit : -Math.abs(row.debit || 0);
      const credit = row.credit > 0 ? row.credit : Math.abs(row.credit || 0);

      // Générer l'index
      const dateStr = format(date, 'yyyyMMdd');
      const soldeAbsolu = Math.abs(Math.round(row.solde));
      const indexStr = `${dateStr},${soldeAbsolu}`;

      return {
        Source: 'Création manuelle',
        Compte: account.name,
        Date: format(date, 'dd/MM/yyyy'),
        'Date de valeur': row.dateValue,
        Débit: Math.round(debit * 100) / 100,
        Crédit: Math.round(credit * 100) / 100,
        Libellé: row.libelle.trim(),
        Solde: row.solde,
        catégorie: '',
        'Solde initial': index === 0 ? initialBalance : '',
        Index: indexStr,
      };
    });
  };

  // Gérer la confirmation
  const handleConfirm = () => {
    if (!selectedAccountCode) {
      setErrors({ account: t('upload.manualCreate.error.account') });
      return;
    }

    if (rows.length === 0) {
      setErrors({ rows: t('upload.manualCreate.error.noRows') });
      return;
    }

    if (!validateAllRows()) {
      return;
    }

    const transformedRows = convertToTransformedRows();
    onConfirm(transformedRows, selectedAccountCode, initialBalance);
  };

  return (
    <Card>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('upload.manualCreate.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('upload.manualCreate.description')}
          </p>
        </div>

        {/* Sélection du compte */}
        <div>
          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
            {t('upload.manualCreate.selectAccount')} *
          </label>
          <div className="flex gap-2">
            <select
              value={selectedAccountCode}
              onChange={(e) => setSelectedAccountCode(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">{t('upload.selectAccountPlaceholder')}</option>
              {Object.entries(accounts).map(([code, account]) => (
                <option key={code} value={code}>
                  {code} - {account.name}
                </option>
              ))}
            </select>
            {onOpenCreateAccount && (
              <Button
                variant="secondary"
                onClick={onOpenCreateAccount}
              >
                {t('upload.createAccount', 'Créer un nouveau compte')}
              </Button>
            )}
          </div>
          {errors.account && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.account}</p>
          )}
        </div>

        {/* Solde initial */}
        {selectedAccountCode && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('upload.manualCreate.initialBalance')}
            </label>
            <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white">
              {isLoadingBalance ? (
                <span className="text-gray-500 dark:text-gray-400">{t('common.loading')}</span>
              ) : (
                <span className="font-medium">{initialBalance.toFixed(2)} €</span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('upload.manualCreate.initialBalanceDescription')}
            </p>
          </div>
        )}

        {/* Tableau des lignes */}
        {selectedAccountCode && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {t('upload.manualCreate.rows')} ({sortedRowsWithBalance.length})
              </h4>
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={handleAddRow}
              >
                {t('upload.manualCreate.addRow')}
              </Button>
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>{t('upload.manualCreate.noRows')}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={handleAddRow}
                >
                  {t('upload.manualCreate.addFirstRow')}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-900 dark:text-white">
                        {t('upload.manualCreate.dateValue')}
                      </th>
                      <th className="px-3 py-2 text-left text-gray-900 dark:text-white">
                        {t('upload.manualCreate.libelle')}
                      </th>
                      <th className="px-3 py-2 text-right text-gray-900 dark:text-white">
                        {t('upload.manualCreate.debit')}
                      </th>
                      <th className="px-3 py-2 text-right text-gray-900 dark:text-white">
                        {t('upload.manualCreate.credit')}
                      </th>
                      <th className="px-3 py-2 text-right text-gray-900 dark:text-white">
                        {t('upload.manualCreate.balance')}
                      </th>
                      <th className="px-3 py-2 text-center text-gray-900 dark:text-white w-16">
                        {t('common.delete')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRowsWithBalance.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.dateValue}
                            onChange={(e) => handleUpdateRow(row.id, 'dateValue', e.target.value)}
                            placeholder="DD/MM/YYYY"
                            className={`w-full px-2 py-1 border rounded ${
                              errors[`${row.id}-dateValue`]
                                ? 'border-red-500 dark:border-red-500'
                                : 'border-gray-300 dark:border-gray-600'
                            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                          />
                          {errors[`${row.id}-dateValue`] && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                              {errors[`${row.id}-dateValue`]}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.libelle}
                            onChange={(e) => handleUpdateRow(row.id, 'libelle', e.target.value)}
                            className={`w-full px-2 py-1 border rounded ${
                              errors[`${row.id}-libelle`]
                                ? 'border-red-500 dark:border-red-500'
                                : 'border-gray-300 dark:border-gray-600'
                            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                          />
                          {errors[`${row.id}-libelle`] && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                              {errors[`${row.id}-libelle`]}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.debit === 0 ? '' : Math.abs(row.debit)}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              // Stocker comme négatif
                              handleUpdateRow(row.id, 'debit', value > 0 ? -value : 0);
                            }}
                            placeholder="0.00"
                            className={`w-full px-2 py-1 border rounded text-right ${
                              errors[`${row.id}-amount`]
                                ? 'border-red-500 dark:border-red-500'
                                : 'border-gray-300 dark:border-gray-600'
                            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            value={row.credit === 0 ? '' : row.credit}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              handleUpdateRow(row.id, 'credit', value);
                            }}
                            placeholder="0.00"
                            className={`w-full px-2 py-1 border rounded text-right ${
                              errors[`${row.id}-amount`]
                                ? 'border-red-500 dark:border-red-500'
                                : 'border-gray-300 dark:border-gray-600'
                            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                          {row.solde !== undefined && row.solde !== null ? row.solde.toFixed(2) : '0.00'} €
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                            title={t('upload.manualCreate.removeRow')}
                          >
                            <Trash2 size={16} className="text-red-600 dark:text-red-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {errors.rows && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.rows}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!selectedAccountCode || rows.length === 0}
          >
            {t('upload.manualCreate.continue')}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ManualDataCreator;
