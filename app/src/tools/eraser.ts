import { hitDrawing } from '../model/drawing';
import type { Vec } from '../model/types';
import type { Tool } from './types';

/** Removes whole drawings it touches. One sweep is one undo step. */
export const eraserTool: Tool = {
  id: 'eraser',
  begin(ctx, p) {
    const tol = Math.max(0.15, 12 / ctx.scale);
    ctx.board.beginGesture();
    let last = p;
    const eraseAt = (q: Vec) => {
      // Sample along the move so fast sweeps don't skip thin strokes.
      const steps = Math.max(1, Math.ceil(Math.hypot(q.x - last.x, q.y - last.y) / tol));
      const hits = new Set<string>();
      const drawings = ctx.getBoard().drawings;
      for (let i = 1; i <= steps; i++) {
        const s = {
          x: last.x + ((q.x - last.x) * i) / steps,
          y: last.y + ((q.y - last.y) * i) / steps,
        };
        for (const d of drawings) if (hitDrawing(d, s, tol)) hits.add(d.id);
      }
      last = q;
      if (hits.size) ctx.board.deleteDrawings([...hits]);
    };
    eraseAt(p);
    return {
      move: eraseAt,
      end: () => ctx.board.endGesture(),
      cancel: () => ctx.board.endGesture(),
    };
  },
};
