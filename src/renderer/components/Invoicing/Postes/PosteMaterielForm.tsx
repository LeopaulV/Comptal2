import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteMateriel } from '../../../types/Invoice';
import { usePosteService } from '../../../contexts/PosteServiceContext';
import { TAUX_TVA, UNITES_MESURE } from '../../../constants/invoicingConstants';
import { ArticleStock } from '../../../types/Stock';
import { StockService } from '../../../services/StockService';

interface PosteMaterielFormProps {
  initialPoste?: PosteMateriel;
  onSaved?: () => void;
  onCancel?: () => void;
}

export const PosteMaterielForm: React.FC<PosteMaterielFormProps> = ({ initialPoste, onSaved, onCancel }) => {
  const { t } = useTranslation();
  const posteService = usePosteService();
  const isEdit = !!initialPoste;
  const [designation, setDesignation] = useState('');
  const [numeroArticle, setNumeroArticle] = useState('');
  const [numeroLot, setNumeroLot] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [prixUnitaire, setPrixUnitaire] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [unite, setUnite] = useState('unite');
  const [remise, setRemise] = useState('');
  const [fraisTransport, setFraisTransport] = useState('');
  const [marge, setMarge] = useState('');
  const [tva, setTva] = useState('20');
  const [status, setStatus] = useState<string | null>(null);
  const [stockArticles, setStockArticles] = useState<ArticleStock[]>([]);
  const [articlesLies, setArticlesLies] = useState<{ articleId: string; quantiteParUtilisation: number }[]>([]);
  const [articleRefId, setArticleRefId] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [factureRef, setFactureRef] = useState('');

  useEffect(() => {
    StockService.loadArticles().then((arts) => {
      setStockArticles(arts.filter((a) => a.type === 'stock' || a.type === 'consommable'));
    });
  }, []);

  useEffect(() => {
    if (initialPoste) {
      setDesignation(initialPoste.designation);
      setArticlesLies(initialPoste.articlesLies ?? []);
      setNumeroArticle(initialPoste.numeroArticle || '');
      setNumeroLot(initialPoste.numeroLot || '');
      setReference(initialPoste.reference || '');
      setDescription(initialPoste.description || '');
      setPrixUnitaire(String(initialPoste.prixUnitaireHT));
      setQuantite(String(initialPoste.quantite));
      setUnite(initialPoste.unite);
      setRemise(initialPoste.remise ? String(initialPoste.remise) : '');
      setFraisTransport(initialPoste.fraisTransport ? String(initialPoste.fraisTransport) : '');
      setMarge(initialPoste.marge ? String(initialPoste.marge) : '');
      setTva(String(initialPoste.tauxTVA));
      setArticleRefId(initialPoste.articleRefId || '');
      setFournisseur(initialPoste.fournisseur || '');
      setFactureRef(initialPoste.factureRef || '');
    } else {
      setArticlesLies([]);
      setArticleRefId('');
      setFournisseur('');
      setFactureRef('');
    }
  }, [initialPoste]);

  const resetForm = () => {
    setDesignation('');
    setNumeroArticle('');
    setNumeroLot('');
    setReference('');
    setDescription('');
    setPrixUnitaire('');
    setQuantite('1');
    setUnite('unite');
    setRemise('');
    setFraisTransport('');
    setMarge('');
    setTva('20');
    setArticlesLies([]);
    setArticleRefId('');
    setFournisseur('');
    setFactureRef('');
  };

  const applyArticleToForm = (article: ArticleStock, mergeWithExisting: boolean) => {
    if (!mergeWithExisting) {
      setDesignation(article.designation);
      setReference(article.reference || '');
      setFournisseur(article.fournisseur || '');
      setFactureRef(article.factureRef || '');
      setUnite(article.unite || 'unite');
      setTva(String(article.tauxTVA ?? 20));
      setPrixUnitaire(String(article.valeurAcquisitionHT ?? ''));
    } else {
      if (!designation.trim()) setDesignation(article.designation);
      if (!reference.trim()) setReference(article.reference || '');
      if (!fournisseur.trim()) setFournisseur(article.fournisseur || '');
      if (!factureRef.trim()) setFactureRef(article.factureRef || '');
      if (unite === 'unite' || !unite) setUnite(article.unite || 'unite');
      if (!prixUnitaire.trim()) setPrixUnitaire(String(article.valeurAcquisitionHT ?? ''));
      if (tva === '20') setTva(String(article.tauxTVA ?? 20));
    }
  };

  const handleArticleRefChange = (articleId: string) => {
    setArticleRefId(articleId);
    if (!articleId) return;
    const article = stockArticles.find((a) => a.id === articleId);
    if (article) {
      applyArticleToForm(article, isEdit);
    }
  };

  const handleSubmit = async () => {
    if (!designation || !prixUnitaire) {
      setStatus(t('invoicing.postes.required'));
      return;
    }
    const poste: PosteMateriel = {
      id: initialPoste?.id || `poste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'materiel',
      designation,
      prixUnitaireHT: Number(prixUnitaire),
      quantite: Number(quantite) || 1,
      unite,
      tauxTVA: Number(tva),
    };
    if (numeroArticle.trim()) poste.numeroArticle = numeroArticle.trim();
    if (numeroLot.trim()) poste.numeroLot = numeroLot.trim();
    if (reference.trim()) poste.reference = reference.trim();
    if (description.trim()) poste.description = description.trim();
    if (remise) poste.remise = Number(remise);
    if (fraisTransport) poste.fraisTransport = Number(fraisTransport);
    if (marge) poste.marge = Number(marge);
    if (articleRefId.trim()) poste.articleRefId = articleRefId.trim();
    if (fournisseur.trim()) poste.fournisseur = fournisseur.trim();
    if (factureRef.trim()) poste.factureRef = factureRef.trim();
    if (articlesLies.length > 0) {
      poste.articlesLies = articlesLies.filter((l) => l.articleId && l.quantiteParUtilisation > 0);
    }

    if (isEdit) {
      await posteService.updatePoste(poste.id, poste);
    } else {
      await posteService.addPoste(poste);
      resetForm();
    }

    if (articleRefId.trim()) {
      const article = stockArticles.find((a) => a.id === articleRefId);
      if (article) {
        const now = new Date();
        await StockService.upsertArticle({
          ...article,
          designation,
          reference: reference.trim() || undefined,
          fournisseur: fournisseur.trim() || undefined,
          factureRef: factureRef.trim() || undefined,
          unite,
          tauxTVA: Number(tva),
          updatedAt: now,
        });
      }
    }

    setStatus(t('invoicing.postes.saved'));
    window.dispatchEvent(new CustomEvent('postes-updated'));
    onSaved?.();
  };

  return (
    <div className="invoicing-card">
      {!isEdit && <h2>{t('invoicing.postes.materielTitle')}</h2>}
      <div className="invoicing-form-grid">
        <label className="invoicing-full-width" style={{ gridColumn: '1 / -1' }}>
          {t('invoicing.postes.articleRef')}
          <select
            value={articleRefId}
            onChange={(e) => handleArticleRefChange(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8 }}
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
          {t('invoicing.postes.designation')}
          <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} />
        </label>
        <label>
          {t('invoicing.postes.numeroArticle')}
          <input type="text" value={numeroArticle} onChange={(e) => setNumeroArticle(e.target.value)} placeholder={t('invoicing.postes.optional')} />
        </label>
        <label>
          {t('invoicing.postes.numeroLot')}
          <input type="text" value={numeroLot} onChange={(e) => setNumeroLot(e.target.value)} placeholder={t('invoicing.postes.optional')} />
        </label>
        <label>
          {t('invoicing.postes.reference')}
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('invoicing.postes.optional')} />
        </label>
        <label>
          {t('invoicing.postes.fournisseur')}
          <input type="text" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} placeholder={t('invoicing.postes.optional')} />
        </label>
        <label>
          {t('invoicing.postes.factureRef')}
          <input type="text" value={factureRef} onChange={(e) => setFactureRef(e.target.value)} placeholder={t('invoicing.postes.optional')} />
        </label>
        <label>
          {t('invoicing.postes.description')}
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('invoicing.postes.optional')} />
        </label>
        <label>
          {t('invoicing.postes.unitPrice')}
          <input type="number" value={prixUnitaire} onChange={(e) => setPrixUnitaire(e.target.value)} />
        </label>
        <label>
          {t('invoicing.postes.quantity')}
          <input type="number" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
        </label>
        <label>
          {t('invoicing.postes.unit')}
          <select value={unite} onChange={(e) => setUnite(e.target.value)}>
            {UNITES_MESURE.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('invoicing.postes.remise')}
          <input type="number" value={remise} onChange={(e) => setRemise(e.target.value)} placeholder="%" />
        </label>
        <label>
          {t('invoicing.postes.fraisTransport')}
          <input type="number" value={fraisTransport} onChange={(e) => setFraisTransport(e.target.value)} placeholder="€" />
        </label>
        <label>
          {t('invoicing.postes.marge')}
          <input type="number" value={marge} onChange={(e) => setMarge(e.target.value)} placeholder="%" />
        </label>
        <label>
          {t('invoicing.postes.tva')}
          <select value={tva} onChange={(e) => setTva(e.target.value)}>
            {TAUX_TVA.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--invoicing-gray-200)' }}>
        <h4 style={{ marginBottom: 12, fontSize: '1rem' }}>{t('invoicing.stock.linkedArticles')}</h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--invoicing-gray-500)', marginBottom: 12 }}>
          {t('invoicing.stock.stockVsDevis')}
        </p>
        {articlesLies.map((link, idx) => (
            <div
              key={`${link.articleId}-${idx}`}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <select
                value={link.articleId}
                onChange={(e) => {
                  const next = [...articlesLies];
                  next[idx] = { ...next[idx], articleId: e.target.value };
                  setArticlesLies(next);
                }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8 }}
              >
                <option value="">— {t('common.select')} —</option>
                {stockArticles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.designation} {a.reference ? `(${a.reference})` : ''}
                  </option>
                ))}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <span style={{ whiteSpace: 'nowrap' }}>{t('invoicing.stock.qtyPerUse')}</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={link.quantiteParUtilisation}
                  onChange={(e) => {
                    const next = [...articlesLies];
                    next[idx] = { ...next[idx], quantiteParUtilisation: Number(e.target.value) || 0 };
                    setArticlesLies(next);
                  }}
                  style={{ width: 80, padding: '6px 8px', borderRadius: 6 }}
                />
              </label>
              <button
                type="button"
                className="secondary"
                style={{ padding: '6px 10px' }}
                onClick={() => setArticlesLies(articlesLies.filter((_, i) => i !== idx))}
              >
                {t('common.delete')}
              </button>
            </div>
        ))}
        <button
          type="button"
          className="secondary"
          style={{ marginTop: 8 }}
          onClick={() => setArticlesLies([...articlesLies, { articleId: '', quantiteParUtilisation: 1 }])}
        >
          + {t('invoicing.stock.addArticleLink')}
        </button>
      </div>

      <div className="invoicing-actions">
        <button type="button" className="primary" onClick={handleSubmit}>
          {isEdit ? t('common.save') : t('invoicing.postes.add')}
        </button>
        {isEdit && onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        )}
      </div>
      {status && <div className="status">{status}</div>}
    </div>
  );
};
