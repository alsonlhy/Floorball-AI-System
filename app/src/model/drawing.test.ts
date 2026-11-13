import { describe, expect, it } from 'vitest';
import { distToSegment, drawingsForFrame, hitDrawing, thinPoints, zoneFill } from './drawing';
import type { Drawing } from './types';

const style = { color: '#dc2626', widthM: 0.1 };

describe('drawing geometry', () => {
  it('measures distance to a segment', () => {
    expect(distToSegment({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(1);
    expect(distToSegment({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(5);
  });

  it('hit-tests each tool', () => {
    const line: Drawing = {
      id: 'l',
      tool: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      style,
    };
    expect(hitDrawing(line, { x: 2, y: 0.2 }, 0.2)).toBe(true);
    expect(hitDrawing(line, { x: 2, y: 1 }, 0.2)).toBe(false);

    const rect: Drawing = {
      id: 'z',
      tool: 'zone',
      shape: 'rect',
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 2 },
      ],
      style,
    };
    expect(hitDrawing(rect, { x: 3.9, y: 1.9 }, 0.1)).toBe(true);
    expect(hitDrawing(rect, { x: 5, y: 1 }, 0.1)).toBe(false);

    const ell: Drawing = { ...rect, shape: 'ellipse' };
    expect(hitDrawing(ell, { x: 2, y: 1 }, 0.1)).toBe(true);
    expect(hitDrawing(ell, { x: 0.1, y: 0.1 }, 0.1)).toBe(false); // corner is outside an ellipse

    const text: Drawing = {
      id: 't',
      tool: 'text',
      points: [{ x: 5, y: 5 }],
      text: 'Press',
      style: { ...style, fontSizeM: 1 },
    };
    expect(hitDrawing(text, { x: 5.5, y: 5 }, 0.1)).toBe(true);
    expect(hitDrawing(text, { x: 9, y: 5 }, 0.1)).toBe(false);
  });

  it('thins pen points but keeps the ends', () => {
    const pts = Array.from({ length: 11 }, (_, i) => ({ x: i * 0.01, y: 0 }));
    const out = thinPoints(
      pts,
      0.05,
      pts.map(() => 0.7),
    );
    expect(out.points[0]).toEqual(pts[0]);
    expect(out.points[out.points.length - 1]).toEqual(pts[10]);
    expect(out.points.length).toBeLessThan(5);
    expect(out.pressures).toHaveLength(out.points.length);
    expect(thinPoints(pts, 0.05).pressures).toBeUndefined();
  });

  it('makes a translucent zone fill', () => {
    expect(zoneFill('#2563eb')).toBe('rgba(37,99,235,0.22)');
  });

  it('shows unpinned drawings on every frame and pinned ones on their frame (Rule 3)', () => {
    const a: Drawing = { id: 'a', tool: 'line', points: [], style };
    const b: Drawing = { ...a, id: 'b', frameId: 'f1' };
    expect(drawingsForFrame([a, b], 'f0').map((d) => d.id)).toEqual(['a']);
    expect(drawingsForFrame([a, b], 'f1').map((d) => d.id)).toEqual(['a', 'b']);
  });
});
