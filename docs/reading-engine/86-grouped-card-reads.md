# 86 — Grouped card reads: fast, slim, self-cleaning (2026-11-18)

**Sachin, 2026-11-18 (approved):** (1) delete the explicit Gemini caches a dashboard build made as soon as its card reads
finish, never under another in-flight operation (per-kundli lease), failures to the sweeper; card chat takes a lease and
never fails on a missing cache. (2) A board's cards in under 20 s: about 2,000 output tokens per call, groups in parallel,
`CARDS_GROUP_SIZE_BOARD` default 3, sized by measured output length. (3) The pack holds each row once, cards name rows by
key, byte-stable per kundli and ledger; the shared prompts (`cards/oracle.md`, `cards/group.md`, the v3 Personalizer,
`common/reader-system.md`) are not edited. (4) One paid grouped read on kundli `c584c0a3`, cap $0.45, measured.

## 1. Start (facts checked in code and DB, 2026-11-18)

- `CARDS_GROUP_PACK=1` path: `src/reading/cards/run.ts` builds one pack (`buildCardPack`, `src/reading/cards/group.ts`),
  caches it with `ensurePromptCache` and reads the board in groups of `CARDS_GROUP_SIZE_BOARD` (default **1**), the rest
  in sixes; each group call has `maxOutputTokens` 16,000.
- The pack already writes the role library once and each matter row once. What still repeats: `CARD CELLS <id>` writes
  every ledger cell line under every card whose matters include it (cards share matters), and card ids are in board
  order, so a reordered board changes the pack bytes and the cache key.
- Caches: every region is in `llm_cache_entries` and is deleted 45 minutes after the person's last use
  (`informIndividualCacheUsed` → `recycleIndividualCaches`, `src/reading/llm/cacheSweep.ts`); EventBridge
  `llm-cache-sweep` is the safety net. Nothing deletes a build's caches when it ends.
- On a clock-layer cache hit, `runClockLayer` still warms the reader prefix cache (about 43k tokens) although the grouped
  cards never read it.
- Card chat (`src/reading/cardChat/answer.ts`) reads the reader prefix with `cachePrefix`; a missing cache already falls
  back to an uncached call (`isCacheRejection` retry in `src/reading/llm/gemini.ts`), but a miss also starts a background
  create once the entry has two uses.
- Per-card baseline, live build 2026-11-18 08:40 on `c584c0a3` (agent_runs): 11 board cards, 11 `self.card.oracle`
  (620–1,150 output tokens, $0.123) and 11 `self.v3.personalizer` (230–340 tokens, $0.049): cards **$0.172**; card phase
  08:41:32.8 → 08:42:08.5 = **35.7 s** (58 s from the first clock reader); whole build $0.27.

## 2. End goal

A board's cards are all ready under 20 s after the card phase starts; the pack is as small as the data allows and its
key survives a reordered board; no explicit cache outlives the operation that made it by more than the delete call.

## 3. Deliverable

- `src/reading/cards/group.ts`: pack with `# AGREED LEDGER` (each cell once) and `## CARD CELLS <id>` naming cells by
  key; ids sorted; `planGroups` (greedy by estimated output tokens, max size); per-group `maxOutputTokens` with headroom.
- `src/reading/cards/run.ts`: the batcher splits with `planGroups`.
- `src/reading/llm/cacheLease.ts` (new): per-kundli lease; keys used while leased are tracked and deleted at the last
  release. `src/reading/llm/promptCache.ts`: key-used and cache-created hooks, `deleteCachesByKey`, no-create lookups.
- `src/reading/self/v2/build.ts` (`runSelfV2Build`, the whole dashboard build) and `src/reading/self/v3/build.ts`
  (`runSelfV3Cards`, also run alone by the measure script) run under a recording lease; `src/reading/cardChat/answer.ts`
  holds a non-recording one per answer and never starts a create. `src/reading/cards/state.ts`: state writes coalesce.
- `src/reading/clocks/run.ts`: `warmOnHit` (the build passes false when grouped).
- `src/config/env.ts`: `CARDS_GROUP_SIZE_BOARD` default 3; new `CARDS_GROUP_OUTPUT_BUDGET` (2,000),
  `CARDS_CARD_OUTPUT_TOKENS` (1,000), `READING_CACHE_DELETE_AFTER_BUILD` (default on).
- `scripts/measure-grouped-cards.ts`; tests in `tests/unit/reading/cards/` and `tests/unit/reading/llm/`.
- No migration, no shared prompt edit, no card store key change (the pack bytes are not in it).

## 4. How it works when done

**Backend.** The dashboard build runs under `withCacheLease({userId,kundliId}, 'build.v2')` (the v3 step nests its own).
Every prompt-cache key the build's own calls look up or warm for that kundli is recorded: the five family prefixes,
the v2 Oracle and Personalizer prefixes, the clock prefix and the card pack, all built from this person's data (checked:
`prepared()` in `src/reading/self/v2/slices.ts` makes each prefix from the person's context; none is shared between
people). Recording follows the build's own async call tree (AsyncLocalStorage), so an Ask answer for the same person
running meanwhile is not recorded and not deleted. The card phase plans the board's cards
greedily: a group takes cards while its estimated output (`CARDS_CARD_OUTPUT_TOKENS` each, 1,000 = the 18 Nov mean of
Oracle plus face) stays within `CARDS_GROUP_OUTPUT_BUDGET` (2,000 ≈ 16 s at 125 tokens/s), at most
`CARDS_GROUP_SIZE_BOARD` (3) cards: 11 cards → 6 calls, all in parallel. Each call's `maxOutputTokens` is 1.6× its
estimate (at least 2,048), so a long card is not cut (a cut fails the group into a serial repair). The rest phase keeps
fixed sixes. When the build ends (after the concordance's words are folded in), the lease is released; at the last
release the recorded keys are deleted at Gemini (an in-flight create is awaited first) and marked deleted in
`llm_cache_entries`. A failed delete keeps its row live with `delete_error` and its `last_used_at` set to the epoch, so
the next `llm-cache-sweep` deletes it. The 45-minute recycle still runs as a backstop and waits while a lease is held.

**Card chat.** Each answer holds a lease. It uses the reader prefix cache when one is live (a build in flight) and never
creates one. Since builds now delete their caches, nearly every answer is uncached: about $0.03 of input (43k tokens at
$0.75 per 1M) where a cached follow-up would cost about $0.003. A create per answer would cost more than that and be
deleted at once; a conversation of many answers could hold a cache later (not built). A cache deleted by
another Lambda instance answers 403/404 and the call is retried uncached (existing path, now tested).

**API, frontend, UI/UX.** No change. The board shows the same cards sooner.

## 5. Architecture

Request path → async build Lambda (lease, clock layer, cards, release, deletes) → Gemini `cachedContents` and
`generateContent`; DB rows in `llm_cache_entries`, `technique_outputs`, `agent_runs`. The lease is per Lambda instance:
two instances do not see each other's leases; the cross-instance guarantee is the uncached retry on a refused cache.

## 6. Ingredients

Env (Lambda): `CARDS_GROUP_PACK=1`, `READING_EXPLICIT_CACHE=1`, `CARDS_GROUP_SIZE_BOARD=3`, optional
`CARDS_GROUP_OUTPUT_BUDGET`, `CARDS_CARD_OUTPUT_TOKENS`, `READING_CACHE_DELETE_AFTER_BUILD`. No migration, no IAM, no
new EventBridge rule. Paid: one run, Sachin's yes 2026-11-18.

## 7. Action steps in sequence

1. Pack: ledger once, cells by key, sorted ids; tests (each line once, byte-stable, reorder-stable).
2. `planGroups` and per-group output cap; batcher; env defaults; tests.
3. Lease module and promptCache hooks; builds and card chat take leases; clock layer `warmOnHit`; tests (delete only at
   last release, failure → sweeper, chat survives a missing cache on the call and stream paths).
4. `npx tsc --noEmit -p .`, touched tests.
5. Script rehearsal (fake model, no writes), then the one paid run; numbers into doc 71 §8 and billing §10.

## 8. Development phases

One phase; ships behind `CARDS_GROUP_PACK`. Closing check: the paid run's summary (`docs/reading-engine/replays/86-…`).
Deferred: cross-instance lease (needs a DB row, i.e. a migration), adaptive per-card estimates from `agent_runs`, a
loaded portrait in the measure script.

## 9. Recommendation

Ship the lease and the token-budgeted groups together with `CARDS_GROUP_PACK=1` once the measured board time is under
20 s. Alternatives: fixed groups of three (about 3,000 tokens, 24 s+: misses the target); one card per call (fastest,
one cached pack read per card: kept as what the planner gives when cards run long).

## 10. Measured (2026-11-18 23:57 UTC, one paid run)

Run: `npx tsx scripts/measure-grouped-cards.ts --yes-spend` (cap $0.45), summary in
`docs/reading-engine/replays/86-grouped-2026-11-18/summary.json`. Same 11 board cards as the 08:41 live build.

- **Pack:** 61,866 tokens (Gemini's count at create). The pre-doc-86 layout of the same data is about 70,200 tokens
  (162,790 against 143,448 characters at the measured 2.32 characters a token): 12% smaller. Duplicate lines 177 → 26
  (the 26 are dated lines whose meaning is their heading). Byte-stable on rebuild and on a reversed card order.
- **Groups:** planned 2+2+2+2+2+1, all six sent at once (one state write for the phase), no repair, 11 of 11 cards.
  Output per card about 940 tokens (the 1,000 estimate holds).
- **Time:** cache create 1.73 s; calls 10.2 to 17.2 s; **first call to last answer 17.2 s** (per-card path 35.7 s,
  first Oracle call to last Personalizer answer; the brief's "about 70 s" counted from the clock readers);
  first call to last reading stored 19.6 s; `readCards` end to end **28.6 s** from a laptop (3.5 s of database and
  cache set-up before the first call, about 8 s of store and state writes after the last answer). The page shows a
  card `reading` until its state write lands, so what a person sees is nearer 28.6 s here. **Verdict: the model part
  meets 20 s; end to end it does not, as measured from a laptop.** On Lambda the database part is shorter; not measured
  there yet (TODOS). If the slowest pair (2,140 tokens, 17.2 s) proves too close, `CARDS_CARD_OUTPUT_TOKENS=1100` makes
  every board call a single card (11 calls, about 10 to 12 s each, about $0.02 more in cached reads).
- **Cost:** calls $0.067 (per-card path $0.172); creation at worst $0.046 (not priced by Google); storage $0.0002 for
  the 28 s the pack lived.
- **Cleanup:** the pack was deleted 2.4 s after the last card was stored, at the lease release; Gemini answers 403 on
  it, its registry row has `deleted_at`. No prefix cache was made (stored layer hit, `warmOnHit` false). The run went
  through `runSelfV3Cards` only, so immediate deletion was shown live for the pack; the v2 build's own caches are
  covered by the same lease since the follow-up commit and by a unit test, not by this run.
- **Issues:** 11 of 11 cards passed on the first call; four carried notes (lagna and diagnosis one, chapter and
  chapters two). Their text was not kept (the script saved counts; issues are not stored in the database), so whether
  they were "key not given to this card" notes is not known. The script now keeps each issue's check and message.
- **Writes:** 11 `technique_outputs` (card readings), 16 `agent_runs`, 7 `area_builds` (cards state), the
  `llm_cache_entries` row. One `kundli_slices` upsert was swallowed. No other write.
- **Not like a real build:** the script passes `portrait: null`, so the 11 readings are stored under a key a real build
  (with its portrait) does not hit; they are extra rows, not served.

**Recommended Lambda env:** `CARDS_GROUP_PACK=1`, `READING_EXPLICIT_CACHE=1`, `CARDS_GROUP_SIZE_BOARD=3` (the default
now), `CARDS_GROUP_OUTPUT_BUDGET=2000`, `CARDS_CARD_OUTPUT_TOKENS=1000` (both defaults), `READING_CACHE_DELETE_AFTER_BUILD`
unset (on).

**Changes on deploy to note:** `READING_CACHE_DELETE_AFTER_BUILD` defaults on, so the per-card path (group pack off)
also deletes its caches when a build ends: a second build the same day re-creates them. A card read alone (Try again,
a card added) rebuilds and re-caches the whole pack (about $0.046 at worst for the create).
