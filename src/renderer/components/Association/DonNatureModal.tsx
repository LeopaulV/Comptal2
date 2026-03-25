import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Package, Briefcase, Banknote } from 'lucide-react';
import { Don, NatureDon, ModeVersement, DONATEUR_ANONYME_ID } from '../../types/Association';
import { DonsService } from '../../services/DonsService';

interface DonNatureModalProps {
  isOpen: boolean;
  donateurId: string;
  donateurLabel: string;
  donToEdit?: Don | null;
  onClose: () => void;
  onSaved: () => void;
  /** Si true, affiche le champ "Identité du donateur" pour les dons anonymes */
  allowAnonymous?: boolean;
}

const NATURE_OPTIONS: { value: NatureDon; icon: React.ReactNode; label: string; hint: string }[] = [
  {
    value: 'nature',
    icon: <Package size={18} />,
    label: 'Don en nature',
    hint: 'Objets, matériaux, équipements, nourriture…',
  },
  {
    value: 'mecenat_competences',
    icon: <Briefcase size={18} />,
    label: 'Mécénat de compétences',
    hint: 'Mise à disposition de compétences professionnelles',
  },
  {
    value: 'numeraire',
    icon: <Banknote size={18} />,
    label: 'Don numéraire',
    hint: 'Espèces, chèque, virement (hors import bancaire)',
  },
];

const MODE_OPTIONS: { value: ModeVersement; label: string }[] = [
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'especes', label: 'Espèces' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'prelevement', label: 'Prélèvement' },
  { value: 'autre', label: 'Autre' },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

export const DonNatureModal: React.FC<DonNatureModalProps> = ({
  isOpen,
  donateurId,
  donateurLabel,
  donToEdit,
  onClose,
  onSaved,
  allowAnonymous = false,
}) => {
  const { t } = useTranslation();
  const isAnonymous = donateurId === DONATEUR_ANONYME_ID;

  const [natureDon, setNatureDon] = useState<NatureDon>(donToEdit?.natureDon ?? 'nature');
  const [montant, setMontant] = useState<string>(donToEdit ? String(donToEdit.montant) : '');
  const [date, setDate] = useState<string>(
    donToEdit ? new Date(donToEdit.date).toISOString().slice(0, 10) : todayStr()
  );
  const [datePerception, setDatePerception] = useState<string>(
    donToEdit?.datePerception ? new Date(donToEdit.datePerception).toISOString().slice(0, 10) : ''
  );
  const [description, setDescription] = useState<string>(donToEdit?.description ?? '');
  const [notes, setNotes] = useState<string>(donToEdit?.notes ?? '');
  const [modeVersement, setModeVersement] = useState<ModeVersement | ''>(
    donToEdit?.modeVersement ?? ''
  );
  const [customLabel, setCustomLabel] = useState<string>(
    donToEdit?.donorLabel ?? donateurLabel
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNatureDon(donToEdit?.natureDon ?? 'nature');
      setMontant(donToEdit ? String(donToEdit.montant) : '');
      setDate(donToEdit ? new Date(donToEdit.date).toISOString().slice(0, 10) : todayStr());
      setDatePerception(donToEdit?.datePerception ? new Date(donToEdit.datePerception).toISOString().slice(0, 10) : '');
      setDescription(donToEdit?.description ?? '');
      setNotes(donToEdit?.notes ?? '');
      setModeVersement(donToEdit?.modeVersement ?? '');
      setCustomLabel(donToEdit?.donorLabel ?? donateurLabel);
      setError(null);
    }
  }, [isOpen, donToEdit, donateurLabel]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const parsedMontant = parseFloat(montant.replace(',', '.'));
    if (isNaN(parsedMontant) || parsedMontant <= 0) {
      setError(t('association.dons.errorMontant'));
      return;
    }
    if (!date) {
      setError(t('association.dons.errorDate'));
      return;
    }
    if (!description.trim() && natureDon !== 'numeraire') {
      setError(t('association.dons.errorDescription'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const don: Don = {
        id: donToEdit?.id ?? DonsService.generateId(),
        donateurId,
        donorLabel: (isAnonymous || allowAnonymous) ? customLabel : undefined,
        natureDon,
        montant: parsedMontant,
        date: new Date(date),
        datePerception: datePerception ? new Date(datePerception) : undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        modeVersement: natureDon === 'numeraire' && modeVersement ? modeVersement : undefined,
        createdAt: donToEdit?.createdAt ?? new Date(),
        updatedAt: new Date(),
      };
      await DonsService.upsertDon(don);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="don-nature-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="don-nature-modal">
        <div className="don-nature-modal-header">
          <div>
            <h3 className="don-nature-modal-title">
              {donToEdit ? t('association.dons.editTitle') : t('association.dons.addTitle')}
            </h3>
            <p className="don-nature-modal-subtitle">{isAnonymous ? t('association.dons.anonymousHint') : donateurLabel}</p>
          </div>
          <button type="button" className="don-nature-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="don-nature-modal-body">
          {/* Sélecteur de nature */}
          <div className="don-nature-type-grid">
            {NATURE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`don-nature-type-card ${natureDon === opt.value ? 'active' : ''}`}
                onClick={() => setNatureDon(opt.value)}
              >
                <span className="don-nature-type-icon">{opt.icon}</span>
                <span className="don-nature-type-label">{opt.label}</span>
                <span className="don-nature-type-hint">{opt.hint}</span>
              </button>
            ))}
          </div>

          <div className="don-nature-form-grid">
            {/* Champ identité pour les dons anonymes */}
            {(isAnonymous || allowAnonymous) && (
              <label style={{ gridColumn: '1 / -1' }}>
                {t('association.dons.donorLabel')}
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder={t('association.dons.donorLabelPlaceholder')}
                />
              </label>
            )}

            <label>
              {t('association.dons.date')}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            <label>
              {t('association.dons.datePerception')}
              <input
                type="date"
                value={datePerception}
                onChange={(e) => setDatePerception(e.target.value)}
                title={t('association.dons.datePerceptionPlaceholder')}
              />
            </label>

            <label>
              {natureDon === 'nature' ? t('association.dons.valeurEstimee') : natureDon === 'mecenat_competences' ? t('association.dons.valeurMecenat') : t('association.dons.montant')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0.00"
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--invoicing-gray-600)', fontWeight: 600 }}>€</span>
              </div>
            </label>

            {natureDon === 'numeraire' && (
              <label>
                {t('association.dons.modeVersement')}
                <select
                  value={modeVersement}
                  onChange={(e) => setModeVersement(e.target.value as ModeVersement | '')}
                >
                  <option value="">{t('association.dons.modeVersementSelect')}</option>
                  {MODE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
            )}

            <label style={{ gridColumn: natureDon === 'numeraire' ? '1 / -1' : undefined }}>
              {natureDon === 'nature'
                ? t('association.dons.descriptionNature')
                : natureDon === 'mecenat_competences'
                ? t('association.dons.descriptionMecenat')
                : t('association.dons.descriptionNumeraire')}
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  natureDon === 'nature'
                    ? t('association.dons.descriptionNaturePlaceholder')
                    : natureDon === 'mecenat_competences'
                    ? t('association.dons.descriptionMecenatPlaceholder')
                    : t('association.dons.descriptionNumerairePlaceholder')
                }
              />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              {t('association.dons.notes')}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t('association.dons.notesPlaceholder')}
              />
            </label>
          </div>

          {/* Aide contextuelle selon la nature */}
          {natureDon === 'nature' && (
            <div className="don-nature-info-box">
              <strong>{t('association.dons.infoNatureTitle')}</strong>
              <p>{t('association.dons.infoNatureText')}</p>
            </div>
          )}
          {natureDon === 'mecenat_competences' && (
            <div className="don-nature-info-box don-nature-info-box--mecenat">
              <strong>{t('association.dons.infoMecenatTitle')}</strong>
              <p>{t('association.dons.infoMecenatText')}</p>
            </div>
          )}

          {error && <div className="don-nature-error">{error}</div>}
        </div>

        <div className="don-nature-modal-footer">
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="button" className="primary" onClick={handleSave} disabled={saving}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
