# 60 — The Self reading at research grade: scenarios, the per-person dossier, the top-down purview check, the auditor, and a build with no live reads

Status: **requirements and design, 2026-11-07,** from Sachin's brief of the same evening, for the Self-dashboard session
(docs 58 and 59) to build to. Sachin's words, kept: the Self dashboard is designed around specific user scenarios; the
reading must be research grade, "as if you were having a biotech medicine breakthrough"; techniques are made of smaller
techniques, and without a top-down purview the small ones miss rules a whole-chart reading applies; every ingredient
(technique, rules, data, yogas) and the digested data sent to the synthesizer, which is now called the **Vedic
Astrological Oracle**, is documented per person so an advanced **auditor** agent can reverse-engineer the reading and say
whether it was done correctly; and everything the sub-agents, the synthesizer and the lineman agents need (prompt,
context, data) is cached, with nothing pulled live from the database if it can be helped.

Names used from here: **lineman agents** are the readers that each read one slice and return claims (R01–R15 and the
code readers); the **Vedic Astrological Oracle** is the one synthesizer that writes the reading from the brief; the
**auditor** is the independent agent that reads the dossier and the reading and grades it. The engine's own name never
appears in any of their text (SOUL.md).

## 0. Answer first

1. **Eight named scenarios drive the Self reading** (§2): Sachin's own chart first; then the person who has everything
   and every problem at once; the stuck mid-career professional; the young adult without direction; the person in loss;
   the person at the end of a mahadasha; the seeker; the new parent. Each scenario is a research subject with a chart,
   the panels it must get right, the sentences it must never produce, and a hand-written expected reading that the
   auditor compares against. They are the acceptance tests of the feature, not illustrations.
2. **One dossier per person per build** (§3): a stored, versioned record of every ingredient that went into the
   reading: the techniques and their contract hashes, the classical rules applied with their sources, every digest row
   and activation row read (with keys), the yogas and doshas present, the clock and the confirming clocks, the slices as
   the lineman agents saw them, each lineman's prompt version and claims, the brief exactly as the Oracle received it, the
   Oracle's prompt version and output, the validator's result, the gaps, and the cost. The dossier is the research
   artefact; the reading is one of its fields.
3. **A top-down purview check runs before the Oracle** (§4): a whole-chart technique (`board.purview`) over the full
   digest, not a panel's slice, that applies the rules a slice cannot see (cancellations, overrides, the lagna lord's
   standing over every house reading, combustion and retrograde, badhaka and maraka lords for this lagna, gandanta and
   sandhi, dasha applicability, a vargottama or a Neecha Bhanga that changes a panel's verdict) and writes **overrides and
   vetoes** into the brief. A panel claim the purview contradicts is not shown.
4. **An auditor grades every build** (§5): an advanced model, on a separate prompt and a separate role, receives the
   dossier and the reading, re-derives each sentence from the dossier's rows and rules, and returns a score, a verdict
   (pass, warn, fail), and receipts: the sentence, the rows it rests on, the rule applied, and what was missed or
   contradicted. A fail blocks the reading from the person's board and shows the stored previous reading or the
   deterministic panels. The existing `research.technical_verifier` (docs/admin/09) is the code half of this and stays;
   the model half is new and runs only on Sachin's yes.
5. **The build reads the database once and the agents read nothing live** (§6): one bundle per build holds the
   digest sections, activation rows, annual rows, the sky overlay, the sealed facts, the prompts and the contracts; it is
   stored in `technique_outputs` and uploaded to the model's prompt cache (doc 57's pre-run upload). The lineman agents,
   the purview, the Oracle, the validator and the auditor read the bundle. Rebuilds happen on four triggers only: a new
   digest version, the reading clock's sub-period boundary, the next year chart, a confirm answer.
6. **Recommendation** (§10): build the dossier and the purview first, deterministically, because they make the auditor
   possible and cost nothing; then the auditor on the eight scenarios in research staging; the Oracle prose last, after
   the auditor passes the scenarios.

## 1. Start: what exists (checked on `develop` 854e6d9 and the plan branch)

| Exists | Where | What it gives this design |
|---|---|---|
| Research staging: `research_kundlis`, `research_chart_data`, `research_digests`, `research_activations`, `research_dashboard_runs`; 20 preset subjects (10 age brackets, 10 personas); a 10-step technical trace; `research.technical_verifier` auditing 8 dimensions in code | docs/admin/09; `src/reading/research/` | The place the scenarios live and the code auditor to extend |
| Per-question journal: every agent's prompt sent, data keys, digest, usage, status | `src/reading/oracle/journal.ts`, `reading_journal` | The shape of a dossier row, per agent, already written for chat |
| Technique outputs by validity window, agent runs with ms and cost | `technique_outputs`, `agent_runs` (docs 56, 53) | Where the bundle and the dossier are stored and timed |
| Reader memo and findings cache; pre-run LLM cache upload and sub-agent prewarm | `reading_findings_cache`, `llm_cache_entries`, `src/reading/oracle/prewarm.ts`, doc 57 | The mechanism for "nothing pulled live" |
| Technique contracts with inputs, layout, system prompt, output schema | `src/techniques/contracts.ts`, catalogue | The contract hash the dossier records per technique |
| Grounding gate: a claim with no resolvable evidence id is dropped | `src/reading/oracle/brief.ts` | The first line of the auditor's checks, already in code |
| Doc 58's panel techniques and slicers; doc 59's page shape and contracts | plan branch | What the dossier documents and the purview checks |

What is missing, and the symptom: the production Self reading has no record of what it read and why (only the research
staging does, for synthetic subjects); no rule runs over the whole chart, so a panel can state a debilitated Moon as a
weakness when the digest holds a Neecha Bhanga row the panel did not read; no agent grades a real person's reading; the
board build reads the digest, the activation calendar and the facts live on every request that misses the cache.

## 2. The scenarios (acceptance tests, in research staging)

Each scenario is a `research_kundlis` subject with `group_kind = 'self_scenario'`, hydrated once through the production
pipeline into the research tables, with a scenario file under `docs/reading-engine/scenarios/self/<id>.md` holding: the
birth data (synthetic for all but Sachin's, whose own kundli is referenced by id and never copied into staging), the
chart facts that define the scenario, the panels that must be right, the sentences that must never appear, and the
expected reading written by hand against the classical rules. The auditor compares every build against the file.

| id | Scenario | What defines it in the chart | Must get right | Must never say |
|---|---|---|---|---|
| S1 | **Sachin** | Pisces lagna, L1 Jupiter mrita in the 7th with Sun and Saturn; Moon debilitated in the 9th with Mars, Neecha Bhanga; AK Sun; Dwisaptati applies (L1 in the 7th); Rahu MD 2019–2028, Venus AD, Sun MD next | The clock is Dwisaptati; the running chapter names Rahu's houses (5, 11) and the Venus sub-chapter; the cancellation on the Moon is stated as a gift; the previous chapter (Saturn 2010–2019) is recognisable to him | "Your Jupiter mahadasha" (Vimshottari-only); the Moon as a plain weakness; any sentence without a row |
| S2 | **Everything and every problem** | Strong 10th and multiple raja yogas, exalted L10, AL in a kendra; afflicted Moon or 4th (Saturn and Rahu), Kemadruma or Sade Sati running; a 6/8 relation between MD and AD lords | Holds success and strain in one diagnosis; the struggle panel names the Moon's affliction with its release; "how you are seen" is strong while "your mind" is pressed | "A clear stretch" as the headline; a reading that is all praise or all warning |
| S3 | **Stuck at mid-career** | L1 in the 8th or 12th, Saturn MD or Sade Sati running, weak SAV on 1 and 10, a Viparita yoga present | The release date of the running affliction; the Viparita as the gift that turns the stuck period; the next chapter dated | "Begin something of your own" during a Saturn-on-Moon year |
| S4 | **Young and without direction** | Age 22, Rahu MD, Mercury retrograde, AK Rahu or Ketu, 5th lord in the 12th | The soul's aim stated from the AK, not from the 10th; the running chapter as a search, not a failure; the confirm question about direction | A profession as a verdict; "late" or "behind" |
| S5 | **In loss** | Ketu AD running over the 12th or the 4th, Moon with Ketu or in gandanta, 8th lord running | The passage with a shape and dates; graces first (doc 39 sensitive rule); release date from the stored period | Possessed, cursed, doomed, loss, death; a child under 18 |
| S6 | **End of a mahadasha** | Last 18 months of an MD, the next MD lord a functional benefic or malefic, two confirming clocks changing within the window | The chapter boundary dated and confirmed by name; what the ending lord wants completed; the next lord's faculty | "Everything changes on <date>"; a boundary stated when only the reading clock marks it |
| S7 | **The seeker** | AK Ketu or Saturn, 12th strong, Jupiter in the 9th or 12th, Moksha trikona occupied, karakamsa with Ketu | Atma panel leads the diagnosis; the 12th read as inner life, not loss | Renunciation as advice; remedies |
| S8 | **New parent** | Age 32, Jupiter MD, 5th house active, Moon with Jupiter, L4 strong | The 5th and 4th as the running theme; the Moon's peace; nothing about the child | Anything about the child (under 18 rule) |

S2 to S8 are built with `buildCustomResearchSubject` from chart specifications, not real people; where a preset of
docs/admin/09 already matches (the founder, the teacher, the age-32 bracket), the preset is reused and the scenario file
points at it. Each scenario has a `must_say` and a `must_not_say` list the auditor checks mechanically before the model
grades the rest.

## 3. The dossier: everything about one reading, stored per person per build

`reading_dossiers` (new table; one row per kundli per build; encrypted like `kundli_data`; never served to the person):

| Field | Holds |
|---|---|
| `kundli_id`, `board`, `built_at`, `digest_version`, `clock`, `valid_from`, `valid_to`, `trigger` | identity and the validity window; trigger is `digest` / `dasha_boundary` / `annual` / `confirm` / `manual` |
| `techniques[]` | every technique that ran: id, contract hash, prompt file and version (from the registry's `system_prompts.version`), code version (git sha), input filter, ms, cache hit or run |
| `rules[]` | every classical rule applied, as the technique declared it: id (`bphs.neecha_bhanga.moon`, `jaimini.karakamsa.planets_in`, `tajaka.year_lord`), the source line (BPHS chapter and verse, Jaimini sutra, Phaladeepika, Tajaka Neelakanthi, the Rath or Giri text named in the catalogue), the rows it read, the verdict it returned |
| `data[]` | every digest, activation, annual, sky and fact row read, by key, with the value as read (the slice, not a pointer, so the dossier stands alone when the digest is rebuilt) |
| `yogas[]`, `doshas[]` | every present row, whether a panel used it or not, so the auditor can see what was available and unused |
| `clocks` | the reading clock and why, the confirming clocks, every L1 and running L2/L3 row of each, the applicability verdicts |
| `purview` | the top-down check's overrides and vetoes (§4) with their rules and rows |
| `linemen[]` | per lineman agent: prompt name and version, the slice it received (keys), the claims it returned, dropped claims and why (grounding), usage and ms |
| `brief` | the brief exactly as the Oracle received it, byte for byte |
| `oracle` | prompt name and version, model, the reading returned, the validator's verdict, usage, ms |
| `gaps[]` | every missing field recorded by any slicer or lineman |
| `audit` | the auditor's score, verdict, receipts and model (§5), or `not_run` |
| `cost_usd`, `tokens` | the build's total, from `agent_runs` |

The dossier is written by the build service in one transaction after the panels and before the Oracle call, and updated
with the Oracle and auditor fields after. The admin app gets a "Reading dossier" page per kundli and build (docs/admin/03
pattern): the dossier as a tree, the brief as sent, each sentence of the reading linked to the claim ids and rows it
rests on, the rules with their sources, and the auditor's receipts; staff can re-run the auditor on a stored dossier
without rebuilding. The research staging run writes the same dossier shape into `research_dashboard_runs.dossier`.

## 4. The top-down purview check (`board.purview`)

A whole-chart technique, deterministic, run once per build before the brief is assembled, over the full digest and the
full activation calendar, with no panel filter. It exists because a panel reads a slice and a chart is read whole. It
returns overrides and vetoes that the brief carries under a `PURVIEW` block, and a panel claim it contradicts is marked
`vetoed` with the rule and is not shown to the person.

Rules it applies (each a catalogue row with its source; the engine supplies every value, the check only matches labels
and joins keys):

| Rule | What a slice misses | Effect on the brief |
|---|---|---|
| Lagna lord's standing | a panel on the 4th or 5th reads its lord well while the lagna lord is mrita or in the 8th | every "firm footing" claim is capped at "holds, with effort"; the diagnosis names the lagna lord first |
| Cancellations | a debilitated Moon stated as weakness when `yoga:neecha_bhanga` names it; Kemadruma cancelled by a kendra Moon or a planet in 2/12 | the weakness claim is replaced by the cancellation claim (a gift) |
| Combustion and retrograde | a lord's dignity read as strong while the engine marks it combust or retrograde | dignity claims carry the condition; a combust lord cannot be "a strength" |
| Functional nature by lagna | a natural benefic treated as a help when it is a maraka or badhaka lord for this lagna | the planet's functional role from the digest overrides its natural role in every claim about it |
| Vargottama and D9 agreement | a D1 dignity stated without D9 disagreeing (or agreeing strongly) | the claim gains "confirmed in the inner chart" or "not confirmed in the inner chart" |
| Gandanta and sandhi | Moon or lagna in gandanta; a planet in the last degree of a sign | the mind or self claim carries the junction; timing claims near a sandhi are graded one step down |
| Dasha applicability | a chapter from a conditional clock the engine says does not apply | the clock is replaced; the dossier records why |
| MD–AD relation | an AD lord in 6/8 or 2/12 from the MD lord read as a plain support | the sub-chapter is marked as a reversal or a cost, from the charter cell |
| Sade Sati and nodal transits | a "clear stretch" while the sky overlay marks Saturn on the Moon or Rahu on the lagna | the running chapter carries the transit as a standing pressure with its stored dates |
| Yoga completeness | a raja yoga claimed from two lords when the engine's row lists a third that is afflicted | the yoga claim is stated as the engine states it, with every planet in the row |
| Age of the period | a Jupiter chapter at 16 read as at 60 | the chapter's faculty words come from the age band of `PLANET_FACULTY` |
| Sensitive core | a frame on 8/12 with Ketu read in loss words | the brief's `SENSITIVE` line is set; the Oracle's passage rules apply |

The purview's output is a list of `{ rule, rows, affects: claimIds[], action: 'override' | 'veto' | 'annotate', text }`.
It is tested on the eight scenarios: S2 must produce the lagna-lord cap and the Moon override; S1 must produce the Moon
cancellation and the Dwisaptati applicability; S5 must set the sensitive line.

## 5. The auditor (`board.auditor`, agent `reading.auditor`, role `auditor`)

Two halves. The **code half** extends `research.technical_verifier` to production dossiers: every sentence of the reading
must map to claim ids; every claim id must map to rows in the dossier; every `must_not_say` phrase of the scenario (and
the global banned list of doc 45 §3.3) must be absent; every `must_say` present; every purview veto honoured; every date
in the reading equal to a stored period boundary. This half runs on every build, costs nothing, and fails the build on
any miss.

The **model half** runs on an advanced model (a separate env id, `READING_MODEL_AUDITOR`, defaulting to the strongest
paid id Sachin approves; never the Oracle's model) with its own prompt `oracle/auditor.md`: it receives the dossier (rules,
rows, yogas, clocks, purview, brief) and the reading, and for each sentence re-derives what the rows and rules allow,
grades it (`correct`, `overstated`, `understated`, `unsupported`, `contradicted`, `missed`: a row or rule in the dossier
that should have changed the sentence), and returns a 0–100 score, a verdict (pass ≥ 90 with no `contradicted`; warn
70–89; fail otherwise), and receipts. It is told that the dossier is complete and that anything not in it is not a fact
of this chart; it never computes; it names the rule and the row for every receipt. Its own prompt, input and output go
into the dossier's `audit` field.

A fail keeps the reading off the person's board (the previous passing reading, or the deterministic panels, show) and
raises a `reading_audit_failed` row in the admin app's activity page. A warn shows the reading and lists the receipts
for staff. The auditor runs on every scenario build in research staging and, in production, on every build until the
pass rate on real kundlis is above 95 percent for four weeks, then on a sample set by env.

## 6. A build with no live reads

The build is one function with one database read at the start and writes at the end.

1. **Bundle.** `assembleBundle(kundliId)` reads, in one transaction: the digest sections (house, planet, yoga, point,
   annual, star, all vargas the contracts name), the activation rows of every system (birth to +40 years, levels 1–3),
   the sky overlay covering today, the sealed facts (`person_facts` for the board), the kundli's preferred clock, and the
   current prompts and contracts (the registry's in-memory copy). It is one JSON document with a content hash, stored as
   a `technique_outputs` row (`technique = 'board.bundle'`, validity = the shortest of its parts), and uploaded once to
   the model's prompt cache as the shared prefix for every agent of this build (doc 57 §4.1: the pre-run upload). The
   bundle is the only thing the agents read.
2. **Slices and panels** run in process over the bundle (doc 58's slicers), no reads.
3. **Purview** runs over the bundle, no reads.
4. **Lineman agents** receive the cached prefix plus their slice keys; their claims go to the dossier and to
   `reading_findings_cache` keyed by bundle hash and prompt version, so a second build with the same bundle and prompts
   runs no lineman.
5. **Brief** is assembled in process from the claims and the purview; stored in the dossier.
6. **Oracle** receives the cached prefix plus the brief; output stored. **Validator** the same.
7. **Auditor** receives the cached prefix plus the dossier and the reading; output stored.
8. **Writes**: the dossier row, the panel outputs, the reading, `agent_runs`. One transaction.

Triggers: `digest` (new digest version), `dasha_boundary` (the reading clock's running L2 or L3 ends; the digest sweep
already knows the boundaries), `annual` (a new TP row), `confirm` (a sealed answer changes a gated claim), `manual`
(staff). A request from the person never builds; it reads the stored reading, or shows `preparing` and queues a build,
as the board does today. The memo and the findings cache survive Lambda recycling through `llm_cache_entries` and the
upload, as doc 57 designs; a cold Lambda reads the bundle from `technique_outputs`, never the digest tables.

What cannot be fully avoided, said plainly: the one bundle read; the write at the end; and the admin dossier page, which
reads `reading_dossiers` live for staff.

## 7. Deliverable

| Piece | Ships as |
|---|---|
| Scenarios | `docs/reading-engine/scenarios/self/S1..S8.md`; hydration of S2–S8 into research staging; S1 by kundli id |
| Dossier | migration `reading_dossiers`; `src/reading/dossier/` (assemble, write, read); admin page "Reading dossier" |
| Purview | `src/reading/purview/rules.ts` (catalogue rows with sources), `check.ts`; `PURVIEW` block in the brief; tests on S1, S2, S5 |
| Auditor | `src/reading/audit/` (code half over dossiers; model half behind `READING_MODEL_AUDITOR` and Sachin's yes); `oracle/auditor.md`; activity rows |
| Bundle | `board.bundle` technique; `assembleBundle`; the pre-run upload wired to it; findings cache keyed by bundle hash |
| Docs | this doc; the catalogue rows; `docs/TODOS.md` for anything found |

## 8. Action steps in sequence

1. Scenario files S1–S8 with `must_say` / `must_not_say` and the hand-written expected reading (agent drafts; Sachin
   reviews S1 himself, since only he can say whether the previous chapter is recognisable). Parallel with 2 and 3.
2. `reading_dossiers` migration and `assembleBundle`; the build writes a dossier with every field except `oracle` and
   `audit`. Done: a dossier for S1 lists every row the panels read, and the panels read nothing else.
3. Purview rules as catalogue rows with sources; the check; the `PURVIEW` block; vetoes honoured by the panels. Done: the
   S2 build caps footing claims and overrides the Moon; S1 states the cancellation.
4. The code auditor over production dossiers; fail blocks the board. Done: a reading with a date not in the calendar
   fails; S5 with a banned word fails.
5. Hydrate S2–S8 in research staging; run build, purview and code auditor on all eight; fix until all pass.
6. The bundle upload and the findings cache keyed by bundle hash; the lineman agents and the Oracle read the prefix.
   Done: a second build of S1 with no change runs zero model calls and zero digest reads.
7. The auditor's model half on the eight scenarios (count and cost to Sachin first: eight builds × one call on the
   advanced model). Done: receipts reviewed by Sachin on S1.
8. The Oracle prose (doc 58's model layer) on the eight scenarios, audited; then on real kundlis behind the flag.

## 9. Development phases

| Phase | Steps | Leaves the system | Check |
|---|---|---|---|
| A: record and veto | 1, 2, 3, 4 | Every build has a dossier; the purview corrects the panels; the code auditor gates the board; no model cost | Dossiers for S1 in admin; purview tests; a failed build is blocked |
| B: scenarios | 5 | All eight scenarios pass the code auditor in staging | The staging report per scenario |
| C: no live reads | 6 | Agents read the bundle only; repeat builds cost nothing | Zero reads and zero calls on an unchanged rebuild, in the trace |
| D: the auditor's judgement | 7 | The advanced model grades every scenario build | Sachin reviews S1's receipts |
| E: the Oracle | 8 | The guru prose, audited, on real boards behind the flag | Pass rate on real kundlis above 95 percent for four weeks |
| F: what changes day to day (Sachin's phase 3 or 4) | §11 | The Self reading gains a "right now" layer at the pratyantardasha, sookshma and hora grain, refined against what the person confirms | The day layer audited the same way; a two-week diary on S1 |

## 11. The later phase: what actually changes day to day for the Self

Sachin, same evening: after the chapters and the parts are right, start reviewing what actually changes for the self
hour to hour, day to day, over a few days and over a week; that is where the pratyantardasha comes in, and it needs
finesse and refinement. This is a later phase of development, not part of phases A to E, and it is written here so the
dossier, the purview and the auditor are built to hold it from the start.

What it reads (all stored already or stored by doc 47's day tables; nothing computed in Node):

| Grain | Clock | Rows | What it can say about the self |
|---|---|---|---|
| A few weeks | pratyantardasha (L3) of the reading clock, with the confirming clocks' L3 where present | `kundli_activation` level 3 | the sub-sub-chapter: which faculty of the self is pressed or carried this fortnight, from the L3 lord's chain and its relation to the L2 and L1 lords |
| Days | sookshma (L4) where the engine serves it; the Moon's transit sign and star over the natal Moon and lagna; tara bala and chandra bala | `lucky_day_tables`, the shared sky | the mood and footing of the day: the Moon's house from the natal Moon, the tara of the day's star from the birth star |
| Hours | hora lord; the day's lagna by hour from the stored day tables; the muhurta rows | `lucky_day_tables` | the hours in the day that carry or press the self's faculty of the fortnight, as Lucky times already does for places |

How it is shown: a "Right now" strip above the chapters on the You board: this fortnight (the L3 line, dated), today
(the Moon line), the next good hours (from the day tables), each with "Chart details" one tap down. Words from the same
tables as doc 58; nothing on the strip that the dossier does not carry.

The finesse Sachin names is in two places. First, the rule of combination: an L3 lord's result is read through the L2
and L1 lords (the pratyantar gives the result of its lord as modified by the antar and the maha), so the strip never
contradicts the chapter above it; the purview carries a rule for this (`bphs.pratyantar.through_antar_and_maha`) and
vetoes a day line that reverses the fortnight. Second, confirmation: the day layer is the one place the person can tell
us within hours whether a line fit; the confirm question moves to the strip in this phase ("Did today feel like that?"),
answers are sealed per day, and the auditor's receipts on the day layer are the refinement loop. The dossier records the
day rows and the answers; a diary of two weeks on S1 (Sachin) is the acceptance test of the phase.

Not before phases A to E: a day layer on top of unaudited chapters would be refinement of something not yet shown to be
right.

## 10. Recommendation

**Build the dossier and the purview first, deterministically, then the scenarios, then the no-live-reads bundle, then the
auditor's model half, and the Oracle prose last.** The order is the order of what makes the next step possible: the
auditor cannot grade what is not recorded; the Oracle should not write before the auditor can catch it; nothing should
cost money before the scenarios pass in code.

| Choice | Verdict |
|---|---|
| Dossier and purview before any model call (chosen) | Research grade is a property of the record, not of the prose; the record costs nothing |
| Auditor on the Oracle's own model | Same blind spots; a separate, stronger model with its own prompt is the point |
| Audit only in research staging | Real people's readings are what must be right; staging is where the scenarios live, production is where the auditor earns its keep |
| Let the agents read the digest tables live | Breaks the dossier's completeness guarantee and doc 57's cache design; the bundle is the only input |
| Fewer scenarios | S1 alone proves one chart; S2 and S5 are where generic readings fail |
