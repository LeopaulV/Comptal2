import { useCallback, useRef, useState } from 'react';
import { EditionHistoryAction } from '../types/editionHistory';
import { EditionService } from '../services/EditionService';
import { Logger } from '../services/logger';

const MAX_HISTORY = 100;

async function applyHistoryAction(
  action: EditionHistoryAction,
  direction: 'undo' | 'redo'
): Promise<void> {
  switch (action.kind) {
    case 'update': {
      const fields = direction === 'undo' ? action.before : action.after;
      await EditionService.update(action.id, fields);
      break;
    }
    case 'insert': {
      if (direction === 'undo') await EditionService.remove(action.row.id);
      else await EditionService.restore(action.row);
      break;
    }
    case 'delete': {
      if (direction === 'undo') await EditionService.restore(action.row);
      else await EditionService.remove(action.row.id);
      break;
    }
    case 'bulkUpdate': {
      for (const item of action.items) {
        const fields = direction === 'undo' ? item.before : item.after;
        await EditionService.update(item.id, fields);
      }
      break;
    }
    case 'bulkDelete': {
      if (direction === 'undo') {
        for (const row of action.rows) {
          await EditionService.restore(row);
        }
      } else {
        await EditionService.deleteIds(action.rows.map((r) => r.id));
      }
      break;
    }
  }
}

export function useEditionHistory(onApplied: () => Promise<void>) {
  const [past, setPast] = useState<EditionHistoryAction[]>([]);
  const [future, setFuture] = useState<EditionHistoryAction[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const applyingRef = useRef(false);

  const push = useCallback((action: EditionHistoryAction) => {
    setPast((prev) => [...prev.slice(-(MAX_HISTORY - 1)), action]);
    setFuture([]);
  }, []);

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  const undo = useCallback(async () => {
    if (applyingRef.current || past.length === 0) return;
    const action = past[past.length - 1];
    applyingRef.current = true;
    setIsApplying(true);
    try {
      await applyHistoryAction(action, 'undo');
      setPast((prev) => prev.slice(0, -1));
      setFuture((prev) => [...prev, action]);
      await onApplied();
    } catch (err) {
      Logger.error('useEditionHistory.undo', err);
      throw err;
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  }, [past, onApplied]);

  const redo = useCallback(async () => {
    if (applyingRef.current || future.length === 0) return;
    const action = future[future.length - 1];
    applyingRef.current = true;
    setIsApplying(true);
    try {
      await applyHistoryAction(action, 'redo');
      setFuture((prev) => prev.slice(0, -1));
      setPast((prev) => [...prev, action]);
      await onApplied();
    } catch (err) {
      Logger.error('useEditionHistory.redo', err);
      throw err;
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  }, [future, onApplied]);

  return {
    push,
    clear,
    undo,
    redo,
    canUndo: past.length > 0 && !isApplying,
    canRedo: future.length > 0 && !isApplying,
    isApplying,
  };
}
