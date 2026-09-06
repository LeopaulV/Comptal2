import React from 'react';
import { useTranslation } from 'react-i18next';
import { Devis, Facture } from '../../types/invoice';
import { isDevisCaduc } from '../../utils/invoiceFormat';
import WideModal from '../Common/WideModal';
import DocumentEditor from './DocumentEditor';

interface FactureModalProps {
  isOpen: boolean;
  devis?: Devis | null;
  factureToEdit?: Facture | null;
  onClose: () => void;
}

const FactureModal: React.FC<FactureModalProps> = ({ isOpen, devis, factureToEdit, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  if (!factureToEdit && !devis) return null;
  if (devis && isDevisCaduc(devis) && !factureToEdit) return null;
  return (
    <WideModal
      isOpen={isOpen}
      title={factureToEdit ? t('facturation.editFacture') : t('facturation.newFacture')}
      onClose={onClose}
      layer="editor"
    >
      <DocumentEditor
        documentType="facture"
        clientId={factureToEdit?.clientId ?? devis?.clientId}
        devisForFacture={devis ?? undefined}
        initialFacture={factureToEdit ?? undefined}
        onSaved={onClose}
      />
    </WideModal>
  );
};

export default FactureModal;
