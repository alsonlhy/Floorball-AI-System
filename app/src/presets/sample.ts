// A ready-made three-step drill (pass, carry, shot) so a new device has something to try.
// Opened via #/sample or the library's "Sample drill" button; each open makes a fresh copy.

import { newId } from '../model/ids';
import { loadBoard } from '../model/migrate';
import type { Board } from '../model/types';

const SAMPLE = {
  schemaVersion: 1,
  id: 'sample',
  name: 'Sample: switch and shoot',
  rink: {
    lengthM: 40,
    widthM: 20,
    view: 'full',
  },
  teamColors: {
    home: '#d62828',
    away: '#1d4ed8',
  },
  entities: [
    {
      id: 'g_a45277af',
      kind: 'goalie',
      team: 'home',
      label: 'G',
    },
    {
      id: 'p_5d144437',
      kind: 'player',
      team: 'home',
      label: '4',
    },
    {
      id: 'p_58de281f',
      kind: 'player',
      team: 'home',
      label: '5',
    },
    {
      id: 'p_67c74099',
      kind: 'player',
      team: 'home',
      label: '10',
    },
    {
      id: 'p_3f6d9f9e',
      kind: 'player',
      team: 'home',
      label: '7',
    },
    {
      id: 'p_1c42b602',
      kind: 'player',
      team: 'home',
      label: '9',
    },
    {
      id: 'g_92f8e784',
      kind: 'goalie',
      team: 'away',
      label: 'G',
    },
    {
      id: 'p_d1c41ee2',
      kind: 'player',
      team: 'away',
      label: '3',
    },
    {
      id: 'p_93cf812a',
      kind: 'player',
      team: 'away',
      label: '6',
    },
    {
      id: 'p_59d85b24',
      kind: 'player',
      team: 'away',
      label: '8',
    },
    {
      id: 'p_41eb262f',
      kind: 'player',
      team: 'away',
      label: '11',
    },
    {
      id: 'p_047e11e6',
      kind: 'player',
      team: 'away',
      label: '14',
    },
    {
      id: 'b_82be59d5',
      kind: 'ball',
      team: 'neutral',
    },
  ],
  frames: [
    {
      id: 'f_601ccd45',
      durationMs: 1000,
      positions: {
        g_a45277af: {
          x: -16,
          y: 0,
        },
        p_5d144437: {
          x: -12,
          y: -4,
        },
        p_58de281f: {
          x: -12,
          y: 4,
        },
        p_67c74099: {
          x: -6,
          y: 0,
        },
        p_3f6d9f9e: {
          x: -1,
          y: -6,
        },
        p_1c42b602: {
          x: -1,
          y: 6,
        },
        g_92f8e784: {
          x: 16,
          y: 0,
        },
        p_d1c41ee2: {
          x: 10,
          y: -3,
        },
        p_93cf812a: {
          x: 10,
          y: 3,
        },
        p_59d85b24: {
          x: 4,
          y: -7,
        },
        p_41eb262f: {
          x: 4,
          y: 7,
        },
        p_047e11e6: {
          x: 5,
          y: 0,
        },
        b_82be59d5: {
          x: -5.3,
          y: 0.6,
        },
      },
    },
    {
      id: 'f_6b991da6',
      durationMs: 1000,
      positions: {
        g_a45277af: {
          x: -16,
          y: 0,
        },
        p_5d144437: {
          x: -12,
          y: -4,
        },
        p_58de281f: {
          x: -12,
          y: 4,
        },
        p_67c74099: {
          x: -3,
          y: -1,
        },
        p_3f6d9f9e: {
          x: -1,
          y: -6,
        },
        p_1c42b602: {
          x: -1,
          y: 6,
        },
        g_92f8e784: {
          x: 16,
          y: 0,
        },
        p_d1c41ee2: {
          x: 10,
          y: -3,
        },
        p_93cf812a: {
          x: 10,
          y: 3,
        },
        p_59d85b24: {
          x: 2,
          y: -5,
        },
        p_41eb262f: {
          x: 4,
          y: 7,
        },
        p_047e11e6: {
          x: 5,
          y: 0,
        },
        b_82be59d5: {
          x: -1.4,
          y: -5.3,
        },
      },
    },
    {
      id: 'f_2f712e4c',
      durationMs: 1000,
      positions: {
        g_a45277af: {
          x: -16,
          y: 0,
        },
        p_5d144437: {
          x: -12,
          y: -4,
        },
        p_58de281f: {
          x: -12,
          y: 4,
        },
        p_67c74099: {
          x: 3,
          y: 1,
        },
        p_3f6d9f9e: {
          x: 7,
          y: -4,
        },
        p_1c42b602: {
          x: -1,
          y: 6,
        },
        g_92f8e784: {
          x: 16,
          y: 0,
        },
        p_d1c41ee2: {
          x: 9,
          y: -2.5,
        },
        p_93cf812a: {
          x: 10,
          y: 3,
        },
        p_59d85b24: {
          x: 2,
          y: -5,
        },
        p_41eb262f: {
          x: 4,
          y: 7,
        },
        p_047e11e6: {
          x: 5,
          y: 0,
        },
        b_82be59d5: {
          x: 15.4,
          y: -0.4,
        },
      },
    },
  ],
  drawings: [
    {
      id: 'd_9abe9d4b',
      tool: 'arrow',
      points: [
        {
          x: -6,
          y: 0,
        },
        {
          x: -1.5,
          y: -5.5,
        },
      ],
      style: {
        color: '#111827',
        widthM: 0.15,
        dash: 'dashed',
        head: 'arrow',
      },
    },
    {
      id: 'd_fe625c3a',
      tool: 'arrow',
      points: [
        {
          x: -1,
          y: -6,
        },
        {
          x: 7,
          y: -4,
        },
      ],
      style: {
        color: '#111827',
        widthM: 0.15,
        dash: 'solid',
        head: 'arrow',
      },
    },
    {
      id: 'd_97de74d7',
      tool: 'arrow',
      points: [
        {
          x: 7,
          y: -4,
        },
        {
          x: 15.5,
          y: -0.5,
        },
      ],
      style: {
        color: '#dc2626',
        widthM: 0.15,
        dash: 'double',
        head: 'arrow',
      },
    },
    {
      id: 'd_5e1b7dac',
      tool: 'zone',
      points: [
        {
          x: 6,
          y: -7,
        },
        {
          x: 12,
          y: -1,
        },
      ],
      style: {
        color: '#2563eb',
        widthM: 0.15,
        fill: 'rgba(37,99,235,0.22)',
      },
      shape: 'ellipse',
    },
    {
      id: 'd_67c33515',
      tool: 'text',
      points: [
        {
          x: 0,
          y: -8.6,
        },
      ],
      style: {
        color: '#111827',
        widthM: 0.15,
        fontSizeM: 1.05,
      },
      text: 'Switch and shoot',
    },
  ],
  createdAt: 0,
  updatedAt: 0,
} as const;

export function sampleBoard(now = Date.now()): Board {
  // Through loadBoard like any saved file, so the sample is checked against the schema.
  return { ...loadBoard(structuredClone(SAMPLE)), id: newId('b_'), createdAt: now, updatedAt: now };
}
