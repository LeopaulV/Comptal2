import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Check, ChevronRight } from 'lucide-react';
import { ExcelSheetInfo } from '../../types/ExcelImport';
import { AccountsConfig } from '../../types/Account';
import { Button } from '../Common';

interface ExcelSheetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  sheets: ExcelSheetInfo[];
  accounts: AccountsConfig;
  onConfirm: (selectedSheets: Map<string, string>) => void; // Map: sheetName -> accountCode
}

const ExcelSheetSelector: React.FC<ExcelSheetSelectorProps> = ({
  isOpen,
  onClose,
  sheets,
  accounts,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [sheetAccounts, setSheetAccounts] = useState<Map<string, string>>(new Map());

  // Sélectionner toutes les feuilles par défaut
  useEffect(() => {
    if (sheets.length > 0 && selectedSheets.size === 0) {
      const allSheets = new Set(sheets.map(s => s.name));
      setSelectedSheets(allSheets);
    }
  }, [sheets]);

  if (!isOpen) return null;

  const toggleSheet = (sheetName: string) => {
    const newSelected = new Set(selectedSheets);
    if (newSelected.has(sheetName)) {
      newSelected.delete(sheetName);
      // Supprimer aussi l'association de compte
      const newAccounts = new Map(sheetAccounts);
      newAccounts.delete(sheetName);
      setSheetAccounts(newAccounts);
    } else {
      newSelected.add(sheetName);
    }
    setSelectedSheets(newSelected);
  };

  const handleAccountChange = (sheetName: string, accountCode: string) => {
    const newAccounts = new Map(sheetAccounts);
    newAccounts.set(sheetName, accountCode);
    setSheetAccounts(newAccounts);
  };

  const handleConfirm = () => {
    // Vérifier que toutes les feuilles sélectionnées ont un compte associé
    const missingAccounts: string[] = [];
    selectedSheets.forEach(sheetName => {
      if (!sheetAccounts.has(sheetName)) {
        missingAccounts.push(sheetName);
      }
    });

    if (missingAccounts.length > 0) {
      alert(t('excelSheet.missingAccounts', { sheets: missingAccounts.join(', ') }));
      return;
    }

    onConfirm(sheetAccounts);
  };

  const allSheetsHaveAccounts = Array.from(selectedSheets).every(
    sheetName => sheetAccounts.has(sheetName)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('excelSheet.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              {t('excelSheet.description')}
              {sheets.length > 0 && t('excelSheet.sheetsDetected', { count: sheets.length })}
            </p>
          </div>

          {/* Liste des feuilles */}
          <div className="space-y-3">
            {sheets.map((sheet) => {
              const isSelected = selectedSheets.has(sheet.name);
              const accountCode = sheetAccounts.get(sheet.name) || '';

              return (
                <div
                  key={sheet.name}
                  className={`
                    border-2 rounded-lg p-4 transition-all
                    ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                    }
                  `}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox de sélection */}
                    <button
                      onClick={() => toggleSheet(sheet.name)}
                      className={`
                        mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                        ${
                          isSelected
                            ? 'bg-primary-600 border-primary-600'
                            : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800'
                        }
                      `}
                    >
                      {isSelected && (
                        <Check size={14} className="text-white" strokeWidth={3} />
                      )}
                    </button>

                    {/* Informations de la feuille */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {sheet.name}
                        </h3>
                        {isSelected && (
                          <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                            {t('excelSheet.selected')}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {sheet.rowCount !== undefined && (
                          <div>
                            <span className="font-medium">{t('excelSheet.rows')}</span> {sheet.rowCount}
                          </div>
                        )}
                        {sheet.startDate && sheet.endDate && (
                          <div>
                            <span className="font-medium">{t('excelSheet.period')}</span>{' '}
                            {sheet.startDate} - {sheet.endDate}
                          </div>
                        )}
                      </div>

                      {/* Sélection du compte */}
                      {isSelected && (
                        <div>
                          <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                            {t('excelSheet.associatedAccount')}
                          </label>
                          <select
                            value={accountCode}
                            onChange={(e) => handleAccountChange(sheet.name, e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">{t('excelSheet.selectAccount')}</option>
                            {Object.entries(accounts).map(([code, account]) => (
                              <option key={code} value={code}>
                                {code} - {account.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Résumé */}
          {selectedSheets.size > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {t('excelSheet.summary', { count: selectedSheets.size })}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {allSheetsHaveAccounts
                      ? t('excelSheet.allHaveAccounts')
                      : t('excelSheet.sheetsWithoutAccount', { count: selectedSheets.size - Array.from(selectedSheets).filter(s => sheetAccounts.has(s)).length })}
                  </p>
                </div>
                <ChevronRight size={24} className="text-gray-400" />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={selectedSheets.size === 0 || !allSheetsHaveAccounts}
            >
              {t('excelSheet.continue', { count: selectedSheets.size })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelSheetSelector;

