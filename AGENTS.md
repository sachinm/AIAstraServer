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

## Branches and checks

- Every feature/fix/docs branch is cut from `develop` and merged back into `develop` with `--no-ff`. `main` gets release
  merges only.
- Before a merge: `npx tsc --noEmit` and the unit tests for the area (`npx vitest run tests/unit/<area>`).
- Dev sessions stop at "committed and merged into local `develop`". Lambda deploys and Amplify rebuilds go through the
  deploy session.
- **Push `develop` after every merge** so that at most one merge is ever unpushed. Local-only history is one bad command
  from gone (2026-10-31: 13 unpushed commits were lost with the checkout).
- Migrations are written, never applied, without Sachin's explicit OK. Never run terraform.

### Worktrees and deletes

On 2026-10-31 a `git worktree add` with an empty path made git's cleanup delete the main checkout: `.git`, `.env`,
`docs`, `evals`, `AGENTS.md` and everything sorting before `node_modules`. These rules exist so it cannot happen again.

- **Never build a worktree or delete path from a variable, a substitution or a prompt result.** Write the path as a
  literal absolute path, outside every checkout, and print it before the command. An empty or wrong path in
  `git worktree add`, `git worktree remove`, `rm -rf`, `Remove-Item -Recurse`, `Directory.Delete` or `git clean` can
  delete the main checkout.
- **Before `git worktree add`:** the target must not exist, or be an empty directory, and must not be inside a checkout.
  Run `git worktree add <literal-path> -b <branch> <base>` with every argument spelled out. Never run it with an empty
  string, `$VAR`, `$(...)` or `${...}` in the path.
- **After `git worktree add` or `git worktree remove`:** check that the main checkout still has `.git` and `docs` (for
  example `ls -d <main>/.git <main>/docs`) before doing anything else. If either is missing, stop, run nothing that
  writes, and tell Sachin.
- **Never run `git clean`, `git reset --hard`, `rm -rf` or a recursive delete against the main checkout.** Cleanup is
  only ever of a worktree you created, by its literal path, after its branch is merged.
- **Prefer the app's own worktree isolation** (the session or agent `isolation: worktree` option) over hand-run
  `git worktree` commands.
- **`.env` is not in git.** Keep a copy of its values outside the checkout, in the password manager, and note where it is
  in `docs/TODOS.md` without the values.

## File every finding

- Every error, bug, risk or finding you do not fix on the spot goes in `docs/TODOS.md` before your session ends, or in a
  named doc under `docs/` linked from it. That includes side findings, failures you worked around, and things another
  session told you.
- Each item says what is wrong, where, how you know, who holds it, and what done means, with a priority P0 to P3.
- Read `docs/TODOS.md` before working in an area. Delete an item when its fix ships, and say where the fix went in the
  commit.

## Clean up when work is done

- **Branches:** once a feature/fix/docs branch is merged into `develop`, delete it locally (`git branch -d`). Never
  delete `develop`, `main`, release branches, unmerged branches, or remote branches without Sachin's OK.
- **Worktrees:** once a worktree's branch is merged and it has no uncommitted changes, remove it
  (`git worktree remove <literal-path>`). If the folder is held open by a session, archive that session (with Sachin's
  OK) and remove it then.
- **Local servers:** any server or watcher you start (`npm run dev`, `node server`, `uvicorn`, Vite, test watchers) is
  stopped as soon as the check that needed it is done. Before finishing, list what you started and confirm none is still
  running. Never stop processes you did not start.

## Tracking files

- `docs/TODOS.md`: every open finding (see "File every finding").
- `TEST.MD`: tests to perform. Executed tests save screenshots in `docs/screenshots/<folder>/` with sequence-numbered
  names (`01-…png`).
- `QA-LIST.MD`: tested items with their screenshots, for review.
- `AUTO-FIX.MD`: straightforward bugs queued for direct fixing.
- `SLOW-UI.MD`, `SLOW-UX.MD`, `SLOW-AGENTIC-FLOW.MD`: items that need slower review.

## Product rules agents must keep

- Radha (pyjhora, `AIAstra_Radha`) is the only source of astrological data. Node computes nothing astrological, and
  never derives a house: natal and transit houses come from Radha's own answers (`transit_range`, the per-kundli
  overlays), never from a sign-index lookup.
- English only for now.
- Declined topics (`declined_topics` table, docs/reading-engine/18) are never facilitated or passed to any agent.
- Never print secrets.
