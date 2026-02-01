import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteService } from '../../../services/PosteService';
import { TAUX_TVA, UNITES_MESURE } from '../../../constants/invoicingConstants';

interface PosteMaterielFormProps {
  onSaved?: () => void;
}

export const PosteMaterielForm: React.FC<PosteMaterielFormProps> = ({ onSaved }) => {
  const { t } = useTranslation();
  const [designation, setDesignation] = useState('');
  const [prixUnitaire, setPrixUnitaire] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [tva, setTva] = useState('20');
  const [unite, setUnite] = useState('unite');
  const [status, setStatus] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!designation || !prixUnitaire) {
      setStatus(t('invoicing.postes.required'));
      return;
    }
    await PosteService.addPoste({
      id: `poste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'materiel',
      designation,
      prixUnitaireHT: Number(prixUnitaire),
      quantite: Number(quantite) || 1,
      unite,
      tauxTVA: Number(tva),
    });
    setDesignation('');
    setPrixUnitaire('');
    setQuantite('1');
    setUnite('unite');
    setTva('20');
    setStatus(t('invoicing.postes.saved'));
    window.dispatchEvent(new CustomEvent('postes-updated'));
    onSaved?.();
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.postes.materielTitle')}</h2>
      <div className="invoicing-form-grid">
        <label>
          {t('invoicing.postes.designation')}
          <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} />
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
      <button type="button" className="primary" onClick={handleAdd}>
        {t('invoicing.postes.add')}
      </button>
      {status && <div className="status">{status}</div>}
    </div>
  );
};
