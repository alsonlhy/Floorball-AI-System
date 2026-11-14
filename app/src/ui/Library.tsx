import { useCallback, useEffect, useState } from 'react';
import { BoardValidationError } from '../model/validate';
import { getFiles } from '../platform/files';
import { getRepository, type BoardSummary } from '../platform/storage';
import {
  deleteStoredBoard,
  duplicateStoredBoard,
  exportBoard,
  importBoardFile,
  renameStoredBoard,
} from '../store/library';
import { whenSaved } from '../store/autosave';
import { Dialog, PromptDialog } from './Dialog';
import { boardHash, navigate } from './router';
import { editedAgo } from './time';

type Pending =
  { kind: 'rename'; board: BoardSummary } | { kind: 'delete'; board: BoardSummary } | null;

/** The board library: every saved board, most recently edited first. */
export function Library() {
  const repo = getRepository();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const refresh = useCallback(async () => setBoards(await repo.list()), [repo]);
  useEffect(() => {
    let live = true;
    // Wait for a board that was just closed to finish saving, so the list is current.
    void whenSaved()
      .then(() => repo.list())
      .then((b) => live && setBoards(b));
    return () => {
      live = false;
    };
  }, [repo]);

  const onImport = async () => {
    setMessage(null);
    const file = await getFiles().open('.json,application/json');
    if (!file) return;
    try {
      const b = await importBoardFile(repo, file);
      await refresh();
      setMessage({ text: `Imported "${b.name}".`, error: false });
    } catch (e) {
      const text =
        e instanceof BoardValidationError
          ? e.message
          : `Could not import that file (${e instanceof Error ? e.message : String(e)}).`;
      setMessage({ text, error: true });
    }
  };

  return (
    <div className="library" data-testid="library">
      <header className="library-head">
        <h1>Boards</h1>
        <div className="group">
          <button data-testid="open-sample" onClick={() => navigate('#/sample')}>
            Sample drill
          </button>
          <button data-testid="import-board" onClick={onImport}>
            Import…
          </button>
          <button data-testid="new-board" className="primary" onClick={() => navigate('#/new')}>
            + New board
          </button>
        </div>
      </header>

      {message && (
        <div
          className={`banner ${message.error ? 'error' : ''}`}
          role={message.error ? 'alert' : 'status'}
          data-testid="library-message"
        >
          <span>{message.text}</span>
          <button aria-label="Dismiss" onClick={() => setMessage(null)}>
            ✕
          </button>
        </div>
      )}

      {boards && boards.length === 0 && (
        <p className="empty">No boards yet. Start one with “New board”.</p>
      )}

      <ul className="board-grid">
        {boards?.map((b) => (
          <li key={b.id} className="board-card" data-testid="board-card" data-board-id={b.id}>
            <button
              className="thumb"
              data-testid="open-board"
              aria-label={`Open ${b.name}`}
              onClick={() => navigate(boardHash(b.id))}
            >
              {b.thumbnail ? (
                <img src={b.thumbnail} alt="" data-testid="board-thumb" />
              ) : (
                <span className="no-thumb">No preview yet</span>
              )}
            </button>
            <div className="card-meta">
              <span className="card-name" data-testid="board-name-label">
                {b.name || 'Untitled'}
              </span>
              <span className="card-time">Edited {editedAgo(b.updatedAt)}</span>
            </div>
            <div className="card-actions">
              <button
                data-testid="rename-board"
                onClick={() => setPending({ kind: 'rename', board: b })}
              >
                Rename
              </button>
              <button
                data-testid="duplicate-board"
                onClick={async () => {
                  await duplicateStoredBoard(repo, b.id, b.thumbnail);
                  await refresh();
                }}
              >
                Duplicate
              </button>
              <button
                data-testid="export-board"
                onClick={async () => {
                  const full = await repo.get(b.id);
                  if (full) await exportBoard(getFiles(), full);
                }}
              >
                Export
              </button>
              <button
                data-testid="delete-board"
                className="danger"
                onClick={() => setPending({ kind: 'delete', board: b })}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {pending?.kind === 'rename' && (
        <PromptDialog
          title="Rename board"
          initial={pending.board.name}
          confirmLabel="Rename"
          onCancel={() => setPending(null)}
          onConfirm={async (name) => {
            setPending(null);
            await renameStoredBoard(repo, pending.board.id, name);
            await refresh();
          }}
        />
      )}
      {pending?.kind === 'delete' && (
        <Dialog
          title={`Delete "${pending.board.name}"?`}
          confirmLabel="Delete"
          danger
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            setPending(null);
            await deleteStoredBoard(repo, pending.board.id);
            await refresh();
          }}
        >
          <p>This removes the board from this device. It cannot be undone.</p>
        </Dialog>
      )}
    </div>
  );
}
