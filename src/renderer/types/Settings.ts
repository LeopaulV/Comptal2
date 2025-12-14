// Types pour les paramètres de l'application

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'fr' | 'en';
  currency: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  dataDirectory: string;
  autoSave: boolean;
  showBalance: boolean;
  defaultView: 'dashboard' | 'edition' | 'finance-global';
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  language: 'fr',
  currency: '€',
  dateFormat: 'DD/MM/YYYY',
  dataDirectory: './data',
  autoSave: true,
  showBalance: true,
  defaultView: 'dashboard',
};

