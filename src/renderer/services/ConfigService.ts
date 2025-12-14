// Service pour charger les configurations (comptes, catégories, paramètres)

import { AccountsConfig } from '../types/Account';
import { CategoriesConfig } from '../types/Category';
import { AppSettings, DEFAULT_SETTINGS } from '../types/Settings';
import { WordStatsMap } from '../types/AutoCategorisation';
import { ColorPalette } from '../types/ColorPalette';
import { FileService } from './FileService';

export class ConfigService {
  private static accountsCache: AccountsConfig | null = null;
  private static categoriesCache: CategoriesConfig | null = null;
  private static settingsCache: AppSettings | null = null;
  private static autoCategorisationCache: WordStatsMap | null = null;
  private static colorPalettesCache: ColorPalette[] | null = null;

  /**
   * Charge la configuration des comptes
   */
  static async loadAccounts(): Promise<AccountsConfig> {
    if (this.accountsCache) {
      return this.accountsCache;
    }

    try {
      const content = await FileService.readFile('parametre/account.json');
      this.accountsCache = JSON.parse(content);
      return this.accountsCache!;
    } catch (error: any) {
      console.error('Erreur lors du chargement des comptes:', error.message);
      return {};
    }
  }

  /**
   * Charge la configuration des catégories
   */
  static async loadCategories(): Promise<CategoriesConfig> {
    if (this.categoriesCache) {
      return this.categoriesCache;
    }

    try {
      const content = await FileService.readFile('parametre/categories.json');
      this.categoriesCache = JSON.parse(content);
      return this.categoriesCache!;
    } catch (error: any) {
      console.error('Erreur lors du chargement des catégories:', error.message);
      return {};
    }
  }

  /**
   * Charge les paramètres de l'application
   */
  static async loadSettings(): Promise<AppSettings> {
    if (this.settingsCache) {
      return this.settingsCache;
    }

    try {
      const content = await FileService.readFile('parametre/settings.json');
      const settings = JSON.parse(content);
      this.settingsCache = { ...DEFAULT_SETTINGS, ...settings };
      return this.settingsCache!;
    } catch (error: any) {
      console.warn('Paramètres non trouvés, utilisation des paramètres par défaut');
      this.settingsCache = DEFAULT_SETTINGS;
      return this.settingsCache;
    }
  }

  /**
   * Sauvegarde les paramètres
   */
  static async saveSettings(settings: AppSettings): Promise<void> {
    try {
      const content = JSON.stringify(settings, null, 2);
      await FileService.writeFile('parametre/settings.json', content);
      this.settingsCache = settings;
    } catch (error: any) {
      throw new Error(`Erreur lors de la sauvegarde des paramètres: ${error.message}`);
    }
  }

  /**
   * Sauvegarde la configuration des comptes
   */
  static async saveAccounts(accounts: AccountsConfig): Promise<void> {
    try {
      const content = JSON.stringify(accounts, null, 4);
      await FileService.writeFile('parametre/account.json', content);
      this.accountsCache = accounts;
    } catch (error: any) {
      throw new Error(`Erreur lors de la sauvegarde des comptes: ${error.message}`);
    }
  }

  /**
   * Sauvegarde la configuration des catégories
   */
  static async saveCategories(categories: CategoriesConfig): Promise<void> {
    try {
      const content = JSON.stringify(categories, null, 4);
      await FileService.writeFile('parametre/categories.json', content);
      this.categoriesCache = categories;
    } catch (error: any) {
      throw new Error(`Erreur lors de la sauvegarde des catégories: ${error.message}`);
    }
  }

  /**
   * Charge les statistiques d'auto-catégorisation
   */
  static async loadAutoCategorisationStats(): Promise<WordStatsMap> {
    if (this.autoCategorisationCache) {
      return this.autoCategorisationCache;
    }

    try {
      const content = await FileService.readFile('parametre/auto_categorisation.json');
      this.autoCategorisationCache = JSON.parse(content);
      return this.autoCategorisationCache!;
    } catch (error: any) {
      // Si le fichier n'existe pas encore, retourner un objet vide (c'est normal au premier lancement)
      // Ne pas logger d'erreur, juste initialiser avec des stats vides
      this.autoCategorisationCache = {};
      return this.autoCategorisationCache;
    }
  }

  /**
   * Sauvegarde les statistiques d'auto-catégorisation
   */
  static async saveAutoCategorisationStats(stats: WordStatsMap): Promise<void> {
    try {
      const content = JSON.stringify(stats, null, 2);
      await FileService.writeFile('parametre/auto_categorisation.json', content);
      this.autoCategorisationCache = stats;
    } catch (error: any) {
      throw new Error(`Erreur lors de la sauvegarde des stats d'auto-catégorisation: ${error.message}`);
    }
  }

  /**
   * Charge les palettes de couleurs personnalisées
   */
  static async loadColorPalettes(): Promise<ColorPalette[]> {
    if (this.colorPalettesCache) {
      return this.colorPalettesCache;
    }

    try {
      const content = await FileService.readFile('parametre/color_palettes.json');
      this.colorPalettesCache = JSON.parse(content);
      return this.colorPalettesCache!;
    } catch (error: any) {
      // Si le fichier n'existe pas encore, retourner un tableau vide
      this.colorPalettesCache = [];
      return this.colorPalettesCache;
    }
  }

  /**
   * Sauvegarde les palettes de couleurs personnalisées
   */
  static async saveColorPalettes(palettes: ColorPalette[]): Promise<void> {
    try {
      const content = JSON.stringify(palettes, null, 2);
      await FileService.writeFile('parametre/color_palettes.json', content);
      this.colorPalettesCache = palettes;
    } catch (error: any) {
      throw new Error(`Erreur lors de la sauvegarde des palettes: ${error.message}`);
    }
  }

  /**
   * Réinitialise le cache
   */
  static clearCache(): void {
    this.accountsCache = null;
    this.categoriesCache = null;
    this.settingsCache = null;
    this.autoCategorisationCache = null;
    this.colorPalettesCache = null;
  }
}

