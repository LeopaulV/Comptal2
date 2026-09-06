import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ChevronDown, ChevronRight, Link2, Unlink, FileMinus } from 'lucide-react';
import { Facture, Paiement } from '../../types/invoice';
import { TransactionListRow } from '../../services/StatsService';
import { PaymentTrackingService } from '../../services/PaymentTrackingService';
import { InvoiceService } from '../../services/InvoiceService';
import { EmetteurService } from '../../services/EmetteurService';
import { PDFService } from '../../services/PDFService';
import { formatDateFr, formatMoney } from '../../utils/invoiceFormat';
import ConfirmModal from '../Common/ConfirmModal';
import PaiementFactureModal from './PaiementFactureModal';
import { Logger } from '../../services/logger';

interface RecoveryBarProps {
  paidAmount: number;
  totalAmount: number;
}

export const RecoveryBar: React.FC<RecoveryBarProps> = ({ paidAmount, totalAmount }) => {
  const percent = totalAmount > 0 ? Math.min(100, (paidAmount / totalAmount) * 100) : 0;
  return (
    <div className="invoicing-recovery-container">
      <div className="invoicing-recovery-bar-wrapper">
        <div className="invoicing-recovery-bar">
          <div className="invoicing-recovery-progress" style={{ width: `${percent}%` }} />
        </div>
        <span className="invoicing-recovery-label">
          {formatMoney(paidAmount)} / {formatMoney(totalAmount)}
        </span>
      </div>
      <span className="invoicing-recovery-percent">{percent.toFixed(0)}%</span>
    </div>
  );
};

interface GestionFactureRowProps {
  facture: Facture;
  transactionsById: Map<number, TransactionListRow>;
  clientName: string;
  onRefresh: () => Promise<void>;
  onPdf: () => void;
}

const GestionFactureRow: React.FC<GestionFactureRowProps> = ({
  facture,
  transactionsById,
  clientName,
  onRefresh,
  onPdf,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [unlinkId, setUnlinkId] = useState<string | null>(null);
  const [avoirBusy, setAvoirBusy] = useState(false);

  const paymentStatus = useMemo(() => PaymentTrackingService.getPaymentStatus(facture), [facture]);
  const remaining = paymentStatus.totalTTC - paymentStatus.paidAmount;

  const isOverdue = useMemo(() => {
    if (facture.statut === 'en_retard') return true;
    if (!facture.dateEcheance || remaining <= 0.009) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const echeance = new Date(facture.dateEcheance);
    echeance.setHours(0, 0, 0, 0);
    return echeance < today;
  }, [facture.statut, facture.dateEcheance, remaining]);

  const paymentClass =
    paymentStatus.totalTTC <= 0
      ? 'invoicing-facture-0'
      : paymentStatus.paidAmount >= paymentStatus.totalTTC
        ? 'invoicing-facture-complet'
        : paymentStatus.paidAmount > 0
          ? 'invoicing-facture-partiel'
          : 'invoicing-facture-0';

  const linked = useMemo(() => {
    return facture.paiements
      .map((paiement) => {
        const txId = paiement.transactionId ? Number(paiement.transactionId) : NaN;
        const transaction = Number.isFinite(txId) ? transactionsById.get(txId) : undefined;
        return { paiement, transaction };
      });
  }, [facture.paiements, transactionsById]);

  const handleAvoir = async () => {
    setAvoirBusy(true);
    try {
      const avoir = await InvoiceService.createAvoir(facture.id);
      const emetteur = await EmetteurService.loadEmetteurExtended();
      if (emetteur) {
        try {
          const attachment = await PDFService.generateFacturePDFToFile(avoir, emetteur);
          avoir.attachment = {
            mode: 'copy',
            path: attachment.path,
            name: attachment.name,
            mimeType: 'application/pdf',
          };
          await InvoiceService.upsertFacture(avoir);
        } catch (pdfErr) {
          Logger.error('GestionFactureRow.avoirPdf', pdfErr);
        }
      }
      await onRefresh();
    } catch (err) {
      Logger.error('GestionFactureRow.avoir', err);
      toast.error(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setAvoirBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkId) return;
    try {
      await PaymentTrackingService.unlinkPaiement(unlinkId, facture.id);
      setUnlinkId(null);
      await onRefresh();
    } catch (err) {
      Logger.error('GestionFactureRow.unlink', err);
    }
  };

  return (
    <div className="invoicing-nested">
      <div
        className={`invoicing-list-item invoicing-nested-item invoicing-facture-row ${paymentClass}${isOverdue ? ' invoicing-facture-en-retard' : ''}`}
      >
        <button type="button" className="invoicing-toggle" onClick={() => setIsOpen((v) => !v)}>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="invoicing-row-content">
          <div className="invoicing-row-main">
            <div className="invoicing-row-name">
              {facture.numero}
              {facture.isAvoir && (
                <span className="invoicing-row-intitule"> • {t('facturation.avoirBadge')}</span>
              )}
              {facture.intituleSecondaire && (
                <span className="invoicing-row-intitule"> • {facture.intituleSecondaire}</span>
              )}
              <span className="invoicing-row-meta">
                • {formatDateFr(facture.dateEmission)} • {formatMoney(facture.totalTTC)} •{' '}
                <span className={`inv-status inv-status-${facture.statut}`}>
                  {t(`facturation.status.${facture.statut}`, facture.statut)}
                </span>
              </span>
            </div>
          </div>
          <RecoveryBar paidAmount={paymentStatus.paidAmount} totalAmount={paymentStatus.totalTTC} />
        </div>
        <div className="invoicing-list-item-actions">
          {!facture.isAvoir && (
            <button type="button" className="ct-btn-secondary inv-compact-button" onClick={() => setPayOpen(true)}>
              {t('facturation.pay.addButton')}
            </button>
          )}
          {!facture.isAvoir && (
            <button
              type="button"
              className="ct-btn-secondary inv-compact-button"
              disabled={avoirBusy}
              onClick={() => void handleAvoir()}
            >
              <FileMinus size={14} /> {t('facturation.createAvoir')}
            </button>
          )}
          <button type="button" className="ct-btn-secondary inv-compact-button" onClick={onPdf}>
            PDF
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="invoicing-nested-content">
          {facture.paiements.length === 0 ? (
            <div className="invoicing-empty">{t('facturation.pay.empty')}</div>
          ) : (
            linked.map(({ paiement, transaction }) => (
              <PaiementCard
                key={paiement.id}
                paiement={paiement}
                transaction={transaction}
                onUnlink={() => setUnlinkId(paiement.id)}
              />
            ))
          )}
        </div>
      )}
      <PaiementFactureModal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        facture={facture}
        clientName={clientName}
        onSaved={onRefresh}
      />
      <ConfirmModal
        isOpen={Boolean(unlinkId)}
        title={t('facturation.pay.unlink')}
        message={t('facturation.pay.confirmUnlink')}
        onCancel={() => setUnlinkId(null)}
        onConfirm={() => void handleUnlink()}
      />
    </div>
  );
};

const PaiementCard: React.FC<{
  paiement: Paiement;
  transaction?: TransactionListRow;
  onUnlink: () => void;
}> = ({ paiement, transaction, onUnlink }) => {
  const { t } = useTranslation();
  return (
    <div className="invoicing-transaction-card">
      <div className="invoicing-transaction-header">
        <div className="invoicing-transaction-title">
          <Link2 size={14} />
          <span>
            {transaction?.label ||
              t(`facturation.pay.mode.${paiement.modePaiement}`, paiement.modePaiement)}
          </span>
        </div>
        <strong>{formatMoney(paiement.montant)}</strong>
      </div>
      <div className="invoicing-transaction-details">
        <span>{formatDateFr(paiement.datePaiement)}</span>
        {transaction?.accountCode && <span>{transaction.accountCode}</span>}
        {paiement.reference && <span>{paiement.reference}</span>}
      </div>
      <button type="button" className="invoicing-unlink-button" onClick={onUnlink}>
        <Unlink size={13} /> {t('facturation.pay.unlink')}
      </button>
    </div>
  );
};

export default GestionFactureRow;
