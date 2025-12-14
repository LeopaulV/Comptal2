import React, { useState } from 'react';
import { X, ArrowRight, CheckCircle } from 'lucide-react';
import { FileStructure, DetectedColumns } from '../../types/FileAnalysis';
import { ManualColumnMapping } from '../../types/ColumnMapping';
import { Button } from '../Common';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  structure: FileStructure;
  detectedColumns: DetectedColumns;
  onConfirm: (mapping: ManualColumnMapping) => void;
}

const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  detectedColumns,
  onConfirm,
}) => {
  const [debitColumnIndex, setDebitColumnIndex] = useState<number | null>(
    detectedColumns.amountColumns[0]?.index ?? null
  );
  const [creditColumnIndex, setCreditColumnIndex] = useState<number | null>(
    detectedColumns.amountColumns[1]?.index ?? null
  );

  if (!isOpen) return null;

  const amountColumns = detectedColumns.amountColumns;

  const handleConfirm = () => {
    if (debitColumnIndex !== null && creditColumnIndex !== null && debitColumnIndex !== creditColumnIndex) {
      onConfirm({
        debitColumnIndex,
        creditColumnIndex,
      });
    }
  };

  const isValid = debitColumnIndex !== null && creditColumnIndex !== null && debitColumnIndex !== creditColumnIndex;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Mapping manuel des colonnes
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Veuillez spécifier quelle colonne correspond au <strong>Débit</strong> et
              quelle colonne correspond au <strong>Crédit</strong>.
            </p>
          </div>

          {/* Sélection Débit */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Colonne Débit (montants négatifs)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {amountColumns.map((column) => (
                <button
                  key={column.index}
                  onClick={() => setDebitColumnIndex(column.index)}
                  className={`
                    p-4 rounded-lg border-2 transition-all text-left
                    ${
                      debitColumnIndex === column.index
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {column.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Exemples: {column.sampleValues.slice(0, 2).join(', ')}
                      </p>
                    </div>
                    {debitColumnIndex === column.index && (
                      <CheckCircle size={20} className="text-red-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sélection Crédit */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Colonne Crédit (montants positifs)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {amountColumns.map((column) => (
                <button
                  key={column.index}
                  onClick={() => setCreditColumnIndex(column.index)}
                  disabled={debitColumnIndex === column.index}
                  className={`
                    p-4 rounded-lg border-2 transition-all text-left
                    ${
                      debitColumnIndex === column.index
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }
                    ${
                      creditColumnIndex === column.index
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {column.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Exemples: {column.sampleValues.slice(0, 2).join(', ')}
                      </p>
                    </div>
                    {creditColumnIndex === column.index && (
                      <CheckCircle size={20} className="text-green-500" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Aperçu du mapping */}
          {isValid && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Débit
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {
                      amountColumns.find((c) => c.index === debitColumnIndex)?.name
                    }
                  </p>
                </div>
                <ArrowRight size={20} className="text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    Crédit
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {
                      amountColumns.find((c) => c.index === creditColumnIndex)?.name
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={!isValid}>
              Confirmer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColumnMappingModal;

