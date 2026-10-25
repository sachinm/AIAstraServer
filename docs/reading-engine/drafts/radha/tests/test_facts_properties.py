# -*- coding: UTF-8 -*-
"""Property tests for the dossier (03-chart-facts-dossier.md §5) on random birth data."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from jhora.facts import PLANET_CODES, build_facts

birth = st.builds(
    dict,
    dob=st.dates(min_value=date(1940, 1, 1), max_value=date(2024, 12, 31)).map(lambda d: d.isoformat()),
    tob=st.tuples(st.integers(0, 23), st.integers(0, 59)).map(lambda t: "%02d:%02d:00" % t),
    lat=st.floats(min_value=-55.0, max_value=65.0, allow_nan=False, allow_infinity=False).map(lambda x: round(x, 3)),
    lon=st.floats(min_value=-179.0, max_value=179.0, allow_nan=False, allow_infinity=False).map(lambda x: round(x, 3)),
    tz=st.sampled_from([-8.0, -5.0, 0.0, 1.0, 3.0, 5.5, 8.0, 10.0]),
)


def _check_invariants(d):
    houses = d["houses"]
    assert len(houses) == 12
    lords = [houses[str(h)]["lord"] for h in range(1, 13)]
    for h in range(1, 13):
        assert houses[str(h)]["lord"] in PLANET_CODES[:7]
    # houses_of is the inverse of lord_of
    inverse = {}
    for h, lord in d["relations"]["lord_of"].items():
        inverse.setdefault(lord, []).append(int(h))
    assert {k: sorted(v) for k, v in inverse.items()} == {k: sorted(v) for k, v in d["relations"]["houses_of"].items()}
    # every body sits in a house 1..12 and the lagna sign is house 1
    for code in PLANET_CODES:
        b = d["bodies"][code]
        assert 1 <= b["house"] <= 12
        assert b["house"] == (b["sign"] - d["bodies"]["La"]["sign"]) % 12 + 1
        assert 0 <= b["sign"] <= 11 and 0 <= b["deg_in_sign"] < 30.0
        assert 0 <= b["nak"]["idx"] <= 26 and 1 <= b["nak"]["pada"] <= 4
    occupants = sum(len(houses[str(h)]["occupants"]) for h in range(1, 13))
    assert occupants == 9
    # Vimshottari: mahadashas contiguous and 120 years; AD rows contiguous inside each MD
    mds = d["dasha"]["vimshottari"]["mahadashas"]
    assert len(mds) == 9
    for a, b in zip(mds, mds[1:]):
        assert a["end"] == b["start"]
    span = date.fromisoformat(mds[-1]["end"]) - date.fromisoformat(mds[0]["start"])
    assert abs(span.days - 120 * 365.2564) < 3
    cur = d["dasha"]["vimshottari"]["current"]
    assert cur["md"] in PLANET_CODES and cur["ad"] in PLANET_CODES
    periods = d["dasha"]["vimshottari"]["periods"]
    assert periods == sorted(periods, key=lambda r: r["start"])
    for p in periods:
        assert p["start"] <= p["end"]
    # vargas: each varga has 12 houses with exactly one lord each and 9 planets
    for name, v in d["vargas"].items():
        assert len(v["houses"]) == 12
        assert sum(len(h["occupants"]) for h in v["houses"].values()) == 9
    # functional classes partition the 9 planets
    f = d["relations"]["functional"]
    assert sorted(f["benefic"] + f["malefic"] + f["neutral"]) == sorted(PLANET_CODES)
    assert len(d["nakshatra_profile"]["taras_from_janma"]) == 27


@settings(max_examples=6, deadline=None, suppress_health_check=[HealthCheck.too_slow])
@given(b=birth)
def test_dossier_invariants_random_births(b):
    d = build_facts(b["dob"], b["tob"], b["lat"], b["lon"], b["tz"], ayanamsa="TRUE_CITRA", as_of="2026-10-24", vargas=["D1", "D9", "D10"])
    _check_invariants(d)


def test_dossier_invariants_scorpio_and_aquarius_lagna():
    # dual-lord signs: Scorpio (Ma/Ke) and Aquarius (Sa/Ra) carry co_lord fields
    d = build_facts("1990-11-15", "06:30:00", 13.08, 80.27, 5.5, ayanamsa="TRUE_CITRA", as_of="2026-10-24", vargas=["D1", "D9"])
    _check_invariants(d)
    sc = [h for h in d["houses"].values() if h["sign_name"] == "Scorpio"][0]
    aq = [h for h in d["houses"].values() if h["sign_name"] == "Aquarius"][0]
    assert sc["lord"] == "Ma" and sc["co_lord"] == "Ke"
    assert aq["lord"] == "Sa" and aq["co_lord"] == "Ra"


def test_as_of_only_moves_current_flags():
    base = dict(dob="2002-04-27", tob="17:05:00", lat=28.9167, lon=77.0167, tz=5.5, ayanamsa="TRUE_CITRA", vargas=["D1", "D9"])
    a = build_facts(**base, as_of="2026-10-24")
    b = build_facts(**base, as_of="2027-10-24")
    assert a["bodies"] == b["bodies"] and a["houses"] == b["houses"] and a["vargas"] == b["vargas"]
    assert a["dasha"]["vimshottari"]["mahadashas"] == b["dasha"]["vimshottari"]["mahadashas"]
    assert a["dasha"]["vimshottari"]["current"] != b["dasha"]["vimshottari"]["current"]


def test_unsupported_ayanamsa_rejected():
    with pytest.raises(ValueError):
        build_facts("2002-04-27", "17:05:00", 28.9167, 77.0167, 5.5, ayanamsa="NOT_A_MODE")
