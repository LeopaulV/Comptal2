// Types pour l'édition des données CSV

export interface EditionRow {
  Source: string; // Nom du fichier CSV (ex: CCAL_01.01.2025_31.01.2025.csv)
  Compte: string; // Nom complet du compte
  Date: string; // Format: dd/MM/yyyy
  'Date de valeur': string; // Format: dd/MM/yyyy
  Débit: string | number; // Valeur négative ou 0
  Crédit: string | number; // Valeur positive ou 0
  Libellé: string; // Description de la transaction
  Solde: string | number; // Solde après transaction
  catégorie: string; // Code de catégorie (peut être vide)
  'Solde initial'?: string | number; // Solde initial (colonne optionnelle)
  Index?: string; // Index de la transaction (colonne optionnelle)
  rowIndex?: number; // Index original de la ligne (pour tracking)
  deleted?: boolean; // Marqueur pour les lignes supprimées
  modified?: boolean; // Marqueur pour les lignes modifiées
  [key: string]: any; // Pour toute autre colonne dynamique du CSV
}

export interface EditionData {
  headers: string[];
  rows: EditionRow[];
}

