# CLAUDE.md

Read and follow `AGENTS.md`. It holds the rules for every agent in this repo. Three you must not miss:

- **File every finding.** Any error, bug or issue you find and do not fix on the spot goes in `docs/TODOS.md` before your
  session ends. Read that file before starting work in an area.
- **Radha is the only source of astrological data.** Node computes nothing astrological, not even a lookup.
- **Worktree and delete commands take literal paths only.** Never run `git worktree add`, `git worktree remove`,
  `rm -rf`, `Remove-Item -Recurse` or `git clean` with a variable, a substitution or an empty path, and check that the
  main checkout still has `.git` and `docs` afterwards. On 2026-10-31 a `git worktree add` with an empty path deleted
  the main checkout.
- **Never say or output `Radha` or `pyjhora` anywhere in readings, reports, or user-facing responses.** Read and follow `SOUL.md` alongside `AGENTS.md`; this prohibition is also hardcoded in the system prompt sent to every agent.
- **Installs and worktree creation go to Haiku at medium effort.** Dependency installs (server, web, local, worktree) and
  creating worktrees are done only by a Haiku sub-agent at medium effort, given the literal folder. See `AGENTS.md`.
- **Kill any local server you started** (Node or otherwise) as soon as the work that needed it is done.
- **Plans cover the whole thing before code.** Any plan goes under `docs/` and follows "How a plan is written" in
  `AGENTS.md`: start (facts checked), end goal, deliverable, exactly how backend / API / frontend / UI-UX work when done,
  architecture, ingredients, numbered action steps in sequence, development phases, one recommendation. Not a list of
  patches.
