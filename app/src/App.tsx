import { useEffect, useState } from 'react';
import { BoardStage } from './board/BoardStage';
import { useBoardStore } from './store/boardStore';
import { Inspector } from './ui/Inspector';
import { Toolbar } from './ui/Toolbar';

export function App() {
  const [fitSignal, setFitSignal] = useState(0);

  // Delete / Backspace removes the selection, unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA'))
        return;
      const s = useBoardStore.getState();
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.length > 0) {
        e.preventDefault();
        s.deleteEntities(s.selection);
      } else if (e.key === 'Escape') {
        s.select([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <Toolbar onFit={() => setFitSignal((n) => n + 1)} />
      <main className="board-area">
        <BoardStage fitSignal={fitSignal} />
      </main>
      <Inspector />
    </div>
  );
}
