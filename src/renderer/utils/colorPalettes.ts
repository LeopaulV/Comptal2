// Palettes de couleurs prédéfinies harmonisées

import { ColorPalette } from '../types/ColorPalette';

export const PREDEFINED_PALETTES: ColorPalette[] = [
  {
    id: 'pastel',
    name: 'Pastel',
    colors: [
      '#FFB3BA', // Rose pastel
      '#FFDFBA', // Pêche
      '#FFFFBA', // Jaune pastel
      '#BAFFC9', // Vert menthe
      '#BAE1FF', // Bleu ciel
      '#E0BBE4', // Lavande
      '#FFCCCB', // Rose clair
      '#F0E68C', // Khaki
      '#DDA0DD', // Prune
      '#98D8C8', // Turquoise
      '#F7DC6F', // Jaune doux
      '#AED6F1', // Bleu poudre
    ],
  },
  {
    id: 'vif',
    name: 'Vif',
    colors: [
      '#FF0000', // Rouge vif
      '#FF8C00', // Orange foncé
      '#FFD700', // Or
      '#32CD32', // Vert lime
      '#00CED1', // Turquoise foncé
      '#1E90FF', // Bleu dodger
      '#9370DB', // Violet moyen
      '#FF1493', // Rose profond
      '#00FF00', // Vert vif
      '#00BFFF', // Bleu profond
      '#FF4500', // Orange rouge
      '#8A2BE2', // Bleu violet
    ],
  },
  {
    id: 'ocean',
    name: 'Océan',
    colors: [
      '#001F3F', // Bleu marine
      '#0074D9', // Bleu
      '#39CCCC', // Turquoise
      '#7FDBFF', // Bleu ciel
      '#B3E5FC', // Bleu très clair
      '#E0F7FA', // Cyan clair
      '#006064', // Cyan foncé
      '#0097A7', // Cyan moyen
      '#00ACC1', // Cyan
      '#4DD0E1', // Cyan clair
      '#80DEEA', // Cyan pâle
      '#B2EBF2', // Cyan très clair
    ],
  },
  {
    id: 'foret',
    name: 'Forêt',
    colors: [
      '#1B5E20', // Vert foncé
      '#2E7D32', // Vert
      '#388E3C', // Vert moyen
      '#43A047', // Vert clair
      '#66BB6A', // Vert lime
      '#81C784', // Vert pâle
      '#A5D6A7', // Vert très clair
      '#6D4C41', // Brun
      '#8D6E63', // Brun clair
      '#A1887F', // Brun pâle
      '#BCAAA4', // Brun très clair
      '#D7CCC8', // Beige
    ],
  },
  {
    id: 'coucher-soleil',
    name: 'Coucher de soleil',
    colors: [
      '#FF6B35', // Orange rouge
      '#F7931E', // Orange
      '#FFC857', // Jaune orange
      '#FFE66D', // Jaune
      '#FF8C94', // Rose saumon
      '#FF6B9D', // Rose
      '#C44569', // Rose foncé
      '#F8B500', // Or
      '#FFA07A', // Saumon clair
      '#FF7F50', // Corail
      '#FF6347', // Tomate
      '#FF4500', // Orange rouge foncé
    ],
  },
  {
    id: 'arc-en-ciel',
    name: 'Arc-en-ciel',
    colors: [
      '#FF0000', // Rouge
      '#FF7F00', // Orange
      '#FFFF00', // Jaune
      '#00FF00', // Vert
      '#0000FF', // Bleu
      '#4B0082', // Indigo
      '#9400D3', // Violet
      '#FF1493', // Rose profond
      '#00CED1', // Turquoise
      '#32CD32', // Vert lime
      '#FFD700', // Or
      '#FF69B4', // Rose chaud
    ],
  },
  {
    id: 'monochrome-bleu',
    name: 'Monochrome Bleu',
    colors: [
      '#000080', // Bleu marine
      '#0000CD', // Bleu moyen
      '#0000FF', // Bleu
      '#4169E1', // Bleu royal
      '#1E90FF', // Bleu dodger
      '#00BFFF', // Bleu profond
      '#87CEEB', // Bleu ciel
      '#B0E0E6', // Bleu poudre
      '#ADD8E6', // Bleu clair
      '#E0F7FA', // Cyan très clair
      '#B3E5FC', // Bleu très clair
      '#E1F5FE', // Bleu pâle
    ],
  },
  {
    id: 'monochrome-vert',
    name: 'Monochrome Vert',
    colors: [
      '#006400', // Vert foncé
      '#008000', // Vert
      '#228B22', // Vert forêt
      '#32CD32', // Vert lime
      '#00FF00', // Vert vif
      '#7CFC00', // Vert herbe
      '#90EE90', // Vert clair
      '#98FB98', // Vert pâle
      '#ADFF2F', // Vert jaune
      '#B3E5B3', // Vert très clair
      '#C8E6C9', // Vert pâle
      '#E8F5E9', // Vert très pâle
    ],
  },
  {
    id: 'monochrome-rouge',
    name: 'Monochrome Rouge',
    colors: [
      '#8B0000', // Rouge foncé
      '#DC143C', // Crimson
      '#FF0000', // Rouge
      '#FF4500', // Orange rouge
      '#FF6347', // Tomate
      '#FF7F50', // Corail
      '#FF8C00', // Orange foncé
      '#FFA07A', // Saumon clair
      '#FFB6C1', // Rose clair
      '#FFC0CB', // Rose
      '#FFE4E1', // Rose coquille
      '#FFF0F5', // Lavande blush
    ],
  },
];

// Fonction pour générer des harmonies de couleurs
export function generateHarmonyColors(baseColor: string, type: 'analogous' | 'complementary' | 'triadic'): string[] {
  // Convertir hex en RGB
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Convertir RGB en HSL
  const rgb = [r / 255, g / 255, b / 255];
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === rgb[0]) {
      h = ((rgb[1] - rgb[2]) / delta + (rgb[1] < rgb[2] ? 6 : 0)) / 6;
    } else if (max === rgb[1]) {
      h = ((rgb[2] - rgb[0]) / delta + 2) / 6;
    } else {
      h = ((rgb[0] - rgb[1]) / delta + 4) / 6;
    }
  }

  const colors: string[] = [];

  if (type === 'analogous') {
    // Couleurs adjacentes (±30°)
    for (let i = -2; i <= 2; i++) {
      const newH = (h + i * 30 / 360 + 1) % 1;
      colors.push(hslToHex(newH, s, l));
    }
  } else if (type === 'complementary') {
    // Couleur complémentaire (180°)
    colors.push(hslToHex(h, s, l));
    colors.push(hslToHex((h + 0.5) % 1, s, l));
    // Variations de luminosité
    colors.push(hslToHex(h, s, Math.max(0, l - 0.2)));
    colors.push(hslToHex(h, s, Math.min(1, l + 0.2)));
    colors.push(hslToHex((h + 0.5) % 1, s, Math.max(0, l - 0.2)));
    colors.push(hslToHex((h + 0.5) % 1, s, Math.min(1, l + 0.2)));
  } else if (type === 'triadic') {
    // Triade (120° d'écart)
    colors.push(hslToHex(h, s, l));
    colors.push(hslToHex((h + 1/3) % 1, s, l));
    colors.push(hslToHex((h + 2/3) % 1, s, l));
    // Variations
    colors.push(hslToHex(h, s, Math.max(0, l - 0.15)));
    colors.push(hslToHex((h + 1/3) % 1, s, Math.max(0, l - 0.15)));
    colors.push(hslToHex((h + 2/3) % 1, s, Math.max(0, l - 0.15)));
  }

  return colors;
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h < 1/6) {
    r = c; g = x; b = 0;
  } else if (h < 2/6) {
    r = x; g = c; b = 0;
  } else if (h < 3/6) {
    r = 0; g = c; b = x;
  } else if (h < 4/6) {
    r = 0; g = x; b = c;
  } else if (h < 5/6) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `#${[r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

