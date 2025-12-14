import React from 'react';
import { X, CheckCircle, AlertCircle, Calendar, FileText, DollarSign } from 'lucide-react';
import { FileAnalysisResult } from '../../types/FileAnalysis';
import { Button } from '../Common';

interface FileAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: FileAnalysisResult | null;
  onConfirm: () => void;
  onEdit?: () => void;
}

const FileAnalysisModal: React.FC<FileAnalysisModalProps> = ({
  isOpen,
  onClose,
  analysis,
  onConfirm,
  onEdit,
}) => {
  if (!isOpen || !analysis) return null;

  const { structure, detectedColumns } = analysis;

  const getColumnTypeIcon = (type: string) => {
    switch (type) {
      case 'date':
        return <Calendar size={16} className="text-blue-500" />;
      case 'text':
        return <FileText size={16} className="text-green-500" />;
      case 'number':
        return <DollarSign size={16} className="text-purple-500" />;
      default:
        return null;
    }
  };

  const getColumnTypeLabel = (type: string) => {
    switch (type) {
      case 'date':
        return 'Date';
      case 'text':
        return 'Texte';
      case 'number':
        return 'Nombre';
      default:
        return 'Inconnu';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Analyse du fichier
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Résumé de la détection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-gray-900 dark:text-white">Date</span>
              </div>
              {detectedColumns.dateColumn ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {detectedColumns.dateColumn.name}
                </p>
              ) : (
                <p className="text-sm text-red-600 dark:text-red-400">Non détectée</p>
              )}
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={20} className="text-green-600 dark:text-green-400" />
                <span className="font-semibold text-gray-900 dark:text-white">Libellé</span>
              </div>
              {detectedColumns.libelleColumn ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {detectedColumns.libelleColumn.name}
                </p>
              ) : (
                <p className="text-sm text-red-600 dark:text-red-400">Non détectée</p>
              )}
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={20} className="text-purple-600 dark:text-purple-400" />
                <span className="font-semibold text-gray-900 dark:text-white">Montants</span>
              </div>
              {detectedColumns.amountColumns.length > 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {detectedColumns.amountColumns.length} colonne(s) détectée(s)
                </p>
              ) : (
                <p className="text-sm text-red-600 dark:text-red-400">Non détectées</p>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-gray-900 dark:text-white">Lignes</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {structure.totalRows} ligne(s) de données
              </p>
            </div>
          </div>

          {/* Détails des colonnes */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Colonnes détectées
            </h3>
            <div className="space-y-2">
              {structure.columns.map((column) => {
                const isDetected =
                  column === detectedColumns.dateColumn ||
                  column === detectedColumns.dateValueColumn ||
                  column === detectedColumns.libelleColumn ||
                  detectedColumns.amountColumns.includes(column) ||
                  column === detectedColumns.balanceColumn;

                return (
                  <div
                    key={column.index}
                    className={`p-3 rounded-lg border ${
                      isDetected
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getColumnTypeIcon(column.type)}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {column.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getColumnTypeLabel(column.type)}
                            {column.type === 'number' && (
                              <>
                                {column.hasNegativeValues && ' • Négatif'}
                                {column.hasPositiveValues && ' • Positif'}
                                {column.isMonotonic && ' • Solde'}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      {isDetected && (
                        <CheckCircle size={20} className="text-green-500" />
                      )}
                    </div>
                    {column.sampleValues.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        Exemples: {column.sampleValues.slice(0, 3).join(', ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Avertissements */}
          {analysis.requiresManualMapping && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                    Mapping manuel requis
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Deux colonnes de montants ont été détectées sans valeurs négatives.
                    Vous devrez spécifier manuellement quelle colonne correspond au Débit et
                    laquelle correspond au Crédit.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Prévisualisation */}
          {structure.sampleRows.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Aperçu des données
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {structure.columns.map((col) => (
                        <th
                          key={col.index}
                          className="px-3 py-2 text-left font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-600"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {structure.sampleRows.slice(0, 5).map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-gray-200 dark:border-gray-700"
                      >
                        {structure.columns.map((col) => (
                          <td
                            key={col.index}
                            className="px-3 py-2 text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600"
                          >
                            {row[col.index] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            {onEdit && (
              <Button variant="secondary" onClick={onEdit}>
                Modifier
              </Button>
            )}
            <Button variant="primary" onClick={onConfirm}>
              Continuer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileAnalysisModal;

