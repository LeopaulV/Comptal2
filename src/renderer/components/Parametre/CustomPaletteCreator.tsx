import React, { useState } from 'react';
import { Save, Plus, Trash2, Wand2 } from 'lucide-react';
import { ColorPalette } from '../../types/ColorPalette';
import { generateHarmonyColors } from '../../utils/colorPalettes';
import { Button } from '../Common';

interface CustomPaletteCreatorProps {
  onSave: (palette: ColorPalette) => void;
  onCancel: () => void;
}

const CustomPaletteCreator: React.FC<CustomPaletteCreatorProps> = ({ onSave, onCancel }) => {
  const [paletteName, setPaletteName] = useState('');
  const [colors, setColors] = useState<string[]>(['#0ea5e9', '#10b981', '#f59e0b']);
  const [baseColor, setBaseColor] = useState('#0ea5e9');
  const [harmonyType, setHarmonyType] = useState<'analogous' | 'complementary' | 'triadic'>('analogous');

  const handleAddColor = () => {
    setColors([...colors, '#cccccc']);
  };

  const handleRemoveColor = (index: number) => {
    if (colors.length > 3) {
      setColors(colors.filter((_, i) => i !== index));
    }
  };

  const handleColorChange = (index: number, color: string) => {
    const newColors = [...colors];
    newColors[index] = color;
    setColors(newColors);
  };

  const handleGenerateHarmony = () => {
    const harmonyColors = generateHarmonyColors(baseColor, harmonyType);
    setColors(harmonyColors);
  };

  const handleSave = () => {
    if (!paletteName.trim()) {
      alert('Veuillez donner un nom à votre palette');
      return;
    }
    if (colors.length < 3) {
      alert('Une palette doit contenir au moins 3 couleurs');
      return;
    }

    const palette: ColorPalette = {
      id: `custom-${Date.now()}`,
      name: paletteName.trim(),
      colors: colors,
      isCustom: true,
    };

    onSave(palette);
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <h4 className="font-semibold text-gray-900 dark:text-white">Créer une palette personnalisée</h4>

      {/* Nom de la palette */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Nom de la palette
        </label>
        <input
          type="text"
          value={paletteName}
          onChange={(e) => setPaletteName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                   bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Ex: Ma palette personnalisée"
        />
      </div>

      {/* Génération automatique */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Génération automatique (harmonie de couleurs)
        </label>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Couleur de base</label>
            <input
              type="color"
              value={baseColor}
              onChange={(e) => setBaseColor(e.target.value)}
              className="w-full h-10 rounded cursor-pointer"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type d'harmonie</label>
            <select
              value={harmonyType}
              onChange={(e) => setHarmonyType(e.target.value as 'analogous' | 'complementary' | 'triadic')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="analogous">Analogues</option>
              <option value="complementary">Complémentaires</option>
              <option value="triadic">Triadique</option>
            </select>
          </div>
          <button
            onClick={handleGenerateHarmony}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors
                     flex items-center gap-2 whitespace-nowrap"
          >
            <Wand2 size={16} />
            Générer
          </button>
        </div>
      </div>

      {/* Couleurs personnalisées */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Couleurs ({colors.length})
          </label>
          <button
            onClick={handleAddColor}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus size={14} />
            Ajouter
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {colors.map((color, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => handleColorChange(index, e.target.value)}
                className="w-12 h-12 rounded cursor-pointer flex-shrink-0"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => handleColorChange(index, e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
              />
              {colors.length > 3 && (
                <button
                  onClick={() => handleRemoveColor(index)}
                  className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Aperçu */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Aperçu
        </label>
        <div className="flex gap-1 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {colors.map((color, index) => (
            <div
              key={index}
              className="flex-1 h-12 rounded"
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Boutons */}
      <div className="flex gap-2 pt-2">
        <Button variant="primary" onClick={handleSave} icon={<Save size={18} />}>
          Sauvegarder la palette
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
};

export default CustomPaletteCreator;

