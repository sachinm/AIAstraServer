# Technique Specification: Love AI Family Sub-Agents, Love Lineman & Love Oracle Synthesis (`love.reading.oracle`)

**Technique ID:** `love.reading.oracle`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/self/oracle.ts runSelfOracle` (`board: 'love'`, `runFamilySubAgents`, `runSelfLineman`)  
**Agent ID:** `love.reading_oracle`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.love`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.reading.oracle` orchestrates the end-to-end AI reading pipeline for the **Love** board. It reuses the five shared chart-family sub-agents (`family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`) stored in `reading_findings_cache`, compiles them with the eight deterministic Love panel claims (`love.reading.*`), whole-chart purview rules (`love.reading.purview`), and the user's confirmed `love.status` through the **Love Lineman** (`lineman.love`), and synthesizes a warm, empathetic, plain-English Love reading via `love.reading_oracle` under evidence-key validation and a `$1.00` spend guard.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` enriches every sub-agent slice (`SUBAGENT_DIGEST_SPECS` in `src/reading/oracle/digestSlices.ts:429-518`) feeding `love.reading.oracle`:

- **`family.varga` (`varga.d9`, `varga.d7`, `varga.d30`, Gaps R2 / R3):**
  - `digestSlices.ts:443` already requests `D7`, `D9`, `D30`, yet `SERVED_VARGAS` (`catalog.ts:133`) blocks `D30` (`served: false`) and `_build_placements_json` (`export.py:887`) omits `house`, `lagna`, `owns`, and `dignity`.
  - Unlocking explicit divisional `house` and `dignity` fields lets `family.varga` and `lineman.love` (`digestSlices.ts:503`) evaluate marital dharma (`D9`), romantic/family continuity (`D7`), and hidden subconscious relational fears (`D30`) accurately.
- **`family.rasi` (`strength.bhava`, `strength.vimsopaka`, `strength.harsha`, Gap H6; `houseShift`, Gap H8):** Enriches `strength_matrix` (`digestSlices.ts:434`) with Bhava Bala for houses `7, 5, 2, 4, 12`, Venus/L7/DK Vimsopaka scores, Harsha Bala in `6/8/12`, and Bhava Chalit shifts.
- **`family.year` (TP `yearLord`, Annual `D9`, Return Panchanga, Gaps R1 / R4):** Supplies `AnnualRow.yearLord` (*Vaaresha*), `return_instant.panchanga`, and dynamic **TP D9** (`divisional_chart_factor=9`) inside `family.year` (`digestSlices.ts:464`) and `lineman.love` (`504`), eliminating fail-closed `get_through` annual bias.
- **`family.sky` (Gochara Vedha, Murti Nirnaya, `transit_ashtakavarga`, 2027–2036 contacts, Gaps R5 / H1 / H2 / H5):** Enriches `ashtakavarga` and `transit_range` (`digestSlices.ts:474`) so `family.sky` distinguishes unobstructed Jupiter/Venus support from Vedha-blocked transits and grades Saturn/Rahu pressure via Murti Nirnaya.
- **`lineman.love` (Headless Ashtakoota / Dasakoota & Sudarshana Chakra, Gaps H3 / H4):** When a partner comparison is requested, injects headless koota scores and 3-wheel Lagna/Moon/Sun progression into the Love Lineman brief.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:1844-1852`)
```typescript
[
  c('natal', 'panel claims'),
  c('divisional', 'D1'),
  c('divisional', 'D9'),
  c('divisional', 'D7'),
  c('dasha', 'reading clock'),
  c('annual', 'tithi_pravesha'),
  c('transit', 'sky overlay'),
  // Priority 2 additions: D30, strength.bhava, strength.vimsopaka, transit_ashtakavarga, compatibility (optional synastry)
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:1872-1880`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1 and divisional house cards 1..12` | `house_card` | Explicit `D9`/`D7`/`D30` `house`, `lord`, `lord_dignity`, `bhava_bala` |
| `planet` | `D1 and divisional planet cards with avasthas and dasha_charter` | `planet_card` | `vimsopaka`, `harsha_bala`, `D9`/`D7`/`D30` dignities & houses |
| `yoga` | `D1 yogas, doshas, and cancellations` | `yoga_row` | `Kalathra`, `Manglik`, and cancellation rows |
| `point` | `D1/D9 chara karakas, arudha padas, and Lunar Astro points` | `point_row` | `DK`, `UL`, `A7` across `D1` and `D9` |
| `star` | `Moon star, lagna star, gandanta, and pending karma houses` | `star_profile` | Full nakshatra & tara profile |
| `annual` | `running Tithi Pravesha and Varsha annual charts` | `annual_row` | TP `year_lord` (*Vaaresha*), TP `D9`, *Vivaha/Preethi* sahams |
| `activation` | `reading clock L1-L3 and confirming clocks L1` | `activation_row` | Conditional, Karaka, and 40+ dasha clock concordance |

### 3.3 Output Schema & Oracle Synthesis Structure
- **System Prompt:** `src/reading/prompts/oracle/self.md` (with `lineman.love` via `readers/R15` and `love.reading_oracle` via `areaDoc` / `oracleAreaSchema`).
- **User Turn Fields:** `['FACTS', 'TODAY']` (`parts[1]` dynamic suffix).
- **Contract Output:** `self_reading.v1` (`SelfOraclePayload`: `{ status, board: 'love', panels, areas, diagnosis, synthesis, evidence[] }`).
- **Synthesis Payload (`findings_in`):** `lineman.love` (`digestSlices.ts:500`) merges the 5 `family.*` outputs (`reading_findings_cache`), the 8 deterministic `love.reading.*` panel claims (`heart`, `partner`, `bond`, `circle`, `struggle`, `chapters`, `year`, `diagnosis`), `love.reading.purview`, and `person_facts` (`love.status`, `self.confirm.*`), weighting convergent claims (`-3 .. +3`) before `oracle.love` writes the final Love reading.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:**
  - **Step 3 (AI Family Sub-Agents & Love Lineman):** `family.rasi`..`family.sky` execute in parallel (reusing `reading_findings_cache` across Self/Love/Work), followed by `lineman.love` (`src/reading/self/oracle.ts`).
  - **Step 4 (Love Oracle Synthesis & Audit):** `love.reading_oracle` synthesizes the Love reading, validated by `validateAreaDoc` / `auditCards` (`love.reading.audit`) against stored chart keys.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.love`, `love.reading_oracle`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.reading.oracle` (`category: 'love'`).
  - **Span Level:** `stage` (orchestration) + `model_call` (per Gemini call, tracking tokens and `est_cost_usd`).
- **Execution Boundary & Runtime Limits:**
  - **Spend & Token Caps:** Enforces cumulative `$1.00` spend cap (`getSelfReadingMaxSpendUsd()`), `getSelfFamilyMaxOutputTokens()`, and `getSelfOracleMaxOutputTokens()` (`src/config/env.ts`).
  - **Offline-First Read Mode:** Page requests run `mode: 'cached_only'` (zero live model calls); cold builds execute asynchronously via `buildEvent.ts`.
  - **Zero Node Astrology:** Prompts are built strictly from `DigestView` + `ActivationRow[]` + stored sky overlays; Node computes zero chart math.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Compassionate, plain second-person guidance tailored to `love.status` (`single`, `dating`, `committed`, `married`, `separated`, `complicated`), obeying `MAX_LINE_WORDS` (<= 22 words per card line), `SOUL.md` 4-tier framing, and strict non-fatalism (never predicting separation or yes/no marriage verdicts; never referencing children under 18 in `circlePanel`).
- **Jargon Redaction Rules:** `redactEngineTerms` and `love.reading.audit` forbid Sanskrit terms (*Navamsha*, *Saptamsha*, *Trimshamsha*, *Upapada*, *Darakaraka*, *Manglik*, *Vedha*, *Vaaresha*) and internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`).
- **Evidence Array Encapsulation:** Every sentence cites verified keys inside `evidence[]` (`['D9.h7:lord=Ve:exalted', 'family.year:TP2026:yearLord=Ju', 'family.sky:Ju:h5:clear_vedha']`); unbacked claims are stripped by `validateAreaDoc`.
- **One-Tap "Chart Details":** Reveals the underlying Love panel claims, `family.*` summaries, and verified evidence keys inside the details drawer.
- **Single Past-Event Calibration Question:** Grounds the Love diagnosis with one verifiable past-event question (`self.confirm.*` / `area_checks:love`) aligned to the user's relationship context.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache (`src/techniques/subagentCachePlan.ts:425-470`):**
  - `usesLlmCache: true`, `cacheStore: 'gemini_cached_contents+llm_cache_entries'`, `ttlSeconds: 3600`.
  - **Prefix Rule:** Places the immutable `FAMILY PACK` (`family.rasi`..`family.sky`) and `LINEMAN BRIEF` in `parts[0]` (`>= 1,024` tokens) with `cachePrefix: true` and `cacheOwner: { userId, kundliId }`. Dynamic `FACTS` (`love.status`, confirms) and `TODAY` ride in `parts[1]`.
- **Findings & Output Persistence:**
  - Shared `family.*` findings and `lineman.love` brief persist in `reading_findings_cache` across Self/Love/Work.
  - Final Love Oracle output persists in `technique_outputs` (`techniqueCacheKey(love.reading.oracle)`).
- **45-Minute Inactivity Lifecycle:**
  - Prewarming leaves `hit_count = 0`.
  - Serving/reading invokes `informIndividualCacheUsed({ userId, kundliId })`; after `READING_CACHE_RECYCLE_MINUTES=45` of inactivity, `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts:85`) deletes remote Gemini `cachedContents`, `llm_cache_entries`, expired `reading_findings_cache` windows, and `technique_outputs`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `ReadingFindingsCache` (`payload`), `TechniqueOutput` (`output`), `KundliDigest` (`row`, `source`), and `ReadingDossier` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
