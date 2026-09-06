import { Client } from '../types/invoice';
import { newEntityId, parseDateOrNow, reviveAdresse } from '../utils/invoiceFormat';
import { Db } from './db';
import { EmetteurService } from './EmetteurService';
import { withLog } from './logger';
import i18n from '../i18n/config';
import { isLightEmail } from '../utils/security';

function reviveClient(raw: Partial<Client> & { createdAt?: unknown; updatedAt?: unknown }): Client {
  return {
    ...(raw as Client),
    id: raw.id || newEntityId('cli'),
    type: raw.type ?? 'particulier',
    roles: raw.roles?.length ? raw.roles : ['client'],
    adresseFacturation: reviveAdresse(raw.adresseFacturation),
    adresseLivraison: raw.adresseLivraison ? reviveAdresse(raw.adresseLivraison) : undefined,
    createdAt: parseDateOrNow(raw.createdAt),
    updatedAt: parseDateOrNow(raw.updatedAt),
  };
}

function serializeClient(client: Client) {
  return {
    ...client,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

function generateCodeClient(client: Client, clients: Client[]): string {
  const prefix = getClientPrefix(client);
  const existing = clients
    .map((item) => item.codeClient)
    .filter((value): value is string => Boolean(value))
    .filter((value) => value.startsWith(prefix));
  const maxSuffix = existing.reduce((acc, value) => {
    const match = value.slice(prefix.length).match(/\d{3}$/);
    if (!match) return acc;
    const parsed = Number(match[0]);
    return Number.isNaN(parsed) ? acc : Math.max(acc, parsed);
  }, 0);
  return `${prefix}${String(maxSuffix + 1).padStart(3, '0')}`;
}

function getClientPrefix(client: Client): string {
  if (client.type === 'particulier') {
    const initials = `${(client.nom || '').trim().charAt(0)}${(client.prenom || '').trim().charAt(0)}`.toUpperCase();
    if (initials.length === 2) return initials;
  }
  const source = client.denominationSociale || client.nom || client.prenom || 'CL';
  const cleaned = source
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '');
  if (cleaned.length >= 2) return cleaned.slice(0, 2);
  return 'CL';
}

function normalizeQuery(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export const ClientService = {
  async loadClients(): Promise<Client[]> {
    return withLog('ClientService.loadClients', async () => {
      const rows = await Db.select<{ payload: string }>('SELECT payload FROM clients ORDER BY updated_at DESC');
      return rows.map((r) => reviveClient(JSON.parse(r.payload)));
    });
  },

  async loadClientsLite(): Promise<Client[]> {
    return withLog('ClientService.loadClientsLite', async () => {
      const rows = await Db.select<{ payload: string }>('SELECT payload FROM clients ORDER BY updated_at DESC');
      return rows.map((r) => {
        const raw = JSON.parse(r.payload) as Partial<Client> & { createdAt?: unknown; updatedAt?: unknown };
        const client = reviveClient(raw);
        return {
          ...client,
          notes: undefined,
          coordonneesBancaires: undefined,
        };
      });
    });
  },

  async getClientById(clientId: string): Promise<Client | null> {
    const rows = await Db.select<{ payload: string }>('SELECT payload FROM clients WHERE id = ?', [clientId]);
    if (!rows[0]) return null;
    return reviveClient(JSON.parse(rows[0].payload));
  },

  async loadBillingClients(): Promise<Client[]> {
    const contacts = await this.loadClients();
    return contacts.filter((contact) => contact.roles?.includes('client'));
  },

  async upsertClient(client: Client): Promise<Client> {
    return withLog('ClientService.upsertClient', async () => {
      const clients = await this.loadClients();
      const now = new Date();
      const codeClient = client.codeClient || generateCodeClient(client, clients);
      const email = client.email?.trim() || undefined;
      if (email && !isLightEmail(email)) {
        throw new Error(i18n.t('errors.emailInvalid'));
      }
      const iban = client.coordonneesBancaires?.iban?.trim();
      if (iban && !EmetteurService.validateIban(iban)) {
        throw new Error(i18n.t('errors.ibanInvalid'));
      }
      const normalized: Client = {
        ...client,
        id: client.id || newEntityId('cli'),
        codeClient,
        email,
        createdAt: client.createdAt || now,
        updatedAt: now,
      };
      const payload = JSON.stringify(serializeClient(normalized));
      await Db.execute(
        `INSERT INTO clients (id, code_client, type, archived, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           code_client = excluded.code_client,
           type = excluded.type,
           archived = excluded.archived,
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
        [
          normalized.id,
          normalized.codeClient ?? null,
          normalized.type,
          normalized.archived ? 1 : 0,
          payload,
          normalized.updatedAt.toISOString(),
        ]
      );
      return normalized;
    });
  },

  async deleteClient(clientId: string): Promise<void> {
    return withLog('ClientService.deleteClient', async () => {
      const [devis, factures, donations] = await Promise.all([
        Db.select<{ id: string }>('SELECT id FROM devis WHERE client_id = ? AND supprime = 0 LIMIT 1', [clientId]),
        Db.select<{ id: string }>('SELECT id FROM factures WHERE client_id = ? AND supprime = 0 LIMIT 1', [clientId]),
        Db.select<{ id: string }>('SELECT id FROM donations WHERE contact_id = ? LIMIT 1', [clientId]),
      ]);
      if (devis.length > 0 || factures.length > 0 || donations.length > 0) {
        throw new Error(i18n.t('errors.contactHasLinks'));
      }
      await Db.execute('DELETE FROM clients WHERE id = ?', [clientId]);
    });
  },

  async searchClients(query: string): Promise<Client[]> {
    const clients = await this.loadClients();
    const q = normalizeQuery(query);
    if (!q) return clients;
    return clients.filter((client) => {
      const fields = [
        client.nom,
        client.prenom,
        client.denominationSociale,
        client.email,
        client.telephone,
        client.siren,
        client.siret,
        client.codeClient,
      ]
        .filter(Boolean)
        .map((value) => normalizeQuery(String(value)));
      return fields.some((value) => value.includes(q));
    });
  },

  async importList(rawList: unknown[]): Promise<number> {
    let count = 0;
    for (const raw of rawList) {
      const client = reviveClient(raw as Partial<Client>);
      await this.upsertClient(client);
      count += 1;
    }
    return count;
  },
};
