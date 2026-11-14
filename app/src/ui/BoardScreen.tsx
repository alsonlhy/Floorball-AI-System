import { useEffect, useRef, useState } from 'react';
import { BoardStage } from '../board/BoardStage';
import { captureThumbnail } from '../board/snapshot';
import { getRepository } from '../platform/storage';
import { startAutosave, useSaveStatus, type Autosave } from '../store/autosave';
import { useBoardStore } from '../store/boardStore';
import { useToolStore, type ToolId } from '../store/toolStore';
import {
  goToFrame,
  pause,
  resetPlayback,
  stepBy,
  togglePlay,
  usePlayback,
} from '../store/playback';
import { BoardMenu } from './BoardMenu';
import { Inspector } from './Inspector';
import { PieceRail } from './PieceRail';
import { navigate } from './router';
import { StyleStrip } from './StyleStrip';
import { Timeline } from './Timeline';
import { ToolRail } from './ToolRail';

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  p: 'pen',
  l: 'line',
  a: 'arrow',
  z: 'zone',
  t: 'text',
  e: 'eraser',
};

type Load = 'loading' | 'ready' | 'missing' | { error: string };

/** One board, loaded from storage and autosaved back to it. */
export function BoardScreen({ id }: { id: string }) {
  const [fitSignal, setFitSignal] = useState(0);
  const [load, setLoad] = useState<Load>(() =>
    useBoardStore.getState().board.id === id ? 'ready' : 'loading',
  );
  const autosave = useRef<Autosave | null>(null);
  const presentingRef = useRef(false);
  const playing = usePlayback((p) => p.playing);
  const [presenting, setPresenting] = useState(false);

  // Each board opens stopped on its first step.
  useEffect(() => {
    resetPlayback();
    return resetPlayback;
  }, []);

  // Load the board, unless it is already in the store (just created). The screen is keyed
  // by id, so this runs once per board.
  useEffect(() => {
    if (useBoardStore.getState().board.id === id) return;
    let live = true;
    getRepository()
      .get(id)
      .then((b) => {
        if (!live) return;
        if (!b) return setLoad('missing');
        useBoardStore.getState().reset(b);
        useToolStore.getState().setTool('select');
        setLoad('ready');
      })
      .catch(
        (e: unknown) => live && setLoad({ error: e instanceof Error ? e.message : String(e) }),
      );
    return () => {
      live = false;
    };
  }, [id]);

  // Autosave while this board is open.
  useEffect(() => {
    if (load !== 'ready') return;
    const a = startAutosave({ repo: getRepository(), thumbnail: () => captureThumbnail() });
    autosave.current = a;
    // First visit: store a thumbnail once the stage has drawn.
    const t = setTimeout(() => {
      const thumb = captureThumbnail();
      if (thumb) void getRepository().put(useBoardStore.getState().board, thumb);
    }, 400);
    return () => {
      clearTimeout(t);
      autosave.current = null;
      void a.stop();
    };
  }, [load]);

  // Keyboard shortcuts.
  useEffect(() => {
    if (load !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'))
        return;
      const s = useBoardStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (e.key === 'Escape' && presentingRef.current) {
        setPresenting(false);
        return;
      }
      if (e.key === ' ' && !mod) {
        e.preventDefault();
        togglePlay();
        return;
      }
      // Nothing is edited while a drill plays (PLAN.md M5).
      if (usePlayback.getState().playing) {
        if (e.key === 'Escape') pause();
        return;
      }
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.length > 0) {
        e.preventDefault();
        s.deleteEntities(s.selection);
      } else if (e.key === 'Escape') {
        s.select([]);
        useToolStore.getState().setTool('select');
      } else if (!mod && !e.altKey && TOOL_KEYS[key]) {
        useToolStore.getState().setTool(TOOL_KEYS[key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [load]);

  if (load !== 'ready') {
    return (
      <div className="screen-message" data-testid="board-loading">
        {load === 'loading' && <p>Opening board…</p>}
        {load === 'missing' && <p>That board is not on this device.</p>}
        {typeof load === 'object' && <p role="alert">Could not open the board: {load.error}</p>}
        {load !== 'loading' && <button onClick={() => navigate('#/')}>Back to boards</button>}
      </div>
    );
  }

  const back = async () => {
    await autosave.current?.flush();
    navigate('#/');
  };

  const present = (on: boolean) => {
    presentingRef.current = on;
    setPresenting(on);
    if (on) {
      useToolStore.getState().setTool('select');
      useBoardStore.getState().select([]);
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  };

  return (
    <div
      className={`board-screen${presenting ? ' presenting' : ''}`}
      data-testid="board-screen"
      data-presenting={presenting}
    >
      {/* Disabled fieldsets turn every control inside off while the drill plays. */}
      <fieldset className="bars" disabled={playing}>
        <TopBar onBack={back} onPresent={() => present(true)} />
        <ToolRail />
        <PieceRail />
      </fieldset>
      <main className="board-area">
        <BoardStage fitSignal={fitSignal} />
        {!presenting && (
          <fieldset className="bars" disabled={playing}>
            <StyleStrip />
            <Inspector />
          </fieldset>
        )}
        <button
          className="fit-btn"
          data-testid="fit"
          title="Fit the rink to the screen"
          onClick={() => setFitSignal((n) => n + 1)}
        >
          Fit
        </button>
        {presenting && <PresentControls onExit={() => present(false)} />}
      </main>
      <Timeline />
    </div>
  );
}

function enterFullscreen() {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  try {
    const r = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.();
    if (r instanceof Promise) r.catch(() => undefined);
  } catch {
    // Not available (e.g. iPhone Safari): presentation still hides the toolbars.
  }
}

function exitFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}

/** Presentation mode: just the board, play controls if it is a drill, and a way out. */
function PresentControls({ onExit }: { onExit(): void }) {
  const frames = useBoardStore((s) => s.board.frames.length);
  const frameIndex = useBoardStore((s) => s.frameIndex);
  const playing = usePlayback((p) => p.playing);
  return (
    <div className="float-strip present-controls" role="toolbar" aria-label="Presentation">
      {frames > 1 && (
        <>
          <button aria-label="Previous step" onClick={() => stepBy(-1)}>
            ⏮
          </button>
          <button
            data-testid="present-play"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={togglePlay}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button aria-label="Next step" onClick={() => stepBy(1)}>
            ⏭
          </button>
          <button aria-label="Back to step 1" onClick={() => goToFrame(0)}>
            {frameIndex + 1}/{frames}
          </button>
        </>
      )}
      <button data-testid="exit-present" onClick={onExit}>
        Done
      </button>
    </div>
  );
}

function TopBar({ onBack, onPresent }: { onBack(): void; onPresent(): void }) {
  const name = useBoardStore((s) => s.board.name);
  const setName = useBoardStore((s) => s.setName);
  const status = useSaveStatus((s) => s.status);
  const error = useSaveStatus((s) => s.error);
  const label = { saved: 'Saved', pending: 'Saving…', saving: 'Saving…', error: 'Not saved' }[
    status
  ];

  return (
    <header className="topbar">
      <button data-testid="back-to-library" onClick={onBack} title="All boards">
        ‹ Boards
      </button>
      <input
        className="board-name"
        data-testid="board-name"
        aria-label="Board name"
        value={name}
        maxLength={120}
        placeholder="Board name"
        onChange={(e) => setName(e.target.value)}
      />
      <span
        className={`save-status ${status}`}
        data-testid="save-status"
        data-status={status}
        title={error}
        role={status === 'error' ? 'alert' : undefined}
      >
        {label}
      </span>
      <span className="spacer" />
      <button data-testid="present" onClick={onPresent} title="Show only the board">
        Present
      </button>
      <BoardMenu />
    </header>
  );
}
