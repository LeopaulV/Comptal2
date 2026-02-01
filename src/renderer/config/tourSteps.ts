// Configuration des étapes du tour guidé

import { OnboardingService } from '../services/OnboardingService';

export interface TourStep {
  id: string;
  titleKey: string; // Clé de traduction pour le titre
  descriptionKey: string; // Clé de traduction pour la description
  targetSelector: string; // Sélecteur CSS de l'élément à mettre en évidence
  targetRoute: string; // Route où naviguer
  position: 'top' | 'bottom' | 'left' | 'right'; // Position de la carte
  waitForElement: boolean; // Attendre que l'élément soit visible
  checkCompletion: () => Promise<boolean>; // Fonction pour vérifier si l'étape est complétée
  beforeStep?: () => Promise<void>; // Action avant l'étape (ex: ouvrir un onglet)
  afterStep?: () => Promise<void>; // Action après l'étape
}

export const tourSteps: TourStep[] = [
  {
    id: 'create-account',
    titleKey: 'tour.steps.createAccount.title',
    descriptionKey: 'tour.steps.createAccount.description',
    targetSelector: '[data-tour-step="create-account"]',
    targetRoute: '/parametre',
    position: 'right',
    waitForElement: true,
    checkCompletion: async () => {
      return await OnboardingService.isStep1Completed();
    },
    beforeStep: async () => {
      // S'assurer qu'on est sur la page Paramètres et que l'onglet "accounts" est ouvert
      // Cette logique sera gérée dans le composant GuidedTour
    },
  },
  {
    id: 'import-data',
    titleKey: 'tour.steps.importData.title',
    descriptionKey: 'tour.steps.importData.description',
    targetSelector: '[data-tour-step="import-data"]',
    targetRoute: '/upload',
    position: 'top',
    waitForElement: true,
    checkCompletion: async () => {
      return await OnboardingService.isStep2Completed();
    },
  },
  {
    id: 'create-category',
    titleKey: 'tour.steps.createCategory.title',
    descriptionKey: 'tour.steps.createCategory.description',
    targetSelector: '[data-tour-step="create-category"]',
    targetRoute: '/edition',
    position: 'left',
    waitForElement: true,
    checkCompletion: async () => {
      return await OnboardingService.isStep3Completed();
    },
  },
];

export const getTourStepById = (id: string): TourStep | undefined => {
  return tourSteps.find(step => step.id === id);
};

export const getTourStepByIndex = (index: number): TourStep | undefined => {
  return tourSteps[index];
};

