# -*- coding: UTF-8 -*-
"""
DRAFT (parked, not in Radha). Stand-in for the future pyjhora Lambda export ``type=transits`` served per kundli.

Takes the natal dossier (``facts``) and the global transit snapshot and places every transit period against the
natal chart: house from Lagna / Moon / Arudha Lagna, natal planets in the transited sign, nakshatra-level
segments for the slow planets, double transit (Jupiter + Saturn influence on the same house), Sade Sati phases.
The Node server consumes exactly this shape (src/reading/transits/types.ts) and computes nothing itself.

Used only to generate evals/fixtures/G1/transits.v1.json until the Lambda serves the same payload.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Tuple

SIGN_NAMES = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
PLANETS = ["Su", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"]
SLOW = ["Ju", "Sa", "Ra", "Ke"]
CODE_IDX = {"Su": 0, "Mo": 1, "Ma": 2, "Me": 3, "Ju": 4, "Ve": 5, "Sa": 6, "Ra": 7, "Ke": 8}
GRAHA_DRISHTI = {"Su": [7], "Ma": [4, 7, 8], "Me": [7], "Ju": [5, 7, 9], "Ve": [7], "Sa": [3, 7, 10], "Ra": [7], "Ke": [7]}


def _house(lagna_sign: int, sign: int) -> int:
    return (sign - lagna_sign) % 12 + 1


def _influence_houses(lagna_sign: int, planet: str, sign: int) -> List[int]:
    """Houses (from natal Lagna) the transiting planet occupies or aspects (Parashari graha drishti)."""
    out = {_house(lagna_sign, sign)}
    for h in GRAHA_DRISHTI[planet]:
        out.add(_house(lagna_sign, (sign + h - 1) % 12))
    return sorted(out)


def build_transit_chart(natal: Dict[str, Any], snap: Dict[str, Any], as_of: str) -> Dict[str, Any]:
    bodies = natal["bodies"]
    lagna_sign = bodies["La"]["sign"]
    moon_sign = bodies["Mo"]["sign"]
    al_sign = natal["arudhas"]["AL"]["sign"]
    sav = natal["ashtakavarga"]["sav"]
    bav = natal["ashtakavarga"]["bav"]
    natal_by_sign: Dict[int, List[str]] = {}
    natal_by_nak: Dict[str, List[str]] = {}
    for code in ("Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"):
        natal_by_sign.setdefault(bodies[code]["sign"], []).append(code)
        natal_by_nak.setdefault(bodies[code]["nak"]["name"], []).append(code)
    natal_by_sign.setdefault(lagna_sign, []).append("La")
    natal_by_nak.setdefault(bodies["La"]["nak"]["name"], []).append("La")

    d_from, d_to = date.fromisoformat(snap["from"]), date.fromisoformat(snap["to"])
    first = snap["positions"][0]
    rows: List[Dict[str, Any]] = []
    for p in PLANETS:
        sign_ing = [i for i in snap["ingresses"] if i["planet"] == p and i["kind"] == "sign"]
        nak_ing = [i for i in snap["ingresses"] if i["planet"] == p and i["kind"] == "nak"]
        bounds: List[Tuple[date, int, bool]] = [(d_from, first[p]["sign"], bool(first[p]["retro"]))]
        for i in sign_ing:
            bounds.append((date.fromisoformat(i["date"]), int(i["into"]), bool(i["retro"])))
        for k, (start, sign, retro) in enumerate(bounds):
            end = (bounds[k + 1][0] - timedelta(days=1)) if k + 1 < len(bounds) else d_to
            if end < start:
                end = start
            row: Dict[str, Any] = {
                "planet": p,
                "from": start.isoformat(),
                "to": end.isoformat(),
                "sign": sign,
                "sign_name": SIGN_NAMES[sign],
                "retro_on_entry": retro,
                "house_from_lagna": _house(lagna_sign, sign),
                "house_from_moon": _house(moon_sign, sign),
                "house_from_al": _house(al_sign, sign),
                "over_natal": [c for c in natal_by_sign.get(sign, []) if c != p or True],
                "influences_houses": _influence_houses(lagna_sign, p, sign),
                "sav": sav[sign],
            }
            if p in bav:
                row["bav"] = bav[p][sign]
            if p in SLOW:
                segs = []
                cur_nak = None
                # nakshatra at the start of the period: last nak ingress on/before start, else first position
                prior = [i for i in nak_ing if date.fromisoformat(i["date"]) <= start]
                cur_nak = prior[-1]["into"] if prior else first[p]["nak"]
                seg_start = start
                for i in nak_ing:
                    di = date.fromisoformat(i["date"])
                    if di <= start or di > end:
                        continue
                    segs.append({"from": seg_start.isoformat(), "to": (di - timedelta(days=1)).isoformat(), "nak": cur_nak, "over_natal_nak": natal_by_nak.get(cur_nak, [])})
                    seg_start, cur_nak = di, i["into"]
                segs.append({"from": seg_start.isoformat(), "to": end.isoformat(), "nak": cur_nak, "over_natal_nak": natal_by_nak.get(cur_nak, [])})
                row["nak_segments"] = segs
            rows.append(row)
    rows.sort(key=lambda r: (r["from"], PLANETS.index(r["planet"])))

    # double transit: Jupiter and Saturn influence the same natal house at the same time
    cuts = sorted({d_from, d_to} | {date.fromisoformat(r["from"]) for r in rows if r["planet"] in ("Ju", "Sa")})
    dt: List[Dict[str, Any]] = []
    for k, a in enumerate(cuts):
        b = (cuts[k + 1] - timedelta(days=1)) if k + 1 < len(cuts) else d_to
        if b < a:
            continue
        ju = next(r for r in rows if r["planet"] == "Ju" and r["from"] <= a.isoformat() <= r["to"])
        sa = next(r for r in rows if r["planet"] == "Sa" and r["from"] <= a.isoformat() <= r["to"])
        houses = sorted(set(ju["influences_houses"]) & set(sa["influences_houses"]))
        if houses and dt and dt[-1]["houses"] == houses and dt[-1]["to"] == (a - timedelta(days=1)).isoformat():
            dt[-1]["to"] = b.isoformat()
        elif houses:
            dt.append({"from": a.isoformat(), "to": b.isoformat(), "houses": houses, "jupiter_sign": ju["sign"], "saturn_sign": sa["sign"]})

    # Sade Sati and dhaiyya from Saturn's house from the natal Moon
    sade: List[Dict[str, Any]] = []
    for r in rows:
        if r["planet"] != "Sa":
            continue
        h = r["house_from_moon"]
        phase = {12: "sade_sati_rising", 1: "sade_sati_peak", 2: "sade_sati_setting", 4: "kantaka_dhaiyya", 8: "ashtama_dhaiyya"}.get(h)
        if phase:
            sade.append({"from": r["from"], "to": r["to"], "phase": phase, "saturn_sign": r["sign"], "house_from_moon": h})

    def at(d: str, p: str) -> Dict[str, Any]:
        return next(r for r in rows if r["planet"] == p and r["from"] <= d <= r["to"])

    now = {p: {k: at(as_of, p)[k] for k in ("sign", "sign_name", "house_from_lagna", "house_from_moon", "house_from_al", "over_natal", "from", "to")} for p in PLANETS}
    sade_now = next((s for s in sade if s["from"] <= as_of <= s["to"]), None)
    return {
        "v": 1,
        "kind": "natal_overlay",
        "ayanamsa": snap["ayanamsa"],
        "as_of": as_of,
        "from": snap["from"],
        "to": snap["to"],
        "natal": {"lagna_sign": lagna_sign, "moon_sign": moon_sign, "al_sign": al_sign, "moon_nak": bodies["Mo"]["nak"]["name"]},
        "now": now,
        "rows": rows,
        "double_transit": dt,
        "sade_sati": {"now": sade_now, "periods": sade},
        "stations": snap["stations"],
        "lunations": [l for l in snap["lunations"] if l["date"] <= (date.fromisoformat(as_of) + timedelta(days=190)).isoformat()],
    }
