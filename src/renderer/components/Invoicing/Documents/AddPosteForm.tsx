import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteFacture, PosteMateriel, PosteTravail } from '../../../types/Invoice';
import { PosteService } from '../../../services/PosteService';
import { SecteurActivite, SecteurService } from '../../../services/SecteurService';
import { StockService } from '../../../services/StockService';
import { ArticleStock } from '../../../types/Stock';
import { TAUX_TVA, UNITES_MESURE } from '../../../constants/invoicingConstants';

type PosteType = 'materiel' | 'travail';

interface AddPosteFormProps {
  devisForFacture?: boolean;
  onAdd: (poste: PosteFacture) => void;
}

export const AddPosteForm: React.FC<AddPosteFormProps> = ({ devisForFacture, onAdd }) => {
  const { t } = useTranslation();
  const [posteType, setPosteType] = useState<PosteType>('materiel');
  const [addToCatalogue, setAddToCatalogue] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Materiel fields
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
  const [articleRefId, setArticleRefId] = useState('');
  const [fournisseur, setFournisseur] = useState('');
  const [factureRef, setFactureRef] = useState('');
  const [stockArticles, setStockArticles] = useState<ArticleStock[]>([]);

  // Travail fields
  const [secteurs, setSecteurs] = useState<SecteurActivite[]>([]);
  const [tauxHoraire, setTauxHoraire] = useState('');
  const [heures, setHeures] = useState('1');
  const [intervenants, setIntervenants] = useState('1');
  const [fraisDeplacement, setFraisDeplacement] = useState('');
  const [taches, setTaches] = useState<string[]>([]);
  const [newTache, setNewTache] = useState('');
  const [selectedSecteursIds, setSelectedSecteursIds] = useState<string[]>([]);

  useEffect(() => {
    SecteurService.loadSecteurs().then(setSecteurs);
  }, []);

  useEffect(() => {
    if (posteType === 'materiel') {
      StockService.loadArticles().then((arts) => {
        setStockArticles(arts.filter((a) => a.type === 'stock' || a.type === 'consommable'));
      });
    }
  }, [posteType]);

  const handleArticleRefChange = (articleId: string) => {
    setArticleRefId(articleId);
    if (!articleId) return;
    const article = stockArticles.find((a) => a.id === articleId);
    if (article) {
      setDesignation(article.designation);
      setReference(article.reference || '');
      setFournisseur(article.fournisseur || '');
      setFactureRef(article.factureRef || '');
      setUnite(article.unite || 'unite');
      setTva(String(article.tauxTVA ?? 20));
      setPrixUnitaire(String(article.valeurAcquisitionHT ?? ''));
    }
  };

  const resetMaterielForm = () => {
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
    setArticleRefId('');
    setFournisseur('');
    setFactureRef('');
  };

  const resetTravailForm = () => {
    setDesignation('');
    setDescription('');
    setTauxHoraire('');
    setHeures('1');
    setIntervenants('1');
    setMarge('');
    setFraisDeplacement('');
    setTaches([]);
    setSelectedSecteursIds([]);
    setTva('20');
  };

  const resetForm = () => {
    if (posteType === 'materiel') resetMaterielForm();
    else resetTravailForm();
    setStatus(null);
  };

  const addTache = () => {
    if (newTache.trim()) {
      setTaches((prev) => [...prev, newTache.trim()]);
      setNewTache('');
    }
  };

  const removeTache = (index: number) => {
    setTaches((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSecteur = (id: string) => {
    setSelectedSecteursIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleAddMateriel = () => {
    if (!designation || !prixUnitaire) {
      setStatus(t('invoicing.postes.required'));
      return;
    }
    const lineId = `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const poste: PosteMateriel = {
      id: lineId,
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

    onAdd(poste);

    if (addToCatalogue) {
      const cataloguePoste: PosteMateriel = {
        ...poste,
        id: `poste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      PosteService.addPoste(cataloguePoste).then(async () => {
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
        window.dispatchEvent(new CustomEvent('postes-updated'));
      });
    }

    resetForm();
  };

  const handleAddTravail = () => {
    if (!designation || !tauxHoraire) {
      setStatus(t('invoicing.postes.required'));
      return;
    }
    const lineId = `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const poste: PosteTravail = {
      id: lineId,
      type: 'travail',
      designation,
      tauxHoraire: Number(tauxHoraire),
      heuresEstimees: Number(heures) || 1,
      nombreIntervenants: Number(intervenants) || 1,
      tauxTVA: Number(tva),
    };
    if (description.trim()) poste.description = description.trim();
    if (marge) poste.marge = Number(marge);
    if (fraisDeplacement) poste.fraisDeplacement = Number(fraisDeplacement);
    if (taches.length > 0) poste.taches = taches;
    if (selectedSecteursIds.length > 0) poste.secteursIds = selectedSecteursIds;

    onAdd(poste);

    if (addToCatalogue) {
      const cataloguePoste: PosteTravail = {
        ...poste,
        id: `poste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      PosteService.addPoste(cataloguePoste).then(() => {
        window.dispatchEvent(new CustomEvent('postes-updated'));
      });
    }

    resetForm();
  };

  const handleSubmit = () => {
    if (posteType === 'materiel') handleAddMateriel();
    else handleAddTravail();
  };

  return (
    <div className="add-poste-form">
      <div className="add-poste-tabs">
        <button
          type="button"
          className={posteType === 'materiel' ? 'active' : 'secondary'}
          onClick={() => setPosteType('materiel')}
        >
          {t('invoicing.postes.materielTitle')}
        </button>
        <button
          type="button"
          className={posteType === 'travail' ? 'active' : 'secondary'}
          onClick={() => setPosteType('travail')}
        >
          {t('invoicing.postes.servicesTitle')}
        </button>
      </div>

      {posteType === 'materiel' ? (
        <div className="invoicing-form-grid">
          <label style={{ gridColumn: '1 / -1' }}>
            {t('invoicing.postes.articleRef')}
            <select
              value={articleRefId}
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
      ) : (
        <>
          <div className="invoicing-form-grid">
            <label>
              {t('invoicing.postes.designation')}
              <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </label>
            <label>
              {t('invoicing.postes.description')}
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('invoicing.postes.optional')} />
            </label>
            <label>
              {t('invoicing.postes.hourlyRate')}
              <input type="number" value={tauxHoraire} onChange={(e) => setTauxHoraire(e.target.value)} />
            </label>
            <label>
              {t('invoicing.postes.hours')}
              <input type="number" value={heures} onChange={(e) => setHeures(e.target.value)} />
            </label>
            <label>
              {t('invoicing.postes.intervenants')}
              <input type="number" value={intervenants} onChange={(e) => setIntervenants(e.target.value)} />
            </label>
            <label>
              {t('invoicing.postes.marge')}
              <input type="number" value={marge} onChange={(e) => setMarge(e.target.value)} placeholder="%" />
            </label>
            <label>
              {t('invoicing.postes.fraisDeplacement')}
              <input type="number" value={fraisDeplacement} onChange={(e) => setFraisDeplacement(e.target.value)} placeholder="€" />
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
          <div className="invoicing-form-section">
            <h3>{t('invoicing.postes.tachesTitle')}</h3>
            <div className="invoicing-inline-form">
              <input
                type="text"
                value={newTache}
                onChange={(e) => setNewTache(e.target.value)}
                placeholder={t('invoicing.postes.tachePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTache())}
              />
              <button type="button" className="secondary" onClick={addTache}>
                {t('invoicing.postes.addTache')}
              </button>
            </div>
            <ul className="invoicing-taches-list">
              {taches.map((tache, i) => (
                <li key={i}>
                  <span>{tache}</span>
                  <button type="button" className="invoicing-icon-button" onClick={() => removeTache(i)}>
                    {t('common.delete')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {secteurs.length > 0 && (
            <div className="invoicing-form-section">
              <h3>{t('invoicing.postes.secteursSelect')}</h3>
              <div className="invoicing-checkbox-list">
                {secteurs.map((s) => (
                  <label key={s.id} className="invoicing-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSecteursIds.includes(s.id)}
                      onChange={() => toggleSecteur(s.id)}
                    />
                    <span>{s.nom}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!devisForFacture && (
        <label className="add-poste-catalogue-checkbox">
          <input
            type="checkbox"
            checked={addToCatalogue}
            onChange={(e) => setAddToCatalogue(e.target.checked)}
          />
          <span>{t('invoicing.documents.addToCatalogue')}</span>
        </label>
      )}

      <div className="invoicing-actions">
        <button type="button" className="primary" onClick={handleSubmit}>
          {t('invoicing.documents.addCustomPoste')}
        </button>
      </div>
      {status && <div className="status">{status}</div>}
    </div>
  );
};
