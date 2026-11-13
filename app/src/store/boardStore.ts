import { create } from 'zustand';
import { createBoard } from '../model/board';
import { newId } from '../model/ids';
import { defaultPosition } from '../model/placement';
import { clampRinkSize, clampToRink } from '../model/rink';
import type { Board, Entity, EntityKind, Frame, RinkView, Team, Vec } from '../model/types';

export interface BoardState {
  board: Board;
  /** Index of the frame being edited. Until M5 there is only frame 0. */
  frameIndex: number;
  selection: string[];

  addEntity(kind: EntityKind, team?: Team): string;
  moveEntities(moves: Record<string, Vec>): void;
  setLabel(id: string, label: string): void;
  setTeam(ids: string[], team: Team): void;
  deleteEntities(ids: string[]): void;
  duplicateEntities(ids: string[]): string[];
  select(ids: string[]): void;
  toggleSelect(id: string): void;
  setRinkSize(lengthM: number, widthM: number): void;
  setView(view: RinkView): void;
  setTeamColor(team: 'home' | 'away', color: string): void;
  reset(board?: Board): void;
}

function currentFrame(s: Pick<BoardState, 'board' | 'frameIndex'>): Frame {
  return s.board.frames[s.frameIndex] ?? s.board.frames[0]!;
}

function idPrefix(kind: EntityKind): string {
  return kind.charAt(0) + '_';
}

function nextLabel(entities: Entity[], kind: EntityKind, team?: Team): string | undefined {
  if (kind === 'goalie') return 'G';
  if (kind !== 'player') return undefined;
  const used = new Set(
    entities.filter((e) => e.kind === 'player' && e.team === team).map((e) => e.label),
  );
  let n = 1;
  while (used.has(String(n))) n++;
  return String(n);
}

function mapFrames(board: Board, fn: (f: Frame, i: number) => Frame): Board {
  return { ...board, frames: board.frames.map(fn), updatedAt: Date.now() };
}

export const useBoardStore = create<BoardState>()((set, get) => ({
  board: createBoard(),
  frameIndex: 0,
  selection: [],

  addEntity(kind, team) {
    const s = get();
    const t: Team = kind === 'ball' || kind === 'cone' ? 'neutral' : (team ?? 'home');
    const pos = defaultPosition(kind, t, s.board.rink, Object.values(currentFrame(s).positions));
    const entity: Entity = { id: newId(idPrefix(kind)), kind, team: t };
    const label = nextLabel(s.board.entities, kind, t);
    if (label !== undefined) entity.label = label;
    const fi = s.frameIndex;
    const board = mapFrames(s.board, (f, i) =>
      i === fi ? { ...f, positions: { ...f.positions, [entity.id]: pos } } : f,
    );
    set({ board: { ...board, entities: [...board.entities, entity] }, selection: [entity.id] });
    return entity.id;
  },

  moveEntities(moves) {
    const s = get();
    const fi = s.frameIndex;
    set({
      board: mapFrames(s.board, (f, i) => {
        if (i !== fi) return f;
        const positions = { ...f.positions };
        for (const [id, p] of Object.entries(moves)) {
          if (id in positions) positions[id] = clampToRink(p, s.board.rink);
        }
        return { ...f, positions };
      }),
    });
  },

  setLabel(id, label) {
    const s = get();
    set({
      board: {
        ...s.board,
        entities: s.board.entities.map((e) =>
          e.id === id ? { ...e, label: label.slice(0, 12) } : e,
        ),
        updatedAt: Date.now(),
      },
    });
  },

  setTeam(ids, team) {
    const s = get();
    const which = new Set(ids);
    set({
      board: {
        ...s.board,
        entities: s.board.entities.map((e) =>
          which.has(e.id) && (e.kind === 'player' || e.kind === 'goalie') ? { ...e, team } : e,
        ),
        updatedAt: Date.now(),
      },
    });
  },

  deleteEntities(ids) {
    const s = get();
    const gone = new Set(ids);
    const board = mapFrames(s.board, (f) => ({
      ...f,
      positions: Object.fromEntries(Object.entries(f.positions).filter(([id]) => !gone.has(id))),
    }));
    set({
      board: { ...board, entities: board.entities.filter((e) => !gone.has(e.id)) },
      selection: s.selection.filter((id) => !gone.has(id)),
    });
  },

  duplicateEntities(ids) {
    const s = get();
    const offset = 1.5;
    const entities = [...s.board.entities];
    const idMap = new Map<string, string>();
    for (const id of ids) {
      const src = entities.find((e) => e.id === id);
      if (!src) continue;
      const copy: Entity = { ...src, id: newId(idPrefix(src.kind)) };
      if (src.kind === 'player') {
        const label = nextLabel(entities, 'player', src.team);
        if (label !== undefined) copy.label = label;
      }
      entities.push(copy);
      idMap.set(id, copy.id);
    }
    const rink = s.board.rink;
    const board = mapFrames({ ...s.board, entities }, (f) => {
      const positions = { ...f.positions };
      for (const [from, to] of idMap) {
        const p = f.positions[from];
        if (p) positions[to] = clampToRink({ x: p.x + offset, y: p.y + offset }, rink);
      }
      return { ...f, positions };
    });
    const created = [...idMap.values()];
    set({ board, selection: created });
    return created;
  },

  select(ids) {
    set({ selection: [...new Set(ids)] });
  },

  toggleSelect(id) {
    const sel = get().selection;
    set({ selection: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
  },

  setRinkSize(lengthM, widthM) {
    const s = get();
    const rink = { ...s.board.rink, ...clampRinkSize(lengthM, widthM) };
    const board = mapFrames(s.board, (f) => ({
      ...f,
      positions: Object.fromEntries(
        Object.entries(f.positions).map(([id, p]) => [id, clampToRink(p, rink)]),
      ),
    }));
    set({ board: { ...board, rink } });
  },

  setView(view) {
    const s = get();
    set({ board: { ...s.board, rink: { ...s.board.rink, view }, updatedAt: Date.now() } });
  },

  setTeamColor(team, color) {
    const s = get();
    set({
      board: {
        ...s.board,
        teamColors: { ...s.board.teamColors, [team]: color },
        updatedAt: Date.now(),
      },
    });
  },

  reset(board) {
    set({ board: board ?? createBoard(), frameIndex: 0, selection: [] });
  },
}));
