// Composant principal orchestrant le tour guidé interactif

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useElementObserver } from '../../hooks/useElementObserver';
import ElementHighlight from './ElementHighlight';
import TourStep from './TourStep';
import TourNotification from './TourNotification';
import { tourSteps } from '../../config/tourSteps';

const GuidedTour: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    tourState,
    currentStep,
    nextStep,
    previousStep,
    skipTour,
    checkStepCompletion,
  } = useOnboarding();

  const [_stepCompleted, setStepCompleted] = useState(false);

  // Observer l'élément cible de l'étape actuelle
  const { elementExists, elementRect, element } = useElementObserver(
    currentStep?.targetSelector || ''
  );

  // Vérifier périodiquement si l'étape est complétée
  useEffect(() => {
    if (!tourState.isActive || tourState.isPaused || !currentStep) return;

    const checkCompletion = async () => {
      const completed = await checkStepCompletion();
      setStepCompleted(completed);
    };

    checkCompletion();
    const interval = setInterval(checkCompletion, 2000);
    return () => clearInterval(interval);
  }, [tourState.isActive, tourState.isPaused, currentStep, checkStepCompletion]);

  // Naviguer vers la route de l'étape si nécessaire
  useEffect(() => {
    if (!tourState.isActive || !currentStep) return;

    const currentPath = window.location.hash.replace('#', '');
    if (currentPath !== currentStep.targetRoute) {
      navigate(currentStep.targetRoute);
    }
  }, [tourState.isActive, currentStep, navigate]);

  // Ouvrir l'onglet approprié pour l'étape 1 (comptes)
  useEffect(() => {
    if (!tourState.isActive || !currentStep) return;

    if (currentStep.id === 'create-account') {
      // Attendre que la page soit chargée puis ouvrir l'onglet accounts
      const timer = setTimeout(() => {
        const accountsTab = document.querySelector('[data-tour-tab="accounts"]') as HTMLElement;
        if (accountsTab) {
          accountsTab.click();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tourState.isActive, currentStep]);

  // Écouter les clics sur l'élément cible
  useEffect(() => {
    if (!element || !tourState.isActive || tourState.isPaused) return;

    const handleClick = async (e: MouseEvent) => {
      // Vérifier si le clic est sur l'élément cible ou ses enfants
      const target = e.target as HTMLElement;
      if (element.contains(target) || element === target) {
        // Attendre un peu pour que l'action se termine
        setTimeout(async () => {
          const completed = await checkStepCompletion();
          if (completed) {
            // Passer automatiquement à l'étape suivante après un délai
            setTimeout(() => {
              nextStep();
            }, 500);
          }
        }, 300);
      }
    };

    element.addEventListener('click', handleClick, true);
    return () => {
      element.removeEventListener('click', handleClick, true);
    };
  }, [element, tourState.isActive, tourState.isPaused, checkStepCompletion, nextStep]);

  if (!tourState.isActive || !currentStep) {
    return null;
  }

  const isLastStep = tourState.currentStepIndex === tourSteps.length - 1;
  const canGoPrevious = tourState.currentStepIndex > 0;

  return (
    <>
      {/* Bordure animée autour de l'élément cible */}
      <ElementHighlight
        elementRect={elementRect}
        visible={elementExists && !tourState.isPaused}
      />

      {/* Carte flottante avec instructions */}
      {elementExists && !tourState.isPaused && (
        <TourStep
          title={t(currentStep.titleKey)}
          description={t(currentStep.descriptionKey)}
          elementRect={elementRect}
          position={currentStep.position}
          visible={true}
        />
      )}

      {/* Notification en bas à droite */}
      <TourNotification
        currentStep={tourState.currentStepIndex + 1}
        totalSteps={tourSteps.length}
        title={t(currentStep.titleKey)}
        description={t(currentStep.descriptionKey)}
        onNext={nextStep}
        onPrevious={previousStep}
        onSkip={skipTour}
        canGoPrevious={canGoPrevious}
        isLastStep={isLastStep}
      />
    </>
  );
};

export default GuidedTour;

