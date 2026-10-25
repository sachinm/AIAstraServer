# -*- coding: UTF-8 -*-
"""
Global transit snapshot (AI Astra reading engine, snapshot_version 1).

Geocentric sidereal positions per step plus sign/nakshatra ingress dates, retrograde stations and
lunations for a date range. Not per user: the server stores one row per range in ``transit_snapshots``
and joins it with each user's natal points. Schema: 03-chart-facts-dossier.md §2 (transit snapshot).

Positions are evaluated at local noon of each date (``lat``/``lon``/``tz`` only decide the local day);
ingress/station/lunation instants are bisected to the minute and reported as the local calendar date.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any, Callable, Dict, List, Optional, Tuple

import swisseph as swe

from jhora.facts import NAKSHATRA_NAMES, PLANET_CODES, SIGN_NAMES, _norm360

SNAPSHOT_VERSION = 1
logger = logging.getLogger("jhora.transits")

# Planets carried in the snapshot (Moon optional: 27 nakshatra ingresses a month is noise for readings)
TRANSIT_PLANETS: List[str] = ["Su", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"]
SLOW_PLANETS: List[str] = ["Ju", "Sa", "Ra", "Ke"]
_SWE_ID: Dict[str, int] = {
    "Su": swe.SUN, "Mo": swe.MOON, "Ma": swe.MARS, "Me": swe.MERCURY, "Ju": swe.JUPITER,
    "Ve": swe.VENUS, "Sa": swe.SATURN, "Ra": swe.MEAN_NODE, "Ke": swe.MEAN_NODE,
}
_FLAGS = swe.FLG_SWIEPH | swe.FLG_SIDEREAL | swe.FLG_SPEED


def _set_ayanamsa(ayanamsa: str) -> str:
    from jhora import const

    ayan = (ayanamsa or "LAHIRI").upper()
    mode = const.available_ayanamsa_modes.get(ayan)
    if mode is None:
        ayan = "LAHIRI"
        mode = swe.SIDM_LAHIRI
    swe.set_sid_mode(mode, 0, 0)
    return ayan


def _calc(jd_utc: float, code: str) -> Tuple[float, float]:
    """(sidereal longitude, longitude speed deg/day) for a planet code at a UTC Julian day."""
    xx, _ = swe.calc_ut(jd_utc, _SWE_ID[code], _FLAGS)
    lon, speed = float(xx[0]), float(xx[3])
    if code == "Ke":
        lon = _norm360(lon + 180.0)
    return _norm360(lon), speed


def _jd_local_noon_utc(d: date, tz: float) -> float:
    return swe.julday(d.year, d.month, d.day, 12.0) - tz / 24.0


def _jd_utc_to_local_date(jd_utc: float, tz: float) -> date:
    y, m, dd, _ = swe.revjul(jd_utc + tz / 24.0, swe.GREG_CAL)
    return date(int(y), int(m), int(dd))


def _bisect(f: Callable[[float], float], lo: float, hi: float, iters: int = 40) -> float:
    """Root of f on [lo, hi] where f changes sign; returns jd."""
    flo = f(lo)
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        fm = f(mid)
        if (fm < 0) == (flo < 0):
            lo, flo = mid, fm
        else:
            hi = mid
        if hi - lo < 1.0 / 1440.0:
            break
    return 0.5 * (lo + hi)


def _bisect_index_change(f_idx: Callable[[float], int], lo: float, hi: float, iters: int = 40) -> float:
    """Instant where an integer index (sign / nakshatra) changes between lo and hi."""
    ilo = f_idx(lo)
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        if f_idx(mid) == ilo:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1.0 / 1440.0:
            break
    return hi


def _ang_diff(a: float, b: float) -> float:
    """Signed smallest difference a-b in (-180, 180]."""
    return ((a - b + 180.0) % 360.0) - 180.0


def build_transits(
    from_date: str,
    to_date: str,
    lat: float = 0.0,
    lon: float = 0.0,
    tz: float = 0.0,
    ayanamsa: str = "LAHIRI",
    step: str = "auto",
    include_moon: bool = False,
    daily_days: int = 60,
) -> Dict[str, Any]:
    """Transit snapshot for [from_date, to_date] (ISO dates, inclusive).

    ``step``: ``auto`` (daily for the first ``daily_days`` days, weekly after), ``daily`` or ``weekly``.
    Ingress/station/lunation detection always scans daily regardless of ``step``.
    """
    d0 = date.fromisoformat(str(from_date)[:10])
    d1 = date.fromisoformat(str(to_date)[:10])
    if d1 < d0:
        raise ValueError("'to' must be on or after 'from'")
    if (d1 - d0).days > 366 * 5:
        raise ValueError("transit range must be 5 years or less")
    ayan = _set_ayanamsa(ayanamsa)
    planets = list(TRANSIT_PLANETS)
    if include_moon:
        planets.insert(1, "Mo")

    n_days = (d1 - d0).days + 1
    dates = [d0 + timedelta(days=i) for i in range(n_days)]
    jds = [_jd_local_noon_utc(d, tz) for d in dates]

    # daily longitudes/speeds for every planet (the scan grid)
    lons: Dict[str, List[float]] = {p: [] for p in planets}
    speeds: Dict[str, List[float]] = {p: [] for p in planets}
    for jd in jds:
        for p in planets:
            l, s = _calc(jd, p)
            lons[p].append(l)
            speeds[p].append(s)

    # positions (subsampled)
    positions: List[Dict[str, Any]] = []
    for i, d in enumerate(dates):
        if step == "weekly":
            keep = i % 7 == 0
        elif step == "daily":
            keep = True
        else:
            keep = i < daily_days or (i - daily_days) % 7 == 0
        if not keep and i != n_days - 1:
            continue
        row: Dict[str, Any] = {"date": d.isoformat()}
        for p in planets:
            l = lons[p][i]
            sign = int(l // 30) % 12
            nak_idx = int(l // (360.0 / 27)) % 27
            row[p] = {
                "lon": round(l, 3),
                "sign": sign,
                "nak": NAKSHATRA_NAMES[nak_idx],
                "nak_idx": nak_idx,
                "retro": bool(speeds[p][i] < 0) if p not in ("Ra", "Ke") else True,
            }
        positions.append(row)

    # ingresses (sign + nakshatra), per planet, scanning consecutive days
    ingresses: List[Dict[str, Any]] = []
    for p in planets:
        sign_idx = lambda jd, p=p: int(_calc(jd, p)[0] // 30) % 12  # noqa: E731
        nak_idx = lambda jd, p=p: int(_calc(jd, p)[0] // (360.0 / 27)) % 27  # noqa: E731
        for i in range(1, n_days):
            s_prev, s_cur = int(lons[p][i - 1] // 30) % 12, int(lons[p][i] // 30) % 12
            if s_prev != s_cur:
                jd_x = _bisect_index_change(sign_idx, jds[i - 1], jds[i])
                direction = _ang_diff(lons[p][i], lons[p][i - 1])
                ingresses.append({
                    "planet": p, "kind": "sign", "from": s_prev, "into": s_cur, "into_name": SIGN_NAMES[s_cur],
                    "date": _jd_utc_to_local_date(jd_x, tz).isoformat(), "retro": direction < 0,
                })
            n_prev, n_cur = int(lons[p][i - 1] // (360.0 / 27)) % 27, int(lons[p][i] // (360.0 / 27)) % 27
            if n_prev != n_cur:
                jd_x = _bisect_index_change(nak_idx, jds[i - 1], jds[i])
                direction = _ang_diff(lons[p][i], lons[p][i - 1])
                ingresses.append({
                    "planet": p, "kind": "nak", "from": NAKSHATRA_NAMES[n_prev], "into": NAKSHATRA_NAMES[n_cur],
                    "into_idx": n_cur, "date": _jd_utc_to_local_date(jd_x, tz).isoformat(), "retro": direction < 0,
                })
    ingresses.sort(key=lambda r: (r["date"], r["planet"], r["kind"]))

    # stations: speed sign change (not for the nodes / Sun / Moon)
    stations: List[Dict[str, Any]] = []
    for p in planets:
        if p in ("Su", "Mo", "Ra", "Ke"):
            continue
        speed_f = lambda jd, p=p: _calc(jd, p)[1]  # noqa: E731
        for i in range(1, n_days):
            if (speeds[p][i - 1] < 0) != (speeds[p][i] < 0):
                jd_x = _bisect(speed_f, jds[i - 1], jds[i])
                l, _ = _calc(jd_x, p)
                stations.append({
                    "planet": p, "kind": "retro_start" if speeds[p][i] < 0 else "retro_end",
                    "date": _jd_utc_to_local_date(jd_x, tz).isoformat(), "lon": round(l, 3), "sign": int(l // 30) % 12,
                    "nak": NAKSHATRA_NAMES[int(l // (360.0 / 27)) % 27],
                })
    stations.sort(key=lambda r: (r["date"], r["planet"]))

    # lunations: new (elongation 0) and full (180)
    lunations: List[Dict[str, Any]] = []

    def elong(jd: float) -> float:
        return _norm360(_calc(jd, "Mo")[0] - _calc(jd, "Su")[0])

    prev_e = elong(jds[0])
    for i in range(1, n_days):
        e = elong(jds[i])
        for target, kind in ((0.0, "new"), (180.0, "full")):
            f = lambda jd, t=target: _ang_diff(elong(jd), t)  # noqa: E731
            if (f(jds[i - 1]) < 0) != (f(jds[i]) < 0) and abs(f(jds[i - 1])) < 30 and abs(f(jds[i])) < 30:
                jd_x = _bisect(f, jds[i - 1], jds[i])
                ml, _ = _calc(jd_x, "Mo")
                lunations.append({
                    "kind": kind, "date": _jd_utc_to_local_date(jd_x, tz).isoformat(), "sign": int(ml // 30) % 12,
                    "sign_name": SIGN_NAMES[int(ml // 30) % 12], "nak": NAKSHATRA_NAMES[int(ml // (360.0 / 27)) % 27],
                })
        prev_e = e
    lunations.sort(key=lambda r: r["date"])

    return {
        "v": SNAPSHOT_VERSION,
        "ayanamsa": ayan,
        "from": d0.isoformat(),
        "to": d1.isoformat(),
        "step": step,
        "daily_until": (d0 + timedelta(days=min(daily_days, n_days) - 1)).isoformat() if step == "auto" else None,
        "planets": planets,
        "positions": positions,
        "ingresses": ingresses,
        "stations": stations,
        "lunations": lunations,
    }
