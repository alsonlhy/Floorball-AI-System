// Pictures of the board: library thumbnails and "export view as PNG". The stage on screen
// registers itself here so code outside React can capture it.

import type Konva from 'konva';
import { viewBounds } from '../model/rink';
import type { RinkSpec } from '../model/types';
import { rectToScreen, type Viewport } from './viewport';

interface Live {
  stage: Konva.Stage;
  vp: Viewport;
  rink: RinkSpec;
}

let live: Live | null = null;

export function registerStage(l: Live | null): void {
  live = l;
}

/** The stage on screen (debug hooks and tests). */
export const liveStage = () => live?.stage ?? null;

export const BOARD_BACKGROUND = '#cfd8e1';

function compose(src: HTMLCanvasElement, background: string): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0);
  return out;
}

/** The current view exactly as on screen, at `pixelRatio` (default 2 for sharp prints). */
export function captureView(pixelRatio = 2): HTMLCanvasElement | null {
  if (!live) return null;
  const src = live.stage.toCanvas({ pixelRatio });
  return compose(src, BOARD_BACKGROUND);
}

/** A small picture of the rink area for the library (fit to ~`widthPx` wide). */
export function captureThumbnail(widthPx = 320): string | undefined {
  if (!live) return undefined;
  const { stage, vp, rink } = live;
  const r = rectToScreen(viewBounds(rink), vp);
  // Clip to what is on the stage (the coach may be zoomed in).
  const x = Math.max(0, r.x);
  const y = Math.max(0, r.y);
  const w = Math.min(stage.width(), r.x + r.w) - x;
  const h = Math.min(stage.height(), r.y + r.h) - y;
  if (w < 10 || h < 10) return undefined;
  const pixelRatio = Math.min(1, widthPx / Math.max(w, h));
  const src = stage.toCanvas({ x, y, width: w, height: h, pixelRatio });
  return compose(src, BOARD_BACKGROUND).toDataURL('image/png');
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not create the image'))),
      'image/png',
    ),
  );
}
