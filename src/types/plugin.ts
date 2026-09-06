export const PLUGIN_FORMAT = 'comptal21-plugin';
export const PLUGIN_FORMAT_VERSION = 1;

export const PLUGIN_TYPES = ['category_pack', 'mention_pack', 'export_mapper', 'import_mapper'] as const;
export type PluginType = (typeof PLUGIN_TYPES)[number];

export const PLUGIN_HOOKS = [
  'categories.apply',
  'invoice.mentions',
  'export.accountantCsv',
  'import.columnMap',
] as const;
export type PluginHook = (typeof PLUGIN_HOOKS)[number];

export interface PluginManifest {
  format: typeof PLUGIN_FORMAT;
  formatVersion: number;
  id: string;
  name: string;
  version: string;
  type: PluginType;
  hooks: PluginHook[];
  description?: string;
  author?: string;
  comptalMin?: string;
}

export interface PluginCategoryItem {
  code: string;
  name: string;
  color?: string;
  group?: string;
}

export interface PluginCategoryPack {
  groups?: Array<{ name: string; color?: string }>;
  categories: PluginCategoryItem[];
}

export interface PluginMentionItem {
  id?: string;
  label: string;
  content: string;
  category?: 'tva' | 'penalites' | 'assurance' | 'juridique' | 'autre';
}

export interface PluginMentionPack {
  mentions: PluginMentionItem[];
}

export const EXPORT_CSV_FIELDS = [
  'date',
  'account',
  'label',
  'debit',
  'credit',
  'category',
  'invoiceNumero',
] as const;
export type ExportCsvField = (typeof EXPORT_CSV_FIELDS)[number];

export interface PluginExportMapper {
  delimiter?: ';' | ',' | '\t';
  columns: Array<{ header: string; field: ExportCsvField }>;
}

export interface PluginImportMapper {
  name?: string;
  columnRoles: Record<string, string>;
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  enabled: boolean;
  appliedAt?: string;
  relDir: string;
}

export interface PluginPayloads {
  categoryPack?: PluginCategoryPack;
  mentionPack?: PluginMentionPack;
  exportMapper?: PluginExportMapper;
  importMapper?: PluginImportMapper;
}
