# Serverless voice, approved answers only (plan, 2026-11-02)

Sachin's brief: serverless. Tell me the cost for 10,000 people using it simultaneously all day. Limit it so it cannot give away
intellectual property, our reading process, where the data came from, or how we store and encrypt data. "Be very wary and start very
conservative and then expand the info that's available."

This replaces `docs/assistant/02` for launch. Nothing here is built or released yet.

## 1. Start: facts checked (2026-11-02)

| Fact | Source |
|---|---|
| Nova 2 Sonic: 20 concurrent sessions per account per Region, **not adjustable**. Four Regions. 8-minute connection limit. Guardrails not supported | AWS model card and Nova 2 guide |
| The Bedrock browser SDK has a WebSocket handler, so browser-to-Sonic is possible | `@aws-sdk/client-bedrock-runtime` 3.1156 `runtimeConfig.browser.js` |
| No AWS page found for Bedrock client secrets or WebRTC. One third-party gateway says they are unsupported | Search, not conclusive |
| Sonic's system prompt is sent by whoever opens the stream, so on a direct browser call it sits in the browser | AWS getting-started guide |
| Transcribe streaming: $0.01 a minute in AWS's example, billed per second | AWS pricing page. US East tier table not in the text I read |
| Polly per million characters: Standard $4, Neural $16, Generative $30 | AWS pricing page |
| Nemotron 3 Super 120B: $0.15 in, $0.65 out, per million tokens, US East | AWS pricing page. Sonic's price was not readable there |
| Lambda: $0.20 per million requests, $0.0000166667 per GB-second | AWS pricing page |
| Transcribe concurrent streams default 25 | One re:Post article. **Confirm in Service Quotas** |

**Why not Sonic, though it was the first ask:** 80 people at most at any moment, whatever is paid. The brief would be readable in the
browser, a token would let anyone use the model on our bill until it expired, and the words cannot be checked on a server before they
are spoken. Those last three break the brief above directly.

## 2. End goal

A visitor clicks the button at the top right and talks. It answers aloud, only with words Sachin has approved. It cannot say anything
else, because nothing can generate new words. Sachin widens what it can say by approving more answers.

## 3. Deliverable

- **`assistant-voice` Lambda**, separate from the API: mints Transcribe tokens, picks answers, logs. No access to the database of
  charts, no Radha, no reading code.
- **Approved answer file** on the server only, and pre-recorded audio on a CDN.
- **Web:** voice button, Transcribe connection, device-voice fallback. No text input.
- **Testbed:** extended from WebRTC to WebSocket and HTTP, because this route has no WebRTC.

## 4. How it works when done

### Backend

1. Click: the Lambda checks Turnstile and limits, then returns a presigned Transcribe URL lasting at most 5 minutes. That URL is the
   ephemeral token. It can reach Transcribe and nothing else, so the browser never holds a route to the model or the answers.
2. The final transcript goes to the Lambda.
3. `fixedAnswer` and the declined topics run first.
4. Nemotron gets the transcript and a list of answer IDs with short labels, and returns one ID or `none`. **It never sees the answer
   text and never writes words a person hears.**
5. The Lambda returns that answer's text and audio URL. `none` gets the deflection line.
6. Questions and chosen IDs go to the log, kept 90 days. Audio is never stored.

The worst a successful prompt injection can do is pick the wrong approved answer.

### API

| Call | Request | Response | Errors |
|---|---|---|---|
| `POST /voice/session` | `{ visitId, turnstileToken }` | `{ transcribeUrl, expiresIn }` | `403` check failed, `429` limit, `503` off |
| `POST /voice/turn` | `{ visitId, transcript }` | `{ answerId, text, audioUrl, cta }` | `429`; the page says a built-in line |

### Frontend

- **Button:** top right, beside Sign up, on all public pages and held above the routes, so a call survives moving to `/signup`.
- **Microphone:** opens only after the click. Off in password fields. A check in the page sends audio only when someone is speaking,
  because Transcribe bills per second sent.
- **Ends** at sign-in, on a click, or after a silence (tap to resume).
- **Bad connection:** token or turn fails, so it uses the device's voice for the text, then the tap answers built into the page.

### UI/UX

Captions read-only. Spoken once on a drop: "The connection is weak, so I'll keep this simple." No text box in any state.

## 5. What it may say: start small, widen on approval

| Level | What it can say | Who widens it |
|---|---|---|
| **0, launch** | About 15 approved answers: what readings cover, the free plan, what it declines, how to sign up, a pointer to the Privacy Policy | Sachin |
| **1** | More approved answers, drawn from the logged questions that got `none` | Sachin, reviewing the log |
| **2, only if wanted** | Model-written replies on one narrow topic, checked on the server, after a red-team run | Sachin, per topic |

Never at any level: how readings are made, data sources, calculations, models or vendors, storage, encryption, security, who built
it, other people's details.

Questions on how personal data is handled get one approved line pointing to the Privacy Policy, because a person has a right to that
answer and the policy is already public.

## 6. Cost for 10,000 people at once, all day

10,000 people for 24 hours is 14.4 million person-minutes a day. **Assumed:** one exchange every 30 seconds, each answer about 200
characters, about 930 model tokens per exchange when it writes the answer, a 1 GB Lambda running 3 s.

| Per day | Mic always streaming, model writes, Neural | Mic only on speech (20%), model writes, Neural | **Approved answers, level 0** |
|---|---:|---:|---:|
| Transcribe | $144,000 | $28,800 | $28,800 |
| Polly | $92,160 | $92,160 | About $0 (recorded once) |
| Nemotron | $5,472 | $5,472 | About $3,800 |
| Lambda and data | About $1,640 | About $1,640 | About $1,640 |
| **Per day** | **About $243,000** | **About $128,000** | **About $34,000** |
| **Per 30 days** | **About $7.3M** | **About $3.8M** | **About $1.0M** |
| **Per person-minute** | $0.017 | $0.009 | $0.0024 |

A real visitor costs far less. A 3-minute talk at level 0 is about **$0.007**, so 1,000 of them a day is about $7.

These are list prices with no free tier or negotiated discount. Transcribe's volume tiers were not visible, so its line could move.
None of this has been measured.

**10,000 at once is also a quotas question.** It needs raises on Transcribe streams, Bedrock tokens per minute and Lambda concurrency,
and the log needs batching: 28.8 million rows a day would not suit the Render Postgres.

## 7. Ingredients

| Item | Who |
|---|---|
| Bedrock access to Nemotron (step 7 of the CloudShell file) | Sachin |
| New Lambda with its role: Transcribe streaming, Bedrock for one model, the log table | Sachin, from a script agents write |
| S3 and CDN for recorded answers; Polly at build time | Sachin, from the same script |
| Approval of every answer's words | Sachin |
| Lawyer's read: open microphone during sign-up | Sachin |
| Code, tests, red-team list, testbed changes | Agents |
| Release | Deploy session, on Sachin's word |

## 8. Action steps

1. Write the 15 answers. Sachin approves them.
2. Answer picker with its red-team tests: prying, injection, Hindi, garbled transcripts.
3. `assistant-voice` Lambda, session and turn routes, limits, spend cap.
4. Voice button, Transcribe connection, tiers.
5. Extend the testbed to WebSocket and HTTP with a stand-in Transcribe; run every network scenario.
6. Sachin runs the AWS script. Measure real delay, then real phones.
7. Privacy Policy and the controls note. Sachin approves the words.
8. Release behind `VOICE_ENABLED`, capped.

## 9. Phases

- **Phase 1 (steps 1 to 5):** built and tested with stand-ins. About 2 to 3 working days.
- **Phase 2 (steps 6 to 8):** the real services. Needs the AWS script and phones.

## 10. Recommendation

**Launch at level 0 with a hard cap: 50 calls at once and 5,000 minutes a day, about $12 a day.** Raise both once real use is seen.
It is the only design here where the rule that it cannot give anything away holds by construction rather than by checking, and it is
also the cheapest.
