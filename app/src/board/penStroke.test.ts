import { getStroke } from 'perfect-freehand';
import { describe, expect, it } from 'vitest';
import { distToPolyline } from '../model/drawing';
import type { Vec } from '../model/types';
import { penOutline } from './penStroke';

const W = 0.15; // medium pen, metres

/** Largest distance from any outline point to the path the finger/pen actually took. */
function maxDeviation(outline: number[], path: Vec[]): number {
  let worst = 0;
  for (let i = 0; i < outline.length; i += 2) {
    worst = Math.max(worst, distToPolyline({ x: outline[i]!, y: outline[i + 1]! }, path));
  }
  return worst;
}

// Touch on iPad/phone: the first move arrives ~12 px from the touch-down point (touch slop),
// then the finger moves on in small steps.
const touchStart: Vec[] = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0.3 },
];
for (let i = 1; i <= 20; i++) touchStart.push({ x: 0.5 + i * 0.1, y: 0.3 });

const curve: Vec[] = Array.from({ length: 60 }, (_, i) => ({
  x: -6 + i * 0.2,
  y: Math.sin(i / 8) * 2,
}));

describe('pen stroke outline', () => {
  it('reproduces the bug: raw metres make a big blob at a touch start', () => {
    // What the board did before: getStroke on metres directly.
    const raw = getStroke(
      touchStart.map((p) => [p.x, p.y, 0.5]),
      { size: W * 1.8, thinning: 0.4, smoothing: 0.5, streamline: 0.4, simulatePressure: true },
    ).flat();
    expect(maxDeviation(raw, touchStart)).toBeGreaterThan(1); // metres off the path
  });

  it('stays within the stroke width of the path at a touch start', () => {
    const o = penOutline(touchStart, W);
    expect(maxDeviation(o, touchStart)).toBeLessThan(W * 1.2);
  });

  it('follows a curve, as a live draft and when finished', () => {
    for (const complete of [false, true]) {
      const o = penOutline(curve, W, { complete });
      expect(maxDeviation(o, curve)).toBeLessThan(W * 1.2);
    }
  });

  it('follows the path with Apple Pencil pressure, including a zero-pressure start', () => {
    const pressures = curve.map((_, i) => (i === 0 ? 0 : 0.3 + (i % 10) / 20));
    const o = penOutline(curve, W, { pressures });
    expect(maxDeviation(o, curve)).toBeLessThan(W * 1.2);
  });

  it('reaches both ends of the stroke', () => {
    const straight = Array.from({ length: 41 }, (_, i) => ({ x: i * 0.1, y: 0 }));
    const o = penOutline(straight, W);
    const xs = o.filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeLessThan(0.05);
    expect(Math.max(...xs)).toBeGreaterThan(3.95);
  });

  it('draws a dot for a single tap', () => {
    const o = penOutline([{ x: 1, y: 1 }], W);
    expect(o.length).toBeGreaterThan(4);
    expect(maxDeviation(o, [{ x: 1, y: 1 }])).toBeLessThan(W * 1.2);
  });
});
