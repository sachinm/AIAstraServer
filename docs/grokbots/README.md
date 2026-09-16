# Grok bots — AI Astra Server

**READ THIS FILE FIRST** before any eng/ops work on this repo.

## Purpose
How Narayan, Lakshmi, and project bots (especially Astra) plan, execute, test, and record learnings for `sachinm/AIAstraServer` so we do not repeat mistakes across projects.

## Canonical locations
- KING-SM disk: `C:\Users\Sachin\Documents\work\AdAstra_Server`
- GitHub: https://github.com/sachinm/AIAstraServer
- Related: Amplify web (AIAstraWeb), calc Lambda `aiastra-pyjhora` (AIAstraRadha), Render Postgres (pooler `:6432`)

## Methodology (every step)
1. State the **planned goal** this work advances.
2. For each step: how it gets us closer; **what** we test; **how** we test; is this the **best approach**?
3. After: **success or mistake** — write learnings into `docs/grokbots/` (this README index, `plan-*/README.md`, `SKILLS.md`).
4. Fail-fast: concrete plan before long runs; surface hangs/blocks in ~15–20s; no blind retries without a revised plan.
5. Hard rules: no secrets in chat; on-demand cloud agents off unless Sachin enables; prefer KING-SM; Amplify GraphQL stays on CloudFront (do not retarget to Render from web-env dumps).

## Plan index
| Plan | Folder | Status |
|------|--------|--------|
| Phase 2 Amplify?CF?Lambda | [plan-phase2-cf-lambda](./plan-phase2-cf-lambda/README.md) | Complete (App Runner retired) |
| Phase A chat latency / quality | [plan-phase-a-chat-latency](./plan-phase-a-chat-latency/README.md) | **GREEN** (~21s @ thinkingBudget 512; cache held)

## Skills
Reusable lessons: [SKILLS.md](./SKILLS.md)
