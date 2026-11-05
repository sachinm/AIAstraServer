# 48 — The companion: a conversational memory at the centre of the You board

Status: **design and build plan, 2026-11-05 (Fable).** No code written. Sachin's brief, after the interview rule of
doc 45 §3.5: *"we need a conversational AI prime and center on the user profile, the personal side, that is intelligent
about memory, learns about the person as much as possible, and asks questions to learn about the user."* This document
makes that the centre of the You board (doc 45 §8.3) and the single memory every board and the chat read from.

## 0. Answer first

1. **The companion is the You board's first screen.** Not a form, not a dashboard: one line from the companion, one
   question or one observation, and the person's one-tap or typed answer. It remembers what it learns, and the boards
   (Love, Work, Lucky times) and the chat's Clarify step read the same memory, so nobody is asked twice.
2. **Memory is a table of facts about the person, with provenance and freshness**, not a transcript. Each fact says
   where it came from (the person said it, tapped it, or it was inferred from a question or the ledger), how sure, when,
   and when to ask again. The chart is never a fact in this table; the chart lives in `kundli_data`.
3. **It asks one thing at a time, chosen by value**: the fact that would most change what the boards show next, that is
   missing or stale, and that the person has not declined. Never a questionnaire; never the same question twice while
   fresh; never a chart term.
4. **It learns from three streams**: answers to its questions, what the person says in chat (the classifier's slots of
   doc 15 already extract employed / between jobs / self-employed / studying, places and people), and the ledger
   (doc 27: events with dates). An inferred fact is confirmed with one tap before it drives a prediction.
5. **It is honest about not knowing.** When a fact is missing, the boards show the chart's estimate with "we're assuming
   you're employed" once and a tap to correct; a prediction that depends on an unknown fact is not made (doc 45 rule 13).
6. **Private by construction.** Facts are sealed with the per-user keys of the privacy plan (docs/privacy/02), shown
   only to the person, deletable one by one or all at once, never used in prompts beyond the person's own readings, and
   never shown back as a fact in a way that could be heard as surveillance ("you told us on 3 Nov…" is fine; "we noticed
   you…" is not).
7. **Phases:** 0 the fact table and the question engine as code (template lines, one question per visit, no model
   cost); 1 the You screen and the shared read by boards and Clarify; 2 the conversational layer on Gemini after the
   spend yes (free text, follow-ups, warmth); 3 learning from chat and ledger with confirmation taps; 4 proactive
   check-ins ("the review you mentioned was last week; how did it go?").
8. **Recommendation:** build the memory and the question engine first, as deterministic code, so the companion is
   useful and cheap from day one; add the model only for the conversation itself (§8).

## 1. Start: what exists today (facts checked 2026-11-05)

| Fact | Where |
|---|---|
| The chat's Clarify step asks before answering and stores its state in `reading_runs.intent.clarify` and the confirmed intent in `intent_confirmed` (JSON); nothing is kept about the person beyond that run | doc 17 §9; `src/reading/clarify/*` |
| The classifier extracts a `background` slot from question text: employed, between jobs, self-employed, studying, plus places and people | `src/reading/buckets/classifier.ts:449-453` (`extractBackground`) |
| The ledger holds dated life events by category (job start and end, marriage, moves, …) and an interview helper that turns free text into events | `life_events`, `src/reading/timeline/ledgerStore.ts`, `LedgerInterview` in the web app |
| The person's current place is stored for chat questions | `user_current_location` (`user_id`, `place`, `tz`) |
| Profile holds name, birth details, language, region; nothing about work, relationship or goals | `ProfileSection.tsx`, `auth` table |
| Chat threads and messages are stored per user | `chats`, `chat_messages` |
| Privacy: B0 closed the leaks, B1 built per-user keys; writes are still plain (docs/privacy/02 phases); Gemini is not on Bedrock | docs/privacy/01, 02 |
| Doc 45 rule 13 and §3.5 define the first one-tap questions (work status, what is hardest, relationship status, planning or checking); doc 43 §8.3 the work-level question; doc 44 §3 the self-report | docs 43–45 |

Symptom today: the app knows the chart and nothing about the person; every answer is general, and the person repeats
themselves in every chat.

## 2. End goal

The person opens You and meets a companion that already knows what they have told it, asks one short question when it
would help, and never asks again while the answer holds. A week later it says "You said the review is on the 12th; the
12th is a good day for it, the morning more than the afternoon" and after the 12th asks how it went. Work, Love and
Lucky times read the same memory, so they lead with the right worry in the right words. The person can see every fact
the app holds about them on one page, correct or delete any of them, and the deletion takes effect everywhere at once.
What can no longer go wrong: a prediction for an employee shown to someone between jobs; the same question asked in the
chat and again on a board; a fact kept after the person deleted it.

## 3. Deliverable

| Area | Items |
|---|---|
| Server, data | migration `person_facts` and `person_questions` (§4.1); the sealing of fact values with the B1 keys |
| Server, engine | `src/reading/companion/{facts.ts,questions.ts,policy.ts,learn.ts,lines.ts}`: the fact model, the question catalogue, the pick-one policy, learning from chat and ledger, template lines |
| Server, API | `src/routes/companionRoutes.ts` (§4.2); Clarify and the area builds read facts through `facts.ts` |
| Web | You → Overview becomes the companion screen (`CompanionScreen`, `FactCard`, `QuestionCard`, `MemoryPage` under You → About you) |
| Prompts (Phase 2) | the companion persona and the fact-extraction schema (doc 33's curriculum style) |
| Docs | this plan; privacy doc 02 gains the `person_facts` row |

## 4. How it works when done

### 4.1 Backend

**The fact model** (`person_facts`): `user_id`, `key` (from a fixed catalogue, §4.3), `value` (sealed), `source`
(`tapped | typed | chat_inferred | ledger_inferred | estimated`), `confidence` (1.0 for tapped and typed, 0.6 inferred,
0.3 estimated), `asked_at`, `confirmed_at`, `valid_until` (freshness: work status 90 days, relationship status 90
days, a named event until its date plus 14 days, mood 1 day), `declined_at` (the person tapped "skip"; ask again after
180 days at most), `deleted_at`. One row per key; history is not kept (the old value is overwritten, so deleting is
simple and complete).

**The question engine** (`policy.ts`, pure code): on each You open, and when a board needs a fact, pick **one** question:
1. Candidates are facts that are missing, stale, estimated, or inferred-but-unconfirmed, and not declined.
2. Score each by **value now** = the number of visible cards whose content changes with the answer (Work tone,
   worry order, scenario cards, the chat's next answer) × a freshness weight × a recency penalty (asked in the last 7
   days → 0).
3. Pick the top one; at most one question per visit on You, at most two before any answer anywhere (doc 45 §3.5).
4. Store `asked_at`; on answer store value, source and `confirmed_at`; on skip store `declined_at`.

**Learning** (`learn.ts`): after every chat answer, the classifier's slots (background, people, places, named events
with dates) are written as `chat_inferred` facts at 0.6; after every ledger write, the matching facts are updated
(`job.end` sets work status to *between jobs* as `ledger_inferred` until confirmed). An inferred fact is never used to
make a prediction until confirmed by one tap; until then it only orders the next question ("You mentioned a new job in
chat; is that right?"). Nothing is extracted from a message the person deleted.

**Lines** (`lines.ts`, Phase 0–1): template sentences keyed by fact and board state ("You said you're between jobs.
This week's best stretch to send applications is Wed morning"); the model (Phase 2) rewrites them warmly and handles
free text, under a validator that forbids new facts, dates or grades not in the input (doc 39's validator pattern).

**Limits:** one question per visit; a visit is 30 minutes; facts per user capped at 200 keys; sealing and unsealing in
the same request path as the ledger; no fact value in any log; the daily sweep deletes rows past `deleted_at`.

### 4.2 API

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/companion/opening` | | `{ line, question?: { key, text, options[] }, observation?: { line, fact_key, action } }` — the You screen's first card |
| `POST /api/companion/answer` | `{ key, value | skip: true, typed?: string }` | `{ stored, next?: question }` (204 when nothing follows) |
| `GET /api/companion/facts` | | the person's facts for the Memory page: `{ key, label, value, source, since, until }[]` (unsealed for the person only) |
| `DELETE /api/companion/facts/:key` · `DELETE /api/companion/facts` | | 204; the boards re-read on next load |
| `POST /api/companion/say` (Phase 2) | `{ text }` | `{ line, facts_proposed[] }` — free text; proposed facts need a tap |
| Internal | `facts.read(userId, keys[])` used by Clarify (doc 17), the area builds (doc 42), the tone engine (doc 45 §7), Lucky times scenarios (doc 47 §3.4a) | |

### 4.3 The fact catalogue (v1)

| Key | Asked as | Options | Used by |
|---|---|---|---|
| `work.status` | "Do you have a job right now?" | Yes · Between jobs · Own business · Studying · Retired | Work worries order, scenario titles, signatures read |
| `work.level` | "What best describes your work now?" (doc 43 §8.3) | Hourly · Employee · Specialist · Manage people · Senior leader · Own business alone · Own business with staff · Several businesses | Work wording and ceiling |
| `work.hardest` | "What's hardest at work right now?" (only in a Demanding tone) | My boss · Politics · Pay · The role itself · Nothing much | the trouble signature read first |
| `work.next_event` | "Anything coming up at work?" | an interview · a review · a decision · a start date · nothing (typed date optional) | Lucky times and Work "this week" lines; the follow-up after the date |
| `love.status` | "Right now are you…" | Single · Seeing someone · Committed · It's complicated · Prefer not to say | Love worries order, points read |
| `love.hardest` | "What's hardest right now?" (only in a strain tone) | Distance · A fight · Family · Trust · Nothing much | the strain signature |
| `love.next_event` | "Anything coming up?" | a date · a talk · meeting family · a decision · nothing | Lucky times scenarios |
| `self.focus` | "What are you most working on for yourself?" | Confidence · Direction · Energy · Habits · Peace of mind · Faith | You's worries order |
| `self.mood_today` | "How are you today?" (once a day, optional) | Light · Okay · Heavy | Today's line; the mood feedback stream of doc 32 Part 2 |
| `place.current` | set in the profile (doc 45 rule 12) | | Lucky times |
| `planning_or_checking` | "Planning something, or just checking?" | Planning · Checking | horizons shown |

Every key has a label for the Memory page and a plain deletion. New keys come only through this catalogue.

### 4.4 Frontend experience

| State | You → Overview shows |
|---|---|
| First open, nothing known | "I'll get to know you as we go. One question: do you have a job right now?" with the chips; skip is a chip |
| Something known, a question has value | The opening line built from the tone and a known fact, then one question card |
| Something known, nothing to ask | The opening line and one observation with an action ("Your review is in 9 days; the 12th looks better than the 11th. See the day") |
| After an event date passes | "How did the review go?" → *Went well · Mixed · Not well · It moved*; the answer becomes a ledger entry when it names an event |
| Memory page (You → About you → What I know) | the facts as cards, each with source and date, "Change" and "Forget"; "Forget everything" at the bottom; a line on what is never stored |
| Phase 2 | a text field under the opening line ("Tell me something") with the companion's reply and proposed facts as chips to confirm |

Words: first person for the companion ("I'll remember that"), never "we noticed"; questions are the person's situation,
never a chart term; no more than one question per visit; a skipped question disappears without comment.

## 5. Architecture

```
You screen ──GET opening / POST answer──> companionRoutes ──> policy.ts (pick one) ──> person_facts (sealed, B1 keys)
Chat answer ──classifier slots──> learn.ts ──inferred facts──> person_facts        Ledger write ──> learn.ts
Clarify (doc 17), area builds (doc 42), tone (doc 45 §7), Lucky times scenarios (doc 47) ──facts.read──> person_facts
Phase 2: say ──> Gemini (persona + extraction schema) ──> validator ──> line + proposed facts (confirm by tap)
```

Boundaries: the fact table never holds a chart value; the companion never changes a grade, a date or a tone, only what
is read first and how it is worded; the model sees the person's facts only inside that person's request.

## 6. Ingredients

| Need | Who |
|---|---|
| Migration `person_facts`, `person_questions` on the test database | agent, standing OK; production: Sachin |
| B1 sealing helpers wired for fact values | agent (docs/privacy/02 phases decide when writes become sealed in production) |
| Gemini key, model, count (Phase 2: one call per free-text turn, none for taps) | Sachin |
| Review of the question wording and the catalogue | Sachin |
| Decision: the companion's name and voice (the existing guide avatar, or a new one) | Sachin |

## 7. Action steps in sequence

1. Migration and `facts.ts` (read, write, seal, delete); unit tests. Parallel with 2.
2. The catalogue and `policy.ts` (pick one by value); tests with fixtures of known and missing facts.
3. `companionRoutes.ts`; `lines.ts` templates; the You Overview screen and the Memory page (web).
4. Wire readers: Clarify reads `work.status` and `love.status` before asking; the Work and Love boards order worries by
   facts; Lucky times reads `*.next_event` for its cards. Depends on 1–3.
5. `learn.ts` from the classifier's slots and the ledger, with confirmation taps. Depends on 1.
6. Phase 2: persona and extraction prompts, the validator, `POST /say`; eval on 20 scripted conversations.
7. Phase 4: check-ins after event dates; one push a day at most, only when there is something to say.

## 8. Development phases

| Phase | Steps | Ships | Check that closes it | Deferred |
|---|---|---|---|---|
| 0 Memory and the one question | 1, 2 | the fact table, the policy, the catalogue | tests: the picked question changes when facts change; a declined question is not re-asked | |
| 1 You screen and shared reads | 3, 4 | the companion as You's first screen; boards and Clarify read facts | a person asked on Work is not asked again in chat; Memory page shows, changes and forgets | free text |
| 2 Conversation | 6 | free text, warm lines, proposed facts | validator rejects any new date or grade; 20 conversations reviewed | learning from chat |
| 3 Learning | 5 | inferred facts with confirmation | a chat mention of a new job becomes a confirmed fact in one tap | |
| 4 Check-ins | 7 | follow-ups after dates; the daily push | one push a day at most; opt-out in one tap | |

## 9. Recommendation and verdicts

Build the memory and the question policy as code first, put the companion on You's first screen with template lines,
and let every board and the chat read the same facts. Add the model only for free text, after the spend yes.

| Option | Verdict |
|---|---|
| **A fact table with provenance and a pick-one question policy; the model only for conversation (chosen)** | Useful from day one at no model cost; one memory for every surface; deletable completely |
| A transcript memory (feed past chats to the model) | Rejected: cost per call, no deletion guarantee, facts drift, surveillance feel |
| A profile form | Rejected: Sachin's rule 3 (no configuration); people do not fill forms, they answer one question |
| Questions on every board independently | Rejected: the same question twice; no single place to see and forget |
| The companion changes predictions directly | Rejected: it changes what is read first and the words, never a grade or a date (doc 46 owns the chart) |

## 10. Open points for Sachin

1. The companion's name and voice: the existing guide avatar, or a new persona for the personal side.
2. Approve the v1 catalogue (§4.3) and its wording.
3. Whether `self.mood_today` is asked daily by default or only when the person opens You (default: only on open).
4. Phase 2 spend (one Gemini call per free-text turn) before any call.
5. Whether the companion may read chat history older than the current session for learning (default: current session
   and the ledger only, until the privacy plan's sealed writes are live).
