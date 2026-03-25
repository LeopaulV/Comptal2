import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { AssociationConfig } from '../../types/Association';
import { AssociationConfigService } from '../../services/AssociationConfigService';
import { AssociationFormPanel } from './AssociationFormPanel';
import { AssociationPDFPreviewPanel } from './AssociationPDFPreviewPanel';

const defaultConfig = (): AssociationConfig => ({
  denominationSociale: '',
  objetSocial: '',
  adresse: { rue: '', codePostal: '', ville: '', pays: 'France' },
  statutOIG: false,
  referencesCGI: 'Articles 200 et 238 bis du code général des impôts',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const AssociationConfigSplitView: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<AssociationConfig>(defaultConfig());
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [isNewProfile, setIsNewProfile] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await AssociationConfigService.getOrCreateConfig();
        setIsNewProfile(!loaded.denominationSociale);
        setConfig(loaded);
      } catch (error) {
        console.error('Erreur chargement config association:', error);
        setIsNewProfile(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    try {
      setStatus(null);
      const toSave = {
        ...config,
        updatedAt: new Date(),
      };
      await AssociationConfigService.saveConfig(toSave);
      setConfig(toSave);
      setStatus(t('association.config.saved'));
      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      setStatus(error.message || t('association.config.saveError'));
    }
  };

  if (isLoading) {
    return (
      <div className="emetteur-split-view loading">
        <div className="loading-spinner" />
        <span>{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div className="emetteur-split-view">
      {isNewProfile && (
        <div className="emetteur-setup-notice">
          <Info size={18} />
          <div className="emetteur-setup-notice-content">
            <strong>{t('association.config.setupRequired')}</strong>
            <span>{t('association.config.setupRequiredHint')}</span>
          </div>
        </div>
      )}
      <div className="emetteur-form-container">
        <AssociationFormPanel
          config={config}
          onChange={setConfig}
          onSave={handleSave}
          status={status}
        />
      </div>
      <div className={`emetteur-preview-container ${showPreviewMobile ? 'show-mobile' : ''}`}>
        <AssociationPDFPreviewPanel config={config} />
      </div>
      <button
        type="button"
        className="emetteur-preview-toggle-mobile"
        onClick={() => setShowPreviewMobile(!showPreviewMobile)}
      >
        {showPreviewMobile ? t('invoicing.preview.hidePreview') : t('invoicing.preview.showPreview')}
      </button>
    </div>
  );
};
