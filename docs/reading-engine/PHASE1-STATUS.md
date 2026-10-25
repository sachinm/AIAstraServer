# Phase 1 status — dossier and grounded single call

**Date:** 2026-10-24. **Branches:** server `feature/reading-phase1-engine`, web `feature/reading-phase1-stages`, both merged into local `develop` (not pushed). Radha has no commits (see "Python").

## Summary

The pipeline for Phase 1 is built and tested end to end on this machine against the golden chart G1 fixtures and a local fake Gemini. The gates that need a real model, the database or the Lambda cannot be passed from here. They are listed under "Blocked", each with the command to run.

**Update 2026-10-25 (Sachin: "we must use the new chat path no matter what").** The reading engine is now the chat path by default (`READING_ENGINE=0` is the kill switch). Legacy fallback is opt-in only (`READING_FALLBACK_LEGACY=1`). A kundli with no dossier gets a plain "your chart is still being prepared" answer on the new path, and its build is scheduled.

- **24 of 25 existing kundlis have dossiers and transit charts** in the live database. They were computed by pyjhora locally through the parked drafts (`scripts/backfill-local-facts.ts` plus `drafts/radha/build_from_inputs.py`) and cross-checked against each kundli's stored D-1 (QA-LIST P1-14).
- **The 25th kundli** never finished its original sync, so it has nothing to read from on either path.
- **New kundlis** need the Lambda `facts` / `transits` exports (contract in 09-lambda-contract.md), or a rerun of the local backfill, before they can be read.
- **Production** still runs the previous server image. The new path reaches users only after this code is pushed and the "Deploy API Lambda (OIDC)" workflow is run.

## What shipped

**Server**

- Contract and validation: `facts.v1` and `transits.v1` JSON schemas, loaded with ajv, and the Lambda brief in [09-lambda-contract.md](./09-lambda-contract.md).
- Data layer: Lambda client for `facts` and `transits`, database store, in-process cache (5 minutes), prefetch in parallel with intake, lazy transit build with an 8 second timeout, a facts build after each kundli sync, and a backfill script.
- Migrations M1 to M4: coordinates and facts status on kundlis, `kundli_facts`, `transit_snapshots`, `reading_runs`. Applied to the live Render database on 2026-10-24 with Sachin's approval and verified (QA-LIST P1-13).
- Evidence packs: 15 subject frames, selector with sections in cache order, transit selection and clipping, current dasha re-selected by date.
- Intake: rules first (about 0 ms), model only when unsure, fixed reply for self-harm questions.
- Orchestrator: `single` flow (default, one streamed call) and `graph` flow (parallel promise, dasha, transit and nakshatra specialists, a reconcile step, then a streamed synthesis). Fast lane for short yes/no questions.
- Chat wiring: `READING_ENGINE=1` routes the Gemini chat provider to the new engine; `0` keeps the legacy path. Progress events go out over the existing SSE stream. `reading_runs` stores the pack hash, timings, tokens and findings, not raw chart JSON.
- Prompts: persona, method, intake, specialists, synthesis and five answer formats, embedded into `generated.ts` at build time. A test fails if the embedded copy is stale.
- Grounding checker and the eval harness: 12 golden questions, report under `evals/reports/<date>/`, legacy token baseline estimated offline.

**Web**

- The understanding line and stage pills under the answer, driven by the new SSE events. Legacy servers send no events and the screen is unchanged.
- Removed one redundant `meDetails` round trip before every ask.

## Measured here

Token estimates use characters divided by 3.6 on both sides.

| Item | Value |
|---|---|
| Single-subject evidence pack | about 4.0k to 4.2k tokens |
| Whole dossier | about 16.1k tokens |
| Legacy prompt, lean mode | about 6.6k tokens |
| Legacy prompt, full mode | about 19.2k tokens |
| Cacheable base chart plus method and persona | about 1.7k plus 1.4k tokens, byte-identical across questions |
| Progress to the browser | about 0.2 s (fake model) |

Latency and cost against a real model were not measured. The fake model's timings say nothing about Gemini.

## Gate status (08-rollout.md, Phase 1)

| Gate | Status |
|---|---|
| Prose-grounding `contradicted = 0` on G1 | blocked: needs a real model's answers |
| Q2, Q8, Q9 cite the varga | blocked: same; the pack for each carries the varga facts (see `p1-02-pack-sizes`) |
| Q5 answers from the transit table | blocked: same; the pack carries the transit rows |
| Input tokens down 50 percent or more | pack is 72 percent smaller than the legacy full prompt and 38 percent smaller than lean, by estimate; model-reported numbers blocked |
| p50 latency not worse than baseline | blocked: no baseline, no key |
| `npx tsc --noEmit` clean | met |
| Production flag flip | not done, by design |
| Migrations on the live database | done 2026-10-24 (QA-LIST P1-13) |

## Blocked, and what unblocks it

| Blocked | Needs | Command |
|---|---|---|
| Real-model eval of the 12 questions | `GEMINI_API_KEY` in `.env`; free tier allows about 20 calls a day | `npm run eval:readings -- --engine phase1 --questions Q2,Q8,Q9`, then all 12 |
| Baseline on the legacy path | database and `.env` | `npm run eval:readings -- --engine current` |
| Real `kundli_facts` and transit builds | the Lambda serving `facts` and `transits` | `npm run facts:backfill`, `npm run transits:build` |
| Gemini billing | Sachin to confirm; Phase 1 uses `gemini-2.5-flash` | none |
| Pushing, AWS, Terraform | Sachin | none |

## Python (Radha)

Sachin asked that the Python service not be touched for now, and that nothing astrological be computed in Node. The server therefore only consumes `facts` and `transits` from the Lambda. [09-lambda-contract.md](./09-lambda-contract.md) is the brief for the later pass, and the stand-in drafts under `drafts/radha/` produced the G1 fixtures (Lahiri ayanamsa, the one the server requests). The Node-side compute experiment is parked in `drafts/node-compute-parked/`.

## Decisions

- Node computes nothing. The Lambda returns every dossier fact and a transit chart per kundli.
- The transit chart is per kundli with natal overlay (`natal_overlay` v1), not a global snapshot joined in Node. M3 has a nullable `kundli_id` so a global snapshot is still possible.
- Default flow is `single`. The graph is built and tested but off, since it needs 4 to 6 model calls per question and the free tier allows about 20 a day. Choose after measuring on a paid key.
- Intake is rules first. `READING_INTAKE_MODE=auto|rules|llm`.
- The persona comes from a file, not the database row, because that row changes daily and would break the cache prefix. `READING_USE_DB_PERSONA` re-enables it.
- The reading engine is the default chat path; fallback to legacy is an emergency opt-in (`READING_FALLBACK_LEGACY=1`). Changed 2026-10-25 at Sachin's request; previously the fallback was on.
- The facts build after sync follows `READING_ENGINE` unless `READING_FACTS_BUILD` is set.
- The grounding checker is regex based and conservative: mixed natal and transit sentences and unknown vargas are reported as unverifiable, never as contradicted. Table cells under a "Transit" header count as transit statements.
- Fixtures use Lahiri. Dasha boundaries can differ by about four days from JHora's true-Citra defaults.
- Not built yet: follow-up history in intake, the clarify card, explicit Gemini cache. They are listed in the SLOW queues.

## Known open items

- `AUTO-FIX.MD` AF-08: 20 existing TypeScript errors in the web repo under the app tsconfig, hidden by `vite build`.
- `AUTO-FIX.MD` AF-10: one timing test can flake under heavy CPU load.
- Unit tests on `develop` had 9 failures before this work (`astroKundliClient`, `env`, `env.chatProvider`, `geminiChatService`). They still fail and are unrelated.
- Slow review queues: `SLOW-UI.MD`, `SLOW-UX.MD`, `SLOW-AGENTIC-FLOW.MD`.

## Evidence

All tests and their evidence are in `QA-LIST.MD`. Screenshots and outputs are under `docs/screenshots/p1-*`.
