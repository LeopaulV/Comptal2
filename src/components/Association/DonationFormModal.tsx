import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import WideModal from '../Common/WideModal';
import { DonationService } from '../../services/DonationService';
import { Logger } from '../../services/logger';
import { ModeVersement, NatureDon } from '../../types/association';
import { Client } from '../../types/invoice';
import { clientDisplayName } from '../../utils/invoiceFormat';
import '../../styles/association-custom.css';
import '../../styles/organization-custom.css';

const TODAY = new Date().toISOString().slice(0, 10);

export interface DonationFormValues {
  contactId: string;
  anonymous: boolean;
  donorLabel: string;
  natureDon: NatureDon;
  modeVersement: ModeVersement;
  montant: string;
  date: string;
  description: string;
  valuationMethod: string;
  valuationProvidedByDonor: boolean;
  receiptEligible: boolean;
  notes: string;
}

const emptyForm = (contactId = ''): DonationFormValues => ({
  contactId,
  anonymous: false,
  donorLabel: '',
  natureDon: 'numeraire',
  modeVersement: 'especes',
  montant: '',
  date: TODAY,
  description: '',
  valuationMethod: '',
  valuationProvidedByDonor: false,
  receiptEligible: true,
  notes: '',
});

interface DonationFormModalProps {
  isOpen: boolean;
  donors: Client[];
  /** Si défini, le contact est pré-sélectionné et figé. */
  lockedContactId?: string | null;
  title?: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const DonationFormModal: React.FC<DonationFormModalProps> = ({
  isOpen,
  donors,
  lockedContactId,
  title,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<DonationFormValues>(emptyForm());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyForm(lockedContactId ?? ''));
    setBusy(false);
  }, [isOpen, lockedContactId]);

  const save = async () => {
    const montant = Number(form.montant.replace(',', '.'));
    if (!Number.isFinite(montant) || montant <= 0) {
      toast.error(t('association.invalidAmount'));
      return;
    }
    const contactId = lockedContactId || form.contactId;
    setBusy(true);
    try {
      if (!form.anonymous && contactId) {
        await DonationService.ensureDonorRole(contactId);
      }
      await DonationService.save({
        contactId: form.anonymous ? null : contactId || null,
        anonymous: form.anonymous,
        donorLabel: form.donorLabel,
        natureDon: form.natureDon,
        modeVersement: form.modeVersement,
        montant,
        date: form.date,
        datePerception: form.date,
        description: form.description,
        valuationMethod: form.valuationMethod,
        valuationProvidedByDonor: form.valuationProvidedByDonor,
        receiptEligible: form.receiptEligible,
        notes: form.notes,
      });
      toast.success(t('association.saved'));
      await onSaved();
      onClose();
    } catch (error) {
      Logger.error('DonationFormModal.save', error);
      toast.error(error instanceof Error ? error.message : t('association.saveFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <WideModal isOpen={isOpen} title={title ?? t('association.formTitle')} onClose={onClose}>
      <div className="donation-form">
        <div className="donation-kind-picker">
          {([
            ['numeraire', t('association.kindCash'), t('association.kindCashHint')],
            ['nature', t('association.natureDon'), t('association.kindNatureHint')],
            ['mecenat_competences', t('association.mecenat'), t('association.kindSkillsHint')],
          ] as const).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              className={form.natureDon === value ? 'active' : ''}
              onClick={() => setForm({ ...form, natureDon: value })}
            >
              <strong>{label}</strong>
              <small>{hint}</small>
            </button>
          ))}
        </div>
        <div className="org-grid">
          {!lockedContactId && (
            <label className="org-field full donation-check">
              <input
                type="checkbox"
                checked={form.anonymous}
                onChange={(event) => setForm({
                  ...form,
                  anonymous: event.target.checked,
                  receiptEligible: event.target.checked ? false : form.receiptEligible,
                })}
              />
              {t('association.anonymousCheck')}
            </label>
          )}
          {!form.anonymous ? (
            lockedContactId ? (
              <label className="org-field">
                <span>{t('association.donorContact')}</span>
                <input
                  value={(() => {
                    const donor = donors.find((d) => d.id === lockedContactId);
                    return donor ? clientDisplayName(donor) : lockedContactId;
                  })()}
                  disabled
                  readOnly
                />
              </label>
            ) : (
              <label className="org-field">
                <span>{t('association.donorContact')}</span>
                <select
                  value={form.contactId}
                  onChange={(event) => setForm({ ...form, contactId: event.target.value })}
                >
                  <option value="">{t('common.choose')}</option>
                  {donors.map((donor) => (
                    <option key={donor.id} value={donor.id}>{clientDisplayName(donor)}</option>
                  ))}
                </select>
              </label>
            )
          ) : (
            <label className="org-field">
              <span>{t('association.optionalInternalLabel')}</span>
              <input
                value={form.donorLabel}
                onChange={(event) => setForm({ ...form, donorLabel: event.target.value })}
                placeholder={t('association.internalLabelPh')}
              />
            </label>
          )}
          <label className="org-field">
            <span>{form.natureDon === 'numeraire' ? t('association.montant') : t('association.communicatedValuation')}</span>
            <input
              inputMode="decimal"
              value={form.montant}
              onChange={(event) => setForm({ ...form, montant: event.target.value })}
            />
          </label>
          <label className="org-field">
            <span>{t('association.perceptionDate')}</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </label>
          {form.natureDon === 'numeraire' ? (
            <label className="org-field">
              <span>{t('association.paymentMode')}</span>
              <select
                value={form.modeVersement}
                onChange={(event) => setForm({ ...form, modeVersement: event.target.value as ModeVersement })}
              >
                <option value="especes">{t('association.mode.especes')}</option>
                <option value="cheque">{t('association.mode.cheque')}</option>
                <option value="virement">{t('association.mode.virement')}</option>
                <option value="cb">{t('association.mode.cb')}</option>
                <option value="prelevement">{t('association.mode.prelevement')}</option>
                <option value="autre">{t('association.mode.autre')}</option>
              </select>
            </label>
          ) : (
            <label className="org-field">
              <span>{t('association.valuationMethod')}</span>
              <input
                value={form.valuationMethod}
                onChange={(event) => setForm({ ...form, valuationMethod: event.target.value })}
                placeholder={t('association.valuationMethodPh')}
              />
            </label>
          )}
          <label className="org-field full">
            <span>{form.natureDon !== 'numeraire' ? t('association.descriptionDetailed') : t('common.description')}</span>
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          {form.natureDon !== 'numeraire' && (
            <label className="org-field full donation-check">
              <input
                type="checkbox"
                checked={form.valuationProvidedByDonor}
                onChange={(event) => setForm({ ...form, valuationProvidedByDonor: event.target.checked })}
              />
              {t('association.valuationByDonor')}
            </label>
          )}
          {!form.anonymous && (
            <label className="org-field full donation-check">
              <input
                type="checkbox"
                checked={form.receiptEligible}
                onChange={(event) => setForm({ ...form, receiptEligible: event.target.checked })}
              />
              {t('association.receiptEligible')}
            </label>
          )}
          <label className="org-field full">
            <span>{t('association.internalNotes')}</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
        </div>
        <div className="donation-legal-hint">
          {form.natureDon === 'numeraire'
            ? t('association.legalCash')
            : t('association.legalValuation')}
        </div>
        <div className="donation-form-actions">
          <button type="button" className="ct-btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="ct-btn-primary" disabled={busy} onClick={() => void save()}>
            {t('association.saveDonation')}
          </button>
        </div>
      </div>
    </WideModal>
  );
};

export default DonationFormModal;
