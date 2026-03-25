import React, { createContext, useContext, useState, useEffect } from 'react';

const ZOOM_STORAGE_KEY = 'appZoomLevel';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 175, 200];

interface ZoomContextValue {
  zoomLevel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (level: number) => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  MIN_ZOOM: number;
  MAX_ZOOM: number;
}

const ZoomContext = createContext<ZoomContextValue | null>(null);

export const ZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_ZOOM;
    return ZOOM_LEVELS.includes(parsed) ? parsed : DEFAULT_ZOOM;
  });

  useEffect(() => {
    localStorage.setItem(ZOOM_STORAGE_KEY, zoomLevel.toString());
  }, [zoomLevel]);

  const findNextZoomLevel = (current: number): number => {
    const next = ZOOM_LEVELS.find((level) => level > current);
    return next || MAX_ZOOM;
  };

  const findPreviousZoomLevel = (current: number): number => {
    const reversed = [...ZOOM_LEVELS].reverse();
    const previous = reversed.find((level) => level < current);
    return previous || MIN_ZOOM;
  };

  const zoomIn = () => {
    setZoomLevel((prev) => {
      const next = findNextZoomLevel(prev);
      return next <= MAX_ZOOM ? next : prev;
    });
  };

  const zoomOut = () => {
    setZoomLevel((prev) => {
      const previous = findPreviousZoomLevel(prev);
      return previous >= MIN_ZOOM ? previous : prev;
    });
  };

  const setZoom = (level: number) => {
    if (ZOOM_LEVELS.includes(level) && level >= MIN_ZOOM && level <= MAX_ZOOM) {
      setZoomLevel(level);
    }
  };

  const value: ZoomContextValue = {
    zoomLevel,
    zoomIn,
    zoomOut,
    setZoom,
    canZoomIn: zoomLevel < MAX_ZOOM,
    canZoomOut: zoomLevel > MIN_ZOOM,
    MIN_ZOOM,
    MAX_ZOOM,
  };

  return <ZoomContext.Provider value={value}>{children}</ZoomContext.Provider>;
};

export const useZoom = (): ZoomContextValue => {
  const context = useContext(ZoomContext);
  if (!context) {
    throw new Error('useZoom must be used within a ZoomProvider');
  }
  return context;
};
