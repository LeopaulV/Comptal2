import { RecetteRegistreEntry } from '../types/Invoice';
import { FileService } from './FileService';
import { ProfilePaths } from './ProfilePaths';

export class RegistreRecettesEntrepriseService {
  static async loadRegistre(): Promise<RecetteRegistreEntry[]> {
    try {
      const content = await FileService.readFile(await ProfilePaths.parametreFile('registre_recettes_entreprise.json'));
      return JSON.parse(content) as RecetteRegistreEntry[];
    } catch {
      return [];
    }
  }

  static async saveRegistre(entries: RecetteRegistreEntry[]): Promise<void> {
    await FileService.writeFile(await ProfilePaths.parametreFile('registre_recettes_entreprise.json'), JSON.stringify(entries, null, 2));
  }

  /** Ajoute une nouvelle entrée dans le registre des recettes */
  static async addEntry(entry: Omit<RecetteRegistreEntry, 'id'>): Promise<RecetteRegistreEntry> {
    const entries = await this.loadRegistre();
    const newEntry: RecetteRegistreEntry = {
      ...entry,
      id: `recette-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    entries.unshift(newEntry);
    await this.saveRegistre(entries);
    return newEntry;
  }
}
