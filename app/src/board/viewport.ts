// The one transform between rink metres and screen pixels. Everything that turns a rink
// position into a pixel, or a pointer into a rink position, goes through these functions.
// Pure TS (no React / Konva) so it can be unit-tested directly.

import type { Rect } from '../model/rink';
import type { Vec } from '../model/types';

export interface Viewport {
  /** Pixels per metre. Same on both axes, so the rink is never distorted. */
  scale: number;
  /** Screen position of the rink origin (centre spot). */
  offsetX: number;
  offsetY: number;
  /** 0 = rink length runs left-right; 90 = rotated clockwise, length runs top-bottom. */
  rotation: 0 | 90;
}

export interface Size {
  width: number;
  height: number;
}

export function rinkToScreen(p: Vec, vp: Viewport): Vec {
  if (vp.rotation === 90) {
    return { x: vp.offsetX - p.y * vp.scale, y: vp.offsetY + p.x * vp.scale };
  }
  return { x: vp.offsetX + p.x * vp.scale, y: vp.offsetY + p.y * vp.scale };
}

export function screenToRink(s: Vec, vp: Viewport): Vec {
  const dx = (s.x - vp.offsetX) / vp.scale;
  const dy = (s.y - vp.offsetY) / vp.scale;
  if (vp.rotation === 90) return { x: dy, y: -dx };
  return { x: dx, y: dy };
}

/**
 * Konva group attributes equivalent to rinkToScreen, for drawing rink markings in metres.
 * Konva applies scale then rotation then translation, which matches rinkToScreen.
 */
export function viewportGroupAttrs(vp: Viewport) {
  return {
    x: vp.offsetX,
    y: vp.offsetY,
    scaleX: vp.scale,
    scaleY: vp.scale,
    rotation: vp.rotation,
  };
}

/** Fit a rink-space rectangle into the screen, choosing the orientation that shows it largest. */
export function fitViewport(bounds: Rect, size: Size, paddingPx = 8): Viewport {
  const w = Math.max(1, size.width - 2 * paddingPx);
  const h = Math.max(1, size.height - 2 * paddingPx);
  const s0 = Math.min(w / bounds.w, h / bounds.h);
  const s90 = Math.min(w / bounds.h, h / bounds.w);
  // Prefer landscape unless rotating gains a clear margin (avoids flipping near square).
  const rotation: 0 | 90 = s90 > s0 * 1.05 ? 90 : 0;
  const scale = rotation === 90 ? s90 : s0;
  const centre = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  const base: Viewport = { scale, offsetX: 0, offsetY: 0, rotation };
  const c = rinkToScreen(centre, base);
  return { ...base, offsetX: size.width / 2 - c.x, offsetY: size.height / 2 - c.y };
}

export const MIN_ZOOM_FACTOR = 0.5;
export const MAX_ZOOM_FACTOR = 6;

/** Zoom by `factor` keeping the screen point `anchor` fixed. */
export function zoomAt(vp: Viewport, anchor: Vec, factor: number, fitScale: number): Viewport {
  const scale = Math.min(
    fitScale * MAX_ZOOM_FACTOR,
    Math.max(fitScale * MIN_ZOOM_FACTOR, vp.scale * factor),
  );
  const rinkPt = screenToRink(anchor, vp);
  const next: Viewport = { ...vp, scale };
  const moved = rinkToScreen(rinkPt, next);
  return {
    ...next,
    offsetX: vp.offsetX + anchor.x - moved.x,
    offsetY: vp.offsetY + anchor.y - moved.y,
  };
}

export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { ...vp, offsetX: vp.offsetX + dx, offsetY: vp.offsetY + dy };
}

/** Screen-space bounding box of a rink rectangle. */
export function rectToScreen(
  r: Rect,
  vp: Viewport,
): { x: number; y: number; w: number; h: number } {
  const a = rinkToScreen({ x: r.x, y: r.y }, vp);
  const b = rinkToScreen({ x: r.x + r.w, y: r.y + r.h }, vp);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}
