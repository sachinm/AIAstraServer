# Technique Specification: Work AI Family Sub-Agents, Work Lineman & Work Oracle Synthesis (`work.reading.oracle`)

**Technique ID:** `work.reading.oracle`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/self/oracle.ts runSelfOracle` (`board: 'work'`, `runFamilySubAgents`, `runSelfLineman`)  
**Agent ID:** `work.reading_oracle`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.work`  
**Accuracy Check:** `area_checks:work`

---

## 1. Executive Summary & Purpose

`work.reading.oracle` orchestrates the end-to-end AI reading pipeline for the **Work** board. It reuses the five shared chart-family sub-agents (`family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`) from `reading_findings_cache`, compiles those findings together with the eight deterministic Work panel claims (`work.reading.*`) and whole-chart purview rules through the **Work Lineman** (`lineman.work`), and synthesizes a plain-English, personalized career narrative via `work.reading_oracle` under strict evidence-key validation and a `$1.00` cumulative spend guard.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` enriches every sub-agent slice (`SUBAGENT_DIGEST_SPECS` in `src/reading/oracle/digestSlices.ts:429-538`) feeding `work.reading.oracle`:

- **`family.varga` (`varga.d10`, `varga.d11`, `varga.d24`, `varga.d60`, Gaps R2 / R3):**
  - `digestSlices.ts:443` already requests `['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60']`, yet `SERVED_VARGAS` (`catalog.ts:133`) blocks 14 of them, `_build_placements_json` (`export.py:887`) omits `house`, `lagna`, `owns`, and `dignity`, and `D11` must also be added to `SUBAGENT_DIGEST_SPECS['family.varga'].vargas` (`digestSlices.ts:443`).
  - Unlocking all 23 vargas with complete `house_card` and `planet_card` fields lets `family.varga` and `lineman.work` compare `D1` career promises against `D10` (profession), `D24` (specialized skill/education), `D2` (wealth), and `D60` (root karma).
- **`family.rasi` (`strength.bhava`, `strength.vimsopaka`, `strength.harsha`, Gap H6; `houseShift`, Gap H8):** Upgrades `strength_matrix` in `family.rasi` (`digestSlices.ts:434`) with Bhava Bala (10th/6th/11th/2nd houses), Vimsopaka (20-point composite), Harsha Bala (competitive resilience in 6/8/12), and Bhava Chalit sign-to-house shifts.
- **`family.year` (TP `yearLord`, Annual `D10`, Return Panchanga, Gaps R1 / R4):** Supplies `AnnualRow.yearLord` (*Vaaresha*), `return_instant.panchanga`, and dynamic **TP D10** (`divisional_chart_factor=10`) inside `family.year` (`digestSlices.ts:464`) and `lineman.work` (`524`), fixing fail-closed annual conservatism.
- **`family.sky` (`transit_ashtakavarga`, Gochara Vedha, Murti Nirnaya, 2027–2036 contacts, Gaps R5 / H1 / H2 / H5):** Enriches `ashtakavarga` and `transit_range` in `family.sky` (`digestSlices.ts:474`) with Kakshya bindu flags, Vedha obstructions, Murti vehicle grades, and multi-year exact contacts.
- **`family.dasha` & `lineman.work` (Karakamsha/Swamsha, Sudarshana Chakra, Gaps R6 / H4):** Adds Jaimini Karakamsha 10th-house vocation links and 3-wheel Sudarshana progression to the Work Lineman brief (`digestSlices.ts:520-538`).

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:1925-1934`)
```typescript
[
  c('natal', 'panel claims'),
  c('divisional', 'D1'),
  c('divisional', 'D9'),
  c('divisional', 'D10'),
  c('divisional', 'D2'),
  c('dasha', 'reading clock'),
  c('annual', 'tithi_pravesha'),
  c('transit', 'sky overlay'),
  // Priority 2 additions: D11, D24, D60, strength.bhava, strength.vimsopaka, strength.harsha, transit_ashtakavarga
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:1954-1962`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1 and divisional house cards 1..12` | `house_card` | Explicit `house`, `lord`, `lord_dignity` across `D1..D60`, `bhava_bala` |
| `planet` | `D1 and divisional planet cards with avasthas and dasha_charter` | `planet_card` | `vimsopaka`, `harsha_bala`, `D10`/`D24`/`D60` dignities & houses |
| `yoga` | `D1 yogas, doshas, and cancellations` | `yoga_row` | Cross-varga Raja/Dhana yogas (`yogas.d10`) |
| `point` | `D1/D9 chara karakas, arudha padas, and Lunar Astro points` | `point_row` | `KL`/`Swamsha` (`D9 AK`), `A10`, `AL`, Sudarshana Chakra wheels |
| `star` | `Moon star, lagna star, gandanta, and pending karma houses` | `star_profile` | Full nakshatra & tara profile |
| `annual` | `running Tithi Pravesha and Varsha annual charts` | `annual_row` | TP `year_lord` (*Vaaresha*), TP `D10`, TP `panchanga` |
| `activation` | `reading clock L1-L3 and confirming clocks L1` | `activation_row` | Conditional, Karaka, and 40+ dasha clock concordance |

### 3.3 Output Schema & Oracle Synthesis Structure
- **System Prompt:** `src/reading/prompts/oracle/self.md` (with `lineman.work` via `readers/R15` and `work.reading_oracle` via `areaDoc` / `oracleAreaSchema`).
- **User Turn Fields:** `['FACTS', 'TODAY']` (`ANALYST_USER_FIELDS` subset in `parts[1]`).
- **Contract Output:** `self_reading.v1` (`SelfOraclePayload`: `{ status, board: 'work', panels, areas, diagnosis, synthesis, evidence[] }`).
- **Synthesis Payload (`findings_in`):** `lineman.work` (`digestSlices.ts:520`) joins the 5 `family.*` outputs (`reading_findings_cache`), the 8 deterministic `work.reading.*` panel claims (`vocation`, `standing`, `ground`, `gain`, `struggle`, `chapters`, `year`, `diagnosis`), `work.reading.purview`, and `person_facts` (`work.status`, `self.confirm.*`), weighting convergent claims (`-3 .. +3`) before `oracle.work` generates the final narrative.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:**
  - **Step 3 (AI Family Sub-Agents & Work Lineman):** `family.rasi`..`family.sky` run in parallel (reusing `reading_findings_cache` across Self/Love/Work), followed by `lineman.work` (`src/reading/self/oracle.ts`).
  - **Step 4 (Work Oracle Synthesis & Audit):** `work.reading_oracle` streams/writes the Work reading, validated by `validateAreaDoc` / `auditCards` (`work.reading.audit`) against allowed evidence keys.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.work`, `work.reading_oracle`.
  - **Tagged `technique_id` (`withAgentRun`):** `work.reading.oracle` (`category: 'work'`).
  - **Span Level:** `stage` (orchestration) + `model_call` (per Gemini request, tracking `prompt_tokens`, `cached_tokens`, `output_tokens`, `est_cost_usd`).
- **Execution Boundary & Runtime Limits:**
  - **Spend & Token Caps:** Enforces cumulative `$1.00` spend cap (`getSelfReadingMaxSpendUsd()`), `getSelfFamilyMaxOutputTokens()`, and `getSelfOracleMaxOutputTokens()` (`src/config/env.ts`).
  - **Offline-First Read Mode:** Page requests use `mode: 'cached_only'` (serving stored `technique_outputs` or `{ status: 'pending' }` with zero live model calls); cold builds execute asynchronously via `buildEvent.ts`.
  - **Zero Node Astrology:** All LLM prompts receive pre-digested tables from `DigestView` + `ActivationRow[]`; Node computes zero chart math.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Delivers crisp, empathetic second-person career guidance tailored to the user's confirmed `work.status` (`yes`, `between_jobs`, `own_business`, `studying`), obeying `MAX_LINE_WORDS` (<= 22 words per card line) and `SOUL.md` 4-tier behavioral framing.
- **Jargon Redaction Rules:** `redactEngineTerms` and `work.reading.audit` enforce zero Sanskrit terms (*Dashamsha*, *Amatyakaraka*, *Vaaresha*, *Ashtakavarga*, *Dusthana*) and strictly zero internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) on consumer screens.
- **Evidence Array Encapsulation:** Every Oracle paragraph and card sentence cites verified digest/panel keys inside `evidence[]` (e.g., `['D10.h10:lord=Me:exalted', 'family.dasha:Me/Ve:9x9_support', 'annual.TP2026:yearLord=Ju']`), dropping any hallucinated or unbacked claim automatically.
- **One-Tap "Chart Details":** Exposes the underlying panel claims, `family.*` findings summary, and verified chart keys behind the details drawer.
- **Single Past-Event Calibration Question:** Grounds the Work diagnosis with one verifiable past-event question (`self.confirm.*` / `area_checks:career`) tied to the central career tension.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache (`src/techniques/subagentCachePlan.ts:425-470`):**
  - `usesLlmCache: true`, `cacheStore: 'gemini_cached_contents+llm_cache_entries'`, `ttlSeconds: 3600`.
  - **Prefix Rule:** Places the immutable `FAMILY PACK` (`family.rasi`..`family.sky`) and `LINEMAN BRIEF` from `kundli_digest` + `kundli_activation` in `parts[0]` (`>= 1,024` tokens) with `cachePrefix: true` and `cacheOwner: { userId, kundliId }`. Dynamic `FACTS` and `TODAY` ride in `parts[1]`.
- **Findings & Output Persistence:**
  - Shared `family.*` findings and `lineman.work` brief persist in `reading_findings_cache` (so Self, Love, and Work never re-pay for the 5 chart-family reads).
  - Final Work Oracle output persists in `technique_outputs` (`techniqueCacheKey(work.reading.oracle)`).
- **45-Minute Inactivity Lifecycle:**
  - Prewarming (`ensurePromptCache`, `saveDbReaderCache`) leaves `hit_count = 0`.
  - Serving/reading calls `informIndividualCacheUsed({ userId, kundliId })`; after `READING_CACHE_RECYCLE_MINUTES=45` of inactivity, `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts:85`) deletes remote Gemini `cachedContents`, `llm_cache_entries`, expired `reading_findings_cache` windows, and `technique_outputs`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `ReadingFindingsCache` (`payload`), `TechniqueOutput` (`output`), `KundliDigest` (`row`, `source`), and `ReadingDossier` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
