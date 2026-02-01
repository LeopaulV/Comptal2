import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Client } from '../../../types/Invoice';
import { ClientService } from '../../../services/ClientService';

export const ClientList: React.FC = () => {
  const { t } = useTranslation();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      const data = await ClientService.loadClients();
      setClients(data);
    };
    load();
  }, []);

  useEffect(() => {
    const search = async () => {
      const results = await ClientService.searchClients(query);
      setClients(results);
    };
    search();
  }, [query]);

  const handleDelete = async (clientId: string) => {
    await ClientService.deleteClient(clientId);
    const results = await ClientService.searchClients(query);
    setClients(results);
  };

  return (
    <div className="invoicing-card">
      <h2>{t('invoicing.clients.listTitle')}</h2>
      <input
        type="text"
        placeholder={t('invoicing.clients.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="invoicing-search"
      />
      <div className="invoicing-list">
        {clients.map((client) => (
          <div key={client.id} className="invoicing-list-item">
            <div className="name">
              {client.type === 'particulier'
                ? `${client.prenom || ''} ${client.nom || ''}`.trim() || t('invoicing.clients.unknown')
                : client.denominationSociale || t('invoicing.clients.unknown')}
            </div>
            <div className="meta">{client.email || client.telephone || '-'}</div>
            <div className="invoicing-list-item-actions">
              <button type="button" className="invoicing-icon-button" onClick={() => handleDelete(client.id)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
        {clients.length === 0 && <div className="invoicing-empty">{t('invoicing.clients.empty')}</div>}
      </div>
    </div>
  );
};
