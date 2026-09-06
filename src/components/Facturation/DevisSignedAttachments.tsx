import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Paperclip, Trash2 } from 'lucide-react';
import { Devis, DevisAttachment } from '../../types/invoice';
import { AttachmentService } from '../../services/AttachmentService';
import { InvoiceService } from '../../services/InvoiceService';
import { Logger } from '../../services/logger';

interface DevisSignedAttachmentsProps {
  devis: Devis;
  onUpdated?: (devis: Devis) => void;
  onRefresh: () => Promise<void>;
}

const ACCEPT = '.pdf,image/*,.png,.jpg,.jpeg,.webp';

const DevisSignedAttachments: React.FC<DevisSignedAttachmentsProps> = ({
  devis,
  onUpdated,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const signed = devis.clientAttachments ?? [];

  const persist = async (updated: Devis) => {
    onUpdated?.(updated);
    await onRefresh();
  };

  const attach = async (file: File) => {
    try {
      const updated = await InvoiceService.addClientAttachment(devis, file);
      toast.success(t('common.success'));
      await persist(updated);
    } catch (err) {
      Logger.error('DevisSignedAttachments.attach', err);
      toast.error(t('clients.attachmentSaveError'));
    }
  };

  const remove = async (item: DevisAttachment) => {
    try {
      const updated = await InvoiceService.removeClientAttachment(devis, item.path);
      await persist(updated);
    } catch (err) {
      Logger.error('DevisSignedAttachments.remove', err);
      toast.error(t('common.error'));
    }
  };

  const open = (item: DevisAttachment) => {
    void AttachmentService.openRel(item.path).catch((err) => {
      Logger.error('DevisSignedAttachments.open', err);
      toast.error(t('common.error'));
    });
  };

  return (
    <section className="contact-signed-block" title={t('clients.signedAttachmentsHint')}>
      <span className="contact-signed-label">
        <Paperclip size={14} />
        {t('clients.signedAttachments')}
      </span>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void attach(file);
        }}
      />
      {signed.length > 0 && (
        <ul className="contact-signed-list">
          {signed.map((item) => (
            <li key={item.path}>
              <button type="button" className="contact-signed-open" onClick={() => open(item)}>
                <span>{item.name}</span>
              </button>
              <button
                type="button"
                className="ct-btn-danger inv-icon-button"
                title={t('common.delete')}
                onClick={() => void remove(item)}
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="ct-btn-secondary inv-compact-button"
        title={t('clients.signedAttachmentsHint')}
        onClick={() => fileRef.current?.click()}
      >
        <Paperclip size={14} /> {t('clients.addSignedFile')}
      </button>
    </section>
  );
};

export default DevisSignedAttachments;

export function DevisAttachButton({
  devis,
  onUpdated,
  onRefresh,
}: DevisSignedAttachmentsProps) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const count = devis.clientAttachments?.length ?? 0;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void InvoiceService.addClientAttachment(devis, file)
            .then(async (updated) => {
              toast.success(t('common.success'));
              onUpdated?.(updated);
              await onRefresh();
            })
            .catch((err) => {
              Logger.error('DevisAttachButton.attach', err);
              toast.error(t('clients.attachmentSaveError'));
            });
        }}
      />
      <button
        type="button"
        className="ct-btn-secondary inv-icon-button"
        title={t('clients.addSignedFile')}
        onClick={(e) => {
          e.stopPropagation();
          fileRef.current?.click();
        }}
      >
        <Paperclip size={15} />
        {count > 0 && <span className="inv-attach-count">{count}</span>}
      </button>
    </>
  );
}
