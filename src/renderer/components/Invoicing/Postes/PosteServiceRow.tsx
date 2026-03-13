import React from 'react';
import { useTranslation } from 'react-i18next';
import { PosteTravail } from '../../../types/Invoice';

interface PosteServiceRowProps {
  poste: PosteTravail;
  onEdit: () => void;
  onDelete: () => void;
}

export const PosteServiceRow: React.FC<PosteServiceRowProps> = ({ poste, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const totalHT = poste.tauxHoraire * poste.heuresEstimees * poste.nombreIntervenants;

  return (
    <div className="poste-row poste-row-service">
      <div className="poste-row-main">
        <div className="poste-row-header">
          <span className="poste-row-designation">{poste.designation}</span>
          <span className="poste-row-price">
            {poste.tauxHoraire.toFixed(2)} €/h × {poste.heuresEstimees} h
            {poste.nombreIntervenants > 1 && ` × ${poste.nombreIntervenants} intervenant(s)`}
          </span>
        </div>
        <div className="poste-row-details">
          {poste.description && <span className="poste-row-desc">{poste.description}</span>}
          {poste.taches && poste.taches.length > 0 && (
            <span className="poste-row-badge">
              {poste.taches.length} {t('invoicing.postes.tacheCount')}
            </span>
          )}
          {(poste.marge || poste.fraisDeplacement) && (
            <span className="poste-row-extra">
              {poste.marge && `Marge ${poste.marge}%`}
              {poste.marge && poste.fraisDeplacement && ' · '}
              {poste.fraisDeplacement && `Déplacement ${poste.fraisDeplacement} €`}
            </span>
          )}
        </div>
        <div className="poste-row-footer">
          <span className="poste-row-tva">TVA {poste.tauxTVA}%</span>
          <span className="poste-row-total">Total HT: {totalHT.toFixed(2)} €</span>
        </div>
      </div>
      <div className="poste-row-actions">
        <button type="button" className="invoicing-icon-button" onClick={onEdit} title={t('common.edit')}>
          {t('common.edit')}
        </button>
        <button type="button" className="invoicing-icon-button" onClick={onDelete} title={t('common.delete')}>
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
};
