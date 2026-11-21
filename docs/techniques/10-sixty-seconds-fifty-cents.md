# 10 · Sixty seconds and fifty cents: a hard limit on every dashboard read

Written 2026-11-21. Plan only; no code is changed by this document. It supersedes the time and money targets of plan 09
(`09-full-thread-reading-and-astrologer-voice.md`: first card 120 s, board 180 s, build under $1.50) and the staging
test proposed for retire-v2 ($1.50 cap, $2.00 stop). It sets the envelope; the shape of the pipeline inside it stays
with the pipeline's owner.

Sachin's instruction (2026-11-21): every dashboard or sub-dashboard read takes at most one minute and costs at most 40
cents, 50 cents as the hard cap; a technique that would take a read past 50 cents says so in the logs; a dashboard goes
live only after at least 25 test runs show it stays under.

## Five decisions for Sachin (defaults chosen so the build is not blocked)

1. **A person's first read cannot fit in 60 seconds as one piece.** The chart's shared groundwork (seven family
   readers, the clock sheets, the agreement ledger) takes 26 to 31 s by measurement before any card can start, the
   server's cold start adds about 7 s, and the cards then need about 45 s. That is 80 s or more however it is cut.
   *Default:* the groundwork becomes its own read, "Chart foundation", built once when the person finishes the
   welcome wizard. Every dashboard opened after that fits in its own 60 s. It costs about $0.13 to $0.20 per new
   person, paid whether or not they open a dashboard. *Alternative:* build it on the first open, which then takes two
   back-to-back reads (up to 2 minutes).
2. **Sixty seconds cuts the depth plan 09 asked for.** The model writes 85 to 120 tokens a second (measured). After
   the cold start and storing, about 49 s of writing is left on the longest path, which is about 3,000 tokens for the
   lens thread, the technical story and the plain story of one card together. Plan 09 planned 3,000 to 6,000 tokens
   for the technical story alone. The plain story of 350 words still fits.
   *Default:* accept the shorter technical story (about 1,400 tokens, roughly 950 words), and add "read deeper" on a
   card: one tap reads that card's long technical story as its own small read (at most $0.06 and 45 s).
3. **Prices double on 1 January 2027** for the model that writes the cards (`src/reading/llm/models.ts`,
   `PRICE_CHANGES`). A read that costs $0.36 today costs about $0.72 then. *Default:* the 25-run report states each run's
   cost at today's price and at the January price; dashboards go live on today's price; a re-fit for January is due by
   15 December (plain story on the cheaper reader model, shorter outputs, or a higher cap: your choice then).
4. **Chat answers and card-chat answers** use a single $0.45 cap today. *Default:* they take the same two numbers,
   $0.40 target and $0.50 hard cap. They already reserve before each call.
5. **The 25-run tests are paid.** Ten reads to prove (Chart foundation, Self, four Love lenses, four Work lenses), 25
   forced cold runs each, on the live Gemini key: 250 runs, expected about $75, stopped at $125 (every run at the
   hard cap). *Default:* one
   dashboard's 25 runs at a time, each batch on your yes, with its count and cost stated first.

## 1. Start (checked 2026-11-21: code on `develop` `3817d17`, deployed staging `0fc6bfa`, `agent_runs` of the last 14 days)

**Nothing limits a read's total time, and no money cap is checked before the money is spent.**

| Fact | Where |
|---|---|
| Every read (board open, lens refresh, one card's "Try again") queues the same Self build; a lens has no budget of its own | `src/reading/self/buildEvent.ts:319`, `boards/lensRefresh.ts:57,151`, `boards/v3Service.ts:352` |
| Per-call timeouts are longer than a minute: card Oracle 150 s plus a 150 s repair, card Personalizer 90 s, lens lineman 90 s, v2 Oracle 120 s | `config/env.ts:1053,1063,1073`; `self/v2/oracle.ts:56` |
| No timeout for a stage or for the build. A build counts as stuck only after 10 minutes; a failed one blocks the next for 30 | `buildEvent.ts:27,29` |
| Board cap $1.50 on `develop` ($0.45 deployed); per-card stop $0.12; chat $0.45 | `env.ts:1087,1092,951` |
| Caps are "spent so far ≥ cap" checks between steps. Spend is added only when a call returns | `cards/run.ts:298,459`; `self/agentTiming.ts:26` |
| Up to 12 cards start together under the cap, so they can overshoot together | `env.ts:1097`; `cards/run.ts:505` |
| Lens linemen are given no cap at all | `self/v3/build.ts:388` |
| Each later round (up to three) and each "Try again" starts with a fresh cap | `cards/run.ts:509-525` |
| A timed-out or failed call is recorded at $0 though it may be billed; creating the cached prefix (about $0.047 a build) is not priced | `agents/registry.ts:722`; `llm/models.ts:42-62` |
| A card can continue three times and be repaired once; a thin card is re-queued up to three times a day | `cards/oracle.ts:468-581`; `cards/run.ts:228` |
| `agent_runs` has no build id, and no log line or table holds a read's total cost and time | `prisma/schema.prisma:1012`; `buildEvent.ts:232` |
| No log line warns before a call that it will pass a cap | search of `src/reading` |
| Only a whole board can be held back (`BOARDS_V3`); nothing holds back one lens | `env.ts:1012`; `boards/features.ts:57` |

**Measured on the deployed pipeline** (grouped cards with the old v2 reading in front):

| Read | Cost | Time |
|---|---|---|
| Self, 18 Nov | $0.27 | 116 s |
| Self, 19 Nov | $0.28 | 162 s |
| Self, 21 cards replay, 11 Nov | $0.34 | 71 s |
| One clock sheet | $0.015 (p90 $0.022) | 19 s (p90 26 s, max 31 s) |
| One card, Oracle part | $0.012 | 15 s (p90 21 s) |
| Old v2 Oracle, then v2 Personalizer | $0.019, $0.026 | 29 s, 50 s |

So today's dashboards are inside the money limit and outside the time limit. **The `develop` pipeline (one story per
card, lens linemen) has never been measured**; plan 09's figures for it are estimates: Self of 11 cards about $0.65 and
150 s, a lens of 5 about $0.35 and 110 s. Both break the new limits.

Not verified: the server Lambda's own timeout (the repo says 300, 600 and 900 s in three places) and the live flag
values (AWS credentials had expired when this was written). Reading them is step 1.

## 2. End goal

- A **read** is one of: Chart foundation, the Self dashboard, one Love or Work lens, or one card on its own.
- Every read finishes within **60 s of the request** (cold start included) and costs **at most $0.50**, planned to
  **$0.40**.
- Before a read starts, its calls are planned against the two numbers; a call that would pass $0.50 is not started and
  a log line says which technique, what it was projected to cost and what was done.
- A dashboard's new reading is switched on only after **25 forced cold runs** in a row on the server, each with every
  planned card served at the depth floor, inside both limits.
- Failure modes removed: parallel overshoot, fresh caps on later rounds, linemen with no cap, unpriced cache creation,
  timed-out calls counted at $0, ten-minute "stuck" builds.

## 3. Deliverable

- **Code (server):** `src/reading/budget/` (new: `ledger.ts`, `deadline.ts`, `allowances.ts`, `plan.ts`, `unitLog.ts`);
  wiring in `self/v2/build.ts`, `self/v3/build.ts`, `cards/run.ts`, `cards/oracle.ts`, `lens/lineman.ts`,
  `clocks/run.ts`, `clocks/reader.ts`, `clocks/concordance.ts`, `families/run.ts`, `llm/gemini.ts` (retries ask the
  ledger), `self/buildEvent.ts` (markers per read); `config/env.ts` (two numbers replace three caps).
- **Migration (additive):** table `reading_units`; column `agent_runs.unit_id` with an index.
- **Tools:** `scripts/unit-budget.ts` (free projection per read from pack sizes), `scripts/unit-gate.ts` (runs and
  reports the 25), admin route `POST /api/admin-lab/unit-run` (queues one forced read on the server for a test chart).
- **Switch:** `READING_UNITS_LIVE` (list of read keys such as `self`, `love.dating`), checked against the gate record.
- **Tests:** unit tests for the ledger, deadline and planner; a CI test that the allowances of every read's largest
  deck sum to at most $0.40 and 60 s.
- **Docs:** this plan; `docs/billing/README.md` caps section; plan 09's targets marked superseded.

## 4. How it works when done

### 4.1 Backend

**The read.** `unit = { id, kind: foundation | self | lens | card, key, kundliId, requestedAt, deadlineAt =
requestedAt + 60 s, targetUsd 0.40, hardCapUsd 0.50 }`. One ledger and one deadline per read. Later rounds, re-queues
and repairs draw on the same ledger and the same deadline; nothing gets a fresh cap. "Try again" on one card is a
`card` read with its own smaller limits ($0.06, 45 s).

**Plan before spending.** `plan.ts` lists every call the read will make, each with its expected cost (the measured
p90 for that technique) and its ceiling (input tokens at the cached price plus its output cap and thinking budget at
the output price). If the expected total passes $0.40 the plan is trimmed in deck order (fewest cards dropped), and
the trimmed cards stay "not read yet" until the person opens them. The plan is logged.

**Reserve before each call.** A call asks the ledger for its ceiling. If `spent + reserved + ceiling > $0.50` the call
is not started and `reading.technique.over_budget` is logged. When the call returns, the reservation is replaced by
the actual cost. Rules that close today's leaks:
- twelve parallel cards each hold a reservation, so they cannot overshoot together;
- a repair, a continuation, the retry after a cache rejection (which pays the full-price prefix, about $0.047) and the
  client's retry on 429/500/503 are each a new reservation;
- a call that times out keeps its whole reservation as spent, because it may be billed;
- creating the cached prefix is priced and reserved like a call;
- whether the output cap also bounds thinking tokens is checked in step 2; until then the reservation adds the
  thinking budget on top.

**Deadline before each call.** A call is given `min(its allowance, time left − 3 s for storing)` as its timeout. A
call whose minimum time (its output cap at 85 tokens a second) no longer fits is not started and
`reading.technique.over_time` is logged. At the deadline the read stores what is complete and ends; an unfinished
card stays "not read yet". Markers: a read is stuck after 90 s (not 10 minutes); a failed read can be started again by
the person at once, and automatically after 2 minutes (not 30).

**Allowances** (`allowances.ts`; first values from arithmetic, replaced by measurement in phase 1):

| Technique | Time | Output cap | Expected cost | In which read |
|---|---|---|---|---|
| Cold start and queueing | 8 s | — | — | every read |
| Cached prefix creation | 3 s | — | $0.047 | every read that calls the card model |
| Family readers ×7, together | 20 s | 2,500 each | $0.02 in all | foundation |
| Clock sheets ×4–5, together | 28 s | 2,400 each | $0.015–0.022 each | foundation |
| Agreement ledger | 18 s | 1,500 | $0.01–0.03 | foundation; if cut, the counted statuses stand and the sentences follow next time |
| Lens thread, one per lens, together | 12 s | 900 | $0.011 each | self (five), lens (one) |
| Card technical story | 20 s | 1,500 + 400 thinking | $0.016 | self, lens, card |
| Card plain story | 14 s | 1,100 + 300 thinking | $0.011 | self, lens, card |
| Storing | 3 s | — | — | every read |

Longest path of a dashboard read: 8 + 3 + 12 + 20 + 14 + 3 = 60 s. There is no slack, which is why phase 1 measures
before these are fixed, and why the pipeline owner may choose a different shape inside the same total (for example the
lens thread written beside the technical stories and handed to the plain-story call, or both stories in one call).

**What each read costs at those ceilings** (arithmetic, not measured):

| Read | Calls | At the ceilings | Room for repairs |
|---|---|---|---|
| Chart foundation | 7 + 5 + 1 | $0.13–0.20 | to $0.50 |
| A lens, largest deck (11 cards) | 1 + 22 | $0.36 | two repairs and one full-price retry reach $0.44 |
| Self, 8 suggested cards | 5 + 16 | $0.32 | to $0.50 |
| Self, 11 cards | 5 + 22 | $0.40 | planner trims to 10 if the measured p90 is not lower |
| One card | 2 | $0.03–0.08 | cap $0.06 unless the prefix must be re-created |

### 4.2 API

No new public endpoint. `GET /api/self/v3` and `GET /api/board/:board/v3` gain `read: { state: planned | reading |
done | partial, cardsPlanned, cardsServed, deadlineAt }` in place of the open-ended build state. A lens whose key is
not in `READING_UNITS_LIVE` answers with its stored cards and starts no read. Admin only:
`POST /api/admin-lab/unit-run { kundliId, key, force: true }` → `202 { unitId }`; `GET /api/admin-lab/units?key=` →
the stored runs.

### 4.3 Logging and records

All lines are `console` JSON, so they reach CloudWatch (the queue log does not by default).

| Line | When | Fields |
|---|---|---|
| `reading.unit.plan` | before the first call | `unitId, key, kundliId, calls, cardsPlanned, cardsTrimmed[], expectedUsd, ceilingUsd, targetUsd, hardCapUsd, deadlineAt, pipelineVersion` |
| `reading.technique.over_budget` (warn) | before a call that would pass a limit | `unitId, key, technique, call, ceilingUsd, spentUsd, reservedUsd, wouldReachUsd, limit: target or hard, action: trimmed, not_started or allowed_over_target` |
| `reading.technique.over_time` (warn) | before a call that cannot fit | `unitId, key, technique, call, needsMs, leftMs, action` |
| `reading.unit.done` | at the end | `unitId, key, ms, msFromRequest, costUsd, costAtNextPriceUsd, calls, cardsPlanned, cardsServed, cardsAtDepth, complete, hitTarget, hitHardCap, hitDeadline, source: live or gate` |

The same end-of-read fields are one row in `reading_units`; every `agent_runs` row of the read carries its `unit_id`.
A static check also runs with no model: `scripts/unit-budget.ts` prints each read's expected and ceiling cost from the
pack sizes and the allowances, and exits non-zero when any read's largest deck passes $0.40 or 60 s. CI runs it, so a
prompt or pack that grows past the limit is caught before it ships.

### 4.4 The 25-run gate

- A run counts only if it ran on the staging server (cold start and network included), was forced cold (no stored
  card reused), used the read's largest deck, and ended `complete`: every planned card served at the depth floor.
  A read that stays under the cap by cutting cards off does not pass.
- 25 runs across at least five test charts, five each. Pass: all 25 at most $0.50 and 60 s, and the median at most
  $0.40. The report gives p50, p90 and the maximum of cost and time, and the cost at the January price.
- The record is keyed by the pipeline version: the prompt version, the model ids, the flags that shape the pipeline,
  the allowances and the price table in force. A change to any of them voids the 25.
- `READING_UNITS_LIVE` may name a read only when its gate record exists for the version being deployed; the server
  logs `reading.unit.gate_missing` and keeps that read switched off otherwise.

### 4.5 Frontend and UI/UX

A card that was trimmed or not finished shows "Not read yet" with "Read this card" (the existing state and button).
Cards appear as each finishes, as today. The reading line counts to the deadline ("Reading 6 of 9") and never runs past
a minute. Dashboards served by today's pipeline look as they do now until their new reading is switched on.

## 5. Architecture

- **Request path:** queues a read, answers at once, as today.
- **Async invoke:** one read = one ledger, one deadline, one plan. Stages call models only through the ledger.
- **Store:** each finished piece is stored when it finishes (family findings, sheets, threads, cards already are), so
  a read cut at the deadline loses nothing and the next read starts from what is stored.
- **Guarantees:** the hard cap holds because every billable request reserves first; the deadline holds because every
  call's timeout is derived from the time left; "live" holds because the switch is checked against the gate record.
- **Not guaranteed:** the provider billing a timed-out call for more than its reservation (bounded by the output cap).

## 6. Ingredients

- Libraries: none. Reuse the reservation pattern of `src/reading/oracle/costGuard.ts` and `cardChat/answer.ts`.
- Env: `READING_SPEND_TARGET_USD` (0.40), `READING_SPEND_HARD_CAP_USD` (0.50), `READING_UNIT_DEADLINE_MS` (60000),
  `READING_UNITS_LIVE`, `READING_UNIT_ENFORCE` (`observe` or `enforce`). Retired: `READING_BOARD_SPEND_CAP_USD`,
  `READING_CARD_SPEND_CAP_USD`, `READING_SPEND_CAP_USD`.
- Migration: `reading_units`, `agent_runs.unit_id` (small; the disk check runs first).
- Test charts: the six on staging. Paid runs: phase 1 about $1.10 (stop $2.00); phase 3 about $75 (stop $125).
- Owners: build session (budget code, tools, docs); the pipeline's owner (fitting the stages); deploy sub-session
  (releases, flags); Sachin (five decisions, each paid batch).

## 7. Action steps in sequence

1. Read the server Lambda's timeout and the live flag values (needs fresh AWS credentials). Done: both written in §1.
2. Migration and `unit_id`; ledger, deadline and log lines in **observe** mode: they record and log, they stop nothing.
   Done: a read on a laptop writes one `reading_units` row whose cost equals the sum of its `agent_runs` rows.
3. First measurement of the `develop` pipeline, observe mode, on staging: one cold Chart foundation plus Self, and one
   Love lens (paid, about $1.10, stop $2.00, on Sachin's yes). This replaces the retire-v2 test run. Done: a per-stage
   table of time, tokens (thinking included) and cost.
4. Fix the allowances from step 3; `scripts/unit-budget.ts`; the CI check. *Parallel with 5.*
5. Chart foundation as its own read; markers per read; the two numbers replace the three caps (chat and card chat too).
6. The pipeline's owner fits the stages to the allowances: output caps, thinking budgets, timeouts, the lens-thread
   shape, no fresh cap on later rounds. Done: `unit-budget.ts` passes for every read's largest deck.
7. Enforce mode behind `READING_UNIT_ENFORCE`; planner trimming; "read deeper" as a card read.
8. `unit-gate.ts`, the admin route, the per-read switch and its gate check.
9. Gate runs, one read at a time, each batch on Sachin's yes: Chart foundation, Self, then the eight lenses.
10. Switch on each read that passes. Re-fit for the January price by 15 December and re-run the gates at that price.

## 8. Development phases

| Phase | Steps | Ships | Closing check |
|---|---|---|---|
| 0 Facts and records | 1–2 | observe-mode ledger, `reading_units`, log lines | a row per read; the four log lines seen in CloudWatch |
| 1 First real numbers | 3–4 | per-stage table, allowances, CI check | the measured table replaces the arithmetic in §4.1 |
| 2 Fit and enforce | 5–7 | foundation read, fitted stages, enforce mode | unit tests; one read stopped by the ledger and one by the deadline in a test, each with its log line |
| 3 Prove and switch on | 8–10 | gate tool, 25 runs per read, switches | 25 of 25 complete, at most $0.50 and 60 s, median at most $0.40 |

Until a dashboard's new reading passes, it keeps today's pipeline, which is over the time limit (71 to 162 s) and
under the money limit. Deferred: the same limits for Lucky times and the General Reading chat pipeline's stages
(chat already reserves per answer); alarms in CloudWatch on `reading.unit.done` with `hitHardCap`.

## 9. One recommendation

Put one ledger and one deadline around every read, plan each read against $0.40 before it starts, and prove each
dashboard with 25 complete cold runs before switching it on. Measure the `develop` pipeline once before fixing any
per-stage number.

| Alternative | Verdict |
|---|---|
| Lower the three existing caps to $0.50 | Rejected: they are checked after spending, twelve cards overshoot together, and later rounds start a fresh cap |
| Enforce 60 s by cutting the build off | Rejected alone: it passes any cost test while serving half a dashboard; the gate requires complete reads |
| Reserve every call at the full uncached price | Rejected: it would allow only six cards; the retry that pays full price reserves when it happens |
| Keep the groundwork inside the first dashboard's 60 s | Not possible: 80 s or more by measurement (decision 1) |
| Count laptop runs toward the 25 | Rejected: they miss the cold start and the server's network |
| Gate at the January price now | Left to decision 3: it halves what a read can write today |

## Verification

- Unit tests: ledger (parallel reservations never pass the cap; a timeout keeps its reservation), deadline, planner.
- `npx tsx scripts/unit-budget.ts` exits 0 for every read; CI runs it.
- Staging: the four log lines in CloudWatch; `reading_units` rows equal the sum of their `agent_runs` rows.
- Gate: `npx tsx scripts/unit-gate.ts --key love.dating --report` prints 25 rows and pass or fail at both prices.
