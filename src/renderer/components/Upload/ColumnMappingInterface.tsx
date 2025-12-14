import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { format } from 'date-fns';
import { FileStructure, DetectedColumns } from '../../types/FileAnalysis';
import { ColumnMappingConfig } from '../../types/ColumnMapping';
import { Button } from '../Common';
import { parseDateWithMultipleFormats } from '../../utils/dateFormats';
import { BalanceService } from '../../services/BalanceService';

export type ColumnRole = 
  | 'date' 
  | 'dateValue' 
  | 'libelle' 
  | 'debit' 
  | 'credit' 
  | 'debitCredit' 
  | 'balance' 
  | 'ignore';

interface ColumnMappingInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  structure: FileStructure;
  detectedColumns: DetectedColumns;
  accountCode?: string;
  initialBalance?: number;
  onConfirm: (mapping: ColumnMappingConfig, initialBalance: number) => void;
}

const ColumnMappingInterface: React.FC<ColumnMappingInterfaceProps> = ({
  isOpen,
  onClose,
  structure,
  detectedColumns,
  accountCode,
  initialBalance: propInitialBalance = 0,
  onConfirm,
}) => {
  const { t } = useTranslation();
  // État pour le mapping des colonnes
  const [columnRoles, setColumnRoles] = useState<Map<number, ColumnRole>>(new Map());
  const [balance, setBalance] = useState<number>(propInitialBalance);
  const [balanceSource, setBalanceSource] = useState<'manual' | 'auto'>('manual');

  // Initialiser le mapping avec les colonnes détectées automatiquement
  useEffect(() => {
    if (!isOpen) return;

    const initialMapping = new Map<number, ColumnRole>();

    // Pré-remplir avec les colonnes détectées
    if (detectedColumns.dateColumn) {
      initialMapping.set(detectedColumns.dateColumn.index, 'date');
    }
    if (detectedColumns.dateValueColumn && detectedColumns.dateValueColumn !== detectedColumns.dateColumn) {
      initialMapping.set(detectedColumns.dateValueColumn.index, 'dateValue');
    }
    if (detectedColumns.libelleColumn) {
      initialMapping.set(detectedColumns.libelleColumn.index, 'libelle');
    }
    if (detectedColumns.balanceColumn) {
      initialMapping.set(detectedColumns.balanceColumn.index, 'balance');
    }

    // Gérer les colonnes de montants
    if (detectedColumns.amountColumns.length === 1) {
      const singleCol = detectedColumns.amountColumns[0];
      if (singleCol.hasNegativeValues && singleCol.hasPositiveValues) {
        // Colonne unique avec valeurs négatives et positives
        initialMapping.set(singleCol.index, 'debitCredit');
      } else if (singleCol.hasNegativeValues && !singleCol.hasPositiveValues) {
        // Seulement valeurs négatives (Débit)
        initialMapping.set(singleCol.index, 'debit');
      } else {
        // Seulement valeurs positives (Crédit)
        initialMapping.set(singleCol.index, 'credit');
      }
    } else if (detectedColumns.amountColumns.length >= 2) {
      const col1 = detectedColumns.amountColumns[0];
      const col2 = detectedColumns.amountColumns[1];
      
      // Déterminer quelle colonne est Débit et laquelle est Crédit
      if (col1.hasNegativeValues && !col2.hasNegativeValues) {
        initialMapping.set(col1.index, 'debit');
        initialMapping.set(col2.index, 'credit');
      } else if (col2.hasNegativeValues && !col1.hasNegativeValues) {
        initialMapping.set(col2.index, 'debit');
        initialMapping.set(col1.index, 'credit');
      } else {
        // Par défaut : première = débit, deuxième = crédit
        initialMapping.set(col1.index, 'debit');
        initialMapping.set(col2.index, 'credit');
      }
    }

    setColumnRoles(initialMapping);
    setBalance(propInitialBalance);
  }, [isOpen, detectedColumns, propInitialBalance]);

  // Récupérer le solde automatiquement si un compte est fourni
  useEffect(() => {
    const fetchBalance = async () => {
      if (!accountCode || !isOpen) return;

      try {
        // Extraire les dates du fichier pour déterminer la date de début
        const dataRows = structure.rawData?.slice(structure.dataStartRowIndex) || [];
        if (dataRows.length === 0) {
          console.log('[Import] Aucune ligne de données pour extraire la date');
          return;
        }

        // Trouver la première date valide
        const dateColumnIndex = Array.from(columnRoles.entries()).find(([_, role]) => role === 'date')?.[0];
        if (dateColumnIndex === undefined) {
          console.log('[Import] Colonne date non trouvée dans le mapping');
          return;
        }

        console.log('[Import] Recherche de la première date valide dans la colonne', dateColumnIndex);
        let firstDate: Date | null = null;
        for (const row of dataRows.slice(0, 20)) {
          if (row && row[dateColumnIndex] !== undefined && row[dateColumnIndex] !== null && row[dateColumnIndex] !== '') {
            const parsed = parseDateWithMultipleFormats(row[dateColumnIndex]);
            if (parsed) {
              firstDate = parsed;
              console.log('[Import] Première date trouvée:', format(firstDate, 'dd/MM/yyyy'), 'depuis valeur:', row[dateColumnIndex]);
              break;
            }
          }
        }

        if (firstDate) {
          const startDateStr = format(firstDate, 'yyyy-MM-dd');
          console.log(`[Import] Recherche du solde initial dans CSV pour ${accountCode} avant ${startDateStr}`);
          
          // Utiliser la nouvelle fonction qui cherche dans les fichiers CSV
          const balanceFromCSV = await BalanceService.getInitialBalanceFromCSV(accountCode, startDateStr);
          
          if (balanceFromCSV !== null) {
            console.log(`[Import] Solde initial trouvé dans CSV: ${balanceFromCSV} €`);
            setBalance(balanceFromCSV);
            setBalanceSource('auto');
          } else {
            console.log('[Import] Aucun solde trouvé dans les CSV, utilisation du solde par défaut');
          }
        } else {
          console.log('[Import] Aucune date valide trouvée dans les données');
        }
      } catch (error: any) {
        console.warn('[Import] Erreur lors de la récupération automatique du solde:', error.message);
      }
    };

    // Attendre un peu que le mapping soit initialisé
    const timeoutId = setTimeout(() => {
      fetchBalance();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [accountCode, isOpen, structure, columnRoles]);

  if (!isOpen) return null;

  const handleColumnRoleChange = (columnIndex: number, role: ColumnRole) => {
    const newMapping = new Map(columnRoles);

    // Si on assigne un rôle qui ne peut être utilisé qu'une fois, retirer les autres colonnes avec ce rôle
    if (role === 'date' || role === 'libelle') {
      for (const [idx, r] of newMapping.entries()) {
        if (r === role && idx !== columnIndex) {
          newMapping.delete(idx);
        }
      }
    }

    // Si on assigne debitCredit, retirer debit et credit de cette colonne
    if (role === 'debitCredit') {
      // Ne rien faire, on peut avoir debitCredit sur une colonne
    } else if (role === 'debit' || role === 'credit') {
      // Si on assigne debit ou credit, vérifier qu'on n'a pas déjà debitCredit sur cette colonne
      if (newMapping.get(columnIndex) === 'debitCredit') {
        newMapping.delete(columnIndex);
      }
    }

    if (role === 'ignore') {
      newMapping.delete(columnIndex);
    } else {
      newMapping.set(columnIndex, role);
    }

    setColumnRoles(newMapping);
  };

  const validateMapping = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const roles = Array.from(columnRoles.values());

    if (!roles.includes('date')) {
      errors.push(t('columnMapping.errorDateRequired'));
    }

    if (!roles.includes('libelle')) {
      errors.push(t('columnMapping.errorLibelleRequired'));
    }

    const hasDebit = roles.includes('debit');
    const hasCredit = roles.includes('credit');
    const hasDebitCredit = roles.includes('debitCredit');

    if (!hasDebitCredit && !(hasDebit || hasCredit)) {
      errors.push(t('columnMapping.errorAmountRequired'));
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  };

  const handleConfirm = () => {
    console.log('[Import] handleConfirm appelé');
    const validation = validateMapping();
    console.log('[Import] Validation mapping:', validation);
    
    if (!validation.valid) {
      console.warn('[Import] Validation échouée, erreurs:', validation.errors);
      return;
    }

    // Construire le ColumnMappingConfig
    const dateIndex = Array.from(columnRoles.entries()).find(([_, r]) => r === 'date')?.[0];
    const dateValueIndex = Array.from(columnRoles.entries()).find(([_, r]) => r === 'dateValue')?.[0];
    const libelleIndex = Array.from(columnRoles.entries()).find(([_, r]) => r === 'libelle')?.[0];
    const debitIndex = Array.from(columnRoles.entries()).find(([_, r]) => r === 'debit' || r === 'debitCredit')?.[0];
    const creditIndex = Array.from(columnRoles.entries()).find(([_, r]) => r === 'credit' || r === 'debitCredit')?.[0];

    console.log('[Import] Index colonnes trouvés:', {
      date: dateIndex,
      dateValue: dateValueIndex,
      libelle: libelleIndex,
      debit: debitIndex,
      credit: creditIndex,
      balance: balance
    });

    if (dateIndex === undefined || libelleIndex === undefined || (debitIndex === undefined && creditIndex === undefined)) {
      console.error('[Import] Colonnes essentielles manquantes:', {
        date: dateIndex !== undefined,
        libelle: libelleIndex !== undefined,
        debit: debitIndex !== undefined,
        credit: creditIndex !== undefined
      });
      return;
    }

    const mapping: ColumnMappingConfig = {
      dateColumnIndex: dateIndex,
      dateValueColumnIndex: dateValueIndex,
      libelleColumnIndex: libelleIndex,
      debitColumnIndex: debitIndex ?? creditIndex ?? 0,
      creditColumnIndex: creditIndex ?? debitIndex ?? 0,
      balanceColumnIndex: Array.from(columnRoles.entries()).find(([_, r]) => r === 'balance')?.[0],
    };

    console.log('[Import] Mapping créé:', mapping);
    console.log('[Import] Solde initial:', balance);
    console.log('[Import] Appel onConfirm...');
    
    try {
      onConfirm(mapping, balance);
      console.log('[Import] onConfirm appelé avec succès');
    } catch (error: any) {
      console.error('[Import] Erreur lors de l\'appel onConfirm:', error);
    }
  };

  const validation = validateMapping();
  const hasDebit = Array.from(columnRoles.values()).includes('debit');
  const hasCredit = Array.from(columnRoles.values()).includes('credit');
  const hasDebitCredit = Array.from(columnRoles.values()).includes('debitCredit');
  const warningNoCredit = hasDebit && !hasCredit && !hasDebitCredit;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 my-8">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('columnMapping.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-200">
                <p className="font-semibold mb-1">{t('columnMapping.instructions')}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li dangerouslySetInnerHTML={{ __html: t('columnMapping.instruction1') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('columnMapping.instruction2') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('columnMapping.instruction3') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('columnMapping.instruction4') }} />
                </ul>
              </div>
            </div>
          </div>

          {/* Avertissement si pas de colonne Crédit */}
          {warningNoCredit && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-900 dark:text-yellow-200">
                  <p className="font-semibold mb-1">{t('columnMapping.warning')}</p>
                  <p>{t('columnMapping.warningNoCredit')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Erreurs de validation */}
          {!validation.valid && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-900 dark:text-red-200">
                  <p className="font-semibold mb-1">{t('columnMapping.validationErrors')}</p>
                  <ul className="list-disc list-inside space-y-1">
                    {validation.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Aperçu des données */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('columnMapping.dataPreview')}
            </h3>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {structure.columns.map((col) => (
                      <th
                        key={col.index}
                        className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600"
                      >
                        <div className="font-semibold">{col.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {col.type}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {structure.sampleRows.slice(0, 5).map((row, rowIdx) => (
                    <tr key={rowIdx} className="bg-white dark:bg-gray-800">
                      {structure.columns.map((col) => (
                        <td
                          key={col.index}
                          className="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 max-w-xs truncate"
                        >
                          {row[col.index] !== undefined && row[col.index] !== null && row[col.index] !== ''
                            ? String(row[col.index])
                            : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mapping des colonnes */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('columnMapping.columnAssignment')}
            </h3>
            <div className="space-y-3">
              {structure.columns.map((column) => {
                const currentRole = columnRoles.get(column.index) || 'ignore';
                return (
                  <div
                    key={column.index}
                    className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {column.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('columnMapping.type')} {column.type}
                        {column.hasNegativeValues && t('columnMapping.hasNegative')}
                        {column.hasPositiveValues && t('columnMapping.hasPositive')}
                        {column.isMonotonic && t('columnMapping.isMonotonic')}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {t('columnMapping.examples')} {column.sampleValues.slice(0, 3).join(', ')}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <select
                        value={currentRole}
                        onChange={(e) => handleColumnRoleChange(column.index, e.target.value as ColumnRole)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-w-[180px]"
                      >
                        <option value="ignore">{t('columnMapping.ignore')}</option>
                        <option value="date">{t('columnMapping.date')}</option>
                        <option value="dateValue">{t('columnMapping.dateValue')}</option>
                        <option value="libelle">{t('columnMapping.libelle')}</option>
                        <option value="debit">{t('columnMapping.debit')}</option>
                        <option value="credit">{t('columnMapping.credit')}</option>
                        <option value="debitCredit">{t('columnMapping.debitCredit')}</option>
                        <option value="balance">{t('columnMapping.balance')}</option>
                      </select>
                    </div>
                    {currentRole !== 'ignore' && (
                      <div className="flex-shrink-0">
                        <CheckCircle
                          size={20}
                          className={
                            currentRole === 'date' || currentRole === 'libelle'
                              ? 'text-blue-500'
                              : currentRole === 'debit'
                              ? 'text-red-500'
                              : currentRole === 'credit'
                              ? 'text-green-500'
                              : currentRole === 'debitCredit'
                              ? 'text-purple-500'
                              : 'text-gray-500'
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Solde initial */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('columnMapping.initialBalance')}
            </h3>
            <div className="space-y-2">
              {balanceSource === 'auto' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    {t('columnMapping.autoDetected')}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-900 dark:text-white min-w-[120px]">
                  {t('columnMapping.initialBalanceLabel')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balance}
                  onChange={(e) => {
                    setBalance(parseFloat(e.target.value) || 0);
                    setBalanceSource('manual');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-1 max-w-xs"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={!validation.valid}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingInterface;

