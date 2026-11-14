import { useEffect, useRef, useState } from 'react';
import { getRepository } from './platform/storage';
import { useBoardStore } from './store/boardStore';
import { createStoredBoard } from './store/library';
import { BoardScreen } from './ui/BoardScreen';
import { Library } from './ui/Library';
import { boardHash, navigate, useRoute } from './ui/router';

export function App() {
  const route = useRoute();
  if (route.name === 'board') return <BoardScreen key={route.id} id={route.id} />;
  if (route.name === 'new') return <NewBoard />;
  return <Library />;
}

/** #/new: create a board, then replace the URL with the board's own so reload reopens it. */
function NewBoard() {
  const started = useRef(false); // StrictMode runs effects twice; create only once
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    createStoredBoard(getRepository())
      .then((b) => {
        useBoardStore.getState().reset(b);
        navigate(boardHash(b.id), true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return (
    <div className="screen-message">
      {error ? <p role="alert">Could not create a board: {error}</p> : <p>Creating board…</p>}
    </div>
  );
}
