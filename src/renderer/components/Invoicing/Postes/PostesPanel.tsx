import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteFacture } from '../../../types/Invoice';
import { PosteService } from '../../../services/PosteService';
import { PostesGroupesList } from './PostesGroupesList';
import { PosteGroupeModal } from './PosteGroupeModal';
import { PosteMaterielForm } from './PosteMaterielForm';
import { PosteTravailForm } from './PosteTravailForm';

export const PostesPanel: React.FC = () => {
  const { t } = useTranslation();
  const [postes, setPostes] = useState<PosteFacture[]>([]);
  const [isGroupeModalOpen, setIsGroupeModalOpen] = useState(false);
  const [isMaterielModalOpen, setIsMaterielModalOpen] = useState(false);
  const [isTravailModalOpen, setIsTravailModalOpen] = useState(false);

  const loadPostes = async () => {
    const data = await PosteService.loadPostes();
    setPostes(data);
  };

  useEffect(() => {
    loadPostes();
    const handler = () => loadPostes();
    window.addEventListener('postes-updated', handler);
    return () => window.removeEventListener('postes-updated', handler);
  }, []);

  const materiel = postes.filter((poste) => poste.type === 'materiel');
  const travail = postes.filter((poste) => poste.type === 'travail');

  const handleDelete = async (id: string) => {
    await PosteService.deletePoste(id);
    await loadPostes();
  };

  return (
    <div className="invoicing-panel">
      <PostesGroupesList onAddGroupe={() => setIsGroupeModalOpen(true)} />
      <div className="invoicing-form-grid">
        <div className="invoicing-card">
          <div className="invoicing-header-row">
            <h2>{t('invoicing.postes.materielTitle')}</h2>
            <button type="button" className="primary" onClick={() => setIsMaterielModalOpen(true)}>
              {t('invoicing.postes.add')}
            </button>
          </div>
          <div className="invoicing-list">
            {materiel.map((poste) => (
              <div key={poste.id} className="invoicing-list-item">
                <div>
                  <div className="name">{poste.designation}</div>
                  <div className="meta">
                    {poste.prixUnitaireHT} € x {poste.quantite}
                  </div>
                </div>
                <div className="invoicing-list-item-actions">
                  <button type="button" className="invoicing-icon-button" onClick={() => handleDelete(poste.id)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
            {materiel.length === 0 && <div className="invoicing-empty">{t('invoicing.postes.empty')}</div>}
          </div>
        </div>
        <div className="invoicing-card">
          <div className="invoicing-header-row">
            <h2>{t('invoicing.postes.travailTitle')}</h2>
            <button type="button" className="primary" onClick={() => setIsTravailModalOpen(true)}>
              {t('invoicing.postes.add')}
            </button>
          </div>
          <div className="invoicing-list">
            {travail.map((poste) => (
              <div key={poste.id} className="invoicing-list-item">
                <div>
                  <div className="name">{poste.designation}</div>
                  <div className="meta">
                    {poste.tauxHoraire} €/h x {poste.heuresEstimees}
                  </div>
                </div>
                <div className="invoicing-list-item-actions">
                  <button type="button" className="invoicing-icon-button" onClick={() => handleDelete(poste.id)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
            {travail.length === 0 && <div className="invoicing-empty">{t('invoicing.postes.empty')}</div>}
          </div>
        </div>
      </div>

      <PosteGroupeModal isOpen={isGroupeModalOpen} onClose={() => setIsGroupeModalOpen(false)} />

      {isMaterielModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="invoicing-header-row">
              <h2>{t('invoicing.postes.newMateriel')}</h2>
              <button type="button" className="secondary" onClick={() => setIsMaterielModalOpen(false)}>
                {t('common.close')}
              </button>
            </div>
            <PosteMaterielForm
              onSaved={() => {
                setIsMaterielModalOpen(false);
                loadPostes();
              }}
            />
          </div>
        </div>
      )}

      {isTravailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="invoicing-header-row">
              <h2>{t('invoicing.postes.newTravail')}</h2>
              <button type="button" className="secondary" onClick={() => setIsTravailModalOpen(false)}>
                {t('common.close')}
              </button>
            </div>
            <PosteTravailForm
              onSaved={() => {
                setIsTravailModalOpen(false);
                loadPostes();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
