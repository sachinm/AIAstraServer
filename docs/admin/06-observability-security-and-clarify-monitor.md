# 06 — AI-First Clarify Agent, Multi-Agent Caching, Session/Quota Observability & Security Telemetry (M35)

## 1. Start

Five gaps exist across `AIAstra_Server` and `aiadastra_admin` today:

1. **Clarify Agent & Companion Memory (`src/reading/clarify/{planner,machine,service}.ts`, `src/reading/llm/bedrock.ts`)**:
   - `clarifyModelConfig()` only supports Bedrock (`bedrock:<model>` or `'off'`); it cannot route to the cheapest Gemini model (`gemini-2.5-flash-lite` / `gemini-2.0-flash`) even when `GEMINI_API_KEY` is configured.
   - `beginClarify` and `answerClarify` do not load `confirmedFacts` (`person_facts`, `docs/reading-engine/48`) and do not pass them into `startClarify`. Even when a user has already answered their work status (`work.status`) or relationship status (`love.status`), the clarifier starts without that context.
   - `prepareReaders` (`src/reading/oracle/prepare.ts:103`) computes `personIn(a.question)` from raw question text and ignores `a.intent.classification?.slots?.subject_person?.value` confirmed during Clarify. In addition, `PEOPLE` (`src/reading/oracle/readers.ts:39-47`) and `PERSON_SIGNIFIERS` (`src/reading/codeReaders/rules.ts:81-87`) omit `'parent'` (even though `personAsk()` offers `{ label: 'My parent', value: 'parent' }`), so choosing "My parent" never opens the `R13` D12 parent slice.
   - Clarify runs (`beginClarify`, `answerClarify`, `confirmAndBuildIntent`) are not logged via `withAgentRun(prisma, 'reading.clarify', ...)`, nor is there a deterministic counterfactual evaluator (`reading.clarify_monitor`) to audit whether Clarify asked the right questions, skipped already-known facts, or handed off `subject_person`, `sibling`, `location`, and `horizon` into downstream readers.
2. **Trace & Technique Rollup Gaps (`src/reading/metrics/trace.ts`, `aiadastra_admin/api/src/admin/{techniques,metrics}.ts`)**:
   - In `RunTrace`, `startStage` creates a `level = 'stage'` span (`prompt_tokens = 0`, `model = null`) while `recordModelCall` creates a separate `level = 'model_call'` span. For Graph Specialists (`graph.career_work`), the stage span has `agent = 'graph.career_work'` while the model call has `agent = 'career_work'`, so joining only on `m.agent = s.agent` leaves stage spans showing `0` tokens and `null` model in the Admin Techniques and Queries views.
   - `safeSummary` in `src/agents/registry.ts` and `aiadastra_admin/api/src/admin/techniques.ts` does not preserve a `writes` key (`['kundli_digest:64', 'kundli_activation:180']`), and `reading_traces` does not record `tables_written` or `clarify_monitor`.
3. **Multi-Agent Caching Gaps (`src/reading/oracle/{prewarm,runReader,flow,validator}.ts`, `src/reading/codeReaders/readers.ts`, `src/reading/luckyTimes/service.ts`)**:
   - `runReader.ts` keeps an in-process `memCache` that vanishes across Lambda instances and omits `a.slice.person?.person` from its cache key (causing `R13` person collisions on the same chart).
   - `flow.ts` does not pass `cachePrefix: true` on the Oracle synthesis `streamGemini` call.
   - `runCodeReaders`, `classifyRules`, `runIntake`, `validateDraft`, and `luckyTimes/service.ts` `getRange` recompute identical deterministic inputs without in-memory LRU memoization.
4. **Session Logout Revocation & Quota Visibility (`src/graphql/schema.ts`, `src/services/authService.ts`, `aiadastra_admin/api/src/admin/activity.ts`)**:
   - `Mutation.logout` returns `true` without incrementing `auth.token_version`, evicting the in-memory `requestAuth` cache (`forgetUser`), or writing a `sign_out` row to `account_events`. Logged-out JWTs remain valid and logged-out users stay counted in Admin's `onNow` for up to 15 minutes.
   - `completeLogin` does not set `auth.last_seen_at = new Date()`.
   - Admin Activity (`activity.ts`) does not join `billing_accounts` to show `planSummary` (`free` vs `paid`) or `quotaRemaining` per session.
5. **Security & Bot/Turnstile Telemetry (`src/services/turnstileService.ts`, `aiadastra_admin/api/src/auth.ts`)**:
   - Failed Cloudflare Turnstile checks do not return `errorCodes` or write `turnstile_failed` rows to `account_events`, and failed staff logins in `aiadastra_admin/api/src/auth.ts` do not write `staff.login_failed` rows to `admin_actions`. Admin has no `/security` or `/clarify-monitor` dashboards.

## 2. End Goal

1. **AI-First Clarify Agent with Deterministic `machine.ts` Fallback**:
   - When `READING_MODEL_CLARIFY` is configured for Gemini (`gemini`, `gemini:auto`, `gemini:gemini-2.5-flash-lite`) or Bedrock (`bedrock:<model>`), the Clarify agent uses the fast AI model (`planAiClarifyTurn` / `phraseAsk` / `resolveFreeText` / `judgePrashna`) to select and phrase the highest-value astrological clarifying question (including chart-led shade disambiguation) while skipping facts already confirmed in `person_facts`.
   - If the AI Clarify model is `off`, times out (`900ms`), or fails policy/word-count gates, `machine.ts` provides an instant, zero-latency deterministic fallback.
2. **100% Deterministic `ClarifyDecisionLog` & `reading.clarify_monitor` (`general.clarify`)**:
   - Every Clarify run records a structured `decisionLog` (`asked`, `skipped`, `defaulted`, `driver: 'ai' | 'machine_fallback' | 'safety_gate'`, `astrologicalPurpose`, `techniquesDependent`).
   - After every reading, `runClarifyMonitor` (`reading.clarify_monitor`, tagged to `general.clarify`) deterministically evaluates Stage-1 counterfactuals (`wouldAskingHaveHelped`, `missedCriterion`, `extraAskTriggered`, `contextHandoffOk`, `askRightScore`, `phrasingScore`, `handoffScore`) with zero extra LLM cost.
3. **Full Specialist Stage Rollup, Multi-Agent Caching & Table Write Attribution**:
   - Every stage span in `RunTrace` and Admin API (`techniques.ts`, `metrics.ts`) rolls up tokens, cost, model, and TTFT from child `model_call` spans matching either `agent_id` or `technique_id`.
   - `withAgentRun` and `reading_traces` record `writes: ['table:count']` and `tables_written`.
   - Cross-Lambda DB reader caching (`reading_findings_cache`) and bounded LRU caches accelerate `runReader`, `runCodeReaders`, `classifyRules`, `runIntake`, `validateDraft`, and `luckyTimes.getRange`.
4. **Session Revocation, Plan/Quota Visibility & `/security` + `/clarify-monitor` Dashboards**:
   - `Mutation.logout` revokes the session (`token_version` increment + `forgetUser` + `sign_out` event).
   - Admin gains `/security`, `/clarify-monitor`, and `/api/admin/activity/sessions` with zero PII leakage (`noPersonalFields.test.ts`).

## 3. Deliverable

- **Migration `M35`**: `prisma/migrations/20261106070000_admin_m35_clarify_and_security/migration.sql` + `prisma/schema.prisma`.
- **AI-First Clarify & Monitor**: `src/reading/llm/bedrock.ts`, `src/reading/clarify/{planner,machine,service,monitor}.ts`, `src/reading/run.ts`.
- **R13 `'parent'` & Handoff Fix + Caching**: `src/reading/oracle/{readers,prepare,runReader,prewarm,flow,validator}.ts`, `src/reading/codeReaders/{rules,readers}.ts`, `src/reading/buckets/classifier.ts`, `src/reading/nodes/intake.ts`, `src/reading/luckyTimes/service.ts`.
- **Trace & Write Attribution**: `src/reading/metrics/trace.ts`, `src/agents/registry.ts`, `src/techniques/catalog.ts`, `src/reading/digest/event.ts`, `src/reading/area/{boardService,careerService}.ts`, `src/reading/life/service.ts`.
- **Auth & Security Telemetry**: `src/graphql/schema.ts`, `src/services/{authService,turnstileService}.ts`.
- **Admin API & Web (`aiadastra_admin`)**: `api/src/admin/{security,clarifyMonitor,activity,metrics,techniques}.ts`, `api/src/auth.ts`, `web/src/pages/{Security,ClarifyMonitor,Activity,Queries,Query,DayReview,Technique}.tsx`.

## 4. Exactly How It Works When Done

### Backend
- **Clarify Model Selection (`clarifyModelConfig()`)**:
  - Reads `READING_MODEL_CLARIFY`. Supports `'gemini'`, `'gemini:auto'`, `'gemini:<model>'`, `'gemini-...'` (defaulting to `'gemini-2.5-flash-lite'`), `'bedrock:<model>'`, or `'off'`.
  - `planAiClarifyTurn` / `phraseAsk` / `resolveFreeText` / `judgePrashna` call Gemini (`thinking: 'off'`, `temperature: 0`, `CLARIFY_MODEL_TIMEOUT_MS = 900`) when `provider === 'gemini'`, or Bedrock when `provider === 'bedrock'`. On any timeout, error, or policy violation, `machine.ts` rules execute immediately.
- **Confirmed Facts & Decision Log**:
  - `beginClarify` loads `confirmedFacts(prisma, userId)` and passes `facts` into `startClarify`.
  - Known facts (`work.status`, `love.status`, `self.focus`) pre-fill `slots.background` and are recorded in `state.decisionLog` with `action: 'skipped', reason: 'known_in_person_facts'`.
- **Counterfactual Clarify Monitor (`src/reading/clarify/monitor.ts`)**:
  - `evaluateClarifyMonitor(state, record, facts)` inspects the reading's `findings`, `agreement`, `droppedClaims`, and `intent` against `state.turns`, `state.assumed`, and `facts`:
    - `missedCriterion`: `'horizon' | 'sub_bucket' | 'subject_person' | 'sibling' | 'location' | 'none'`
    - `wouldAskingHaveHelped`: `1` when a defaulted slot coincided with `agreement.level === 'split'` or `droppedClaims > 0`, else `0`
    - `extraAskTriggered`: `1` when Clarify asked a criterion already satisfied in `facts` or `question`, else `0`
    - `contextHandoffOk`: `1` when all clarified slots (`subject_person`, `sibling`, `location`, `horizon`) reached `record.intent`, else `0`
    - Composite scores `askRightScore`, `phrasingScore`, `handoffScore`, `overallScore` (`0..100`).

### API
- `GET /api/admin/security?days=7`: KPIs, Turnstile failures, customer auth failures, staff security events, top offending IPs, locked accounts, rate-limit summary.
- `GET /api/admin/clarify-monitor?days=7`: KPIs (`totalEvaluated`, `avgOverallScore`, `avgAskRightScore`, `avgPhrasingScore`, `avgHandoffScore`, `wouldHaveHelpedCount`, `extraAskCount`, `handoffFailureCount`), breakdown by criterion and target agent, and recent evaluations (safe IDs/scores only, zero PII).
- `GET /api/admin/activity/sessions`: Active/recent sessions with `plan`, `quota`, `used`, `remaining`, `signedOutAt`, `tokenVersion`.

### Frontend Experience & UI/UX
- **Security (`/security`)**: KPI strip, Turnstile & Bot Defense table, Customer Auth Failures, Staff Security Events, Top Offending IPs, Locked Accounts.
- **Clarify Monitor (`/clarify-monitor`)**: Score cards (`Overall`, `Ask-Right`, `Phrasing`, `Handoff`), Counterfactual Impact breakdown (`Would Asking Have Helped?`, `Extra Ask Rate`, `Target Agent Impact`), and Recent Clarify Evaluations table.

## 5. Architecture

```
User Question ──► beginClarify (loads person_facts + location + headlineCard)
                     │
                     ├──► AI Clarify Planner (Gemini 2.5 Flash-Lite / Bedrock) ──(timeout/off)──► machine.ts Fallback
                     │         └── writes ClarifyState.decisionLog + agent_runs ('reading.clarify')
                     ▼
              confirmAndBuildIntent ──► runReading
                                           ├── prepareReaders (passes subject_person incl. 'parent' to R13)
                                           ├── runReader (memCache + reading_findings_cache, person in key)
                                           ├── RunTrace (stage span rolls up child model_call tokens/cost/model)
                                           └── runClarifyMonitor ('reading.clarify_monitor' -> general.clarify)
```

## 6. Ingredients

- **Database Migration**: `20261106070000_admin_m35_clarify_and_security` (`reading_traces.clarify_monitor`, `reading_traces.tables_written`, `reading_findings_cache`, security indexes).
- **Env Vars**: `READING_MODEL_CLARIFY` (`gemini:gemini-2.5-flash-lite` | `bedrock:...` | `off`).

## 7. Action Steps in Sequence

1. Add migration `M35` and update `prisma/schema.prisma`.
2. Extend `clarifyModelConfig()` in `src/reading/llm/bedrock.ts` and update `src/reading/clarify/{planner,machine,service}.ts` + create `src/reading/clarify/monitor.ts`.
3. Fix `R13` `'parent'` and `subject_person` handoff in `src/reading/oracle/{readers,prepare,runReader}.ts` and `src/reading/codeReaders/{rules,readers}.ts`.
4. Add DB reader cache in `src/reading/oracle/prewarm.ts`, `cachePrefix: true` in `flow.ts`, and LRU caches in `classifier.ts`, `intake.ts`, `validator.ts`, and `luckyTimes/service.ts`.
5. Update `src/reading/metrics/trace.ts` and `src/agents/registry.ts` for stage span rollup and `writes` attribution.
6. Update `Mutation.logout`, `completeLogin`, and `turnstileService.ts` for session revocation and security telemetry.
7. Build Admin API & Web endpoints (`/security`, `/clarify-monitor`, `/activity/sessions`).

## 8. Development Phases

- **Phase 1**: Clarify AI-first planner, `machine.ts` fallback, `ClarifyDecisionLog`, `reading.clarify_monitor`, and `R13` `'parent'` handoff.
- **Phase 2**: Multi-agent caching, stage span rollup, `writes` attribution, logout revocation, and Turnstile/auth security logging.
- **Phase 3**: Admin API & Web dashboards (`/security`, `/clarify-monitor`, `/activity/sessions`) + unit & E2E tests.

## 9. One Recommendation

Use the AI-first Clarify planner (`gemini-2.5-flash-lite` or Bedrock) during the live Clarify turn with `machine.ts` as an instant fallback, and keep the post-reading `reading.clarify_monitor` 100% deterministic TypeScript over `ClarifyState` + `ReadingRunRecord` so counterfactual monitoring costs $0.00 and adds 0ms of LLM latency.
