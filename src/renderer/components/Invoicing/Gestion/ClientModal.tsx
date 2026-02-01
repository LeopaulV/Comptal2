import React from 'react';
import { useTranslation } from 'react-i18next';
import { ClientForm } from '../Clients/ClientForm';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="invoicing-header-row">
          <h2>{t('invoicing.gestion.newClient')}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <ClientForm onSaved={onClose} />
      </div>
    </div>
  );
};
