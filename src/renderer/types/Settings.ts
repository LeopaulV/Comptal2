// Types pour les paramètres de l'application

export interface MenuVisibility {
  dashboard: boolean;
  upload: boolean;
  edition: boolean;
  financeGlobal: boolean;
  projectManagement: boolean;
  invoicing: boolean;
  // parametre est toujours visible, donc pas besoin de l'inclure
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  language: 'fr' | 'en';
  currency: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  dataDirectory: string;
  autoSave: boolean;
  showBalance: boolean;
  defaultView: 'dashboard' | 'edition' | 'finance-global';
  onboardingCompleted?: boolean;
  menuVisibility?: MenuVisibility;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export const DEFAULT_MENU_VISIBILITY: MenuVisibility = {
  dashboard: true,
  upload: true,
  edition: true,
  financeGlobal: true,
  projectManagement: true,
  invoicing: true,
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  language: 'fr',
  currency: '€',
  dateFormat: 'DD/MM/YYYY',
  dataDirectory: './data',
  autoSave: true,
  showBalance: true,
  defaultView: 'dashboard',
  menuVisibility: DEFAULT_MENU_VISIBILITY,
};

