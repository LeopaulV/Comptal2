import { ReceiptEntry } from '../types/Association';
import { FileService } from './FileService';
import { AssociationConfigService } from './AssociationConfigService';
import { ProfilePaths } from './ProfilePaths';

export class RegistreRecusService {
  static async loadRegistre(): Promise<ReceiptEntry[]> {
    try {
      const content = await FileService.readFile(await ProfilePaths.parametreFile('registre_recus.json'));
      return JSON.parse(content) as ReceiptEntry[];
    } catch {
      return [];
    }
  }

  static async saveRegistre(entries: ReceiptEntry[]): Promise<void> {
    await FileService.writeFile(await ProfilePaths.parametreFile('registre_recus.json'), JSON.stringify(entries, null, 2));
  }

  /** Génère le prochain numéro séquentiel et l'incrémente dans la config */
  static async generateNextNumero(): Promise<string> {
    const config = await AssociationConfigService.getOrCreateConfig();
    const year = new Date().getFullYear();
    const counter = (config.nextReceiptNumber ?? 0) + 1;
    const padded = String(counter).padStart(4, '0');
    const numero = `RECU-${year}-${padded}`;

    await AssociationConfigService.saveConfig({
      ...config,
      nextReceiptNumber: counter,
    });

    return numero;
  }

  /** Ajoute une nouvelle entrée dans le registre */
  static async addEntry(entry: Omit<ReceiptEntry, 'id'>): Promise<ReceiptEntry> {
    const entries = await this.loadRegistre();
    const newEntry: ReceiptEntry = {
      ...entry,
      id: `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    entries.unshift(newEntry);
    await this.saveRegistre(entries);
    return newEntry;
  }

  /** Annule un reçu dans le registre (ne le supprime pas) */
  static async annulerRecu(id: string): Promise<void> {
    const entries = await this.loadRegistre();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx === -1) return;
    entries[idx] = {
      ...entries[idx],
      annule: true,
      dateAnnulation: new Date().toISOString(),
    };
    await this.saveRegistre(entries);
  }

  /** Supprime définitivement une entrée du registre */
  static async deleteEntry(id: string): Promise<void> {
    const entries = await this.loadRegistre();
    await this.saveRegistre(entries.filter((e) => e.id !== id));
  }
}
