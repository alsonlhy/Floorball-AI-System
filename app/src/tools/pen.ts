import { thinPoints } from '../model/drawing';
import type { Vec } from '../model/types';
import { baseStyle } from './style';
import type { Tool } from './types';

/** Freehand stroke; pressure is kept when the device reports it (Apple Pencil). */
export const penTool: Tool = {
  id: 'pen',
  begin(ctx, p, pressure) {
    const style = baseStyle(ctx);
    const points: Vec[] = [p];
    const pressures: number[] = [pressure ?? 0.5];
    const hasPressure = pressure !== undefined;
    const minStep = Math.max(0.02, 1.5 / ctx.scale);
    const show = () =>
      ctx.tools.setDraft({
        tool: 'pen',
        points: [...points],
        ...(hasPressure ? { pressures: [...pressures] } : {}),
        style,
      });
    show();
    return {
      move(q, pr) {
        points.push(q);
        pressures.push(pr ?? 0.5);
        show();
      },
      end() {
        ctx.tools.setDraft(null);
        const thin = thinPoints(points, minStep, hasPressure ? pressures : undefined);
        ctx.board.addDrawing({
          tool: 'pen',
          points: thin.points,
          ...(thin.pressures ? { pressures: thin.pressures } : {}),
          style,
        });
      },
      cancel() {
        ctx.tools.setDraft(null);
      },
    };
  },
};
