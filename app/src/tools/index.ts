import type { ToolId } from '../store/toolStore';
import { eraserTool } from './eraser';
import { arrowTool, lineTool } from './line';
import { penTool } from './pen';
import { textTool } from './text';
import type { Tool } from './types';
import { zoneTool } from './zone';

/**
 * One module per tool. `select` has no gesture here: selecting, dragging and box-select
 * are handled by the entity layer and the stage (board/BoardStage.tsx).
 */
export const TOOLS: Record<Exclude<ToolId, 'select'>, Tool> = {
  pen: penTool,
  line: lineTool,
  arrow: arrowTool,
  zone: zoneTool,
  text: textTool,
  eraser: eraserTool,
};

export const TOOL_LABELS: Record<ToolId, string> = {
  select: 'Select',
  pen: 'Pen',
  line: 'Line',
  arrow: 'Arrow',
  zone: 'Zone',
  text: 'Text',
  eraser: 'Eraser',
};
