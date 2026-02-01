import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Facture } from '../../../types/Invoice';
import { InvoiceService } from '../../../services/InvoiceService';

export const FacturesList: React.FC = () => {
  const { t } = useTranslation();
  const [factures, setFactures] = useState<Facture[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = (await InvoiceService.loadFactures()).filter((f) => !f.supprime);
      setFactures(data);
    };
    load();
  }, []);

  const handleDelete = async (factureId: string) => {
    await InvoiceService.softDeleteFacture(factureId);
    const data = (await InvoiceService.loadFactures()).filter((f) => !f.supprime);
    setFactures(data);
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.documents.invoicesTitle')}</h2>
      <div className="invoicing-list">
        {factures.map((item) => (
          <div key={item.id} className="invoicing-list-item">
            <div className="name">{item.numero}</div>
            <div className="meta">{item.statut}</div>
            <div className="invoicing-list-item-actions">
              <button type="button" className="invoicing-icon-button" onClick={() => handleDelete(item.id)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
        {factures.length === 0 && <div className="invoicing-empty">{t('invoicing.documents.emptyInvoices')}</div>}
      </div>
    </div>
  );
};
