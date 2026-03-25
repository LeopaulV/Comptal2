import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Devis } from '../../../types/Invoice';
import { InvoiceService } from '../../../services/InvoiceService';

export const DevisList: React.FC = () => {
  const { t } = useTranslation();
  const [devis, setDevis] = useState<Devis[]>([]);
  const [isConverting, setIsConverting] = useState<string | null>(null);
  const [appPath, setAppPath] = useState('');

  useEffect(() => {
    const load = async () => {
      const data = (await InvoiceService.loadDevis()).filter((d) => !d.supprime);
      setDevis(data);
    };
    load();
  }, []);

  useEffect(() => {
    const loadPath = async () => {
      const path = await window.electronAPI.getAppPath();
      setAppPath(path);
    };
    loadPath();
  }, []);

  const handleConvert = async (devisId: string) => {
    setIsConverting(devisId);
    await InvoiceService.convertDevisToFacture(devisId);
    const data = (await InvoiceService.loadDevis()).filter((d) => !d.supprime);
    setDevis(data);
    setIsConverting(null);
  };

  const handleDelete = async (devisId: string) => {
    await InvoiceService.softDeleteDevis(devisId);
    const data = (await InvoiceService.loadDevis()).filter((d) => !d.supprime);
    setDevis(data);
  };

  const openAttachment = (item: Devis) => {
    if (!item.attachment) return;
    const isCopy = item.attachment.mode === 'copy';
    const rawPath = isCopy
      ? (appPath ? `${appPath}/${item.attachment.path}` : item.attachment.path)
      : item.attachment.path;
    const normalized = rawPath.replace(/\\/g, '/');
    window.open(`file:///${normalized}`);
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.documents.quotesTitle')}</h2>
      <div className="invoicing-list">
        {devis.map((item) => (
          <div key={item.id} className="invoicing-list-item">
            <div className="name">{item.numero}</div>
            <div className="meta">{item.statut}</div>
            <div className="invoicing-list-item-actions">
              {item.attachment && (
                <button
                  type="button"
                  className="invoicing-icon-button"
                  onClick={() => openAttachment(item)}
                >
                  {t('invoicing.documents.openAttachment')}
                </button>
              )}
              <button
                type="button"
                className="invoicing-icon-button"
                onClick={() => handleConvert(item.id)}
                disabled={isConverting === item.id}
              >
                {t('invoicing.documents.convert')}
              </button>
              <button type="button" className="invoicing-icon-button" onClick={() => handleDelete(item.id)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
        {devis.length === 0 && <div className="invoicing-empty">{t('invoicing.documents.emptyQuotes')}</div>}
      </div>
    </div>
  );
};
