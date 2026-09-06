import React, { useState } from 'react';
import { Plus, Save, Trash2, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ColorPalette } from '../../types/colorPalette';
import { generateHarmonyColors } from '../../utils/colorPalettes';

interface CustomPaletteCreatorProps {
  onSave: (palette: ColorPalette) => void;
  onCancel: () => void;
}

const CustomPaletteCreator: React.FC<CustomPaletteCreatorProps> = ({ onSave, onCancel }) => {
  const { t } = useTranslation();
  const [paletteName, setPaletteName] = useState('');
  const [colors, setColors] = useState<string[]>(['#0ea5e9', '#10b981', '#f59e0b']);
  const [baseColor, setBaseColor] = useState('#0ea5e9');
  const [harmonyType, setHarmonyType] = useState<'analogous' | 'complementary' | 'triadic'>('analogous');

  const handleSave = () => {
    if (!paletteName.trim()) {
      toast.error(t('settings.palette.nameRequired'));
      return;
    }
    if (colors.length < 3) {
      toast.error(t('settings.palette.minColors'));
      return;
    }
    onSave({
      id: `custom-${Date.now()}`,
      name: paletteName.trim(),
      colors,
      isCustom: true,
    });
  };

  return (
    <div className="palette-creator">
      <h4 className="font-semibold mb-3" style={{ color: 'var(--invoicing-gray-900)' }}>
        {t('settings.palette.creatorTitle')}
      </h4>
      <label className="ct-label">{t('settings.palette.paletteName')}</label>
      <input
        className="ct-input w-full mb-3"
        value={paletteName}
        onChange={(e) => setPaletteName(e.target.value)}
        placeholder={t('settings.palette.namePlaceholder')}
      />
      <div className="palette-harmony">
        <label className="ct-label">{t('settings.palette.autoGenerate')}</label>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <span className="ct-label">{t('settings.palette.baseColor')}</span>
            <input type="color" className="w-12 h-10 rounded cursor-pointer" value={baseColor} onChange={(e) => setBaseColor(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <span className="ct-label">{t('settings.palette.harmonyType')}</span>
            <select className="ct-input w-full" value={harmonyType} onChange={(e) => setHarmonyType(e.target.value as typeof harmonyType)}>
              <option value="analogous">{t('settings.palette.analogous')}</option>
              <option value="complementary">{t('settings.palette.complementary')}</option>
              <option value="triadic">{t('settings.palette.triadic')}</option>
            </select>
          </div>
          <button type="button" className="ct-btn-secondary" onClick={() => setColors(generateHarmonyColors(baseColor, harmonyType))}>
            <Wand2 size={16} /> {t('settings.palette.generate')}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 mb-2">
        <span className="ct-label mb-0">{t('settings.palette.colorsCount', { count: colors.length })}</span>
        <button type="button" className="ct-btn-icon" onClick={() => setColors([...colors, '#cccccc'])}>
          <Plus size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {colors.map((color, index) => (
          <div key={`${color}-${index}`} className="flex items-center gap-2">
            <input
              type="color"
              className="w-10 h-10 rounded cursor-pointer"
              value={color}
              onChange={(e) => setColors(colors.map((c, i) => (i === index ? e.target.value : c)))}
            />
            <input
              className="ct-input flex-1 font-mono text-xs"
              value={color}
              onChange={(e) => setColors(colors.map((c, i) => (i === index ? e.target.value : c)))}
            />
            {colors.length > 3 && (
              <button type="button" className="ct-btn-icon hover:!text-red-500" onClick={() => setColors(colors.filter((_, i) => i !== index))}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-3 p-2 rounded-lg" style={{ border: '1px solid var(--invoicing-gray-200)' }}>
        {colors.map((color, index) => (
          <div key={`${color}-preview-${index}`} className="flex-1 h-10 rounded" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="flex gap-2 mt-4">
        <button type="button" className="ct-btn-primary" onClick={handleSave}>
          <Save size={16} /> {t('settings.palette.savePalette')}
        </button>
        <button type="button" className="ct-btn-secondary" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  );
};

export default CustomPaletteCreator;
