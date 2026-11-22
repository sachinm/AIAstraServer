# Technique Specification: Nakshatra Charter of Houses 1, 4 and 5 (`self.nakshatra`)

**Technique ID:** `self.nakshatra`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 enhancement ready)  
**Owning Code Path:** `src/reading/area/houseLayers.ts` (`nakshatraLayer`); `src/reading/area/self.ts` (`SELF`)  
**Agent ID:** `area.self_board` (upstream: `digest.build`; downstream: `self.sub.mind_facts`, `self.v2.oracle`, `self.reading_oracle`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.nakshatra` reads the lunar-mansion (Nakshatra) architecture behind the Self board: the cusp stars of houses `1, 4, 5, 9, 12`, the natal Moon's Janma Nakshatra and its Tara Bala table, the Lagna star, Gandanta flags, and pending karma houses (`avasthas.lunar_astro.pending_karma`). It determines *how* and *through whom* a running period delivers its results—boosting confidence when a running period lord's star lord aligns with the house lord or natural karaka.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `self.nakshatra`:

- **Divisional Cusp Stars & Pada Precision Across 23 Vargas (Gaps R2 & R3):**
  - Upgrading Radha `_build_placements_json` (`export.py:887–901`) to emit top-level `lagna` (`nakshatra`, `pada`, `star_lord`) across all 23 vargas (`D1, D9, D20, D24, D60`) lets `self.nakshatra` cross-reference not only D1 cusp stars, but also the `D9` Navamsha Lagna star and planetary star-lord chains in divisional charts.
- **Daily Grade & Tara Bala Engine Alignment (`daily_grade`, Gap H5):**
  - Currently marked `served: false` in `src/reading/chartData/catalog.ts:261`.
  - Radha `daily_export.py:429–450` (`_run_daily_grade`) computes live daily Moon Nakshatra, Janma Tara Bala (`1..9`: Janma, Sampat, Vipat, Kshema, Pratyak, Sadhana, Naidhana, Mitra, Parama Mitra), and transition events—aligning static natal Tara profiles with live daily star resonance for `self.now`.
- **Sarvatobhadra Chakra Nakshatra Vedha (`ui/chakra.py`, Gap O1):**
  - Headless extraction of Sarvatobhadra Chakra maps planetary transit Vedha directly onto the natal Janma Nakshatra, Lagna Nakshatra, and 28-nakshatra grid (including Abhijit), giving `self.nakshatra` precise star-level obstruction detection.
- **Vimsopaka & Harsha Bala on Star Lords (Gap H6):**
  - Evaluates the multi-varga and trik-house strength of the cusp star lords and Moon star lord instead of checking D1 dignity alone.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:654`):**
  ```typescript
  [
    c('nakshatra', 'cusp_nak'), c('nakshatra', 'star_lord'),
    c('nakshatra', 'occupant_stars'), c('nakshatra', 'janma'),
    c('transit', 'daily_grade'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('star', 'Moon star, lagna star and the tara table, gandanta flags, pending karma houses', 'star_profile')` — columns: `point`, `star`, `pada`, `star_lord`, `tara`, `gandanta`, `pending_karma_houses`.
  - `inp('house', 'D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12 (cusp_star column)', 'house_card')`
  - `inp('planet', 'D1 and D9 cards of the lagna lord, Moon, Sun, 4th and 5th lords, star lords, and running PD lords', 'planet_card')` — includes `star`, `star_chain`, `dignity`, `vimsopaka`.
- **Contract Output Schema:** `'area_board.v1'` (feeds `self.sub.mind_facts` and `self.v2.oracle`).
- **Oracle Synthesis Payload (`findings_in`):**
  - `{ technique: 'self.nakshatra', claim: string, evidence: string[], polarity: 'support' | 'pressure', weight: number, confidenceBoost: boolean }`.
  - Weight formula: Primary house cusp star lord dignified or functional benefic in D1 (`+1.0` support) / debilitated (`-1.0` pressure); running PD lord's star lord equals the house lord or area karaka (`+1.5` support, raises confidence by one step); Sarvatobhadra Vedha on Janma Nakshatra moderates transit claims.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Digest Star Profile (`digest.build`):** Extracts `facts.nakshatra_profile`, `avasthas.lunar_astro.pending_karma`, `facts.houses` cusp stars, and `star_chain` into `kundli_digest`.
  2. **Deterministic Nakshatra Charter (`self.nakshatra`):** Runs `nakshatraLayer` in `houseLayers.ts`, matching cusp star lords and active PD star lords against the reviewed charter table.
  3. **Mind & Oracle Consumption (`self.sub.mind_facts`, `self.v2.oracle`):** Incorporates Moon star, Gandanta, and star-lord delivery cues into personality and timing cards.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'`.
  - **Tagged `technique_id` (`withAgentRun`):** `'self.nakshatra'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic code step, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - Deterministic evaluation `< 10 ms`.
  - Zero Node astrology: Nakshatra boundaries, pada, Tara classifications, Gandanta flags, and Sarvatobhadra Vedhas originate strictly in Radha; Node only looks up reviewed charter lines by star key.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates star-level drivers into nuanced emotional and behavioral tendencies (e.g., *"You process decisions intuitively first and verify them through detail afterward; when your environment feels unsettled, creative routines restore your focus fastest."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Nakshatra*, *Janma*, *Pada*, *Tara Bala*, *Vipat*, *Naidhana*, *Gandanta*, *Sarvatobhadra*, *Vedha*, *Pratyantardasha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - Star mechanics remain solely in `evidence[]`:
    `['digest.star.moon:Anuradha.pada2', 'digest.house.D1.h1.cusp_star:Uttara_Bhadrapada', 'digest.planet.D1.PD_lord.star_lord:L1', 'sbc.janma_vedha:clear']`.
- **One-Tap "Chart Details":** Displays Birth Moon star, Ascendant star, Pada, star-lord linkage, and Gandanta status (if present).
- **Single Past-Event Calibration Question:** Checks instinctive temperament: *"When you hit a fork in the road, do you usually trust an immediate gut sense first, or map out every option on paper?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Deterministic code step (`cacheStore: 'none_deterministic_code'`).
  - Feeds `star_profile` and star-lord chains into `family.rasi` and `self.v2.oracle` cached natal prefixes (`parts[0]` $\ge 1024$ tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:**
  - Stored inside `technique_outputs` keyed by `techniqueCacheKey(v1|self.nakshatra|<contractHash>|<kundliId>|d:<digestVersion>|natal|-|-)`.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`; prewarmed with `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`; evicted after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) by `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Sealed at rest under `SEALED_MODELS` (`KundliDigest`, `TechniqueOutput`, `AreaBuild`) with `pii2:v1` AES-256-GCM.
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.

## Who reads this technique (corrected 2026-11-22, `docs/techniques/11` rev 4 §4.9)

The lines above name `self.v2.oracle` (and other `self.v2.*` ids) as the reader. Checked on `develop` on 2026-11-22:

- **Today** the v2 Self build still runs (its retirement is built behind flags that are off), so the v2 Oracle is
  still one reader, beside the per-card pipeline.
- **In the preparation build** this technique's output is read through `self.sub.mind_facts` and the `family.star` reader by the natal core and the dated frame (`slices/natalPrefix.ts`), and from there by the family
  readers, the period readers, the lens linemen and the card Oracle. The v2 Oracle is not a reader on that
  path, and the preparation build never goes through `runSelfV2Build`.
- The technique ids `self.v2.oracle`, `self.v2.personalizer` and `self.v2.hero` are retired in the same change that
  switches `SELF_V2_RETIRED` on; until then the catalogue keeps them.
