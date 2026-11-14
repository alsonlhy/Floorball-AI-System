import { beforeEach, describe, expect, it } from 'vitest';
import { ease, KeyframeTrackSource } from '../model/keyframeTrackSource';
import type { Entity, Frame } from '../model/types';
import { useBoardStore } from './boardStore';
import {
  advance,
  displayTime,
  goToFrame,
  pause,
  play,
  resetPlayback,
  scrub,
  setLoop,
  setSpeed,
  stepBy,
  usePlayback,
} from './playback';

const bs = () => useBoardStore.getState();
const pb = () => usePlayback.getState();

describe('KeyframeTrackSource interpolation (Rule 2)', () => {
  const entities: Entity[] = [
    { id: 'a', kind: 'player' },
    { id: 'late', kind: 'player' },
  ];
  const frames: Frame[] = [
    { id: 'f0', durationMs: 1000, positions: { a: { x: 0, y: 0 } } },
    { id: 'f1', durationMs: 2000, positions: { a: { x: 10, y: 0 }, late: { x: 5, y: 5 } } },
    { id: 'f2', durationMs: 1000, positions: { a: { x: 10, y: -8 }, late: { x: 5, y: -5 } } },
  ];
  const src = new KeyframeTrackSource(entities, frames);
  const at = (t: number, id = 'a') => src.stateAt(t).get(id)?.pos;

  it('lasts the sum of all but the last step', () => {
    expect(src.durationMs).toBe(3000);
    expect([0, 1, 2].map((i) => src.frameTime(i))).toEqual([0, 1000, 3000]);
  });

  it('is exactly on each keyframe at frame boundaries', () => {
    expect(at(0)).toEqual({ x: 0, y: 0 });
    expect(at(1000)).toEqual({ x: 10, y: 0 });
    expect(at(3000)).toEqual({ x: 10, y: -8 });
    // and clamps outside the drill
    expect(at(-50)).toEqual({ x: 0, y: 0 });
    expect(at(99_999)).toEqual({ x: 10, y: -8 });
  });

  it('is halfway at the midpoint of each move (eased, symmetric)', () => {
    expect(at(500)).toEqual({ x: 5, y: 0 });
    expect(at(2000)).toEqual({ x: 10, y: -4 }); // 2 s move: midpoint at 1000 + 1000
  });

  it('eases in and out', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBe(0.5);
    // slower than linear near the ends
    expect(at(100)!.x).toBeLessThan(1);
    expect(at(900)!.x).toBeGreaterThan(9);
  });

  it('shows a piece added in a later step only from that step', () => {
    expect(at(0, 'late')).toBeUndefined();
    expect(at(999, 'late')).toBeUndefined();
    expect(at(1000, 'late')).toEqual({ x: 5, y: 5 });
    expect(at(2000, 'late')).toEqual({ x: 5, y: 0 });
  });

  it('finds the step at, and nearest to, a time', () => {
    expect(src.frameIndexAt(0)).toBe(0);
    expect(src.frameIndexAt(999)).toBe(0);
    expect(src.frameIndexAt(1000)).toBe(1);
    expect(src.frameIndexAt(3000)).toBe(2);
    expect(src.nearestFrameIndex(400)).toBe(0);
    expect(src.nearestFrameIndex(600)).toBe(1);
    expect(src.nearestFrameIndex(2100)).toBe(2);
  });
});

/** Three-step drill: player moves right, then up. */
function threeStepDrill() {
  bs().reset();
  const id = bs().addEntity('player', 'home');
  bs().moveEntities({ [id]: { x: 0, y: 0 } });
  bs().addFrame();
  bs().moveEntities({ [id]: { x: 10, y: 0 } });
  bs().addFrame();
  bs().moveEntities({ [id]: { x: 10, y: -8 } });
  goToFrame(0);
  return id;
}

describe('steps in the board store', () => {
  beforeEach(() => {
    resetPlayback();
    bs().reset();
  });

  it('adding a step copies the current positions and selects it; it is one undo step', () => {
    const id = bs().addEntity('player', 'home');
    bs().addFrame();
    expect(bs().board.frames).toHaveLength(2);
    expect(bs().frameIndex).toBe(1);
    expect(bs().board.frames[1]!.positions).toEqual(bs().board.frames[0]!.positions);
    bs().moveEntities({ [id]: { x: 3, y: 3 } });
    expect(bs().board.frames[0]!.positions[id]).not.toEqual({ x: 3, y: 3 }); // only step 2 moved
    bs().undo();
    bs().undo();
    expect(bs().board.frames).toHaveLength(1);
    expect(bs().frameIndex).toBe(0); // clamped after undo
  });

  it('a piece added at a later step is on that step and the ones after it', () => {
    bs().addFrame();
    bs().addFrame();
    bs().selectFrame(1);
    const id = bs().addEntity('cone');
    expect(bs().board.frames.map((f) => id in f.positions)).toEqual([false, true, true]);
  });

  it('deleting a step removes drawings pinned to it', () => {
    bs().addFrame();
    const f1 = bs().board.frames[1]!.id;
    const line = {
      tool: 'line' as const,
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    };
    bs().addDrawing({ ...line, style: { color: '#000', widthM: 0.1 }, frameId: f1 });
    bs().addDrawing({ ...line, style: { color: '#000', widthM: 0.1 } });
    bs().deleteFrame(1);
    expect(bs().board.frames).toHaveLength(1);
    expect(bs().board.drawings).toHaveLength(1);
    expect(bs().board.drawings[0]!.frameId).toBeUndefined();
    bs().deleteFrame(0); // the last step cannot be deleted
    expect(bs().board.frames).toHaveLength(1);
  });

  it('clamps step durations', () => {
    bs().addFrame();
    bs().setFrameDuration(0, 5);
    expect(bs().board.frames[0]!.durationMs).toBe(200);
  });
});

describe('playback', () => {
  beforeEach(() => {
    resetPlayback();
    setSpeed(1);
    setLoop(false);
  });

  it('plays, pauses mid-way and resumes from the same time', () => {
    const id = threeStepDrill();
    play();
    expect(pb().playing).toBe(true);
    advance(700);
    pause();
    expect(pb().playing).toBe(false);
    expect(pb().pausedAt).toBe(700);
    expect(displayTime()).toBe(700);
    expect(bs().frameIndex).toBe(1); // editing goes to the nearest step

    play();
    expect(pb().playheadMs).toBe(700); // resumes where it paused
    advance(100);
    expect(pb().playheadMs).toBe(800);
    advance(10_000);
    expect(pb().playing).toBe(false);
    expect(pb().pausedAt).toBeNull(); // stopped exactly on the last step
    expect(bs().frameIndex).toBe(2);
    expect(bs().board.frames[2]!.positions[id]).toEqual({ x: 10, y: -8 });
  });

  it('speed scales time and loop wraps around', () => {
    threeStepDrill();
    setSpeed(2);
    setLoop(true);
    play();
    advance(400); // 800 ms of drill (drill lasts 1000 + 1000 ms)
    expect(pb().playheadMs).toBe(800);
    advance(700); // 2200 -> wraps to 200
    expect(pb().playing).toBe(true);
    expect(pb().playheadMs).toBe(200);
  });

  it('play at the end starts again from the top', () => {
    threeStepDrill();
    goToFrame(2);
    play();
    expect(pb().playheadMs).toBe(0);
  });

  it('cannot play a single step', () => {
    bs().reset();
    play();
    expect(pb().playing).toBe(false);
  });

  it('scrub pauses and shows that time; stepping lands on steps', () => {
    threeStepDrill();
    play();
    scrub(1400);
    expect(pb().playing).toBe(false);
    expect(pb().pausedAt).toBe(1400);
    stepBy(1);
    expect(pb().pausedAt).toBeNull();
    expect(bs().frameIndex).toBe(2);
    stepBy(-1);
    expect(bs().frameIndex).toBe(1);
    scrub(500);
    stepBy(-1);
    expect(bs().frameIndex).toBe(0);
  });

  it('an edit while paused between steps snaps to the nearest step', () => {
    const id = threeStepDrill();
    play();
    advance(900);
    pause();
    expect(pb().pausedAt).toBe(900);
    bs().moveEntities({ [id]: { x: 4, y: 4 } });
    expect(pb().pausedAt).toBeNull();
    expect(bs().board.frames[1]!.positions[id]).toEqual({ x: 4, y: 4 });
  });
});
