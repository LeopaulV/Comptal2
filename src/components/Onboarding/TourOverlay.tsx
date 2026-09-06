import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { PAGE_INTRO_ANCHOR } from './pageIntros';
import TourCard from './TourCard';
import '../../styles/onboarding-custom.css';

const HALO_PAD = 8;

function queryTourTarget(selector: string): HTMLElement | null {
  return document.querySelector(`[data-tour="${selector}"]`);
}

const TourOverlay: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    tourActive,
    tourPaused,
    currentStep,
    currentStepIndex,
    pageIntro,
    next,
    previous,
    skipStep,
    skipTour,
    goToStep,
    resumeTour,
    dismissPageIntro,
  } = useOnboarding();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const activeTarget = useMemo(() => {
    if (pageIntro) return PAGE_INTRO_ANCHOR;
    if (tourActive && !tourPaused) return currentStep?.target ?? null;
    return null;
  }, [currentStep, pageIntro, tourActive, tourPaused]);

  useEffect(() => {
    if (!activeTarget) {
      setTargetRect(null);
      return;
    }

    let cancelled = false;
    let raf = 0;

    const measure = () => {
      if (cancelled) return;
      const el = queryTourTarget(activeTarget);
      if (!el) {
        setTargetRect(null);
        return;
      }
      setTargetRect(el.getBoundingClientRect());
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    measure();
    const el = queryTourTarget(activeTarget);
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }

    const interval = window.setInterval(measure, 250);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [activeTarget, location.key, currentStepIndex, pageIntro?.route]);

  if (typeof document === 'undefined') {
    return null;
  }

  const showResume = tourActive && tourPaused && !pageIntro;
  const showTour = tourActive && !tourPaused && currentStep && !pageIntro;
  const showIntro = pageIntro !== null;

  if (!showResume && !showTour && !showIntro) {
    return null;
  }

  const halo = targetRect
    ? {
        top: Math.max(0, targetRect.top - HALO_PAD),
        left: Math.max(0, targetRect.left - HALO_PAD),
        width: targetRect.width + HALO_PAD * 2,
        height: targetRect.height + HALO_PAD * 2,
      }
    : null;

  return createPortal(
    <div className="onboarding-overlay" aria-live="polite">
      {halo && (showTour || showIntro) && (
        <div
          className="onboarding-halo"
          style={{
            top: halo.top,
            left: halo.left,
            width: halo.width,
            height: halo.height,
          }}
        />
      )}

      {showTour && currentStep && (
        <TourCard
          mode="tour"
          title={t(currentStep.titleKey)}
          body={t(currentStep.bodyKey)}
          resetKey={`tour-${currentStep.id}`}
          targetRect={targetRect}
          stepIndex={currentStepIndex}
          onPrevious={previous}
          onNext={next}
          onSkipStep={skipStep}
          onSkipTour={skipTour}
          onFinish={skipTour}
          onGoToStep={goToStep}
        />
      )}

      {showIntro && pageIntro && (
        <TourCard
          mode="intro"
          title={t(pageIntro.titleKey)}
          body={t(pageIntro.bodyKey)}
          resetKey={`intro-${pageIntro.route}`}
          targetRect={targetRect}
          onFinish={dismissPageIntro}
        />
      )}

      {showResume && (
        <button type="button" className="onboarding-resume" onClick={resumeTour}>
          {t('onboarding.resume')}
        </button>
      )}
    </div>,
    document.body
  );
};

export default TourOverlay;
