# 03 — Techniques and agent analytics in the Admin Panel

Status: **build plan, 2026-11-05, executing.** Sachin's brief:

1. Every sub-agent of the General Reading carries a **type** and the **id of the agent that ran**, with **what it worked
   on**, so each run counts in analytics. The techniques go in the Admin Panel by category (**Self, Love, Work**), so
   the agents and sub-agents can be analysed per specialised task.
2. The Admin Panel gets a new **Techniques** menu that tracks every function behind the boards and categories. For
   each function it shows whether it runs properly, and which charts it uses: divisional charts, transits, Tithi
   Pravesha, dashas, and anything special it does. The algorithm is logged per function and reviewed for accuracy
   there.

## 1. Start (facts checked 2026-11-05 on `develop` 3016c68)

| Fact | Where |
|---|---|
| **Board runs.** `agent_registry` (id, title, kind `engine_pull·code·llm`, module, sub_module, model, prices) and `agent_runs` (agent_id, user_id, module, sub_module, task, status, input/output summary, ms, tokens, cost) exist. `withAgentRun()` writes one row per run and never breaks the request. Five agents are registered beside the seven reading roles. | `src/agents/registry.ts`, migration `20261105180000_lucky_registry_analytics` |
| **Board agents.** Board work runs through 5 agents: `lucky.day_tables`, `lucky.day_overlay`, `lucky.scenario_windows`, `area.career_inputs` and `area.career_map`. None of them records which category, board or technique it served, or which charts it read. | `src/reading/luckyTimes/service.ts`, `src/reading/area/careerService.ts` |
| **Reading spans.** General Reading writes `reading_traces` and `reading_agent_spans`. The span fields `agent` (a name such as `dasha`, `specialist:dasha`, `R3` or `oracle`), `agent_kind` (reader, specialist, oracle, validator, intake, clarify, step), `subject` and `tier` exist. A span has no registry id, technique or category, so it cannot be joined to `agent_registry`. | `src/reading/metrics/trace.ts`, migration M24 |
| **Subjects.** General Reading covers 17 subjects (career_work … explain_term). Each frame names its houses, karakas, vargas (D10, D9, D7 …), arudhas and special lagnas. | `src/reading/packs/frames.ts` |
| **Work board.** The career map is built: five voting families (main clock = Vimshottari, sign clock = Narayana, short clocks = Yogini + Tithi Ashtottari, slow transits = transit contacts + double transit, Jaimini points). It also gives the present tone, security grade per month, sub-area windows, horizons and Looking back. The families not built are the conditional clock, this year's chart (Tithi Pravesha) and the karaka clock. D10 waits for the house-state engine. | `src/reading/area/career.ts`, docs/reading-engine/43 §8 |
| **Lucky times.** 13 scenarios in 6 areas. Each is a rule row (tithi groups, star groups, weekdays, hora lords, hours, floor, source) scored by `windows.ts`. | `src/reading/luckyTimes/scenarios.ts`, `windows.ts` |
| **You and Love boards.** Not built. They wait on the house-state engine of doc 46: 7 layers (promise, affliction, activation by every dasha, transit, annual chart, owning varga, nakshatra charter), with evidence rows carrying provenance. | docs/reading-engine/45, 46 |
| **Accuracy evidence that exists.** `area_checks`: the person's yes / partly / no / skip to a Looking-back moment, per area and month. Nothing else records whether a technique was right. | `prisma/schema.prisma` `AreaCheck` |
| **Admin Panel.** It has Users, Queries and Agents (speed and tokens from the spans). There is no registry, technique or accuracy page. | `aiadastra_admin` |

Symptom today: staff cannot answer "is the career present-tone function working, and was it right?", or "how long
does the dasha analyst take on Love questions?".

## 2. End goal

- Staff open **Techniques** and see three tabs, **Self · Love · Work**, plus **Lucky times** and **General**.
- Each tab lists every function and technique of that category: its name, status (built, partial, planned), runs in
  the last 7 days, failure rate, p50 and p95 time, and average cost.
- Each row shows chart chips (D10, D9, Vimshottari, Yogini, Narayana, transits, Tithi Pravesha, panchang …) and an
  accuracy figure, or "no evidence yet".
- A technique opens to:
  - its algorithm in plain steps, its source and doc;
  - the agents that implement it;
  - a 14-day chart of runs and failures;
  - accuracy (people's confirmations and staff reviews);
  - its recent runs.
- A run opens to its timings, the charts it read (type, variant, calc version), its input and output summaries, and
  the reviews. A staff member marks it **Right · Wrong · Unsure** with a short note. The review is audited.
- **Agents** gains a **Registry** tab: every agent with its id, type, model and price. Averages can be grouped by
  agent, technique or category, so "the dasha analyst on Love questions" is one row.
- No question text and no birth data appear anywhere, as in doc admin/01.

## 3. Deliverable

| Area | Items |
|---|---|
| Server (AIAstra_Server) | `src/techniques/catalog.ts` (the technique catalogue, code); `src/techniques/categories.ts` (subject → category, lucky area → category); registry additions in `src/agents/registry.ts` (the graph analysts, readers, oracle, validator, clarify as their own ids); `withAgentRun` takes `technique`, `kundliId`, `charts`, `subject`; the five board call sites pass them; `trace.ts` writes `agent_id`, `technique_id`, `category` on every span; boot seeds `technique_registry`; migration M29; tests |
| Migration | `20261106010000_techniques_m29` (below). Additive only |
| Admin API (aiadastra_admin/api) | `src/admin/techniques.ts`: list, detail, runs, run detail, review; `GET /agents/registry`; `groupBy` on `/stats/agents`; contract types; SQL check additions; tests |
| Admin web | Menu item **Techniques**; pages `Techniques` (tabs), `Technique`, run drawer with review; **Registry** tab and group-by on `Agents`; tests |
| Docs | this plan; AGENTS.md rule "every agent and function is registered and tagged"; admin `docs/01-architecture-and-api.md` routes |

## 4. How it works when done

### 4.1 Backend

**The catalogue (code, seeded at boot).** `TECHNIQUES: TechniqueDef[]`, one entry per function or technique:

```ts
{
  id: 'work.present_tone',             // <category or board>.<name>
  title: 'Present tone',
  category: 'work',                    // self | love | work | general
  board: 'work',                       // you | love | work | lucky | chat
  status: 'built',                     // built | partial | planned
  charts: [                            // what it reads, declared
    { source: 'dasha', id: 'vimshottari' }, { source: 'dasha', id: 'yogini' },
    { source: 'dasha', id: 'tithi_ashtottari' }, { source: 'dasha', id: 'narayana' },
    { source: 'transit', id: 'transit_contacts' }, { source: 'jaimini', id: 'modifier' },
  ],
  algorithm: ['Group the systems into five voting families', '…'],   // plain steps
  special: 'Short clocks vote only when Yogini and Tithi Ashtottari agree',
  source: 'docs/reading-engine/43 §8.1',
  code: 'src/reading/area/career.ts presentState',
  agents: ['area.career_inputs', 'area.career_map'],
  accuracy: 'area_checks:career',      // area_checks:<area> | staff | none
}
```

- **Chart sources:** `natal · divisional (D1…D60) · dasha (vimshottari, yogini, tithi_ashtottari, narayana, chara,
  conditional …) · transit (transit_contacts, double_transit, sade_sati, eclipses) · annual (tithi_pravesha, varsha) ·
  panchang (tithi, nakshatra, hora, muhurta, kalams) · nakshatra · jaimini · ashtakavarga`.
- **v1 rows:**
  - **Work** (built): `present_tone`, `security_grade`, `subarea_windows`, `horizons`, `looking_back`.
  - **Work** (planned): `annual_family` (Tithi Pravesha), `conditional_family`, `karaka_family`, `d10_check`.
  - **Lucky times** (built): one per scenario (`lucky.work.sign_contract` …), plus `avoid_bands`, `personal_overlay` and
    `day_tables`. Each scenario row lists its tithi, star, weekday and hora rules as its algorithm, with its source.
  - **Love and Self** (planned): one row per house-state layer (doc 46 §B.2–B.8: promise, affliction, activation,
    transit, annual, varga, nakshatra), for house 7 with D9 under Love, and houses 1, 4 and 5 with the Moon under Self.
  - **General** (built): one row per General Reading analyst and reader.
- **Seeding:** at boot the catalogue is upserted into `technique_registry`, like `seedAgentRegistry`. It is
  idempotent, and a failed seed is logged once and never blocks start-up.

**Categories.** `categoryOfSubject(subject)` maps each subject to a category:

| Category | Subjects |
|---|---|
| work | career_work, income_wealth, debt_loss_expense, litigation_government, speculation_lottery |
| love | marriage_relationship, children |
| self | health_body, education_learning, spirituality_moksha, general_life_direction, property_home, vehicles, siblings, foreign_relocation, travel_journeys |
| general | explain_term, or no subject |

`categoryOfLuckyArea` maps work and money to `work`, love to `love`, and travel, study and home to `self`.

**Board runs.** `withAgentRun(prisma, agentId, ctx, fn)`: `RunContext` gains the fields below, and the row gets the
matching columns.
- `technique?` (a catalogue id); `category` and `board` default from the catalogue entry when this is set.
- `kundliId?` and `subject?`.
- `charts?: Array<{ type, variant?, calc_version? }>`: the engine payloads the run actually read.
  - `area.career_inputs` passes the catalogue ids it loaded (`Object.keys(inputs.items)`) and each `transit_contacts`
    range.
  - `lucky.*` runs pass `muhurta` with the month.

An unknown technique id is logged once and the run is still written. The input and output summaries hold counts, ids,
tones and scores only. Never birth details, a place name typed by the person, or question text. A unit test asserts
this on every call site.

**General Reading spans.**
- **Registry id.** `trace.ts` gains `agentIdOf(name, kind)`, which gives every span a registry id:
  - graph analysts give `reading.analyst.<name>` (promise, dasha, transit, nakshatra, annual, prashna);
  - oracle readers `R1…` and `P…` give `reading.reader`;
  - `oracle`, `synth` and `addendum` give `reading.oracle`;
  - `validator`, `intake` and `clarify` give their own `reading.*` ids;
  - other steps give `reading.step`.
- **Technique.** `technique_id` is `general.<analyst>` for analysts and `general.reader` for readers.
- **Category.** It comes from `categoryOfSubject(span.subject ?? trace subject)`.
- **The run's id and work item.** The span's own `id` is the id of that run. The pair `agent` (instance: `dasha`,
  `R3`) plus `subject` is what it worked on.
- **Registry rows.** The analysts and the reader are added to `AGENTS` as `llm` agents with the specialist or reader
  role, so their model and price show.
- **Cost of the writes.** Writes keep the 300 ms batching, and a missing column falls back to the pre-M29 insert, as
  M24 did.

**Reviews.** These are written only by the admin API: `technique_reviews` (run kind + id, technique, verdict, note of
500 characters or less, admin id), in the same transaction as an `admin_actions` row.

**Accuracy.**
- `area_checks:<area>` joins the person's answers by area and month. The rate is yes / (yes + partly + no); skip is
  left out. The rate is shown only once there are 5 or more answers, otherwise "no evidence yet".
- Staff reviews count right, wrong and unsure.
- Engine checks (`house_state_checks`, doc 46 §D.2) join once that table exists.

**Limits.** Lists are read over 7 days by default (1, 7 or 30). The `statement_timeout` is 5 s. Runs are paged at 50
with a cursor.

### 4.2 API (admin API, `/api/admin`, staff token; reviews need admin or superadmin)

| Endpoint | Request | Response |
|---|---|---|
| `GET /techniques` | `?category=self\|love\|work\|general&board=&days=1\|7\|30` | `{ techniques: [{ id, title, category, board, status, charts[], runs, failed, p50_ms, p95_ms, avg_cost_usd, last_run_at, accuracy: { source, n, rate \| null, reviews: { right, wrong, unsure } } }] }` |
| `GET /techniques/:id` | `?days` | the catalogue row (algorithm, special, source, code, agents) + `daily: [{ day, runs, failed, p50_ms }]` + `agents: [{ id, kind, model, runs, avg_ms }]` + `accuracy` |
| `GET /techniques/:id/runs` | `?cursor&status` | `{ runs: [{ kind: 'agent_run'\|'span', id, at, ms, status, user: masked, category, subject, cost }], next }` |
| `GET /technique-runs/:kind/:id` | | `{ run: { …timings, tokens, charts[], input_summary, output_summary, agent_id, technique_id }, reviews[] }`; 404 |
| `POST /technique-runs/:kind/:id/review` | `{ verdict: right\|wrong\|unsure, note? }` | 201 `{ review }`; 400 bad verdict or a note over 500 characters |
| `GET /agents/registry` | `?days` | `{ agents: [{ id, title, kind, module, sub_module, model, price_in, price_out, runs, avg_ms, p95_ms, avg_cost_usd }] }` (runs from both `agent_runs` and stage spans) |
| `GET /stats/agents` | adds `?groupBy=agent\|agent_id\|technique\|category` | same shape, keyed by the chosen group |

Errors use the existing `{ error: { code, message } }`. A technique list before M29 returns 503 `not_migrated`.

### 4.3 Frontend experience

- **Techniques.**
  - Tabs: Self · Love · Work · Lucky times · General, each with a 1d / 7d / 30d selector.
  - The table has a status pill, chart chips, runs, failure %, p50 / p95, cost and accuracy.
  - Planned rows are greyed and show "not built".
  - Loading shows skeleton rows; an error shows a retry line; an empty tab says "No runs in this window".
- **Technique.** Header (title, status, category, board), the algorithm as a numbered list, a "Special" line, chart
  chips, the source and code path, a runs/failures bar chart for 14 days, an agents table, an accuracy card, and
  recent runs with a status filter.
- **Run drawer.** Timings, tokens and cost; charts read, as `type · variant · calc version`; input and output
  summaries as key-value lists; reviews; Right / Wrong / Unsure buttons and a note box. A review saves, shows
  "Saved", and appears in the list.
- **Agents.** The tabs are Speed (today's page, now with a group-by selector) and Registry.

### 4.4 UI/UX words

The menu says "Techniques". The statuses read "Built", "Partly built" and "Planned".

Accuracy reads one of three ways:
- "People confirmed 7 of 10 (70 %)", from 5 or more answers;
- "No evidence yet", below that;
- "Staff: 3 right · 1 wrong".

The review buttons are "Right", "Wrong" and "Unsure", with a "Note (optional)" box. Chart chips use the engine's terms (D10,
Vimshottari, Tithi Pravesha). This is a staff site, so technique terms are allowed here, but the engine's own name is
not.

## 5. Architecture

```
user app ─► main API Lambda ─► withAgentRun / ReadingTrace ─► agent_runs, reading_agent_spans (tagged)
                    │ boot: seedAgentRegistry + seedTechniqueRegistry ─► agent_registry, technique_registry
staff ─► admin web (Amplify, WAF) ─► admin API Lambda (CloudFront, WAF) ─► same Postgres (read; reviews + admin_actions write)
```

- **Shared rule.** The catalogue is code in the server repo and is copied to the database on boot. The admin reads the
  table, so it never imports server code.
- **Accuracy.** It comes only from stored answers and reviews. Nothing in the admin recomputes a technique.

## 6. Ingredients

- No new libraries.
- Migration M29, applied under the standing OK for additive migrations.
- No new env vars and no IAM changes.
- The deploy session ships the server and the admin, as before.
- Test data: existing `agent_runs` and spans on the shared database. The SQL check uses EXPLAIN on writes.

### Migration M29 (`prisma/migrations/20261106010000_techniques_m29/migration.sql`)

```sql
CREATE TABLE IF NOT EXISTS technique_registry (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('self','love','work','general')),
  board text NOT NULL,
  status text NOT NULL CHECK (status IN ('built','partial','planned')),
  charts jsonb NOT NULL DEFAULT '[]',
  algorithm jsonb NOT NULL DEFAULT '[]',
  special text,
  source text,
  code_ref text,
  agents jsonb NOT NULL DEFAULT '[]',
  accuracy text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS technique_registry_category ON technique_registry (category, board);

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS technique_id text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS board text,
  ADD COLUMN IF NOT EXISTS kundli_id text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS charts_used jsonb;
CREATE INDEX IF NOT EXISTS agent_runs_technique ON agent_runs (technique_id, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_category ON agent_runs (category, started_at DESC);

ALTER TABLE reading_agent_spans
  ADD COLUMN IF NOT EXISTS agent_id text,
  ADD COLUMN IF NOT EXISTS technique_id text,
  ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS reading_agent_spans_technique ON reading_agent_spans (technique_id, started_at DESC);
CREATE INDEX IF NOT EXISTS reading_agent_spans_agent_id ON reading_agent_spans (agent_id, level, started_at DESC);

CREATE TABLE IF NOT EXISTS technique_reviews (
  id text PRIMARY KEY DEFAULT (uuid_generate_v4())::text,
  run_kind text NOT NULL CHECK (run_kind IN ('agent_run','span')),
  run_id text NOT NULL,
  technique_id text,
  verdict text NOT NULL CHECK (verdict IN ('right','wrong','unsure')),
  note text CHECK (note IS NULL OR length(note) <= 500),
  admin_id text NOT NULL REFERENCES admin_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS technique_reviews_run ON technique_reviews (run_kind, run_id);
CREATE INDEX IF NOT EXISTS technique_reviews_technique ON technique_reviews (technique_id, created_at DESC);
```

There are no foreign keys from runs to `technique_registry`. A run must never fail because a catalogue row is late.

## 7. Action steps in sequence

1. **Migration.** Write and apply M29, and add the models to `schema.prisma` (`TechniqueRegistry`, `TechniqueReview`,
   plus the new fields on `AgentRun` and `ReadingAgentSpan`). Done: the migration is applied and `prisma generate`
   passes.
2. **Server tagging** (parallel with 3–4, in its own worktree). Write `catalog.ts`, `categories.ts`, the registry
   additions, `withAgentRun` fields, the five call sites, span tagging in `trace.ts`, and the boot seed. Tests cover:
   - every catalogue agent exists in the registry;
   - every registered board agent has a technique;
   - `categoryOfSubject` covers all 17 subjects;
   - span tagging for each kind;
   - summaries carry no personal keys;
   - the seed is idempotent.

   Done: tsc is clean, the area tests pass, and the branch is merged into `develop`.
3. **Admin API** (parallel with 2). Build `techniques.ts`, the registry endpoint, the group-by, the contract, the SQL
   check and the tests. Done: tsc, the tests and the SQL check against the database all pass.
4. **Admin web** (after 3's contract). Build the menu, pages, drawer, Agents tabs and tests. Done: tsc, the tests and
   the build pass, plus a local look with fixture data.
5. **Docs and rules.** Add the AGENTS.md rule and the admin route docs, and file the planned rows' owners in TODOS.
6. **Ship** through the deploy session: the server image, the admin Lambda and the admin web.

## 8. Development phases

- **T1. Tagging.** Steps 1 and 2. New runs and spans carry agent id, technique and category. Closing check: a local
  career build writes `agent_runs` rows with `technique_id` and `charts_used`.
- **T2. Panel.** Steps 3 and 4. Techniques, Technique, run drawer, Registry and group-by. Closing check: the tests and
  the SQL check pass.
- **T3. Accuracy grows.** Planned rows turn to built as the house-state engine lands. That engine calls
  `withAgentRun` with its layer's technique id, and that is its only contract with this plan. `house_state_checks`
  joins the accuracy card. Deferred: comparing a technique's prediction with ledger events (doc 45 rule 4) beyond the
  career area.

## 9. Recommendation

**Keep the catalogue in code and copy it to the database on boot.** Tag runs with a technique id when they are written.
Don't infer the technique later from agent names.

Code is where the algorithm lives, so a reviewer sees the steps beside the code path. The admin stays a reader of one
table, and old runs stay attributable after a rename.

| Option | Verdict |
|---|---|
| Catalogue in code, seeded (chosen) | One source and reviewable in git. The admin reads a table |
| Catalogue edited in the admin | Drifts from the code that runs. Staff are not the authors of algorithms |
| Infer technique from `agent`/`task` text at read time | Breaks on every rename. Cannot express the planned rows |
| Log the full algorithm trace per run | Large rows on the hot path. Charts read plus summaries is enough to review |
