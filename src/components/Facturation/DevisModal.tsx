import React from 'react';
import { useTranslation } from 'react-i18next';
import { Devis } from '../../types/invoice';
import WideModal from '../Common/WideModal';
import DocumentEditor from './DocumentEditor';

interface DevisModalProps {
  isOpen: boolean;
  clientId?: string | null;
  devisToEdit?: Devis | null;
  onClose: () => void;
}

const DevisModal: React.FC<DevisModalProps> = ({ isOpen, clientId, devisToEdit, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const isEdit = Boolean(devisToEdit);
  return (
    <WideModal
      isOpen={isOpen}
      title={isEdit ? t('facturation.editDevis') : t('facturation.newDevis')}
      onClose={onClose}
      layer="editor"
    >
      <DocumentEditor
        documentType="devis"
        clientId={isEdit ? devisToEdit!.clientId : clientId || undefined}
        initialDevis={devisToEdit ?? undefined}
        onSaved={onClose}
      />
    </WideModal>
  );
};

export default DevisModal;
