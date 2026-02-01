import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Adresse, Emetteur, TypeEmetteur } from '../../../types/Invoice';
import { EmetteurService } from '../../../services/EmetteurService';
import { SireneAPIService, SireneEntrepriseResult } from '../../../services/SireneAPIService';
import { FORMES_JURIDIQUES, PAYS } from '../../../constants/invoicingConstants';
import { BankDetailsForm } from './BankDetailsForm';

const defaultAdresse: Adresse = {
  rue: '',
  codePostal: '',
  ville: '',
  pays: 'France',
};

const generateId = () => `emit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultEmetteur = (): Emetteur => ({
  id: generateId(),
  type: 'entreprise',
  denominationSociale: '',
  siret: '',
  adresse: { ...defaultAdresse },
  regimeTVA: 'franchise',
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const EmetteurForm: React.FC = () => {
  const { t } = useTranslation();
  const [emetteur, setEmetteur] = useState<Emetteur>(defaultEmetteur());
  const [status, setStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SireneEntrepriseResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleLogoChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;
      setEmetteur((prev) => ({ ...prev, logo: result }));
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setEmetteur((prev) => ({ ...prev, logo: undefined }));
  };

  useEffect(() => {
    const load = async () => {
      const existing = await EmetteurService.loadEmetteur();
      if (existing) {
        setEmetteur(existing);
      }
    };
    load();
  }, []);

  const handleAdresseChange = (field: keyof Adresse, value: string) => {
    setEmetteur((prev) => ({
      ...prev,
      adresse: { ...prev.adresse, [field]: value },
    }));
  };

  const handleEntrepriseSelect = (entreprise: SireneEntrepriseResult) => {
    setEmetteur((prev) => ({
      ...prev,
      denominationSociale: entreprise.nom_complet || entreprise.denomination || prev.denominationSociale,
      siren: entreprise.siren || prev.siren,
      siret: entreprise.siret || prev.siret,
      codeNAF: entreprise.activite_principale || prev.codeNAF,
      adresse: {
        ...prev.adresse,
        rue: entreprise.adresse || prev.adresse.rue,
        codePostal: entreprise.code_postal || prev.adresse.codePostal,
        ville: entreprise.commune || prev.adresse.ville,
      },
    }));
    setSearchResults([]);
    setSearchQuery('');
  };

  useEffect(() => {
    const runSearch = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const data = await SireneAPIService.searchEntreprises(searchQuery, 1, 5);
        setSearchResults(data.results || []);
      } catch (error) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };
    const timeout = setTimeout(runSearch, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const handleSave = async () => {
    try {
      await EmetteurService.saveEmetteur(emetteur);
      setStatus(t('invoicing.settings.saved'));
    } catch (error: any) {
      setStatus(error.message || t('invoicing.settings.saveError'));
    }
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.settings.emetteurTitle')}</h2>
      <div className="invoicing-form-grid">
        <label>
          {t('invoicing.settings.emetteurType')}
          <select
            value={emetteur.type}
            onChange={(e) => setEmetteur({ ...emetteur, type: e.target.value as TypeEmetteur })}
          >
            <option value="entreprise">{t('invoicing.settings.typeEntreprise')}</option>
            <option value="association">{t('invoicing.settings.typeAssociation')}</option>
            <option value="auto_entrepreneur">{t('invoicing.settings.typeAutoEntrepreneur')}</option>
            <option value="particulier">{t('invoicing.settings.typeParticulier')}</option>
          </select>
        </label>
        <label>
          {t('invoicing.settings.denomination')}
          <input
            type="text"
            value={emetteur.denominationSociale}
            onChange={(e) => setEmetteur({ ...emetteur, denominationSociale: e.target.value })}
          />
        </label>
        <label>
          SIRET
          <input
            type="text"
            value={emetteur.siret}
            onChange={(e) => setEmetteur({ ...emetteur, siret: e.target.value })}
          />
        </label>
        <label>
          SIREN
          <input
            type="text"
            value={emetteur.siren || ''}
            onChange={(e) => setEmetteur({ ...emetteur, siren: e.target.value })}
          />
        </label>
        <label>
          {t('invoicing.settings.formeJuridique')}
          <select
            value={emetteur.formeJuridique || ''}
            onChange={(e) => setEmetteur({ ...emetteur, formeJuridique: e.target.value })}
          >
            <option value="">{t('invoicing.settings.selectFormeJuridique')}</option>
            {FORMES_JURIDIQUES.map((forme) => (
              <option key={forme.value} value={forme.value}>
                {forme.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('invoicing.settings.numeroTVA')}
          <input
            type="text"
            value={emetteur.numeroTVA || ''}
            onChange={(e) => setEmetteur({ ...emetteur, numeroTVA: e.target.value })}
          />
        </label>
      </div>

      <div className="invoicing-form-section">
        <h3>{t('invoicing.settings.entrepriseSearch')}</h3>
        <div className="invoicing-search-box">
          <label>
            {t('invoicing.settings.searchLabel')}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('invoicing.settings.searchPlaceholder')}
            />
          </label>
          {isSearching && <div className="invoicing-loading">{t('invoicing.settings.searching')}</div>}
          <div className="invoicing-search-results">
            {searchResults.map((result) => (
              <button
                key={`${result.siret}-${result.siren}-${result.nom_complet}`}
                type="button"
                className="invoicing-search-result"
                onClick={() => handleEntrepriseSelect(result)}
              >
                <div className="name">{result.nom_complet || result.denomination}</div>
                <div className="meta">{result.siret || result.siren}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="invoicing-form-section">
        <h3>{t('invoicing.settings.address')}</h3>
        <div className="invoicing-form-grid">
          <label>
            {t('invoicing.settings.street')}
            <input type="text" value={emetteur.adresse.rue} onChange={(e) => handleAdresseChange('rue', e.target.value)} />
          </label>
          <label>
            {t('invoicing.settings.postalCode')}
            <input
              type="text"
              value={emetteur.adresse.codePostal}
              onChange={(e) => handleAdresseChange('codePostal', e.target.value)}
            />
          </label>
          <label>
            {t('invoicing.settings.city')}
            <input
              type="text"
              value={emetteur.adresse.ville}
              onChange={(e) => handleAdresseChange('ville', e.target.value)}
            />
          </label>
          <label>
            {t('invoicing.settings.country')}
            <select value={emetteur.adresse.pays} onChange={(e) => handleAdresseChange('pays', e.target.value)}>
              {PAYS.map((pays) => (
                <option key={pays} value={pays}>
                  {pays}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="invoicing-form-section">
        <h3>{t('invoicing.settings.contact')}</h3>
        <div className="invoicing-form-grid">
          <label>
            {t('invoicing.settings.phone')}
            <input
              type="text"
              value={emetteur.telephone || ''}
              onChange={(e) => setEmetteur({ ...emetteur, telephone: e.target.value })}
            />
          </label>
          <label>
            {t('invoicing.settings.email')}
            <input
              type="email"
              value={emetteur.email || ''}
              onChange={(e) => setEmetteur({ ...emetteur, email: e.target.value })}
            />
          </label>
          <label>
            {t('invoicing.settings.website')}
            <input
              type="text"
              value={emetteur.siteWeb || ''}
              onChange={(e) => setEmetteur({ ...emetteur, siteWeb: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="invoicing-form-section">
        <h3>{t('invoicing.settings.logoTitle')}</h3>
        <div className="invoicing-form-grid">
          <label>
            {t('invoicing.settings.logoUpload')}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              onChange={(e) => handleLogoChange(e.target.files?.[0] || null)}
            />
          </label>
          {emetteur.logo && (
            <div className="invoicing-preview">
              <img src={emetteur.logo} alt={t('invoicing.settings.logoAlt')} />
            </div>
          )}
        </div>
        {emetteur.logo && (
          <div className="invoicing-actions">
            <button type="button" className="secondary" onClick={clearLogo}>
              {t('invoicing.settings.logoRemove')}
            </button>
          </div>
        )}
      </div>

      <BankDetailsForm
        value={emetteur.coordonneesBancaires}
        onChange={(value) => setEmetteur({ ...emetteur, coordonneesBancaires: value })}
      />

      <div className="invoicing-actions">
        <button type="button" className="primary" onClick={handleSave}>
          {t('invoicing.settings.save')}
        </button>
        {status && <span className="status">{status}</span>}
      </div>
    </div>
  );
};
