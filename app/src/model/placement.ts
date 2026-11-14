// Where a newly added entity lands: a free spot on its own side of the visible area.

import { OFFICIAL, viewBounds } from './rink';
import type { EntityKind, RinkSpec, Team, Vec } from './types';

const MIN_GAP_M = 1.6;

export function defaultPosition(
  kind: EntityKind,
  team: Team | undefined,
  spec: RinkSpec,
  occupied: Vec[],
): Vec {
  const halfL = spec.lengthM / 2;
  if (kind === 'goalie') {
    // In front of own goal: home defends the left goal, away the right.
    const side = team === 'away' ? 1 : -1;
    const x = side * (halfL - OFFICIAL.goalLineFromEndM - 0.6);
    return freeSpot([{ x, y: 0 }, ...grid(spec, team)], occupied);
  }
  return freeSpot(grid(spec, kind === 'player' ? team : undefined), occupied);
}

function grid(spec: RinkSpec, team: Team | undefined): Vec[] {
  // Visible rink area (inside the boards), split by team for players.
  const vb = viewBounds(spec);
  const halfL = spec.lengthM / 2;
  const halfW = spec.widthM / 2;
  const x0 = Math.max(vb.x, -halfL) + 2;
  const x1 = Math.min(vb.x + vb.w, halfL) - 2;
  const mid = (x0 + x1) / 2;
  const [lo, hi] = team === 'home' ? [x0, mid - 0.5] : team === 'away' ? [mid + 0.5, x1] : [x0, x1];
  const cx = (lo + hi) / 2;
  const step = 2;
  const maxR = Math.ceil(Math.max((hi - lo) / 2, halfW) / step);
  const pts: Vec[] = [];
  for (let r = 0; r <= maxR; r++) {
    for (let j = -r; j <= r; j++) {
      for (let i = -r; i <= r; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const x = cx + i * step + 0; // + 0: no -0 (JSON drops the sign)
        const y = j * step + 0;
        if (x < lo - 1e-9 || x > hi + 1e-9 || Math.abs(y) > halfW - 2) continue;
        pts.push({ x, y });
      }
    }
  }
  return pts;
}

function freeSpot(candidates: Vec[], occupied: Vec[]): Vec {
  for (const c of candidates) {
    if (occupied.every((o) => Math.hypot(o.x - c.x, o.y - c.y) >= MIN_GAP_M)) return c;
  }
  return candidates[0] ?? { x: 0, y: 0 };
}
