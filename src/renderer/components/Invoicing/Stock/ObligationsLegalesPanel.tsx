import React from 'react';
import { useTranslation } from 'react-i18next';

export const ObligationsLegalesPanel: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="invoicing-card" style={{ marginTop: 16 }}>
      <h3>{t('invoicing.stock.legalTitle')}</h3>
      <ul style={{ marginTop: 12, paddingLeft: 20, display: 'grid', gap: 8 }}>
        <li>{t('invoicing.stock.legalInventory')}</li>
        <li>{t('invoicing.stock.legalAmortissement')}</li>
        <li>{t('invoicing.stock.legalAnnexe')}</li>
        <li>{t('invoicing.stock.legalValorisation')}</li>
        <li>{t('invoicing.stock.legalFactureElectronique')}</li>
      </ul>
    </div>
  );
};
