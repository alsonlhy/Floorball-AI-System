import { useState, type ReactNode } from 'react';
import { CUSTOM_LIMITS, presetOf, RINK_PRESETS, type RinkPresetId } from '../model/rink';
import type { RinkView } from '../model/types';
import { useBoardStore } from '../store/boardStore';

interface Props {
  onFit(): void;
  /** Leading controls (back to library, board name, export). */
  lead?: ReactNode;
}

export function Toolbar({ onFit, lead }: Props) {
  const rink = useBoardStore((s) => s.board.rink);
  const teamColors = useBoardStore((s) => s.board.teamColors);
  const addEntity = useBoardStore((s) => s.addEntity);
  const setView = useBoardStore((s) => s.setView);
  const setRinkSize = useBoardStore((s) => s.setRinkSize);
  const setTeamColor = useBoardStore((s) => s.setTeamColor);
  const preset = presetOf(rink);
  const [customOpen, setCustomOpen] = useState(false);

  const onPreset = (id: RinkPresetId) => {
    if (id === 'custom') {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    setRinkSize(RINK_PRESETS[id].lengthM, RINK_PRESETS[id].widthM);
  };

  return (
    <header className="toolbar" role="toolbar" aria-label="Board tools">
      {lead}
      <div className="group" aria-label="Add">
        <button
          data-testid="add-home-player"
          onClick={() => addEntity('player', 'home')}
          title="Add home player"
        >
          <span className="swatch round" style={{ background: teamColors.home }} /> Player
        </button>
        <button
          data-testid="add-away-player"
          onClick={() => addEntity('player', 'away')}
          title="Add away player"
        >
          <span className="swatch round" style={{ background: teamColors.away }} /> Player
        </button>
        <button
          data-testid="add-home-goalie"
          onClick={() => addEntity('goalie', 'home')}
          title="Add home goalie"
        >
          <span className="swatch" style={{ background: teamColors.home }} /> Goalie
        </button>
        <button
          data-testid="add-away-goalie"
          onClick={() => addEntity('goalie', 'away')}
          title="Add away goalie"
        >
          <span className="swatch" style={{ background: teamColors.away }} /> Goalie
        </button>
        <button data-testid="add-ball" onClick={() => addEntity('ball')} title="Add ball">
          <span className="swatch round ball" /> Ball
        </button>
        <button data-testid="add-cone" onClick={() => addEntity('cone')} title="Add cone">
          <span className="swatch cone" /> Cone
        </button>
      </div>

      <div className="group">
        <label className="field">
          Rink
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
        <button data-testid="fit" onClick={onFit} title="Fit rink to screen">
          Fit
        </button>
      </div>

      <div className="group">
        <label className="field color" title="Home team colour">
          Home
          <input
            type="color"
            data-testid="home-color"
            value={teamColors.home}
            onChange={(e) => setTeamColor('home', e.target.value)}
          />
        </label>
        <label className="field color" title="Away team colour">
          Away
          <input
            type="color"
            data-testid="away-color"
            value={teamColors.away}
            onChange={(e) => setTeamColor('away', e.target.value)}
          />
        </label>
      </div>
    </header>
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
