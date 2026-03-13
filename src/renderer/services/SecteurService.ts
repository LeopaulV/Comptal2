import { FileService } from './FileService';

const SECTEURS_PATH = 'parametre/secteurs_activite.json';

export interface SecteurActivite {
  id: string;
  nom: string;
  ordre: number;
}

export class SecteurService {
  private static cache: SecteurActivite[] | null = null;

  static async loadSecteurs(): Promise<SecteurActivite[]> {
    if (this.cache) {
      return this.cache;
    }
    try {
      const content = await FileService.readFileOptional(SECTEURS_PATH);
      if (content === null) {
        this.cache = [];
        return [];
      }
      this.cache = JSON.parse(content);
      return this.cache!;
    } catch (error: any) {
      this.cache = [];
      return [];
    }
  }

  static async saveSecteurs(secteurs: SecteurActivite[]): Promise<void> {
    const content = JSON.stringify(secteurs, null, 2);
    await FileService.writeFile(SECTEURS_PATH, content);
    this.cache = secteurs;
  }

  static async addSecteur(secteur: SecteurActivite): Promise<void> {
    const secteurs = await this.loadSecteurs();
    secteurs.push(secteur);
    await this.saveSecteurs(secteurs);
  }

  static async updateSecteur(id: string, updated: SecteurActivite): Promise<void> {
    const secteurs = await this.loadSecteurs();
    const index = secteurs.findIndex((s) => s.id === id);
    if (index >= 0) {
      secteurs[index] = updated;
      await this.saveSecteurs(secteurs);
    }
  }

  static async deleteSecteur(id: string): Promise<void> {
    const secteurs = await this.loadSecteurs();
    const filtered = secteurs.filter((s) => s.id !== id);
    await this.saveSecteurs(filtered);
  }

  static invalidateCache(): void {
    this.cache = null;
  }
}
