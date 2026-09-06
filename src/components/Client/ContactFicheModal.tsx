import React from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Banknote, FileText, Mail, Paperclip, Phone, Plus, ReceiptText } from 'lucide-react';
import { Donation } from '../../types/association';
import { Client, ContactGroupe, Devis, Facture } from '../../types/invoice';
import { PaymentTrackingService } from '../../services/PaymentTrackingService';
import { clientDisplayName, formatDateFr, formatMoney, isDevisCaduc } from '../../utils/invoiceFormat';
import WideModal from '../Common/WideModal';
import ClientForm from './ClientForm';

interface ContactFicheModalProps {
  isOpen: boolean;
  client: Client;
  groupes: ContactGroupe[];
  devis: Devis[];
  facturesByDevis: Map<string, Facture[]>;
  facturesDirect: Facture[];
  donations: Donation[];
  onClose: () => void;
  onSaveClient: (client: Client) => void;
  onCreateGroupe: (nom: string) => Promise<ContactGroupe | null>;
  onOpenDevis: (devis: Devis) => void;
  onOpenFacture: (facture: Facture) => void;
  onNewDevis: () => void;
  onNewDonation: () => void;
}

function statusBadge(t: TFunction, statut: string, caduc: boolean) {
  if (caduc) return t('facturation.status.caduc');
  if (statut === 'brouillon') return null;
  return t(`facturation.status.${statut}`, { defaultValue: statut });
}

function natureLabel(t: (key: string) => string, nature: Donation['natureDon']): string {
  if (nature === 'nature') return t('association.natureDon');
  if (nature === 'mecenat_competences') return t('association.mecenat');
  return t('association.kindCash');
}

const ContactFicheModal: React.FC<ContactFicheModalProps> = ({
  isOpen,
  client,
  groupes,
  devis,
  facturesByDevis,
  facturesDirect,
  donations,
  onClose,
  onSaveClient,
  onCreateGroupe,
  onOpenDevis,
  onOpenFacture,
  onNewDevis,
  onNewDonation,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const name = clientDisplayName(client);
  const typeLabel = client.type === 'entreprise' ? t('org.typeEntreprise') : t('org.typePart');
  const subtitle = [client.codeClient, typeLabel].filter(Boolean).join(' · ');

  return (
    <WideModal
      isOpen={isOpen}
      title={name}
      subtitle={subtitle}
      onClose={onClose}
      className="contact-fiche-modal"
      lead={(
        <span
          className="contact-fiche-avatar"
          style={client.color ? { backgroundColor: client.color, borderColor: client.color, color: '#ffffff' } : undefined}
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
      )}
    >
      <div className="contact-fiche">
        {(client.email || client.telephone) && (
          <div className="contact-fiche-chips">
            {client.email && (
              <span>
                <Mail size={13} /> {client.email}
              </span>
            )}
            {client.telephone && (
              <span>
                <Phone size={13} /> {client.telephone}
              </span>
            )}
          </div>
        )}
        <div className="contact-fiche-layout">
          <section className="contact-fiche-main">
            <ClientForm
              initial={client}
              groupes={groupes}
              embedded
              onSubmit={onSaveClient}
              onCreateGroupe={onCreateGroupe}
            />
          </section>
          <aside className="contact-fiche-side">
            <div className="contact-section-head">
              <h3 className="org-section-title">{t('clients.linkedElements')}</h3>
              <div className="contact-section-actions">
                <button type="button" className="ct-btn-secondary inv-compact-button" onClick={onNewDonation}>
                  <Plus size={14} /> {t('clients.newDonation')}
                </button>
                <button type="button" className="ct-btn-primary inv-compact-button" onClick={onNewDevis}>
                  <Plus size={14} /> {t('facturation.newDevis')}
                </button>
              </div>
            </div>
            {devis.length === 0 && facturesDirect.length === 0 && donations.length === 0 && (
              <div className="inv-empty">{t('clients.noDocumentsOrDonations')}</div>
            )}
            <div className="contact-encart-list">
              {donations.map((donation) => (
                <div key={donation.id} className="contact-encart contact-encart-static">
                  <span className="contact-encart-icon is-donation"><Banknote size={18} /></span>
                  <span className="contact-encart-body">
                    <strong>{formatMoney(donation.montant)}</strong>
                    <small>
                      {natureLabel(t, donation.natureDon)} · {formatDateFr(donation.date)}
                    </small>
                    {donation.description && <small>{donation.description}</small>}
                    {donation.receiptId ? (
                      <span className="inv-badge">{t('clients.donationReceiptIssued')}</span>
                    ) : donation.receiptEligible ? (
                      <small>{t('clients.donationReceiptPending')}</small>
                    ) : null}
                  </span>
                </div>
              ))}
              {devis.map((d) => {
                const linked = facturesByDevis.get(d.id) ?? [];
                const caduc = isDevisCaduc(d);
                const badge = statusBadge(t, d.statut, caduc);
                const signedCount = d.clientAttachments?.length ?? 0;
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`contact-encart${caduc ? ' is-caduc' : ''}`}
                    onClick={() => onOpenDevis(d)}
                  >
                    <span className="contact-encart-icon"><FileText size={18} /></span>
                    <span className="contact-encart-body">
                      <strong>{d.numero}</strong>
                      <small>
                        {t('facturation.devis')} · {formatDateFr(d.dateEmission)} · {formatMoney(d.totalTTC)}
                      </small>
                      {badge && (
                        <span className={`inv-badge${caduc ? ' inv-status-caduc' : ''}`}>{badge}</span>
                      )}
                      {linked.length > 0 && (
                        <small>
                          {linked.length} {t('facturation.factures').toLowerCase()}
                        </small>
                      )}
                      {signedCount > 0 && (
                        <small className="contact-encart-pj">
                          <Paperclip size={12} /> {signedCount} {t('clients.signedFiles')}
                        </small>
                      )}
                    </span>
                  </button>
                );
              })}
              {facturesDirect.map((f) => {
                const pay = PaymentTrackingService.getPaymentStatus(f);
                const badge = statusBadge(t, f.statut, false);
                return (
                  <button
                    key={f.id}
                    type="button"
                    className="contact-encart"
                    onClick={() => onOpenFacture(f)}
                  >
                    <span className="contact-encart-icon is-facture"><ReceiptText size={18} /></span>
                    <span className="contact-encart-body">
                      <strong>{f.numero}</strong>
                      <small>
                        {t('facturation.factures')} · {formatDateFr(f.dateEmission)} · {formatMoney(f.totalTTC)}
                      </small>
                      {badge && <span className="inv-badge">{badge}</span>}
                      <small>
                        {formatMoney(pay.paidAmount)} ({Math.round(pay.percent)}%)
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </WideModal>
  );
};

export default ContactFicheModal;
