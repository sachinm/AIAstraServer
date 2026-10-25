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
