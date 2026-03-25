import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssociationMenu, AssociationTab } from '../../components/Association/AssociationMenu';
import { AssociationCarousel } from '../../components/Association/AssociationCarousel';
import { GestionDonateursPanel } from '../../components/Association/GestionDonateursPanel';
import { AssociationConfigSplitView } from '../../components/Association/AssociationConfigSplitView';
import { PostesAssociationPanel } from '../../components/Association/PostesAssociationPanel';
import { RegistreRecusPanel } from '../../components/Association/RegistreRecusPanel';
import { DonateurService } from '../../services/DonateurService';
import { DataService } from '../../services/DataService';
import { ConfigService } from '../../services/ConfigService';
import { DonsService } from '../../services/DonsService';
import { Donateur, Don } from '../../types/Association';
import { Transaction } from '../../types/Transaction';
import { CategoriesConfig } from '../../types/Category';
import { Project } from '../../types/ProjectManagement';
import { startOfYear, endOfYear } from 'date-fns';
import { computeCategoryChargesData } from '../../utils/categoryCharges';
import '../../styles/invoicing-custom.css';
import '../../styles/project-management-custom.css';
import '../../styles/association-custom.css';

const ASSOCIATION_PROJECT_CODE = 'ASSOCIATION';

const createDefaultProject = (): Project => {
  const now = new Date();
  return {
    code: ASSOCIATION_PROJECT_CODE,
    name: 'Association',
    subscriptions: [],
    projectionConfig: {
      startDate: startOfYear(now),
      endDate: endOfYear(now),
      initialBalance: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
};

const Association: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AssociationTab>('gestion');
  const [donateurs, setDonateurs] = useState<Donateur[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionMapping, setTransactionMapping] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [project, setProject] = useState<Project | null>(null);
  const [dons, setDons] = useState<Don[]>([]);

  const loadAssociationData = useCallback(async () => {
    const [loadedDonateurs, loadedTransactions, loadedMapping, loadedCategories, loadedDons] = await Promise.all([
      DonateurService.loadDonateurs(),
      DataService.getTransactions(),
      DonateurService.loadTransactionMapping(),
      ConfigService.loadCategories(),
      DonsService.loadDons(),
    ]);
    setDonateurs(loadedDonateurs);
    setTransactions(loadedTransactions);
    setTransactionMapping(loadedMapping);
    setCategories(loadedCategories);
    setDons(loadedDons);
  }, []);

  const loadProject = useCallback(async () => {
    let loaded = await ConfigService.loadProject(ASSOCIATION_PROJECT_CODE);
    if (!loaded) {
      loaded = createDefaultProject();
      await ConfigService.saveProject(loaded);
    }
    setProject(loaded);
  }, []);

  useEffect(() => {
    loadAssociationData();
    loadProject();
  }, [loadAssociationData, loadProject]);

  const handleProjectChange = useCallback((updatedProject: Project) => {
    setProject(updatedProject);
  }, []);

  const categoryChargesData = useMemo(() => {
    if (!project || project.chargesMode !== 'categories' || !project.categoryChargesConfig) return null;
    const { selectedCategories, referencePeriod } = project.categoryChargesConfig;
    return computeCategoryChargesData(transactions, selectedCategories, referencePeriod, categories);
  }, [project, transactions, categories]);

  return (
    <div className="association-page">
      <AssociationMenu activeTab={activeTab} onChangeTab={setActiveTab} />
      <div className="association-content">
        <div className="association-header">
          <h1 className="association-title">{t('association.title')}</h1>
        </div>
        <AssociationCarousel
          donateurs={donateurs}
          transactions={transactions}
          transactionMapping={transactionMapping}
          categories={categories}
          project={project}
          dons={dons}
          categoryChargesData={categoryChargesData}
        />
        <div className="association-main">
          <div style={{ display: activeTab === 'parametres' ? 'block' : 'none' }}>
            <AssociationConfigSplitView />
          </div>
          <div style={{ display: activeTab === 'gestion' ? 'block' : 'none' }}>
            <GestionDonateursPanel onDataChange={loadAssociationData} />
          </div>
          <div style={{ display: activeTab === 'postes' ? 'block' : 'none' }}>
            <PostesAssociationPanel
              project={project}
              transactions={transactions}
              categories={categories}
              onProjectChange={handleProjectChange}
            />
          </div>
          <div style={{ display: activeTab === 'registre' ? 'block' : 'none' }}>
            <RegistreRecusPanel isVisible={activeTab === 'registre'} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Association;
