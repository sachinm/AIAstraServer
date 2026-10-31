# CLAUDE.md

Read and follow `AGENTS.md`. It holds the rules for every agent in this repo. Three you must not miss:

- **File every finding.** Any error, bug or issue you find and do not fix on the spot goes in `docs/TODOS.md` before your
  session ends. Read that file before starting work in an area.
- **Radha is the only source of astrological data.** Node computes nothing astrological, not even a lookup.
- **Worktree and delete commands take literal paths only.** Never run `git worktree add`, `git worktree remove`,
  `rm -rf`, `Remove-Item -Recurse` or `git clean` with a variable, a substitution or an empty path, and check that the
  main checkout still has `.git` and `docs` afterwards. On 2026-10-31 a `git worktree add` with an empty path deleted
  the main checkout.
