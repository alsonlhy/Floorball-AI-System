import { beforeEach, describe, expect, it } from 'vitest';
import { useBoardStore } from './boardStore';

const st = () => useBoardStore.getState();
const line = {
  tool: 'line' as const,
  points: [
    { x: 0, y: 0 },
    { x: 3, y: 1 },
  ],
  style: { color: '#000', widthM: 0.1 },
};

beforeEach(() => st().reset());

describe('store undo/redo', () => {
  it('undoes every kind of mutation back to the empty board, then redoes to the end', () => {
    const empty = st().board;
    const id = st().addEntity('player', 'home');
    st().moveEntities({ [id]: { x: 1, y: 2 } });
    st().setTeam([id], 'away');
    st().setLabel(id, '9');
    st().addDrawing(line);
    st().setView('half-left');
    st().setRinkSize(36, 18);
    st().setTeamColor('home', '#00ff00');
    st().duplicateEntities([id]);
    st().deleteEntities([id]);
    st().clearDrawings();
    const end = st().board;

    let n = 0;
    while (st().canUndo()) {
      st().undo();
      n++;
    }
    expect(n).toBe(11);
    expect(st().board).toEqual(empty);

    while (st().canRedo()) st().redo();
    expect(st().board).toEqual(end);
  });

  it('one drag is one undo step', () => {
    const id = st().addEntity('player', 'home');
    const before = st().board.frames[0]!.positions[id];
    st().beginGesture();
    for (let i = 1; i <= 20; i++) st().moveEntities({ [id]: { x: i * 0.1, y: 0 } });
    st().endGesture();
    expect(st().history.past).toHaveLength(2); // add + drag
    st().undo();
    expect(st().board.frames[0]!.positions[id]).toEqual(before);
    st().redo();
    expect(st().board.frames[0]!.positions[id]).toEqual({ x: 2, y: 0 });
  });

  it('a gesture that changes nothing adds no step', () => {
    st().addEntity('cone');
    st().beginGesture();
    st().endGesture();
    expect(st().history.past).toHaveLength(1);
  });

  it('typing a label is one step', () => {
    const id = st().addEntity('player', 'home');
    for (const v of ['K', 'Ki', 'Kim']) st().setLabel(id, v);
    expect(st().history.past).toHaveLength(2);
    st().undo();
    expect(st().board.entities[0]!.label).toBe('1');
  });

  it('clear drawings keeps the players in place and is undoable', () => {
    const id = st().addEntity('player', 'home');
    st().addDrawing(line);
    st().addDrawing(line);
    const positions = st().board.frames[0]!.positions;
    st().clearDrawings();
    expect(st().board.drawings).toHaveLength(0);
    expect(st().board.frames[0]!.positions).toEqual(positions);
    expect(st().board.entities.map((e) => e.id)).toEqual([id]);
    st().undo();
    expect(st().board.drawings).toHaveLength(2);
  });

  it('undo drops selection of entities that no longer exist', () => {
    const id = st().addEntity('player', 'home');
    expect(st().selection).toEqual([id]);
    st().undo();
    expect(st().selection).toEqual([]);
  });

  it('a new change after undo discards the redo branch', () => {
    st().addEntity('cone');
    st().undo();
    expect(st().canRedo()).toBe(true);
    st().addEntity('ball');
    expect(st().canRedo()).toBe(false);
  });
});
