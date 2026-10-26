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

Life-timeline ledger P0 (server `feature/timeline-p0-ledger`, web `feature/timeline-p0-ledger`). Blocked until migration
`20261027100000_timeline_m14_ledger_and_builds` is applied (Sachin's OK) and `TIMELINE_ENABLED=1`; unit tests cover the logic meanwhile
(`npx vitest run tests/unit/reading/timeline/ledger`).

| Id | Test | Steps | Expected | Folder |
|---|---|---|---|---|
| TL-P0-01 | Ledger: 20 events | Sign in, open /timeline/ledger, add 20 events across markers with day, month and year precision and attributes (colour, make, direction, floor, field, country, outcome, with whom) | All 20 listed in date order and placed on the 18-year strip; edit and delete work; another user's row is never visible | `docs/screenshots/timeline-p0-ledger/` |
| TL-P0-02 | Ledger interview | Type "In June 2014 I moved to Pune and bought a white Honda" (year 2014), confirm one proposal, skip the other | Two proposals; only the confirmed one is stored; no evaluation words anywhere | `docs/screenshots/timeline-p0-ledger/` |
| TL-P0-03 | Interview declined | Type a declined-topic sentence | The fixed reply only, no proposals, no model call (server log) | `docs/screenshots/timeline-p0-ledger/` |
| TL-P0-04 | Flag off | `TIMELINE_ENABLED` unset | `/api/timeline/ledger/meta` 404; the web hides the page and link | `docs/screenshots/timeline-p0-ledger/` |
