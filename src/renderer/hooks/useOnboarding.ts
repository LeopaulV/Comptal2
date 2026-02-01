// Hook pour gérer le tour guidé interactif

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingService } from '../services/OnboardingService';
import { tourSteps, TourStep } from '../config/tourSteps';

export interface TourState {
  isActive: boolean;
  isPaused: boolean;
  currentStepIndex: number;
  completedSteps: string[];
  skipped: boolean;
}

interface UseOnboardingReturn {
  tourState: TourState;
  currentStep: TourStep | null;
  startTour: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTour: () => void;
  pauseTour: () => void;
  resumeTour: () => void;
  checkStepCompletion: () => Promise<boolean>;
  goToStep: (stepIndex: number) => void;
}

export const useOnboarding = (): UseOnboardingReturn => {
  const navigate = useNavigate();
  const [tourState, setTourState] = useState<TourState>({
    isActive: false,
    isPaused: false,
    currentStepIndex: 0,
    completedSteps: [],
    skipped: false,
  });

  const currentStep = tourState.currentStepIndex < tourSteps.length
    ? tourSteps[tourState.currentStepIndex]
    : null;

  // Vérifier si c'est une première ouverture au montage
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const isFirst = await OnboardingService.isFirstLaunch();
        if (isFirst) {
          setTourState(prev => ({
            ...prev,
            isActive: true,
          }));
        }
      } catch (error) {
        console.error('[useOnboarding] Erreur lors de la vérification de première ouverture:', error);
      }
    };

    checkFirstLaunch();
  }, []);

  // Vérifier périodiquement si l'étape actuelle est complétée (toutes les 3 secondes)
  useEffect(() => {
    if (!tourState.isActive || tourState.isPaused || !currentStep) return;

    const interval = setInterval(async () => {
      const isCompleted = await currentStep.checkCompletion();
      if (isCompleted && !tourState.completedSteps.includes(currentStep.id)) {
        // Marquer l'étape comme complétée et passer à la suivante automatiquement après un délai
        setTimeout(() => {
          nextStep();
        }, 1000);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [tourState.isActive, tourState.isPaused, currentStep, tourState.completedSteps]);

  // Vérifier la complétion d'une étape
  const checkStepCompletion = useCallback(async (): Promise<boolean> => {
    if (!currentStep) return false;
    return await currentStep.checkCompletion();
  }, [currentStep]);

  // Démarrer le tour
  const startTour = useCallback(() => {
    setTourState({
      isActive: true,
      isPaused: false,
      currentStepIndex: 0,
      completedSteps: [],
      skipped: false,
    });
    
    // Naviguer vers la première étape
    if (tourSteps.length > 0) {
      navigate(tourSteps[0].targetRoute);
    }
  }, [navigate]);

  // Étape suivante
  const nextStep = useCallback(async () => {
    setTourState(prev => {
      const nextIndex = prev.currentStepIndex + 1;
      
      if (nextIndex >= tourSteps.length) {
        // Tour terminé
        OnboardingService.markOnboardingComplete();
        return {
          ...prev,
          isActive: false,
          completedSteps: [...prev.completedSteps, currentStep?.id || ''],
        };
      }

      const nextStep = tourSteps[nextIndex];
      
      // Exécuter beforeStep si défini
      if (nextStep.beforeStep) {
        nextStep.beforeStep();
      }

      // Naviguer vers la route de l'étape suivante
      navigate(nextStep.targetRoute);

      return {
        ...prev,
        currentStepIndex: nextIndex,
        completedSteps: [...prev.completedSteps, currentStep?.id || ''],
      };
    });
  }, [navigate, currentStep]);

  // Étape précédente
  const previousStep = useCallback(() => {
    setTourState(prev => {
      const prevIndex = prev.currentStepIndex - 1;
      
      if (prevIndex < 0) {
        return prev;
      }

      const prevStep = tourSteps[prevIndex];
      
      // Naviguer vers la route de l'étape précédente
      navigate(prevStep.targetRoute);

      return {
        ...prev,
        currentStepIndex: prevIndex,
      };
    });
  }, [navigate]);

  // Passer le tour
  const skipTour = useCallback(async () => {
    await OnboardingService.markOnboardingComplete();
    setTourState(prev => ({
      ...prev,
      isActive: false,
      skipped: true,
    }));
  }, []);

  // Mettre en pause le tour
  const pauseTour = useCallback(() => {
    setTourState(prev => ({
      ...prev,
      isPaused: true,
    }));
  }, []);

  // Reprendre le tour
  const resumeTour = useCallback(() => {
    setTourState(prev => ({
      ...prev,
      isPaused: false,
    }));
  }, []);

  // Aller à une étape spécifique
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= tourSteps.length) return;

    const step = tourSteps[stepIndex];
    navigate(step.targetRoute);

    setTourState(prev => ({
      ...prev,
      currentStepIndex: stepIndex,
    }));
  }, [navigate]);

  return {
    tourState,
    currentStep,
    startTour,
    nextStep,
    previousStep,
    skipTour,
    pauseTour,
    resumeTour,
    checkStepCompletion,
    goToStep,
  };
};
