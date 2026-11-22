# 07 · One evidence chain for every reading: research folded into the live techniques

Written 2026-11-19. Plan only; no code is changed by this document. It supersedes the order of work in
`docs/deep-research/sanjay-rath/14-technique-mapping.md` §9 and `docs/deep-research/current-specs-review/07-recommendation.md`
by merging both into one sequence, and it replaces the routing table of doc 76 (`docs/reading-engine/76`). Doc 14
(`docs/dashboards/14`, Love and Work board techniques) is extended, not replaced.

Sachin's request (2026-11-19): fold the Sanjay Rath and dasha research into every technique; every card reads the birth
chart with the navamsa by the person's age, the divisional chart of its subject, the Tithi Pravesha year (this year's
and last year's) with its divisional charts, and the dasha systems that apply to the person, read together; nakshatras
count; a statement is made with confidence only when these agree.

Source tags used below: **[Rath]** his own text · **[Student]** P.V.R. Narasimha Rao or Poddar · **[Text]** a classical
verse · **[Yours]** Sachin's decision, no source found · **[Inferred]** assembled by the researchers.

## Five decisions for Sachin (defaults chosen so the build is not blocked)

The research was read in full (three agents, 2026-11-19). It supports most of the request. It does **not** support four
points as stated, and one more needs your choice.

1. **Age 36 and D1 with D9.** No Rath, student or classical source ties a D1/D9 rule to age 36 or any age. The research
   tags the product's rule "unsourced". Rath's only "D9 leads" rule is about temperament, at any age.
   *Default:* keep your age-36 rule as a house rule tagged [Yours], unchanged, and add the three age rules that do have
   sources (§4.1 step 1). *Alternative:* drop the age condition and confirm D1 in D9 at every age.
2. **"D9 is better than D1 for the Tithi Pravesha."** Not addressed anywhere in the research. It also found no rule for
   which houses to read in the year chart.
   *Default:* read the year chart's D1 first, then the year chart in the card's own divisional chart as the confirmer
   (the same rule as the birth chart), and use the year chart's D9 for the dignity of the year lord and hora lord.
3. **Counting how many systems agree.** No source gives a required number. Rath's method is a gate: a sign dasha such as
   Narayana must confirm what Vimshottari pinpoints [Rath, *Crux* p.3]. The research warns that more clocks raise
   agreement by accident.
   *Default:* one gate replaces the four counts in the code today (§4.1 step 3). The count is still shown, as support.
4. **Nakshatras and Narayana dasha.** The research links them nowhere. Narayana is a sign dasha. Nakshatra rules belong
   to Vimshottari and the other star dashas, to each planet's star lord, and to transits.
   *Default:* nakshatra rules are applied to planets and to the star-dasha period lords, not to Narayana.
5. **Where Vimshottari starts.** The engine starts from the Moon's star only. Rath's two texts differ: the stronger of
   the lagna star and the Moon star (*Crux*), or the strongest of lagna, Moon and the 5th star from the Moon (his site).
   *Default:* stay on the Moon until the engine has a seed option and a reference test, then follow *Crux*.

## 1. Start (checked 2026-11-19 against code on `develop` `cae0f28`, the staging database and the engine at `b902bea`)

**The research.** `reports/*.md`, `research_notes/**`, `docs/deep-research/**` (168 files). Committed only in `75bc0a0` on
`feat/self-foundation-server`; **not on `develop`**, so a build session on `develop` cannot read it. Two different docs
are numbered 86 (`86-grouped-card-reads` on develop, `86-confirmation-loop` on that branch).

**What is live.** No file under `docs/techniques/` is loaded by code. The 45 per-technique specs describe planned
behaviour, and their README marks all of them "built", which is false. The live rules are:

| Live rule | File | Bytes |
|---|---|---|
| Oracle rules for every card | `src/reading/prompts/cards/oracle.md` | 7,700 |
| 90 card briefs (21 Self, 36 Love, 33 Work) | `src/reading/prompts/cards/{self,love,work}/` | 118,945 |
| Card → technique rows, Love and Work only | `src/reading/cards/techniques.ts` | 31,168 |
| Timing and chart-routing block | `src/reading/cards/oracle.ts` `renderActiveTimingAndVargaBlock` | — |
| The eight house layers, career votes | `src/reading/area/houseLayers.ts`, `career.ts` | 87,283 |
| D1/D9 verdicts, age gate (computed in Node) | `src/reading/dasha/dashaAssessment.ts` | 24,921 |
| Clocks, tones, year frame, ledger | `src/reading/clocks/*`, `self/v3/yearFrame.ts`, `self/sub/rowTone.ts` | — |

**What each of your five points looks like today.**

| Point | Today |
|---|---|
| Age | The Oracle is told only "over 36" or "36 and under". The server holds the real age and does not pass it. |
| Divisional chart of the subject | Fixed per board in code (Love D9, D7; Work D10, D9, D60). The routing table lists Self cards only; on the one-card path every Love and Work card falls to "D1+D9". 18 of 21 Self briefs, 6 Love briefs and 6 Work briefs name no divisional chart unconditionally. The pack holds all houses only for D9, D10 and D30; other charts carry the 1st house only; D11 is absent. |
| Tithi Pravesha | Cards get the year's dates, lagna, year lord and dated rows. **No year-chart houses and no year divisional charts reach a card.** Briefs ask for "the year's D10" that the pack does not contain. Last year appears only if its rows overlap the window. |
| Dashas together | Up to five clocks (Vimshottari, Narayana, the year, one conditional, Yogini or Chara). Agreement is counted four different ways (`yearFrame.ts:115`, `clocks/concordance.ts:59`, `houseLayers.ts:161`, `dashaAssessment.ts:449`). Divisional charts, age and nakshatras play no part. |
| Nakshatras | Each D1 planet's star lord and pada are in the pack. No rule tells the Oracle to use them. |

**What the texts contradict in the product today.** Romance is read from D7, which the texts give to children
[Text, BPHS]. Friends cards name a "D11 proxy"; no source makes D11 a gains or friendship chart (it is destruction
[Student; Rath Table 29]). `work.character_arc` cites *Crux* for the age-36 rule; the research could not find it there.

**Data stored per kundli** (six test kundlis checked):

| Data | Stored | Gap |
|---|---|---|
| 23 divisional charts with dignities, motion, combustion | yes | star lord only in D1 |
| 42 dasha systems, levels 1–3 for life, level 4 near today | yes | none on a divisional chart; Vimshottari from the Moon only |
| Which conditional dasha applies | yes, 7 of 9 decided | Shodashottari, Shat-trimsha never checked |
| Tithi Pravesha D1, D9, D10, ten years each side | yes | other charts only where a one-off script ran (5 of 6 test kundlis; a new kundli gets three) |
| Year lord and hora lord of the Tithi Pravesha | motion flags only | **names not exported** |
| Dasha inside the Tithi Pravesha year | Tithi Ashtottari, 2 levels | no other system on the year chart |
| Nakshatra, pada, star lord, tara (D1) | yes | nine-star round and special stars in the library, not exported |
| Confirmed life events (`life_events`) | **0 rows** | the events for the two family kundlis are in notes, not in the database |

**Clocks that cannot be trusted yet.** The research flags, from reading engine code, that the Narayana and Chara
sub-periods and the first six stars of the Yogini table may be wrong; a Mudda start lord is proven wrong. Agreement
counted across unverified clocks is not evidence. Database: 539 MB, of which `kundli_activation` is 370 MB.

## 2. End goal

Every card on every dashboard is read through the same five-link chain, each link naming its source, and the card says
plainly which links hold:

1. **Promise**: the birth chart and the card's own divisional chart agree.
2. **Period**: Vimshottari points to the subject and a sign dasha confirms it.
3. **Year**: the Tithi Pravesha year supports it; last year's chart is how last year felt.
4. **Star**: the period lord's nakshatra says how it acts.
5. **Trigger**: a slow transit over the subject's point.

User-visible: a dated statement appears only when links 1 to 3 hold. "May" is used when link 2 holds on one dasha family.
A card never cites a clock the engine has not verified. Card build time stays under 20 s and $0.45.
Failure modes removed: briefs asking for charts the pack lacks; romance on D7; four agreement counts that can disagree;
astrology computed in Node for D1/D9.

## 3. Deliverable

- **Docs:** this plan; one routing table `docs/techniques/08-card-routing-table.md` (90 cards); the 45 specs and README
  re-marked `live`, `planned` or `dropped` to match the code; research commit `75bc0a0` on `develop`; the second doc 86
  renumbered 88.
- **Engine (its own repo, release branch `release-candidate-staging`):** reference harness under `tests/research/`;
  fixes it confirms; new fields listed in §6. No migration.
- **Server:** `src/reading/cards/routing.ts` (new, one table for all cards); `cards/oracle.ts`, `cards/group.ts`,
  `cards/techniques.ts`, `self/oracle.ts` (pack content); `clocks/concordance.ts`, `self/v3/yearFrame.ts`,
  `area/houseLayers.ts`, `area/career.ts` (one gate); `dasha/dashaAssessment.ts` (Node verdicts removed);
  `digest/annualSet.ts`, `chartData/catalog.ts` (pull set); `tests/unit/noAstrologyInNode.test.ts` widened.
- **Prompts:** `cards/oracle.md`, 90 briefs, `common/reader-system.md`. Two prompt releases in all (phases 1 and 4).
- **Tests:** unit tests per file; a replay script scoring the gate against confirmed past events.

## 4. How it works when done

### 4.1 Backend: the chain, step by step

**Step 1 · Promise (natal).**
- Read the subject's house, its lord and its karaka in D1; then the same house lord's placement in the card's own
  divisional chart, from that chart's lagna ("karya rasi") [Rath; extended beyond D10 by inference].
- D1 with D9 for every planet cited: vargottama is strong [Text]; a friendly sign with an enemy or debilitated navamsa
  is mixed [Text, Saravali 41.19]; debilitated in D1 with an exalted navamsa gives a sudden rise [Rath].
  The verdict is an engine field per planet (`d1_d9`), not Node code.
- Age enters three sourced ways, plus yours:
  - the life stage from the stored Naisargika dasha (Venus 12–32, Jupiter 32–50, Sun 50–70) [Text, BPHS 43], context only;
  - the year's house by age from Sudarshana (age mod 12, from lagna, Moon and Sun) [Text, BPHS 74], once the engine exports it;
  - Rath's "years of fortune" per planet (Saturn 35–36, Jupiter 33–34 …) [Rath, to be checked in print], as a note when
    a cited planet's year is within one year of the person's age;
  - the age-36 rule [Yours], unchanged (decision 1).
- The pack gives the real age in whole years, not a band.

**Step 2 · Period (dashas read as a pair, then widened).**
- Vimshottari pinpoints; the sign dasha confirms [Rath]. The sign dasha is Narayana on D1 and, once exposed, Narayana on
  the card's own divisional chart ("the D10 is key in the working years") [Rath, *Narayana Dasa* pp.114–115].
- Purpose dashas join by subject: Sudasa for money and standing [Rath role; Student calculation]; Drig then D20 Narayana
  for purpose [Rath].
- The conditional dasha that applies to the person confirms; it never replaces Vimshottari [Text is silent; research advice].
- Chara is the movable-lagna form of Narayana [Rath], so the two never count as two.
- Yogini and Tithi Ashtottari are tagged as not Rath and are tie-breakers only.
- A period "points to the subject" when its lord or sign is linked to the subject's house, lord or karaka. That link is
  an engine field per period row (`houses_activated`, per chart). Levels 1–3; level 4 only when the birth time source
  is a record.

**Step 3 · One gate (replaces the four counts).**

| Status | Rule | Wording |
|---|---|---|
| `confirmed` | promise holds, Vimshottari and the sign dasha both point, and the year supports | dated statement |
| `leaning` | promise holds and one of the two dasha families points | "may", month or season only |
| `open` | promise holds, no dasha points now | no date; what it would take |
| `contested` | the two families point opposite ways, or the year denies | both sides said plainly |
| `not promised` | D1 and the subject's chart both deny | never timed [Text: nothing is timed that is not promised] |

The server only counts engine verdicts. A clock marked `calibrating` in the engine's variant tag takes no part.

**Step 4 · Year (Tithi Pravesha).**
- Never read alone; the birth chart overrides [Student, Poddar].
- Order [Student, Poddar; houses are a gap in the research]: year lagna counted from the birth lagna (kendra ease,
  trikona gain, dusthana obstacle); year lagna lord; hora lord (the year's focus); year lord by weekday
  [Yours, decided 2026-11-09]; then the card's house in the year D1 and in the year's chart of the card's subject.
- In-year timing: Tithi Ashtottari to two levels, tagged "SJC practice, not verified in Rath's text".
- Last year's chart gives one line, "how last year felt", and one confirm question. It is never a prediction.
- Same planet in the same sign in both the birth chart and the year chart gives full results [Text, Tajika].

**Step 5 · Star.**
- A period lord acts through its star lord's house and condition [commentary, no verse; tagged].
- Mind is read through the lagna lord's star lord [Rath].
- In a malefic's period, the sub-period of the lord of the 3rd, 5th or 7th star from the birth star is adverse
  [Text, Phaladeepika 20.23]; tara of each cited planet comes from the engine.
- Special stars that the texts tie to danger to life stay internal.

**Step 6 · Trigger.** Jupiter over the AL, the 7th lord or the 2nd from UL; Saturn over A10 or aspecting the AL
[Rath, career and marriage only]. Others stay as today, tagged by source.

**Limits.** Pack grows from about 64.8k to about 71k tokens: one subject chart with all houses per card (shared by
cards on the same chart, six charts at most), the year D1 houses, the year's subject charts, star lines. Output size is
unchanged, so the measured 17 s model time for six grouped calls should hold; cost per board about $0.075 against a
$0.45 cap. Both are measured in phase 1 before release.

### 4.2 Routing: which chart each dashboard reads

Full per-card table goes in doc 08. By subject:

| Dashboard | Promise chart | Sign dasha | Year chart | Points | Source |
|---|---|---|---|---|---|
| Self: temperament, presence | D1 with D9 lagna (D9 dominant) | Narayana D1 | year D1, D9 | lagna, AL, AK | Rath |
| Self: mind, learning | Moon, lagna lord's star lord; D24 | Narayana D1 | year D24 | 4th, 5th, 9th | Rath |
| Self: purpose | D20 | Drig, then D20 Narayana | year D20 | AK, Karakamsa | Rath |
| Self: body, strain | lagna, paka lagna; D30 for strain words only | Narayana D1 | year D1 | Sun, lagna lord | Rath; illness rules stay out |
| Self: chapters, year | D1 | Narayana D1; Naisargika stage | year D1; last year | — | Rath; Text |
| Love: dating | 5th, Venus, **D9** (not D7) | Narayana D1 | year D9 | A7; 2nd and 7th from UL | Rath |
| Love: marriage | 7th, its lord, D9 | Narayana D9 | year D9 | UL, DK | Rath; D9 Narayana is Student |
| Love: children (later card) | D7 decides | D7 Narayana | year D7 | 5th | Rath |
| Love: friends | 11th in D1 and D9; **no D11** | Narayana D1 | year D1 | A5 from AL | Text, BPHS 29.35; Rath is silent |
| Love: allies | D10 5th (team), 9th (boss), 7th | D10 Narayana | year D10 | A7, A10 | Rath |
| Work: starting out | D10 5th lord | D10 Narayana | year D10 | A10 | Rath |
| Work: your job | D10 6th, 9th, 8th | D10 Narayana; Sudasa for pay | year D10 | AL, A10 | Rath |
| Work: business | D10 7th, 6th and 7th lords; D10 2nd for capital | D10 Narayana | year D10 | A7 | Rath |
| Work: craft | 3rd and 5th in D1 and D9; D24 for skill | Narayana D1 | year D1 | Mercury | adjacent rules only; Rath is silent |
| Money cards | 2nd, Jupiter, D2 (variant tagged) | Sudasa | year D2 | HL; 11th and 12th from AL | Rath; D2 scheme disputed |
| Lucky times | no divisional chart | — | year lord as context | tara and Moon strength | classical muhurta; Rath is silent |

### 4.3 API

No new endpoint. `GET /api/self/v3` and `GET /api/board/:board/v3` are unchanged in shape. Each card's stored reading
gains `chain: { promise, period, year, star, trigger, status }` with source tags, served under the existing
`feature.why_panel` grant and shown on the Astrology Reading tab. Engine request types gain optional params (§6);
missing params behave as today.

### 4.4 Frontend and UI/UX

Astrology Reading tab: a five-row "What this rests on" list (Promise, Period, Year, Star, Trigger), each row with a
held or not-held mark and one chart-language sentence. Outlook's "Why we think so" line reads from `chain.status`
("The birth chart, both period systems and this year agree"). States are unchanged (reading, ready, failed).
Cards built before the release show today's view.

## 5. Architecture

- **Engine** computes every astrological verdict: `d1_d9` per planet, period links, year lord names, star data, dashas
  on a divisional chart, applicability. Each output carries `variant` and `text` tags.
- **Server** pulls, stores, routes by one table, counts verdicts into the gate, and builds the pack. It computes nothing
  astrological; the guard test scans all of `src/reading/**`.
- **Model** (Oracle) reads the routed pack and writes the chain sentences; (Personalizer) writes plain words.
- Boundaries: engine calls on the request path stay under the 60 s limit, one call per item; the disk guard runs before
  any pull; a prompt change re-keys every card, so prompts ship twice only.
  Note 2026-11-22: the disk guard was removed on Sachin's instruction; nothing in code now refuses a bulk write when the disk is nearly full (see `docs/techniques/11` rev 4, open point E).

## 6. Ingredients

**Engine additions (owner: engine session; each ships with a harness test):**

| # | Addition | Size |
|---|---|---|
| E1 | Reference harness: Vimshottari, Narayana, Chara, Yogini, Mudda, Tithi Ashtottari against JHora for the research kundlis | tests only |
| E2 | Fixes the harness confirms (Narayana and Chara sub-periods, Yogini table, Mudda start lord) | few lines each |
| E3 | `year_lord`, `hora_lord` and the panchanga on the Tithi Pravesha payload | bytes |
| E4 | Star lord per planet in every divisional chart; nine-star round; tara per planet | ~1 KB |
| E5 | `varga` param on `dasha.<name>`: Narayana on D9, D10, D7, D4, D24, D20, D2 | ~100 KB stored per chart |
| E6 | Per planet `d1_d9`, `vargottama`, `neecha_bhanga`; per period row `houses_activated` per chart | small |
| E7 | Applicability checks for Shodashottari and Shat-trimsha; the Tara condition flag | tiny |
| E8 | Vimshottari seed option (decision 5); Sudarshana export | small |
| E9 | `calibrating` tag on any system without a passing harness test | tag |

**Server:** no migration, no new env var. Varga Narayana rows are stored in `kundli_data` only (levels 1–3), not in
`kundli_activation`, to stay clear of the disk limit (about 0.7 MB per kundli for seven charts).
**Agents:** `engine-rule-verifier` for E1; build agents on Opus 5.5, medium effort, in the background.
**Test data:** the six test kundlis; confirmed events for the two family kundlis entered through the confirmation loop.
**Owners:** engine session (E1–E9), build session (server, prompts, docs), deploy sub-session (releases),
Sachin (five decisions, each paid replay, entering the events).

## 7. Action steps in sequence

1. Put the research on `develop`: cherry-pick `75bc0a0`, renumber `86-confirmation-loop` to 88, commit this plan. Done: a `develop` checkout can open every file this plan cites.
2. E1 reference harness (engine). Done: a pass or fail per system per kundli, filed in `docs/TODOS.md`. *Parallel with 3–6.*
3. Write `docs/techniques/08-card-routing-table.md`: 90 rows (card, houses, promise chart, sign dasha, year chart, points, source tag) from §4.2 and `docs/dashboards/01–08`. Done: every card has a row; no row names D7 for romance or D11.
4. Server `cards/routing.ts` from doc 08; `renderActiveTimingAndVargaBlock` and both card paths read it. Done: unit test asserts all 90 cards route, and Love and Work cards no longer default to "D1+D9".
5. Pack content: real age; all houses of each routed chart; year D1 houses and the routed year chart; D1 star lord and tara lines for cited planets; Naisargika stage from the stored row. Widen `ANNUAL_CHART_VARGAS` to the routed charts for this year and last. Done: a brief never names a chart the pack lacks (unit test over all briefs).
6. Prompt release 1: `cards/oracle.md` gets the chain order and source tags; the 90 briefs name their routed charts; romance off D7; friends off D11; nakshatra rule added; "40+ dasha systems" wording removed. Done: one measured board read (paid, on Sachin's yes) shows time and cost within limits.
7. Engine E2, E3, E4, E7 then a re-pull for the six test kundlis after the disk check. Done: year lord and hora lord named in the pack; unverified clocks tagged.
   Note 2026-11-22: the disk guard was removed on Sachin's instruction; nothing in code now refuses a bulk write when the disk is nearly full (see `docs/techniques/11` rev 4, open point E).
8. Engine E5, E6. Server stores varga Narayana in `kundli_data`; `clocks/` reads it for routed cards.
9. One gate: `clocks/concordance.ts`, `yearFrame.ts`, `houseLayers.ts`, `career.ts` use the §4.1 step 3 table; `dashaAssessment.ts` D1/D9 code removed in favour of E6; guard test widened. Done: one function decides status; four old counts deleted.
10. Prompt release 2 and the `chain` field; web shows the five rows on the Astrology Reading tab.
11. Confirmation loop (doc 88): one confirm route per board writing dated `life_events`; a birth-time-source fact. Enter the confirmed events for the two family kundlis.
12. Replay script: for each confirmed event, the gate's status for that subject on that date. Done: a table of hits and misses per chain link, filed in `docs/`.
13. Re-mark the 45 specs and the README to match the code. E8 as decisions land.

## 8. Development phases

| Phase | Steps | Ships | Closing check |
|---|---|---|---|
| 0 Ground truth | 1–3 | research on `develop`, harness results, routing table | harness table per system; doc 08 reviewed |
| 1 Right charts, real age | 4–6 | server + prompt release 1 | unit tests; one paid board read: under 20 s, under $0.45; a Love card cites D9 and the year D9, a Work card D10 and the year D10 |
| 2 Engine fields | 7–8 | engine release, re-pull | year lord named; D10 Narayana stored; database size before and after |
| 3 One gate | 9–10 | server + prompt release 2 + web | one status function; the five rows on a card; no Node astrology in the guard test |
| 4 Proof | 11–13 | confirm route, replay report, honest specs | hits and misses against confirmed events for two kundlis |

Each prompt release re-keys every card: the You board re-reads on its daily build; Love and Work re-read only when a
lens is refreshed. Each paid read or replay is stated to Sachin first with key, count and cost.

Deferred: monthly and daily Pravesha (one student source only); Vimshottari cast on the year chart (new engine
computation, in-year dasha unresolved in the research); health, longevity and curse rules (Shoola, Mula, D30 and D6
illness, special stars), which stay out; muhurta event rules (need a verse-level pass); rectification technique (needs
phase 4 data first).

## 9. One recommendation

Build the chain in the order above: verify the clocks, route every card to its own charts, then replace the four counts
with one gate, and prove it against confirmed events.

| Alternative | Verdict |
|---|---|
| Rewrite the 45 technique specs first | Rejected: no code loads them; the live rules are the prompts and four code files |
| Add more dasha systems to the count | Rejected: no source asks for a count, and unverified clocks agree by accident |
| Extend the Node D1/D9 code with an age scale | Rejected: breaks the rule that Node computes nothing astrological, and the age rule has no source |
| Give every card every divisional chart | Rejected: pack size and cost; one routed chart per card carries the rule |
| Start with the confirmation loop (the research's own first step) | Folded in as phase 4: it proves the chain but changes no reading today |
| Treat the year chart's D9 as above its D1 | Left to decision 2: nothing in the research supports or denies it |

## Verification

- Engine: harness run in the engine repo (`tests/research/`), one row per system per kundli.
- Server: `npx tsc --noEmit`; `npx vitest run tests/unit/reading/cards tests/unit/reading/clocks tests/unit/techniques`; the brief-coverage test (step 5); the widened `noAstrologyInNode` test.
- Live: one board read per prompt release, timed and costed from `agent_runs`; the Astrology Reading tab shows the five rows; the replay table in phase 4.
