import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StatsCarousel } from '../../components/Invoicing/StatsCarousel';
import { InvoicingMenu, InvoicingTab } from '../../components/Invoicing/InvoicingMenu';
import { EmetteurSplitView } from '../../components/Invoicing/Parametres/EmetteurSplitView';
import { GestionPanel } from '../../components/Invoicing/Gestion/GestionPanel';
import { PostesPanel } from '../../components/Invoicing/Postes/PostesPanel';
import { PostesEntreprisePanel } from '../../components/Invoicing/Charges/PostesEntreprisePanel';
import { StockAchatPanel } from '../../components/Invoicing/Stock/StockAchatPanel';
import { RegistreEntreprisePanel } from '../../components/Invoicing/Charges/RegistreEntreprisePanel';
import { InvoiceService } from '../../services/InvoiceService';
import { DataService } from '../../services/DataService';
import { ConfigService } from '../../services/ConfigService';
import { EmetteurService } from '../../services/EmetteurService';
import { StockService } from '../../services/StockService';
import { Devis, EmetteurExtended, Facture } from '../../types/Invoice';
import { Transaction } from '../../types/Transaction';
import { CategoriesConfig } from '../../types/Category';
import { Project } from '../../types/ProjectManagement';
import { computeCategoryChargesData } from '../../utils/categoryCharges';
import { ArticleStock } from '../../types/Stock';
import '../../styles/invoicing-custom.css';

const ENTREPRISE_PROJECT_CODE = 'ENTREPRISE';

const defaultEntrepriseProject = (): Project => ({
  code: ENTREPRISE_PROJECT_CODE,
  name: 'Charges Entreprise',
  subscriptions: [],
  projectionConfig: {
    startDate: new Date(new Date().getFullYear(), 0, 1),
    endDate: new Date(new Date().getFullYear(), 11, 31),
    initialBalance: 0,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});

const Invoicing: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<InvoicingTab>('gestion');
  const [devis, setDevis] = useState<Devis[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [entrepriseProject, setEntrepriseProject] = useState<Project | null>(null);
  const [emetteur, setEmetteur] = useState<EmetteurExtended | null>(null);
  const [stockArticles, setStockArticles] = useState<ArticleStock[]>([]);
  const [categories, setCategories] = useState<CategoriesConfig>({});

  const loadInvoicingData = useCallback(async () => {
    const [loadedDevis, loadedFactures, loadedTransactions] = await Promise.all([
      InvoiceService.loadDevis(),
      InvoiceService.loadFactures(),
      DataService.getTransactions(),
    ]);
    setDevis(loadedDevis.filter((d) => !d.supprime));
    setFactures(loadedFactures.filter((f) => !f.supprime));
    setTransactions(loadedTransactions);
  }, []);

  const loadEntrepriseProject = useCallback(async () => {
    let project = await ConfigService.loadProject(ENTREPRISE_PROJECT_CODE);
    if (!project) {
      project = defaultEntrepriseProject();
      await ConfigService.saveProject(project);
    }
    setEntrepriseProject(project);
  }, []);

  const loadEmetteur = useCallback(async () => {
    const loaded = await EmetteurService.loadEmetteurExtended();
    setEmetteur(loaded);
  }, []);

  const loadStock = useCallback(async () => {
    const articles = await StockService.loadArticles();
    setStockArticles(articles);
  }, []);

  const loadCategories = useCallback(async () => {
    const cats = await ConfigService.loadCategories();
    setCategories(cats);
  }, []);

  const handleEmetteurSaved = useCallback((updated: EmetteurExtended) => {
    setEmetteur(updated);
  }, []);

  useEffect(() => {
    loadInvoicingData();
    loadEntrepriseProject();
    loadEmetteur();
    loadStock();
    loadCategories();
  }, [loadInvoicingData, loadEntrepriseProject, loadEmetteur, loadStock, loadCategories]);

  const categoryChargesData = useMemo(() => {
    if (!entrepriseProject || entrepriseProject.chargesMode !== 'categories' || !entrepriseProject.categoryChargesConfig) return null;
    const { selectedCategories, referencePeriod } = entrepriseProject.categoryChargesConfig;
    return computeCategoryChargesData(transactions, selectedCategories, referencePeriod, categories);
  }, [entrepriseProject, transactions, categories]);

  return (
    <div className="invoicing-page">
      <InvoicingMenu activeTab={activeTab} onChangeTab={setActiveTab} />
      <div className="invoicing-content">
        <div className="invoicing-header">
          <h1 className="invoicing-title">{t('invoicing.title')}</h1>
        </div>
        <StatsCarousel
          devis={devis}
          factures={factures}
          transactions={transactions}
          entrepriseProject={entrepriseProject}
          stockArticles={stockArticles}
          categoryChargesData={categoryChargesData}
        />
        <div className="invoicing-main">
          <div style={{ display: activeTab === 'parametres' ? 'block' : 'none' }}>
            <EmetteurSplitView
              emetteur={emetteur}
              onEmetteurSaved={handleEmetteurSaved}
            />
          </div>
          <div style={{ display: activeTab === 'gestion' ? 'block' : 'none' }}>
            <GestionPanel onDataChange={loadInvoicingData} />
          </div>
          <div style={{ display: activeTab === 'postes' ? 'block' : 'none' }}>
            <PostesPanel />
          </div>
          <div style={{ display: activeTab === 'charges' ? 'block' : 'none' }}>
            <PostesEntreprisePanel
              project={entrepriseProject}
              transactions={transactions}
              categories={categories}
              onProjectChange={setEntrepriseProject}
            />
          </div>
          <div style={{ display: activeTab === 'stock' ? 'block' : 'none' }}>
            <StockAchatPanel onStockChange={loadStock} />
          </div>
          <div style={{ display: activeTab === 'registre' ? 'block' : 'none' }}>
            <RegistreEntreprisePanel
              factures={factures}
              entrepriseProject={entrepriseProject}
              emetteur={emetteur}
              categoryChargesData={categoryChargesData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoicing;
