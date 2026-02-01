import { PosteFacture, PosteGroupe } from '../types/Invoice';
import { FileService } from './FileService';

const POSTES_PATH = 'parametre/postes_catalogue.json';
const POSTES_GROUPES_PATH = 'parametre/postes_groupes.json';

export class PosteService {
  private static cache: PosteFacture[] | null = null;
  private static groupesCache: PosteGroupe[] | null = null;

  static async loadPostes(): Promise<PosteFacture[]> {
    if (this.cache) {
      return this.cache;
    }
    try {
      const content = await FileService.readFile(POSTES_PATH);
      this.cache = JSON.parse(content);
      return this.cache!;
    } catch (error: any) {
      this.cache = [];
      return [];
    }
  }

  static async savePostes(postes: PosteFacture[]): Promise<void> {
    const content = JSON.stringify(postes, null, 2);
    await FileService.writeFile(POSTES_PATH, content);
    this.cache = postes;
  }

  static async addPoste(poste: PosteFacture): Promise<void> {
    const postes = await this.loadPostes();
    postes.push(poste);
    await this.savePostes(postes);
  }

  static async updatePoste(id: string, updated: PosteFacture): Promise<void> {
    const postes = await this.loadPostes();
    const index = postes.findIndex((p) => p.id === id);
    if (index >= 0) {
      postes[index] = updated;
      await this.savePostes(postes);
    }
  }

  static async deletePoste(id: string): Promise<void> {
    const postes = await this.loadPostes();
    const filtered = postes.filter((p) => p.id !== id);
    await this.savePostes(filtered);
  }

  static async loadPostesGroupes(): Promise<PosteGroupe[]> {
    if (this.groupesCache) {
      return this.groupesCache;
    }
    try {
      const content = await FileService.readFile(POSTES_GROUPES_PATH);
      const parsed: Array<Omit<PosteGroupe, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }> =
        JSON.parse(content);
      this.groupesCache = parsed.map((groupe) => ({
        ...groupe,
        createdAt: new Date(groupe.createdAt),
        updatedAt: new Date(groupe.updatedAt),
      }));
      return this.groupesCache;
    } catch (error: any) {
      this.groupesCache = [];
      return [];
    }
  }

  static async savePostesGroupes(groupes: PosteGroupe[]): Promise<void> {
    const serialized = groupes.map((groupe) => ({
      ...groupe,
      createdAt: groupe.createdAt.toISOString(),
      updatedAt: groupe.updatedAt.toISOString(),
    }));
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(POSTES_GROUPES_PATH, content);
    this.groupesCache = groupes;
  }

  static async savePosteGroupe(groupe: PosteGroupe): Promise<void> {
    const groupes = await this.loadPostesGroupes();
    const index = groupes.findIndex((item) => item.id === groupe.id);
    const now = new Date();
    const normalized: PosteGroupe = {
      ...groupe,
      createdAt: groupe.createdAt || now,
      updatedAt: now,
    };
    if (index >= 0) {
      groupes[index] = normalized;
    } else {
      groupes.push(normalized);
    }
    await this.savePostesGroupes(groupes);
  }

  static async deletePosteGroupe(id: string): Promise<void> {
    const groupes = await this.loadPostesGroupes();
    const filtered = groupes.filter((groupe) => groupe.id !== id);
    await this.savePostesGroupes(filtered);
  }
}
