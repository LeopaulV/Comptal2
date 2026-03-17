import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigService } from '../../services/ConfigService';
import { ProjectionService } from '../../services/ProjectionService';
import { Project, Subscription, ProjectionData, ProjectionDataByAccount } from '../../types/ProjectManagement';
import { CategoriesConfig } from '../../types/Category';
import ProjectSelector from '../../components/ProjectManagement/ProjectSelector';
import SubscriptionTable from '../../components/ProjectManagement/SubscriptionTable';
import GraphCarousel from '../../components/ProjectManagement/GraphCarousel';
import ProjectionConfig from '../../components/ProjectManagement/ProjectionConfig';
import { Loading } from '../../components/Common';
import { toast } from 'react-toastify';
import '../../styles/project-management-custom.css';

const ProjectManagement: React.FC = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [selectedProjectCode, setSelectedProjectCode] = useState<string | null>(null);
  const [projectionData, setProjectionData] = useState<ProjectionData[]>([]);
  const [projectionDataByAccount, setProjectionDataByAccount] = useState<ProjectionDataByAccount[]>([]);
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [accountColors, setAccountColors] = useState<Record<string, string>>({});
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});

  // Calcul des statistiques pour les boxes d'information
  const stats = useMemo(() => {
    if (projectionData.length === 0) {
      return {
        totalDebits: 0,
        totalCredits: 0,
        finalBalance: currentProject?.projectionConfig.initialBalance || 0,
        netFlow: 0,
      };
    }

    const lastData = projectionData[projectionData.length - 1];
    const totalDebits = projectionData.reduce((sum, d) => sum + d.totalDebits, 0); // <= 0
    const totalCredits = projectionData.reduce((sum, d) => sum + d.totalCredits, 0);

    return {
      totalDebits,
      totalCredits,
      finalBalance: lastData.balance,
      netFlow: totalCredits + totalDebits, // totalDebits déjà négatif
    };
  }, [projectionData, currentProject?.projectionConfig.initialBalance]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Charger les catégories
      const loadedCategories = await ConfigService.loadCategories();
      setCategories(loadedCategories);

      // Charger les comptes et leurs couleurs/noms
      const accounts = await ConfigService.loadAccounts();
      const colors: Record<string, string> = {};
      const names: Record<string, string> = {};
      for (const [code, account] of Object.entries(accounts)) {
        colors[code] = account.color;
        names[code] = account.name;
      }
      setAccountColors(colors);
      setAccountNames(names);

      const projects = await ConfigService.loadSelectableProjects();
      const projectCodes = Object.keys(projects);
      
      if (projectCodes.length > 0) {
        const firstProjectCode = projectCodes[0];
        setSelectedProjectCode(firstProjectCode);
        await loadProject(firstProjectCode);
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement initial:', error);
      toast.error(t('projectManagement.loadError', 'Erreur lors du chargement des projets'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadProject = async (projectCode: string) => {
    try {
      const project = await ConfigService.loadProject(projectCode);
      if (project) {
        // Migration : ajouter la couleur aux abonnements existants si elle n'existe pas
        let needsMigration = false;
        
        // Charger les catégories pour la migration
        const categories = await ConfigService.loadCategories();
        
        const migratedSubscriptions = project.subscriptions.map(sub => {
          if (!sub.color) {
            needsMigration = true;
            // Si une catégorie existe, utiliser sa couleur, sinon couleur par défaut
            if (sub.categoryCode && categories[sub.categoryCode]) {
              return { ...sub, color: categories[sub.categoryCode].color };
            }
            return { ...sub, color: '#0ea5e9' };
          }
          return sub;
        });

        // Si migration nécessaire, sauvegarder le projet mis à jour
        if (needsMigration) {
          const migratedProject = {
            ...project,
            subscriptions: migratedSubscriptions,
            updatedAt: new Date(),
          };
          await ConfigService.saveProject(migratedProject);
          setCurrentProject(migratedProject);
          calculateProjection(migratedProject);
        } else {
          setCurrentProject(project);
          calculateProjection(project);
        }
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement du projet:', error);
      toast.error(t('projectManagement.loadProjectError', 'Erreur lors du chargement du projet'));
    }
  };

  const calculateProjection = useCallback((project: Project) => {
    if (!project || project.subscriptions.length === 0) {
      setProjectionData([]);
      setProjectionDataByAccount([]);
      return;
    }

    try {
      // Si des comptes sont configurés, utiliser la projection par compte
      if (project.projectionConfig.accountConfigs && project.projectionConfig.accountConfigs.length > 0) {
        const dataByAccount = ProjectionService.calculateProjectionByAccount(
          project.subscriptions,
          project.projectionConfig
        );
        setProjectionDataByAccount(dataByAccount);
        
        // Calculer aussi les données classiques pour les stats
        const data = ProjectionService.calculateProjection(
          project.subscriptions,
          project.projectionConfig
        );
        setProjectionData(data);
      } else {
        // Sinon, utiliser la projection classique
        const data = ProjectionService.calculateProjection(
          project.subscriptions,
          project.projectionConfig
        );
        setProjectionData(data);
        setProjectionDataByAccount([]);
      }
    } catch (error: any) {
      console.error('Erreur lors du calcul de la projection:', error);
      toast.error(t('projectManagement.calculationError', 'Erreur lors du calcul de la projection'));
    }
  }, [t]);

  const handleProjectChange = useCallback(async (projectCode: string) => {
    if (!projectCode) {
      setCurrentProject(null);
      setProjectionData([]);
      return;
    }

    setSelectedProjectCode(projectCode);
    await loadProject(projectCode);
  }, []);

  const handleProjectLoaded = useCallback((project: Project) => {
    setCurrentProject(project);
    calculateProjection(project);
  }, [calculateProjection]);

  const handleSubscriptionsChange = useCallback(async (subscriptions: Subscription[]) => {
    if (!currentProject) return;

    // IMPORTANT: Forcer le blur de l'élément actif AVANT de commencer la sauvegarde
    // Cela évite les problèmes de focus après suppression/modification
    const activeElement = document.activeElement;
    if (activeElement && activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    
    // Attendre que le blur soit traité et que les modifications soient appliquées
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const updatedProject: Project = {
        ...currentProject,
        subscriptions,
        updatedAt: new Date(),
      };

      await ConfigService.saveProject(updatedProject);
      setCurrentProject(updatedProject);
      calculateProjection(updatedProject);
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error(t('projectManagement.saveError', { error: error.message, defaultValue: 'Erreur lors de la sauvegarde: {{error}}' }));
    }
  }, [currentProject, calculateProjection, t]);

  const handleConfigChange = useCallback(async (config: Project['projectionConfig']) => {
    if (!currentProject) return;

    // IMPORTANT: Forcer le blur de l'élément actif AVANT de commencer la sauvegarde
    // Cela évite les problèmes de focus après modification
    const activeElement = document.activeElement;
    if (activeElement && activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    
    // Attendre que le blur soit traité et que les modifications soient appliquées
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const updatedProject: Project = {
        ...currentProject,
        projectionConfig: config,
        updatedAt: new Date(),
      };

      await ConfigService.saveProject(updatedProject);
      setCurrentProject(updatedProject);
      calculateProjection(updatedProject);
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error(t('projectManagement.saveError', { error: error.message, defaultValue: 'Erreur lors de la sauvegarde: {{error}}' }));
    }
  }, [currentProject, calculateProjection, t]);

  if (isLoading) {
    return <Loading message={t('projectManagement.loading', 'Chargement...')} />;
  }

  return (
    <div className="project-management-page text-gray-900 dark:text-gray-100">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {t('projectManagement.title', 'Gestion et Projet')}
        </h1>
        <ProjectSelector
          selectedProjectCode={selectedProjectCode}
          onProjectChange={handleProjectChange}
          onProjectLoaded={handleProjectLoaded}
        />
      </div>

      {currentProject ? (
        <div className="project-management-main">
          {/* PARTIE HAUTE : Carrousel de graphiques */}
          <GraphCarousel 
            projectionData={projectionData}
            projectionDataByAccount={projectionDataByAccount}
            stats={stats}
            subscriptions={currentProject.subscriptions}
            projectionConfig={currentProject.projectionConfig}
            categories={categories}
            accountColors={accountColors}
            accountNames={accountNames}
          />

          {/* PARTIE BASSE : Configuration et tableau */}
          <div className="project-management-bottom-section mt-8">
            <ProjectionConfig 
              config={currentProject.projectionConfig}
              onConfigChange={handleConfigChange}
            />
            <div className="project-management-content">
              <SubscriptionTable 
                subscriptions={currentProject.subscriptions}
                onSubscriptionsChange={handleSubscriptionsChange}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>{t('projectManagement.noProject', 'Aucun projet sélectionné. Créez un nouveau projet pour commencer.')}</p>
        </div>
      )}
    </div>
  );
};

export default ProjectManagement;
