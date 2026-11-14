import { describe, expect, it } from 'vitest';
import { createBoard } from './board';
import { loadBoard, parseBoardJson, serializeBoard } from './migrate';
import type { Board } from './types';
import { BoardValidationError } from './validate';

function richBoard(): Board {
  const b = createBoard('Power play 5v4', 1_700_000_000_000);
  const f0 = b.frames[0]!;
  return {
    ...b,
    rink: { lengthM: 36, widthM: 18, view: 'half-right', cornerRadiusM: 2.5 },
    teamColors: { home: '#ff0000', away: '#0000ff' },
    entities: [
      { id: 'p_1', kind: 'player', team: 'home', label: '7' },
      { id: 'g_1', kind: 'goalie', team: 'away', label: 'G' },
      { id: 'b_1', kind: 'ball', team: 'neutral' },
      { id: 'c_1', kind: 'cone' },
    ],
    frames: [
      {
        ...f0,
        positions: { p_1: { x: -3.25, y: 4.5 }, g_1: { x: 14, y: 0 }, b_1: { x: 0, y: 0 } },
      },
      {
        id: 'f_2',
        durationMs: 1500,
        positions: { p_1: { x: 1, y: 1 }, c_1: { x: 19.2, y: -9.9 } },
      },
    ],
    drawings: [
      {
        id: 'd_1',
        tool: 'pen',
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0.5 },
        ],
        pressures: [0.2, 0.9],
        style: { color: '#dc2626', widthM: 0.15 },
      },
      {
        id: 'd_2',
        tool: 'arrow',
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 2 },
        ],
        style: { color: '#111827', widthM: 0.15, dash: 'double', head: 'arrow' },
        frameId: 'f_2',
      },
      {
        id: 'd_3',
        tool: 'zone',
        shape: 'ellipse',
        points: [
          { x: 1, y: 1 },
          { x: 4, y: 3 },
        ],
        style: { color: '#2563eb', widthM: 0.08, fill: 'rgba(37,99,235,0.22)' },
      },
      {
        id: 'd_4',
        tool: 'text',
        points: [{ x: 0, y: 8 }],
        text: 'Press high',
        style: { color: '#111827', widthM: 0.15, fontSizeM: 1.05 },
      },
    ],
    updatedAt: 1_700_000_100_000,
  };
}

const expectError = (fn: () => unknown, re: RegExp) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(BoardValidationError);
    expect((e as Error).message).toMatch(re);
    return;
  }
  throw new Error('expected a BoardValidationError');
};

const mutate = (fn: (b: Record<string, unknown>) => void) => {
  const raw = JSON.parse(serializeBoard(richBoard())) as Record<string, unknown>;
  fn(raw);
  return JSON.stringify(raw);
};

describe('board files', () => {
  it('round-trips a board exactly through JSON', () => {
    const b = richBoard();
    expect(parseBoardJson(serializeBoard(b))).toEqual(b);
  });

  it('drops unknown fields', () => {
    const text = mutate((b) => {
      b.secret = 'x';
      (b.entities as Record<string, unknown>[])[0]!.extra = 1;
    });
    const b = parseBoardJson(text) as unknown as Record<string, unknown>;
    expect(b.secret).toBeUndefined();
    expect((b.entities as Record<string, unknown>[])[0]!.extra).toBeUndefined();
  });

  it('rejects non-JSON with a readable message', () => {
    expectError(() => parseBoardJson('{not json'), /not valid JSON/);
    expectError(() => parseBoardJson(''), /not valid JSON/);
  });

  it('rejects things that are not boards', () => {
    expectError(() => parseBoardJson('[1,2]'), /expected a JSON object/);
    expectError(() => parseBoardJson('{"hello":1}'), /no schemaVersion/);
    expectError(() => parseBoardJson('{"schemaVersion":7}'), /newer version of the app/);
  });

  it('names the field that is wrong', () => {
    expectError(
      () =>
        parseBoardJson(
          mutate((b) => ((b.entities as Record<string, unknown>[])[1]!.kind = 'goalkeeper')),
        ),
      /entities\[1\]\.kind is "goalkeeper", expected one of player, goalie, ball, cone/,
    );
    expectError(
      () => parseBoardJson(mutate((b) => ((b.rink as Record<string, unknown>).lengthM = 400))),
      /rink\.lengthM must be between 20 and 44/,
    );
    expectError(
      () => parseBoardJson(mutate((b) => (b.frames = []))),
      /frames must contain at least one frame/,
    );
    expectError(
      () =>
        parseBoardJson(
          mutate(
            (b) =>
              ((b.frames as { positions: Record<string, unknown> }[])[0]!.positions.ghost = {
                x: 0,
                y: 0,
              }),
          ),
        ),
      /piece "ghost" that is not on the board/,
    );
    expectError(
      () =>
        parseBoardJson(
          mutate((b) => ((b.drawings as Record<string, unknown>[])[1]!.frameId = 'nope')),
        ),
      /frame "nope" that does not exist/,
    );
    expectError(
      () =>
        parseBoardJson(mutate((b) => ((b.entities as Record<string, unknown>[])[1]!.id = 'p_1'))),
      /id "p_1" more than once/,
    );
    expectError(
      () =>
        parseBoardJson(
          mutate((b) => ((b.drawings as { pressures: number[] }[])[0]!.pressures = [0.5])),
        ),
      /one value per point/,
    );
    expectError(
      () =>
        parseBoardJson(
          mutate(
            (b) =>
              ((b.frames as { positions: Record<string, { x: unknown }> }[])[0]!.positions.p_1!.x =
                'left'),
          ),
        ),
      /positions\.p_1\.x must be a number/,
    );
  });

  it('fills defaults for early v1 boards without teamColors or drawings', () => {
    const raw = JSON.parse(serializeBoard(richBoard())) as Record<string, unknown>;
    delete raw.teamColors;
    delete raw.drawings;
    const b = loadBoard(raw);
    expect(b.teamColors.home).toMatch(/^#/);
    expect(b.drawings).toEqual([]);
  });
});
