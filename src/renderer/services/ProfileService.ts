// Service de gestion des profils Comptal2
// Chaque profil = parametre/ + data/ dans profiles/{id}/parametre/ et profiles/{id}/data/

import { FileService } from './FileService';
import { ConfigService } from './ConfigService';
import { DataService } from './DataService';
import { DEFAULT_SETTINGS } from '../types/Settings';

const PROFILES_DIR = 'profiles';
const ACTIVE_FILE = 'profiles/active.json';
const PARAMETRE_DIR = 'parametre';
const DATA_DIR_NAME = 'data';

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

async function getActiveProfileId(): Promise<string | null> {
  try {
    const content = await FileService.readFile(ACTIVE_FILE);
    const data = JSON.parse(content);
    return data.activeProfileId ?? null;
  } catch {
    return null;
  }
}

async function setActiveProfileId(id: string): Promise<void> {
  await FileService.writeFile(ACTIVE_FILE, JSON.stringify({ activeProfileId: id }, null, 2));
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

/** Écrit les fichiers parametre/ depuis le contenu du profil */
async function restoreParametreFromProfile(profileParametrePath: string): Promise<void> {
  for (const file of PROFILE_FILES) {
    try {
      const content = await FileService.readFile(`${profileParametrePath}/${file}`);
      await FileService.writeFile(`${PARAMETRE_DIR}/${file}`, content);
    } catch {
      // Utiliser le défaut si le fichier n'existe pas dans le profil
      const defaultContent = DEFAULT_CONTENT[file] ?? '{}';
      await FileService.writeFile(`${PARAMETRE_DIR}/${file}`, defaultContent);
    }
  }
}

/** Sauvegarde le parametre/ actuel vers le dossier du profil */
async function saveCurrentToProfile(profileParametrePath: string): Promise<void> {
  await copyParametreDir(PARAMETRE_DIR, profileParametrePath);
}

/** Chemin du dossier data d'un profil */
function getProfileDataPath(profileId: string): string {
  return `${PROFILES_DIR}/${profileId}/${DATA_DIR_NAME}`;
}

/** Sauvegarde le dossier data actuel vers le profil */
async function saveCurrentDataToProfile(profileId: string): Promise<void> {
  const settings = await ConfigService.loadSettings();
  const dataDir = settings.dataDirectory || './data';
  const destPath = getProfileDataPath(profileId);
  try {
    await FileService.copyDirectory(dataDir, destPath);
  } catch (err) {
    console.warn('[ProfileService] Impossible de copier le dossier data:', err);
  }
}

/** Met à jour dataDirectory dans settings pour pointer vers le profil */
async function setProfileDataDirectory(profileId: string): Promise<void> {
  const settings = await ConfigService.loadSettings();
  settings.dataDirectory = getProfileDataPath(profileId);
  await ConfigService.saveSettings(settings);
}

export class ProfileService {
  /**
   * Initialise le système de profils si nécessaire.
   * Au premier lancement, crée un profil "Principal" à partir du parametre/ actuel.
   */
  static async ensureInitialized(): Promise<void> {
    await ensureProfilesDir();
    const activeId = await getActiveProfileId();
    if (activeId) return;

    const files = await FileService.readDirectory(PROFILES_DIR).catch(() => []);
    const hasProfiles = files.some((f) => f !== '.gitkeep' && f !== 'active.json' && !f.startsWith('.'));

    if (!hasProfiles) {
    const id = generateId();
    const profileDir = `${PROFILES_DIR}/${id}`;
    const parametrePath = `${profileDir}/${PARAMETRE_DIR}`;
    const profileDataPath = getProfileDataPath(id);

      await copyParametreDir(PARAMETRE_DIR, parametrePath);
      try {
        const settings = await ConfigService.loadSettings();
        const currentDataDir = settings.dataDirectory || './data';
        await FileService.copyDirectory(currentDataDir, profileDataPath);
      } catch (err) {
        console.warn('[ProfileService] Copie data initiale:', err);
      }
      await FileService.writeFile(
        `${parametrePath}/settings.json`,
        JSON.stringify({ ...DEFAULT_SETTINGS, dataDirectory: profileDataPath }, null, 2)
      );
      await setProfileDataDirectory(id);
      await setActiveProfileId(id);

      const info: ProfileInfo = {
        id,
        name: 'Principal',
        description: 'Profil par défaut',
        createdAt: new Date().toISOString(),
        lastSaved: new Date().toISOString(),
      };
      await FileService.writeFile(`${profileDir}/info.json`, JSON.stringify(info, null, 2));
    }
  }

  /** Liste tous les profils avec indication du profil actif */
  static async listProfiles(): Promise<ProfileListItem[]> {
    await ensureProfilesDir();
    const activeId = await getActiveProfileId();

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
    const activeId = await getActiveProfileId();

    if (activeId) {
      const currentParamPath = `${PROFILES_DIR}/${activeId}/${PARAMETRE_DIR}`;
      await saveCurrentToProfile(currentParamPath);
      await saveCurrentDataToProfile(activeId);
      try {
        const info = await this.getProfileInfo(activeId);
        info.lastSaved = new Date().toISOString();
        await FileService.writeFile(`${PROFILES_DIR}/${activeId}/info.json`, JSON.stringify(info, null, 2));
      } catch {}
    }

    const id = generateId();
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
      lastSaved: new Date().toISOString(),
    };
    await FileService.writeFile(`${profileDir}/info.json`, JSON.stringify(info, null, 2));
    await setActiveProfileId(id);

    await restoreParametreFromProfile(parametrePath);
    ConfigService.clearCache();
    await DataService.reload();
  }

  /**
   * Charge un profil existant (sauvegarde l'actuel puis restaure le profil cible).
   */
  static async switchProfile(profileId: string): Promise<void> {
    const activeId = await getActiveProfileId();
    if (activeId === profileId) return;

    if (activeId) {
      const currentParamPath = `${PROFILES_DIR}/${activeId}/${PARAMETRE_DIR}`;
      await saveCurrentToProfile(currentParamPath);
      await saveCurrentDataToProfile(activeId);
      try {
        const infoContent = await FileService.readFile(`${PROFILES_DIR}/${activeId}/info.json`);
        const info = JSON.parse(infoContent);
        info.lastSaved = new Date().toISOString();
        await FileService.writeFile(`${PROFILES_DIR}/${activeId}/info.json`, JSON.stringify(info, null, 2));
      } catch {}
    }

    const targetParamPath = `${PROFILES_DIR}/${profileId}/${PARAMETRE_DIR}`;
    await restoreParametreFromProfile(targetParamPath);
    await setActiveProfileId(profileId);

    ConfigService.clearCache();
    await DataService.reload();
  }

  /**
   * Supprime un profil (sauf s'il est actif).
   */
  static async deleteProfile(profileId: string): Promise<void> {
    const activeId = await getActiveProfileId();
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
    const activeId = await getActiveProfileId();
    if (!activeId) return null;
    try {
      return await this.getProfileInfo(activeId);
    } catch {
      return null;
    }
  }

  /**
   * Sauvegarde l'état actuel (parametre + data) dans le stockage du profil.
   * Utile avant un export pour s'assurer que les données sont à jour.
   */
  static async saveCurrentProfileToStorage(profileId: string): Promise<void> {
    const parametrePath = `${PROFILES_DIR}/${profileId}/${PARAMETRE_DIR}`;
    await saveCurrentToProfile(parametrePath);
    await saveCurrentDataToProfile(profileId);
    try {
      const info = await this.getProfileInfo(profileId);
      info.lastSaved = new Date().toISOString();
      await FileService.writeFile(`${PROFILES_DIR}/${profileId}/info.json`, JSON.stringify(info, null, 2));
    } catch {}
  }

  /**
   * Exporte un profil (parametre + data) vers un fichier .zip.
   * Ouvre une boîte de dialogue pour choisir l'emplacement.
   */
  static async exportProfile(profileId: string, profileName: string): Promise<{ path?: string; canceled?: boolean }> {
    const result = await window.electronAPI.exportProfile(profileId, profileName);
    if (!result.success) {
      if (result.canceled) return { canceled: true };
      throw new Error(result.error || 'Erreur lors de l\'export');
    }
    return { path: result.path };
  }

  /**
   * Importe un profil depuis un fichier .zip.
   * Le zip doit contenir parametre/ et/ou data/ à la racine.
   */
  static async importProfile(zipPath: string, newProfileName: string): Promise<string> {
    const result = await window.electronAPI.importProfile(zipPath, newProfileName);
    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de l\'import');
    }
    return result.profileId!;
  }
}
