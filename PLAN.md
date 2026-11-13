# Floorball System — Plan

Planned 2026-11-13. This file is the brief for whoever builds the code. Phase 1 (feasibility test) and Phase 2 (tactics board) are specified in full; later phases are outlined so the early work does not paint them into a corner.

## 1. Product

A coaching tool for floorball with one shared 2D board and two modes:

1. **Tactics Board** — a whiteboard on a rink. The coach places players, ball and cones, draws on it, and animates drills. No AI. Built first.
2. **Match Replay** — a recorded match is processed offline into a tracking file; the same board plays it back with play, pause and scrub, and the coach can draw on it at any moment. Built after the board.

### Decisions already made

| Topic | Decision |
|---|---|
| Audience | Personal / club use first. No accounts or billing. |
| Devices | iPad at the rink is the primary device; laptop browser second. Must work offline. Ships as a web app and in both the Apple App Store and Google Play. |
| Ball tracking | Best-effort only. Coaches can infer the ball; it must never block a release. |
| Footage | The user's own full-court recordings only, for now. The user owns the rights. SFA streams (panning camera) are deferred; a working result on own footage is the pitch to SFA for a permanent full-court camera. |
| Rink | Official IFF dimensions (section 3). |
| Repo | Fresh start. The earlier YOLO prototype (`kings_castle.pt`, `track_players.py`) is in git history only. |

### What the user's footage looks like

Checked 2026-11-13 from three frames of one video ("KCK vs Dalen QF P3") in the user's playlist of about 36 videos.

- One fixed ultra-wide action camera with strong fisheye distortion, mounted behind the match secretariat at the centre line. The whole rink is in view and the camera does not move.
- One video per period, about 25 minutes each. The YouTube copy is 1920×1080.
- The mount is low. Players on the far side are small, and players overlap each other more than they would from a high mount.
- Wooden multi-sport floor with many overlapping court lines and bright light reflections.
- Bench players, officials and spectators stand right at the boards and must be excluded.

Consequences: calibration is done once per video (good), but it must model the fisheye lens, and far-side accuracy is the main risk.

**Source files.** The original camera files are gone; only the user's YouTube uploads exist, at 1080p. The user gets the files by exporting their own uploads with Google Takeout (which returns the uploaded files) rather than YouTube Studio's download button, which may give a lower resolution. The pipeline takes local video files and never downloads anything itself. Future recordings should be kept as original files, at the camera's highest resolution.

**Hardware.** The user has an Nvidia RTX 3060. Check its memory (6 GB laptop or 12 GB desktop) before choosing model sizes. It is enough for Phase 1 and for processing whole matches locally in Phase 3, slower than real time.

### Still open

- Which camera and lens mode was used (helps the fisheye calibration).
- How much manual correction per match is acceptable.
- iOS builds need a Mac or a cloud build service; the user works on Windows. Decide before Phase 2's store milestone.

## 2. Roadmap

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Feasibility test on the user's own clips (section 4) | Next |
| 2 | Tactics board, web plus both app stores (section 5) | Specified |
| 3 | Analysis pipeline v1 and match replay on the board | Outlined |
| 4 | Video synced beside the board, manual correction tools | Outlined |
| 5 | Analytics (heatmaps, team width/depth), sharing | Outlined |
| Later | SFA version, ideally from a permanent high full-court camera | Not planned yet |

Phases 1 and 2 share no code and can run in either order or side by side. Phase 1 is listed first because it is short and it is the only part whose outcome is uncertain.

## 3. Architecture the board must respect

These three rules are what let Match Replay reuse the board later. They are not optional.

**Rule 1 — Rink coordinates in metres.** All stored positions are in metres with the origin at the rink centre, `x` along the length (−20 to +20 on a full rink), `y` along the width (−10 to +10). Pixels exist only in the rendering layer. The analysis pipeline will output the same coordinates.

**Rule 2 — The board renders from a track source.** The renderer never reads keyframes directly. It asks one interface for the state at a time `t`:

```ts
type Vec = { x: number; y: number };            // metres, rink-centre origin

interface EntityState { pos: Vec; confidence?: number; visible?: boolean }

interface TrackSource {
  durationMs: number;
  entities: Entity[];
  stateAt(tMs: number): Map<string, EntityState>;
}
```

Phase 2 ships `KeyframeTrackSource` (interpolates between drill keyframes). Phase 3 adds `SampledTrackSource` (dense match data). `confidence` and `visible` are unused in Phase 2 but must be in the type: match data will have off-camera players shown faded.

**Rule 3 — Drawings are a separate layer with their own time scope.** A drawing is either pinned to the whole board or to a time range. This is what lets a coach pause a match replay and draw on that moment.

### Data model

```ts
interface Board {
  schemaVersion: 1;
  id: string; name: string;
  rink: RinkSpec;
  entities: Entity[];
  frames: Frame[];            // at least one; one frame = a static board
  drawings: Drawing[];
  createdAt: number; updatedAt: number;
}

interface RinkSpec { lengthM: number; widthM: number; view: 'full' | 'half-left' | 'half-right' }

interface Entity {
  id: string;
  kind: 'player' | 'goalie' | 'ball' | 'cone';
  team?: 'home' | 'away' | 'neutral';
  label?: string;             // jersey number or short name
}

interface Frame { id: string; durationMs: number; positions: Record<string, Vec> }

interface Drawing {
  id: string;
  tool: 'pen' | 'line' | 'arrow' | 'zone' | 'text';
  points: Vec[];
  style: { color: string; widthM: number; dash?: 'solid' | 'dashed'; head?: 'none' | 'arrow'; fill?: string };
  text?: string;
  frameId?: string;           // undefined = shown on every frame
}
```

Every saved file carries `schemaVersion`. Loading runs through a migration function even though there is only one version, so later changes do not strand saved boards.

### Stack

| Concern | Choice | Reason |
|---|---|---|
| App shell | Vite + React + TypeScript (strict) | Simple, fast, no server needed |
| Canvas | Konva via `react-konva` | Hit-testing, dragging and touch built in; layers map to rink / drawings / entities |
| Pen strokes | `perfect-freehand` | Pressure-aware smooth strokes for Apple Pencil |
| State | Zustand, with a hand-rolled undo/redo stack of board snapshots | Small, no boilerplate |
| Storage | IndexedDB via Dexie | Offline, no backend |
| Offline / install | `vite-plugin-pwa` | Installs to iPad home screen |
| Tests | Vitest for logic, Playwright for the app | |

| Store apps | Capacitor wrapping the same web build for iOS and Android | One codebase for web, App Store and Google Play |

No backend for the board. Nothing may depend on browser-only APIs that Capacitor cannot host; storage and file export go through a thin adapter so the native builds can swap in Capacitor plugins.

### Official rink dimensions

From the IFF Rules of the Game, edition valid from 1 July 2026, rules 101–104.

| Item | Value |
|---|---|
| Rink | 40 × 20 m, board with rounded corners. Smallest allowed 36 × 18 m. |
| Lines | 4–5 cm wide |
| Centre line and centre spot | Centre line parallel to the short sides, halving the rink |
| Goal crease | 4 m (along rink length) × 5 m, starting 2.85 m from the short side, centred on the width |
| Goalkeeper area | 1 m × 2.5 m, starting 0.65 m in front of the rear of the goal crease, centred |
| Goal line | The rear line of the goalkeeper area, so 3.5 m from the short side |
| Goal posts | 1.6 m apart on the goal line; cage opening faces the centre spot |
| Face-off dots | On the centre line and on the extended goal lines, 1.5 m from each long side, at most 30 cm across (six dots) |
| Substitution zones | Along one long side, from 5 m off the centre line to the extended goal line, at most 3 m deep |

The rules do not give a corner radius; it comes from the board manufacturer. Use a configurable value and pick a default that looks right. Goal cage depth is not in rule 103 either; an older edition gives 160 × 115 × 60 cm, so draw 0.6 m deep.

### Source layout

```
src/
  model/        types, migration, rink geometry, KeyframeTrackSource   (pure TS, no React)
  store/        Zustand store, undo/redo, persistence
  board/        Konva stage: RinkLayer, DrawingLayer, EntityLayer, viewport transform
  tools/        one module per tool (select, pen, line, arrow, zone, text, eraser)
  ui/           toolbar, timeline, board library, dialogs
  presets/      formations and rink sizes
```

`model/` must stay free of React and Konva so the pipeline's output can be validated against it and so it can be unit-tested directly.

## 4. Phase 1 — Feasibility test on own footage

A short, throwaway-quality experiment in Python that answers one question: from this camera position, can players be placed on the 2D rink well enough to show team shape? It lives in `analysis/`, separate from the app.

**Inputs.** Three two-minute clips cut from the user's own 1080p files (see "Source files"), from different matches so jersey colours and lighting vary.

**Setup.** Python 3.11+, a virtual environment, OpenCV, and a current off-the-shelf person detector and tracker, with GPU (CUDA) support for the RTX 3060. Check the detector's licence before anything is sold or handed to SFA; some popular ones are AGPL.

| Step | Work | Measure |
|---|---|---|
| F1 Calibration | A small tool where the user clicks known rink points in one frame (goal crease corners, centre line ends, face-off dots, board corners). Fit a fisheye camera model plus the image-to-rink mapping. Reused for the whole video since the camera is fixed. | Error in metres on held-out clicked points, reported separately for near and far side |
| F2 Detection | Detect people; run the detector on overlapping tiles so small far-side players are not missed. Keep only detections whose feet map inside the rink. | Share of on-rink players found, hand-counted on 50 sampled frames |
| F3 Tracking | Link detections over time. | Identity swaps per minute |
| F4 Teams | Cluster jersey colours into two teams, goalkeepers and referees. | Share of correct team labels on the same 50 frames |
| F5 Ball | Try it; do not tune it. | Share of frames with the ball found |
| F6 Output | Write the match file (below) and render a top-down video of dots next to the source video. | The user watches it and judges whether the shape is believable |

**Suggested pass marks** (proposed here, not agreed with the user): 90% of on-rink players found, 95% correct team labels, position error within 1 m on the near side and 2 m on the far side. The ball has no pass mark.

**Deliverable.** A one-page result with the numbers, the side-by-side video, and a recommendation on camera height, position and resolution for future recordings and for the SFA pitch.

### Match file

The contract between the pipeline and the board's `SampledTrackSource`. Positions follow Rule 1.

```json
{
  "schemaVersion": 1,
  "rink": { "lengthM": 40, "widthM": 20 },
  "sampleRateHz": 10,
  "entities": [{ "id": "p7", "kind": "player", "team": "home" }],
  "samples": [{ "tMs": 0, "states": [["p7", -3.2, 4.1, 0.93]] }]
}
```

Each state is `[entityId, x, y, confidence]`. An entity missing from a sample is not visible at that time.

## 5. Phase 2 — Tactics Board

Build in the order below. Each milestone ends in a working app and has acceptance checks. Do not start a milestone before the previous one passes.

### M0 — Scaffold

- Vite + React + TS strict, ESLint, Prettier, Vitest, Playwright, `npm run dev / build / test / e2e`.
- A `CLAUDE.md` recording the three architecture rules and the commands.

*Accept:* the app builds, one Vitest and one Playwright test pass.

### M1 — Rink and viewport

- Draw the rink from `RinkSpec` in metres using the official dimensions table in section 3: boards with rounded corners, centre line and spot, goal creases, goalkeeper areas, goal cages and the six face-off dots.
- Rink size presets: full (40 × 20), minimum (36 × 18) and a custom size, since school and 3v3 rinks are smaller. Markings keep their official distances from the boards at every size.
- View modes: full rink, left half, right half.
- The stage fits the available space in both orientations, with pinch-zoom and two-finger pan, and a "fit" button.
- A single `rinkToScreen` / `screenToRink` transform used by everything.

*Accept:* unit tests for the transform round-trip; rink is undistorted at 1024×768, 768×1024 and a phone width; half-rink views show the correct half.

### M2 — Players, ball, cones

- Add entities from the toolbar: home player, away player, goalie (each team), ball, cone.
- Drag to move, with positions clamped to a small margin outside the rink boards (players do stand off-rink in drills).
- Tap to select; selected entity shows a handle. Multi-select by drag-box. Delete, duplicate.
- Edit label (number or short name) and team colour. Two team colours are board-level settings.
- Tokens are at least 44 pt touch targets regardless of zoom.

*Accept:* Playwright test adds five-a-side plus goalies for both teams, moves one, relabels one, deletes one, and the store matches.

### M3 — Drawing tools and undo

- Tools: freehand pen, straight line, arrow, zone (rectangle and ellipse, translucent fill), text, eraser (removes whole drawings on touch).
- Arrow styles as a coach would expect: solid = player run, dashed = pass, with a third distinct style for a shot. Colour and width pickers with a short fixed palette.
- Pointer Events throughout. When a pen is detected (`pointerType === 'pen'`), touch input pans and zooms and only the pen draws, so a resting palm does nothing.
- Undo / redo for every mutation, including entity moves. One drag is one undo step.
- "Clear drawings" keeps the players in place.

*Accept:* unit tests for the undo stack; Playwright draws each tool, undoes all, redoes all, and ends at the same state.

### M4 — Saving and sharing

- Board library screen: create, rename, duplicate, delete (with confirmation), sorted by last edited, with a thumbnail.
- Autosave to IndexedDB, debounced. No save button.
- Export and import a board as a `.json` file. Import validates against the schema and rejects bad files with a readable message.
- Export the current view as PNG.

*Accept:* a board survives a page reload; export then import yields an identical board; a corrupt file is rejected without crashing.

### M5 — Animation

- A timeline strip of frames. "Add frame" copies the current positions; the coach then moves players for the next step.
- Play, pause, scrub, step forward/back, speed (0.5×, 1×, 2×), loop.
- Playback goes through `KeyframeTrackSource.stateAt(t)` (Rule 2), with eased interpolation. Entities added in a later frame appear at that frame.
- Optional faint movement trails between the current frame and the next.
- Drawings can be pinned to one frame or shown on all (Rule 3).
- Editing is disabled while playing; pausing mid-way snaps editing to the nearest frame.

*Accept:* unit tests for interpolation at frame boundaries and midpoints; a three-frame drill plays, pauses at an arbitrary time and resumes from there.

### M6 — iPad and offline

- PWA manifest and service worker; the app loads and works with no network after first visit.
- Safe-area insets, no rubber-band scrolling or text selection on the stage, no double-tap zoom.
- Toolbar reachable with a thumb in landscape; layout adapts in portrait.
- A presentation mode that hides the toolbars for showing players the board.

*Accept:* Playwright run with the network offline; manual check on a real iPad with Apple Pencil (the builder cannot verify this — hand it to the user with a checklist).

### M7 — Presets

- Formation presets that place a team in one tap: 2-1-2, 2-2-1, 1-2-2, plus box and diamond for penalty-kill and power-play.
- Start-from templates: empty rink, face-off at centre, free-hit, half-rink drill.
- Save any board as a personal template.

*Accept:* each preset places the right number of players inside the rink, mirrored correctly for the away team.

### M8 — App Store and Google Play

- Add Capacitor; produce iOS and Android projects from the same web build. Swap the storage and file-export adapter to native plugins where the web versions do not work.
- App icons, splash screens, store listing text and screenshots for phone and tablet.
- A privacy policy page (both stores require one, even for an app that collects nothing).
- Android: signed release bundle uploaded to a Google Play internal test track.
- iOS: build uploaded to TestFlight. This needs a Mac or a cloud build service, and the user is on Windows; pick one before starting this milestone.
- The user must create the Apple Developer and Google Play developer accounts themselves; both charge a fee and verify identity. Check each store's current rules for new accounts before promising a release date, as Google has required a closed testing period for new personal accounts.

*Accept:* the board runs from TestFlight on an iPad and from the internal test track on an Android tablet, offline, with saved boards surviving an app restart.

### Out of scope for Phase 2

Accounts, cloud sync, multi-user editing, video of any kind, video export of animations (PNG and JSON only).

## 6. Later phases, in brief

**Phase 3 — Pipeline and replay.** Harden the Phase 1 experiment into a repeatable pipeline: calibrate once per video, detect, track, classify team, map to rink coordinates, smooth, write a match file. The board gains `SampledTrackSource`, a match library, and drawing on a paused replay. Decide here where processing runs (the user's PC or a rented GPU), since a store app cannot do it on the device.

**Phase 4 — Video and correction.** Video beside the board with a shared timeline; tools to fix swapped identities and wrong team labels.

**Phase 5 — Analytics and reach.** Heatmaps, distance covered, team width and depth; share links.

**SFA version.** Their current streams use one panning camera showing a third to half of the rink, with replay cut-ins. Not worth building for. The aim is a permanent high full-court camera, which makes their footage the same problem as the user's own.
