import type { EntityKind } from '../model/types';

/** Minimum touch target: 44 pt (CSS px) across, whatever the zoom. */
export const MIN_TOUCH_TARGET_PX = 44;

/** Drawn radius of a token in screen pixels; grows with zoom within limits. */
export function tokenRadiusPx(kind: EntityKind, scale: number): number {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  switch (kind) {
    case 'ball':
      return clamp(0.18 * scale, 5, 10);
    case 'cone':
      return clamp(0.3 * scale, 8, 16);
    default:
      return clamp(0.5 * scale, 13, 26);
  }
}
