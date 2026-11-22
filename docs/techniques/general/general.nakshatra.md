# Technique Specification: Nakshatra Analyst (`general.nakshatra`)

**Technique ID:** `general.nakshatra`  
**Category:** `general`  
**Board:** `chat`  
**Status:** `built` (Priority #2 `daily_grade`, `Sarvatobhadra Chakra`, & divisional cusp star enhancement ready)  
**Owning Code Path:** `src/reading/nodes/specialists.ts`; `src/reading/packs/selector.ts` (`ANALYST_SECTIONS.nakshatra`); `src/reading/prompts/v2/nakshatra.md`  
**Agent ID:** `reading.analyst.nakshatra` (subagent slices: `specialist:nakshatra`, `code:nakshatra`; downstream: `general.oracle`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.nakshatra` examines the lunar-mansion (Nakshatra) layer of any General Reading query: the native's Janma Nakshatra (Moon star) and Lagna star, Tara Bala table, Gandanta flags, the cusp stars of the subject's frame houses, and the star-lord chains of running dasha lords and transiting planets. It reveals *how* and *through what channel* an activated house delivers its outcome, flagging star-level sensitivity, pending karma themes, and Tara alignments.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `general.nakshatra`:

- **Sarvatobhadra Chakra (`ui/chakra.py` headless extraction, Gap O1):**
  - Headless extraction of the 81-square **Sarvatobhadra Chakra** maps planetary transit Vedha (*front, right, left* rays) across the 28 Nakshatras (including Abhijit), Rasis, Tithis, Weekdays, and phonetic letters.
  - Gives `specialist:nakshatra` exact star-level Vedha warnings when a transiting planet strikes the native's Janma Nakshatra, Karma Nakshatra (10th from Janma), or Sanghatika Nakshatra (16th).
- **Enabling `daily_grade` (`daily_export.py:429–450`, Gap H5):**
  - Currently `served: false` in `src/reading/chartData/catalog.ts:261`. Unlocks live Tara Bala (`1..9`) and Moon Nakshatra transition events for short-horizon (`now`) star checks.
- **Divisional Lagna & Placement Nakshatras Across 23 Vargas (`export.py:887`, Gaps R2 & R3):**
  - Upgrading `_build_placements_json` to emit top-level `lagna` (`nakshatra`, `pada`, `star_lord`) across all 23 vargas (`D1..D60`) lets `general.nakshatra` inspect divisional cusp/lagna stars (`D9` Lagna star, `D10` Lagna star) alongside D1.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:949`):**
  ```typescript
  [
    c('natal', 'facts'), c('nakshatra', 'janma'),
    c('dasha', 'vimshottari'), c('transit', 'transit_overlay'),
    c('transit', 'daily_grade'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('star', 'Moon star, lagna star, the tara table, gandanta flags, pending karma houses', 'star_profile')`
  - `inp('house', "D1 and frame vargas, the frame's houses (cusp_star column)", 'house_card')`
  - `inp('planet', "D1 cards of the star lords of the frame's cusps, the Moon, and running dasha lords (star_chain column)", 'planet_card')`
- **Contract Output Schema:** `'findings.v2'` (`system: 'src/reading/prompts/v2/nakshatra.md'`, `user: ANALYST_USER_FIELDS`, `synthesizer: 'general.oracle'`).
- **Oracle Synthesis Payload (`findings_in`):**
  - Structured findings citing exact `star_profile`, `house_card.cusp_star`, and `planet_card.star_chain` digest IDs, weighted `1..3` by whether star lords sit in supportive houses or Gandanta/Sarvatobhadra Vedha introduces friction.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Clarify Prewarm (`general.clarify`):** `prewarmNatalLayers` warms `FullContext.prefix` (`parts[0]`) and pre-populates natal `specialist:nakshatra` into `reading_findings_cache`.
  2. **Graph Specialist Execution (`runSpecialist`):** Checks `reading_findings_cache` (`horizonKey: 'natal'`); runs in parallel with other selected analysts and deterministic `code:nakshatra`.
  3. **Oracle Synthesis (`general.oracle`):** Weaves star-lord delivery nuances into the final reading.
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts`):**
  - `agentIdOf('nakshatra')` -> `'reading.analyst.nakshatra'`. Note: `code:nakshatra` is a digest slice key in `src/reading/oracle/digestSlices.ts`; `trace.ts` `CODE_READERS` only maps `varga_dynamics`, `strength_yoga`, `jaimini`, and `person` (`code:nakshatra` rolls up as `'reading.step'` / `null` unless registered in `CODE_READERS`).
  - `techniqueIdOf('nakshatra')` -> `'general.nakshatra'`.
  - `category`: `categoryOfSubject(subject)`.
  - `level`: `'stage'` (`nakshatra|subject`) and `'model_call'` (`specialist:nakshatra|subject`).
- **Execution Boundary & Runtime Limits:**
  - Bounded by interactive AI fan-out timeout (`<= 10 s`); zero live Radha calls during chat queries when `kundli_digest` is ready.
  - Zero Node astrology: Nakshatra padas, Tara counts, Gandanta flags, and Sarvatobhadra Vedhas originate strictly in Radha.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates lunar-star nuances into intuitive behavioral instincts and timing flavors (e.g., *"Your decisions work best when you start quietly behind the scenes rather than announcing moves early."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on consumer surfaces: *Nakshatra*, *Pada*, *Tara Bala*, *Gandanta*, *Sarvatobhadra*, *Vedha*, *Janma*, *Sanghatika*, *Star Lord*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All star identifiers remain inside `evidence[]`:
    `['digest.star.moon:Pushya.pada3', 'digest.house.D1.h10.cusp_star:Ashwini', 'digest.planet.D1.AD_lord.star_lord:Ve', 'sbc.janma_vedha:Ma_front']`.
- **One-Tap "Chart Details":** Displays Birth Moon star, Ascendant star, Pada, star-lord links, and active Tara/Vedha notes.
- **Single Past-Event Calibration Question:** Clarify confirms behavioral style when star-lord chains point strongly inward vs. outward.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache (`src/techniques/subagentCachePlan.ts:221–275`):**
  - `cacheStore: 'gemini_cached_contents+llm_cache_entries'`, `ttlSeconds: 3600`.
  - Natal `FullContext.prefix` cached in `parts[0]` (`cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:**
  - Persisted in `reading_findings_cache` under `findingsKey({ kundliId, analyst: 'nakshatra', subject, packHash, horizonKey: 'natal', promptVer })` (reusable across horizons because natal star patterns do not expire with daily horizons).
- **45-Minute Inactivity Lifecycle:**
  - Prewarming leaves `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`.
  - `recycleIndividualCaches` deletes remote Gemini `cachedContents` and evicts inactive `llm_cache_entries` + `reading_findings_cache` after `READING_CACHE_RECYCLE_MINUTES` (`45`).
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliDigest`, `ReadingFindingsCache`, and `ReadingRun` sealed at rest under `SEALED_MODELS` (`pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
