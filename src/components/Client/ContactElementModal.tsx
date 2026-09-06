import React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Devis, Facture, PosteFacture } from '../../types/invoice';
import { InvoiceService } from '../../services/InvoiceService';
import { PaymentTrackingService } from '../../services/PaymentTrackingService';
import { formatDateFr, formatMoney, hoursToHhMm, isDevisCaduc } from '../../utils/invoiceFormat';
import WideModal from '../Common/WideModal';
import DevisSignedAttachments from '../Facturation/DevisSignedAttachments';

interface ContactElementModalProps {
  isOpen: boolean;
  clientName: string;
  devis?: Devis | null;
  facture?: Facture | null;
  linkedFactures?: Facture[];
  originDevis?: Devis | null;
  onClose: () => void;
  onOpenFacture?: (facture: Facture) => void;
  onEditDevis?: () => void;
  onFacturer?: () => void;
  onCaduc?: () => void;
  onPdf: () => void;
  onPay?: () => void;
  onEditFacture?: () => void;
  onDevisRefresh?: () => Promise<void>;
  onDevisUpdated?: (devis: Devis) => void;
}

function posteSummary(poste: PosteFacture): string {
  if (poste.type === 'travail') {
    return `${hoursToHhMm(poste.heuresEstimees)} × ${poste.tauxHoraire} €/h × ${poste.nombreIntervenants}`;
  }
  return `${poste.quantite} × ${poste.prixUnitaireHT} €`;
}

function statusBadge(t: TFunction, statut: string, caduc: boolean) {
  if (caduc) return t('facturation.status.caduc');
  if (statut === 'brouillon') return null;
  return t(`facturation.status.${statut}`, { defaultValue: statut });
}

const ContactElementModal: React.FC<ContactElementModalProps> = ({
  isOpen,
  clientName,
  devis,
  facture,
  linkedFactures = [],
  originDevis,
  onClose,
  onOpenFacture,
  onEditDevis,
  onFacturer,
  onCaduc,
  onPdf,
  onPay,
  onEditFacture,
  onDevisRefresh,
  onDevisUpdated,
}) => {
  const { t } = useTranslation();
  const doc = devis ?? facture;
  if (!isOpen || !doc) return null;
  const caduc = devis ? isDevisCaduc(devis) : false;
  const pay = facture ? PaymentTrackingService.getPaymentStatus(facture) : null;
  const badge = statusBadge(t, doc.statut, caduc);

  return (
    <WideModal
      isOpen={isOpen}
      title={`${doc.numero} — ${clientName}`}
      onClose={onClose}
      layer="stack"
      className="contact-element-modal"
    >
      <div className="contact-element">
        <div className="contact-element-meta">
          {badge && (
            <span className={`inv-badge${caduc ? ' inv-status-caduc' : ''}`}>{badge}</span>
          )}
          <span>{formatDateFr(doc.dateEmission)}</span>
          {doc.intituleSecondaire && <span>{doc.intituleSecondaire}</span>}
          {originDevis && (
            <span>
              {t('facturation.devis')} {originDevis.numero}
            </span>
          )}
        </div>
        <div className="contact-element-totals">
          <div>
            <small>HT</small>
            <strong>{formatMoney(doc.totalHT)}</strong>
          </div>
          <div>
            <small>TTC</small>
            <strong>{formatMoney(doc.totalTTC)}</strong>
          </div>
          {pay && (
            <div>
              <small>{t('facturation.pay.addButton')}</small>
              <strong>
                {formatMoney(pay.paidAmount)} ({Math.round(pay.percent)}%)
              </strong>
            </div>
          )}
        </div>

        <h3 className="org-section-title">{t('facturation.lignes')}</h3>
        {doc.postes.length === 0 && <div className="inv-empty">{t('facturation.noPostes')}</div>}
        <ul className="contact-element-postes">
          {doc.postes.map((poste) => (
            <li key={poste.id}>
              <div>
                <strong>{poste.designation || t('facturation.designation')}</strong>
                <small>
                  {poste.type === 'travail' ? t('facturation.posteTravail') : t('facturation.posteMateriel')} ·{' '}
                  {posteSummary(poste)}
                </small>
              </div>
              <span>{formatMoney(InvoiceService.calculateLineHT(poste))}</span>
            </li>
          ))}
        </ul>

        {devis && onDevisRefresh && (
          <DevisSignedAttachments
            devis={devis}
            onRefresh={onDevisRefresh}
            onUpdated={onDevisUpdated}
          />
        )}

        {devis && linkedFactures.length > 0 && (
          <>
            <h3 className="org-section-title">{t('facturation.factures')}</h3>
            <div className="contact-encart-grid">
              {linkedFactures.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="contact-encart"
                  onClick={() => onOpenFacture?.(f)}
                >
                  <span className="contact-encart-body">
                    <strong>{f.numero}</strong>
                    <small>
                      {formatDateFr(f.dateEmission)} · {formatMoney(f.totalTTC)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="contact-element-actions">
          <button type="button" className="ct-btn-secondary" onClick={onPdf}>
            PDF
          </button>
          {devis && !caduc && onEditDevis && (
            <button type="button" className="ct-btn-secondary" onClick={onEditDevis}>
              {t('common.edit')}
            </button>
          )}
          {devis && !caduc && onFacturer && (
            <button type="button" className="ct-btn-primary" onClick={onFacturer}>
              {t('facturation.toFacture')}
            </button>
          )}
          {devis && !caduc && onCaduc && (
            <button type="button" className="ct-btn-danger" onClick={onCaduc}>
              {t('facturation.caduc.action')}
            </button>
          )}
          {facture && onEditFacture && (
            <button type="button" className="ct-btn-secondary" onClick={onEditFacture}>
              {t('common.edit')}
            </button>
          )}
          {facture && onPay && (
            <button type="button" className="ct-btn-primary" onClick={onPay}>
              {t('clients.paiement')}
            </button>
          )}
        </div>
      </div>
    </WideModal>
  );
};

export default ContactElementModal;
