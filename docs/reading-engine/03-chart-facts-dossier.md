# 03 — Chart facts dossier and evidence packs

The dossier is the deterministic, versioned, per-kundli JSON that replaces raw chart dumps. It is built by the Python engine in one call, stored in `kundli_facts`, and sliced into **evidence packs** per subject by the server. The LLM never sees a longitude string it has to parse and never computes a house number.

Design rules:

- **Numeric and normalised**: longitudes as decimal degrees, signs as 0–11 plus English names, houses 1–12, dates ISO-8601, booleans explicit.
- **Every leaf fact has a stable id** (dot path) so specialists can cite it and the checker can verify it. Example ids: `planet.Me.house=9`, `house.10.lord=Me`, `dasha.vim.current.ad=Me`, `transit.Ke.2026-11.sign=Pi`.
- **Precomputed relations**: lordships, aspects, argala, conjunctions, exchanges, dispositor and star-lord chains, "current" flags. Anything a reading step needs more than once is a field, not a derivation.
- **Compact**: no pretty-printing when sent to the model; short keys; about 25–40k tokens for the full dossier, 6–12k for an evidence pack.
- **Versioned**: `facts_version` (schema) + `engine_commit` (pyjhora) + `ayanamsa`. A new version triggers a rebuild for all users via the worker.

## 1. New Python export types

Added to `AIAstra_Radha/src/jhora/api.py` + `export.py` (same endpoint, new `type` values, same `{type, data}` envelope):

| type | Input | Output | Notes |
|---|---|---|---|
| `facts` | dob, tob, lat/lon/tz (preferred) or place, ayanamsa, `as_of` date (optional, default today), `vargas` list (default `D1,D2,D3,D4,D7,D9,D10,D12,D30,D60`) | the full dossier below | One invoke, ~1–3 s compute on the 2048 MB Lambda. Replaces the ten per-field calls for new users; old fields stay for the Charts page until the UI reads from facts. |
| `transits` | `from` date, `to` date, lat/lon/tz (for local day boundaries only), ayanamsa, `step` (`daily` for the first 60 days, `weekly` after) | planet positions per step + sign and nakshatra ingress dates for Su, Mo (optional), Ma, Me, Ju, Ve, Sa, Ra, Ke; retrograde stations; new/full moons | **Not per user**: positions are geocentric; store one row per date range in `transit_snapshots` and reuse for everyone. |
| `natal_points` | same as facts | planets + lagna + special lagnas + arudhas as longitudes only | Cheap subset used by the transit analyst to compute "over natal X" without the whole dossier; also lets the server compute transit-vs-natal in Node if needed. |

Also: when `place` is used, return the resolved `lat`, `lon`, `tz` in the `facts` output so the server stores them and never geocodes again.

## 2. Dossier schema (abridged; full JSON Schema to live at `src/reading/schema/facts.v1.schema.json`)

```jsonc
{
  "v": 1,                              // facts_version
  "engine": { "pyjhora": "4.5.0", "commit": "…", "ayanamsa": "LAHIRI", "houses": "whole_sign" },
  "as_of": "2026-10-24",
  "birth": { "date": "2002-04-27", "time": "17:05:00", "tz": 5.5, "lat": 28.9167, "lon": 77.0167, "place": "…" },
  "panchanga": { "tithi": "Krishna Pratipat", "tithi_lord": "Su", "vara": "Sa", "nakshatra": "Swati", "yoga": "Siddhi", "karana": "Balava", "lunar_month": "Chaitra", "sunrise": "05:48:41", "sunset": "18:50:58" },

  "bodies": {                           // La, Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke (+ Md Maandi, Gk Gulika)
    "Me": {
      "lon": 32.266, "sign": 1, "sign_name": "Taurus", "deg_in_sign": 2.266,
      "house": 9,                        // whole sign from Lagna
      "bhava": 9, "near_cusp": false,    // Sripati, for flags only
      "nak": { "idx": 2, "name": "Krittika", "pada": 2, "lord": "Su" },
      "navamsa_sign": 9,
      "dignity": "friend",               // exalted|moolatrikona|own|friend|neutral|enemy|debilitated
      "retro": false, "combust": true, "speed": 1.92,
      "owns": [1, 10],                   // houses owned from Lagna
      "nature": { "natural": "benefic", "functional": "benefic" },   // functional per lagna rules
      "conj": ["Ma", "Ve", "Sa", "Ra"],  // same sign
      "aspects_to": { "graha": [3], "rasi": [4, 7, 10] },            // houses aspected
      "aspected_by": { "graha": ["Ju"], "rasi": ["Mo"] },
      "star_lord": "Su", "star_lord_house": 8, "sign_lord": "Ve", "sign_lord_house": 9,
      "shadbala": { "rupas": 6.1, "required": 7.0, "ratio": 0.87, "rank": 5 },
      "ishta": 23.4, "kashta": 36.6,
      "bav_at_sign": 4,
      "tara_from_janma": "Vipat",        // tara of this planet's nakshatra counted from Moon's
      "flags": ["combust"]               // gandanta|pushkara|combust|vargottama|retro|planetary_war
    }
  },

  "houses": {
    "10": {
      "sign": 2, "sign_name": "Gemini", "lord": "Me", "lord_house": 9, "lord_dignity": "friend",
      "occupants": ["Ju"], "aspected_by": { "graha": ["Sa"], "rasi": [] },
      "argala": { "primary": ["Mo"], "obstructed_by": [] },
      "sav": 31, "class": ["kendra", "upachaya"], "cusp_nak": { "name": "Ardra", "lord": "Ra" }
    }
  },

  "vargas": {                           // per varga: lagna, planet->house, house->planets, dignity in varga
    "D10": {
      "lagna_sign": 5, "lagna_lord": "Me",
      "planets": { "Me": { "sign": 9, "house": 5, "dignity": "friend", "vargottama": false } },
      "houses": { "10": { "sign": 2, "lord": "Me", "occupants": [] } },
      "d1_lord_positions": { "10": { "lord": "Me", "varga_house": 5, "varga_dignity": "friend" } }
    }
  },

  "karakas": { "chara": { "AK": "Sa", "AmK": "Mo", "BK": "Ju", "MK": "Ma", "PiK": "Su", "PK": "Ve", "GK": "Ra", "DK": "Me" },
               "karakamsa": { "sign": 2 } },
  "arudhas": { "AL": { "sign": 11, "house": 3 }, "A2": {}, "A4": {}, "A7": {}, "A10": {}, "UL": {} },
  "special_lagnas": { "HL": {}, "GL": {}, "IL": {}, "SL": {}, "BL": {}, "VL": {} },

  "yogas": [ { "name": "Gaja Kesari", "planets": ["Ju", "Mo"], "houses": [10, 2], "class": "benefic", "strength": "moderate" },
             { "name": "Dharma-Karmadhipati", "planets": ["Me", "Ve"], "houses": [9, 10], "class": "raja" } ],
  "doshas": [ { "name": "Manglik", "present": false, "exceptions": [] } ],

  "ashtakavarga": { "sav": [28, 31, …12], "bav": { "Sa": [3, 4, …12] } },

  "dasha": {
    "vimshottari": {
      "current": { "md": "Sa", "ad": "Me", "pd": "Ke", "md_start": "2020-11-11", "md_end": "2039-11-12", "ad_start": "2023-11-14", "ad_end": "2026-07-24", "pd_start": "…", "pd_end": "…" },
      "periods": [ { "md": "Sa", "ad": "Me", "pd": "Ve", "start": "2026-07-24", "end": "2027-02-01" } ]   // PD level for as_of-1y .. as_of+3y, AD level beyond
    },
    "narayana": { "current": { "md_sign": 7, "ad_sign": 10, "start": "…", "end": "…" }, "periods": [ … ] }
  },

  "nakshatra_profile": {
    "janma": { "name": "Swati", "pada": 4, "lord": "Ra", "deity": "Vayu", "gana": "Deva", "symbol": "…", "lord_house": 9 },
    "lagna": { "name": "Hasta", "pada": 4, "lord": "Mo" },
    "taras_from_janma": { "Krittika": "Vipat", … },   // all 27, so transit/dasha nakshatras map instantly
    "gandanta": { "moon": false, "lagna": false }, "pushkara": []
  },

  "relations": {                        // precomputed lookups the analysts would otherwise derive
    "exchanges": [["Me", "Ve"]],
    "lord_of": { "1": "Me", "2": "Ve", … }, "houses_of": { "Me": [1, 10], … },
    "kendra_trikona_lords": ["Me", "Ve", "Sa"], "dusthana_lords": ["Ma", "Su", "Mo"], "marakas": ["Ve", "Ju"],
    "yogakaraka": null, "functional": { "benefic": [...], "malefic": [...], "neutral": [...] }
  }
}
```

Transit snapshot (global):

```jsonc
{
  "v": 1, "ayanamsa": "LAHIRI", "from": "2026-10-24", "to": "2028-10-24",
  "positions": [ { "date": "2026-10-24", "Sa": { "lon": 345.1, "sign": 11, "nak": "Uttara Bhadrapada", "retro": false }, "Ju": {…}, "Ra": {…}, "Ke": {…}, "Ma": {…}, "Su": {…} } ],
  "ingresses": [ { "planet": "Ke", "kind": "sign", "into": 10, "date": "2026-12-05" }, { "planet": "Ke", "kind": "nak", "into": "Shatabhisha", "date": "…" } ],
  "stations": [ { "planet": "Sa", "kind": "retro_start", "date": "…" } ],
  "lunations": [ { "kind": "new", "date": "…", "sign": 6, "nak": "…" } ]
}
```

The server joins transit snapshot × natal points to produce the per-user **transit table** at pack-build time (cheap arithmetic):
`{ date_from, date_to, planet, sign, nak, house_from_lagna, house_from_moon, house_from_AL, over_natal: ["Ju"], same_nak_as_natal: ["Ju"], bav: 4, sav: 31, sade_sati: "peak"|null, double_transit_on: [10] }`.

## 3. Evidence pack selector (server, no LLM)

`buildEvidencePack(dossier, transitTable, subject, horizon) → EvidencePack`. Deterministic, unit-tested, one table-driven rule per subject (the frame table in file 02).

An evidence pack contains, in this order (stable prefix first, for implicit caching):

1. `header`: birth, panchanga, as_of, horizon, subject frame (houses, karakas, varga, arudhas) — ~300 tokens.
2. `d1_core`: all 12 houses (sign, lord, lord_house, occupants, class) and all bodies in compact form — ~1.5k tokens. Always included: the analysts need the whole D-1 skeleton to reason about relations.
3. `subject_detail`: full records for the frame houses, their lords, the karakas, with aspects, argala, strength, yogas touching them — ~1–2k.
4. `varga`: the subject varga in full plus `d1_lord_positions` for the frame houses — ~0.8k per varga.
5. `arudha_special`: AL, subject arudhas, relevant special lagnas — ~200.
6. `dasha`: current MD/AD/PD + all periods in the horizon (PD level ≤ 1y) with, for each distinct lord, its compact body record — ~1–2k.
7. `transits`: transit table rows for the horizon for Sa, Ju, Ra, Ke (+ Ma for ≤ 3m), restricted to rows that touch frame houses, their lords, karakas, Moon, Lagna, AL — ~1–2k.
8. `nakshatra`: nakshatra_profile + nak/star-lord/tara for every planet named above — ~600.
9. `relations`: exchanges, functional classes, marakas, yogakaraka — ~200.

Which analyst gets which sections:

| Analyst | Sections |
|---|---|
| promise | 1, 2, 3, 4, 5, 9 |
| dasha | 1, 2, 3 (lords only), 4 (d1_lord_positions), 6, 8 (dasha lords), 9 |
| transit | 1, 2, 5, 6 (windows only), 7, 8 (transit naks) |
| nakshatra | 1, 2, 6 (lords), 7 (nak rows), 8 |
| synthesizer | header + the analysts' findings + a 20-line "key facts" card (lagna, Moon, current MD/AD/PD, the frame houses and lords) |

For `general_life_direction` the pack uses the `career_work` + `income_wealth` + `marriage_relationship` frames at reduced detail. For `explain_term` only header + the relevant bodies.

## 4. Storage

| Table | Row | Lifecycle |
|---|---|---|
| `kundli_facts` | `kundli_id`, `facts_version`, `engine_commit`, `as_of`, `dossier jsonb`, `natal_points jsonb`, `built_at` | Built by the worker after sync; rebuilt when `facts_version` changes or birth data changes (admin edit). `as_of` only affects the `current` dasha flags, which the server recomputes from `periods` at request time, so the row does not go stale daily. |
| `transit_snapshots` | `from_date`, `to_date`, `ayanamsa`, `snapshot jsonb`, `built_at` | Daily job (EventBridge, kundli-worker) builds a 24-month window starting today; the server reads the newest row covering the horizon. ~50–100 KB per row. |

Gemini explicit cache (when billing is paid): cache object = persona + method prompt + the **full dossier** (not a pack) so one cache serves all specialists for a user; key hash = prompt version + dossier hash + model id. Packs are then sent as the per-request `contents` and the model still benefits from the prefix. See file 05 for when this pays off versus implicit caching.

## 5. Validation of the dossier itself

- Golden chart: the chart in `notes.txt` (2002-04-27 17:05 IST, 28N55 77E01, the `kundli.json` sample) exported from Jagannatha Hora. Every field the dossier shares with JHora output (longitudes, nakshatra/pada, navamsa, special lagnas, dasha dates) must match to the printed precision. pyjhora already has `test_export_d1_jhora_reference.py` for D-1; extend the same pattern to special lagnas, arudhas, Narayana dasa and D-10.
- Property tests: every house has exactly one lord; every body has a house 1–12; `houses_of` is the inverse of `lord_of`; dasha periods are contiguous and cover the lifespan; transit ingress dates are monotonic per planet.
- Snapshot test on the full dossier JSON for the golden chart, checked into the Python repo, so unintended changes in pyjhora upgrades are caught.
