# QA-LIST.MD — executed tests, ready for QA

Each row links to the evidence under `docs/screenshots/<folder>/`. QA reviews from four perspectives:
**UI/UX**, **response quality**, **response format**, **accuracy against the chart facts**.
Status: `pass` | `fail` | `blocked` (reason given; re-run when unblocked).

| Id | Test | Status | Evidence | Notes |
|---|---|---|---|---|
| P0-01 | `develop` branches exist in web and Radha, cut from the live feature branches | pass | [01-web](docs/screenshots/p0-01-develop-branches/01-web-develop-branch.txt), [02-radha](docs/screenshots/p0-01-develop-branches/02-radha-develop-branch.txt), [03-server](docs/screenshots/p0-01-develop-branches/03-server-develop-branch.txt) | Web `develop` = `origin/feature/turnstile_iPhone` (0bdc4d4); Radha `develop` = `origin/feature/add_divisional_charts` (f1b57c4); server `develop` = 326349b. Not pushed. |
| P0-02 | Server `develop` typechecks and builds | pass | [01-tsc](docs/screenshots/p0-02-server-build/01-tsc-noemit.txt), [02-build](docs/screenshots/p0-02-server-build/02-npm-run-build.txt) | `npx tsc --noEmit` clean; `npm run build` emits `dist/server.js`. Unit tests on `develop` have 9 pre-existing stale-expectation failures (`astroKundliClient`, `env`, `env.chatProvider`, `geminiChatService`), not regressions. |
| P0-03 | Baseline evals on the current chat path (07-evaluation §5) | blocked | [README](evals/baseline/README.md) | No `.env` (DB, Gemini key) on this machine; command to run once present is in the README. Re-run and replace this row. |
