# GEMINI.md — Gemini & Antigravity Agent Rules for AIAstra_Server

All instructions in [`AGENTS.md`](./AGENTS.md) and [`SOUL.md`](./SOUL.md) apply to every session in this repository.

## Mandatory Design Rules

1. **Environment-Driven Selections & Rule Lists (`src/config/env.ts`)**:
   - Store configurable astrological and operational selections, rule lists, horizons, reference timezone coordinates, and thresholds in environment variables read through `src/config/env.ts` (with sensible defaults) rather than hardcoding them inside feature modules.
   - Examples: `LUCKY_HORIZON_DAYS`, `LUCKY_PREPULL_DAYS`, `LUCKY_REFERENCE_PLACES`, `LUCKY_YOGA_FAVOUR`, `LUCKY_YOGA_AVOID`, `LUCKY_KARANA_AVOID`, `LUCKY_KARANA_FAVOUR`, `LUCKY_FIXED_KARANA_AVOID`, `LUCKY_FIXED_KARANA_FAVOUR`, `LUCKY_AMRITA_SIDDHI_ENABLED`, `DIGEST_VERSION`, `DIGEST_SWEEP_MAX_MS`, `DIGEST_ANNUAL_MAX_CALLS`.
2. **Deterministic Digest & Universal Prepull (Zero AI Where Deterministic)**:
   - Never use an LLM/AI model for work that is deterministic over engine tables (such as `kundli_digest`, `kundli_activation`, or the 2–4 week universal Lucky Times `day_tables` prepull across the 5 reference timezones and personal overlay).
3. **Per-Sub-Agent Digest Slicing, Stable Prefix Caching & Cross-Lambda Output Caching**:
   - Every sub-agent (`R01..R14`, `P1..P3`, `specialist:*`, `oracle`, `addendum`, `synthesize`, `clarify`, `validator`, `intake`, `code:*`) must map its `contract.inputs` (`src/techniques/catalog.ts`) in `src/reading/oracle/digestSlices.ts` (`SUBAGENT_DIGEST_SPECS`) and `src/techniques/subagentCachePlan.ts`.
   - When `kundli_digest` (`DigestView`) is ready, build sub-agent prompt context from `DigestView` + `kundli_activation` rather than raw `chart_data_items`.
   - Always place the stable per-individual context prefix (`coreText` + clarified facts) in `parts[0]` and question-specific inputs in `parts[1..]` with `cachePrefix: true` and `cacheOwner: { userId, kundliId }` so Gemini `cachedContents` hits across follow-up questions.
   - Persist reader/specialist outputs in `reading_findings_cache` (`M35/M38`) and deterministic/board technique outputs in `technique_outputs` (`M37`).
4. **45-Minute Per-Individual Used-Cache Recycling (`READING_CACHE_RECYCLE_MINUTES=45`)**:
   - Prewarming a cache (`ensurePromptCache`, `saveDbReaderCache`) must leave `uses = 0` (`hit_count = 0`).
   - Consuming any cache for an individual (`userId` / `kundliId`) must increment usage (`hit_count`, `last_used_at`) and call `informIndividualCacheUsed(owner)` (`src/reading/llm/cacheSweep.ts`), scheduling a 45-minute per-individual recycle (`recycleIndividualCaches(owner, { onlyUsed: true })`) and participating in the 45-minute `runScheduledSweep` across all 4 layers: Gemini `cachedContents`/`llm_cache_entries`, `reading_findings_cache`, `technique_outputs`, and in-memory memos.
5. **Local Server Teardown**:
   - Any local server process (`node`, `tsx`, `vite`, `npm run dev`) started for verification MUST be terminated immediately after testing completes.
6. **Database Migrations via Server (`npx.cmd prisma migrate deploy`)**:
   - Gemini agents are authorized to apply additive Prisma migrations in `AIAstra_Server/prisma/migrations` directly to the shared PostgreSQL database via `npx.cmd prisma migrate deploy` and verify with `npx.cmd prisma migrate status`. Never run destructive DDL (`DROP`, `TRUNCATE`) or `terraform` without explicit user approval.
7. **Deploying `develop` via `release-candidate-staging` & GitHub Actions**:
   - After `tsc --noEmit` and unit tests pass on `develop`, Gemini agents can push `develop`, merge `develop` `--no-ff` into `release-candidate-staging`, and push `release-candidate-staging` (with `gh auth switch --user sachinm`) across `AIAstra_Server`, `aiadastra_admin`, and `AIAstra_WEB` to trigger GitHub Actions OIDC deployments for AWS Lambda APIs (`aiastra-server-api`, `aiadastra-admin-api`) and Amplify websites (`aiadastra-admin-web`, `AIAstra_WEB`).
8. **Self-Only RBAC (`assertOwnAccount`) & At-Rest Cache Encryption (`SEALED_MODELS`)**:
   - Every user-scoped GraphQL resolver and REST endpoint must enforce `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`) so authenticated users (including admins on consumer endpoints) can only read or mutate their own account's kundlis, boards, and readings.
   - Every Prisma model storing derived astrological prose, digests, boards, or sub-agent/technique cache payloads (`ReadingFindingsCache`, `TechniqueOutput`, `KundliDigest`, `KundliBoard`, `ClarifyTurnAudit`) must be listed in `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM at-rest encryption), and `/api/*` + `/graphql` responses must emit `Cache-Control: private, no-store, no-cache, must-revalidate`.
9. **End-to-End Page Timing Telemetry (`M37`) & Progressive NDJSON Board Streaming**:
   - Every consumer page in `AIAstra_WEB` must map its route in `src/lib/pageTelemetry.ts` (`X-Astra-Page` header via `apiHeaders()` + `<PageTimingTracker />` reporting `render_ms` and `draw_ms` to `POST /api/telemetry/page-render`) and `AIAstra_Server/src/telemetry/pageTiming.ts` (`AsyncLocalStorage` profiler recording `db_ms`, `ai_ms`, `compute_ms`, `cache_hits`, and `spans` into `page_execution_logs`).
   - Multi-section boards (`/you`, `/love`, `/work`) must stream sections progressively via `GET /api/dashboard/sections-stream` (`application/x-ndjson`) so deterministic/cached sections render before heavier AI synthesis finishes.
10. **Isolated Research Staging Schema (`research_*`, `M38`) & 8-Gate Technical Verifier**:
    - Synthetic QA subjects, age/profession cohorts, and R&D deep-dive runs must use the isolated `research_kundlis`, `research_chart_data`, `research_digests`, `research_activations`, and `research_dashboard_runs` tables (`src/reading/research/*`) — never production user tables.
    - Every deep-dive QA report (`self`, `love`, `work`) must include the 10-step reverse-engineered trace (`dataPulled` -> `dataExcluded` -> `classicalRules` -> `combinationFormula` -> `oracleClaim`) and be audited by `research.technical_verifier` (`src/reading/research/verifier.ts`, 8 gates, `>=95%` pass threshold).

