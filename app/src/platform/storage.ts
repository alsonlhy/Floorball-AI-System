// Board storage behind a small interface (PLAN.md section 3: "storage and file export go through
// a thin adapter so the native builds can swap in Capacitor plugins"). The web build uses
// IndexedDB via Dexie; tests use the in-memory version.

import Dexie, { type Table } from 'dexie';
import { loadBoard } from '../model/migrate';
import type { Board } from '../model/types';

export interface BoardSummary {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  /** PNG data URL, if one has been captured. */
  thumbnail?: string;
}

export interface BoardRepository {
  /** All boards, most recently edited first. */
  list(): Promise<BoardSummary[]>;
  get(id: string): Promise<Board | undefined>;
  put(board: Board, thumbnail?: string): Promise<void>;
  delete(id: string): Promise<void>;
}

interface StoredThumb {
  id: string;
  dataUrl: string;
}

class FloorballDb extends Dexie {
  boards!: Table<Board, string>;
  thumbs!: Table<StoredThumb, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ boards: 'id, updatedAt', thumbs: 'id' });
  }
}

export class DexieBoardRepository implements BoardRepository {
  private db: FloorballDb;

  constructor(dbName = 'floorball-board') {
    this.db = new FloorballDb(dbName);
  }

  async list(): Promise<BoardSummary[]> {
    const [boards, thumbs] = await Promise.all([
      this.db.boards.orderBy('updatedAt').reverse().toArray(),
      this.db.thumbs.toArray(),
    ]);
    const byId = new Map(thumbs.map((t) => [t.id, t.dataUrl]));
    return boards.map((b) => summary(b, byId.get(b.id)));
  }

  async get(id: string): Promise<Board | undefined> {
    const raw = await this.db.boards.get(id);
    // Stored boards also go through migration, so older saves keep opening.
    return raw ? loadBoard(raw) : undefined;
  }

  async put(board: Board, thumbnail?: string): Promise<void> {
    await this.db.transaction('rw', this.db.boards, this.db.thumbs, async () => {
      await this.db.boards.put(board);
      if (thumbnail) await this.db.thumbs.put({ id: board.id, dataUrl: thumbnail });
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.boards, this.db.thumbs, async () => {
      await this.db.boards.delete(id);
      await this.db.thumbs.delete(id);
    });
  }
}

export class MemoryBoardRepository implements BoardRepository {
  private boards = new Map<string, Board>();
  private thumbs = new Map<string, string>();

  async list(): Promise<BoardSummary[]> {
    return [...this.boards.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((b) => summary(b, this.thumbs.get(b.id)));
  }
  async get(id: string) {
    const b = this.boards.get(id);
    return b ? structuredClone(b) : undefined;
  }
  async put(board: Board, thumbnail?: string) {
    this.boards.set(board.id, structuredClone(board));
    if (thumbnail) this.thumbs.set(board.id, thumbnail);
  }
  async delete(id: string) {
    this.boards.delete(id);
    this.thumbs.delete(id);
  }
}

function summary(b: Board, thumbnail?: string): BoardSummary {
  const s: BoardSummary = {
    id: b.id,
    name: b.name,
    updatedAt: b.updatedAt,
    createdAt: b.createdAt,
  };
  if (thumbnail) s.thumbnail = thumbnail;
  return s;
}

let repo: BoardRepository | null = null;

/** The app's repository. Replace with setRepository in tests or native builds. */
export function getRepository(): BoardRepository {
  repo ??= new DexieBoardRepository();
  return repo;
}

export function setRepository(r: BoardRepository): void {
  repo = r;
}
