import { useEffect, useRef, useState } from 'react';
import type { Board } from './model/types';
import { getRepository, type BoardRepository } from './platform/storage';
import { sampleBoard } from './presets/sample';
import { useBoardStore } from './store/boardStore';
import { createStoredBoard } from './store/library';
import { BoardScreen } from './ui/BoardScreen';
import { Library } from './ui/Library';
import { boardHash, navigate, useRoute } from './ui/router';

export function App() {
  const route = useRoute();
  if (route.name === 'board') return <BoardScreen key={route.id} id={route.id} />;
  if (route.name === 'new') return <NewBoard create={createStoredBoard} />;
  if (route.name === 'sample') return <NewBoard key="sample" create={createSample} />;
  return <Library />;
}

async function createSample(repo: BoardRepository): Promise<Board> {
  const b = sampleBoard();
  await repo.put(b);
  return b;
}

/** #/new, #/sample: create a board, then replace the URL with its own so reload reopens it. */
function NewBoard({ create }: { create(repo: BoardRepository): Promise<Board> }) {
  const started = useRef(false); // StrictMode runs effects twice; create only once
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create(getRepository())
      .then((b) => {
        useBoardStore.getState().reset(b);
        navigate(boardHash(b.id), true);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [create]);
  return (
    <div className="screen-message">
      {error ? <p role="alert">Could not create a board: {error}</p> : <p>Creating board…</p>}
    </div>
  );
}
