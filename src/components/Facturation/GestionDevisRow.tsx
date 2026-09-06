import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Eye, FileWarning } from 'lucide-react';
import { Devis, Facture } from '../../types/invoice';
import { TransactionListRow } from '../../services/StatsService';
import { formatDateFr, formatMoney, isDevisCaduc } from '../../utils/invoiceFormat';
import GestionFactureRow, { RecoveryBar } from './GestionFactureRow';
import CaducDevisModal from './CaducDevisModal';
import DevisSignedAttachments, { DevisAttachButton } from './DevisSignedAttachments';
import { InvoiceService } from '../../services/InvoiceService';
import { Logger } from '../../services/logger';
import { toast } from 'react-toastify';

interface GestionDevisRowProps {
  devis: Devis;
  factures: Facture[];
  transactionsById: Map<number, TransactionListRow>;
  clientName: string;
  onAddFacture: () => void;
  onEditDevis: () => void;
  onRefresh: () => Promise<void>;
  onPdf: () => void;
  onPdfFacture: (facture: Facture) => void;
}

const GestionDevisRow: React.FC<GestionDevisRowProps> = ({
  devis,
  factures,
  transactionsById,
  clientName,
  onAddFacture,
  onEditDevis,
  onRefresh,
  onPdf,
  onPdfFacture,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [caducOpen, setCaducOpen] = useState(false);
  const caduc = isDevisCaduc(devis);

  const totalPaid = factures.reduce(
    (sum, facture) => sum + facture.paiements.reduce((s, p) => s + p.montant, 0),
    0
  );
  const completionRate = devis.totalTTC > 0 ? (totalPaid / devis.totalTTC) * 100 : 0;
  const devisClass =
    caduc
      ? 'invoicing-devis-caduc'
      : completionRate >= 100
        ? 'invoicing-devis-complet'
        : completionRate > 0
          ? 'invoicing-devis-partiel'
          : 'invoicing-devis-0';

  const caducLabel = useMemo(() => {
    if (!devis.caducite) return null;
    return t('facturation.caduc.signedMeta', {
      name: devis.caducite.signedBy,
      date: formatDateFr(devis.caducite.signedAt),
    });
  }, [devis.caducite, t]);

  const handleCaduc = async (payload: { signedBy: string; reason?: string }) => {
    try {
      await InvoiceService.markDevisCaduc(devis.id, payload);
      toast.success(t('facturation.caduc.done'));
      setCaducOpen(false);
      await onRefresh();
    } catch (err) {
      Logger.error('GestionDevisRow.caduc', err);
      throw err;
    }
  };

  return (
    <div className="invoicing-nested">
      <div className={`invoicing-list-item invoicing-nested-item invoicing-devis-row ${devisClass}`}>
        <button type="button" className="invoicing-toggle" onClick={() => setIsOpen((v) => !v)}>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="invoicing-row-content">
          <div className="invoicing-row-main">
            <div className={`invoicing-row-name${caduc ? ' is-caduc' : ''}`}>
              {devis.numero}
              {devis.intituleSecondaire && (
                <span className="invoicing-row-intitule"> • {devis.intituleSecondaire}</span>
              )}
              {caduc && (
                <span className="inv-status inv-status-caduc">{t('facturation.status.caduc')}</span>
              )}
              <span className="invoicing-row-meta">
                • {formatDateFr(devis.dateEmission)} • {formatMoney(devis.totalTTC)}
              </span>
            </div>
            {caducLabel && <div className="invoicing-row-extra-inline">{caducLabel}</div>}
          </div>
          {!caduc && <RecoveryBar paidAmount={totalPaid} totalAmount={devis.totalTTC} />}
        </div>
        <div className="invoicing-list-item-actions">
          {!caduc && (
            <button type="button" className="ct-btn-primary inv-compact-button" onClick={onAddFacture}>
              {t('facturation.toFacture')}
            </button>
          )}
          {!caduc && (
            <button type="button" className="ct-btn-secondary inv-compact-button" onClick={onEditDevis}>
              {t('common.edit')}
            </button>
          )}
          <button type="button" className="ct-btn-secondary inv-icon-button" title={t('facturation.openPdf')} onClick={onPdf}>
            <Eye size={15} />
          </button>
          <DevisAttachButton devis={devis} onRefresh={onRefresh} />
          {!caduc && (
            <button
              type="button"
              className="ct-btn-danger inv-compact-button"
              onClick={() => setCaducOpen(true)}
              title={t('facturation.caduc.actionHint')}
            >
              <FileWarning size={14} /> {t('facturation.caduc.action')}
            </button>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="invoicing-nested-content">
          <DevisSignedAttachments devis={devis} onRefresh={onRefresh} />
          {factures.length === 0 && <div className="invoicing-empty">{t('facturation.emptyFactures')}</div>}
          {factures.map((facture) => (
            <GestionFactureRow
              key={facture.id}
              facture={facture}
              transactionsById={transactionsById}
              clientName={clientName}
              onRefresh={onRefresh}
              onPdf={() => onPdfFacture(facture)}
            />
          ))}
        </div>
      )}
      <CaducDevisModal
        isOpen={caducOpen}
        numero={devis.numero}
        onCancel={() => setCaducOpen(false)}
        onConfirm={handleCaduc}
      />
    </div>
  );
};

export default GestionDevisRow;
