# AGENTS.md — how agents work in this repo

Applies to every coding agent (Claude, Fable, Gemini, Cursor, Codex) working on AI Astra.

## Work in parallel by default

Never let one task block the rest of the plan.

0. **Run commands in background mode.** Any command that can take more than a few seconds (tests, `tsc`, builds,
   `prisma generate`, installs, git on large trees, scripts) runs with the agent's background/"run in background"
   option. While it runs, keep working on the next thing that does not need its result; read its output when it
   finishes. Do not sit waiting on a foreground command.

Do not work through a plan one item at a time when its items are independent.

1. **Split first.** When a plan has two or more pieces that do not need each other's results and do not edit the same
   files, start each extra piece as its own background session (or sub-agent) on its own branch/worktree, then do the
   remaining piece yourself. Do not wait for them; keep going.
2. **Unblock yourself.** A blocker that is not a decision only Sachin can make (a missing fixture, a review, a side
   investigation, a doc, a refactor another piece needs) goes to the background too, while you continue with what you can.
3. **Brief it fully.** Each background piece gets: the goal, the files it owns, the files it must not touch, which
   migration number/timestamp it uses, and what "done" is (branch, commit, tests green). Two writers never edit the same
   file; when both need one shared file (e.g. `prisma/schema.prisma`), say where each one appends.
4. **Planning stays planning.** A planning/review session (e.g. Fable on a design doc) only reads code and writes its one
   doc. It does not change code.
5. **Merge is yours.** Background sessions commit on their own branch and stop. The session that started them checks the
   diff, runs tsc and tests, and merges `--no-ff` into `develop`.
6. **Ask only for real decisions.** Production, AWS, database writes, pushes, deletes and money need Sachin's OK
   (through the deploy session for deploys). Everything else, decide and report.

## How a plan is written

A plan is not a list of patches. Before any code, write it under `docs/<topic>/` (or as a numbered doc in an existing
topic folder) and cover, in this order:

1. **Start.** The system as it is today, with the facts checked (code, logs, AWS config, DB), not assumed. Name the
   files, Lambdas, tables and env vars involved, and the symptom each problem shows the user.
2. **End goal.** What the user gets when it is done, stated as behaviour: what they see, how long it takes, what can no
   longer go wrong.
3. **Deliverable.** The exact things that ship: code paths, migrations, infra changes, env vars, docs, tests.
4. **Exactly how it works when done**, one section each for:
   - **Backend:** every flow end to end (request in, work done, state written, response out), with concurrency, limits,
     timeouts, retries and failure handling stated as numbers.
   - **API:** each endpoint, query or event touched: request, response, status codes, errors the client must handle.
   - **Frontend experience:** what each screen does at each state, what it polls or streams, what it shows while
     waiting and when something fails.
   - **UI/UX:** the words on screen, the states (pending, building, ready, failed), timings the user notices.
5. **Architecture.** The components and how they talk (a diagram or a flow list), what runs where (request path, async
   invocation, scheduled sweep, Radha, DB), and what each boundary guarantees.
6. **Ingredients.** Everything the build needs: libraries, env vars, IAM, EventBridge rules, migrations, fixtures, test
   data, and who provides each (agent, deploy session, Sachin).
7. **Action steps in sequence.** Numbered, each with the files it touches, what "done" is, and which steps can run in
   parallel (see "Work in parallel by default").
8. **Development phases.** Group the steps into phases that each leave the system working and shippable, with the
   check that closes each phase (tests, a screenshot, a log line) and what is deferred to the next.
9. **One recommendation.** Where there is a choice, lead with the chosen design and why; alternatives go in a short
   verdict table. Not a menu.

Decide what a staff engineer could decide; ask only for decisions that are Sachin's (production, money, data writes,
product behaviour). The plan is the thing to review; code follows it.

## Branches and checks

- Every feature/fix/docs branch is cut from `develop` and merged back into `develop` with `--no-ff`. `main` gets release
  merges only.
- Before a merge: `npx tsc --noEmit` and the unit tests for the area (`npx vitest run tests/unit/<area>`).
- Dev sessions stop at "committed and merged into local `develop`". Pushing, Lambda deploys and Amplify rebuilds go
  through the deploy session.
- Migrations are written, never applied, without Sachin's explicit OK. Never run terraform.

## Installs and worktree creation go to Haiku

Installing dependencies (server, web, local or in a worktree: `npm ci`, `npm install`, `prisma generate`) and creating
worktrees are done only by a sub-agent on the Haiku model at medium effort, never by the session's own model. Brief it with
the literal folder to work in, because a command run without one lands in the main checkout: on 2026-11-01 an `npm ci` meant
for a worktree rebuilt the main checkout's `node_modules`. The rules under "Worktrees and deletes" apply to it too.

## Worktrees and deletes

On 2026-10-31 a `git worktree add` run with an empty path made git's cleanup delete the contents of the main checkout
(`.git`, `.env`, `docs`, `evals` and more), and unpushed commits were lost. These rules exist so it cannot happen again.

- **Never build a worktree or delete path from a variable, a substitution or a prompt result.** Write the path as a
  literal absolute path, outside every checkout, and print it before the command. An empty or wrong path in
  `git worktree add`, `git worktree remove`, `rm -rf`, `Remove-Item -Recurse`, `Directory.Delete` or `git clean` can
  delete the main checkout.
- **Before `git worktree add`:** the target must not exist, or be an empty directory, and must not be inside a checkout.
  Run `git worktree add <literal-path> -b <branch> <base>` with every argument spelled out, never with an empty string,
  `$VAR`, `$(...)` or `${...}` in the path.
- **After `git worktree add` or `git worktree remove`:** check that the main checkout still has `.git` and `docs`
  (`ls -d <main>/.git <main>/docs`) before doing anything else. If either is missing, stop, run nothing that writes, and
  tell Sachin.
- **Never run `git clean`, `git reset --hard`, `rm -rf` or a recursive delete against the main checkout.** Cleanup is
  only ever of a worktree you created, by its literal path, after its branch is merged.
- **Prefer the app's own worktree isolation** (the session or agent `isolation: worktree` option) over hand-run
  `git worktree` commands.
- **`develop` is pushed after every merge** (through the deploy session, as below), so at most one merge is ever unpushed.
- **`.env` is not in git.** Its values live in the Lambda and Render configuration; keep a copy outside the checkout and
  note where it is in `docs/TODOS.md` without the values.

## Clean up when work is done

- **Branches:** once a feature/fix/docs branch is merged into `develop`, delete it locally (`git branch -d`). Never
  delete `develop`, `main`, release branches, unmerged branches, or remote branches without Sachin's OK.
- **Worktrees:** once a worktree's branch is merged and it has no uncommitted changes, remove it
  (`git worktree remove <path>`). If the folder is held open by a session, archive that session (with Sachin's OK) and
  remove it then.
- **Local servers:** any server or watcher you start for any reason (`npm run dev`, `node server`, `uvicorn`, Vite, test
  watchers) is stopped as soon as the check that needed it is done. Kill the process; do not leave it for later. Before finishing, list what you started and confirm none is still
  running. Never stop processes you did not start.

## File every finding

Any error, bug, risk or issue you find and do not fix on the spot goes in `docs/TODOS.md` before your session ends, or in an
appropriately named doc under `docs/` linked from there. This covers side findings outside your task, failures you worked
around, and things another session told you. Say what is wrong, where, how you know, who holds it, and what done means.
Read `docs/TODOS.md` before starting work in an area. Delete an item when its fix ships. A finding mentioned only in chat is lost.

## Tracking files

- `docs/TODOS.md`: every open finding, by priority (see above).
- `TEST.MD`: tests to perform. Executed tests save screenshots in `docs/screenshots/<folder>/` with sequence-numbered
  names (`01-…png`).
- `QA-LIST.MD`: tested items with their screenshots, for review.
- `AUTO-FIX.MD`: straightforward bugs queued for direct fixing.
- `SLOW-UI.MD`, `SLOW-UX.MD`, `SLOW-AGENTIC-FLOW.MD`: items that need slower review.

## Product rules agents must keep

- Radha (pyjhora, `AIAstra_Radha`) is the only source of astrological data. Node computes nothing astrological.
- English only for now.
- Declined topics (`declined_topics` table, docs/reading-engine/18) are never facilitated or passed to any agent.
- Never print secrets.
- **Never output internal engine/library names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) in any reading, report, or user-facing response.** All agents and LLM system prompts must enforce this rule (see `SOUL.md`).
- Read and follow `SOUL.md` for all astrological reading synthesis, anti-sycophancy claim verification, and 4-tier (`Sattvic / Rajasic / Mediocre / Baseline`) behavioral playbooks.
