# -*- coding: UTF-8 -*-
"""
Golden-chart tests for the chart-facts dossier (facts_version 1).

Reference: Jagannatha Hora export in AIAstra_Server/notes.txt — 2002-04-27 17:05 IST, 28N55 77E01
(lat 28.9167, lon 77.0167, tz +5.5), JHora "Lahiri" (= pyjhora TRUE_CITRA). Every field the dossier shares
with that export (longitudes, nakshatra/pada, navamsa, special lagnas, chara karakas, arudha lagna,
Vimshottari dates, panchanga) is checked here. A full-dossier snapshot catches unintended changes from
pyjhora upgrades; regenerate with ``JHORA_UPDATE_SNAPSHOT=1``.

Known tolerances (documented in docs/reading-engine/PHASE1-STATUS.md):
- longitudes 0.02° (JHora rounds to arc-seconds; Swiss Ephemeris nutation differences),
- Vimshottari mahadasha/antardasha boundaries ±7 days vs JHora,
- sunrise-based special lagnas (BL/HL/GL) 0.3°, Sree/Pranapada/Kunda 1.5° (error amplification),
- Vighati Lagna is not asserted (pyjhora and JHora disagree by hours of rate; tracked separately).
"""
from __future__ import annotations

import json
import os
from datetime import date
from typing import Any, Dict

import pytest

from jhora.facts import build_facts, build_natal_points

GOLDEN = dict(dob="2002-04-27", tob="17:05:00", lat=28.9167, lon=77.0167, tz=5.5, place_name="South Grafton, India")
AS_OF = "2026-10-24"
SNAPSHOT = os.path.join(os.path.dirname(__file__), "snapshots", "facts_golden_g1.json")

SIGN = {"Ar": 0, "Ta": 1, "Ge": 2, "Cn": 3, "Le": 4, "Vi": 5, "Li": 6, "Sc": 7, "Sg": 8, "Cp": 9, "Aq": 10, "Pi": 11}


def dms(sign: str, d: int, m: int, s: float) -> float:
    return SIGN[sign] * 30 + d + m / 60.0 + s / 3600.0


# notes.txt: Body, Longitude, Nakshatra, Pada, Rasi, Navamsa
JHORA_BODIES: Dict[str, Dict[str, Any]] = {
    "La": {"lon": dms("Vi", 20, 12, 57.44), "nak": "Hasta", "pada": 4, "nav": "Cn"},
    "Su": {"lon": dms("Ar", 13, 10, 10.48), "nak": "Ashwini", "pada": 4, "nav": "Cn"},
    "Mo": {"lon": dms("Li", 18, 7, 26.10), "nak": "Swati", "pada": 4, "nav": "Pi"},
    "Ma": {"lon": dms("Ta", 15, 28, 26.03), "nak": "Rohini", "pada": 2, "nav": "Ta"},
    "Me": {"lon": dms("Ta", 2, 15, 58.24), "nak": "Krittika", "pada": 2, "nav": "Cp"},
    "Ju": {"lon": dms("Ge", 16, 30, 54.68), "nak": "Ardra", "pada": 3, "nav": "Aq"},
    "Ve": {"lon": dms("Ta", 8, 15, 13.92), "nak": "Krittika", "pada": 4, "nav": "Pi"},
    "Sa": {"lon": dms("Ta", 19, 14, 17.44), "nak": "Rohini", "pada": 3, "nav": "Ge"},
    "Ra": {"lon": dms("Ta", 26, 19, 11.54), "nak": "Mrigashira", "pada": 1, "nav": "Le"},
    "Ke": {"lon": dms("Sc", 26, 19, 11.54), "nak": "Jyeshtha", "pada": 3, "nav": "Aq"},
    "Md": {"lon": dms("Ar", 27, 45, 37.12), "nak": "Krittika", "pada": 1},
    "Gk": {"lon": dms("Ar", 12, 42, 41.20), "nak": "Ashwini", "pada": 4},
}
JHORA_SPECIAL = {  # code: (longitude, tolerance deg)
    "BL": (dms("Li", 1, 47, 28.23), 0.3),
    "HL": (dms("Pi", 20, 52, 10.01), 0.3),
    "GL": (dms("Le", 18, 6, 15.36), 0.3),
    "SL": (dms("Cn", 29, 33, 42.09), 1.5),
    "PL": (dms("Vi", 4, 44, 6.12), 1.5),
    "IL": (dms("Ta", 18, 7, 26.10), 0.05),
    "BB": (dms("Le", 7, 13, 18.82), 0.05),
    "KL": (dms("Cn", 17, 29, 32.59), 1.5),
    "VNL": (dms("Le", 20, 12, 57.44), 0.05),
}
JHORA_KARAKAS = {"AK": "Sa", "AmK": "Mo", "BK": "Ju", "MK": "Ma", "PiK": "Su", "PK": "Ve", "GK": "Ra", "DK": "Me"}
# Vimsottari Dasa table in notes.txt (mahadasha starts and Saturn antardashas)
JHORA_MD = {"Ra": "1986-11-11", "Ju": "2004-11-11", "Sa": "2020-11-11", "Me": "2039-11-12", "Ke": "2056-11-11", "Ve": "2063-11-12"}
JHORA_SA_AD = {"Sa": "2020-11-11", "Me": "2023-11-14", "Ke": "2026-07-24", "Ve": "2027-09-03", "Su": "2030-11-02"}
DASHA_TOL_DAYS = 7


def ang(a: float, b: float) -> float:
    d = abs((a - b) % 360.0)
    return min(d, 360.0 - d)


@pytest.fixture(scope="module")
def dossier() -> Dict[str, Any]:
    return build_facts(**GOLDEN, ayanamsa="TRUE_CITRA", as_of=AS_OF)


def test_engine_block(dossier):
    assert dossier["v"] == 1
    assert dossier["engine"]["ayanamsa"] == "TRUE_CITRA"
    assert dossier["engine"]["houses"] == "whole_sign"
    assert dossier["as_of"] == AS_OF
    assert dossier["birth"]["lat"] == pytest.approx(28.9167)
    assert dossier["birth"]["lon"] == pytest.approx(77.0167)
    assert dossier["birth"]["tz"] == 5.5


@pytest.mark.parametrize("code", list(JHORA_BODIES.keys()))
def test_body_matches_jhora(dossier, code):
    ref = JHORA_BODIES[code]
    body = dossier["bodies"][code]
    assert ang(body["lon"], ref["lon"]) <= 0.02, (code, body["lon"], ref["lon"])
    assert body["nak"]["name"] == ref["nak"]
    assert body["nak"]["pada"] == ref["pada"]
    if "nav" in ref:
        assert body["navamsa_sign"] == SIGN[ref["nav"]]


def test_houses_from_virgo_lagna(dossier):
    h = dossier["houses"]
    assert h["1"]["sign_name"] == "Virgo" and h["1"]["lord"] == "Me"
    assert h["10"]["sign_name"] == "Gemini" and h["10"]["lord"] == "Me" and h["10"]["lord_house"] == 9
    assert h["10"]["occupants"] == ["Ju"]
    assert h["9"]["occupants"] == ["Ma", "Me", "Ve", "Sa", "Ra"]
    assert h["2"]["occupants"] == ["Mo"] and h["3"]["occupants"] == ["Ke"] and h["8"]["occupants"] == ["Su"]
    assert dossier["bodies"]["Me"]["house"] == 9 and dossier["bodies"]["Me"]["owns"] == [1, 10]


def test_chara_karakas_and_karakamsa(dossier):
    assert dossier["karakas"]["chara"] == JHORA_KARAKAS
    assert dossier["karakas"]["karakamsa"]["sign_name"] == "Gemini"  # AK Saturn's navamsa sign


def test_arudha_lagna(dossier):
    # South-Indian chart in notes.txt shows AL in Capricorn (5th from Virgo) and GL in Leo
    assert dossier["arudhas"]["AL"]["sign_name"] == "Capricorn"
    assert dossier["arudhas"]["AL"]["house"] == 5
    assert dossier["arudhas"]["A10"]["sign"] == dossier["arudhas"]["A10"]["sign"]  # present


@pytest.mark.parametrize("code", list(JHORA_SPECIAL.keys()))
def test_special_lagnas(dossier, code):
    ref, tol = JHORA_SPECIAL[code]
    got = dossier["special_lagnas"][code]["lon"]
    assert ang(got, ref) <= tol, (code, got, ref)


def test_vimshottari_matches_jhora_within_tolerance(dossier):
    vim = dossier["dasha"]["vimshottari"]
    mds = {m["md"]: m["start"] for m in vim["mahadashas"]}
    for lord, ref in JHORA_MD.items():
        got = date.fromisoformat(mds[lord])
        assert abs((got - date.fromisoformat(ref)).days) <= DASHA_TOL_DAYS, (lord, mds[lord], ref)
    ads = {p["ad"]: p["start"] for p in vim["periods"] if p["md"] == "Sa" and p["level"] == "ad"}
    pd_ads = {}
    for p in vim["periods"]:
        if p["md"] == "Sa" and p["level"] == "pd":
            pd_ads.setdefault(p["ad"], p["start"])
    ads.update({k: v for k, v in pd_ads.items() if k not in ads or v < ads[k]})
    for lord, ref in JHORA_SA_AD.items():
        got = date.fromisoformat(ads[lord])
        assert abs((got - date.fromisoformat(ref)).days) <= DASHA_TOL_DAYS, (lord, ads[lord], ref)
    cur = vim["current"]
    assert cur["md"] == "Sa" and cur["ad"] == "Ke" and cur.get("pd")
    assert cur["ad_start"] <= AS_OF < cur["ad_end"]
    assert cur["pd_start"] <= AS_OF < cur["pd_end"]


def test_panchanga_matches_jhora(dossier):
    p = dossier["panchanga"]
    assert p["tithi"] == "Krishna Pratipat" and p["tithi_lord"] == "Su"
    assert p["vara_name"] == "Saturday"
    assert p["nakshatra"] == "Swati" and p["nakshatra_lord"] == "Ra"
    assert p["yoga"] == "Siddhi"
    assert p["karana"] == "Balava"
    assert p["lunar_month"] == "Chaitra"
    assert p["sunrise"].startswith("05:48") and p["sunset"].startswith("18:50")


def test_varga_blocks_present(dossier):
    v = dossier["vargas"]
    for k in ("D1", "D2", "D3", "D4", "D7", "D9", "D10", "D12", "D30", "D60"):
        assert k in v, k
        assert set(v[k]["planets"].keys()) == {"Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"}
        assert len(v[k]["houses"]) == 12 and len(v[k]["d1_lord_positions"]) == 12
    assert v["D9"]["planets"]["Mo"]["sign"] == SIGN["Pi"]
    assert v["D1"]["lagna_sign"] == SIGN["Vi"]


def test_nakshatra_profile(dossier):
    n = dossier["nakshatra_profile"]
    assert n["janma"]["name"] == "Swati" and n["janma"]["lord"] == "Ra" and n["janma"]["pada"] == 4
    assert n["lagna"]["name"] == "Hasta"
    assert len(n["taras_from_janma"]) == 27 and n["taras_from_janma"]["Swati"] == "Janma"
    assert n["taras_from_janma"]["Vishakha"] == "Sampat"
    assert n["gandanta"] == {"moon": False, "lagna": False}


def test_natal_points_subset():
    np_ = build_natal_points(**GOLDEN, ayanamsa="TRUE_CITRA")
    assert np_["v"] == 1 and np_["lagna_sign"] == SIGN["Vi"] and np_["moon_sign"] == SIGN["Li"]
    assert ang(np_["points"]["Ju"]["lon"], JHORA_BODIES["Ju"]["lon"]) <= 0.02
    assert np_["arudha_signs"]["AL"] == SIGN["Cp"]
    assert np_["lord_of"]["10"] == "Me"


def _strip_volatile(d: Dict[str, Any]) -> Dict[str, Any]:
    out = json.loads(json.dumps(d))
    out["engine"]["commit"] = "<commit>"
    out["engine"]["pyjhora"] = "<version>"
    out.pop("meta", None)
    return out


def test_full_dossier_snapshot(dossier):
    """Byte-stable dossier for the golden chart; set JHORA_UPDATE_SNAPSHOT=1 to regenerate on purpose."""
    current = _strip_volatile(dossier)
    if os.environ.get("JHORA_UPDATE_SNAPSHOT") == "1" or not os.path.exists(SNAPSHOT):
        os.makedirs(os.path.dirname(SNAPSHOT), exist_ok=True)
        with open(SNAPSHOT, "w", encoding="utf-8", newline="\n") as f:
            json.dump(current, f, indent=1, sort_keys=True, ensure_ascii=False)
            f.write("\n")
    with open(SNAPSHOT, encoding="utf-8") as f:
        stored = json.load(f)
    assert current == stored, "dossier changed vs snapshot; review and set JHORA_UPDATE_SNAPSHOT=1 if intended"


def test_facts_compute_under_three_seconds():
    """Warm call (imports and ephemeris already loaded) must stay under the 3 s Lambda budget."""
    import time

    build_facts(**GOLDEN, ayanamsa="TRUE_CITRA", as_of=AS_OF)  # warm-up
    t0 = time.perf_counter()
    d = build_facts(**GOLDEN, ayanamsa="TRUE_CITRA", as_of=AS_OF)
    elapsed = time.perf_counter() - t0
    assert elapsed < 3.0, "facts took %.2fs" % elapsed
    assert d["meta"]["compute_ms"] < 3000
