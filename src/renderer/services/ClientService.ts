import { Client } from '../types/Invoice';
import { FileService } from './FileService';

const CLIENTS_PATH = 'parametre/clients.json';

export class ClientService {
  private static clientsCache: Client[] | null = null;

  static async loadClients(): Promise<Client[]> {
    if (this.clientsCache) {
      return this.clientsCache;
    }
    try {
      const content = await FileService.readFile(CLIENTS_PATH);
      const parsed: Client[] = JSON.parse(content);
      const clients = parsed.map((client) => ({
        ...client,
        createdAt: new Date(client.createdAt),
        updatedAt: new Date(client.updatedAt),
      }));
      this.clientsCache = clients;
      return clients;
    } catch (error: any) {
      this.clientsCache = [];
      return [];
    }
  }

  static async saveClients(clients: Client[]): Promise<void> {
    const serialized = clients.map((client) => ({
      ...client,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString(),
    }));
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(CLIENTS_PATH, content);
    this.clientsCache = clients;
  }

  static async upsertClient(client: Client): Promise<void> {
    const clients = await this.loadClients();
    const existingIndex = clients.findIndex((item) => item.id === client.id);
    const now = new Date();
    const codeClient = client.codeClient || this.generateCodeClient(client, clients);
    const normalized: Client = {
      ...client,
      codeClient,
      createdAt: client.createdAt || now,
      updatedAt: now,
    };
    if (existingIndex >= 0) {
      clients[existingIndex] = normalized;
    } else {
      clients.push(normalized);
    }
    await this.saveClients(clients);
  }

  static async deleteClient(clientId: string): Promise<void> {
    const clients = await this.loadClients();
    const updated = clients.filter((client) => client.id !== clientId);
    await this.saveClients(updated);
  }

  static async getClientById(clientId: string): Promise<Client | null> {
    const clients = await this.loadClients();
    return clients.find((client) => client.id === clientId) || null;
  }

  static async searchClients(query: string): Promise<Client[]> {
    const clients = await this.loadClients();
    const normalizedQuery = this.normalize(query);
    if (!normalizedQuery) {
      return clients;
    }
    return clients.filter((client) => {
      const fields = [
        client.nom,
        client.prenom,
        client.denominationSociale,
        client.email,
        client.telephone,
        client.siren,
        client.siret,
      ]
        .filter(Boolean)
        .map((value) => this.normalize(String(value)));
      return fields.some((value) => value.includes(normalizedQuery));
    });
  }

  private static normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private static generateCodeClient(client: Client, clients: Client[]): string {
    const prefix = this.getClientPrefix(client);
    const existing = clients
      .map((item) => item.codeClient)
      .filter((value): value is string => Boolean(value))
      .filter((value) => value.startsWith(prefix));
    const maxSuffix = existing.reduce((acc, value) => {
      const match = value.slice(prefix.length).match(/\d{3}$/);
      if (!match) {
        return acc;
      }
      const parsed = Number(match[0]);
      return Number.isNaN(parsed) ? acc : Math.max(acc, parsed);
    }, 0);
    const nextSuffix = String(maxSuffix + 1).padStart(3, '0');
    return `${prefix}${nextSuffix}`;
  }

  private static getClientPrefix(client: Client): string {
    if (client.type === 'particulier') {
      const initialNom = (client.nom || '').trim().charAt(0);
      const initialPrenom = (client.prenom || '').trim().charAt(0);
      const initials = `${initialNom}${initialPrenom}`.toUpperCase();
      if (initials.length === 2) {
        return initials;
      }
    }
    const source = client.denominationSociale || client.nom || client.prenom || 'CL';
    const cleaned = source
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2);
    }
    return 'CL';
  }
}
