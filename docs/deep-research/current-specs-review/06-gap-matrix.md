# 06 — Gap matrix: classical techniques vs specs, stored contracts and engine exports

Written 2026-11-18 from `01`-`05` in this folder and the engine findings of every researcher folder
(`dashas-nakshatra`, `dashas-rasi-jaimini`, `jaimini-apparatus`, `dasha-results`, `dashas-other-and-annual`,
`natal-techniques`, `transits`, `tajika-prashna-muhurta`) and their notes in
`research_notes/Vedic dasha systems and prediction techniques/`. Server `feat/self-foundation-server` @ `280ac27`;
engine `AIAstra_Radha` `origin/release-candidate-staging` @ `b902bea`. One row per classical technique or dasha;
names that mean different calculations in different schools (Moola, Tara, Shoola) get one row each with the trap noted.

## How to read the columns

- **Spec**: the file under `docs/techniques/` that specifies it (short ids: `g.` general, `s.` self, `l.` love, `w.`
  work, `lk.` lucky; "vol NN" = an illustration volume page only). "none" = no spec names it.
- **Catalogue / stored contract**: how it reaches a technique today. Digest sections are `house`, `planet`, `yoga`,
  `point`, `annual`, `star` (`kundli_digest`) and `activation` (`kundli_activation`, every stored dasha, L1-L3 for life,
  L4-L6 in a window). "not in digest" = the engine may export it but no reader receives it.
- **Engine**: `exported` / `exported, wrong vs text` / `exported, variant` (a school choice not declared) / `in library
  not exported` / `missing` (not in the engine or the vendored library). Evidence: **run** = the researcher ran the
  engine; **code** = read from code only. Researchers in `natal-techniques` and `jaimini-apparatus` partly read the
  local engine checkout, which is 35 files behind `b902bea`; where they and `03` disagree, `03` wins and the row says so.
- **Boards**: Y = You/Self, L = Love, W = Work, Lk = Lucky Times, N = Now card, C = chat (general reading), T = life
  timeline, R = research/admin only, — = none (internal or out of scope).
- **Priority**: **P0** wrong data served today to a board or reader; **P1** needed by a board or spec now (missing,
  Node-computed, or wrong but not yet read); **P2** nice to have, or an undeclared school variant that needs a
  decision; **P3** skip or research only (includes longevity and death-timing tools, which stay internal).
- "TODOS" in the last column means an entry exists in `docs/TODOS.md` (line given) or was added by this review in the
  section "Filed 2026-11-18 by the classical-techniques deep research".

## A. Nakshatra (graha) dashas

| # | Technique | Classical source | What the texts say it is for | Spec | Catalogue / stored contract | Engine | Boards | Pri. | Notes |
|---|---|---|---|---|---|---|---|---|---|
| A01 | Vimshottari | BPHS 46.12-16 (chief, *mukhyā*); results ch. 47-48, 52-63 | The default life clock for every chart | g.dasha, s.activation, l.activation, w.present_tone | activation family 1 (L1-L3 life, L4-L6 window); clock 1 of the five | exported L1-6, sidereal year; options (seed star, start planet, tribhagi, Utpanna/Kshema) not passed | Y L W N C T Lk | P1 | Correct at L1-L3 (proportional rule is the text's). Gap is options and the year length not written into the export (`dashas-nakshatra/vimshottari.md`) |
| A02 | Ashtottari | BPHS 46.17-23; judged as Vimshottari (46.22) | Conditional second clock (Rahu from lagna lord; or day-krishna / night-shukla birth) | g.dasha, w.conditional_family | activation family "conditional" when `dasha.applicable` says so | exported; applicability **wrong vs text**: only the Rahu rule (46.17), not 46.23 (code) | Y W C | P1 | Under-reports eligibility for about half of charts; AD start flag disputed (PVR vs JHora) |
| A03 | Shodashottari | BPHS 46.24-26 | Conditional (lagna hora + paksha) | g.dasha, w.conditional_family | conditional family, but never eligible | exported; applicability **not checked** (`applicability.py` TODO) | Y W C | P1 | Can never be the conditional clock today |
| A04 | Dwadashottari | BPHS 46.27-28 | Conditional (born in a Venus amsha) | g.dasha | conditional family | exported; check = D9 lagna Taurus/Libra | Y W C | P2 | Reading of *śukrāṃśa* is the common one |
| A05 | Panchottari | BPHS 46.29-31 | Conditional (Cancer lagna + *arkāṃśa*) | g.dasha | conditional family | exported, **variant**: PVR D12-only reading; AE reading also needs rasi Cancer | Y W C | P2 | Expose both readings as flags (`01-applicability-matrix.md`) |
| A06 | Shatabdika | BPHS 46.32-34 | Conditional (vargottama lagna) | g.dasha | conditional family | exported, check ok | Y W C | P2 | — |
| A07 | Chaturashiti-sama | BPHS 46.35-36 | Conditional (10th lord in 10th) | g.dasha, w.conditional_family | conditional family | exported, check ok | Y W C | P2 | Doc 43 names it for career |
| A08 | Dwisaptati-sama | BPHS 46.37-39 | Conditional (L1 in 7th or L7 in 1st) | g.dasha | conditional family | exported, check ok | Y W C | P2 | Node re-derives its applicability in `pastReadingFlow.ts` (05 F10) |
| A09 | Shashtihayani | BPHS 46.40-41 | Conditional (Sun in lagna) | g.dasha | conditional family | exported, check ok | Y W C | P2 | — |
| A10 | Shat-trimshat-sama | BPHS 46.42-43 | Conditional (day/night + lagna hora) | g.dasha | conditional family, never eligible | exported; applicability **not checked** | Y W C | P1 | As A03 |
| A11 | Yogini | BPHS 46.195-200 (no condition) | Widely used second clock [MODERN practice] | g.dasha, s.activation, l.activation, w.present_tone (short confirmer) | activation family yogini; clock 5 of the five | exported L1-6; star→yogini table **disagrees with 46.199 for Ashwini-Ardra** (code, reimplementation; not a live run) | Y L W N C | P0 (verify first) | If confirmed, 6 of 27 birth stars get the wrong first yogini and every Yogini date shifts |
| A12 | Kalachakra | BPHS 46.52-154; results ch. 49, 64 | "Most authoritative" of its group; deha/jeeva, gatis | none (doc 43: off by default) | activation (L1 only) | exported L1 only; AD rows unusable; gatis not flagged (code) | R | P3 | `TODOS.md:2289` (L1 cap) |
| A13 | Tara dasha (graha) | BPHS 46.207-209; "not universally agreed" (46.11) | Vimshottari reordered by kendra planets | none | activation "other" | exported; does not enforce its own all-kendras condition (code); fails on some kundlis (`TODOS.md:457`) | R | P3 | Not the rasi "Tara-amsa" dasha (D16) nor tara bala (E04) |
| A14 | Moola / Mula (graha, BJ/SJC) | Brihat Jataka 8 via Rath; not in BPHS list | Karma and remedy reading (SJC) | none | activation (as the engine's rasi "moola") | **wrong vs text by name**: engine `moola.py` is the Lagna Kendradi rasi dasha, a duplicate of `kendradhi_rasi.py` | R | P3 | Rename; doc 46 lists Moola research-only |
| A15 | Non-BPHS graha variants: Tithi Ashtottari, Tithi Yogini, Yoga Vimshottari, Karana Chaturashiti, Saptarishi, Buddhi Gathi, Kaala | JHora / SJC [MODERN]; Tithi Ashtottari is Rath's TP year dasha | Short confirmers and annual clocks | g.dasha, s.activation (TA) | activation families tithi_ashtottari, other | exported L1-6 | Y W C (TA only) | P2 | Weight as confirmers only (doc 46 §B.4); label the school |

## B. Rasi (sign) dashas — BPHS ch. 46/50/51 and the Jaimini Upadesa Sutras

| # | Technique | Classical source | What the texts say it is for | Spec | Catalogue / stored contract | Engine | Boards | Pri. | Notes |
|---|---|---|---|---|---|---|---|---|---|
| B01 | Narayana (D1) | JS 2.4.7-10, 2.4.31-34; BPHS 46.155-167 | General events; "progression of lagna" [MODERN PVR, Rath] | g.dasha, s.activation, w.present_tone (S4) | activation family rasi; clock 2 of the five | exported L1-5, D1 only; antardasa **wrong vs text**: "7th from dasa sign" taken as `+7` (the 8th) and the lords' signs compared (code) | Y L W N C T | P0 (verify first) | Every Narayana antardasa start sign is suspect; reference-test against JHora before the fix |
| B02 | Narayana on vargas (D9, D10, D4, D7, D12, D24) | PVR-VA 18.5 [MODERN]; Jaimini practice | Marriage (D9), career (D10), home, children, parents, learning | g.dasha (named), doc 43 | none | in library not exported (`narayana_dhasa_for_divisional_chart`); dasha export passes no varga | L W | P1 | Needed by the Love and Work rasi family |
| B03 | Chara | BPHS 46.155-167; JS 1.1.26-28, 2.4.7-10 | General events with chara karakas [MODERN KNR] | g.dasha, s.activation, l.activation, vol 02 `general.jaimini` | activation family rasi; clock 6 | exported L1-5, method 1 only; **wrong vs text**: antardasa list identical in every mahadasa; seed always PVR-2014; KN Rao / PVN Rao labels crossed (code) | Y C (L, W as confirmer) | P0 (verify first) | If confirmed, any reader of Chara L2 gets wrong sub-periods |
| B04 | Sudasa (Sree Lagna Kendradi) | BPHS 46.188-190 (inferred root); PVR-VA ch. 20 | Wealth, power, status | w.present_tone (named confirmer) | activation family rasi; not in code S4 (05 B10) | exported L1-5 | W | P1 | Work board money/standing confirmer; verify against JHora |
| B05 | Lagna Kendradi rasi | BPHS 46.175-177 | Material prosperity [MODERN] | none | activation | exported (`kendradhi_rasi`, also duplicated as `moola`) | — | P3 | Low weight |
| B06 | Karaka dasha / Karaka Kendradi | JS 2.4.11-13 (graha form); engine rule otherwise | AK-centred results; no stated purpose | w.karaka_family, g.dasha | activation family karaka (Work family vote, Self chapters) | exported (`dasha.karaka`, graha) | W Y C | P2 | Votes in Work although its rules are unverified against text; needs a reference test |
| B07 | Drig | BPHS 46.185-187; JS 2.4.21-23 | Spiritual growth | none (doc 43: mentors) | activation | exported, **variant**: Narayana years (PVR) vs BPHS Sthira years 7/8/9 | — | P2 | Product decision on use |
| B08 | Trikona | BPHS 46.183-184; JS 2.4.24-25 | Not stated | none | activation | exported; direction and years differ from "as Chara"; AD not JHora (code) | — | P3 | — |
| B09 | Yogardha | BPHS 46.174; JS 2.4.19-20 | Not stated | none | activation | exported; inherits the Chara AD bug (code) | — | P3 | — |
| B10 | Mandooka | BPHS 46.179-180; JS 2.4.15 | Not stated (PVR: D11 for wars) | none | activation | exported; default method not BPHS (code) | — | P3 | — |
| B11 | Lagnadi Rasi (BPHS "Rasi") | BPHS 46.188-190 | Not stated; seed = Sree Lagna (inference) | none | — | not separate (Sudasa variant) | — | P3 | — |
| B12 | Tara-amsa / Tara Lagna | JS 2.4.27-30 | Wealth status | none | activation | exported; AD start from AK unsourced (code) | — | P3 | — |
| B13 | Varnada | JS 1.1.32 (lagna only) | Not verified | none | activation | exported; self-declared not matching JHora | — | P3 | — |
| B14 | Paryaya / Chara Paryaya | no text read | Not verified | none | activation | exported; unverified | — | P3 | — |
| B15 | Padanathamsa | JS 2.1.18; Jyotisha Phala Ratnamala 27 [COMM] | Ayur / general | none | activation | exported; self-declared incomplete | — | P3 | — |
| B16 | Chakra | BPHS ~46.50-51 | Not stated | none | activation | exported | — | P3 | — |
| B17 | Lagnamsaka | engine only | — | none | activation | exported | — | P3 | No classical file |
| B18 | Sthira | BPHS 46.168-169; JS 2.3.3-4 | Longevity | none | activation | exported; always zodiacal, BPHS says odd forward / even backward (code) | — | P3 | Death timing: never surfaced |
| B19 | Shoola (Jaimini, 1st/7th) | JS 2.1.37-43, 2.2.4-11 | Death; suffering; relatives | none | activation | exported | — | P3 | Same name as B20 in BPHS: naming trap |
| B20 | Niryana Shoola (BPHS "Shoola", 2nd/8th) | BPHS 46.181-182 | Timing of death | none | activation | exported | — | P3 | Internal only |
| B21 | Brahma | JS 2.1.47-53; BPHS 46.170-173 | Longevity | none | — | in library not exported (negative durations); direction keyed to seed not lagna (code) | — | P3 | — |
| B22 | Navamsa dasha | JS 2.3.1-2, 2.1.15-18 | Longevity; 2nd-house results | none | activation | exported; seed and AD tables do not match JS (code) | — | P3 | — |
| B23 | Sandhya / Pachaka | BPHS 46.204-206; "not universally agreed" | Decade house theme | none | activation | exported (`dasha.sandhya`) | — | P3 | — |
| B24 | Rasi pratyantar (L3-L5) | BPHS ch. 51 vv. 5-12 (rasi AD rules differ by system) | Sub-period timing | doc 67 | activation L3 lifelong | exported by an engine proportional split, unverified for rasi dashas | Y W C | P2 | `TODOS.md:2285` (decision) |

## C. Other and annual clocks

| # | Technique | Classical source | What the texts say it is for | Spec | Catalogue / stored contract | Engine | Boards | Pri. | Notes |
|---|---|---|---|---|---|---|---|---|---|
| C01 | Tithi Pravesha chart and year lord | [MODERN] SJC (Rath) | Kind of year; year lord = weekday lord at the TP moment (decided `TODOS.md:2283`) | s.annual, g.annual, l.annual, w.annual_family | `annual` TP rows; clock 3 of the five | chart exported; the weekday year lord drives only motion fields, it is not named as a field on the TP export; year dasha bounded to the TP year @ `b902bea` (03 §3.2), but **stored rows still span 108 years**; `vratha.tithi_pravesha` silently falls back to the current year when the year is at or before the birth year (code) | Y L W N C | P0 | `TODOS.md:19` (P0: stored rows; needs a re-pull and digest rebuild), `:120` (R1), `:3163` (digest); fallback is new |
| C02 | Mudda (Varsha Vimshottari) | Tajika practice; formula [MODERN] PVR | In-year timer when the natal Moon-sign lord is strong in the year (HR 7.11) | g.annual, s.annual, l.annual, w.annual_family | `annual` row dashas; the You reading takes its year span from the VP Mudda span | exported, **wrong vs text**: start lord adds years to a planet id (`mudda.py:51-53`), wrong for 15 of 27 birth stars (**run**) | Y L W C | P0 | Start offset already filed (`TODOS.md:1426`, `:2291`); the start-lord bug is new |
| C03 | Patyayini | Tajika (Neelakanthi, unverified) + PVR | In-year timer | as C02 | `annual` row dashas | exported (**run**: matches PVR); average Gregorian year; not bounded to its year | L W C | P2 | `TODOS.md:2291` |
| C04 | Sudarshana Chakra | BPHS 74 (full chapter; 74.22, 74.27-28) | Year / month / 2.5-day house of focus from Lagna, Moon, Sun | g.sudarshana_chakra (**planned**), s.annual, s.character_arc (declared, not in code) | none (no catalogue row) | in library not exported; library seeds from birth + N years and shifts N-1 houses, prints debug (code) | Y L W Lk C | P1 | Medium-high value for focus; fix the seed before exporting |
| C05 | Varsha Narayana | [MODERN] PVR | In-year sign focus (any varga) | doc 43 (Work D10) | none | in library not exported | W | P2 | — |
| C06 | Naisargika | BPHS 43.16-17 (named 46.10); BJ/Saravali via Rath | Life stages; background only | none (doc 46: research-only) | activation (karaka family, research) | exported, **wrong vs text**: adds a 12-year lagna period (132 vs 120 years); equal AD split and rounding (code) | T (context) | P2 | — |
| C07 | Pinda / Amsa / Nisarga ayur-dashas | BPHS 43; BJ 7-8 | Longevity | none | activation (`dasha.aayu`) | exported although `aayu.py` is self-declared "DO NOT USE"; `const.aayu_types` (0-32/33-70/71-100) differs from BPHS 44.11 (<22, 22-64, 64+) | — | P2 | Longevity: stop serving or mark internal |
| C08 | Ashtakavarga dasha | BPHS 46.203 | Strength modifier of any period | none | — | missing (no period table in the text) | — | P3 | Use bindus as a modifier only |
| C09 | Maturity ages / progressions | [MODERN] folk, unsourced | When a promise ripens | doc 76 age-36 D9 gate (s./l./w. varga specs) | `D9_MATURITY_AGE_YEARS` (env) | not an engine output | Y L W | P3 | `TODOS.md:3198` (age-36 rule unsourced) |
| C10 | Year length per system | none in text; Tajika HR 1.6 gives 365.25875 d | Date drift | none | — | **inconsistent**: Mudda tropical/360, Patyayini Gregorian, most others sidereal | Y L W C | P2 | Annual systems should anchor on the true VP/TP instant |

## D. Dasha judging rules (dasha-phala)

| # | Technique | Classical source | What the texts say it is for | Spec | Catalogue / stored contract | Engine | Boards | Pri. | Notes |
|---|---|---|---|---|---|---|---|---|---|
| D01 | Functional nature, yogakaraka, kendradhipati dosha | BPHS 34; PD 20.41-54; Laghu Parashari | Polarity of each period lord for the lagna | doc 46 §B.4 polarity table | `planet.functional` from `benefic_malefic` | exported | Y L W C T Lk | P1 | Node parses it by regex (`wiring.ts:49-57`, 05 F24); doc 46 mixes natural and functional malefics (05 B15) |
| D02 | Dasha lord condition: dignity, house, placement at the dasha start, dreshkana thirds, arohini/avarohini | BPHS 47.2-6, 48.8; PD 20.1, 20.14, 20.30, 20.56; Saravali 41.9-24 | MD polarity and timing inside the period | g.dasha, doc 76 | `planet` cards; `dashaCharter` (engine's own rules) | partial: dignity exported; dasha-start placement, thirds and arohini missing | Y L W C T | P1 | Engine addition; PD 20.30 is the only numeric dignity scale found |
| D03 | Antardasha relation: AD lord's house from MD lord, friendship, mutual 6/8/12 | BPHS 52-60, 57.79; PD 20.22-29 | Bhukti polarity and area | g.dasha | `dashaCharter` fruition matrix; `isShadAshtaka68` | partial: AD-from-MD in the charter; natural+temporal friendship in `relations` | Y C T | P2 | Engine addition: per-period row fields |
| D04 | Rahu/Ketu dasha | BPHS 34, 47; PD 19.15-16 | Node results by house and association; dispositor rule [MODERN] | g.dasha | `planet` cards | partial; node exaltation scheme not declared (engine overrides Rahu dignity, `natal_export.py:74`) | Y C | P2 | — |
| D05 | Yoga fructification in dasha | BPHS 39, 41, 48; PD 20.42-54 | Raja/dhana yogas deliver in their lords' periods | g.dasha | `yoga` rows (no period link) | missing: yoga participation per period lord | Y W C | P2 | Engine addition |
| D06 | Maraka periods | BPHS 44; PD 20 | Health caution only | none | — | exported (`benefic_malefic.maraka`) | — | P3 | Internal flag only; never to the prompt |
| D07 | House activation (which area a period opens) | BPHS 48; bhavat bhavam [MODERN] | Area and person of the period | doc 46 §B.4 | `activation` houses | **Node computes** (`activation.ts:142-160`, 05 F7) | Y L W C T | P1 | `TODOS.md:1685`; engine `houses_activated[]` |
| D08 | Dasha with transit (lord's transit, Sun-ingress month, double transit) | PD 20.34-38, 20.59-62; double transit [MODERN] | Month and day inside the period | g.dasha, g.transit | transit overlay | partial: double transit exported; Sun-ingress dates into the lord's signs missing | Y L W C | P2 | Engine addition |
| D09 | Pratyantar and deeper levels | BPHS 61.1-2, 62-63; PD 21.83-84 | Only one judging rule (61.2); L4+ timing only | doc 67 | activation L3 lifelong, L4-L6 window | exported (engine split, exact for Vimshottari) | Y N | P2 | Server asks 3 levels; engine default 4, max 6, rasi 5, Kalachakra 1 |
| D10 | Dasha sandhi / chidra | no classical verse found | Junction caution [MODERN] | none | — | missing | — | P3 | — |
| D11 | Dasha remedies | BPHS remedy table (per AD) | Remedies | none | — | missing | — | P3 | Product decision |

## E. Transits and ashtakavarga

| # | Technique | Classical source | What the texts say it is for | Spec | Catalogue / stored contract | Engine | Boards | Pri. | Notes |
|---|---|---|---|---|---|---|---|---|---|
| E01 | Gochara from the Moon (good/bad houses) | PD 26.1-8; Brihat Samhita 104 | Transit polarity per planet | g.transit, s.transit, l.transit, w.horizons; doc 11 §4 | transit overlay; `pressure_inventory` polarity | exported, **inconsistent and partly off the text**: `reading_tables` has Ju/Sa only (Jupiter matches PD; Saturn bad only in 1, 2, 8, 12); `pressure_inventory` (`:115`) follows doc 66: Jupiter presses in 6/8/12 and reads "mixed" in 1, 3, 4, 10 where PD calls it bad; Saturn matches PD; no Sun, Mercury, Venus table; no vedha (code) | Y N L W C | P1 | Already filed as a decision (`TODOS.md:1876`: pick the canonical table); `pressure_inventory` feeds the five-clock tones; Node also has its own lists (05 F1, `TODOS.md:72`) |
| E02 | Vedha and vama-vedha | PD 26.2-8 | Obstruction that cancels a good or bad transit | g.transit, s.transit, l.transit (5 specs) | none | missing (not in library); `general.transit.md` claims it is ready | Y L W C | P1 | `TODOS.md:859` (P3, raise) |
| E03 | Latta | PD 26.42-45 | Planetary kicks on the birth star | none | none | in library not exported; helper counts 28 stars (with Abhijit), PD counts 27 | Lk N | P2 | — |
| E04 | Tara bala and Chandra bala | PD 26; Muhurta Chintamani (not read) | Daily star and Moon strength | lk.personal_overlay | `daily_grade`, day overlay | exported with engine-own tables; two tara name sets (`facts` vs `daily`); unused `drik.chandrabalam` omits the 11th | Lk N | P2 | Not served wrong: the export adds the 11th |
| E05 | Transit over natal points, exact contacts | PD 26.26-29 (stars); [MODERN] degree contacts | Event triggers | g.transit, w.horizons | `transit_contacts` (not in overlays) | exported to 10 years; stored data stop at end-2026 | W C | P1 | `TODOS.md:240` |
| E06 | Nakshatra transit and Sarvatobhadra | PD 26.26-29 (7x7 grid); SBC [COMM] | Star-level vedha | g.nakshatra (O1) | none | missing (not in library) | — | P3 | — |
| E07 | Bhinnashtakavarga (BAV) | PD 23.3-9; BPHS 66 | Bindus per planet per sign | via SAV in `house.sav`; specs use it | `house.sav`; transit AV not in digest | exported, **wrong vs PD 23 in three cells** (Moon from Moon +9; Moon from Mars lacks 9; Venus from Mars 4 for 5) (code); totals unchanged, so a checksum misses it | Y L W C | P0 (verify first) | Check BPHS 66 print before changing; PD's Moon-from-Jupiter variant matches the engine |
| E08 | Sarvashtakavarga and the 28 rule | PD 23.20 (above/below 28) | Sign support for transits | specs; doc 11 | `house.sav` | exported | Y L W C | P2 | 28 has a verse; Node's 22 does not (05 F17, B17) |
| E09 | Trikona and ekadhipatya shodhana | BPHS 67-68 | Reductions before pindas | none | — | exported | — | P3 | — |
| E10 | Shodhya pinda | BPHS 69 | AV event timing | none | — | exported; Virgo rasi multiplier 6, BPHS 69:3 says 5 (code) | — | P2 | — |
| E11 | Kakshya | PD 23.16-19 | Which 3°45' slice of a sign delivers the bindu | g.transit, s.transit, lk.personal_overlay | none (`transit_ashtakavarga` has no fetcher) | exported (`transit_ashtakavarga`) | Y Lk C | P1 | `TODOS.md:866` |
| E12 | Prastara ashtakavarga | PD 23.17-18 | Contributor grid | none | — | missing | — | P3 | — |
| E13 | AV predictions (pinda-derived nakshatras for Saturn/Sun transits) | PD 24.1-5 | Event timing for relatives | none | — | missing | — | P3 | — |
| E14 | Sade Sati, Kantaka, Ashtama Shani; Jupiter rules | PD 26; Jataka Sara Deepa (secondary) | Slow-transit pressure | s.transit, w.horizons | transit overlay | exported | Y W N C | P2 | — |
| E15 | Murti nirnaya | Secondary sources only | Grade of an ingress (gold … iron) | g.transit, s.transit, l.transit | none | missing; spec claims it ready | — | P2 | — |
| E16 | Rahu/Ketu transits and eclipses on natal points | PD 26.26-29 | Shocks on natal points | g.transit | transit overlay | exported (eclipses); contact list for eclipses missing | Y C | P2 | — |
| E17 | Double transit (Jupiter + Saturn) | [MODERN] K.N. Rao | Event window | g.transit, w.horizons | transit overlay | exported | Y L W C | P2 | Modern rule, label it |
| E18 | Lagna vs Moon as reference | PD 26.1 (Moon chief) | Reference point | g.transit | transit overlay | exported (houses from Lagna, Moon, AL) | Y L W C | P3 | — |
| E19 | Retrograde and stations | PD 26 (implicit) | Delay and intensity | g.transit | transit overlay | exported | Y C | P3 | — |

## F. Natal (promise-layer) techniques

| # | Technique | Classical source | What the texts say it is for | Spec | Catalogue / stored contract | Engine | Boards | Pri. | Notes |
|---|---|---|---|---|---|---|---|---|---|
| F01 | Bhava analysis (house, lord, karaka, derived house) | BPHS 11; PD 15 | Promise of each house | g.promise, s.promise, l.promise | `house`, `planet` cards | exported (house cards, classes) | Y L W C T | P1 | Node computes house classes and placement classes (05 F3, F9, F11, F20) |
| F02 | House significations | BPHS 11-24 | Which house for which matter | specs; doc 26 Pass 0 | Node area tables (05 F18) | not an engine output | Y L W C | P2 | Move tables to reviewed config |
| F03 | Graha drishti | BPHS 26 | Aspects | specs | `planet.aspectsTo` | exported | all | P3 | — |
| F04 | Dignity and relationships | BPHS 3; PD 2 | Strength of placement | specs | `planet.dignity`; `relations` | exported; co-lord choice open (`TODOS.md:1438`) | all | P2 | — |
| F05 | Combustion, retrogression, graha yuddha | BPHS 3, 27.20 | Weakness, delay, defeat | s.affliction | `planet` cards | exported (motion export incl. graha yuddha @ `b902bea`; the natal researcher read an older checkout) | Y L C | P3 | — |
| F06 | Shadbala | BPHS 27 | Capacity of a planet | vol 02 `general.strength_yoga` | `planet.shadbala*` | exported, **variant**: Sun minimum 5 rupas (Raman) vs BPHS-ET 6.5 | Y C | P2 | Declare the table used |
| F07 | Bhava bala | BPHS 27 | House strength | s.promise, l.promise (declared) | not in digest | exported (3 components, no bhava drishti bala) | Y L | P1 | `TODOS.md:122` |
| F08 | Ishta / Kashta phala | BPHS 28 | Benign vs harsh delivery | none | `facts` only | exported in `facts` only; root formula (Raman) vs rasmi form (BPHS 28.6); Sun/Moon null | C | P2 | — |
| F09 | Vimshopaka | BPHS 7 / 16 | Varga dignity grade | g.promise, g.varga_dynamics, s.varga | not in digest | exported (4 schemes) | Y C | P1 | `TODOS.md:122` |
| F10 | Avasthas | BPHS 45 | How much and in what mood a planet delivers | s.promise, s.affliction | `planet.avasthas` | exported (engine's own rules), **variant**: Baladi 0.35/0.10 vs "negligible/nil"; Deeptadi list not BPHS-ET; Shayanadi silent fallback | Y L C | P2 | — |
| F11 | Shodashavarga (D1-D60) and vargottama | BPHS 6-7 | Confirmation in the varga of the matter (D7 = children) | g.varga_dynamics, s.varga, l.varga, w.d10_check | `house`/`planet` per varga (full, dossier, placement tiers) | exported (23 vargas) | all | P1 | Node computes vargottama and the D1-D9 verdict (05 F2); doc 78 routes romance to D7 (05 B16) |
| F12 | Pancha Mahapurusha yogas | BPHS 75 | Lifelong character and standing | vol 02 `general.strength_yoga` | `yoga` rows | exported | Y C | P2 | From-Moon variant undecided |
| F13 | Parashari raja yogas, yogakaraka | BPHS 39 | Power and standing | g.strength_yoga | `yoga` rows | exported | Y W C | P2 | — |
| F14 | Dhana yogas | BPHS 41; PD 6 | Wealth | w.reading.gain | `yoga` rows | exported, partial rule set (`facts` pairs only) | W C | P2 | — |
| F15 | Chandra and Surya yogas (Sunapha, Kemadruma, Vesi …) | BPHS 37-38 | Mind, support | s.promise | `yoga` rows | exported, **wrong**: `yogas` type reports them for empty houses | Y C | P0 | `TODOS.md:87` |
| F16 | Nabhasa yogas | BPHS 35 | Life pattern | none | `yoga` rows | exported | Y | P3 | — |
| F17 | Arishta / balarishta | BPHS 9-10 | Early-life danger | none | — | missing | — | P3 | Internal only, do not build |
| F18 | Viparita raja yogas | BPHS 34 (basis disputed) | Gain through adversity | g.strength_yoga | `yoga` rows (`facts` per lord) | exported | Y W C | P2 | — |
| F19 | Neecha bhanga raja yoga | PD 7 (recalled) | Cancellation of debility | s.protection | `yoga` rows | exported, rules 1-3 of 5; Node re-derives "neecha bhanga via D9" (05 F2) | Y L C | P1 | Treat neecha-vargottama as weak (doc 76) is contested (01 S7) |
| F20 | Parivartana | BPHS 36 | Exchange of signs | g.strength_yoga | `yoga` rows (`facts`) | exported | Y C | P3 | — |
| F21 | Common named yogas (Gajakesari, Budhaditya, Lakshmi …) | BPHS 36; PD 6 | Named gifts | g.strength_yoga | `yoga` rows | exported; Budhaditya has no combustion check | Y C | P2 | — |
| F22 | Nakshatra natal reading | BPHS 3; nakshatra lore | Flavour, star lords | g.nakshatra, s.nakshatra | `star` profile | exported (`facts.nakshatra_profile`) | Y C | P2 | "Pending karma houses" is Lunar-Astro, unlabelled (05 B18) |
| F23 | Longevity classes | BPHS 44.11 | Alpa/madhya/purna | none | — | exported in library with wrong bands (C07) | — | P3 | Internal only |

## G. Jaimini and Parashari special apparatus

| # | Technique | Classical source | What the texts say it is for | Spec | Catalogue / stored contract | Engine | Boards | Pri. | Notes |
|---|---|---|---|---|---|---|---|---|---|
| G01 | Chara karakas | JS 1.1.11-19; BPHS 32 | Self (AK), spouse (DK), career (AmK) | vol 02 `general.jaimini`; s.reading.atma | `point` AK…DK | exported, **variant**: 8 karakas only, no 7-karaka option, ties silent | Y L W C | P2 | Node read the dispositor as AK (`TODOS.md:1220`) |
| G02 | Sthira karakas | JS 1.1.20-24 | Relatives' longevity | none | — | not exported | — | P3 | — |
| G03 | Naisargika karakas | BPHS 32 | Natural significators | specs; Node lists (05 F17) | Node `rules.ts` | not an engine output | Y L W C | P2 | Reviewed config table |
| G04 | Rasi drishti | JS 1.1.2-4 | Sign aspects | vol 02 `general.jaimini` | `house.aspectedRasi` | exported | C | P3 | — |
| G05 | Argala / virodhargala | JS 1.1.5-10; BPHS 31 | Intervention on a house | s.promise, s.protection, l.promise | `house.argala` | exported, **incomplete vs text**: no Ketu reversal, no 3rd-house malefic argala, no net verdict, not on points | Y L C | P1 | — |
| G06 | Arudha padas | JS 1.1.29-31; BPHS 29 | Perception, status | specs | `point` A1-A12 | exported (PVR exception) | Y L W C | P2 | Houses from AL missing (`TODOS.md:2954`) |
| G07 | Upapada (A12) | JS 1.4; BPHS 30 | Marriage and spouse | l.promise, l.relationship_arc | `point` UL | exported as A12; no UL-relative houses | L | P1 | — |
| G08 | Karakamsha / Swamsha | BPHS 33; JS 1.2 | Vocation, spirituality, spouse | g.jaimini_karakamsha (**planned**), s.reading.atma, w.reading.vocation | `facts` karakamsa sign only | exported as a sign in `facts`; no frame (houses from KL, D1 and D9) | Y W C | P1 | How the panels locate it was not traced (01 V2) |
| G09 | Special lagnas (HL, GL, BL, VL, SL, IL, Pranapada) | BPHS 5; UK 4 (Indu) | Wealth, power | doc 26 Pass 0 (money) | `point` (from `facts`) | exported in `facts` and `d*` rows (03 §2, §5); only SL, HL mapped into vargas | W C | P2 | The Jaimini researcher's "library only" was the older checkout |
| G10 | Jaimini raja yogas | JS 1.3; BPHS 39 | Status, power | none | `yoga` (AK-PK only) | exported AK-PK only; library `_2`, `_3` not served | W C | P2 | — |
| G11 | Jaimini yogas for career, spouse, children | JS 1.2-1.4 | Area-specific results | w.reading.vocation | none | missing (needs G08 frame) | L W | P2 | Harsh outcomes stay internal |
| G12 | Jaimini longevity (three pairs, Rudra, Maheshvara, Brahma) | JS 2.1 | Longevity | none | — | in library not exported; `house.rudra_based_on_planet_positions` and `house.brahma` disagree with the text (code) | — | P3 | Internal only |
| G13 | Upagrahas (Gulika, Mandi, Dhuma and Kala groups) | BPHS 3; PD | Affliction | s.affliction | `d*` rows | exported by substring key match; a missing body becomes Aries 0° with a computed star (code) | Y C | P1 | Fabricated rows look valid (03 item 11) |
| G14 | Sahams (natal) | [MODERN] PVR | Event points | none | — | not in the natal export | — | P2 | — |

## H. Tajika annual, prashna, muhurta and panchang

| # | Technique | Classical source | What the texts say it is for | Spec | Catalogue / stored contract | Engine | Boards | Pri. | Notes |
|---|---|---|---|---|---|---|---|---|---|
| H01 | Varsha pravesha (solar return) | Nilakantha Samj. 1.16 (HR 1.6) | The year's chart | g.annual, s.annual | `annual` VP rows | exported (true return) | Y L W C | P3 | — |
| H02 | Muntha | Samj. 1.66, Varsh. 2.1 | Year focus house | g.annual, s.annual | `annual.muntha` only when `annual.tajaka` is stored | exported in `annual.tajaka`; **not in the annual pull set** | Y L W C | P1 | 05 B1 |
| H03 | Varshesha (year lord of the solar year) | Samarasimha; Muktavali 4.3-4; Yadava 7.3-7 | Tone of the year | g.annual, s.annual (named "Vaaresha", conflated with C01) | `annual.yearLord` (VP D1, when pulled) | exported, **wrong vs text**: strongest over all candidates, not only those aspecting the lagna; Sun/Moon fallback; mean-year instant (code) | Y L W C | P1 | Specs use one name for two year lords (05 B2) |
| H04 | Tajika aspects and orbs | Samj. 2.11-14; Daivajnalamkrti 8.9 | Aspect strength | g.annual | `annual.tajaka` | exported (orbs match); a "semi-sextile" kind the texts lack | C | P3 | — |
| H05 | Sixteen Tajika yogas | Samj. 2.17-2.74; TBh 4; Yadava 6 | Whether the year delivers a house | g.annual, l.annual | `annual.tajakaYogas` (VP D1, when pulled) | exported 10; Gairi Kamboola and Khallasara stubs; Dutthottha-davira, Tambira, Kuttha, Duruhpha missing | L W C | P2 | `TODOS.md:857` (stubs); the library functions return None, so they must be written, not "called" |
| H06 | Tajika sahams | Samj. 3.5-3.24 | Event points in the year (vivaha, rajya, karma …) | g.annual, l.annual, w.annual_family | `annual.sahams` (in the pull set) | exported, **wrong vs text**: day/night taken from the natal birth, not the revolution (`annual_export.py:740, 808`) | L W C | P0 | Reverses half the formulas for many years |
| H07 | Tri-pataki chakra | Muktavali 1.17-20 | Moon and planets in the year | none | — | missing (not in library) | — | P3 | — |
| H08 | Harsha bala, Pancha-vargiya bala | DA 7.1-2; Samj. 1.33-38 | Year-chart strength; year-lord choice | l.affliction, l.protection (harsha ≥ 15), g.dasha (declared) | not in digest | exported natal only, **wrong vs text**: Venus joy house 12, texts give 5 (`const.py:247-249`); not computed on the year chart | L C | P1 | Threshold 15 has no source (05 B17) |
| H09 | Masa pravesha and month lord | Varsh. 18.3-6 | Month timing | g.annual | `annual.tajaka` month lords | month lords on mean-month instants; monthly chart in library not exported | C | P2 | — |
| H10 | Prashna | Prashna Marga; Shatpanchashika (chapter level only) | Horary second witness | vol 02 `general.prashna` | `prashna_card` | exported (`moment` only); KP-249 / 108 lagnas in library | C | P2 | Product decision pending |
| H11 | Panchang five limbs | MC 1-2 (chapter level) | Quality of a day | lk.panchang_limbs | `day_tables` | exported; class tags (tithi groups, star groups, Amrita Siddhi) computed in Node | Lk | P1 | `TODOS.md:913` (groups); 05 F16 |
| H12 | Rahu kalam, Yamaganda, Gulika | [REGIONAL] | Avoid bands | lk.avoid_bands | `day_tables` | exported | Lk | P3 | — |
| H13 | Abhijit and the 30 muhurtas | MC (chapter level) | Good and bad slices of the day | lk.day_tables | `day_tables` | exported | Lk | P3 | — |
| H14 | Hora | standard | Planetary hours | lk.day_tables | `day_tables` | exported; length rule undocumented | Lk | P3 | — |
| H15 | Choghadiya / Gowri | [REGIONAL] | Day slices | doc 47 | `day_tables` (gauri choghadiya per 03 §9) | in the muhurta day windows @ `b902bea`; scheme (North choghadiya vs Tamil Gowri) unverified | Lk | P2 | `TODOS.md:884` predates it |
| H16 | Muhurta doshas (Panchaka, Bhadra, Gandanta …) | MC 1, 6 | Times to avoid | lk.scenarios | `day_tables` | mostly missing; `panchaka_rahitha` served under a name that suggests the Dhanishtha Panchaka but is the Kerala sum-mod-9 scheme | Lk | P1 | — |
| H17 | Event muhurta (marriage, travel, business) | MC 6, 11 | Choosing a start time | lk.scenarios (13 Node rule rows) | Node `scenarios.ts` | missing | Lk | P2 | Verse-level MC pass first |

## I. Cross-cutting engine issues

| # | Issue | Source | Affects | Pri. | Notes |
|---|---|---|---|---|---|
| X01 | Dasha options and varga never reach the library (`dasha_export.py:600-602`) | 03 §12.1, 05 C1 | A01, B02, B03, school variants | P1 | Blocks Narayana D9/D10 and every declared variant |
| X02 | Legacy 2-level types are the batch default; batch `bhava` errors | 03 §12.3-4 | callers of `calculate-full-kundli` | P2 | — |
| X03 | Ayanamsa not enforced outside `facts`, `transits`, `pressure_inventory` | 03 §12.5 | every type | P1 | One response can mix ayanamsas |
| X04 | Errors return empty `periods: []` with success | 03 §12.12 | every dasha type | P1 | Looks like valid empty data |
| X05 | No school/variant tag on any output | every researcher | all | P1 | Each variant choice above needs `variant` and `text` fields |
| X06 | Node computes astrology in about 25 places outside the digest; guard test scans only `src/reading/digest/` | 05 §A | all boards | P1 | Widen `noAstrologyInNode.test.ts` |

## Counts

139 rows: 133 techniques (A 15, B 24, C 10, D 11, E 19, F 23, G 14, H 17) and 6 cross-cutting engine issues (X).
**P0: 8. P1: 33. P2: 52. P3: 46.**

How firm each P0 is:

| Row | Basis | State |
|---|---|---|
| C02 Mudda start lord | engine **run** | proven |
| C01 TP year dasha (stored rows) | stored rows inspected (`TODOS.md:19`) | proven; engine bounded @ `b902bea`, rows need a re-pull |
| F15 Sun/Moon yogas for empty houses | proved on two charts (`TODOS.md:87`) | proven |
| H06 annual sahams day/night | code (`annual_export.py:808`) | unambiguous in code |
| B01 Narayana antardasa | code | verify first |
| B03 Chara antardasa | code | verify first |
| A11 Yogini star table | code (reimplementation) | verify first |
| E07 three BAV cells | code, against PD 23 | verify first (check the BPHS 66 table) |

A11, B01, B03, C02, E07 and H06 were filed by this review; C01 (108 years) and F15 were already in `docs/TODOS.md`.
The C01 current-year fallback is filed as P1 (it bites only for years at or before the birth year). E01 (gochara) was
first rated P0 and lowered to P1: `pressure_inventory` softens Jupiter to "mixed" in four houses rather than inverting
the text, and the choice of table is already an open decision (`TODOS.md:1876`).
