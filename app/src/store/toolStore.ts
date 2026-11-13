import { create } from 'zustand';
import type { ArrowKind, WidthKey } from '../model/drawing';
import type { Drawing } from '../model/types';

export type ToolId = 'select' | 'pen' | 'line' | 'arrow' | 'zone' | 'text' | 'eraser';

/** UI-only state: which tool, its style, and the drawing in progress. Not saved, not undone. */
export interface ToolState {
  tool: ToolId;
  arrowKind: ArrowKind;
  zoneShape: 'rect' | 'ellipse';
  color: string;
  width: WidthKey;
  /** Set once a stylus is seen; from then on touch pans/zooms and only the pen draws. */
  penDetected: boolean;
  draft: Omit<Drawing, 'id'> | null;
  /** Where a text label is being typed (rink metres), if any. */
  textAt: { x: number; y: number } | null;

  setTool(t: ToolId): void;
  setArrowKind(k: ArrowKind): void;
  setZoneShape(s: 'rect' | 'ellipse'): void;
  setColor(c: string): void;
  setWidth(w: WidthKey): void;
  setPenDetected(v: boolean): void;
  setDraft(d: Omit<Drawing, 'id'> | null): void;
  setTextAt(p: { x: number; y: number } | null): void;
}

export const useToolStore = create<ToolState>()((set) => ({
  tool: 'select',
  arrowKind: 'run',
  zoneShape: 'rect',
  color: '#111827',
  width: 'medium',
  penDetected: false,
  draft: null,
  textAt: null,

  setTool: (tool) => set({ tool, draft: null, textAt: null }),
  setArrowKind: (arrowKind) => set({ arrowKind }),
  setZoneShape: (zoneShape) => set({ zoneShape }),
  setColor: (color) => set({ color }),
  setWidth: (width) => set({ width }),
  setPenDetected: (penDetected) => set({ penDetected }),
  setDraft: (draft) => set({ draft }),
  setTextAt: (textAt) => set({ textAt }),
}));
