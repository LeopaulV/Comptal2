import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteFacture, PosteMateriel, PosteTravail } from '../../../types/Invoice';
import { PosteService } from '../../../services/PosteService';
import { SecteurActivite, SecteurService } from '../../../services/SecteurService';
import { StockService } from '../../../services/StockService';
import { ArticleStock } from '../../../types/Stock';
import { TAUX_TVA, UNITES_MESURE } from '../../../constants/invoicingConstants';

export const PostesList: React.FC = () => {
  const { t } = useTranslation();
  const [postes, setPostes] = useState<PosteFacture[]>([]);
  const [secteurs, setSecteurs] = useState<SecteurActivite[]>([]);
  const [stockArticles, setStockArticles] = useState<ArticleStock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PosteFacture | null>(null);

  useEffect(() => {
    SecteurService.loadSecteurs().then(setSecteurs);
  }, []);

  useEffect(() => {
    if (draft?.type === 'materiel') {
      StockService.loadArticles().then((arts) => {
        setStockArticles(arts.filter((a) => a.type === 'stock' || a.type === 'consommable'));
      });
    }
  }, [draft?.type]);

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

  const handleArticleRefChange = (articleId: string) => {
    if (!draft || draft.type !== 'materiel') return;
    const pm = draft as PosteMateriel;
    const next = { ...pm, articleRefId: articleId || undefined };
    if (!articleId) {
      setDraft(next);
      return;
    }
    const article = stockArticles.find((a) => a.id === articleId);
    if (article) {
      if (!pm.designation?.trim()) next.designation = article.designation;
      if (!pm.reference?.trim()) next.reference = article.reference;
      if (!pm.fournisseur?.trim()) next.fournisseur = article.fournisseur;
      if (!pm.factureRef?.trim()) next.factureRef = article.factureRef;
      if (!pm.unite || pm.unite === 'unite') next.unite = article.unite || 'unite';
      if (pm.tauxTVA === 20) next.tauxTVA = article.tauxTVA ?? 20;
      if (!pm.prixUnitaireHT) next.prixUnitaireHT = article.valeurAcquisitionHT ?? 0;
    }
    setDraft(next);
  };

  const handleSave = async () => {
    if (!draft) return;
    await PosteService.updatePoste(draft.id, draft);
    const pm = draft as PosteMateriel;
    if (draft.type === 'materiel' && pm.articleRefId) {
      const article = stockArticles.find((a) => a.id === pm.articleRefId);
      if (article) {
        const now = new Date();
        await StockService.upsertArticle({
          ...article,
          designation: pm.designation,
          reference: pm.reference || undefined,
          fournisseur: pm.fournisseur || undefined,
          factureRef: pm.factureRef || undefined,
          unite: pm.unite,
          tauxTVA: pm.tauxTVA,
          updatedAt: now,
        });
      }
    }
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
                <label style={{ gridColumn: '1 / -1' }}>
                  {t('invoicing.postes.articleRef')}
                  <select
                    value={(draft as PosteMateriel).articleRefId || ''}
                    onChange={(e) => handleArticleRefChange(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8 }}
                  >
                    <option value="">— {t('invoicing.postes.articleRefPlaceholder')} —</option>
                    {stockArticles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.designation} {a.reference ? `(${a.reference})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('invoicing.postes.numeroArticle')}
                  <input
                    type="text"
                    value={(draft as PosteMateriel).numeroArticle || ''}
                    onChange={(e) => setDraft({ ...draft, numeroArticle: e.target.value || undefined } as PosteMateriel)}
                  />
                </label>
                <label>
                  {t('invoicing.postes.numeroLot')}
                  <input
                    type="text"
                    value={(draft as PosteMateriel).numeroLot || ''}
                    onChange={(e) => setDraft({ ...draft, numeroLot: e.target.value || undefined } as PosteMateriel)}
                  />
                </label>
                <label>
                  {t('invoicing.postes.reference')}
                  <input
                    type="text"
                    value={(draft as PosteMateriel).reference || ''}
                    onChange={(e) => setDraft({ ...draft, reference: e.target.value || undefined } as PosteMateriel)}
                  />
                </label>
                <label>
                  {t('invoicing.postes.fournisseur')}
                  <input
                    type="text"
                    value={(draft as PosteMateriel).fournisseur || ''}
                    onChange={(e) => setDraft({ ...draft, fournisseur: e.target.value || undefined } as PosteMateriel)}
                    placeholder={t('invoicing.postes.optional')}
                  />
                </label>
                <label>
                  {t('invoicing.postes.factureRef')}
                  <input
                    type="text"
                    value={(draft as PosteMateriel).factureRef || ''}
                    onChange={(e) => setDraft({ ...draft, factureRef: e.target.value || undefined } as PosteMateriel)}
                    placeholder={t('invoicing.postes.optional')}
                  />
                </label>
                <label>
                  {t('invoicing.postes.description')}
                  <input
                    type="text"
                    value={(draft as PosteMateriel).description || ''}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined } as PosteMateriel)}
                  />
                </label>
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
                <label>
                  {t('invoicing.postes.unit')}
                  <select
                    value={(draft as PosteMateriel).unite}
                    onChange={(e) => setDraft({ ...draft, unite: e.target.value } as PosteMateriel)}
                  >
                    {UNITES_MESURE.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('invoicing.postes.remise')}
                  <input
                    type="number"
                    value={(draft as PosteMateriel).remise ?? ''}
                    onChange={(e) => setDraft({ ...draft, remise: e.target.value ? Number(e.target.value) : undefined } as PosteMateriel)}
                    placeholder="%"
                  />
                </label>
                <label>
                  {t('invoicing.postes.fraisTransport')}
                  <input
                    type="number"
                    value={(draft as PosteMateriel).fraisTransport ?? ''}
                    onChange={(e) => setDraft({ ...draft, fraisTransport: e.target.value ? Number(e.target.value) : undefined } as PosteMateriel)}
                    placeholder="€"
                  />
                </label>
                <label>
                  {t('invoicing.postes.marge')}
                  <input
                    type="number"
                    value={(draft as PosteMateriel).marge ?? ''}
                    onChange={(e) => setDraft({ ...draft, marge: e.target.value ? Number(e.target.value) : undefined } as PosteMateriel)}
                    placeholder="%"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  {t('invoicing.postes.description')}
                  <input
                    type="text"
                    value={(draft as PosteTravail).description || ''}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value || undefined } as PosteTravail)}
                  />
                </label>
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
                <label>
                  {t('invoicing.postes.intervenants')}
                  <input
                    type="number"
                    value={draft.nombreIntervenants}
                    onChange={(e) => setDraft({ ...draft, nombreIntervenants: Number(e.target.value) })}
                  />
                </label>
                <label>
                  {t('invoicing.postes.marge')}
                  <input
                    type="number"
                    value={(draft as PosteTravail).marge ?? ''}
                    onChange={(e) => setDraft({ ...draft, marge: e.target.value ? Number(e.target.value) : undefined } as PosteTravail)}
                    placeholder="%"
                  />
                </label>
                <label>
                  {t('invoicing.postes.fraisDeplacement')}
                  <input
                    type="number"
                    value={(draft as PosteTravail).fraisDeplacement ?? ''}
                    onChange={(e) => setDraft({ ...draft, fraisDeplacement: e.target.value ? Number(e.target.value) : undefined } as PosteTravail)}
                    placeholder="€"
                  />
                </label>
                {draft.type === 'travail' && (
                  <label className="invoicing-full-width">
                    {t('invoicing.postes.tachesTitle')}
                    <textarea
                      rows={3}
                      value={((draft as PosteTravail).taches || []).join('\n')}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          taches: e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        } as PosteTravail)
                      }
                    />
                  </label>
                )}
                {secteurs.length > 0 && (
                  <div className="invoicing-full-width">
                    <h4>{t('invoicing.postes.secteursSelect')}</h4>
                    <div className="invoicing-checkbox-list">
                      {secteurs.map((s) => (
                        <label key={s.id} className="invoicing-checkbox">
                          <input
                            type="checkbox"
                            checked={((draft as PosteTravail).secteursIds || []).includes(s.id)}
                            onChange={() => {
                              const ids = (draft as PosteTravail).secteursIds || [];
                              const next = ids.includes(s.id) ? ids.filter((id) => id !== s.id) : [...ids, s.id];
                              setDraft({ ...draft, secteursIds: next } as PosteTravail);
                            }}
                          />
                          <span>{s.nom}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <label>
              {t('invoicing.postes.tva')}
              <select value={draft.tauxTVA} onChange={(e) => setDraft({ ...draft, tauxTVA: Number(e.target.value) })}>
                {TAUX_TVA.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
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
