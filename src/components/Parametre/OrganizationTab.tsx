import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpenCheck, Building2, FileText, HeartHandshake, Receipt, ShieldCheck } from 'lucide-react';
import IdentityCompanyPanel from './IdentityCompanyPanel';
import IdentityAssociationPanel from './IdentityAssociationPanel';
import PdfDocumentsPanel from './PdfDocumentsPanel';
import RegisterSettingsPanel from './RegisterSettingsPanel';
import { SettingsService } from '../../services/SettingsService';
import { MenuVisibility } from '../../types/settings';
import '../../styles/organization-custom.css';
import '../../styles/facturation-custom.css';

type OrgTab = 'company' | 'pdfInvoices' | 'association' | 'pdfReceipts' | 'registers';

const OrganizationTab: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<OrgTab>('company');
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibility>(
    () => SettingsService.current.menuVisibility
  );

  useEffect(
    () => SettingsService.subscribe((settings) => setMenuVisibility(settings.menuVisibility)),
    []
  );

  const items = useMemo(
    () =>
      (
        [
          { id: 'company' as const, icon: <Building2 size={16} />, label: t('org.identityCompany') },
          {
            id: 'pdfInvoices' as const,
            icon: <FileText size={16} />,
            label: t('org.pdfInvoices'),
            visible: menuVisibility.invoicing,
          },
          {
            id: 'association' as const,
            icon: <HeartHandshake size={16} />,
            label: t('org.identityAsso'),
            visible: menuVisibility.association,
          },
          {
            id: 'pdfReceipts' as const,
            icon: <Receipt size={16} />,
            label: t('org.pdfReceipts'),
            visible: menuVisibility.association,
          },
          {
            id: 'registers' as const,
            icon: <BookOpenCheck size={16} />,
            label: t('register.settings.title'),
            visible: menuVisibility.register,
          },
        ] as Array<{ id: OrgTab; icon: React.ReactNode; label: string; visible?: boolean }>
      ).filter((item) => item.visible !== false),
    [menuVisibility.association, menuVisibility.invoicing, menuVisibility.register, t]
  );

  useEffect(() => {
    if (!items.some((item) => item.id === tab)) {
      setTab('company');
    }
  }, [items, tab]);

  return (
    <div className="organization-workspace">
      <header className="organization-hero">
        <div className="organization-hero-icon"><Building2 size={24} /></div>
        <div>
          <span>{t('org.workspaceEyebrow')}</span>
          <h2>{t('org.workspaceTitle')}</h2>
          <p>{t('org.workspaceHint')}</p>
        </div>
        <div className="organization-hero-status">
          <ShieldCheck size={17} />
          {t('org.profileScoped')}
        </div>
      </header>
      <div className="organization-tabs" role="tablist">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            <span>{item.icon}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>
      <div className="organization-content">
        {tab === 'company' && <IdentityCompanyPanel />}
        {tab === 'pdfInvoices' && menuVisibility.invoicing && <PdfDocumentsPanel mode="invoices" />}
        {tab === 'association' && menuVisibility.association && <IdentityAssociationPanel />}
        {tab === 'pdfReceipts' && menuVisibility.association && (
          <PdfDocumentsPanel mode="receipts" />
        )}
        {tab === 'registers' && menuVisibility.register && <RegisterSettingsPanel />}
      </div>
    </div>
  );
};

export default OrganizationTab;
