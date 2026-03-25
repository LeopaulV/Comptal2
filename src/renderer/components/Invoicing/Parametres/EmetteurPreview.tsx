import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Emetteur } from '../../../types/Invoice';
import { EmetteurService } from '../../../services/EmetteurService';

export const EmetteurPreview: React.FC = () => {
  const { t } = useTranslation();
  const [emetteur, setEmetteur] = useState<Emetteur | null>(null);

  useEffect(() => {
    const load = async () => {
      const existing = await EmetteurService.loadEmetteur();
      setEmetteur(existing);
    };
    load();
  }, []);

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.settings.previewTitle')}</h2>
      {emetteur ? (
        <div className="invoicing-preview">
          {emetteur.logo && (
            <div className="preview-logo">
              <img src={emetteur.logo} alt={t('invoicing.settings.logoAlt')} />
            </div>
          )}
          <div className="preview-name">{emetteur.denominationSociale}</div>
          <div className="preview-line">
            {emetteur.adresse.rue}, {emetteur.adresse.codePostal} {emetteur.adresse.ville}
          </div>
          <div className="preview-line">{emetteur.adresse.pays}</div>
          {emetteur.siret && <div className="preview-line">SIRET: {emetteur.siret}</div>}
          {emetteur.numeroTVA && <div className="preview-line">TVA: {emetteur.numeroTVA}</div>}
          {emetteur.telephone && <div className="preview-line">{emetteur.telephone}</div>}
          {emetteur.email && <div className="preview-line">{emetteur.email}</div>}
        </div>
      ) : (
        <div className="invoicing-empty">{t('invoicing.settings.noEmetteur')}</div>
      )}
    </div>
  );
};
