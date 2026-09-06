import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  danger = true,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="ct-btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            className={danger ? 'ct-btn-danger' : 'ct-btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('common.confirm')}
          </button>
        </>
      }
    >
      <p className="text-sm" style={{ color: 'var(--invoicing-gray-600)' }}>
        {message}
      </p>
    </Modal>
  );
};

export default ConfirmModal;
