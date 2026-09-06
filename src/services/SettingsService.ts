// Paramètres globaux de l'application (data/parameter/settings.json)
import {
  AppSettings,
  DEFAULT_MENU_VISIBILITY,
  DEFAULT_SETTINGS,
  isAppLanguage,
  MenuVisibility,
  WindowMode,
  WindowSettings,
} from '../types/settings';
import { OnboardingProgress } from '../types/onboarding';
import { tauriBridge } from './tauri';
import { Logger, withLog } from './logger';
import { PROFILE_ID_RE } from '../utils/security';

const SETTINGS_FILE = 'parameter/settings.json';

type Listener = (settings: AppSettings) => void;

let cache: AppSettings | null = null;
const listeners = new Set<Listener>();

function notify(settings: AppSettings): void {
  for (const listener of listeners) {
    listener(settings);
  }
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampZoom(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.zoomLevel;
  return Math.min(200, Math.max(50, Math.round(n)));
}

function parseTheme(value: unknown): AppSettings['theme'] {
  return value === 'dark' || value === 'light' ? value : DEFAULT_SETTINGS.theme;
}

function parseWindowMode(value: unknown): WindowMode {
  return value === 'preset' || value === 'custom' || value === 'fullscreen'
    ? value
    : DEFAULT_SETTINGS.window.mode;
}

function parseWindow(raw: unknown, fallback: WindowSettings): WindowSettings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const width = typeof src.width === 'number' && Number.isFinite(src.width) ? src.width : fallback.width;
  const height = typeof src.height === 'number' && Number.isFinite(src.height) ? src.height : fallback.height;
  return {
    mode: parseWindowMode(src.mode ?? fallback.mode),
    width: Math.min(4000, Math.max(800, Math.round(width))),
    height: Math.min(3000, Math.max(600, Math.round(height))),
  };
}

function parseMenu(raw: unknown, fallback: MenuVisibility): MenuVisibility {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = { ...fallback };
  (Object.keys(DEFAULT_MENU_VISIBILITY) as Array<keyof MenuVisibility>).forEach((key) => {
    out[key] = asBoolean(src[key], fallback[key]);
  });
  return out;
}

function parseOnboarding(raw: unknown, fallback: OnboardingProgress): OnboardingProgress {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const seen = Array.isArray(src.seenPageIntros)
    ? src.seenPageIntros.filter((item): item is string => typeof item === 'string')
    : fallback.seenPageIntros;
  return {
    tourCompleted: asBoolean(src.tourCompleted, fallback.tourCompleted),
    seenPageIntros: seen,
  };
}

function parseActiveProfileId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === 'string' && PROFILE_ID_RE.test(value)) return value;
  return DEFAULT_SETTINGS.activeProfileId;
}

function sanitizeSettings(raw: unknown, base: AppSettings = DEFAULT_SETTINGS): AppSettings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    language: isAppLanguage(src.language) ? src.language : base.language,
    theme: parseTheme(src.theme ?? base.theme),
    zoomLevel: clampZoom(src.zoomLevel ?? base.zoomLevel),
    window: parseWindow(src.window, base.window),
    menuVisibility: parseMenu(src.menuVisibility, base.menuVisibility),
    activeProfileId: Object.prototype.hasOwnProperty.call(src, 'activeProfileId')
      ? parseActiveProfileId(src.activeProfileId)
      : base.activeProfileId,
    onboarding: parseOnboarding(src.onboarding, base.onboarding),
    scopeAcknowledged: asBoolean(src.scopeAcknowledged, base.scopeAcknowledged),
  };
}

export const SettingsService = {
  /** Charge les paramètres (fusionnés avec les valeurs par défaut). */
  async load(): Promise<AppSettings> {
    if (cache) {
      return cache;
    }
    return withLog('SettingsService.load', async () => {
      let loaded: unknown = {};
      try {
        const content = await tauriBridge.readTextFile(SETTINGS_FILE);
        loaded = JSON.parse(content);
      } catch {
        Logger.info('SettingsService.load', 'settings.json absent, valeurs par défaut utilisées');
      }
      cache = sanitizeSettings(loaded, DEFAULT_SETTINGS);
      return cache;
    });
  },

  /** Paramètres actuellement en cache (après load initial). */
  get current(): AppSettings {
    return cache ?? DEFAULT_SETTINGS;
  },

  /** Met à jour et persiste une partie des paramètres. */
  async save(partial: Partial<AppSettings>): Promise<AppSettings> {
    return withLog(
      'SettingsService.save',
      async () => {
        const base = cache ?? (await this.load());
        cache = sanitizeSettings({ ...base, ...partial, window: { ...base.window, ...(partial.window ?? {}) }, menuVisibility: { ...base.menuVisibility, ...(partial.menuVisibility ?? {}) }, onboarding: { ...base.onboarding, ...(partial.onboarding ?? {}) } }, base);
        await tauriBridge.writeTextFile(SETTINGS_FILE, JSON.stringify(cache, null, 2));
        notify(cache);
        return cache;
      },
      { data: { keys: Object.keys(partial) } }
    );
  },

  /** S'abonner aux changements de paramètres (retourne la fonction de désabonnement). */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
