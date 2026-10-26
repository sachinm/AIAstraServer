# 27 — The life timeline: the full reading method, and the module that builds 18 years back and 18 years forward

Status: method and build plan, 2026-10-26 (Fable). Design only; no code. For the agent that builds it: Part A is the
astrology (what is read, in what order, and how an event's probability, timing and form are decided); Part B is the module
(data, pipeline, scoring, calibration against the person's real past, resolution, rendering, phases). It sits on docs 02, 10,
11, 23, 24, 25 and 26 and on the chart-data catalogue in `src/reading/chartData/catalog.ts` (115 types, all served by Radha).
Radha stays the only source of astrological data; Node computes nothing astrological; English only; no remedies, amounts,
medical or legal content; declined topics are never facilitated.

The idea in one paragraph. A kundli is read once, exhaustively, into a **foundation** (placements, aspects, strengths, lords
and dispositors, karakas, arudhas, special lagnas, argala, yogas). Then **several independent timing systems** (Vimshottari,
Yogini, Tithi Ashtottari, Narayana, the annual Tithi Pravesha chart and its dasha, transits with natal-degree contacts, and
the Jaimini activation of arudhas and argala) are each asked the same question for every window of the 36 years: *which
houses, karakas and arudhas does this system activate here?* Where three or more systems activate the same life area in the
same window, an event is probable; the activating planets say *how* and *in what form* (down to the classical correspondences
for colour, direction, field and foreign/local); the finest system that fires says *when*. The last 18 years are read first,
**blind**, and compared with a ledger of what actually happened (facts only, no judgement). The hit rate per system per
category calibrates the weights for the next 18 years. Windows where nothing fires are skipped.

---

## Part A — The method

### A.1 Foundation: read once, cite everywhere

Everything below is in the dossier or the catalogue (`docs/reading-engine/23`). Read in this order; later layers cite the
earlier ones.

1. **Lagna and the lights.** Lagna sign, degree, nakshatra, lord and its placement; Moon and Sun the same way; lagna by
   bhava chalit vs whole sign (`bhava`, `near_cusp` flags). Moon's dignity and cancellation (`yogas[]` Neecha Bhanga).
2. **Every planet's card** (`bodies.*`): sign, house, degree, nakshatra and pada, star lord and its house, sign lord and its
   house (dispositor), dignity, retro, combust, vargottama, conjunctions by degree, `aspects_to` (graha drishti incl. special
   aspects of Ma/Ju/Sa) and `aspected_by` (graha and rasi), `nature` natural/functional, `shadbala` (rupas, ratio, rank),
   `bav_at_sign`, `ishta/kashta`, `tara_from_janma`, `navamsa_sign`. Also GK (Gulika) and MD (Mandi) as bodies.
3. **Every house's card** (`houses.*`): sign, lord, co-lord, lord's house and dignity, occupants, `aspected_by` (count and
   name), `argala` (primary, secondary, obstructed_by), class (kendra/trikona/dusthana/upachaya), `sav`, `cusp_nak`.
4. **The house-lord chart.** For each house: lord → its house → that lord's sign lord → its house (two hops). Mark exchanges
   (`relations.exchanges`), lords in their own/kendra/trikona/dusthana, the lagna lord's chain, and every lord sitting in
   6/8/12 from its own house. This chart is the single most used table in Part B's "how" step.
5. **Strengths**: `strength.shadbala`, `strength.bhava` (bhava bala per house), `strength.vimsopaka` (varga strength),
   `strength.harsha`, `ashtakavarga` (SAV per sign, BAV per planet). Keep the numbers; quote them.
6. **Karakas**: natural (`karakas.natural`), chara (`karakas.chara` AK AmK BK MK PiK PK GK DK, `chara_houses`, karakamsa).
7. **Arudhas and special lagnas**: AL, UL, A1–A12 (`arudhas`), and per varga (`arudhas.dN` for D2/3/4/7/9/10/12/20/24/30/60);
   `special_lagnas` HL GL SL IL BL (and `sphutas` for the remaining sphutas). Planets on, aspecting (rasi drishti) and in
   2nd/7th/11th/12th from each arudha.
8. **Argala** on every house in D1 and in each subject varga (`argala.dN`).
9. **Yogas and doshas** (`yogas`, `doshas`), each with the houses and planets it binds; **relations**
   (`relations`: functional benefics/malefics, marakas, yogakaraka, dusthana lords).
10. **All vargas** the catalogue serves (D1–D144), each with lagna, lagna lord, planets with dignity and vargottama,
    `d1_lord_positions` (where each D1 house lord lands), kendra occupants.

Output of A.1: a **foundation pack** per kundli — deterministic, cached, versioned by dossier hash. Nothing in it changes with the
date.

### A.2 The subject frames for a life (what the timeline tracks)

The timeline tracks ten **markers**, each a frame of houses, karakas, arudhas and vargas (extend `FRAMES` in
`src/reading/packs/frames.ts`; the existing subjects map onto these):

| Marker | Houses | Natural karakas | Chara / arudha / special | Vargas | Ledger categories |
|---|---|---|---|---|---|
| Family: father, mother | 9 (father), 4 (mother), 10 | Su, Mo | PiK, MK, A9, A4 | D12 | family.father.*, family.mother.* |
| Family: siblings | 3 (younger), 11 (elder) | Ma | BK, A3, A11 | D3 | family.sibling.* |
| Love and marriage | 7, 5, 2, 11, 12 | Ve, Ju | DK, UL, A7 | D9 | relationship.*, marriage.* |
| Children | 5, 9, 2 | Ju | PK, A5 | D7 | child.* |
| Job and career | 10, 6, 1, 2 | Su, Sa, Me, Ju | AmK, A10, GL | D10 | job.* |
| Business | 7, 10, 11, 2, 5 | Me, Sa, Ju | AmK, A7, A10, HL | D10, D2 | business.* |
| Money: gain/loss | 2, 11, 5, 9 / 6, 8, 12 | Ju, Ve / Sa, Ra | HL, IL, A2, A11, A8 | D2 | money.* |
| Residence and movement | 4, 12, 3, 9 | Mo, Ra, Ve | A4, A12, A3 | D4 | residence.*, travel.long |
| Property and vehicles | 4, 2, 11 / 4, 3 | Ma, Ve / Ve | A4, MK | D4 (property), D16 (vehicles) | property.*, vehicle.* |
| Education | 4, 5, 9, 2 | Me, Ju | A5, A9 | D24 | education.* |
| Health | 1, 6, 8, 12 | Su, Mo, Sa | AK, GK, A6, A8 | D30 | health.* (facts only; never advice) |

Every system in A.3 is asked, per window: *which of these markers does it activate, through which planet, and how hard?*

### A.3 The timing systems, and what "activation" means in each

Each system produces, for every window, a set of `(marker, planet, strength 1–3, evidence id)` activations. The rules are
deterministic (file 11 §0: a rule on read fields) so they can be computed without a model and replayed over 36 years.

**S1 Vimshottari** (`dasha.vimsottari`, MD–AD–PD, PD only within ±3 years of today or inside a calibration window).
A period lord activates: the houses it owns, the house it sits in, the houses its **star lord** owns and occupies (the
kp_starlord rule), the arudhas it sits on or aspects by rasi drishti, and any marker whose karaka it is. Strength 3 when the
lord is a frame lord or karaka in dignity; 2 when it owns or occupies a frame house; 1 by star lord only. AD-from-MD in
6/8/12 lowers by one; a lord in a dusthana or debilitated makes the activation *adverse* (the same marker, negative sign).

**S2 Yogini** (`dasha.yogini`, 36-year cycle of eight yoginis, each ruled by a planet: Mangala Mo, Pingala Su, Dhanya Ju,
Bhramari Ma, Bhadrika Me, Ulka Sa, Siddha Ve, Sankata Ra). Same activation rule as S1 applied to the yogini's planet, at
weight 1.5; Sankata and Ulka periods make adverse activations of the markers their planet rules.

**S3 Tithi Ashtottari** (`dasha.tithi_ashtottari`, a 108-year lunar-day system; also `dasha.ashtottari` by nakshatra).
Applicability is conditional (`dasha.applicable` says which conditional systems apply to this chart; if it lists Ashtottari,
S3 counts at full weight, otherwise at half). Activation rule as S1 on the period lord.

**S4 Narayana** (`dasha.narayana`, rasi periods with sub-periods). The running *sign* is activated as a house from the
lagna, plus the houses of its lord and the planets in it; arudhas in that sign are activated at strength 2 (Jaimini: the
period of the sign holding AL/UL/A10 brings that arudha's matter to the surface). Also read the running sign from the AL:
the sign in the 7th from it activates relationships; 2nd/11th from AL money.

**S5 Annual: Tithi Pravesha** (`annual.tithi_pravesha` per year, `annual.tithi_pravesha_dasha` for its own dasha; keep
`annual.varsha` + `annual.mudda`/`annual.patyayini`/`annual.sahams` as the Tajaka second opinion). For each birthday-year:
the TP lagna's house in the natal chart (the year's theme), the TP lagna lord, planets in TP kendras, the muntha, the
year lord, and the TP dasha's monthly periods. Activation: the natal house that the TP lagna falls in (strength 2), the
houses of the year lord and TP lagna lord (2), TP dasha period lords (1.5, monthly windows). The sahams give the Tajaka
"events of the year" (Vivaha, Putra, Karma, Vyapara, Yatra, Bandhu …): a saham whose lord is strong in the annual chart
activates its marker at strength 1.5 for the year.

**S6 Transits** (`transit` snapshots, `transit_contacts` for ±2° natal contacts, and a Radha range export for the slow
planets over 36 years — see B.3 gap R-T1). Saturn, Jupiter, Rahu, Ketu, and Mars for short windows; Sun/Mercury/Venus for
the monthly grain only. Activation: a slow planet over a frame house, its lord, its karaka or its arudha (strength 1.5;
Jupiter supportive, Saturn/nodes adverse-or-testing by the frame's rules); a double transit on a frame house (2); a natal
contact exact (1.5) and a station in orb (2); the nodes' axis change over a frame axis (1.5); Sade Sati phases on 1/4/7/10
markers (1); eclipses on a frame point (1, when Radha serves them). Also the transit from the Moon (house from Moon) as a
second column, and `sav`/`bav` of the transited sign as a modifier (+0.5 if SAV ≥ 28 / BAV ≥ 4, −0.5 if SAV ≤ 22 / BAV ≤ 2).

**S7 Jaimini activation: arudhas, argala, special lagnas.** Not a dasha; a modifier on every window. When the window's
active lords (S1–S5) sit on, aspect (rasi drishti) or hold argala on the marker's arudha or special lagna (HL/IL for
money, GL for authority, SL for the self, UL for marriage), add +1 to that marker; an obstructed argala (virodha argala
from the active lord) adds −1. AL-based transits (Jupiter/Saturn in trines/7th from AL) add ±0.5.

**S8 Tajaka monthly (optional, later)**: the Mudda dasha and the monthly (masa) pravesha charts refine S5 to the month; add
once S5 is calibrated.

### A.4 Convergence: probability, timing and form

For each marker and each window (monthly by default, see A.6):

- **Score** = Σ over systems of (weight_system × strength × sign), where the default weights are S1 3.0, S4 2.0, S5 2.0,
  S6 1.5 (per transit item), S2 1.5, S3 1.5 (0.75 if not applicable), S7 ±1.0. Positive and adverse activations are summed
  separately (support score, test score).
- **Independence rule**: count the systems that activate the marker (any strength). Probability bands:
  - **High** (an event of this marker is expected): ≥ 3 systems *and* support score ≥ 7.
  - **Moderate**: ≥ 2 systems and score ≥ 4.5.
  - **Possible**: 1 system, score ≥ 2.5 (listed only in the drill-down).
  - **Quiet**: below. Skipped in the timeline.
  - **Testing**: test score ≥ 4.5 with ≥ 2 systems: an event that is adverse for the marker (loss, separation, illness,
    failed venture). Shown with the same bands, tagged testing.
- **When** (narrowing): the window's edges come from the finest system that fires — PD edge, TP dasha month, a station or exact
  contact date, a lunation on the frame point. The calendar builder (`src/reading/calendar`) already merges these edges.
- **How** (the mechanism and form): the activating planet with the highest weighted strength is the **agent**; its
  karakatwa, the house it rules in the frame, its dispositor chain, and its seat in the marker's varga give the form.
  The `significator → kind of person/thing` table (A.5) turns the agent into words. The second strongest is the
  **channel** (through whom or what). Culprits and contributors are the adverse and supportive agents, as in doc 25/26.

### A.5 The specifics: colour, brand class, direction, field, country, business outcome

These are classical correspondence tables. They give *probabilities over classes*, never certainties; the output says
"the chart leans to …" with the band, and the retrodiction (A.7) measures how often the lean was right for this person. All
tables live in one reference file (`src/reading/data/correspondences.json`) so prompts and the deterministic layer share them.

**Planet → colour family** (for vehicles, property finish, clothing, the "look" of a thing): Sun red/copper/orange; Moon
white/silver/cream/pearl; Mars red/scarlet/maroon; Mercury green; Jupiter yellow/gold/saffron; Venus white/pastel/variegated/
shiny; Saturn black/dark blue/grey; Rahu smoky/dark/multicolour; Ketu brown/grey/variegated. The car's colour family =
the colour of the strongest planet among: D16 lagna lord, 4th lord in D16, Venus's dispositor, and the dasha lord at purchase.
Brand *class* (not brand): Venus/Jupiter in dignity → premium; Mercury/Moon → compact, economical; Saturn → used, utilitarian,
heavy; Mars → sporty, fast; Rahu → foreign-made, unusual. State the top two classes with their share of the score.

**Sign → direction** (property, residence, the country/city relative to birthplace): Aries/Leo/Sagittarius east;
Taurus/Virgo/Capricorn south; Gemini/Libra/Aquarius west; Cancer/Scorpio/Pisces north. **Planet → direction**: Sun east,
Venus south-east, Mars south, Rahu south-west, Saturn west, Moon north-west, Mercury north, Jupiter north-east, Ketu (take
the nodes' axis; report as south-west/north-east). House direction = D4 lagna sign, 4th lord's sign, and the planet in or
aspecting the D4 4th, weighted; facing direction from the D4 lagna. Residence abroad: the 12th sign's direction and the
agent planet's direction, from the birthplace (then from the current residence once stored — M13).

**Planet → field of education / profession** (4th, 5th, 9th, D24 lagna lord and 5th lord in D24 for education; 10th lord,
D10 lagna lord and the AmK for profession): Sun medicine, administration, government, physics; Moon nursing, hospitality,
psychology, marine, public-facing; Mars engineering, surgery, military/police, real estate, sport; Mercury commerce,
accounting, computing, writing, law (with Jupiter), trade; Jupiter law, finance, teaching, religion, counselling,
economics; Venus arts, design, fashion, entertainment, luxury, hospitality, diplomacy; Saturn civil/mechanical/mining
engineering, labour, oil, agriculture, long institutions; Rahu foreign, technology, aviation, pharma, unconventional;
Ketu research, mathematics, spiritual, esoteric, precision work. Sign flavours modify (Scorpio research/occult, Gemini
communication, Capricorn structures …). Output the top three fields with shares.

**Country of work / foreign vs local**: foreign when ≥ 2 of: 12th lord with 10th lord or in 10th; D10 lagna lord in the D10
12th/9th; Rahu in 10th/7th or with the 10th lord; the 4th lord in 12th or 9th; AmK in 12th/9th; A10 in a movable sign with
Rahu/Saturn; the current MD lord is the 12th/9th lord or Rahu. Direction of the country = direction of the 12th sign /
10th sign / agent planet. Never a country name; the direction and "far/near" (dual sign = near, movable = far, fixed = long
stay) only.

**Business: worked or not; made money or not**: business is promised when 7th and 10th lords relate (conjunction, aspect,
exchange, mutual kendras), Mercury/Saturn strong, D10 lagna lord in a kendra or trikona of D10, and HL/IL connected to the 11th.
It *works* in a window where S1/S4/S5 activate 7/10/11 with the agent in dignity and no obstructed argala on the 11th; it
*fails* in windows where the same houses are activated adversely (agent in 6/8/12, Saturn/Ketu on the 7th lord, Sade Sati on
the 10th from Moon). Money from it: 11th lord and HL/IL activation in the same window (support) vs 12th/8th activation (loss).

**Family events**: father — 9th, Sun, PiK, D12 9th; mother — 4th, Moon, MK, D12 4th; the death/illness of a parent is read from
maraka lords for the 9th/4th (2nd and 7th from those houses) and Saturn/Ketu transits on them (reported as "a hard period for
the father's health", never as a prediction of death); birth of a child — 5th lord, Jupiter, PK, D7 5th activated by S1 + S5
+ Jupiter transit on 5th/9th/lagna/Moon; marriage — 7th lord/Venus/DK/UL activated by ≥ 3 systems with Jupiter on 7th/lagna/
Moon or the UL; separation — the same markers adverse with Saturn/Rahu/Ketu as agent and the 12th/6th activated.

### A.6 Resolution: daily, weekly, monthly — and skipping the quiet

- **Monthly** is the base grain for all 36 years: every system's edges are snapped to months, scores computed per month.
- **Weekly** inside any month that is Moderate or High for any marker.
- **Daily** only within ±3 days of a station in orb, an exact natal contact, a PD edge, a lunation or eclipse on a frame
  point, or a TP/Mudda period edge — and only inside High windows. Daily rows need the Moon's daily sign/nakshatra/tithi, which
  the catalogue does not serve yet (gap R-T2); until it does, the daily grain lists the dated edges only, with the honesty
  note from the calendar module.
- **Quiet** months (every marker below Possible) are collapsed into a single "nothing notable, <lords running>" strip.
- The past 18 years are built at the monthly grain throughout (weekly where the ledger has an event, to score the match);
  the next 18 years at monthly, with weekly/daily computed lazily when the person opens a window.

### A.7 Verification against the real past: the ledger and the blind cast

1. **Ledger** (facts only): the person records what happened in the last 18 years — their own life, family, job, love,
   moves, property, vehicles, business, education, health — each with a date (day, month or year precision), a category, a
   place, and free attributes (car colour and make, house direction and floor, field of study, country, outcome). No
   judgement anywhere in the UI or the data: a business that closed is `business.end` with `outcome: closed`, nothing more.
2. **Blind cast**: the engine builds the 18-year past timeline *without reading the ledger* (same code path as the future).
3. **Match**: each ledger event is matched to the windows of its marker: a hit when the event date falls inside a Moderate or
   High window of the right marker (±1 month at the monthly grain), a near-miss within ±3 months, else a miss. Specifics are
   scored separately (colour family, direction quadrant, field class, foreign/local, outcome sign).
4. **Calibration per kundli**: per system and per marker, precision (windows that saw an event ÷ windows predicted) and recall
   (events hit ÷ events). The system weights for the next 18 years are the defaults multiplied by (0.5 + precision) and the
   conditional systems are kept only when `dasha.applicable` and the empirical precision agree. The calibration is stored
   and shown ("for your chart Narayana and the annual chart timed 8 of 10 moves; Yogini timed 3 of 10").
5. **Report**: the past timeline is rendered with the ledger events on it — hits, near-misses and misses visible — so the
   person can see where the astrology was right. Misses are facts too; they are never explained away.

---

## Part B — The module (design at the 5th–10th floor)

### B.1 Scope and non-goals

In scope: a per-kundli life timeline, 18 years back and 18 years forward from today, with a marker-by-window probability
grid, the agent/channel and form for each High/Moderate window, the specifics where the tables apply, the past matched to a
ledger of facts, per-kundli calibration, and a UI from year strip to day. Out of scope for the first build: Tajaka monthly
charts (S8), prashna, muhurta, compatibility, remedies, anything medical/legal/financial-advice, and languages other than
English.

### B.2 Data model (new tables; migrations written, never applied, without Sachin's OK)

- `life_events` — the ledger. `id`, `user_id`, `kundli_id`, `category` (dotted, from the marker table: e.g. `vehicle.purchase`,
  `residence.move`, `job.start`, `business.end`, `family.father.illness`), `date`, `date_precision` (day|month|year),
  `place`, `attributes` jsonb (colour, make, direction, floor, field, country, outcome, with whom), `source` (user|import),
  `created_at`. No free-text judgement fields.
- `timeline_builds` — one per kundli build: `id`, `kundli_id`, `dossier_hash`, `from`, `to`, `grain`, `system_versions` jsonb
  (calc versions of every type used), `weights` jsonb (defaults or calibrated), `status`, `cost_usd`, `created_at`.
- `timeline_windows` — the grid: `build_id`, `marker`, `from`, `to`, `grain` (month|week|day), `band` (high|moderate|possible|
  testing), `support_score`, `test_score`, `systems` jsonb (per system: strength, planet, evidence ids), `agent`, `channel`,
  `how` (text, from the annotation step), `form` jsonb (specifics with shares), `prompt_version`.
- `timeline_matches` — `build_id`, `event_id`, `window_id` nullable, `result` (hit|near|miss), `specifics` jsonb (per
  attribute: predicted class, actual, correct).
- `timeline_calibration` — `kundli_id`, `system`, `marker`, `precision`, `recall`, `n`, `weight`, `computed_at`.
- `kundli_data` already stores every catalogue type per kundli (annual types by `@year` variant; moving types are not stored).

### B.3 Data acquisition from the catalogue (and the two Radha gaps)

Per kundli, in a background job (Radha's 1 call/s limit; use the existing `ensureChartData` queue with the registration pull):

| Need | Catalogue types | Calls | Tier |
|---|---|---|---|
| Foundation | d1, all vargas incl. D16/D24/D30/D12/D7/D3/D4/D9/D10, arudhas (+ `arudhas.dN`), argala.d1 (+ `argala.dN`), karaka.chara, ashtakavarga, strength.shadbala/bhava/vimsopaka/harsha, aspects, relations, benefic_malefic, dignities, bhava, sphutas, yogas, doshas, dasha.applicable | ~60 | registration + on-demand on first timeline build |
| Dashas | dasha.vimsottari (to PD), dasha.yogini, dasha.tithi_ashtottari (and dasha.ashtottari), dasha.narayana, optional dasha.chara/kalachakra/sudasa/drig for later | 4–8 | on first build |
| Annual | annual.tithi_pravesha@Y and annual.tithi_pravesha_dasha@Y for Y = today−18 … today+18 (37 years); annual.varsha@Y + sahams@Y as the Tajaka second opinion | 74–148 | on first build, ~2–3 min at 1/s |
| Transits | transit_contacts (from, to ≤ 10 years: 4 calls for 36 years); transit snapshots for the current ±3 years | 4 + a few | on first build; refresh monthly |
| Slow-planet range | **R-T1 gap**: Radha has no range export for ingresses, stations, lunations and eclipses over decades; the `transit` export is a snapshot around `at`. Add `transit_range` (params from, to, planets, with sign ingresses, retro/direct stations with longitude, lunations, eclipses, Sade Sati phases, nodes' sign changes). Deterministic, fast, same pyjhora calls as transit_export. | 1–4 | needed for S6 over 36 years |
| Daily Moon | **R-T2 gap**: `transit_daily` (params from, to ≤ 93 days): Moon sign/nakshatra/pada/tithi per day for the daily grain. | lazy | needed for A.6 daily rows |

Until R-T1 lands, S6 for years outside the snapshot's horizon uses only `transit_contacts` (which already covers 36 years in 4
calls, including stations in orb) — enough for a first calibration.

### B.4 Pipeline

```
ledger (user)                 foundation pack ─┐
                                               ├─ activation matrix (deterministic, per system) ─ convergence ─ windows
dossier + catalogue types ─ dasha stack ────────┤                                                                  │
annual charts (TP, varsha) ─ annual layer ──────┤                                                 annotation (LLM, High/Moderate only)
transits + contacts ──────── transit layer ─────┘                                                                  │
                                                                                     past: match ledger ─ calibrate ─ rebuild future with weights
```

Stages (each a pure module under `src/reading/timeline/`, unit-tested on the G1 fixture):

0. **Ledger capture** (`ledger/`): a form plus an English free-text interview ("tell me what happened in 2014") that an LLM
   turns into proposed `life_events` rows the person confirms one by one. The model extracts facts only; a prompt rule forbids
   evaluation words. Imports later (CSV).
1. **Foundation pack** (`foundation.ts`): A.1 from the dossier and catalogue items; cached by dossier hash. Reuses
   `buildEvidencePack`'s renderers; adds the house-lord chart and per-varga arudha/argala blocks.
2. **Dasha stack** (`dashas.ts`): one normalised period table per system `{system, level, lord|sign, from, to}`; Vimshottari
   to PD inside ±3 years of today and inside ledger-event months, AD elsewhere; Yogini, Tithi Ashtottari to the sub-period;
   Narayana to the sub-period.
3. **Annual layer** (`annual.ts`): per year, the TP lagna's natal house, lords, muntha, sahams, TP dasha months.
4. **Transit layer** (`transits.ts`): from `transit_contacts`, the range export (R-T1) and snapshots; the calendar module's
   event list is reused for the edges.
5. **Activation** (`activate/<system>.ts`): the rules of A.3, each returning `(marker, planet, strength, sign, evidence)` per
   window. Deterministic; every output cites a dossier path (so `resolveEvidence` can check it).
6. **Convergence** (`converge.ts`): A.4 scoring with the weights (default or calibrated), bands, agent/channel selection,
   quiet-collapse, resolution rules of A.6.
7. **Annotation** (`annotate.ts`): one model call per High/Moderate window (or one per year, batching that year's windows, to
   keep calls ≈ 37): input = foundation summary + the window's activations + the correspondence tables + the marker's
   significator table; output = `how` (≤ 60 words), `form` (specifics with shares), culprits/contributors, in the findings
   JSON shape of doc 25 (reuse `findingZ` v2 fields). Model: the specialist tier (3.x Flash-Lite), temperature 0.2, thinking
   low, schema-constrained. No annotation for Possible windows.
8. **Match and calibrate** (`calibrate.ts`): A.7; recompute weights; rebuild the future windows with them (stages 6–7 only;
   the activation matrix is unchanged).
9. **Render** (`render.ts` + web): the year strip (36 cells, one colour per band per marker, quiet cells grey), month grid per
   year, week/day drill-down, window cards (marker, band, systems agreeing with their evidence, agent/channel, how, form,
   matched ledger events or "no record"), the calibration panel, and the honesty line about grain.
10. **Refresh**: monthly cron (transits, the current year's TP), on dossier change (full rebuild), on ledger change (stages 8–9).

### B.5 Scoring and thresholds, pinned for the first build

- Weights and bands as in A.4; all in one config object with env overrides (`TIMELINE_WEIGHTS` json).
- Strength per activation 1–3 as in A.3; sign +1 support / −1 test; SAV/BAV modifier ±0.5 on S6 only.
- A marker's **agent** = argmax over activations of weight × strength; ties broken by shadbala rank.
- Quiet collapse when every marker < 2.5 for the month.
- Calibration floor and ceiling: a system's weight never goes below 0.5× or above 1.5× its default from one person's data.
- Specifics: emit a class only when its share ≥ 0.4; otherwise "no clear lean".

### B.6 Cost, latency and flags

- Data pull: ~150–230 Radha calls per kundli on first build (≈ 3–4 minutes at 1/s, in the background; the person sees the
  foundation and dashas first, annual and transit layers fill in). Stored in `kundli_data`, so the second build is free.
- Deterministic stages: milliseconds.
- Annotation: ≈ 37 calls (one per year) × ~6k input / ~1.5k output tokens on Flash-Lite ≈ $0.5–1.5 per kundli full build;
  future-only rebuilds after calibration ≈ half. Cache by (build weights hash, year, prompt version).
- Flags: `TIMELINE_ENABLED` (off by default), `TIMELINE_SYSTEMS` (default `S1,S2,S3,S4,S5,S6,S7`), `TIMELINE_GRAIN`,
  `TIMELINE_ANNOTATE=0` (deterministic only, for QA).

### B.7 Phases (each a branch off `develop`, merged `--no-ff`, tests green; migrations written only)

- **P0 — Ledger** (server + web): tables, capture form, interview extraction, confirm flow. Done when a person can enter 20
  dated events with attributes and see them on a plain year strip.
- **P1 — Foundation + dasha stack + activation + convergence, past only, no LLM**: builds the 18-year past grid from S1, S2,
  S3, S4, S7 and `transit_contacts`; matches the ledger; prints precision/recall per system. Done when the G1 fixture plus two
  panel charts with ledgers produce a calibration table and the blind-cast hit rate is reported (target to beat: a random
  monthly baseline).
- **P2 — Annual layer + transit range**: S5 from TP (+ Tajaka), S6 from R-T1 once Radha serves it; recalibrate. Radha work:
  `transit_range` (R-T1) in `AIAstra_Radha` on its own branch, tests, catalog entry + seed migration on the server.
- **P3 — Annotation and specifics**: stage 7 with the correspondence tables; specifics scored against the ledger; the window
  cards. Done when High windows carry how/form and the past specifics report their own hit rate.
- **P4 — Future timeline + UI + refresh**: 18 years forward with calibrated weights; year strip → month → week/day; monthly
  refresh; daily grain once R-T2 lands.
- **P5 — Deeper floors** (after Sachin's review): Tajaka monthly (S8), chara/kalachakra/sudasa as optional systems, eclipses,
  per-marker custom frames, exporting the timeline as a document.

### B.8 Open points for Sachin

1. Which conditional dasha systems to include by default beyond Yogini and Tithi Ashtottari (Chara, Kalachakra, Sudasa are
   served and cheap; each adds a column and some noise until calibrated).
2. Whether the ledger interview may ask about family members' events (it is the person's own account; the data stays under
   their user id; declined topics still apply).
3. The honesty line for specifics — proposed: "classical correspondence, right about N of M times for your chart so far".
4. Radha gaps R-T1 (range export) and R-T2 (daily Moon): Radha is hands-off until 2026-10-25 per the earlier rule; it is now
   open, so P2 can include them.

### B.9 Handover notes for the building agent

- Start from doc 26's passes and the existing modules: `packs/selector.ts` (pack renderers), `calendar/calendar.ts` (dated
  edges), `packs/contacts.ts` (natal contacts), `nodes/convergence.ts` (bands and brief), `prompts/v2/*` (findings shape),
  `chartData/catalog.ts` + `ensureChartData` (fetching; annual types take `@year`; moving types use the `fetchTransit` /
  `transitContacts` pattern, options inside `params`).
- Every activation and every date must cite a dossier/catalogue path; the prose checker (`grounding/checker.ts`) applies to
  annotations.
- Keep the deterministic layer model-free so the blind cast is reproducible; the model only writes `how`/`form`.
- Tests: unit tests per stage on G1; a golden "ledger" fixture for G1 with ten dated events (made up for the fixture, labelled
  as such) so the match/calibration code has a stable target.
