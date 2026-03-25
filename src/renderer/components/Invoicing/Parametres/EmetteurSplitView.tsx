import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { EmetteurExtended } from '../../../types/Invoice';
import { EmetteurService } from '../../../services/EmetteurService';
import { EmetteurFormPanel, defaultEmetteur } from './EmetteurFormPanel';
import { PDFPreviewPanel } from './PDFPreviewPanel';

interface EmetteurSplitViewProps {
  emetteur: EmetteurExtended | null;
  onEmetteurSaved?: (updated: EmetteurExtended) => void;
}

export const EmetteurSplitView: React.FC<EmetteurSplitViewProps> = ({
  emetteur: emetteurFromParent,
  onEmetteurSaved,
}) => {
  const { t } = useTranslation();
  const [emetteur, setEmetteur] = useState<EmetteurExtended>(defaultEmetteur());
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [isNewProfile, setIsNewProfile] = useState(false);

  useEffect(() => {
    if (emetteurFromParent) {
      setIsNewProfile(!emetteurFromParent.denominationSociale);
      setEmetteur(emetteurFromParent);
      setIsLoading(false);
    } else {
      const loadFromService = async () => {
        try {
          const loaded = await EmetteurService.loadEmetteurExtended();
          if (loaded) {
            setIsNewProfile(!loaded.denominationSociale);
            setEmetteur(loaded);
          } else {
            setIsNewProfile(true);
          }
        } catch (error) {
          console.error('Erreur lors du chargement de l\'émetteur:', error);
          setIsNewProfile(true);
        } finally {
          setIsLoading(false);
        }
      };
      loadFromService();
    }
  }, [emetteurFromParent]);

  const handleSave = async () => {
    try {
      setStatus(null);

      const errors = EmetteurService.validateEmetteur(emetteur);
      if (errors.length > 0) {
        setStatus(t('invoicing.emetteur.validationError', { fields: errors.join(', ') }));
        return;
      }

      await EmetteurService.saveEmetteurExtended(emetteur);

      const saved = await EmetteurService.loadEmetteurExtended();
      if (saved) {
        setEmetteur(saved);
        onEmetteurSaved?.(saved);
      }

      setStatus(t('invoicing.emetteur.saved'));
      setTimeout(() => setStatus(null), 3000);
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      setStatus(error.message || t('invoicing.emetteur.saveError'));
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
            <strong>{t('invoicing.emetteur.setupRequired')}</strong>
            <span>{t('invoicing.emetteur.setupRequiredHint')}</span>
          </div>
        </div>
      )}
      {/* Panneau gauche: Formulaire */}
      <div className="emetteur-form-container">
        <EmetteurFormPanel
          emetteur={emetteur}
          onChange={setEmetteur}
          onSave={handleSave}
          status={status}
        />
      </div>

      {/* Panneau droit: Aperçu PDF */}
      <div className={`emetteur-preview-container ${showPreviewMobile ? 'show-mobile' : ''}`}>
        <PDFPreviewPanel emetteur={emetteur} />
      </div>

      {/* Bouton mobile pour afficher/masquer l'aperçu */}
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
