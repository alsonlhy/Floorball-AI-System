import type Konva from 'konva';
import { useRef } from 'react';
import { Circle, Group, Layer, Line, Rect, Text } from 'react-konva';
import { clampToRink } from '../model/rink';
import type { Entity, EntityState, RinkSpec, TeamColors, Vec } from '../model/types';
import { MIN_TOUCH_TARGET_PX, tokenRadiusPx } from './tokens';
import { rinkToScreen, screenToRink, type Viewport } from './viewport';

const HIT_R = MIN_TOUCH_TARGET_PX / 2;

const NEUTRAL = { ball: '#ffffff', cone: '#f97316' };

interface Props {
  entities: Entity[];
  states: Map<string, EntityState>;
  vp: Viewport;
  rink: RinkSpec;
  teamColors: TeamColors;
  selection: string[];
  onSelect(id: string, additive: boolean): void;
  onMove(moves: Record<string, Vec>): void;
}

/** Hit area drawn by every token: never smaller than the 44 pt target. */
function hitCircle(r: number) {
  const hr = Math.max(HIT_R, r);
  return (ctx: Konva.Context, shape: Konva.Shape) => {
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStrokeShape(shape);
  };
}

export function EntityLayer(props: Props) {
  const { entities, states, vp, rink, teamColors, selection, onSelect, onMove } = props;
  const dragStart = useRef<{ id: string; starts: Record<string, Vec> } | null>(null);

  const colorOf = (e: Entity) =>
    e.team === 'home' ? teamColors.home : e.team === 'away' ? teamColors.away : '#6b7280';

  const boundFor = (pos: Vec) => rinkToScreen(clampToRink(screenToRink(pos, vp), rink), vp);

  return (
    <Layer name="entity-layer">
      {entities.map((e) => {
        const st = states.get(e.id);
        if (!st || st.visible === false) return null;
        const p = rinkToScreen(st.pos, vp);
        const r = tokenRadiusPx(e.kind, vp.scale);
        const selected = selection.includes(e.id);
        const hit = hitCircle(r);

        return (
          <Group
            key={e.id}
            id={e.id}
            name="entity"
            x={p.x}
            y={p.y}
            opacity={st.confidence !== undefined ? 0.35 + 0.65 * st.confidence : 1}
            draggable
            dragBoundFunc={boundFor}
            onClick={(ev) => onSelect(e.id, ev.evt.shiftKey || ev.evt.metaKey || ev.evt.ctrlKey)}
            onTap={() => onSelect(e.id, false)}
            onDragStart={(ev) => {
              const additive = 'shiftKey' in ev.evt && (ev.evt as MouseEvent).shiftKey;
              let ids = selection;
              if (!selected) {
                onSelect(e.id, additive);
                ids = additive ? [...selection, e.id] : [e.id];
              }
              const starts: Record<string, Vec> = {};
              for (const id of ids) {
                const s = states.get(id);
                if (s) starts[id] = s.pos;
              }
              dragStart.current = { id: e.id, starts };
              ev.target.moveToTop();
            }}
            onDragMove={(ev) => {
              const d = dragStart.current;
              if (!d || d.id !== e.id) return;
              const now = screenToRink(ev.target.position(), vp);
              const origin = d.starts[e.id] ?? now;
              const dx = now.x - origin.x;
              const dy = now.y - origin.y;
              const moves: Record<string, Vec> = {};
              for (const [id, s] of Object.entries(d.starts))
                moves[id] = { x: s.x + dx, y: s.y + dy };
              moves[e.id] = now;
              onMove(moves);
            }}
            onDragEnd={() => {
              dragStart.current = null;
            }}
          >
            {selected && (
              <>
                <Circle
                  radius={Math.max(HIT_R, r) + 3}
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dash={[5, 4]}
                  listening={false}
                />
                <Circle
                  name="handle"
                  x={(Math.max(HIT_R, r) + 3) * Math.SQRT1_2}
                  y={-(Math.max(HIT_R, r) + 3) * Math.SQRT1_2}
                  radius={5}
                  fill="#0ea5e9"
                  stroke="#fff"
                  strokeWidth={1.5}
                  listening={false}
                />
              </>
            )}
            {e.kind === 'player' && (
              <Circle radius={r} fill={colorOf(e)} stroke="#fff" strokeWidth={2} hitFunc={hit} />
            )}
            {e.kind === 'goalie' && (
              <Rect
                x={-r}
                y={-r}
                width={2 * r}
                height={2 * r}
                cornerRadius={r * 0.35}
                fill={colorOf(e)}
                stroke="#111827"
                strokeWidth={2.5}
                hitFunc={(ctx, shape) => {
                  // Rect is drawn from its top-left corner; centre the hit circle on the token.
                  const hr = Math.max(HIT_R, r);
                  ctx.beginPath();
                  ctx.arc(r, r, hr, 0, Math.PI * 2);
                  ctx.closePath();
                  ctx.fillStrokeShape(shape);
                }}
              />
            )}
            {e.kind === 'ball' && (
              <Circle
                radius={r}
                fill={NEUTRAL.ball}
                stroke="#111827"
                strokeWidth={1.5}
                hitFunc={hit}
              />
            )}
            {e.kind === 'cone' && (
              <Line
                points={[0, -r, r * 0.9, r * 0.75, -r * 0.9, r * 0.75]}
                closed
                fill={NEUTRAL.cone}
                stroke="#9a3412"
                strokeWidth={1.5}
                hitFunc={hit}
              />
            )}
            {e.label && (e.kind === 'player' || e.kind === 'goalie') && (
              <Text
                text={e.label}
                width={2 * r}
                height={2 * r}
                offsetX={r}
                offsetY={r}
                align="center"
                verticalAlign="middle"
                fontStyle="bold"
                fontSize={Math.max(10, r * (e.label.length > 2 ? 0.6 : 0.9))}
                fill="#fff"
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </Layer>
  );
}
