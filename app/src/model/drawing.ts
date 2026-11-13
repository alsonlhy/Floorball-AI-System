// Drawing styles and geometry in rink metres. Pure TS: used by the tools, the renderer and tests.

import type { Drawing, DrawingStyle, Vec } from './types';

export type ArrowKind = 'run' | 'pass' | 'shot';

/** How a coach reads arrows: solid = player run, dashed = pass, double line = shot. */
export const ARROW_STYLES: Record<ArrowKind, Pick<DrawingStyle, 'dash' | 'head'>> = {
  run: { dash: 'solid', head: 'arrow' },
  pass: { dash: 'dashed', head: 'arrow' },
  shot: { dash: 'double', head: 'arrow' },
};

export const PALETTE = ['#111827', '#ffffff', '#dc2626', '#2563eb', '#facc15', '#16a34a'] as const;

export const WIDTHS = { thin: 0.08, medium: 0.15, thick: 0.3 } as const;
export type WidthKey = keyof typeof WIDTHS;

export const TEXT_SIZE_PER_WIDTH = 7; // text height = 7 x stroke width (≈1 m at medium)

/** Translucent fill for zones, from a #rrggbb colour. */
export function zoneFill(color: string, alpha = 0.22): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return color;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h!, 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

export function boundsOf(points: Vec[]): { x: number; y: number; w: number; h: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distToPolyline(p: Vec, pts: Vec[]): number {
  if (pts.length === 1) return Math.hypot(p.x - pts[0]!.x, p.y - pts[0]!.y);
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, distToSegment(p, pts[i - 1]!, pts[i]!));
  return d;
}

/** Approximate text extent in metres (used for hit-testing only). */
export function textRadiusM(d: Drawing): number {
  const size = d.style.fontSizeM ?? d.style.widthM * TEXT_SIZE_PER_WIDTH;
  const len = Math.max(1, (d.text ?? '').length);
  return Math.max(size, (len * size * 0.6) / 2);
}

/** Does the eraser at `p` (tolerance `tolM`) touch this drawing? */
export function hitDrawing(d: Drawing, p: Vec, tolM: number): boolean {
  const tol = tolM + d.style.widthM / 2;
  switch (d.tool) {
    case 'pen':
    case 'line':
    case 'arrow':
      return d.points.length > 0 && distToPolyline(p, d.points) <= tol;
    case 'text': {
      const a = d.points[0];
      return !!a && Math.hypot(p.x - a.x, p.y - a.y) <= textRadiusM(d) + tolM;
    }
    case 'zone': {
      if (d.points.length < 2) return false;
      const b = boundsOf(d.points);
      if (d.shape === 'ellipse') {
        const rx = b.w / 2 + tol;
        const ry = b.h / 2 + tol;
        const nx = (p.x - (b.x + b.w / 2)) / rx;
        const ny = (p.y - (b.y + b.h / 2)) / ry;
        return nx * nx + ny * ny <= 1;
      }
      return (
        p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol
      );
    }
  }
}

/** Drop pen points closer than `minStepM` to the previous kept point (always keeps the last). */
export function thinPoints(points: Vec[], minStepM: number, pressures?: number[]) {
  const outP: Vec[] = [];
  const outPr: number[] = [];
  points.forEach((p, i) => {
    const last = outP[outP.length - 1];
    const isLast = i === points.length - 1;
    if (!last || isLast || Math.hypot(p.x - last.x, p.y - last.y) >= minStepM) {
      outP.push(p);
      if (pressures) outPr.push(pressures[i] ?? 0.5);
    }
  });
  return { points: outP, pressures: pressures ? outPr : undefined };
}

/** Drawings visible on a frame (Rule 3): unpinned ones plus those pinned to this frame. */
export function drawingsForFrame(drawings: Drawing[], frameId: string | undefined): Drawing[] {
  return drawings.filter((d) => d.frameId === undefined || d.frameId === frameId);
}
