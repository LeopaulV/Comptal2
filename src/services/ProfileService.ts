// Gestion des profils : 1 profil = 1 dossier data/profils/{id}/ contenant
// info.json, manifest.json, comptal.db et attachments/ (PDF, pièces jointes).
import { ProfileInfo } from '../types/models';
import i18n from '../i18n/config';
import { tauriBridge } from './tauri';
import { Logger, withLog } from './logger';
import { Db, SCHEMA_VERSION } from './db';
import { SettingsService } from './SettingsService';
import { MigrationResult, MigrationService } from './MigrationService';
import { assertSafeProfileId } from '../utils/security';
import { menuPresetForUsage, parseUsageMode, UsageMode } from '../utils/usageMode';

const PROFILES_DIR = 'profils';
export const PROFILE_FORMAT = 'comptal21-profile';
export const PROFILE_FORMAT_VERSION = 1;

export interface ProfileManifest {
  format: typeof PROFILE_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  profileName: string;
}

export interface ProfileImportResult {
  profile: ProfileInfo;
  migration: MigrationResult | null;
}

function newProfileId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function readInfo(id: string): Promise<ProfileInfo | null> {
  try {
    assertSafeProfileId(id);
    const content = await tauriBridge.readTextFile(`${PROFILES_DIR}/${id}/info.json`);
    const parsed = JSON.parse(content) as Partial<ProfileInfo>;
    return {
      id,
      name: parsed.name ?? id,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      usageMode: parseUsageMode(parsed.usageMode, 'tpe'),
    };
  } catch {
    return null;
  }
}

async function writeInfo(info: ProfileInfo): Promise<void> {
  assertSafeProfileId(info.id);
  await tauriBridge.writeTextFile(
    `${PROFILES_DIR}/${info.id}/info.json`,
    JSON.stringify(info, null, 2)
  );
}

async function writeManifest(id: string, name: string): Promise<void> {
  assertSafeProfileId(id);
  const manifest: ProfileManifest = {
    format: PROFILE_FORMAT,
    formatVersion: PROFILE_FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profileName: name,
  };
  await tauriBridge.writeTextFile(
    `${PROFILES_DIR}/${id}/manifest.json`,
    JSON.stringify(manifest, null, 2)
  );
}

async function prepareFolder(id: string): Promise<void> {
  assertSafeProfileId(id);
  await tauriBridge.mkdirs(`${PROFILES_DIR}/${id}`);
  await tauriBridge.mkdirs(`${PROFILES_DIR}/${id}/attachments`);
}

export const ProfileService = {
  /** Liste tous les profils existants. */
  async list(): Promise<ProfileInfo[]> {
    return withLog('ProfileService.list', async () => {
      const entries = await tauriBridge.readDir(PROFILES_DIR);
      const profiles: ProfileInfo[] = [];
      for (const entry of entries) {
        if (!entry.isDir) continue;
        try {
          assertSafeProfileId(entry.name);
        } catch {
          continue;
        }
        const info = await readInfo(entry.name);
        if (info) {
          profiles.push(info);
        }
      }
      profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return profiles;
    });
  },

  /** Crée un profil vide et retourne ses métadonnées. */
  async create(name: string, usageMode: UsageMode = 'tpe'): Promise<ProfileInfo> {
    return withLog(
      'ProfileService.create',
      async () => {
        const info: ProfileInfo = {
          id: newProfileId(),
          name: name.trim() || 'Sans nom',
          createdAt: new Date().toISOString(),
          usageMode,
        };
        await prepareFolder(info.id);
        await writeInfo(info);
        await writeManifest(info.id, info.name);
        return info;
      },
      { data: { name, usageMode } }
    );
  },

  async rename(id: string, name: string): Promise<void> {
    return withLog('ProfileService.rename', async () => {
      assertSafeProfileId(id);
      const info = await readInfo(id);
      if (!info) {
        throw new Error(i18n.t('errors.profileNotFound', { id }));
      }
      await writeInfo({ ...info, name: name.trim() || info.name });
    });
  },

  /** Supprime un profil (dossier + base). Interdit sur le profil actif. */
  async remove(id: string): Promise<void> {
    return withLog('ProfileService.remove', async () => {
      assertSafeProfileId(id);
      if (SettingsService.current.activeProfileId === id) {
        throw new Error(i18n.t('errors.cannotDeleteActiveProfile'));
      }
      await tauriBridge.deleteDir(`${PROFILES_DIR}/${id}`);
    }, { data: { id } });
  },

  /** Active un profil : ouvre sa base, migre un éventuel legacy Comptal2, mémorise le choix. */
  async setUsageMode(id: string, usageMode: UsageMode): Promise<void> {
    return withLog('ProfileService.setUsageMode', async () => {
      assertSafeProfileId(id);
      const info = await readInfo(id);
      if (!info) {
        throw new Error(i18n.t('errors.profileNotFound', { id }));
      }
      await writeInfo({ ...info, usageMode });
      if (SettingsService.current.activeProfileId === id) {
        await SettingsService.save({ menuVisibility: menuPresetForUsage(usageMode) });
      }
    }, { data: { id, usageMode } });
  },

  async setActive(id: string): Promise<MigrationResult | null> {
    return withLog('ProfileService.setActive', async () => {
      assertSafeProfileId(id);
      await Db.openForProfile(id);
      const migration = await MigrationService.migrateLegacyProfileIfNeeded(id);
      const info = await readInfo(id);
      const usageMode = parseUsageMode(info?.usageMode, 'tpe');
      await SettingsService.save({
        activeProfileId: id,
        menuVisibility: menuPresetForUsage(usageMode),
      });
      return migration;
    }, { data: { id } });
  },

  /**
   * Démarrage : garantit qu'un profil actif valide existe et ouvre sa base.
   * Crée un profil "Principal" au tout premier lancement.
   */
  async ensureInitialized(): Promise<ProfileInfo> {
    return withLog('ProfileService.ensureInitialized', async () => {
      const settings = await SettingsService.load();
      let profiles = await this.list();

      if (profiles.length === 0) {
        Logger.info('ProfileService.ensureInitialized', 'Aucun profil, création de "Principal"');
        const created = await this.create('Principal');
        profiles = [created];
      }

      const active =
        profiles.find((p) => p.id === settings.activeProfileId) ?? profiles[0];

      const usageMode = parseUsageMode(active.usageMode, 'tpe');
      if (settings.activeProfileId !== active.id) {
        await SettingsService.save({
          activeProfileId: active.id,
          menuVisibility: menuPresetForUsage(usageMode),
        });
      } else if (usageMode === 'familiale' && settings.menuVisibility.register) {
        await SettingsService.save({
          menuVisibility: { ...settings.menuVisibility, register: false },
        });
      }
      await Db.openForProfile(active.id);
      await MigrationService.migrateLegacyProfileIfNeeded(active.id);
      return active;
    });
  },

  /**
   * Exporte un profil complet (SQLite, pièces jointes, PDF) vers un ZIP.
   * Le ZIP est le format d’échange : base binaire + fichiers, identifié par manifest.json.
   */
  async exportZip(id: string, destAbs: string): Promise<void> {
    return withLog('ProfileService.exportZip', async () => {
      assertSafeProfileId(id);
      const previous = Db.profileId;
      if (previous !== id) {
        await Db.openForProfile(id);
      }
      await Db.checkpoint();
      const info = await readInfo(id);
      await writeManifest(id, info?.name ?? id);
      await tauriBridge.zipDir(`${PROFILES_DIR}/${id}`, destAbs);
      if (previous && previous !== id) {
        await Db.openForProfile(previous);
      }
    }, { data: { id } });
  },

  /** Importe un profil depuis un ZIP exporté (Comptal2 ou Comptal2.1). */
  async importZip(zipAbs: string): Promise<ProfileImportResult> {
    return withLog('ProfileService.importZip', async () => {
      const id = newProfileId();
      assertSafeProfileId(id);
      await tauriBridge.unzipTo(zipAbs, `${PROFILES_DIR}/${id}`);
      await tauriBridge.mkdirs(`${PROFILES_DIR}/${id}/attachments`);
      const existing = await readInfo(id);
      const info: ProfileInfo = {
        id,
        name: existing ? `${existing.name} (importé)` : 'Profil importé',
        createdAt: new Date().toISOString(),
        usageMode: parseUsageMode(existing?.usageMode, 'tpe'),
      };
      await writeInfo(info);
      await writeManifest(id, info.name);
      await Db.openForProfile(id);
      const migration = await MigrationService.migrateLegacyProfileIfNeeded(id);
      if (migration) {
        Logger.info('ProfileService.importZip', 'Migration Comptal2 intégrée à l\'import', migration);
      }
      return { profile: info, migration };
    }, { data: { imported: true } });
  },
};
