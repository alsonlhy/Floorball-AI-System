// Rule 2: the renderer reads entity state through a TrackSource. Phase 2 interpolates
// between drill keyframes. Frame i is reached at the sum of the durations before it.

import type { Entity, EntityState, Frame, TrackSource, Vec } from './types';

export function ease(t: number): number {
  // smoothstep: zero velocity at both keyframes
  return t * t * (3 - 2 * t);
}

export class KeyframeTrackSource implements TrackSource {
  readonly durationMs: number;
  readonly entities: Entity[];
  private readonly frames: Frame[];
  private readonly starts: number[];

  constructor(entities: Entity[], frames: Frame[]) {
    this.entities = entities;
    this.frames = frames;
    this.starts = [];
    let t = 0;
    frames.forEach((f, i) => {
      this.starts.push(t);
      if (i < frames.length - 1) t += f.durationMs;
    });
    this.durationMs = t;
  }

  /** Start time of frame `index`. */
  frameTime(index: number): number {
    return this.starts[Math.max(0, Math.min(index, this.starts.length - 1))] ?? 0;
  }

  stateAt(tMs: number): Map<string, EntityState> {
    const out = new Map<string, EntityState>();
    const n = this.frames.length;
    if (n === 0) return out;
    const t = Math.max(0, Math.min(tMs, this.durationMs));
    let i = 0;
    while (i < n - 1 && (this.starts[i + 1] ?? Infinity) <= t) i++;
    const a = this.frames[i]!;
    const b = this.frames[i + 1];
    const span = b ? this.starts[i + 1]! - this.starts[i]! : 0;
    const k = b && span > 0 ? ease((t - this.starts[i]!) / span) : 0;

    for (const e of this.entities) {
      const pa = a.positions[e.id];
      if (!pa) continue; // not yet on the board at this frame
      const pb: Vec | undefined = b?.positions[e.id];
      const pos = pb ? { x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k } : pa;
      out.set(e.id, { pos, visible: true });
    }
    return out;
  }
}
