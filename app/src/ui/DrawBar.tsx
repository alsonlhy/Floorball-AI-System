import { PALETTE, WIDTHS, type ArrowKind, type WidthKey } from '../model/drawing';
import { useBoardStore } from '../store/boardStore';
import { useToolStore, type ToolId } from '../store/toolStore';
import { TOOL_LABELS } from '../tools';

const TOOL_ORDER: ToolId[] = ['select', 'pen', 'line', 'arrow', 'zone', 'text', 'eraser'];
const ARROWS: { kind: ArrowKind; label: string; title: string }[] = [
  { kind: 'run', label: 'Run', title: 'Solid arrow: player run' },
  { kind: 'pass', label: 'Pass', title: 'Dashed arrow: pass' },
  { kind: 'shot', label: 'Shot', title: 'Double-line arrow: shot' },
];
const COLOR_NAMES: Record<string, string> = {
  '#111827': 'black',
  '#ffffff': 'white',
  '#dc2626': 'red',
  '#2563eb': 'blue',
  '#facc15': 'yellow',
  '#16a34a': 'green',
};

/** Drawing tools, their styles, undo/redo and clear. */
export function DrawBar() {
  const t = useToolStore();
  const canUndo = useBoardStore((s) => s.history.past.length > 0);
  const canRedo = useBoardStore((s) => s.history.future.length > 0);
  const hasDrawings = useBoardStore((s) => s.board.drawings.length > 0);
  const undo = useBoardStore((s) => s.undo);
  const redo = useBoardStore((s) => s.redo);
  const clearDrawings = useBoardStore((s) => s.clearDrawings);
  const styled = t.tool !== 'select' && t.tool !== 'eraser';

  return (
    <div className="toolbar drawbar" role="toolbar" aria-label="Drawing tools">
      <div className="group">
        {TOOL_ORDER.map((id) => (
          <button
            key={id}
            data-testid={`tool-${id}`}
            aria-pressed={t.tool === id}
            onClick={() => t.setTool(id)}
          >
            {TOOL_LABELS[id]}
          </button>
        ))}
      </div>

      {t.tool === 'arrow' && (
        <div className="group" aria-label="Arrow style">
          {ARROWS.map((a) => (
            <button
              key={a.kind}
              data-testid={`arrow-${a.kind}`}
              title={a.title}
              aria-pressed={t.arrowKind === a.kind}
              onClick={() => t.setArrowKind(a.kind)}
            >
              <ArrowIcon kind={a.kind} /> {a.label}
            </button>
          ))}
        </div>
      )}

      {t.tool === 'zone' && (
        <div className="group" aria-label="Zone shape">
          {(['rect', 'ellipse'] as const).map((shape) => (
            <button
              key={shape}
              data-testid={`zone-${shape}`}
              aria-pressed={t.zoneShape === shape}
              onClick={() => t.setZoneShape(shape)}
            >
              {shape === 'rect' ? 'Rectangle' : 'Ellipse'}
            </button>
          ))}
        </div>
      )}

      {/* Always laid out (hidden when unused) so the bar's height, and so the board's fit,
          does not change when switching tools under the coach's finger. */}
      <div
        className="group"
        aria-label="Colour and width"
        aria-hidden={!styled}
        style={styled ? undefined : { visibility: 'hidden' }}
      >
        {PALETTE.map((c) => (
          <button
            key={c}
            data-testid={`color-${COLOR_NAMES[c] ?? c}`}
            title={COLOR_NAMES[c] ?? c}
            aria-label={`Colour ${COLOR_NAMES[c] ?? c}`}
            aria-pressed={t.color === c}
            onClick={() => t.setColor(c)}
          >
            <span className="color-dot" style={{ background: c }} />
          </button>
        ))}
        {(Object.keys(WIDTHS) as WidthKey[]).map((w) => (
          <button
            key={w}
            data-testid={`width-${w}`}
            title={`${w} line`}
            aria-label={`${w} line`}
            aria-pressed={t.width === w}
            onClick={() => t.setWidth(w)}
          >
            <span className="width-bar" style={{ height: { thin: 2, medium: 4, thick: 7 }[w] }} />
          </button>
        ))}
      </div>

      <div className="group" style={{ marginLeft: 'auto' }}>
        {styled && (
          <button
            data-testid="pin-to-step"
            aria-pressed={t.pinToStep}
            onClick={() => t.setPinToStep(!t.pinToStep)}
            title="New drawings show on this step only, not on every step"
          >
            This step only
          </button>
        )}
        <button data-testid="undo" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button data-testid="redo" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </button>
        <button
          data-testid="clear-drawings"
          disabled={!hasDrawings}
          onClick={clearDrawings}
          title="Remove all drawings; players stay"
        >
          Clear drawings
        </button>
      </div>
    </div>
  );
}

function ArrowIcon({ kind }: { kind: ArrowKind }) {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
      {kind === 'shot' ? (
        <>
          <line x1="1" y1="3.5" x2="20" y2="3.5" stroke="currentColor" strokeWidth="1.6" />
          <line x1="1" y1="8.5" x2="20" y2="8.5" stroke="currentColor" strokeWidth="1.6" />
        </>
      ) : (
        <line
          x1="1"
          y1="6"
          x2="20"
          y2="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={kind === 'pass' ? '4 3' : undefined}
        />
      )}
      <path d="M19 1 L27 6 L19 11 Z" fill="currentColor" />
    </svg>
  );
}
