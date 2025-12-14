// Types pour les catégories de dépenses

export interface Category {
  code: string; // A, B, C, D, etc.
  name: string; // Nom complet de la catégorie
  color: string; // Couleur hexadécimale pour l'affichage
}

export interface CategoriesConfig {
  [key: string]: Omit<Category, 'code'>;
}

export interface CategorySummary {
  categoryCode: string;
  categoryName: string;
  color: string;
  totalAmount: number;
  transactionCount: number;
  percentage: number; // Pourcentage du total des dépenses
}

export interface CategoryTrend {
  categoryCode: string;
  categoryName: string;
  color: string;
  monthlyData: {
    month: string;
    amount: number;
  }[];
}

