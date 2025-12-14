// Types pour l'import Excel avec gestion des feuilles

export interface ExcelSheetInfo {
  name: string;
  index: number;
  startDate?: string; // Format DD.MM.YYYY
  endDate?: string; // Format DD.MM.YYYY
  rowCount?: number;
}

export interface SheetImportConfig {
  sheetName: string;
  accountCode: string;
  accountName: string;
  initialBalance: number;
  startDate?: string; // Format YYYY-MM-DD
  endDate?: string; // Format YYYY-MM-DD
  columnMapping?: any; // ColumnMappingConfig - sera défini après analyse
  requiresManualMapping?: boolean;
}

export interface ExcelImportState {
  file: File;
  sheets: ExcelSheetInfo[];
  selectedSheets: string[]; // Noms des feuilles sélectionnées
  sheetConfigs: Map<string, SheetImportConfig>; // Map: sheetName -> config
  analyzedSheets: Map<string, any>; // Map: sheetName -> FileAnalysisResult
  transformedData: Map<string, any[]>; // Map: sheetName -> TransformedRow[]
}

