import { Donateur, DonateurSerialized, DonateurTransactionMapping } from '../types/Association';
import { FileService } from './FileService';
import { DataService } from './DataService';

const DONATEURS_PATH = 'parametre/donateurs.json';
const DONATEUR_TRANSACTIONS_PATH = 'parametre/donateur_transactions.json';

export class DonateurService {
  private static cache: Donateur[] | null = null;
  private static mappingCache: DonateurTransactionMapping | null = null;

  static async loadDonateurs(): Promise<Donateur[]> {
    if (this.cache) {
      return this.cache;
    }
    try {
      const content = await FileService.readFile(DONATEURS_PATH);
      const parsed: DonateurSerialized[] = JSON.parse(content);
      const donateurs = parsed.map((d) => ({
        ...d,
        createdAt: new Date(d.createdAt),
        updatedAt: new Date(d.updatedAt),
      }));
      this.cache = donateurs;
      return donateurs;
    } catch {
      this.cache = [];
      return [];
    }
  }

  static async saveDonateurs(donateurs: Donateur[]): Promise<void> {
    const serialized: DonateurSerialized[] = donateurs.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(DONATEURS_PATH, content);
    this.cache = donateurs;
  }

  static async upsertDonateur(donateur: Donateur): Promise<void> {
    const donateurs = await this.loadDonateurs();
    const existingIndex = donateurs.findIndex((item) => item.id === donateur.id);
    const now = new Date();
    const normalized: Donateur = {
      ...donateur,
      createdAt: donateur.createdAt || now,
      updatedAt: now,
    };
    if (existingIndex >= 0) {
      donateurs[existingIndex] = normalized;
    } else {
      donateurs.push(normalized);
    }
    await this.saveDonateurs(donateurs);

    // Si une catégorie est assignée : une catégorie par donateur + lier toutes les transactions de cette catégorie
    if (normalized.categoryCode) {
      // Retirer la même catégorie des autres donateurs (une catégorie = un seul donateur)
      let othersUpdated = false;
      for (const d of donateurs) {
        if (d.id !== normalized.id && d.categoryCode === normalized.categoryCode) {
          d.categoryCode = undefined;
          d.updatedAt = now;
          othersUpdated = true;
        }
      }
      if (othersUpdated) {
        await this.saveDonateurs(donateurs);
      }

      // Lier toutes les transactions de cette catégorie à ce donateur
      const transactions = await DataService.getTransactions();
      const toLink = transactions.filter(
        (t) => t.category === normalized.categoryCode && t.amount > 0
      );
      if (toLink.length > 0) {
        const mapping = await this.loadTransactionMapping();
        for (const t of toLink) {
          mapping[t.id] = normalized.id;
        }
        await this.saveTransactionMapping(mapping);
      }
    }
  }

  static async deleteDonateur(donateurId: string): Promise<void> {
    const donateurs = await this.loadDonateurs();
    const updated = donateurs.filter((d) => d.id !== donateurId);
    await this.saveDonateurs(updated);
    // Retirer les liaisons transaction de ce donateur
    const mapping = await this.loadTransactionMapping();
    const newMapping = { ...mapping };
    for (const [txId, dId] of Object.entries(newMapping)) {
      if (dId === donateurId) delete newMapping[txId];
    }
    await this.saveTransactionMapping(newMapping);
  }

  static async getDonateurById(donateurId: string): Promise<Donateur | null> {
    const donateurs = await this.loadDonateurs();
    return donateurs.find((d) => d.id === donateurId) || null;
  }

  static async searchDonateurs(query: string): Promise<Donateur[]> {
    const donateurs = await this.loadDonateurs();
    const normalizedQuery = this.normalize(query);
    if (!normalizedQuery) return donateurs;
    return donateurs.filter((d) => {
      const fields = [
        d.nom,
        d.prenom,
        d.denominationSociale,
        d.email,
        d.telephone,
        d.siren,
        d.siret,
      ]
        .filter(Boolean)
        .map((v) => this.normalize(String(v)));
      return fields.some((v) => v.includes(normalizedQuery));
    });
  }

  private static normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // --- Liaison transaction <-> donateur ---

  static async loadTransactionMapping(): Promise<DonateurTransactionMapping> {
    if (this.mappingCache) return this.mappingCache;
    try {
      const content = await FileService.readFile(DONATEUR_TRANSACTIONS_PATH);
      this.mappingCache = JSON.parse(content);
      return this.mappingCache!;
    } catch {
      this.mappingCache = {};
      return {};
    }
  }

  static async saveTransactionMapping(mapping: DonateurTransactionMapping): Promise<void> {
    const content = JSON.stringify(mapping, null, 2);
    await FileService.writeFile(DONATEUR_TRANSACTIONS_PATH, content);
    this.mappingCache = mapping;
  }

  static async linkTransactionToDonateur(transactionId: string, donateurId: string): Promise<void> {
    const mapping = await this.loadTransactionMapping();
    mapping[transactionId] = donateurId;
    await this.saveTransactionMapping(mapping);
  }

  static async unlinkTransaction(transactionId: string): Promise<void> {
    const mapping = await this.loadTransactionMapping();
    delete mapping[transactionId];
    await this.saveTransactionMapping(mapping);
  }

  static async getTransactionIdsByDonateur(donateurId: string): Promise<string[]> {
    const mapping = await this.loadTransactionMapping();
    return Object.entries(mapping)
      .filter(([, dId]) => dId === donateurId)
      .map(([txId]) => txId);
  }

  static generateId(): string {
    return `DON-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
