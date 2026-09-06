import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface CardPosition {
  x: number;
  y: number;
}

interface DragOrigin {
  pointerX: number;
  pointerY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function boundToViewport(x: number, y: number, width: number, height: number): CardPosition {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: clamp(x, margin, maxX),
    y: clamp(y, margin, maxY),
  };
}

/**
 * Drag souris/pointeur pour la carte d'onboarding.
 * `resetKey` change à chaque étape : la position manuelle est alors oubliée.
 */
export function useDraggableCard(resetKey: string): {
  manualPosition: CardPosition | null;
  isDragging: boolean;
  handlePointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    currentPosition: CardPosition,
    cardSize: { width: number; height: number }
  ) => void;
} {
  const [manualPosition, setManualPosition] = useState<CardPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const originRef = useRef<DragOrigin | null>(null);

  useEffect(() => {
    setManualPosition(null);
    setIsDragging(false);
    originRef.current = null;
  }, [resetKey]);

  const handlePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      currentPosition: CardPosition,
      cardSize: { width: number; height: number }
    ) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      originRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        originX: currentPosition.x,
        originY: currentPosition.y,
        width: cardSize.width,
        height: cardSize.height,
      };
      setIsDragging(true);
    },
    []
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => {
      const origin = originRef.current;
      if (!origin) return;
      const next = boundToViewport(
        origin.originX + event.clientX - origin.pointerX,
        origin.originY + event.clientY - origin.pointerY,
        origin.width,
        origin.height
      );
      setManualPosition(next);
    };

    const onUp = () => {
      originRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [isDragging]);

  return { manualPosition, isDragging, handlePointerDown };
}

export function defaultCardPosition(
  targetRect: DOMRect | null,
  cardWidth: number,
  cardHeight: number
): CardPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 16;

  if (!targetRect) {
    return boundToViewport((vw - cardWidth) / 2, (vh - cardHeight) / 2, cardWidth, cardHeight);
  }

  const candidates: CardPosition[] = [
    { x: targetRect.right + gap, y: targetRect.top },
    { x: targetRect.left - cardWidth - gap, y: targetRect.top },
    { x: targetRect.left, y: targetRect.bottom + gap },
    { x: targetRect.left, y: targetRect.top - cardHeight - gap },
  ];

  const fits = candidates.find(
    (pos) =>
      pos.x >= 8 &&
      pos.y >= 8 &&
      pos.x + cardWidth <= vw - 8 &&
      pos.y + cardHeight <= vh - 8
  );

  return boundToViewport(
    fits?.x ?? candidates[0].x,
    fits?.y ?? candidates[0].y,
    cardWidth,
    cardHeight
  );
}
