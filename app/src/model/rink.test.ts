import { describe, expect, it } from 'vitest';
import { clampRinkSize, clampToRink, OFF_RINK_MARGIN_M, presetOf, rinkGeometry } from './rink';

describe('rinkGeometry (IFF rules 101-104)', () => {
  const g = rinkGeometry({ lengthM: 40, widthM: 20, view: 'full' });
  const [left, right] = g.ends;

  it('places the goal crease 2.85 m from the short side, 4 x 5 m', () => {
    expect(left.crease).toEqual({ x: -17.15, y: -2.5, w: 4, h: 5 });
    expect(right.crease.x + right.crease.w).toBeCloseTo(17.15);
    expect(right.crease.w).toBeCloseTo(4);
  });

  it('places the goalkeeper area 1 x 2.5 m with its rear line on the goal line (3.5 m)', () => {
    expect(left.keeperArea.x).toBeCloseTo(-16.5);
    expect(left.keeperArea.w).toBeCloseTo(1);
    expect(left.keeperArea.h).toBeCloseTo(2.5);
    expect(left.goalLineX).toBeCloseTo(-16.5);
    expect(right.goalLineX).toBeCloseTo(16.5);
    // keeper area starts 0.65 m in front of the rear of the crease
    expect(left.keeperArea.x - left.crease.x).toBeCloseTo(0.65);
  });

  it('draws the cage 1.6 m wide and 0.6 m deep, behind the goal line', () => {
    const ys = left.cage.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1.6);
    const xs = left.cage.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(-17.1);
    expect(Math.max(...xs)).toBeCloseTo(-16.5);
    // opening faces the centre: right cage lies beyond its goal line
    expect(Math.max(...right.cage.map((p) => p.x))).toBeCloseTo(17.1);
  });

  it('has six face-off dots 1.5 m from the long sides', () => {
    expect(g.faceoffDots).toHaveLength(6);
    for (const d of g.faceoffDots) expect(Math.abs(d.y)).toBeCloseTo(8.5);
    expect(new Set(g.faceoffDots.map((d) => d.x))).toEqual(new Set([-16.5, 0, 16.5]));
  });

  it('keeps official distances from the boards on a smaller rink', () => {
    const s = rinkGeometry({ lengthM: 24, widthM: 14, view: 'full' });
    expect(s.ends[0].crease.x).toBeCloseTo(-12 + 2.85);
    expect(s.ends[1].goalLineX).toBeCloseTo(12 - 3.5);
    for (const d of s.faceoffDots) expect(Math.abs(d.y)).toBeCloseTo(7 - 1.5);
  });

  it('caps the corner radius to the rink size', () => {
    expect(
      rinkGeometry({ lengthM: 20, widthM: 10, view: 'full', cornerRadiusM: 9 }).cornerRadiusM,
    ).toBe(5);
  });
});

describe('rink helpers', () => {
  it('recognises presets', () => {
    expect(presetOf({ lengthM: 40, widthM: 20 })).toBe('full');
    expect(presetOf({ lengthM: 36, widthM: 18 })).toBe('minimum');
    expect(presetOf({ lengthM: 30, widthM: 15 })).toBe('custom');
  });

  it('clamps custom sizes', () => {
    expect(clampRinkSize(5, 100)).toEqual({ lengthM: 20, widthM: 22 });
    expect(clampRinkSize(NaN, 15)).toEqual({ lengthM: 20, widthM: 15 });
  });

  it('clamps positions to the off-rink margin', () => {
    const m = OFF_RINK_MARGIN_M;
    expect(clampToRink({ x: 100, y: -100 }, { lengthM: 40, widthM: 20 })).toEqual({
      x: 20 + m,
      y: -10 - m,
    });
    expect(clampToRink({ x: 3, y: 4 }, { lengthM: 40, widthM: 20 })).toEqual({ x: 3, y: 4 });
  });
});
