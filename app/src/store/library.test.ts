import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBoard } from '../model/board';
import { serializeBoard } from '../model/migrate';
import { BoardValidationError } from '../model/validate';
import { DexieBoardRepository, MemoryBoardRepository } from '../platform/storage';
import { startAutosave, useSaveStatus } from './autosave';
import { useBoardStore } from './boardStore';
import {
  createStoredBoard,
  deleteStoredBoard,
  duplicateStoredBoard,
  importBoardText,
  nextUntitledName,
  renameStoredBoard,
} from './library';

describe('library operations', () => {
  it('creates, renames, duplicates and deletes, newest first', async () => {
    const repo = new MemoryBoardRepository();
    const a = await createStoredBoard(repo);
    await new Promise((r) => setTimeout(r, 2));
    const b = await createStoredBoard(repo);
    expect(a.name).toBe('Untitled board');
    expect(b.name).toBe('Untitled board 2');
    expect((await repo.list()).map((x) => x.id)).toEqual([b.id, a.id]);

    await new Promise((r) => setTimeout(r, 2));
    await renameStoredBoard(repo, a.id, 'Breakout drill');
    const list = await repo.list();
    expect(list[0]).toMatchObject({ id: a.id, name: 'Breakout drill' }); // rename counts as an edit

    const copy = (await duplicateStoredBoard(repo, a.id, 'data:image/png;base64,xx'))!;
    expect(copy.id).not.toBe(a.id);
    expect(copy.name).toBe('Breakout drill (copy)');
    const { id: _a, name: _n, createdAt: _c, updatedAt: _u, ...restA } = (await repo.get(a.id))!;
    const { id: _b, name: _m, createdAt: _d, updatedAt: _v, ...restC } = copy;
    expect(restC).toEqual(restA);
    expect((await repo.list()).find((x) => x.id === copy.id)?.thumbnail).toBe(
      'data:image/png;base64,xx',
    );

    await deleteStoredBoard(repo, b.id);
    expect((await repo.list()).map((x) => x.id)).not.toContain(b.id);
  });

  it('numbers untitled boards', () => {
    expect(nextUntitledName([])).toBe('Untitled board');
    expect(nextUntitledName(['Untitled board', 'Untitled board 2'])).toBe('Untitled board 3');
  });

  it('imports a board exactly, and gives it a new id only if the id is taken', async () => {
    const repo = new MemoryBoardRepository();
    const original = createBoard('Face-off');
    const text = serializeBoard(original);

    const first = await importBoardText(repo, text);
    expect(first).toEqual(original);

    const second = await importBoardText(repo, text);
    expect(second.id).not.toBe(original.id);
    expect({ ...second, id: original.id }).toEqual(original);
    expect(await repo.list()).toHaveLength(2);
  });

  it('rejects a corrupt file and stores nothing', async () => {
    const repo = new MemoryBoardRepository();
    await expect(importBoardText(repo, '{"schemaVersion":1,"id":')).rejects.toBeInstanceOf(
      BoardValidationError,
    );
    expect(await repo.list()).toEqual([]);
  });
});

describe('IndexedDB repository', () => {
  it('stores, lists newest first, keeps thumbnails and deletes', async () => {
    const repo = new DexieBoardRepository(`test-${Math.random()}`);
    const a = { ...createBoard('A'), updatedAt: 100 };
    const b = { ...createBoard('B'), updatedAt: 200 };
    await repo.put(a, 'data:image/png;base64,AAA');
    await repo.put(b);
    expect((await repo.list()).map((x) => x.name)).toEqual(['B', 'A']);
    expect((await repo.list())[1]!.thumbnail).toBe('data:image/png;base64,AAA');
    expect(await repo.get(a.id)).toEqual(a);
    await repo.put({ ...a, updatedAt: 300 }); // no thumbnail: keeps the old one
    expect((await repo.list())[0]).toMatchObject({
      name: 'A',
      thumbnail: 'data:image/png;base64,AAA',
    });
    await repo.delete(a.id);
    expect((await repo.list()).map((x) => x.name)).toEqual(['B']);
    expect(await repo.get(a.id)).toBeUndefined();
  });
});

describe('autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useBoardStore.getState().reset();
  });
  afterEach(() => vi.useRealTimers());

  it('saves once after a burst of edits, not on every edit', async () => {
    const repo = new MemoryBoardRepository();
    const put = vi.spyOn(repo, 'put');
    const a = startAutosave({ repo, delayMs: 500 });
    const s = useBoardStore.getState();
    for (let i = 0; i < 5; i++) s.addEntity('player', 'home');
    expect(useSaveStatus.getState().status).toBe('pending');
    await vi.advanceTimersByTimeAsync(400);
    expect(put).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(put).toHaveBeenCalledTimes(1);
    expect(useSaveStatus.getState().status).toBe('saved');
    expect(await repo.get(s.board.id)).toEqual(useBoardStore.getState().board);
    await a.stop();
  });

  it('stop() writes a pending change immediately', async () => {
    const repo = new MemoryBoardRepository();
    const a = startAutosave({ repo, delayMs: 10_000 });
    useBoardStore.getState().addEntity('cone');
    await a.stop();
    expect((await repo.get(useBoardStore.getState().board.id))?.entities).toHaveLength(1);
  });

  it('reports a failed save', async () => {
    const repo = new MemoryBoardRepository();
    vi.spyOn(repo, 'put').mockRejectedValue(new Error('disk full'));
    const a = startAutosave({ repo, delayMs: 10 });
    useBoardStore.getState().addEntity('cone');
    await vi.advanceTimersByTimeAsync(20);
    expect(useSaveStatus.getState()).toMatchObject({ status: 'error', error: 'disk full' });
    await a.stop().catch(() => undefined);
  });
});
