import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Facture } from '../../../types/Invoice';
import { InvoiceService } from '../../../services/InvoiceService';
import { PaymentTrackingService } from '../../../services/PaymentTrackingService';

export const PaiementsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [factures, setFactures] = useState<Facture[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = (await InvoiceService.loadFactures()).filter((f) => !f.supprime);
      setFactures(data);
    };
    load();
  }, []);

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.payments.title')}</h2>
      <div className="invoicing-list">
        {factures.map((facture) => {
          const status = PaymentTrackingService.getPaymentStatus(facture);
          return (
            <div key={facture.id} className="invoicing-list-item">
              <div className="name">{facture.numero}</div>
              <div className="meta">
                {status.paidAmount.toFixed(2)}€ / {status.totalTTC.toFixed(2)}€ ({status.percent.toFixed(0)}%)
              </div>
            </div>
          );
        })}
        {factures.length === 0 && <div className="invoicing-empty">{t('invoicing.payments.empty')}</div>}
      </div>
    </div>
  );
};
