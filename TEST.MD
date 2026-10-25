# TEST.MD — tests to perform for the work in progress

Workflow: every test has an id, steps, expected result and a screenshot folder under `docs/screenshots/<folder>/`.
UI tests save PNGs named `NN-<step>.png` (zero padded, replayable in order) taken in the built-in browser; API and CLI tests save
`NN-<step>.json` or `.txt` in the same folder. When a test has been executed it moves to `QA-LIST.MD` with links to its evidence.
Bugs go to `AUTO-FIX.MD` (straightforward) or `SLOW-UI.MD` / `SLOW-UX.MD` / `SLOW-AGENTIC-FLOW.MD` (needs slower review).

Branches: server `feature/reading-phase1-engine`, web `feature/reading-phase1-stages` (Phase 1 of `docs/reading-engine/08-rollout.md`).
Stand-ins: no database, AWS credentials or Gemini key exist on this machine, and the pyjhora Lambda does not serve `facts` / `transits`
yet (Sachin: do not touch the Python for now). Tests therefore use the golden chart G1 fixtures and a local fake Gemini; real-model
quality tests are listed as blocked in `QA-LIST.MD` with the exact command to run later.

## Pending

(none: P1-01 to P1-12 are in QA-LIST.MD)

| Id | Test | Steps | Expected | Folder |
|---|---|---|---|---|
