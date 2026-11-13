"""Calibrate a fixed camera by clicking known rink points in one frame.

    uv run python -m floorball_analysis.calibrate_cli VIDEO --time 60 --out data/match1

Writes <out>.clicks.json, <out>.calib.json and <out>.overlay.jpg. Pass
--clicks to refit from saved clicks without opening a window.

Convention: the camera is on the near long side. "left"/"right" are as seen
from the camera, "near" is the camera's side of the rink, "far" the other.
"back" means towards the end board behind that goal, "front" towards centre.

Keys: left click = place point, S = skip (not visible), U = undo, Q/Enter = finish.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np

from .camera import MIN_POINTS, FisheyeCamera, fit_camera, leave_one_out_errors
from .rink import Rink

DISPLAY_WIDTH = 1600
LOUPE = 220  # size of the magnifier inset, in screen pixels
LOUPE_ZOOM = 4


def read_frame(video: str, time_s: float) -> np.ndarray:
    cap = cv2.VideoCapture(video)
    if not cap.isOpened():
        raise SystemExit(f"cannot open video: {video}")
    cap.set(cv2.CAP_PROP_POS_MSEC, time_s * 1000)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise SystemExit(f"cannot read a frame at {time_s}s from {video}")
    return frame


def rink_diagram(rink: Rink, highlight: tuple[float, float], size: int = 360) -> np.ndarray:
    """Small top-down map showing which point to click. Near side is at the bottom."""
    scale = (size - 20) / rink.length
    h = int(rink.width * scale) + 20
    img = np.full((h, size, 3), 40, np.uint8)

    def to_px(xy):
        xy = np.atleast_2d(xy)
        return np.stack([10 + (xy[:, 0] + rink.half_length) * scale,
                         h - 10 - (xy[:, 1] + rink.half_width) * scale], axis=1).astype(np.int32)

    for line in rink.polylines(step=1.0):
        cv2.polylines(img, [to_px(line)], False, (200, 200, 200), 1, cv2.LINE_AA)
    for xy in rink.landmarks().values():
        cv2.circle(img, tuple(to_px(xy)[0]), 2, (140, 140, 140), -1)
    cv2.circle(img, tuple(to_px(highlight)[0]), 6, (0, 0, 255), -1)
    cv2.putText(img, "camera side", (size // 2 - 40, h - 1), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (160, 160, 160), 1)
    return img


def collect_clicks(frame: np.ndarray, rink: Rink) -> dict[str, list[float]]:
    names = list(rink.landmarks())
    coords = rink.landmarks()
    scale = min(1.0, DISPLAY_WIDTH / frame.shape[1])
    base = cv2.resize(frame, None, fx=scale, fy=scale) if scale < 1 else frame.copy()
    clicks: dict[str, list[float]] = {}
    order: list[str | None] = []  # history for undo; None marks a skip
    state = {"mouse": (0, 0), "clicked": None}

    def on_mouse(event, x, y, _flags, _param):
        state["mouse"] = (x, y)
        if event == cv2.EVENT_LBUTTONDOWN:
            state["clicked"] = (x / scale, y / scale)

    win = "Calibrate: click the red point shown on the map (S skip, U undo, Q finish)"
    cv2.namedWindow(win)
    cv2.setMouseCallback(win, on_mouse)

    while len(order) < len(names):
        name = names[len(order)]
        view = base.copy()
        for done in clicks.values():
            cv2.circle(view, (int(done[0] * scale), int(done[1] * scale)), 4, (0, 255, 0), -1)
        diagram = rink_diagram(rink, coords[name])
        view[10:10 + diagram.shape[0], 10:10 + diagram.shape[1]] = diagram
        cv2.putText(view, f"{len(order) + 1}/{len(names)}  {name}", (10, diagram.shape[0] + 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)

        # Magnifier from the full-resolution frame, so far-side points can be placed precisely.
        mx, my = state["mouse"]
        half = LOUPE // (2 * LOUPE_ZOOM)
        fx, fy = int(mx / scale), int(my / scale)
        padded = cv2.copyMakeBorder(frame, half, half, half, half, cv2.BORDER_CONSTANT)
        patch = padded[fy:fy + 2 * half, fx:fx + 2 * half]
        if patch.shape[0] == 2 * half and patch.shape[1] == 2 * half:
            loupe = cv2.resize(patch, (LOUPE, LOUPE), interpolation=cv2.INTER_NEAREST)
            cv2.drawMarker(loupe, (LOUPE // 2, LOUPE // 2), (0, 0, 255), cv2.MARKER_CROSS, 20, 1)
            view[10:10 + LOUPE, view.shape[1] - LOUPE - 10:view.shape[1] - 10] = loupe

        cv2.imshow(win, view)
        key = cv2.waitKey(20) & 0xFF
        if state["clicked"] is not None:
            clicks[name] = list(state["clicked"])
            order.append(name)
            state["clicked"] = None
        elif key in (ord("s"), ord("S")):
            order.append(None)
        elif key in (ord("u"), ord("U")) and order:
            last = order.pop()
            if last is not None:
                clicks.pop(last)
        elif key in (ord("q"), ord("Q"), 13, 27):
            break
        if cv2.getWindowProperty(win, cv2.WND_PROP_VISIBLE) < 1:
            break
    cv2.destroyAllWindows()
    return clicks


def draw_overlay(frame: np.ndarray, cam: FisheyeCamera, rink: Rink, clicks: dict[str, list[float]]) -> np.ndarray:
    out = frame.copy()
    for line in rink.polylines():
        px = cam.project(line)
        cv2.polylines(out, [np.round(px).astype(np.int32)], False, (0, 255, 255), 2, cv2.LINE_AA)
    for x, y in clicks.values():
        cv2.circle(out, (int(round(x)), int(round(y))), 5, (0, 0, 255), -1)
    return out


def report(cam: FisheyeCamera, rms: float, rink: Rink, clicks: dict[str, list[float]]) -> str:
    coords = rink.landmarks()
    names = list(clicks)
    xy = np.array([coords[n] for n in names])
    px = np.array([clicks[n] for n in names])
    errs = leave_one_out_errors(cam, xy, px)
    near, far = errs[xy[:, 1] < 0], errs[xy[:, 1] >= 0]
    pos = cam.position
    lines = [
        f"points used: {len(names)}",
        f"fit error: {rms:.1f} px",
        f"camera position: x={pos[0]:.1f} m, {-pos[1]:.1f} m out from the rink centre, height {pos[2]:.1f} m",
    ]
    for label, e in (("near side", near), ("far side", far)):
        if np.isfinite(e).any():
            lines.append(f"held-out error, {label}: mean {np.nanmean(e):.2f} m, worst {np.nanmax(e):.2f} m")
    worst = int(np.nanargmax(errs)) if np.isfinite(errs).any() else None
    if worst is not None:
        lines.append(f"worst point: {names[worst]} ({errs[worst]:.2f} m) - re-click it if this is large")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video")
    ap.add_argument("--time", type=float, default=60.0, help="seconds into the video to take the frame from")
    ap.add_argument("--out", required=True, help="output path prefix, e.g. data/match1")
    ap.add_argument("--rink-length", type=float, default=40.0)
    ap.add_argument("--rink-width", type=float, default=20.0)
    ap.add_argument("--clicks", help="refit from a saved clicks file instead of opening a window")
    args = ap.parse_args()

    rink = Rink(args.rink_length, args.rink_width)
    frame = read_frame(args.video, args.time)
    h, w = frame.shape[:2]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.clicks:
        clicks = json.loads(Path(args.clicks).read_text())["clicks"]
    else:
        clicks = collect_clicks(frame, rink)
        Path(f"{out}.clicks.json").write_text(json.dumps(
            {"video": args.video, "time": args.time, "rink": [rink.length, rink.width], "clicks": clicks}, indent=2))

    if len(clicks) < MIN_POINTS:
        raise SystemExit(f"only {len(clicks)} points clicked; need at least {MIN_POINTS}, more is better")

    coords = rink.landmarks()
    names = list(clicks)
    cam, rms = fit_camera(np.array([coords[n] for n in names]), np.array([clicks[n] for n in names]), w, h)
    cam.save(f"{out}.calib.json")
    cv2.imwrite(f"{out}.overlay.jpg", draw_overlay(frame, cam, rink, clicks))
    print(report(cam, rms, rink, clicks))
    print(f"\nCheck {out}.overlay.jpg: the yellow lines should sit on the rink markings and boards.")


if __name__ == "__main__":
    main()
