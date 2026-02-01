import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteFacture } from '../../../types/Invoice';
import { PosteService } from '../../../services/PosteService';

export const PostesList: React.FC = () => {
  const { t } = useTranslation();
  const [postes, setPostes] = useState<PosteFacture[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PosteFacture | null>(null);

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

  const startEdit = (poste: PosteFacture) => {
    setEditingId(poste.id);
    setDraft({ ...poste });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    await PosteService.updatePoste(draft.id, draft);
    setEditingId(null);
    setDraft(null);
    await loadPostes();
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.postes.listTitle')}</h2>
      <div className="invoicing-list">
        {postes.map((poste) => (
          <div key={poste.id} className="invoicing-list-item">
            <div>
              <div className="name">{poste.designation}</div>
              <div className="meta">
                {poste.type === 'materiel'
                  ? `${poste.prixUnitaireHT}€ x ${poste.quantite}`
                  : `${poste.tauxHoraire}€/h x ${poste.heuresEstimees}`}
              </div>
            </div>
            <div className="invoicing-list-item-actions">
              <button type="button" className="invoicing-icon-button" onClick={() => startEdit(poste)}>
                {t('common.edit')}
              </button>
              <button type="button" className="invoicing-icon-button" onClick={() => PosteService.deletePoste(poste.id).then(loadPostes)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
        {postes.length === 0 && <div className="invoicing-empty">{t('invoicing.postes.empty')}</div>}
      </div>

      {draft && editingId && (
        <div className="invoicing-form-section">
          <h3>{t('invoicing.postes.editTitle')}</h3>
          <div className="invoicing-form-grid">
            <label>
              {t('invoicing.postes.designation')}
              <input
                type="text"
                value={draft.designation}
                onChange={(e) => setDraft({ ...draft, designation: e.target.value })}
              />
            </label>
            {draft.type === 'materiel' ? (
              <>
                <label>
                  {t('invoicing.postes.unitPrice')}
                  <input
                    type="number"
                    value={draft.prixUnitaireHT}
                    onChange={(e) => setDraft({ ...draft, prixUnitaireHT: Number(e.target.value) })}
                  />
                </label>
                <label>
                  {t('invoicing.postes.quantity')}
                  <input
                    type="number"
                    value={draft.quantite}
                    onChange={(e) => setDraft({ ...draft, quantite: Number(e.target.value) })}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  {t('invoicing.postes.hourlyRate')}
                  <input
                    type="number"
                    value={draft.tauxHoraire}
                    onChange={(e) => setDraft({ ...draft, tauxHoraire: Number(e.target.value) })}
                  />
                </label>
                <label>
                  {t('invoicing.postes.hours')}
                  <input
                    type="number"
                    value={draft.heuresEstimees}
                    onChange={(e) => setDraft({ ...draft, heuresEstimees: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
          </div>
          <div className="invoicing-actions">
            <button type="button" className="primary" onClick={handleSave}>
              {t('common.save')}
            </button>
            <button type="button" className="secondary" onClick={cancelEdit}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
