import { TEXT_SIZE_PER_WIDTH, WIDTHS } from '../model/drawing';
import type { Drawing, Vec } from '../model/types';
import type { Tool } from './types';

/**
 * Tap where the text goes; the board then shows an input there (see TextEntry). The input
 * opens on pointer-up so the tap's own mousedown cannot steal its focus.
 */
export const textTool: Tool = {
  id: 'text',
  begin(ctx, p) {
    return {
      move() {},
      end: () => ctx.tools.setTextAt(p),
      cancel() {},
    };
  },
};

export function commitText(
  addDrawing: (d: Omit<Drawing, 'id'>) => void,
  at: Vec,
  text: string,
  color: string,
  width: keyof typeof WIDTHS,
): void {
  const t = text.trim().slice(0, 60);
  if (!t) return;
  const widthM = WIDTHS[width];
  addDrawing({
    tool: 'text',
    points: [at],
    text: t,
    style: { color, widthM, fontSizeM: widthM * TEXT_SIZE_PER_WIDTH },
  });
}
