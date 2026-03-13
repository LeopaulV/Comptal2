import React from 'react';
import { useTranslation } from 'react-i18next';
import { PosteMateriel } from '../../../types/Invoice';

interface PosteMaterielRowProps {
  poste: PosteMateriel;
  onEdit: () => void;
  onDelete: () => void;
}

export const PosteMaterielRow: React.FC<PosteMaterielRowProps> = ({ poste, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const totalHT = poste.prixUnitaireHT * poste.quantite;

  return (
    <div className="poste-row poste-row-materiel">
      <div className="poste-row-main">
        <div className="poste-row-header">
          <span className="poste-row-designation">{poste.designation}</span>
          <span className="poste-row-price">
            {poste.prixUnitaireHT.toFixed(2)} € × {poste.quantite} {poste.unite}
          </span>
        </div>
        <div className="poste-row-details">
          {poste.numeroArticle && (
            <span className="poste-row-badge">{t('invoicing.postes.numeroArticle')}: {poste.numeroArticle}</span>
          )}
          {poste.numeroLot && (
            <span className="poste-row-badge">{t('invoicing.postes.numeroLot')}: {poste.numeroLot}</span>
          )}
          {poste.reference && (
            <span className="poste-row-badge">{t('invoicing.postes.reference')}: {poste.reference}</span>
          )}
          {poste.fournisseur && (
            <span className="poste-row-badge">{t('invoicing.postes.fournisseur')}: {poste.fournisseur}</span>
          )}
          {poste.factureRef && (
            <span className="poste-row-badge">{t('invoicing.postes.factureRef')}: {poste.factureRef}</span>
          )}
          {poste.description && (
            <span className="poste-row-desc">{poste.description}</span>
          )}
          {(poste.remise || poste.fraisTransport) && (
            <span className="poste-row-extra">
              {poste.remise && `Remise ${poste.remise}%`}
              {poste.remise && poste.fraisTransport && ' · '}
              {poste.fraisTransport && `Transport ${poste.fraisTransport} €`}
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
