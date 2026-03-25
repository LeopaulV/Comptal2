// Hook pour observer un élément DOM et obtenir sa position

import { useState, useEffect, useRef } from 'react';

interface UseElementObserverReturn {
  elementExists: boolean;
  elementRect: DOMRect | null;
  element: HTMLElement | null;
}

export const useElementObserver = (selector: string): UseElementObserverReturn => {
  const [elementExists, setElementExists] = useState(false);
  const [elementRect, setElementRect] = useState<DOMRect | null>(null);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const findElement = () => {
      const el = document.querySelector(selector) as HTMLElement;
      if (el) {
        setElement(el);
        setElementExists(true);
        updateRect(el);
      } else {
        setElement(null);
        setElementExists(false);
        setElementRect(null);
      }
    };

    const updateRect = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      setElementRect(rect);
    };

    // Vérifier immédiatement
    findElement();

    // Observer les changements du DOM
    observerRef.current = new MutationObserver(() => {
      findElement();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tour-step', 'style', 'class'],
    });

    // Observer les changements de taille/position
    const resizeObserver = new ResizeObserver(() => {
      if (element) {
        updateRect(element);
      }
    });

    if (element) {
      resizeObserver.observe(element);
    }

    // Mettre à jour la position lors du scroll
    const handleScroll = () => {
      if (element) {
        updateRect(element);
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      resizeObserver.disconnect();
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [selector, element]);

  return {
    elementExists,
    elementRect,
    element,
  };
};

