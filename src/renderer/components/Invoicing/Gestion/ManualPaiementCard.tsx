import React from 'react';
import { useTranslation } from 'react-i18next';
import { Paiement } from '../../../types/Invoice';
import { formatCurrency, formatDate } from '../../../utils/format';

interface ManualPaiementCardProps {
  paiement: Paiement;
  onRemove: () => Promise<void>;
}

export const ManualPaiementCard: React.FC<ManualPaiementCardProps> = ({ paiement, onRemove }) => {
  const { t } = useTranslation();
  const [isRemoving, setIsRemoving] = React.useState(false);

  const handleRemove = async () => {
    if (window.confirm(t('invoicing.gestion.confirmRemovePaiement', 'Supprimer ce paiement ?'))) {
      setIsRemoving(true);
      try {
        await onRemove();
      } finally {
        setIsRemoving(false);
      }
    }
  };

  return (
    <div className="invoicing-transaction-card invoicing-manual-paiement-card">
      <div className="invoicing-transaction-header">
        <div className="invoicing-transaction-title">
          <span className="invoicing-transaction-title-icon">💵</span>
          <span className="invoicing-transaction-title-text">
            {t(`invoicing.gestion.paymentMode.${paiement.modePaiement}`, paiement.modePaiement)}
          </span>
        </div>
        <div className="invoicing-transaction-badge">{formatCurrency(paiement.montant)}</div>
      </div>

      <div className="invoicing-transaction-details">
        <div className="invoicing-transaction-detail-row">
          <span className="invoicing-transaction-detail-label">{t('invoicing.gestion.date', 'Date')}</span>
          <span className="invoicing-transaction-detail-value">{formatDate(paiement.datePaiement)}</span>
        </div>
        {paiement.reference && (
          <div className="invoicing-transaction-detail-row">
            <span className="invoicing-transaction-detail-label">{t('invoicing.gestion.reference', 'Référence')}</span>
            <span className="invoicing-transaction-detail-value">{paiement.reference}</span>
          </div>
        )}
      </div>

      <div className="invoicing-transaction-actions">
        <button
          type="button"
          className="invoicing-unlink-button"
          onClick={handleRemove}
          disabled={isRemoving}
        >
          <span>✕</span>
          <span>{t('invoicing.gestion.remove', 'Supprimer')}</span>
        </button>
      </div>
    </div>
  );
};
