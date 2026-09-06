import {
  EditionColumnKey,
  EditionUiPrefs,
  mergeColumnWidths,
} from '../types/editionUi';
import { tauriBridge } from './tauri';
import { Logger, withLog } from './logger';

const PROFILES_DIR = 'profils';

function prefsPath(profileId: string): string {
  return `${PROFILES_DIR}/${profileId}/parametre/edition_ui.json`;
}

export const EditionUiService = {
  async loadColumnWidths(profileId: string): Promise<Record<EditionColumnKey, number>> {
    return withLog('EditionUiService.loadColumnWidths', async () => {
      try {
        const content = await tauriBridge.readTextFile(prefsPath(profileId));
        const parsed = JSON.parse(content) as EditionUiPrefs;
        return mergeColumnWidths(parsed.columnWidths);
      } catch {
        return mergeColumnWidths(undefined);
      }
    }, { data: { profileId } });
  },

  async saveColumnWidths(
    profileId: string,
    widths: Record<EditionColumnKey, number>
  ): Promise<void> {
    return withLog('EditionUiService.saveColumnWidths', async () => {
      const dir = `${PROFILES_DIR}/${profileId}/parametre`;
      await tauriBridge.mkdirs(dir);
      const prefs: EditionUiPrefs = { columnWidths: widths };
      await tauriBridge.writeTextFile(prefsPath(profileId), JSON.stringify(prefs, null, 2));
      Logger.data('EditionUiService.saveColumnWidths', 'Largeurs colonnes enregistrées', {
        profileId,
      });
    }, { data: { profileId } });
  },
};
