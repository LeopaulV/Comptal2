import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { pageIntroForPath } from './pageIntros';

const OnboardingLauncher: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { startTour, openPageIntro, tourActive, tourPaused, pageIntro } = useOnboarding();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const intro = pageIntroForPath(location.pathname);
  const hideWhileGuiding = (tourActive && !tourPaused) || pageIntro !== null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (hideWhileGuiding) {
    return null;
  }

  return (
    <div className="onboarding-launcher" ref={rootRef}>
      {open && (
        <div className="onboarding-launcher-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              startTour(0);
            }}
          >
            {t('onboarding.replayTour')}
          </button>
          {intro && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                openPageIntro(intro.route);
              }}
            >
              {t('onboarding.openPageIntro')}
            </button>
          )}
        </div>
      )}
      <button
        type="button"
        className="onboarding-launcher-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        title={t('onboarding.help')}
        onClick={() => setOpen((value) => !value)}
      >
        <HelpCircle size={20} />
        <span>{t('onboarding.help')}</span>
      </button>
    </div>
  );
};

export default OnboardingLauncher;
