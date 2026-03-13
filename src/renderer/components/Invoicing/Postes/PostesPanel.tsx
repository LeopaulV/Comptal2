import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteFacture, PosteMateriel, PosteTravail } from '../../../types/Invoice';
import { usePosteService } from '../../../contexts/PosteServiceContext';
import { PostesGroupesList } from './PostesGroupesList';
import { PosteGroupeModal } from './PosteGroupeModal';
import { PosteMaterielForm } from './PosteMaterielForm';
import { PosteTravailForm } from './PosteTravailForm';
import { PosteMaterielRow } from './PosteMaterielRow';
import { PosteServiceRow } from './PosteServiceRow';

export const PostesPanel: React.FC = () => {
  const { t } = useTranslation();
  const posteService = usePosteService();
  const [postes, setPostes] = useState<PosteFacture[]>([]);
  const [isGroupeModalOpen, setIsGroupeModalOpen] = useState(false);
  const [isMaterielModalOpen, setIsMaterielModalOpen] = useState(false);
  const [isTravailModalOpen, setIsTravailModalOpen] = useState(false);
  const [editingMateriel, setEditingMateriel] = useState<PosteMateriel | null>(null);
  const [editingTravail, setEditingTravail] = useState<PosteTravail | null>(null);

  const loadPostes = async () => {
    const data = await posteService.loadPostes();
    setPostes(data);
  };

  useEffect(() => {
    loadPostes();
    const handler = () => loadPostes();
    window.addEventListener('postes-updated', handler);
    return () => window.removeEventListener('postes-updated', handler);
  }, []);

  const materiel = postes.filter((poste) => poste.type === 'materiel') as PosteMateriel[];
  const travail = postes.filter((poste) => poste.type === 'travail') as PosteTravail[];

  const handleDelete = async (id: string) => {
    await posteService.deletePoste(id);
    await loadPostes();
  };

  const closeEditModals = () => {
    setEditingMateriel(null);
    setEditingTravail(null);
  };

  return (
    <div className="invoicing-panel">
      <PostesGroupesList onAddGroupe={() => setIsGroupeModalOpen(true)} />
      <div className="invoicing-form-grid">
        <div className="invoicing-card">
          <div className="invoicing-header-row">
            <h2>{t('invoicing.postes.materielTitle')}</h2>
            <button type="button" className="primary" onClick={() => { setEditingMateriel(null); setIsMaterielModalOpen(true); }}>
              {t('invoicing.postes.add')}
            </button>
          </div>
          <div className="invoicing-list poste-list">
            {materiel.map((poste) => (
              <PosteMaterielRow
                key={poste.id}
                poste={poste}
                onEdit={() => setEditingMateriel(poste)}
                onDelete={() => handleDelete(poste.id)}
              />
            ))}
            {materiel.length === 0 && <div className="invoicing-empty">{t('invoicing.postes.empty')}</div>}
          </div>
        </div>
        <div className="invoicing-card">
          <div className="invoicing-header-row">
            <h2>{t('invoicing.postes.servicesTitle')}</h2>
            <button type="button" className="primary" onClick={() => { setEditingTravail(null); setIsTravailModalOpen(true); }}>
              {t('invoicing.postes.add')}
            </button>
          </div>
          <div className="invoicing-list poste-list">
            {travail.map((poste) => (
              <PosteServiceRow
                key={poste.id}
                poste={poste}
                onEdit={() => setEditingTravail(poste)}
                onDelete={() => handleDelete(poste.id)}
              />
            ))}
            {travail.length === 0 && <div className="invoicing-empty">{t('invoicing.postes.empty')}</div>}
          </div>
        </div>
      </div>

      <PosteGroupeModal isOpen={isGroupeModalOpen} onClose={() => setIsGroupeModalOpen(false)} />

      {isMaterielModalOpen && !editingMateriel && (
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

      {isTravailModalOpen && !editingTravail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="invoicing-header-row">
              <h2>{t('invoicing.postes.newService')}</h2>
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

      {editingMateriel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="invoicing-header-row">
              <h2>{t('invoicing.postes.editPoste')} – {editingMateriel.designation}</h2>
              <button type="button" className="secondary" onClick={closeEditModals}>
                {t('common.close')}
              </button>
            </div>
            <PosteMaterielForm
              initialPoste={editingMateriel}
              onSaved={() => {
                setEditingMateriel(null);
                loadPostes();
              }}
              onCancel={closeEditModals}
            />
          </div>
        </div>
      )}

      {editingTravail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="invoicing-header-row">
              <h2>{t('invoicing.postes.editPoste')} – {editingTravail.designation}</h2>
              <button type="button" className="secondary" onClick={closeEditModals}>
                {t('common.close')}
              </button>
            </div>
            <PosteTravailForm
              initialPoste={editingTravail}
              onSaved={() => {
                setEditingTravail(null);
                loadPostes();
              }}
              onCancel={closeEditModals}
            />
          </div>
        </div>
      )}
    </div>
  );
};
