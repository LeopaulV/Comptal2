import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PenLine } from 'lucide-react';
import Modal from '../Common/Modal';

interface CaducDevisModalProps {
  isOpen: boolean;
  numero: string;
  onCancel: () => void;
  onConfirm: (payload: { signedBy: string; reason?: string }) => Promise<void> | void;
}

const CaducDevisModal: React.FC<CaducDevisModalProps> = ({ isOpen, numero, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const [signedBy, setSignedBy] = useState('');
  const [reason, setReason] = useState('');
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setSignedBy('');
    setReason('');
    setAck(false);
    setError('');
    setSaving(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleConfirm = async () => {
    if (signedBy.trim().length < 2) {
      setError(t('facturation.caduc.signatureRequired'));
      return;
    }
    if (!ack) {
      setError(t('facturation.caduc.ackRequired'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onConfirm({ signedBy: signedBy.trim(), reason: reason.trim() || undefined });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title={t('facturation.caduc.title')} onClose={handleCancel} maxWidth="560px">
      <div className="inv-caduc-form">
        <p>
          {t('facturation.caduc.intro', { numero })}
        </p>
        <label className="org-field">
          <span>
            <PenLine size={14} /> {t('facturation.caduc.signature')}
          </span>
          <input
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            placeholder={t('facturation.caduc.signaturePlaceholder')}
            autoComplete="name"
          />
        </label>
        <label className="org-field">
          <span>{t('facturation.caduc.reason')}</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('facturation.caduc.reasonPlaceholder')}
          />
        </label>
        <label className="inv-caduc-ack">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>{t('facturation.caduc.ack')}</span>
        </label>
        {error && <div className="paiement-facture-error">{error}</div>}
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className="ct-btn-secondary" onClick={handleCancel} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="button" className="ct-btn-danger" onClick={() => void handleConfirm()} disabled={saving}>
            {t('facturation.caduc.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CaducDevisModal;
