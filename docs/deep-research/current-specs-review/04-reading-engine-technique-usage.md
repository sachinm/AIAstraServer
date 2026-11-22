# 04 — How the reading-engine docs choose and combine techniques

Read-only review, 2026-11-18, of `docs/reading-engine/` docs 11, 26, 43, 46, 47, 53, 55, 56, 67, 69, 70, 72, 76, 78,
80, 81 (and 82-85 where they touch techniques; 82-85 are about card words, card writers and the card chat bubble and
add no new astrological technique). Every claim cites the doc and section or line. Code names are checked against
`src/` where noted.

## 1. The method layers (shared by every board and the chat)

**Doc 11 (2026-10-24) is the oldest statement of the method and is still the frame.**

- Five layers, each scored −3..+3 (`11-analysis-methods.md:11-19`): L1 promise (D1 houses, lords, karakas, subject
  varga, arudhas, yogas, strength; required), L2 timing (Vimshottari MD/AD/PD; Narayana/Chara of the sign; required),
  L3 trigger (gochara of Saturn, Jupiter, Rahu/Ketu by sign and nakshatra; double transit; ashtakavarga of the
  transited sign; required for horizons ≤ 3 y), L4 confirmation by Jaimini or nakshatra (optional), L5 annual
  (Tithi Pravesha / Varshaphal, Mudda, sahams; optional).
- Convergence: `score = 3·L1 + 2·L2 + 2·L3 + L4 + L5`, with the gate "L1 ≤ −2 → not indicated" ("transits cannot
  deliver what the chart denies") (`11:21-30`).
- Strengthen/weaken rules for L1 (`11:34-40`): kendra/trikona lord in dignity, argala, SAV ≥ 28 vs ≤ 22, shadbala
  ratio ≥ 1, pushkara navamsa, vargottama; combustion, papakartari, dusthana lord, retrograde = delay, gandanta. The
  star-lord rule (a dasha lord gives the results of its nakshatra lord) is "central".
- Deciders per subject (`11:44-64`): e.g. marriage = D9 7th lord dignity + D1 7th lord in D9, then UL; career = 10th
  lord's dispositor + D10 10th lord, then AmK; property = 4th lord in D4 + Mars; children = 5th lord in D7 + Jupiter;
  education = Mercury/Jupiter + 5th lord in D24; health = lagna lord vs 6/8 lords + D30.
- A deterministic "fortune tier" (`11:66-80`) from the 9th house, Jupiter, Sree and Indu lagna lords, running MD/AD
  from lagna and AL, Jupiter-from-Moon 2/5/7/9/11, Saturn-from-Moon 3/6/11, Narayana sign. Doc 11 says "reconcile
  computes it", i.e. Node; the code that does it (`src/reading/nodes/convergence.ts:160-198`) is a rule violation
  (05 F1).

**Doc 26** turns this into eight reading tiers (`26-reading-method-tiers.md:114-222`): Tier 1 full treatment
(promise, dasha, transit, nakshatra readers + writer), Tiers 2-3 (promise, dasha, transit), Tier 4 dasha-first,
Tier 5 transit-first fast lane, Tier 6 Jaimini cross-check inside promise, Tier 7 deterministic strength screen,
Tier 8 five-minute single call. Pass 0 maps a question to houses, karaka, Jaimini points and varga (`26:25-31`): love
7, 5 / Venus / DK, UL, A7 / D9; money 2, 11, 12 / Jupiter, Venus / HL, IL, A2 / D2, D4; work 10, 6, 7 / Sun, Saturn,
Mercury, Jupiter / AmK, A10 / D10; travel 3, 9, 12 / D3; siblings 3, 11 / BK / D3.

**Doc 46 (house-state engine)** names the schools (`46:§0.2`): Parashara (BPHS) for houses, lords, drishti, yogas,
dashas, gochara; Jaimini (chara karakas, arudhas, rasi drishti, argala, rasi dashas); Tajaka (annual, muntha, Tajaka
yogas, sahams); nakshatra lore; Ashtakavarga; Prashna. KP and Nadi are kept out; Lal Kitab absent. Seven evidence
layers per house: promise, afflictions, activation by every dasha system, transits, annual, owning varga, nakshatra
charter. **§B.4 defines the seven dasha families** used everywhere later:

| # | Family | Systems |
|---|---|---|
| 1 | Main graha clock | Vimshottari L1-L3 |
| 2 | Conditional graha clock | whatever `dasha.applicable` says applies (Ashtottari, Dwisaptati, Chaturaseeti, Shodasottari …) |
| 3 | Rasi clock | Narayana primary; Chara and Sudasa confirmers; Drig, Shoola, Kalachakra, Moola research-only |
| 4 | Karaka clock | Jaimini karaka dasha L3; Kaala and Naisargika research-only |
| 5 | Annual clock | TP tithi ashtottari, Mudda, Patyayini |
| 6 | Transit clock | slow planets and eclipses |
| 7 | Short confirmers | Yogini + Tithi Ashtottari L3 (vote only when they agree); Tithi Yogini, Yoga Vimshottari, Tara, Saptarishi research-only |

Polarity of a running planet to house h is one table (`46:§B.4`), and "a dasha vote counts only when D1 and the
owning varga agree; D9 breaks a tie; D60 confirms only with a minute-exact birth time". Weights from doc 29 §3
(S1 3, S4 2, confirmers 1, conditional 1.5). Note: the polarity table lists "functional malefic (Sa, Ma, Ra, Ke, and
the lagna's malefics)", which mixes natural and functional malefics; the engine exports functional nature per
lagna (`benefic_malefic` type) and that should be the only source.

## 2. How a technique is selected (doc 53, 56)

- A technique is a stored contract (`53:§4.3`): `selectors` (subjects, boards, houses, vargas, questionTypes,
  horizons, facts, slots) and `contract` (inputs by digest section and layout, system prompt, user fields, output,
  synthesizer). `selectTechniques(intent, facts, board)` in `src/techniques/contracts.ts` keeps the rows whose selectors
  all match; `houses` and `vargas` are not actually matched (`contracts.ts:17`; 02 D5).
- Doc 56 adds validity windows: each output is cached for the window its shortest-lived input allows (natal, annual,
  dasha, daily, 2-hour transit buckets) and the agent is skipped inside the window. In practice about 12 ids write
  outputs (02 §2.6).
- Companion memory (doc 48) and person facts switch sub-areas on and off (e.g. `love.status`, `work.status`); one
  question is asked when a needed fact is missing (AGENTS.md "We are making a Vedic astrology personal assistant").

## 3. Board by board

### 3.1 General reading (chat)

- Doc 53 §4.4 (`53:164-187`): house-led. Analysts: house promise (D1 + frame vargas, arudhas, special lagnas, yogas),
  varga dynamics (D9 marriage, D10 career, D2, D4, D7, D24, D12, D30, D60 by frame; D16-D144 for `explain`/`life`
  questions), dasha "all systems" (activation rows of every served system grouped into the seven families,
  Vimshottari L3, `dasha.applicable`), annual set (TP and VP, current/previous/next year, D1/D9/D10, year dashas,
  sahams, muntha and year lord), transit (shared sky + overlay, contacts, double transit, sade sati, eclipses, transit
  ashtakavarga), nakshatra (star profile, cusp stars, star lords), prashna (moment chart).
- Code readers (`general.strength_yoga`, `general.jaimini`, `general.person`) and the Oracle readers R01-R14, P1-P3
  feed `general.oracle`, then `general.validator`.
- Tiers (doc 26) decide how many of these run.
- **Dasha systems relied on:** Vimshottari (always, L3); Narayana and Chara (L2 and Jaimini L4); conditional per
  `dasha.applicable`; karaka; Yogini; Tithi Ashtottari; TP year dasha, Mudda, Patyayini for L5.

### 3.2 You / Self board

- Doc 46 layers for houses 1, 4, 5 (+9, 12) and the Moon, then doc 66 (v2: sub-techniques `self.sub.*`, Oracle then
  Personalizer, pressure inventory from the engine), doc 68 (v3: "your cards, your months"), doc 70 (five clocks),
  doc 72 (Now card), doc 75/79 (foundation card), doc 76 (D9 maturity and active-dasha anchoring).
- **Doc 70 five clocks** (`70-five-clocks-and-card-by-card-readings.md:94-101`): first five that exist of
  (1) Vimshottari, (2) Narayana, (3) Tithi Pravesha year, (4) the conditional clock `dasha.applicable` names,
  (5) Yogini, (6) Chara. Each clock is read alone by its own agent; `reading.concordance` counts agreement in code;
  each card reads the agreed ledger. Code: `READING_CLOCK_ORDER` default
  `['vimsottari','narayana','tithi_pravesha','conditional','yogini','chara']`, `READING_CLOCKS=5`,
  `READING_CLOCKS_MIN=3` (`src/config/env.ts:859-872`). The "spine clock" that cuts the year into spans stays the one
  `resolveClockV2` picks (`70:103-104`).
- Data path: one `pressure_inventory` per clock (`years_back 3`, `years_ahead 3`, `levels 3`) (`70:89`); the engine
  serves levels 1-6 (doc 72 §1; 03 §3.1) but the server asks for 3 (`PRESSURE_LEVELS`, `src/reading/self/sub/pressure.ts`).
- Doc 76 directives: after age 36 (`D9_MATURITY_AGE_YEARS`) D1 must be confirmed in D9; departmental varga for the
  running dasha lord (D10 career, D7 children/romance, D30 health, D24 learning, D20 spiritual); readings anchored to
  the running MD/AD and the current TP year (`76:§0.1-0.2`).
- **Dasha systems relied on:** the five clocks above; Kalachakra and the other 30-odd systems are pulled into
  `kundli_activation` but are not voting clocks.

### 3.3 Love board

- Today a code board: eight house-state layers over 7, 5, 11, 2, 4, 8, 12 with D9, D7, D30, the tone vote, sub-areas
  `love.meet` / `love.health` / `love.reconcile` by `love.status` (doc 69 §0; `catalog.ts:663-774`).
- Doc 69 v3 plan (approved per memory, not built): nine or ten cards, five shown, one Oracle and one Personalizer call;
  same span-led card as Self v3, so the same five clocks.
- Doc 78 proposes splitting relationships into four boards (dating, marriage, friendships, professional allies) by
  bhava, karaka, arudha and varga (`78:§3.1-3.3`): marriage D9 + UL + DK; romance 5th + D7 (doc 78's choice of D7 for
  romance is not the usual classical reading, where D7 is children; flag for research).
- **Dasha systems relied on:** the seven families of doc 46 §B.4, vote validated by D1 + D9 (or D7).

### 3.4 Work board

- Doc 43 is the method (`43-career-reading-technique.md`): five questions per sub-area (§1), ranked sub-areas (§2),
  vargas D1-D60 with D10 primary (§3.1), clocks by family (§3.2), TP chart and its D10, TP dasha, Varsha, Mudda,
  Patyayini and 15 career sahams (§3.3), transits from the shared sky (§3.4), and a seven-family present-state vote
  (§8.1).
- §3.2 clocks: Vimshottari L3 primary; the conditional dasha the chart qualifies for ("Chathuraaseethi Sama applies when
  the 10th lord is in the 10th" etc.); Narayana primary rasi clock; Karaka L3, Chara, Sudasa secondary; Yogini and TA
  confirmers only; Drig for mentors; Kaala, Moola, Kalachakra, Tara "off by default". "A clock opens a window only if
  it is primary; confirmers count only in a month a primary clock already opened."
- §8.1: a family vote counts only when D1 and D10 agree; D9 breaks ties; D60 only with exact birth time. "Confirmed"
  needs 5 of 7 families.
- Code: `career.ts` families S1 (main), S4 (rasi), S2+S3 (short), S6/S6D (transit), S7 (Jaimini points)
  (`src/reading/area/career.ts:40-45`), plus `workAnnualVote`, `workConditionalVote`, `workKarakaVote`, `workD10Check`
  (`:207-307`). Sudasa and Chara are not in the S4 family in code (doc 43 has them as confirmers).
- Doc 78 §4 proposes four career boards (start of career, primary job, hobby, business) each with its own varga lens.

### 3.5 Lucky Times

- Doc 47: the engine's `muhurta` type gives a per-place day table (sunrise/sunset, abhijit, rahu kaal, yamaganda,
  gulika, durmuhurta, brahma, godhuli, vijaya, nishita, amrita gadiya, varjyam, 30 muhurtas, 24 horas, panchanga
  with end times) (`47:§0.1`). Personal parts: tara bala, chandra bala, Moon's house from natal Moon (`47:§0.3`).
  Life-area mapping from hora lord and choghadiya tables (Drik Panchang) crossed with the person's day (`47:§0.5`).
- 13 scenario rules (work, love, money, travel, study, home) live in `src/reading/luckyTimes/scenarios.ts`.
- **Dasha use:** Vimshottari lords at level 2 for the personal overlay (doc 67 §1 table).
- Engine additions asked (`47:§0.2`): moonrise/set, choghadiya, amrit kaal, lunar month, samvatsara, second tithi or
  star in a day, chandrashtama, festivals, udaya lagna. 03 §9 shows choghadiya and event muhurta are still not served.

### 3.6 Today / Now card

- Doc 72: one Now card on every board, read from the five clocks at their deepest level around today and today's
  transit over the chart in 16 vargas (D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, D60)
  (`72:46-47`). Doc 72 §1 reports an engine fault: the transit's `natal_house` was counted from the D1 lagna in every
  varga. 03 §7 (`transit_export.py:286`) finds the live engine now counts from the same-varga natal lagna, so doc 72
  §1 is out of date on this point.

### 3.7 Life reading (timeline)

- Doc 55 (`55-life-reading-mahadasha-charter.md:§1`): digest (six sections), `kundli_activation` (~10k rows, 43 dasha
  systems, levels 1-3, birth to +30 years), the engine's `dasha_charter` (5-vector MD charter and 9×9 AD-from-MD
  fruition matrix from `avasthas_export.py`). Adds `life.mahadasha_charter`: the remaining largest MD across its ADs
  with a charter per life area. `life.promise_scale` and `life.timing_agreement` weigh 13 areas.

## 4. Dasha levels (doc 67) and what the docs assume

- Doc 67 (2026-11-09): six systems at L3 (`.l3` entries: vimsottari, dwisatpathi, yogini, tithi_ashtottari, kaala,
  karaka), every other system at the engine's default 2 levels; readers ask for 2 or 3 (`67:§1`). Plan: levels 1-6.
- Now: the server requests `levels: 3` for every non-legacy `dasha.*` (`DASHA_LIFELONG_LEVELS = 3`,
  `src/reading/chartData/catalog.ts:123, 182`); the dasha-deep worker stores L4-L6 in a −90 d..+365 d window
  (`src/workers/dashaDeep.ts`); the engine default is 4 and caps rasi dashas at 5, Kalachakra at 1 (03 §3.1).
- The memory note "dasha exports 2 levels deep" is out of date except for the legacy `vimsottari_dasa` /
  `narayana_dasa` types and the annual dashas.

## 5. Summary: what each surface relies on

| Surface | Dasha systems | Vargas | Transit methods | Annual | Other |
|---|---|---|---|---|---|
| General reading | V L3 (always); N, Ch; conditional; K; Y; TA | D1 + frame varga (D2-D60; D81-D144 declared) | Slow gochara from shared sky, double transit, sade sati, eclipses, transit AV (when served) | TP + VP ±1 y, TP dasha, Mudda, Patyayini, sahams | Arudhas, special lagnas, yogas, star profile, prashna |
| You / Self | 5 clocks: V, N, TP year, conditional, Y (Ch as 6th) | D1, D9 (+ owning vargas D20, D24, D12, D4, D7, D60; D30 for body) | Saturn passage, windows around today, D1-D60 transit for Now | TP year as a clock and frame | Pressure inventory, dasha charter |
| Love | Seven families (doc 46) → five clocks in v3 | D9, D7, D30 | Slow planets on 7, 5, 11, 2, 4, 8, 12, UL | TP, love sahams | UL, A7, DK |
| Work | Seven families (doc 43): V, conditional, N (+Ch, Sudasa), K, annual, transits, Y+TA | D10 primary, D1, D9 tie-break, D60 confirm; D2, D4, D11 for sub-areas | Double transit on 10th, sade sati, eclipses on 10/4 axis, stations | TP + TP D10, Mudda, Patyayini, 15 sahams | AmK, A10, AL |
| Lucky Times | V lords L2 | — | Moon's daily star (tara, chandra bala) | — | Muhurta day table, hora, panchang limbs |
| Now card | 5 clocks at deepest level | 16 vargas D1-D60 | Today's transit in 16 vargas | TP year | — |
| Life reading | 43 systems in activation; V MD/AD charter | D1, D9, owning vargas | Life sky snapshots | — | Dasha charter, fruition matrix |
