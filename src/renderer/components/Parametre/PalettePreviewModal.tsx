import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { ColorPalette } from '../../types/ColorPalette';
import { PaletteApplication } from '../../types/ColorPalette';
import ColorPaletteSelector from './ColorPaletteSelector';

interface PalettePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{ code: string; name: string; color: string }>;
  onApply: (applications: PaletteApplication[]) => void;
  title: string;
}

const PalettePreviewModal: React.FC<PalettePreviewModalProps> = ({
  isOpen,
  onClose,
  items,
  onApply,
  title,
}) => {
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette | null>(null);
  const [applications, setApplications] = useState<PaletteApplication[]>([]);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      // Initialiser avec l'ordre actuel des items
      const initialApplications: PaletteApplication[] = items.map((item) => ({
        itemCode: item.code,
        itemName: item.name,
        currentColor: item.color,
        newColor: item.color,
        selected: true,
      }));
      setApplications(initialApplications);
    }
  }, [isOpen, items]);

  useEffect(() => {
    if (selectedPalette && applications.length > 0) {
      // Distribuer les couleurs de la palette selon l'ordre actuel
      const updated = applications.map((app, index) => ({
        ...app,
        newColor: selectedPalette.colors[index % selectedPalette.colors.length],
      }));
      setApplications(updated);
    }
  }, [selectedPalette]);

  const handlePaletteSelect = (palette: ColorPalette) => {
    setSelectedPalette(palette);
  };

  const handleToggleSelection = (index: number) => {
    const updated = [...applications];
    updated[index] = {
      ...updated[index],
      selected: !updated[index].selected,
    };
    setApplications(updated);
  };

  const handleSelectAll = () => {
    const allSelected = applications.every((app) => app.selected);
    setApplications(applications.map((app) => ({ ...app, selected: !allSelected })));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...applications];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    // Redistribuer les couleurs selon le nouvel ordre
    if (selectedPalette) {
      updated.forEach((app, i) => {
        app.newColor = selectedPalette.colors[i % selectedPalette.colors.length];
      });
    }
    setApplications(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === applications.length - 1) return;
    const updated = [...applications];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    // Redistribuer les couleurs selon le nouvel ordre
    if (selectedPalette) {
      updated.forEach((app, i) => {
        app.newColor = selectedPalette.colors[i % selectedPalette.colors.length];
      });
    }
    setApplications(updated);
  };

  const handleApply = () => {
    const selectedApplications = applications.filter((app) => app.selected);
    if (selectedApplications.length === 0) {
      alert('Veuillez sélectionner au moins un élément à modifier');
      return;
    }
    onApply(selectedApplications);
    onClose();
  };

  const selectedCount = applications.filter((app) => app.selected).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Appliquer une palette de couleurs - {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Sélecteur de palette */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                1. Choisissez une palette
              </h3>
              <ColorPaletteSelector onSelectPalette={handlePaletteSelect} />
            </div>

            {/* Prévisualisation */}
            {selectedPalette && applications.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    2. Prévisualisation et sélection
                  </h3>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {applications.every((app) => app.selected)
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'}
                  </button>
                </div>

                <div className="space-y-2">
                  {applications.map((app, index) => (
                    <div
                      key={app.itemCode}
                      className={`
                        flex items-center gap-4 p-3 rounded-lg border-2 transition-all
                        ${app.selected
                          ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 opacity-60'
                        }
                      `}
                    >
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={app.selected}
                        onChange={() => handleToggleSelection(index)}
                        className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 cursor-pointer"
                      />

                      {/* Réorganisation */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200
                                 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Déplacer vers le haut"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === applications.length - 1}
                          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200
                                 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Déplacer vers le bas"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{app.itemName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{app.itemCode}</p>
                      </div>

                      {/* Couleur actuelle */}
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Actuelle</div>
                        <div
                          className="w-12 h-12 rounded border-2 border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: app.currentColor }}
                          title={app.currentColor}
                        />
                      </div>

                      {/* Flèche */}
                      <div className="text-gray-400 dark:text-gray-600">
                        →
                      </div>

                      {/* Nouvelle couleur */}
                      <div className="flex items-center gap-2">
                        <div
                          className="w-12 h-12 rounded border-2 border-gray-300 dark:border-gray-600"
                          style={{ backgroundColor: app.newColor }}
                          title={app.newColor}
                        />
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {app.newColor}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    {selectedCount} élément{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''} sur {applications.length}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg
                     hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleApply}
            disabled={!selectedPalette || selectedCount === 0}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Check size={18} />
            Appliquer ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
};

export default PalettePreviewModal;

