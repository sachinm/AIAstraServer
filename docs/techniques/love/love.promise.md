# Technique Specification: Natal Promise of Love & Partnership (`love.promise`)

**Technique ID:** `love.promise`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/houseLayers.ts promiseLayer` (`src/reading/area/love.ts LOVE`, `src/reading/area/boardService.ts getAreaBoard`)  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.promise` quantifies the baseline natal foundation for partnership, romance, and relational stability across houses `7, 5, 11, 2, 4, 8, 12` (anchored on the 7th Bhava, its lord, *Shukra*/Venus, Moon, Jupiter, `UL`, `A7`, `DK`, and `AL`). It converts stored house cards, planet dignities, functional natures, SAV bindus, yogas, and avastha ripeness multipliers into plain-language support rows with traceable digest keys.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` upgrades `love.promise` from basic D1 heuristics to full classical strength and divisional depth:

- **Bhava Bala (`strength.bhava`, Gap H6):** `src/reading/chartData/catalog.ts:197` leaves `strength.bhava` as `served: false`, even though `_build_bhava_bala` (`AIAstra_Radha/src/jhora/natal_export.py:270-291`) already computes `bhavadhipati`, `dig`, `drik`, total virupas, rupas, ratio, and rank for all 12 houses. Unlocking it lets `promiseLayer` score top-4 vs bottom-4 Bhava Bala ranks for houses `7` (covenant), `5` (romance), `2` (family), `4` (emotional peace), and `12` (intimacy).
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):** Flipping `served: true` on `catalog.ts:198` supplies 20-point *Shadvarga*/*Dashavarga* composite strength for Venus, the 7th lord, and Dara Karaka (`DK`), separating genuine enduring promise (`>= 15/20`) from surface D1 appearances.
- **D9 Navamsha & D7 Saptamsha Structural Enrichment (`varga.d9`, `varga.d7`, Gaps R2 / R3):** Upgrading Radha's `_build_placements_json` (`export.py:887`) to emit explicit `house` (1..12), `lagna`, `owns`, `aspects_to`, and `dignity` removes `house: null` fallbacks in `digest/build.ts:612` and allows `love.promise` to verify `D9` 7th-house and `D7` 5th/7th-house support cleanly.
- **D30 Trimshamsha Unlock (`varga.d30`, Gap R2):** Expanding `SERVED_VARGAS` (`catalog.ts:133`) unlocks `D30`, letting `love.promise` cross-check hidden relational vulnerabilities against natal supports.
- **Bhava Chalit Shifts (`houseShift`, Gap H8):** Identifies when Venus or the 7th lord shifts between Rasi and Bhava Chalit houses so `promiseLayer` does not misattribute house occupancy.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:600, 663-667`)
```typescript
[
  c('natal', 'facts'),
  c('natal', 'house_counts'),
  c('natal', 'dignities'),
  c('natal', 'aspects'),
  c('jaimini', 'argala'),
  c('ashtakavarga', 'sav'),
  c('natal', 'strength.bhava'),
  c('natal', 'yogas'),
  c('natal', 'doshas'),
  c('jaimini', 'arudhas'),
  c('natal', 'avasthas'),
  // Priority 2 additions:
  // c('natal', 'strength.vimsopaka'), c('divisional', 'D9'), c('divisional', 'D7')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:575-578, 608`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `house` | `D1,D9,D7,D30 houses 7,5,11,2,4,8,12` | `house_card` | `bhava_bala` ranks/ratios; explicit `D9`/`D7`/`D30` house cards |
| `planet` | `D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord` | `planet_card` | `vimsopaka` (0..20), `avastha_multipliers`, `houseShift` |
| `point` | `UL, A7, DK, AL` | `point_row` | Explicit `D1` & `D9` house/lord mappings for `UL`, `A7`, `DK` |
| `yoga` | `yogas and doshas joining houses 7, 5, 11, 2, 4, 8, 12 or their lords or Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord` | `yoga_row` | Raja/Subha yogas & cancellations touching `L7`, `Ve`, `Mo` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `area_board.v1` (array of deterministic support rows with `evidence[]` keys, feeding `love.meet`, `love.health`, `love.reconcile`, and `love.reading.oracle`).
- **Synthesis Payload (`findings_in`):** Emits `{ technique: 'love.promise', claim, evidence, polarity: 'support', weight, about: 'love' }`:
  - Lord in own/kendra/trikona (`+2`), dignified lord (`+2`), benefic occupants/drishti (`+1` each), `SAV >= 28` (`+1`), yoga register (`+1..+2`), scaled by lord avastha (`x0.5` *mrita/sushupta*, `x1.25` *jagrat/deepta*) and `bhava_bala` rank, capped to `[-8, +8]` (mapped to `[-3 .. +3]` in `findings_in`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Deterministic Board Computation)** in `boardService.ts getAreaBoard` -> `houseLayers.ts buildBoard` (`promiseLayer`), after `digest.build` (Step 1) and before `love.reading.oracle` (Steps 3–4).
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.promise` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript selection and weighted summation over `DigestView` (`< 10 ms`). Zero LLM calls; zero Node astrological math (house classes, dignities, functional natures, argala, and Bhava Bala come verbatim from Radha/digest).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates relational strengths into warm, plain second-person affirmations (e.g., *"You bring natural warmth and steady loyalty into close partnerships, especially when honesty and shared values come first."*).
- **Jargon Redaction Rules:** Strictly strips *Bhava Bala*, *Vimsopaka*, *SAV*, *Graha Drishti*, *Avastha*, *Jagrat/Mrita*, *Upapada Lagna*, *Darakaraka*, *Shukra*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Every support line carries exact digest keys in `evidence[]` (e.g., `['D1.h7:lord=Ve:kendra', 'D1.h7.sav:31', 'bhava_bala:h7:rank2', 'vimsopaka:Ve:16.2']`).
- **One-Tap "Chart Details":** Reveals the underlying house/planet support rows, `SAV` score, and `Bhava Bala` rank when the user opens the research lens.
- **Single Past-Event Calibration Question:** Supports `love.status` gating (`single`, `dating`, `committed`, `married`, `separated`, `complicated`) and confirms baseline relational patterns without yes/no marriage verdicts.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `love.reading.oracle` (`family.rasi`, `lineman.love`) where the immutable natal Love slice sits in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Stored in `area_builds` (`area: 'love'`) and `technique_outputs` (`techniqueCacheKey` with `freshness: 'natal'`).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `KundliDigest`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
