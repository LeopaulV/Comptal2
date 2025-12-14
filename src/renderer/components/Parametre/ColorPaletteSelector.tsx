import React, { useState, useEffect } from 'react';
import { Palette, Plus } from 'lucide-react';
import { ColorPalette } from '../../types/ColorPalette';
import { PREDEFINED_PALETTES } from '../../utils/colorPalettes';
import { ConfigService } from '../../services/ConfigService';
import CustomPaletteCreator from './CustomPaletteCreator';

interface ColorPaletteSelectorProps {
  onSelectPalette: (palette: ColorPalette) => void;
}

const ColorPaletteSelector: React.FC<ColorPaletteSelectorProps> = ({ onSelectPalette }) => {
  const [customPalettes, setCustomPalettes] = useState<ColorPalette[]>([]);
  const [showCreator, setShowCreator] = useState(false);
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);

  useEffect(() => {
    loadCustomPalettes();
  }, []);

  const loadCustomPalettes = async () => {
    try {
      const palettes = await ConfigService.loadColorPalettes();
      setCustomPalettes(palettes);
    } catch (error) {
      console.error('Erreur lors du chargement des palettes personnalisées:', error);
    }
  };

  const handlePaletteSelect = (palette: ColorPalette) => {
    setSelectedPaletteId(palette.id);
    onSelectPalette(palette);
  };

  const handleSaveCustomPalette = async (palette: ColorPalette) => {
    try {
      const updated = [...customPalettes, palette];
      await ConfigService.saveColorPalettes(updated);
      setCustomPalettes(updated);
      setShowCreator(false);
      handlePaletteSelect(palette);
    } catch (error: any) {
      alert(`Erreur lors de la sauvegarde: ${error.message}`);
    }
  };

  const allPalettes = [...PREDEFINED_PALETTES, ...customPalettes];

  return (
    <div className="space-y-4">
      {showCreator ? (
        <CustomPaletteCreator
          onSave={handleSaveCustomPalette}
          onCancel={() => setShowCreator(false)}
        />
      ) : (
        <>
          {/* Bouton créer palette */}
          <button
            onClick={() => setShowCreator(true)}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600
                     rounded-lg hover:border-primary-500 dark:hover:border-primary-500
                     transition-colors flex items-center justify-center gap-2
                     text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
          >
            <Plus size={18} />
            Créer une palette personnalisée
          </button>

          {/* Liste des palettes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allPalettes.map((palette) => (
              <button
                key={palette.id}
                onClick={() => handlePaletteSelect(palette)}
                className={`
                  p-4 rounded-lg border-2 transition-all text-left
                  ${selectedPaletteId === palette.id
                    ? 'border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Palette size={16} className="text-gray-600 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {palette.name}
                  </span>
                  {palette.isCustom && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      Personnalisée
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  {palette.colors.slice(0, 8).map((color, index) => (
                    <div
                      key={index}
                      className="flex-1 h-8 rounded"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {palette.colors.length > 8 && (
                    <div className="flex-1 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        +{palette.colors.length - 8}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {palette.colors.length} couleurs
                </p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ColorPaletteSelector;

