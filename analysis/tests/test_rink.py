import numpy as np
from pytest import approx

from floorball_analysis.rink import Rink


def test_official_distances_on_full_rink():
    lm = Rink().landmarks()
    assert lm["right_post_far"] == approx((16.5, 0.8))  # goal line 3.5 m from the end, posts 1.6 m apart
    assert lm["left_crease_back_near"] == approx((-17.15, -2.5))
    assert lm["left_crease_front_near"] == approx((-13.15, -2.5))
    assert lm["right_gk_front_far"] == approx((15.5, 1.25))
    assert lm["right_faceoff_near"] == approx((16.5, -8.5))
    assert lm["centre_faceoff_far"] == approx((0.0, 8.5))


def test_markings_keep_distance_from_boards_on_small_rink():
    lm = Rink(length=36, width=18).landmarks()
    assert lm["right_post_far"] == approx((14.5, 0.8))
    assert lm["left_faceoff_far"] == approx((-14.5, 7.5))


def test_landmarks_are_mirror_symmetric():
    lm = Rink().landmarks()
    for name, (x, y) in lm.items():
        if name.startswith("left_"):
            assert lm["right_" + name[5:]] == (-x, y)


def test_contains():
    rink = Rink()
    pts = np.array([[0, 0], [20.5, 0], [0, -10.5]])
    assert rink.contains(pts).tolist() == [True, False, False]
    assert rink.contains(pts, margin=1.0).all()


def test_polylines_stay_inside_boards():
    rink = Rink()
    for line in rink.polylines():
        assert rink.contains(line, margin=1e-9).all()
