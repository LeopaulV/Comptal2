import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheck, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { PendingAutoCategorisation } from '../../types/AutoCategorisation';

interface AutoCategorisationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: PendingAutoCategorisation[];
  onConfirm: (selectedSuggestions: PendingAutoCategorisation[]) => void;
}

const AutoCategorisationReviewModal: React.FC<AutoCategorisationReviewModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onConfirm,
}) => {
  const [localSuggestions, setLocalSuggestions] = useState<PendingAutoCategorisation[]>(suggestions);

  // Mettre à jour les suggestions locales quand elles changent
  React.useEffect(() => {
    setLocalSuggestions(suggestions);
  }, [suggestions]);

  const handleToggleSelection = (index: number) => {
    const updated = [...localSuggestions];
    updated[index] = {
      ...updated[index],
      selected: !updated[index].selected,
    };
    setLocalSuggestions(updated);
  };

  const handleSelectAll = () => {
    const allSelected = localSuggestions.every(s => s.selected);
    setLocalSuggestions(localSuggestions.map(s => ({ ...s, selected: !allSelected })));
  };

  const handleConfirm = () => {
    onConfirm(localSuggestions);
  };

  const selectedCount = useMemo(() => {
    return localSuggestions.filter(s => s.selected).length;
  }, [localSuggestions]);

  const averageConfidence = useMemo(() => {
    const selected = localSuggestions.filter(s => s.selected);
    if (selected.length === 0) return 0;
    const sum = selected.reduce((acc, s) => acc + s.confidence, 0);
    return sum / selected.length;
  }, [localSuggestions]);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.4) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBgColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'bg-green-100 dark:bg-green-900';
    if (confidence >= 0.4) return 'bg-orange-100 dark:bg-orange-900';
    return 'bg-red-100 dark:bg-red-900';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Révision des auto-catégorisations
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Résumé */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedCount} / {localSuggestions.length} ligne(s) sélectionnée(s)
              </span>
              {selectedCount > 0 && (
                <span className={`text-sm font-medium ${getConfidenceColor(averageConfidence)}`}>
                  Score moyen: {(averageConfidence * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {localSuggestions.every(s => s.selected) ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>
        </div>

        {/* Tableau des suggestions */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    <input
                      type="checkbox"
                      checked={localSuggestions.length > 0 && localSuggestions.every(s => s.selected)}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Libellé
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Catégorie actuelle
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Catégorie suggérée
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {localSuggestions.map((suggestion, index) => (
                  <tr
                    key={index}
                    className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      !suggestion.selected ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={suggestion.selected}
                        onChange={() => handleToggleSelection(index)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {suggestion.source}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {suggestion.date}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-md truncate" title={suggestion.libelle}>
                      {suggestion.libelle}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {suggestion.currentCategory || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {suggestion.suggestedCategory || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceBgColor(suggestion.confidence)} ${getConfidenceColor(suggestion.confidence)}`}
                        title={`Confiance: ${(suggestion.confidence * 100).toFixed(1)}%`}
                      >
                        {(suggestion.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer avec boutons */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FontAwesomeIcon icon={faInfoCircle} />
            <span>
              Les lignes sélectionnées seront catégorisées. Vous pourrez ensuite sauvegarder les modifications.
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faCheck} />
              Valider {selectedCount > 0 && `(${selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoCategorisationReviewModal;

