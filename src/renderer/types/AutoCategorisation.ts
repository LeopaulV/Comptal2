// Types pour le système d'auto-catégorisation par mots

export interface WordStats {
  totalCount: number; // Nombre total d'apparitions du mot (toutes catégories)
  length: number; // Nombre de caractères du mot
  isNumeric: boolean; // True si le mot est 100% numérique
  catCounts: Record<string, number>; // { codeCategorie: nombreDeCategorisationsAvecCeMot }
}

export interface WordStatsMap {
  [word: string]: WordStats;
}

export interface CategorySuggestion {
  category: string | null; // Code de catégorie suggéré (null si aucun score suffisant)
  scores: Record<string, number>; // Scores pour toutes les catégories
  confidence: number; // Score de la catégorie suggérée (0-1)
}

export interface PendingAutoCategorisation {
  rowIndex: number; // Index dans sortedRows
  source: string;
  date: string;
  libelle: string;
  currentCategory: string;
  suggestedCategory: string | null;
  confidence: number; // Score de confiance (0-1)
  selected: boolean; // Si la ligne est cochée pour application
}

