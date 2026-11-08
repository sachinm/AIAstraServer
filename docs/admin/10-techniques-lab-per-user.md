# 10 — Techniques Lab: run each board technique for one person and see its inputs, flow, brief, output and quality

Status: **plan, 2026-11-07,** from Sachin's question that night: is there already an admin page where the techniques
that put together the Self, Love and Work dashboards can be tested per auth user, each run on its own, with the inputs,
the process flow, what the synthesizer (the Vedic Astrological Oracle) received, and the final output visible; and if
not, build it, with QA and quality-of-service per technique. Companion to server docs/reading-engine/58–61 and
docs/admin/09. Built in `aiadastra_admin` (web and api) with one new read surface on the server.

## 1. Start: what exists today (checked 2026-11-07, admin `develop`, server plan branch)

| Page or route | What it does | What it does not do |
|---|---|---|
| **Techniques** and **Techniques/:id** (`/api/admin/techniques`, `/techniques/:id`, `/techniques/:id/runs`, `/technique-runs/:kind/:id`, `/review`) | The catalogue with runs in the last 30 days, failure rate, cost, accuracy from people's answers; a run drawer with tokens, timing and filtered input and output summaries; staff reviews right / wrong / unsure | Cannot start a run. Shows summaries through `safeSummary` (strings over 80 characters dropped), never the slice, the brief, the prompt or the full output |
| **Machinery** (`/api/admin/machinery`) | Pieces, recipe families, freshness and validity windows | Nothing per person |
| **Research Lab** (`/api/admin/research-lab`, `/hydrate`, `/verify`) | Twenty synthetic subjects, a temporal zoom, a ten-step trace and an eight-gate verifier | The admin API builds its runs itself with `synthesizeAdminResearchRun` from seed templates (tone from whether the AD lord is Saturn, Rahu or Ketu; fixed phrases). It does not call the server pipeline, so what it shows is a template, not a reading. Not per auth user |
| **Users/:id** | Masked identity, plan, quota, the research flag (`auth.research`, which only unlocks sidebar columns on the customer site), digest status and a rebuild button | Cannot run or inspect a technique |
| Server `/api/research/*` | Hydrates presets through the real pipeline into `research_*` tables and runs the code verifier | Admin does not call it yet |

**Answer: no.** There is no page where staff pick a real person, run one technique of a board, and see what went in,
what each step did, what the Oracle received and what came out. The Research Lab looks like one and is not; its runs
are synthesized in the admin API. That is filed as P1 in the server's `docs/TODOS.md`.

Privacy rules that bind this page (`docs/01-architecture-and-api.md` §3; `api/tests/noPersonalFields.test.ts`): no
personal field leaves the admin API except a masked email and name and the logged reveal; birth date, time and place
are personal fields; the engine's name never appears; `reading_traces.question` is never selected.

## 2. End goal

A superadmin opens Techniques Lab, picks a person by masked email (only people with `auth.research = true`, which
becomes the consent flag for staff inspection, set by a superadmin and logged), picks a board and a technique, presses
Run, and in under ten seconds sees, on one page: the inputs (the bundle keys and the rows the technique read, with
values), the flow (each step with its milliseconds and whether it hit a cache), the purview's overrides on it, the
lineman claims if the technique has a model reader, the brief exactly as the Oracle received it (when the model layer
is on), the output as the person's board would show it, the code auditor's verdict with receipts, and the cost. They
can run the whole board the same way, compare two runs, mark a run right / wrong / unsure, and open the stored dossier
of any past build. Nothing on the page shows birth data or a name; the chart's placements are shown as placements.

## 3. Deliverable

| Side | Ships |
|---|---|
| Server | `GET /api/admin-lab/people` (research-consented people, masked), `POST /api/admin-lab/run` `{ userId, board, technique \| 'all', asOf?, force? }` → a `LabRun` (dossier shape, doc 60 §3, with birth fields stripped), `GET /api/admin-lab/runs/:id`, `GET /api/admin-lab/dossiers?userId&board` ; all behind the admin service token and `auth.research`; every run writes `agent_runs` and an `admin_actions` row (`lab.run`, user id, technique, as-of; never output) |
| Admin API | `admin/lab.ts` proxying the four routes with the staff role check (superadmin for run; admin may read), `safeSummary` not applied to the dossier because it carries no personal keys by construction (a contract test asserts the forbidden-column list against `LabRun`) |
| Admin web | `pages/TechniquesLab.tsx` with sub-tabs Inputs, Flow, Purview, Linemen, Brief, Output, Audit, Cost; a run picker; a compare view; the review buttons from the run drawer |
| Docs | this doc; `docs/01-architecture-and-api.md` §4 rows; `docs/TODOS.md` entries |

## 4. Exactly how it works when done

### 4.1 Backend (server)

`POST /api/admin-lab/run` calls the same build the person's board uses (doc 58 `getSelfReading` and doc 60's bundle
build) with `{ force, asOf, technique }`: `technique = 'all'` builds the board; a technique id builds one panel over
the stored bundle (the bundle is assembled once per person per day and reused, so a single-panel run reads no digest
tables). The run writes a dossier row with `trigger = 'manual'` and `requested_by = 'lab'`, and returns it with the birth
fields removed and the kundli id replaced by a lab run id. Timeouts: 20 s, then 503 `lab_slow`; a model call that
would exceed the person's daily cap or the lab's own cap (`LAB_DAILY_USD`, default 2) is refused with 409 `lab_budget`.
Concurrency: one lab run per person at a time (an advisory lock on the kundli id), five per instance.

`GET /api/admin-lab/dossiers` lists stored dossiers (built_at, trigger, clock, audit verdict, cost) for a person and
board; `GET /runs/:id` returns one. Nothing here is served to customers; the routes mount only when `ADMIN_LAB=1` and
require the admin service token.

### 4.2 API (admin)

| Method and path | Body or query | Response |
|---|---|---|
| `GET /lab/people` | `?q` (masked match) | `{ items: LabPerson[] }` (user id, masked email, consent at, kundli present, digest status, preferred clock) |
| `POST /lab/run` (superadmin) | `LabRunBody` | `LabRun` (the dossier, stripped); errors `lab_slow`, `lab_budget`, `no_consent`, `preparing` |
| `GET /lab/runs/:id` | | `LabRun` |
| `GET /lab/dossiers` | `userId`, `board` | `{ items: LabRunSummary[] }` |
| `POST /lab/runs/:id/review` | `ReviewBody` | as technique-runs review; writes `admin_actions` `lab.review` |

### 4.3 Frontend experience (admin web)

Techniques Lab page: a person picker (masked emails, consented only), a board tabs row (Self, Love, Work), a technique
list for the board (from the catalogue, with freshness and last run), an as-of date, a Run button and a Run board button.
While running: a stepper (bundle → slices → panel → purview → linemen → brief → Oracle → validator → auditor) with
elapsed ms per step filling in as the server streams NDJSON section timings (the page-performance channel of docs/admin/08).
On completion, sub-tabs:

- **Inputs:** the bundle keys the technique declared and the rows read, as a tree with values; a count of rows available
  but unread (so a reviewer sees what the technique ignored).
- **Flow:** the steps with ms, cache hit or run, and the code version and prompt version used.
- **Purview:** overrides, vetoes and annotations with the rule, its source and the rows.
- **Linemen:** per reader, the slice keys, the claims returned, the claims dropped by grounding and why.
- **Brief:** the text as sent to the Oracle, byte for byte, read-only, with a copy button; empty with "model layer off"
  when it is off.
- **Output:** the panel or board rendered with the customer components (`AreaBoardView` shared through the contract) so
  staff see exactly what the person would, each line expandable to its claim ids and rows.
- **Audit:** the code auditor's verdict and receipts; the model auditor's when it ran; the review buttons.
- **Cost:** tokens, cached tokens, USD, ms, cache hits, against the lab's daily cap.

Compare: two runs of the same person and technique side by side, lines diffed by claim id. Failed states: a 503 shows
the step that timed out; a 409 budget shows the cap and today's spend; `preparing` shows the digest status and the
rebuild button from the User page.

### 4.4 UI words

"Techniques Lab"; "Run this technique"; "Run the whole board"; "What it read"; "What it did"; "What the whole chart
said" (purview); "What the readers found"; "What the Oracle received"; "What the person sees"; "Was it right?"; "What it
cost". Never an engine name, never a birth field, never the person's name.

## 5. Architecture

```
admin web ── admin api (/lab/*, role + consent check, admin_actions) ── server (/api/admin-lab/*, service token, ADMIN_LAB=1)
                                                                          └─ doc 60 build: bundle (technique_outputs) → panels → purview → linemen → brief → Oracle → validator → auditor
                                                                          └─ reading_dossiers (stripped on the way out), agent_runs
```

Boundaries: the admin API never reads `kundlis`, `kundli_data` or `auth` birth columns for this page; the server strips
birth fields before the response and a contract test in both repos asserts it; consent is `auth.research`, set only by a
superadmin with a logged action; the lab's model spend is capped separately from customers' and is reported on the
Cost tab and the Agents page.

## 6. Ingredients

| Need | Who |
|---|---|
| Doc 60's dossier and bundle build on the server (the lab reads them; without them the lab shows summaries only) | Self-dashboard session |
| The server admin service token path (exists for `/api/admin/*` metrics; reuse) | admin build session |
| Consent semantics: `auth.research` becomes "staff may inspect this person's readings"; the customer-site sidebar columns stay as they are | Sachin to confirm the wording shown to the person in Profile |
| `LAB_DAILY_USD`, `ADMIN_LAB` env on the server Lambda; deploy through the deploy sub-session | deploy session |
| A test person: Sachin's own account with `auth.research = true` | Sachin |

## 7. Action steps in sequence

1. Server: `/api/admin-lab/*` over the doc 60 build with `trigger = 'manual'`; birth-field stripping and its test;
   caps and locks. Depends on doc 60 phase A (dossier). Done: a run for Sachin's kundli returns a stripped dossier.
2. Admin API: `admin/lab.ts`, contract types, role and consent checks, `admin_actions` rows, the forbidden-column test
   over `LabRun`. Parallel with 3.
3. Admin web: the page with the picker, the stepper, the eight sub-tabs, compare, review. Parallel with 2 against the
   contract types.
4. Replace the Research Lab's `synthesizeAdminResearchRun` with calls to the server's `/api/research/*` so its runs are
   real; its presets become doc 60's scenario subjects. Done: the Research Lab shows the same dossier shape as the lab.
5. `docs/01-architecture-and-api.md` rows; deploy admin API and web through the deploy session.

## 8. Development phases

| Phase | Steps | Leaves | Check |
|---|---|---|---|
| A: read-only lab | 1 (dossiers list and get only), 2, 3 without Run | Staff can open any stored dossier per consented person, every tab but Flow-live | Sachin opens his own last build in the lab |
| B: run on demand | 1 (run), 3 (stepper, compare) | Staff run one technique or a board and see every step | A single-panel run reads zero digest tables (trace) |
| C: real research lab | 4 | The Research Lab is the scenarios lab of doc 60 | S1–S8 runs appear with dossiers |

## 9. Recommendation

**Build the lab as a viewer of doc 60's dossiers first, then add Run.** The dossier is the thing worth looking at; a
Run button without a dossier shows summaries, which is what Techniques/:id already shows. The Research Lab's synthesized
runs should be replaced, not extended: a lab that shows template text as if it were a reading will mislead the review it
exists to support.

| Choice | Verdict |
|---|---|
| Lab as dossier viewer, then Run (chosen) | Every tab has real content from day one; Run adds only the trigger |
| Extend the Research Lab page | Its data is synthesized in the admin API; extending it keeps the illusion |
| Show the brief through `safeSummary` | Drops every sentence over 80 characters; the brief is the point |
| Let the admin API call the digest tables directly | Breaks the privacy boundary and the no-live-reads rule; the server strips and serves |
