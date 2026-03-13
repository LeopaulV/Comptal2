import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Project, Subscription } from '../../types/ProjectManagement';
import { Transaction } from '../../types/Transaction';
import { CategoriesConfig } from '../../types/Category';
import { ConfigService } from '../../services/ConfigService';
import SubscriptionTable from '../ProjectManagement/SubscriptionTable';
import ProjectionConfig from '../ProjectManagement/ProjectionConfig';
import { CategoryChargesPanel } from './CategoryChargesPanel';
import { AssociationPDFService } from '../../services/AssociationPDFService';
import { computeCategoryChargesData } from '../../utils/categoryCharges';

interface PostesAssociationPanelProps {
  project: Project | null;
  transactions: Transaction[];
  categories: CategoriesConfig;
  onProjectChange: (project: Project) => void;
}

export const PostesAssociationPanel: React.FC<PostesAssociationPanelProps> = ({
  project,
  transactions,
  categories,
  onProjectChange,
}) => {
  const { t } = useTranslation();

  const handleSubscriptionsChange = async (subscriptions: Subscription[]) => {
    if (!project) return;
    const updated = { ...project, subscriptions, updatedAt: new Date() };
    await ConfigService.saveProject(updated);
    onProjectChange(updated);
  };

  const handleConfigChange = async (config: Project['projectionConfig']) => {
    if (!project) return;
    const updated = { ...project, projectionConfig: config, updatedAt: new Date() };
    await ConfigService.saveProject(updated);
    onProjectChange(updated);
  };

  const handleModeChange = useCallback(
    async (mode: 'manual' | 'categories') => {
      if (!project) return;
      const updated = { ...project, chargesMode: mode, updatedAt: new Date() };
      await ConfigService.saveProject(updated);
      onProjectChange(updated);
    },
    [project, onProjectChange]
  );

  const handleExportPdf = useCallback(async () => {
    if (!project) return;

    const isCategoryMode = project.chargesMode === 'categories' && project.categoryChargesConfig;

    let categoryChargesData = null;
    if (isCategoryMode && project.categoryChargesConfig) {
      categoryChargesData = computeCategoryChargesData(
        transactions,
        project.categoryChargesConfig.selectedCategories,
        project.categoryChargesConfig.referencePeriod,
        categories
      );
    }

    try {
      await AssociationPDFService.generateChargesReportPDF(project, categoryChargesData);
    } catch (err) {
      console.error('Erreur génération PDF charges:', err);
    }
  }, [project, transactions, categories]);

  const currentMode = project?.chargesMode ?? 'manual';

  return (
    <div className="association-panel">
      <div className="invoicing-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h2>{t('association.postes.chargesTitle')}</h2>
          {project && (
            <button
              onClick={handleExportPdf}
              className="secondary"
              style={{ padding: '8px 16px', borderRadius: 8, fontSize: '0.9rem' }}
            >
              {t('association.postes.exportChargesPdf', 'Exporter PDF des charges')}
            </button>
          )}
        </div>

        {project ? (
          <>
            <div className="charges-mode-tabs" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleModeChange('manual')}
                className={currentMode === 'manual' ? 'invoicing-carousel-tab active' : 'invoicing-carousel-tab'}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid var(--invoicing-gray-300)',
                  background: currentMode === 'manual' ? 'var(--invoicing-primary)' : 'var(--invoicing-gray-50)',
                  color: currentMode === 'manual' ? '#fff' : 'var(--invoicing-gray-700)',
                  fontWeight: currentMode === 'manual' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {t('association.postes.modeRecurrent', 'Projection de charges')}
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('categories')}
                className={currentMode === 'categories' ? 'invoicing-carousel-tab active' : 'invoicing-carousel-tab'}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid var(--invoicing-gray-300)',
                  background: currentMode === 'categories' ? 'var(--invoicing-primary)' : 'var(--invoicing-gray-50)',
                  color: currentMode === 'categories' ? '#fff' : 'var(--invoicing-gray-700)',
                  fontWeight: currentMode === 'categories' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {t('association.postes.modeCategories', 'Charges réelles')}
              </button>
            </div>

            {currentMode === 'manual' ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <ProjectionConfig
                    config={project.projectionConfig}
                    onConfigChange={handleConfigChange}
                    titleKey="association.postes.configLabel"
                  />
                </div>
                <div className="project-management-content">
                  <SubscriptionTable
                    subscriptions={project.subscriptions}
                    onSubscriptionsChange={handleSubscriptionsChange}
                  />
                </div>
              </>
            ) : (
              <CategoryChargesPanel
                project={project}
                transactions={transactions}
                categories={categories}
                onProjectChange={onProjectChange}
              />
            )}
          </>
        ) : (
          <div className="invoicing-empty" style={{ padding: 40, textAlign: 'center' }}>
            {t('common.loading')}
          </div>
        )}
      </div>
    </div>
  );
};
