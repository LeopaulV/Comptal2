import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clampSplitRatio, DEFAULT_SPLIT_RATIO, SPLIT_RATIO_STORAGE_KEY } from '../../types/forecast';

const MQ = '(max-width: 1100px)';
const GUTTER = 8;
const MIN_PANE_PX = 280;

interface PrevisionnelSplitProps {
  ratio: number;
  onRatioChange: (ratio: number) => void;
  onRatioCommit?: (ratio: number) => void;
  left: React.ReactNode;
  right: React.ReactNode;
}

function readStoredRatio(): number | null {
  try {
    const raw = localStorage.getItem(SPLIT_RATIO_STORAGE_KEY);
    if (!raw) return null;
    return clampSplitRatio(Number(raw));
  } catch {
    return null;
  }
}

function writeStoredRatio(ratio: number): void {
  try {
    localStorage.setItem(SPLIT_RATIO_STORAGE_KEY, String(ratio));
  } catch {
    /* ignore quota */
  }
}

function clampInContainer(raw: number, size: number): number {
  const minR = Math.max(0.35, MIN_PANE_PX / size);
  const maxR = Math.min(0.75, (size - MIN_PANE_PX - GUTTER) / size);
  if (minR >= maxR) return 0.5;
  const base = clampSplitRatio(raw);
  return Math.min(maxR, Math.max(minR, base));
}

const PrevisionnelSplit: React.FC<PrevisionnelSplitProps> = ({
  ratio,
  onRatioChange,
  onRatioCommit,
  left,
  right,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;
  const dragging = useRef(false);
  const [stacked, setStacked] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MQ).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(MQ);
    const apply = () => setStacked(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const commit = useCallback(
    (next: number) => {
      writeStoredRatio(next);
      onRatioCommit?.(next);
    },
    [onRatioCommit]
  );

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const size = stacked ? rect.height : rect.width;
      const raw = stacked ? (clientY - rect.top) / rect.height : (clientX - rect.left) / rect.width;
      onRatioChange(clampInContainer(raw, size));
    },
    [onRatioChange, stacked]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    commit(ratioRef.current);
  };

  const onDoubleClick = () => {
    onRatioChange(DEFAULT_SPLIT_RATIO);
    commit(DEFAULT_SPLIT_RATIO);
  };

  const tablePct = `${Math.round(ratio * 1000) / 10}%`;
  const style = stacked
    ? { gridTemplateRows: `${tablePct} ${GUTTER}px minmax(0, 1fr)` }
    : { gridTemplateColumns: `${tablePct} ${GUTTER}px minmax(0, 1fr)` };

  return (
    <div
      ref={rootRef}
      className={`previsionnel-split ${stacked ? 'stacked' : 'side'}`}
      style={style}
    >
      <div className="previsionnel-split-pane">{left}</div>
      <div
        className="previsionnel-split-gutter"
        role="separator"
        aria-orientation={stacked ? 'horizontal' : 'vertical'}
        aria-valuemin={35}
        aria-valuemax={75}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.05 : 0.02;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = clampSplitRatio(ratio - step);
            onRatioChange(next);
            commit(next);
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = clampSplitRatio(ratio + step);
            onRatioChange(next);
            commit(next);
          }
        }}
      />
      <div className="previsionnel-split-pane">{right}</div>
    </div>
  );
};

export { readStoredRatio, writeStoredRatio };
export default PrevisionnelSplit;
