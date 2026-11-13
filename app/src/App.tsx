import { useEffect, useState } from 'react';
import { BoardStage } from './board/BoardStage';
import { useBoardStore } from './store/boardStore';
import { useToolStore, type ToolId } from './store/toolStore';
import { DrawBar } from './ui/DrawBar';
import { Inspector } from './ui/Inspector';
import { Toolbar } from './ui/Toolbar';

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  p: 'pen',
  l: 'line',
  a: 'arrow',
  z: 'zone',
  t: 'text',
  e: 'eraser',
};

export function App() {
  const [fitSignal, setFitSignal] = useState(0);

  useEffect(() => {
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
  }, []);

  return (
    <div className="app">
      <Toolbar onFit={() => setFitSignal((n) => n + 1)} />
      <DrawBar />
      <main className="board-area">
        <BoardStage fitSignal={fitSignal} />
      </main>
      <Inspector />
    </div>
  );
}
