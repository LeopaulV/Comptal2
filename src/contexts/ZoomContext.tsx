import React, { createContext, useCallback, useContext, useState } from 'react';
import { SettingsService } from '../services/SettingsService';
import { Logger } from '../services/logger';

interface ZoomContextValue {
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const ZoomContext = createContext<ZoomContextValue | null>(null);

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const STEP = 10;

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zoomLevel, setZoomLevelState] = useState<number>(
    () => {
      try {
        return SettingsService.current.zoomLevel ?? 100;
      } catch {
        return 100;
      }
    }
  );

  const persist = useCallback((level: number) => {
    SettingsService.save({ zoomLevel: level }).catch((err) =>
      Logger.error('ZoomProvider.persist', err)
    );
  }, []);

  const setZoomLevel = useCallback(
    (level: number) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(level / STEP) * STEP));
      setZoomLevelState(clamped);
      persist(clamped);
    },
    [persist]
  );

  const zoomIn = useCallback(() => setZoomLevel(zoomLevel + STEP), [zoomLevel, setZoomLevel]);
  const zoomOut = useCallback(() => setZoomLevel(zoomLevel - STEP), [zoomLevel, setZoomLevel]);
  const resetZoom = useCallback(() => setZoomLevel(100), [setZoomLevel]);

  return (
    <ZoomContext.Provider value={{ zoomLevel, setZoomLevel, zoomIn, zoomOut, resetZoom }}>
      {children}
    </ZoomContext.Provider>
  );
};

export function useZoom(): ZoomContextValue {
  const ctx = useContext(ZoomContext);
  if (!ctx) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return ctx;
}
