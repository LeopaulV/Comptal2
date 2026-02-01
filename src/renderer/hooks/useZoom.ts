// Hook pour gérer le niveau de zoom de l'application

import { useState, useEffect } from 'react';

const ZOOM_STORAGE_KEY = 'appZoomLevel';
const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
// Niveaux de zoom autorisés
const ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 175, 200];

export const useZoom = () => {
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
    const parsed = saved ? parseInt(saved, 10) : DEFAULT_ZOOM;
    // S'assurer que la valeur sauvegardée est valide
    return ZOOM_LEVELS.includes(parsed) ? parsed : DEFAULT_ZOOM;
  });

  // Appliquer le zoom à l'élément root de l'application
  useEffect(() => {
    const zoomValue = zoomLevel / 100;
    const rootElement = document.getElementById('root');
    
    if (rootElement) {
      rootElement.style.transform = `scale(${zoomValue})`;
      rootElement.style.transformOrigin = 'top left';
      
      // Ajuster la largeur et hauteur pour compenser le scale
      // et éviter les problèmes de scrollbar et de layout
      const width = 100 / zoomValue;
      const height = 100 / zoomValue;
      rootElement.style.width = `${width}%`;
      rootElement.style.height = `${height}%`;
    }

    // Sauvegarder dans localStorage
    localStorage.setItem(ZOOM_STORAGE_KEY, zoomLevel.toString());

    // Nettoyer au démontage
    return () => {
      if (rootElement) {
        rootElement.style.transform = '';
        rootElement.style.transformOrigin = '';
        rootElement.style.width = '';
        rootElement.style.height = '';
      }
    };
  }, [zoomLevel]);

  // Fonction pour trouver le niveau de zoom le plus proche supérieur
  const findNextZoomLevel = (current: number): number => {
    const next = ZOOM_LEVELS.find(level => level > current);
    return next || MAX_ZOOM;
  };

  // Fonction pour trouver le niveau de zoom le plus proche inférieur
  const findPreviousZoomLevel = (current: number): number => {
    const reversed = [...ZOOM_LEVELS].reverse();
    const previous = reversed.find(level => level < current);
    return previous || MIN_ZOOM;
  };

  const zoomIn = () => {
    setZoomLevel(prev => {
      const next = findNextZoomLevel(prev);
      return next <= MAX_ZOOM ? next : prev;
    });
  };

  const zoomOut = () => {
    setZoomLevel(prev => {
      const previous = findPreviousZoomLevel(prev);
      return previous >= MIN_ZOOM ? previous : prev;
    });
  };

  const setZoom = (level: number) => {
    if (ZOOM_LEVELS.includes(level) && level >= MIN_ZOOM && level <= MAX_ZOOM) {
      setZoomLevel(level);
    }
  };

  const canZoomIn = zoomLevel < MAX_ZOOM;
  const canZoomOut = zoomLevel > MIN_ZOOM;

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    setZoom,
    canZoomIn,
    canZoomOut,
    MIN_ZOOM,
    MAX_ZOOM,
  };
};
