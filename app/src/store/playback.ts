// Drill playback (PLAN.md M5). UI state only: never saved, never on the undo stack.
//
// The board shows the state at `displayTime()`:
//   - playing:              the moving playhead
//   - paused between steps: where it was paused (`pausedAt`), so play resumes from there;
//                           editing then targets the nearest step, and the first edit snaps to it
//   - otherwise:            the start time of the current step (boardStore.frameIndex)

import { create } from 'zustand';
import { KeyframeTrackSource } from '../model/keyframeTrackSource';
import { useBoardStore } from './boardStore';

export const SPEEDS = [0.5, 1, 2] as const;
export type Speed = (typeof SPEEDS)[number];

export interface PlaybackState {
  playing: boolean;
  /** Playhead while playing (ms from the first step). */
  playheadMs: number;
  /** Set when paused between steps; null when the board sits exactly on a step. */
  pausedAt: number | null;
  speed: Speed;
  loop: boolean;
  /** Faint lines from each piece to where it goes in the next step. */
  trails: boolean;
}

export const usePlayback = create<PlaybackState>()(() => ({
  playing: false,
  playheadMs: 0,
  pausedAt: null,
  speed: 1,
  loop: false,
  trails: true,
}));

export function trackSource(): KeyframeTrackSource {
  const { board } = useBoardStore.getState();
  return new KeyframeTrackSource(board.entities, board.frames);
}

/** Time the board is showing. */
export function displayTime(
  p: Pick<PlaybackState, 'playing' | 'playheadMs' | 'pausedAt'> = usePlayback.getState(),
  source = trackSource(),
): number {
  if (p.playing) return p.playheadMs;
  if (p.pausedAt !== null) return p.pausedAt;
  return source.frameTime(useBoardStore.getState().frameIndex);
}

/** Can the board be edited right now? (Not while playing.) */
export const isEditable = () => !usePlayback.getState().playing;

// ---- transport ----

let raf: number | null = null;
let lastTs: number | null = null;

function loop(ts: number) {
  const dt = lastTs === null ? 0 : ts - lastTs;
  lastTs = ts;
  advance(dt);
  raf = usePlayback.getState().playing ? requestAnimationFrame(loop) : null;
}

export function play(): void {
  const source = trackSource();
  if (source.durationMs <= 0) return; // one step: nothing to play
  const p = usePlayback.getState();
  if (p.playing) return;
  let start = displayTime(p, source);
  if (start >= source.durationMs) start = 0; // at the end: play from the top
  usePlayback.setState({ playing: true, playheadMs: start, pausedAt: null });
  useBoardStore.getState().endGesture();
  useBoardStore.getState().select([]);
  lastTs = null;
  if (typeof requestAnimationFrame !== 'undefined' && raf === null) {
    raf = requestAnimationFrame(loop);
  }
}

/** Move the playhead on by `dtMs` of wall time (scaled by speed). Exposed for tests. */
export function advance(dtMs: number): void {
  const p = usePlayback.getState();
  if (!p.playing) return;
  const duration = trackSource().durationMs;
  let t = p.playheadMs + dtMs * p.speed;
  if (t >= duration) {
    if (p.loop && duration > 0) {
      t = t % duration;
    } else {
      usePlayback.setState({ playheadMs: duration });
      stopAt(duration);
      return;
    }
  }
  usePlayback.setState({ playheadMs: t });
}

/** Stop and leave the board at time t: on a step if t is one, otherwise paused between. */
function stopAt(t: number): void {
  const source = trackSource();
  const nearest = source.nearestFrameIndex(t);
  const onStep = Math.abs(source.frameTime(nearest) - t) < 0.5;
  usePlayback.setState({ playing: false, pausedAt: onStep ? null : t });
  useBoardStore.getState().selectFrame(nearest);
  if (raf !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
  raf = null;
}

export function pause(): void {
  const p = usePlayback.getState();
  if (!p.playing) return;
  stopAt(p.playheadMs);
}

export function togglePlay(): void {
  if (usePlayback.getState().playing) pause();
  else play();
}

/** Drag the scrubber: pauses and shows time t. */
export function scrub(tMs: number): void {
  const source = trackSource();
  const t = Math.max(0, Math.min(tMs, source.durationMs));
  if (usePlayback.getState().playing) usePlayback.setState({ playing: false });
  stopAt(t);
}

/** Go to a step (tap on the timeline, step buttons). */
export function goToFrame(index: number): void {
  if (usePlayback.getState().playing) pause();
  usePlayback.setState({ pausedAt: null });
  useBoardStore.getState().selectFrame(index);
}

export function stepBy(delta: -1 | 1): void {
  const p = usePlayback.getState();
  if (p.playing) pause();
  const source = trackSource();
  const { frameIndex } = useBoardStore.getState();
  const paused = usePlayback.getState().pausedAt;
  // From between two steps, "back" goes to the earlier one and "forward" to the later one.
  const base =
    paused !== null ? source.frameIndexAt(paused) + (delta > 0 ? 1 : 0) : frameIndex + delta;
  goToFrame(Math.max(0, Math.min(base, source.frameCount - 1)));
}

/** Pin the view to the editing step (first edit after pausing between steps). */
export function snapToFrame(): void {
  if (usePlayback.getState().pausedAt !== null) usePlayback.setState({ pausedAt: null });
}

export function setSpeed(speed: Speed) {
  usePlayback.setState({ speed });
}
export function setLoop(loop: boolean) {
  usePlayback.setState({ loop });
}
export function setTrails(trails: boolean) {
  usePlayback.setState({ trails });
}

/** Back to the first step, stopped (after loading another board). */
export function resetPlayback(): void {
  if (raf !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
  raf = null;
  usePlayback.setState({ playing: false, playheadMs: 0, pausedAt: null });
}

// Any edit while paused between steps applies to the nearest step and snaps the view there.
useBoardStore.subscribe((s, prev) => {
  if (s.board !== prev.board && usePlayback.getState().pausedAt !== null) snapToFrame();
});
