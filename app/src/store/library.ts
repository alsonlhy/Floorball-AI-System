// Board library operations on stored boards (create, rename, duplicate, delete, import, export).
// No React here, so it is unit-tested with the in-memory repository.

import { createBoard } from '../model/board';
import { newId } from '../model/ids';
import { parseBoardJson, serializeBoard } from '../model/migrate';
import type { Board } from '../model/types';
import { BoardValidationError } from '../model/validate';
import { fileNameFor, type FileAdapter } from '../platform/files';
import type { BoardRepository } from '../platform/storage';

export async function createStoredBoard(repo: BoardRepository, name?: string): Promise<Board> {
  const existing = await repo.list();
  const board = createBoard(name ?? nextUntitledName(existing.map((b) => b.name)));
  await repo.put(board);
  return board;
}

export function nextUntitledName(names: string[]): string {
  const taken = new Set(names);
  if (!taken.has('Untitled board')) return 'Untitled board';
  let n = 2;
  while (taken.has(`Untitled board ${n}`)) n++;
  return `Untitled board ${n}`;
}

export async function renameStoredBoard(repo: BoardRepository, id: string, name: string) {
  const b = await repo.get(id);
  if (!b) return;
  await repo.put({ ...b, name: name.slice(0, 120), updatedAt: Date.now() });
}

export async function duplicateStoredBoard(
  repo: BoardRepository,
  id: string,
  thumbnail?: string,
): Promise<Board | undefined> {
  const b = await repo.get(id);
  if (!b) return undefined;
  const now = Date.now();
  const copy: Board = {
    ...b,
    id: newId('b_'),
    name: `${b.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await repo.put(copy, thumbnail);
  return copy;
}

export async function deleteStoredBoard(repo: BoardRepository, id: string) {
  await repo.delete(id);
}

export function boardFile(board: Board): { name: string; blob: Blob } {
  return {
    name: fileNameFor(board.name, 'json'),
    blob: new Blob([serializeBoard(board)], { type: 'application/json' }),
  };
}

export async function exportBoard(files: FileAdapter, board: Board) {
  const f = boardFile(board);
  await files.save(f.name, f.blob);
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Read a board file into the library. Throws BoardValidationError (readable message) for bad
 * files. If a board with the same id is already stored, the import gets a new id so nothing
 * is overwritten; everything else is kept exactly.
 */
export async function importBoardText(repo: BoardRepository, text: string): Promise<Board> {
  const parsed = parseBoardJson(text);
  const clash = await repo.get(parsed.id);
  const board = clash ? { ...parsed, id: newId('b_') } : parsed;
  await repo.put(board);
  return board;
}

export async function importBoardFile(repo: BoardRepository, file: File): Promise<Board> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new BoardValidationError(
      `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB; boards are at most 5 MB.`,
    );
  }
  return importBoardText(repo, await file.text());
}
