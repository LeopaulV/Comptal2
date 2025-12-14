// Types pour le mapping manuel des colonnes

export interface ManualColumnMapping {
  debitColumnIndex: number;
  creditColumnIndex: number;
}

export interface ColumnMappingConfig {
  dateColumnIndex: number;
  dateValueColumnIndex?: number; // Optionnel, utilise dateColumnIndex si absent
  libelleColumnIndex: number;
  debitColumnIndex: number;
  creditColumnIndex: number;
  balanceColumnIndex?: number; // Optionnel
}

export interface TransformedRow {
  Source: string;
  Compte: string;
  Date: string; // Format DD/MM/YYYY
  'Date de valeur': string; // Format DD/MM/YYYY
  Débit: number; // Toujours négatif ou 0
  Crédit: number; // Toujours positif ou 0
  Libellé: string;
  Solde: number;
  catégorie: string; // 'X' par défaut
  'Solde initial': number | '';
  Index: string; // Format: YYYYMMDD,solde_absolu
}

export interface ImportConfig {
  accountCode: string;
  accountName: string;
  initialBalance: number;
  startDate: string; // Format YYYY-MM-DD
  endDate: string; // Format YYYY-MM-DD
  columnMapping: ColumnMappingConfig;
}

