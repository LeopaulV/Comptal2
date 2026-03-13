// Service pour charger les configurations (comptes, catégories, paramètres)

import { AccountsConfig } from '../types/Account';
import { CategoriesConfig } from '../types/Category';
import { AppSettings, DEFAULT_SETTINGS, DEFAULT_MENU_VISIBILITY } from '../types/Settings';
import { WordStatsMap } from '../types/AutoCategorisation';
import { ColorPalette } from '../types/ColorPalette';
import { ProjectsConfig, Project, ProjectSerialized, Subscription, SubscriptionSerialized } from '../types/ProjectManagement';
import { FileService } from './FileService';

export class ConfigService {
  private static accountsCache: AccountsConfig | null = null;
  private static categoriesCache: CategoriesConfig | null = null;
  private static settingsCache: AppSettings | null = null;
  private static autoCategorisationCache: WordStatsMap | null = null;
  private static colorPalettesCache: ColorPalette[] | null = null;
  private static projectsCache: ProjectsConfig | null = null;

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
      
      // Fusionner les paramètres avec les valeurs par défaut
      // Fusion récursive pour menuVisibility
      const mergedSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...settings,
        menuVisibility: settings.menuVisibility 
          ? { ...DEFAULT_MENU_VISIBILITY, ...settings.menuVisibility }
          : DEFAULT_MENU_VISIBILITY,
      };
      
      this.settingsCache = mergedSettings;
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
   * Codes des projets exclus des sélecteurs (Gestion et Projet, Finance Global).
   * Ces projets sont réservés à leurs pages dédiées (ex: Charges Entreprise, Association).
   */
  static readonly PROJECT_CODES_EXCLUDED_FROM_SELECTION = ['ENTREPRISE', 'ASSOCIATION'] as const;

  /**
   * Charge tous les projets
   */
  static async loadProjects(): Promise<ProjectsConfig> {
    if (this.projectsCache) {
      return this.projectsCache;
    }

    try {
      const content = await FileService.readFile('parametre/projects.json');
      this.projectsCache = JSON.parse(content);
      return this.projectsCache!;
    } catch (error: any) {
      // Si le fichier n'existe pas encore, retourner un objet vide
      this.projectsCache = {};
      return this.projectsCache;
    }
  }

  /**
   * Sauvegarde tous les projets
   */
  static async saveProjects(projects: ProjectsConfig): Promise<void> {
    try {
      const content = JSON.stringify(projects, null, 2);
      await FileService.writeFile('parametre/projects.json', content);
      this.projectsCache = projects;
    } catch (error: any) {
      throw new Error(`Erreur lors de la sauvegarde des projets: ${error.message}`);
    }
  }

  /**
   * Charge les projets sélectionnables (exclut ENTREPRISE, etc.).
   * Utilisé par Gestion et Projet et Finance Global.
   */
  static async loadSelectableProjects(): Promise<ProjectsConfig> {
    const projects = await this.loadProjects();
    const excluded = new Set<string>(this.PROJECT_CODES_EXCLUDED_FROM_SELECTION);
    return Object.fromEntries(
      Object.entries(projects).filter(([code]) => !excluded.has(code))
    );
  }

  /**
   * Convertit un abonnement sérialisé en abonnement (désérialisation récursive)
   */
  private static deserializeSubscription(subSerialized: SubscriptionSerialized): Subscription {
    const subscription: Subscription = {
      ...subSerialized,
      startDate: new Date(subSerialized.startDate),
      endDate: subSerialized.endDate ? new Date(subSerialized.endDate) : undefined,
      children: subSerialized.children ? subSerialized.children.map(child => this.deserializeSubscription(child)) : undefined,
      advancedSettings: subSerialized.advancedSettings ? {
        ...subSerialized.advancedSettings,
        rates: subSerialized.advancedSettings.rates ? subSerialized.advancedSettings.rates.map(rate => ({
          ...rate,
          startDate: new Date(rate.startDate),
          endDate: rate.endDate ? new Date(rate.endDate) : undefined,
        })) : undefined,
      } : undefined,
    };
    return subscription;
  }

  /**
   * Convertit un abonnement en abonnement sérialisé (sérialisation récursive)
   */
  private static serializeSubscription(subscription: Subscription): SubscriptionSerialized {
    const subSerialized: SubscriptionSerialized = {
      id: subscription.id,
      name: subscription.name,
      amount: subscription.amount,
      periodicity: subscription.periodicity,
      type: subscription.type,
      startDate: subscription.startDate.toISOString(),
      endDate: subscription.endDate ? subscription.endDate.toISOString() : undefined,
      accountCode: subscription.accountCode,
      categoryCode: subscription.categoryCode,
      color: subscription.color,
      isGroup: subscription.isGroup,
      children: subscription.children ? subscription.children.map(child => this.serializeSubscription(child)) : undefined,
      advancedSettings: subscription.advancedSettings ? {
        rate: subscription.advancedSettings.rate,
        rates: subscription.advancedSettings.rates ? subscription.advancedSettings.rates.map(rate => ({
          id: rate.id,
          percentage: rate.percentage,
          frequency: rate.frequency,
          startDate: rate.startDate.toISOString(),
          endDate: rate.endDate ? rate.endDate.toISOString() : undefined,
        })) : undefined,
        creditIndicator: subscription.advancedSettings.creditIndicator,
      } : undefined,
    };
    return subSerialized;
  }

  /**
   * Charge un projet spécifique
   */
  static async loadProject(projectCode: string): Promise<Project | null> {
    const projects = await this.loadProjects();
    const projectSerialized = projects[projectCode];
    
    if (!projectSerialized) {
      return null;
    }

    // Convertir les dates ISO string en Date
    const project: Project = {
      code: projectSerialized.code,
      name: projectSerialized.name,
      subscriptions: projectSerialized.subscriptions.map(sub => this.deserializeSubscription(sub)),
      projectionConfig: {
        startDate: new Date(projectSerialized.projectionConfig.startDate),
        endDate: new Date(projectSerialized.projectionConfig.endDate),
        initialBalance: projectSerialized.projectionConfig.initialBalance,
        accountConfigs: projectSerialized.projectionConfig.accountConfigs,
      },
      createdAt: new Date(projectSerialized.createdAt),
      updatedAt: new Date(projectSerialized.updatedAt),
    };

    if (projectSerialized.chargesMode) {
      project.chargesMode = projectSerialized.chargesMode;
    }
    if (projectSerialized.categoryChargesConfig) {
      project.categoryChargesConfig = {
        referencePeriod: {
          startDate: new Date(projectSerialized.categoryChargesConfig.referencePeriod.startDate),
          endDate: new Date(projectSerialized.categoryChargesConfig.referencePeriod.endDate),
        },
        selectedCategories: projectSerialized.categoryChargesConfig.selectedCategories,
      };
    }

    return project;
  }

  /**
   * Sauvegarde un projet (ajoute ou met à jour)
   */
  static async saveProject(project: Project): Promise<void> {
    const projects = await this.loadProjects();
    
    // Sérialiser le projet (convertir les dates en ISO string)
    const projectSerialized: ProjectSerialized = {
      code: project.code,
      name: project.name,
      subscriptions: project.subscriptions.map(sub => this.serializeSubscription(sub)),
      projectionConfig: {
        startDate: project.projectionConfig.startDate.toISOString(),
        endDate: project.projectionConfig.endDate.toISOString(),
        initialBalance: project.projectionConfig.initialBalance,
        accountConfigs: project.projectionConfig.accountConfigs,
      },
      createdAt: project.createdAt.toISOString(),
      updatedAt: new Date().toISOString(), // Mettre à jour la date de modification
    };

    if (project.chargesMode) {
      projectSerialized.chargesMode = project.chargesMode;
    }
    if (project.categoryChargesConfig) {
      projectSerialized.categoryChargesConfig = {
        referencePeriod: {
          startDate: project.categoryChargesConfig.referencePeriod.startDate.toISOString(),
          endDate: project.categoryChargesConfig.referencePeriod.endDate.toISOString(),
        },
        selectedCategories: project.categoryChargesConfig.selectedCategories,
      };
    }

    projects[project.code] = projectSerialized;
    await this.saveProjects(projects);
  }

  /**
   * Supprime un projet
   */
  static async deleteProject(projectCode: string): Promise<void> {
    const projects = await this.loadProjects();
    
    if (!projects[projectCode]) {
      throw new Error(`Projet "${projectCode}" introuvable`);
    }
    
    delete projects[projectCode];
    await this.saveProjects(projects);
  }

  /**
   * Génère un code unique pour un nouveau projet
   */
  static async generateProjectCode(name?: string): Promise<string> {
    const projects = await this.loadProjects();
    
    // Si un nom est fourni, essayer de créer un code basé sur le nom
    if (name) {
      const baseCode = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 10);
      
      if (baseCode && !projects[baseCode]) {
        return baseCode;
      }
      
      // Si le code existe déjà, ajouter un numéro
      let counter = 1;
      let candidateCode = `${baseCode}${counter}`;
      while (projects[candidateCode]) {
        counter++;
        candidateCode = `${baseCode}${counter}`;
      }
      return candidateCode;
    }
    
    // Sinon, générer un code séquentiel PROJ001, PROJ002, etc.
    let counter = 1;
    let candidateCode = `PROJ${counter.toString().padStart(3, '0')}`;
    while (projects[candidateCode]) {
      counter++;
      candidateCode = `PROJ${counter.toString().padStart(3, '0')}`;
    }
    return candidateCode;
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
    this.projectsCache = null;
  }
}

