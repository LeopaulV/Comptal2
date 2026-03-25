import { PosteFacture, PosteGroupe } from '../types/Invoice';
import { FileService } from './FileService';
import { ProfilePaths } from './ProfilePaths';

export class PosteAssociationService {
  private static cache: PosteFacture[] | null = null;
  private static groupesCache: PosteGroupe[] | null = null;

  static async loadPostes(): Promise<PosteFacture[]> {
    if (this.cache) return this.cache;
    try {
      const content = await FileService.readFile(await ProfilePaths.parametreFile('postes_association.json'));
      this.cache = JSON.parse(content);
      return this.cache!;
    } catch {
      this.cache = [];
      return [];
    }
  }

  static async savePostes(postes: PosteFacture[]): Promise<void> {
    const content = JSON.stringify(postes, null, 2);
    await FileService.writeFile(await ProfilePaths.parametreFile('postes_association.json'), content);
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
    if (this.groupesCache) return this.groupesCache;
    try {
      const content = await FileService.readFile(await ProfilePaths.parametreFile('postes_groupes_association.json'));
      const parsed: Array<Omit<PosteGroupe, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }> =
        JSON.parse(content);
      this.groupesCache = parsed.map((g) => ({
        ...g,
        createdAt: new Date(g.createdAt),
        updatedAt: new Date(g.updatedAt),
      }));
      return this.groupesCache;
    } catch {
      this.groupesCache = [];
      return [];
    }
  }

  static async savePostesGroupes(groupes: PosteGroupe[]): Promise<void> {
    const serialized = groupes.map((g) => ({
      ...g,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }));
    const content = JSON.stringify(serialized, null, 2);
    await FileService.writeFile(await ProfilePaths.parametreFile('postes_groupes_association.json'), content);
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
    const filtered = groupes.filter((g) => g.id !== id);
    await this.savePostesGroupes(filtered);
  }
}
