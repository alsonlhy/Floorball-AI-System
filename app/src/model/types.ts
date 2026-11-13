// Data model from PLAN.md section 3. All positions are metres, origin at the rink centre,
// x along the length, y along the width (Rule 1). Pixels never appear in this folder.

export type Vec = { x: number; y: number };

export type EntityKind = 'player' | 'goalie' | 'ball' | 'cone';
export type Team = 'home' | 'away' | 'neutral';
export type RinkView = 'full' | 'half-left' | 'half-right';

export interface Entity {
  id: string;
  kind: EntityKind;
  team?: Team;
  label?: string; // jersey number or short name
}

export interface EntityState {
  pos: Vec;
  confidence?: number; // unused in Phase 2; match data shows low confidence faded
  visible?: boolean;
}

/** Rule 2: the renderer only ever asks a TrackSource for state at a time. */
export interface TrackSource {
  durationMs: number;
  entities: Entity[];
  stateAt(tMs: number): Map<string, EntityState>;
}

export interface RinkSpec {
  lengthM: number;
  widthM: number;
  view: RinkView;
  /** Board corner radius. Not in the IFF rules; manufacturer-specific. */
  cornerRadiusM?: number;
}

export interface Frame {
  id: string;
  durationMs: number;
  positions: Record<string, Vec>;
}

export interface Drawing {
  id: string;
  tool: 'pen' | 'line' | 'arrow' | 'zone' | 'text';
  points: Vec[];
  style: {
    color: string;
    widthM: number;
    dash?: 'solid' | 'dashed';
    head?: 'none' | 'arrow';
    fill?: string;
  };
  text?: string;
  frameId?: string; // undefined = shown on every frame (Rule 3)
}

export interface TeamColors {
  home: string;
  away: string;
}

export interface Board {
  schemaVersion: 1;
  id: string;
  name: string;
  rink: RinkSpec;
  /** Board-level team colours (PLAN.md M2). */
  teamColors: TeamColors;
  entities: Entity[];
  frames: Frame[]; // at least one; one frame = a static board
  drawings: Drawing[];
  createdAt: number;
  updatedAt: number;
}
