# 85 — A chat on every card: the card becomes the conversation

**Approved 2026-11-18 by Sachin:** every sent card-chat question costs one question (key per turn; a retry of the same
send and clarifier answers are free); on Love and Work one bubble per panel, named after the catalogue card that owns
its sub-area. Build Phase 1 (You) first.

Plan only, 2026-11-18. Owner decisions (2026-11-18): every card on every board gets its own chat bubble. Tapping it
turns **that card, in place** into a conversation about the card and the period on screen. It is not a modal and not
the chat page, and the other cards stay as they are. The card's own text is the preamble. The input has a mic for
dictation. Real-time spoken conversation comes later. Rules kept: SOUL.md (never the engine's name), AGENTS.md "personal
assistant" rules 2 and 7 (confirm before predicting, show the cost before the tap), doc 82 (no word filters in code).

## 1. Start (facts checked in code)

| Area | What is there today | Where |
|---|---|---|
| You v3 slot | `CardFrame` has `chat?: (card, period) => ReactNode`, drawn left of the "i" (Why) in the header. `SelfBoardV3.renderSlide` never passes it, so no bubble shows. The You board has no board-level bubble either | web `src/pages/you/v3/CardFrame.tsx:53,137`; `SelfBoardV3.tsx:565-588` |
| Feature switch | `feature('feature.card_chat','Card chat','on')`, scope `card`. Web `features.ts` lists the key but leaves it out of `FOUNDATION`, so it is off when the server sends no list. `feature.voice` is the Gentle/Direct **writing tone**, not speech | server `src/boards/features.ts:42,44`; web `src/pages/you/v3/features.ts:16-22` |
| Board bubbles | `BoardAsk` → `AskModal` (98 vw portal) → `ChatSection(category, focus=CATEGORY_FOCUS)`. Back closes it through a pushed history entry (`__boardAsk`) | web `src/components/BoardAsk.tsx`, `AskModal.tsx`; used at `AreaBoardView.tsx:425`, `WorkPage.tsx:156`, `LuckyTimesPage.tsx:161` |
| Love/Work "cards" | 19 catalogue cards (`BOARD_CARDS`, each with `subareas`). On screen they are **chips** (`AreaCardChips`) that filter the panels. No box exists per catalogue card. The visible boxes are panels: tone card, Now panels, `SubareaPanel`, findings master-detail, Ahead windows, Looking back | server `src/reading/boards/catalogue.ts:38-61`; web `components/boardCards/AreaCards.tsx:142`, `AreaBoardView.tsx:1091-1192`, `WorkPage.tsx:196` |
| Lucky "cards" | `now-card` and one `today-<scenario>` panel per pick. No catalogue entry | web `pages/lucky/LuckyTimesPage.tsx:312,333` |
| Ask path | `POST /api/chat/ask-stream {question, chatId, clarify, focus: SubjectId, parts, lat/lon/tz}`: `gate.check` → `clarifyOnAsk` (free) → `gate.reserve()` (random UUID key = kind `chat`) → `chatWithConfiguredProvider` → `persistAskTurn` → commit. `confirm-stream` reserves `clarify:<runId>` | server `server.ts:225-350`; `src/routes/clarifyRoutes.ts:84,146-206` |
| Category | Never sent on ask-stream. The web calls `createChat(category)` first and sends `chatId`. `persistAskTurn` creates a chat **without** a category when `chatId` is missing or not found | web `src/pages/UserData.ts:161-187,444`; server `src/services/askChatTurn.ts:78-104` |
| History | `runReading` has `history`, which is fed to intake only. `chatWithConfiguredProvider` never passes it, so every turn is an independent reading | server `src/reading/run.ts:71,331`; `src/services/chatLlmService.ts:72` |
| Prompt tails | `tailFor()` serves the single and graph flows and `buildBrief()` serves the oracle flow. Which one runs is set by `READING_FLOW`. `Horizon` accepts `{from,to}` | `run.ts:216-232`; `oracle/brief.ts:141-180`; `reading/config.ts:20`; `packs/frames.ts:266` |
| Billing | `usageKinds` counts a `cardchat:` key prefix, but nothing writes one. `reserve(key)` makes any repeat of a committed key free | `src/billing/usageKinds.ts:15`; `questionGate.ts:168-201` |
| Stored card text | You: `getSelfV3` (the shaped and feature-gated card) queues builds through `getSelfV2`, but both `queueBuild` and `queueDigest` are injectable. Love: `getLoveBoard` (has a `queueDigest` seam). Work: `getCareer`. Lucky: the `/api/lucky/range` service | `self/v3/service.ts:57`; `self/v2api/service.ts:34-35`; `area/boardService.ts:32,191` |
| Speech | `useSpeechRecognition` uses the Web Speech API with the `webkit` prefix, stops after 2 s of silence and carries an Apple restart workaround. The chat page mic (`ChatMainArea`) uses it. `Permissions-Policy: microphone=(self)` is set site-wide. The privacy policy says speech is turned into text by the browser or device and only the text reaches us | web `pages/chat-interface/useSpeechRecognition.ts`, `ChatMainArea.tsx:416-433`; `customHttp.yml:57` |
| Voice agent | WebRTC voice client, mounted only in `testbed/voice` | web `src/lib/voice/client.ts`; server `docs/assistant/02-voice-agent-design.md`, `03-voice-testbed.md` |
| Chats table | `chats.category` exists. No column ties a chat to a card. Both `createChat` and `persistAskTurn` set `is_active=false` on every other chat of the person | `prisma/schema.prisma:177-195`; `src/graphql/schema.ts:1506-1520` |
| Clarifier | `beginClarify` classifies by rules and shows the clarify card when the horizon is missing. It has no seed input today, and nothing turns a card's `confirm` claim into its question | `src/reading/clarify/service.ts:129-139,291` |
| Feature grants | Only the You v3 response carries `features`. The Love/Work layout and the Lucky setup carry none, and Lucky has no card keys in `CARD_FLAGS` | `self/v3/response.ts` `applySelfFeatures`; `routes/boardCardsRoutes.ts`; `routes/luckyRoutes.ts` |

Not checked: AWS, logs and the DB. Which `READING_FLOW` production runs is unknown, so the plan covers all three flows.

## 2. End goal

- Every chattable card on You, Love, Work and Lucky shows a bubble when `feature.card_chat` is granted. A locked card
  shows no bubble.
- A tap flips that card in place to chat mode within 100 ms. The preamble arrives in under 500 ms (the cached-API
  budget). It is the card's own stored text for the period on screen, and the server sends it. The person types or
  dictates, sees "Uses 1 of your N questions" before sending, and watches the answer stream into the card. The first
  token takes as long as in the chat today.
- **Back to card** (button, Esc or the browser's Back) returns the face. The thread is kept: reopening the card shows
  it, and the chat sidebar lists it under the board's category with the card's name.
- Failure modes removed: answers built on text the client edited (the server re-reads the card), answers drifting off
  the card (the card is the topic in every turn), a double charge on a network retry (key per turn), and the jump to
  the chat page.

## 3. Deliverable

| Side | Files |
|---|---|
| Server, new | `src/reading/cardChat/types.ts` (`CardRef`, `CardPreamble`, `CardTopic`), `resolve.ts` (board → read-only lookup → preamble), `intent.ts` (`intentForCard`), `prompt.ts` (`cardLines()`), `thread.ts` (find or create the card thread), `src/routes/cardChatRoutes.ts` (GET open) |
| Server, changed | `server.ts` (ask-stream accepts `card` and `turnId`), `src/routes/clarifyRoutes.ts` (card carried on clarify state, confirm key), `src/reading/clarify/service.ts` (`beginClarify` seed), `src/reading/types.ts` (`Intent.card?`), `run.ts` `tailFor` + `oracle/brief.ts` `buildBrief` (one call to `cardLines`), `src/services/askChatTurn.ts` (`persistAskTurn` takes `{category, cardRef}`), `self/v3/cards.ts` and `boards/catalogue.ts` (`subjects` per card), `src/reading/metrics/trace.ts` + `src/techniques/catalog.ts` (`chat.card` tag and row) |
| Server, grants | `features: {'feature.card_chat': grant}` added to `GET /api/board/:board/v3/layout` and `GET /api/lucky/setup`, resolved by the same `resolveFeatures`. Lucky uses the board-level grant only. The server ships first. The flag defaults to `on`, so once a web build reads the grant, every person sees bubbles. To hold it back everywhere, set `BOARD_FEATURES_OFF=feature.card_chat`. Each web phase only renders bubbles on the boards it has built |
| Migration | `prisma/migrations/<ts>_chats_card_ref`: `chats.card_ref text NULL`, index `(user_id, card_ref)`. Additive |
| Web, new | `src/components/cardChat/CardChat.tsx` (chat face), `useCardChat.ts` (open, send, confirm, stream), `CardChatBubble.tsx`, `src/lib/cardChatApi.ts` |
| Web, changed | `SelfBoardV3.tsx` (passes `chat`, locks the carousel), `CardFrame.tsx` (renders `CardChat` in place of header+body when open), `components/carousel/Carousel.tsx` (`locked`), `AreaBoardView.tsx`, `WorkPage.tsx`, `LuckyTimesPage.tsx` (bubble per panel), `pages/UserData.ts` (`card`, `turnId` on the stream body) |
| Tests | Listed per step in §7 |

## 4. How it works when done

### Backend

1. **Open** (`GET /api/cards/:board/:cardId/chat`): auth (`focusUser`) → feature check (`feature.card_chat` and the card
   key, using the same `resolveFeatures` as the board) → `resolveCard()` runs the board's read **with no-op queue seams**
   (no build or digest queued, no clock charge) → pick the period by `from/to` (server periods are `p1…` plus dates,
   web periods are rail indexes) → build the preamble from stored text, capped at 1,500 chars → load the card thread
   (`chats` where `user_id` and `card_ref = '<board>:<cardId>'`, newest by `created_at`, **ignoring `is_active`**,
   because any new ordinary chat deactivates it; last 20 messages). Budget under 500 ms. No model call.
2. **Send** (`POST /api/chat/ask-stream` with `card`): the open steps re-run on the server (the client's text is never
   used). Then `gate.check`. The **first** question of a thread goes through the clarifier with a new `seed` option
   (the card's subjects and horizon, so the horizon card is not shown and only a missing fact is asked). The card ref
   is saved on the clarify state. *Verify first (step 5):* whether the card's unanswered `confirm` claim can become the
   clarifier's one question, with its answer written through the existing `writeConfirm`. If it cannot, the seeded
   clarifier alone carries the confirm-before-predict rule. Follow-ups in the same thread skip the clarifier, as part
   continuations do today.
3. **Read**: one `applyCard(intent, topic)` serves both entry points. On ask-stream (follow-ups) it runs on
   `intentForCard()`. On confirm-stream (first turn) it runs on the intent `confirmAndBuildIntent` returns, using the
   card read from the clarify state. `intentForCard()` takes the rules intake. `applyCard` sets `subjects` from the card's `subjects`, `horizon` to the
   period (`{from,to}`, or the card's whole range) and `intent.card` = `{board, id, title, period, lines, history}`.
   `history` is the thread's last 2 Q/A, capped at 1,200 chars. `cardLines()` renders a `CARD ON SCREEN` block. Both
   tails insert it before `QUESTION:` (`tailFor`) or after `UNDERSTOOD AS` (`buildBrief`), so single, graph and oracle
   all see it. The reading still reads the chart. The card names the topic and the window and is never the evidence.
4. **Charge**: `reserve(userId, {key: 'cardchat:<board>:<cardId>:<turnId>'})`, where `turnId` is a client UUID per send,
   so a retry of the same send is free. On confirm, the key is `cardchat:<board>:<cardId>:<clarifyRunId>`. A declined
   topic or a failed reading releases the question, as today.
5. **Persist**: `persistAskTurn(..., {category: board→category, cardRef})` creates or uses the card thread. It stores
   `category`, `card_ref` and `name = card title`, and each message as `[<card title> · <period label>] <question>`.
   It does not deactivate the person's other chats when it creates a card thread.
6. Limits and timeouts are as in chat today: Lambda 300 s, SSE ping 12 s, stale reservations released after 10 min. The
   web allows one send per card at a time and one card in chat mode per board.

### API

| Call | Request | Response | Errors |
|---|---|---|---|
| `GET /api/cards/:board/:cardId/chat?from&to` | `board` ∈ `self love work lucky`. For Lucky, `cardId` is `now` or a scenario id, and `from=to=` the day | `200 {card:{board,id,title}, period:{from,to,label}\|null, preamble:{headline, lines[], keyDates[]}, cost:{uses:1, remaining\|null}, thread:{chatId\|null, messages:[{question,answer,at,periodLabel}]}}` | `400 unknown_board\|unknown_card\|bad_period`; `403 feature_off\|locked`; `404 no_kundli\|card_not_on_board`; `409 card_not_ready` |
| `POST /api/chat/ask-stream` | today's body plus `card:{board,id,from?,to?}`, `turnId` (uuid) and `chatId` (the thread). `focus`/`parts` are not allowed together with `card` | SSE: `{type:'card',title,periodLabel}` first, then today's events (`clarify`, `propose`, `start`, `usage`, `token`, `done{chatId}`) | Before any SSE frame: the GET errors above, `402 quota_exhausted`, `409 chart_not_ready`, `400 card_with_focus` |
| `POST /api/chat/confirm-stream` | unchanged; the card comes from the clarify state | unchanged, plus the `card` event | unchanged |

### Frontend experience

`useCardChat(board, cardId, period)` holds the states **face → opening → ready → clarifying → streaming → answered**,
plus **error** and **quota**. *Opening* shows the card's title and a one-line skeleton. A failed open shows "This chat
did not open." with Retry inside the card. *Clarifying* renders the existing `ClarifyCard` chips inside the card.
*Streaming* uses `createTokenDeltaFlusher` (50 ms) and one status line from `applyReadingEvent`. *Quota* (402 or the
SSE `quota_exhausted` event) shows the plan line and keeps the typed text. The preamble is rendered **only** from the
GET response, never rebuilt from the web's card model, so what is shown is exactly what was sent. Opening a second card
closes the first one's chat mode. Its thread is kept.

### UI/UX

| Element | Copy and behaviour |
|---|---|
| Bubble | `MessageCircle`, 36 px (44 px on coarse pointers), aria "Ask about <card title>". It sits left of the "i" on You (the existing slot), at the top-right of each panel on Love/Work/Lucky, and is disabled with the AI-unavailable title when `useAiUnavailable()` |
| Chat header | ← "Back to card" · card title · period chip ("Heavy stretch · to 3 Jun 2027"). The period stays fixed while in chat mode. To ask about another period, go back and pick it |
| Preamble | Grey block, "From your card:" then the headline and up to 4 lines. It collapses to 2 lines with "More" |
| Input | Textarea "Ask about this card…" · mic · send. Under it: "Uses 1 of your N questions this month" (hidden for Unlimited or exempt accounts) |
| Mic | Tap to dictate. Words appear in the box and stay editable, and nothing is sent until Send. Listening shows a pulsing ring and "Listening…". When unsupported: disabled, "Microphone unavailable". When denied: "Microphone access denied; tap to try again" (the chat page's wording) |
| Size | **Phone** (carousel, `perView` 1): the card keeps its grid row. Swipe and dots are locked while chatting, the messages scroll inside the card, and the input is pinned to the card's foot. While the keyboard is open, the card's height follows `visualViewport.height`. **Tablet/desktop**: the card stays in its slot. Seasons (2-up) gives a ~600 px chat. Compact (4-up) gives a ~300 px chat with the phone layout, and the carousel keeps that card in view. Love/Work/Lucky panels keep their box with a height of `min(70dvh, 560px)` and an internal scroll. The page never scrolls |
| Leaving | Back to card, Esc and browser Back all close it (history entry `__cardChat`, same pattern as `BoardAsk`), and focus returns to the bubble. Inside chat mode, "New conversation" starts a fresh thread. The old one stays in the chat sidebar under the board's category |
| Timings | flip under 100 ms, preamble under 500 ms, first token as chat today. After 10 s: "Still reading your chart…" (the existing `askWaitMessage`) |

## 5. Architecture

```
card bubble ─tap─► CardChat (in the card) ─GET open─► cardChatRoutes ─► resolveCard (board read, no-op queues) ─► DB (stored builds, chats)
                     │ send (text or dictated)                    ▲ same resolver
                     └─POST ask-stream {card,turnId,chatId}─► server.ts ─► gate.check ─► clarifier (seeded, 1st turn)
                                                                   └─► intentForCard ─► runReading (tail + CARD ON SCREEN) ─► model
                                                                   └─► persistAskTurn(category, card_ref) ─► gate.commit(cardchat:…)
```

Everything runs on the request path. There is no new async invoke or scheduled sweep, and the reading reads stored
chart rows as it does today. No new engine call is made for You (stored rows only). For Love, Work and Lucky, the
board read may reach the engine as the board itself does (Lucky's range is wired with an engine dependency). Verify
each in its phase and prefer the cached day tables. Guarantees: the preamble and the prompt come from the same server read. A
card the person cannot see (locked, feature off, not on their layout, not read) cannot be chatted about. Card
references are board and card ids only, with no personal data, and question text stays out of summaries.

## 6. Ingredients

| Ingredient | Detail | Owner |
|---|---|---|
| Libraries | none new. lucide `MessageCircle`/`Mic`/`ArrowLeft`, existing `useSpeechRecognition`, `ClarifyCard`, `tokenFlusher`, `readingProgress` | agent |
| Speech engine | Browser Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`). Chromium browsers send audio to their vendor's service and Safari to Apple's. This matches the privacy policy as written. Gaps to verify on devices: Firefox has no `SpeechRecognition` (mic disabled), home-screen web apps and in-app browsers on iOS behave unreliably, and some Android WebViews lack it. A server transcription endpoint is **not** built (cost and a privacy-policy change) | agent; device check by QA |
| Env | none new. `feature.card_chat` is controlled through `BOARD_FEATURES_OFF` / `BOARD_FEATURES_PREMIUM` and `user_feature_overrides` | — |
| Migration | `chats.card_ref` + index (additive, applied for testing under the standing OK) | agent; staging via deploy session |
| Registration | `chat.card` in `metrics/trace.ts`; a `TECHNIQUES` row `chat.card` (selectors: `card` present; contract: board card text + chart reading) so `contracts.test.ts` passes | agent |
| Fixtures | one stored You v3 card, one Love board, one Work map, one Lucky day, all from existing unit fixtures. The model is stubbed | agent |
| Paid calls | none in development. A staging check of one card chat is one chat reading per test on the live Gemini key, at the Lab-measured cost of one chat reading, and needs Sachin's yes | Sachin |

## 7. Action steps in sequence

1. **Types and subjects** (server): `cardChat/types.ts`, `Intent.card?`, a `subjects` field on `SELF_CARDS` and
   `BOARD_CARDS`, and Lucky scenario → subject. Done when tsc passes and a test shows every offered card has ≥ 1 subject.
2. **Resolver** (server `cardChat/resolve.ts`): You through `getSelfV3` with no-op `queueBuild`/`queueDigest` and no
   `gate`. Love through `getLoveBoard` with a no-op `queueDigest`. Work through `getCareer`. Lucky through the range
   service for one day. Period by `from/to`. Preamble cap. Errors as in §4 API. Tests `tests/unit/cardChat/resolve.test.ts`
   per board, including locked, off and not-ready cases, and a check that nothing was queued.
3. **Prompt** (`intent.ts`, `prompt.ts`, `tailFor`, `buildBrief`): tests showing that both tails carry `CARD ON SCREEN`
   with the period and lines, that the horizon equals the period, and that the history is capped. *Parallel with 2.*
4. **Migration + thread** (`thread.ts`, `persistAskTurn` options): tests for the thread found by `card_ref`, the name,
   the stored `[title · period]` prefix, and other chats left active. *Parallel with 2–3.*
5. **Routes**: `cardChatRoutes.ts` (GET), plus the ask-stream `card`/`turnId` branch and the clarify seed and confirm key.
   Tests in `tests/unit/cardChat/routes.test.ts` (style of `coachAndRoutes.test.ts`): errors before SSE, `card` event
   first, `cardchat:` key written and counted as `cardchat` by `breakdownOf`, a retry with the same `turnId` charged
   once, a declined topic released, follow-ups skipping the clarifier, a reading confirmed through `confirm-stream`
   carrying `CARD ON SCREEN`, and a thread still found after an ordinary `createChat` deactivated it. Read
   `clarify/machine.ts` first to settle the seed and confirm-claim questions in §4 step 2.
   The layout and Lucky setup grants (§3) go out in this step.
6. **Registration**: trace tag, catalogue row, `contracts.test.ts` green.
7. **Web API + hook** (`cardChatApi.ts`, `useCardChat.ts`, `UserData.ts` body): tests for state transitions, the 402
   path, and Abort on close. *Starts once step 5's contract is fixed; parallel with 8.*
8. **Web CardChat + bubble**: tests (`CardChat.test.tsx`) for the preamble rendered from the response, the cost line,
   the streamed text, Esc and Back closing it with focus returned, a transcript filling the textarea without sending,
   the mic disabled when unsupported, and ClarifyCard chips inside the card.
9. **You board**: `SelfBoardV3` passes `chat` when `featureOn(board,'feature.card_chat')`. `CardFrame` swaps in
   `CardChat`. `Carousel` gets `locked`. Tests: the bubble appears only when granted, only one card is in chat mode,
   and swipe is locked. Screenshots `docs/screenshots/85-card-chat/01-…` on phone, tablet and desktop.
10. **Love and Work**: a bubble on each panel that holds a subarea's windows, mapped to its catalogue card (the card
    whose `subareas` holds the window's subarea; `'*'` and the tone/Now panels map to `<board>_where`). With a chip
    active, every bubble on the board names that card. The panel box switches in place. Tests in `AreaBoardView` and
    `WorkPage`.
11. **Lucky**: bubbles on `now-card` and `today-<scenario>`. The period is the day shown. Tests in `LuckyTimesPage`.
12. **Close-out**: `npx tsc --noEmit` and `npx vitest run tests/unit/cardChat` (server), and the web unit tests for the
    touched folders. File findings in `docs/TODOS.md`. Merge `--no-ff` into `develop`.

## 8. Development phases

| Phase | Ships | Closing verification |
|---|---|---|
| **1 — You** (the slot exists) | steps 1–9: server contract for `self`, migration, You v3 bubbles and chat mode with the mic | tests green; screenshots of face → chat → streamed answer → back, on phone and desktop; log line `[cardchat] open board=self card=<id> ms=<n>` under 500 |
| **2 — Love and Work** | step 10, with the resolver for `love`/`work` (built in step 2 but only exercised here) | tests green; screenshots of a panel in chat mode with a chip active and with none |
| **3 — Lucky** | step 11 | tests green; screenshot of a scenario card's chat for today |
| **Deferred — real-time voice** | A spoken conversation inside the card. It needs: the WebRTC client already in `src/lib/voice/client.ts` mounted outside the testbed; a realtime speech model and a signalling path that Lambda behind CloudFront does not hold (API Gateway WebSocket or the provider's own session); the card preamble as the session's opening context; per-minute cost and its question rule (billing decision); a privacy-policy change (audio would leave the device to us); barge-in and the device-voice fallback tiers from `docs/assistant/02` | a design doc of its own; a yes from Sachin on model, key and cost |
| **Deferred — server transcription** | For Firefox and WebViews: an upload endpoint and a speech-to-text provider | only with a privacy-policy change and a yes on cost |

The board-level `BoardAsk` stays on Love, Work and Lucky for questions that span the whole board.

## 9. One recommendation

**Trusted server lookup and an in-card chat that reuses the ask-stream pipeline.** The web sends only
`{board, cardId, from, to}`. The server re-reads the stored card through the board's own read path, with its queue
seams turned off, both to render the preamble (GET) and to build the prompt (send). The same text appears on screen and
in the prompt, and nothing the client edits reaches the reader. Card chat is one more input to the existing
`ask-stream`/clarify/gate/persist path, not a second chat stack. The threads live on `chats` under the board's category
with `card_ref`.

**Billing (Sachin's decision, recommended default):** every sent question costs one question under
`cardchat:<board>:<cardId>:<turnId>`. Clarify answers are free (they run before reserve), and a retry of the same send
is free. Follow-ups are **not** free, because each one is a full reading with paid model calls. The cost line shows
before every send.

| Alternative | Verdict |
|---|---|
| The client sends the card text | Rejected: it can be edited or stale, and the web's renames and voices would make the shown text differ from what is sent |
| AskModal with a card header | Superseded by the owner's in-card rule. It also hides the card the person is asking about |
| A new card-chat SSE route | Rejected: it would duplicate the gate, clarify, persist and error handling that ask-stream already has |
| Key `cardchat:<board>:<card>:<day>` | Rejected: under `reserve()` every repeat of the key is free, which allows unlimited readings per card per day |
| Follow-ups free for 1 hour (like open parts) | Possible if Sachin wants softer pricing. Cost: up to N extra readings per charged question |
| Server transcription now | Deferred: costs money and changes the privacy policy. Web Speech covers Chromium and Safari today |

### Findings to file in `docs/TODOS.md` (this doc may not edit it)

- **P2** `persistAskTurn` creates a chat with no category (and deactivates every other chat) when `chatId` is missing
  or not found, so a board question can land under General (`src/services/askChatTurn.ts:95-103`). `createChat` also
  deactivates every other chat (`src/graphql/schema.ts:1517`). Done: the category is passed through, with a test.
- **P2** Chat follow-ups are independent readings: `chatWithConfiguredProvider` never passes `history`
  (`chatLlmService.ts:72`; `run.ts:71` only feeds intake). Done: the thread's last turns reach the reading, with a
  test.
- **P3** Reading `getSelfV3`/`getLoveBoard` queues builds or digests as a side effect. Any new reader must pass no-op
  seams (§7 step 2).
- **P3** On Love and Work, the catalogue cards have no on-screen box. They are chips over panels, so "a card" is
  decided here as the panel mapped to its catalogue card by subarea. Sachin to confirm.
