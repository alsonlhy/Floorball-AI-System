import { PALETTE, WIDTHS, type ArrowKind, type WidthKey } from '../model/drawing';
import { useToolStore } from '../store/toolStore';

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

/**
 * Options for the active drawing tool, floating over the top of the board. Floating (not a
 * toolbar row) so switching tools never resizes the board under the coach's finger.
 */
export function StyleStrip() {
  const t = useToolStore();
  if (t.tool === 'select' || t.tool === 'eraser') return null;

  return (
    <div className="float-strip style-strip" role="toolbar" aria-label="Drawing style">
      {t.tool === 'arrow' &&
        ARROWS.map((a) => (
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
      {t.tool === 'zone' &&
        (['rect', 'ellipse'] as const).map((shape) => (
          <button
            key={shape}
            data-testid={`zone-${shape}`}
            aria-pressed={t.zoneShape === shape}
            onClick={() => t.setZoneShape(shape)}
          >
            {shape === 'rect' ? 'Rectangle' : 'Ellipse'}
          </button>
        ))}
      {(t.tool === 'arrow' || t.tool === 'zone') && <span className="divider" />}
      {PALETTE.map((c) => (
        <button
          key={c}
          className="icon-btn"
          data-testid={`color-${COLOR_NAMES[c] ?? c}`}
          title={COLOR_NAMES[c] ?? c}
          aria-label={`Colour ${COLOR_NAMES[c] ?? c}`}
          aria-pressed={t.color === c}
          onClick={() => t.setColor(c)}
        >
          <span className="color-dot" style={{ background: c }} />
        </button>
      ))}
      <span className="divider" />
      {(Object.keys(WIDTHS) as WidthKey[]).map((w) => (
        <button
          key={w}
          className="icon-btn"
          data-testid={`width-${w}`}
          title={`${w} line`}
          aria-label={`${w} line`}
          aria-pressed={t.width === w}
          onClick={() => t.setWidth(w)}
        >
          <span className="width-bar" style={{ height: { thin: 2, medium: 4, thick: 7 }[w] }} />
        </button>
      ))}
      <span className="divider" />
      <button
        data-testid="pin-to-step"
        aria-pressed={t.pinToStep}
        onClick={() => t.setPinToStep(!t.pinToStep)}
        title="New drawings show on this step only, not on every step"
      >
        This step only
      </button>
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
