// Cadrage de la fenêtre : dimensions précises réglables dans Paramètres
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';
import { WindowSettings } from '../types/settings';
import { withLog } from './logger';
import { isTauriAvailable } from './tauri';

type FullscreenListener = (isFullscreen: boolean) => void;

const fullscreenListeners = new Set<FullscreenListener>();
let resizeUnlisten: (() => void) | null = null;

async function currentFullscreen(): Promise<boolean> {
  if (!isTauriAvailable()) return false;
  return getCurrentWindow().isFullscreen();
}

async function notifyFullscreenState(): Promise<void> {
  const isFullscreen = await currentFullscreen();
  fullscreenListeners.forEach((listener) => listener(isFullscreen));
}

async function ensureResizeListener(): Promise<void> {
  if (resizeUnlisten || !isTauriAvailable()) return;
  resizeUnlisten = await getCurrentWindow().onResized(() => {
    void notifyFullscreenState();
  });
}

export const WindowService = {
  /** Applique les réglages de fenêtre (preset/custom/plein écran). */
  async apply(settings: WindowSettings): Promise<void> {
    if (!isTauriAvailable()) return;
    return withLog(
      'WindowService.apply',
      async () => {
        const win = getCurrentWindow();
        if (settings.mode === 'fullscreen') {
          await win.setFullscreen(true);
          await notifyFullscreenState();
          return;
        }
        const isFullscreen = await win.isFullscreen();
        if (isFullscreen) {
          await win.setFullscreen(false);
        }
        const width = Math.max(1024, Math.round(settings.width));
        const height = Math.max(768, Math.round(settings.height));
        await win.setSize(new LogicalSize(width, height));
        await win.center();
        await notifyFullscreenState();
      },
      { data: settings }
    );
  },

  async isFullscreen(): Promise<boolean> {
    return currentFullscreen();
  },

  /** Notifie dès qu’on entre/sort du plein écran (réglages ou redimensionnement). */
  subscribeFullscreen(listener: FullscreenListener): () => void {
    fullscreenListeners.add(listener);
    void (async () => {
      await ensureResizeListener();
      listener(await currentFullscreen());
    })();
    return () => {
      fullscreenListeners.delete(listener);
    };
  },

  /** Ferme complètement l’application (nécessaire en plein écran, sans chrome OS). */
  async quit(): Promise<void> {
    if (!isTauriAvailable()) return;
    return withLog('WindowService.quit', async () => {
      await exit(0);
    });
  },
};
