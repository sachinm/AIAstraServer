# 05 — Findings: bugs, contradictions, missing pieces, Node astrology

Review of 2026-11-18. Server checkout `feat/self-foundation-server` @ `280ac27`; engine `origin/release-candidate-staging`
@ `b902bea` (see 03). Nothing here is filed in `docs/TODOS.md` yet; the final writer files them. "Filed" marks items
already in `docs/TODOS.md` (line given) that are still true in the code. Line numbers hold for the commits above.

Severity: **High** changes a reading; **Medium** scores or rule lists, or research/QA only; **Low** label or naming.

## A. Node computes astrology (rule: the engine is the only source of astrological data)

The digest has a guard test, `tests/unit/reading/digest/noAstrologyInNode.test.ts`, but it scans only
`src/reading/digest/` (`DIR`, line 11). Every item below lives outside that folder, so the test cannot catch it.
**Fix A0 (spec change):** widen the test's directory list to `src/reading/**` (minus word tables) and add the
patterns below (house-class literals `[6, 8, 12]`, `[1, 4, 7, 10]`, gochara house lists, sign-ring indexing).

| # | file:line | What Node computes | Sev. | Filed? | Suggested fix (engine addition or spec change) |
|---|---|---|---|---|---|
| F1 | `src/reading/nodes/convergence.ts:160-198` | Fortune tier from `DIGNITY_SCORE`, `GOOD_HOUSES`, `DUSTHANA`, Jupiter-from-Moon 2/5/7/9/11 and Saturn 3/6/11 gochara lists, SAV 28/22, tier cut-offs (the doc 11 §4 fortune tier) | High | `TODOS.md:72` | Engine exports `fortune_tier` with its inputs, or a `gochara.favourable` flag per transit row and a dasha-lord placement grade; delete the tables. Doc 11 §4 to say "engine computes" |
| F2 | `src/reading/dasha/dashaAssessment.ts:142-153` | Vargottama (`d1Sign === d9Sign`), neecha vargottama, "neecha bhanga via D9", confirmed strong/weak and score adjustments ±1.0/1.2/1.3/1.5 (doc 76 §0.1) | High | new | Planet cards carry `vargottama` and `neecha_bhanga[]` (with source varga) from the engine; engine returns a `d1_d9_confirmation` verdict; the score constants move to `env.ts` |
| F3 | `src/reading/dasha/dashaAssessment.ts:367-374, 456-485` | House classes `[1,4,7,10,5,9,11]` / `[6,8,12]` and dignity regexes grade varga placement and the TP year lord | High | new | Read the engine house `class` already on house cards; engine returns year-lord affliction |
| F4 | `src/reading/digest/build.ts:573, 636, 847-850` | Conjunction = same sign (`signOf` match at `:573`; `int(qv.sign) === int(pv.sign)` at `:847-850`), no orb; `docs/TODOS.md:1119` says another digest path uses an 8° rule, so two conjunction rules co-exist | High | partly (`TODOS.md:1119` notes the mismatch, not the rule violation) | Engine exports `conjunctions[]` per planet per varga with its orb rule |
| F5 | `src/reading/layers/sections.ts:33-41, 47-49, 170-174` | Natal sign→lord map applied to prashna and TP charts; co-lords dropped; house sign taken from first occupant | High | `TODOS.md:70` | Prashna and TP exports carry `houses[].{sign, lord, co_lord}` and `lagna.lord` |
| F6 | `src/reading/area/houseLayers.ts:406-409` | Lord of a rasi-dasha period looked up from the sign; Scorpio/Aquarius co-lords ignored | High | `TODOS.md:1683` | Rasi dasha rows carry `lord` and `co_lord` |
| F7 | `src/reading/digest/activation.ts:142-160` | Houses a dasha period activates (occupied + owned + graha-drishti houses; rasi: sign house + lord house) | High | `TODOS.md:1685` | `dasha.*` rows carry `houses_activated[]` (engine), per doc 46 §B.4 rules |
| F8 | `src/reading/self/oracle.ts:348-375` | Transit house via a Node sign→house map fallback; "over natal Moon" by sign compare | High | `TODOS.md:1684` | Ingress rows always carry `house_from_lagna` and `over_natal[]`; drop the fallback |
| F9 | `src/reading/timeline/foundation.ts:16-19, 111-152` | `KENDRAS`/`TRIKONAS`/`DUSTHANAS` placement class of house lords; Rahu/Ketu ownership via co-lord | High | `TODOS.md:73-74` | House cards carry `lord_placement_class`; planet cards carry engine `owns` |
| F10 | `src/reading/timeline/pastReadingFlow.ts:331-332, 646-654, 682-683` | Defaults lagna to Pisces (`?? 11`) and lord to Jupiter, hard-coded aspect prose ("aspecting the 1st, 11th and 3rd"), Dwisaptati applicability by Node rule | High | privacy only (`TODOS.md:646`) | Remove defaults; read `dasha.applicable` and the lord's `aspectsTo` |
| F11 | `src/reading/area/career.ts:158, 182-197, 294, 419, 475` | `WORK_DUSTHANA`, career house scoring, job-change / abroad drivers (`Ra`, L12, L3, L9) | High | new | Rule lists to `env.ts`, or engine `career.sub_area_triggers`; use house-card `class` |
| F12 | `src/reading/area/houseLayers.ts:180-182` | Which planet a karaka is, by matching sign/house/dispositor | Medium | `TODOS.md:1683` | Read `PointRow.planet` (already in digest) |
| F13 | `src/reading/area/selfCharacterAndJoy.ts:473` | Reads `PointRow.lord` (dispositor) as the atmakaraka | Medium (wrong AK in Self) | `TODOS.md:1220` | Read `PointRow.planet` |
| F14 | `src/reading/area/houseLayers.ts:545-546` | Good/bad tara by regex list | Medium | `TODOS.md:1686` | Engine adds `tara.good: boolean` (one shared tara table, see C5) |
| F15 | `src/reading/self/service.ts:748-751`; `src/reading/self/purview.ts:233` | "Sensitive passage" rule (Ketu, or Saturn owning 8 and 12) | Medium | `TODOS.md:1686, 1821` | Engine exports a `sensitive` flag per running period |
| F16 | `src/reading/luckyTimes/scenarios.ts:34-52, 117-130, 173+` | Tithi groups (nanda…), star groups (fixed…), Amrita Siddhi weekday+star table, per-scenario favoured/avoided weekdays and horas | Medium | `TODOS.md:907, 937` (partly) | Muhurta day rows carry `tithi.group`, `nakshatra.group`, `amrita_siddhi`; scenario verdicts from the engine or lists in `env.ts` |
| F17 | `src/reading/codeReaders/rules.ts:53-54, 64-71` | `SAV_HIGH = 28`, `SAV_LOW = 22`, fixed signifiers (spouse: 7th, D9, Venus) | Medium | new | Thresholds to `env.ts`; signifiers from an engine `karaka.natural` table or a reviewed `env.ts` table |
| F18 | `src/reading/timeline/markers.ts:45-55`; `src/reading/life/areas.ts:34+`; `src/reading/area/love.ts:24-31` | Per-area houses, adverse houses, karakas, chara karakas, arudhas, vargas | Medium | partly (`TODOS.md:66`) | Move to `env.ts` / reviewed config (AGENTS.md rule) |
| F19 | `src/reading/timeline/activate/narayana.ts:41-47` | When a Narayana sign period activates an area (house from AL, sign compare) | Medium | new | Narayana rows carry `houses_activated` and `points_in_sign` |
| F20 | `src/reading/timeline/signification.ts:38, 80-95`; `src/reading/timeline/activate/graha.ts:28-35` | `isDusthana` and 6/8/12-from-parent scoring | Medium | partly (`TODOS.md:66`) | Engine house `class`; `dashaCharter.fruition.isShadAshtaka68` (already exported) |
| F21 | `src/reading/self/panels/body.ts:220` | `bodyHouseSet = [1,2,3,4,6,8,12]` contradicts `SELF_V2_BODY_HOUSES` default [1,6,8] (`src/reading/self/sub/config.ts:27`) | Medium | new | Use the config helper |
| F22 | `src/reading/research/presets.ts:33-60, 152, 943, 975-979, 1043, 1293-1323` | Synthetic digests built with sign-ring house arithmetic and `RULER_BY_SIGN`; these gate the `>= 95 %` technical verifier | Medium | new | Build presets from real engine exports of synthetic birth data |
| F23 | `src/reading/self/panels/chapters.ts:15-19` | Dasha-system agreement by month distance | Low | `TODOS.md:1687` | Engine exports chapter-boundary agreement, or keep as a written presentation rule |
| F24 | `src/reading/luckyTimes/wiring.ts:49-57` | Functional nature parsed by regex from engine text | Low | new | Engine exports enum `functional: benefic|malefic|neutral` |
| F25 | `src/reading/area/houseLayers.ts:533-540`; `src/reading/life/labels.ts:16-24` | Dignity label → support/test polarity by regex | Low | new | Engine exports dignity `polarity`, or regexes to `env.ts` |

## B. Data and spec contradictions (server)

| # | file:line | What is wrong | Suggested fix |
|---|---|---|---|
| B1 | `src/reading/digest/build.ts:1174-1190`; `src/reading/digest/annualSet.ts:11-14` | Verified: `AnnualRow.yearLord`, `muntha`, `tajakaYogas` are filled only when `kind === 'VP'` and varga D1 (`build.ts:1177`), so a **TP** row never has a year lord, and `dashaAssessment.ts:414` falls back to `'Unknown'` for the TP stance. Also, the annual pull set (`annualSet.ts:11-14`) does not include `annual.tajaka`; it is a catalogue type (`chartData/catalog.ts:246`) that is pulled only if the engine sync marks it served and registration requests it, which was not checked live, so the VP fields may also be empty | Add `annual.tajaka` to `ANNUAL_YEAR_TYPES`; engine adds `year_lord` (weekday lord) on `annual.tithi_pravesha` (doc 80 R1) as a separate field from the Tajika `lord_of_the_year`, and the spec names both |
| B2 | Specs `self/self.annual.md`, `general/general.annual.md`, `love/love.annual.md`, `work/work.annual_family.md` | One name ("year lord / Vaaresha") for two quantities: the TP moment's weekday lord and the Tajika Varshesha | Spec change: two fields, `tp.vara_lord` and `varsha.year_lord`, each with its classical rule |
| B3 | `docs/TODOS.md:19-30` (P0, still open) | `annual.tithi_pravesha_dasha` rows span 108 years, yet `self.activation`, `love.activation` and the five-clock set count the TP year as a clock | Keep the TP clock withheld until the engine fix ships and digests are rebuilt; add a server check "year dasha fits its year" before it votes |
| B4 | `src/techniques/catalog.ts:600` vs `src/reading/digest/build.ts:1337-1347` | `self.promise` / `love.promise` declare `strength.bhava`; specs add vimsopaka and harsha. None of the three is in `DIGEST_NATAL_TYPES`, so no reader sees them. The engine exports all three (`natal_export.py:270, 293, 311`) | Add `strength.bhava`, `strength.vimsopaka`, `strength.harsha` to `DIGEST_NATAL_TYPES` and to planet/house cards; or drop them from the declared charts |
| B5 | `docs/techniques/self/self.character_arc.md` §3, `self/self.affliction.md` §3, `general/general.dasha.md` §3 | "Declared Charts" blocks claim to quote `catalog.ts` but add charts the code does not declare (vimsopaka, sudarshana, bhava bala, D30) | Spec change: quote the code exactly and put Priority #2 additions in a separate, marked list (as `love/` and `work/` do) |
| B6 | `src/techniques/catalog.ts:2433-2495`; M36 `migration.sql:3-5` | All 142 catalogue rows are `built`; `enabled`/`verification_status` never set by the seed, so the shade gate (`shadeResolver.ts:566`) treats every technique as verified | Seed `verification_status` from the catalogue (`calibrating` until a benchmark passes); mark planned specs (`general.jaimini_karakamsha`, `general.sudarshana_chakra`, `love.synastry_koota`) as `planned` rows |
| B7 | `docs/reading-engine/53-kundli-digest-and-technique-contracts.md:164-180` vs `catalog.ts:860-944` | Doc 53 renames analysts and moves them to `findings.v3`; code keeps `general.promise` etc. on `findings.v2` | Either do the rename or mark doc 53 §4.4 as superseded |
| B8 | `src/techniques/contracts.ts:17` | `houses` and `vargas` selectors never match, though doc 53 §4.3 says all selectors match | Spec change in doc 53, or match them |
| B9 | `src/reading/area/career.ts:46-50` | `FAMILIES_NOT_BUILT` still names conditional, annual and karaka families, which are built (`:226-307`) | Rename to `FAMILY_LABELS_WHEN_SILENT` or derive from the vote result |
| B10 | `src/reading/area/career.ts:40-45` vs doc 43 §8.1 | Doc 43's rasi family is Narayana with Chara and Sudasa confirmers; code's S4 family is Narayana only | Add Chara and Sudasa as S4 confirmers, or change doc 43 |
| B11 | `src/reading/digest/annualSet.ts:15-20` | `DIGEST_ANNUAL_MAX_CALLS` 40 per run vs ±10 years × (2 charts × 3 vargas + 4 tables) ≈ 210 calls; the far years fill over several runs and readers may see gaps | State the expected fill time in doc 55/56 or raise the cap per run behind the disk guard |
| B12 | `docs/techniques/README.md:57`; `03-self-board-illustrations.md:411-1631` | "69 techniques" vs 142 rows; page numbers "10 of 10", "11 of 12", "13 of 25", "26 of 55" | Regenerate the index from `TECHNIQUES` (as `scripts/write-techniques-doc.ts` does for admin doc 05) |
| B13 | `docs/reading-engine/72-now-card-on-every-board.md` §1 | Says the engine counts transit `natal_house` from the D1 lagna in every varga; engine @ `b902bea` counts from the same-varga natal lagna (`transit_export.py:286`, 03 §7) | Update doc 72 §1 after confirming on staging |
| B14 | memory note "Engine release path … dasha exports 2 levels deep"; doc 67 §1 | Engine `dasha.*` default is 4 levels, up to 6; server asks for 3 lifelong (`chartData/catalog.ts:123`) | Update memory and doc 67 "Start" |
| B15 | `docs/reading-engine/46-house-state-engine-and-research-page.md` §B.4 polarity table | "functional malefic (Sa, Ma, Ra, Ke, and the lagna's malefics)" mixes natural and functional malefics | Spec change: functional nature only from the engine's `benefic_malefic` per lagna |
| B16 | `docs/reading-engine/78-love-work-dashboard-separation-and-cards.md` §3 | Uses D7 as the romance chart; classically D7 (saptamsa) is progeny | Check against `natal-techniques/` research; route romance to 5th house + D9 unless a source supports D7 |
| B17 | doc 11 §2, `codeReaders/rules.ts:53-54`, doc 76 §0.1, love specs (harsha `>= 15`) | Thresholds without a classical citation (SAV 28/22, harsha 15, ±1.0..1.5 adjustments) | Each threshold gets a source and an `env.ts` setting |
| B18 | Specs `general.nakshatra`, `self.nakshatra`; engine `avasthas.lunar_astro` | "Pending karma houses" and Lunar-Astro points are presented beside BPHS/Jaimini without a school label | Label the school in the spec and in evidence ids |

## C. Engine gaps and bugs that affect the specs (from 03 §12, engine @ `b902bea`)

| # | file:line (engine) | What is wrong | Suggested engine addition |
|---|---|---|---|
| C1 | `src/jhora/dasha_export.py:600-602, 190` | Dashas are called with `(dob, tob, place)` only: no varga, no Chara method (PVN Rao only), no gender, tribhagi or seed. No Narayana on D10/D9, which Jaimini career and marriage readings use | `varga` and per-system `options` params |
| C2 | `dasha_export.py:479, 547` | Levels 3-6 are an engine proportional split; exact for Vimshottari, unverified for rasi dashas (classical antardasha order differs by system) | Per-system reference tests, or library-native sub-levels |
| C3 | `annual_export.py:808` | Annual saham day/night decided from the birth time, not the annual chart | Pass `ret_jd` |
| C4 | `annual_export.py:531-532` | Gairi Kamboola and Khallasara Tajaka yogas hard-coded empty | Call the library functions |
| C5 | `reading_tables_export.py:54` vs `pressure_inventory_export.py:115`; `facts_export.py:66` vs `daily_export.py:61` | Two gochara tables disagree; no vedha; two tara name sets | One gochara table (Phaladeepika ch. 26) with vedha pairs; one tara constant |
| C6 | `api.py:214-225, 659-660`; `export.py:1054` | Batch default uses the 2-level legacy dashas; batch `bhava` always errors | Point the batch at `dasha.*`; route through `run_natal` |
| C7 | `api.py:97` | Ayanamsa not enforced outside `facts`, `transits`, `pressure_inventory` | Reject non-LAHIRI or thread the mode through |
| C8 | `export.py:810, 845, 867` | Missing bodies default to Aries 0° and get a computed nakshatra | Null rows for missing bodies |
| C9 | `export.py:1112-1114, 1196-1198, 975-977` | Errors return empty `periods: []` or `[]` that look valid | Raise so the API answers 500 |
| C10 | 03 §11 | Not exported though pyjhora has it: Sudarshana Chakra, Varsha Narayana, Tajaka monthly chart, KP-249 / 108 prashna lagnas, Ashtakoota matching, Rudra/Maheshwara/Jaimini longevity, Brahma dasha (negative durations), Kalachakra beyond L1, bhava drishti bala, choghadiya / event muhurta | Types `annual.sudarshana`, `annual.varsha_narayana`, `annual.maasa`, `compatibility`, prashna `method`; specs `general.sudarshana_chakra`, `love.synastry_koota` depend on them |

## D. Missing pieces the classical research should test against

- **Vedha** (gochara obstruction) is specified in five specs and computed nowhere (engine or server).
- **Murti nirnaya**, **kakshya** gating and **transit ashtakavarga** are specified; transit AV exists in the engine
  (`daily_export.py:704`) but is not in any digest section.
- **Karakamsha / Swamsha** lagna has no engine field; `general.jaimini_karakamsha` cannot be built without it.
- **Divisional dashas** (Narayana of D9/D10) are named in doc 43 and Jaimini practice; the engine serves D1 only (C1).
- **Exact transit contacts** stop at the end of 2026 in stored data (`docs/TODOS.md:240`).
- **Live state unchecked:** the `technique_registry` and `chart_data_types` tables on Render were not queried; whether
  staff changed any `enabled`/`verification_status`/`served` flag is unknown.
