import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteFacture, PosteGroupe } from '../../../types/Invoice';
import { PosteService } from '../../../services/PosteService';

interface PosteGroupeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PosteGroupeModal: React.FC<PosteGroupeModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [postes, setPostes] = useState<PosteFacture[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      const loaded = await PosteService.loadPostes();
      setPostes(loaded);
    };
    load();
  }, [isOpen]);

  const groupedPostes = useMemo(() => {
    return {
      materiel: postes.filter((poste) => poste.type === 'materiel'),
      travail: postes.filter((poste) => poste.type === 'travail'),
    };
  }, [postes]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (!nom.trim()) {
      setStatus(t('invoicing.postes.groupesRequired'));
      return;
    }
    const selectedPostes = postes.filter((poste) => selectedIds.includes(poste.id));
    const groupe: PosteGroupe = {
      id: `groupe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'groupe',
      nom: nom.trim(),
      description: description.trim() || undefined,
      postes: selectedPostes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await PosteService.savePosteGroupe(groupe);
    window.dispatchEvent(new CustomEvent('postes-groupes-updated'));
    setNom('');
    setDescription('');
    setSelectedIds([]);
    setStatus(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="invoicing-header-row">
          <h2>{t('invoicing.postes.newGroupe')}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
        <div className="invoicing-form-grid">
          <label>
            {t('invoicing.postes.groupName')}
            <input value={nom} onChange={(e) => setNom(e.target.value)} />
          </label>
          <label>
            {t('invoicing.postes.groupDescription')}
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        <div className="invoicing-form-section">
          <h3>{t('invoicing.postes.groupSelectPostes')}</h3>
          <div className="invoicing-form-grid">
            <div>
              <h4>{t('invoicing.postes.materielTitle')}</h4>
              {groupedPostes.materiel.map((poste) => (
                <label key={poste.id} className="invoicing-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(poste.id)}
                    onChange={() => toggleSelection(poste.id)}
                  />
                  <span>{poste.designation}</span>
                </label>
              ))}
              {groupedPostes.materiel.length === 0 && (
                <div className="invoicing-empty">{t('invoicing.postes.empty')}</div>
              )}
            </div>
            <div>
              <h4>{t('invoicing.postes.travailTitle')}</h4>
              {groupedPostes.travail.map((poste) => (
                <label key={poste.id} className="invoicing-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(poste.id)}
                    onChange={() => toggleSelection(poste.id)}
                  />
                  <span>{poste.designation}</span>
                </label>
              ))}
              {groupedPostes.travail.length === 0 && (
                <div className="invoicing-empty">{t('invoicing.postes.empty')}</div>
              )}
            </div>
          </div>
        </div>
        <div className="invoicing-actions">
          <button type="button" className="primary" onClick={handleSave}>
            {t('common.save')}
          </button>
          {status && <span className="status">{status}</span>}
        </div>
      </div>
    </div>
  );
};
