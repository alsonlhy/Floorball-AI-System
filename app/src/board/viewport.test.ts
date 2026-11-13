import { describe, expect, it } from 'vitest';
import { RINK_PRESETS, viewBounds } from '../model/rink';
import type { RinkSpec } from '../model/types';
import {
  fitViewport,
  panBy,
  rectToScreen,
  rinkToScreen,
  screenToRink,
  zoomAt,
  type Viewport,
} from './viewport';

const full: RinkSpec = { ...RINK_PRESETS.full, view: 'full' };
const pts = [
  { x: 0, y: 0 },
  { x: 20, y: 10 },
  { x: -20, y: -10 },
  { x: -16.5, y: 8.5 },
  { x: 3.25, y: -7.1 },
];

describe('rinkToScreen / screenToRink', () => {
  const vps: Viewport[] = [
    { scale: 25, offsetX: 512, offsetY: 384, rotation: 0 },
    { scale: 17.3, offsetX: 100.5, offsetY: -40, rotation: 90 },
    { scale: 0.9, offsetX: 0, offsetY: 0, rotation: 0 },
  ];
  for (const vp of vps) {
    it(`round-trips at scale ${vp.scale}, rotation ${vp.rotation}`, () => {
      for (const p of pts) {
        const back = screenToRink(rinkToScreen(p, vp), vp);
        expect(back.x).toBeCloseTo(p.x, 9);
        expect(back.y).toBeCloseTo(p.y, 9);
      }
      for (const s of [
        { x: 0, y: 0 },
        { x: 333, y: 777 },
      ]) {
        const back = rinkToScreen(screenToRink(s, vp), vp);
        expect(back.x).toBeCloseTo(s.x, 9);
        expect(back.y).toBeCloseTo(s.y, 9);
      }
    });
  }

  it('is a rotation, not a mirror, when rotated (orientation preserved)', () => {
    const vp: Viewport = { scale: 10, offsetX: 0, offsetY: 0, rotation: 90 };
    const o = rinkToScreen({ x: 0, y: 0 }, vp);
    const ex = rinkToScreen({ x: 1, y: 0 }, vp);
    const ey = rinkToScreen({ x: 0, y: 1 }, vp);
    // 2D cross product keeps the same sign as the unrotated axes (+1 in y-down screen space)
    const cross = (ex.x - o.x) * (ey.y - o.y) - (ex.y - o.y) * (ey.x - o.x);
    expect(cross).toBeGreaterThan(0);
  });

  it('uses the same scale on both axes (no distortion)', () => {
    for (const rotation of [0, 90] as const) {
      const vp: Viewport = { scale: 13, offsetX: 5, offsetY: 7, rotation };
      const o = rinkToScreen({ x: 0, y: 0 }, vp);
      const ex = rinkToScreen({ x: 1, y: 0 }, vp);
      const ey = rinkToScreen({ x: 0, y: 1 }, vp);
      expect(Math.hypot(ex.x - o.x, ex.y - o.y)).toBeCloseTo(13);
      expect(Math.hypot(ey.x - o.x, ey.y - o.y)).toBeCloseTo(13);
    }
  });
});

describe('fitViewport', () => {
  const sizes = [
    { width: 1024, height: 768, rot: 0 },
    { width: 768, height: 1024, rot: 90 },
    { width: 375, height: 700, rot: 90 },
    { width: 812, height: 375, rot: 0 },
  ];
  for (const { width, height, rot } of sizes) {
    it(`fits the full rink inside ${width}x${height} (rotation ${rot})`, () => {
      const b = viewBounds(full);
      const vp = fitViewport(b, { width, height });
      expect(vp.rotation).toBe(rot);
      const r = rectToScreen(b, vp);
      expect(r.x).toBeGreaterThanOrEqual(-1e-6);
      expect(r.y).toBeGreaterThanOrEqual(-1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(width + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(height + 1e-6);
      // centred
      const c = rinkToScreen({ x: 0, y: 0 }, vp);
      expect(c.x).toBeCloseTo(width / 2);
      expect(c.y).toBeCloseTo(height / 2);
      // aspect preserved
      const long = Math.max(r.w, r.h);
      const short = Math.min(r.w, r.h);
      expect(long / short).toBeCloseTo(b.w / b.h, 6);
    });
  }

  it('half-left view shows the left goal and not the right one', () => {
    const size = { width: 1024, height: 768 };
    const vp = fitViewport(viewBounds(full, 'half-left'), size);
    const left = rinkToScreen({ x: -16.5, y: 0 }, vp);
    const right = rinkToScreen({ x: 16.5, y: 0 }, vp);
    const inside = (p: { x: number; y: number }) =>
      p.x >= 0 && p.x <= size.width && p.y >= 0 && p.y <= size.height;
    expect(inside(left)).toBe(true);
    expect(inside(right)).toBe(false);
  });

  it('half-right view shows the right goal and not the left one', () => {
    const size = { width: 1024, height: 768 };
    const vp = fitViewport(viewBounds(full, 'half-right'), size);
    const inside = (p: { x: number; y: number }) =>
      p.x >= 0 && p.x <= size.width && p.y >= 0 && p.y <= size.height;
    expect(inside(rinkToScreen({ x: 16.5, y: 0 }, vp))).toBe(true);
    expect(inside(rinkToScreen({ x: -16.5, y: 0 }, vp))).toBe(false);
  });
});

describe('zoomAt / panBy', () => {
  it('keeps the anchor point fixed while zooming', () => {
    const vp = fitViewport(viewBounds(full), { width: 1024, height: 768 });
    const anchor = { x: 300, y: 200 };
    const before = screenToRink(anchor, vp);
    const z = zoomAt(vp, anchor, 2, vp.scale);
    expect(z.scale).toBeCloseTo(vp.scale * 2);
    const after = screenToRink(anchor, z);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('clamps zoom to the allowed range', () => {
    const vp: Viewport = { scale: 10, offsetX: 0, offsetY: 0, rotation: 0 };
    expect(zoomAt(vp, { x: 0, y: 0 }, 1000, 10).scale).toBe(60);
    expect(zoomAt(vp, { x: 0, y: 0 }, 0.001, 10).scale).toBe(5);
  });

  it('pans in screen pixels', () => {
    const vp: Viewport = { scale: 10, offsetX: 0, offsetY: 0, rotation: 90 };
    const p = panBy(vp, 15, -5);
    const s = rinkToScreen({ x: 1, y: 2 }, p);
    const s0 = rinkToScreen({ x: 1, y: 2 }, vp);
    expect(s.x - s0.x).toBe(15);
    expect(s.y - s0.y).toBe(-5);
  });
});
