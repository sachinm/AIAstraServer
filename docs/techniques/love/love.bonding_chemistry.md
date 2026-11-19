# Technique Specification: Bonding, Partner Chemistry & Synastry (`love.synastry_koota` / `love.bonding_chemistry`)

**Technique ID:** `love.synastry_koota` *(aliased to `love.bonding_chemistry` for single-chart natal bonding in `selfCharacterAndJoy.ts:1184`)*  
**Category:** `love`  
**Board:** `love`  
**Status:** `partial` (Natal bonding & chemistry `built` in `selfCharacterAndJoy.ts:1184`; headless Ashtakoota/Dasakoota partner synastry `love.synastry_koota` `planned` per Doc 80 H3 & Doc 81 §3.2)  
**Owning Code Path:** `src/reading/area/selfCharacterAndJoy.ts buildLoveBondingAndChemistry` + planned `src/reading/compatibility/service.ts`  
**Agent ID:** `area.love_board` (single-chart natal bonding) / `reading.analyst.compatibility` (planned synastry agent per Doc 81 §3.2)  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.synastry_koota` (aliased to `love.bonding_chemistry` for individual natal bonding) operates in two complementary modes:
1. **Individual Natal Bonding & Chemistry (Built):** Synthesizes how the user naturally bonds, flirts, builds emotional safety, and recharges in love using Venus (*Shukra*), Moon (*Chandra*), and houses `5` (romance), `7` (covenant), and `8` (emotional depth) across `D1` and `D9`.
2. **Partner Synastry via Headless Ashtakoota & Dasakoota (Planned Priority #2, Doc 80 H3):** Compares two birth charts via Radha's 36-point North Indian **Ashtakoota** and South Indian **Dasakoota** compatibility engines, including classical dosha cancellation rules (*Nadi*, *Bhakoot*, *Rajju*), merged with `D9` and `UL` overlay checks.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` unlocks full two-person synastry alongside enriched single-chart chemistry:

- **Headless Ashtakoota & Dasakoota Compatibility (`AIAstra_Radha/src/jhora/horoscope/match/compatibility.py:521-545`, Gap H3):**
  - `pyjhora` already computes complete 36-guna **Ashtakoota** (`Varna 1`, `Vashya 2`, `Tara 3`, `Yoni 4`, `Graha Maitri 5`, `Gana 6`, `Bhakoot 7`, `Nadi 8`) and South Indian **Dasakoota** (`Mahendra`, `Vedha`, `Rajju`, `Sthree Dheerga`), plus *Nadi*/*Bhakoot*/*Rajju* dosha flags and classical cancellations.
  - Currently no export wrapper exposes this in `AIAstra_Radha/src/jhora/export.py` (`POST /api/export-horoscope` `type: "compatibility"`). Wrapping `compatibility_score` as a headless JSON endpoint lets Server ingest structured koota scores without computing any lunar-mansion math in Node.
- **D9 Navamsha & D7 Saptamsha Structural Enrichment (`varga.d9`, `varga.d7`, Gaps R2 / R3):** Explicit `D9` `house` and `dignity` on `Ve`, `Mo`, `L7`, and `UL` confirm whether partner synastry chemistry translates into long-term marital harmony (`D9` synastry overlay) and shared joy (`D7`).
- **Bhava Bala & Vimsopaka Bala (`strength.bhava`, `strength.vimsopaka`, Gap H6):** Replaces static `SAV` fallbacks (`h8?.sav ?? 27` in `selfCharacterAndJoy.ts:1220`) with true `7th`/`5th`/`8th` Bhava Bala and Venus/Moon Vimsopaka scores.
- **Gochara Vedha on Synastry Transits (Gap H1):** Checks whether current transits over a couple's composite Moon/Venus points support reconnection or require patience.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts` planned registration + existing `selfCharacterAndJoy.ts`)
```typescript
[
  c('natal', 'facts'),
  c('divisional', 'D1'),
  c('divisional', 'D9'),
  c('divisional', 'D7'),
  c('ashtakavarga', 'sav'),
  c('jaimini', 'arudhas'),
  // Priority 2 Synastry addition (new ChartSource/type `'compatibility'`):
  // c('natal', 'compatibility') -> Ashtakoota (36 pts) + Dasakoota + dosha cancellations
]
```

### 3.2 Contract Inputs (`src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D9 houses 5,7,8,4` | `house_card` | Explicit `D9.h7` / `D9.h5` `house_card` + `bhava_bala` + `sav` |
| `planet` | `D1,D9 cards of Ve, Mo, L5, L7` | `planet_card` | `vimsopaka`, `dignity` in `D9`, `star` (*Janma Nakshatra*) |
| `star` | `Moon star and tara compatibility (Self + Partner)` | `star_profile` | Partner star pair for Ashtakoota/Dasakoota |
| `compatibility` *(planned `ContractSection` in `src/techniques/contracts.ts`)* | `Ashtakoota 8 kootas (36 pts) + Dasakoota + dosha cancellations` | `compatibility_card` *(planned `LayoutId` in `src/techniques/layouts.ts`)* | `total_score`, `percentage`, `kootas[]`, `dasakoota`, `doshas` with `has_cancellation` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:**
  - Single-chart mode: `self_personality_joy.v1` (`covenant_trust`, `romantic_spark`, `emotional_safety`, `shared_sanctuary`, `rechargeRule`).
  - Synastry mode (planned): `love_synastry.v1` (`ashtakootaScore`, `maxScore: 36`, `strengthPillars[]`, `frictionAreas[]`, `cancellations[]`, `plainSummary`, `evidence[]`).
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'love.synastry_koota', claim, evidence, polarity, weight, about: 'love.chemistry' }` (aliased to `love.bonding_chemistry` in single-chart mode) to `love.reading.oracle`:
  - `>= 24/36` with Nadi/Rajju clear (or cancelled) + `D9`/`UL` harmony: `support` (`+2.0 .. +3.0`).
  - Uncancelled Bhakoot (`6/8` or `2/12`), Nadi, or Rajju friction: framed constructively as communication/pacing work (`test`, `-1.0 .. -2.0`), never as fatalistic rejection.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:**
  - **Single-chart mode:** **Step 2 (Deterministic Board Computation)** inside `buildLoveBondingAndChemistry` (`selfCharacterAndJoy.ts:1184`).
  - **Synastry mode (Planned):** **Step 1 (`compatibility.evaluate` Radha headless call)** -> **Step 2 (Deterministic Koota + `D9`/`UL` synthesis)** -> **Step 3/4 (`love.reading.oracle` narrative)**.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board` (Step 2 single-chart) / `reading.analyst.compatibility` (Step 1–2 planned synastry).
  - **Tagged `technique_id` (`withAgentRun`):** `love.synastry_koota` (aliased to `love.bonding_chemistry`; `category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'` / `'engine_pull'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Single-chart `< 10 ms` pure TypeScript; synastry Radha call `< 500 ms` (cached per `(primaryKundliId, partnerBirthHash)`).
  - **Zero Node Astrology:** All *Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi*, *Dasakoota*, and dosha cancellations are computed exclusively in Radha (`compatibility.py`) — Node performs zero Nakshatra/Rasi table math.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Warm, practical relational chemistry copy (e.g., *"You connect naturally through shared curiosity and steady everyday gestures; when stress hits, a calm 20-minute reset before serious talks keeps affection effortless."* In synastry: *"Strong emotional rapport and shared values anchor this match, while differing pacing styles benefit from explicit agreements around downtime."*).
- **Jargon Redaction Rules:** Strictly strips *Ashtakoota*, *Dasakoota*, *Guna*, *Varna*, *Vashya*, *Yoni*, *Gana*, *Bhakoot*, *Nadi Dosha*, *Rajju*, *Mahendra*, *Shukra*, *D9*, and internal engine names (`Radha`, `pyjhora`). Never outputs raw `XX/36` compatibility verdicts as pass/fail doom.
- **Evidence Array Encapsulation:** Technical scores live strictly in `evidence[]` (e.g., `['ashtakoota:28.5/36:favorable', 'koota:graha_maitri:5/5', 'dosha:bhakoot_6_8:cancelled=false', 'D9.Ve:Libra']`).
- **One-Tap "Chart Details":** Displays the 8 harmony dimensions and any classical cancellation notes in the expandable technical drawer.
- **Single Past-Event Calibration Question:** When evaluating an existing partner, asks one check-in question about communication rhythm during disagreements.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` for deterministic koota/chemistry assembly (`cacheStore: 'none_deterministic_code'`). Feeds `love.reading.oracle` (`lineman.love`) where the primary chart's natal slice sits in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`) and partner synastry summary enters `parts[1]`.
- **Findings & Output Persistence:** Single-chart chemistry caches in `area_builds` / `technique_outputs`; synastry results cache in `technique_outputs` keyed by `(kundliId, partnerBirthHash, digestVersion)`.
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`) — a user may only run compatibility against a partner profile they explicitly created under their own account, never querying another user's private kundli.
  - `AreaBuild`, `TechniqueOutput`, `KundliDigest`, and partner compatibility payloads are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
