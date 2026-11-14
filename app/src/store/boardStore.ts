import { create } from 'zustand';
import { createBoard } from '../model/board';
import { emptyHistory, record, redo, undo, type History } from '../model/history';
import { newId } from '../model/ids';
import { defaultPosition } from '../model/placement';
import { clampRinkSize, clampToRink } from '../model/rink';
import type {
  Board,
  Drawing,
  Entity,
  EntityKind,
  Frame,
  RinkView,
  Team,
  Vec,
} from '../model/types';

export interface BoardState {
  board: Board;
  /** Index of the frame being edited. Until M5 there is only frame 0. */
  frameIndex: number;
  selection: string[];
  history: History<Board>;
  /** Board as it was when the current gesture (drag, erase) began; the gesture is one undo step. */
  gestureBase: Board | null;

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
  setName(name: string): void;

  addDrawing(d: Omit<Drawing, 'id'>): string;
  deleteDrawings(ids: string[]): void;
  clearDrawings(): void;

  beginGesture(): void;
  endGesture(): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;

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
  return { ...board, frames: board.frames.map(fn) };
}

function liveSelection(board: Board, selection: string[]): string[] {
  const ids = new Set(board.entities.map((e) => e.id));
  return selection.filter((id) => ids.has(id));
}

export const useBoardStore = create<BoardState>()((set, get) => {
  /**
   * Every board mutation goes through here so it lands on the undo stack. Inside a gesture
   * the stack is left alone; endGesture records the whole gesture as one step.
   */
  const commit = (next: Board, opts: { key?: string; extra?: Partial<BoardState> } = {}): void => {
    const s = get();
    if (next === s.board) return;
    const board = { ...next, updatedAt: Date.now() };
    const history = s.gestureBase ? s.history : record(s.history, s.board, opts.key ?? null);
    set({ board, history, ...opts.extra });
  };

  return {
    board: createBoard(),
    frameIndex: 0,
    selection: [],
    history: emptyHistory<Board>(),
    gestureBase: null,

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
      commit(
        { ...board, entities: [...board.entities, entity] },
        { extra: { selection: [entity.id] } },
      );
      return entity.id;
    },

    moveEntities(moves) {
      const s = get();
      const fi = s.frameIndex;
      commit(
        mapFrames(s.board, (f, i) => {
          if (i !== fi) return f;
          const positions = { ...f.positions };
          for (const [id, p] of Object.entries(moves)) {
            if (id in positions) positions[id] = clampToRink(p, s.board.rink);
          }
          return { ...f, positions };
        }),
      );
    },

    setLabel(id, label) {
      const s = get();
      commit(
        {
          ...s.board,
          entities: s.board.entities.map((e) =>
            e.id === id ? { ...e, label: label.slice(0, 12) } : e,
          ),
        },
        { key: `label:${id}` },
      );
    },

    setTeam(ids, team) {
      const s = get();
      const which = new Set(ids);
      commit({
        ...s.board,
        entities: s.board.entities.map((e) =>
          which.has(e.id) && (e.kind === 'player' || e.kind === 'goalie') ? { ...e, team } : e,
        ),
      });
    },

    deleteEntities(ids) {
      const s = get();
      const gone = new Set(ids);
      if (!s.board.entities.some((e) => gone.has(e.id))) return;
      const board = mapFrames(s.board, (f) => ({
        ...f,
        positions: Object.fromEntries(Object.entries(f.positions).filter(([id]) => !gone.has(id))),
      }));
      commit(
        { ...board, entities: board.entities.filter((e) => !gone.has(e.id)) },
        { extra: { selection: s.selection.filter((id) => !gone.has(id)) } },
      );
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
      if (idMap.size === 0) return [];
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
      commit(board, { extra: { selection: created } });
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
      if (rink.lengthM === s.board.rink.lengthM && rink.widthM === s.board.rink.widthM) return;
      const board = mapFrames(s.board, (f) => ({
        ...f,
        positions: Object.fromEntries(
          Object.entries(f.positions).map(([id, p]) => [id, clampToRink(p, rink)]),
        ),
      }));
      commit({ ...board, rink });
    },

    setView(view) {
      const s = get();
      if (s.board.rink.view === view) return;
      commit({ ...s.board, rink: { ...s.board.rink, view } });
    },

    setTeamColor(team, color) {
      const s = get();
      commit(
        { ...s.board, teamColors: { ...s.board.teamColors, [team]: color } },
        { key: `color:${team}` },
      );
    },

    setName(name) {
      const s = get();
      const next = name.slice(0, 120);
      if (next === s.board.name) return;
      commit({ ...s.board, name: next }, { key: 'name' });
    },

    addDrawing(d) {
      const s = get();
      // + 0 turns -0 into 0 so saved files round-trip exactly.
      const points = d.points.map((p) => ({ x: p.x + 0, y: p.y + 0 }));
      const drawing: Drawing = { ...d, points, id: newId('d_') };
      commit({ ...s.board, drawings: [...s.board.drawings, drawing] });
      return drawing.id;
    },

    deleteDrawings(ids) {
      const s = get();
      const gone = new Set(ids);
      if (!s.board.drawings.some((d) => gone.has(d.id))) return;
      commit({ ...s.board, drawings: s.board.drawings.filter((d) => !gone.has(d.id)) });
    },

    clearDrawings() {
      const s = get();
      if (s.board.drawings.length === 0) return;
      commit({ ...s.board, drawings: [] });
    },

    beginGesture() {
      const s = get();
      if (!s.gestureBase) set({ gestureBase: s.board });
    },

    endGesture() {
      const s = get();
      const base = s.gestureBase;
      if (!base) return;
      set({
        gestureBase: null,
        history: s.board !== base ? record(s.history, base) : s.history,
      });
    },

    undo() {
      get().endGesture();
      const s = get();
      const r = undo(s.history, s.board);
      if (!r) return;
      set({ board: r.value, history: r.history, selection: liveSelection(r.value, s.selection) });
    },

    redo() {
      get().endGesture();
      const s = get();
      const r = redo(s.history, s.board);
      if (!r) return;
      set({ board: r.value, history: r.history, selection: liveSelection(r.value, s.selection) });
    },

    canUndo() {
      return get().history.past.length > 0;
    },

    canRedo() {
      return get().history.future.length > 0;
    },

    reset(board) {
      set({
        board: board ?? createBoard(),
        frameIndex: 0,
        selection: [],
        history: emptyHistory<Board>(),
        gestureBase: null,
      });
    },
  };
});
