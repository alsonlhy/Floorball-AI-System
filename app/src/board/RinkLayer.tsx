import { Circle, Group, Layer, Line, Rect } from 'react-konva';
import { OFFICIAL, rinkGeometry, type Rect as RRect } from '../model/rink';
import type { RinkSpec } from '../model/types';
import { viewportGroupAttrs, type Viewport } from './viewport';

const COLORS = {
  surface: '#f3f6f9',
  boards: '#2b3440',
  line: '#24324a',
  crease: '#b3261e',
  keeper: '#b3261e',
  cage: '#111827',
  dot: '#24324a',
};

interface Props {
  spec: RinkSpec;
  vp: Viewport;
}

/**
 * Rink markings drawn in metres inside one group whose transform is the viewport
 * (viewportGroupAttrs is rinkToScreen expressed as Konva attributes).
 */
export function RinkLayer({ spec, vp }: Props) {
  const g = rinkGeometry(spec);
  // Official lines are 5 cm; keep them at least ~1.2 px so they stay visible when zoomed out.
  const line = Math.max(OFFICIAL.lineWidthM, 1.2 / vp.scale);
  const boardStroke = Math.max(0.15, 2.5 / vp.scale);
  const dotR = Math.max(OFFICIAL.faceoffDotDiameterM / 2, 2.5 / vp.scale);

  const rect = (r: RRect, key: string, stroke: string, fill?: string) => (
    <Rect
      key={key}
      x={r.x}
      y={r.y}
      width={r.w}
      height={r.h}
      stroke={stroke}
      strokeWidth={line}
      fill={fill}
    />
  );

  return (
    <Layer listening={false} name="rink-layer">
      <Group {...viewportGroupAttrs(vp)}>
        <Rect
          name="rink-boards"
          x={g.boards.x}
          y={g.boards.y}
          width={g.boards.w}
          height={g.boards.h}
          cornerRadius={g.cornerRadiusM}
          fill={COLORS.surface}
          stroke={COLORS.boards}
          strokeWidth={boardStroke}
        />
        <Line
          points={[0, g.boards.y, 0, g.boards.y + g.boards.h]}
          stroke={COLORS.line}
          strokeWidth={line}
        />
        <Circle
          x={g.centreSpot.x}
          y={g.centreSpot.y}
          radius={Math.max(OFFICIAL.centreSpotDiameterM / 2, 2.5 / vp.scale)}
          fill={COLORS.dot}
        />
        {g.ends.map((end) => (
          <Group key={end.side}>
            {rect(end.crease, 'crease', COLORS.crease, 'rgba(179,38,30,0.05)')}
            {rect(end.keeperArea, 'keeper', COLORS.keeper, 'rgba(179,38,30,0.08)')}
            <Line
              points={end.cage.flatMap((p) => [p.x, p.y])}
              stroke={COLORS.cage}
              strokeWidth={Math.max(0.08, 2 / vp.scale)}
              lineJoin="round"
              fill="rgba(17,24,39,0.15)"
              closed={false}
            />
          </Group>
        ))}
        {g.faceoffDots.map((d, i) => (
          <Circle key={i} x={d.x} y={d.y} radius={dotR} fill={COLORS.dot} />
        ))}
      </Group>
    </Layer>
  );
}
