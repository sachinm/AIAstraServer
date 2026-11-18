# 83 · One card writer, one check: the Self board without the v2 gate

Written 2026-11-18. Sachin asked what the v2 validator does, why a v3 card check exists as well, and whether there is a
better design. Follows doc 82 (no word filters). For review; no code is written from this until Sachin agrees.

## 1. Start (checked against code 2026-11-18)

Three writers make Self cards today, each with its own checks:

| Writer | Code | Model calls | Its checks | When it runs |
| --- | --- | --- | --- | --- |
| **v2 build** (doc 66): family readers → Oracle (11 areas) → Personalizer (11 cards + hero) | `self/v2/build.ts`, `oracle.ts`, `personalizer.ts` | 5 readers + 3 Oracle + 1 repair + 1 Personalizer (18 Nov: 9 calls, about $0.10, 75 s) | `areaDoc.ts validateAreaDoc` (Oracle areas), `personalizerValidate.ts validatePersonalDoc` (cards, hero), `failures.ts servesPage` (8 of 11) | every build |
| **v3 Phase B** (doc 68): v3 Oracle + v3 Personalizer, span-led cards | `self/v3/build.ts`, `v3/oracle.ts`, `v3/personalizer.ts` | 3 + 3 | `checkOracleCard`, `checkPersonalCard` | only after v2 serves and `SELF_V3_BUILD=1` |
| **Per-card reading** (doc 70): one call per card over the clock ledger | `cards/run.ts`, `cards/group.ts`, `cards/oracle.ts` | one per card (plus one repair each) | `precheckCard`, `checkOracleCard`, `checkAgainstLedger`, `checkPersonalCard` | only after v2 serves, `SELF_V3_BUILD=1` and `READING_CLOCK_LAYER=1` |

**What the v2 validator does:** it keeps the Personalizer to what the Oracle said. Each sentence must cite an Oracle
paragraph or evidence key, and each card date must be an Oracle window. Since doc 82 it no longer judges words.
`servesPage` then decides whether the build is stored and the refresh question charged.

**Why a v3 check exists too:** v3 cards have a different shape (spans with tone and mode, a knot and a gift, a
confirm question, per-card ledger cells). `checkOracleCard` checks that shape and its evidence keys against the clock
ledger; `checkPersonalCard` checks the face has its fields. Doc 70 reused them for the per-card reading.

**What the page shows:** `GET /api/self/v3` (`self/v3/service.ts`) calls `getSelfV2` first. That supplies the status,
`builtAt`, clock, refresh state and the v2 card under each v3 card. The v3 cards are then laid on top
(`v3/response.ts`).

**What went wrong on 18 Nov:** the v2 build did not serve, so no v3 card was built. The page had no v2 card to fall
back on either, so all 11 cards showed "did not finish".

**Not checked:** the live Lambda's `SELF_V3_BUILD` and `READING_CLOCK_LAYER` values (the AWS tool's credentials had
expired). Read them before step 1.

## 2. End goal

- One writer makes the Self cards: the doc 70 per-card reading, one call per card in parallel. A card that fails is
  re-asked alone and never holds up another card.
- One check for every card, about grounding only. It asks four things: did the JSON parse, are the required fields
  there, are the evidence keys in the card's ledger, and are the structured dates from the engine's stored windows.
  Engine names are redacted in place.
- No build-wide gate. A refresh is good when the person's board cards are read. The charge rule counts read cards,
  not v2 areas.
- The v2 build stops running for the Self board. Its board state (clock, refresh, `builtAt`) moves to a small state
  module that does not depend on any model call.
- **Timing and cost:** the first card shows in about 10–20 s instead of after the whole v2 build (75 s on 18 Nov). The
  9 v2 calls (about $0.10 per refresh) are saved.

## 3. Deliverable

- `src/reading/self/board/state.ts` (new): clock, refresh dates, `builtAt` and build marker, read from `area_builds`
  and the cards store. Lifted out of `self/v2api/service.ts` with no model call.
- `src/reading/cards/check.ts` (new): `checkCard(raw, ctx)` merges `precheckCard`, `checkOracleCard`,
  `checkAgainstLedger` and `checkPersonalCard` into one grounding check that returns `{ card, missing[] }`.
- `self/v3/service.ts getSelfV3`: reads board state from `state.ts`, not `getSelfV2`. A v2 card is shown only as a
  stand-in where a stored one exists.
- `self/buildEvent.ts runV2OwnedBuild` becomes `runCardsBuild`: clock layer, then `readCards`, then settle the refresh
  on cards read. No v2 build.
- `failures.ts`: the serve rule becomes "at least `CARDS_SERVE_MIN` of the board's cards read" (default: all but two).
- Retired from the Self path (kept for one release, then deleted): `self/v2/build.ts`, `v2/oracle.ts`,
  `v2/personalizer.ts`, `v2/personalizerValidate.ts`, `v3/oracle.ts` and `v3/personalizer.ts` (Phase B).
- Env: `SELF_V3_BUILD=1` and `READING_CLOCK_LAYER=1` become the default. `SELF_V2_BUILD` is off for Self.
- No migration: `technique_outputs` and `area_builds` hold everything already.
- Tests: `checkCard` unit tests, a `runCardsBuild` test with a fake model (one card fails and the rest serve), and a
  `getSelfV3` test with no v2 rows.

## 4. How it works when done

- **Backend:** `POST /api/boards/self/refresh` holds a question and queues the async build (unchanged: one per kundli
  per day, 30-minute failed-retry hold, Lambda 300 s). The build loads the stored ledger (Radha data only), then reads
  the board's cards in parallel (doc 70 cap and timeouts; one repair each). Each card is stored when it passes
  `checkCard`. The refresh is charged when `CARDS_SERVE_MIN` cards are read, else given back.
- **API:** `GET /api/self/v3` gives the same response shape; `status`, `builtAt` and `refresh` come from `state.ts`.
  `GET /api/self/v2` stays for one release and then goes. Refresh codes are unchanged (202, 409, 402).
- **Frontend and UI:** no change is needed. Cards fill in one by one ("Being read for you now" → card), so the page
  never sits on eleven failed cards because one shared step failed.

## 5. Architecture

Request path (GET, PUT layout, POST refresh) → async self-invoke → clock layer (stored ledger) → per-card calls in
parallel → `checkCard` → `technique_outputs` per card → GET reads them through `state.ts` and `cards/store.ts`. Radha
is read through the stored rows only. Nothing in the request path calls a model.

## 6. Ingredients

- Env flags already exist (`SELF_V3_BUILD`, `READING_CLOCK_LAYER`, `CARDS_READ_REST`); a new `CARDS_SERVE_MIN` is
  needed.
- No IAM, EventBridge or migration change.
- Owners: a dev agent for steps 1–5, the deploy path for flags and release, and Sachin for the charge rule and the
  flag switch.

## 7. Action steps

0. **Done 2026-11-18 (interim, ships with the doc 82 release):** flags read (`SELF_V3_BUILD`, `READING_CLOCK_LAYER`
   were unset) and set to 1 on `aiastra-server-api` at Sachin's instruction. In `self/v2/build.ts` the v3 cards now
   run whenever the Oracle served, and a build that stored v3 cards is `ok` even when the v2 Personalizer did not
   serve. `readSelfV2Latest` reads a `ready` marker without v2 cards as `ok`, and the new-day auto re-queue skips it.
1. Read the live flags; if the per-card reading is off, run it on one test kundli with a yes (paid calls).
2. `cards/check.ts`: one grounding check; switch `group.ts` and `cards/oracle.ts` to it. Tests.
3. `self/board/state.ts`; `getSelfV3` reads it, not `getSelfV2`. Tests with no v2 rows.
4. `runCardsBuild` replaces `runV2OwnedBuild` for Self, and the charge rule counts cards read. Tests.
5. Flags on staging; one refresh on c584c0a3; a screenshot of `/you` with cards filling in.
6. After one release: delete the v2 Self build, Phase B and their validators and tests.

Steps 2 and 3 can run in parallel; step 4 needs both.

## 8. Phases

- **Phase A (steps 1–4):** code behind the flags with tests. Ships dark.
- **Phase B (step 5):** flags on for staging, then one verified refresh. Closing check: per-card rows stored, the
  refresh charged once, and a screenshot.
- **Phase C (step 6):** deletion. Closing check: the whole unit suite passes and nothing imports `self/v2/build`.

## 9. Recommendation

Make the doc 70 per-card reading the only Self card writer, with one grounding check, and stop the v2 build from
gating the board. It removes the single point of failure that blanked the page on 18 Nov. It also halves the model
calls per refresh and puts the first card on screen in seconds.

| Option | Verdict |
| --- | --- |
| Per-card writer only, one grounding check, board state without v2 | **Chosen** |
| Keep v2 and decouple v3 from it (v3 runs even when v2 fails) | Rejected: two writers and two checks remain, and the cost and time stay doubled |
| Keep all three writers, share one check | Rejected: fixes duplication, not the gate or the cost |
