import React, { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '../Common/Modal';
import SignaturePad from '../Common/SignaturePad';
import { AssociationConfig, Donation } from '../../types/association';
import { Client } from '../../types/invoice';
import { clientDisplayName, formatMoney } from '../../utils/invoiceFormat';

export interface ReceiptSignaturePayload {
  imageDataUrl: string;
  signedAt: string;
}

interface ReceiptSignatureModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  donations: Donation[];
  donors: Client[];
  config: AssociationConfig | null;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (signature: ReceiptSignaturePayload | null, remember: boolean) => void;
}

const ReceiptSignatureModal: React.FC<ReceiptSignatureModalProps> = ({
  isOpen,
  title,
  message,
  donations,
  donors,
  config,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [applySignature, setApplySignature] = useState(true);
  const [remember, setRemember] = useState(true);
  const [drawn, setDrawn] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setApplySignature(true);
    setRemember(true);
    setDrawn(config?.signataireSignature ?? null);
  }, [isOpen, config?.signataireSignature]);

  const image = drawn || config?.signataireSignature || null;
  const signatory = [config?.signataireNom, config?.signataireQualite].filter(Boolean).join(' — ')
    || t('association.legalRep');

  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel} maxWidth="680px">
      <div className="donation-sign-modal">
        <p>{message}</p>
        {donations.length > 0 && (
          <ul className="donation-sign-list">
            {donations.slice(0, 8).map((donation) => {
              const donor = donors.find((item) => item.id === donation.contactId);
              return (
                <li key={donation.id}>
                  <strong>{donor ? clientDisplayName(donor) : donation.donorLabel || t('association.defaultDonor')}</strong>
                  <span>{formatMoney(donation.montant)}</span>
                </li>
              );
            })}
            {donations.length > 8 && <li>{t('association.andOthers', { count: donations.length - 8 })}</li>}
          </ul>
        )}
        <label className="donation-check">
          <input type="checkbox" checked={applySignature} onChange={(e) => setApplySignature(e.target.checked)} />
          {t('association.applyPresidentSignature')}
        </label>
        {applySignature && (
          <>
            <p className="donation-legal-hint">
              {t('association.signatureLegalHint', { name: signatory })}
            </p>
            <div className="donation-sign-head">
              <PenLine size={15} />
              <span>{t('association.signBelow')}</span>
            </div>
            <SignaturePad value={image} onChange={setDrawn} />
            <label className="donation-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              {t('association.rememberSignature')}
            </label>
          </>
        )}
        <div className="donation-form-actions">
          <button type="button" className="ct-btn-secondary" disabled={busy} onClick={onCancel}>{t('common.cancel')}</button>
          <button
            type="button"
            className="ct-btn-primary"
            disabled={busy || (applySignature && !image)}
            onClick={() => onConfirm(
              applySignature && image
                ? { imageDataUrl: image, signedAt: new Date().toISOString() }
                : null,
              applySignature && remember
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ReceiptSignatureModal;
