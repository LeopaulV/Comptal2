import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteGroupe } from '../../../types/Invoice';

interface PosteGroupeRowProps {
  groupe: PosteGroupe;
  onDelete: () => void;
}

export const PosteGroupeRow: React.FC<PosteGroupeRowProps> = ({ groupe, onDelete }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="invoicing-nested">
      <div className="invoicing-list-item">
        <button type="button" className="invoicing-toggle" onClick={() => setIsOpen((prev) => !prev)}>
          {isOpen ? '▾' : '▸'}
        </button>
        <div className="name">{groupe.nom}</div>
        <div className="invoicing-list-item-actions">
          <button type="button" className="invoicing-icon-button" onClick={onDelete}>
            {t('common.delete')}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="invoicing-nested-content">
          {groupe.description && <div className="invoicing-inline-meta">{groupe.description}</div>}
          {groupe.postes.map((poste) => (
            <div key={poste.id} className="invoicing-list-item invoicing-nested-item">
              <div className="name">{poste.designation}</div>
              <div className="meta">{poste.type}</div>
            </div>
          ))}
          {groupe.postes.length === 0 && <div className="invoicing-empty">{t('invoicing.postes.groupesEmptyPostes')}</div>}
        </div>
      )}
    </div>
  );
};
