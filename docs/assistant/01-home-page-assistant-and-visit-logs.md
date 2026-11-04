# The home page assistant, and the visit log

**Built 2026-11-02. Where this differs from the text below, this box is what shipped.**
- On every public page except `/signin`, including `/signup`, and not for someone signed in. A button, bottom left.
- Sachin's rule (2026-11-02): it never reveals how charts are built, where the sky is calculated from, or which dasha systems or data points are used. It says "I wouldn't know all that. I leave it to the ancient Vedic texts and the sages and oracles inside the site. They're busy helping real people with real readings in there." So the prompt names none of those things (a test enforces it), a fixed answer catches the question before any model runs, and a word check on the way out replaces any answer that slips.
- A random visit id in localStorage, not a cookie: the API is on another domain, so a cookie would be third-party. Visits are logged on page load, once per browser session, as Sachin asked for every visitor, not only those who ask a question.
- On by default, `ASSISTANT_ENABLED=0` turns it off, because agents cannot change Lambda env. With no model access it still answers, with a fixed line.
- The address comes from `CloudFront-Viewer-Address` when forwarded, else Express's `req.ip`, because a visitor can forge the first hop of `X-Forwarded-For`.
- Not built: the admin read route and the erasure route (read the tables directly for now; filed in `docs/TODOS.md`).

Plan, 2026-11-02. Sachin's request: a conversational assistant on the home page that answers general questions about
what AI AdAstra can do, on a Bedrock open-weight model (Nemotron preferred), with example answers: "Will you be able
to answer questions about my illness?" No. "Can you tell me where my son will go to college?" Yes. "What field are they
more inclined for?" Yes. "Can you read his birth chart?" No, sign up for an account and let's look at it. Keep what
people ask in a separate table, and keep IP address, user agent and what identifies a visitor, for SOC 2.

## 1. Start: what is true today

Checked in the code and the docs on 2026-11-02; nothing read from AWS, because the agents have no AWS access tonight.

- **Home page.** `AIAstra_WEB/src/LandingPage.tsx`: hero, the 9,500 records block, and the FAQ from
  `src/lib/landingFaqs.ts`. No input of any kind for a signed-out visitor. The page is prerendered at build time.
- **API for signed-out visitors.** `GET /api/billing/plans` is the only public route besides `/health` and the
  GraphQL sign-up mutations. GraphQL has a rate limit of 200 requests per 15 minutes per IP (`server.ts:120`).
- **Bedrock in the server.** `src/reading/llm/bedrock.ts` wraps the Converse API for the clarifier, with no streaming.
  Default model `openai.gpt-oss-120b-1:0`. The file notes that Meta Muse is not on Bedrock in this account or region
  (checked 2026-10-25). Nemotron 3 Super 120B is on Bedrock as `nvidia.nemotron-super-3-120b` (AWS model card and the
  2026-03-18 What's New post), and the 30B Nano as `nvidia.nemotron-nano-3-30b` (AWS blog, mirrored). Neither has
  been called from this account: model access, quota and `bedrock:InvokeModel` on the Lambda role are unknown, and
  `docs/TODOS.md` says the role lacks it for gpt-oss too.
- **Declined topics.** `DeclinedTopic` table and `src/reading/policy/declined.ts`: a word-and-phrase gate with a fixed
  reply per topic (death, baby sex, a third party's private actions, gambling, harm). It runs before any model, and the
  interview route already uses it. The home page assistant can use the same gate unchanged.
- **Where the IP comes from.** `src/lib/requestMeta.ts` reads `X-Forwarded-For` first hop, `X-Real-IP` or
  `CF-Connecting-IP`. The API sits behind CloudFront, which sets `X-Forwarded-For`; `trust proxy` is 1. `auth.signup_ip`
  is the only stored IP today. Nothing stores a user agent.
- **Privacy docs.** The published Privacy Policy says questions may reveal sensitive matters and asks people to share
  only what they are comfortable with. It says nothing about IP addresses, user agents or a visit log. The privacy plan
  (`docs/privacy/01`) lists logs that already hold personal data, and it wants model traffic inside AWS. Google
  Analytics is on every page (`index.html:34`), which already sends IP and usage to Google.
- **Terms.** Education and entertainment only; no advice; nothing about college or careers specifically.

## 2. End goal

A visitor on the home page sees a small chat box under the hero: "Ask what AI AdAstra can do." They type a question in
plain words and get a short, honest answer within about 3 seconds, in the product's voice, that says yes, no, or
"that needs your chart, so sign up". It never gives a reading, never names the engine or any model, never asks for
birth details, and declines illness, death, gambling and anything in the declined list. Every question and answer is
stored with the visit's IP, user agent, country and a visit id. Sachin can read what people asked, and a SOC 2 auditor
can see who visited, when, from where, how the data is protected, and when it is deleted.

The four example answers, in the product's voice:

| Question | Answer |
|---|---|
| Will you be able to answer questions about my illness? | No. AI AdAstra does not give medical advice or read health from a chart. For your health, please see a doctor. |
| Can you tell me where my son will go to college? | Yes. With his birth chart, a reading can look at the periods and houses the tradition links to education and say what they suggest, and when. It is a reading, not a prediction. |
| What field are they more inclined for? | Yes. That is one of the most common questions: the chart's tenth house, its lord and the running periods are read together for career inclinations. |
| Can you read his birth chart? | Not here. Sign up for an account, add his birth details, and the readings open from his chart. It takes a few minutes. |

## 3. Deliverable

- **Server:** `POST /api/assistant/ask` (public), `src/assistant/` with the system prompt, the answer schema and the
  Bedrock call through a shared adapter; migration `assistant_m1_visits_and_questions`; a daily job that removes
  expired rows; a `GET /api/admin/assistant/questions` for Sachin's role; tests.
- **Web:** `src/components/HomeAssistant.tsx` under the hero; a visit id cookie; a line in the Privacy Policy.
- **Docs:** this plan; the retention table in the Privacy Policy; a SOC 2 evidence note in `docs/security/`.
- **Infra (Sachin, CloudShell):** Bedrock model access for Nemotron, `bedrock:InvokeModel` on the Lambda role for
  that model only, the env vars below.

## 4. How it works when done

### Backend

1. The request arrives with the question (1 to 400 characters), the visit id cookie, and the headers CloudFront
   forwards. The route reads IP, user agent, `CloudFront-Viewer-Country` (once step 2 of the CloudShell file is in),
   `Accept-Language`, and the referrer.
2. **Visit upsert.** `assistant_visits` gets one row per visit id per day: first and last seen, IP, user agent,
   country, language, referrer, and the first landing path. One query, `ON CONFLICT` on `(visit_id, day)`.
3. **Rate limit.** 10 questions per visit per hour, 30 per IP per hour, 2,000 for the whole site per day
   (`ASSISTANT_DAILY_CAP`). Over the limit returns 429 with a polite line, and nothing is sent to the model.
4. **Declined gate.** `declinedFor(prisma, null, text)` with no user: a hit returns that topic's fixed reply, logged
   with `outcome = declined`, no model call.
5. **Model call.** Converse on `ASSISTANT_MODEL` (default `nvidia.nemotron-super-3-120b`, fallback
   `openai.gpt-oss-120b-1:0` on AccessDenied or throttle), `maxTokens` 220, temperature 0.3, timeout 6 s, one retry
   on throttle only. The system prompt holds: what the product is, the capability list (what a reading covers, what it
   never covers), the four example pairs, the voice rules from `SOUL.md`, and "never name the calculation engine,
   the model or the cloud". The reply is JSON: `{ "answer": string, "verdict": "yes" | "no" | "needs_chart" |
   "unsure", "cta": boolean }`. A parse failure returns the `unsure` canned answer.
6. **Output check.** A word list check on the answer (engine and model names, medical and legal phrasing); a hit
   replaces the answer with the canned `unsure` line and logs `outcome = scrubbed`.
7. **Log.** `assistant_questions` gets the question, answer, verdict, outcome, model, tokens in and out, latency and
   cost, and the visit id. Written after the response is sent.
8. **Retention job.** Once a day (the existing sweep), delete `assistant_questions` older than 90 days and
   `assistant_visits` older than 400 days, unless a legal hold flag is set on the row. Counts are logged.

Numbers: p50 under 2.5 s, p95 under 6 s; cost per question about $0.0004 on Nemotron Super at the Bedrock list rate
(input about $0.60 and output about $1.80 per million tokens were not read from AWS tonight: read them before launch and
add rows to `llm/models.ts` `PRICES`). 2,000 questions a day is under $1 a day.

### API

| Call | Request | Response | Errors |
|---|---|---|---|
| `POST /api/assistant/ask` | `{ question }` + cookie `aa_visit` | `200 { answer, verdict, cta }` | `400 bad_question`, `429 too_many`, `503 assistant_unavailable` |
| `GET /api/admin/assistant/questions?from&to&verdict&q` | Sachin's roles only | paged rows with visit fields | `401`, `403` |
| `DELETE /api/admin/assistant/visits/:ip` | erasure request | `{ deleted }` | `401`, `403` |

### Frontend

- A card under the hero: the prompt line, a text box, a Send button, and four example chips that fill the box with
  one of the four questions. The answer appears under it with a Sign up button when `cta` is true. Three turns at most
  are kept on screen; it is not a chat history and nothing is stored in the browser except the visit id.
- The visit id is a random 128-bit value in a first-party cookie `aa_visit`, 400 days, `SameSite=Lax`, `Secure`,
  set by the API on the first call so the prerendered page stays static. No cookie is set until the person sends a
  question. The disclaimer line sits under the box: "For education and entertainment. Questions are logged."
- States: idle, sending (button disabled, dots), answered, declined (the fixed reply in a muted colour), limit
  (the polite line), error (one retry button). Reduced motion: no dots animation.

### UI/UX

Words on screen: "Ask what AI AdAstra can do", placeholder "For example: can you tell me when I will change jobs?",
button "Ask", under it "Not a reading. For education and entertainment. Questions are logged." The Sign up button
reads "Sign up and read your chart". Nothing says Nemotron, Bedrock or AWS.

## 5. Architecture

```
Home page (prerendered) --POST /api/assistant/ask--> CloudFront --> Lambda aiastra-server-api
   |                                                                   |-- rate limits (memory per instance + DB count)
   |                                                                   |-- DeclinedTopic gate (DB, cached 60 s)
   |                                                                   |-- Bedrock Converse: nvidia.nemotron-super-3-120b
   |                                                                   |-- Postgres: assistant_visits, assistant_questions
   |<-- answer, cookie aa_visit ------------------------------------------|
Daily sweep (existing EventBridge rule) --> retention delete
```

The model runs inside AWS, which the privacy plan requires. The database is on Render, outside AWS, which the privacy
plan already lists as an open point; the IP and user agent columns inherit that. Until the encryption work lands,
`ip` is stored in full for 90 days on the question row and as a `/24` (or `/48` for IPv6) prefix on the visit row.

## 6. Ingredients

| Item | Who |
|---|---|
| Bedrock model access for `nvidia.nemotron-super-3-120b` in us-east-1, and the quota read | Sachin, CloudShell |
| `bedrock:InvokeModel` on the API Lambda role, that model ARN only | Sachin |
| Env: `ASSISTANT_ENABLED=1`, `ASSISTANT_MODEL`, `ASSISTANT_DAILY_CAP=2000`, `ASSISTANT_RETENTION_DAYS=90` | deploy session |
| `CloudFront-Viewer-Country` forwarded (CloudShell step 2) | Sachin |
| Migration `20261103100000_assistant_m1_visits_and_questions` | agent; applied by the deploy session |
| Privacy Policy paragraph and the retention table | agent; Sachin approves the words |
| 40 test questions with expected verdicts, in `tests/fixtures/assistant/` | agent |
| A lawyer's read of "yes" on college and career, under "no advice" | Sachin |

### Tables

```sql
CREATE TABLE assistant_visits (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      text NOT NULL,
  day           date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  ip_prefix     text NOT NULL,            -- /24 or /48
  ip_full       text,                     -- nulled by the retention job after 30 days
  user_agent    text,
  country       text,
  language      text,
  referrer      text,
  landing_path  text,
  user_id       text,                     -- set when the visitor later signs in with the same cookie
  questions     int NOT NULL DEFAULT 0,
  legal_hold    boolean NOT NULL DEFAULT false,
  UNIQUE (visit_id, day)
);
CREATE INDEX ON assistant_visits (ip_prefix, day);
CREATE INDEX ON assistant_visits (first_seen_at);

CREATE TABLE assistant_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id    text NOT NULL,
  asked_at    timestamptz NOT NULL DEFAULT now(),
  ip          text NOT NULL,
  question    text NOT NULL,
  answer      text NOT NULL,
  verdict     text NOT NULL,              -- yes | no | needs_chart | unsure
  outcome     text NOT NULL,              -- answered | declined | scrubbed | limited | failed
  model       text,
  tokens_in   int,
  tokens_out  int,
  latency_ms  int,
  cost_usd    numeric(10,6),
  legal_hold  boolean NOT NULL DEFAULT false
);
CREATE INDEX ON assistant_questions (asked_at);
CREATE INDEX ON assistant_questions (visit_id, asked_at);
```

### What SOC 2 needs from this, and what it does not

SOC 2 does not require collecting IP addresses. It requires that what is collected is listed, protected, limited to a
purpose, kept for a stated time, and that access to it is controlled and logged. So the plan records, in
`docs/security/assistant-log-controls.md`: the purpose (abuse prevention, product questions, security investigation),
the fields, who can read them (Sachin's roles through the admin route, which itself logs each read), the retention
(90 days for questions and full IP, 400 days for the visit row with the prefix only), the erasure route, and the
encryption state. Google Analytics already sends IP and user agent to Google; the privacy plan should decide whether
it stays, since two visit logs is one too many.

## 7. Action steps

1. **Bedrock check** (Sachin, 10 min): request model access for Nemotron 3 Super, read the quota, paste the output.
   Everything else can start before this returns.
2. **Adapter** (agent): lift the Converse call out of `bedrock.ts` into `src/llm/converse.ts` with model fallback and
   the price rows. Tests with a fake client.
3. **Prompt and fixtures** (agent, in parallel with 2): the system prompt, the 40 fixture questions, and the schema.
4. **Migration and store** (agent): the two tables, `recordVisit`, `recordQuestion`, the retention delete.
5. **Route** (agent, after 2 to 4): `POST /api/assistant/ask` with limits, gate, call, check, log. Tests for every
   outcome and the 429s.
6. **Web card** (agent, in parallel with 5): the component, states, tests, two screenshots.
7. **Privacy words** (agent drafts, Sachin approves): one paragraph in the Privacy Policy, the retention table, the
   controls note.
8. **Admin route and erasure** (agent).
9. **Deploy** (deploy session): migration, server with `ASSISTANT_ENABLED=0`, web; then flip the flag on staging; run
   the 40 fixtures against the live route and read the verdicts; fix the prompt until at least 38 match.
10. **Watch** (agent, first week): read `assistant_questions` daily, add new declined topics as they appear.

## 8. Phases

- **Phase 1 (one working day):** steps 2 to 7. Ends with the route and the card on staging behind the flag.
- **Phase 2 (half a day):** steps 8 to 9. Ends with the flag on and 38 of 40 fixtures right.
- **Phase 3 (ongoing):** step 10.

Not before the demo. The demo freeze means none of this ships tomorrow.

## 9. Recommendation

Build it on `nvidia.nemotron-super-3-120b` with `openai.gpt-oss-120b-1:0` as the fallback, both through one Converse
adapter, so the model is one env var. Keep the declined gate in front of the model and a word check behind it, since
the model is open-weight and will sometimes be chatty. Log the full IP for 90 days and a prefix after that, state it
in the Privacy Policy, and decide about Google Analytics in the privacy plan so there is one visit log, not two.

Sources read tonight: the AWS [Nemotron 3 Super 120B model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-nvidia-nemotron-super-3-120b.html),
the [What's New post](https://aws.amazon.com/about-aws/whats-new/2026/03/amazon-bedrock-nemotron-3-super) and the
[Nemotron 3 Nano blog](https://aws.amazon.com/blogs/machine-learning/run-nvidia-nemotron-3-nano-as-a-fully-managed-serverless-model-on-amazon-bedrock).
