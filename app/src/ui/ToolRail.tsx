import { useBoardStore } from '../store/boardStore';
import { useToolStore, type ToolId } from '../store/toolStore';
import { TOOL_LABELS } from '../tools';
import { Icon } from './icons';

const TOOL_ORDER: ToolId[] = ['select', 'pen', 'line', 'arrow', 'zone', 'text', 'eraser'];

/** Drawing tools plus undo/redo. A column at the left edge in landscape (thumb reach). */
export function ToolRail() {
  const tool = useToolStore((s) => s.tool);
  const setTool = useToolStore((s) => s.setTool);
  const canUndo = useBoardStore((s) => s.history.past.length > 0);
  const canRedo = useBoardStore((s) => s.history.future.length > 0);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);

  return (
    <nav className="rail tools-rail" role="toolbar" aria-label="Drawing tools">
      {TOOL_ORDER.map((id) => (
        <button
          key={id}
          className="rail-btn"
          data-testid={`tool-${id}`}
          aria-pressed={tool === id}
          onClick={() => setTool(id)}
        >
          <Icon name={id} />
          <span>{TOOL_LABELS[id]}</span>
        </button>
      ))}
      <span className="rail-gap" />
      <button
        className="rail-btn"
        data-testid="undo"
        disabled={!canUndo}
        onClick={undo}
        title="Undo (Ctrl+Z)"
      >
        <Icon name="undo" />
        <span>Undo</span>
      </button>
      <button
        className="rail-btn"
        data-testid="redo"
        disabled={!canRedo}
        onClick={redo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Icon name="redo" />
        <span>Redo</span>
      </button>
    </nav>
  );
}
