# 71. Ready on click: one cache per person, 15 seconds, and a Personalizer that learns (2026-11-10)

Plan only. No code is written yet. Follows doc 70 (five clocks, card-by-card readings) and doc 48 (companion memory).

## 1. Start (facts checked today)

- **Cost now.** The per-card reading is switched off on staging (`SELF_V3_BUILD`, `READING_CLOCK_LAYER` unset), so it
  costs nothing today. The one paid replay cost $0.704 for 50 calls and took 275 s (first card 106 s). The fixes
  shipped in `aaaeebb` are estimated at $0.49 to $0.56 for all 21 cards; not measured.
- **Where the money went.** Each card call sent about 55,000 prompt tokens: 37,000 cached and 18,000 at full price.
  23 card calls times 18,000 is about 410,000 full-price tokens, $0.47 of the $0.70.
- **A cache registry already exists.** `src/reading/llm/promptCache.ts` creates Gemini caches, names them
  `aiastra:<hash>`, records them in a registry table with the owner, adopts a live cache across Lambda instances,
  extends it on use, deletes on logout, and sweeps every 45 minutes. `ensurePromptCache` prewarms on demand.
- **A "whole evidence" cache layout already exists** for questions (`READING_CACHE_LAYOUT=full`,
  `src/reading/packs/fullPrefix.ts`): one role library plus the person's evidence, shared by every reader. The card
  path does not use it.
- **One cache holds one system instruction.** A Gemini call that uses a cache cannot send a different system
  instruction. So a shared cache needs one role library, and each call names its role in the short uncached part.
- **The refresh button exists.** `POST /api/boards/:board/refresh` runs only when `refresh_due`, and takes one question
  from the quota (`src/billing/questionGate.ts`). The first reading is free and is made on open.
- **Slices are written at sync** (Phase 3 of doc 70), per kundli, in `kundli_slices`.
- **Finished cards are stored by key** in `technique_outputs`; a stored card with the same key is served with no call.
- **The person's facts** live in a fixed catalogue (`src/profile/facts.ts`): work, love, family, focus, place, mood
  history, confirm answers. There is no per-area life memory and no per-person Personalizer brief.
- **Prompts today:** `cards/oracle.md` 658 words, 21 card briefs of about 85 words each, `personalizer/self-v3.md`,
  `common/reader-system`, `concordance`, and the clarify prompts. None was written with a quality rubric.
- **Not known:** the price of cache storage per hour for `gemini-3.8-flash`, and how long a cache of this size takes
  to create. Both are measured in Phase 0 before anything else is built.

## 2. End goal

When the refresh button is clickable, everything the reading needs is already uploaded and its cache ID is on file.
A click returns all 21 cards within 15 seconds. All five dasha clocks are read and conferred. The Personalizer writes
from a brief that belongs to this person and improves with every reading and every answer.

## 3. Deliverable

1. One cache pack per kundli, built at sync and pushed when the dashboard opens with the button enabled.
2. A reading that runs in at most six model calls after the click.
3. Four rewritten prompts: Oracle, clock reader and concordance, Personalizer, Clarifier.
4. A life memory per person in ten areas, and a person brief made from it.
5. One Personalizer question on the dashboard, from time to time.
6. A paid replay that proves time, cost and quality against the stored 21-card run.

## 4. How it works when done

### 4.1 The order of events

| When | What the system does | Model calls | Button |
|---|---|---|---|
| Registration | Kundli syncs once. Slices are written. The cache pack text is assembled and stored in the database. | 0 | n/a |
| Dashboard opens, refresh is due | New date ranges sync. Pack is reassembled. | 0 | disabled |
| Sync done | Pack is pushed to the model as one cache; ID stored in the registry. Five clock readers run in parallel on the cache; the ledger is counted in code; results stored for the day. | 5 | disabled |
| Ready | Button enables. | 0 | **enabled** |
| Person clicks | One question is taken. Four card-group calls run in parallel on the cache; cards stream to the page as each finishes. The concordance writes its sentences alongside. | 5 | busy |
| Reading done | Life memory and person brief are updated. Cache stays for re-runs, Try again and questions. | 1 small | disabled until next due |
| Page stays open | A heartbeat from the visible page extends the cache. | 0 | |
| Page closed, cache expires | Cache is deleted by the sweep. On the next open with the button enabled, it is pushed again from the stored pack. | 0 | |

The cache goes up on dashboard open, not on click. A click-time upload would add the upload time to the 15 seconds.
The stored pack makes each push a single upload with no assembly.

The five clock readers run before the click because the cards need the counted ledger, and readers plus cards in
sequence do not fit in 15 seconds. This spends a few cents before the person spends a question. It is a setting
(`READING_PREWARM_CLOCKS`); with it off, the click takes about 25 seconds (estimate).

### 4.2 What is in the cache pack

Everything any sub-agent on any board may need, in a fixed order so the bytes are stable:

1. The role library (one system instruction): Oracle, clock reader, concordance writer, Personalizer, Clarifier.
2. All 21 Self card briefs. Love and Work briefs join in Phase 4 of doc 70.
3. The chart core, the sky window, the year rows.
4. The five clock slices, each complete.
5. Every matter slice for every card.
6. The person: facts, life memory, person brief.

Each call then sends only a short instruction: its role, its cards, the day's dates. Size is not limited by design.
Two costs do grow with size and are measured in Phase 0: storage per hour, and the cached-rate charge that every
call pays on the whole pack.

### 4.3 The calls after the click

- **Four card groups in parallel**, five or six cards each, grouped by theme. Each card is written in two labelled
  steps inside the same call: the Oracle's finding, then the Personalizer's face. Both roles and both prompts stay.
- **One concordance call** alongside.
- A failed group retries alone. A card whose evidence hash is unchanged is served from the store with no call.

Fallback if the replay shows the merged call lowers quality: Personalizer as a second stage of four calls. That
costs about 6 more seconds and misses 15.

### 4.4 The cache ID

Stored in the registry per kundli with the pack hash, model, creation time and expiry. Written on every `agent_runs`
row that used it. Reused by re-runs, Try again, Clarify and the other boards until it expires. A changed pack hash
(new sync, new answer, new brief) makes a new cache and deletes the old one.

### 4.5 Life memory and the person brief

- **Life memory:** one sealed record per person in ten areas: health, wealth, love, career, aims and goals,
  achievement, luck, body, mind, soul. Each area holds what the readings have said (past, now, next, with date
  ranges), what the person confirmed or denied, and what is still unknown.
- **Person brief:** a short text made from the memory after each reading: what is known, what matters to them now,
  how they have answered, what not to assume, what is still open.
- **The Personalizer prompt is two parts.** The default prompt is the same for everyone and holds every rule. The
  person brief is added below it and can only add knowledge of the person. Code checks each new brief: length, no
  engine names, no chart terms, no text that reads as an instruction. A brief that fails is dropped and the last
  good one stays.
- Every brief is versioned and visible in the admin app.

### 4.6 The Personalizer's own questions

- After a reading, the open unknowns in the life memory are ranked by how many cards would change with the answer.
- The dashboard shows at most one question per visit and at most three a week. It never repeats a declined question.
- The chart leads: the question states what the chart suggests and asks the person to confirm ("yes, partly, no,
  skip"). Tap answers need no model call. Free text goes to the model.
- A dashboard question never costs quota. Each answer updates the memory and the brief.

### 4.7 API and web

- `GET /api/self/v3` adds `ready` (cache up, clocks read), the reason when not ready, and the pending question.
- `POST /api/boards/self/refresh` is unchanged for the client; it now starts the group calls.
- `POST /api/self/v3/heartbeat` extends the cache while the page is visible.
- `POST /api/self/v3/answer` stores a dashboard answer.
- Web: the button shows "Getting ready" until `ready`; the quota note stays; cards fill in as they arrive; one
  question card appears in the carousel when there is one.

## 5. Ingredients

Existing and reused: the cache registry and sweep, `ensurePromptCache`, the full-layout pack builder, `kundli_slices`,
the card store, the question gate, the fact catalogue, the replay script.

New: the pack assembler, the group runner with streaming, the life memory table, the brief writer and its check,
the question ranker, three routes, one additive migration, four prompts and a scoring rubric.

## 6. Action steps, in order

1. Measure on the test kundli: pack size in tokens, cache creation time, storage price, cached-read price. Paid;
   needs Sachin's yes with key, count and cost.
2. Decide from step 1: one pack, or two (clocks and cards) if the cached-read charge is too high.
3. Write the pack assembler; store the pack at sync.
4. Push the pack on dashboard open; record the ID; add `ready` to GET; add the heartbeat.
5. Move the clock readers onto the pack and before the click.
6. Rewrite the four prompts against a written rubric.
7. Build the group runner; stream cards to the page.
8. Add the cache ID to `agent_runs`.
9. Paid replay: time, cost and quality against the stored 21-card run. Needs Sachin's yes.
10. Life memory table, brief writer, brief check, admin view.
11. Question ranker, answer route, question card on the web.
12. Second replay with a brief in place. Needs Sachin's yes.
13. Turn the flags on in staging through the deploy session.

## 7. Phases

| Phase | Steps | Proves |
|---|---|---|
| 0. Measure | 1 to 2 | the prices and times this plan assumes |
| 1. Ready on click | 3 to 5, 8 | the button enables only when the cache and clocks are in place |
| 2. Fifteen seconds | 6, 7, 9 | 21 cards in 15 s at equal quality |
| 3. Memory | 10, 12 | the brief changes the writing and stays inside the rules |
| 4. Questions | 11 | one useful question, answered by tap |
| 5. Release | 13 | staging on, signed-in page checked |

## 8. Estimates (not measured)

| | Replay today | This plan |
|---|---|---|
| Calls after the click | 50 | 5 |
| Calls before the click | 0 | 5 |
| Time from click to all 21 cards | 275 s | 12 to 15 s |
| Cost per refresh | $0.70 | $0.15 to $0.25, plus cache storage |

The cost row assumes about $0.50 per million input tokens, a tenth of that for cached tokens, and a pack of about
150,000 tokens. The input price is inferred from the replay bill, not confirmed. If storage is near $1 per million
tokens per hour, keeping a pack of that size up for 45 minutes costs about $0.11, which is close to the reading
itself. In that case the cache should live 10 to 15 minutes and be extended by the heartbeat.

## 9. Quality bar

The new path must match the stored run on the same kundli and seed: 21 of 21 cards, every span grounded, no chart
words on faces, all five clocks in the ledger. A blind side-by-side of ten cards, old against new, is scored on the
rubric from step 6. No flag turns on before that.

## 10. Decisions for Sachin

1. Read the five clocks before the click (recommended), or only after it at about 25 seconds.
2. Oracle and Personalizer in one call per group (recommended), or two stages at about 20 seconds.
3. The ten memory areas as listed in §4.5.
4. The question limits: one per visit, three a week.

## 11. Recommendation

Build Phase 0 and Phase 1 first. They need one small paid measurement and they settle every number in §8. Phase 2
follows only if the measured cached-read and storage prices hold the cost under $0.25.
