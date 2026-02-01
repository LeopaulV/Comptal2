// Notification fixe en bas à droite avec instructions

import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import Button from '../Common/Button';
import '../../styles/guided-tour.css';

interface TourNotificationProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  description: string;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  canGoPrevious: boolean;
  isLastStep: boolean;
}

const TourNotification: React.FC<TourNotificationProps> = ({
  currentStep,
  totalSteps,
  title,
  description,
  onNext,
  onPrevious,
  onSkip,
  canGoPrevious,
  isLastStep,
}) => {
  const { t } = useTranslation();
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className={`tour-notification ${isDark ? 'dark' : ''}`}>
      {/* Header avec bouton fermer */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
              {t('tour.step', { current: currentStep, total: totalSteps })}
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
        <button
          onClick={onSkip}
          className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title={t('tour.skip')}
        >
          <X size={20} />
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        {description}
      </p>

      {/* Indicateur de progression */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex items-center gap-2">
        {canGoPrevious && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onPrevious}
            icon={<ChevronLeft size={16} />}
          >
            {t('tour.previous')}
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={onNext}
          className="flex-1"
          icon={<ChevronRight size={16} />}
        >
          {isLastStep ? t('tour.finish') : t('tour.next')}
        </Button>
      </div>
    </div>
  );
};

export default TourNotification;

