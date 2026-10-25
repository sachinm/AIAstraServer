# 17 — Clarify agent: how it works and how it talks to the person

Added 2026-10-25. Implements file 13 §2 (the clarifier, Track A). Code: `src/reading/clarify/` (`machine.ts`, `planner.ts`, `service.ts`, `store.ts`) and `src/reading/llm/bedrock.ts`. It builds on the bucket classifier (file 15). English only for now.

## 1. Purpose

Turn a vague question into an exact, answerable one in at most two short exchanges, and teach the person what astrology can answer while doing it. A question that already names its area and its period is read straight away, with no questions.

## 2. How a question flows

```
question
  │
  ├─► declined-topics gate (file 18): deny / decline / role-gated ──► fixed reply, stop
  ├─► bucket classifier (rules, < 1 ms)            area, sub-question, period, person, what is missing
  ├─► data prewarm starts (dossier + transit chart, cached in process)       ← Track B begins here
  │
  ├─ nothing missing and confident ──────────────────────────────► READY: read straight away
  ├─ policy question (death timing, lottery numbers …) ──────────► READY: T10 policy answer, no questions
  │
  └─ something missing or unclear ──► ASKING (one criterion per turn, chips + free text)
                                         │ answer (chip or typed)
                                         ├─ still missing and fewer than 2 questions asked ──► ASKING
                                         └─ done, or 2 questions asked (rest defaulted) ─────► PROPOSED
                                                                                                  │
                                       "I will read: … over …, using …"   confirm ─► CONFIRMED ─► reading streams
                                                                           edit ───► PROPOSED again
   any state waiting for the person: 10 minutes without an answer ──► ABANDONED
```

States are plain data (`ClarifyState`). Every transition is a pure function, so each one has a unit test.

## 3. What it asks, and in what order

Criteria are asked one per turn, in this order. A criterion is skipped when the question already answered it.

| Order | Criterion | Asked when | Chips (machine value) | Default if not answered |
|---|---|---|---|---|
| 1 | life area (`bucket`) | the area is unknown, the classifier is below 0.70, or the question names three or more areas | the candidate areas ("Career and job" = `career_job` …) | the classifier's top area |
| 2 | period (`horizon`) | the area needs a period and none was named | "Until 7 Sep 2027" (end of the running sub-period), Next 3 months, Next 6 months, Rest of this year, Next 12 months; free text | the area's default: 6 months for career and money, 12 months for marriage and education, 3 years for property and children |
| 0 | child's age (`child_age`) | the question is about the person's own child and gives no age of 18 or more; asked first, not counted in the two-question cap | 18 or older, Under 18 | none: under 18 or unclear ends with the minors decline |
| 3 | whose chart (`subject_person`) | the area needs it (family and children) and the question did not say | Me, My partner, My adult child (18+), My parent | your own chart |
| 4 | which part (`sub_bucket`) | the area needs it (career) and the question did not say | Changing jobs, Promotion or recognition, Finding a job, Trouble with boss or team, What kind of work suits me | all of the area |
| 5 | second chart (`other_person`) | compatibility questions that do not name the other person | My partner, A prospective match, A family member | (a second chart is required) |

Rules:
- At most two questions. After that the clarifier proposes with defaults and says what it assumed ("I assumed the next 6 months").
- It never asks for something the person already said.
- Each question has at most 18 words. Options come first, and free text is always allowed.

## 4. Talking to the person: real examples

These are produced by the state machine as of 24 Oct 2026, with a chart whose running period is Saturn–Ketu until 7 Sep 2027.

**"When will I get married?"** The question has an area but no period.

> **Clarifier:** Your Saturn–Ketu period runs until 7 Sep 2027. Which period should I look at?
> *[Until 7 Sep 2027] [Next 3 months] [Next 6 months] [Rest of this year] [Next 12 months]*
> **Person:** taps *Next 6 months*
> **Clarifier:** I will read: "When will I get married" over the next 6 months (24 Oct 2026 to 24 Apr 2027), using the D-9 chart, your 7th, 2nd, 11th houses, your Saturn–Ketu period and the transits. *[Yes, read it] [Change]*

**"Is my career going anywhere?"** This needs a period and the part of career.

> **Clarifier:** Your Saturn–Ketu period runs until 7 Sep 2027. Which period should I look at? → *Next 12 months*
> **Clarifier:** Is this about changing jobs, a promotion, finding work, trouble at work, or direction? → *Promotion or recognition*
> **Clarifier:** I will read: "Is my career going anywhere", focusing on promotion or recognition over the next 12 months (24 Oct 2026 to 24 Oct 2027), using the D-10 chart, your 10th, 6th, 1st houses, your Saturn–Ketu period and the transits.

**"Will my daughter get married soon?"** The question is about the person's own child, with no age given.

> **Clarifier:** Is your daughter 18 or older? *[18 or older] [Under 18]*
> **Person:** taps *Under 18* → **App:** "AI Astra does not answer questions about children under 18." (the conversation ends)
> **Person:** taps *18 or older* → the clarifier continues with the period question, and the reading proceeds for an adult child, read from the person's own chart.

A stated age decides on its own: "my 13 year old daughter" is declined straight away, whatever else the question says, and "my 25 year old son" needs no age question. Words like "marriage" or "job" never count as proof of age.

**"How will my work, money and marriage go over the next 3 years?"** (golden Q12) The question names three areas.

> **Clarifier:** Which should I read first? *[Marriage] [Money and wealth] [Career and job]* → *Career and job*
> **Clarifier:** Is this about changing jobs, a promotion, finding work, trouble at work, or direction? → *Promotion or recognition*
> **Clarifier:** I will read: career and job first, from "How will my work, money and marriage go over the next 3 years", focusing on promotion or recognition over the next 3 years …

**"Hello"** The message names no area.

> **Clarifier:** Which area of life is this about? *[Career and job] [Money and wealth] [Love and relationships] [Marriage] [Health windows]*
> **Person:** types "money"
> **Clarifier:** Your Saturn–Ketu period runs until 7 Sep 2027. Which period should I look at?
> **Person:** types "after my sister's wedding" (the rules cannot read it; with a model configured, the model tries; otherwise the default applies)
> **Clarifier:** I will read: your money and wealth over the next 6 months (24 Oct 2026 to 24 Apr 2027), using the D-2 chart … I assumed the next 6 months.

**"Should I change jobs this year?"** No questions: the area, the part (changing jobs) and the period (today to 31 Dec 2026) are all in the question. The reading starts immediately.

**"When will I die?"** Stopped by the declined-topics gate (file 18) before the clarifier runs: one fixed reply, no questions, no reading. Violence, harm and the other deny topics are stopped the same way, and a typed clarify answer on a declined topic ends the conversation without storing the text.

## 5. Questions about another person

| What the person writes | What is recorded | How it is read |
|---|---|---|
| "When will I …", "my …", "we …" | `me` | the person's own chart |
| "for my mother", "my wife's career", "my 25 year old son's business" | `mother`, `spouse`, `son` (adult) | from the person's own chart, through the house and karaka of that relation (5th and Jupiter for children, 4th and Moon for the mother, 9th and Sun for the father, 7th and Venus for the spouse); the proposal says "(about your son, read from your chart)" |
| family and children questions that do not say whose chart | asked: "Is this about your own chart or someone else's?" | as chosen |
| compatibility ("are my partner and I compatible") | `other_person = partner` | needs the second person's birth details; a two-chart reading (template T8) is not built yet, so for now the reading explains what the person's own chart says about partnership and asks for the partner's details |

Reading another person's chart directly (their own birth details) is the two-chart work in the plan, not yet built.

## 6. The model step (optional, Bedrock)

The rules decide **what** to ask: the order, the two-question cap, the defaults, and never re-asking. A model is used only for two things the rules do badly:

1. **Phrasing:** it rewrites the rule question in a friendlier, chart-aware way, keeping the same chips so the values the client sends back stay stable.
2. **Free text:** it maps an answer the rules could not read ("after my sister's wedding in spring") to one of the closed values (a period id or date range, an area id, a sub-question id, a person).

| Setting | Value |
|---|---|
| `READING_MODEL_CLARIFY` | `off` (default: rules only), or `bedrock:<model id>` |
| Recommended model | `openai.gpt-oss-120b-1:0` (open-weight reasoning model, on demand in us-east-1), reasoning effort low |
| Alternatives on Bedrock | Meta Llama 4 Maverick (`us.meta.llama4-maverick-17b-instruct-v1:0`, cross-region profile), Qwen3-Next 80B, DeepSeek V3.2, NVIDIA Nemotron Super 3 120B, Google Gemma 3 27B. Meta Muse is not offered on Bedrock. |
| Budget | 900 ms per call, `maxTokens` 300 (set explicitly so the quota reservation stays small); any error or timeout falls back to the rules |
| Safety | the reply must be a JSON object; questions over 22 words or mentioning death, remedies, lottery numbers or money amounts are discarded in favour of the rule question |
| Blocked by | Bedrock quotas in account 442728149528 are 0 for every model; a support case is needed (gpt-oss-120b: L-25B50707 requests/min, L-9DC5F595 tokens/min, plus the daily token limit). The Lambda role also needs `bedrock:InvokeModel` on the chosen model. |

## 6a. Coaching: how to ask so astrology can answer

Code: `src/reading/coach/content.ts`. Every area has a card with four parts:
- what the chart can answer;
- a good example question;
- a weak question with its rewrite;
- what to include (which part, whose chart, the period).

The cards reach the person in three places:

| Where | When |
|---|---|
| `guidance` on the clarify event | the area question for a message with no life area ("Hello", "Will it happen?"): one line on how to ask, with area chips |
| `guidance` on the SSE `intent` event | the same cases on the normal reading path |
| GraphQL `askingGuide(bucketId)` | the "ask better" helper and the subject chips under the input; health appears only for roles allowed to discuss it |

No example or rewrite falls into a declined topic. This is a test.

The SSE `intent` event also carries the bucket, sub-question, template and missing slots. That lets the web draw the reading card frame before the first token arrives.

## 7. Two tracks: data is ready before the person confirms

When the question arrives, the dossier and transit chart load in parallel (the same in-process cache the reading uses). The chart-aware first question waits at most 300 ms for that load. If the load takes longer, the plain question is asked, and the load keeps going in the background. By the time the person taps "Yes, read it", the data is warm, so confirmation costs no data wait.

Still to come with the graph branch: dispatching the stage-1 specialists (promise, nakshatra, dasha with a wide horizon) during clarification, so their findings are also ready on confirm.

## 8. API contract

All endpoints use the existing JWT. The clarify step happens only when the client sends `clarify: true`. Older clients keep today's behaviour (read straight away).

| Call | Body | Response |
|---|---|---|
| `POST /api/chat/ask-stream` | `{ question, chatId?, clarify: true }` | SSE. Either the normal reading, or `{ type: "clarify", runId, criterion, question, chips:[{label,value}], allowFreeText, turn, understanding }` or `{ type: "propose", runId, exactQuery, assumed, slots }`, then `{ type: "done", status: "clarifying", runId }` |
| `POST /api/chat/answer` | `{ runId, value, viaChip }` | JSON: the next `clarify` or `propose` event |
| `POST /api/chat/confirm-stream` | `{ runId, chatId?, edits?: { horizon?, bucket? } }` | SSE: the reading with the confirmed intent (or a new `propose` after an edit) |

`READING_CLARIFY_MODE`:
- `when_missing` (default): ask only when something is missing or unclear.
- `always`: also propose when nothing is missing.
- `never`: never ask.

## 9. Where the state lives

The state lives in `reading_runs`: status `clarifying`, then `confirmed` or `abandoned`. The state is stored in `intent.clarify`, and on confirm the confirmed intent goes to `intent_confirmed`. These columns exist since migration M4, so no schema change is needed. The next HTTP request may land on another Lambda instance, so the state cannot live in memory. Tests use the in-memory store.

## 10. Tests

`tests/unit/reading/clarify.test.ts` covers:
- **Transitions:** every state change; the two-question cap and defaults; never re-asking.
- **Answers:** chips and free text; ambiguous and unknown areas; person extraction; policy questions.
- **Lifecycle:** confirm and edit; abandonment after 10 minutes.
- **Model step:** the planner falling back to the rules on model error, timeout and invalid output, with a fake Bedrock client.
- **Endpoints:** the clarify, answer and confirm flow end to end with the memory store.
