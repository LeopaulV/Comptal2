import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Monitor, Download, FileText, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { Button } from '../Common';

interface ImportHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS: Array<{ icon: React.ComponentType<{ size?: number; className?: string }>; key: string; icons?: React.ComponentType<{ size?: number; className?: string }>[] }> = [
  { icon: Monitor, key: 'step1' },
  { icon: Download, key: 'step2' },
  { icon: FileText, key: 'step3', icons: [FileText, FileSpreadsheet] },
];

const ImportHelpModal: React.FC<ImportHelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isLastStep = currentStep === STEPS.length - 1;
  const StepIcon = STEPS[currentStep].icon;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-help-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 id="import-help-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('upload.importHelp.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded"
            aria-label={t('common.close', 'Fermer')}
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Indicateurs d'étapes */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((_, index) => (
              <React.Fragment key={index}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
                    ${index === currentStep
                      ? 'bg-primary-600 text-white scale-110'
                      : index < currentStep
                        ? 'bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }
                  `}
                >
                  {index + 1}
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-8 h-0.5 rounded transition-colors ${
                      index < currentStep ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Contenu de l'étape avec animation */}
          <div className="min-h-[140px] overflow-hidden">
            {STEPS.map((step, index) => (
              <div
                key={step.key}
                className={`
                  transition-all duration-300 ease-out
                  ${index === currentStep
                    ? 'opacity-100 translate-x-0'
                    : index < currentStep
                      ? 'opacity-0 absolute -translate-x-full pointer-events-none'
                      : 'opacity-0 absolute translate-x-full pointer-events-none'
                  }
                `}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center mb-4">
                    {step.icons ? (
                      <div className="flex gap-1">
                        {step.icons.map((Icon, i) => (
                          <Icon key={i} size={24} className="text-primary-600 dark:text-primary-400" />
                        ))}
                      </div>
                    ) : (
                      <step.icon size={32} className="text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                  <p className="text-base text-gray-700 dark:text-gray-300">
                    {t(`upload.importHelp.${step.key}`)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Boutons */}
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            {isLastStep ? (
              <Button variant="primary" onClick={onClose}>
                {t('upload.importHelp.gotIt')}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setCurrentStep((s) => s + 1)}
                icon={<ChevronRight size={16} />}
              >
                {t('upload.importHelp.next')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportHelpModal;
