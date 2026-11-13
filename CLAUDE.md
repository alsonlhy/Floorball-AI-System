# Floorball System

`PLAN.md` is the brief. Two parts: `app/` (tactics board, TypeScript) and `analysis/` (offline video analysis, Python). They share no code; the match file format in `PLAN.md` section 4 is their contract.

## Architecture rules for the board (PLAN.md section 3, not optional)

1. **Rink coordinates in metres.** Every stored position is in metres, origin at the rink centre, `x` along the length (−20…+20 on a full rink), `y` along the width (−10…+10). Pixels exist only in the rendering layer. Convert only through `rinkToScreen` / `screenToRink` in `app/src/board/viewport.ts`; the rink layer uses `viewportGroupAttrs`, which is the same transform expressed as Konva attributes.
2. **The board renders from a `TrackSource`.** The renderer never reads frames or keyframes directly; it calls `stateAt(tMs)` (`KeyframeTrackSource` now, `SampledTrackSource` for match replay later). Keep `confidence` and `visible` in `EntityState`.
3. **Drawings are a separate layer with their own time scope.** A drawing is pinned to the whole board (`frameId` undefined) or to one frame/time range.

Also: `app/src/model/` stays pure TypeScript with no React, Konva or Zustand (ESLint enforces this). Every saved board carries `schemaVersion` and loads through `migrateBoard`.

## Commands (run in `app/`)

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm run build` | Type-check (`tsc -b`) and production build to `app/dist` |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run e2e` | Playwright tests in `app/e2e` (starts the dev server itself) |
| `npm run lint` | ESLint |
| `npm run format` / `format:check` | Prettier |

In dev builds (or with `?debug` in the URL) `window.__floorball` exposes the store and the current viewport; the Playwright tests use it.

## Layout of `app/src`

`model/` types, rink geometry, drawing geometry, undo history, migration, `KeyframeTrackSource` · `store/` board store (every mutation goes through `commit`, which records undo) and tool store (UI-only) · `board/` Konva stage, layers, viewport transform · `tools/` one module per drawing tool · `ui/` toolbars and inspector · `presets/` formations (M7).

Undo: every board mutation is one step. Drags and eraser sweeps are bracketed by `beginGesture` / `endGesture` so a whole gesture is one step; label typing and colour picking merge by key.

## Status

Phase 2 milestones M0–M3 are built (scaffold, rink and viewport, players/ball/cones, drawing tools and undo). Next is M4 (saving and sharing).
