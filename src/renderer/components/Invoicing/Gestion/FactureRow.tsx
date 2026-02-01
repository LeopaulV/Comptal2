import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Facture, Paiement } from '../../../types/Invoice';
import { Transaction } from '../../../types/Transaction';
import { formatCurrency, formatDate } from '../../../utils/format';
import { LinkedTransactionCard } from './LinkedTransactionCard';
import { TransactionSearchDialog } from '../Paiements/TransactionSearchDialog';
import { ChevronToggle } from './ChevronToggle';
import { PaymentTrackingService } from '../../../services/PaymentTrackingService';

const RecoveryBar: React.FC<{ paidAmount: number; totalAmount: number }> = ({ paidAmount, totalAmount }) => {
  const percent = totalAmount > 0 ? Math.min(100, (paidAmount / totalAmount) * 100) : 0;
  return (
    <div className="invoicing-recovery-container">
      <div className="invoicing-recovery-bar-wrapper">
        <div className="invoicing-recovery-bar">
          <div className="invoicing-recovery-progress" style={{ width: `${percent}%` }} />
        </div>
        <span className="invoicing-recovery-label">
          {paidAmount.toFixed(2)} € / {totalAmount.toFixed(2)} €
        </span>
      </div>
      <span className="invoicing-recovery-percent">{percent.toFixed(1)}%</span>
    </div>
  );
};

interface FactureRowProps {
  facture: Facture;
  transactionsById: Map<string, Transaction>;
  onDeleteFacture?: () => void;
  onRefresh?: () => Promise<void>;
}

export const FactureRow: React.FC<FactureRowProps> = ({ facture, transactionsById, onDeleteFacture, onRefresh }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  const linkedTransactionsWithPaiements = useMemo(() => {
    return facture.paiements
      .map((paiement) => {
        const transaction = paiement.transactionId ? transactionsById.get(paiement.transactionId) : undefined;
        return transaction ? { transaction, paiement } : null;
      })
      .filter((item): item is { transaction: Transaction; paiement: Paiement } => Boolean(item));
  }, [facture.paiements, transactionsById]);

  const paymentStatus = useMemo(
    () => PaymentTrackingService.getPaymentStatus(facture),
    [facture]
  );

  const excludedTransactionIds = useMemo(() => {
    return facture.paiements
      .map((p) => p.transactionId)
      .filter((id): id is string => Boolean(id));
  }, [facture.paiements]);

  const handleLinkTransaction = async (transaction: Transaction) => {
    setIsLinking(true);
    try {
      await PaymentTrackingService.linkTransactionToInvoice(transaction.id, facture.id);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Erreur lors de la liaison de la transaction:', error);
    } finally {
      setIsLinking(false);
      setIsSearchDialogOpen(false);
    }
  };

  const handleUnlinkTransaction = async (paiementId: string) => {
    try {
      await PaymentTrackingService.unlinkTransactionFromInvoice(paiementId, facture.id);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Erreur lors de la déliaison de la transaction:', error);
    }
  };

  return (
    <div className="invoicing-nested">
      <div className="invoicing-list-item invoicing-nested-item invoicing-facture-row">
        <ChevronToggle isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
        <div className="invoicing-row-content">
        <div className="invoicing-row-name">
          {facture.numero}
          <span className="invoicing-row-meta">
            • {formatDate(facture.dateEmission)} • {formatCurrency(facture.totalTTC)} •{' '}
            <span className={`invoicing-status-badge ${facture.statut}`}>
              {t(`invoicing.gestion.status.${facture.statut}`)}
            </span>
          </span>
        </div>
        <RecoveryBar paidAmount={paymentStatus.paidAmount} totalAmount={paymentStatus.totalTTC} />
        </div>
        {onDeleteFacture && (
          <div className="invoicing-list-item-actions">
            <button type="button" className="secondary" onClick={onDeleteFacture}>
              {t('invoicing.gestion.deleteFacture', 'Supprimer')}
            </button>
          </div>
        )}
      </div>
      {facture.attachment?.name && (
        <div className="invoicing-inline-meta invoicing-pdf-link-row">
          <span>{t('invoicing.gestion.linkedPdf')}: {facture.attachment.name}</span>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const appPath = await window.electronAPI.getAppPath();
              const p = facture.attachment!.path;
              const isAbsolute = p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
              const fullPath = isAbsolute ? p : `${appPath}/${p}`.replace(/\/+/g, '/');
              await window.electronAPI.openPath(fullPath);
            }}
          >
            {t('invoicing.gestion.openPdf', 'Ouvrir le PDF')}
          </button>
        </div>
      )}
      {isOpen && (
        <div className="invoicing-nested-content">
          <div className="invoicing-transaction-section">
            <button
              type="button"
              className="invoicing-link-button"
              onClick={() => setIsSearchDialogOpen(true)}
              disabled={isLinking}
            >
              <span>+</span>
              <span>{t('invoicing.gestion.linkTransaction', 'Lier une transaction')}</span>
            </button>

            {linkedTransactionsWithPaiements.length === 0 ? (
              <div className="invoicing-empty">{t('invoicing.gestion.emptyTransactions', 'Aucune transaction liée')}</div>
            ) : (
              linkedTransactionsWithPaiements.map(({ transaction, paiement }) => (
                <LinkedTransactionCard
                  key={paiement.id}
                  transaction={transaction}
                  paiement={paiement}
                  onUnlink={() => handleUnlinkTransaction(paiement.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      <TransactionSearchDialog
        isOpen={isSearchDialogOpen}
        onClose={() => setIsSearchDialogOpen(false)}
        onSelect={handleLinkTransaction}
        excludeTransactionIds={excludedTransactionIds}
      />
    </div>
  );
};
