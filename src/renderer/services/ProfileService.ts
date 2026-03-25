// Service de gestion des profils Comptal2
// Stockage : profiles/{id}/parametre/ et profiles/{id}/data/ uniquement

import { FileService } from './FileService';
import { ConfigService } from './ConfigService';
import { DataService } from './DataService';
import { ProfilePaths } from './ProfilePaths';
import { DEFAULT_SETTINGS } from '../types/Settings';

const PROFILES_DIR = 'profiles';
const ACTIVE_FILE = 'profiles/active.json';
const PARAMETRE_DIR = 'parametre';
const ROOT_PARAMETRE = 'parametre';
const ROOT_DATA = 'data';

/** Fichiers JSON à persister par profil (structure neutre pour nouveau profil) */
const PROFILE_FILES = [
  'account.json',
  'association_config.json',
  'auto_categorisation.json',
  'categories.json',
  'chemin_acces.json',
  'clients.json',
  'color_palettes.json',
  'colors_main.json',
  'devis.json',
  'donateur_transactions.json',
  'donateurs.json',
  'dons_manuels.json',
  'emetteur.json',
  'emetteur_extended.json',
  'factures.json',
  'invoice_settings.json',
  'mentions_legales.json',
  'paiements.json',
  'pdf_templates.json',
  'postes_catalogue.json',
  'postes_groupes.json',
  'projects.json',
  'registre_recettes_entreprise.json',
  'registre_recus.json',
  'settings.json',
  'solde_compte.json',
  'stock_articles.json',
  'stock_categories.json',
  'stock_mouvements.json',
  'postes_association.json',
  'postes_groupes_association.json',
  'secteurs_activite.json',
] as const;

/** Contenu par défaut pour un nouveau profil (données neutres) */
const DEFAULT_CONTENT: Record<string, string> = {
  'account.json': '{}',
  'association_config.json': '{}',
  'auto_categorisation.json': '{}',
  'categories.json': '{}',
  'chemin_acces.json': '{}',
  'clients.json': '[]',
  'color_palettes.json': '[]',
  'colors_main.json': '{}',
  'devis.json': '[]',
  'donateur_transactions.json': '[]',
  'donateurs.json': '[]',
  'dons_manuels.json': '[]',
  'emetteur.json': '{}',
  'emetteur_extended.json': '{}',
  'factures.json': '[]',
  'invoice_settings.json': JSON.stringify({
    emetteur: {
      id: 'emit-default',
      type: 'entreprise',
      denominationSociale: '',
      formeJuridique: '',
      siren: '',
      siret: '',
      numeroTVA: '',
      rna: '',
      codeNAF: '',
      rcs: '',
      rm: '',
      capitalSocial: 0,
      adresse: { rue: '', codePostal: '', ville: '', pays: 'France' },
      telephone: '',
      email: '',
      siteWeb: '',
      logo: '',
      coordonneesBancaires: { titulaire: '', iban: '', bic: '', banque: '' },
      regimeTVA: 'franchise',
      mentionFranchiseTVA: 'TVA non applicable, art. 293 B du CGI',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    prefixeDevis: 'DEVIS',
    prefixeFacture: 'FAC',
    formatNumero: '{PREFIX}-{YEAR}-{SEQ:4}',
    prochainNumeroDevis: 1,
    prochainNumeroFacture: 1,
    tauxTVADefaut: 20,
    delaiPaiementDefaut: 30,
    conditionsPaiementDefaut: 'Paiement à 30 jours',
    mentionsPenalitesRetard: '',
    mentionIndemniteRecouvrement: '',
    mentionsParticulieres: '',
  }, null, 2),
  'mentions_legales.json': '[]',
  'paiements.json': '[]',
  'pdf_templates.json': '[]',
  'postes_catalogue.json': '[]',
  'postes_groupes.json': '[]',
  'projects.json': '{}',
  'registre_recettes_entreprise.json': '[]',
  'registre_recus.json': '[]',
  'settings.json': JSON.stringify({ ...DEFAULT_SETTINGS, dataDirectory: './data' }, null, 2),
  'solde_compte.json': '{}',
  'stock_articles.json': '[]',
  'stock_categories.json': '[]',
  'stock_mouvements.json': '[]',
  'postes_association.json': '[]',
  'postes_groupes_association.json': '[]',
  'secteurs_activite.json': '[]',
};

export interface ProfileInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastSaved?: string;
}

export interface ProfileListItem extends ProfileInfo {
  isActive: boolean;
}

function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function ensureProfilesDir(): Promise<void> {
  try {
    await FileService.readDirectory(PROFILES_DIR);
  } catch {
    await FileService.writeFile(`${PROFILES_DIR}/.gitkeep`, '');
  }
}

async function setActiveProfileId(id: string): Promise<void> {
  await FileService.writeFile(ACTIVE_FILE, JSON.stringify({ activeProfileId: id }, null, 2));
  ProfilePaths.invalidate();
}

/** Copie le contenu de sourceDir vers destDir (chemins relatifs) */
async function copyParametreDir(sourceDir: string, destDir: string): Promise<void> {
  for (const file of PROFILE_FILES) {
    try {
      const content = await FileService.readFile(`${sourceDir}/${file}`);
      await FileService.writeFile(`${destDir}/${file}`, content);
    } catch {
      // Fichier optionnel ou inexistant, ignorer
    }
  }
}

function getProfileDataPath(profileId: string): string {
  return ProfilePaths.getProfileDataPath(profileId);
}

async function rootParametreLooksPopulated(): Promise<boolean> {
  const settings = await FileService.readFileOptional(`${ROOT_PARAMETRE}/settings.json`);
  const account = await FileService.readFileOptional(`${ROOT_PARAMETRE}/account.json`);
  return !!(settings || account);
}

/** Crée un profil avec fichiers par défaut (parametre + dossier data vide si besoin) */
async function seedNewProfile(
  id: string,
  name: string,
  description: string | undefined,
  lastSaved: string
): Promise<void> {
  const profileDir = `${PROFILES_DIR}/${id}`;
  const parametrePath = `${profileDir}/${PARAMETRE_DIR}`;
  const profileDataPath = getProfileDataPath(id);

  for (const file of PROFILE_FILES) {
    const content =
      file === 'settings.json'
        ? JSON.stringify({ ...DEFAULT_SETTINGS, dataDirectory: profileDataPath }, null, 2)
        : (DEFAULT_CONTENT[file] ?? '{}');
    await FileService.writeFile(`${parametrePath}/${file}`, content);
  }

  const info: ProfileInfo = {
    id,
    name,
    description,
    createdAt: new Date().toISOString(),
    lastSaved,
  };
  await FileService.writeFile(`${profileDir}/info.json`, JSON.stringify(info, null, 2));
}

/** Migre parametre/ et data/ racine vers un nouveau profil */
async function migrateRootIntoNewProfile(): Promise<string> {
  const id = generateId();
  const profileDir = `${PROFILES_DIR}/${id}`;
  const parametrePath = `${profileDir}/${PARAMETRE_DIR}`;
  const profileDataPath = getProfileDataPath(id);

  await copyParametreDir(ROOT_PARAMETRE, parametrePath);
  try {
    await FileService.copyDirectory(ROOT_DATA, profileDataPath);
  } catch (err) {
    console.warn('[ProfileService] Migration data racine:', err);
  }

  const settingsPath = `${parametrePath}/settings.json`;
  try {
    const raw = await FileService.readFile(settingsPath);
    const s = JSON.parse(raw);
    s.dataDirectory = profileDataPath;
    await FileService.writeFile(settingsPath, JSON.stringify(s, null, 2));
  } catch {
    await FileService.writeFile(
      settingsPath,
      JSON.stringify({ ...DEFAULT_SETTINGS, dataDirectory: profileDataPath }, null, 2)
    );
  }

  const info: ProfileInfo = {
    id,
    name: 'Principal',
    description: 'Migré depuis le dossier racine',
    createdAt: new Date().toISOString(),
    lastSaved: new Date().toISOString(),
  };
  await FileService.writeFile(`${profileDir}/info.json`, JSON.stringify(info, null, 2));
  await setActiveProfileId(id);
  return id;
}

/** Si des profils existent mais pas active.json : active le premier profil trouvé */
async function activateFirstExistingProfile(): Promise<void> {
  const entries = await FileService.readDirectory(PROFILES_DIR);
  const profileIds = entries
    .filter((e) => e !== '.gitkeep' && e !== 'active.json' && !e.includes('.') && e.startsWith('profile_'))
    .sort();
  if (profileIds.length === 0) return;
  await setActiveProfileId(profileIds[0]);
}

export class ProfileService {
  /**
   * Initialise le système de profils : migration racine, profil vide, ou profil actif manquant.
   */
  static async ensureInitialized(): Promise<void> {
    await ensureProfilesDir();

    let activeId = await ProfilePaths.getActiveProfileId();
    if (activeId) {
      try {
        await FileService.readFile(`${PROFILES_DIR}/${activeId}/info.json`);
      } catch {
        activeId = null;
        ProfilePaths.invalidate();
      }
    }

    const entries = await FileService.readDirectory(PROFILES_DIR).catch(() => []);
    const hasProfiles = entries.some(
      (f) => f !== '.gitkeep' && f !== 'active.json' && !f.startsWith('.') && f.startsWith('profile_')
    );

    if (!activeId && hasProfiles) {
      await activateFirstExistingProfile();
      return;
    }

    if (activeId) return;

    if (!hasProfiles && (await rootParametreLooksPopulated())) {
      await migrateRootIntoNewProfile();
      return;
    }

    if (!hasProfiles) {
      const id = generateId();
      await seedNewProfile(id, 'Principal', 'Profil par défaut', new Date().toISOString());
      await setActiveProfileId(id);
    }
  }

  /** Liste tous les profils avec indication du profil actif */
  static async listProfiles(): Promise<ProfileListItem[]> {
    await ensureProfilesDir();
    const activeId = await ProfilePaths.getActiveProfileId();

    const entries = await FileService.readDirectory(PROFILES_DIR);
    const profileIds = entries.filter((e) => e !== '.gitkeep' && e !== 'active.json' && !e.includes('.'));

    const result: ProfileListItem[] = [];
    for (const id of profileIds) {
      try {
        const content = await FileService.readFile(`${PROFILES_DIR}/${id}/info.json`);
        const info: ProfileInfo = JSON.parse(content);
        result.push({
          ...info,
          isActive: id === activeId,
        });
      } catch {
        result.push({
          id,
          name: id,
          createdAt: '',
          isActive: id === activeId,
        });
      }
    }

    return result.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  /**
   * Crée un nouveau profil vierge et bascule dessus.
   */
  static async createProfile(name: string, description?: string): Promise<void> {
    await ensureProfilesDir();
    const activeId = await ProfilePaths.getActiveProfileId();

    if (activeId) {
      try {
        const info = await this.getProfileInfo(activeId);
        info.lastSaved = new Date().toISOString();
        await FileService.writeFile(`${PROFILES_DIR}/${activeId}/info.json`, JSON.stringify(info, null, 2));
      } catch {}
    }

    const id = generateId();
    const now = new Date().toISOString();
    await seedNewProfile(id, name, description, now);
    await setActiveProfileId(id);

    ConfigService.clearCache();
    await DataService.reload();
  }

  /**
   * Charge un profil existant.
   */
  static async switchProfile(profileId: string): Promise<void> {
    const activeId = await ProfilePaths.getActiveProfileId();
    if (activeId === profileId) return;

    if (activeId) {
      try {
        const infoContent = await FileService.readFile(`${PROFILES_DIR}/${activeId}/info.json`);
        const info = JSON.parse(infoContent);
        info.lastSaved = new Date().toISOString();
        await FileService.writeFile(`${PROFILES_DIR}/${activeId}/info.json`, JSON.stringify(info, null, 2));
      } catch {}
    }

    await setActiveProfileId(profileId);

    ConfigService.clearCache();
    await DataService.reload();
  }

  /**
   * Supprime un profil (sauf s'il est actif).
   */
  static async deleteProfile(profileId: string): Promise<void> {
    const activeId = await ProfilePaths.getActiveProfileId();
    if (activeId === profileId) {
      throw new Error('Impossible de supprimer le profil actif');
    }

    const profileDir = `${PROFILES_DIR}/${profileId}`;
    try {
      await FileService.deleteDirectory(profileDir);
    } catch (err) {
      console.warn('[ProfileService] Erreur suppression profil:', err);
      throw err;
    }
  }

  static async getProfileInfo(profileId: string): Promise<ProfileInfo> {
    const content = await FileService.readFile(`${PROFILES_DIR}/${profileId}/info.json`);
    return JSON.parse(content);
  }

  static async getActiveProfile(): Promise<ProfileInfo | null> {
    const activeId = await ProfilePaths.getActiveProfileId();
    if (!activeId) return null;
    try {
      return await this.getProfileInfo(activeId);
    } catch {
      return null;
    }
  }

  /**
   * Met à jour la date de dernière sauvegarde du profil (export).
   */
  static async saveCurrentProfileToStorage(profileId: string): Promise<void> {
    try {
      const info = await this.getProfileInfo(profileId);
      info.lastSaved = new Date().toISOString();
      await FileService.writeFile(`${PROFILES_DIR}/${profileId}/info.json`, JSON.stringify(info, null, 2));
    } catch {}
  }

  /**
   * Exporte un profil (parametre + data) vers un fichier .zip.
   */
  static async exportProfile(profileId: string, profileName: string): Promise<{ path?: string; canceled?: boolean }> {
    const result = await window.electronAPI.exportProfile(profileId, profileName);
    if (!result.success) {
      if (result.canceled) return { canceled: true };
      throw new Error(result.error || "Erreur lors de l'export");
    }
    return { path: result.path };
  }

  /**
   * Importe un profil depuis un fichier .zip.
   */
  static async importProfile(zipPath: string, newProfileName: string): Promise<string> {
    const result = await window.electronAPI.importProfile(zipPath, newProfileName);
    if (!result.success) {
      throw new Error(result.error || "Erreur lors de l'import");
    }
    return result.profileId!;
  }
}
