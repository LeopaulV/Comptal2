// Notification déplaçable en bas à droite avec instructions

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight, ChevronLeft, GripVertical } from 'lucide-react';
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
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  const clampPosition = useCallback((left: number, top: number) => {
    const el = ref.current;
    if (!el) return { left, top };
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = rect.width;
    const h = rect.height;
    return {
      left: Math.max(0, Math.min(left, vw - w)),
      top: Math.max(0, Math.min(top, vh - h)),
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPosition((prev) => prev ?? { left: rect.left, top: rect.top });
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    },
    []
  );

  useEffect(() => {
    if (dragOffset === null) return;
    const handleMouseMove = (e: MouseEvent) => {
      setPosition((prev) => {
        if (prev === null) return null;
        const clamped = clampPosition(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
        return clamped;
      });
    };
    const handleMouseUp = () => setDragOffset(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragOffset, clampPosition]);

  const style: React.CSSProperties = position
    ? { left: position.left, top: position.top, bottom: 'auto', right: 'auto' }
    : {};

  return (
    <div
      ref={ref}
      className={`tour-notification ${isDark ? 'dark' : ''} ${dragOffset ? 'tour-notification-dragging' : ''}`}
      style={style}
    >
      {/* Header avec poignée de déplacement et bouton fermer */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="tour-notification-drag-handle flex-1"
          onMouseDown={handleMouseDown}
          title={t('tour.dragHint', 'Glissez pour déplacer')}
        >
          <div className="flex items-center gap-2">
            <GripVertical size={16} className="tour-notification-grip-icon flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                  {t('tour.step', { current: currentStep, total: totalSteps })}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {title}
              </h3>
            </div>
          </div>
        </div>
        <button
          onClick={onSkip}
          className="ml-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
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

