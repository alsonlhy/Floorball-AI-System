import { ARROW_STYLES } from '../model/drawing';
import type { DrawingStyle, Vec } from '../model/types';
import { baseStyle, MIN_SHAPE_M } from './style';
import type { Tool, ToolContext } from './types';

function straight(tool: 'line' | 'arrow', styleOf: (ctx: ToolContext) => DrawingStyle): Tool {
  return {
    id: tool,
    begin(ctx, a) {
      const style = styleOf(ctx);
      let b: Vec = a;
      const show = () => ctx.tools.setDraft({ tool, points: [a, b], style });
      show();
      return {
        move(q) {
          b = q;
          show();
        },
        end() {
          ctx.tools.setDraft(null);
          if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_SHAPE_M) return; // a tap, not a line
          ctx.board.addDrawing({ tool, points: [a, b], style });
        },
        cancel() {
          ctx.tools.setDraft(null);
        },
      };
    },
  };
}

export const lineTool = straight('line', (ctx) => ({
  ...baseStyle(ctx),
  dash: 'solid',
  head: 'none',
}));

export const arrowTool = straight('arrow', (ctx) => ({
  ...baseStyle(ctx),
  ...ARROW_STYLES[ctx.tools.arrowKind],
}));
