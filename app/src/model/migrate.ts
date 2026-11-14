// Every load goes through here, even with one schema version, so later changes
// do not strand saved boards (PLAN.md section 3). loadBoard = migrate, then validate.

import { DEFAULT_TEAM_COLORS } from './board';
import type { Board } from './types';
import { BoardValidationError, validateBoard } from './validate';

export const CURRENT_SCHEMA_VERSION = 1;

export class BoardMigrationError extends BoardValidationError {}

/** Bring any known schema version up to the current one. Does not check field contents. */
export function migrateBoard(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new BoardMigrationError('This is not a board: expected a JSON object.');
  const obj = raw as Record<string, unknown>;
  const v = obj.schemaVersion;
  if (v === undefined)
    throw new BoardMigrationError('This is not a board: it has no schemaVersion.');
  if (typeof v === 'number' && v > CURRENT_SCHEMA_VERSION)
    throw new BoardMigrationError(
      `This board was saved by a newer version of the app (schema ${v}). Update the app to open it.`,
    );
  if (v !== 1) throw new BoardMigrationError(`Unsupported board schemaVersion: ${String(v)}.`);
  // v1 boards written before teamColors existed (pre-M2 dev builds) get the defaults.
  return {
    ...obj,
    teamColors: obj.teamColors ?? { ...DEFAULT_TEAM_COLORS },
    drawings: obj.drawings ?? [],
  };
}

/** Parse anything claiming to be a board into a valid current-version Board, or throw. */
export function loadBoard(raw: unknown): Board {
  return validateBoard(migrateBoard(raw));
}

/** Parse the text of a board file. Errors are BoardValidationError with a readable message. */
export function parseBoardJson(text: string): Board {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BoardValidationError('This file is not valid JSON, so it cannot be a board.');
  }
  return loadBoard(raw);
}

export function serializeBoard(board: Board): string {
  return JSON.stringify(board, null, 2);
}
