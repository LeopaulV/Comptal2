import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../Common/Modal';

interface SaveTemplateModalProps {
  isOpen: boolean;
  defaultName?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  isOpen,
  defaultName = '',
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (isOpen) setName(defaultName);
  }, [isOpen, defaultName]);

  return (
    <Modal
      isOpen={isOpen}
      title={t('upload.templates.saveTitle')}
      onClose={onClose}
      footer={
        <>
          <button className="ct-btn-secondary" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="ct-btn-primary"
            disabled={!name.trim()}
            onClick={() => onSave(name.trim())}
          >
            {t('common.save')}
          </button>
        </>
      }
    >
      <label className="ct-label">
        {t('upload.templates.name')}
        <input
          className="ct-input w-full mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('upload.templates.namePlaceholder')}
          autoFocus
        />
      </label>
    </Modal>
  );
};

export default SaveTemplateModal;
