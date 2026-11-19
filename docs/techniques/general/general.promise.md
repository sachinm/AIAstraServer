# Technique Specification: House Promise Analyst (`general.promise`)

**Technique ID:** `general.promise`  
**Category:** `general`  
**Board:** `chat`  
**Status:** `built` (Priority #2 `strength.bhava`, `strength.vimsopaka`, `D1..D60`, & `Bhava Chalit` enhancement ready)  
**Owning Code Path:** `src/reading/nodes/specialists.ts`; `src/reading/packs/selector.ts` (`ANALYST_SECTIONS.promise`); `src/reading/packs/digestSource.ts` (`overlayDigest`); `src/reading/prompts/v2/promise.md`  
**Agent ID:** `reading.analyst.promise` (subagent slice: `specialist:promise`; downstream synthesizer: `general.oracle`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.promise` is the foundational natal specialist of the General Reading (Chat) graph flow, always selected alongside `general.dasha` by `selectTechniques` (`src/techniques/use.ts`). For every subject identified by Intake/Clarify (across all 17 subjects), it examines the subject's primary D1 house, frame vargas, house lords, natural/functional karakas, Arudhas, special lagnas, and yogas from `kundli_digest` (`DigestView`) to establish what the chart genuinely promises—never predicting an event whose natal promise is absent.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `general.promise`:

- **Bhava Bala (`strength.bhava`, Gap H6) & Vimsopaka Bala (`strength.vimsopaka`, Gap H6):**
  - Currently `served: false` in `src/reading/chartData/catalog.ts:197–198`.
  - Injecting `strength.bhava` (Bhavadhipati, Dig, Drik bala, rupas, rank `1..12`) into `house_card` and `strength.vimsopaka` (20-point scale across `shadvarga..shodhasavarga`) into `planet_card` lets `specialist:promise` measure whether a frame house has genuine capacity to deliver vs. brittle appearance.
- **Unlocking All 23 Divisional Vargas (`D1..D60`, Gaps R2 & R3):**
  - Currently `specialist:promise` in `src/reading/oracle/digestSlices.ts:244` slices `vargas: ['D1', 'D9', 'D10']` while `FRAME_VARGAS` spans `D1, D2, D3, D4, D7, D9, D10` and deeper subjects (children `D7`, education `D24`, spirituality `D20`, parents `D12`, property `D4`, gains `D11`) are throttled by `SERVED_VARGAS = new Set([1, 2, 4, 7, 9, 10])` and `house: null` placement cards (`build.ts:589`).
  - Expanding `SERVED_VARGAS` to all 23 factors and upgrading `_build_placements_json` (`export.py:887`) to emit explicit `house`, `lagna`, `owns`, and `dignity` enriches every subject frame's promise pack.
- **Bhava Chalit Planetary Shifts (Gap H8):**
  - Adding `houseShift` to `planet_card` prevents `specialist:promise` from attributing D1 Rasi placements to the wrong Bhava when cusp degrees shift a planet's house occupancy.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:865`):**
  ```typescript
  [
    c('natal', 'facts'),
    ...FRAME_VARGAS, // D1, D2, D3, D4, D7, D9, D10 (+ unlocked D11, D12, D20, D24, D30, D60 by frame)
    c('jaimini', 'arudhas'), c('jaimini', 'special_lagnas'),
    c('natal', 'strength.bhava'), c('natal', 'strength.vimsopaka'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('house', "D1 and the frame's vargas, the frame's houses (plus bhava_bala_rank)", 'house_card')`
  - `inp('planet', "D1 cards of the frame's house lords and karakas (plus vimsopaka_score, house_shift)", 'planet_card')`
  - `inp('point', "arudhas and special lagnas of the frame", 'point_row')`
  - `inp('yoga', "yogas touching the frame's houses or their lords", 'yoga_row')`
- **Contract Output Schema:** `'findings.v2'` (with `synthesizer: 'general.oracle'`, `system: 'src/reading/prompts/v2/promise.md'`, `user: ANALYST_USER_FIELDS`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Structured JSON findings where every claim cites exact pack evidence IDs (`digest.house.<varga>.<house>.<field>` / `digest.planet.<varga>.<planet>.<field>`). Non-JSON output is repaired once; timeout/parse/schema failures are logged without crashing synthesis.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Clarify & Prewarm (`general.clarify`):** During `POST /api/chat/clarify` & `POST /api/chat/prewarm`, `prewarmNatalLayers` loads `DigestView`, builds `FullContext`, uploads `parts[0]` to Gemini `cachedContents` + `llm_cache_entries`, and pre-runs natal `specialist:promise` into `reading_findings_cache`.
  2. **Graph Specialist Execution (`runSpecialist`):** Checks `findingsCache` (L1) + `loadDbSpecialistFinding` (`reading_findings_cache`, L2); on miss calls `llmCallWithPrefix` using the pre-uploaded `provider_name` handle, running in parallel per subject with `general.dasha`.
  3. **Oracle Synthesis (`general.oracle`):** Merges `findings.v2` from all analysts with cited `DigestView` rows and confirmed `person_facts`.
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts`):**
  - `agentIdOf('promise')` -> `'reading.analyst.promise'`.
  - `techniqueIdOf('promise')` -> `'general.promise'`.
  - `category`: derived from `categoryOfSubject(subject)` (`work | love | self | general`).
  - `level`: `'stage'` (`promise|subject`) and `'model_call'` (`specialist:promise|subject`).
- **Execution Boundary & Runtime Limits:**
  - Runs within the `<= 10 s` interactive AI fan-out budget; zero `kundli_data` raw queries when `kundli_digest` is ready (`packs/digestSource.ts`).
  - Node never calculates houses, dignities, or Bhava strength—it slices pre-digested rows.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** `general.promise` emits internal structured `findings.v2` only; `general.oracle` translates them into empathetic, person-specific guidance (e.g., *"Your chart favors steady, earned progress in long-term collaborations rather than overnight windfalls."*).
- **Jargon Redaction Rules:**
  - Consumer answers generated downstream redact Sanskrit jargon (*Bhava Bala*, *Vimsopaka*, *Arudha*, *Dusthana*, *Karakamsa*, *D10/D24*) and strictly forbid engine names (`Radha`, `pyjhora`, `jhora`).
- **Evidence Array Encapsulation:**
  - Every `findings.v2` claim cites exact digest IDs in `evidence[]`:
    `['digest.house.D1.h10.bhava_bala_rank:1', 'digest.planet.D1.Sa.vimsopaka:16.4', 'digest.yoga.D1.hamsa:present']`.
- **One-Tap "Chart Details":** Surfaced via reading grounding/details drawer showing which house promise, strength tier, and divisional confirmation backed the answer.
- **Single Past-Event Calibration Question:** When natal promise is mixed or shifted (`house_shift`), Clarify asks one plain grounding question before predicting.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache (`src/techniques/subagentCachePlan.ts:221–275`):**
  - `cacheStore: 'gemini_cached_contents+llm_cache_entries'`, `ttlSeconds: 3600`.
  - `parts[0]` holds `FullContext.prefix` from `kundli_digest` (`cachePrefix: true`, `cacheOwner: { userId, kundliId }`); `parts[1]` holds question/horizon suffix.
- **Findings & Output Persistence:**
  - Persisted in `reading_findings_cache` under `findingsKey({ kundliId, analyst: 'promise', subject, packHash, horizonKey: 'natal', promptVer })`.
- **45-Minute Inactivity Lifecycle:**
  - Prewarming (`prewarmNatalLayers`) leaves `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`.
  - `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) deletes remote Gemini `cachedContents` and evicts inactive `llm_cache_entries` + `reading_findings_cache` after `READING_CACHE_RECYCLE_MINUTES` (`45`).
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliDigest`, `ReadingFindingsCache`, and `ReadingRun` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
