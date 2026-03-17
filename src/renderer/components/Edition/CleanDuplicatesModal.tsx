import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faBroom } from '@fortawesome/free-solid-svg-icons';
import { DuplicateRowEntry } from '../../types/Edition';

interface CleanDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateRowEntry[];
  inconsistenciesCount: number;
  isLoading?: boolean;
  onConfirm: (selectedIds: string[]) => void;
}

const CleanDuplicatesModal: React.FC<CleanDuplicatesModalProps> = ({
  isOpen,
  onClose,
  duplicates,
  inconsistenciesCount,
  isLoading = false,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && duplicates.length > 0) {
      setSelectedIds(new Set(duplicates.map(d => d.id)));
    }
  }, [isOpen, duplicates]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(duplicates.map(d => d.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  const selectedCount = selectedIds.size;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={e => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="clean-duplicates-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="clean-duplicates-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faBroom} />
            {t('edition.cleanDuplicatesModalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
            aria-label={t('common.close')}
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-12 text-gray-500 dark:text-gray-400">
            {t('edition.cleanDuplicatesLoading')}
          </div>
        ) : duplicates.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-500 dark:text-gray-400 text-center">
            <p>{t('edition.cleanDuplicatesNoDuplicates')}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('edition.cleanDuplicatesSummary', { selected: selectedCount, total: duplicates.length })}
              </span>
              {inconsistenciesCount > 0 && (
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  {t('edition.cleanDuplicatesInconsistencies', { count: inconsistenciesCount })}
                </span>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('edition.cleanDuplicatesSelectAll')}
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t('edition.cleanDuplicatesDeselectAll')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-10">
                        <input
                          type="checkbox"
                          checked={selectedCount === duplicates.length}
                          onChange={() => (selectedCount === duplicates.length ? handleDeselectAll() : handleSelectAll())}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          aria-label={selectedCount === duplicates.length ? t('edition.cleanDuplicatesDeselectAll') : t('edition.cleanDuplicatesSelectAll')}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Libellé</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Débit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.map(entry => (
                      <tr
                        key={entry.id}
                        className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${!selectedIds.has(entry.id) ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(entry.id)}
                            onChange={() => handleToggle(entry.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{entry.fileName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{entry.row.Date ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate" title={String(entry.row.Libellé ?? '')}>
                          {entry.row.Libellé ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{entry.row.Débit ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white text-right">{entry.row.Crédit ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={selectedCount === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faCheck} />
                {t('edition.cleanDuplicatesConfirm')} {selectedCount > 0 && `(${selectedCount})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CleanDuplicatesModal;
