// Strict check of a (migrated) board. Imported files are untrusted, so every field is checked
// and the first problem is reported in words a coach can act on.

import { CUSTOM_LIMITS } from './rink';
import type { Board, Drawing, Entity, Frame, RinkSpec, Vec } from './types';

export class BoardValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardValidationError';
  }
}

export const LIMITS = {
  entities: 500,
  frames: 500,
  drawings: 2000,
  pointsPerDrawing: 20000,
  textLength: 200,
  nameLength: 120,
  labelLength: 12,
  /** Positions may be off-rink, but not absurdly so. */
  coordAbsM: 100,
};

type Obj = Record<string, unknown>;

const KINDS = ['player', 'goalie', 'ball', 'cone'] as const;
const TEAMS = ['home', 'away', 'neutral'] as const;
const VIEWS = ['full', 'half-left', 'half-right'] as const;
const TOOLS = ['pen', 'line', 'arrow', 'zone', 'text'] as const;
const DASHES = ['solid', 'dashed', 'double'] as const;
const HEADS = ['none', 'arrow'] as const;
const SHAPES = ['rect', 'ellipse'] as const;

function fail(path: string, problem: string): never {
  throw new BoardValidationError(`This file is not a valid board: ${path} ${problem}.`);
}

function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'must be an object');
  return v as Obj;
}

function arr(v: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(v)) fail(path, 'must be a list');
  if (v.length > max) fail(path, `has ${v.length} items (at most ${max} allowed)`);
  return v;
}

function str(v: unknown, path: string, max = 1000, nonEmpty = false): string {
  if (typeof v !== 'string') fail(path, 'must be text');
  if (nonEmpty && v.length === 0) fail(path, 'must not be empty');
  if (v.length > max) fail(path, `is longer than ${max} characters`);
  return v;
}

function num(v: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(path, 'must be a number');
  if (v < min || v > max) fail(path, `must be between ${min} and ${max} (got ${v})`);
  return v;
}

function oneOf<T extends string>(v: unknown, path: string, options: readonly T[]): T {
  if (typeof v !== 'string' || !(options as readonly string[]).includes(v))
    fail(path, `is ${JSON.stringify(v)}, expected one of ${options.join(', ')}`);
  return v as T;
}

function color(v: unknown, path: string): string {
  const s = str(v, path, 64);
  if (!/^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,\s%]+\))$/.test(s)) fail(path, `is not a colour (${s})`);
  return s;
}

function vec(v: unknown, path: string): Vec {
  const o = obj(v, path);
  const m = LIMITS.coordAbsM;
  return { x: num(o.x, `${path}.x`, -m, m), y: num(o.y, `${path}.y`, -m, m) };
}

function rink(v: unknown): RinkSpec {
  const o = obj(v, 'rink');
  const r: RinkSpec = {
    lengthM: num(o.lengthM, 'rink.lengthM', CUSTOM_LIMITS.minLengthM, CUSTOM_LIMITS.maxLengthM),
    widthM: num(o.widthM, 'rink.widthM', CUSTOM_LIMITS.minWidthM, CUSTOM_LIMITS.maxWidthM),
    view: oneOf(o.view, 'rink.view', VIEWS),
  };
  if (o.cornerRadiusM !== undefined)
    r.cornerRadiusM = num(o.cornerRadiusM, 'rink.cornerRadiusM', 0, 20);
  return r;
}

function entity(v: unknown, path: string): Entity {
  const o = obj(v, path);
  const e: Entity = {
    id: str(o.id, `${path}.id`, 64, true),
    kind: oneOf(o.kind, `${path}.kind`, KINDS),
  };
  if (o.team !== undefined) e.team = oneOf(o.team, `${path}.team`, TEAMS);
  if (o.label !== undefined) e.label = str(o.label, `${path}.label`, LIMITS.labelLength);
  return e;
}

function frame(v: unknown, path: string, entityIds: Set<string>): Frame {
  const o = obj(v, path);
  const posObj = obj(o.positions, `${path}.positions`);
  const positions: Record<string, Vec> = {};
  for (const [id, p] of Object.entries(posObj)) {
    if (!entityIds.has(id))
      fail(`${path}.positions`, `refers to a piece "${id}" that is not on the board`);
    positions[id] = vec(p, `${path}.positions.${id}`);
  }
  return {
    id: str(o.id, `${path}.id`, 64, true),
    durationMs: num(o.durationMs, `${path}.durationMs`, 0, 600_000),
    positions,
  };
}

function drawing(v: unknown, path: string, frameIds: Set<string>): Drawing {
  const o = obj(v, path);
  const tool = oneOf(o.tool, `${path}.tool`, TOOLS);
  const points = arr(o.points, `${path}.points`, LIMITS.pointsPerDrawing).map((p, i) =>
    vec(p, `${path}.points[${i}]`),
  );
  const minPoints = { pen: 1, line: 2, arrow: 2, zone: 2, text: 1 }[tool];
  if (points.length < minPoints) fail(`${path}.points`, `needs at least ${minPoints} point(s)`);

  const so = obj(o.style, `${path}.style`);
  const style: Drawing['style'] = {
    color: color(so.color, `${path}.style.color`),
    widthM: num(so.widthM, `${path}.style.widthM`, 0.001, 5),
  };
  if (so.dash !== undefined) style.dash = oneOf(so.dash, `${path}.style.dash`, DASHES);
  if (so.head !== undefined) style.head = oneOf(so.head, `${path}.style.head`, HEADS);
  if (so.fill !== undefined) style.fill = color(so.fill, `${path}.style.fill`);
  if (so.fontSizeM !== undefined)
    style.fontSizeM = num(so.fontSizeM, `${path}.style.fontSizeM`, 0.05, 20);

  const d: Drawing = { id: str(o.id, `${path}.id`, 64, true), tool, points, style };
  if (o.pressures !== undefined) {
    const pr = arr(o.pressures, `${path}.pressures`, LIMITS.pointsPerDrawing).map((p, i) =>
      num(p, `${path}.pressures[${i}]`, 0, 1),
    );
    if (pr.length !== points.length) fail(`${path}.pressures`, 'must have one value per point');
    d.pressures = pr;
  }
  if (o.shape !== undefined) d.shape = oneOf(o.shape, `${path}.shape`, SHAPES);
  if (o.text !== undefined) d.text = str(o.text, `${path}.text`, LIMITS.textLength);
  if (tool === 'text' && !d.text) fail(`${path}.text`, 'is missing');
  if (o.frameId !== undefined) {
    const f = str(o.frameId, `${path}.frameId`, 64, true);
    if (!frameIds.has(f)) fail(`${path}.frameId`, `refers to a frame "${f}" that does not exist`);
    d.frameId = f;
  }
  return d;
}

function unique(ids: string[], path: string): Set<string> {
  const set = new Set<string>();
  for (const id of ids) {
    if (set.has(id)) fail(path, `has the id "${id}" more than once`);
    set.add(id);
  }
  return set;
}

/** Validate a migrated (current-version) board. Returns a clean copy with only known fields. */
export function validateBoard(raw: unknown): Board {
  const o = obj(raw, 'the board');
  if (o.schemaVersion !== 1) fail('schemaVersion', 'must be 1');

  const entities = arr(o.entities, 'entities', LIMITS.entities).map((e, i) =>
    entity(e, `entities[${i}]`),
  );
  const entityIds = unique(
    entities.map((e) => e.id),
    'entities',
  );

  const framesRaw = arr(o.frames, 'frames', LIMITS.frames);
  if (framesRaw.length === 0) fail('frames', 'must contain at least one frame');
  const frames = framesRaw.map((f, i) => frame(f, `frames[${i}]`, entityIds));
  const frameIds = unique(
    frames.map((f) => f.id),
    'frames',
  );

  const drawings = arr(o.drawings, 'drawings', LIMITS.drawings).map((d, i) =>
    drawing(d, `drawings[${i}]`, frameIds),
  );
  unique(
    drawings.map((d) => d.id),
    'drawings',
  );

  const tc = obj(o.teamColors, 'teamColors');
  return {
    schemaVersion: 1,
    id: str(o.id, 'id', 64, true),
    name: str(o.name, 'name', LIMITS.nameLength),
    rink: rink(o.rink),
    teamColors: {
      home: color(tc.home, 'teamColors.home'),
      away: color(tc.away, 'teamColors.away'),
    },
    entities,
    frames,
    drawings,
    createdAt: num(o.createdAt, 'createdAt', 0),
    updatedAt: num(o.updatedAt, 'updatedAt', 0),
  };
}
