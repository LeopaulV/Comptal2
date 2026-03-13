import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SecteurActivite, SecteurService } from '../../../services/SecteurService';

export const SecteursList: React.FC = () => {
  const { t } = useTranslation();
  const [secteurs, setSecteurs] = useState<SecteurActivite[]>([]);
  const [newNom, setNewNom] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const loadSecteurs = async () => {
    const data = await SecteurService.loadSecteurs();
    setSecteurs([...data].sort((a, b) => a.ordre - b.ordre));
  };

  useEffect(() => {
    loadSecteurs();
    const handler = () => {
      SecteurService.invalidateCache();
      loadSecteurs();
    };
    window.addEventListener('secteurs-updated', handler);
    return () => window.removeEventListener('secteurs-updated', handler);
  }, []);

  const handleAdd = async () => {
    if (!newNom.trim()) {
      setStatus(t('invoicing.postes.secteursRequired'));
      return;
    }
    const maxOrdre = secteurs.length > 0 ? Math.max(...secteurs.map((s) => s.ordre)) : 0;
    await SecteurService.addSecteur({
      id: `secteur-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nom: newNom.trim(),
      ordre: maxOrdre + 1,
    });
    window.dispatchEvent(new CustomEvent('secteurs-updated'));
    setNewNom('');
    setStatus(null);
    await loadSecteurs();
  };

  const handleDelete = async (id: string) => {
    await SecteurService.deleteSecteur(id);
    window.dispatchEvent(new CustomEvent('secteurs-updated'));
    await loadSecteurs();
  };

  return (
    <div className="invoicing-card">
      <div className="invoicing-header-row">
        <h2>{t('invoicing.postes.secteursTitle')}</h2>
      </div>
      <p className="invoicing-hint">{t('invoicing.postes.secteursHint')}</p>
      <div className="invoicing-inline-form">
        <input
          type="text"
          value={newNom}
          onChange={(e) => setNewNom(e.target.value)}
          placeholder={t('invoicing.postes.secteurName')}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button type="button" className="primary" onClick={handleAdd}>
          {t('invoicing.postes.addSecteur')}
        </button>
      </div>
      {status && <div className="status">{status}</div>}
      <div className="invoicing-list">
        {secteurs.map((secteur) => (
          <div key={secteur.id} className="invoicing-list-item">
            <div className="name">{secteur.nom}</div>
            <div className="invoicing-list-item-actions">
              <button type="button" className="invoicing-icon-button" onClick={() => handleDelete(secteur.id)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
        {secteurs.length === 0 && <div className="invoicing-empty">{t('invoicing.postes.secteursEmpty')}</div>}
      </div>
    </div>
  );
};
