import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Donateur, TypeDonateur } from '../../types/Association';
import { Adresse } from '../../types/Invoice';
import { ConfigService } from '../../services/ConfigService';
import { CategoriesConfig } from '../../types/Category';

const defaultAdresse: Adresse = {
  rue: '',
  codePostal: '',
  ville: '',
  pays: 'France',
};

const CIVILITES = ['M.', 'Mme', 'Mlle'] as const;

interface DonateurFormProps {
  initialDonateur?: Donateur | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

export const DonateurForm: React.FC<DonateurFormProps> = ({
  initialDonateur,
  onSaved,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<CategoriesConfig>({});
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [donateur, setDonateur] = useState<Donateur>(() => {
    if (initialDonateur) return { ...initialDonateur };
    return {
      id: `don-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: 'particulier',
      adresse: { ...defaultAdresse },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  const loadCategories = async () => {
    const loaded = await ConfigService.loadCategories();
    setCategories(loaded);
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAdresseChange = (field: keyof Adresse, value: string) => {
    setDonateur((prev) => ({
      ...prev,
      adresse: { ...prev.adresse, [field]: value },
    }));
  };

  const handleCreateCategory = async () => {
    const code = newCatCode.trim().toUpperCase();
    const name = newCatName.trim();
    if (!code || !name) return;
    if (categories[code]) {
      toast.warn(`${code} existe déjà`);
      return;
    }
    const defaultColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
    const usedColors = new Set(Object.values(categories).map((c) => c.color));
    const color = defaultColors.find((c) => !usedColors.has(c)) || defaultColors[Math.floor(Math.random() * defaultColors.length)];
    const updated = { ...categories, [code]: { name, color } };
    await ConfigService.saveCategories(updated);
    ConfigService.clearCache();
    setCategories(updated);
    setDonateur((prev) => ({ ...prev, categoryCode: code }));
    setNewCatCode('');
    setNewCatName('');
    setShowNewCategory(false);
    toast.success(t('association.gestion.categorySaved'));
  };

  const handleSave = async () => {
    const { DonateurService } = await import('../../services/DonateurService');
    await DonateurService.upsertDonateur(donateur);
    onSaved?.();
  };

  const categoryEntries = Object.entries(categories);

  return (
    <div className="invoicing-card">
      <div className="invoicing-form-grid">
        <label>
          {t('association.gestion.typeDonateur')}
          <select
            value={donateur.type}
            onChange={(e) => setDonateur({ ...donateur, type: e.target.value as TypeDonateur })}
          >
            <option value="particulier">{t('association.gestion.typeParticulier')}</option>
            <option value="entreprise">{t('association.gestion.typeEntreprise')}</option>
          </select>
        </label>

        <div>
          <label>
            {t('association.gestion.category')}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={donateur.categoryCode || ''}
                onChange={(e) => setDonateur({ ...donateur, categoryCode: e.target.value || undefined })}
                style={{ flex: 1 }}
              >
                <option value="">{t('association.gestion.noCategory')}</option>
                {categoryEntries.map(([code, cat]) => (
                  <option key={code} value={code}>
                    {code} – {cat.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary"
                style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '4px 10px' }}
                onClick={() => setShowNewCategory((prev) => !prev)}
              >
                {t('association.gestion.createCategory')}
              </button>
            </div>
          </label>
          {showNewCategory && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-end',
                marginTop: 8,
                padding: '10px 12px',
                background: 'var(--invoicing-gray-50)',
                borderRadius: 8,
                border: '1px solid var(--invoicing-gray-200)',
              }}
            >
              <label style={{ flex: '0 0 100px' }}>
                {t('association.gestion.categoryCode')}
                <input
                  type="text"
                  value={newCatCode}
                  onChange={(e) => setNewCatCode(e.target.value)}
                  placeholder="EX"
                  maxLength={10}
                />
              </label>
              <label style={{ flex: 1 }}>
                {t('association.gestion.categoryName')}
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nom de la catégorie"
                />
              </label>
              <button
                type="button"
                className="primary"
                style={{ padding: '6px 14px', fontSize: 13 }}
                onClick={handleCreateCategory}
                disabled={!newCatCode.trim() || !newCatName.trim()}
              >
                {t('common.save')}
              </button>
            </div>
          )}
        </div>

        {donateur.type === 'particulier' && (
          <>
            <label>
              {t('association.gestion.civility')}
              <select
                value={donateur.civilite || ''}
                onChange={(e) => setDonateur({ ...donateur, civilite: (e.target.value || undefined) as Donateur['civilite'] })}
              >
                <option value="">{t('association.gestion.selectCivility')}</option>
                {CIVILITES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {t('association.gestion.firstName')}
              <input type="text" value={donateur.prenom || ''} onChange={(e) => setDonateur({ ...donateur, prenom: e.target.value })} />
            </label>
            <label>
              {t('association.gestion.lastName')}
              <input type="text" value={donateur.nom || ''} onChange={(e) => setDonateur({ ...donateur, nom: e.target.value })} />
            </label>
          </>
        )}

        {donateur.type === 'entreprise' && (
          <>
            <label>
              {t('association.gestion.companyName')}
              <input
                type="text"
                value={donateur.denominationSociale || ''}
                onChange={(e) => setDonateur({ ...donateur, denominationSociale: e.target.value })}
              />
            </label>
            <label>
              SIREN
              <input type="text" value={donateur.siren || ''} onChange={(e) => setDonateur({ ...donateur, siren: e.target.value })} />
            </label>
            <label>
              SIRET
              <input type="text" value={donateur.siret || ''} onChange={(e) => setDonateur({ ...donateur, siret: e.target.value })} />
            </label>
          </>
        )}

        <label>
          {t('association.gestion.address')}
          <input type="text" value={donateur.adresse.rue || ''} onChange={(e) => handleAdresseChange('rue', e.target.value)} placeholder={t('association.gestion.street')} />
        </label>
        <label>
          {t('association.gestion.postalCode')}
          <input type="text" value={donateur.adresse.codePostal || ''} onChange={(e) => handleAdresseChange('codePostal', e.target.value)} />
        </label>
        <label>
          {t('association.gestion.city')}
          <input type="text" value={donateur.adresse.ville || ''} onChange={(e) => handleAdresseChange('ville', e.target.value)} />
        </label>
        <label>
          {t('association.gestion.email')}
          <input type="email" value={donateur.email || ''} onChange={(e) => setDonateur({ ...donateur, email: e.target.value })} />
        </label>
        <label>
          {t('association.gestion.phone')}
          <input type="tel" value={donateur.telephone || ''} onChange={(e) => setDonateur({ ...donateur, telephone: e.target.value })} />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          {t('association.gestion.notes')}
          <textarea
            value={donateur.notes || ''}
            onChange={(e) => setDonateur({ ...donateur, notes: e.target.value })}
            rows={3}
          />
        </label>
      </div>
      <div className="invoicing-actions">
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        )}
        <button type="button" className="primary" onClick={handleSave}>
          {t('common.save')}
        </button>
      </div>
    </div>
  );
};
