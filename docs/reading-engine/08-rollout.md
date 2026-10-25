# 08 — Rollout

Each phase ships behind a flag, has a gate, and leaves the previous path working. Estimates assume one engineer plus agent assistance and the 1–2 minute step discipline from the operating rules.

## Phase 0 — Consolidate and unblock (2–3 days)

Goal: a `main` that is the live code, with reproducible deploys.

1. **Server**: `develop` created on 2026-10-24 from `origin/feature/gemini-context-cache` (the live code; it contains the other server feature branches). Not yet pushed. `main` stays as is until a release merge `develop → main`, tagged `v0.2.0-live`.
2. **Web**: create `develop` from `origin/feature/turnstile_iPhone` (same tip as `cf-oac-api-headers`).
3. **Radha**: create `develop` from `origin/feature/add_divisional_charts`.
4. **Find and commit the API Lambda packaging** (RESPONSE_STREAM handler or web-adapter Dockerfile) — see file 06 §3. Until this is in the repo, every later phase deploys by hand.
5. **Gemini billing**: confirm paid tier is active on the project key in `aiastra/chat-llm`; without it the 3.x/4 models and cache are rate-limited or unavailable. If still free tier, Phase 1 runs on `gemini-2.5-flash`.
6. **Baseline evals** (file 07 §5) on the live path.

Gate: `main` builds, `npm run test:unit` green, one manual end-to-end chat on production through CloudFront, baseline report stored.

## Phase 1 — Dossier and grounded single call (about 1 week)

Goal: remove the "model computes" problem and the D-1 bias with the least code, prove the dossier.

| Day | Work |
|---|---|
| 1–3 | Radha: `facts`, `transits`, `natal_points` export types; golden snapshot test; timing test; Lambda image + deploy. |
| 2–3 | Server: migrations M1–M3; `kundli_facts` build in the sync path; transit snapshot builder + daily rule; backfill script; coordinates stored once. |
| 3–4 | Server: `packs/frames.ts`, `packs/selector.ts`, `packs/transitTable.ts` with unit tests; `intake` node alone (used only to pick subject/horizon/format, no clarify yet). |
| 4–5 | Server: `READING_ENGINE=1` routes `chatWithGemini` to: intake → pack (promise+dasha+transit+nakshatra sections for the subject) → one call on the current chat model with `method.md` + format prompt. Request payload logged is the pack, not raw JSON. |
| 5 | Evals: 12 questions on G1 + panel; compare with baseline. |

Gate: prose-grounding `contradicted = 0` on G1; Q2/Q8/Q9 cite the varga; Q5 answers from the transit table; input tokens down ≥ 50 %; p50 latency not worse than baseline. Flip `READING_ENGINE=1` in production.

## Phase 2 — The graph (about 2 weeks)

Goal: parallel specialists, structured findings, reasoning synthesizer, run logging, visible pipeline.

| Week | Work |
|---|---|
| 1 | `state.ts`, `graph.ts`, four specialist nodes with schemas and prompts, `reconcile` (gate + window algebra + agreement), `synthesize` on argon with streaming, `persist` + migration M4, `stage` events in SSE, web stage chips. Groq fallback for specialists. |
| 2 | Fast lane; model matrix via env; cost accounting; admin `adminReadingRuns/Stats`; prose-grounding checker as a post-step; CloudWatch metric filters; load test 20 concurrent readings against staging env of the Lambda (`NODE_ENV=staging` is the live Lambda value, note the inventory caveat). |

Gate: evals green per file 07 §4; p50 complete ≤ 40 s, first token ≤ 15 s; cost ≤ $0.12 per full reading; no regression on GraphQL `ask`. Enable for all users (the kill switch `READING_ENGINE=0` restores Phase 1 behaviour).

## Phase 3 — Clarify step, formats, nakshatra depth (about 1 week)

1. Postgres checkpointer (M6), `interrupt` in `intake→clarify`, `POST /api/chat/confirm`, CloudFront behaviour, web clarify card with chips and follow-up chips; eager `prepare` during the wait.
2. `READING_CLARIFY_MODE=when_ambiguous` in production; `always` available per user later as a preference.
3. Nakshatra analyst at full depth (eight layers), Q6 to rubric ≥ 4.5; format files finalised with Sachin reviewing one example per format.
4. Chat metadata (M5): subject tags and last activity for the sidebar.

Gate: Q12 triggers the card and completes after confirm; abandoned runs expire; rubric mean ≥ 4.0.

## Phase 4 — Tune and harden (ongoing, first pass 1 week)

- Explicit per-user cache on `gemini-3.8-flash` (lazy, second question in 24 h) once billing is paid; measure hit rate; keep or drop based on cost.
- Try `gemini-3.5-flash-lite` for specialists; keep if grounding and rubric hold.
- Remove `CHAT_KUNDLI_CONTEXT` and the raw-JSON path; Charts page reads `kundli_facts`.
- Retention jobs; per-user daily budget; provisioned concurrency decision from cold-start data.
- Terraform: fill module stubs for the new resources (no apply without Sachin).
- Vedha, eclipses, D-30/D-24/D-20 subjects as config rows when a question class needs them.

## Phase 5 — Options, not commitments

- Tool-calling specialists that can ask the Python engine ad-hoc questions ("what if the birth time is 15 minutes later") for rectification-style conversations.
- Varshaphal (Tajaka) analyst using pyjhora `tajaka.annual_chart` for "this year" questions.
- Cross-chat memory: subject tags + last answers summarised into intake context.
- Human astrologer hand-off: the `reading_runs` brief is already the case file.

## Branch and PR conventions

- Every branch (docs, feature, fix) is cut from `develop` and merged back into `develop`. `main` only receives release merges from `develop`.
- One PR per numbered item above, into `develop`, with the eval report attached for anything touching prompts, packs, models or the dossier.
- Branch names: `docs/<topic>`, `feature/<topic>`, and for this plan `feature/reading-phase1-dossier`, `feature/reading-phase2-graph`, `feature/reading-phase3-clarify`, matching across the three repos.
- `pnpm.cmd check`/`npm run typecheck` and unit tests before merge; evals before enabling a flag in production.
- Every production flag flip is a line in `docs/grokbots/SKILLS.md` style: what, when, measured result.

## Risks and what we do about them

| Risk | Mitigation |
|---|---|
| Gemini 4 Argon has no explicit caching; prices shift Dec 2026 / Jan 2027 | Synth prefix kept small and stable; model ids are env; cost accounted per run so a switch to 3.8-flash synth is a config change |
| pyjhora `facts` slower than expected on Lambda | Profile; raise memory to 3008 MB; cache the `Horoscope` object across sections; worst case split vargas into a second invoke |
| Specialists hallucinate ids | Grounding gate drops them; `droppedClaims` is tracked; prompt tightened; schema enum of allowed id prefixes |
| Synth invents a placement anyway | Prose checker logs it in v1; v2 blocks and asks for a one-shot rewrite with the contradiction listed |
| Lambda packaging not found | Phase 0 item 4 is a hard blocker; rebuild from the ECR image config if the source is gone |
| Free tier still | Phase 1 works on 2.5-flash with the dossier; Phase 2 waits for billing |
| Render Postgres connection limit (1 per Lambda) | Checkpointer and Prisma share the pool; keep the checkpointer writes to two per run; move to RDS only if measurements say so |
