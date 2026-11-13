"""Rink geometry in metres (PLAN.md Rule 1).

Origin at the rink centre, x along the length, y along the width.
Convention for footage: the camera stands on the y < 0 long side, so
"near" means y < 0, "far" means y > 0, and "left" means x < 0 as seen
from the camera.

Dimensions follow the IFF Rules of the Game (valid from 1 July 2026),
rules 101-102. Markings keep their official distance from the boards at
any rink size.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

CREASE_FROM_END = 2.85  # goal crease starts this far from the short side
CREASE_DEPTH = 4.0  # along the rink length
CREASE_WIDTH = 5.0
GK_AREA_FROM_CREASE_REAR = 0.65
GK_AREA_DEPTH = 1.0
GK_AREA_WIDTH = 2.5
GOAL_WIDTH = 1.6
GOAL_DEPTH = 0.6
FACEOFF_FROM_SIDE = 1.5
GOAL_LINE_FROM_END = CREASE_FROM_END + GK_AREA_FROM_CREASE_REAR  # 3.5 m


@dataclass(frozen=True)
class Rink:
    length: float = 40.0
    width: float = 20.0
    corner_radius: float = 2.0  # not set by the rules; depends on the board maker

    @property
    def half_length(self) -> float:
        return self.length / 2

    @property
    def half_width(self) -> float:
        return self.width / 2

    def contains(self, xy: np.ndarray, margin: float = 0.0) -> np.ndarray:
        """True for points inside the boards (rounded corners ignored), grown by margin."""
        xy = np.atleast_2d(xy)
        return (np.abs(xy[:, 0]) <= self.half_length + margin) & (
            np.abs(xy[:, 1]) <= self.half_width + margin
        )

    def landmarks(self) -> dict[str, tuple[float, float]]:
        """Named points a person can find in a frame, used for calibration."""
        hl, hw = self.half_length, self.half_width
        pts: dict[str, tuple[float, float]] = {
            "centre_spot": (0.0, 0.0),
            "centre_line_near": (0.0, -hw),
            "centre_line_far": (0.0, hw),
            "centre_faceoff_near": (0.0, -(hw - FACEOFF_FROM_SIDE)),
            "centre_faceoff_far": (0.0, hw - FACEOFF_FROM_SIDE),
        }
        for side, s in (("left", -1.0), ("right", 1.0)):
            crease_back = s * (hl - CREASE_FROM_END)
            crease_front = s * (hl - CREASE_FROM_END - CREASE_DEPTH)
            goal_line = s * (hl - GOAL_LINE_FROM_END)
            gk_front = s * (hl - GOAL_LINE_FROM_END - GK_AREA_DEPTH)
            for depth, d in (("near", -1.0), ("far", 1.0)):
                pts[f"{side}_crease_back_{depth}"] = (crease_back, d * CREASE_WIDTH / 2)
                pts[f"{side}_crease_front_{depth}"] = (crease_front, d * CREASE_WIDTH / 2)
                pts[f"{side}_gk_back_{depth}"] = (goal_line, d * GK_AREA_WIDTH / 2)
                pts[f"{side}_gk_front_{depth}"] = (gk_front, d * GK_AREA_WIDTH / 2)
                pts[f"{side}_post_{depth}"] = (goal_line, d * GOAL_WIDTH / 2)
                pts[f"{side}_faceoff_{depth}"] = (goal_line, d * (hw - FACEOFF_FROM_SIDE))
        return pts

    def polylines(self, step: float = 0.25) -> list[np.ndarray]:
        """Rink markings as densely sampled polylines, so a fisheye lens can bend them."""
        hl, hw, r = self.half_length, self.half_width, self.corner_radius
        lines = [_dense(_rounded_rect(hl, hw, r), step), _dense(np.array([[0, -hw], [0, hw]]), step)]
        for s in (-1.0, 1.0):
            x0 = s * (hl - CREASE_FROM_END)
            x1 = s * (hl - CREASE_FROM_END - CREASE_DEPTH)
            lines.append(_dense(_rect(x0, x1, CREASE_WIDTH / 2), step))
            g0 = s * (hl - GOAL_LINE_FROM_END)
            g1 = s * (hl - GOAL_LINE_FROM_END - GK_AREA_DEPTH)
            lines.append(_dense(_rect(g0, g1, GK_AREA_WIDTH / 2), step))
        return lines


def _rect(x0: float, x1: float, half_w: float) -> np.ndarray:
    return np.array([[x0, -half_w], [x1, -half_w], [x1, half_w], [x0, half_w], [x0, -half_w]])


def _rounded_rect(hl: float, hw: float, r: float) -> np.ndarray:
    r = min(r, hl, hw)
    pts = []
    for cx, cy, start in ((hl - r, hw - r, 0), (-(hl - r), hw - r, 90), (-(hl - r), -(hw - r), 180), (hl - r, -(hw - r), 270)):
        a = np.radians(np.linspace(start, start + 90, 13))
        pts.append(np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], axis=1))
    out = np.concatenate(pts)
    return np.vstack([out, out[:1]])


def _dense(poly: np.ndarray, step: float) -> np.ndarray:
    out = [poly[:1]]
    for a, b in zip(poly[:-1], poly[1:]):
        n = max(1, int(np.ceil(np.linalg.norm(b - a) / step)))
        t = np.linspace(0, 1, n + 1)[1:, None]
        out.append(a + (b - a) * t)
    return np.concatenate(out)
