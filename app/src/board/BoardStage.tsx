import type Konva from 'konva';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Rect, Stage } from 'react-konva';
import { debugState } from '../debug';
import { drawingsForFrame } from '../model/drawing';
import { KeyframeTrackSource } from '../model/keyframeTrackSource';
import { viewBounds } from '../model/rink';
import type { Vec } from '../model/types';
import { useBoardStore } from '../store/boardStore';
import { useToolStore } from '../store/toolStore';
import { TOOLS } from '../tools';
import type { ToolGesture } from '../tools/types';
import { DrawingLayer } from './DrawingLayer';
import { EntityLayer } from './EntityLayer';
import { RinkLayer } from './RinkLayer';
import { registerStage } from './snapshot';
import { TextEntry } from './TextEntry';
import {
  fitViewport,
  panBy,
  rinkToScreen,
  screenToRink,
  zoomAt,
  type Size,
  type Viewport,
} from './viewport';

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
  const beginGesture = useBoardStore((s) => s.beginGesture);
  const endGesture = useBoardStore((s) => s.endGesture);
  const tool = useToolStore((s) => s.tool);
  const draft = useToolStore((s) => s.draft);
  const textAt = useToolStore((s) => s.textAt);

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
  // Let thumbnails and PNG export capture this stage.
  const rink = board.rink;
  useEffect(() => {
    const stage = stageRef.current;
    if (stage) registerStage({ stage, vp, rink });
  }, [vp, rink, size]);
  useEffect(() => () => registerStage(null), []);
  const setVp = useCallback(
    (next: Viewport) => {
      vpRef.current = next;
      setOverride({ key: fitKey, vp: next });
    },
    [fitKey],
  );

  // ---- Rule 2: render entity state from a TrackSource, never from frames directly ----
  const source = useMemo(
    () => new KeyframeTrackSource(board.entities, board.frames),
    [board.entities, board.frames],
  );
  const states = useMemo(() => source.stateAt(source.frameTime(frameIndex)), [source, frameIndex]);
  // ---- Rule 3: drawings visible on this frame ----
  const frameId = board.frames[frameIndex]?.id;
  const drawings = useMemo(
    () => drawingsForFrame(board.drawings, frameId),
    [board.drawings, frameId],
  );

  // ---- pointer state ----
  const touches = useRef(new Map<number, Vec>());
  const pinch = useRef<{ startVp: Viewport; mid: Vec; dist: number } | null>(null);
  const pan = useRef<{ pointerId: number; last: Vec } | null>(null);
  const drawing = useRef<{ pointerId: number; gesture: ToolGesture } | null>(null);
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

  /** Keep receiving moves outside the board. Best effort: throws for an inactive pointer id. */
  const capture = (pointerId: number) => {
    try {
      wrapRef.current?.setPointerCapture(pointerId);
    } catch {
      // ignore
    }
  };

  const stopEntityDrags = () => {
    stageRef.current?.find('.entity').forEach((n) => {
      if (n.isDragging()) n.stopDrag();
    });
    endGesture();
  };

  const startDrawing = (ev: React.PointerEvent) => {
    if (tool === 'select') return;
    const ts = useToolStore.getState();
    if (ts.textAt) {
      // A tap elsewhere while typing commits the text (TextEntry's blur) and starts nothing.
      return;
    }
    const bs = useBoardStore.getState();
    const p = screenToRink(localPoint(ev), vpRef.current);
    const pressure = ev.pointerType === 'pen' ? ev.pressure : undefined;
    const gesture = TOOLS[tool].begin(
      {
        board: bs,
        getBoard: () => useBoardStore.getState().board,
        tools: ts,
        scale: vpRef.current.scale,
      },
      p,
      pressure,
    );
    if (gesture) drawing.current = { pointerId: ev.pointerId, gesture };
  };

  const onPointerDownCapture = (ev: React.PointerEvent) => {
    const drawMode = tool !== 'select';
    if (ev.pointerType === 'pen' && !useToolStore.getState().penDetected) {
      useToolStore.getState().setPenDetected(true);
    }
    const penMode = useToolStore.getState().penDetected;

    if (ev.pointerType === 'touch') {
      touches.current.set(ev.pointerId, localPoint(ev));
      if (touches.current.size === 2) {
        // Second finger: whatever the first one started becomes a pinch.
        stopEntityDrags();
        setBox(null);
        drawing.current?.gesture.cancel();
        drawing.current = null;
        pan.current = null;
        const tf = twoFinger()!;
        pinch.current = { startVp: vpRef.current, mid: tf.mid, dist: Math.max(1, tf.dist) };
        return;
      }
      if (touches.current.size > 2) return;
      if (drawMode) {
        capture(ev.pointerId);
        if (penMode) {
          // Stylus seen: fingers only pan and zoom, so a resting palm draws nothing.
          pan.current = { pointerId: ev.pointerId, last: localPoint(ev) };
        } else {
          startDrawing(ev);
        }
      }
      return;
    }

    if (ev.pointerType === 'mouse' && (ev.button === 1 || ev.button === 2)) {
      pan.current = { pointerId: ev.pointerId, last: localPoint(ev) };
      capture(ev.pointerId);
      return;
    }

    if (drawMode && ev.button === 0) {
      capture(ev.pointerId);
      startDrawing(ev);
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
        return;
      }
    }
    if (pan.current && pan.current.pointerId === ev.pointerId) {
      const pt = localPoint(ev);
      const last = pan.current.last;
      pan.current.last = pt;
      setVp(panBy(vpRef.current, pt.x - last.x, pt.y - last.y));
      return;
    }
    const d = drawing.current;
    if (d && d.pointerId === ev.pointerId) {
      // Coalesced events give the full-rate path of a fast pen.
      const native = ev.nativeEvent;
      const evs = native.getCoalescedEvents?.() ?? [];
      for (const e of evs.length ? evs : [native]) {
        d.gesture.move(
          screenToRink(localPoint(e), vpRef.current),
          e.pointerType === 'pen' ? e.pressure : undefined,
        );
      }
    }
  };

  const onPointerUpCapture = (ev: React.PointerEvent) => {
    if (ev.pointerType === 'touch') {
      touches.current.delete(ev.pointerId);
      if (touches.current.size < 2) pinch.current = null;
    }
    if (pan.current?.pointerId === ev.pointerId) pan.current = null;
    const d = drawing.current;
    if (d && d.pointerId === ev.pointerId) {
      drawing.current = null;
      if (ev.type === 'pointercancel') d.gesture.cancel();
      else d.gesture.end();
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

  // ---- select tool: tap empty space clears selection; drag on empty space box-selects ----
  const onStagePointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (tool !== 'select') return;
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
      className={`board-stage tool-${tool}`}
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
          <DrawingLayer drawings={drawings} draft={draft} vp={vp} />
          <EntityLayer
            entities={source.entities}
            states={states}
            vp={vp}
            rink={board.rink}
            teamColors={board.teamColors}
            selection={selection}
            interactive={tool === 'select'}
            onSelect={(id, additive) => (additive ? toggleSelect(id) : select([id]))}
            onMove={moveEntities}
            onDragBegin={beginGesture}
            onDragFinish={endGesture}
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
      {textAt && <TextEntry at={rinkToScreen(textAt, vp)} />}
    </div>
  );
}
