// Undo/redo as a stack of whole-board snapshots (PLAN.md section 3: "hand-rolled undo/redo
// stack of board snapshots"). Boards are immutable, so a snapshot is just a reference.

export interface History<T> {
  past: T[];
  future: T[];
  /** Consecutive commits with the same key merge into one step (e.g. typing a label). */
  lastKey: string | null;
}

export const HISTORY_LIMIT = 200;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [], lastKey: null };
}

/** Record that `before` is being replaced. Returns the new history. */
export function record<T>(h: History<T>, before: T, key: string | null = null): History<T> {
  if (key !== null && key === h.lastKey) return { ...h, future: [] };
  const past = [...h.past, before];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, future: [], lastKey: key };
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = h.past[h.past.length - 1];
  if (value === undefined) return null;
  return {
    history: { past: h.past.slice(0, -1), future: [current, ...h.future], lastKey: null },
    value,
  };
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = h.future[0];
  if (value === undefined) return null;
  return {
    history: { past: [...h.past, current], future: h.future.slice(1), lastKey: null },
    value,
  };
}
