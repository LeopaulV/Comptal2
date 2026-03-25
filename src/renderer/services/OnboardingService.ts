// Service pour gérer le didacticiel de première ouverture

import { ConfigService } from './ConfigService';
import { FileService } from './FileService';
import { ProfilePaths } from './ProfilePaths';

export class OnboardingService {
  // Catégories par défaut qui ne comptent pas comme des catégories personnalisées
  private static readonly DEFAULT_CATEGORIES = ['!', '?', 'X'];

  /**
   * Indique si le didacticiel doit s'afficher pour le profil actif :
   * tant que `onboardingCompleted` n'est pas `true` dans les paramètres du profil.
   */
  static async isFirstLaunch(): Promise<boolean> {
    try {
      const settings = await ConfigService.loadSettings();
      if (settings.onboardingCompleted === true) {
        return false;
      }
      return true;
    } catch (error: any) {
      console.error('[OnboardingService] Erreur lors de la vérification de première ouverture:', error);
      // En cas d'erreur, on considère que ce n'est pas une première ouverture pour éviter de bloquer l'utilisateur
      return false;
    }
  }

  /**
   * Vérifie si l'utilisateur a créé au moins un compte
   */
  static async hasUserAccounts(): Promise<boolean> {
    try {
      const accounts = await ConfigService.loadAccounts();
      const accountKeys = Object.keys(accounts);
      // Un compte existe si le fichier n'est pas vide et contient au moins une clé
      return accountKeys.length > 0;
    } catch (error: any) {
      console.error('[OnboardingService] Erreur lors de la vérification des comptes:', error);
      return false;
    }
  }

  /**
   * Vérifie si l'utilisateur a importé des données (utilise le dossier data du profil actif)
   */
  static async hasImportedData(): Promise<boolean> {
    try {
      const dataDir = await ProfilePaths.getDataDirectory();
      const files = await FileService.readDirectoryOptional(dataDir);
      if (files === null) return false;
      return files.some(file => file.endsWith('.csv'));
    } catch (error: any) {
      console.error('[OnboardingService] Erreur lors de la vérification des données:', error);
      return false;
    }
  }

  /**
   * Vérifie si l'utilisateur a créé des catégories personnalisées
   */
  static async hasCustomCategories(): Promise<boolean> {
    try {
      const categories = await ConfigService.loadCategories();
      const categoryKeys = Object.keys(categories);
      
      // Vérifier s'il y a des catégories autres que les catégories par défaut
      const customCategories = categoryKeys.filter(
        key => !this.DEFAULT_CATEGORIES.includes(key)
      );
      
      return customCategories.length > 0;
    } catch (error: any) {
      console.error('[OnboardingService] Erreur lors de la vérification des catégories:', error);
      return false;
    }
  }

  /**
   * Vérifie si l'étape 1 (comptes) est complétée
   */
  static async isStep1Completed(): Promise<boolean> {
    return await this.hasUserAccounts();
  }

  /**
   * Vérifie si l'étape 2 (import) est complétée
   */
  static async isStep2Completed(): Promise<boolean> {
    return await this.hasImportedData();
  }

  /**
   * Vérifie si l'étape 3 (catégories) est complétée
   */
  static async isStep3Completed(): Promise<boolean> {
    return await this.hasCustomCategories();
  }

  /**
   * Marque le didacticiel comme terminé
   */
  static async markOnboardingComplete(): Promise<void> {
    try {
      const settings = await ConfigService.loadSettings();
      settings.onboardingCompleted = true;
      await ConfigService.saveSettings(settings);
      console.log('[OnboardingService] Didacticiel marqué comme terminé');
    } catch (error: any) {
      console.error('[OnboardingService] Erreur lors de la sauvegarde de l\'état du didacticiel:', error);
      throw error;
    }
  }

  /**
   * Réinitialise le didacticiel (pour les tests ou la réinitialisation)
   */
  static async resetOnboarding(): Promise<void> {
    try {
      const settings = await ConfigService.loadSettings();
      settings.onboardingCompleted = false;
      await ConfigService.saveSettings(settings);
      console.log('[OnboardingService] Didacticiel réinitialisé');
    } catch (error: any) {
      console.error('[OnboardingService] Erreur lors de la réinitialisation du didacticiel:', error);
      throw error;
    }
  }
}

