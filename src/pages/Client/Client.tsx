import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import ClientTree from '../../components/Client/ClientTree';
import '../../styles/client-custom.css';
import '../../styles/organization-custom.css';

const ClientPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="inv-page">
      <header className="inv-page-header">
        <span className="inv-page-header-icon"><Users size={23} /></span>
        <div>
          <h1 data-tour="page-intro-anchor">{t('pages.clients')}</h1>
          <p>{t('clients.pageHint')}</p>
        </div>
      </header>
      <ClientTree />
    </div>
  );
};

export default ClientPage;
