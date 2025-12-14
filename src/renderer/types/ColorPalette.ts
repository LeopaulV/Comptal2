// Types pour les palettes de couleurs

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  isCustom?: boolean;
}

export interface PaletteApplication {
  itemCode: string;
  itemName: string;
  currentColor: string;
  newColor: string;
  selected: boolean;
}

