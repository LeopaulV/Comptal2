import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Facture, Paiement } from '../../../types/Invoice';
import { Transaction } from '../../../types/Transaction';
import { formatCurrency, formatDate } from '../../../utils/format';
import { LinkedTransactionCard } from './LinkedTransactionCard';
import { ManualPaiementCard } from './ManualPaiementCard';
import { PaiementFactureModal } from '../Paiements/PaiementFactureModal';
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
  clientName: string;
  onDeleteFacture?: () => void;
  onRefresh?: () => Promise<void>;
}

export const FactureRow: React.FC<FactureRowProps> = ({ facture, transactionsById, clientName, onDeleteFacture, onRefresh }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  const linkedTransactionsWithPaiements = useMemo(() => {
    return facture.paiements
      .map((paiement) => {
        const transaction = paiement.transactionId ? transactionsById.get(paiement.transactionId) : undefined;
        return transaction ? { transaction, paiement } : null;
      })
      .filter((item): item is { transaction: Transaction; paiement: Paiement } => Boolean(item));
  }, [facture.paiements, transactionsById]);

  const manualPaiements = useMemo(() => {
    return facture.paiements.filter((p) => !p.transactionId);
  }, [facture.paiements]);

  const paymentStatus = useMemo(
    () => PaymentTrackingService.getPaymentStatus(facture),
    [facture]
  );

  const isOverdue = useMemo(() => {
    if (facture.statut === 'en_retard') return true;
    if (!facture.dateEcheance || paymentStatus.paidAmount >= paymentStatus.totalTTC) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const echeance = new Date(facture.dateEcheance);
    echeance.setHours(0, 0, 0, 0);
    return echeance < today;
  }, [facture.statut, facture.dateEcheance, paymentStatus.paidAmount, paymentStatus.totalTTC]);

  const paymentCompletionClass =
    paymentStatus.totalTTC <= 0
      ? 'invoicing-facture-0'
      : paymentStatus.paidAmount >= paymentStatus.totalTTC
        ? 'invoicing-facture-complet'
        : paymentStatus.paidAmount > 0
          ? 'invoicing-facture-partiel'
          : 'invoicing-facture-0';

  const postesTitles = facture.postes.map((p) => p.designation).filter(Boolean).join(', ');
  const marges = facture.postes
    .map((p) => (p as { marge?: number }).marge)
    .filter((m): m is number => m != null && !Number.isNaN(m));
  const tauxMarge = marges.length > 0 ? (marges.reduce((a, b) => a + b, 0) / marges.length).toFixed(1) : null;

  const handleRemovePaiement = async (paiementId: string) => {
    try {
      await PaymentTrackingService.unlinkTransactionFromInvoice(paiementId, facture.id);
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du paiement:', error);
    }
  };

  return (
    <div className="invoicing-nested">
      <div
        className={`invoicing-list-item invoicing-nested-item invoicing-facture-row ${paymentCompletionClass}${isOverdue ? ' invoicing-facture-en-retard' : ''}`}
      >
        <ChevronToggle isOpen={isOpen} onClick={() => setIsOpen((prev) => !prev)} />
        <div className="invoicing-row-content">
          <div className="invoicing-row-main">
            <div className="invoicing-row-name">
              {facture.numero}
              {facture.intituleSecondaire && (
                <span className="invoicing-row-intitule"> • {facture.intituleSecondaire}</span>
              )}
              <span className="invoicing-row-meta">
                • {formatDate(facture.dateEmission)} • {formatCurrency(facture.totalTTC)} •{' '}
                <span className={`invoicing-status-badge ${facture.statut}`}>
                  {t(`invoicing.gestion.status.${facture.statut}`)}
                </span>
              </span>
            </div>
            {(facture.dateEcheance || postesTitles || tauxMarge) && (
              <div className="invoicing-row-extra-inline">
                {facture.dateEcheance && (
                  <span>
                    {t('invoicing.gestion.dateEcheance')}: {formatDate(facture.dateEcheance)}
                  </span>
                )}
                {postesTitles && (
                  <span title={postesTitles}>
                    {t('invoicing.gestion.postes')}: {postesTitles.length > 40 ? `${postesTitles.slice(0, 40)}…` : postesTitles}
                  </span>
                )}
                {tauxMarge != null && (
                  <span>
                    {t('invoicing.gestion.tauxMarge')}: {tauxMarge}%
                  </span>
                )}
              </div>
            )}
          </div>
          <RecoveryBar paidAmount={paymentStatus.paidAmount} totalAmount={paymentStatus.totalTTC} />
        </div>
        {onDeleteFacture && (
          <div className="invoicing-list-item-actions">
            <button type="button" className="secondary danger" onClick={onDeleteFacture}>
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
            <div className="invoicing-transaction-section-header">
              <button
                type="button"
                className="invoicing-link-button"
                onClick={() => setIsPaiementModalOpen(true)}
              >
                <span>+</span>
                <span>{t('invoicing.paiementModal.addButton', 'Enregistrer un paiement')}</span>
              </button>
              {facture.paiements.length > 0 && (
                <div className="invoicing-transaction-total">
                  {t('invoicing.gestion.totalEncaisse', 'Total encaissé')} :{' '}
                  <strong>{paymentStatus.paidAmount.toFixed(2)} €</strong>
                </div>
              )}
            </div>

            {facture.paiements.length === 0 ? (
              <div className="invoicing-empty">{t('invoicing.gestion.emptyPaiements', 'Aucun paiement enregistré')}</div>
            ) : (
              <>
                {linkedTransactionsWithPaiements.map(({ transaction, paiement }) => (
                  <LinkedTransactionCard
                    key={paiement.id}
                    transaction={transaction}
                    paiement={paiement}
                    onUnlink={() => handleRemovePaiement(paiement.id)}
                  />
                ))}
                {manualPaiements.map((paiement) => (
                  <ManualPaiementCard
                    key={paiement.id}
                    paiement={paiement}
                    onRemove={() => handleRemovePaiement(paiement.id)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <PaiementFactureModal
        isOpen={isPaiementModalOpen}
        onClose={() => setIsPaiementModalOpen(false)}
        facture={facture}
        clientName={clientName}
        onSaved={async () => {
          if (onRefresh) await onRefresh();
        }}
      />
    </div>
  );
};
