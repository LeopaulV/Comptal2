import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatsCarousel } from '../../components/Invoicing/StatsCarousel';
import { InvoicingMenu, InvoicingTab } from '../../components/Invoicing/InvoicingMenu';
import { EmetteurSplitView } from '../../components/Invoicing/Parametres/EmetteurSplitView';
import { GestionPanel } from '../../components/Invoicing/Gestion/GestionPanel';
import { PostesPanel } from '../../components/Invoicing/Postes/PostesPanel';
import { InvoiceService } from '../../services/InvoiceService';
import { DataService } from '../../services/DataService';
import { Facture } from '../../types/Invoice';
import { Transaction } from '../../types/Transaction';
import '../../styles/invoicing-custom.css';

const Invoicing: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<InvoicingTab>('gestion');
  const [factures, setFactures] = useState<Facture[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const loadInvoicingData = React.useCallback(async () => {
    const [loadedFactures, loadedTransactions] = await Promise.all([
      InvoiceService.loadFactures(),
      DataService.getTransactions(),
    ]);
    setFactures(loadedFactures.filter((f) => !f.supprime));
    setTransactions(loadedTransactions);
  }, []);

  useEffect(() => {
    loadInvoicingData();
  }, [loadInvoicingData]);

  return (
    <div className="invoicing-page">
      <InvoicingMenu activeTab={activeTab} onChangeTab={setActiveTab} />
      <div className="invoicing-content">
        <div className="invoicing-header">
          <h1 className="invoicing-title">{t('invoicing.title')}</h1>
        </div>
        <StatsCarousel factures={factures} transactions={transactions} />
        <div className="invoicing-main">
          {activeTab === 'parametres' && <EmetteurSplitView />}
          {activeTab === 'gestion' && <GestionPanel onDataChange={loadInvoicingData} />}
          {activeTab === 'postes' && <PostesPanel />}
        </div>
      </div>
    </div>
  );
};

export default Invoicing;
