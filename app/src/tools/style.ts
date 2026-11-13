import { WIDTHS } from '../model/drawing';
import type { DrawingStyle } from '../model/types';
import type { ToolContext } from './types';

export function baseStyle(ctx: ToolContext): DrawingStyle {
  return { color: ctx.tools.color, widthM: WIDTHS[ctx.tools.width] };
}

export const MIN_SHAPE_M = 0.3;
