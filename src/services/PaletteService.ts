import { ColorPalette } from '../types/colorPalette';
import { loadSingletonJson, saveSingletonJson } from './jsonStore';
import { withLog } from './logger';

export const PaletteService = {
  async loadCustom(): Promise<ColorPalette[]> {
    return withLog('PaletteService.loadCustom', async () => {
      const payload = await loadSingletonJson<ColorPalette[]>('color_palettes');
      return Array.isArray(payload) ? payload.filter((p) => p?.id && Array.isArray(p.colors)) : [];
    });
  },

  async saveCustom(palettes: ColorPalette[]): Promise<void> {
    return withLog('PaletteService.saveCustom', async () => {
      await saveSingletonJson('color_palettes', palettes);
    }, { data: { count: palettes.length } });
  },
};
