import React from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction } from '../../../types/Transaction';
import { Paiement } from '../../../types/Invoice';
import { formatCurrency, formatDate } from '../../../utils/format';

interface LinkedTransactionCardProps {
  transaction: Transaction;
  paiement: Paiement;
  onUnlink: () => Promise<void>;
}

export const LinkedTransactionCard: React.FC<LinkedTransactionCardProps> = ({
  transaction,
  paiement,
  onUnlink,
}) => {
  const { t } = useTranslation();
  const [isUnlinking, setIsUnlinking] = React.useState(false);

  const handleUnlink = async () => {
    if (window.confirm(t('invoicing.gestion.confirmUnlink', 'Êtes-vous sûr de vouloir délier cette transaction ?'))) {
      setIsUnlinking(true);
      try {
        await onUnlink();
      } finally {
        setIsUnlinking(false);
      }
    }
  };

  return (
    <div className="invoicing-transaction-card">
      <div className="invoicing-transaction-header">
        <div className="invoicing-transaction-title">
          <span className="invoicing-transaction-title-icon">🔗</span>
          <span className="invoicing-transaction-title-text">{transaction.description || t('invoicing.gestion.noDescription', 'Sans description')}</span>
        </div>
        <div className="invoicing-transaction-badge">{formatCurrency(paiement.montant)}</div>
      </div>
      
      <div className="invoicing-transaction-details">
        <div className="invoicing-transaction-detail-row">
          <span className="invoicing-transaction-detail-label">{t('invoicing.gestion.date', 'Date')}</span>
          <span className="invoicing-transaction-detail-value">{formatDate(transaction.date)}</span>
        </div>
        <div className="invoicing-transaction-detail-row">
          <span className="invoicing-transaction-detail-label">{t('invoicing.gestion.account', 'Compte')}</span>
          <span className="invoicing-transaction-detail-value">
            {transaction.accountCode || t('invoicing.gestion.unknown', 'Inconnu')}
            {transaction.accountName && ` • ${transaction.accountName}`}
          </span>
        </div>
        {transaction.category && (
          <div className="invoicing-transaction-detail-row">
            <span className="invoicing-transaction-detail-label">{t('invoicing.gestion.category', 'Catégorie')}</span>
            <span className="invoicing-transaction-detail-value">{transaction.category}</span>
          </div>
        )}
        {paiement.modePaiement && (
          <div className="invoicing-transaction-detail-row">
            <span className="invoicing-transaction-detail-label">{t('invoicing.gestion.paymentMethod', 'Mode')}</span>
            <span className="invoicing-transaction-detail-value">
              {t(`invoicing.gestion.paymentMode.${paiement.modePaiement}`, paiement.modePaiement)}
            </span>
          </div>
        )}
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
          onClick={handleUnlink}
          disabled={isUnlinking}
        >
          <span>✕</span>
          <span>{t('invoicing.gestion.unlink', 'Délier')}</span>
        </button>
      </div>
    </div>
  );
};
