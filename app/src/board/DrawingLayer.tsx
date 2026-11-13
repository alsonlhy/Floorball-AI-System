import { getStroke } from 'perfect-freehand';
import { Arrow, Ellipse, Group, Layer, Line, Rect, Text } from 'react-konva';
import { boundsOf, TEXT_SIZE_PER_WIDTH } from '../model/drawing';
import type { Drawing } from '../model/types';
import { rinkToScreen, viewportGroupAttrs, type Viewport } from './viewport';

/** Rink surface colour, used to hollow out the "shot" double line. */
const SURFACE = '#f3f6f9';

interface Props {
  drawings: Drawing[];
  draft: Omit<Drawing, 'id'> | null;
  vp: Viewport;
}

/**
 * Rule 3: drawings are their own layer, between the rink and the entities. Shapes are drawn
 * in metres inside a group carrying the viewport transform; text is drawn upright in screen
 * space (positioned with rinkToScreen) so it stays readable when the rink is rotated.
 */
export function DrawingLayer({ drawings, draft, vp }: Props) {
  return (
    <Layer listening={false} name="drawing-layer">
      <Group {...viewportGroupAttrs(vp)}>
        {drawings.map((d) => (d.tool === 'text' ? null : <Shape key={d.id} d={d} />))}
        {draft && draft.tool !== 'text' && <Shape d={draft} opacity={0.8} />}
      </Group>
      {drawings.map((d) => (d.tool === 'text' ? <TextMark key={d.id} d={d} vp={vp} /> : null))}
    </Layer>
  );
}

function Shape({ d, opacity = 1 }: { d: Omit<Drawing, 'id'>; opacity?: number }) {
  const { color, widthM } = d.style;
  const flat = d.points.flatMap((p) => [p.x, p.y]);
  const dash = d.style.dash === 'dashed' ? [widthM * 4, widthM * 3] : undefined;

  switch (d.tool) {
    case 'pen': {
      const outline = getStroke(
        d.points.map((p, i) => [p.x, p.y, d.pressures?.[i] ?? 0.5]),
        {
          size: widthM * 1.8,
          thinning: d.pressures ? 0.6 : 0.4,
          smoothing: 0.5,
          streamline: 0.4,
          simulatePressure: !d.pressures,
        },
      );
      return (
        <Line
          name="drawing"
          points={outline.flat()}
          closed
          fill={color}
          opacity={opacity}
          perfectDrawEnabled={false}
        />
      );
    }
    case 'line':
      return (
        <Line
          name="drawing"
          points={flat}
          stroke={color}
          strokeWidth={widthM}
          dash={dash}
          lineCap="round"
          opacity={opacity}
        />
      );
    case 'arrow': {
      const head = Math.max(0.5, widthM * 4);
      if (d.style.dash === 'double') {
        // Shot: a hollow double line with a solid head.
        const [a, b] = d.points;
        if (!a || !b) return null;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const k = Math.max(0, len - head) / len;
        const inner = [a.x, a.y, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k];
        return (
          <Group name="drawing" opacity={opacity}>
            <Arrow
              points={flat}
              stroke={color}
              fill={color}
              strokeWidth={widthM * 3}
              pointerLength={head * 1.2}
              pointerWidth={head * 1.4}
            />
            <Line points={inner} stroke={SURFACE} strokeWidth={widthM} />
          </Group>
        );
      }
      return (
        <Arrow
          name="drawing"
          points={flat}
          stroke={color}
          fill={color}
          strokeWidth={widthM}
          dash={dash}
          pointerLength={head}
          pointerWidth={head * 0.9}
          lineCap="round"
          opacity={opacity}
        />
      );
    }
    case 'zone': {
      if (d.points.length < 2) return null;
      const b = boundsOf(d.points);
      const common = {
        name: 'drawing',
        stroke: d.style.color,
        strokeWidth: widthM,
        fill: d.style.fill,
        opacity,
      };
      return d.shape === 'ellipse' ? (
        <Ellipse
          {...common}
          x={b.x + b.w / 2}
          y={b.y + b.h / 2}
          radiusX={b.w / 2}
          radiusY={b.h / 2}
        />
      ) : (
        <Rect {...common} x={b.x} y={b.y} width={b.w} height={b.h} />
      );
    }
    default:
      return null;
  }
}

function TextMark({ d, vp }: { d: Drawing; vp: Viewport }) {
  const a = d.points[0];
  if (!a || !d.text) return null;
  const s = rinkToScreen(a, vp);
  const fontSize = Math.max(
    9,
    (d.style.fontSizeM ?? d.style.widthM * TEXT_SIZE_PER_WIDTH) * vp.scale,
  );
  const w = Math.max(40, d.text.length * fontSize * 0.75 + 8);
  return (
    <Text
      name="drawing"
      x={s.x}
      y={s.y}
      width={w}
      offsetX={w / 2}
      offsetY={fontSize / 2}
      align="center"
      text={d.text}
      fontSize={fontSize}
      fontStyle="bold"
      fill={d.style.color}
      stroke={d.style.color === '#ffffff' ? '#111827' : '#ffffff'}
      strokeWidth={Math.max(1, fontSize / 10)}
      fillAfterStrokeEnabled
    />
  );
}
