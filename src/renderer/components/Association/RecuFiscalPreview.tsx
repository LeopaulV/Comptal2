import React from 'react';
import { useTranslation } from 'react-i18next';
import { AssociationConfig } from '../../types/Association';

interface RecuFiscalPreviewProps {
  config: AssociationConfig;
}

function formatAdresse(adresse: { rue: string; codePostal: string; ville: string; pays: string }): string {
  const parts = [adresse.rue, `${adresse.codePostal} ${adresse.ville}`.trim(), adresse.pays].filter(Boolean);
  return parts.join(', ');
}

export const RecuFiscalPreview: React.FC<RecuFiscalPreviewProps> = ({ config }) => {
  const { t } = useTranslation();

  if (!config.denominationSociale) {
    return (
      <div className="recu-fiscal-preview-placeholder">
        <p>{t('association.config.previewPlaceholder')}</p>
      </div>
    );
  }

  return (
    <div className="recu-fiscal-preview">
      <div className="recu-fiscal-preview-header">
        <h3>{t('association.config.previewTitle')}</h3>
        <p className="recu-fiscal-preview-subtitle">CERFA 11580*05 / 16216*01</p>
      </div>
      <div className="recu-fiscal-preview-content">
        <div className="recu-fiscal-preview-block">
          <strong>{config.denominationSociale}</strong>
          {config.objetSocial && <p>{config.objetSocial}</p>}
          <p>{formatAdresse(config.adresse)}</p>
          {config.rna && <p>RNA : {config.rna}</p>}
          {config.siren && <p>SIREN : {config.siren}</p>}
        </div>
        {config.statutOIG && (
          <div className="recu-fiscal-preview-block">
            <p>{t('association.config.statutOIGMention')}</p>
            {config.datePublicationJO && <p>{t('association.config.dateJO')}: {config.datePublicationJO}</p>}
          </div>
        )}
        {config.referencesCGI && (
          <div className="recu-fiscal-preview-block">
            <p>{config.referencesCGI}</p>
          </div>
        )}
        <div className="recu-fiscal-preview-block recu-fiscal-preview-don">
          <p className="recu-fiscal-preview-label">{t('association.config.previewDonLabel')}</p>
          <p>[Donateur]</p>
          <p>[Montant]</p>
          <p>{t('association.config.previewAttestation')}</p>
        </div>
      </div>
    </div>
  );
};
