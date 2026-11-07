# Claude Opus Agent Handoff — AI AdAstra (`AIAstra_Server`, `AIAstra_WEB`, `aiadastra_admin`, `AIAstra_Radha`)

**Date**: 2026-11-07  
**Reviewed & Consolidated Sessions**:
- [`2ef00975-2f31-42e5-b3a8-2fbceb1320d1`](conversation://2ef00975-2f31-42e5-b3a8-2fbceb1320d1) — *Research Staging Schema (`M38`), Self-Board Deep-Dive Template & 8-Gate Technical Verifier Lab*
- [`e578460d-f82f-4ac7-9e49-d928f8af3b04`](conversation://e578460d-f82f-4ac7-9e49-d928f8af3b04) — *Page Response Times Telemetry (`M37`), Progressive NDJSON Section Streaming, Self-Only RBAC & At-Rest Cache Encryption*
- [`be0d2cfe-a2ba-49e9-a111-48bf42a770bf`](conversation://be0d2cfe-a2ba-49e9-a111-48bf42a770bf) — *Standardized Technique Pieces, Date-Range Output Store (`M37`), 80-Page Visual Manual & Admin Machinery Deck*
- [`8b768708-b735-4085-8c65-fbb7b336061f`](conversation://8b768708-b735-4085-8c65-fbb7b336061f) — *Life Reading Part 2: Remaining Largest Mahadasha & Antardasha Charter (`doc 55`) + Multi-School Jyotish Skill & Digest Truthiness*
- [`f944d40f-f281-4df5-937c-3fdb7faf038f`](conversation://f944d40f-f281-4df5-937c-3fdb7faf038f) — *Per-Sub-Agent Digest Slicing, Cross-Lambda Output Caching, 45-Min Used-Cache Recycling (`M38`), plus Plan A + Plan B (`M35`/`M36`)*
- [`dfdaae72-8fc9-48e7-8b7a-561e1ede8acd`](conversation://dfdaae72-8fc9-48e7-8b7a-561e1ede8acd) — *P0–P3 Consolidation, Header Personalize Wizard Modal, Self 3-Decade Character Evolution (`self.character_arc`) + Vedic Moon/Mercury Personality & Joy (`self.personality_joy`), and Love/Work Research Lab (`research.love_dashboard_qa`, `research.work_dashboard_qa`)*

---

## 1. Purpose of All This Work & End Result Across Every Area of the Site

AI AdAstra has transitioned from a raw chart-calculation app into a **personal, deterministic, fast, explainable, and forensically verified Vedic astrology personal assistant** ([`AGENTS.md`](../AGENTS.md), [`SOUL.md`](../SOUL.md)).

### End Result by Site Area

| Site Area & Route | Purpose of Work | End Result Experienced by User / Staff |
|---|---|---|
| **1. Header Personalization Modal (All Authenticated Routes)** (`AIAstra_WEB` + `AIAstra_Server`) | Allow users to open the 5-question Personalize Profile Setup Wizard (`work.status`, `work.form`, `love.status`, `home.status`, `family.children`) at any time from the top navigation bar next to the user profile icon (`PersonalizeWizardModal.tsx` in `AppShell.tsx`). | Users click **Personalize** next to their profile icon in the header, answer or update 5 one-tap facts in a clean modal, and immediately tailor their You, Love, Work, and Life Reading boards (`person_facts`). |
| **2. General Reading & Clarify (`/chat`)** (`AIAstra_WEB` + `AIAstra_Server`) | Replace full-chart prompt dumps with deterministic per-sub-agent digest slicing (`SUBAGENT_DIGEST_SPECS`), Gemini `cachedContents` prefix caching (`parts[0]`), cross-Lambda DB reader caching (`reading_findings_cache`), 45-minute used-cache recycling, and AI-first Clarify auditing (`reading.clarify_monitor`). | Follow-up questions hit warm Gemini prefix caches and DB reader caches (`R01..R14`, `P1..P3`, `specialist:*`); Clarify asks at most 1–2 chart-led, plain-English questions without jargon or redundant repeats; used caches recycle cleanly 45 minutes after active use. |
| **3. You / Self (`/you`), Love (`/love`), Work (`/work`) Area Boards** (`AIAstra_WEB` + `AIAstra_Server`) | Wire the 3-tier Resort-vs-Hospital/ER Shade Resolver (`shadeResolver.ts`), progressive NDJSON streaming (`GET /api/dashboard/sections-stream`), date-range `technique_outputs` caching (`M37`), and two new purely Vedic Self techniques: **#1 3-Decade Character Evolution (`self.character_arc`: Last 10 Years · Who You Are Now · Next 10 Years)** and **#2 Vedic Personality & Joy (`self.personality_joy`: Moon/Chandra + Mercury/Budha + 4th/5th Bhava)**. | Boards render cached/fast sections in `<300ms` via NDJSON stream. On `/you`, users see their 3-decade character evolution (e.g. ages 20–30 vs. now at 30 vs. ages 30–40) and what genuinely brings them emotional peace and intellectual joy from their Vedic Moon and Mercury placements, all in plain English with expandable `<details>` evidence. |
| **4. Life Reading (`/profile/timeline`)** (`AIAstra_WEB` + `AIAstra_Server`) | Add **Part 2: Remaining Largest Mahadasha & Antardasha Charter (`life.mahadasha_charter`, doc 55)** alongside Part 1 (18-Yr Retrospective + 1/3/6/9/12-Mo Wealth Ladder), backed by corrected conditional dasha filtering (`applies === true`) and dual co-lordships (`Ma/Ke` Scorpio, `Sa/Ra` Aquarius). | Users see a complete 10–18+ year forward life charter with Current-Chapter Bridge, area badges (`anchor`, `growth`, `guarded`), and chronological Antardasha sub-chapters in warm plain English (`BANNED_RE` enforced). |
| **5. Lucky Times (`/lucky-times`)** (`AIAstra_WEB` + `AIAstra_Server`) | Wrap the 5 deterministic limbs (`lucky.day_windows`, `lucky.panchanga`, `lucky.tarabala_chandrabala`, `lucky.hora`, `lucky.choghadiya`) in `withTechniqueOutput` (`M37`) with exact UTC day-end validity windows and environment-driven rule lists (`src/config/env.ts`). | Instant, zero-LLM daily/weekly auspicious windows cached across Lambdas until UTC midnight of the target day. |
| **6. Account Security & Privacy (All Consumer Routes)** (`AIAstra_WEB` + `AIAstra_Server`) | Enforce `assertOwnAccount` across all 16 user-scoped GraphQL resolvers (`src/graphql/rbac.ts`), expand `SEALED_MODELS` (`pii2:v1` AES-256-GCM at-rest encryption) to all cache/board/digest tables, and enforce `Cache-Control: private, no-store` on `/api/*` and `/graphql`. | Strict self-only RBAC isolation, zero plaintext PII or reading JSON at rest in PostgreSQL caches, and full Turnstile/OTP audit telemetry. |
| **7. Admin — Page Times (`/pages`)** (`aiadastra_admin` + `AIAstra_Server`) | Add `AsyncLocalStorage` request profiler (`src/telemetry/pageTiming.ts`), `X-Astra-Page` attribution (`apiHeaders.ts`), `<PageTimingTracker />` (`render_ms` + `draw_ms`), `page_execution_logs` (`M37`), and 6–12 month infra forecast (`doc 08`). | Staff inspect real-time p50/p95/max latency broken down by `db_ms`, `ai_ms`, `compute_ms`, `render_ms`, `draw_ms`, cache hits, and per-call waterfall spans. |
| **8. Admin — Machinery & Illustrations (`/machinery`, `/illustrations`)** (`aiadastra_admin` + `AIAstra_Server`) | Decompose all 73 built techniques into standardized pieces (`reader:*` with typed `HouseCardFilter`, `prompt:*`, `output:*`, `agent:*`) and generate an 80-page visual manual (`docs/techniques/01..06`, `docs/admin/07`). | Paginated (`Page X of N`) interactive manual showing every technique's flowchart, pieces, input slice, prompt, and date-range validity window. |
| **9. Admin — Research & Verification Lab (`/research-lab`)** (`aiadastra_admin` + `AIAstra_Server`) | Create 5 isolated `research_*` staging tables (`M38`), 20 synthetic personas (10 ages `18..56` + 10 professions), `Self (You) | Love | Work` board selector (`selfDashboardQa.ts`, `loveDashboardQa.ts`, `workDashboardQa.ts`), 10-step reverse-engineered trace, and 8-gate independent technical verifier (`research.technical_verifier`). | R&D staff hydrate synthetic charts across Self, Love, and Work without polluting production tables, inspect every step from `dataPulled` to `oracleClaim`, and run an automated 8-gate verifier (`>=95%` pass threshold). |

---

## 2. Complete File & Plan Name Reference

### 2.1 Architecture & Plan Documents (`AIAstra_Server/docs/`)
- [`docs/reading-engine/53-kundli-digest-and-technique-contracts.md`](./reading-engine/53-kundli-digest-and-technique-contracts.md)
- [`docs/reading-engine/54-build-contracts-digest-boards-life-reading.md`](./reading-engine/54-build-contracts-digest-boards-life-reading.md)
- [`docs/reading-engine/55-life-reading-mahadasha-charter.md`](./reading-engine/55-life-reading-mahadasha-charter.md)
- [`docs/reading-engine/55-technique-verification-and-shade-architecture.md`](./reading-engine/55-technique-verification-and-shade-architecture.md)
- [`docs/reading-engine/56-technique-pieces-and-validity-windows.md`](./reading-engine/56-technique-pieces-and-validity-windows.md)
- [`docs/reading-engine/56-technique-pieces-illustrations-and-date-range-cache.md`](./reading-engine/56-technique-pieces-illustrations-and-date-range-cache.md)
- [`docs/reading-engine/57-technique-pieces-llm-cache-upload-and-subagent-prewarm.md`](./reading-engine/57-technique-pieces-llm-cache-upload-and-subagent-prewarm.md)
- [`docs/admin/05-techniques-catalogue.md`](./admin/05-techniques-catalogue.md)
- [`docs/admin/06-observability-security-and-clarify-monitor.md`](./admin/06-observability-security-and-clarify-monitor.md)
- [`docs/admin/07-technique-pieces-and-agents.md`](./admin/07-technique-pieces-and-agents.md)
- [`docs/admin/08-page-response-times-and-app-forecast.md`](./admin/08-page-response-times-and-app-forecast.md)
- [`docs/admin/09-research-staging-and-self-dashboard-verification.md`](./admin/09-research-staging-and-self-dashboard-verification.md)
- [`docs/techniques/README.md`](./techniques/README.md) & [`docs/techniques/01-architecture-and-reusable-pieces.md`](./techniques/01-architecture-and-reusable-pieces.md) through [`docs/techniques/06-lucky-times-and-life-illustrations.md`](./techniques/06-lucky-times-and-life-illustrations.md)
- [`docs/TODOS.md`](./TODOS.md)

### 2.2 Database Migrations (`AIAstra_Server/prisma/migrations/`)
- `M35`: `20261106020000_admin_m35_observability_security_clarify/migration.sql`
- `M36`: `20261106030000_admin_m36_shade_governance/migration.sql`
- `M37` (Outputs): `20261106080000_technique_outputs_m37/migration.sql`
- `M37` (Page Timing): `20261106090000_page_execution_logs_m37/migration.sql`
- `M38` (Cache Recycling): `20261106100000_subagent_cache_usage_tracking_m38/migration.sql`
- `M38` (Research Lab): `20261106120000_admin_m38_research_staging_and_self_qa/migration.sql`

### 2.3 Key Source Files Modified/Created
- **`AIAstra_Server`**:
  - Self Character Arc & Moon/Mercury Personality/Joy: `src/reading/area/selfCharacterAndJoy.ts`, `src/reading/area/houseLayers.ts`, `src/techniques/catalog.ts`, `src/agents/registry.ts`
  - Research Lab (Self, Love, Work): `src/reading/research/types.ts`, `src/reading/research/presets.ts`, `src/reading/research/selfDashboardQa.ts`, `src/reading/research/loveDashboardQa.ts`, `src/reading/research/workDashboardQa.ts`, `src/reading/research/verifier.ts`, `src/routes/researchRoutes.ts`
  - Telemetry, RBAC & Encryption: `src/telemetry/pageTiming.ts`, `src/graphql/rbac.ts`, `src/graphql/schema.ts`, `src/lib/pii/fields.ts`, `src/routes/dashboardStreamRoutes.ts`
  - Technique Pieces & Caching: `src/techniques/pieces.ts`, `src/techniques/outputStore.ts`, `src/techniques/piecesDoc.ts`, `src/techniques/subagentCachePlan.ts`, `src/reading/oracle/digestSlices.ts`, `src/reading/llm/cacheSweep.ts`, `src/reading/llm/promptCache.ts`, `src/reading/oracle/readerCache.ts`
  - Life Charter, Shade & Digest: `src/reading/life/charter.ts`, `src/reading/life/compose.ts`, `src/reading/life/service.ts`, `src/reading/area/shadeResolver.ts`, `src/reading/digest/activation.ts`, `src/reading/digest/build.ts`
- **`AIAstra_WEB`**:
  - Header Personalize Wizard Modal: `src/components/PersonalizeWizardModal.tsx`, `src/components/AppShell.tsx`
  - Self 3-Decade Character Evolution & Personality/Joy UI + NDJSON Streaming: `src/pages/boards/BoardView.tsx`, `src/pages/UserData.ts`
  - Telemetry & Life Charter: `src/lib/pageTelemetry.ts`, `src/components/PageTimingTracker.tsx`, `src/lib/apiHeaders.ts`, `src/pages/timeline/LifeReadingDashboard.tsx`, `src/lib/lifeReadingApi.ts`
- **`aiadastra_admin`**:
  - Research Lab (`Self | Love | Work` + Character Arc & Joy): `web/src/pages/ResearchLab.tsx`, `api/src/admin/researchLab.ts`, `api/src/contract.ts`, `api/src/app.ts`, `web/src/lib/adminApi.ts`
  - Observability & Machinery: `web/src/pages/PagePerformance.tsx`, `api/src/admin/pagePerformance.ts`, `web/src/pages/Machinery.tsx`, `api/src/admin/machinery.ts`, `web/src/pages/SecurityAudit.tsx`, `web/src/pages/ClarifyMonitor.tsx`

---

## 3. Next Items for Claude Opus

1. **Staging Data Parity (`docs/TODOS.md` P1)**:
   - Run `topUpAnnualSet` (`±10 yr` across `D1, D2, D7, D9, D10`) and `transits:overlay` on staging for Sachin (`c584c0a3-841b-451b-a2ed-f5709c5fb31d`) and Archisha (`6514751c-9b30-45e6-bad6-0a56415e067b`), then rebuild their `kundli_digest` so their annual and transit overlay counts match Sumit (`75b0d618`).
2. **EventBridge Scheduled Sweep Verification (`docs/TODOS.md` P1/P2)**:
   - Verify `kundli-digest-sweep` (every 15 min) and `aiastra-llm-cache-sweep` (every 45 min) in CloudWatch logs (`{"msg":"digest_sweep_done"}` and `{"msg":"llm cache sweep"}`).
3. **Admin `/techniques` Cache Hit-Rate Column**:
   - Surface per-technique `technique_outputs` and `reading_findings_cache` hit rates directly in `aiadastra_admin/web/src/pages/Techniques.tsx` alongside `Runs`, `p50`, and `p95`.
