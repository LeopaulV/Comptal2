import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteTravail } from '../../../types/Invoice';
import { usePosteService } from '../../../contexts/PosteServiceContext';
import { SecteurActivite, SecteurService } from '../../../services/SecteurService';
import { TAUX_TVA } from '../../../constants/invoicingConstants';

interface PosteTravailFormProps {
  initialPoste?: PosteTravail;
  onSaved?: () => void;
  onCancel?: () => void;
}

export const PosteTravailForm: React.FC<PosteTravailFormProps> = ({ initialPoste, onSaved, onCancel }) => {
  const { t } = useTranslation();
  const posteService = usePosteService();
  const isEdit = !!initialPoste;
  const [secteurs, setSecteurs] = useState<SecteurActivite[]>([]);
  const [designation, setDesignation] = useState('');
  const [description, setDescription] = useState('');
  const [tauxHoraire, setTauxHoraire] = useState('');
  const [heures, setHeures] = useState('1');
  const [intervenants, setIntervenants] = useState('1');
  const [marge, setMarge] = useState('');
  const [fraisDeplacement, setFraisDeplacement] = useState('');
  const [taches, setTaches] = useState<string[]>([]);
  const [newTache, setNewTache] = useState('');
  const [selectedSecteursIds, setSelectedSecteursIds] = useState<string[]>([]);
  const [tva, setTva] = useState('20');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    SecteurService.loadSecteurs().then(setSecteurs);
  }, []);

  useEffect(() => {
    if (initialPoste) {
      setDesignation(initialPoste.designation);
      setDescription(initialPoste.description || '');
      setTauxHoraire(String(initialPoste.tauxHoraire));
      setHeures(String(initialPoste.heuresEstimees));
      setIntervenants(String(initialPoste.nombreIntervenants));
      setMarge(initialPoste.marge ? String(initialPoste.marge) : '');
      setFraisDeplacement(initialPoste.fraisDeplacement ? String(initialPoste.fraisDeplacement) : '');
      setTaches(initialPoste.taches || []);
      setSelectedSecteursIds(initialPoste.secteursIds || []);
      setTva(String(initialPoste.tauxTVA));
    }
  }, [initialPoste]);

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

  const handleSubmit = async () => {
    if (!designation || !tauxHoraire) {
      setStatus(t('invoicing.postes.required'));
      return;
    }
    const poste: PosteTravail = {
      id: initialPoste?.id || `poste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

    if (isEdit) {
      await posteService.updatePoste(poste.id, poste);
    } else {
      await posteService.addPoste(poste);
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
    }
    setStatus(t('invoicing.postes.saved'));
    window.dispatchEvent(new CustomEvent('postes-updated'));
    onSaved?.();
  };

  return (
    <div className="invoicing-card">
      {!isEdit && <h2>{t('invoicing.postes.servicesTitle')}</h2>}
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
