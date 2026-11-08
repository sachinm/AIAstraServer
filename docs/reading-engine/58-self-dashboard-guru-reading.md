# 58 — The You dashboard as a reading of the self: one technique per panel, built from shared pieces, stored by validity window

Status: **plan and build, 2026-11-07.** Branch `feat/self-dashboard-guru-reading` in `AIAstra_Server` and `AIAstra_WEB`,
cut from `develop`. Written from Sachin's brief of 2026-11-07 (the You board reads like a newspaper horoscope), the review
`docs/product/you-board-synthesis-review.md` (which agent and prompt produce the board today), and his two additions the
same day: the dasha chapters are the spine, and each panel of the dashboard is its own technique that can be tested,
timed, tuned and analysed, built from the reusable pieces of doc 56 and stored for as long as its data cannot change.

**Updated the same evening by [doc 59](59-board-panels-as-techniques.md) and [doc 60](60-self-reading-research-grade.md).**
Doc 59 sets the page shape every board follows (a three-sentence diagnosis first, built last from the other panels; the
chapters spine; the part panels; struggle; this year; one question about the diagnosis's central tension) and six cuts
to the Self panels: the paka lagna leaves "Who you are" and the Moon lagna and D9 lagna join it; Jupiter, the 9th and the
12th move to "Your soul's aim"; the 3rd joins "Your mind"; gifts come before knots and a manglik row shows only when it
touches the 1st; the question asks about the tension. All of that is built on this branch. Doc 60 makes the reading
research grade (a per-build dossier, a whole-chart purview check, eight scenario subjects, a code and a model auditor,
one cached bundle per build) and moves the model layer of §4.1 to last; §8 and §9 below carry its order.

Rules that hold everywhere below: the engine is the only source of astrological values (Node selects, joins, counts,
intersects date ranges and picks words from tables; it never derives a sign, lord, aspect, dignity or yoga); the engine's
name is never shown to a person; no paid model call runs before Sachin's yes on key, count and cost; a missing field
drops the line and records a gap, it never substitutes a value.

## 0. Answer first

1. **The You board gets a new first page, "Your reading", made of seven panels.** Who you are (the 1st house), Your
   mind, Your soul's aim, Gifts and knots, What you struggle with, Your chapters (the mahadasha spine), This year. Under
   them sits one confirm question drawn from the strongest claim. The old tone card and tabs stay behind it, unchanged.
2. **Each panel is one catalogued technique** (`self.reading.<panel>`) with a contract that names exactly the digest
   sections, vargas, points and dasha systems it reads, the layout it reads them in, its freshness, its output schema and
   its code path. The admin Techniques and Machinery pages show it like any other row; doc 56's reuse report counts its
   reader pieces with every other technique that reads the same layout.
3. **Shared parts, not copies.** Six slicers in `src/reading/self/slices.ts` turn digest rows into the shape every panel
   needs (a planet's delivery chain, a house frame, a point, the yogas touching a set, the running chain of one clock, the
   mahadasha spine of one clock). Each panel is a small function over slices plus a word table. A fix to a slicer reaches
   every panel that uses it, and the slicers are tested once.
4. **Stored for as long as the data holds.** Each panel runs through `withTechniqueOutput`: natal panels (who you are,
   mind, soul, gifts) are stored with an open window until the digest is rebuilt; the chapters and struggle panels until
   the running sub-period of the reading clock ends; This year until the next year chart. A second open inside the
   window reads the stored output and runs nothing. Every run and every cache hit writes an `agent_runs` row with its
   milliseconds, so each technique is timed separately.
5. **The reading clock is per kundli.** `kundlis.preferred_dasha` holds the system the person or Sachin trusts (Sachin's:
   Dwisaptati Sama, catalogue id `dwisatpathi`). When it is empty the clock is the conditional system the engine says
   applies (`dasha.applicable`), else Vimshottari. Vimshottari, Narayana, Chara, Yogini, the karaka clock and Tithi
   Ashtottari are the confirming clocks (env-configurable).
6. **Chapters are stated only when other clocks confirm them.** Previous, running and next mahadasha with dates, the
   running antardasha as the present sub-range. A chapter's sentence is shown when at least two confirming clocks change
   their own main period within 18 months of the chapter's start; with one it is shown as likely; with none the dates are
   shown and the sentence is withheld, naming the clocks that do not agree.
7. **Plain words first, chart terms one tap down.** Each claim has `text` (no planet, house or dasha words) and `detail`
   (the placements, dignities, periods and evidence keys) behind "Chart details". Natal facts are stated as facts;
   confidence words are used only on timing.
8. **The guru prose is the next layer, not this one.** A Self reader (`R15-self.md`) and a Self Oracle prompt
   (`oracle/self.md`) are written and wired behind `SELF_READING_MODEL=1`, reading only the panel claims and their
   evidence. They do not run until Sachin's yes (§7: about $0.02 per build, one build per kundli per sub-period).
9. **Recommendation:** ship the seven deterministic panels and the per-kundli clock now; turn on the model layer after
   Sachin reads the worked example (§10) and approves the cost.

## 1. Start (facts checked 2026-11-07 on `develop` 12215fc and the shared database)

**What builds the board today.** `GET /api/area/self` → `selfService.getSelfBoard` → `boardService.getAreaBoard` →
`houseLayers.buildBoard` with `SELF` (`src/reading/area/self.ts`: houses 1, 4, 5, 9, 12; karakas L1, Mo, Su, AK; vargas
D1, D9, D20, D24, D12). Agent `area.self_board` is kind `code`: no model, no prompt. Headlines are phrases from
`SELF.words`, chosen by integer votes (`gradePlanet` −4..+4; every period of a planet gets that planet's side whatever
house it activates). The web (`AIAstra_WEB/src/components/AreaBoardView.tsx`, `src/pages/you/YouPage.tsx`) writes the
tone headline ("A clear stretch for a fresh start. Begin before …"), the clock counts ("3 supporting · 2 testing of 6
clocks") and the technique chips; "33 independent timing clocks aligned" is the number of systems merged into one
window. The character arc and personality panels (`selfCharacterAndJoy.ts`) print fixed paragraphs by house and by
Moon/Mercury sign, with silent defaults (Taurus, Virgo, Rohini, Ju, SAV 28).

**Bugs found while checking (filed in TODOS, fixed here where named):**
- `selfCharacterAndJoy.ts:473` reads `akPoint.lord` as the atmakaraka. A karaka point's `lord` is the **dispositor** of
  the karaka's sign. For Sachin it prints "AK=Me (H8)"; the AK is the Sun (27°41' Virgo, highest degree). Fixed in this
  build by adding `planet` to karaka point rows (§4.1) and reading it.
- The main clock is hard-wired to Vimshottari (`isTurn`, `nowMd`, `releaseOf`). Dwisaptati is one "conditional" vote.
- `self.focus` answers only reorder sub-areas; no sentence depends on them.

**What is stored for Sachin's kundli `c584c0a3` (digest `d1.2026-11-06`, status ready):**

| Store | Rows | Notes |
|---|---|---|
| `kundli_digest` | 702: house 144, planet 207, point 325, yoga 23, annual 2, star 1 | house cards for D1 D2 D3 D4 D7 D9 D10 D12 D20 D24 D30 D60; planet cards to D144; points in 12 vargas; annual only TP2026 and VP2026 (D1) |
| `kundli_activation` | 12,586 | 43 systems; level 3 for vimsottari, dwisatpathi, yogini, tithi_ashtottari, kaala, karaka |
| `kundli_data` | 164 | includes `dasha.applicable`: Dwisaptati applies ("Lagna lord in the 7th house"); Shattrimsa and Shodasottari unchecked |
| `kundli_transit_overlays` | 0 | the slow sky is not stored for this kundli |
| `person_facts` | 2 | `wizard.skipped`, `wizard.selfie`; no `self.focus` |

**What the engine does not give the digest yet:** a karakamsa row (the D9 sign of the AK is the karakamsa and is read as
`D9.AK`), yogas in vargas, muntha and year lord, sahams on the Tithi Pravesha chart, the 2nd–10th years of the annual
set for this kundli.

## 2. End goal

Sachin opens You and reads, first, a reading of himself: who he is from the 1st house and its lord, what his mind is
made of, what his soul is after, the gifts and knots of the chart, what he struggles with and until when, and the three
chapters of his life on the clock he trusts, dated, each stated only where other clocks agree, with the sub-chapter he is
in now. Every sentence has its placements one tap down. He can change the clock. He can answer one question that
confirms or rejects the strongest claim; a rejected claim is not shown again. Opening the page a second time the same
day reads stored outputs only and returns in under 150 ms server time. Staff can open each technique in the admin, see
what it reads, how long it took, how often it was reused, and test it alone.

What can no longer go wrong: a default sign printed as the person's; a dispositor shown as the atmakaraka; a chapter
stated that no second clock supports; the same words for every person.

## 3. Deliverable

| Area | Items |
|---|---|
| Migration M39 (additive) | `kundlis.preferred_dasha text null` (`prisma/migrations/20261107120000_kundli_preferred_dasha_m39`) |
| Digest | `PointRow.planet` on chara karaka rows (`src/reading/digest/{types,build}.ts`); no version bump (older rows lack the field and the atma panel records a gap until rebuilt) |
| Server, techniques | `src/reading/self/`: `clock.ts` (reading clock), `words.ts` (house and planet meanings, the only word tables), `slices.ts` (six shared slicers), `panels/{lagna,mind,atma,yogas,struggle,chapters,year,confirm}.ts`, `types.ts`, `service.ts` (runs the panels through `withTechniqueOutput` and `withAgentRun`, shapes by facts), `oracle.ts` (flagged model layer) |
| Server, API | `src/routes/selfReadingRoutes.ts`: `GET /api/self/reading`, `POST /api/self/reading/confirm`, `PUT /api/self/clock`; mounted in `server.ts` behind `AREA_ENABLED=1` |
| Server, config | env helpers in `src/config/env.ts`: `SELF_CONFIRM_SYSTEMS`, `SELF_CHAPTER_BOUNDARY_MONTHS` (18), `SELF_CHAPTER_CONFIRM_MIN` (2), `SELF_READING_MODEL` (off) |
| Catalogue and agents | nine `self.reading.*` rows in `src/techniques/catalog.ts`; agents `self.reading_panel` (code) and `self.reading_oracle` (llm, planned) in `src/agents/registry.ts`; `profile/facts.ts` accepts `self.confirm.<claim>` |
| Prompts | `src/reading/prompts/readers/R15-self.md`, `src/reading/prompts/oracle/self.md` |
| Scripts | `scripts/self-reading.ts --kundli <id>`: runs every panel, prints each technique's ms, cache state and gaps |
| Tests | `tests/unit/reading/self/*.test.ts` (each slicer, each panel, the clock, chapter confirmation, gaps, no-astrology grep, golden on Sachin's stored rows), route tests, catalogue tests |
| Web | `src/lib/selfReadingApi.ts`, `src/pages/you/SelfReading.tsx` (panels, chapters, confirm, clock choice), YouPage gains the "Your reading" tab first; tests |
| Docs | this plan; TODOS entries; `docs/admin/07` regenerated by its script |

## 4. Exactly how it works when done

### 4.1 Backend

**The reading clock** (`clock.ts`, technique `self.reading.clock`). Inputs: `kundlis.preferred_dasha`, the digest-time
`dasha.applicable` verdicts carried on the activation rows (`family = 'conditional'`), the systems present in
`kundli_activation`. Order: the stored preference if that system has rows → the first conditional system present (in
the order of `SELF_CONFIRM_SYSTEMS`' conditional list, default `dwisatpathi, ashtottari, chathuraaseethi_sama,
dwadasottari, panchottari, sataatbika, shastihayani`) → `vimsottari`. Returns `{ system, label, reason:
'preferred'|'applicable'|'default', confirming: string[] }`. The confirming clocks are `SELF_CONFIRM_SYSTEMS` minus the
reading clock, kept only when rows exist (default `vimsottari, narayana, chara, yogini, karaka, tithi_ashtottari`).

**The digest fix.** `pointRows` already places each chara karaka by its planet's card; it now also writes `planet` (the
karaka's own planet code). `D1.AK.planet = 'Su'` for Sachin; `D9.AK.sign` is the karakamsa.

**Shared slicers** (`slices.ts`, pure functions of `DigestView` and `ActivationRow[]`, each returning `null` plus a gap
when a field it needs is absent):

| Slicer | Returns | Reads |
|---|---|---|
| `planetChain(view, p)` | D1 sign, house, degree, dignity, star and star lord, dispositor and its house, conjunctions, aspected-by, functional nature, owned houses, avastha ripeness and effective multiplier; the D9 sign, house, dignity | `planet` D1 and D9 |
| `houseFrame(view, varga, h)` | sign, lord, lord's house and dignity, occupants, graha aspects, SAV, class, cusp star and lord, arudha | `house` |
| `pointOf(view, varga, id)` | sign, house, lord, lord's house, planet | `point` |
| `yogasTouching(view, planets, houses)` | present yoga rows whose planets or houses meet the sets | `yoga` D1 |
| `runningChain(rows, system, asOf)` | the L1, L2, L3 rows of one system covering `asOf` | `kundli_activation` |
| `mdSpine(rows, system, asOf)` | previous, running and next L1 rows, the L2 rows inside the running one, the running and next L2 | `kundli_activation` |

**Panels.** Each is `(input) => SelfPanel`, where `input` is the slices it declares. The words come from `words.ts`
(`HOUSE_SELF` meanings per house, `PLANET_FACULTY` per planet, `DIGNITY_WORDS`, `RIPENESS_WORDS`, `CLOCK_LABEL`). No
other text is generated.

| Panel (technique) | Title | Reads | Says | Certainty |
|---|---|---|---|---|
| `self.reading.lagna` | Who you are | D1 h1 frame; lagna lord chain (D1, D9); occupants and aspects on h1; `D1.AL`; the lagna lord's sign (paka lagna) | where the self is directed (the lagna lord's house), how it is held (dignity, ripeness), who sits on or looks at the self, how the world sees you (AL's house), the birth star of the lagna's lord | fact |
| `self.reading.mind` | Your mind | Moon chain, Mercury chain, Jupiter chain; D1 h4 and h5 frames; yogas touching the Moon | the Moon's house and dignity (feeling), its star lord, who presses on it; Mercury's house (thinking); Jupiter's house (judgement); the 4th (peace) and 5th (intelligence) | fact |
| `self.reading.atma` | Your soul's aim | Sun chain; the AK point and its planet chain; `D9.AK` (karakamsa) and the D9 planets in that sign; D9 h1 frame | what the soul is learning (the AK planet's faculty and house), the karakamsa house from the D9 lagna, the Sun's house | fact; withheld with a gap when `planet` is missing |
| `self.reading.yogas` | Gifts and knots | yoga rows touching L1, Moon, Sun, AK or houses 1, 4, 5, 9 | each tied yoga as a gift (raja, dhana, viparita, cancellation) or a knot (dosha, affliction), naming the faculty it touches | fact |
| `self.reading.struggle` | What you struggle with | lagna lord, Moon, Sun and AK chains; h1, h4, h5 frames; the reading clock's running chain | each affliction (lord in 6/8/12, debilitated without a cancellation row, a dead or unripe avastha, Saturn/Rahu/Ketu on the self or the Moon) and, when the afflicting planet is a running lord of the reading clock, the date its period ends | fact; release date only from a stored period |
| `self.reading.chapters` | Your chapters | `mdSpine` of the reading clock; each lord's chain; the running MD lord's `dashaCharter.fruition[AD]`; every confirming clock's L1 rows | previous, running, next chapter with dates and the houses the lord activates; the running sub-chapter; per chapter, which clocks confirm the shift | confirmed / likely / split (sentence withheld on split) |
| `self.reading.year` | This year | the current TP row (D1): lagna, h1 frame, the house holding the natal lagna lord, the TP year-dasha lord running; the VP Mudda lord running | what this year's chart puts on the self | fact (year chart); withheld when no TP row covers today |
| `self.reading.confirm` | One question | the claims above | one question for the strongest claim; answer stored as `self.confirm.<claimId>` | — |

**Chapter confirmation rule** (code, over dates only). For a chapter starting at `S`, a confirming clock *agrees on the
shift* when one of its level-1 periods starts within `SELF_CHAPTER_BOUNDARY_MONTHS` (default 18) of `S`. *Confirmed*: at
least `SELF_CHAPTER_CONFIRM_MIN` (2) clocks agree; *likely*: 1; *split*: 0. The chapter always shows its dates (the
clock's fact). Its sentence is shown on confirmed and likely; on split the sentence is replaced by "Your other clocks do
not mark a turn here" and the disagreeing clocks are listed in the detail. The next chapter is evaluated the same way.

**Gaps.** Every slicer that misses a field returns a gap string (`D1.Mo.star missing`). The panel drops the claim that
needed it; a panel with no claims is `withheld`. Gaps are returned on the response for staff and logged in the run's
output summary; they are never shown to the person.

**Service** (`service.ts`). `getSelfReading(deps, userId)`: kundli → digest (`preparing` when not ready, the digest
queued as the board does) → clock (`kundlis.preferred_dasha` + activation systems) → activation rows for the clock and
the confirming clocks (`activationFor`, levels 1–2, birth to +40 years, 1 query) → each panel through
`withTechniqueOutput(prisma, { technique, kundliId, digestVersion, context: { now, runningPeriod, year } , agentId:
'self.reading_panel' }, () => withAgentRun(...))` in parallel. The clock id is part of the panel input, so it is in the
technique's context hash: a clock change makes new keys (§4.2 `PUT /api/self/clock` also deletes the kundli's
`self.reading.*` outputs). Then `shape(facts)`: a claim the person answered `no` to is marked `withheld` with "You told us
this did not fit"; the confirm question skips answered claims. Concurrency: panels run with `Promise.all`; each panel is
pure CPU under 5 ms on stored rows; the request reads the digest (memoised 60 s by `loadDigest`) and one activation
query. Timeouts: the route aborts at 10 s with 503 `reading_slow`. Failures: a panel that throws is returned as
`{ status: 'failed' }` and logged; the others still render.

**Validity windows** (doc 56 freshness from each contract): lagna, mind, atma, yogas → natal (open until digest
version or contract changes); struggle and chapters → dasha (the reading clock's running L2 span, passed as
`runningPeriod`); year → annual (`runningYearSpan`); confirm → computed at read (not stored). Cache key also carries the
contract hash, so editing a panel's contract invalidates only that panel.

**Model layer** (`oracle.ts`, technique `self.reading.oracle`, agent `self.reading_oracle`, off unless
`SELF_READING_MODEL=1`). Input: the panel claims with their evidence keys and certainty, the facts the person confirmed,
the clock label. Reader `R15-self.md` (role `reader`) turns the claims into findings; Oracle `oracle/self.md` (role
`oracle`) writes the reading in the order: diagnosis in three sentences, the three chapters, what was promised and what
was taken, what you have built, the mind, the struggle, this year, one question. The validator drops any sentence whose
evidence keys are not in the input. Stored with the chapters panel's window. Not called in this build.

### 4.2 API

| Endpoint | Request | Response | Errors |
|---|---|---|---|
| `GET /api/self/reading` | — | `200 { status: 'ok', built_at, cached, reading: SelfReading }` | `404 { status: 'no_kundli' }`, `202 { status: 'preparing' }`, `401`, `500 { error: 'self_reading_failed' }`, `503 { error: 'reading_slow' }` |
| `POST /api/self/reading/confirm` | `{ claimId: string, answer: 'yes'\|'partly'\|'no'\|'skip' }` | `204` | `400 bad_answer`, `401` |
| `PUT /api/self/clock` | `{ system: string \| null }` (null clears) | `200 { clock }` | `400 unknown_system` (no rows for it), `401`, `404 no_kundli` |

```ts
interface SelfReading {
  asOf: string;                      // YYYY-MM-DD
  digestVersion: string;
  clock: { system: string; label: string; reason: 'preferred' | 'applicable' | 'default'; confirming: Array<{ system: string; label: string }>; choices: Array<{ system: string; label: string }> };
  panels: SelfPanel[];               // in display order
  question: { claimId: string; panel: string; text: string; options: Array<{ value: 'yes' | 'partly' | 'no' | 'skip'; label: string }> } | null;
  gaps: string[];                    // staff only; the web never renders these
}
interface SelfPanel {
  id: 'lagna' | 'mind' | 'atma' | 'yogas' | 'struggle' | 'chapters' | 'year';
  technique: string;                 // self.reading.<id>
  title: string;
  lead: string;                      // one plain sentence
  status: 'ok' | 'partial' | 'withheld' | 'failed';
  claims: SelfClaim[];
  chapters?: SelfChapter[];          // chapters panel only
  cached: boolean;
  ms: number;                        // time to make it (0 on a cache hit)
}
interface SelfClaim {
  id: string;                        // stable per kundli: '<panel>.<rule>' e.g. 'lagna.lord_house'
  text: string;                      // plain words, no chart terms
  detail: string;                    // chart terms, shown under "Chart details"
  certainty: 'fact' | 'confirmed' | 'likely' | 'split';
  evidence: string[];                // digest keys and activation rows, e.g. 'planet:D1.Ju', 'activation:dwisatpathi/1/Ra'
  withheld?: string;                 // reason, when the person said it did not fit
}
interface SelfChapter {
  kind: 'previous' | 'running' | 'next';
  lord: string; lordLabel: string;   // 'Ra', 'Rahu'
  from: string; to: string;
  text: string | null;               // null on split
  detail: string;
  certainty: 'confirmed' | 'likely' | 'split';
  houses: number[];
  sub?: { lord: string; lordLabel: string; from: string; to: string; text: string; detail: string; houses: number[] };   // running only: the sub-chapter now
  nextSub?: { lord: string; lordLabel: string; from: string; to: string; houses: number[] };
  confirmations: Array<{ system: string; label: string; agrees: boolean; boundary: string | null }>;
  evidence: string[];
}
```

### 4.3 Frontend experience

The You page gains a first tab, **Your reading**, selected by default; the existing tabs (Now, What holds you up, What
presses, Ahead, Looking back, Your questions) follow unchanged. On a phone the seven panels are a swipe carousel with
chips and dots; on a desktop a vertical tab list on the left and the panel on the right (doc 45 rule 11).

| State | Shows |
|---|---|
| Loading | Skeleton of the panel list, "Reading your chart…" |
| Preparing (202) | "Your chart is still being prepared. This page will update by itself." Polls every 30 s, 10 times |
| Ready | The clock line ("Read on your Dwisaptati clock · Change"), the panel chips, the selected panel: title, lead, claims as short paragraphs; "Chart details" toggle reveals each claim's detail and the technique id |
| Chapters panel | Three cards on a line from the previous to the next chapter; the running card is larger and holds the sub-chapter with its dates; each card shows "Confirmed by Vimshottari and Chara" or, on split, "Your other clocks do not mark a turn here" |
| Question | A card under the panels: the question, Yes / Partly / No / Skip; after the answer "Thanks, noted." |
| Withheld claim | "You told us this did not fit." in place of the text, detail still under Chart details |
| Failed panel | "This part could not be read just now." |
| Clock change | A sheet listing the clocks with rows for this chart; choosing one reloads the reading |

### 4.4 UI words

Titles: Who you are · Your mind · Your soul's aim · Gifts and knots · What you struggle with · Your chapters · This
year. Certainty words (timing only): "Confirmed by …", "Likely", "Your other clocks do not mark a turn here". No planet, house,
dasha, nakshatra or varga word outside Chart details; the web test scans every panel's visible text for the banned list
of doc 45 §3.3.

## 5. Architecture

```
kundli_data ─digest.build─► kundli_digest (house · planet · point(+planet) · yoga · annual · star)
                         └► kundli_activation (43 systems)            kundlis.preferred_dasha
                                     │                                         │
                    GET /api/self/reading ─► service.getSelfReading ─► clock.ts (reading + confirming clocks)
                                     │
            slices.ts: planetChain · houseFrame · pointOf · yogasTouching · runningChain · mdSpine   (shared pieces)
                                     │
   panels/lagna · mind · atma · yogas · struggle · chapters · year   each in withTechniqueOutput ─► technique_outputs
                                     │                                  and withAgentRun ─► agent_runs (ms, cached)
                       shape(person_facts self.confirm.*) ─► confirm.ts ─► response
                                     │
               (flag) oracle.ts: R15-self reader ─► oracle/self.md ─► validator ─► stored with the chapters window
```

Boundaries: the engine computes; the digest stores with provenance; slicers select; panels pick words from tables;
the model layer may only rephrase claims it is given.

## 6. Ingredients

| Need | Who |
|---|---|
| Migration M39 applied on the shared database | agent (standing OK for additive migrations) |
| Sachin's `preferred_dasha = 'dwisatpathi'` | agent writes it for `c584c0a3` (his stated preference, 2026-11-07) |
| Digest rebuild of `c584c0a3` (adds `planet` on karaka points; no engine call) | agent, local `buildDigest` without fetch |
| Env defaults | code; deploy session sets nothing unless tuning |
| Gemini key, model and count for the model layer | Sachin (§7) |
| Astrologer review of `words.ts` and the confirm question table | Sachin |
| Deploy of both branches | the deploy sub-session after merge |

## 7. Cost of the model layer (for Sachin's yes; nothing runs before it)

Per build: one reader call (role `reader` → `READING_MODEL_SPECIALIST` = gemini-3.1-flash-lite: about 6k tokens in,
1.5k out → $0.0015 + $0.0023) and one Oracle call (role `oracle` → `READING_MODEL_SYNTH` = gemini-3.8-flash: about 8k
in, 2k out → $0.006 + $0.0075). About **$0.017 per build**; from 2027-01-01 gemini-3.8-flash doubles, about $0.031. A
build happens once per kundli per running sub-period of the reading clock (Sachin's next one is 2027-01-01) or when the
digest is rebuilt. For the 24 research kundlis: about $0.41 once.

## 7a. The techniques, as catalogue rows

| id | Inputs (section · filter · layout) | Freshness | Output |
|---|---|---|---|
| `self.reading.clock` | activation · systems present and conditional rows · activation_row | dasha | `self_clock.v1` |
| `self.reading.lagna` | house · D1 h1 · house_card; planet · D1, D9 lagna lord · planet_card; point · AL · point_row | natal | `self_panel.v1` |
| `self.reading.mind` | planet · D1, D9 Mo, Me, Ju · planet_card; house · D1 h4, h5 · house_card; yoga · touching Mo · yoga_row; star · Moon star · star_profile | natal | `self_panel.v1` |
| `self.reading.atma` | planet · D1, D9 Su and the AK planet · planet_card; point · D1, D9 AK · point_row; house · D9 h1 · house_card | natal | `self_panel.v1` |
| `self.reading.yogas` | yoga · touching L1, Mo, Su, AK, houses 1, 4, 5, 9 · yoga_row | natal | `self_panel.v1` |
| `self.reading.struggle` | planet · D1 L1, Mo, Su, AK · planet_card; house · D1 h1, h4, h5 · house_card; activation · reading clock L1–L3 running · activation_row | dasha | `self_panel.v1` |
| `self.reading.chapters` | activation · reading clock L1–L2 and confirming clocks L1, birth to +40 years · activation_row; planet · D1 chapter lords · planet_card | dasha | `self_panel.v1` |
| `self.reading.year` | annual · current TP and VP, D1 · annual_row | annual | `self_panel.v1` |
| `self.reading.oracle` (planned) | findings · the seven panels · findings | dasha | `self_reading.v1` |

The confirm question is a read-time step of the service, not a stored technique.

## 8. Action steps in sequence

1. This plan, the contract (§4.2) → web starts on it in parallel (step 9).
2. M39 migration + Prisma field; `preferred_dasha` written for `c584c0a3`.
3. Digest: `PointRow.planet`; rebuild `c584c0a3`.
4. `words.ts`, `slices.ts`, `clock.ts` with tests.
5. The seven panels and the confirm step, with tests and the golden on Sachin's rows.
6. `service.ts`, routes, server mount, catalogue rows, agents, facts key; route and catalogue tests.
7. `R15-self.md`, `oracle/self.md`, `oracle.ts` behind the flag, tested with a fake model.
8. `scripts/self-reading.ts`; run on `c584c0a3`; paste the output into §10; regenerate docs/admin/07.
9. Web (parallel from step 1): api client, `SelfReading` panels, chapters, confirm, clock sheet, tab, tests.
10. `tsc --noEmit` and the unit tests in both repos; commit both branches; TODOS; hand-over note.

### 8.1 After docs 59 and 60 (2026-11-07 evening): the order from here

Steps 1–6 and 8–10 above are built on this branch, with doc 59's page shape and cuts. Step 7 (the model layer) is
written and stays off. Doc 60 §10 sets the order from here; every step is code first and costs nothing until step 15:

11. **Reading dossier** (doc 60 §4): a `reading_dossiers` row per kundli per build holding the techniques with their
    contract hashes and `SELF_READING_VERSION`, every digest and activation row each panel read with its value, the
    present yogas, the clock and its confirmations, the claims, the gaps; an admin "Reading dossier" page. The panel
    evidence keys already name every row; the dossier stores their values.
12. **Purview** (`board.purview`, doc 60 §5): the whole-chart check run before the claims are shown: lagna lord's
    standing caps footing claims, cancellations override weaknesses, combustion and retrograde, functional nature by
    lagna, vargottama, gandanta, dasha applicability, MD–AD 6/8 and 2/12, sade sati and the nodes when the sky is stored,
    yoga completeness, the age of the period. It writes overrides and vetoes that the panels and the diagnosis obey.
13. **Eight scenarios S1–S8** (doc 60 §3) as research-staging subjects with must-say and must-not-say lists; S1 is this
    kundli. The code auditor (doc 60 §6, extending `research.technical_verifier`) must pass all eight in staging: every
    sentence maps to claim ids and rows, dates equal stored boundaries, banned words absent.
14. **One bundle per build** (doc 60 §7): the slices, purview and claims written once as `board.bundle` in
    `technique_outputs`, so a request reads one stored row; rebuild only on digest, dasha boundary, annual, confirm or
    manual triggers.
15. **The auditor's model half, then the Oracle prose** (doc 60 §6, §8): only after Sachin's yes on key, model, count
    and cost (§7 here for the Oracle; doc 60 for the auditor).
16. **Love and Work boards** on the same shared code (doc 59 §3, §4): the 16 rows are registered as planned in the
    catalogue now; `board.chapters`, `board.struggle` and `board.year` gain a house and planet filter when the first of
    them is built.

The day-to-day layer (pratyantardasha, sookshma, hora, the Moon's transit and tara, a "Right now" strip; doc 60 §11)
comes after all of these.

## 9. Development phases

| Phase | Steps | Leaves | Check |
|---|---|---|---|
| A Clock and pieces | 2–4 | the reading clock and slicers, tested | slicer tests; Sachin's clock is Dwisaptati with reason `preferred` |
| B Panels | 5–6, 8 | `GET /api/self/reading` live behind `AREA_ENABLED`; each panel timed and stored | golden test; second call all `cached: true`; script prints per-technique ms |
| C Web | 9 | "Your reading" tab | web tests; banned-word scan over every panel |
| D Dossier and purview | 11, 12 | every build documented; whole-chart overrides | a dossier for `c584c0a3` that reproduces every claim from stored rows |
| E Scenarios and code auditor | 13, 14 | eight subjects passing in staging; one stored bundle per build | auditor pass on S1–S8; a request with zero live chart reads |
| F Model layer | 7, 15, then Sachin's yes | the auditor's model half, then the Oracle prose over the claims | validator and auditor tests; one paid run on `c584c0a3` after the yes |
| G Love and Work | 16 | the other two boards on the same shared code | the same golden and scenario checks per board |

## 10. Worked example: Sachin, kundli c584c0a3, as of 2026-11-07

Filled from the output of `scripts/self-reading.ts --kundli c584c0a3-841b-451b-a2ed-f5709c5fb31d` after step 8 (see
§10.1). The facts it reads, from the stored rows:

| Fact | Row |
|---|---|
| Lagna Pisces, cusp star Uttara Bhadrapada (lord Sa); no occupants; graha aspects from Su, Ju, Sa; SAV 27 | `house:D1.h1` |
| Lagna lord Ju in h7 Virgo, friend's sign, 3°48', mrita (effective 0.05, "dried seed"), with Su and Sa; star Uttara Phalguni (lord Su) | `planet:D1.Ju` |
| AL (A1) Sagittarius, h10 | `point:D1.AL` |
| Moon in h9 Scorpio, debilitated, Jyeshtha (lord Me), with Ma (own sign); aspected by Sa; Neecha Bhanga row on Mo, Ma; Ganda Moola dosha on Mo | `planet:D1.Mo`, `yoga:D1.facts_neecha_bhanga`, `yoga:D1.ganda_moola` |
| Mercury in h8 Libra, friend; owns 4 and 7 | `planet:D1.Me` |
| h4 Gemini, lord Me in h8 (dusthana), SAV 35; h5 Cancer, lord Mo in h9, Rahu in h5, SAV 36 | `house:D1.h4`, `house:D1.h5` |
| AK = Sun (27°41' Virgo, h7, Chitra, lord Ma), shadbala rank 2; D9 AK in Virgo, h2 from the D9 Leo lagna (karakamsa Virgo) | `point:D1.AK`, `point:D9.AK`, `planet:D1.Su` |
| Yogas: Dhana (lords 2 and 5: Ma, Mo), Dhana (lords 11 and 1: Sa, Ju), Viparita Raja (8th lord Ve in 6), Neecha Bhanga (Mo, Ma); doshas Kala Sarpa (Ra–Ke on 5–11), Ganda Moola | `yoga:*` |
| Reading clock Dwisaptati (applies: lagna lord in the 7th). MDs: Sa 2010-02-15 → 2019-02-16 (houses 1, 4, 7, 9, 11, 12); **Ra 2019-02-16 → 2028-02-16 (5, 11)**; Su 2028-02-16 → 2037-02-15 (1, 6, 7). Running AD Ve 2025-11-16 → 2027-01-01 (3, 6, 8, 12); next AD Sa 2027-01-01 → 2028-02-16 | `activation:dwisatpathi` |
| Confirming L1 boundaries near 2019-02: Vimshottari Mo 2018-03-16, Chara Virgo 2018-10-15, Yogini Sa 2018-02-01. Near 2028-02: Vimshottari Ma 2028-03-16, Narayana Aries 2027-10-15 | `activation:vimsottari/narayana/chara/yogini` |
| This year's Tithi Pravesha chart: Cancer lagna, natal lagna lord Ju exalted in the year's 1st with Ma | `annual:TP2026.D1` |

### 10.1 The panel text the build produces

Measured with `npx tsx scripts/self-reading.ts --kundli c584c0a3-… --times 2` on 2026-11-07, from this machine to the shared Render database. The first open makes every panel; the second reads all seven from `technique_outputs`:

| Technique | First open (made) | Second open |
|---|---|---|
| `self.reading.diagnosis` (3 claims) | 0.49 ms | stored |
| `self.reading.chapters` (4 claims) | 3.57 ms | stored |
| `self.reading.lagna` (8 claims) | 1.15 ms | stored |
| `self.reading.mind` (7 claims) | 1.82 ms | stored |
| `self.reading.atma` (6 claims) | 1.08 ms | stored |
| `self.reading.yogas` (4 claims) | 1.06 ms | stored |
| `self.reading.struggle` (6 claims) | 1.23 ms | stored |
| `self.reading.year` (4 claims) | 0.66 ms | stored |

Wall time was 5.3 s for the first open and 2.2 s for the second (the measured run after the doc 59 cuts). Almost all of it is round trips from this machine to the remote database (one activation read, seven store reads, seven run rows); the panel code itself took about 260 ms in total on the first open (module warm-up included; a warm second build measured 160 ms). On the Lambda, next to the database, the second open should meet the 150 ms server-time goal of §2; that is to be measured after deploy.

The panel text exactly as the build produced it after the doc 59 cuts (`[certainty]` text, then the Chart details line and
the evidence keys), in display order:

```text
## Who you are, in short (self.reading.diagnosis)
Your sense of self is lived through partnership. Where it sits it is comfortable, and by its state it spends itself mostly on the people around you.
- [fact] Your sense of self is lived through partnership. Where it sits it is comfortable, and by its state it spends itself mostly on the people around you.
    details: Lagna Pisces; lagna lord Jupiter: Jupiter D1 h7 Virgo 3.81°; dignity friend; star Uthiram (lord Sun); dispositor Mercury h8; with Sun, Saturn; delivery dried_seed_externalized ×0.05; D9 Aquarius h7 neutral | Jupiter avasthas {"baladi":"mrita","deeptadi":"shanta","jagradadi":"swapna","lajjitadi":"kshudhita,kshobhita","shayanadi":"agama"}
    evidence: claim:lagna.lord_house, claim:lagna.lord_state
- [fact] The tension in it: what carries your hunger for the new and the unconventional lives in your ideas and learning and makes them restless. This presses hardest until 16 Feb 2028, when your current chapter ends.
    details: Rahu occupies D1 h5 Cancer; natural and functional malefic; running Dwisaptati Sama level 1 Rahu 2019-02-16 → 2028-02-16
    evidence: claim:struggle.ideas_Ra
- [confirmed] You are in a chapter of ideas and learning and gains and networks that runs to 16 Feb 2028; since 16 Nov 2025, what presses is your own effort, service and struggle, change and the hidden and letting go and faraway places.
    details: Dwisaptati Sama level 1 Rahu 2019-02-16 → 2028-02-16; activates houses 5, 11; Rahu D1 h5 Cancer 23.09°; dignity enemy; star Aayilyam (lord Mercury); dispositor Moon h9; aspected by Ketu; delivery half_ripe ×0.125; confirming: Vimshottari main period from 2018-03-16 ✓; Narayana main period from 2016-10-14 ✗; Chara main period from 2018-10-15 ✓; Yogini main period from 2018-02-01 ✓; Chara Karaka main period from 2020-10-14 ✗; Tithi Ashtottari main period from 2021-01-16 ✗
    evidence: claim:chapters.running, claim:chapters.sub

## Your chapters (self.reading.chapters)
You are in the chapter of ideas and learning and gains and networks, until 16 Feb 2028.
- [likely] From 15 Feb 2010 to 16 Feb 2019 you were shaped by yourself, home and peace of mind, partnership, belief and fortune, gains and networks and letting go and faraway places. It is carried by your discipline, duty and endurance, placed in partnership.
    details: Dwisaptati Sama level 1 Saturn 2010-02-15 → 2019-02-16; activates houses 1, 4, 7, 9, 11, 12; Saturn D1 h7 Virgo 9.25°; dignity friend; star Uthiram (lord Sun); dispositor Mercury h8; with Sun, Jupiter; delivery over_ripe_delayed ×0.175; confirming: Vimshottari main period from 2012-03-16 ✗; Narayana main period from 2012-10-14 ✗; Chara main period from 2007-10-15 ✗; Yogini main period from 2009-02-01 ✓; Chara Karaka main period from 2012-10-14 ✗; Tithi Ashtottari main period from 2015-01-17 ✗
    evidence: activation:dwisatpathi/1/Sa@2010-02-15, planet:D1.Sa
- [confirmed] From 16 Feb 2019 to 16 Feb 2028 your life is organised around ideas and learning and gains and networks. It is carried by your hunger for the new and the unconventional, placed in ideas and learning.
    details: Dwisaptati Sama level 1 Rahu 2019-02-16 → 2028-02-16; activates houses 5, 11; Rahu D1 h5 Cancer 23.09°; dignity enemy; star Aayilyam (lord Mercury); dispositor Moon h9; aspected by Ketu; delivery half_ripe ×0.125; confirming: Vimshottari main period from 2018-03-16 ✓; Narayana main period from 2016-10-14 ✗; Chara main period from 2018-10-15 ✓; Yogini main period from 2018-02-01 ✓; Chara Karaka main period from 2020-10-14 ✗; Tithi Ashtottari main period from 2021-01-16 ✗
    evidence: activation:dwisatpathi/1/Ra@2019-02-16, planet:D1.Ra, activation:dwisatpathi/2/Ve@2025-11-16
- [confirmed] Since 16 Nov 2025 and until 1 Jan 2027, what presses now is your own effort, service and struggle, change and the hidden and letting go and faraway places. In this chapter it brings gains, though what comes in also goes out.
    details: Dwisaptati Sama level 2 Venus 2025-11-16 → 2027-01-01; activates houses 3, 6, 8, 12; fruition from Rahu: 2nd from the main lord, dhana_labha_gain, 2/12
    evidence: activation:dwisatpathi/2/Ve@2025-11-16
- [confirmed] From 16 Feb 2028 you move into a chapter of yourself, service and struggle and partnership. It is carried by your sense of purpose and authority, placed in partnership.
    details: Dwisaptati Sama level 1 Sun 2028-02-16 → 2037-02-15; activates houses 1, 6, 7; Sun D1 h7 Virgo 27.69°; dignity neutral; star Chithirai (lord Mars); dispositor Mercury h8; with Jupiter, Saturn; delivery unripe_sour ×0.125; confirming: Vimshottari main period from 2028-03-16 ✓; Narayana main period from 2027-10-15 ✓; Chara main period from 2029-10-15 ✗; Yogini main period from 2031-02-01 ✗; Chara Karaka main period from 2024-10-14 ✗; Tithi Ashtottari main period from 2021-01-16 ✗
    evidence: activation:dwisatpathi/1/Su@2028-02-16, planet:D1.Su
  chapter previous Saturn 2010-02-15→2019-02-16 likely: Vimshottari✗(2012-03-16) Narayana✗(2012-10-14) Chara✗(2007-10-15) Yogini✓(2009-02-01) Chara Karaka✗(2012-10-14) Tithi Ashtottari✗(2015-01-17)
  chapter running Rahu 2019-02-16→2028-02-16 confirmed: Vimshottari✓(2018-03-16) Narayana✗(2016-10-14) Chara✓(2018-10-15) Yogini✓(2018-02-01) Chara Karaka✗(2020-10-14) Tithi Ashtottari✗(2021-01-16)
  chapter next Sun 2028-02-16→2037-02-15 confirmed: Vimshottari✓(2028-03-16) Narayana✓(2027-10-15) Chara✗(2029-10-15) Yogini✗(2031-02-01) Chara Karaka✗(2024-10-14) Tithi Ashtottari✗(2021-01-16)

## Who you are (self.reading.lagna)
Your sense of self is lived through partnership.
- [fact] The part of you that steers your life is lived through partners, clients and the people you deal with.
    details: Lagna Pisces; lagna lord Jupiter: Jupiter D1 h7 Virgo 3.81°; dignity friend; star Uthiram (lord Sun); dispositor Mercury h8; with Sun, Saturn; delivery dried_seed_externalized ×0.05; D9 Aquarius h7 neutral
    evidence: house:D1.h1, planet:D1.Ju, planet:D9.Ju
- [fact] Where it sits it is comfortable, and by its state it spends itself mostly on the people around you.
    details: Jupiter avasthas {"baladi":"mrita","deeptadi":"shanta","jagradadi":"swapna","lajjitadi":"kshudhita,kshobhita","shayanadi":"agama"}
    evidence: planet:D1.Ju
- [fact] It shares its place with your sense of purpose and authority and your discipline, duty and endurance, and every choice you make carries them.
    details: Jupiter conjunct Sun, Saturn in Virgo
    evidence: planet:D1.Ju, planet:D1.Su, planet:D1.Sa
- [fact] Nothing sits on your sense of self directly. It is helped by your judgement, wisdom and faith, and pressed by your sense of purpose and authority and your discipline, duty and endurance.
    details: D1 h1 occupants: none; graha drishti from Sun (malefic), Jupiter (benefic), Saturn (malefic); rasi drishti from Sun, Jupiter, Saturn; SAV 27
    evidence: house:D1.h1
- [fact] The star rising at your birth is ruled by your discipline, duty and endurance: it colours how you meet the world.
    details: Lagna cusp star Uttara Bhadrapada pada 1, star lord Saturn
    evidence: house:D1.h1
- [fact] Others see you through your work, your standing and what you are known for.
    details: Arudha lagna (A1) Sagittarius, h10; its lord Jupiter in h7
    evidence: point:D1.AL
- [fact] Read from your feelings rather than your body, your life is steered from gains, friends, networks and elder siblings, with your drive and courage close by.
    details: Moon lagna: D1 h9 Scorpio, its lord Ketu in h11 (friend), co-lord Mars; occupants Moon, Mars
    evidence: planet:D1.Mo, house:D1.h9
- [fact] Your inner self is steered from your family, your speech and what you hold.
    details: D9 lagna Leo, lord Sun in D9 h2 (neutral)
    evidence: house:D9.h1

## Your mind (self.reading.mind)
Your feelings are tied to belief and fortune, your thinking to change and the hidden.
- [fact] Your feelings are tied to belief, teachers, your father and fortune. By birth they run at their most fragile, and a cancellation in your chart lifts this over time.
    details: Moon: Moon D1 h9 Scorpio 26.54°; dignity debilitated; star Kaettai (lord Mercury); dispositor Ketu h11; with Mars; aspected by Saturn; delivery unripe_sour ×0.0625; D9 Aquarius h7 neutral; neecha bhanga row present
    evidence: planet:D1.Mo, planet:D9.Mo
- [fact] They share space with your drive and courage and are watched by your discipline, duty and endurance.
    details: Moon conjunct Mars; aspected by Saturn
    evidence: planet:D1.Mo
- [fact] Your birth star is ruled by your thinking and speech: that is what steadies your mind.
    details: Moon star Kaettai pada 3, star lord Mercury
    evidence: planet:D1.Mo, star:profile
- [fact] Your thinking is drawn to sudden change, shared money and what is hidden, and it is comfortable there.
    details: Mercury: Mercury D1 h8 Libra 22.42°; dignity friend; star Visaakam (lord Jupiter); dispositor Venus h6; delivery over_ripe_delayed ×0.175
    evidence: planet:D1.Me, planet:D9.Me
- [fact] Your courage and effort work through service, daily work, rivals and debts.
    details: D1 h3 Taurus, lord Venus in h6 (enemy); occupants none
    evidence: house:D1.h3
- [fact] Your peace of mind depends on sudden change, shared money and what is hidden. Your chart gives it more support than most of your life.
    details: D1 h4 Gemini, lord Mercury in h8 (friend); SAV 35 (chart mean 28.1)
    evidence: house:D1.h4
- [fact] Your intelligence works through belief, teachers, your father and fortune. Your hunger for the new and the unconventional lives in it.
    details: D1 h5 Cancer, lord Moon in h9 (debilitated); occupants Rahu; SAV 36
    evidence: house:D1.h5

## Your soul's aim (self.reading.atma)
Your soul's lesson runs through your sense of purpose and authority.
- [fact] What your soul is here to learn runs through your sense of purpose and authority, lived in partners, clients and the people you deal with.
    details: Atmakaraka Sun: Sun D1 h7 Virgo 27.69°; dignity neutral; star Chithirai (lord Mars); dispositor Mercury h8; with Jupiter, Saturn; delivery unripe_sour ×0.125; shadbala rank 2
    evidence: point:D1.AK, planet:D1.Su, planet:D9.Su
- [fact] Where it sits it is neither helped nor hindered, and by its state it gives its results early and raw.
    details: Sun avasthas {"baladi":"bala","deeptadi":"shanta","jagradadi":"swapna","lajjitadi":"kshudhita","shayanadi":"upaveshana"}
    evidence: planet:D1.Su
- [fact] In the chart of your inner self it sits in your family, your speech and what you hold, alongside your drive and courage and your pleasures, art and closeness.
    details: Karakamsa Virgo (D9 AK), h2 from the D9 lagna Leo; D9 planets there: Mars, Venus
    evidence: point:D9.AK, planet:D9.Ma, planet:D9.Ve
- [fact] Your judgement and faith work through partners, clients and the people you deal with.
    details: Jupiter: Jupiter D1 h7 Virgo 3.81°; dignity friend; star Uthiram (lord Sun); dispositor Mercury h8; with Sun, Saturn; delivery dried_seed_externalized ×0.05
    evidence: planet:D1.Ju, planet:D9.Ju
- [fact] Your sense of purpose rests on gains, friends, networks and elder siblings.
    details: D1 h9 Scorpio, lord Ketu in h11 (friend); occupants Moon, Mars
    evidence: house:D1.h9
- [fact] Letting go comes to you through partners, clients and the people you deal with.
    details: D1 h12 Aquarius, lord Saturn in h7 (friend); occupants none
    evidence: house:D1.h12

## Gifts and knots (self.reading.yogas)
2 gifts and 2 knots in your chart touch your self.
- [fact] A gift: a combination for wealth, touching your feelings and your mind.
    details: Dhana Yoga (lords of 2 and 5) (dhana); planets Mars, Moon; houses 2, 5, 9; source facts.yogas
    evidence: yoga:D1.facts_dhana_yoga_lords_of_2_and_5
- [fact] A gift: a cancellation that lifts a weakness over time, touching your feelings and your mind.
    details: Neecha Bhanga (cancellation); planets Moon, Mars; houses 9; source facts.yogas
    evidence: yoga:D1.facts_neecha_bhanga
- [fact] A knot: a knot that asks for patience, touching ideas and learning.
    details: Kala Sarpa Dosha (dosha); planets Rahu, Ketu; houses 5, 11; source doshas
    evidence: yoga:D1.kala_sarpa
- [fact] A knot: a knot that asks for patience, touching your feelings and your mind.
    details: Ganda Moola Dosha (dosha); planets Moon; houses 9; source doshas
    evidence: yoga:D1.ganda_moola

## What you struggle with (self.reading.struggle)
6 things in your chart ask more of you than the rest.
- [fact] What carries your hunger for the new and the unconventional lives in your ideas and learning and makes them restless. This presses hardest until 16 Feb 2028, when your current chapter ends.
    details: Rahu occupies D1 h5 Cancer; natural and functional malefic; running Dwisaptati Sama level 1 Rahu 2019-02-16 → 2028-02-16
    evidence: house:D1.h5, planet:D1.Ra, activation:dwisatpathi/1/Ra@2019-02-16
- [fact] What carries your judgement, wisdom and faith spends itself mostly on the people around you.
    details: Jupiter avasthas {"baladi":"mrita","deeptadi":"shanta","jagradadi":"swapna","lajjitadi":"kshudhita,kshobhita","shayanadi":"agama"}; delivery dried_seed_externalized ×0.05
    evidence: planet:D1.Ju
- [fact] What carries your feelings and your mind is at its weakest by birth, and a cancellation in your chart lifts it over time.
    details: Moon D1 h9 Scorpio 26.54°; dignity debilitated; star Kaettai (lord Mercury); dispositor Ketu h11; with Mars; aspected by Saturn; delivery unripe_sour ×0.0625; cancellation row present
    evidence: planet:D1.Mo
- [fact] What carries your feelings and your mind gives its results early and raw.
    details: Moon avasthas {"baladi":"bala","deeptadi":"shanta","jagradadi":"sushupti","lajjitadi":"kshudhita,trishita","shayanadi":"agama"}; delivery unripe_sour ×0.0625
    evidence: planet:D1.Mo
- [fact] What carries your sense of purpose and authority gives its results early and raw.
    details: Sun avasthas {"baladi":"bala","deeptadi":"shanta","jagradadi":"swapna","lajjitadi":"kshudhita","shayanadi":"upaveshana"}; delivery unripe_sour ×0.125
    evidence: planet:D1.Su
- [fact] What carries your sense of purpose and authority weighs on your sense of self.
    details: Sun aspects (graha drishti) D1 h1; natural and functional malefic
    evidence: house:D1.h1, planet:D1.Su

## This year (self.reading.year)
This year your chart puts the part of you that steers in yourself.
- [fact] This year's chart puts the part of you that steers in your body, your presence and your sense of self, at its strongest.
    details: TP2026 lagna Cancer; natal lagna lord Jupiter in year h1 Cancer (exalted)
    evidence: annual:TP2026.D1
- [fact] It shares that place with your drive and courage.
    details: year h1 occupants Mars (debilitated), Jupiter (exalted)
    evidence: annual:TP2026.D1
- [fact] This year your self is steered from your ideas, learning, creativity and children.
    details: TP2026 h1 Cancer, lord Moon in year h5 (debilitated)
    evidence: annual:TP2026.D1
- [fact] Until 24 Dec 2026 the year's short clock runs through your discipline, duty and endurance.
    details: VP2026 Mudda Saturn 2026-10-28 → 2026-12-24
    evidence: annual:VP2026.D1

Question: Does this ring true for you right now? What carries your hunger for the new and the unconventional lives in your ideas and learning and makes them restless. This presses hardest until 16 Feb 2028, when your current chapter ends. (diagnosis.tension)
```

What this shows against Sachin's own record (docs/reading-engine/36, 37): the running chapter (Rahu, 16 Feb 2019 – 16 Feb 2028, ideas and gains) is confirmed by Vimshottari, Chara and Yogini, each turning within 18 months; the sub-chapter (Venus, 16 Nov 2025 – 1 Jan 2027) is the same Rahu–Venus period the October reading built its plan around; the next chapter (Sun, from 16 Feb 2028) is confirmed by Vimshottari (Mars from 16 Mar 2028) and Narayana (Aries from 15 Oct 2027). The previous chapter (Saturn, 2010–2019) is only likely: one clock (Yogini, 2009) turns near its start. The diagnosis names one tension: the running chapter's own lord (Rahu) restless in the 5th until the chapter ends on 16 Feb 2028, and the one question asks whether that rings true. Once it is answered, the next question is the 12th house of the running sub-chapter ("Have you moved recently, or been thinking about moving?"), which matches the move the October reading dates to 2027.

## 11. Recommendation

**Build the You reading as seven deterministic panel techniques over shared slicers, each stored for its validity window
and timed on its own, on a per-kundli reading clock; add the model layer on top of their claims only after Sachin's yes.**

| Option | Verdict |
|---|---|
| Panels as techniques over shared slicers, stored by window (chosen) | Each panel testable and tunable alone; reuse counted by doc 56; a second open costs nothing; no model cost to ship |
| Rewrite `SELF.words` with more phrases | Still one phrase per vote; nothing names the person's placements |
| Model-only reading straight from the digest | Untraceable sentences, a cost per open, no per-panel test; the claims layer is what the model needs anyway |
| Keep Vimshottari as the main clock for everyone | Wrong for charts where a conditional system applies; Sachin's own trusted clock ignored |
| Slice chapters by calendar decade (today's character arc) | Not where the person's life turns; cannot be recognised |
