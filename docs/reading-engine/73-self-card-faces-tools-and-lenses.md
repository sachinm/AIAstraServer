# 73. Self cards get faces, tools and (later) life-area lenses

Status: **plan written 2026-11-12. Phase 1 server is built and committed on `feat/board-layout-vclean`; Phase 1 web is
in progress on other branches; Phase 2 (lenses) is a plan only and needs Sachin's yes before any paid call.** Nothing in
Phase 1 calls a model.

Asked by Sachin (2026-11-12): clean the signed-in header, rebuild each Self card as one full-width card with an icon
toolbar and several faces, carry the picker's art onto the board, remember the person's choices, and show the board
from cache at once. Companion docs: 68 (Self v3), 70 (per-card reading), 71 (picker art and card options), 72 (Now card).

Two things in this plan are Sachin's to decide and are marked **DECISION**: whether Chart details evidence keys go to
every role (§4.2), and the cost and go-ahead of the lens call (§4.6).

---

## 1. Start (facts checked 2026-11-12)

Checked in the server worktree `C:\Users\Owner\Documents\work\wt\server-board-layout` (branch `feat/board-layout-vclean`,
commits `1b5e944`, `32cdb08`, `9512668` on top of `e91e894`) and in the web main checkout
`C:\Users\Owner\Documents\work\AIAstra_WEB` (branch `feat/self-vclean`). Nothing was run: no `tsc`, no tests, no
install (the worktree has no usable `node_modules`, see §6).

### 1.1 Server, as it is now

| Area | Fact | Where |
|---|---|---|
| Board route | `GET /api/self/v3`, `PUT /api/self/v3/layout`, `GET /api/self/v3/catalogue`, `POST /api/self/v3/confirm`, `POST /api/self/v3/cards/:id/read`. Mounted only when `SELF_V3_ENABLED=1` and the v2 board is on. Love and Work have **no** v3 layout route; `readLayout`/`writeLayout` take a `board` argument but only `self` is wired. | `src/routes/selfV3Routes.ts`, `src/reading/self/v3/layout.ts` |
| Layout row | `board_layout`: `user_id`, `kundli_id`, `board` (`self`/`love`/`work`), `template`, `cards` (ordered ids), `sections` (per card), `options` (per card, m49), **`board_options`** (new, m50). One row per chart per board, `@@unique([kundli_id, board])`. `board_layout` is not in `SEALED_MODELS`; it holds ids and option words only, never the person's words. | `prisma/schema.prisma` `model BoardLayout`, `src/lib/pii/fields.ts` |
| Card options | `length`, `view`, `words`, `plan` (doc 71) plus the redesign keys `face` (`read|light|breakdown|research`), `tools` (subset of `table|calendar|dates|timeframe|plan|info`), `groupBy` (`weeks|months|quarters|years|decades`), `groupsAs` (`swipe|accordion`), `start` (`short|full`). Lists and defaults come from env helpers. Only non-default keys are stored. In force = the card's own, then the board's, then the defaults. | `src/reading/boards/cardOptions.ts`, `src/config/env.ts` |
| Env for faces | `CARD_FACES`, `CARD_FACE`, `CARD_TOOLS`, `CARD_TOOLS_DEFAULT`, `CARD_GROUP_BY_VALUES`, `CARD_GROUP_BY`, `CARD_GROUPS_AS_VALUES`, `CARD_GROUPS_AS`, `CARD_START_VALUES`, `CARD_START`, `BOARD_CONFIRM_DEFAULT`, `BOARD_MOTION_DEFAULT`, `SELF_V3_ROUTE_BUDGET_MS`. | `src/config/env.ts` |
| Face = layout only | `shapeSelfCard` applies `view` and `plan` to stored content; `face`, `tools`, `groupBy`, `groupsAs` and `start` change no content (a test asserts `face: 'research'` adds nothing). | `cardOptions.ts` |
| Card registry | **26** cards in `src/reading/self/v3/cards.ts`: the 11 Phase A/B cards (Body & energy, How you think, What bothers you, Drive & ambition, Gifts & knots, How you come across, Who you are, Inner core, Diagnosis, This chapter, Chapters, This year; the old plan counted 11) and 15 Phase C cards offered only when the per-card reading is on. | `cards.ts` |
| Per-card reading is gated | `isCardsReadEnabled()` needs `SELF_V3_BUILD=1` **and** `READING_CLOCK_LAYER=1`. Whether the live Lambda has them is not checked here (no AWS read in this task); the old plan's finding "every card is `not_read`" stands until Sachin or the deploy session confirms it. | `src/config/env.ts` |
| Period text | Until a card is read, the rail comes from the v2 card's `dates` (`railFromDates`) with one `body` for all of them. Built in `1b5e944`: `splitBodyByPeriods` gives each body paragraph to the first period whose **start or end date it names** (`2027-01-01`, `1 Jan 2027`, `1 January 2027`), the rest become `card.standing`; a period no paragraph names keeps `text: null`. Phase B (read cards) keeps `text: null` because the page reads the span. | `src/reading/self/v3/response.ts`, `types.ts` (`RailItem.text`, `SelfV3CardView.standing`) |
| ETag/304 | `GET /api/self/v3` sends a strong ETag: first 16 bytes of the sha1 of the **serialised body**, base64url, quoted. A matching `If-None-Match` (a list, `*` or `W/` form) answers `304` with no body. `no_kundli` is never 304. CORS allows `If-None-Match` and exposes `ETag`. The 304 is decided **after** the full board read, so it saves bytes and web work, not server time. | `selfV3Routes.ts` (`strongETag`, `ifNoneMatchHas`), `server.ts` |
| Route budget | GET and PUT layout run under `withinBudget(work, SELF_V3_ROUTE_BUDGET_MS)` (default 2000, clamp 200 to 10000); past it the route answers `503 { error: 'timeout' }` with `Retry-After: 1`. The work is not cancelled; its late result is dropped. | `selfV3Routes.ts`, `env.ts` |
| GET critical path | Cut from 6 sequential database rounds to 4: (1) the chart (`latestKundli`), (2) the clock (`clockFor`: dasha applicability), (3) in parallel the stored v2 build, profile pack, floors, refresh block and build markers (profile, refresh and markers start before the clock read and overlap it), (4) in parallel the layout row (with `board_options`), `self.v3.cards`, the card readings and the cards state. The chart id comes from the v2 read (no second `kundlis` lookup); the build markers are read once. | `src/reading/self/v2api/service.ts` `getSelfV2`, `src/reading/self/v3/service.ts` `getSelfV3` |
| Card readings read | `readCardReadings`: one `findMany` on `technique_outputs` for `technique_id = 'self.card.reading'`, `digest_version` starts with `self.card|` and contains `|clock=<clock>|`, newest first, **`take: 300`**, no `select`; `output` is a sealed JSON column (`TechniqueOutput` in `SEALED_MODELS`), so every returned row is decrypted. This is the main variable cost of the GET. | `src/reading/cards/store.ts`, `src/lib/pii/fields.ts` |
| Indexes | m51 (`20261112190100_board_read_indexes_m51`): `idx_technique_outputs_kundli_technique_created` on `technique_outputs (kundli_id, technique_id, created_at DESC)` and `idx_kundlis_user_created` on `kundlis (user_id, created_at DESC)`. Plain `CREATE INDEX IF NOT EXISTS`. | `prisma/migrations/20261112190100_board_read_indexes_m51`, `prisma/schema.prisma` |
| Ownership | The user id comes from `deps.requireUser`; the chart is `latestKundli(prisma, userId)` or `latestKundliId`; a `userId` in the query or body that is not the signed-in user answers `403 { error: 'forbidden' }` (`assertOwnAccount`); kundli ids in a PUT body are ignored (tested). Every answer, including the 304, carries `Cache-Control: private, no-store, no-cache, must-revalidate`. | `selfV3Routes.ts` `ownAccount`, `src/routes/selfV2Routes.ts` `SELF_V2_CACHE_CONTROL` |
| PUT queue | After the layout upsert, with the per-card reading on and at least `CARDS_READ_MIN` (default 5) cards, card readings and card state are read in parallel, unread cards are marked `queued` (awaited) and the build is started **without** being awaited. | `service.ts` `putSelfLayout` |
| Evidence keys | `cards[].v2.details.evidence` (engine row keys such as `planet:D1.Sa`) and the Chart details paragraphs go to **every** signed-in role. The page hides keys unless `profile.role === 'practitioner'` (`SelfBoardV3.tsx:592`). The server's `readerRole` maps `student`, `astrologer`, `researcher` to `practitioner` from a hardcoded set (`PRACTITIONER_ROLES`); `aiastra_admin` is **not** in it. | `src/reading/self/v2api/response.ts`, `src/reading/person/profile.ts` |
| Agents and techniques | Registered today: `self.sub`, `self.oracle.v3`, `self.personalizer`, `self.now`, `self.card.oracle`, `self.card.personalizer` (`src/agents/registry.ts`); techniques `self.card.reading` (`catalog.ts`), `self.now`, `self.v3.cards`. There is **no** `self.card_lens`. The card agents use `cachePrefix: true` + `cacheOwner` and call `markAgentUsed` → `informIndividualCacheUsed` (`src/reading/cards/oracle.ts`, `group.ts`). | `registry.ts`, `src/techniques/catalog.ts`, `src/reading/llm/cacheSweep.ts` |
| Cost controls that exist | `CARDS_SPEND_CAP_USD` (default 0.75 per person per day, 0.01 to 10), `CARDS_READ_MIN`, `CARDS_BOARD_PARALLEL` (8), `CARDS_GROUP_PACK`, `CARDS_GROUP_SIZE_BOARD/REST`, `READING_CACHE_RECYCLE_MINUTES` (45). | `env.ts` |
| Voice | `src/reading/prompts/personalizer/voice.md` exists in the worktree (written by another session, uncommitted when this was checked). Not part of this plan's deliverable. | worktree |

### 1.2 Web, as it is now (read only)

| Area | Fact | Where |
|---|---|---|
| Header | **Already done** on the checkout's branch (`006d499`, `7ef177b`, `e4c898d`): name over tagline in `TopNavigation.tsx` (`data-test-id="header-tagline"`), `PRODUCT_TAGLINE = 'Your personal Vedic astrologer.'` in `src/lib/legal.ts`, and `ProfileMenu.tsx` holds General Reading (`useGeneralReadingIfAvailable`), Happy Hour(s) and "Personalize setup". The "Personalize Your Readings" modal still lives in `TopNavigation.tsx`. | `src/pages/TopNavigation.tsx`, `src/components/ProfileMenu.tsx` |
| Card | `SeasonsCard.tsx` (213 lines) still draws a text column plus the "Your year" rail (`YearRail`); `Stretch` prints `card.v2.card.body` whole under whichever period label is chosen on early cards. **The web does not read `RailItem.text` or `card.standing` yet.** `SectionsMenu` (in `CardParts.tsx`) and `sectionsFor` (`src/lib/cardOptions.ts`) are still the edit surface. | `src/pages/you/v3/SeasonsCard.tsx`, `CardParts.tsx`, `CompactCard.tsx`, `SelfBoardV3.tsx` |
| Options types | `src/lib/cardOptions.ts` knows only `length`, `view`, `words`, `plan`; no `face`, `tools`, `groupBy`, `groupsAs`, `start`, no board options, no `effectiveOptions(card, board, defaults)`. `src/lib/selfV3Api.ts` carries a hand-copied set of server types ("must stay identical") that lacks `boardOptions`, `boardDefaults`, `RailItem.text` and `standing`. | `src/lib/cardOptions.ts`, `src/lib/selfV3Api.ts` |
| Card art | `CardArt.tsx` has sizes `tile | small | thumb | swatch` only (no `banner`). `CardArt`/`useLoadCardPhotos` are used only inside `src/components/boardCards/` (`BoardCardPicker.tsx`, `AreaCards.tsx`, `cardPhotos.ts`, `cardArtRegistry.ts`); nothing on the Self v3 board draws them. | `src/components/boardCards/` |
| Cache | `selfV3Api.ts` has no memory cache, no ETag handling, no IndexedDB; the page shows its loading veil on every visit. `perViewFor(template, mode)` returns 1 (phone), 1 or 2 (compact portrait 2, landscape 4; seasons portrait 1, landscape 2): it is by mode, not by width. | `src/lib/selfV3Api.ts`, `SelfBoardV3.tsx` |

### 1.3 What the person sees today (symptoms)

- Choosing another period on an early card changes only the small label; the text is the same paragraphs (cause: one
  `body` per card; server side now fixed for dated paragraphs, web not yet using it).
- Cards lose the picker's art and category colour once on the board.
- Two overlapping edit layers (How this card reads, Fine-tune) with locked-on boxes and "partly honoured" notes.
- A visit to `/dashboard/you` always waits on the GET behind a veil; a reload redraws nothing from memory.

---

## 2. End goal

When this is done, the person:

- Opens `/dashboard/you` and sees their last board **within 100 ms** of the route mounting (from memory, or from the
  encrypted disk copy on a reload), then, quietly, the fresh board if anything changed. No veil except on a first visit,
  a build in progress or a fresh reading.
- Sees each card as one full-width card with the picker's art as its header band, an icon toolbar, and a **face** to
  read it in (Read, Light, Breakdown, Research), plus **tools** to see it by date (Table, Calendar, Dates, By timeframe),
  the ladder (Plan) and the notes (Info). The choice sticks per card and per board, across devices.
- Chooses a period and **always** sees that period's own text, or is not offered the choice (never a label change over
  identical words).
- Changes how every card reads from one gear ("Card settings"), with a clear line for cards that keep their own choice.
- Later (Phase 2, after Sachin's yes): opens "In your life" on a card and gets a short lens for their lifestyle,
  how they meet the world, work, loved ones or family, written from facts they gave, or one tap question if the fact is
  missing.

What can no longer go wrong: a period button that changes nothing; a 304 that makes the page jump; another account's
board served (`403`); a board GET that hangs (`503` at 2 s); personal text stored in the browser in the clear;
a model call the person's questions or the budget did not agree to.

---

## 3. Deliverable

**Done in Phase 1 server (committed on `feat/board-layout-vclean`, not pushed, not applied):**

- `1b5e944` feat(boards): `face`, `tools`, `groupBy`, `groupsAs`, `start` card options with env-driven lists
  (`src/config/env.ts`); `board_layout.board_options` (migration m50 `20261112190000_board_layout_board_options_m50`);
  `PUT` accepts `boardOptions`; `GET` returns `layout.boardOptions` and `layout.boardDefaults`; options in force per
  card; Phase A per-period text (`RailItem.text`, `card.standing`); read indexes (m51).
- `32cdb08` perf(self-v3): ETag/304, route budget (`SELF_V3_ROUTE_BUDGET_MS`, 503), GET critical path 6 → 4 rounds,
  kundli ownership from the signed-in user only (403 on another `userId`), non-blocking card queue after PUT; CORS
  `If-None-Match` and exposed `ETag` in `server.ts`.
- `9512668` docs(todos): findings from that build (m50/m51 order, evidence gating, queue on Lambda, board-wide
  `length`/`words`/`plan` not changing stored `sections`, the incomplete worktree `node_modules`).
- Tests written with these commits (not run here): `tests/unit/reading/boards/cardOptions.test.ts`,
  `boardCardsRoutes.test.ts`, `tests/unit/reading/self/v3/periodText.test.ts`, `routes.test.ts` (ETag 200 then 304,
  budget 503, board options round trip, ownership, face research adds nothing).

**In progress by other sessions (named here so this plan's steps do not duplicate them):**

- Personalizer voice by stated gender (`src/reading/prompts/personalizer/voice.md`, `PERSONALIZER_VOICE_BY_GENDER`).
- Web: header cleanup (committed on `feat/self-vclean`), card redesign with a toolbar, the banner using the picker's
  `CardArt`, the board settings gear, SWR cache (memory plus encrypted IndexedDB, `If-None-Match`), session memory of the
  active card and period.

**Still to ship by this plan:**

| # | Thing | Repo | Files |
|---|---|---|---|
| D1 | Apply m50 and m51 | server (deploy) | `prisma/migrations/20261112190000_…_m50`, `…190100_…_m51` |
| D2 | Copy the new server types into the web (`boardOptions`, `boardDefaults`, `RailItem.text`, `standing`, new option keys) | web | `src/lib/selfV3Api.ts`, `src/lib/cardOptions.ts` |
| D3 | `effectiveCardOptions(card, board, defaults)` and tests; faces map to sections; remove `SectionsMenu` and Fine-tune | web | `src/lib/cardOptions.ts`, `CardParts.tsx`, `SeasonsCard.tsx`, `CompactCard.tsx` |
| D4 | `CardToolbar`, `faces/*`, `tools/*`, `BoardSettings`, `CardBanner`; `CardArt` `banner` size; chips thumbnails; `useLoadCardPhotos('self')` | web | `src/pages/you/v3/…`, `src/components/boardCards/CardArt.tsx`, `src/pages/you/v3/CardChips.tsx` |
| D5 | Period strip and period carousel reading `RailItem.text`; "never pretend" rule; By timeframe swipe or accordion | web | `SeasonsCard.tsx`, `tools/TimeframeAccordion.tsx` |
| D6 | Board cache: memory, encrypted IndexedDB, `If-None-Match`, `sessionStorage`, optimistic PUT with rollback | web | `src/lib/selfV3Api.ts`, new `src/lib/selfV3Cache.ts` |
| D7 | Server tightening (§4.1): layout read overlapped with the clock, bounded and narrowed card-readings read, optional stamp-based 304 | server | `src/reading/self/v3/service.ts`, `src/reading/cards/store.ts`, `src/routes/selfV3Routes.ts`, `src/config/env.ts` |
| D8 | Evidence gate (only after Sachin's decision, §4.2) | server | `src/reading/self/v2api/response.ts`, `src/config/env.ts` |
| D9 | Phase 2 lens: types, agent, technique, endpoint, cache, `LensFace` (only after Sachin's yes, §4.6) | both | §4.6 |
| D10 | Docs: README row for doc 73, `docs/TODOS.md` closes, screenshots `docs/screenshots/self-card-faces/01-…png` | server | `docs/` |

---

## 4. Exactly how it works when done

### 4.1 Backend

**GET `/api/self/v3` (request in → body out).**

1. `requireUser` → user id. A `userId` in query or body that is not that id → `403`. Sets `Cache-Control: private,
   no-store, no-cache, must-revalidate`.
2. `withinBudget(getSelfV3(...), SELF_V3_ROUTE_BUDGET_MS)`: 2000 ms cap, then `503 { error: 'timeout' }`.
3. Reads (rounds): chart → clock → v2 build, profile, floors, refresh, markers → layout row, `self.v3.cards`, card
   readings (≤ 300 rows, decrypted), cards state. Maps to `SelfV3Response`: each card gets its rail, `standing`, `state`,
   options in force; `shapeSelfCard` applies `view` and `plan`. A filter over stored content; no model call, no new
   astrology.
4. `JSON.stringify`, sha1, `ETag`. `If-None-Match` equal → `304`, no body. Otherwise `200` with the body.

**PUT `/api/self/v3/layout`.** Validate (`validateLayout`: template, cards, sections, options, boardOptions; unknown
key or value → `400 unknown_option` with `detail`) → chart → upsert `board_layout` (options and `board_options` written
only when the request carried them) → answer the saved layout (it wins over the page's guess). With the per-card
reading on and ≥ `CARDS_READ_MIN` cards: unread cards are marked `queued`, the build is started without holding the
answer. Same 2000 ms cap.

**Concurrency, limits, retries (stated as numbers).**

- Route budget 2000 ms (env). Web retries a `503` once after the `Retry-After: 1` second, then shows the cached board
  with a quiet "Couldn't refresh" line.
- The page polls every 2 s only while a card or the board is being read (unchanged), and stops at the stuck-card limit
  (`CARD_STUCK_MS`).
- A face, tool or grouping change is a layout write: 1 chart lookup + 1 upsert. It reads and writes no card text.
- The PUT's card queue touches the database 3 times (read readings, read state, mark queued) and starts the build
  without waiting.

**Tightening, in order of value (D7; each is its own commit and its own check):**

1. **Overlap the layout read with the clock.** `readLayout` needs only the chart id, so start it as soon as the chart
   is known (round 1) instead of round 4. Rounds 4 → 3 for the layout; the card readings still wait for the clock.
2. **Bound and narrow the card-readings read.** `take: 300` and no `select` today. Add a `select` of `output`,
   `digest_version` and `created_at`, and an env `SELF_V3_CARD_ROWS_MAX` (default 300, no change) so the number can be
   lowered after a measurement shows how many rows a real person has per clock. Fewer decrypted rows is the biggest
   single saving.
3. **Stamp-based 304 (optional, only if the measurement says the GET is still over budget).** Make the tag a stamp of
   three cheap reads (newest `technique_outputs.created_at` for the chart, the layout `updated_at`, the build marker
   state) plus the profile version and the day. A matching stamp answers `304` after rounds 1 to 2 and one tiny query,
   without decrypting any card. The body-hash tag stays as the fallback. Risk: a stamp that misses a changing input
   serves a stale board, so it needs a test per input (profile fact change, clock switch, confirm answer, card read).
4. **PUT: skip the card queue when nothing is new.** When the saved card set equals the stored one and every card
   already has a reading or a `queued/reading` state, the three queue reads can be skipped; this needs the upsert to
   return the previous `cards`. Optional.
5. **Queue on Lambda.** Move the fire-and-forget build start before the response if a staging trace shows the invoke
   only leaves on the next request (finding filed in `docs/TODOS.md` 2026-11-12). Done when the invoke leaves within
   the PUT's invocation, or the move is measured under 50 ms.

**Phase 2 lens flow: see §4.6.**

### 4.2 API and ACL

**Endpoints touched.**

| Endpoint | Request | Response | Errors the client must handle |
|---|---|---|---|
| `GET /api/self/v3` | `If-None-Match: "<tag>"` optional | `200` `SelfV3Response` + `ETag`; `304` no body; `404` `no_kundli` | `401` signed out; `403` another `userId`; `503 {error:'timeout'}` (retry once after 1 s); `500 self_v3_failed` |
| `PUT /api/self/v3/layout` | `{ template, cards, sections?, options?, boardOptions? }` | `200` `SelfBoardLayoutView` (+ `reading: { queued }`) with `boardOptions`, `boardDefaults` | `400` `unknown_option` (`detail` = `<card>.<key>=<value>` or `board.<key>`), `bad_body`, `too_few_cards`, `unknown_card`, `card_not_offered`, `duplicate_card`, `fixed_section_off`; `404` `no_kundli`; `503` timeout |
| `GET /api/self/v3/catalogue` | none | picker tiles | runs the whole board read today (filed, P3) |
| `GET /api/self/v3/cards/:id/lens/:lens?span=` (Phase 2) | none | `{ state: 'ready'|'idle'|'writing'|'failed'|'needs_fact'|'off', text?, question? }`; never spends | `400 unknown_card|unknown_lens`, `403`, `404 no_kundli`, `503 off` |
| `POST /api/self/v3/cards/:id/lens/:lens` (Phase 2) | `{ span }` | `202 { state: 'writing' }` | `400`, `403`, `404 no_kundli`, `409 already_writing`, `429 spend_cap`, `503 off` |

The Phase 2 path follows the existing `/cards/:id/read` shape (plural `cards`).

**What the board response holds that the page uses:** per card `options` (in force), `optionNotes`, `rail[].text`,
`standing`, `state`; at layout level `boardOptions` (what the person changed) and `boardDefaults` (env-driven, so the
page never hardcodes a default). Order of precedence: the card's own choice, then the board settings, then
`boardDefaults`.

**RBAC / ACL.**

- **Self only.** The chart is always the signed-in user's latest (`latestKundli(prisma, userId)`); a request naming
  another account is refused with `403`; body kundli ids are ignored. This is the `assertOwnAccount` rule of
  `AIAstra_Server/AGENTS.md` for every user-scoped endpoint. Nothing in Phase 1 or 2 takes a user or chart id from the
  client. No admin or staff path reads this board; staff tooling lives in `aiadastra_admin` and never selects reading text.
- **Cache-Control.** `private, no-store, no-cache, must-revalidate` on every answer including `304` and `503`. Because
  of `no-store` the browser's own HTTP cache never keeps the body or sends conditional headers; the page's own
  `If-None-Match` and its encrypted IndexedDB copy do that deliberately (§4.3).
- **Sealed data.** Card readings and lens outputs live in `technique_outputs.output` (`TechniqueOutput` in
  `SEALED_MODELS`, `pii2:v1`); `board_layout` holds ids and option words only (migration m50's comment: "No
  astrological content and no words of the person"). Summaries of runs hold counts, ids, tones and scores only.
- **Browser storage.** The disk cache holds the board body only as AES-GCM ciphertext, keyed by user id and board; the
  key comes from the server per session (the pattern of `src/lib/overlayArt.ts`). It is wiped on sign-out and when the
  user id changes. `sessionStorage` holds only the active card id, selected period index, open groups and Show more
  flags: ids and numbers, no text.
- **DECISION for Sachin: role gating of Chart details evidence keys.** Today the server sends `v2.details.evidence`
  (row keys such as `planet:D1.Sa`) and the Chart details paragraphs to every role; the page hides keys unless
  `profile.role === 'practitioner'`, which is a display rule, not an access rule. `readerRole` treats `student`,
  `astrologer` and `researcher` as practitioner (hardcoded set; `aiastra_admin` is not in it; the 2026-11-12 TODOS entry
  lists `aiastra_admin` instead, which does not match the code). The new Research face changes no content, so it does not
  widen this.

  | Option | What it means | Cost |
  |---|---|---|
  | A. Keep | Evidence keys go to everyone; the page hides them. | No work. A public user can read the keys in the network tab. |
  | **B. Gate on the server (recommended)** | A non-practitioner's body has `evidence: []` (and no Chart details paragraphs that quote keys). The practitioner set moves to env `SELF_EVIDENCE_ROLES` (default `student,astrologer,researcher,aiastra_admin`, so it is decided in one place and the admin can see what they support). A test asserts a public body has `evidence: []`. The ETag already varies by body, so the tag differs by role. | Small: `areaViews` in `src/reading/self/v2api/response.ts` plus env and a test. |
  | C. Gate per face | Evidence only when `face = research`. | Rejected: a face is a layout choice, not a permission. |

  Until Sachin decides, D8 is not built and the finding stays in `docs/TODOS.md`.

### 4.3 Frontend experience

**Page states.**

| State | What the page does |
|---|---|
| First visit, no cache | Loading veil until the GET returns (unchanged). |
| Revisit, same session | Draws the board from the memory cache in the same frame; GET with `If-None-Match` in the background; `304` → nothing moves; `200` → only changed cards redraw; the active card, the selected period and any open tool stay. |
| Reload or new tab | Reads the IndexedDB entry for (user, board), decrypts, draws, then revalidates as above. |
| Build in progress or a fresh reading | Veil or progress line as today; polling every 2 s. |
| `503` timeout | Keeps what is drawn; one quiet line "Couldn't refresh just now"; one retry after 1 s. |
| PUT fails | The optimistic change rolls back with a plain error line; the server's saved layout wins on success. |
| Sign-out or user change | Memory and IndexedDB entries removed. |

**One card.**

- **Faces** (the same card, read four ways; layout only, the card turns over in 400 ms, a cross-fade with reduced
  motion): Read (default), Light (headline, one sentence, one step), Breakdown (what it asks, the likely trap, one step,
  your pattern, the ladder), Research (chart details, how many clocks agree, evidence for practitioners only, chart
  terms allowed). In your life arrives in Phase 2.
- **Tools** (icon buttons): Table, Calendar, Dates, By timeframe, Plan, Info. On a card 720 px or wider a tool opens as a
  panel between the headline and the body and shows as pressed; narrower, a popover; on a phone a bottom sheet. Several
  tools may be open on a wide card; one at a time on a narrow one.
- **Period carousel.** A 36 px strip of period pills above the reading column; the column is a carousel (swipe, drag,
  arrows, dots in step). Each slide shows the period's own text. **Never pretend:** a period is a selectable slide only
  when it has text of its own (`RailItem.text` for early cards, the span for read cards); an early card with none shows
  its dates as a plain list, its text once, and the line "Readings for each period come with your next reading". Text
  that belongs to no period (`standing`) shows on every period.
- **Show more.** Read face shows the headline, period label and first paragraph clamped to about 4 lines with a fade; the
  button names what is waiting ("Show more · the likely trap, one step and your pattern"); state kept per card and
  period in `sessionStorage`; setting "Start cards: Short or Full" (`start`). "Is this right?" and Chart details are
  never behind it. Each tap is `track('show_more','self_v3',cardId)`: ids only.
- **By timeframe** groups the stored periods by `groupBy` (date arithmetic on dates already stored; Node derives no
  chart data). Swipe on a touch screen, accordion with a mouse (`groupsAs`).
- **Chart details** is always reachable (footer link and toolbar icon), opening the sheet for the period on screen.

**Board settings (gear, left of Edit).** Popover on desktop and tablet, bottom sheet on a phone. Every change saves at
once through `PUT /api/self/v3/layout` (`boardOptions`).

```text
+---------------- Card settings (all cards) ----------------+
| Read as      ( *Read* | Light | Breakdown | Research )    |
| Open tools   [ ] Table [ ] Calendar [x] Dates              |
|              [ ] By timeframe [x] Plan                     |
| Group by     ( Weeks | Months | *Quarters* | Years | Dec ) |
| Show groups as ( *Swipe* | Accordion )   Start ( *Short* | Full ) |
| Show "Is this right?" [on]    Turn animation [on]          |
|-----------------------------------------------------------|
| 3 cards have their own settings.  [Apply to all cards]    |
+-----------------------------------------------------------+
```

"Apply to all cards" sends `options` with the per-card keys cleared. Turning "Is this right?" off hides only the footer;
a card waiting on an answer keeps one quiet "Check this" link in its Info tool, so confirmed answers stay calibration
evidence (product rule 4).

**Precedence in the page:** `effectiveCardOptions(card, board, defaults)` = the card's own, then `boardOptions`, then
`boardDefaults`; the page takes `cards[].options` from the server (already in force) and only recomputes while a change
is optimistic. Known server gap (filed): board-wide `length`, `words` and `plan` do not change a card's stored `sections`;
the page must derive the visible sections from `cards[].options` until the server does.

### 4.4 UI and UX

**One card, wide (≥ 900 px of card).**

```text
+---------------------------------------------------------------------------+
| [art band 56-72px: gradient + backdrop + photo]  (glyph) BODY & ENERGY    |
| [Read|Light|Breakdown|Research]       [tbl][cal][dates][acc][plan][i]     |
|---------------------------------------------------------------------------|
| ( now -> 19 Dec 2026 . Heavy ) ( 1 Jan -> 5 Dec 2027 . Mixed ) ( > )      |
|           Pacing your daily energy protects your baseline.                |
|        NOW -> 19 DEC 2026 . A HEAVY STRETCH                               |
|        <this period's own paragraphs, 17px, up to 72ch, centred column>   |
|           [ Show more . the likely trap and one step ]                    |
|---------------------------------------------------------------------------|
| Is this right? (Yes)(Partly)(No)         Checked 3 of 5 . Chart details > |
+---------------------------------------------------------------------------+
```

**Words and states.** Tone is written in words ("Heavy", "Mixed", "Light"), never colour alone. Toolbar active state and
card border use the category's `--art-a` colour. Phone: the face picker becomes a menu, tools beyond three go under
"...", tools open as bottom sheets, 16 px body text. Tablet: one card in portrait, two in landscape with a 24 to 40 px
peek. Desktop: two cards across from 1280 px, three from 1920 px; the reading column keeps the whole card width and never
shares it with a dates column. Page background and card tokens (`--board-bg`, `--card-bg`, `--card-border`) sit behind one
switch so the royal-blue look can be compared against today's purple-black at 1440 px before it ships.

**Timings the person notices.** Board from cache under 100 ms; face turn 400 ms; Show more unfold 200 ms; a tool or
period change instant (no request); a setting change visible at once and saved in the background; "Couldn't refresh just
now" after a 503 and one retry.

**Header** (already built on the web branch): 64 px bar, logo, name over the tagline "Your personal Vedic astrologer.",
usage bar, avatar; the avatar menu lists General Reading, Happy Hour(s), Personalize, Upgrade, Profile, Plan, Language,
Sign out once each.

### 4.5 Performance budget (estimates only: nothing here was measured)

All figures are targets with an estimate of where the time goes, assuming a warm Lambda and a same-region database.
Phase 1 closes only when a measurement on staging (the route's own log of server time plus a browser trace) confirms
them; until then they are goals.

| Path | Target | Estimated split | How it is tightened |
|---|---|---|---|
| `GET /api/self/v3`, warm Lambda, server time | **< 100 ms** (hard cap 2000 ms via `SELF_V3_ROUTE_BUDGET_MS`) | chart lookup 3 to 8 ms (m51 `idx_kundlis_user_created`); clock 5 to 10 ms; v2 build, profile, floors, refresh, markers 15 to 30 ms (largest read is the sealed v2 build row); layout row, `self.v3.cards`, card readings, cards state 20 to 50 ms; mapping, shaping, `JSON.stringify`, sha1 2 to 5 ms. About 45 to 95 ms in total. | Done: 6 → 4 rounds, one marker read, no second chart lookup, m51 indexes. To do (§4.1): layout read overlapped with the clock; narrowed and bounded card-readings read; optional stamp-based 304. |
| Main variable cost | up to 300 rows decrypted on each GET | The card-readings `findMany` returns up to 300 rows of sealed JSON, each decrypted (`TechniqueOutput.output`); a board with many cards and several stored versions per card sits near the cap. This dominates the 20 to 50 ms above. | `select` only the used columns; `SELF_V3_CARD_ROWS_MAX`; recycle stale rows (45-minute sweep already removes an individual's `technique_outputs` after inactivity). |
| `GET` cold Lambda | not budgeted (first request after idle) | Lambda init plus first connection to the database. | The 2 s cap turns a stall into a `503` the page retries; the page already shows from cache. |
| `GET` that answers 304 (today) | server time ≈ the 200 path; body 0 bytes; page work ≈ 0 | Full read, then sha1 and compare. Saves network bytes and every re-render. | Optional stamp-based tag (§4.1 item 3) cuts server time to rounds 1 to 2 plus one small query, an estimated 15 to 25 ms. |
| Web paint from memory cache | **< 100 ms** from route mount | Synchronous read of a module-level value plus first paint of the active card only. | Render the active card and its neighbours first; defer other cards and photos. |
| Web paint from disk cache (reload) | **< 100 ms** after the encryption key is available | IndexedDB read 5 to 20 ms, AES-GCM decrypt of about 100 to 300 KB 5 to 15 ms, JSON parse 3 to 8 ms, first paint. The key is fetched once per session; the very first reload of a session pays that request. | Keep the key in memory for the session; store the body as one record; decrypt off the main thread if profiling shows jank. |
| `PUT /api/self/v3/layout` | **< 150 ms** server time; the page does not wait (optimistic) | Chart lookup 3 to 8 ms; upsert 5 to 15 ms; with the card reading on: 2 parallel reads 10 to 40 ms and 1 write 5 to 15 ms; build start not awaited. | Skip the queue reads when the card set is unchanged (§4.1 item 4); the page already updates first and rolls back on failure. |
| Photos | 1 cached request and 1 decrypt per page load | `useLoadCardPhotos('self')` per `cardPhotos.ts` design. | Drawn art shows until photos are ready. |
| Phase 2 lens, first open | < 6 s to `ready` (a model call); < 100 ms on every later open | One model call over a cached prefix; later opens are a `technique_outputs` read. | §4.6. |

### 4.6 Phase 2: the life-area lens ("In your life")

**What it is.** A fifth face on a card. For one card and one period it writes a short reading of how that card's
situation lands in one area of the person's life: **lifestyle** (daily living), **world** (how they meet the world),
**work**, **loved ones**, **family**. The person opens the face; the first open writes and caches it; later opens read the
cache. The page never shows a lens for an area the person's facts do not support, and asks one question instead.

**Facts first, then one question, never a guess** (AGENTS.md "Tilt the board", item 6; item 3 "Questions follow facts").
The lens agent is handed only: the card's stored line, the period's text and ledger cells, the person's known facts (age
band, stated gender or none, role, the wizard's facts for work, love, children, focus and place, last confirm answers),
declined topics. Lens availability:

| Lens | Offered when the profile holds | Else |
|---|---|---|
| Lifestyle | always (daily living needs no fact) | n/a |
| World | always | n/a |
| Work | a stated job or work status (`person_facts`) | `needs_fact` with the one-tap question "Do you work at the moment?" |
| Loved ones | a stated relationship status or a love fact | `needs_fact` with one question |
| Family | a stated family fact (children or parents) | `needs_fact` with one question |

Declined topics (`declined_topics`, doc 18) are never passed to the agent and never shown. The lens text is written for
**the person's own facts only**: it may not name a partner, child, employer or place the person did not give, and the
validator drops a sentence that does (the `GENDERED_WORDS` and chart-term checks of `personalizerValidate.ts` apply, plus
a check that every named relation or role is in the facts list). No chart terms and never the engine's name on the face.

**Registration (AGENTS.md "Every agent and function is registered and tagged" and "Board and technique machinery" rules 3 to 5).**

1. **Types first.** `SelfCardLensInput`, `SelfCardLensOutput`, `CardLensId` (`lifestyle|world|work|loved|family`) in
   `src/reading/self/v3/types.ts` (or `src/reading/cards/types.ts` beside `StoredCardReading`), a Zod validator for the
   output, before any code uses them. Output: `{ text: string[] (≤ 3 short paragraphs), step: string | null, facts: string[]
   (the fact keys used), question?: { factKey, text } }`.
2. **Technique.** `TECHNIQUES` row `self.card_lens` in `src/techniques/catalog.ts`: charts, algorithm in plain steps, source
   `docs/reading-engine/73`, code path, agent `self.card.lens`, `accuracy: 'area_checks:self'`, `selectors: { boards:
   ['you'], subjects: ['general_life_direction'] }` and a `contract` (inputs: the card's stored reading and ledger cells;
   system: `src/reading/prompts/cards/lens.md`; user: `['TODAY','FACTS']`; output: `self_card_lens.v1`). The catalogue
   test (`tests/unit/techniques/contracts.test.ts`) fails without it. Status stays `planned` until built.
3. **Agent.** `AGENTS` row `self.card.lens` in `src/agents/registry.ts` (`kind: 'llm'`, `module: 'self'`, `subModule:
   'cards'`, `role: 'fast'`). Every `withAgentRun` passes `technique: 'self.card_lens'` and `kundliId` and the charts read.
4. **Digest slice and cache plan.** The input is built from the build context (never the database): a stable prefix (≥ 1,024
   tokens; pad with the card's own stored line, rows it may legitimately read and the facts list) plus a variable suffix
   (the period, the lens, the question state). Register the slice in `SUBAGENT_DIGEST_SPECS`
   (`src/reading/oracle/digestSlices.ts`) and `src/techniques/subagentCachePlan.ts`; call with `cachePrefix: true` and
   `cacheOwner: { userId, kundliId }` with the stable individual prefix in `parts[0]`; warm the prefix with the card's own
   prefix when the face is opened (`READING_EXPLICIT_CACHE=1`).
5. **Ledger and sweep.** Any created cache region exists only with its `llm_cache_entries` row (`name`, `provider`,
   `user_id`, `kundli_id`, `prefix_hash`, `model`, `created_at`, `last_used_at`, `expires_at`). After each use the agent calls
   `informIndividualCacheUsed({ userId, kundliId })`; `recycleIndividualCaches` removes the individual's regions and
   `technique_outputs` after `READING_CACHE_RECYCLE_MINUTES` (45) of inactivity; `runScheduledSweep` is the safety net. A
   region whose id is not in the ledger is a defect to fix before merge.
6. **Stored output.** `technique_outputs`, `technique_id = 'self.card_lens'`, `cache_key` / `digest_version` =
   `self.card_lens|card=<id>|lens=<id>|span=<period>|clock=<clock>|digest=<version>|prof=<profile hash>|voice=<voice
   version>|p=<prompt hash>|`. It carries the digest version, the clock and the boundary stamps that can change it, so a
   profile-only change rebuilds it and nothing else does. `valid_to` = the end of the period it covers. Sealed through
   `SEALED_MODELS.TechniqueOutput`. Run summaries hold counts, ids, tones and scores only (checked by
   `tests/unit/techniques/summaries.test.ts`).
7. **Endpoint.** `GET /api/self/v3/cards/:id/lens/:lens?span=<period>` (signed-in user only; chart from the user; `403` on
   another `userId`). States: `ready` (text from cache), `writing` (queued or running; the page polls every 2 s,
   stops after 60 s with "taking longer than usual"), `failed` (one retry button), `needs_fact` (`question` set; the answer
   goes through the existing fact store and the next GET writes), `off` (`SELF_CARD_LENS_ENABLED` unset). A GET never spends: for
   a missing lens it answers `{ state: 'idle' }`, and the page's open of the face sends
   `POST /api/self/v3/cards/:id/lens/:lens` (`202 { state: 'writing' }`, `409 already_writing`), which queues the write through
   the same build queue the card readings use, under the `CARDS_SPEND_CAP_USD` cap
   (`429 spend_cap` at the cap).
8. **Env.** `SELF_CARD_LENS_ENABLED` (default off), `SELF_CARD_LENSES` (default `lifestyle,world,work,loved,family`),
   `SELF_CARD_LENS_MODEL` (default the personalizer's model chain), `SELF_CARD_LENS_MAX_PER_DAY` (default 12 per person,
   counted within the cap). All read through `src/config/env.ts`.
9. **A lens costs a question?** No. A lens is written from stored content and the person's own facts; it is not a fresh
   rebuild, a clock switch or a re-read on another system, so rule 7 of the personal-assistant rules does not require a
   cost line. If Sachin wants a limit on it, it is `SELF_CARD_LENS_MAX_PER_DAY`, not a question.

**Cost statement (key, model, calls, cost), to be confirmed before any live call (AGENTS.md rule 7 "No paid call without a yes"):**

| Item | Value |
|---|---|
| Key | the Gemini key the card readings already use (`GEMINI_API_KEY` on the Lambda); no new key |
| Model | the personalizer's model chain (`SELF_PERSONALIZER_MODEL`, else `READING_MODEL_ORACLE`, today the Gemini Flash tier); named in the replay report |
| Calls | **1 per (card, period, lens) first open**, plus at most 1 repair; 0 on every later open; 0 for `needs_fact` |
| Estimated cost | on the order of **US$ 0.003 to 0.015 per lens** with a warm cached prefix (estimate from the size of a card's Personalizer call; not measured). A person who opens 5 lenses on 4 cards is at most 20 calls ≈ US$ 0.06 to 0.30. Capped by `CARDS_SPEND_CAP_USD` (0.75 per person per day) and `SELF_CARD_LENS_MAX_PER_DAY` |
| First replay | in the Lab on **stored dossiers only** (a handful of cached chart dossiers, no live build), one lens per card for 3 cards, stated before it runs; the replay report records wall time, prompt tokens, cached tokens, output tokens and cost per agent, as the board plan requires |
| Gate | **Needs Sachin's yes for: the replay's cost (a few cents), then for turning `SELF_CARD_LENS_ENABLED` on in production.** Phase 2 code ships dark; nothing calls a model until both yes. |

**Budgets (rule 6).** Code layers under 1 s (the lens input slice and the facts join are code); a first lens under 6 s; a
cached lens under 100 ms; cached share of model input above 70 % on a warm prefix; a profile-only change rebuilds only the
lens rows whose `prof=` hash changed. A change that misses these is not merged; the Lab replay is the gate.

---

## 5. Architecture

```text
Browser (web, feat/self-vclean ...)
  memory cache --> IndexedDB (AES-GCM, key per session, wiped on sign-out)
      | If-None-Match
      v
API Lambda: GET /api/self/v3 ----> getSelfV3 ----> Postgres (shared with admin)
  requireUser -> 403 on other userId   rounds: kundlis -> dasha applicability ->
  withinBudget(2000 ms) -> 503           [technique_outputs v2 build, person_facts, area_builds]
  sha1 ETag / 304                         -> [board_layout, technique_outputs (self.v3.cards,
                                              self.card.reading <=300 rows), cards state]
PUT /api/self/v3/layout --> validateLayout --> board_layout upsert (options, board_options)
                                          \--> mark cards queued (awaited) --> queueSelfReadingBuild (not awaited)
                                                    \--> build Lambda (card Oracle + Personalizer, cached prefix)
Phase 2: GET /api/self/v3/cards/:id/lens/:lens --> technique_outputs (self.card_lens) hit -> ready
                                               \-> miss -> queue -> lens agent (cached prefix, llm_cache_entries)
                                                                  -> technique_outputs -> poll every 2 s
Sweep: informIndividualCacheUsed -> recycleIndividualCaches (45 min) -> runScheduledSweep (safety net)
```

Boundaries and what each guarantees:

- **Request path:** read-only plus the layout upsert; no model call; capped at 2000 ms.
- **Async build:** the only place Phase 1 reads spend money (card readings, as before); capped per person per day.
- **Database:** the shared Postgres. Schema changes only in `AIAstra_Server/prisma/migrations` (`aiadastra_admin` never
  changes it). Personal text is sealed per `SEALED_MODELS`.
- **Browser:** holds ciphertext at rest, ids in `sessionStorage`. No reading text in plain form.
- **Engine:** the only source of astrological data; this plan adds none. Period text joins stored paragraphs to stored
  dates by string match; the lens joins stored text with the person's own facts.

---

## 6. Ingredients

| Ingredient | Who provides it |
|---|---|
| Migrations m50 `20261112190000_board_layout_board_options_m50` and m51 `20261112190100_board_read_indexes_m51`, applied from `AIAstra_Server` with `npx.cmd prisma migrate deploy`, then `npx.cmd prisma generate` and `npx.cmd prisma migrate status`. m50 is additive (a `JSONB NOT NULL DEFAULT '{}'` column). m51 is two plain `CREATE INDEX IF NOT EXISTS`, which block writes to `technique_outputs` while building: **apply at a quiet time**, or by hand as `CREATE INDEX CONCURRENTLY` and mark applied. | deploy session (authorised in AGENTS.md for additive migrations) |
| **Order:** m50 and m51 before the code deploys. Unmigrated, `PUT /api/self/v3/layout` answers 500 (Prisma selects `board_options` on every layout read and write) and GET falls back to an empty layout. | deploy session |
| Env, all with defaults, none required at first: `CARD_FACES`, `CARD_FACE`, `CARD_TOOLS`, `CARD_TOOLS_DEFAULT`, `CARD_GROUP_BY_VALUES`, `CARD_GROUP_BY`, `CARD_GROUPS_AS_VALUES`, `CARD_GROUPS_AS`, `CARD_START_VALUES`, `CARD_START`, `BOARD_CONFIRM_DEFAULT`, `BOARD_MOTION_DEFAULT`, `SELF_V3_ROUTE_BUDGET_MS` (existing: `SELF_V3_ENABLED`, `SELF_V3_BUILD`, `READING_CLOCK_LAYER`, `CARDS_READ_MIN`, `CARDS_SPEND_CAP_USD`, `READING_CACHE_RECYCLE_MINUTES`, `READING_EXPLICIT_CACHE`). New by this plan: `SELF_V3_CARD_ROWS_MAX`, `SELF_EVIDENCE_ROLES` (after decision), `SELF_CARD_LENS_ENABLED`, `SELF_CARD_LENSES`, `SELF_CARD_LENS_MODEL`, `SELF_CARD_LENS_MAX_PER_DAY`. | agent (code), deploy session (Lambda config) |
| Web keys: an encryption key endpoint per session for the IndexedDB cache (pattern `src/lib/overlayArt.ts`; if none exists for the board, one small authenticated route in the API, own commit). | web agent, then deploy |
| Fixtures: stored dossiers for the Lab replay (§4.6); a `selfV3.fixture.ts` update carrying `rail[].text`, `standing`, `boardOptions`, `boardDefaults`. | agent |
| Sub-agents on Opus 5.5 at medium effort with fast mode (AGENTS.md), installs on Haiku at medium effort with the literal folder. | parent session |
| Sachin's decisions: evidence gating (§4.2), lens replay cost and go-ahead (§4.6). | Sachin |

### Testing note (important)

The worktree `C:\Users\Owner\Documents\work\wt\server-board-layout` has **no usable `node_modules`** (no
`.package-lock.json`; `@smithy/core` and `merge-descriptors` missing; `@langchain/openai/node_modules/openai/resources/graders/*`
truncated; filed in `docs/TODOS.md` 2026-11-12). The build session therefore ran no `tsc` or full vitest here, and this plan
was written with no install, `tsc` or test command. So **typecheck and tests run in CI on the pushed branches before
merge** (`npx tsc --noEmit` and `npx vitest run tests/unit/reading/boards tests/unit/reading/self/v3` in the server;
`npm run typecheck` and `npm test` in the web and, as a gate for the shared contract, in `aiadastra_admin/api` and
`web`). A Haiku install agent at medium effort, given the literal worktree folder, can fix the install if a local run is wanted
(`npm ci` there). Until CI is green, the Phase 1 server commits count as written, not verified.

---

## 7. Action steps in sequence

`‖` = can run in parallel with the others of the same number (separate branches or worktrees, no shared files).

0. **Switch the GitHub CLI to `sachinm`** (`gh auth switch --hostname github.com --user sachinm`, then `gh auth status`).
   Done when `sachinm` is active. Needed before step 5.
1. **Push and verify the server Phase 1 commits on CI** (`1b5e944`, `32cdb08`, `9512668`; this doc). Files: none. Done
   when `tsc` and the unit tests are green in CI for `feat/board-layout-vclean`. Push is the deploy session's.
2. ‖ **Apply m50 and m51** (`npx.cmd prisma migrate deploy` from `AIAstra_Server`, then `generate` and `status`), m51
   at a quiet time. Done when `migrate status` is clean on staging. Must precede step 5's deploy, not step 3.
3. ‖ **Web types and options (D2, D3):** copy the server types into `src/lib/selfV3Api.ts`; extend `src/lib/cardOptions.ts`
   with the new keys, `effectiveCardOptions` and tests; map faces to sections. Done when web `typecheck` and `test` pass.
4. ‖ **Web card redesign (D4, D5):** toolbar, faces, tools, banner, gear, period carousel, never-pretend, Show more,
   chart details always visible; screenshots at 1024, 1440, 1920 px for each card and face in
   `docs/screenshots/self-card-faces/01-…png`. Depends on step 3's types, not on its code.
5. ‖ **Web board cache (D6):** memory cache, encrypted IndexedDB, `If-None-Match`, `sessionStorage`, optimistic PUT with
   rollback. Independent of step 4 apart from `selfV3Api.ts` (step 3 owns the types; this step owns the fetch and cache
   code in a new `src/lib/selfV3Cache.ts`).
6. ‖ **Server tightening (D7):** items 1 and 2 of §4.1 first (overlap the layout read, narrow and bound the readings read);
   items 3 to 5 only if the measurement in step 8 says so. Tests for each.
7. ‖ **Decision request to Sachin:** evidence gating (§4.2) and the lens replay cost (§4.6). Done when answered in writing.
8. **Measure** on staging: route server time (the route logs the budget; add a `server_ms` log line), a browser trace of
   paint from memory and from disk, and the rows returned by the card-readings read for a real account. Fill the
   measured column of §4.5. Done when each Phase 1 target is met or filed in `docs/TODOS.md` with its gap.
9. **Phase 1 merge:** `npx tsc --noEmit` and unit tests (server), `npm run typecheck` and `npm test` (web, and the admin
   repos if the contract changed) green in CI; merge both feature branches into `develop` with `--no-ff`; push; deploy
   through `release-candidate-staging` (GitHub Actions) as AGENTS.md authorises. m50 and m51 are applied first.
10. **Evidence gate (D8)** only if step 7 chose B: env `SELF_EVIDENCE_ROLES`, `areaViews` change, test that a public body
    has `evidence: []`. Close the TODOS entry.
11. **Phase 2 build, dark (D9)**, in this order, each its own commit: types and validator → `TECHNIQUES` and `AGENTS` rows
    and catalogue test → digest slice and cache plan → agent, prompt `lens.md`, validators → endpoint and queue → web
    `LensFace` with its writing, failed and needs-fact states. `SELF_CARD_LENS_ENABLED` unset.
12. **Lab replay** of the lens on stored dossiers, after Sachin's yes to its cost. Report wall time, tokens (cached and
    total), cost per agent, and the text for Sachin's review. Done when the numbers meet §4.6's budgets.
13. **Turn the lens on** (Lambda config) only after Sachin's second yes; live check on one account; delete the closed
    findings from `docs/TODOS.md`.
14. **Clean up:** delete merged branches locally (`git branch -d`), remove merged worktrees by literal path, stop any local
    server started, confirm none is running.

Parallelism: steps 3, 4, 5, 6 and 7 can run at once; 1 and 2 are the gate before any deploy; 8 follows a staging
deploy of the server work; 11 can start in parallel with 4 to 6 on its own branch but ships dark.

---

## 8. Development phases

Each phase leaves the system working and shippable, and closes with a check.

| Phase | Contents | Closes with | Deferred |
|---|---|---|---|
| **1a. Server contract (built, unverified)** | `1b5e944`, `32cdb08`, `9512668`: options, `board_options`, ETag/304, route budget, shorter GET, per-period text, indexes. | CI green (`tsc`, unit tests) on the pushed branch; m50 and m51 applied; `GET /api/self/v3` answers 200 on staging after the deploy; a second GET with `If-None-Match` answers 304. The old web keeps working (all new fields are additive, `RailItem.text` and `standing` are ignored by it). | Web use of the new fields. |
| **1b. Web faces, tools, gear, banner** | Steps 3 and 4. | Web `typecheck` and tests green; screenshots at 1024, 1440, 1920 px of every card and face reviewed by Sachin; a test that choosing another period changes the text or is not offered; each board card renders `card-art-<id>`. | Cache; lens. |
| **1c. Web cache and server tightening** | Steps 5, 6, 8. | A trace: board from memory under 100 ms; from disk under 100 ms; GET server time under 100 ms warm (or the gap filed); the 503 path keeps the cached board; sign-out clears IndexedDB. | Stamp-based 304 unless needed; evidence gate until decided. |
| **1d. Evidence gate (if chosen)** | Step 10. | A public user's body has `evidence: []`, with a test. | n/a |
| **2. Lens (dark, then on)** | Steps 11 to 13. | Lab replay report within §4.6's budgets and Sachin's two yeses; a live check on one account shows `ready` in under 6 s the first time and under 100 ms the second, the cache row in `llm_cache_entries`, and the 45-minute sweep removing it. | Lenses beyond the five; Love and Work boards on the same faces (the same `board_layout` row shape; their `v3` layout routes do not exist yet). |

---

## 9. One recommendation

**Ship Phase 1 as written, in this order: verify and migrate the server, then the web faces and cache, then tighten the
server only where a measurement says it is needed. Build the lens dark, and ask Sachin for one replay and one go-ahead.**

Why: Phase 1 costs no model money and fixes what the person actually hits (periods that change nothing, lost art, a veil on
every visit). The server contract is already built and additive, so the old web keeps working while the new one lands. The
measured budget decides whether the stamp-based 304 is worth its staleness risk. The evidence gate is a product call, so it
waits for Sachin; the lens is the only paid thing, so it ships dark.

| Choice | Verdict |
|---|---|
| Faces and tools computed in the browser from stored text | **Chosen.** No model, instant, nothing new stored. |
| Lens written per card and period, on first open, cached | **Chosen for Phase 2.** Specific to this person, cost only when asked. |
| Lenses prewritten for every card in the board build | Rejected: 26 cards × 5 lenses of spend for text most people never open, and many lenses need a fact the person may not have given. |
| 304 from a hash of the body (built) | **Kept** as the baseline: simple, always correct. |
| 304 from a cheap stamp | Optional, only if the GET stays over 100 ms after steps 6 and 8; needs a test per input. |
| Evidence keys: gate on the server by role (B) | **Recommended** to Sachin; display-only hiding (A) is the status quo. |
| Faces as a content option (a different set of fields per face) | Rejected: a face is layout; adding fields per face would widen role-gated content (doc 71 §4.4). |
| Board-wide settings in a new column | **Chosen** (`board_options`); per-card choices stay in the existing `options` column. |

---

## Appendix A. Competitor and adjacent-app research (sources checked)

Taken from the planning notes of 2026-11-12 (web sources named there; nothing here was re-fetched when writing this doc, so
treat each as a summary, not a quotation). Each row says what we adopt or reject. The existing deeper research notes are in
`docs/research/reports/Self screen design patterns.md` and `docs/research/research_notes/Self screen design patterns/`.

| App | What it does (summary) | Source | We adopt | We reject |
|---|---|---|---|---|
| **Co-Star** | A Do/Don't list at a glance, a daily theme, categories such as "Luck in home & family" and "Trouble with friends", subtle "Details" links for depth, friend compatibility. | [App Store](https://apps.apple.com/us/app/co-star-personalized-astrology/id1264782561), [ScreensDesign](https://screensdesign.com/showcase/costar-personalized-astrology), [Pratt critique](https://ixd.prattsi.org/2024/09/design-critique-co-star-ios-app/) | The glanceable Light face; depth behind a quiet link (Chart details, Research); life-area categories as the Phase 2 lenses. | Generic, shared categories with no stated facts (breaks "specific to this person, or not shown"). |
| **The Pattern** | Chart themes in everyday language, timing cycles and "Bonds". | [Fate Script](https://fatescript.com/best-astrology-apps/) | Plain-language themes; timing shown as periods (the period strip and Table). | Its relationship-first framing as a default for every card. |
| **CHANI** | Readings paired with reflection prompts, journaling and affirmations. | [chani.com/app](https://www.chani.com/app) | The "one step" line and a reflect line after a face is read. | Journaling as a separate product surface (out of scope here). |
| **Sanctuary** | Interactive birth chart, compatibility across five areas of love, live readers. | [App Store](https://apps.apple.com/us/app/sanctuary-psychic-reading/id1417411962) | Nothing directly; confirms five love areas as a lens count. | Live readers (a marketplace, not our product). |
| **AstroSage Kundli AI** | Calculation-first: 16 divisional charts, dasha to 5 levels, PDF reports; dense for beginners. | [Google Play](https://play.google.com/store/apps/details?id=com.ojassoft.astrosage) | Depth for those who want it, kept behind a flip: the **Research** face. | Density on the first screen. |
| **AstroTalk** | Marketplace of live astrologers paid per minute, plus a free report by life area. | [Google Play](https://play.google.com/store/apps/details?id=com.astrotalk), [comparison](https://theastrologyreview.com/astrotalk-vs-astrosage) | Life-area breakdown as a free, structured read (the lenses). | Per-minute human consultation. |
| **Jagannatha Hora** | Windows study tool with every varga, dasha system, ashtakavarga and Tajaka chart. | [feature list](https://www.shram.kiev.ua/horoscopes/jagannatha/) | The bar for the **Research** face's depth, not its tone. | Its interface and jargon for the general person. |
| **Drik Panchang** | Calculation-first panchang and kundli. | [Graha Darpan comparison](https://grahadarpan.com/compare/astrosage-vs-astrotalk-vs-drik-panchang) | Reference point for date-first views (Dates, Calendar). | A calculation-first first screen. |
| **Hinge** (dating) | A vertical stack of prompt cards, each tappable to respond: "a conversation, not a verdict". | [design notes](https://www.uiskillbook.com/design-md/hinge.md) | "Is this right?" as a tap on the card, a confirm that becomes evidence. | Public profile-style prompts. |
| **Stoic and Stillee** (self-help, journaling) | Guided templates instead of a blank page, one-tap mood check-ins, prompts drawn from the person's own stated stresses. | [Stoic](https://screensdesign.com/showcase/journal-mental-health-stoic), [Stillee](https://stillee.com/how-it-works/journal-and-mood/) | One-tap questions that follow known facts (the lens's `needs_fact` question). | Daily streak mechanics. |
| **BetterHelp** (therapy) | Reflection prompts tied to what was just discussed raised repeat journal use by 12%. | [case study](https://www.cole.lol/portfolio/betterhelp/) | A reflection line after a face is read, tied to the period on screen. | Clinical framing. |
| **Headspace** (lifestyle) | A curated Today tab with a clear next step instead of a library. | [case study](https://jarynmiller.design/designing-for-care-at-headspace) | One step per card; the Light face. | A library of content to browse. |
| Bumble, Calm, Finch, Rosebud, Talkspace | Included in a search; no usable source came back. | none | not counted | not counted |

---

## Appendix B. What changed from the planning notes (facts the code corrected)

For the reviewer. The planning notes of 2026-11-12 were written before the server build; the code now says:

1. **Per-period text is matched by dates in the text, not by Oracle sources.** The notes planned to join each v2 body
   paragraph to the period its Oracle `sources` fall in; `splitBodyByPeriods` (`response.ts`) instead matches a paragraph
   to the first period whose start or end date it names, and the rest are `standing`. A paragraph that names no date is
   shown on every period; a period no paragraph names has `text: null`. Joining by `sources` stays a possible later step.
2. **The ETag is a hash of the body, not a tag built from the build time, layout `updated_at`, card states and profile
   version.** It never serves a stale board, but the 304 is decided after the full read.
3. **Option keys are `face, tools, groupBy, groupsAs, start` plus `length, view, words, plan`** (the notes listed `face, tools,
   groupBy`); the response also returns `layout.boardDefaults`.
4. **The header is already done on the web branch** (`feat/self-vclean`: `006d499`, `7ef177b`, `e4c898d`), and the web main checkout
   is on `feat/self-vclean`, not `release-candidate-staging`.
5. **Only the Self board has a v3 layout route.** The notes said Love and Work "use the same row shape"; the row shape is shared
   (`board_layout.board`), but no `/api/love/v3/layout` or `/api/work/v3/layout` route exists.
6. **The registry has 26 cards, not 11**; 15 more appear only when the per-card reading is on.
7. **`readerRole` practitioner set is `student, astrologer, researcher`** (hardcoded in `src/reading/person/profile.ts`); the
   2026-11-12 TODOS entry names `aiastra_admin`, which the code does not include.
8. **The lens endpoint path is `/api/self/v3/cards/:id/lens/:lens`** (the notes said `/card/:id/...`), matching the existing
   `/cards/:id/read`.
9. **The web has not adopted `RailItem.text` or `standing` yet**, so the "period changes nothing" bug is fixed on the server
   only; it is fixed for the person when step 4 ships.
