import { newId } from './ids';
import { RINK_PRESETS } from './rink';
import type { Board, TeamColors } from './types';

export const DEFAULT_TEAM_COLORS: TeamColors = { home: '#d62828', away: '#1d4ed8' };

export function createBoard(name = 'Untitled board', now = Date.now()): Board {
  return {
    schemaVersion: 1,
    id: newId('b_'),
    name,
    rink: { ...RINK_PRESETS.full, view: 'full' },
    teamColors: { ...DEFAULT_TEAM_COLORS },
    entities: [],
    frames: [{ id: newId('f_'), durationMs: 1000, positions: {} }],
    drawings: [],
    createdAt: now,
    updatedAt: now,
  };
}
