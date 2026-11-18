# 82 · No word filters in code: the Personalizer owns the words

Written 2026-11-18 after the Self board's refresh failed with every card showing "The full reading did not finish for
this card". Sachin's decision, same day: "There should be no filter in the software. The Personalizer takes care of
filters for words. Remove any filters in the code. AI handles that." This plan carries that out.

**Where the filters ran:** inside the reading build (the async build a dashboard refresh or a first visit queues), after
each model call and before the result is stored. Not in deployment. A filter that dropped text could leave a card, the
hero or the whole build "not served", so the build was not stored and the page showed failed cards.

## 1. Start (checked 2026-11-18)

- **Symptom:** `/you` on the phone: all 11 cards "did not finish"; header "That did not work. Try again".
- **DB evidence (kundli c584c0a3):** `area_builds` 18 Nov: `self.v2` failed "build does not serve the page",
  `self.reading` failed "v2 partial". `agent_runs`: all 9 model calls ok (about $0.10). `reading_validation_failures`
  for build `e6bb679f`: the hero sentence dropped for "your career" (role word against `work.status = between_jobs`),
  plus drops for "professional", "your job", "meeting", "Chronic", "annual cycle".
- **16 Nov failure:** a separate cause. Every Gemini call returned "prepayment credits are depleted" (billing).
- **Nothing stored:** no `self.v2.personalizer` row exists for this kundli on any clock, so a failed build leaves
  nothing to fall back to.
- **Live page:** `GET /api/self/v3` (`src/reading/self/v3/service.ts getSelfV3`) reads v2 state plus v3 cards (Phase B
  `self/v3/store.ts` and per-card readings `cards/store.ts`). The v3 cards are built only after v2 serves
  (`self/v2/build.ts`, `if (served && isSelfV3BuildEnabled())`). There is no "v4" in either repo.
- **The filters in code** (all in the build path):

| Filter | Where | Effect before |
| --- | --- | --- |
| Role words for retired / between_jobs / studying (`SELF_V2_ROLE_WORDS_NOT_WORKING`, `SELF_V2_NOT_WORKING_STATUSES`) | `self/v2/personalizerValidate.ts roleWordsFor` | sentence, headline, hero, ladder step dropped |
| Career-stage words (`SELF_V2_SENIOR_STAGE_WORDS`) | `profileFit.ts seniorStageWordsFor` used by validators | same |
| Chart terms (`CHART_TERMS`) | `textProblem`, `redactChartTerms` (also the v3 foundation prose) | sentence dropped |
| Medical words (`MEDICAL_WORDS`), body diet words (`SELF_V2_BODY_ADVICE_WORDS`) | `textProblem` | sentence dropped |
| Gendered words, stereotype phrases (`GENDERED_WORDS`, `getPersonalizerStereotypePhrases`) | `textProblem`, `dropStereotypeSentences` | sentence dropped |
| Dates the Oracle did not name, in prose | `textProblem` | sentence dropped |
| Word caps (headline, body, line, asks, step), if-then step form | v2 validator, v3 `checkPersonalCard`, `now/service checkNowFace`, `areaDoc.ts` headline | headline or card or face refused |
| Tone or mode against the frame, extra spans, prose dates | v3 `checkOracleCard` | card refused |
| Hero must stand to serve | `self/v2/failures.ts servesPage` | whole build not stored |

## 2. End goal

- A model answer that parses and is grounded is shown. No word, phrase, word count or sentence form removes text, a
  card or a build.
- Tone, words, the person's situation (between jobs, retired, studying), age register, gender and body-card limits
  are the Personalizer prompt's job. The prompt already carries them (`slices.ts` "WHAT THESE FACTS FORBID AND
  REQUIRE", the system prompt), and it is not changed by this plan.
- A failed refresh happens only for a real failure: the model call failed (credits, timeout), the answer did not
  parse, or fewer than 8 of 11 Oracle areas came back grounded.

## 3. Deliverable

- `src/reading/self/v2/personalizerValidate.ts`: `textProblem` returns null for everything; the word lists,
  `roleWordsFor`, `bodyAdviceWords`, `stereotypeMatcher` checks and `dropStereotypeSentences` are deleted from the
  check path. Engine names and internal keys are **redacted in place** (`redactEngineText`), never a drop.
  `redactChartTerms` keeps chart terms (redacts engine names only).
- `src/reading/self/v2/failures.ts`: `servesPage` needs 8 of 11 areas; the hero is not part of it (done in 992fb6d).
- `src/reading/self/v3/personalizer.ts`, `src/reading/self/v3/oracle.ts`, `src/reading/cards/group.ts`,
  `src/reading/now/service.ts`, `src/reading/self/areaDoc.ts`: caps, if-then form, tone/mode and prose dates no longer
  refuse a card; long headlines stand.
- `src/config/env.ts`: the role-word, not-working-status, body-advice and stereotype getters removed; the senior-stage
  table stays only for the prompt line in `slices.ts`.
- Tests rewritten from "dropped" to "kept"; one test of the 18 Nov case (hero "your career", `between_jobs`).
- `docs/TODOS.md` entries updated. (`docs/billing/03` does not name the hero; the rule lives in `failures.ts`.)

## 4. How it works when done

- **Backend:** a refresh posts, the build is invoked async (unchanged: one build per kundli per day, 30-minute
  failed-retry hold, Lambda 300 s). The family readers, Oracle (3 calls plus one repair), Personalizer and v3 cards run
  as now. Validators keep only structure and grounding: JSON shape, known areas, required fields not empty, evidence
  keys and paragraph sources from the brief, card date windows (`dates`, pattern `since/until`, confirm `from/to`)
  from the engine's stored windows. Text is never dropped for its words.
- **API:** unchanged. `GET /api/self/v3`, `POST /api/boards/self/refresh` (202 building, 409 not_ready/building, 402).
- **Frontend / UI:** unchanged code. The person sees cards instead of "did not finish".

## 5. Architecture

Request path (GET, PUT layout, POST refresh) → async self-invoke (build) → Gemini → validators (structure and grounding
only) → `technique_outputs` → GET reads them. Radha is not touched. The one in-code text step left is redaction of the
engine's internal names and internal keys (CLAUDE.md: they are never shown), which changes words in place.

## 6. Ingredients

No migration, no env var added, no IAM change. Env vars that become dead: `SELF_V2_ROLE_WORDS_NOT_WORKING`,
`SELF_V2_NOT_WORKING_STATUSES`, `SELF_V2_BODY_ADVICE_WORDS`, `PERSONALIZER_STEREOTYPE_PHRASES` (remove from the Lambda
config when next touched). Owner: this session for code and tests; the deploy session for the Lambda; Sachin for the
deploy yes and the one paid test reading (about $0.10).

## 7. Action steps

1. Make the hero non-fatal (`failures.ts`, `build.ts`). Done, commit 992fb6d.
2. Strip every word check from `textProblem`; add `redactEngineText`; delete the role, body, stereotype and
   gendered checks and their env getters.
3. v3 card checks, now faces, `areaDoc.ts`: caps, if-then, tone/mode, prose dates stop refusing.
4. Rewrite the tests; add the 18 Nov case; run `npx tsc --noEmit` and `npx vitest run tests/unit`.
5. Update TODOS; commit on `feat/self-foundation-server`.
6. With Sachin's yes: deploy through the deploy session, then one fresh reading on c584c0a3 and check the 11 cards.

## 8. Phases

- **Phase 1 (this branch):** steps 1–5. Closing check: whole unit suite and type check pass.
- **Phase 2 (needs a yes):** step 6. Closing check: `area_builds self.v2` ready for 18 Nov or later and a
  `self.v2.personalizer` row stored; screenshot of `/you`.
- **Deferred:** the v3 cards wait on v2 serving (`build.ts`); decoupling them moves the charge rule, filed in TODOS.

## 9. Recommendation

Remove the filters and let the prompt own the words, as Sachin decided. The only code step left on text is redaction of
engine names and internal keys, done in place so it can never fail a build.

| Option | Verdict |
| --- | --- |
| Remove all word filters; prompt owns words; redact engine names in place | **Chosen** |
| Keep filters as review warnings (text kept, finding stored) | Rejected by Sachin 2026-11-18: still filters in code |
| Narrow the role-word list for between_jobs | Rejected: treats one symptom, keeps the design |
