// Autosave (PLAN.md M4): every board change is written to storage after a short pause.
// No save button. The status is shown in the toolbar.

import { create } from 'zustand';
import type { BoardRepository } from '../platform/storage';
import type { Board } from '../model/types';
import { useBoardStore } from './boardStore';

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error';

export const useSaveStatus = create<{ status: SaveStatus; error?: string }>()(() => ({
  status: 'saved',
}));

export interface Autosave {
  /** Save now if anything is pending. */
  flush(): Promise<void>;
  /** Flush and stop listening. */
  stop(): Promise<void>;
}

export const AUTOSAVE_DELAY_MS = 500;

let lastStop: Promise<void> = Promise.resolve();
/** Resolves once the most recently stopped autosave has written its final save. */
export const whenSaved = () => lastStop;

export function startAutosave(opts: {
  repo: BoardRepository;
  delayMs?: number;
  /** Small PNG of the board for the library, if a stage is on screen. */
  thumbnail?: () => string | undefined;
}): Autosave {
  const { repo, delayMs = AUTOSAVE_DELAY_MS, thumbnail } = opts;
  let lastSaved: Board = useBoardStore.getState().board;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> = Promise.resolve();
  const setStatus = (status: SaveStatus, error?: string) =>
    useSaveStatus.setState(error ? { status, error } : { status });
  setStatus('saved');

  const save = (): Promise<void> => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    // Chain saves so they land in order.
    running = running.then(async () => {
      const board = useBoardStore.getState().board;
      if (board === lastSaved) return;
      setStatus('saving');
      try {
        let thumb: string | undefined;
        try {
          thumb = thumbnail?.();
        } catch {
          thumb = undefined; // a failed thumbnail never blocks a save
        }
        await repo.put(board, thumb);
        lastSaved = board;
        setStatus(useBoardStore.getState().board === board ? 'saved' : 'pending');
      } catch (e) {
        setStatus('error', e instanceof Error ? e.message : String(e));
      }
    });
    return running;
  };

  const unsubscribe = useBoardStore.subscribe((s, prev) => {
    if (s.board === prev.board) return;
    setStatus('pending');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void save(), delayMs);
  });

  // Best effort when the tab is hidden or closed (iPad apps are often just swiped away).
  const onHide = () => {
    if (document.visibilityState === 'hidden') void save();
  };
  const hasDocument = typeof document !== 'undefined';
  if (hasDocument) {
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
  }

  return {
    flush: save,
    stop() {
      unsubscribe();
      if (hasDocument) {
        document.removeEventListener('visibilitychange', onHide);
        window.removeEventListener('pagehide', onHide);
      }
      lastStop = save();
      return lastStop;
    },
  };
}
