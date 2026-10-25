# -*- coding: UTF-8 -*-
"""Transit snapshot tests: shape, monotonic ingress dates, known events, timing."""
from __future__ import annotations

import time
from datetime import date

import pytest

from jhora.transits import TRANSIT_PLANETS, build_transits


@pytest.fixture(scope="module")
def snap():
    return build_transits("2026-10-24", "2028-10-24", lat=28.9167, lon=77.0167, tz=5.5, ayanamsa="TRUE_CITRA")


def test_shape(snap):
    assert snap["v"] == 1 and snap["ayanamsa"] == "TRUE_CITRA"
    assert snap["from"] == "2026-10-24" and snap["to"] == "2028-10-24"
    assert snap["planets"] == TRANSIT_PLANETS
    assert snap["positions"][0]["date"] == "2026-10-24"
    assert snap["positions"][-1]["date"] == "2028-10-24"
    # daily for 60 days then weekly
    dates = [r["date"] for r in snap["positions"]]
    assert dates[59] == "2026-12-22" and dates[60] == "2026-12-29"
    for row in snap["positions"][:3]:
        for p in TRANSIT_PLANETS:
            assert 0.0 <= row[p]["lon"] < 360.0 and 0 <= row[p]["sign"] <= 11 and 0 <= row[p]["nak_idx"] <= 26
    assert len(snap["ingresses"]) > 50 and len(snap["lunations"]) >= 48


def test_ingress_dates_monotonic_per_planet(snap):
    for p in TRANSIT_PLANETS:
        for kind in ("sign", "nak"):
            ds = [r["date"] for r in snap["ingresses"] if r["planet"] == p and r["kind"] == kind]
            assert ds == sorted(ds), (p, kind)
            assert len(ds) == len(set(ds)) or p in ("Su", "Me", "Ve", "Ma"), (p, kind)


def test_ingress_consistent_with_positions(snap):
    """The sign reported on a date must agree with the most recent sign ingress before it."""
    for p in ("Sa", "Ju", "Ra", "Ke"):
        ing = [r for r in snap["ingresses"] if r["planet"] == p and r["kind"] == "sign"]
        for row in snap["positions"]:
            before = [r for r in ing if r["date"] <= row["date"]]
            if before:
                assert row[p]["sign"] == before[-1]["into"], (p, row["date"])


def test_nodes_always_retro_and_opposite(snap):
    for row in snap["positions"]:
        assert row["Ra"]["retro"] is True and row["Ke"]["retro"] is True
        assert abs(((row["Ke"]["lon"] - row["Ra"]["lon"]) % 360.0) - 180.0) < 0.01


def test_lunations_alternate_and_spaced(snap):
    kinds = [r["kind"] for r in snap["lunations"]]
    for a, b in zip(kinds, kinds[1:]):
        assert a != b
    ds = [date.fromisoformat(r["date"]) for r in snap["lunations"]]
    for a, b in zip(ds, ds[1:]):
        assert 13 <= (b - a).days <= 17


def test_stations_only_for_true_planets(snap):
    assert all(r["planet"] in ("Ma", "Me", "Ju", "Ve", "Sa") for r in snap["stations"])
    kinds = [r for r in snap["stations"] if r["planet"] == "Me"]
    assert len(kinds) >= 6  # Mercury stations ~6 times in two years


def test_daily_step_and_moon_option():
    s = build_transits("2026-01-01", "2026-01-10", step="daily", include_moon=True)
    assert len(s["positions"]) == 10 and "Mo" in s["planets"]
    assert any(r["planet"] == "Mo" and r["kind"] == "nak" for r in s["ingresses"])


def test_bad_ranges():
    with pytest.raises(ValueError):
        build_transits("2026-10-24", "2026-10-01")
    with pytest.raises(ValueError):
        build_transits("2020-01-01", "2026-01-01")


def test_transits_two_years_under_three_seconds():
    build_transits("2026-01-01", "2026-01-05")  # warm-up
    t0 = time.perf_counter()
    build_transits("2026-10-24", "2028-10-24", lat=28.9167, lon=77.0167, tz=5.5)
    assert time.perf_counter() - t0 < 3.0
