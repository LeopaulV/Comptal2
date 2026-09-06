import React, { useEffect, useState } from 'react';
import { Palette, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ColorPalette } from '../../types/colorPalette';
import { isDynamicPalette, PREDEFINED_PALETTES } from '../../utils/colorPalettes';
import { PaletteService } from '../../services/PaletteService';
import { Logger } from '../../services/logger';
import CustomPaletteCreator from './CustomPaletteCreator';

interface ColorPaletteSelectorProps {
  onSelectPalette: (palette: ColorPalette) => void;
}

const ColorPaletteSelector: React.FC<ColorPaletteSelectorProps> = ({ onSelectPalette }) => {
  const { t } = useTranslation();
  const [customPalettes, setCustomPalettes] = useState<ColorPalette[]>([]);
  const [showCreator, setShowCreator] = useState(false);
  const [selectedPaletteId, setSelectedPaletteId] = useState<string | null>(null);

  useEffect(() => {
    void PaletteService.loadCustom()
      .then(setCustomPalettes)
      .catch((err) => Logger.error('ColorPaletteSelector.load', err));
  }, []);

  const handlePaletteSelect = (palette: ColorPalette) => {
    setSelectedPaletteId(palette.id);
    onSelectPalette(palette);
  };

  const handleSaveCustomPalette = async (palette: ColorPalette) => {
    try {
      const updated = [...customPalettes, palette];
      await PaletteService.saveCustom(updated);
      setCustomPalettes(updated);
      setShowCreator(false);
      handlePaletteSelect(palette);
    } catch (err) {
      Logger.error('ColorPaletteSelector.save', err);
      toast.error(t('settings.palette.saveError'));
    }
  };

  const allPalettes = [...PREDEFINED_PALETTES, ...customPalettes];

  return (
    <div className="flex flex-col gap-4">
      {showCreator ? (
        <CustomPaletteCreator
          onSave={(palette) => void handleSaveCustomPalette(palette)}
          onCancel={() => setShowCreator(false)}
        />
      ) : (
        <>
          <button type="button" className="ct-btn-secondary w-full justify-center" onClick={() => setShowCreator(true)}>
            <Plus size={16} /> {t('settings.palette.createCustom')}
          </button>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allPalettes.map((palette) => (
              <button
                key={palette.id}
                type="button"
                onClick={() => handlePaletteSelect(palette)}
                className="palette-card text-left"
                data-selected={palette.id === selectedPaletteId ? 'true' : 'false'}
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Palette size={16} style={{ color: 'var(--invoicing-gray-500)' }} />
                  <span className="font-medium" style={{ color: 'var(--invoicing-gray-900)' }}>
                    {t(`settings.palette.names.${palette.id}`, { defaultValue: palette.name })}
                  </span>
                  {isDynamicPalette(palette) && <span className="palette-dynamic-badge">{t('settings.palette.dynamic')}</span>}
                  {palette.isCustom && <span className="palette-custom-badge">{t('settings.palette.custom')}</span>}
                </div>
                <div className="flex gap-1">
                  {palette.colors.slice(0, 8).map((color, index) => (
                    <div key={`${palette.id}-${index}`} className="flex-1 h-8 rounded" style={{ backgroundColor: color }} title={color} />
                  ))}
                  {palette.colors.length > 8 && (
                    <div
                      className="flex-1 h-8 rounded flex items-center justify-center text-xs"
                      style={{ backgroundColor: 'var(--invoicing-gray-200)', color: 'var(--invoicing-gray-500)' }}
                    >
                      +{palette.colors.length - 8}
                    </div>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--invoicing-gray-500)' }}>
                  {isDynamicPalette(palette)
                    ? t('settings.palette.dynamicDescription')
                    : t('settings.palette.colorCount', { count: palette.colors.length })}
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
