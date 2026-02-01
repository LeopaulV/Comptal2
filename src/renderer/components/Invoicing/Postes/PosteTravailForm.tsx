import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PosteService } from '../../../services/PosteService';
import { TAUX_TVA } from '../../../constants/invoicingConstants';

interface PosteTravailFormProps {
  onSaved?: () => void;
}

export const PosteTravailForm: React.FC<PosteTravailFormProps> = ({ onSaved }) => {
  const { t } = useTranslation();
  const [designation, setDesignation] = useState('');
  const [tauxHoraire, setTauxHoraire] = useState('');
  const [heures, setHeures] = useState('1');
  const [intervenants, setIntervenants] = useState('1');
  const [tva, setTva] = useState('20');
  const [status, setStatus] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!designation || !tauxHoraire) {
      setStatus(t('invoicing.postes.required'));
      return;
    }
    await PosteService.addPoste({
      id: `poste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'travail',
      designation,
      tauxHoraire: Number(tauxHoraire),
      heuresEstimees: Number(heures) || 1,
      nombreIntervenants: Number(intervenants) || 1,
      tauxTVA: Number(tva),
    });
    setDesignation('');
    setTauxHoraire('');
    setHeures('1');
    setIntervenants('1');
    setTva('20');
    setStatus(t('invoicing.postes.saved'));
    window.dispatchEvent(new CustomEvent('postes-updated'));
    onSaved?.();
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.postes.travailTitle')}</h2>
      <div className="invoicing-form-grid">
        <label>
          {t('invoicing.postes.designation')}
          <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} />
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
