import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmetteurExtended, EmetteurExtendedSerialized } from '../../../types/Invoice';
import { EmetteurService } from '../../../services/EmetteurService';
import { FileService } from '../../../services/FileService';
import { EmetteurFormPanel, defaultEmetteur } from './EmetteurFormPanel';
import { PDFPreviewPanel } from './PDFPreviewPanel';

const EXTENDED_EMETTEUR_PATH = 'parametre/emetteur_extended.json';

export const EmetteurSplitView: React.FC = () => {
  const { t } = useTranslation();
  const [emetteur, setEmetteur] = useState<EmetteurExtended>(defaultEmetteur());
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);

  useEffect(() => {
    const loadEmetteur = async () => {
      try {
        // Essayer de charger l'émetteur étendu
        let loaded: EmetteurExtended | null = null;
        
        try {
          const extendedContent = await FileService.readFile(EXTENDED_EMETTEUR_PATH);
          const parsed: EmetteurExtendedSerialized = JSON.parse(extendedContent);
          loaded = {
            ...parsed,
            createdAt: new Date(parsed.createdAt),
            updatedAt: new Date(parsed.updatedAt),
          };
        } catch {
          // Si pas d'émetteur étendu, charger l'émetteur classique
          const baseEmetteur = await EmetteurService.loadEmetteur();
          if (baseEmetteur) {
            loaded = {
              ...baseEmetteur,
              linkedAccounts: [],
              selectedMentionsLegales: [],
              customMentionsLegales: [],
              mentionPlaceholderValues: {},
            };
          }
        }

        if (loaded) {
          setEmetteur(loaded);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'émetteur:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadEmetteur();
  }, []);

  const handleSave = async () => {
    try {
      setStatus(null);

      // Valider et sauvegarder l'émetteur étendu (met à jour le cache pour la génération PDF)
      await EmetteurService.saveEmetteurExtended(emetteur);

      setStatus(t('invoicing.emetteur.saved'));

      // Effacer le statut après 3 secondes
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
