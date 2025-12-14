import React from 'react';
import { useTranslation } from 'react-i18next';
import { TransformedRow } from '../../types/ColumnMapping';
import { Card } from '../Common';

interface ImportPreviewTableProps {
  rows: TransformedRow[];
  onConfirm: () => void;
  onCancel: () => void;
}

const ImportPreviewTable: React.FC<ImportPreviewTableProps> = ({
  rows,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('preview.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('preview.readyToImport', { count: rows.length })}
          </p>
        </div>

        <div className="overflow-x-auto max-h-96 border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600">
                  {t('table.date')}
                </th>
                <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600">
                  {t('table.description')}
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600">
                  {t('table.debit')}
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600">
                  {t('table.credit')}
                </th>
                <th className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-white">
                  {t('table.balance')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                    {row.Date}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600 max-w-xs truncate">
                    {row.Libellé}
                  </td>
                  <td className={`px-4 py-2 text-right border-r border-gray-200 dark:border-gray-600 ${
                    row.Débit !== 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {row.Débit !== 0 ? row.Débit.toFixed(2) : '-'}
                  </td>
                  <td className={`px-4 py-2 text-right border-r border-gray-200 dark:border-gray-600 ${
                    row.Crédit !== 0 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {row.Crédit !== 0 ? row.Crédit.toFixed(2) : '-'}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900 dark:text-white">
                    {row.Solde.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > 20 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            {t('upload.moreTransactions', { count: rows.length - 20 })}
          </p>
        )}

        <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('preview.importButton', { count: rows.length })}
          </button>
        </div>
      </div>
    </Card>
  );
};

export default ImportPreviewTable;

