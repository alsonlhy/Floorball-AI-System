import { zoneFill } from '../model/drawing';
import type { Vec } from '../model/types';
import { baseStyle, MIN_SHAPE_M } from './style';
import type { Tool } from './types';

/** Rectangle or ellipse from corner to corner, with a translucent fill. */
export const zoneTool: Tool = {
  id: 'zone',
  begin(ctx, a) {
    const base = baseStyle(ctx);
    const style = { ...base, fill: zoneFill(base.color) };
    const shape = ctx.tools.zoneShape;
    let b: Vec = a;
    const show = () => ctx.tools.setDraft({ tool: 'zone', shape, points: [a, b], style });
    show();
    return {
      move(q) {
        b = q;
        show();
      },
      end() {
        ctx.tools.setDraft(null);
        if (Math.abs(b.x - a.x) < MIN_SHAPE_M || Math.abs(b.y - a.y) < MIN_SHAPE_M) return;
        ctx.board.addDrawing({ tool: 'zone', shape, points: [a, b], style });
      },
      cancel() {
        ctx.tools.setDraft(null);
      },
    };
  },
};
