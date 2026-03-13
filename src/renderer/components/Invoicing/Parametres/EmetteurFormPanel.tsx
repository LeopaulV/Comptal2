import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, MapPin, Phone, CreditCard, Search, Scale } from 'lucide-react';
import { 
  Adresse, 
  EmetteurExtended, 
  TypeEmetteur,
  EmetteurAccountLink,
  MentionLegale 
} from '../../../types/Invoice';
import { SireneAPIService, SireneEntrepriseResult } from '../../../services/SireneAPIService';
import { FORMES_JURIDIQUES, PAYS } from '../../../constants/invoicingConstants';
import { LogoViewer } from './LogoViewer';
import { AccountLinkSection } from './AccountLinkSection';
import { PDFTemplateConfig } from './PDFTemplateConfig';
import { LegalMentionsConfig } from './LegalMentionsConfig';
import { BankDetailsForm } from './BankDetailsForm';

const defaultAdresse: Adresse = {
  rue: '',
  codePostal: '',
  ville: '',
  pays: 'France',
};

const generateId = () => `emit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultEmetteur = (): EmetteurExtended => ({
  id: generateId(),
  type: 'entreprise',
  denominationSociale: '',
  siret: '',
  adresse: { ...defaultAdresse },
  regimeTVA: 'franchise',
  createdAt: new Date(),
  updatedAt: new Date(),
  linkedAccounts: [],
  selectedMentionsLegales: [],
  customMentionsLegales: [],
  mentionPlaceholderValues: {},
});

interface EmetteurFormPanelProps {
  emetteur: EmetteurExtended;
  onChange: (emetteur: EmetteurExtended) => void;
  onSave: () => void;
  status: string | null;
}

export const EmetteurFormPanel: React.FC<EmetteurFormPanelProps> = ({
  emetteur,
  onChange,
  onSave,
  status,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SireneEntrepriseResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Recherche SIRENE
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

  const handleAdresseChange = (field: keyof Adresse, value: string) => {
    onChange({
      ...emetteur,
      adresse: { ...emetteur.adresse, [field]: value },
    });
  };

  const handleEntrepriseSelect = (entreprise: SireneEntrepriseResult) => {
    onChange({
      ...emetteur,
      denominationSociale: entreprise.nom_complet || entreprise.denomination || emetteur.denominationSociale,
      siren: entreprise.siren || emetteur.siren,
      siret: entreprise.siret || emetteur.siret,
      codeNAF: entreprise.activite_principale || emetteur.codeNAF,
      adresse: {
        ...emetteur.adresse,
        rue: entreprise.adresse || emetteur.adresse.rue,
        codePostal: entreprise.code_postal || emetteur.adresse.codePostal,
        ville: entreprise.commune || emetteur.adresse.ville,
      },
    });
    setSearchResults([]);
    setSearchQuery('');
    setShowSearch(false);
  };

  const handleLinkedAccountsChange = (accounts: EmetteurAccountLink[]) => {
    onChange({ ...emetteur, linkedAccounts: accounts });
  };

  const handleSelectedMentionsChange = (mentionIds: string[]) => {
    onChange({ ...emetteur, selectedMentionsLegales: mentionIds });
  };

  const handleCustomMentionsChange = (mentions: MentionLegale[]) => {
    onChange({ ...emetteur, customMentionsLegales: mentions });
  };

  const handleDevisTemplateChange = (templateId: string) => {
    onChange({ ...emetteur, pdfTemplateDevis: templateId });
  };

  const handleFactureTemplateChange = (templateId: string) => {
    onChange({ ...emetteur, pdfTemplateFacture: templateId });
  };

  return (
    <div className="emetteur-form-panel">
      {/* En-tête avec titre */}
      <div className="emetteur-form-header">
        <h2 className="emetteur-form-title">
          <Building2 size={24} />
          {t('invoicing.emetteur.title')}
        </h2>
        <p className="emetteur-form-subtitle">{t('invoicing.emetteur.subtitle')}</p>
      </div>

      {/* Section: Type et identification */}
      <div className="emetteur-section">
        <div className="emetteur-section-header">
          <Building2 size={18} />
          <h3>{t('invoicing.emetteur.identification.title')}</h3>
        </div>
        
        <div className="emetteur-form-grid">
          <div className="form-field">
            <label>{t('invoicing.emetteur.type')}</label>
            <select
              value={emetteur.type}
              onChange={(e) => onChange({ ...emetteur, type: e.target.value as TypeEmetteur })}
            >
              <option value="entreprise">{t('invoicing.emetteur.typeEntreprise')}</option>
              <option value="association">{t('invoicing.emetteur.typeAssociation')}</option>
              <option value="auto_entrepreneur">{t('invoicing.emetteur.typeAutoEntrepreneur')}</option>
              <option value="particulier">{t('invoicing.emetteur.typeParticulier')}</option>
            </select>
          </div>

          <div className="form-field">
            <label>{t('invoicing.emetteur.denomination')}</label>
            <input
              type="text"
              value={emetteur.denominationSociale}
              onChange={(e) => onChange({ ...emetteur, denominationSociale: e.target.value })}
              placeholder={t('invoicing.emetteur.denominationPlaceholder')}
            />
          </div>

          <div className="form-field">
            <label>SIRET</label>
            <input
              type="text"
              value={emetteur.siret}
              onChange={(e) => onChange({ ...emetteur, siret: e.target.value })}
              placeholder="XXX XXX XXX XXXXX"
            />
          </div>

          <div className="form-field">
            <label>SIREN</label>
            <input
              type="text"
              value={emetteur.siren || ''}
              onChange={(e) => onChange({ ...emetteur, siren: e.target.value })}
              placeholder="XXX XXX XXX"
            />
          </div>

          <div className="form-field">
            <label>{t('invoicing.emetteur.formeJuridique')}</label>
            <select
              value={emetteur.formeJuridique || ''}
              onChange={(e) => onChange({ ...emetteur, formeJuridique: e.target.value })}
            >
              <option value="">{t('invoicing.emetteur.selectFormeJuridique')}</option>
              {FORMES_JURIDIQUES.map((forme) => (
                <option key={forme.value} value={forme.value}>
                  {forme.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>{t('invoicing.emetteur.numeroTVA')}</label>
            <input
              type="text"
              value={emetteur.numeroTVA || ''}
              onChange={(e) => onChange({ ...emetteur, numeroTVA: e.target.value })}
              placeholder="FRXX XXXXXXXXX"
            />
          </div>
        </div>

        {/* Recherche entreprise */}
        <div className="emetteur-search-section">
          <button
            type="button"
            className={`emetteur-search-toggle ${showSearch ? 'active' : ''}`}
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={16} />
            {t('invoicing.emetteur.searchEntreprise')}
          </button>
          
          {showSearch && (
            <div className="emetteur-search-box">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('invoicing.emetteur.searchPlaceholder')}
                className="emetteur-search-input"
              />
              {isSearching && (
                <div className="emetteur-search-loading">{t('common.searching')}</div>
              )}
              {searchResults.length > 0 && (
                <div className="emetteur-search-results">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.siret}-${result.siren}`}
                      type="button"
                      className="emetteur-search-result"
                      onClick={() => handleEntrepriseSelect(result)}
                    >
                      <span className="result-name">{result.nom_complet || result.denomination}</span>
                      <span className="result-siret">{result.siret || result.siren}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section: Régime fiscal */}
      <div className="emetteur-section">
        <div className="emetteur-section-header">
          <Scale size={18} />
          <h3>{t('invoicing.charges.regime.title')}</h3>
        </div>
        
        <div className="emetteur-form-grid">
          <div className="form-field">
            <label>{t('invoicing.charges.regime.fiscal')}</label>
            <select
              value={emetteur.regimeFiscal || ''}
              onChange={(e) => onChange({ ...emetteur, regimeFiscal: (e.target.value || undefined) as any })}
            >
              <option value="">{t('common.select')}</option>
              <option value="micro_bic">{t('invoicing.charges.regime.microBIC')}</option>
              <option value="micro_bnc">{t('invoicing.charges.regime.microBNC')}</option>
              <option value="reel_simplifie">{t('invoicing.charges.regime.reelSimplifie')}</option>
              <option value="reel_normal">{t('invoicing.charges.regime.reelNormal')}</option>
              <option value="is">{t('invoicing.charges.regime.IS')}</option>
            </select>
          </div>

          <div className="form-field">
            <label>{t('invoicing.charges.regime.tva')}</label>
            <select
              value={emetteur.regimeTVA}
              onChange={(e) => onChange({ ...emetteur, regimeTVA: e.target.value as any })}
            >
              <option value="franchise">{t('invoicing.charges.regime.tvaFranchise')}</option>
              <option value="reel_simplifie">{t('invoicing.charges.regime.tvaReelSimplifie')}</option>
              <option value="reel_normal">{t('invoicing.charges.regime.tvaReelNormal')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section: Adresse */}
      <div className="emetteur-section">
        <div className="emetteur-section-header">
          <MapPin size={18} />
          <h3>{t('invoicing.emetteur.address.title')}</h3>
        </div>
        
        <div className="emetteur-form-grid">
          <div className="form-field full-width">
            <label>{t('invoicing.emetteur.address.street')}</label>
            <input
              type="text"
              value={emetteur.adresse.rue}
              onChange={(e) => handleAdresseChange('rue', e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>{t('invoicing.emetteur.address.postalCode')}</label>
            <input
              type="text"
              value={emetteur.adresse.codePostal}
              onChange={(e) => handleAdresseChange('codePostal', e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>{t('invoicing.emetteur.address.city')}</label>
            <input
              type="text"
              value={emetteur.adresse.ville}
              onChange={(e) => handleAdresseChange('ville', e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>{t('invoicing.emetteur.address.country')}</label>
            <select
              value={emetteur.adresse.pays}
              onChange={(e) => handleAdresseChange('pays', e.target.value)}
            >
              {PAYS.map((pays) => (
                <option key={pays} value={pays}>
                  {pays}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section: Contact */}
      <div className="emetteur-section">
        <div className="emetteur-section-header">
          <Phone size={18} />
          <h3>{t('invoicing.emetteur.contact.title')}</h3>
        </div>
        
        <div className="emetteur-form-grid">
          <div className="form-field">
            <label>{t('invoicing.emetteur.contact.phone')}</label>
            <input
              type="tel"
              value={emetteur.telephone || ''}
              onChange={(e) => onChange({ ...emetteur, telephone: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label>{t('invoicing.emetteur.contact.email')}</label>
            <input
              type="email"
              value={emetteur.email || ''}
              onChange={(e) => onChange({ ...emetteur, email: e.target.value })}
            />
          </div>

          <div className="form-field">
            <label>{t('invoicing.emetteur.contact.website')}</label>
            <input
              type="url"
              value={emetteur.siteWeb || ''}
              onChange={(e) => onChange({ ...emetteur, siteWeb: e.target.value })}
              placeholder="https://"
            />
          </div>
        </div>
      </div>

      {/* Section: Logo */}
      <div className="emetteur-section">
        <LogoViewer
          logo={emetteur.logo}
          onLogoChange={(logo) => onChange({ ...emetteur, logo })}
        />
      </div>

      {/* Section: Comptes bancaires liés */}
      <div className="emetteur-section">
        <AccountLinkSection
          linkedAccounts={emetteur.linkedAccounts || []}
          onChange={handleLinkedAccountsChange}
        />
      </div>

      {/* Section: Coordonnées bancaires */}
      <div className="emetteur-section">
        <div className="emetteur-section-header">
          <CreditCard size={18} />
          <h3>{t('invoicing.emetteur.bank.title')}</h3>
        </div>
        <BankDetailsForm
          value={emetteur.coordonneesBancaires}
          onChange={(value) => onChange({ ...emetteur, coordonneesBancaires: value })}
        />
      </div>

      {/* Section rétractable: Modèles PDF */}
      <PDFTemplateConfig
        selectedDevisTemplate={emetteur.pdfTemplateDevis}
        selectedFactureTemplate={emetteur.pdfTemplateFacture}
        onDevisTemplateChange={handleDevisTemplateChange}
        onFactureTemplateChange={handleFactureTemplateChange}
      />

      {/* Section rétractable: Mentions légales */}
      <LegalMentionsConfig
        selectedMentions={emetteur.selectedMentionsLegales || []}
        customMentions={emetteur.customMentionsLegales || []}
        onSelectedChange={handleSelectedMentionsChange}
        onCustomMentionsChange={handleCustomMentionsChange}
        mentionPlaceholderValues={emetteur.mentionPlaceholderValues || {}}
        onPlaceholderValuesChange={(values) => onChange({ ...emetteur, mentionPlaceholderValues: values })}
      />

      {/* Actions */}
      <div className="emetteur-form-actions">
        <button type="button" className="btn-primary" onClick={onSave}>
          {t('common.save')}
        </button>
        {status && (
          <span className={`status-message ${status.includes('erreur') ? 'error' : 'success'}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
};

export { defaultEmetteur };
