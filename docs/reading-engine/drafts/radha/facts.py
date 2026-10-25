# -*- coding: UTF-8 -*-
"""
Chart facts dossier (AI Astra reading engine, facts_version 1).

Deterministic, versioned JSON for one kundli: every placement, lordship, aspect, dasha date and
nakshatra relation the reading method needs, with stable ids (dot paths) so an LLM can cite them and
a checker can verify them. Schema: AIAstra_Server/docs/reading-engine/03-chart-facts-dossier.md §2 and
AIAstra_Server/src/reading/schema/facts.v1.schema.json.

Everything here is computed by pyjhora; nothing is interpreted. Whole-sign houses from Lagna;
Sripati bhava madhya only for ``bhava`` / ``near_cusp`` flags. Longitudes are decimal degrees,
signs 0-11, houses 1-12, dates ISO-8601.

Public entry points: :func:`build_facts`, :func:`build_natal_points`.
"""
from __future__ import annotations

import logging
import math
import os
import subprocess
import time
from datetime import date, timedelta
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Tuple

FACTS_VERSION = 1
# JHora's "Lahiri" is pyjhora's TRUE_CITRA (true Chitrapaksha); swe LAHIRI differs by ~1 arcmin.
DEFAULT_AYANAMSA = "TRUE_CITRA"
AYANAMSA_ALIASES: Dict[str, str] = {"JHORA_LAHIRI": "TRUE_CITRA", "TRUE_LAHIRI": "TRUE_CITRA"}

logger = logging.getLogger("jhora.facts")

# --- canonical names ---------------------------------------------------------------------------

PLANET_CODES: List[str] = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"]
PLANET_NAMES: List[str] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"]
LAGNA_CODE = "La"
SIGN_NAMES: List[str] = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
]
SIGN_SHORT: List[str] = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"]
NAKSHATRA_NAMES: List[str] = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
    "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
    "Uttara Bhadrapada", "Revati",
]
# Vimshottari star lords, Ashwini..Revati (planet index 0..8)
NAKSHATRA_LORDS: List[int] = [8, 5, 0, 1, 2, 7, 4, 6, 3] * 3
NAKSHATRA_DEITIES: List[str] = [
    "Ashwini Kumaras", "Yama", "Agni", "Brahma", "Soma", "Rudra", "Aditi", "Brihaspati", "Sarpas",
    "Pitris", "Bhaga", "Aryaman", "Savitar", "Tvashtar", "Vayu", "Indra-Agni", "Mitra", "Indra",
    "Nirriti", "Apas", "Vishvadevas", "Vishnu", "Vasus", "Varuna", "Aja Ekapada", "Ahir Budhnya", "Pushan",
]
NAKSHATRA_GANA: List[str] = [
    "Deva", "Manushya", "Rakshasa", "Manushya", "Deva", "Manushya", "Deva", "Deva", "Rakshasa",
    "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa", "Deva", "Rakshasa", "Deva", "Rakshasa",
    "Rakshasa", "Manushya", "Manushya", "Deva", "Rakshasa", "Rakshasa", "Manushya", "Manushya", "Deva",
]
NAKSHATRA_SYMBOLS: List[str] = [
    "Horse's head", "Yoni", "Razor/flame", "Cart/chariot", "Deer's head", "Teardrop/gem", "Bow and quiver",
    "Cow's udder/lotus", "Coiled serpent", "Royal throne", "Front legs of a bed", "Back legs of a bed",
    "Hand/fist", "Pearl/jewel", "Coral/young plant swaying in wind", "Triumphal arch/potter's wheel",
    "Lotus/umbrella", "Earring/umbrella", "Bunch of roots/lion's tail", "Elephant tusk/fan", "Elephant tusk/small bed",
    "Ear/three footprints", "Drum/flute", "Empty circle/1000 flowers", "Sword/two front legs of funeral cot",
    "Twins/back legs of funeral cot", "Fish/drum",
]
TARA_NAMES: List[str] = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyari", "Sadhaka", "Vadha", "Mitra", "Ati-mitra"]
KARAKA_CODES: List[str] = ["AK", "AmK", "BK", "MK", "PiK", "PK", "GK", "DK"]
TITHI_NAMES: List[str] = [
    "Pratipat", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami",
    "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
]
YOGA_NAMES: List[str] = [
    "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shula",
    "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan",
    "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti",
]
KARANA_NAMES_CYCLE: List[str] = ["Bava", "Balava", "Kaulava", "Taitila", "Garaja", "Vanija", "Vishti"]
KARANA_FIXED: Dict[int, str] = {1: "Kimstughna", 58: "Shakuni", 59: "Chatushpada", 60: "Naga"}
VARA_NAMES: List[str] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
VARA_LORDS: List[str] = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa"]
LUNAR_MONTHS: List[str] = [
    "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada", "Ashwina", "Kartika",
    "Margashirsha", "Pausha", "Magha", "Phalguna",
]
# Classical sign lords Aries..Pisces (planet index)
SIGN_LORDS: List[int] = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4]
CO_LORDS: Dict[int, int] = {7: 8, 10: 7}  # Scorpio: Ketu, Aquarius: Rahu (Jaimini co-lords)
DIGNITY_NAMES: Dict[int, str] = {5: "own", 4: "exalted", 3: "friend", 2: "neutral", 1: "enemy", 0: "debilitated"}
DEFAULT_VARGAS: List[str] = ["D1", "D2", "D3", "D4", "D7", "D9", "D10", "D12", "D30", "D60"]
KENDRAS = (1, 4, 7, 10)
TRIKONAS = (1, 5, 9)
UPACHAYAS = (3, 6, 10, 11)
DUSTHANAS = (6, 8, 12)
MARAKA_HOUSES = (2, 7)
PANAPARA = (2, 5, 8, 11)
APOKLIMA = (3, 6, 9, 12)
SPECIAL_LAGNA_FUNCS: List[Tuple[str, str]] = [
    ("BL", "bhava_lagna"), ("HL", "hora_lagna"), ("GL", "ghati_lagna"), ("VL", "vighati_lagna"),
    ("SL", "sree_lagna"), ("IL", "indu_lagna"), ("PL", "pranapada_lagna"), ("BB", "bhrigu_bindhu_lagna"),
    ("KL", "kunda_lagna"),
]
SIDEREAL_YEAR_DAYS = 365.256364  # const.sidereal_year


# --- small helpers -----------------------------------------------------------------------------


def _norm360(x: float) -> float:
    x = x % 360.0
    return x + 360.0 if x < 0 else x


def _r(x: Optional[float], nd: int = 3) -> Optional[float]:
    return None if x is None else round(float(x), nd)


def _house_from(lagna_sign: int, sign: int) -> int:
    return (sign - lagna_sign) % 12 + 1


def _sign_of_house(lagna_sign: int, house: int) -> int:
    return (lagna_sign + house - 1) % 12


def _code(p: Any) -> str:
    if p == "L":
        return LAGNA_CODE
    return PLANET_CODES[int(p)]


def _codes(ps: Iterable[Any]) -> List[str]:
    out: List[str] = []
    for p in ps:
        if p in ("", None):
            continue
        out.append(_code(p))
    return out


def _parse_slash(s: str) -> List[str]:
    """'3/5/L' -> ['Me','Ve','La'] (pyjhora house_to_planet strings)."""
    return [_code(t) for t in str(s).split("/") if t not in ("", None)]


def _jd_to_iso(jd: float) -> str:
    from jhora import utils

    y, m, d, _ = utils.jd_to_gregorian(jd)
    return "%04d-%02d-%02d" % (y, m, d)


def _jd_to_date(jd: float) -> date:
    from jhora import utils

    y, m, d, _ = utils.jd_to_gregorian(jd)
    return date(int(y), int(m), int(d))


def _iso(d: date) -> str:
    return d.isoformat()


def _nak(full_lon: float) -> Dict[str, Any]:
    from jhora.panchanga import drik

    idx, pada, _ = drik.nakshatra_pada(_norm360(full_lon))
    i0 = int(idx) - 1
    return {"idx": i0, "name": NAKSHATRA_NAMES[i0], "pada": int(pada), "lord": PLANET_CODES[NAKSHATRA_LORDS[i0]]}


def _tara(from_nak_idx: int, to_nak_idx: int) -> str:
    count = (to_nak_idx - from_nak_idx) % 27 + 1
    return TARA_NAMES[(count - 1) % 9]


def _is_gandanta(sign: int, deg_in_sign: float) -> bool:
    if sign in (3, 7, 11) and deg_in_sign >= 30.0 - 10.0 / 3.0:
        return True
    if sign in (0, 4, 8) and deg_in_sign < 10.0 / 3.0:
        return True
    return False


def _engine_commit() -> str:
    env = os.environ.get("PYJHORA_ENGINE_COMMIT", "").strip()
    if env:
        return env
    try:
        root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        out = subprocess.run(
            ["git", "rev-parse", "--short=12", "HEAD"], cwd=root, capture_output=True, text=True, timeout=3
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except Exception:  # pragma: no cover - git missing on Lambda
        pass
    return "unknown"


def _pyjhora_version() -> str:
    try:
        from jhora import _package_info  # type: ignore

        for attr in ("__version__", "version", "_version"):
            v = getattr(_package_info, attr, None)
            if v:
                return str(v)
    except Exception:
        pass
    return "4.5.0"


def _dignity(p: int, sign: int) -> str:
    from jhora import const

    if p > 8:
        return "neutral"
    if p == 7:
        # pyjhora reuses Ketu's row for Rahu; classical: Rahu exalted Taurus / debilitated Scorpio (mirror of Ketu)
        strength = const.house_strengths_of_planets[8][(sign + 6) % 12]
    else:
        strength = const.house_strengths_of_planets[p][sign]
    if p <= 6 and sign == const.moola_trikona_of_planets[p] and strength == const._OWNER_RULER:
        return "moolatrikona"
    return DIGNITY_NAMES.get(int(strength), "neutral")


def _class_of_house(h: int) -> List[str]:
    cls: List[str] = []
    if h in KENDRAS:
        cls.append("kendra")
    if h in TRIKONAS:
        cls.append("trikona")
    if h in UPACHAYAS:
        cls.append("upachaya")
    if h in DUSTHANAS:
        cls.append("dusthana")
    if h in MARAKA_HOUSES:
        cls.append("maraka")
    if h in PANAPARA:
        cls.append("panapara")
    if h in APOKLIMA:
        cls.append("apoklima")
    return cls


def _functional_nature(p: int, owned_houses: Sequence[int]) -> str:
    """Simplified PVR functional classification per lagna.

    Lords of 5/9 (and 1) are functional benefics, lords of 3/6/11 functional malefics, kendra lords neutral,
    2/8/12 neutral. A planet owning a trikona and a 3/6/11 house is 'neutral' (mixed). Rahu/Ketu malefic.
    """
    if p >= 7:
        return "malefic"
    owned = set(owned_houses)
    bad = owned & {3, 6, 11}
    good = owned & {1, 5, 9}
    if good and bad:
        return "neutral"
    if good:
        return "benefic"
    if bad:
        return "malefic"
    return "neutral"


# --- core builder --------------------------------------------------------------------------------


class _Chart:
    """D-1 planet positions plus lookups shared by every section (computed once)."""

    def __init__(self, pp: List[Any]):
        from jhora import utils

        self.pp = pp[:10]  # L, Su..Ke
        self.lagna_sign: int = int(self.pp[0][1][0])
        self.lagna_deg: float = float(self.pp[0][1][1])
        self.lagna_lon: float = self.lagna_sign * 30 + self.lagna_deg
        self.sign: Dict[int, int] = {}
        self.deg: Dict[int, float] = {}
        self.lon: Dict[int, float] = {}
        for p, (s, d) in self.pp[1:]:
            self.sign[int(p)] = int(s)
            self.deg[int(p)] = float(d)
            self.lon[int(p)] = int(s) * 30 + float(d)
        self.h_to_p: List[str] = utils.get_house_planet_list_from_planet_positions(self.pp)

    def house(self, p: int) -> int:
        return _house_from(self.lagna_sign, self.sign[p])

    def occupants_of_sign(self, sign: int) -> List[int]:
        return [p for p in range(9) if self.sign[p] == sign]

    def planets_in_house(self, h: int) -> List[int]:
        return self.occupants_of_sign(_sign_of_house(self.lagna_sign, h))


def _resolve_birth(dob: str, tob: str) -> Tuple[Tuple[int, int, int], Tuple[int, int, int]]:
    from jhora.export import _parse_dob_tob

    bd, bt = _parse_dob_tob(dob, tob)
    if bd is None or bt is None:
        raise ValueError("Invalid DOB or TOB format. Use DOB: YYYY,M,D or YYYY-MM-DD; TOB: HH:MM:SS (24h)")
    return (int(bd.year), int(bd.month), int(bd.day)), (int(bt[0]), int(bt[1]), int(bt[2]))


def _parse_as_of(as_of: Optional[str]) -> date:
    if not as_of:
        return date.today()
    s = str(as_of).strip()[:10]
    return date.fromisoformat(s)


def resolve_ayanamsa(ayanamsa: Optional[str]) -> str:
    """Map a requested ayanamsa to a pyjhora mode; default TRUE_CITRA (= JHora Lahiri)."""
    from jhora import const

    a = (ayanamsa or DEFAULT_AYANAMSA).strip().upper()
    a = AYANAMSA_ALIASES.get(a, a)
    if a not in const.available_ayanamsa_modes:
        raise ValueError("Unsupported ayanamsa '%s'" % ayanamsa)
    return a


def _normalize_vargas(vargas: Optional[Sequence[str]]) -> List[int]:
    from jhora import const

    out: List[int] = []
    for v in vargas or DEFAULT_VARGAS:
        s = str(v).strip().upper().replace("D-", "D")
        if not s.startswith("D"):
            s = "D" + s
        try:
            n = int(s[1:])
        except ValueError:
            continue
        if n in const.division_chart_factors and n not in out:
            out.append(n)
    if 1 not in out:
        out.insert(0, 1)
    return out


def build_facts(
    dob: str,
    tob: str,
    lat: float,
    lon: float,
    tz: float,
    place_name: Optional[str] = None,
    ayanamsa: Optional[str] = None,
    as_of: Optional[str] = None,
    vargas: Optional[Sequence[str]] = None,
) -> Dict[str, Any]:
    """Build the full chart-facts dossier (facts_version 1). Deterministic for the same inputs + as_of."""
    from jhora import const, utils
    from jhora.horoscope.chart import charts
    from jhora.panchanga import drik

    t0 = time.perf_counter()
    utils.set_language("en")
    (y, m, d), (hh, mm, ss) = _resolve_birth(dob, tob)
    as_of_date = _parse_as_of(as_of)
    place = drik.Place(place_name or "Unknown", float(lat), float(lon), float(tz))
    jd = utils.julian_day_number((y, m, d), (hh, mm, ss))
    ayan = resolve_ayanamsa(ayanamsa)
    drik.set_ayanamsa_mode(ayan, None, jd)

    pp_raw = charts.rasi_chart(jd, place, ayanamsa_mode=ayan)
    chart = _Chart(pp_raw)
    varga_factors = _normalize_vargas(vargas)
    timings: Dict[str, float] = {}

    def mark(name: str, t: float) -> None:
        timings[name] = round((time.perf_counter() - t) * 1000)

    t = time.perf_counter()
    relations_basic = _lordships(chart)
    aspects = _aspects(chart)
    argala = _argala(chart)
    nature = _natures(chart, jd, place, ayan, relations_basic)
    retro, combust, speeds, war = _motion(chart, jd, place)
    bav, sav = _ashtakavarga(chart)
    shadbala = _shadbala(jd, place, ayan)
    ishta_kashta = _ishta_kashta(chart, jd, place)
    pushkara_nav, pushkara_bhaga = _pushkara(chart)
    mark("d1_core", t)

    t = time.perf_counter()
    moon_nak = _nak(chart.lon[1])
    cusps = _bhava_cusps(jd, place)
    bodies = _bodies(
        chart, relations_basic, aspects, nature, retro, combust, speeds, war, bav, shadbala, ishta_kashta,
        pushkara_nav, pushkara_bhaga, moon_nak["idx"], cusps,
    )
    _add_upagrahas(bodies, chart, (y, m, d), (hh, mm, ss), place, ayan, moon_nak["idx"])
    houses = _houses(chart, relations_basic, aspects, argala, sav, cusps)
    mark("bodies_houses", t)

    t = time.perf_counter()
    varga_block, navamsa_signs = _vargas(chart, jd, place, ayan, varga_factors, relations_basic)
    for p in range(9):
        bodies[PLANET_CODES[p]]["navamsa_sign"] = navamsa_signs.get(p)
        bodies[PLANET_CODES[p]]["flags"] = sorted(
            set(bodies[PLANET_CODES[p]]["flags"]) | ({"vargottama"} if navamsa_signs.get(p) == chart.sign[p] else set())
        )
    bodies[LAGNA_CODE]["navamsa_sign"] = navamsa_signs.get("L")
    mark("vargas", t)

    t = time.perf_counter()
    karakas = _karakas(chart, navamsa_signs)
    arudhas = _arudhas(chart)
    special = _special_lagnas(chart, jd, place, ayan, (y, m, d), (hh, mm, ss))
    mark("karakas_arudhas_special", t)

    t = time.perf_counter()
    yogas = _yogas(chart, jd, place, relations_basic, bodies)
    doshas = _doshas(chart, moon_nak["idx"])
    mark("yogas_doshas", t)

    t = time.perf_counter()
    dasha = _dasha(chart, jd, place, (y, m, d), (hh, mm, ss), as_of_date)
    mark("dasha", t)

    t = time.perf_counter()
    panchanga = _panchanga(jd, place, chart)
    nak_profile = _nakshatra_profile(chart, bodies, moon_nak, arudhas, special, pushkara_nav, pushkara_bhaga)
    nak_profile["tenth_cusp_nak"] = houses["10"]["cusp_nak"]
    relations = _relations(chart, relations_basic, nature, bodies)
    mark("panchanga_nak_relations", t)

    dossier: Dict[str, Any] = {
        "v": FACTS_VERSION,
        "engine": {
            "pyjhora": _pyjhora_version(),
            "commit": _engine_commit(),
            "ayanamsa": ayan,
            "houses": "whole_sign",
        },
        "as_of": _iso(as_of_date),
        "birth": {
            "date": "%04d-%02d-%02d" % (y, m, d),
            "time": "%02d:%02d:%02d" % (hh, mm, ss),
            "tz": float(tz),
            "lat": float(lat),
            "lon": float(lon),
            "place": place_name or "",
        },
        "panchanga": panchanga,
        "bodies": bodies,
        "houses": houses,
        "vargas": varga_block,
        "karakas": karakas,
        "arudhas": arudhas,
        "special_lagnas": special,
        "yogas": yogas,
        "doshas": doshas,
        "ashtakavarga": {
            "sav": sav,
            "bav": {PLANET_CODES[p]: bav[p] for p in range(7)},
            "bav_lagna": bav[7] if len(bav) > 7 else None,
        },
        "dasha": dasha,
        "nakshatra_profile": nak_profile,
        "relations": relations,
        "meta": {"compute_ms": round((time.perf_counter() - t0) * 1000), "sections_ms": timings},
    }
    return dossier


# --- sections ------------------------------------------------------------------------------------


def _lordships(chart: _Chart) -> Dict[str, Any]:
    lord_of: Dict[int, int] = {}
    co_lord_of: Dict[int, int] = {}
    houses_of: Dict[int, List[int]] = {p: [] for p in range(9)}
    for h in range(1, 13):
        sign = _sign_of_house(chart.lagna_sign, h)
        lord = SIGN_LORDS[sign]
        lord_of[h] = lord
        houses_of[lord].append(h)
        if sign in CO_LORDS:
            co_lord_of[h] = CO_LORDS[sign]
    return {"lord_of": lord_of, "co_lord_of": co_lord_of, "houses_of": houses_of}


def _aspects(chart: _Chart) -> Dict[str, Any]:
    from jhora.horoscope.chart import house

    g_arp, g_ahp, g_app = house.graha_drishti_from_chart(chart.h_to_p)
    r_arp, r_ahp, r_app = house.raasi_drishti_from_chart(chart.h_to_p)
    graha_houses = {p: sorted(int(h) for h in g_ahp.get(p, [])) for p in range(9)}
    graha_planets = {p: sorted(int(q) for q in g_app.get(p, []) if int(q) != p) for p in range(9)}
    rasi_houses = {p: sorted(int(h) for h in r_ahp.get(p, [])) for p in range(9)}
    rasi_planets = {p: sorted(int(q) for q in r_app.get(p, []) if int(q) != p) for p in range(9)}
    return {
        "graha_houses": graha_houses,
        "graha_planets": graha_planets,
        "rasi_houses": rasi_houses,
        "rasi_planets": rasi_planets,
        "rasi_signs": {p: sorted(int(s) for s in r_arp.get(p, [])) for p in range(9)},
    }


def _argala(chart: _Chart) -> Dict[int, Dict[str, List[str]]]:
    from jhora.horoscope.chart import house

    argala, virodha = house.get_argala(chart.h_to_p, separator="/")
    out: Dict[int, Dict[str, List[str]]] = {}
    for r in range(12):
        h = r + 1
        a = argala[r]  # planets in 2nd, 4th, 5th, 11th from house h
        v = virodha[r]  # planets in 12th, 10th, 9th, 3rd
        primary = _parse_slash(a[0]) + _parse_slash(a[1]) + _parse_slash(a[3])
        secondary = _parse_slash(a[2])
        obstruct = []
        for s in v:
            obstruct += _parse_slash(s)
        out[h] = {
            "primary": [c for c in primary if c != LAGNA_CODE],
            "secondary": [c for c in secondary if c != LAGNA_CODE],
            "obstructed_by": [c for c in obstruct if c != LAGNA_CODE],
        }
    return out


def _natures(chart: _Chart, jd: float, place: Any, ayan: str, rel: Dict[str, Any]) -> Dict[int, Dict[str, str]]:
    from jhora.horoscope.chart import charts

    try:
        benefics, malefics = charts.benefics_and_malefics(jd, place, ayanamsa_mode=ayan, method=2)
    except Exception as e:  # pragma: no cover
        logger.warning("benefics_and_malefics failed: %s", e)
        benefics, malefics = [4, 5], [0, 2, 6, 7, 8]
    out: Dict[int, Dict[str, str]] = {}
    for p in range(9):
        natural = "benefic" if p in benefics else ("malefic" if p in malefics else "neutral")
        out[p] = {"natural": natural, "functional": _functional_nature(p, rel["houses_of"][p])}
    return out


def _motion(chart: _Chart, jd: float, place: Any) -> Tuple[List[int], List[int], Dict[int, float], List[Tuple[int, int]]]:
    from jhora.horoscope.chart import charts
    from jhora.panchanga import drik

    try:
        retro = [int(p) for p in drik.planets_in_retrograde(jd, place)]
    except Exception:
        retro = [int(p) for p in charts.planets_in_retrograde(chart.pp)]
    try:
        combust = [int(p) for p in charts.planets_in_combustion(chart.pp)]
    except Exception:
        combust = []
    speeds: Dict[int, float] = {}
    try:
        psi = drik.planets_speed_info(jd, place)
        for p in range(9):
            info = psi.get(p)
            if info:
                speeds[p] = float(info[3])
        if 8 in speeds and 7 in speeds:
            speeds[8] = speeds[7]
    except Exception:
        pass
    war: List[Tuple[int, int]] = []
    try:
        for row in drik.planets_in_graha_yudh(jd, place) or []:
            a, b = int(row[0]), int(row[1])
            if 2 <= a <= 6 and 2 <= b <= 6:  # graha yuddha applies to Mars..Saturn only
                war.append((a, b))
    except Exception:
        pass
    return retro, combust, speeds, war


def _ashtakavarga(chart: _Chart) -> Tuple[List[List[int]], List[int]]:
    from jhora.horoscope.chart import ashtakavarga

    bav, sav, _ = ashtakavarga.get_ashtaka_varga(chart.h_to_p)
    return [[int(x) for x in row] for row in bav], [int(x) for x in sav]


def _shadbala(jd: float, place: Any, ayan: str) -> Optional[Dict[int, Dict[str, Any]]]:
    from jhora.horoscope.chart import strength

    try:
        sb = strength.shad_bala(jd, place, ayanamsa_mode=ayan)
    except Exception as e:
        logger.warning("shad_bala failed: %s", e)
        return None
    rupas = sb[7]
    ratio = sb[8]
    required = [5, 6, 5, 7, 6.5, 5.5, 5]
    order = sorted(range(7), key=lambda p: -float(rupas[p]))
    rank = {p: i + 1 for i, p in enumerate(order)}
    return {
        p: {"rupas": _r(rupas[p], 2), "required": required[p], "ratio": _r(ratio[p], 2), "rank": rank[p]}
        for p in range(7)
    }


def _ishta_kashta(chart: _Chart, jd: float, place: Any) -> Dict[int, Tuple[Optional[float], Optional[float]]]:
    from jhora.horoscope.chart import strength

    out: Dict[int, Tuple[Optional[float], Optional[float]]] = {}
    try:
        ub = strength._uchcha_bala(chart.pp)
        cb = strength._cheshta_bala_new(jd, place, use_epoch_table=True)
        for p in range(7):
            u = max(0.0, min(60.0, float(ub[p])))
            c = max(0.0, min(60.0, float(cb[p])))
            out[p] = (_r(math.sqrt(u * c), 1), _r(math.sqrt((60 - u) * (60 - c)), 1))
    except Exception as e:
        logger.debug("ishta/kashta unavailable: %s", e)
    return out


def _pushkara(chart: _Chart) -> Tuple[List[int], List[int]]:
    from jhora.horoscope.chart import charts

    try:
        pna, pb = charts.planets_in_pushkara_navamsa_bhaga(chart.pp)
        return [int(p) for p in pna], [int(p) for p in pb]
    except Exception:
        return [], []


def _bodies(
    chart: _Chart,
    rel: Dict[str, Any],
    aspects: Dict[str, Any],
    nature: Dict[int, Dict[str, str]],
    retro: List[int],
    combust: List[int],
    speeds: Dict[int, float],
    war: List[Tuple[int, int]],
    bav: List[List[int]],
    shadbala: Optional[Dict[int, Dict[str, Any]]],
    ishta_kashta: Dict[int, Tuple[Optional[float], Optional[float]]],
    pushkara_nav: List[int],
    pushkara_bhaga: List[int],
    moon_nak_idx: int,
    cusps: Optional[List[float]] = None,
) -> Dict[str, Dict[str, Any]]:
    bodies: Dict[str, Dict[str, Any]] = {}
    # Lagna
    la_nak = _nak(chart.lagna_lon)
    bodies[LAGNA_CODE] = {
        "lon": _r(chart.lagna_lon),
        "sign": chart.lagna_sign,
        "sign_name": SIGN_NAMES[chart.lagna_sign],
        "deg_in_sign": _r(chart.lagna_deg),
        "house": 1,
        "nak": la_nak,
        "navamsa_sign": None,
        "sign_lord": PLANET_CODES[SIGN_LORDS[chart.lagna_sign]],
        "sign_lord_house": chart.house(SIGN_LORDS[chart.lagna_sign]),
        "star_lord": la_nak["lord"],
        "star_lord_house": chart.house(NAKSHATRA_LORDS[la_nak["idx"]]),
        "conj": _codes(chart.occupants_of_sign(chart.lagna_sign)),
        "flags": ["gandanta"] if _is_gandanta(chart.lagna_sign, chart.lagna_deg) else [],
    }
    war_set = set()
    for a, b in war:
        war_set.add(a)
        war_set.add(b)
    for p in range(9):
        code = PLANET_CODES[p]
        sign = chart.sign[p]
        deg = chart.deg[p]
        nak = _nak(chart.lon[p])
        star_lord = NAKSHATRA_LORDS[nak["idx"]]
        sign_lord = SIGN_LORDS[sign]
        flags: List[str] = []
        if p in combust:
            flags.append("combust")
        is_retro = (p in retro) or p >= 7
        if is_retro and p < 7:
            flags.append("retro")
        if _is_gandanta(sign, deg):
            flags.append("gandanta")
        if p in pushkara_nav:
            flags.append("pushkara_navamsa")
        if p in pushkara_bhaga:
            flags.append("pushkara_bhaga")
        if p in war_set:
            flags.append("planetary_war")
        aspected_by_graha = sorted(q for q in range(9) if p in aspects["graha_planets"][q])
        aspected_by_rasi = sorted(q for q in range(9) if p in aspects["rasi_planets"][q])
        bhava, near_cusp = (_assign_bhava(chart.lon[p], cusps) if cusps else (None, None))
        body: Dict[str, Any] = {
            "lon": _r(chart.lon[p]),
            "sign": sign,
            "sign_name": SIGN_NAMES[sign],
            "deg_in_sign": _r(deg),
            "house": chart.house(p),
            "bhava": bhava,
            "near_cusp": near_cusp,
            "nak": nak,
            "navamsa_sign": None,
            "dignity": _dignity(p, sign),
            "retro": bool(is_retro),
            "combust": p in combust,
            "speed": _r(speeds.get(p), 3),
            "owns": rel["houses_of"][p],
            "nature": nature[p],
            "conj": _codes(q for q in chart.occupants_of_sign(sign) if q != p),
            "aspects_to": {"graha": aspects["graha_houses"][p], "rasi": aspects["rasi_houses"][p]},
            "aspected_by": {"graha": _codes(aspected_by_graha), "rasi": _codes(aspected_by_rasi)},
            "star_lord": PLANET_CODES[star_lord],
            "star_lord_house": chart.house(star_lord),
            "sign_lord": PLANET_CODES[sign_lord],
            "sign_lord_house": chart.house(sign_lord),
            "shadbala": (shadbala or {}).get(p),
            "ishta": ishta_kashta.get(p, (None, None))[0],
            "kashta": ishta_kashta.get(p, (None, None))[1],
            "bav_at_sign": bav[p][sign] if p < 7 else None,
            "tara_from_janma": _tara(moon_nak_idx, nak["idx"]),
            "flags": flags,
        }
        bodies[code] = body
    return bodies


def _add_upagrahas(
    bodies: Dict[str, Dict[str, Any]], chart: _Chart, dob: Tuple[int, int, int], tob: Tuple[int, int, int],
    place: Any, ayan: str, moon_nak_idx: int,
) -> None:
    from jhora.panchanga import drik

    for code, fn in (("Md", "maandi_longitude"), ("Gk", "gulika_longitude")):
        try:
            sign, deg = getattr(drik, fn)(drik.Date(*dob), tob, place, ayanamsa_mode=ayan)
            sign = int(sign)
            lon = sign * 30 + float(deg)
            nak = _nak(lon)
            bodies[code] = {
                "lon": _r(lon),
                "sign": sign,
                "sign_name": SIGN_NAMES[sign],
                "deg_in_sign": _r(float(deg)),
                "house": _house_from(chart.lagna_sign, sign),
                "nak": nak,
                "sign_lord": PLANET_CODES[SIGN_LORDS[sign]],
                "star_lord": nak["lord"],
                "tara_from_janma": _tara(moon_nak_idx, nak["idx"]),
                "flags": [],
            }
        except Exception as e:
            logger.debug("%s unavailable: %s", code, e)


def _bhava_cusps(jd: float, place: Any) -> Optional[List[float]]:
    from jhora.panchanga import drik

    try:
        cusps = drik.bhaava_madhya_sripathi(jd, place)
        if cusps and len(cusps) == 12:
            return [float(c) for c in cusps]
    except Exception as e:
        logger.debug("bhaava_madhya_sripathi unavailable: %s", e)
    return None


def _assign_bhava(lon: float, cusps: List[float]) -> Tuple[int, bool]:
    """Sripati: house i spans from midpoint(cusp[i-1],cusp[i]) to midpoint(cusp[i],cusp[i+1])."""
    best_h, best_d = 1, 999.0
    for i, c in enumerate(cusps):
        d = abs(((lon - c) + 180) % 360 - 180)
        if d < best_d:
            best_h, best_d = i + 1, d
    # distance to nearest sandhi (boundary)
    i = best_h - 1
    prev_c = cusps[(i - 1) % 12]
    next_c = cusps[(i + 1) % 12]
    start = _norm360(prev_c + (((cusps[i] - prev_c) % 360) / 2))
    end = _norm360(cusps[i] + (((next_c - cusps[i]) % 360) / 2))
    d_start = abs(((lon - start) + 180) % 360 - 180)
    d_end = abs(((lon - end) + 180) % 360 - 180)
    return best_h, min(d_start, d_end) <= 3.0


def _houses(
    chart: _Chart, rel: Dict[str, Any], aspects: Dict[str, Any], argala: Dict[int, Dict[str, List[str]]],
    sav: List[int], cusps: Optional[List[float]],
) -> Dict[str, Dict[str, Any]]:
    houses: Dict[str, Dict[str, Any]] = {}
    for h in range(1, 13):
        sign = _sign_of_house(chart.lagna_sign, h)
        lord = rel["lord_of"][h]
        aspected_graha = sorted(p for p in range(9) if h in aspects["graha_houses"][p])
        aspected_rasi = sorted(p for p in range(9) if h in aspects["rasi_houses"][p])
        cusp_lon = cusps[h - 1] if cusps else _norm360(chart.lagna_lon + (h - 1) * 30)
        cusp_nak = _nak(cusp_lon)
        entry: Dict[str, Any] = {
            "sign": sign,
            "sign_name": SIGN_NAMES[sign],
            "lord": PLANET_CODES[lord],
            "lord_house": chart.house(lord),
            "lord_sign": chart.sign[lord],
            "lord_dignity": _dignity(lord, chart.sign[lord]),
            "occupants": _codes(chart.planets_in_house(h)),
            "aspected_by": {"graha": _codes(aspected_graha), "rasi": _codes(aspected_rasi)},
            "argala": argala[h],
            "sav": sav[sign],
            "class": _class_of_house(h),
            "cusp_lon": _r(cusp_lon),
            "cusp_nak": {"name": cusp_nak["name"], "lord": cusp_nak["lord"], "pada": cusp_nak["pada"]},
        }
        if h in rel["co_lord_of"]:
            entry["co_lord"] = PLANET_CODES[rel["co_lord_of"][h]]
            entry["co_lord_house"] = chart.house(rel["co_lord_of"][h])
        houses[str(h)] = entry
    return houses


def _vargas(
    chart: _Chart, jd: float, place: Any, ayan: str, factors: List[int], rel: Dict[str, Any]
) -> Tuple[Dict[str, Any], Dict[Any, int]]:
    from jhora.horoscope.chart import charts

    out: Dict[str, Any] = {}
    navamsa_signs: Dict[Any, int] = {}
    for dvf in factors:
        if dvf == 1:
            ppv = chart.pp
        else:
            try:
                ppv = charts.divisional_positions_from_rasi_positions(chart.pp, divisional_chart_factor=dvf)[:10]
            except Exception as e:
                logger.warning("varga D%d failed: %s", dvf, e)
                continue
        v_lagna = int(ppv[0][1][0])
        v_sign: Dict[int, int] = {int(p): int(s) for p, (s, _) in ppv[1:]}
        if dvf == 9:
            navamsa_signs = {p: v_sign[p] for p in range(9)}
            navamsa_signs["L"] = v_lagna
        planets: Dict[str, Any] = {}
        for p in range(9):
            s = v_sign[p]
            planets[PLANET_CODES[p]] = {
                "sign": s,
                "house": _house_from(v_lagna, s),
                "dignity": _dignity(p, s),
                "vargottama": s == chart.sign[p],
            }
        houses: Dict[str, Any] = {}
        for h in range(1, 13):
            s = _sign_of_house(v_lagna, h)
            houses[str(h)] = {
                "sign": s,
                "lord": PLANET_CODES[SIGN_LORDS[s]],
                "occupants": [PLANET_CODES[p] for p in range(9) if v_sign[p] == s],
            }
        d1_lord_positions: Dict[str, Any] = {}
        for h in range(1, 13):
            lord = rel["lord_of"][h]
            d1_lord_positions[str(h)] = {
                "lord": PLANET_CODES[lord],
                "varga_sign": v_sign[lord],
                "varga_house": _house_from(v_lagna, v_sign[lord]),
                "varga_dignity": _dignity(lord, v_sign[lord]),
            }
        out["D%d" % dvf] = {
            "lagna_sign": v_lagna,
            "lagna_sign_name": SIGN_NAMES[v_lagna],
            "lagna_lord": PLANET_CODES[SIGN_LORDS[v_lagna]],
            "lagna_lord_house": _house_from(v_lagna, v_sign[SIGN_LORDS[v_lagna]]),
            "planets": planets,
            "houses": houses,
            "d1_lord_positions": d1_lord_positions,
        }
    return out, navamsa_signs


def _karakas(chart: _Chart, navamsa_signs: Dict[Any, int]) -> Dict[str, Any]:
    from jhora.horoscope.chart import house

    ck = house.chara_karakas(chart.pp)
    chara = {KARAKA_CODES[i]: PLANET_CODES[int(ck[i])] for i in range(min(8, len(ck)))}
    ak = int(ck[0])
    karakamsa_sign = navamsa_signs.get(ak)
    return {
        "chara": chara,
        "chara_houses": {KARAKA_CODES[i]: chart.house(int(ck[i])) for i in range(min(8, len(ck)))},
        "karakamsa": {"sign": karakamsa_sign, "sign_name": SIGN_NAMES[karakamsa_sign] if karakamsa_sign is not None else None},
        "natural": {
            "Su": ["father", "authority", "soul", "vitality"],
            "Mo": ["mother", "mind", "public", "comfort"],
            "Ma": ["siblings", "land", "courage", "energy"],
            "Me": ["intellect", "trade", "speech", "learning"],
            "Ju": ["wealth", "children", "dharma", "counsel", "husband"],
            "Ve": ["spouse", "comforts", "vehicles", "arts"],
            "Sa": ["work", "longevity", "discipline", "delay"],
            "Ra": ["foreign", "obsession", "speculation"],
            "Ke": ["moksha", "detachment", "research"],
        },
    }


def _arudhas(chart: _Chart) -> Dict[str, Any]:
    from jhora.horoscope.chart import arudhas

    out: Dict[str, Any] = {}
    try:
        ba = arudhas.bhava_arudhas_from_planet_positions(chart.pp)
    except Exception as e:
        logger.warning("bhava arudhas failed: %s", e)
        return out
    for i, sign in enumerate(ba):
        sign = int(sign)
        key = "A%d" % (i + 1)
        entry = {
            "sign": sign,
            "sign_name": SIGN_NAMES[sign],
            "house": _house_from(chart.lagna_sign, sign),
            "occupants": _codes(chart.occupants_of_sign(sign)),
            "lord": PLANET_CODES[SIGN_LORDS[sign]],
        }
        out[key] = entry
        if i == 0:
            out["AL"] = entry
        if i == 11:
            out["UL"] = entry
    return out


def _special_lagnas(
    chart: _Chart, jd: float, place: Any, ayan: str, dob: Tuple[int, int, int], tob: Tuple[int, int, int]
) -> Dict[str, Any]:
    from jhora.horoscope.chart import charts
    from jhora.panchanga import drik

    out: Dict[str, Any] = {}

    def put(code: str, res: Any) -> None:
        sign = int(res[0])
        lon = sign * 30 + float(res[1])
        nak = _nak(lon)
        out[code] = {
            "lon": _r(lon),
            "sign": sign,
            "sign_name": SIGN_NAMES[sign],
            "house": _house_from(chart.lagna_sign, sign),
            "nak": {"name": nak["name"], "lord": nak["lord"], "pada": nak["pada"]},
            "occupants": _codes(chart.occupants_of_sign(sign)),
        }

    for code, fn in SPECIAL_LAGNA_FUNCS:
        try:
            put(code, getattr(drik, fn)(jd, place, ayanamsa_mode=ayan))
        except Exception as e:
            logger.debug("special lagna %s failed: %s", code, e)
    try:
        put("VNL", charts.varnada_lagna(drik.Date(*dob), tob, place, ayanamsa_mode=ayan))
    except Exception as e:
        logger.debug("varnada lagna failed: %s", e)
    return out


def _pretty_yoga_name(key: str) -> str:
    base = key.replace("_from_planet_positions", "").replace("_yoga", "").replace("_", " ").strip()
    return " ".join(w.capitalize() for w in base.split()) + " Yoga"


def _yogas(
    chart: _Chart, jd: float, place: Any, rel: Dict[str, Any], bodies: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    from jhora.horoscope.chart import raja_yoga, yoga

    out: List[Dict[str, Any]] = []
    seen = set()

    def add(name: str, planets: List[str], houses: List[int], cls: str, strength: Optional[str] = None, note: Optional[str] = None, source: str = "D1") -> None:
        key = (name, tuple(sorted(planets)))
        if key in seen:
            return
        seen.add(key)
        entry: Dict[str, Any] = {"name": name, "planets": planets, "houses": sorted(set(houses)), "class": cls, "source": source}
        if strength:
            entry["strength"] = strength
        if note:
            entry["note"] = note
        out.append(entry)

    # Structural yogas computed here (planets and houses are explicit so the model can cite them).
    lord_of = rel["lord_of"]
    # Parivartana (exchange)
    for p in range(7):
        sp = chart.sign[p]
        q = SIGN_LORDS[sp]
        if q != p and q < 7 and SIGN_LORDS[chart.sign[q]] == p:
            if p < q:
                hp, hq = chart.house(p), chart.house(q)
                kind = "Maha" if not ({hp, hq} & {6, 8, 12}) else ("Dainya" if ({hp, hq} & {6, 8, 12}) else "Khala")
                add("Parivartana (%s)" % kind, [PLANET_CODES[p], PLANET_CODES[q]], [hp, hq], "exchange")
    # Gaja Kesari: Jupiter in a kendra from the Moon
    if ((chart.sign[4] - chart.sign[1]) % 12) in (0, 3, 6, 9):
        add("Gaja Kesari", ["Ju", "Mo"], [chart.house(4), chart.house(1)], "benefic")
    # Budha-Aditya
    if chart.sign[0] == chart.sign[3]:
        add("Budha-Aditya", ["Su", "Me"], [chart.house(0)], "benefic")
    # Chandra-Mangala
    if chart.sign[1] == chart.sign[2] or ((chart.sign[1] - chart.sign[2]) % 12) == 6:
        add("Chandra-Mangala", ["Mo", "Ma"], [chart.house(1), chart.house(2)], "dhana")
    # Pancha Mahapurusha: Ma/Me/Ju/Ve/Sa in own/exalted sign in a kendra from Lagna
    names = {2: "Ruchaka", 3: "Bhadra", 4: "Hamsa", 5: "Malavya", 6: "Sasa"}
    for p, nm in names.items():
        if chart.house(p) in KENDRAS and _dignity(p, chart.sign[p]) in ("own", "exalted", "moolatrikona"):
            add("%s (Pancha Mahapurusha)" % nm, [PLANET_CODES[p]], [chart.house(p)], "mahapurusha")
    # Kemadruma: no planet (other than Sun/Rahu/Ketu) in 2nd or 12th from Moon, Moon not conjunct any planet
    moon_sign = chart.sign[1]
    neighbours = [p for p in (2, 3, 4, 5, 6) if (chart.sign[p] - moon_sign) % 12 in (1, 11, 0)]
    if not neighbours:
        cancel = []
        if chart.house(1) in KENDRAS:
            cancel.append("Moon in a kendra from Lagna")
        if ((chart.sign[1] - chart.sign[4]) % 12 + 1) in (5, 7, 9):
            cancel.append("Jupiter aspects the Moon")
        if any(((chart.sign[1] - chart.sign[p]) % 12) in (0, 3, 6, 9) for p in (2, 3, 4, 5, 6)):
            cancel.append("a planet in a kendra from the Moon")
        add("Kemadruma", ["Mo"], [chart.house(1)], "affliction",
            note=("cancelled: " + "; ".join(cancel)) if cancel else "no cancellation found")
    # Dharma-Karmadhipati: lords of 9 and 10 associated (conjunct / mutual aspect / exchange)
    l9, l10 = lord_of[9], lord_of[10]
    if l9 != l10 and _associated(chart, l9, l10):
        add("Dharma-Karmadhipati", [PLANET_CODES[l9], PLANET_CODES[l10]], [9, 10, chart.house(l9), chart.house(l10)], "raja")
    # Raja yoga pairs: kendra lord with trikona lord associated
    for kh in (4, 7, 10):
        for th in (5, 9):
            a, b = lord_of[kh], lord_of[th]
            if a != b and _associated(chart, a, b):
                add("Raja Yoga (lords of %d and %d)" % (kh, th), [PLANET_CODES[a], PLANET_CODES[b]], [kh, th, chart.house(a), chart.house(b)], "raja")
    # Dhana yoga: lords of 2/11 associated with lords of 5/9 or lagna
    for wh in (2, 11):
        for th in (1, 5, 9):
            a, b = lord_of[wh], lord_of[th]
            if a != b and _associated(chart, a, b):
                add("Dhana Yoga (lords of %d and %d)" % (wh, th), [PLANET_CODES[a], PLANET_CODES[b]], [wh, th, chart.house(a), chart.house(b)], "dhana")
    # Viparita Raja yoga: lord of 6/8/12 placed in 6/8/12 (other than own)
    for dh in DUSTHANAS:
        l = lord_of[dh]
        if chart.house(l) in DUSTHANAS and chart.house(l) != dh:
            add("Viparita Raja Yoga (lord of %d in %d)" % (dh, chart.house(l)), [PLANET_CODES[l]], [dh, chart.house(l)], "viparita")
    # Neecha Bhanga: debilitated planet whose sign lord or exaltation lord is in a kendra from Lagna/Moon
    for p in range(7):
        if _dignity(p, chart.sign[p]) == "debilitated":
            sl = SIGN_LORDS[chart.sign[p]]
            if chart.house(sl) in KENDRAS or ((chart.sign[sl] - chart.sign[1]) % 12) in (0, 3, 6, 9):
                add("Neecha Bhanga", [PLANET_CODES[p], PLANET_CODES[sl]], [chart.house(p), chart.house(sl)], "cancellation")
    # Kala Sarpa: all planets between Rahu and Ketu
    try:
        from jhora.horoscope.chart import dosha

        if dosha.kala_sarpa(chart.h_to_p):
            add("Kala Sarpa", ["Ra", "Ke"], [chart.house(7), chart.house(8)], "affliction")
    except Exception:
        pass
    # pyjhora named yogas (D-1): names only, planets not resolvable generically.
    # get_yoga_details alone raises NameError (navamsa globals); the *_for_all_charts entry sets them.
    try:
        res, _, _ = yoga.get_yoga_details_for_all_charts(jd, place, language="en", divisional_chart_factor=1)
        for key, details in (res or {}).items():
            nm = _pretty_yoga_name(key)
            desc = ""
            if isinstance(details, list) and len(details) >= 3:
                desc = str(details[2])[:200]
            add(nm, [], [], "named", note=desc or None, source="pyjhora.yoga")
    except Exception as e:
        logger.debug("pyjhora yoga details failed: %s", e)
    return out


def _associated(chart: _Chart, a: int, b: int) -> bool:
    """Conjunction, mutual graha drishti (both aspect each other) or exchange of signs."""
    from jhora import const

    if chart.sign[a] == chart.sign[b]:
        return True
    if SIGN_LORDS[chart.sign[a]] == b and SIGN_LORDS[chart.sign[b]] == a:
        return True
    da = (chart.sign[b] - chart.sign[a]) % 12 + 1
    db = (chart.sign[a] - chart.sign[b]) % 12 + 1
    return da in const.graha_drishti.get(a, [7]) and db in const.graha_drishti.get(b, [7])


def _doshas(chart: _Chart, moon_nak_idx: int) -> List[Dict[str, Any]]:
    from jhora import const
    from jhora.horoscope.chart import dosha

    out: List[Dict[str, Any]] = []
    try:
        m = dosha.manglik(chart.pp)
        out.append({"name": "Manglik", "present": bool(m[0]), "exceptions": [int(x) for x in (m[2] or []) if x != -1], "planets": ["Ma"], "houses": [chart.house(2)]})
    except Exception:
        out.append({"name": "Manglik", "present": None, "exceptions": []})
    try:
        out.append({"name": "Kala Sarpa", "present": bool(dosha.kala_sarpa(chart.h_to_p)), "planets": ["Ra", "Ke"]})
    except Exception:
        pass
    try:
        gc = dosha.guru_chandala_dosha(chart.pp)
        out.append({"name": "Guru Chandala", "present": bool(gc[0]), "jupiter_stronger": bool(gc[1]) if gc[0] else None, "planets": ["Ju", "Ra", "Ke"]})
    except Exception:
        pass
    try:
        pd = dosha.pitru_dosha(chart.pp)
        out.append({"name": "Pitru", "present": bool(pd[0]), "rules": [int(x) for x in (pd[1] or [])]})
    except Exception:
        pass
    out.append({"name": "Ganda Moola (Moon)", "present": (moon_nak_idx + 1) in const.ganda_moola_stars, "planets": ["Mo"]})
    return out


def _dasha(
    chart: _Chart, jd: float, place: Any, dob: Tuple[int, int, int], tob: Tuple[int, int, int], as_of_date: date
) -> Dict[str, Any]:
    return {
        "vimshottari": _vimshottari(jd, place, as_of_date, moon_lon=chart.lon[1]),
        "narayana": _narayana(dob, tob, place, as_of_date),
    }


VIMSHOTTARI_ORDER: List[int] = [8, 5, 0, 1, 2, 7, 4, 6, 3]  # Ke, Ve, Su, Mo, Ma, Ra, Ju, Sa, Me
VIMSHOTTARI_YEARS: Dict[int, int] = {8: 7, 5: 20, 0: 6, 1: 10, 2: 7, 7: 18, 4: 16, 6: 19, 3: 17}


def _next_lord(lord: int) -> int:
    return VIMSHOTTARI_ORDER[(VIMSHOTTARI_ORDER.index(lord) + 1) % 9]


def _sub_periods(parent_lord: int, start_jd: float, years_fn: Callable[[int], float]) -> List[Tuple[int, float]]:
    """Nine sub-periods starting with the parent lord; years_fn(lord) gives each sub-period's length in years."""
    out: List[Tuple[int, float]] = []
    lord = parent_lord
    t = start_jd
    for _ in range(9):
        out.append((lord, t))
        t += years_fn(lord) * SIDEREAL_YEAR_DAYS
        lord = _next_lord(lord)
    return out


def _vimshottari(jd: float, place: Any, as_of_date: date, moon_lon: Optional[float] = None) -> Dict[str, Any]:
    """Vimshottari from the dossier's own Moon longitude (same ayanamsa as every other fact).

    pyjhora's dasha module recomputes the Moon with the library default ayanamsa, which drifted the
    mahadasha boundaries by ~4 days against the chart positions; computing here keeps the dossier
    self-consistent. Constants are pyjhora's (120-year cycle, sidereal year).
    """
    one_star = 360.0 / 27.0
    if moon_lon is None:
        from jhora.horoscope.chart import charts

        pp = charts.rasi_chart(jd, place)
        moon_lon = pp[2][1][0] * 30 + pp[2][1][1]
    nak = int(moon_lon / one_star)
    rem = moon_lon - nak * one_star
    first_lord = VIMSHOTTARI_ORDER[nak % 9]
    elapsed_days = (rem / one_star) * VIMSHOTTARI_YEARS[first_lord] * SIDEREAL_YEAR_DAYS
    md_start0 = jd - elapsed_days
    md_rows: List[Tuple[int, float, float]] = []
    mds = _sub_periods(first_lord, md_start0, lambda l: float(VIMSHOTTARI_YEARS[l]))
    for i, (lord, start) in enumerate(mds):
        end = mds[i + 1][1] if i + 1 < len(mds) else start + VIMSHOTTARI_YEARS[lord] * SIDEREAL_YEAR_DAYS
        md_rows.append((lord, start, end))

    window_from = as_of_date - timedelta(days=366)
    window_to = as_of_date + timedelta(days=3 * 366)
    as_of_jd = _date_to_jd(as_of_date)

    periods: List[Dict[str, Any]] = []
    current: Dict[str, Any] = {}
    for md, md_start, md_end in md_rows:
        bhuktis = _sub_periods(md, md_start, lambda l, md=md: VIMSHOTTARI_YEARS[l] * VIMSHOTTARI_YEARS[md] / 120.0)
        for j, (ad, ad_start) in enumerate(bhuktis):
            ad_end = bhuktis[j + 1][1] if j + 1 < len(bhuktis) else md_end
            ad_start_d, ad_end_d = _jd_to_date(ad_start), _jd_to_date(ad_end)
            in_window = ad_end_d >= window_from and ad_start_d <= window_to
            is_current = ad_start <= as_of_jd < ad_end
            if is_current:
                current.update({
                    "md": PLANET_CODES[md], "ad": PLANET_CODES[int(ad)],
                    "md_start": _jd_to_iso(md_start), "md_end": _jd_to_iso(md_end),
                    "ad_start": _jd_to_iso(ad_start), "ad_end": _jd_to_iso(ad_end),
                })
            if in_window:
                antaras = _sub_periods(
                    int(ad), ad_start,
                    lambda l, md=md, ad=ad: VIMSHOTTARI_YEARS[l] * VIMSHOTTARI_YEARS[md] * VIMSHOTTARI_YEARS[int(ad)] / 14400.0,
                )
                for k, (pd, pd_start) in enumerate(antaras):
                    pd_end = antaras[k + 1][1] if k + 1 < len(antaras) else ad_end
                    pd_start_d, pd_end_d = _jd_to_date(pd_start), _jd_to_date(pd_end)
                    if pd_end_d < window_from or pd_start_d > window_to:
                        continue
                    periods.append({
                        "level": "pd", "md": PLANET_CODES[md], "ad": PLANET_CODES[int(ad)], "pd": PLANET_CODES[int(pd)],
                        "start": _iso(pd_start_d), "end": _iso(pd_end_d),
                    })
                    if pd_start <= as_of_jd < pd_end:
                        current.update({"pd": PLANET_CODES[int(pd)], "pd_start": _iso(pd_start_d), "pd_end": _iso(pd_end_d)})
            else:
                periods.append({
                    "level": "ad", "md": PLANET_CODES[md], "ad": PLANET_CODES[int(ad)],
                    "start": _iso(ad_start_d), "end": _iso(ad_end_d),
                })
    periods.sort(key=lambda r: r["start"])
    mahadashas = [
        {"md": PLANET_CODES[md], "start": _jd_to_iso(s), "end": _jd_to_iso(e)} for md, s, e in md_rows
    ]
    return {
        "current": current,
        "mahadashas": mahadashas,
        "periods": periods,
        "window": {"pd_from": _iso(window_from), "pd_to": _iso(window_to)},
    }


def _date_to_jd(d: date) -> float:
    import swisseph as swe

    return swe.julday(d.year, d.month, d.day, 12.0)


def _narayana(dob: Tuple[int, int, int], tob: Tuple[int, int, int], place: Any, as_of_date: date) -> Dict[str, Any]:
    from jhora.horoscope.dhasa.raasi import narayana
    from jhora.panchanga import drik

    try:
        rows = narayana.narayana_dhasa_for_rasi_chart(drik.Date(*dob), tob, place, include_antardhasa=True)
    except Exception as e:
        logger.warning("narayana dasha failed: %s", e)
        return {"current": {}, "periods": []}
    periods: List[Dict[str, Any]] = []
    for i, row in enumerate(rows):
        md_sign, ad_sign, start_str, dur = int(row[0]), int(row[1]), str(row[2]), float(row[3])
        start_d = date.fromisoformat(start_str[:10])
        if i + 1 < len(rows):
            end_d = date.fromisoformat(str(rows[i + 1][2])[:10])
        else:
            end_d = start_d + timedelta(days=dur * SIDEREAL_YEAR_DAYS)
        periods.append({
            "md_sign": md_sign, "md_sign_name": SIGN_NAMES[md_sign], "md_lord": PLANET_CODES[SIGN_LORDS[md_sign]],
            "ad_sign": ad_sign, "ad_sign_name": SIGN_NAMES[ad_sign],
            "start": _iso(start_d), "end": _iso(end_d),
        })
    # group consecutive antardashas into their mahadasha run (a sign repeats in the second cycle)
    runs: List[Tuple[int, int]] = []  # (first_index, last_index)
    for i, p in enumerate(periods):
        if runs and periods[runs[-1][0]]["md_sign"] == p["md_sign"] and runs[-1][1] == i - 1:
            runs[-1] = (runs[-1][0], i)
        else:
            runs.append((i, i))
    current: Dict[str, Any] = {}
    for a, b in runs:
        for i in range(a, b + 1):
            p = periods[i]
            if date.fromisoformat(p["start"]) <= as_of_date < date.fromisoformat(p["end"]):
                current = {
                    "md_sign": p["md_sign"], "md_sign_name": p["md_sign_name"], "md_lord": p["md_lord"],
                    "ad_sign": p["ad_sign"], "ad_sign_name": p["ad_sign_name"],
                    "start": p["start"], "end": p["end"],
                    "md_start": periods[a]["start"], "md_end": periods[b]["end"],
                }
                break
        if current:
            break
    # Only the horizon-relevant slice (as_of - 2y .. as_of + 15y) to keep the dossier compact
    lo = _iso(as_of_date - timedelta(days=2 * 366))
    hi = _iso(as_of_date + timedelta(days=15 * 366))
    periods = [p for p in periods if p["end"] >= lo and p["start"] <= hi]
    return {"current": current, "periods": periods}


def _panchanga(jd: float, place: Any, chart: _Chart) -> Dict[str, Any]:
    from jhora.panchanga import drik

    out: Dict[str, Any] = {}
    try:
        t = int(drik.tithi(jd, place)[0])
        paksha = "Shukla" if t <= 15 else "Krishna"
        idx = t if t <= 15 else t - 15
        name = TITHI_NAMES[idx - 1] if idx <= 15 else str(idx)
        if t == 30:
            name = "Amavasya"
        out["tithi"] = "%s %s" % (paksha, name)
        out["tithi_idx"] = t
        out["tithi_lord"] = PLANET_CODES[(idx - 1) % 9]
    except Exception as e:
        logger.debug("tithi failed: %s", e)
    try:
        # Vedic weekday: the civil weekday of the local date, or the previous day when born before sunrise
        from jhora import utils

        y, m, d, fh = utils.jd_to_gregorian(jd)
        civil = date(int(y), int(m), int(d))
        sr = float(drik.sunrise(jd, place)[0])
        if fh < sr:
            civil = civil - timedelta(days=1)
        v = (civil.weekday() + 1) % 7  # Python Mon=0 -> Sun=0
        out["vara"] = VARA_LORDS[v]
        out["vara_name"] = VARA_NAMES[v]
    except Exception:
        pass
    moon_nak = _nak(chart.lon[1])
    out["nakshatra"] = moon_nak["name"]
    out["nakshatra_lord"] = moon_nak["lord"]
    out["nakshatra_pada"] = moon_nak["pada"]
    try:
        yg = int(drik.yogam(jd, place)[0])
        out["yoga"] = YOGA_NAMES[yg - 1]
    except Exception:
        pass
    try:
        k = int(drik.karana(jd, place)[0])
        out["karana"] = KARANA_FIXED.get(k) or KARANA_NAMES_CYCLE[(k - 2) % 7]
    except Exception:
        pass
    try:
        lm = drik.lunar_month(jd, place)
        out["lunar_month"] = LUNAR_MONTHS[int(lm[0]) - 1]
        out["adhika_masa"] = bool(lm[1])
    except Exception:
        pass
    try:
        out["sunrise"] = str(drik.sunrise(jd, place)[1])
        out["sunset"] = str(drik.sunset(jd, place)[1])
    except Exception:
        pass
    out["moon_sign"] = chart.sign[1]
    out["moon_sign_name"] = SIGN_NAMES[chart.sign[1]]
    out["lagna_sign"] = chart.lagna_sign
    out["lagna_sign_name"] = SIGN_NAMES[chart.lagna_sign]
    return out


def _nakshatra_profile(
    chart: _Chart, bodies: Dict[str, Dict[str, Any]], moon_nak: Dict[str, Any], arudhas: Dict[str, Any],
    special: Dict[str, Any], pushkara_nav: List[int], pushkara_bhaga: List[int],
) -> Dict[str, Any]:
    mi = moon_nak["idx"]
    janma = {
        **moon_nak,
        "deity": NAKSHATRA_DEITIES[mi],
        "gana": NAKSHATRA_GANA[mi],
        "symbol": NAKSHATRA_SYMBOLS[mi],
        "lord_house": chart.house(NAKSHATRA_LORDS[mi]),
    }
    la_nak = bodies[LAGNA_CODE]["nak"]
    lagna = {**la_nak, "lord_house": chart.house(NAKSHATRA_LORDS[la_nak["idx"]])}
    taras = {NAKSHATRA_NAMES[i]: _tara(mi, i) for i in range(27)}
    al_nak = None
    if "AL" in arudhas:
        al_sign = arudhas["AL"]["sign"]
        # arudha is a sign, so use the sign's midpoint for an indicative nakshatra set
        al_nak = {"sign": al_sign, "nakshatras": [NAKSHATRA_NAMES[i] for i in range(27) if (i * 40 / 3) < (al_sign + 1) * 30 and ((i + 1) * 40 / 3) > al_sign * 30]}
    star_lords = {}
    for code in PLANET_CODES:
        b = bodies[code]
        star_lords[code] = {
            "nak": b["nak"]["name"], "pada": b["nak"]["pada"], "star_lord": b["star_lord"],
            "star_lord_house": b["star_lord_house"], "star_lord_sign_lord": bodies[b["star_lord"]]["sign_lord"],
            "tara": b["tara_from_janma"], "navamsa_sign": b["navamsa_sign"],
        }
    return {
        "janma": janma,
        "lagna": lagna,
        "taras_from_janma": taras,
        "star_lords": star_lords,
        "gandanta": {
            "moon": _is_gandanta(chart.sign[1], chart.deg[1]),
            "lagna": _is_gandanta(chart.lagna_sign, chart.lagna_deg),
        },
        "pushkara": {"navamsa": _codes(pushkara_nav), "bhaga": _codes(pushkara_bhaga)},
        "arudha_lagna": al_nak,
    }


def _relations(
    chart: _Chart, rel: Dict[str, Any], nature: Dict[int, Dict[str, str]], bodies: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    from jhora.horoscope.chart import house

    exchanges: List[List[str]] = []
    for p in range(7):
        q = SIGN_LORDS[chart.sign[p]]
        if q != p and q < 7 and SIGN_LORDS[chart.sign[q]] == p and p < q:
            exchanges.append([PLANET_CODES[p], PLANET_CODES[q]])
    lord_of = {str(h): PLANET_CODES[l] for h, l in rel["lord_of"].items()}
    houses_of = {PLANET_CODES[p]: hs for p, hs in rel["houses_of"].items() if hs}
    kt = sorted({rel["lord_of"][h] for h in (1, 4, 5, 7, 9, 10)})
    dus = sorted({rel["lord_of"][h] for h in DUSTHANAS})
    # Classical maraka set: lords of 2 and 7 plus planets occupying 2 or 7; pyjhora's wider list kept separately
    marakas = sorted({rel["lord_of"][2], rel["lord_of"][7]} | set(chart.planets_in_house(2)) | set(chart.planets_in_house(7)))
    try:
        marakas_ext = sorted(int(m) for m in house.marakas(chart.h_to_p) if m not in ("L", None))
    except Exception:
        marakas_ext = marakas
    yogakaraka = None
    for p in range(7):
        owned = set(rel["houses_of"][p])
        if (owned & {4, 7, 10}) and (owned & {5, 9}):
            yogakaraka = PLANET_CODES[p]
    functional: Dict[str, List[str]] = {"benefic": [], "malefic": [], "neutral": []}
    for p in range(9):
        functional[nature[p]["functional"]].append(PLANET_CODES[p])
    conj_groups: List[List[str]] = []
    for s in range(12):
        occ = chart.occupants_of_sign(s)
        if len(occ) > 1:
            conj_groups.append(_codes(occ))
    return {
        "exchanges": exchanges,
        "lord_of": lord_of,
        "houses_of": houses_of,
        "kendra_trikona_lords": _codes(kt),
        "dusthana_lords": _codes(dus),
        "marakas": _codes(marakas),
        "marakas_extended": _codes(marakas_ext),
        "yogakaraka": yogakaraka,
        "functional": functional,
        "natural_benefics": [PLANET_CODES[p] for p in range(9) if nature[p]["natural"] == "benefic"],
        "natural_malefics": [PLANET_CODES[p] for p in range(9) if nature[p]["natural"] == "malefic"],
        "conjunctions": conj_groups,
        "lagna_lord": PLANET_CODES[SIGN_LORDS[chart.lagna_sign]],
        "lagna_lord_house": chart.house(SIGN_LORDS[chart.lagna_sign]),
        "moon_sign_lord": PLANET_CODES[SIGN_LORDS[chart.sign[1]]],
    }


# --- natal points --------------------------------------------------------------------------------


def build_natal_points(
    dob: str, tob: str, lat: float, lon: float, tz: float, place_name: Optional[str] = None, ayanamsa: Optional[str] = None
) -> Dict[str, Any]:
    """Planets + lagna + special lagnas + arudhas as longitudes only (cheap subset for the transit join)."""
    from jhora import utils
    from jhora.horoscope.chart import arudhas, charts
    from jhora.panchanga import drik

    utils.set_language("en")
    (y, m, d), (hh, mm, ss) = _resolve_birth(dob, tob)
    place = drik.Place(place_name or "Unknown", float(lat), float(lon), float(tz))
    jd = utils.julian_day_number((y, m, d), (hh, mm, ss))
    ayan = resolve_ayanamsa(ayanamsa)
    drik.set_ayanamsa_mode(ayan, None, jd)
    chart = _Chart(charts.rasi_chart(jd, place, ayanamsa_mode=ayan))

    def pt(lon_: float) -> Dict[str, Any]:
        n = _nak(lon_)
        return {"lon": _r(lon_), "sign": int(lon_ // 30) % 12, "nak": n["idx"], "nak_name": n["name"], "house": _house_from(chart.lagna_sign, int(lon_ // 30) % 12)}

    out: Dict[str, Any] = {
        "v": FACTS_VERSION,
        "ayanamsa": ayan,
        "lagna_sign": chart.lagna_sign,
        "moon_sign": chart.sign[1],
        "points": {LAGNA_CODE: pt(chart.lagna_lon)},
    }
    for p in range(9):
        out["points"][PLANET_CODES[p]] = pt(chart.lon[p])
    for code, fn in SPECIAL_LAGNA_FUNCS:
        try:
            s, dg = getattr(drik, fn)(jd, place, ayanamsa_mode=ayan)
            out["points"][code] = pt(int(s) * 30 + float(dg))
        except Exception:
            pass
    try:
        ba = arudhas.bhava_arudhas_from_planet_positions(chart.pp)
        out["arudha_signs"] = {("A%d" % (i + 1)): int(s) for i, s in enumerate(ba)}
        out["arudha_signs"]["AL"] = int(ba[0])
        out["arudha_signs"]["UL"] = int(ba[11])
    except Exception:
        out["arudha_signs"] = {}
    out["lord_of"] = {str(h): PLANET_CODES[SIGN_LORDS[_sign_of_house(chart.lagna_sign, h)]] for h in range(1, 13)}
    return out
