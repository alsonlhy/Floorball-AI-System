// Every load goes through here, even with one schema version, so later changes
// do not strand saved boards (PLAN.md section 3).

import { DEFAULT_TEAM_COLORS } from './board';
import type { Board } from './types';

export const CURRENT_SCHEMA_VERSION = 1;

export class BoardMigrationError extends Error {}

export function migrateBoard(raw: unknown): Board {
  if (typeof raw !== 'object' || raw === null) throw new BoardMigrationError('Not a board object');
  const obj = raw as Record<string, unknown>;
  const v = obj.schemaVersion;
  if (v !== 1) throw new BoardMigrationError(`Unsupported schemaVersion: ${String(v)}`);
  const b = obj as unknown as Board;
  if (!Array.isArray(b.frames) || b.frames.length === 0)
    throw new BoardMigrationError('Board needs at least one frame');
  return {
    ...b,
    teamColors: b.teamColors ?? { ...DEFAULT_TEAM_COLORS },
    entities: b.entities ?? [],
    drawings: b.drawings ?? [],
  };
}
