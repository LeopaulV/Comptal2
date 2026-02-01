import React from 'react';
import { useTranslation } from 'react-i18next';
import { Devis } from '../../../types/Invoice';
import { DocumentEditor } from '../Documents/DocumentEditor';

interface FactureModalProps {
  isOpen: boolean;
  devis: Devis | null;
  onClose: () => void;
}

export const FactureModal: React.FC<FactureModalProps> = ({ isOpen, devis, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen || !devis) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="invoicing-header-row">
          <h2>{t('invoicing.gestion.newFacture')}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <DocumentEditor
          documentType="facture"
          clientId={devis.clientId}
          devisId={devis.id}
          devisNumero={devis.numero}
          devisForFacture={devis}
          onSaved={onClose}
        />
      </div>
    </div>
  );
};
