import React from 'react';
import { useTranslation } from 'react-i18next';
import { PosteFacture, PosteMateriel, PosteTravail } from '../../../types/Invoice';
import { InvoiceService } from '../../../services/InvoiceService';

interface DocumentPosteRowProps {
  poste: PosteFacture;
  onUpdateQuantite: (posteId: string, value: number) => void;
  onRemove: (posteId: string) => void;
}

export const DocumentPosteRow: React.FC<DocumentPosteRowProps> = ({ poste, onUpdateQuantite, onRemove }) => {
  const { t } = useTranslation();
  const totalHT = InvoiceService.calculateLineHT(poste);

  if (poste.type === 'materiel') {
    const p = poste as PosteMateriel;
    const displayUnitPrice =
      p.prixUnitaireHT * (1 - (p.remise ?? 0) / 100) * (1 + (p.marge ?? 0) / 100);
    return (
      <div className="poste-row poste-row-materiel">
        <div className="poste-row-main">
          <div className="poste-row-header">
            <span className="poste-row-designation">{p.designation}</span>
            <span className="poste-row-price">
              {displayUnitPrice.toFixed(2)} € × {p.quantite} {p.unite}
            </span>
          </div>
          <div className="poste-row-details">
            {p.numeroArticle && (
              <span className="poste-row-badge">{t('invoicing.postes.numeroArticle')}: {p.numeroArticle}</span>
            )}
            {p.numeroLot && (
              <span className="poste-row-badge">{t('invoicing.postes.numeroLot')}: {p.numeroLot}</span>
            )}
            {p.reference && (
              <span className="poste-row-badge">{t('invoicing.postes.reference')}: {p.reference}</span>
            )}
            {p.fournisseur && (
              <span className="poste-row-badge">{t('invoicing.postes.fournisseur')}: {p.fournisseur}</span>
            )}
            {p.factureRef && (
              <span className="poste-row-badge">{t('invoicing.postes.factureRef')}: {p.factureRef}</span>
            )}
            {p.description && (
              <span className="poste-row-desc">{p.description}</span>
            )}
            {(p.remise || p.fraisTransport) && (
              <span className="poste-row-extra">
                {p.remise && `Remise ${p.remise}%`}
                {p.remise && p.fraisTransport && ' · '}
                {p.fraisTransport && `Transport ${p.fraisTransport} €`}
              </span>
            )}
          </div>
          <div className="poste-row-footer">
            <span className="poste-row-tva">TVA {p.tauxTVA}%</span>
            <span className="poste-row-total">Total HT: {totalHT.toFixed(2)} €</span>
          </div>
        </div>
        <div className="poste-row-actions">
          <label className="document-poste-quantity">
            <span className="document-poste-quantity-label">{t('invoicing.documents.quantityShort', 'Qté')}</span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={p.quantite}
              onChange={(e) => onUpdateQuantite(poste.id, Number(e.target.value) || 0)}
              className="document-poste-quantity-input"
            />
          </label>
          <button type="button" className="invoicing-icon-button" onClick={() => onRemove(poste.id)} title={t('common.delete')}>
            {t('common.delete')}
          </button>
        </div>
      </div>
    );
  }

  const posteTravail = poste as PosteTravail;
  const displayUnitPrice =
    posteTravail.tauxHoraire * (1 + (posteTravail.marge ?? 0) / 100);
  return (
    <div className="poste-row poste-row-service">
      <div className="poste-row-main">
        <div className="poste-row-header">
          <span className="poste-row-designation">{posteTravail.designation}</span>
          <span className="poste-row-price">
            {displayUnitPrice.toFixed(2)} €/h × {posteTravail.heuresEstimees} h
            {posteTravail.nombreIntervenants > 1 && ` × ${posteTravail.nombreIntervenants} intervenant(s)`}
          </span>
        </div>
        <div className="poste-row-details">
          {posteTravail.description && <span className="poste-row-desc">{posteTravail.description}</span>}
          {posteTravail.taches && posteTravail.taches.length > 0 && (
            <span className="poste-row-badge">
              {posteTravail.taches.length} {t('invoicing.postes.tacheCount')}
            </span>
          )}
          {(posteTravail.marge || posteTravail.fraisDeplacement) && (
            <span className="poste-row-extra">
              {posteTravail.marge && `Marge ${posteTravail.marge}%`}
              {posteTravail.marge && posteTravail.fraisDeplacement && ' · '}
              {posteTravail.fraisDeplacement && `Déplacement ${posteTravail.fraisDeplacement} €`}
            </span>
          )}
        </div>
        <div className="poste-row-footer">
          <span className="poste-row-tva">TVA {posteTravail.tauxTVA}%</span>
          <span className="poste-row-total">Total HT: {totalHT.toFixed(2)} €</span>
        </div>
      </div>
      <div className="poste-row-actions">
        <label className="document-poste-quantity">
          <span className="document-poste-quantity-label">{t('invoicing.documents.hoursShort', 'H')}</span>
          <input
            type="number"
            min={0.01}
            step={0.5}
            value={posteTravail.heuresEstimees}
            onChange={(e) => onUpdateQuantite(poste.id, Number(e.target.value) || 0)}
            className="document-poste-quantity-input"
          />
        </label>
        <button type="button" className="invoicing-icon-button" onClick={() => onRemove(poste.id)} title={t('common.delete')}>
          {t('common.delete')}
        </button>
      </div>
    </div>
  );
};
