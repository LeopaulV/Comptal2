import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Plus, Trash2, Star, StarOff } from 'lucide-react';
import { EmetteurAccountLink } from '../../../types/Invoice';
import { AccountsConfig } from '../../../types/Account';
import { ConfigService } from '../../../services/ConfigService';

interface AccountLinkSectionProps {
  linkedAccounts: EmetteurAccountLink[];
  onChange: (accounts: EmetteurAccountLink[]) => void;
}

export const AccountLinkSection: React.FC<AccountLinkSectionProps> = ({
  linkedAccounts,
  onChange,
}) => {
  const { t } = useTranslation();
  const [availableAccounts, setAvailableAccounts] = useState<AccountsConfig>({});
  const [selectedAccountCode, setSelectedAccountCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accounts = await ConfigService.loadAccounts();
        setAvailableAccounts(accounts);
      } catch (error) {
        console.error('Erreur lors du chargement des comptes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAccounts();
  }, []);

  // Récupère les codes de comptes non liés
  const getUnlinkedAccountCodes = (): string[] => {
    const linkedCodes = linkedAccounts.map((a) => a.accountCode);
    return Object.keys(availableAccounts).filter((code) => !linkedCodes.includes(code));
  };

  const handleAddAccount = () => {
    if (!selectedAccountCode) return;

    const accountInfo = availableAccounts[selectedAccountCode];
    if (!accountInfo) return;

    const newLink: EmetteurAccountLink = {
      accountCode: selectedAccountCode,
      accountName: accountInfo.name,
      isPrimary: linkedAccounts.length === 0, // Premier compte = principal par défaut
      color: accountInfo.color,
    };

    onChange([...linkedAccounts, newLink]);
    setSelectedAccountCode('');
  };

  const handleRemoveAccount = (accountCode: string) => {
    const filtered = linkedAccounts.filter((a) => a.accountCode !== accountCode);
    
    // Si on supprime le compte principal et qu'il reste des comptes, mettre le premier comme principal
    const wasPrimary = linkedAccounts.find((a) => a.accountCode === accountCode)?.isPrimary;
    if (wasPrimary && filtered.length > 0) {
      filtered[0] = { ...filtered[0], isPrimary: true };
    }
    
    onChange(filtered);
  };

  const handleSetPrimary = (accountCode: string) => {
    const updated = linkedAccounts.map((a) => ({
      ...a,
      isPrimary: a.accountCode === accountCode,
    }));
    onChange(updated);
  };

  const unlinkedCodes = getUnlinkedAccountCodes();

  if (isLoading) {
    return (
      <div className="account-link-section">
        <div className="account-link-loading">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="account-link-section">
      <div className="account-link-header">
        <div className="account-link-title">
          <Link size={18} />
          <span>{t('invoicing.emetteur.accounts.title')}</span>
        </div>
        <span className="account-link-subtitle">
          {t('invoicing.emetteur.accounts.subtitle')}
        </span>
      </div>

      {/* Liste des comptes liés */}
      <div className="account-link-list">
        {linkedAccounts.length === 0 ? (
          <div className="account-link-empty">
            {t('invoicing.emetteur.accounts.empty')}
          </div>
        ) : (
          linkedAccounts.map((account) => (
            <div key={account.accountCode} className="account-link-item">
              <div
                className="account-link-color"
                style={{ backgroundColor: account.color }}
              />
              <div className="account-link-info">
                <span className="account-link-code">{account.accountCode}</span>
                <span className="account-link-name">{account.accountName}</span>
              </div>
              {account.isPrimary && (
                <span className="account-link-badge primary">
                  <Star size={12} />
                  {t('invoicing.emetteur.accounts.primary')}
                </span>
              )}
              <div className="account-link-actions">
                {!account.isPrimary && (
                  <button
                    type="button"
                    className="account-link-btn set-primary"
                    onClick={() => handleSetPrimary(account.accountCode)}
                    title={t('invoicing.emetteur.accounts.setPrimary')}
                  >
                    <StarOff size={16} />
                  </button>
                )}
                <button
                  type="button"
                  className="account-link-btn remove"
                  onClick={() => handleRemoveAccount(account.accountCode)}
                  title={t('invoicing.emetteur.accounts.remove')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Ajout d'un nouveau compte */}
      {unlinkedCodes.length > 0 && (
        <div className="account-link-add">
          <select
            value={selectedAccountCode}
            onChange={(e) => setSelectedAccountCode(e.target.value)}
            className="account-link-select"
          >
            <option value="">{t('invoicing.emetteur.accounts.selectAccount')}</option>
            {unlinkedCodes.map((code) => (
              <option key={code} value={code}>
                {code} - {availableAccounts[code]?.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="account-link-add-btn"
            onClick={handleAddAccount}
            disabled={!selectedAccountCode}
          >
            <Plus size={16} />
            {t('invoicing.emetteur.accounts.add')}
          </button>
        </div>
      )}

      {unlinkedCodes.length === 0 && linkedAccounts.length > 0 && (
        <div className="account-link-all-linked">
          {t('invoicing.emetteur.accounts.allLinked')}
        </div>
      )}
    </div>
  );
};
