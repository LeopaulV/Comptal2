// Chemins relatifs vers le stockage du profil actif (profiles/{id}/parametre, profiles/{id}/data)

import { FileService } from './FileService';

const ACTIVE_FILE = 'profiles/active.json';
const PROFILES_DIR = 'profiles';

let cachedActiveProfileId: string | null | undefined;

export class ProfilePaths {
  /** Réinitialise le cache après changement de profil */
  static invalidate(): void {
    cachedActiveProfileId = undefined;
  }

  static async getActiveProfileId(): Promise<string | null> {
    if (cachedActiveProfileId !== undefined) {
      return cachedActiveProfileId;
    }
    try {
      const content = await FileService.readFile(ACTIVE_FILE);
      const data = JSON.parse(content);
      const id: string | null = data.activeProfileId ?? null;
      cachedActiveProfileId = id;
      return id;
    } catch {
      cachedActiveProfileId = null;
      return null;
    }
  }

  /** ID profil actif requis (après ensureInitialized) */
  static async requireActiveProfileId(): Promise<string> {
    const id = await this.getActiveProfileId();
    if (!id) {
      throw new Error('Aucun profil actif. Ouvrez Paramètres → Profils ou redémarrez l’application.');
    }
    return id;
  }

  /** `profiles/{id}/parametre/{fileName}` */
  static async parametreFile(fileName: string): Promise<string> {
    const id = await this.requireActiveProfileId();
    return `${PROFILES_DIR}/${id}/parametre/${fileName}`;
  }

  /** `profiles/{id}/data` */
  static async getDataDirectory(): Promise<string> {
    const id = await this.requireActiveProfileId();
    return `${PROFILES_DIR}/${id}/data`;
  }

  static getProfileDataPath(profileId: string): string {
    return `${PROFILES_DIR}/${profileId}/data`;
  }

  static getProfileParametrePath(profileId: string): string {
    return `${PROFILES_DIR}/${profileId}/parametre`;
  }
}
