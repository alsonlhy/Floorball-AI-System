# Analysis — Phase 1 feasibility test

Places players from fixed full-court footage onto the 2D rink. See `../PLAN.md` section 4.

## Setup

```bash
uv sync
```

```bash
uv run pytest
```

## Footage

Put video files in `analysis/data/` (ignored by git). Whole period files are fine; there is no need to cut clips.

## Step F1 — calibrate the camera

Run once per video, since the camera is fixed:

```bash
uv run python -m floorball_analysis.calibrate_cli data/match1.mp4 --time 60 --out data/match1
```

A window shows one frame with a small rink map. Click the point marked red on the map, for each point in turn.

- **S** skips a point you cannot see, **U** undoes, **Q** finishes.
- The magnifier at the top right shows the full-resolution pixels under the cursor.
- "left/right" are as seen from the camera; "near" is the camera's side; "back" is towards the end board.
- At least 8 points are needed. Aim for 15 or more, spread over both halves and both sides.
- If the rink is not 40 × 20 m, pass `--rink-length` and `--rink-width`.

It prints the fit error, the estimated camera position and a held-out accuracy figure in metres for the near and far side, and writes:

- `data/match1.clicks.json` — your clicks (refit later with `--clicks`)
- `data/match1.calib.json` — the camera
- `data/match1.overlay.jpg` — the rink drawn back onto the frame; the yellow lines should sit on the real markings

## Not built yet

Steps F2 to F6 (detection, tracking, teams, ball, top-down video) need real footage to develop against.
