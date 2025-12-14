// Types pour l'analyse de fichiers CSV/Excel

export type FileType = 'csv' | 'excel';

export type ColumnType = 'date' | 'text' | 'number' | 'unknown';

export interface ColumnInfo {
  index: number;
  name: string;
  type: ColumnType;
  sampleValues: string[];
  // Pour les colonnes numériques
  hasNegativeValues?: boolean;
  hasPositiveValues?: boolean;
  isMonotonic?: boolean; // Pour détecter le solde
}

export interface FileStructure {
  fileType: FileType;
  encoding?: string;
  delimiter?: string;
  headerRowIndex: number; // Index de la ligne d'en-tête (peut être -1 si pas d'en-tête)
  dataStartRowIndex: number; // Index de la première ligne de données réelle
  columns: ColumnInfo[];
  totalRows: number;
  sampleRows: any[][]; // Premières lignes pour prévisualisation
  rawData?: any[][]; // NOUVEAU : données déjà parsées pour éviter la relecture
}

export interface DetectedColumns {
  dateColumn?: ColumnInfo;
  dateValueColumn?: ColumnInfo;
  libelleColumn?: ColumnInfo;
  amountColumns: ColumnInfo[]; // Colonnes numériques détectées
  balanceColumn?: ColumnInfo;
  otherColumns: ColumnInfo[];
  amountColumnType?: 'single' | 'split'; // Type de colonne montant : unique ou séparée
}

export interface FileAnalysisResult {
  structure: FileStructure;
  detectedColumns: DetectedColumns;
  requiresManualMapping: boolean; // true si besoin de mapping manuel pour Débit/Crédit
}

