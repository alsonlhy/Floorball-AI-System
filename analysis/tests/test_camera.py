import numpy as np
import pytest

from floorball_analysis.camera import FisheyeCamera, _look_at, fit_camera, leave_one_out_errors
from floorball_analysis.rink import Rink

W, H = 1920, 1080


def make_camera(position=(0.6, -13.0, 3.2), target=(0.0, -2.0, 0.0), f=620.0, k1=-0.02, k2=0.003):
    rvec, tvec = _look_at(np.array(position), np.array(target))
    return FisheyeCamera(f, W / 2 + 12, H / 2 - 9, k1, k2, rvec, tvec, W, H)


def test_look_at_recovers_position():
    cam = make_camera()
    assert np.allclose(cam.position, [0.6, -13.0, 3.2])


def test_project_then_to_rink_round_trips():
    cam = make_camera()
    xy = np.array([[0, 0], [-18, 8], [19, -9], [5, 9.5], [-12, -7]], dtype=float)
    assert np.allclose(cam.to_rink(cam.project(xy)), xy, atol=1e-6)


def test_whole_rink_is_in_frame_for_the_test_camera():
    px = make_camera().project(np.array(list(Rink().landmarks().values())))
    assert (px[:, 0] > 0).all() and (px[:, 0] < W).all()
    assert (px[:, 1] > 0).all() and (px[:, 1] < H).all()


def test_ray_that_misses_the_floor_is_nan():
    cam = make_camera()
    assert np.isnan(cam.to_rink(np.array([[W / 2, 5.0]]))).all()  # top of frame looks above the horizon


@pytest.mark.parametrize("position", [(0.6, -13.0, 3.2), (-1.0, -12.0, 2.0), (0.0, -16.0, 7.0)])
def test_fit_recovers_floor_mapping_from_noisy_clicks(position):
    rng = np.random.default_rng(0)
    truth = make_camera(position=position)
    xy = np.array(list(Rink().landmarks().values()))
    clicks = truth.project(xy) + rng.normal(0, 1.0, (len(xy), 2))  # 1 px click noise

    cam, rms = fit_camera(xy, clicks, W, H)
    assert rms < 2.5

    # Judge on points that were not clicked: a grid over the whole rink.
    gx, gy = np.meshgrid(np.linspace(-19, 19, 20), np.linspace(-9, 9, 10))
    grid = np.stack([gx.ravel(), gy.ravel()], axis=1)
    err = np.linalg.norm(cam.to_rink(truth.project(grid)) - grid, axis=1)
    assert err.mean() < 0.25
    assert err.max() < 1.0


def test_leave_one_out_errors_are_small_for_clean_clicks():
    truth = make_camera()
    xy = np.array(list(Rink().landmarks().values()))
    clicks = truth.project(xy)
    cam, _ = fit_camera(xy, clicks, W, H)
    errs = leave_one_out_errors(cam, xy, clicks)
    assert np.nanmax(errs) < 0.2


def test_save_and_load(tmp_path):
    cam = make_camera()
    cam.save(tmp_path / "c.json")
    again = FisheyeCamera.load(tmp_path / "c.json")
    xy = np.array([[3.0, 4.0]])
    assert np.allclose(cam.project(xy), again.project(xy))
