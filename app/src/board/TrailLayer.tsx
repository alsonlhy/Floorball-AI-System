import { Arrow, Group, Layer } from 'react-konva';
import type { Frame } from '../model/types';
import { viewportGroupAttrs, type Viewport } from './viewport';

/** Faint arrows from where each piece is in this step to where it is in the next (M5). */
export function TrailLayer({ from, to, vp }: { from?: Frame; to?: Frame; vp: Viewport }) {
  if (!from || !to) return null;
  const moves = Object.entries(from.positions).flatMap(([id, a]) => {
    const b = to.positions[id];
    return b && Math.hypot(b.x - a.x, b.y - a.y) > 0.3 ? [{ id, a, b }] : [];
  });
  const w = Math.max(0.06, 1.5 / vp.scale);
  return (
    <Layer listening={false} name="trail-layer">
      <Group {...viewportGroupAttrs(vp)}>
        {moves.map(({ id, a, b }) => (
          <Arrow
            key={id}
            name="trail"
            points={[a.x, a.y, b.x, b.y]}
            stroke="#475569"
            fill="#475569"
            strokeWidth={w}
            dash={[w * 4, w * 3]}
            pointerLength={Math.max(0.4, 8 / vp.scale)}
            pointerWidth={Math.max(0.35, 7 / vp.scale)}
            opacity={0.45}
          />
        ))}
      </Group>
    </Layer>
  );
}
