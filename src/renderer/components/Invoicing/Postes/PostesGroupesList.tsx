import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteGroupe } from '../../../types/Invoice';
import { PosteService } from '../../../services/PosteService';
import { PosteGroupeRow } from './PosteGroupeRow';

interface PostesGroupesListProps {
  onAddGroupe: () => void;
}

export const PostesGroupesList: React.FC<PostesGroupesListProps> = ({ onAddGroupe }) => {
  const { t } = useTranslation();
  const [groupes, setGroupes] = useState<PosteGroupe[]>([]);

  const loadGroupes = async () => {
    const data = await PosteService.loadPostesGroupes();
    setGroupes(data);
  };

  useEffect(() => {
    loadGroupes();
    const handler = () => loadGroupes();
    window.addEventListener('postes-groupes-updated', handler);
    return () => window.removeEventListener('postes-groupes-updated', handler);
  }, []);

  const handleDelete = async (id: string) => {
    await PosteService.deletePosteGroupe(id);
    await loadGroupes();
  };

  return (
    <div className="invoicing-card">
      <div className="invoicing-header-row">
        <h2>{t('invoicing.postes.groupesTitle')}</h2>
        <button type="button" className="primary" onClick={onAddGroupe}>
          {t('invoicing.postes.addGroupe')}
        </button>
      </div>
      <div className="invoicing-list">
        {groupes.map((groupe) => (
          <PosteGroupeRow key={groupe.id} groupe={groupe} onDelete={() => handleDelete(groupe.id)} />
        ))}
        {groupes.length === 0 && <div className="invoicing-empty">{t('invoicing.postes.groupesEmpty')}</div>}
      </div>
    </div>
  );
};
