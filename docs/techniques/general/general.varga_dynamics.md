# Technique Specification: Varga Dynamics Analyst (`general.varga_dynamics`)

**Technique ID:** `general.varga_dynamics`  
**Category:** `general`  
**Board:** `chat`  
**Status:** `built` (Priority #2 23-varga unlock directly unblocks core functionality)  
**Owning Code Path:** `src/reading/codeReaders/readers.ts` (`vargaDynamics`); `src/reading/codeReaders/rules.ts` (`CODE_READER_RULES`)  
**Agent ID:** `reading.code.varga_dynamics` (subagent slices: `code:varga_dynamics`, `code:varga`, `R03`; downstream: `general.oracle`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.varga_dynamics` is a deterministic, zero-LLM code reader in the General Reading pipeline that compares D1 house/lord promise against all owning and deeper divisional charts (`D2, D4, D7, D9, D10, D12, D24, D30, D60`, plus `D16, D20, D27, D40, D45, D81, D108, D144` for `why_meaning` or `life` horizon queries). It emits up to 8 ranked `findings.v2` claims (`weight 1..2`, clamped layer score `-3..+3`) checking whether D1 lords retain dignity in the varga and whether planets repeat in the same house across D1 and the varga.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` are **essential** to make `general.varga_dynamics` functional across its declared 17+ vargas:

- **Unlocking All 23 Vargas (`SERVED_VARGAS`, Gap R2):**
  - `general.varga_dynamics` declares `D2, D4, D7, D9, D10, D12, D24, D30, D60, D16, D20, D27, D40, D45, D81, D108, D144` (`src/techniques/catalog.ts:881`).
  - Yet `SERVED_VARGAS` (`src/reading/chartData/catalog.ts:133`) currently serves only `{1, 2, 4, 7, 9, 10}`! Consequently, 12 of the 17 divisional charts declared by `general.varga_dynamics` (`D12, D24, D30, D60, D16, D20, D27, D40, D45, D81, D108, D144`) cannot be fetched via `ensureChartData`.
  - Expanding `SERVED_VARGAS` to all 23 factors in `VARGA_FACTORS` unblocks every varga in `general.varga_dynamics`.
- **Explicit Divisional `house`, `lagna`, `owns`, `aspects_to`, and `dignity` (Gap R3):**
  - Currently `AIAstra_Radha/src/jhora/export.py:887–901` (`_build_placements_json`) omits `house`, `lagna`, `owns`, and `dignity`, and `VARGA_SCOPE` (`natal_export.py:54`) excludes `D16, D27, D40, D45, D81, D108, D144`.
  - In `digest/build.ts:1167`, vargas without `dignities.dN` get **zero `house_card` rows** (`"and no house cards: the engine states no house table for them"`), blinding `vargaDynamics` whenever it inspects `house_card` for deeper vargas!
  - Upgrading `_build_placements_json` and expanding `VARGA_SCOPE` restores full `house_card` + `planet_card` evaluation across all 23 vargas with zero Node `% 12` math.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):**
  - Adds quantitative multi-varga strength (`0..20` scale) to corroborate binary `strong in both` / `debilitated in both` rules.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:881`):**
  ```typescript
  ['D2', 'D4', 'D7', 'D9', 'D10', 'D12', 'D24', 'D30', 'D60', 'D16', 'D20', 'D27', 'D40', 'D45', 'D81', 'D108', 'D144'].map((v) => c('divisional', v))
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('house', "D1 and each frame varga, the frame's houses (lord, lord_dignity, occupants)", 'house_card')`
  - `inp('planet', "D1 and each frame varga, the frame's house lords (dignity)", 'planet_card')`
- **Contract Output Schema:** `'findings.v2'` (deterministic `codeReaderContract`, `system: 'none'`, `user: []`, `synthesizer: 'general.oracle'`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Rule table (`CODE_READER_RULES`):
    - D1 lord strong (`exalted | moolatrikona | own`) in D1 **and** in varga -> `support` (`weight: 2`).
    - Debilitated in both -> `pressure` (`weight: 2`).
    - Strong in one and debilitated in the other -> `neutral` (`weight: 1`, promise and form disagree).
    - Same-house occupancy in D1 and varga -> `neutral` (`weight: 1`, bond repeats).
  - Capped at 8 claims (heaviest first), layer score = `clamp(round(sum / 3), -3, +3)`.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Digest Readiness Gate:** Executes **only** when `kundlis.digest_status === 'ready'`.
  2. **Deterministic Code Reader (`runCodeReadersCached`):** Runs in `< 5 ms` over `DigestView` (`packs/digestSource.ts` `digestSection`) in both Graph and Oracle flows (`src/techniques/use.ts`), storing `findings.v2` in `technique_outputs`. Optional paired LLM reader `R03` remains gated behind spend confirmation.
  3. **Reconcile & Oracle Brief:** Findings join the Oracle brief identically to LLM analyst findings (`analyst: 'varga_dynamics'`).
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts:36, 78, 102`):**
  - `agentIdOf('code:varga_dynamics')` -> `'reading.code.varga_dynamics'`.
  - `techniqueIdOf('code:varga_dynamics')` -> `'general.varga_dynamics'`.
  - `category`: `categoryOfSubject(subject)`.
  - `level`: `'stage'` (or `'cached'` on `technique_outputs` hit, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - `< 5 ms` CPU execution; zero raw `kundli_data` reads; zero LLM calls.
  - Zero Node astrological calculation: varga houses, lords, and dignities are read exclusively from Radha-sourced `kundli_digest` rows.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Emits structured `findings.v2` claims that `general.oracle` weaves into natural guidance (e.g., *"Your outer ambition matches your day-to-day resilience, so steady effort compounds reliably over time."*).
- **Jargon Redaction Rules:**
  - Downstream answers redact all divisional chart names (*Navamsha*, *Dashamsha*, *Shashtiamsha*, *D9*, *D10*, *D60*, *Vargottama*, *Moolatrikona*) and forbid internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation (`evidence[]` Quarantine):**
  - All divisional chart identifiers, house numbers, and dignity labels are strictly quarantined inside structured `evidence[]` arrays (never leaked onto consumer card prose), citing exact digest rows:
    `evidence: ['digest.house.D1.h10.lord_dignity:own', 'digest.house.D10.h10.lord_dignity:exalted', 'digest.planet.D9.Ju.house:1']`.
- **One-Tap "Chart Details":** Displays which divisional lenses reinforced or challenged the primary birth chart promise.
- **Single Past-Event Calibration Question:** When D1 and owning varga disagree (`weight: 1`, promise vs. form split), Clarify asks one plain check on lived outcome vs. outward appearance.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'` in `src/techniques/subagentCachePlan.ts:327–375`). Paired optional `R03` model reader uses `reading_findings_cache` + `parts[0]` prefix caching.
- **Findings & Output Persistence:**
  - Wrapped in `withTechniqueOutput` and persisted in `technique_outputs` (`techniqueCacheKey(v1|general.varga_dynamics|<contractHash>|<kundliId>|d:<digestVersion>|natal|-|-)`); subsequent queries hit `technique_outputs` and record `agent_runs.status = 'cached'`.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts` (`recycledEvery45m: true`).
  - `buildDigest` invalidates stale rows via `deleteKundliTechniqueOutputs`; live hits call `informIndividualCacheUsed({ userId, kundliId })`; inactive outputs recycle after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) via `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliDigest` and `TechniqueOutput` encrypted at rest under `SEALED_MODELS` (`pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
