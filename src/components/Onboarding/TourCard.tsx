import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical } from 'lucide-react';
import { CardPosition, defaultCardPosition, useDraggableCard } from './useDraggableCard';
import { TOUR_STEP_COUNT } from './tourSteps';

interface TourCardProps {
  title: string;
  body: string;
  resetKey: string;
  targetRect: DOMRect | null;
  mode: 'tour' | 'intro';
  stepIndex?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  onSkipStep?: () => void;
  onSkipTour?: () => void;
  onFinish?: () => void;
  onGoToStep?: (index: number) => void;
}

const DEFAULT_CARD_SIZE = { width: 400, height: 280 };

const TourCard: React.FC<TourCardProps> = ({
  title,
  body,
  resetKey,
  targetRect,
  mode,
  stepIndex = 0,
  onPrevious,
  onNext,
  onSkipStep,
  onSkipTour,
  onFinish,
  onGoToStep,
}) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState(DEFAULT_CARD_SIZE);
  const { manualPosition, isDragging, handlePointerDown } = useDraggableCard(resetKey);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCardSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [resetKey, title, body]);

  const fallback = defaultCardPosition(targetRect, cardSize.width, cardSize.height);
  const position: CardPosition = manualPosition ?? fallback;
  const isLast = stepIndex >= TOUR_STEP_COUNT - 1;

  return (
    <div
      ref={cardRef}
      className={`onboarding-card ct-card${isDragging ? ' is-dragging' : ''}`}
      style={{ left: position.x, top: position.y }}
      role="dialog"
      aria-labelledby="onboarding-card-title"
    >
      <div
        className="onboarding-card-handle"
        onPointerDown={(event) => handlePointerDown(event, position, cardSize)}
      >
        <GripVertical size={16} />
        <span>{t('onboarding.dragHint')}</span>
      </div>

      <h2 id="onboarding-card-title" className="onboarding-card-title">
        {title}
      </h2>
      <p className="onboarding-card-body">{body}</p>

      {mode === 'tour' && (
        <div className="onboarding-card-dots" role="tablist" aria-label={t('onboarding.help')}>
          {Array.from({ length: TOUR_STEP_COUNT }, (_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === stepIndex}
              className={`onboarding-dot${index === stepIndex ? ' is-active' : ''}`}
              onClick={() => onGoToStep?.(index)}
              title={`${index + 1}`}
            />
          ))}
        </div>
      )}

      <div className="onboarding-card-actions">
        {mode === 'intro' ? (
          <button type="button" className="ct-btn-primary" onClick={onFinish}>
            {t('onboarding.finish')}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="ct-btn-secondary"
              onClick={onPrevious}
              disabled={stepIndex <= 0}
            >
              {t('onboarding.previous')}
            </button>
            <button type="button" className="ct-btn-primary" onClick={isLast ? onFinish : onNext}>
              {isLast ? t('onboarding.finish') : t('onboarding.next')}
            </button>
          </>
        )}
      </div>

      {mode === 'tour' && (
        <div className="onboarding-card-skips">
          <button type="button" className="onboarding-link-btn" onClick={onSkipStep}>
            {t('onboarding.skipStep')}
          </button>
          <button type="button" className="onboarding-link-btn" onClick={onSkipTour}>
            {t('onboarding.skipTour')}
          </button>
        </div>
      )}
    </div>
  );
};

export default TourCard;
