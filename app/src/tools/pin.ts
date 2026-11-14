import type { Drawing } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { useToolStore } from '../store/toolStore';

/** Add a drawing, pinned to the current step when "This step only" is on (Rule 3). */
export function addDrawingHere(d: Omit<Drawing, 'id'>): string {
  const bs = useBoardStore.getState();
  const frameId = bs.board.frames[bs.frameIndex]?.id;
  const pin = useToolStore.getState().pinToStep && frameId !== undefined;
  return bs.addDrawing(pin ? { ...d, frameId } : d);
}
