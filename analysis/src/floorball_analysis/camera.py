"""Fixed fisheye camera: fit it from clicked rink points, then map pixels to the rink.

The lens follows the equidistant fisheye model with two distortion terms
(the same model as OpenCV's cv2.fisheye). Everything is fitted from one
frame, because the camera does not move and all landmarks lie on the floor.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares
from scipy.spatial.transform import Rotation

MIN_POINTS = 8


@dataclass
class FisheyeCamera:
    f: float
    cx: float
    cy: float
    k1: float
    k2: float
    rvec: np.ndarray
    tvec: np.ndarray
    width: int
    height: int

    @property
    def rotation(self) -> np.ndarray:
        return Rotation.from_rotvec(self.rvec).as_matrix()

    @property
    def position(self) -> np.ndarray:
        """Camera position in rink metres (z is height above the floor)."""
        return -self.rotation.T @ self.tvec

    def project(self, world: np.ndarray) -> np.ndarray:
        """Rink points (N,3), or (N,2) on the floor, to pixels (N,2)."""
        return _project(self._params(), _as_3d(world))

    def to_rink(self, pixels: np.ndarray, z: float = 0.0) -> np.ndarray:
        """Pixels (N,2) to rink xy (N,2) on the plane at height z. NaN where the ray misses."""
        px = np.atleast_2d(np.asarray(pixels, dtype=float))
        x = (px[:, 0] - self.cx) / self.f
        y = (px[:, 1] - self.cy) / self.f
        theta_d = np.hypot(x, y)
        theta = theta_d.copy()
        for _ in range(20):  # Newton's method on the distortion polynomial
            t2 = theta * theta
            g = theta * (1 + self.k1 * t2 + self.k2 * t2 * t2) - theta_d
            dg = 1 + 3 * self.k1 * t2 + 5 * self.k2 * t2 * t2
            theta = theta - g / dg
        safe = np.where(theta_d > 1e-12, theta_d, 1.0)
        d_cam = np.stack([np.sin(theta) * x / safe, np.sin(theta) * y / safe, np.cos(theta)], axis=1)
        d_world = d_cam @ self.rotation  # R^T applied to each row
        c = self.position
        with np.errstate(divide="ignore", invalid="ignore"):
            s = (z - c[2]) / d_world[:, 2]
        out = c[:2] + s[:, None] * d_world[:, :2]
        out[~(np.isfinite(s) & (s > 0))] = np.nan
        return out

    def _params(self) -> np.ndarray:
        return np.concatenate([[self.f, self.cx, self.cy, self.k1, self.k2], self.rvec, self.tvec])

    def save(self, path: str | Path) -> None:
        data = {
            "model": "fisheye-equidistant-k2",
            "f": self.f, "cx": self.cx, "cy": self.cy, "k1": self.k1, "k2": self.k2,
            "rvec": list(map(float, self.rvec)), "tvec": list(map(float, self.tvec)),
            "width": self.width, "height": self.height,
        }
        Path(path).write_text(json.dumps(data, indent=2))

    @classmethod
    def load(cls, path: str | Path) -> "FisheyeCamera":
        d = json.loads(Path(path).read_text())
        return cls(d["f"], d["cx"], d["cy"], d["k1"], d["k2"],
                   np.array(d["rvec"]), np.array(d["tvec"]), d["width"], d["height"])


def _as_3d(world: np.ndarray) -> np.ndarray:
    w = np.atleast_2d(np.asarray(world, dtype=float))
    if w.shape[1] == 2:
        w = np.hstack([w, np.zeros((len(w), 1))])
    return w


def _project(p: np.ndarray, world: np.ndarray) -> np.ndarray:
    f, cx, cy, k1, k2 = p[:5]
    pc = world @ Rotation.from_rotvec(p[5:8]).as_matrix().T + p[8:11]
    rho = np.hypot(pc[:, 0], pc[:, 1])
    theta = np.arctan2(rho, pc[:, 2])
    t2 = theta * theta
    theta_d = theta * (1 + k1 * t2 + k2 * t2 * t2)
    scale = np.where(rho > 1e-12, theta_d / np.where(rho > 1e-12, rho, 1.0), 0.0)
    return np.stack([f * scale * pc[:, 0] + cx, f * scale * pc[:, 1] + cy], axis=1)


def _look_at(position: np.ndarray, target: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Pose (rvec, tvec) of a level camera at position looking at target; world z is up."""
    forward = target - position
    forward = forward / np.linalg.norm(forward)
    right = np.cross(forward, [0.0, 0.0, 1.0])
    right = right / np.linalg.norm(right)
    down = np.cross(forward, right)
    rot = np.stack([right, down, forward])
    return Rotation.from_matrix(rot).as_rotvec(), -rot @ position


def _residuals(p: np.ndarray, world: np.ndarray, pixels: np.ndarray, width: int, height: int) -> np.ndarray:
    reproj = (_project(p, world) - pixels).ravel()
    # One frame of floor points pins the optical centre only weakly, so pull it
    # gently towards the image centre (a 10% offset costs about 5 px).
    prior = 50.0 * np.array([(p[1] - width / 2) / width, (p[2] - height / 2) / height])
    return np.concatenate([reproj, prior])


def _fit_from(p0: np.ndarray, world: np.ndarray, pixels: np.ndarray, width: int, height: int):
    return least_squares(_residuals, p0, args=(world, pixels, width, height), method="lm", max_nfev=600)


def _camera(p: np.ndarray, width: int, height: int) -> FisheyeCamera:
    return FisheyeCamera(*map(float, p[:5]), np.array(p[5:8]), np.array(p[8:11]), width, height)


def fit_camera(rink_xy: np.ndarray, pixels: np.ndarray, width: int, height: int) -> tuple[FisheyeCamera, float]:
    """Fit the camera from floor points and where they appear in the frame.

    Assumes the camera is on the y < 0 side of the rink. Returns the camera and
    the RMS reprojection error in pixels.
    """
    world = _as_3d(rink_xy)
    pixels = np.asarray(pixels, dtype=float)
    if len(world) < MIN_POINTS:
        raise ValueError(f"need at least {MIN_POINTS} points, got {len(world)}")

    best = None
    for dist in (11.0, 14.0, 18.0, 25.0):
        for cam_h in (1.5, 3.0, 6.0, 10.0):
            for f_frac in (0.25, 0.35, 0.5, 0.8):
                rvec, tvec = _look_at(np.array([0.0, -dist, cam_h]), np.zeros(3))
                p0 = np.concatenate([[f_frac * width, width / 2, height / 2, 0.0, 0.0], rvec, tvec])
                try:
                    res = _fit_from(p0, world, pixels, width, height)
                except Exception:
                    continue
                cam = _camera(res.x, width, height)
                if cam.f <= 0 or cam.position[2] <= 0.3 or cam.position[1] >= 0:
                    continue
                if best is None or res.cost < best.cost:
                    best = res
    if best is None:
        raise RuntimeError("calibration did not converge; check the clicked points")
    cam = _camera(best.x, width, height)
    rms = float(np.sqrt(np.mean(np.sum((cam.project(world) - pixels) ** 2, axis=1))))
    return cam, rms


def leave_one_out_errors(cam: FisheyeCamera, rink_xy: np.ndarray, pixels: np.ndarray) -> np.ndarray:
    """For each point: refit without it, then measure how far (metres) its pixel lands from it.

    This is the honest accuracy figure, since the point was not used in its own fit.
    """
    world = _as_3d(rink_xy)
    pixels = np.asarray(pixels, dtype=float)
    errs = np.full(len(world), np.nan)
    if len(world) <= MIN_POINTS:
        return errs
    for i in range(len(world)):
        keep = np.arange(len(world)) != i
        res = _fit_from(cam._params(), world[keep], pixels[keep], cam.width, cam.height)
        est = _camera(res.x, cam.width, cam.height).to_rink(pixels[i : i + 1])[0]
        errs[i] = np.linalg.norm(est - world[i, :2])
    return errs
