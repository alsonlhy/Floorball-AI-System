import { beforeEach, describe, expect, it } from 'vitest';
import { migrateBoard } from '../model/migrate';
import { KeyframeTrackSource } from '../model/keyframeTrackSource';
import { useBoardStore } from './boardStore';

const st = () => useBoardStore.getState();
const pos = (id: string) => st().board.frames[0]!.positions[id]!;

beforeEach(() => st().reset());

describe('board store', () => {
  it('adds entities at distinct spots, numbering players per team', () => {
    const ids = Array.from({ length: 5 }, () => st().addEntity('player', 'home'));
    const labels = ids.map((id) => st().board.entities.find((e) => e.id === id)!.label);
    expect(labels).toEqual(['1', '2', '3', '4', '5']);
    const ps = ids.map(pos);
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++)
        expect(Math.hypot(ps[i]!.x - ps[j]!.x, ps[i]!.y - ps[j]!.y)).toBeGreaterThan(1.5);
    // home players start in the left half
    for (const p of ps) expect(p.x).toBeLessThan(0);
    const away = st().addEntity('player', 'away');
    expect(pos(away).x).toBeGreaterThan(0);
  });

  it('places goalies at their own goal and ball/cones as neutral', () => {
    const hg = st().addEntity('goalie', 'home');
    const ag = st().addEntity('goalie', 'away');
    expect(pos(hg).x).toBeLessThan(-15);
    expect(pos(ag).x).toBeGreaterThan(15);
    const b = st().addEntity('ball');
    expect(st().board.entities.find((e) => e.id === b)!.team).toBe('neutral');
  });

  it('moves with clamping to the off-rink margin', () => {
    const id = st().addEntity('player', 'home');
    st().moveEntities({ [id]: { x: 99, y: 3 } });
    expect(pos(id)).toEqual({ x: 21.5, y: 3 });
  });

  it('relabels, recolours, duplicates and deletes', () => {
    const id = st().addEntity('player', 'home');
    st().setLabel(id, 'Kim');
    st().setTeam([id], 'away');
    const e = st().board.entities.find((x) => x.id === id)!;
    expect(e.label).toBe('Kim');
    expect(e.team).toBe('away');

    const [dup] = st().duplicateEntities([id]);
    expect(st().board.entities).toHaveLength(2);
    expect(pos(dup!).x).toBeCloseTo(pos(id).x + 1.5);
    expect(st().selection).toEqual([dup]);

    st().deleteEntities([id]);
    expect(st().board.entities.map((x) => x.id)).toEqual([dup]);
    expect(st().board.frames[0]!.positions[id]).toBeUndefined();
  });

  it('changing rink size pulls entities back inside', () => {
    const id = st().addEntity('player', 'home');
    st().moveEntities({ [id]: { x: -21, y: 0 } });
    st().setRinkSize(24, 14);
    expect(pos(id).x).toBeCloseTo(-13.5);
    expect(st().board.rink).toMatchObject({ lengthM: 24, widthM: 14 });
  });
});

describe('migrateBoard', () => {
  it('accepts v1 and rejects others', () => {
    const b = st().board;
    expect(migrateBoard(JSON.parse(JSON.stringify(b)))).toEqual(b);
    expect(() => migrateBoard({ schemaVersion: 2 })).toThrow();
    expect(() => migrateBoard(null)).toThrow();
  });
});

describe('KeyframeTrackSource', () => {
  it('returns frame positions for a static board', () => {
    const id = st().addEntity('player', 'home');
    const { entities, frames } = st().board;
    const src = new KeyframeTrackSource(entities, frames);
    expect(src.durationMs).toBe(0);
    expect(src.stateAt(0).get(id)?.pos).toEqual(pos(id));
  });

  it('interpolates between frames and hits keyframes exactly', () => {
    const entities = [{ id: 'a', kind: 'player' as const }];
    const frames = [
      { id: 'f0', durationMs: 1000, positions: { a: { x: 0, y: 0 } } },
      { id: 'f1', durationMs: 1000, positions: { a: { x: 10, y: -4 } } },
    ];
    const src = new KeyframeTrackSource(entities, frames);
    expect(src.durationMs).toBe(1000);
    expect(src.stateAt(0).get('a')!.pos).toEqual({ x: 0, y: 0 });
    expect(src.stateAt(1000).get('a')!.pos).toEqual({ x: 10, y: -4 });
    expect(src.stateAt(500).get('a')!.pos).toEqual({ x: 5, y: -2 });
  });
});
