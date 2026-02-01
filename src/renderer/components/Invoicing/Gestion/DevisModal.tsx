import React from 'react';
import { useTranslation } from 'react-i18next';
import { Devis } from '../../../types/Invoice';
import { DocumentEditor } from '../Documents/DocumentEditor';

interface DevisModalProps {
  isOpen: boolean;
  clientId?: string | null;
  devisToEdit?: Devis | null;
  onClose: () => void;
}

export const DevisModal: React.FC<DevisModalProps> = ({ isOpen, clientId, devisToEdit, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;
  const isEdit = Boolean(devisToEdit);
  if (!isEdit && !clientId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="invoicing-header-row">
          <h2>{isEdit ? t('invoicing.gestion.editDevisTitle', 'Modifier le devis') : t('invoicing.gestion.newDevis')}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <DocumentEditor
          documentType="devis"
          clientId={isEdit ? devisToEdit!.clientId : clientId!}
          initialDevis={devisToEdit ?? undefined}
          onSaved={onClose}
        />
      </div>
    </div>
  );
};
