# Handoff, 2026-11-07 night: Techniques Lab, the three dashboards, the Oracle

Written because quota is running out. Pick up from "Next actions" in order. Sachin's words are quoted where they decide
something.

## What Sachin asked for tonight

1. Verify, in the admin he is signed into (https://admin.vedic-astrology.app, role `admin`), that the techniques behind the
   Self, Love and Work dashboards are listed and run, on a real account, and find the bugs.
2. The techniques must be run by AI: sub-agents per chart family (D1, vargas, dashas, Tithi Pravesha, transits) with a
   precise job (afflictions, malefics, what delays or delivers the running mahadasha's promise for the self), minimal
   strict outputs, passed to lineman agents, then to the synthesizer, "the Vedic Astrological Oracle".
3. Know the cost of every dashboard load: which agents, how many, total. Cache everything: immutable data (D1 to D144,
   yogas, the dasha calendar) versus time-sliced data (running periods, the annual chart, transits). Pre-format each
   sub-agent's data once and put it in the LLM cache. Run each common technique once per window, never twice per load.
4. Name the synthesizer types (one for all boards, one per board, or one per tab or area) and build a workbench to "train
   one-on-one with the Oracle": its system prompt, tone, depth, how it handles every kind of problem, mood, mind, body and
   soul, and whether it reads strictly by Parashara and Jaimini, with every ingredient fed to it visible.
5. A staging side of the Techniques Lab that creates people or AI focus groups, hydrates real engine data, builds the
   per-sub-agent snippets and runs the boards. The current Research Lab is template text (filed).
6. Later phase: day-to-day changes (pratyantar, sookshma, hora), doc 60 section 11.
7. Decisions Sachin made tonight:
   - The lab is DEV/QA: "all data is for testing/training purposes can be used". List every account with a birth chart,
     no consent flag. The admin role may run.
   - The lab must show the person's date, time and place of birth: "this is admin we're testing".
   - Live engine calls are fine: "I'm giving the okay - just run it by me".
   - Opus tests and reviews; Fable writes the comprehensive plan.

## What is true now (checked)

| Item | State |
|---|---|
| Server `develop` | Local head after this doc; staging runs 46c241c (RC e3ff9f6): You reading docs 58 to 62, purview, dossier, cards, body panel, code auditor, `/api/admin-lab/*`, QA rule (every unlocked account with a kundli) |
| Admin `develop` | ceea3b8, live on staging (RC 7196b91): QA banner, 32 people listed, admin may run, only `self.reading.*` panels offered |
| Staging env | `ADMIN_LAB=1` and `ADMIN_LAB_TOKEN` on `aiastra-server-api`; `AIASTRA_SERVER_BASE` and `ADMIN_LAB_TOKEN` on `aiadastra-admin-api`; secret `aiastra/admin-lab-token`. Model layer off (`SELF_READING_MODEL` unset) |
| Lab in the browser | Page loads and the people list works. **Every lab call to the server fails**: `/api/admin/lab/dossiers` returns 503 "The reading server refused the lab token". Header names match in code (`x-admin-lab-token`). Likely cause: the API's CloudFront (dzsm2dbswvuqy) does not forward that custom header, or the two Lambdas hold different token values. Sent to the "Deploy API Lambda with new chat path" session, which owns AWS; no answer yet |
| WIP branch | Server `feat/admin-lab-person-birth` (38dc3b8, not merged): `GET /api/admin-lab/people/:userId` returns name, date, time and place of birth, city, country, kundli id, digest status and clock. The Prisma PII extension opens the sealed fields; the admin API cannot decrypt them itself |
| Fable plan | A Fable background agent was writing `docs/reading-engine/63-dashboard-oracle-and-machinery-plan.md` from requirements 2 to 8 and every finding below. It had not appeared on disk when this was written. If it is still missing, rewrite it from this handoff |

## Findings (all filed in `docs/TODOS.md`, sections dated 2026-11-07)

- **No AI runs on any dashboard.** Every board is deterministic code, and the cost per load is $0.
  - `self.reading.oracle` (the R15 reader plus `oracle/self.md`) exists but is never called. It has no run or cost
    tracking and no response schema.
  - It cannot hit the prompt cache: the prompts are under the 1k-token minimum and `TODAY` sits early in the BRIEF.
  - It asks for 450 to 700 words of prose, which contradicts doc 61's dated cards.
  - Estimated cost once on: about 15k input and 3k to 4.5k output tokens per build, about $0.015 on Flash and $0.06 on
    Pro. Pro is missing from `PRICES`, so its cost would be recorded as $0.
  - R15 is thin on Parashari lordship and Jaimini rules.
- **Wrong headline (P1).** The old You board on Sachin's kundli says "open / likely" ("A clear stretch for a fresh start"),
  while the main clock and his Dwisaptati clock both vote test. `presentTone` (`houseLayers.ts:754-760`) lets the rasi,
  karaka and annual votes outvote them.
- **Slow loads.** The You reading takes 2.3 to 4.9 s even fully cached, because each load makes about ten serial database
  trips and nine `agent_runs` inserts. The old You board takes 4.9 s, Love 3.0 s, and Work 8.1 s, including a live engine
  pull of transit contacts, which Sachin says is fine.
- **Cache bugs.**
  - The 45-minute recycler deletes immutable natal outputs.
  - A new Tithi Pravesha year does not refresh the year panel.
  - The body panel's cache key ignores the sky overlay.
  - Lab force runs never write the store.
  - The cached dossier id is simply the newest of any scope.
- **Run records.** Clock, purview and audit run outside `withAgentRun` and `withTechniqueOutput`, so the admin shows 0
  runs for them.
- **Headers versus lines.** The struggle panel says "6 things" over 5 lines because it counts before the purview veto. The
  yogas header and its card disagree the same way.
- **Data.** Sachin's kundli (c584c0a3) has no stored sky overlay, so the body panel is partial.
- **Admin.** Research Lab runs are synthesized templates, and the Techniques page lists Lucky-times techniques under Self,
  Love and Work.
- Love and Work reading panels (doc 59) are catalogue rows only.

## Update, 2026-11-08 early: what is pending

Done since this was written:
- **Lab token (action 1) is fixed.** The deploy session added `X-Admin-Lab-Token` to CloudFront origin request policy
  e1684868 (staging API distribution E3UPJNUU8APCT only), on Sachin's yes. Both Lambdas and the secret held the same token
  and `AIASTRA_SERVER_BASE` was correct. Verified: `/api/admin-lab/people` returns 200 with the token, 403 without.
- Another session has since moved develop on (self-oracle family readers in parallel, a `BUILD-GAPS.MD` queue). Read
  `git log` and BUILD-GAPS.MD before starting; some items below may already be done.

Pending:
1. **Browser retest of the lab.** Blocked only on Sachin signing in again: the browser pane reopened and lost the admin
   sign-in (kept per tab). Then pick his account and open the stored builds; a run may make a live engine call for the sky
   overlay, which he approved.
2. **Birth details in the lab.** Server branch `feat/admin-lab-person-birth` (38dc3b8) is unmerged and needs a unit test,
   the admin proxy, page fields and the docs/01 privacy note (action 2 below).
3. **Fable plan, doc 63.** The agent stopped on the usage limit before saving the file. Rerun it from this handoff.
4. Actions 3 to 6 below, unchanged.

## Next actions, in order

1. **Get the lab token through.** This is the deploy session's job, since it needs AWS.
   - Check `AIASTRA_SERVER_BASE` on `aiadastra-admin-api`.
   - Check that the API CloudFront origin request policy forwards `x-admin-lab-token`.
   - Compare the SHA-256 of both token values, without printing them.
   - Verify that a token-bearing `GET /api/admin-lab/people` returns 200.
2. **Finish birth details in the lab** (Sachin's request).
   - Server: add a unit test for `GET /api/admin-lab/people/:userId` in `tests/unit/reading/self/adminLab.test.ts`, then
     merge `feat/admin-lab-person-birth` with `--no-ff`.
   - Admin API: add a `serverClient.getPerson` method, a `GET /lab/people/:id` route and a `LabPersonDetail` contract type.
   - Admin page: show Name, Date of birth, Time of birth and Place of birth under the Person picker in
     `web/src/pages/TechniquesLab.tsx`, and change the banner to say birth details are shown.
   - Docs: record the exception in `aiadastra_admin/docs/01-architecture-and-api.md` section 3. The admin reads no sealed
     column itself; the server serves the fields behind the lab token in QA.
   - Redeploy through the deploy session, which needs Sachin's typed yes in that chat.
3. **Run Sachin's board in the lab** (user `19b210cd-d24a-4aed-a54a-ae8e2a1b7df2`, kundli
   `c584c0a3-841b-451b-a2ed-f5709c5fb31d`). Run the whole board, open every tab and record what each shows. Tell Sachin
   first that it may pull the sky overlay from the engine; he has approved live engine calls.
4. **Read or write doc 63** (the Fable plan) and bring it to Sachin with one recommendation. It should cover the
   synthesizer types, the sub-agent families with their input and output schemas, the bundle and caching design, the
   Oracle workbench, staging focus groups, cost per load and the build order. No paid model call before his yes on key,
   count and cost.
5. **Fix in order of harm:**
   1. The tone contradiction (P1).
   2. Run records for clock, purview and audit.
   3. The recycler deleting natal outputs.
   4. The Tithi Pravesha year invalidation.
   5. The header counts.
   6. The cached-load round trips, replaced by one bundle read.
6. Downgrade the Work live-pull TODO to informational, since Sachin says live engine calls are fine.

## Sessions and rules

- Deploys, pushes and AWS changes go through the "Deploy API Lambda with new chat path" session, only on Sachin's typed
  yes in that chat.
- The "Self dashboard: guru-grade reading plan" session wrote docs 58 to 62 and the You reading. The "Build the admin
  Techniques Lab" session built the lab. Both are idle.
- Shared checkout rules (AGENTS.md, CLAUDE.md):
  - Branch off develop, and merge with `--no-ff` after tsc and tests.
  - Use literal paths only for worktree and delete commands.
  - Never name the engine to users.
  - File every finding in `docs/TODOS.md`.
  - Run sub-tasks as background agents.
  - Kill any local server you start.
