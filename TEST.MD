# TEST.MD — tests to perform for the work in progress

Workflow: every test here has an id, steps, expected result and a screenshot folder under
`docs/screenshots/<folder>/`. UI tests save PNGs (`01-login.png`, `02-ask-career.png`, …) from the
built-in browser; API/CLI-only tests save `NN-<step>.json` (or `.txt` for CLI output) in the same folder.
Once a test has been executed it moves to `QA-LIST.MD` with links to its evidence. Bugs found go to
`AUTO-FIX.MD` (straightforward) or `SLOW-UI.MD` / `SLOW-UX.MD` / `SLOW-AGENTIC-FLOW.MD` (needs slower review).

Branch: `feature/reading-phase0-baseline` (Phase 0 of `docs/reading-engine/08-rollout.md`).

## Pending

| Id | Test | Steps | Expected | Folder |
|---|---|---|---|---|
| P0-03 | Baseline evals on the current chat path (07-evaluation §5) | 1. `.env` with `DATABASE_URL`, `GEMINI_API_KEY` present. 2. `npm run eval:readings -- --chart G1 --engine current`. 3. Store answers + grounding under `evals/baseline/`. | 12 answers stored, grounding report written | `p0-03-baseline-evals` |
