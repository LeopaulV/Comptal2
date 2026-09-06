export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  isCustom?: boolean;
  kind?: 'static' | 'dynamic';
  description?: string;
}

export interface PaletteApplication {
  itemCode: string;
  itemName: string;
  currentColor: string;
  newColor: string;
  selected: boolean;
}
