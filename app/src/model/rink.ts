// Rink geometry from the IFF Rules of the Game (valid from 1 July 2026, rules 101-104),
// as tabulated in PLAN.md section 3. Every marking is placed by its official distance from
// the nearest board, so it stays correct on smaller rinks.

import type { RinkSpec, RinkView, Vec } from './types';

export const OFFICIAL = {
  fullLengthM: 40,
  fullWidthM: 20,
  minLengthM: 36,
  minWidthM: 18,
  lineWidthM: 0.05,
  creaseFromEndM: 2.85,
  creaseLengthM: 4, // along the rink length
  creaseWidthM: 5,
  keeperAreaFromEndM: 3.5, // = goal line
  keeperAreaLengthM: 1,
  keeperAreaWidthM: 2.5,
  goalLineFromEndM: 3.5,
  goalWidthM: 1.6,
  goalDepthM: 0.6,
  faceoffFromSideM: 1.5,
  faceoffDotDiameterM: 0.3,
  centreSpotDiameterM: 0.3,
} as const;

export const DEFAULT_CORNER_RADIUS_M = 2;

/** How far outside the boards entities may stand, and how much of it the view shows. */
export const OFF_RINK_MARGIN_M = 1.5;

/** Limits for a custom rink: big enough for creases and face-off dots to fit. */
export const CUSTOM_LIMITS = { minLengthM: 20, maxLengthM: 44, minWidthM: 10, maxWidthM: 22 };

export type RinkPresetId = 'full' | 'minimum' | 'custom';

export const RINK_PRESETS: Record<
  Exclude<RinkPresetId, 'custom'>,
  { lengthM: number; widthM: number }
> = {
  full: { lengthM: OFFICIAL.fullLengthM, widthM: OFFICIAL.fullWidthM },
  minimum: { lengthM: OFFICIAL.minLengthM, widthM: OFFICIAL.minWidthM },
};

export function presetOf(spec: Pick<RinkSpec, 'lengthM' | 'widthM'>): RinkPresetId {
  for (const [id, p] of Object.entries(RINK_PRESETS)) {
    if (p.lengthM === spec.lengthM && p.widthM === spec.widthM) return id as RinkPresetId;
  }
  return 'custom';
}

export function clampRinkSize(
  lengthM: number,
  widthM: number,
): { lengthM: number; widthM: number } {
  const c = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
  return {
    lengthM: c(lengthM, CUSTOM_LIMITS.minLengthM, CUSTOM_LIMITS.maxLengthM),
    widthM: c(widthM, CUSTOM_LIMITS.minWidthM, CUSTOM_LIMITS.maxWidthM),
  };
}

export interface Rect {
  x: number; // min x
  y: number; // min y
  w: number;
  h: number;
}

export interface GoalEnd {
  side: -1 | 1; // -1 = left end (x < 0), +1 = right end
  crease: Rect;
  keeperArea: Rect;
  goalLineX: number;
  /** Cage outline from post to post, running behind the goal line (away from centre). */
  cage: Vec[];
}

export interface RinkGeometry {
  lengthM: number;
  widthM: number;
  cornerRadiusM: number;
  boards: Rect;
  centreLineX: number;
  centreSpot: Vec;
  faceoffDots: Vec[];
  ends: [GoalEnd, GoalEnd];
}

function rectX(fromEnd: number, depth: number, side: -1 | 1, halfL: number, width: number): Rect {
  // fromEnd/depth measured inwards from the short side at x = side * halfL
  const a = side * (halfL - fromEnd);
  const b = side * (halfL - fromEnd - depth);
  return { x: Math.min(a, b), y: -width / 2, w: Math.abs(a - b), h: width };
}

export function rinkGeometry(spec: RinkSpec): RinkGeometry {
  const halfL = spec.lengthM / 2;
  const halfW = spec.widthM / 2;
  const r = Math.min(spec.cornerRadiusM ?? DEFAULT_CORNER_RADIUS_M, halfW, halfL);
  const O = OFFICIAL;

  const end = (side: -1 | 1): GoalEnd => {
    const goalLineX = side * (halfL - O.goalLineFromEndM);
    const backX = side * (halfL - O.goalLineFromEndM + O.goalDepthM);
    const gw = O.goalWidthM / 2;
    return {
      side,
      crease: rectX(O.creaseFromEndM, O.creaseLengthM, side, halfL, O.creaseWidthM),
      keeperArea: rectX(O.keeperAreaFromEndM, O.keeperAreaLengthM, side, halfL, O.keeperAreaWidthM),
      goalLineX,
      cage: [
        { x: goalLineX, y: -gw },
        { x: backX, y: -gw },
        { x: backX, y: gw },
        { x: goalLineX, y: gw },
      ],
    };
  };

  const dotY = halfW - O.faceoffFromSideM;
  const dotXs = [-(halfL - O.goalLineFromEndM), 0, halfL - O.goalLineFromEndM];
  const faceoffDots = dotXs.flatMap((x) => [
    { x, y: -dotY },
    { x, y: dotY },
  ]);

  return {
    lengthM: spec.lengthM,
    widthM: spec.widthM,
    cornerRadiusM: r,
    boards: { x: -halfL, y: -halfW, w: spec.lengthM, h: spec.widthM },
    centreLineX: 0,
    centreSpot: { x: 0, y: 0 },
    faceoffDots,
    ends: [end(-1), end(1)],
  };
}

/** The part of the rink a view shows, including the off-rink margin. */
export function viewBounds(spec: RinkSpec, view: RinkView = spec.view): Rect {
  const halfL = spec.lengthM / 2;
  const halfW = spec.widthM / 2;
  const m = OFF_RINK_MARGIN_M;
  const y = -halfW - m;
  const h = spec.widthM + 2 * m;
  switch (view) {
    case 'half-left':
      return { x: -halfL - m, y, w: halfL + 2 * m, h };
    case 'half-right':
      return { x: -m, y, w: halfL + 2 * m, h };
    default:
      return { x: -halfL - m, y, w: spec.lengthM + 2 * m, h };
  }
}

/** Clamp a position to the rink plus the off-rink margin (players stand off-rink in drills). */
export function clampToRink(p: Vec, spec: Pick<RinkSpec, 'lengthM' | 'widthM'>): Vec {
  const maxX = spec.lengthM / 2 + OFF_RINK_MARGIN_M;
  const maxY = spec.widthM / 2 + OFF_RINK_MARGIN_M;
  return {
    x: Math.min(maxX, Math.max(-maxX, p.x)),
    y: Math.min(maxY, Math.max(-maxY, p.y)),
  };
}
