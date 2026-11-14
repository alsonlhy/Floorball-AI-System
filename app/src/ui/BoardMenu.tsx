import { useEffect, useRef, useState } from 'react';
import { canvasToBlob, captureView } from '../board/snapshot';
import { CUSTOM_LIMITS, presetOf, RINK_PRESETS, type RinkPresetId } from '../model/rink';
import type { RinkView } from '../model/types';
import { fileNameFor, getFiles } from '../platform/files';
import { useBoardStore } from '../store/boardStore';
import { exportBoard } from '../store/library';

/**
 * Settings that are set once per board rather than used every few seconds: rink size and view,
 * team colours, export, clear drawings. Kept in a menu so the board gets the screen.
 */
export function BoardMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a tap anywhere else (the tap still reaches the board) or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu-anchor" ref={ref}>
      <button
        data-testid="board-menu"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        Board ▾
      </button>
      {open && <BoardMenuPanel />}
    </div>
  );
}

function BoardMenuPanel() {
  const rink = useBoardStore((s) => s.board.rink);
  const teamColors = useBoardStore((s) => s.board.teamColors);
  const hasDrawings = useBoardStore((s) => s.board.drawings.length > 0);
  const setView = useBoardStore((s) => s.setView);
  const setRinkSize = useBoardStore((s) => s.setRinkSize);
  const setTeamColor = useBoardStore((s) => s.setTeamColor);
  const clearDrawings = useBoardStore((s) => s.clearDrawings);
  const preset = presetOf(rink);
  const [customOpen, setCustomOpen] = useState(false);

  const onPreset = (id: RinkPresetId) => {
    if (id === 'custom') return setCustomOpen(true);
    setCustomOpen(false);
    setRinkSize(RINK_PRESETS[id].lengthM, RINK_PRESETS[id].widthM);
  };

  const exportPng = async () => {
    const canvas = captureView(2);
    if (!canvas) return;
    const name = useBoardStore.getState().board.name;
    await getFiles().save(fileNameFor(name, 'png'), await canvasToBlob(canvas));
  };

  return (
    <div className="menu-panel" role="menu" data-testid="board-menu-panel">
      <section>
        <h3>Rink</h3>
        <label className="field">
          Size
          <select
            data-testid="rink-preset"
            value={customOpen ? 'custom' : preset}
            onChange={(e) => onPreset(e.target.value as RinkPresetId)}
          >
            <option value="full">Full 40×20</option>
            <option value="minimum">Minimum 36×18</option>
            <option value="custom">Custom…</option>
          </select>
        </label>
        {(customOpen || preset === 'custom') && (
          <CustomSize
            lengthM={rink.lengthM}
            widthM={rink.widthM}
            onApply={(l, w) => setRinkSize(l, w)}
          />
        )}
        <label className="field">
          View
          <select
            data-testid="rink-view"
            value={rink.view}
            onChange={(e) => setView(e.target.value as RinkView)}
          >
            <option value="full">Full rink</option>
            <option value="half-left">Left half</option>
            <option value="half-right">Right half</option>
          </select>
        </label>
      </section>
      <section>
        <h3>Team colours</h3>
        <label className="field color">
          Home
          <input
            type="color"
            data-testid="home-color"
            value={teamColors.home}
            onChange={(e) => setTeamColor('home', e.target.value)}
          />
        </label>
        <label className="field color">
          Away
          <input
            type="color"
            data-testid="away-color"
            value={teamColors.away}
            onChange={(e) => setTeamColor('away', e.target.value)}
          />
        </label>
      </section>
      <section>
        <h3>Share</h3>
        <button
          data-testid="export-json"
          title="Save this board as a .json file"
          onClick={() => void exportBoard(getFiles(), useBoardStore.getState().board)}
        >
          Export board
        </button>
        <button
          data-testid="export-png"
          title="Save the current view as a picture"
          onClick={exportPng}
        >
          Save picture (PNG)
        </button>
      </section>
      <section>
        <button
          data-testid="clear-drawings"
          className="danger"
          disabled={!hasDrawings}
          onClick={clearDrawings}
          title="Remove all drawings; players stay"
        >
          Clear drawings
        </button>
      </section>
    </div>
  );
}

function CustomSize(props: {
  lengthM: number;
  widthM: number;
  onApply(l: number, w: number): void;
}) {
  const [l, setL] = useState(String(props.lengthM));
  const [w, setW] = useState(String(props.widthM));
  return (
    <form
      className="custom-size"
      onSubmit={(e) => {
        e.preventDefault();
        props.onApply(Number(l), Number(w));
      }}
    >
      <input
        data-testid="custom-length"
        aria-label="Length in metres"
        type="number"
        inputMode="decimal"
        min={CUSTOM_LIMITS.minLengthM}
        max={CUSTOM_LIMITS.maxLengthM}
        step={0.5}
        value={l}
        onChange={(e) => setL(e.target.value)}
      />
      ×
      <input
        data-testid="custom-width"
        aria-label="Width in metres"
        type="number"
        inputMode="decimal"
        min={CUSTOM_LIMITS.minWidthM}
        max={CUSTOM_LIMITS.maxWidthM}
        step={0.5}
        value={w}
        onChange={(e) => setW(e.target.value)}
      />
      m
      <button type="submit" data-testid="custom-apply">
        Set
      </button>
    </form>
  );
}
