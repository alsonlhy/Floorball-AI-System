import type Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import { debugState } from '../debug';
import { KeyframeTrackSource } from '../model/keyframeTrackSource';
import { viewBounds } from '../model/rink';
import type { Vec } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { EntityLayer } from './EntityLayer';
import { RinkLayer } from './RinkLayer';
import { fitViewport, panBy, rinkToScreen, zoomAt, type Size, type Viewport } from './viewport';

interface Props {
  /** Incremented by the toolbar's Fit button. */
  fitSignal: number;
}

export function BoardStage({ fitSignal }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const board = useBoardStore((s) => s.board);
  const frameIndex = useBoardStore((s) => s.frameIndex);
  const selection = useBoardStore((s) => s.selection);
  const select = useBoardStore((s) => s.select);
  const toggleSelect = useBoardStore((s) => s.toggleSelect);
  const moveEntities = useBoardStore((s) => s.moveEntities);

  // ---- viewport: fit to space, plus the user's zoom/pan on top ----
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setSize({ width: el.clientWidth, height: el.clientHeight }),
    );
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const { lengthM, widthM, view } = board.rink;
  const fitKey = `${size.width}x${size.height}|${lengthM}x${widthM}|${view}|${fitSignal}`;
  const fit = useMemo(
    () => fitViewport(viewBounds({ lengthM, widthM, view }), size),
    [lengthM, widthM, view, size],
  );
  const [override, setOverride] = useState<{ key: string; vp: Viewport } | null>(null);
  const vp = override && override.key === fitKey ? override.vp : fit;
  const vpRef = useRef(vp);
  useEffect(() => {
    vpRef.current = vp;
    debugState.viewport = vp;
  }, [vp]);
  const setVp = useCallback((next: Viewport) => setOverride({ key: fitKey, vp: next }), [fitKey]);

  // ---- Rule 2: render entity state from a TrackSource, never from frames directly ----
  const source = useMemo(
    () => new KeyframeTrackSource(board.entities, board.frames),
    [board.entities, board.frames],
  );
  const states = useMemo(() => source.stateAt(source.frameTime(frameIndex)), [source, frameIndex]);

  // ---- gestures: pinch-zoom + two-finger pan (touch), wheel zoom, right/middle-drag pan ----
  const touches = useRef(new Map<number, Vec>());
  const pinch = useRef<{ startVp: Viewport; mid: Vec; dist: number } | null>(null);
  const mousePan = useRef<{ last: Vec } | null>(null);
  type Box = { a: Vec; b: Vec; additive: boolean };
  const [box, setBoxState] = useState<Box | null>(null);
  const boxRef = useRef<Box | null>(null);
  const setBox = (b: Box | null) => {
    boxRef.current = b;
    setBoxState(b);
  };
  const boxActive = box !== null;

  const localPoint = (ev: { clientX: number; clientY: number }): Vec => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  const twoFinger = () => {
    const [p, q] = [...touches.current.values()];
    if (!p || !q) return null;
    return {
      mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 },
      dist: Math.hypot(p.x - q.x, p.y - q.y),
    };
  };

  const stopEntityDrags = () => {
    stageRef.current?.find('.entity').forEach((n) => {
      if (n.isDragging()) n.stopDrag();
    });
  };

  const onPointerDownCapture = (ev: React.PointerEvent) => {
    if (ev.pointerType === 'touch') {
      touches.current.set(ev.pointerId, localPoint(ev));
      if (touches.current.size === 2) {
        stopEntityDrags();
        setBox(null);
        const tf = twoFinger()!;
        pinch.current = { startVp: vpRef.current, mid: tf.mid, dist: Math.max(1, tf.dist) };
      }
    } else if (ev.pointerType === 'mouse' && (ev.button === 1 || ev.button === 2)) {
      mousePan.current = { last: localPoint(ev) };
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
    }
  };

  const onPointerMoveCapture = (ev: React.PointerEvent) => {
    if (ev.pointerType === 'touch' && touches.current.has(ev.pointerId)) {
      touches.current.set(ev.pointerId, localPoint(ev));
      const p = pinch.current;
      const tf = twoFinger();
      if (p && tf) {
        const panned = panBy(p.startVp, tf.mid.x - p.mid.x, tf.mid.y - p.mid.y);
        setVp(zoomAt(panned, tf.mid, tf.dist / p.dist, fit.scale));
      }
    } else if (mousePan.current) {
      const pt = localPoint(ev);
      const last = mousePan.current.last;
      mousePan.current.last = pt;
      setVp(panBy(vpRef.current, pt.x - last.x, pt.y - last.y));
    }
  };

  const onPointerUpCapture = (ev: React.PointerEvent) => {
    if (ev.pointerType === 'touch') {
      touches.current.delete(ev.pointerId);
      if (touches.current.size < 2) pinch.current = null;
    } else {
      mousePan.current = null;
    }
  };

  const onWheel = (ev: React.WheelEvent) => {
    const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015));
    setVp(zoomAt(vpRef.current, localPoint(ev), factor, fit.scale));
  };

  // Block page zoom/scroll from wheel on the board (React's onWheel is passive).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', prevent, { passive: false });
    return () => el.removeEventListener('wheel', prevent);
  }, []);

  // ---- tap empty space to clear selection; drag on empty space for a selection box ----
  const onStagePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (e.target !== e.target.getStage()) return;
    if (e.evt.button !== 0 || pinch.current || touches.current.size > 1) return;
    const pt = localPoint(e.evt);
    setBox({ a: pt, b: pt, additive: e.evt.shiftKey });
  };

  useEffect(() => {
    if (!boxActive) return;
    const move = (ev: PointerEvent) => {
      if (pinch.current) return setBox(null);
      const cur = boxRef.current;
      if (cur) setBox({ ...cur, b: localPoint(ev) });
    };
    const up = () => {
      const cur = boxRef.current;
      setBox(null);
      if (!cur || pinch.current) return;
      const x0 = Math.min(cur.a.x, cur.b.x);
      const x1 = Math.max(cur.a.x, cur.b.x);
      const y0 = Math.min(cur.a.y, cur.b.y);
      const y1 = Math.max(cur.a.y, cur.b.y);
      const st = useBoardStore.getState();
      if (x1 - x0 < 4 && y1 - y0 < 4) {
        if (!cur.additive) st.select([]);
        return;
      }
      const hits: string[] = [];
      for (const [id, s] of states) {
        const p = rinkToScreen(s.pos, vpRef.current);
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) hits.push(id);
      }
      st.select(cur.additive ? [...st.selection, ...hits] : hits);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // Listeners depend only on whether a box is active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxActive, states]);

  return (
    <div
      ref={wrapRef}
      className="board-stage"
      data-testid="board-stage"
      data-rotation={vp.rotation}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancelCapture={onPointerUpCapture}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onPointerDown={onStagePointerDown}
        >
          <RinkLayer spec={board.rink} vp={vp} />
          <EntityLayer
            entities={source.entities}
            states={states}
            vp={vp}
            rink={board.rink}
            teamColors={board.teamColors}
            selection={selection}
            onSelect={(id, additive) => (additive ? toggleSelect(id) : select([id]))}
            onMove={moveEntities}
          />
          <Layer listening={false}>
            {box && (
              <Rect
                x={Math.min(box.a.x, box.b.x)}
                y={Math.min(box.a.y, box.b.y)}
                width={Math.abs(box.a.x - box.b.x)}
                height={Math.abs(box.a.y - box.b.y)}
                stroke="#0ea5e9"
                strokeWidth={1}
                dash={[4, 3]}
                fill="rgba(14,165,233,0.08)"
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
