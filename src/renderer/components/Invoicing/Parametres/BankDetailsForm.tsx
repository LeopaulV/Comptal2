import React from 'react';
import { useTranslation } from 'react-i18next';

interface BankDetailsFormProps {
  value?: {
    titulaire: string;
    iban: string;
    bic: string;
    banque?: string;
  };
  onChange: (value: BankDetailsFormProps['value']) => void;
}

export const BankDetailsForm: React.FC<BankDetailsFormProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const current = value || { titulaire: '', iban: '', bic: '', banque: '' };

  return (
    <div className="invoicing-form-section">
      <h3>{t('invoicing.settings.bankDetails')}</h3>
      <div className="invoicing-form-grid">
        <label>
          {t('invoicing.settings.bankHolder')}
          <input
            type="text"
            value={current.titulaire}
            onChange={(e) => onChange({ ...current, titulaire: e.target.value })}
          />
        </label>
        <label>
          IBAN
          <input
            type="text"
            value={current.iban}
            onChange={(e) => onChange({ ...current, iban: e.target.value })}
          />
        </label>
        <label>
          BIC
          <input
            type="text"
            value={current.bic}
            onChange={(e) => onChange({ ...current, bic: e.target.value })}
          />
        </label>
        <label>
          {t('invoicing.settings.bankName')}
          <input
            type="text"
            value={current.banque || ''}
            onChange={(e) => onChange({ ...current, banque: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
};
