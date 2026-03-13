import React from 'react';
import { ArticleStock, StockCategorie } from '../../../types/Stock';
import { CategorieTag } from './CategorieTag';

interface ArticleRowProps {
  article: ArticleStock;
  categorie?: StockCategorie;
  onEdit: () => void;
  onDelete: () => void;
}

export const ArticleRow: React.FC<ArticleRowProps> = ({ article, categorie, onEdit, onDelete }) => {
  return (
    <div className="invoicing-list-item">
      <div className="invoicing-list-item-main">
        <strong>{article.designation}</strong>
        <div style={{ color: 'var(--invoicing-gray-700)', fontSize: '0.9rem' }}>
          {article.type} · {article.valeurAcquisitionHT.toFixed(2)} EUR HT · TVA {article.tauxTVA}%
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {categorie ? <CategorieTag label={categorie.nom} color={categorie.couleur} /> : null}
          <span className="badge">{article.statut}</span>
        </div>
      </div>
      <div className="invoicing-list-item-actions">
        <button type="button" className="secondary" onClick={onEdit}>
          Modifier
        </button>
        <button type="button" className="secondary" onClick={onDelete}>
          Supprimer
        </button>
      </div>
    </div>
  );
};
