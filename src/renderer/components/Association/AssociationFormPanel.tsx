import React from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { AssociationConfig } from '../../types/Association';
import { Adresse } from '../../types/Invoice';
import { AssociationPDFTemplateConfig } from './AssociationPDFTemplateConfig';
import { LogoViewer } from '../Invoicing/Parametres/LogoViewer';

interface AssociationFormPanelProps {
  config: AssociationConfig;
  onChange: (config: AssociationConfig) => void;
  onSave: () => void;
  status: string | null;
}

const FORMES_JURIDIQUES = [
  'Association loi 1901',
  'Association reconnue d\'utilité publique (RUP)',
  'Association reconnue d\'utilité publique cultuelle',
  'Fondation reconnue d\'utilité publique',
  'Fondation d\'entreprise',
  'Fonds de dotation',
  'Congrégation religieuse',
  'Autre',
];

export const AssociationFormPanel: React.FC<AssociationFormPanelProps> = ({
  config,
  onChange,
  onSave,
  status,
}) => {
  const { t } = useTranslation();

  const handleAdresseChange = (field: keyof Adresse, value: string) => {
    const baseAdresse: Adresse = config.adresse ?? {
      rue: '',
      codePostal: '',
      ville: '',
      pays: 'France',
    };

    onChange({
      ...config,
      adresse: { ...baseAdresse, [field]: value },
    });
  };

  return (
    <div className="emetteur-form-panel">
      <div className="emetteur-form-header">
        <h2 className="emetteur-form-title">{t('association.config.formTitle')}</h2>
        <p className="emetteur-form-subtitle">{t('association.config.formSubtitle')}</p>
      </div>

      <div className="emetteur-section">
        <h3>{t('association.config.identification')}</h3>
        <div className="invoicing-form-grid">
          <label>
            {t('association.config.denomination')}
            <input
              type="text"
              value={config.denominationSociale}
              onChange={(e) => onChange({ ...config, denominationSociale: e.target.value })}
              placeholder={t('association.config.denominationPlaceholder')}
            />
          </label>
          <label>
            {t('association.config.formeJuridique')}
            <select
              value={config.formeJuridique || ''}
              onChange={(e) => onChange({ ...config, formeJuridique: e.target.value || undefined })}
            >
              <option value="">{t('association.config.selectFormeJuridique')}</option>
              {FORMES_JURIDIQUES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            {t('association.config.objetSocial')}
            <input
              type="text"
              value={config.objetSocial}
              onChange={(e) => onChange({ ...config, objetSocial: e.target.value })}
              placeholder={t('association.config.objetSocialPlaceholder')}
            />
          </label>
          <label>
            RNA
            <input
              type="text"
              value={config.rna || ''}
              onChange={(e) => onChange({ ...config, rna: e.target.value || undefined })}
              placeholder="W123456789"
            />
          </label>
          <label>
            SIREN
            <input
              type="text"
              value={config.siren || ''}
              onChange={(e) => onChange({ ...config, siren: e.target.value || undefined })}
              placeholder="123 456 789"
            />
          </label>
          <label>
            SIRET
            <input
              type="text"
              value={config.siret || ''}
              onChange={(e) => onChange({ ...config, siret: e.target.value })}
              placeholder="123 456 789 00012"
            />
          </label>
          <label>
            {t('association.config.dateCreation')}
            <input
              type="text"
              value={config.dateCreation || ''}
              onChange={(e) => onChange({ ...config, dateCreation: e.target.value || undefined })}
              placeholder="JJ/MM/AAAA"
            />
          </label>
          <label>
            {t('association.config.prefectureDeclaration')}
            <input
              type="text"
              value={config.prefectureDeclaration || ''}
              onChange={(e) => onChange({ ...config, prefectureDeclaration: e.target.value || undefined })}
              placeholder="Ex : Préfecture de Paris"
            />
          </label>
          <label>
            {t('association.config.numeroRecepisse')}
            <input
              type="text"
              value={config.numeroRecepisse || ''}
              onChange={(e) => onChange({ ...config, numeroRecepisse: e.target.value || undefined })}
              placeholder="N° de récépissé préfectoral"
            />
          </label>
        </div>
      </div>

      <div className="emetteur-section">
        <h3>{t('association.config.address')}</h3>
        <div className="invoicing-form-grid">
          <label>
            {t('association.config.street')}
            <input
              type="text"
              value={config.adresse?.rue ?? ''}
              onChange={(e) => handleAdresseChange('rue', e.target.value)}
            />
          </label>
          <label>
            {t('association.config.postalCode')}
            <input
              type="text"
              value={config.adresse?.codePostal ?? ''}
              onChange={(e) => handleAdresseChange('codePostal', e.target.value)}
            />
          </label>
          <label>
            {t('association.config.city')}
            <input
              type="text"
              value={config.adresse?.ville ?? ''}
              onChange={(e) => handleAdresseChange('ville', e.target.value)}
            />
          </label>
          <label>
            {t('association.config.country')}
            <input
              type="text"
              value={config.adresse?.pays ?? ''}
              onChange={(e) => handleAdresseChange('pays', e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="emetteur-section">
        <h3>{t('association.config.contact')}</h3>
        <div className="invoicing-form-grid">
          <label>
            {t('association.config.email')}
            <input
              type="email"
              value={config.email || ''}
              onChange={(e) => onChange({ ...config, email: e.target.value || undefined })}
            />
          </label>
          <label>
            {t('association.config.phone')}
            <input
              type="text"
              value={config.telephone || ''}
              onChange={(e) => onChange({ ...config, telephone: e.target.value || undefined })}
            />
          </label>
          <label>
            {t('association.config.website')}
            <input
              type="text"
              value={config.siteWeb || ''}
              onChange={(e) => onChange({ ...config, siteWeb: e.target.value || undefined })}
            />
          </label>
        </div>
      </div>

      <div className="emetteur-section">
        <LogoViewer
          logo={config.logo}
          onLogoChange={(logo) => onChange({ ...config, logo })}
        />
      </div>

      <div className="emetteur-section">
        <h3>{t('association.config.signataire')}</h3>
        <p className="emetteur-form-subtitle">{t('association.config.signataireHint')}</p>
        <div className="invoicing-form-grid">
          <label>
            {t('association.config.signataireNom')}
            <input
              type="text"
              value={config.signataireNom || ''}
              onChange={(e) => onChange({ ...config, signataireNom: e.target.value || undefined })}
              placeholder="Ex : Jean Dupont"
            />
          </label>
          <label>
            {t('association.config.signataireQualite')}
            <input
              type="text"
              value={config.signataireQualite || ''}
              onChange={(e) => onChange({ ...config, signataireQualite: e.target.value || undefined })}
              placeholder="Ex : Président"
            />
          </label>
        </div>
      </div>

      <div className="emetteur-section">
        <h3>{t('association.config.recuFiscal')}</h3>
        <div className="invoicing-form-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <AssociationPDFTemplateConfig
              selectedTemplate={config.pdfTemplateRecuFiscal}
              onTemplateChange={(id) =>
                onChange({ ...config, pdfTemplateRecuFiscal: id })
              }
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.statutOIG || false}
              onChange={(e) => onChange({ ...config, statutOIG: e.target.checked })}
            />
            {t('association.config.statutOIG')}
          </label>
          <label>
            {t('association.config.datePublicationJO')}
            <input
              type="text"
              value={config.datePublicationJO || ''}
              onChange={(e) => onChange({ ...config, datePublicationJO: e.target.value || undefined })}
              placeholder="JJ/MM/AAAA"
            />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            {t('association.config.referencesCGI')}
            <input
              type="text"
              value={config.referencesCGI || ''}
              onChange={(e) => onChange({ ...config, referencesCGI: e.target.value || undefined })}
              placeholder="Articles 200 et 238 bis du code général des impôts"
            />
          </label>
          <label>
            {t('association.config.nextReceiptNumber')}
            <input
              type="number"
              min={0}
              value={config.nextReceiptNumber ?? 0}
              onChange={(e) => onChange({ ...config, nextReceiptNumber: parseInt(e.target.value, 10) || 0 })}
            />
          </label>
        </div>
      </div>

      <div className="invoicing-actions association-form-actions">
        <button type="button" className="primary association-save-btn" onClick={onSave}>
          <Save size={18} aria-hidden />
          <span>{t('common.save')}</span>
        </button>
        {status && (
          <span className={`association-form-status ${status.includes('Erreur') || status.includes('error') ? 'error' : 'success'}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
};
