# 10 · Love and Work on the You board's v3 card machine: build plan

Written 2026-11-18 for tonight's build and release. Sachin approved it in advance: "Upgrade those 2 dashboards to be just
like You with their own card topics and aspects … copying exactly the efficiencies of caching data, context and prompt."
This plan covers 8 lenses and 72 cards (docs 00–08). The card specs live in docs 01–08, and this doc does not repeat
them. Each row in §4.5 points back to its doc for the oracle question and the personalizer goal.

## 1. Start (checked against code, 2026-11-18)

**Code checked out:**
- Server: `develop` @ `9f66577` in `C:\Users\Owner\Documents\work\wt\server-retrograde`.
- Web: `develop` @ `e2fa35f` in `C:\Users\Owner\Documents\work\AIAstra_WEB`.

**The You v3 pipeline (doc 70):**
- `self/v2/build.ts` calls `runSelfV3Cards` (`self/v3/build.ts`) once the v2 Oracle has served. That rule is doc 83 step 0, live since 2026-11-18.
- The run builds the year frame, then the slices (`kundli_slices`: `natal.core`, `sky.window`, `year.tp`, `frame`, `clock.<system>`, `matter.<key>`).
- Then the clock layer (`clocks/run.ts`) writes one sheet per clock, a code count and the concordance into one **AgreedLedger**.
- Then `cards/run.ts readCards` calls one Oracle and one Personalizer per card. With `CARDS_GROUP_PACK=1` it reads the cards in groups over one cached pack (`cards/group.ts`).
- Each card is stored in `technique_outputs` (technique `self.card.reading`, key `cardStoreKey`).
- Card state (queued / reading / done / failed, the day's spend, the stage and the clocks) is one `area_builds` row per kundli per day (area `self.cards`, `cards/state.ts`).

**The ledger already covers every matter.**
- Clock readers write cells for every matter their rows touch (`clocks/reader.ts:291`), and `renderSliceSet` writes a `matter.<key>` slice for every matter in the window (`slices/render.ts:227,287`). All 12 engine matters are in the ledger and the slices, whatever board asks.
- A card is only `{ matters[], brief }`. `cardCells(ledger, def.matters)` picks its cells, and `cards/<board>/<id>.md` is its brief.
- The natal prefix (`self/oracle.ts` family packs) already carries:
  - D1 houses with `arudha=` per house (A1–A12, UL = A12), argala, SAV;
  - points with chara karakas (AK, AmK, DK, PK, BK, GK), yogas and the star profile;
  - D2–D60 planets and the D9/D10/D30 houses, where stored.

**Assumptions the code makes about Self:**
- Self ids are a closed union `SelfCardId` (`self/v3/types.ts:53`). `cardDef`, `READABLE_CARDS` and `SELF_CARDS` (`self/v3/cards.ts`) are imported by the 16 files listed in §7 S3.
- `cardBriefPrompt(id) = cards/self/<id>` (`cards/types.ts:12`).
- `readCardReadings` takes the 300 newest rows (`cards/store.ts:50`).
- `CARDS_READ_MIN` defaults to 5 (`env.ts:1008`). The Career-start and Hobby starter sets have 4 cards.
- The spend cap is `CARDS_SPEND_CAP_USD` = $0.75 per kundli per day, shared through the one state doc.
- The schema enums (`oracleV3Schema`, `personalizerV3Schema`) are built from the id list passed in, so new ids need no schema change.
- `CLAIM_RE = /^[a-z0-9_.]{1,60}$/` (`v2api/service.ts:244`).

**Love and Work today:**
- `/love` renders `AreaBoardView` over `GET /api/area/love`. `/work` renders `WorkPage` over `GET /api/area/career`. Neither has v3 cards.
- `boardCardsRoutes.ts` serves `GET/PUT /api/board/:board/v3/{catalogue,layout}` with the legacy `BOARD_CARDS` (19 ids such as `love_where`). These are stored in `board_layout (kundli_id, board)`, the same row v3 will use.
- Internal ids are visible on screen:
  - `WorkPage.tsx` has 12 technique badges (e.g. `:186` "work.present_tone · Present Tone").
  - `AreaBoardView.tsx` has 16 (`:480–1331`).
  - Tests assert them: `LovePage.test.tsx:122`, `WorkPage.test.tsx:127`, `YouPage.test.tsx:233-234`.

**Web You v3:**
- `pages/you/v3/SelfBoardV3.tsx` (777 lines) is hard-wired to Self. The list is in §7 W1–W4.
- The phone header slot (`BoardHeaderSlot`, doc 09) is on `develop`.
- `CardBanner` finds its art through `selfGroupOf(id)`. That returns null for non-Self ids, so the banner is blank.
- The web PATCHes `/api/self/v3/layout/{cards/:id,board,deck}`, but the server has no PATCH route. Each save takes a 404 and then falls back to PUT.

**Live flags:** `SELF_V3_BUILD=1` and `READING_CLOCK_LAYER=1` were set on `aiastra-server-api` on 2026-11-18. The live value of `CARDS_GROUP_PACK` has not been read; read it at R3.

## 2. End goal

- **`/love` and `/work` look and behave exactly like `/you`.** Each has:
  - a phone header with the board title, the reading button and settings;
  - a chips row, then the card carousel at full height;
  - the Read and Short faces, the period strip, key dates and Chart details;
  - one past-event confirm per card.
- **A lens switcher on both boards:**
  - Love: Dating · Marriage · Friends · Allies at work.
  - Work: Starting out · Your job · Craft & hobby · Business.
  - The default lens comes from the person's facts.
  - Switching lenses never leaves the page.
- **No internal id or engine name on any surface.** That covers the old pages too, while they remain as the fallback.
- **One ledger and one prefix:**
  - Love and Work cards stand on the same per-kundli clock layer and agreed ledger as You.
  - They use the same shared prefix and the same group-pack cache.
  - No second clock layer and no second natal prefix. The only difference between boards is the card list.
- **Timings:**
  - A cached GET of a board is at most 300 ms (2 s route budget).
  - After a deck save with the clocks already read: about 20 s to five cards, about $0.08 per lens deck (doc 70 §4.3).
- **Readiness:** 69 of the 72 cards are offered tonight. Cards 20, 39 and 71 show "Coming soon" until doc 80 lands.

## 3. Deliverable

**Server (`AIAstra_Server`, branch `feat/boards-v3-love-work` off `develop`):**
- New registry `src/reading/boards/v3Cards.ts`.
- New lookup `src/reading/cards/registry.ts`.
- New service `src/reading/boards/v3Service.ts`.
- New routes `src/routes/boardV3Routes.ts`.
- 69 briefs: `src/reading/prompts/cards/love/<id>.md` and `cards/work/<id>.md`, then `npm run prompts:embed`.
- Generalized: `cards/{run,group,oracle,state,store,types}.ts`, `self/v3/{types,layout,response,build}.ts`, `boards/features.ts`, `config/env.ts`, `routes/boardCardsRoutes.ts`, `routes/areaRoutes.ts` (refresh guard), `server.ts`.
- **No migration.** `board_layout`, `area_builds`, `technique_outputs` and `kundli_slices` hold everything.

**Web (`AIAstra_WEB`, branch `feat/boards-v3-love-work` off `develop`):**
- New `pages/board/v3/BoardV3.tsx`, made from SelfBoardV3 with a `board` prop. SelfBoardV3 becomes a one-line wrapper.
- New `LensSwitcher.tsx`.
- Board-parameterized `lib/selfV3Api.ts` and `lib/selfV3Cache.ts`.
- Updated `LovePage.tsx` and `WorkPage.tsx`: v3 first, legacy fallback.
- Badges removed from `WorkPage.tsx` and `AreaBoardView.tsx`.

**Env:**
- New `BOARDS_V3=love,work` (server). Unset means off.
- New `CARDS_READ_MIN_AREA` (default 1).
- No web env.

**Tests:** see §7 S10 and W8.

## 4. How it works when done

### 4.1 Backend

1. **Saving a deck.** `PUT /api/board/love/v3/layout {version, patch}`:
   - Writes the versioned layout on `board_layout (kundli, 'love')`. A stale version is refused with 409 `stale_layout`.
   - Marks the active lens's unread deck cards `queued` in today's shared state doc.
   - Calls `queueSelfReadingBuild(prisma, userId, kundliId, 'self')`. There is one build per kundli. Its marker is `self.reading`; `building` blocks a second build, and a failure blocks it for 30 minutes.
2. **Opening a board (build on open, doc 69 D3).** The first `GET /api/board/:board/v3` of the day for a chosen board:
   - Writes `opened[board] = true` into today's state doc.
   - Queues every card of the active lens's deck and queues the same build. It does this once per board per day.
   - A card whose `cardStoreKey` is unchanged is served from `technique_outputs` at no cost. Only cards whose ledger, frame, profile or brief changed are read again.
   - A board's first ever read is free, as on You.
3. **The build** (self-invoked Lambda, 300 s):
   - The v2 build runs. On a second run the same day it is served from stored keys.
   - Then `runSelfV3Cards` builds the frame and slices. It reads the clock layer from the `layer.clock` cache row, with no call on a second same-day run.
   - The gate passes when the Self deck holds `CARDS_READ_MIN` cards **or any card in the state doc is `queued`**. Queued Love and Work cards always open it.
4. **Reading the cards.** `readCards` reads the queued cards (any board) first, then the Self deck.
   - **One pack:** the pack is built from **the union of the three decks** (the Self deck plus the active Love and Work lens decks of enabled boards) plus any queued extras. All three boards therefore share **one cached pack**, which holds the shared prefix once.
   - **Groups:**
     - Board groups are `CARDS_GROUP_SIZE_BOARD` (default 1, live value to read) and run all in parallel.
     - Each group call has a 90 s timeout and 16k output tokens.
     - Each card gets one repair.
     - A failed card is marked `failed` alone.
   - **Spend:** before each card, the spend is checked against the shared day cap. At the cap the rest stay "not read yet".
5. **Card ids** are unique across boards: `dating_*`, `marriage_*`, `friends_*`, `allies_*`, `start_*`, `job_*`, `craft_*`, `biz_*`.
   - The state doc, the store key and the claim ids (`<card>.<tag>`, at most 60 characters) need no board field.
   - Underscores avoid splitting on `.` in `card.<board>.<id>` feature keys and claim ids.

### 4.2 Cache keys (exactly as You)

| Layer | Key | Scope | Shared by boards? |
|---|---|---|---|
| Slices | `kundli_slices` row per slice id; hash = id + text + keys | per kundli, per change | yes |
| Clock layer | `kundli_slices` row `layer.clock`; key = asOf, model, shared-prefix hash, frame hash, every `clock.<system>` hash, 3 prompt hashes, `READER_INPUT_VERSION`, `LAYER_CACHE_VERSION` | per kundli per day | yes, one per kundli |
| Shared prefix | `sharedPrefix(picked.shared).hash` over the `natal.core`, `sky.window`, `year.tp` and `frame` slice hashes; Gemini `cachedContents` key `prefixKey = sha256(model⏎system⏎text)[:24]`, owner `{userId, kundliId}` | per kundli per day | yes, built once |
| Card pack | `ensurePromptCache(model, cardPackSystem(), pack.text, owner)`; the pack is the prefix, frame, person, timing block, then the briefs, cells and matter rows of the **union of the decks** | per kundli, per deck set | yes, one pack |
| Card reading | `cardStoreKey`: `self.card\|card=<id>\|clock\|frame\|ledger\|pre\|profile\|portrait\|sections\|confirm\|p=<role prompts>.<brief hash>.g<group prompt>` in `technique_outputs` (`self.card.reading`) | per card | key unchanged; new ids only |

**The 45-minute recycle is unchanged.**
- `readCardGroup` and `readCardOracle` call `informUsed`, which calls `informIndividualCacheUsed({userId, kundliId})`. The owner is the same for every board, so the one timer is simply reset.
- 45 minutes after the last use, `recycleIndividualCaches(onlyUsed)` deletes:
  - the used Gemini caches (prefix and pack);
  - the used reader-cache rows;
  - the used non-model `technique_outputs`;
  - the memos.
- Card readings and clock sheets are made by agents of `kind: 'llm'` (`self.card.oracle`, `reading.clock`). They are kept until `valid_to` (`outputStore.ts:542-562`).
- No new hook is needed. EventBridge `llm-cache-sweep` remains the safety net.

**What not to touch tonight:** `cards/oracle.md`, `cards/group.md`, the v3 personalizer prompt and `common/reader-system.md`.
- Their hashes are part of every You card's store key and of the clock-layer key. One edit re-reads every You card for every person, and those are paid calls.
- Board rules go in each brief instead: no separation, divorce, job-loss or firing verdicts (doc 69); Rule 0 disambiguation; no legal or medical advice.
- `PROMPT_VERSION` will change because of the new briefs. Its only cache uses are `reading_findings_cache` (Ask flow) and clarify, which re-key once. Accepted.

### 4.3 API

The Self routes are unchanged. The new routes are mounted only when the board is in `BOARDS_V3`; otherwise they answer 404 `{error:'board_v3_off'}`. Every route checks `requireUser`, `assertOwnAccount` and `Cache-Control: private, no-store`.

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/board/:board/v3` (`love\|work`) | `If-None-Match` | **200** `BoardV3Response` + ETag, or **304**. **404** `{status:'no_kundli'}` or `{error:'board_v3_off'}`. **400** `unknown_board`. **503** `timeout` (2 s budget). |
| `PUT /api/board/:board/v3/layout` | `{version, patch:{cards?, options?, boardOptions?:{lens}}}` | **200** layout view + `reading:{queued}`. **409** `{error:'stale_layout', layout}`. **400** `bad_body`, `unknown_card`, `card_not_offered`, `duplicate_card`, `too_few_cards`, `unknown_option`. **404**. |
| `POST /api/board/:board/v3/cards/:id/read` | — | **202** `{state:'queued'}`. **400** `unknown_card`/`card_not_offered` (including an id from another board). **404**. **409** `already_reading`. **429** `spend_cap`. **503** `off`. |
| `POST /api/board/:board/v3/confirm` | `{claimId, answer}` | **204**. **400** `bad_claim`/`bad_answer`. Written as `self.confirm.<claimId>`, the same fact store as You. |
| `GET /api/board/:board/v3/catalogue`, `GET /api/board/:board/v3/layout`, unversioned `PUT …/layout {cards, options}` | — | Legacy, unchanged. The legacy picker on the old pages still saves. PUT is dispatched **on body shape**: `version` or `patch` present means v3. |
| `POST /api/boards/:board/refresh` (`love\|work` while v3) | — | **409** `not_due`. Tonight the board renews itself once a day on open (§4.1), and `refresh.refresh_due` is false. The paid refresh comes in Phase B. |

**`BoardV3Response`** is `SelfV3Response` field for field (status, builtAt, readVersion, clock, profile, refresh, build, quality, layout, cards[], reading, features), plus:
- `board`;
- `lenses: [{id, title, suggested: CardId[]}]`;
- `activeLens`;
- `defaultLens`.

The fields are filled as follows:
- **`status`:** `ok`; `preparing` when today's state doc says `preparing` (too few clocks, or no ledger yet); `no_kundli`. It never takes v2's `pending` or its failed veil.
- **`clock` and `profile`:** from `getSelfV2`, which is the same build.
- **`refresh`:** `{...v2.refresh, refresh_due: false}`.
- **Cards:**
  - `group` is the lens id and `v2` is `null`.
  - The body comes from the card's stored reading.
  - `available` is false with reason `'Coming soon'` for the cards marked "later".
  - A card is not listed when its `showWhen` excludes a fact the person stated. An unknown or declined fact shows every card.
- **`layout.cards`:** the whole deck across lenses. `layout.boardOptions.lens` is the active lens.

### 4.4 Frontend experience and UI/UX

**Load and poll:**
- `LovePage` mounts `BoardV3 board="love"` (`WorkPage` likewise), and `BoardV3` calls `GET /api/board/love/v3`.
- A 404 `board_v3_off` (or `?legacy=1`) renders the current page unchanged.
- The polling is SelfBoardV3's own: the build poll runs while `preparing`/`building` (10 s pending, 30 s preparing, 2 s build, capped at 6 min, then a late line and Retry). The card poll runs every 2 s while a deck card is `queued`/`reading`.

**Lens switcher:**
- **Tablet and desktop:** a segmented 4-tab bar in the head row.
- **Phone:** the board title in the header slot reads "Love · Dating ▾" and opens a 4-option sheet. It does not take card height (doc 09).
- **On switch:**
  - The chips and the carousel are filtered to `card.group === activeLens`.
  - If the deck holds no card of that lens, the picker opens with that lens's `suggested` cards ticked. The person taps Done.
  - The page then sends one PATCH or PUT (`cards: deck ∪ picked`, `boardOptions.lens`). Unread cards are queued and fill in one by one ("Being read for you now").

**Card states:** pending, queued, reading, ready, failed (Try again), locked (plan) and stale. These use the You copy and components (`notReady.tsx`, `CardParts`).

**Picker:** grouped by lens (`lenses[]` from the response) and titled "Your Love cards" / "Your Work cards".

**Art:** `CardBanner`/`CardThumb` use the lens's art theme (`card.group`), so the banner is never blank.

**No technique ids:** no internal id, technique key or engine name appears on any surface. Titles and subtitles come from §4.5. A test asserts that no `/[a-z]+\.[a-z_]+ · /` text renders on `/love`, `/work` or `/you`.

### 4.5 The card registry (`src/reading/boards/v3Cards.ts`)

**Fields of each row:**
- `{id, board, lens (= group), title, subtitle, description, suggested, sensitive, matters, showWhen, offered, later?, defaultSections: DEFAULT_SECTIONS}`.
- The oracle question and the personalizer goal go **into the brief** (`cards/<board>/<id>.md`), taken from the card's section in docs 01–08. The brief has four parts: the card's board and lens line, what it answers, what it reads, and what it leaves to other cards.
- Each brief names only stored evidence. Where a doc leg needs D11, D16, D24, D30, the TP year lord or TP D2/D4/D7/D30, the brief says "read only if present in the shared data". The card stands without it (doc 84: constrain at generation).

**Legend:**
- **Houses to matter keys:** h1 self_and_body, h2 money_in_hand, h3 effort_and_courage, h4 home_and_peace, h5 ideas_and_children, h6 work_load_and_health, h7 partnership, h8 sudden_and_hidden, h9 luck_and_belief, h10 career_and_standing, h11 gains_and_network, h12 loss_rest_and_distance.
- **Facts:** L = `love.status`, W = `work.status`, WL = `work.level`, F = `self.focus`. A rule hides a card only when the fact is stated and excluded.
- **Status groups:**
  - EARLY = W=studying, or W∈{yes,between_jobs} with WL∈{hourly,employee} and age < 30.
  - EMP = W=yes with WL not an owner level.
  - SEEK = W=between_jobs with age ≥ 30.
  - OWN = W=own_business.
- **Marks:**
  - ★ = starter card.
  - *s* = `sensitive: true`.
  - now·p = tonight on a proxy the doc names (D1 11th + A11 + D9/D10 11th for D11).
  - "(Dx later)" = that leg is added when doc 80 lands; the card ships without it.

| # | id | lens | title | showWhen | reads (matters · key evidence) | tonight |
|---|---|---|---|---|---|---|
| 1 | ★dating_pulse | dating | Where Dating Stands | L∈{single,dating,complicated} | h5,h11,h12 · 5/11/12 lords, A5, Ve, Ma, Mo, D9 5/7, TP | now |
| 2 | ★dating_meeting_timing | dating | When You Meet Someone | L∉{married,committed} | h5,h7,h11 · A5, UL lord, DK, D9 7th, Ju/Ve/Ra transits | now |
| 3 | ★dating_delays_blocks | dating | Why It's Taking Time | any | h5,h7,h8 · Sa/Ke on 5/7/Ve/Mo, papakartari, D9 5/7, AD exit dates | now |
| 4 | ★dating_attraction_pattern | dating | The Partner You Draw | any | h5,h7 · A5 vs DK, 7th lord, UL, Ve–Ma, D9 Lagna/7 | now |
| 5 | dating_mixed_signals | dating | How They Feel & Mixed Signals | L∈{dating,complicated} | h5,h12,h3,h7 · Me, Mo, Ra on Mo/Me, A5 vs AL, Me/Ve stations | now |
| 6 | dating_exes_closure *s* | dating | Exes, No-Contact & Reopening Doors | any | h8,h12,h5,h7 · retro 5/7 lords, Ke–Ve, UL, D9 7/9, 8/12 AD | now |
| 7 | dating_karmic_compatibility | dating | Karmic Pull vs. Real Compatibility | any | h5,h8,h4,h7 · Ra/Ma–Ve, Ju on 5/7, A5 vs A8, D9 7/4 | now (D30 later) |
| 8 | dating_intimacy_safety *s* | dating | Intimacy & Emotional Safety | any | h4,h8,h12 · Mo, Ve avasthas, Kemadruma, D9 4/12, Sa from Mo | now |
| 9 | dating_breaking_patterns | dating | Breaking Your Dating Loop | any | h5,h6,h8,h12 · star chains of 5th lord/Ve/Mo, pending karma, D9 | now |
| 10 | ★dating_transition_commitment | dating | Turning Dating Into Commitment | L∈{single,dating} | h7,h5 · 5th–7th lord/UL link, DK, D9 7/UL, S6D on 7th | now |
| 11 | ★marriage_pulse | marriage | Where Your Partnership Stands | L∈{married,committed,separated} | h7,h4 · 7th + lord, UL, DK, Ve, Ju, D9 L/7, TP 7th | now |
| 12 | marriage_timing_readiness | marriage | Marriage Timing & Readiness | L≠married | h7,h9 · 7th lord, UL, DK, Kuja dosha, D9 7/9, S6D | now |
| 13 | ★marriage_daily_harmony | marriage | Warmth & Day-to-Day Harmony | L∈{married,committed} | h4,h7 · 4th lord, Mo, Ve, argala on 7, D9 4/7 | now |
| 14 | ★marriage_conflict_cycles *s* | marriage | Distance, Strain & Conflict Cycles | L∈{married,committed} | h7,h6,h8,h12 · Ma–Sa on 7/4, nodes 1/7, GK→DK, D9 7/2 | now (D30 later) |
| 15 | marriage_communication | marriage | Communication & Unspoken Resentments | L∈{married,committed,separated} | h2,h3,h7 · Me, Mo, D9 2nd, Me stations | now |
| 16 | marriage_trust_transparency *s* | marriage | Trust, Transparency & Hidden Stress | L∈{married,committed,separated} | h8,h12,h7 · Ra on 7th lord/Ve, UL vs A8/A12, D9 7/8/12 | now |
| 17 | marriage_reconciliation *s* | marriage | Repair & Reconciliation | L∈{separated,married,committed} | h7,h8,h9 · UL, 7th lord, Ke on 7/UL, D9 L/7/9, Ju over UL | now |
| 18 | ★marriage_inlaws_family | marriage | Family, In-Laws & Shared Home | L∈{married,committed} | h4,h2,h8 · 2nd from UL, A4, D9 4/8, Sa on 4/8/2 | now (D4 houses later) |
| 19 | ★marriage_finances_chores | marriage | Shared Money & Responsibilities | L∈{married,committed} | h2,h8,h11,h6 · dhana yogas, A2/A8, D2 hora, D9 2/8/11 | now |
| 20 | marriage_children_family *s* | marriage | Children & Family Growth | L∈{married,committed}, children≠declined | h5,h9,h11 · PK, Ju, A5, D7 L/5/9 (core) | **later** (R3, R4) |
| 21 | marriage_longterm_longevity | marriage | Long-Term Longevity & Second Half of Life | L∈{married,committed}; ★ if age>36 | h7,h8 · UL, 2nd from UL, 7th lord, D1+D9 mutual confirmation | now |
| 22 | marriage_personal_growth | marriage | Your Role & Growth Inside Marriage | L∈{married,committed} | h1,h7 · Lagna lord vs 7th lord, AK–DK, AL vs UL, D9 karakamsha | now |
| 23 | ★friends_social_energy | friends | Your Social Energy This Year | any | h11,h12,h3 · A11 vs AL, Mo, Me, Sa transits | now·p |
| 24 | ★friends_core_allies | friends | The Friends Who Truly Carry You | any | h11,h9 · 11th lord, A11, Ju, BK, D9/D10 11 | now·p |
| 25 | ★friends_outgrowing_circles | friends | Outgrowing Circles & Friendship Friction | any | h11,h6,h8 · Ke/Sa on 11/A11, 6/8 lords on 11 | now·p |
| 26 | ★friends_finding_tribe | friends | Finding Your Tribe & New Communities | any | h11,h9,h3 · Ra in 11/A11, Ju over 11/3/9 | now·p |
| 27 | ★friends_boundaries_drains | friends | Boundaries & Energy Drains | any | h12,h6,h11 · 6th lord in 11, nodes over Mo | now·p |
| 28 | friends_mentors_guides | friends | Mentors, Elders & Supportive Guides | any | h9,h11 · 9th lord, Ju, BK, A9, D9 9th | now·p |
| 29 | friends_reputation_belonging | friends | Social Reputation & Belonging | any | h11,h10,h1 · AL vs A11, 10–11 lord link | now·p |
| 30 | ★allies_pulse | allies | Workplace Dynamics This Year | W∈{yes,own_business} | h10,h6,h7,h11 · D10 L/6/7/10/11, A10, AL, AmK, TP D10 | now |
| 31 | ★allies_bosses_authority | allies | Bosses, Authority & Mentors at Work | W=yes | h10,h9 · Su, Sa, Ju, A10, D10 9/10 | now |
| 32 | ★allies_team_politics | allies | Colleagues, Teams & Office Politics | W=yes | h6,h3,h8 · GK, A6, Me with Ma/Ra, D10 6/8 | now (D30 later) |
| 33 | allies_cofounder_fit | allies | Business Partners & Co-Founder Fit | W=own_business | h7,h11 · 7th lord vs Lagna lord, A7, DK, D10 7/11 | now·p |
| 34 | ★allies_clients_deals | allies | Clients, Deals & Public Trust | W∈{yes,own_business} | h7,h10,h11 · A7, A10, Me–Ve, D10 7/10/11, D2 | now |
| 35 | allies_managing_people | allies | Managing & Leading People | WL∈{manager,senior_leader,owner_staff,several_businesses} | h10,h6,h5 · Su dig bala, Ju, Sa, A10 vs A5, D10 1/5/6/10 | now |
| 36 | ★allies_networking_allies | allies | Networking & Career Allies | W≠retired | h11,h10,h3 · A11, Me, Ju, Ra in 11, D10 11 | now·p |
| 37 | allies_contracts_disputes *s* | allies | Contracts, Disputes & Protection | W∈{yes,own_business,between_jobs} | h6,h8,h7 · GK, A6, A8, D10 6/7/8 | now (D30 later) |
| 38 | ★start_launch_window | career_start | Your Career Launch Window | EARLY | h10,h6,h5,h9 · 5/9 lords→6/10, D10 L/10, A10, AmK, S6D on 10th | now (D24 later) |
| 39 | start_degree_to_career | career_start | Turning Your Degree Into a Career | EARLY | h5,h9,h10,h2 · D24 crosswalk (core) | **later** (R2) |
| 40 | ★start_first_role_timing | career_start | Landing Your First Role | EARLY | h6,h10,h11 · D1+D10 6/10/11, A6/A10/A11, AmK, S6D | now |
| 41 | ★start_offer_decision | career_start | Choosing Between Two Paths or Offers | EARLY | h10,h2,h3,h6 · 6th vs 3/7, AmK dispositor, AL vs Lagna, D2 | now (starter while 39 waits) |
| 42 | start_imposter_syndrome *s* | career_start | Overcoming Imposter Syndrome & Early Doubt | EARLY | h1,h4,h5 · Mo, Su, Me, Kemadruma, Sa on Mo, Sade Sati | now |
| 43 | start_relocation_abroad | career_start | Relocation & Working Abroad | EARLY | h12,h9,h4,h3 · Ra, AL sign, D10 9/12, node axis | now (D4 houses later) |
| 44 | ★start_three_year_foundation | career_start | Building Your 3-Year Foundation | EARLY | h10,h3,h6,h11 · upachayas, AmK/AK/A10, MD/AD sandhi, Sa return | now |
| 45 | ★job_pulse | primary_job | Where Your Job Stands | EMP | h10,h6,h11 · D1+D10 6/10/11, AmK, A10, AL, TP D10 | now |
| 46 | ★job_security_layoff *s* | primary_job | Job Security & Restructuring Risk | EMP | h10,h8,h12,h6 · D10 8/12, 8th lord–AmK, sandhi, Ashtama/Kantaka Sa | now (D30 later) |
| 47 | ★job_stay_or_leave | primary_job | Should You Stay or Change Jobs? | EMP or SEEK | h10,h3,h8,h11 · D10 3/8/12 vs 6/10/11, D2, AmK/A10 | now |
| 48 | ★job_promotion_recognition | primary_job | Promotions, Titles & Recognition | EMP | h10,h11,h9 · Su, Ju, 10th lord, A10, raja yogas, D10 1/10/11 | now |
| 49 | ★job_salary_bonuses | primary_job | Salary, Bonuses & Cashflow | EMP | h11,h2,h12 · 2/11/5/9, A2/A11, dhana yogas, D2 hora, D10 11 | now |
| 50 | job_burnout_load *s* | primary_job | What Wears You (Burnout & Heavy Load) | EMP | h6,h8,h12,h1 · Mo, Su, Lagna lord, D10 6/8, Sade Sati | now (D30 later) |
| 51 | job_boss_politics | primary_job | Bosses, Leadership & Politics | EMP | h10,h9,h6 · D10 6/9/10, Su–Sa, A10 vs A6 | now (D30 later) |
| 52 | job_leading_teams | primary_job | Leading Teams & Authority | WL∈{manager,senior_leader} | h10,h5,h6 · D10 5/6/10, Su dig bala, Ju, Sa, A5/A10 | now |
| 53 | job_industry_switch | primary_job | Switching Industries or Roles | EMP | h10,h8,h9,h12 · Ra/Ke axis, AmK chain, A10, D10 L/10 | now (D24 later) |
| 54 | job_remote_abroad | primary_job | Work Abroad & Remote Flexibility | EMP | h12,h9,h4,h10 · Ra, Mo, A10–9/12, D10 9/12/4 | now |
| 55 | job_skill_building | primary_job | What Skill to Build Next | EMP or SEEK | h3,h5,h9,h10 · Me, Ju, PK/AmK, Saraswati yoga | now (D24 later) |
| 56 | ★craft_creative_flow | hobby | Your Creative Flow This Year | any | h5,h3,h11 · Ve, Me, Mo, A5, Saraswati yoga | now |
| 57 | ★craft_energizing_medium | hobby | The Craft That Energizes You | any | h3,h5 · 3rd/5th lords + strongest of Ve/Me/Ma/Mo/Sa/Ra | now |
| 58 | ★craft_creative_blocks | hobby | Creative Blocks & Loss of Motivation | any | h5,h12 · Sa/Ke on 5th, combust Ve/Me, papakartari on 5/A5 | now |
| 59 | craft_monetize_hobby | hobby | Turning a Hobby Into a Side Hustle | W≠retired | h5,h11,h2,h7 · 5→11 and 5→2 links, A5↔A11↔A7 | now |
| 60 | ★craft_shipping_projects | hobby | Finishing & Shipping Your Project | any | h3,h10,h11 · Ma, Sa, A3/A10, D10 3/10, Ma transits | now |
| 61 | craft_audience_community | hobby | Community & Audience for Your Work | any | h11,h5 · A11, A5, Mo, Ve, Ju, D9/D10 11 | now·p |
| 62 | ★biz_readiness | business | Job vs. Business Readiness | any (★ unless OWN) | h7,h3,h11,h6 · 6th vs 3/7/10/11, AL/A7/A10, D10 L/7 vs 6 | now |
| 63 | ★biz_ideal_industry | business | Your Ideal Field & Industry of Business | any (★ unless OWN) | h10,h7,h2 · D10 1/7/10/11, AmK, A10/A7, mahapurusha | now (D24 later) |
| 64 | ★biz_launch_timing | business | Timing Your Launch or Major Pivot | any | h10,h7,h11 · D1/D10 7/10/11, A10/A7, Me, S6D, TP | now |
| 65 | ★biz_cashflow_margins | business | Revenue, Cashflow & Profit Margins | any | h2,h11,h12 · A2/A11, Ju, dhana vs 12th, D2, D10 2/11 | now·p |
| 66 | ★biz_clients_sales | business | Clients, Sales & Market Pull | any | h7,h10,h3 · A7, A10, Me, Ve, D10 7/3/10 | now |
| 67 | biz_partnerships_fit *s* | business | Co-Founders & Business Partnerships | WL≠owner_alone | h7,h11,h8 · 7th lord vs Lagna lord, A7, DK, D10 7/8 | now (D30 later) |
| 68 | biz_hiring_team | business | Hiring, Team & Delegation | OWN | h6,h5,h10 · Sa, A6/A5, D10 6/5/10, D2 | now |
| 69 | biz_capital_assets *s* | business | Capital, Assets & Infrastructure | WL∈{owner_staff,several_businesses} | h4,h2,h8,h6 · Ma, A4, D4 L/4, D2, D10 | now (D4 houses later) |
| 70 | biz_scaling_risk | business | Scaling, Risk & Bold Moves | OWN (★ if OWN) | h3,h11,h10 · Ju–Ma, upachaya Ra, A10/A11, D10 3/10/11 | now·p |
| 71 | biz_legal_safeguards *s* | business | Legal, Contracts & Financial Safeguards | OWN | h6,h8,h12 · D30 L/6/8/12 (core) | **later** (R2) |
| 72 | biz_founder_burnout *s* | business | Founder Energy & Avoiding Burnout | OWN (★ if OWN) | h1,h6,h12,h8 · Lagna lord, Su, Mo, Sade Sati, D10 workload | now (D30 later) |

**Routing (`defaultLens(facts, age)`, pure, no astrology):**
- **Love:**
  - L∈{single,dating,complicated}, or unknown → `dating`.
  - L∈{married,committed,separated} → `marriage`.
  - Friends and Allies are never the default.
- **Work:**
  - W=own_business → `business`.
  - W=retired, or F=creativity with W∉{yes,own_business} → `hobby`.
  - W=studying → `career_start`.
  - W∈{yes,between_jobs}, or unknown: age < 30 with WL∈{hourly,employee,unknown} → `career_start`; otherwise `primary_job`.

**Starter overrides:**
- Marriage lens: 12 goes first when L≠married; 17 goes first when L=separated.
- Business lens: OWN gets {64,65,66,70,72}; others get {62,63,64,65,66}.

**Decisions taken here:**
- The lens ids are `hobby`/`business`, not doc 07's `hobby_craft` or doc 08's `business_venture`.
- Card 12 is a starter only for the unmarried (doc 02 conflict).
- "divorced_seeking" maps to L=separated, so the marriage lens.
- Allies stays on Love, as docs 00 and 04 have it.

## 5. Architecture

**Request path (Lambda `aiastra-server-api`, no model call):**
- GET, PUT layout, POST read and POST confirm read and write `board_layout`, the `area_builds` state doc, `technique_outputs` and `person_facts`.
- They queue one async self-invoke build per kundli (`self-reading-build` event, board `self`).

**Async build (same Lambda, 300 s):** v2 (stored) → v3 frame → slices → clock layer (`layer.clock` cache) → `readCards` over one pack and the queued cards of all boards → `technique_outputs` per card → state doc `done`.

**Engine boundary:** Node selects stored rows by matter, date and key. It computes nothing astrological. `showWhen` and `defaultLens` read person facts and age only.

**Scheduled sweep:** the 45-minute per-owner recycle and the EventBridge `llm-cache-sweep`, unchanged.

**Guarantees:**
- A board not in `BOARDS_V3` is never read and never queued.
- One card's failure never blocks another.
- The legacy pages keep their own endpoints.
- A stale web bundle still saves, because PUT is dispatched on body shape.

## 6. Ingredients

**Libraries:** none new.

**Env (server):**

| Variable | Status | Default | Notes |
|---|---|---|---|
| `BOARDS_V3` | new | unset | Comma list (`love,work`). Owner: deploy session, after the web is live. |
| `CARDS_READ_MIN_AREA` | new | 1 | Minimum deck size that queues a Love/Work reading. |
| `SELF_V3_ENABLED`, `SELF_V3_BUILD`, `READING_CLOCK_LAYER` | existing | — | Required. `GET /api/board/:board/v3` answers 503 `off` while `isCardsReadEnabled()` is false. |
| `CARDS_GROUP_PACK` | existing | — | Read the live value; keep `1`. |
| `CARDS_SPEND_CAP_USD` | existing | $0.75 | Now shared by three boards. **Sachin decides** whether to raise it to $1.00. Estimate per kundli-day: about $0.10 for the clocks, about $0.30 for You, about $0.08 per Love/Work lens deck. |

**IAM / EventBridge / migrations:** none.

**Fixtures and test data:**
- `tests/unit/fixtures` fake prisma and fake Gemini, as the existing card-run tests use them.
- Test kundli `c584c0a3` for the one paid verification run. All rows are QA test data (2026-11-08).

**Owners:**
- Dev agent: S1–S10 and W1–W8.
- Brief writing: 8 parallel sub-agents, one per doc 01–08.
- Worktrees: a Haiku sub-agent at medium effort, using a node_modules junction (SOUL §0).
- Deploys: the deploy sub-session.
- Sachin: the spend cap.

## 7. Action steps in sequence

**0. Setup.** A Haiku sub-agent at medium effort creates two worktrees from `develop`, with literal paths:
- `C:\Users\Owner\Documents\work\wt\server-boards-v3`
- `C:\Users\Owner\Documents\work\wt\web-boards-v3`

For each: link `node_modules` with a junction, and copy `.env` for the server. Check afterwards that both main checkouts still have `.git` and `docs`. Never switch branches in the shared checkouts.

### Server

**S1. Registry** (`src/reading/boards/v3Cards.ts`, new):
- `LOVE_V3_CARDS` and `WORK_V3_CARDS` as `as const` rows from §4.5.
- `V3_LENSES: Record<'love'|'work', {id,title}[]>`.
- `starters(board, lens, facts, age)`, `defaultLens(board, facts, age)` and `showsFor(def, facts, age)`.
- **Done when:** a unit test checks 72 rows, unique ids, matters within the 12 keys, 69 offered, and 20/39/71 `later`.

**S2. Lookup** (`src/reading/cards/registry.ts`, new):
- `type CardId = SelfCardId | LoveV3CardId | WorkV3CardId`.
- `anyCardDef(id)`, `boardOfCard(id)`.
- `isReadable(id)`: Self uses `READABLE_CARDS`; Love and Work need `offered` and the board in `getBoardsV3()`.
- `cardBriefPrompt(id) = cards/${board}/${id}`. Self is unchanged, so You store keys do not change.
- `getBoardsV3()` and `getCardsReadMinArea()` go in `config/env.ts`.

**S3. Generalize the card runner.** Swap `cardDef`→`anyCardDef`, `READABLE_CARDS`→`isReadable` and `SelfCardId`→`CardId` in:
- `cards/run.ts` (`cardOrder`, `one`, the `briefOnly` path);
- `cards/group.ts`;
- `cards/oracle.ts`;
- `cards/types.ts` (move `cardBriefPrompt`);
- `cards/state.ts`: `CardsStateDoc.cards` keyed by `CardId`; add `opened?: Partial<Record<'love'|'work', true>>` **and keep it in `asDoc`**;
- `cards/store.ts`: `readCardReadings(prisma, kundliId, clock, ids?)` with `OR: ids.map(id => ({digest_version: {startsWith: 'self.card|card=' + id + '|'}}))` and `take: ids.length * 4`. This fixes the 300-row window.

The Self call sites keep their types. **Done when:** the existing `tests/unit/reading/cards/*` and `self/v3/*` pass unchanged.

**S4. One pack across boards** (`self/v3/build.ts`, `cards/run.ts`):
- The build loads the Love and Work layouts (`readLayout(prisma, k, board, registry)`) for enabled boards.
- It passes `packCards` = Self deck ∪ active-lens decks to `readCards`, and `buildCardPack({cards: unique([...order, ...packCards])})`.
- The gate at `build.ts:178` already opens on any queued card. No change there.
- **Done when:** a test with a fake model shows a run with 3 Self cards and 2 queued Love cards makes **one** `ensureCache` call for the pack and stores 5 readings.

**S5. Layout and response generalized:**
- `self/v3/layout.ts`: `validateLayout`, `layoutFromRow`, `readLayout` and `writeLayoutVersioned` take a registry, defaulting to Self, and a per-board minimum (Self `MIN_CARDS`, area 1).
- Board options accept `lens` for love/work.
- `self/v3/response.ts`: `cardViews` takes the registry, `v2Areas` optional (null for Love/Work).
- `applySelfFeatures` takes the board for `cardFeatureKey`.
- `boards/features.ts` `CARD_FLAGS` adds `card.love.<id>` and `card.work.<id>` for all 72. The legacy keys stay.

**S6. Service** (`src/reading/boards/v3Service.ts`, new):
- `getBoardV3(deps, userId, board)` reads, in parallel, `getSelfV2` (clock, profile), `readLayout`, `readCardReadings(ids of the board)`, `readCardsState`, plan and overrides. Build on open as in §4.1, step 2.
- `putBoardV3Layout`, `readBoardV3Card` and `writeConfirmV3` mirror `self/v3/service.ts`. The queue is `queueSelfReadingBuild(…, 'self')` and the minimum is `getCardsReadMinArea()`.

**S7. Routes:**
- New `src/routes/boardV3Routes.ts`: GET v3, POST read, POST confirm. It reuses `withinBudget`, `strongETag` and `ifNoneMatchHas` from `selfV3Routes.ts`.
- `boardCardsRoutes.ts` PUT dispatches on `version`/`patch` in the body.
- `areaRoutes.ts` refresh answers 409 `not_due` for v3 boards.
- Register in `server.ts` next to `registerBoardCardsRoutes`.

**S8. Briefs.**
- 69 files: `src/reading/prompts/cards/love/<id>.md` and `cards/work/<id>.md`, in the Self brief format (see `cards/self/drive.md`).
- Each brief adds:
  - the board/lens line;
  - the oracle question and personalizer goal from the doc;
  - the board's no-verdict rules;
  - for *s* cards, the sensitive guard.
- Plain words. No engine names; doc 82 means no word lists in code.
- Then run `npm run prompts:embed` and `npm run prompts:check`.
- **Parallel:** one sub-agent per doc 01–08, started in the background.

**S9. Agent registry text.** `agents/registry.ts`: in the descriptions of `self.card.oracle`/`personalizer`, change "Self board" to "Self, Love or Work board". Description only; the ids stay.

**S10. Tests.** Run with `npx vitest run tests/unit/reading/cards tests/unit/reading/self/v3 tests/unit/boards tests/unit/routes`, plus `npx tsc --noEmit`. New tests:
- `boards/v3Cards.test.ts`: registry, routing, showWhen, starters.
- `routes/boardV3Routes.test.ts`: 200/304/404 `board_v3_off`/409/429, and dispatch on body shape.
- `cards/runMixedBoards.test.ts`: one pack, failure isolation.
- `cards/store.test.ts`: the id filter.
- A brief-exists test for every offered id.

### Web

**W1. API and cache.**
- `lib/selfV3Api.ts`: `type BoardId = 'self'|'love'|'work'` and `base(board)`, which is `/api/self/v3` for self and `/api/board/${board}/v3` otherwise. Thread `board` through fetch, put/patch, readCard and confirm.
- Widen `SelfCardId` to `string`.
- `MIN_CARDS` is per board (self 3, area 1).
- `lib/selfV3Cache.ts`: key IndexedDB, `aa.selfv3.card` and `aa.selfv3.period.*` by board.

**W2. `pages/board/v3/BoardV3.tsx`** from `SelfBoardV3.tsx`, with a `board` prop:
- `SURFACE=${board}_v3`, `useLoadCardPhotos(board)`, `featureState(board, cardKey(board,id))`.
- A per-board title and carousel label, and `signInHref` `/dashboard/${board}`.
- The v2 fallback stays Self-only. The legacy fallback is used for love/work.
- `SelfTitle`, `PersonalizeModal` and the clock line are Self-only.
- `pages/you/v3/SelfBoardV3.tsx` becomes `<BoardV3 board="self"/>`.

**W3. `LensSwitcher.tsx`:**
- The segmented control on tablet/desktop, and the title sheet in `BoardHeaderSlot` on phone.
- Chips and carousel are filtered by lens.
- A lens with no cards opens the picker with its `suggested` ticked.

**W4. Board-neutral parts:**
- `features.ts`: `cardKey(board,id)`; Self `SUBTITLES` only for self.
- `Picker.tsx`: `board` and `groups` from `lenses`.
- `CardBanner.tsx`/`cardArtRegistry.ts`: art by `card.group`, with lens themes added to `GROUP_ART`.
- `CardParts.tsx`: confirm through `board`.
- `v2/FreshReading.tsx`: `refreshBoard(board)`.
- `words.ts`: per-board copy.

**W5. Pages.** `LovePage.tsx` and `WorkPage.tsx` render `<BoardV3 board=…/>`. They fall back to the current page on 404 `board_v3_off` or `?legacy=1`.

**W6. Ids off the old pages.** Delete the `techBadgeClass` spans in `WorkPage.tsx` (12) and `AreaBoardView.tsx` (16), and the engine-flavoured `bhavaRef` copy (`:1237-1249`). Update `LovePage.test:122`, `WorkPage.test:127` and `YouPage.test:233-234`.

**W7.** `e2e/card-picker.spec.ts` gets a love route. Add a `boardV3.love.fixture.ts`.

**W8. Tests.** Run `npm run typecheck`, `npm run test:run` and `npm run lint`. New tests:
- `BoardV3.test.tsx` parametrized over self/love/work;
- lens default and switch;
- fallback on `board_v3_off`;
- the no-id regex on `/love`, `/work` and `/you`.

### Release (`AGENTS.md`, branches and deploys)

**R1.** In each repo: `tsc` and tests pass. Merge `--no-ff` into `develop`; guard the branch in the merge command (shared checkout). Push `develop`.

**R2.** Server first: merge `develop` into `release-candidate-staging` and push. `deploy-api-lambda.yml` deploys with `BOARDS_V3` **unset**, so the new code ships dark. Check that `/you` is unchanged.

**R3.** Web: `deploy-staging-amplify.yml` deploys. Love and Work still render legacy (404 `board_v3_off`), now without badges.

**R4.** The deploy session sets `BOARDS_V3=love,work` on `aiastra-server-api` (account 442728149528, profile `aiastra-ops`) and reads `CARDS_GROUP_PACK`.

**R5.** One paid verification run on `c584c0a3`:
- Save the Dating deck (5 cards) and the Your job deck (5 cards).
- About 10 card calls, about $0.16, about 20 s per deck. The clocks are already read.
- Log lines: `reading_build_done` and `cardsRun.results`.
- Sequenced screenshots of `/love` and `/work` on phone and desktop to `docs/screenshots/boards-v3-love-work/`.

**R6.** Rollback is to unset `BOARDS_V3`. The pages fall back within one GET. Stop every local server started along the way.

## 8. Development phases

| Phase | Scope | Closing check | Deferred |
|---|---|---|---|
| **A, tonight** | S1–S10, W1–W8, R1–R6: the generalized pipeline, 8 lenses, 69 cards on existing data, build on open, no ids on any surface | tsc and unit tests green on both repos. On c584c0a3: 10 cards stored, one pack cache, `/love` and `/work` screenshots, no id text | paid refresh, cards 20/39/71, the D-legs marked later |
| **B, after doc 80 R1–R4** | Cards 20, 39, 71 `offered`. The briefs' D11/D16/D24/D30 and TP-divisional legs become required. Pulse cards read the TP year lord (R1) | Registry test: 72 offered. A replay on 3 research kundlis | — |
| **C, with doc 83 steps 3–4** | The board state comes from `self/board/state.ts`, not `getSelfV2`. A paid refresh per board (`refreshBoard` with a `cardsBoard` event field; charged on cards read). PATCH layout routes on the server. Admin mirror of the 72 feature keys (`aiadastra_admin/api/src/features.ts`) | The refresh is charged once; nothing is gated by v2 | — |

## 9. One recommendation

**Run Love and Work through the You v3 card runner itself.** That means:
- one registry row and one brief per card;
- one shared state doc;
- one build per kundli;
- one cached pack over the union of the three decks.

It reuses the per-kundli clock layer and the shared prefix byte for byte. On top of You it adds only the cost of each board's own cards, about $0.08 a deck, and no second clock layer or prefix. The web reuses every You component through a `board` prop, so `/love` and `/work` cannot drift from `/you`. `BOARDS_V3` makes it reversible in one env change tonight.

| Alternative | Verdict |
|---|---|
| One pack per board | Rejected. It caches the same prefix up to three times, though it would keep the Self pack bytes untouched. |
| A second build and state doc per board (`love.cards`, `work.cards`) | Rejected. That means three spend counters, three gates and clock-layer races. |
| Keep the legacy `/api/area/*` boards and restyle them | Rejected. There is no ledger, no per-card reading, and the internal ids stay. |
| Wait for doc 80 and ship all 72 at once | Rejected. 69 cards stand on stored data today; the 3 that need doc 80 say "Coming soon". |
