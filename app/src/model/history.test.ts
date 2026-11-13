import { describe, expect, it } from 'vitest';
import { emptyHistory, HISTORY_LIMIT, record, redo, undo, type History } from './history';

describe('undo stack', () => {
  it('undoes and redoes in order', () => {
    let h: History<number> = emptyHistory();
    let cur = 0;
    for (const next of [1, 2, 3]) {
      h = record(h, cur);
      cur = next;
    }
    const seen: number[] = [];
    for (let r = undo(h, cur); r; r = undo(h, cur)) {
      h = r.history;
      cur = r.value;
      seen.push(cur);
    }
    expect(seen).toEqual([2, 1, 0]);
    expect(undo(h, cur)).toBeNull();
    const again: number[] = [];
    for (let r = redo(h, cur); r; r = redo(h, cur)) {
      h = r.history;
      cur = r.value;
      again.push(cur);
    }
    expect(again).toEqual([1, 2, 3]);
    expect(redo(h, cur)).toBeNull();
  });

  it('a new change clears the redo branch', () => {
    let h: History<string> = emptyHistory();
    h = record(h, 'a');
    const u = undo(h, 'b')!;
    expect(u.history.future).toEqual(['b']);
    h = record(u.history, 'a');
    expect(h.future).toEqual([]);
  });

  it('merges consecutive commits with the same key', () => {
    let h: History<string> = emptyHistory();
    h = record(h, '', 'label:p1');
    h = record(h, 'K', 'label:p1');
    h = record(h, 'Ki', 'label:p1');
    expect(h.past).toEqual(['']);
    h = record(h, 'Kim', 'label:p2');
    expect(h.past).toEqual(['', 'Kim']);
    h = record(h, 'x');
    h = record(h, 'y');
    expect(h.past).toHaveLength(4); // unkeyed commits never merge
  });

  it('undo breaks a merge run', () => {
    let h: History<string> = emptyHistory();
    h = record(h, 'a', 'k');
    h = undo(h, 'b')!.history;
    h = record(h, 'a', 'k');
    expect(h.past).toEqual(['a']);
    expect(h.lastKey).toBe('k');
  });

  it('caps its length', () => {
    let h: History<number> = emptyHistory();
    for (let i = 0; i < HISTORY_LIMIT + 50; i++) h = record(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(50);
  });
});
