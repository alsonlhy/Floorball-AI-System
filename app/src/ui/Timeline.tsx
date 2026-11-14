import { useMemo } from 'react';
import { KeyframeTrackSource } from '../model/keyframeTrackSource';
import { useBoardStore } from '../store/boardStore';
import {
  goToFrame,
  scrub,
  setLoop,
  setSpeed,
  setTrails,
  SPEEDS,
  stepBy,
  togglePlay,
  usePlayback,
  type Speed,
} from '../store/playback';

const DURATIONS = [500, 1000, 1500, 2000, 3000, 5000];

/** Drill steps and playback controls (PLAN.md M5). */
export function Timeline() {
  const frames = useBoardStore((s) => s.board.frames);
  const entities = useBoardStore((s) => s.board.entities);
  const frameIndex = useBoardStore((s) => s.frameIndex);
  const addFrame = useBoardStore((s) => s.addFrame);
  const deleteFrame = useBoardStore((s) => s.deleteFrame);
  const setFrameDuration = useBoardStore((s) => s.setFrameDuration);
  const { playing, playheadMs, pausedAt, speed, loop, trails } = usePlayback();

  const source = useMemo(() => new KeyframeTrackSource(entities, frames), [entities, frames]);
  const t = playing ? playheadMs : (pausedAt ?? source.frameTime(frameIndex));
  const active = playing || pausedAt !== null ? source.frameIndexAt(t) : frameIndex;
  const canPlay = frames.length > 1;
  const current = frames[frameIndex];
  const isLast = frameIndex === frames.length - 1;

  return (
    <div className="timeline" role="toolbar" aria-label="Drill steps" data-testid="timeline">
      <div className="group transport">
        <button
          data-testid="step-back"
          aria-label="Previous step"
          disabled={!canPlay}
          onClick={() => stepBy(-1)}
        >
          ⏮
        </button>
        <button
          data-testid="play"
          className="play"
          aria-label={playing ? 'Pause' : 'Play'}
          aria-pressed={playing}
          disabled={!canPlay}
          onClick={togglePlay}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <button
          data-testid="step-forward"
          aria-label="Next step"
          disabled={!canPlay}
          onClick={() => stepBy(1)}
        >
          ⏭
        </button>
      </div>

      <input
        className="scrubber"
        data-testid="scrubber"
        type="range"
        aria-label="Playback position"
        min={0}
        max={Math.max(1, source.durationMs)}
        step={10}
        value={t}
        disabled={!canPlay}
        onChange={(e) => scrub(Number(e.target.value))}
      />

      <div className="group steps" aria-label="Steps">
        {frames.map((f, i) => (
          <button
            key={f.id}
            className="step-chip"
            data-testid={`step-${i + 1}`}
            aria-label={`Step ${i + 1}`}
            aria-pressed={i === active}
            disabled={playing}
            onClick={() => goToFrame(i)}
          >
            {i + 1}
          </button>
        ))}
        <button
          data-testid="add-step"
          disabled={playing}
          title="Add a step: copies this step so you can move players for the next one"
          onClick={() => {
            goToFrame(frameIndex);
            addFrame();
          }}
        >
          + Step
        </button>
      </div>

      <div className="group">
        {current && !isLast && (
          <label className="field" title="How long the move to the next step takes">
            Move
            <select
              data-testid="step-duration"
              value={current.durationMs}
              disabled={playing}
              onChange={(e) => setFrameDuration(frameIndex, Number(e.target.value))}
            >
              {[...new Set([...DURATIONS, current.durationMs])]
                .sort((a, b) => a - b)
                .map((ms) => (
                  <option key={ms} value={ms}>
                    {ms / 1000} s
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="field">
          Speed
          <select
            data-testid="speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) as Speed)}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <button data-testid="loop" aria-pressed={loop} onClick={() => setLoop(!loop)}>
          Loop
        </button>
        <button data-testid="trails" aria-pressed={trails} onClick={() => setTrails(!trails)}>
          Trails
        </button>
        <button
          data-testid="delete-step"
          className="danger"
          disabled={playing || frames.length <= 1}
          onClick={() => {
            goToFrame(frameIndex);
            deleteFrame(frameIndex);
          }}
        >
          Delete step
        </button>
      </div>
    </div>
  );
}
