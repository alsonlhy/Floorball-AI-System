import type { BoardState } from '../store/boardStore';
import type { ToolState } from '../store/toolStore';
import type { Board, Vec } from '../model/types';

/** What a tool can see and do. Points are already in rink metres (Rule 1). */
export interface ToolContext {
  /** Store actions (stable functions). Read the live board through getBoard. */
  board: BoardState;
  getBoard(): Board;
  tools: ToolState;
  /** Pixels per metre at the moment, for screen-sized tolerances. */
  scale: number;
}

/** One pointer gesture of a tool, from pointer-down to pointer-up. */
export interface ToolGesture {
  move(p: Vec, pressure?: number): void;
  end(): void;
  /** A second finger landed: abandon without committing. */
  cancel(): void;
}

export interface Tool {
  id: string;
  begin(ctx: ToolContext, p: Vec, pressure?: number): ToolGesture | null;
}
