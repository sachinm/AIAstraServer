# 01 — Technique spec inventory (`docs/techniques/**`)

Read-only inventory, 2026-11-18, of every file under `docs/techniques/` on the shared checkout
(`feat/self-foundation-server` @ `280ac27`; the subfolders `general/`, `self/`, `love/`, `work/`, `lucky/` are
untracked work in progress per `git status`). Purpose: list what each spec says a technique uses, so the classical
research in `docs/deep-research/*` can be laid beside it. Code cross-checks cite `src/techniques/catalog.ts` (the
`TECHNIQUES` catalogue, 142 rows, all `built`; see 02).

## How the specs are organised

| File(s) | What it is | Size |
|---|---|---|
| `README.md` | Index: six illustration volumes, a "pieces" table (digest slicers, calendar loaders, scorers, cache gate, LLM pieces), "Complete Catalogue Index (69 Techniques)" (`README.md:57`), and an index of the 45 "Priority #2" per-technique specs (`README.md:145-202`) | 202 lines |
| `01-architecture-and-reusable-pieces.md` | Vol. 01: architecture, pieces, cache gate, recipe families, error-correction voting, companion memory and `selectTechniques`, `digest.build`, `digest.annual_set`, `digest.activation` (10 pages) | 358 |
| `02-general-reading-illustrations.md` | Vol. 02: 15 chat techniques (`general.intake` … `general.validator`) | 652 |
| `03-self-board-illustrations.md` | Vol. 03: 55 "pages" — 8 house-state layers, research QA/verifier, character arc, personality/joy, `self.reading.*` (v1 cards), `self.sub.*` and `self.v2.*`, `self.v3.cards`, `reading.clock.sheet`, `reading.concordance`, `self.card.reading`, `self.now` | 1653 |
| `04-love-board-illustrations.md` | Vol. 04: 8 love layers, 3 sub-areas, `love.reading.*`, `love.relationship_arc` (25 pages) | 1049 |
| `05-work-board-illustrations.md` | Vol. 05: 9 career-map techniques, `work.reading.*`, `work.character_arc` (23 pages) | 975 |
| `06-lucky-times-and-life-illustrations.md` | Vol. 06: 4 panchang techniques, 13 scenarios, 4 `life.*` techniques (21 pages) | 807 |
| `general/*.md` (9), `self/*.md` (10), `love/*.md` (11), `work/*.md` (10), `lucky/*.md` (5) | "Priority #2" one-technique specs. Common template: header (id, board, status, owning code), §1 summary, §2 "Untapped Radha resources mapped" (gap ids R1-R6, H1-H8, O1-O3 from docs/reading-engine/80 and 81), §3 declared charts, contract inputs, output, §4 pipeline step, §5 UX words, §6 cache and RBAC | 88-112 lines each |

Two templates are in use: `general/`, `self/`, `lucky/` put the declared charts in a bullet; `love/`, `work/` use
§3.1 Declared Charts / §3.2 Contract Inputs tables and mark the Priority #2 additions as `//` comments. The first
template does **not** mark additions, so its "Declared Charts" blocks mix code and wish (finding S1 below).

## Main table: the 45 per-technique specs

Abbreviations: V = Vimshottari, N = Narayana, Ch = Chara, K = Karaka (Jaimini) dasha, Y = Yogini, TA = Tithi
Ashtottari, Cond = conditional dashas chosen by `dasha.applicable`, TP = Tithi Pravesha, VP = Varshaphal (Tajika),
SAV/BAV = ashtakavarga. "Status" is what the spec header says; "Catalogue" is what `catalog.ts` holds.

| Spec file | Technique id | Board | Status (spec / catalogue) | Classical techniques, dashas, vargas, transit methods | Engine inputs it expects (digest sections / chart types) | Output | Notes |
|---|---|---|---|---|---|---|---|
| `general/general.promise.md` | `general.promise` | chat | built / built (`catalog.ts:860`) | House promise: lords, karakas, arudhas, special lagnas, frame vargas D1-D10 (+D11-D60 "unlocked by frame"), bhava bala, vimsopaka, bhava chalit (H8) | `house`, `planet`, `point`, `yoga`; `strength.bhava`, `strength.vimsopaka` | `findings.v2` → `general.oracle` | Bhava/vimsopaka not in digest (02 D2); doc 53 rename to `general.house_promise` not done (02 D3) |
| `general/general.varga_dynamics.md` | `general.varga_dynamics` | chat | built / built (`:876`) | D1 vs Dn agreement over D2, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, D60, D81, D108, D144; vimsopaka | `house`, `planet` per varga | `findings.v2` (code reader) | D81/D108/D144 not sliced to any agent (02 D7); rules in `codeReaders/rules.ts` hold Node thresholds (05 F-list) |
| `general/general.dasha.md` | `general.dasha` | chat | built / built (`:896`) | V MD/AD/PD (L3), N, Cond, Ch, K, Y, TA; TP year lord; vimsopaka, harsha bala; D9 maturity gate age 36 | `activation`, `planet`, `house`; `dasha.applicable` | `findings.v2` → `general.oracle` | Spec's chart list adds `strength.vimsopaka`, `strength.harsha` that `catalog.ts:901` does not have |
| `general/general.annual.md` | `general.annual` | chat | built / built (`:912`) | TP and VP (current, previous, next year) in D1/D9/D10, TP dasha, Mudda, Patyayini, sahams, Tajaka (muntha, year lord), return panchanga | `annual` | `findings.v2` | Year lord / muntha never populated (02 D4); TP dasha 108-year P0 (`docs/TODOS.md:19`) |
| `general/general.transit.md` | `general.transit` | chat | built / built (`:928`) | Gochara of slow planets over frame houses, lords, karakas, arudhas; double transit; sade sati; eclipses; transit ashtakavarga + kakshya; vedha (H1), murti nirnaya (H2), divisional transits (H7), 2027-2036 contacts (R5) | `transit`, overlay, `transit_contacts`, `transit_ashtakavarga` | `findings.v2` | Vedha, murti, kakshya are spec-only; the engine has no vedha (03 §12 item 8) |
| `general/general.nakshatra.md` | `general.nakshatra` | chat | built / built (`:944`) | Janma and lagna star, tara table, gandanta, cusp stars, star lords, "pending karma houses", daily grade, Sarvatobhadra (O1) | `star`, `house`, `planet`, `daily_grade` | `findings.v2` | "Pending karma houses" is a Lunar-Astro (non-classical) notion; SBC not exported |
| `general/general.oracle.md` | `general.oracle` | chat | built / built (`:1076`) | None directly; synthesises findings | `findings`, `text` | `answer.markdown` | Declared charts `[]` |
| `general/general.jaimini_karakamsha.md` | `general.jaimini_karakamsha` | chat (+you, work) | **planned** / **absent** | Karakamsha and Swamsha, AK/AmK, houses 1, 5, 9, 10, 12 from KL, D9 | `point`, `house` (KL not exported) | `findings.v3` | New technique; engine has no KL export named; catalogue has `general.jaimini` (`:980`) instead |
| `general/general.sudarshana_chakra.md` | `general.sudarshana_chakra` | chat (+you, work, love) | **planned** / **absent** | Sudarshana chakra (Lagna, Moon, Sun wheels), yearly progression, D9/D10 versions | new `sudarshana_wheel` layout | `findings.v3` | Engine does not export Sudarshana (03 §11) |
| `self/self.promise.md` | `self.promise` | you | built / built (`:600`) | House promise of 1, 4, 5 (+9, 12) and the Moon: argala, SAV, arudhas, avasthas, yogas, doshas, bhava bala, vimsopaka, D1-D60 | `house`, `planet`, `point`, `yoga` | `area_board.v1` | Title says houses 1, 4, 5; filters read 1, 4, 5, 9, 12 |
| `self/self.affliction.md` | `self.affliction` | you | built / built (`:609`) | Dusthana lords, combustion, war, debility, papakartari, nodes on axis, doshas, dead avastha; release date from activation; D30, D60, D27 | `house`, `planet`, `yoga`, `activation` | `area_board.v1` | Spec lists `strength.bhava`, D1, D30, `dasha.vimshottari` as declared charts; code row has none of them (`catalog.ts:609`) |
| `self/self.protection.md` | `self.protection` | you | built / built (`:615`) | Jupiter drishti on lagna/Moon, argala, yogas, avasthas, varga dignity (D9, D20, D24, D12, D4, D7, D60) | `house`, `planet`, `yoga` | `area_board.v1` | Vimsopaka and bhava bala spec-only |
| `self/self.activation.md` | `self.activation` | you | built / built (`:627`) | Activation of houses by V, Cond, N, Ch, K, TP dasha, Y, TA; family votes; D1 + owning varga agreement | `activation`, `planet` | `area_board.v1` | TP dasha included as a clock while it is a 108-year tree (P0) |
| `self/self.transit.md` | `self.transit` | you | built / built (`:634`) | Saturn, Jupiter, Rahu, Ketu and eclipses over houses 1, 4, 5, 9, 12, lords and arudhas, ±24 months; double transit; sade sati; transit ashtakavarga + kakshya; vedha; murti nirnaya | `transit` | `area_board.v1` | Vedha/murti/kakshya spec-only |
| `self/self.annual.md` | `self.annual` | you | built / built (`:640`) | TP and VP, sahams, Mudda, Patyayini, TP dasha; TP year lord ("Vaaresha"), return panchanga; TP D9/D20/D24/D30; Sudarshana | `annual` | `area_board.v1` | Conflates the TP weekday lord ("Vaaresha") with the Tajika year lord the digest would read from `annual.tajaka` (VP) |
| `self/self.varga.md` | `self.varga` | you | built / built (`:648`) | Owning vargas D9, D20, D24, D12, D4, D7, D60; vimsopaka; D9 maturity gate (>36) | `house`, `planet` | `area_board.v1` | D20, D24, D12, D60 are "dossier" or full coverage depending on pull (02 §2.1) |
| `self/self.nakshatra.md` | `self.nakshatra` | you | built / built (`:654`) | Cusp stars, star lords, occupant stars, janma tara table, gandanta, pending karma houses, daily grade, SBC vedha | `star`, `house`, `planet` | `area_board.v1` | Same Lunar-Astro note as `general.nakshatra` |
| `self/self.character_arc.md` | `self.character_arc` | you | built / built (`:676`) | Three 10-year windows; D1 lagna, L1, D9 maturation, Sun, AK; V and N; TP; D1+D9 confirmation after 36 | `house`, `planet`, `point`, `activation`, `annual` | `self_character_arc.v1` | Spec lists `strength.vimsopaka` and `natal.sudarshana_chakra` at `catalog.ts:681`; code (`:681-690`) has neither |
| `self/self.personality_joy.md` | `self.personality_joy` | you | built / built (`:721`) | Moon, Mercury, 4th and 5th bhava, D9, D24, janma star | `house`, `planet`, `star` | `self_personality_joy.v1` | Code reads `PointRow.lord` as the AK (02 / 05 F29) |
| `love/love.promise.md` | `love.promise` | love | built / built (row from `catalog.ts:600` with LOVE config `:663-667`) | Promise of 7, 5, 11, 2, 4, 8, 12: argala, SAV, bhava bala, yogas, doshas, arudhas (UL, A7), avasthas; D9, D7, D30 | `house`, `planet`, `point`, `yoga` | `area_board.v1` | Priority #2 additions marked as comments (honest) |
| `love/love.affliction.md` | `love.affliction` | love | built / built | Afflictions on love houses; harsha bala for trik lords; bhava chalit | as `self.affliction` | `area_board.v1` | Harsha threshold `>= 15` stated without source |
| `love/love.protection.md` | `love.protection` | love | built / built | Benefic aspects, argala, D9 7th lord dignity, harsha | as `self.protection` | `area_board.v1` | — |
| `love/love.activation.md` | `love.activation` | love | built / built | V, Cond, N, Ch, K, TP dasha, Y, TA; vote counts only with D1 + D9/D7 agreement | `activation`, `planet` | `area_board.v1` | Same TP-dasha P0 |
| `love/love.transit.md` | `love.transit` | love | built / built | Slow transits over love houses, double transit, sade sati, eclipses, transit AV; vedha, murti (H1, H2) | `transit` | `area_board.v1` | States that neither engine nor server computes vedha (true) |
| `love/love.annual.md` | `love.annual` | love | built / built | TP, VP, sahams (vivaha, preethi, santapa, paradara), Mudda, Patyayini, TP dasha | `annual` | `area_board.v1` | — |
| `love/love.varga.md` | `love.varga` | love | built / built | D9, D7, D30; D9 maturity gate; neecha vargottama as "drudha karma" | `house`, `planet` | `area_board.v1` | — |
| `love/love.subareas.md` | `love.meet`, `love.health`, `love.reconcile` | love | built / built (`catalog.ts:774`) | Selection by `love.status`; UL windows; D9 agreement | `findings` of the 8 layers | — | Sub-area rules are Node lists (`src/reading/area/love.ts:24-31`, 05) |
| `love/love.bonding_chemistry.md` | `love.bonding_chemistry` / `love.synastry_koota` | love | **partial** / **absent** (no `bonding` or `synastry` id in `catalog.ts`; the code exists only as `buildLoveBondingAndChemistry`, `selfCharacterAndJoy.ts:1184`) | Ashtakoota / Dasakoota, dosha cancellations, D9, D7, SAV, arudhas | new `compatibility` type | `love_synastry.v1` | Engine has matching code but does not export it (03 §11); spec cites `selfCharacterAndJoy.ts:1220` SAV fallback `?? 27` (a Node default) |
| `love/love.relationship_arc.md` | `love.relationship_arc` | love | built / built (`catalog.ts:787`) | Three decades of 7th, Venus, DK, UL; V; TP; D9, D7 | `house`, `planet`, `point`, `activation`, `annual` | `love_relationship_arc.v1` | — |
| `love/love.reading.oracle.md` | `love.reading.oracle` | love | built / built (`catalog.ts:1839`) | Family sub-agents (rasi, varga, dasha, year, sky), lineman, oracle | all six digest sections | model output | — |
| `work/work.present_tone.md` | `work.present_tone` | work | built / built (`catalog.ts:117`) | Seven family vote (doc 43 §8.1): V, Cond, N (+Ch, Sudasa), K, annual, slow transits, short clocks (Y + TA); D1/D10 validation | `activation`, `transit`, `house`, `planet` | `career_map.v1` | Code families are S1-S7 (`career.ts:40-45`); TA is labelled Ashtottari-of-tithi but spec keys on "short clocks" |
| `work/work.security_grade.md` | `work.security_grade` | work | built / built (`catalog.ts:145`) | 6/8/12 drivers by month; harsha, bhava bala; D10 | as above | `career_map.v1` | — |
| `work/work.subarea_windows.md` | `work.subarea_windows` | work | built / built (`catalog.ts:168`) | Windows by sub-area (job, change, promotion, pay, abroad, business); D10, D2, D4, D11 | as above | `career_map.v1` | Driver rules hard-coded in `career.ts:182-197, 294` (05) |
| `work/work.horizons.md` | `work.horizons` | work | built / built (`catalog.ts:192`) | 1, 3, 6, 12-month rungs; exact contacts (stop end-2026, `docs/TODOS.md:240`); transit AV | as above | `career_map.v1` | — |
| `work/work.annual_family.md` | `work.annual_family` | work | built / built (`catalog.ts:236`) | TP chart and TP D10, TP dasha, Mudda, Patyayini, rajya and karma sahams | `annual` | family vote | `career.ts:46` still lists it in `FAMILIES_NOT_BUILT` (02 D10) |
| `work/work.conditional_family.md` | `work.conditional_family` | work | built / built (`catalog.ts:256`) | Conditional dasha the chart qualifies for (`dasha.applicable`), levels 1-3 | `activation` | family vote | Same stale constant |
| `work/work.karaka_family.md` | `work.karaka_family` | work | built / built (`catalog.ts:275`) | Jaimini karaka dasha L3; AmK; D10 | `activation`, `point`, `planet` | family vote | Same stale constant |
| `work/work.d10_check.md` | `work.d10_check` | work | built / built (`catalog.ts:294`) | D1 vs D10 vote validation; D9 tie-break; D60 confirm only with exact birth time | `house`, `planet` | check result | Rule tables in `career.ts` (Node) |
| `work/work.character_arc.md` | `work.character_arc` | work | built / built (`catalog.ts:314`) | Three decades of 10th, L10, AmK, Saturn; D10, D9; TP | `house`, `planet`, `point`, `activation`, `annual` | `work_character_arc.v1` | — |
| `work/work.reading.oracle.md` | `work.reading.oracle` | work | built / built (`catalog.ts:1920`) | Family sub-agents with D1, D9, D10, D2 | all six | model output | — |
| `lucky/lucky.day_tables.md` | `lucky.day_tables` | lucky | built / built (`catalog.ts:454`) | Muhurta day table per place: sunrise/sunset, rahu kaal, yamaganda, gulika, durmuhurta, abhijit, horas, 30 muhurtas, panchanga limbs | `panchang` (`muhurta`) | `day_tables.v1` | Shared per place (`day_tables`) |
| `lucky/lucky.panchang_limbs.md` | `lucky.panchang_limbs` | lucky | built / built (`:473`) | Vara, tithi, nakshatra, yoga, karana; tithi groups (nanda …), star groups (fixed …), Amrita Siddhi | `panchang` | `limbs.v1` | Tithi/star groups and Amrita Siddhi are Node tables (`scenarios.ts:34-52, 117-130`) |
| `lucky/lucky.avoid_bands.md` | `lucky.avoid_bands` | lucky | built / built (`:413`) | Rahu kaal, yamaganda, gulika, durmuhurta, varjyam; good spans | `panchang` | `day_bands.v1` | — |
| `lucky/lucky.personal_overlay.md` | `lucky.personal_overlay` | lucky | built / built (`:433`) | Tara bala, chandra bala, daily grade, transit AV kakshya, functional nature of hora lords; Pancha Pakshi (O2) | `panchang`, `planet`, `activation` | `day_overlay.v1` | Functional nature parsed by regex in Node (`wiring.ts:49-57`) |
| `lucky/lucky.scenarios.md` | 13 `lucky.<area>.<action>` rows | lucky | built / built (`catalog.ts:397`) | Per action: favoured/avoided weekdays, horas, tithis, stars, yogas, karanas | `panchang` | `windows.v1` | Rule lists in Node code (`scenarios.ts:173+`), not in `env.ts` |

## Techniques specified only in the illustration volumes (01-06)

These ids have no per-technique file; the volume page is their only spec. Each page has a field table ("Charts
Declared", "Output Piece", "Code & Source") followed by a flow diagram. Charts are quoted from the page; line = the
page's heading line. Pages were not each checked against `catalog.ts` (spot checks only; see S1 for why the per-file
specs differ from code).

| Volume:line | Technique id | Board | Charts declared on the page (classical content) | Output |
|---|---|---|---|---|
| 01:255 | `digest.build` | all | Every stored natal and varga type into six digest sections | `kundli_digest` |
| 01:296 | `digest.annual_set` | all | TP and VP ten years back and ahead in D1, D9, D10; TP dasha, Mudda, Patyayini, sahams | `annual` section |
| 01:329 | `digest.activation` | all | Every period of every stored dasha system, birth to +30 years | `kundli_activation` |
| 02:9, 02:50 | `general.intake`, `general.clarify` | chat | none (question → subjects, houses, horizon, slots) | `intent.v1` |
| 02:355 | `general.strength_yoga` | chat | yogas, doshas, strength (shadbala), SAV, avasthas | `findings.v2` (with `graces[]`) |
| 02:403 | `general.jaimini` | chat | chara karakas, arudhas, argala, Narayana and Chara dashas. Rules on the page: karaka or arudha in kendra/trikona supports, in dusthana obstructs; argala primary vs obstructing count; Narayana/Chara period on a frame house supports; top 8 claims, clamp `round(sum/3)` to −3..+3 | `findings.v2` |
| 02:449 | `general.prashna` | chat | prashna chart at the question moment | `findings.v2` |
| 02:486 | `general.person` | chat | aspects, D12, D9, D7, D3, Vimshottari (other people from the native's chart: parents, spouse, children, siblings) | `findings.v2` |
| 02:536 | `general.reader` (R01-R14, P1-P3) | chat | yogas, doshas, aspects, bhava, strength, prashna, sphutas, argala, D1-D10 and D30, Vimshottari, Narayana, Chara, Yogini, TA, Dwisaptati, `dasha.applicable`, transit overlay, TP, VP, sahams, Mudda, Patyayini | `findings.v2` |
| 02:613 | `general.validator` | chat | none | `validator.v1` |
| 03:368, 04:483, 05:411 | `research.self/love/work_dashboard_qa` | research | natal facts, dignities, aspects, avasthas, yogas, doshas, shadbala, SAV, chara karakas, arudhas, argala, janma and cusp stars, ten vargas, V, Y, TA, N, Ch (self), K; TP, VP, TP dasha; contacts, sade sati, muhurta | research outputs |
| 03:411 | `research.technical_verifier` | research | same sources + the 10-step trace | `research_verifier_audit.v1` |
| 03:552-1040 | `self.reading.diagnosis`, `.clock`, `.lagna`, `.mind`, `.atma`, `.yogas`, `.struggle`, `.chapters`, `.body`, `.purview`, `.audit`, `.year`, `.oracle` (v1 Self cards) | you | clock: `dasha.applicable` + all served systems; lagna: D1, D9, arudhas, cusp star; mind: Moon, Mercury, 3/4/5, Moon star, SAV; **atma: AK, karakamsa, Sun, Jupiter, 9th, 12th** (karakamsa has no engine field, 03 §5); struggle: afflictions with release dates from the reading clock L1-L3; chapters: reading clock L1-L2 confirmed by V, N, Ch, Y, K, TA, dasha charter; body: D1, D30, functional nature; year: TP, VP, Mudda | `self_panel.v1`, `self_clock.v1`, `board_diagnosis.v1`, `purview.v1`, `code_audit.v1`, `self_reading.v1` |
| 03:1090-1248 | `self.sub.clock`, `.periods`, `.windows`, `.promise`, `.risk`, `.mind_facts`, `.body_facts`, `.presence_facts`, `.year`, `.profile` | you | as in 02 §3.2 (dasha.applicable + all served systems; primary clock L1-L3 + dasha charter; sky overlay; yogas/doshas; D1, D9, D30; A6, AL; VP Mudda) | typed sub-technique outputs |
| 03:1264-1631 | `self.v2.*` (12 areas), `self.v2.oracle`, `.personalizer`, `.hero`, `self.v3.cards`, `reading.clock.sheet`, `reading.concordance`, `self.card.reading`, `self.now` | you | selections over `self.sub` outputs; Oracle reads D1, D9, D10, D30, reading clock, year chart, sky; v3 and clock sheet read each clock of the reading set; Now reads the deepest level of each clock and the D1-D60 sky | `self_v2_*`, `self_v3_cards.v1`, `clock_sheet.v1`, `agreed_ledger.v1`, `now_card.v1` |
| 04:324 | `love.nakshatra` | love | cusp stars, star lords, occupant stars of the love houses | `area_board.v1` |
| 04:369-445 | `love.meet`, `love.health`, `love.reconcile` | love | facts, D9, Vimshottari, transit contacts (selected by `love.status`) | `board_subarea.v1` |
| 04:530-962 | `love.reading.clock`, `.diagnosis`, `.chapters`, `.heart` (Venus, Moon, 5th lord, D9 7th), `.partner` (7th, lord, DK, UL, A7, D9 7th), `.bond` (7th, 2nd, 4th, 8th, UL and its 2nd, D9, D7), `.circle`, `.struggle`, `.year`, `.purview`, `.audit`, `.oracle` | love | as listed in brackets; chapters read reading clock L1-L2 + confirming clocks L1 | `board_panel.v1` etc. |
| 05:191 | `work.looking_back` | work | V, Y, TA, N; contacts, double transit; Jaimini modifier; house counts. Stores the person's yes/partly/no answers in `area_checks` | `career_map.v1` |
| 05:458-888 | `work.reading.clock`, `.diagnosis`, `.chapters`, `.vocation` (10th, lord, D10, AmK, four karakas, karakamsa), `.standing` (AL, A10, Sun, 10th lord, D10 lagna), `.ground` (6th, 3rd, 7th, 12th, D10 6th and 3rd), `.gain` (11th, 2nd, D2, D10 11th, dhana yogas), `.struggle`, `.year`, `.purview`, `.audit`, `.oracle` | work | as listed in brackets | `board_panel.v1` etc. |
| 06:168-591 | 13 `lucky.<area>.<action>` scenarios | lucky | tithi, nakshatra, weekday, hora, muhurta, kalams, yoga, karana (rules in `scenarios.ts`) | `windows.v1` |
| 06:626-764 | `life.promise_scale`, `life.timing_agreement`, `life.mahadasha_charter`, `life.dashboard` | timeline | digest house, planet, yoga; D9 + owning varga; activation; digest annual; double transit snapshot | `life_promise.v1`, `life_windows.v1`, `life_charter.v1`, `life_reading.v2` |

Notes on the volume-only specs:

- **V1. Jaimini reduced to house classes.** `general.jaimini` (02:403) scores karakas and arudhas by kendra/trikona vs
  dusthana and counts argala planets. Rasi drishti, the Jaimini sign-strength rules and karakamsa are absent. This is
  the place to compare with `jaimini-apparatus/`.
- **V2. Karakamsa named, not served.** `self.reading.atma` and `work.reading.vocation` read "karakamsa"; no engine
  type exports a Karakamsha lagna (03 §5), so how these panels locate it was not traced; if they derive it from the AK's D9 sign in Node, that is a lookup the rule forbids.
- **V3. Four `life.*` pages share one chart list.** Promise scale, timing agreement, charter and dashboard list the same
  inputs; the page does not say which input drives which output.
- **V4. Page counts.** Vol. 01 page 5 says "How 67 techniques collapse"; README says 69; the catalogue has 142.

## Per-file notes: contradictions and vague rules

**S1. Declared charts in `general/` and `self/` specs are not the code's.** Example: `self/self.character_arc.md` §3
says `catalog.ts:681` declares `strength.vimsopaka` and `natal.sudarshana_chakra`; `catalog.ts:681-690` declares
neither. `self/self.affliction.md` lists `strength.bhava`, D1, D30 and `dasha.vimshottari`; `catalog.ts:609` has
`facts, dignities, aspects, doshas, avasthas, house_counts` only. `general/general.dasha.md` adds vimsopaka and harsha
to `catalog.ts:901`. A reader comparing with the classical research must treat these blocks as wishes, not as what
runs. The `love/` and `work/` specs do mark the additions as comments.

**S2. "Status: built (Priority #2 enhancement ready)".** Every built spec carries a parenthetical claiming the
Priority #2 engine work is "ready"; none of R1-R6 / H1-H8 is implemented (`docs/TODOS.md:115-135`, doc 80/81 open).

**S3. Houses in the Self specs.** Titles say "Houses 1, 4 and 5 with the Moon"; contract filters read houses
1, 4, 5, 9, 12 (`self/self.promise.md`, `self.affliction.md`, `self.transit.md`). Which set drives the verdict is not
stated.

**S4. Two different "year lords".** `self/self.annual.md`, `general/general.annual.md`, `love/love.annual.md` and
`work/work.annual_family.md` ask for the Tithi Pravesha "year lord (Vaaresha)" and return panchanga. The digest's
`AnnualRow.yearLord` is the Tajika year lord from `annual.tajaka` on the VP chart (`src/reading/digest/build.ts:1177-1187`).
These are different classical quantities (weekday lord of the TP moment vs the Tajika Varshesha chosen from five
office-bearers). The specs use one name for both.

**S5. Vague thresholds without a source.** Harsha bala "`>= 15`" (`love/love.protection.md`, `love/love.affliction.md`),
SAV 28/22 (doc 11 §2, `codeReaders/rules.ts:53-54`), dignity score adjustments ±1.0/1.2/1.5 for D1/D9 confirmation
(doc 76 §0.1), "Jupiter transit from Moon 2/5/7/9/11 favourable" (doc 11 §4). Each needs a classical citation or an
`env.ts` setting.

**S6. D9 maturity gate.** Every self, love and work varga spec applies `D9_MATURITY_AGE_YEARS=36` ("no assessment from
D1 alone after 36", doc 76 §0.1). Saturn's maturation age of 36 is a known classical list; the rule that D1 cannot be
read alone after 36 is a project rule and should be checked against the research in `natal-techniques/`.

**S7. Neecha vargottama as weak.** `love/love.varga.md` and doc 76 class a planet debilitated in both D1 and D9 as
`confirmed_weak` ("drudha karma"). Classical texts disagree on whether vargottama lifts a debilitated planet; flag for
the research comparison.

**S8. Lunar-Astro additions.** "Pending karma houses" (`general.nakshatra`, `self.nakshatra`) and the
`avasthas.lunar_astro` points come from a modern school, not BPHS/Jaimini. They should be labelled as such.

**S9. Tithi Pravesha dasha as a clock.** `self.activation`, `love.activation` include `annual.tithi_pravesha_dasha` as a
voting clock while the stored rows span 108 years (`docs/TODOS.md:19-30`).

**S10. README counts.** "Complete Catalogue Index (69 Techniques)" (`README.md:57`) against 142 catalogue rows; Vol. 03
page headers run "Page 10 of 10", "11 of 12", "13 of 25", "26 of 55" (`03-self-board-illustrations.md:411-1631`), so the
volume grew by appending and was never renumbered.

**S11. Owning code with Node rules.** Several specs name owning code that holds astrological rule lists in Node
(`lucky.panchang_limbs` → `scenarios.ts`; `work.*` → `career.ts`; `love.subareas` → `love.ts`). Detail in 05.

**S12. Varga vocabulary.** Specs say "unlocking all 23 divisional vargas"; the engine serves 23 factors (03 §2) but the
server's legacy served set is D1, D2, D4, D7, D9, D10 (`chartData/catalog.ts:133`) and the digest reads the rest only
when `dignities.dN` is stored (02 §2.1). The specs do not say which coverage level (full, dossier, placement-only) a
technique needs.
