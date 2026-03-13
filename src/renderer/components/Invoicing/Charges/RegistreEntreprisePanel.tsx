import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Emetteur, Facture } from '../../../types/Invoice';
import { Project, CategoryChargesData } from '../../../types/ProjectManagement';
import { LivreRecettesPanel } from './LivreRecettesPanel';
import { LivreAchatsPanel } from './LivreAchatsPanel';
import { RapportsPanel } from './RapportsPanel';

type RegistreTab = 'recettes' | 'achats' | 'rapports';

interface RegistreEntreprisePanelProps {
  factures: Facture[];
  entrepriseProject: Project | null;
  emetteur: Emetteur | null;
  categoryChargesData?: CategoryChargesData | null;
}

export const RegistreEntreprisePanel: React.FC<RegistreEntreprisePanelProps> = ({
  factures,
  entrepriseProject,
  emetteur,
  categoryChargesData,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<RegistreTab>('recettes');

  return (
    <div className="association-registre-panel entreprise-registre-panel">
      {/* Header */}
      <div className="association-registre-header">
        <div>
          <h3 className="association-registre-title">{t('invoicing.registre.title')}</h3>
          <p className="association-registre-subtitle">{t('invoicing.registre.subtitle')}</p>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="association-registre-filters">
        <button
          type="button"
          className={`association-registre-filter-btn ${activeTab === 'recettes' ? 'active' : ''}`}
          onClick={() => setActiveTab('recettes')}
        >
          {t('invoicing.registre.tabRecettes')}
        </button>
        <button
          type="button"
          className={`association-registre-filter-btn ${activeTab === 'achats' ? 'active' : ''}`}
          onClick={() => setActiveTab('achats')}
        >
          {t('invoicing.registre.tabAchats')}
        </button>
        <button
          type="button"
          className={`association-registre-filter-btn ${activeTab === 'rapports' ? 'active' : ''}`}
          onClick={() => setActiveTab('rapports')}
        >
          {t('invoicing.registre.tabRapports')}
        </button>
      </div>

      {/* Contenu */}
      <div className="entreprise-registre-content">
        {activeTab === 'recettes' && (
          <LivreRecettesPanel />
        )}
        {activeTab === 'achats' && <LivreAchatsPanel />}
        {activeTab === 'rapports' && (
          <RapportsPanel
            factures={factures}
            entrepriseProject={entrepriseProject}
            emetteur={emetteur}
            categoryChargesData={categoryChargesData}
          />
        )}
      </div>
    </div>
  );
};
