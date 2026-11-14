import { useEffect, useRef, useState } from 'react';
import { BoardStage } from '../board/BoardStage';
import { canvasToBlob, captureThumbnail, captureView } from '../board/snapshot';
import { fileNameFor, getFiles } from '../platform/files';
import { getRepository } from '../platform/storage';
import { startAutosave, useSaveStatus, type Autosave } from '../store/autosave';
import { useBoardStore } from '../store/boardStore';
import { exportBoard } from '../store/library';
import { useToolStore, type ToolId } from '../store/toolStore';
import { DrawBar } from './DrawBar';
import { Inspector } from './Inspector';
import { navigate } from './router';
import { Toolbar } from './Toolbar';

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

  return (
    <div className="app">
      <Toolbar onFit={() => setFitSignal((n) => n + 1)} lead={<BoardHeader onBack={back} />} />
      <DrawBar />
      <main className="board-area">
        <BoardStage fitSignal={fitSignal} />
      </main>
      <Inspector />
    </div>
  );
}

function BoardHeader({ onBack }: { onBack(): void }) {
  const name = useBoardStore((s) => s.board.name);
  const setName = useBoardStore((s) => s.setName);
  const status = useSaveStatus((s) => s.status);
  const error = useSaveStatus((s) => s.error);
  const label = { saved: 'Saved', pending: 'Saving…', saving: 'Saving…', error: 'Not saved' }[
    status
  ];

  const exportPng = async () => {
    const canvas = captureView(2);
    if (!canvas) return;
    await getFiles().save(fileNameFor(name, 'png'), await canvasToBlob(canvas));
  };

  return (
    <div className="group board-header">
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
      <button
        data-testid="export-json"
        title="Save this board as a .json file"
        onClick={() => void exportBoard(getFiles(), useBoardStore.getState().board)}
      >
        Export
      </button>
      <button
        data-testid="export-png"
        title="Save the current view as a picture"
        onClick={exportPng}
      >
        PNG
      </button>
    </div>
  );
}
