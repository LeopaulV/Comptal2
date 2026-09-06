import { Db } from './db';
import i18n from '../i18n/config';
import { tauriBridge } from './tauri';
import { withLog } from './logger';
import {
  assertProfileRel,
  assertSafeProfileId,
  detectAllowedUserFile,
  MAX_ATTACHMENT_BYTES,
} from '../utils/security';

export function profileRel(subPath: string): string {
  const id = Db.profileId;
  if (!id) throw new Error(i18n.t('errors.noActiveProfile'));
  assertSafeProfileId(id);
  return `profils/${id}/${subPath.replace(/^\/+/, '')}`;
}

export const AttachmentService = {
  async saveBytes(fileName: string, bytes: Uint8Array): Promise<{ rel: string; name: string; abs: string }> {
    return withLog('AttachmentService.saveBytes', async () => {
      const safe = fileName.replace(/[^\w.\-]+/g, '_');
      const unique = `${Date.now()}_${safe}`;
      const rel = profileRel(`attachments/${unique}`);
      await tauriBridge.mkdirs(profileRel('attachments'));
      await tauriBridge.writeBinaryFile(rel, Array.from(bytes));
      const abs = await tauriBridge.resolveDataPath(rel);
      return { rel, name: unique, abs };
    });
  },

  async savePdfBytes(fileName: string, bytes: Uint8Array): Promise<{ rel: string; name: string; abs: string }> {
    return withLog('AttachmentService.savePdfBytes', async () => {
      const safe = fileName.replace(/[^\w.\-]+/g, '_');
      const unique = `${Date.now()}_${safe}`;
      const rel = profileRel(`attachments/${unique}`);
      await tauriBridge.mkdirs(profileRel('attachments'));
      await tauriBridge.writeBinaryFile(rel, Array.from(bytes));
      const abs = await tauriBridge.resolveDataPath(rel);
      return { rel, name: unique, abs };
    });
  },

  async saveUserFile(file: File): Promise<{ rel: string; name: string; mimeType: string }> {
    return withLog('AttachmentService.saveUserFile', async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > MAX_ATTACHMENT_BYTES) {
        throw new Error(i18n.t('errors.fileTooLarge'));
      }
      const detected = detectAllowedUserFile(bytes);
      if (!detected) {
        throw new Error(i18n.t('errors.fileTypeNotAllowed'));
      }
      const saved = await this.saveBytes(file.name, bytes);
      return { rel: saved.rel, name: file.name, mimeType: detected.mime };
    });
  },

  async openRel(rel: string): Promise<void> {
    const id = Db.profileId;
    if (!id) throw new Error(i18n.t('errors.noActiveProfile'));
    const safeRel = assertProfileRel(rel, id);
    const abs = await tauriBridge.resolveDataPath(safeRel);
    await tauriBridge.openPath(abs);
  },

  async deleteRel(rel: string): Promise<void> {
    return withLog('AttachmentService.deleteRel', async () => {
      const id = Db.profileId;
      if (!id) throw new Error(i18n.t('errors.noActiveProfile'));
      const safeRel = assertProfileRel(rel, id);
      await tauriBridge.deleteFile(safeRel);
    });
  },
};
