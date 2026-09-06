import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Download, FileText, ChevronRight } from 'lucide-react';
import Modal from '../Common/Modal';

interface ImportHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { icon: Monitor, key: 'step1' },
  { icon: Download, key: 'step2' },
  { icon: FileText, key: 'step3' },
] as const;

const ImportHelpModal: React.FC<ImportHelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (isOpen) setCurrent(0);
  }, [isOpen]);

  const StepIcon = STEPS[current].icon;
  const isLast = current === STEPS.length - 1;

  return (
    <Modal
      isOpen={isOpen}
      title={t('upload.importHelp.title')}
      onClose={onClose}
      maxWidth="440px"
      footer={
        <>
          {current > 0 && (
            <button className="ct-btn-secondary" onClick={() => setCurrent((c) => c - 1)}>
              {t('common.previous')}
            </button>
          )}
          <button
            className="ct-btn-primary"
            onClick={() => (isLast ? onClose() : setCurrent((c) => c + 1))}
          >
            {isLast ? t('common.close') : t('upload.continue')}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </>
      }
    >
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrent(index)}
            className={`upload-stepper-circle ${
              index === current ? 'is-active' : index < current ? 'is-done' : 'is-todo'
            }`}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="text-center py-4">
        <div className="flex justify-center mb-4" style={{ color: 'var(--invoicing-primary)' }}>
          <StepIcon size={36} />
        </div>
        <h3 className="font-semibold mb-2" style={{ color: 'var(--invoicing-gray-900)' }}>
          {t(`upload.importHelp.${STEPS[current].key}.title`)}
        </h3>
        <p className="text-sm" style={{ color: 'var(--invoicing-gray-600)' }}>
          {t(`upload.importHelp.${STEPS[current].key}.body`)}
        </p>
      </div>
    </Modal>
  );
};

export default ImportHelpModal;
