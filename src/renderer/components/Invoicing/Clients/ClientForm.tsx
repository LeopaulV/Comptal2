import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Adresse, Client, TypeClient } from '../../../types/Invoice';
import { ClientService } from '../../../services/ClientService';
import { EntrepriseSearch } from './EntrepriseSearch';
import { SireneEntrepriseResult } from '../../../services/SireneAPIService';
import { CIVILITES, PAYS } from '../../../constants/invoicingConstants';

const defaultAdresse: Adresse = {
  rue: '',
  codePostal: '',
  ville: '',
  pays: 'France',
};

const generateId = () => `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface ClientFormProps {
  onSaved?: () => void;
}

export const ClientForm: React.FC<ClientFormProps> = ({ onSaved }) => {
  const { t } = useTranslation();
  const [client, setClient] = useState<Client>({
    id: generateId(),
    type: 'particulier',
    adresseFacturation: { ...defaultAdresse },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [status, setStatus] = useState<string | null>(null);

  const handleAdresseChange = (field: keyof Adresse, value: string) => {
    setClient((prev) => ({
      ...prev,
      adresseFacturation: { ...prev.adresseFacturation, [field]: value },
    }));
  };

  const handleEntrepriseSelect = (entreprise: SireneEntrepriseResult) => {
    setClient((prev) => ({
      ...prev,
      type: 'entreprise',
      denominationSociale: entreprise.nom_complet || entreprise.denomination || '',
      siren: entreprise.siren,
      siret: entreprise.siret,
      codeNAF: entreprise.activite_principale,
      adresseFacturation: {
        ...prev.adresseFacturation,
        rue: entreprise.adresse || prev.adresseFacturation.rue,
        codePostal: entreprise.code_postal || prev.adresseFacturation.codePostal,
        ville: entreprise.commune || prev.adresseFacturation.ville,
      },
    }));
  };

  const handleSave = async () => {
    try {
      await ClientService.upsertClient(client);
      setStatus(t('invoicing.clients.saved'));
      setClient({
        id: generateId(),
        type: client.type,
        adresseFacturation: { ...defaultAdresse },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      onSaved?.();
    } catch (error: any) {
      setStatus(error.message || t('invoicing.clients.saveError'));
    }
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.clients.formTitle')}</h2>
      <div className="invoicing-form-grid">
        <label>
          {t('invoicing.clients.type')}
          <select
            value={client.type}
            onChange={(e) => setClient({ ...client, type: e.target.value as TypeClient })}
          >
            <option value="particulier">{t('invoicing.clients.typeParticulier')}</option>
            <option value="entreprise">{t('invoicing.clients.typeEntreprise')}</option>
          </select>
        </label>
        {client.type === 'particulier' && (
          <>
            <label>
              {t('invoicing.clients.civility')}
              <select
                value={client.civilite || ''}
                onChange={(e) => setClient({ ...client, civilite: e.target.value as Client['civilite'] })}
              >
                <option value="">{t('invoicing.clients.selectCivility')}</option>
                {CIVILITES.map((civilite) => (
                  <option key={civilite} value={civilite}>
                    {civilite}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('invoicing.clients.firstName')}
              <input type="text" value={client.prenom || ''} onChange={(e) => setClient({ ...client, prenom: e.target.value })} />
            </label>
            <label>
              {t('invoicing.clients.lastName')}
              <input type="text" value={client.nom || ''} onChange={(e) => setClient({ ...client, nom: e.target.value })} />
            </label>
          </>
        )}
        {client.type === 'entreprise' && (
          <>
            <label>
              {t('invoicing.clients.companyName')}
              <input
                type="text"
                value={client.denominationSociale || ''}
                onChange={(e) => setClient({ ...client, denominationSociale: e.target.value })}
              />
            </label>
            <label>
              SIRET
              <input type="text" value={client.siret || ''} onChange={(e) => setClient({ ...client, siret: e.target.value })} />
            </label>
            <label>
              SIREN
              <input type="text" value={client.siren || ''} onChange={(e) => setClient({ ...client, siren: e.target.value })} />
            </label>
          </>
        )}
      </div>

      {client.type === 'entreprise' && <EntrepriseSearch onSelect={handleEntrepriseSelect} />}

      <div className="invoicing-form-section">
        <h3>{t('invoicing.clients.billingAddress')}</h3>
        <div className="invoicing-form-grid">
          <label>
            {t('invoicing.clients.street')}
            <input
              type="text"
              value={client.adresseFacturation.rue}
              onChange={(e) => handleAdresseChange('rue', e.target.value)}
            />
          </label>
          <label>
            {t('invoicing.clients.postalCode')}
            <input
              type="text"
              value={client.adresseFacturation.codePostal}
              onChange={(e) => handleAdresseChange('codePostal', e.target.value)}
            />
          </label>
          <label>
            {t('invoicing.clients.city')}
            <input
              type="text"
              value={client.adresseFacturation.ville}
              onChange={(e) => handleAdresseChange('ville', e.target.value)}
            />
          </label>
          <label>
            {t('invoicing.clients.country')}
            <select value={client.adresseFacturation.pays} onChange={(e) => handleAdresseChange('pays', e.target.value)}>
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
        <h3>{t('invoicing.clients.contact')}</h3>
        <div className="invoicing-form-grid">
          <label>
            {t('invoicing.clients.email')}
            <input type="email" value={client.email || ''} onChange={(e) => setClient({ ...client, email: e.target.value })} />
          </label>
          <label>
            {t('invoicing.clients.phone')}
            <input
              type="text"
              value={client.telephone || ''}
              onChange={(e) => setClient({ ...client, telephone: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="invoicing-actions">
        <button type="button" className="primary" onClick={handleSave}>
          {t('invoicing.clients.save')}
        </button>
        {status && <span className="status">{status}</span>}
      </div>
    </div>
  );
};
