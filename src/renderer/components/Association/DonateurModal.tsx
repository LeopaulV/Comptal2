import React from 'react';
import { useTranslation } from 'react-i18next';
import { Donateur } from '../../types/Association';
import { DonateurForm } from './DonateurForm';

interface DonateurModalProps {
  isOpen: boolean;
  donateurToEdit?: Donateur | null;
  onClose: () => void;
}

export const DonateurModal: React.FC<DonateurModalProps> = ({
  isOpen,
  donateurToEdit,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="invoicing-header-row">
          <h2>
            {donateurToEdit ? t('association.gestion.editDonateur') : t('association.gestion.newDonateur')}
          </h2>
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <DonateurForm
          initialDonateur={donateurToEdit}
          onSaved={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  );
};
