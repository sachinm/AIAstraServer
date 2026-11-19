# Technique Specification: Vedic Moon & Mercury Personality and Joy & Fulfillment (`self.personality_joy`)

**Technique ID:** `self.personality_joy`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 enhancement ready)  
**Owning Code Path:** `src/reading/area/selfCharacterAndJoy.ts` (`buildSelfPersonalityAndJoy`); `src/reading/area/houseLayers.ts` (`buildBoard`)  
**Agent ID:** `area.self_board` (downstream consumer: UI `/you` Personality & Joy card, `self.v2.mind`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.personality_joy` synthesizes what genuinely restores, delights, and intellectually energizes the native by pairing **Moon (*Chandra*: emotional rhythm, *Manas*)** and **4th house (*Sukha Bhava*)** with **Mercury (*Budha*: curiosity, wit, play, *Buddhi*)**, **5th house (creative joy)**, and **3rd house (hands-on craft)** across `D1`, `D9`, and `D24` plus Janma Nakshatra. It renders four clear, practical pillars—*Everyday Joy & Flow*, *Mind, Curiosity & Play*, *Social & Creative Recharge*, and *Restorative Sanctuary*—with zero chart jargon and zero Node house arithmetic.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `self.personality_joy`:

- **D24 Chaturvimshamsha Structural Unlock & Explicit House Mapping (Gaps R2 & R3):**
  - **Critical Unlock:** `self.personality_joy` explicitly declares `c('divisional', 'D24')` (`catalog.ts:732`), yet `D24` is currently **blocked** by `SERVED_VARGAS = new Set([1, 2, 4, 7, 9, 10])` (`src/reading/chartData/catalog.ts:133`)!
  - Furthermore, Radha `_build_placements_json` (`export.py:887–901`) omits explicit `house`, `lagna`, `owns`, and `dignity` on `varga.d24` rows.
  - Expanding `SERVED_VARGAS` to all 23 vargas and upgrading `_build_placements_json` immediately unlocks `D24` houses `1, 3, 4, 5, 11, 12` and `D24` Mercury/Jupiter placements for `buildSelfPersonalityAndJoy`.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6) & Bhava Bala (`strength.bhava`, Gap H6):**
  - Measures multi-varga vitality of Moon and Mercury (`vimsopaka_score`) and composite strength of `4H` (Sukha) and `5H` (Buddhi), grading whether emotional restoration comes effortlessly or requires deliberate boundaries.
- **Sudarshana Chakra Chandra Wheel (`dhasa/sudharsana_chakra.py`, Gap H4):**
  - Provides the dedicated Moon-centric wheel (`wheels.moon`) showing which houses and planets sit around emotional orientation (`Chandra Lagna`) without Node performing any `% 12` offset math.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:726`):**
  ```typescript
  [
    c('natal', 'facts'), c('natal', 'dignities'), c('natal', 'aspects'),
    c('divisional', 'D1'), c('divisional', 'D9'), c('divisional', 'D24'),
    c('nakshatra', 'janma'), c('natal', 'strength.vimsopaka'),
    c('natal', 'strength.bhava'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('house', 'D1,D9,D24 houses 1,3,4,5,11,12', 'house_card')`
  - `inp('planet', 'D1,D9,D24 cards of Mo, Me, L4, L5, L3, Ju, Ve (plus vimsopaka_score)', 'planet_card')`
  - `inp('star', 'Moon star, lagna star and tara table', 'star_profile')`
- **Contract Output Schema:** `'self_personality_joy.v1'` — structured four-pillar payload:
  - `everydayJoyAndFlow` (Moon + 4H)
  - `mindCuriosityAndPlay` (Mercury + 5H + D24)
  - `socialAndCreativeRecharge` (3H + 11H + Moon/Mercury)
  - `restorativeSanctuary` (D9 Moon + 4H/12H)
  - Each pillar carries plain-English takeaways + `evidence: string[]`.
- **Oracle Synthesis Payload (`findings_in`):**
  - Streamed directly to the `/you` board via NDJSON and available to `self.v2.mind` / `self.reading_oracle` as behavioral grounding.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Digest Build (`digest.build`):** Populates `D1`, `D9`, and (post-Priority #2 unlock) `D24` `house_card` & `planet_card` rows, `StarProfile.moonStar`, and `strength.vimsopaka` / `strength.bhava`.
  2. **Deterministic Synthesis (`buildSelfPersonalityAndJoy`):** Executes inside `houseLayers.ts` (`buildBoard`) over `DigestView` (zero DB queries, zero LLM calls).
  3. **Progressive Streaming:** Emitted in the initial deterministic wave of `GET /api/dashboard/sections-stream` (`application/x-ndjson`).
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'`.
  - **Tagged `technique_id` (`withAgentRun`):** `'self.personality_joy'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (deterministic code step, `< 15 ms`, `0` model calls).
- **Execution Boundary & Runtime Limits:**
  - Strictly enforces zero `% 12` house arithmetic in Node (`GEMINI.md` Rule #11): every `D1`, `D9`, and `D24` house placement is read from Radha-computed `house_card` / `planet_card` rows.
  - Budget: `< 15 ms` runtime.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Renders warm, concrete, everyday lifestyle suggestions across the 4 pillars (e.g., *"You recharge fastest through tactile, hands-on hobbies and unhurried conversations with one or two trusted friends rather than large, noisy gatherings."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Chandra*, *Budha*, *Manas*, *Buddhi*, *Sukha Bhava*, *D24*, *Chaturvimshamsha*, *Janma Nakshatra*, *D9*, *Drishti*, *Vimsopaka*, *Bhava Bala*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All astrological citations reside in `evidence[]`:
    `['digest.planet.D1.Mo.house:4', 'digest.planet.D24.Me.dignity:own', 'digest.star.moon:Rohini', 'digest.house.D9.h4.aspected_graha:Ju']`.
- **One-Tap "Chart Details":** Shows Moon & Mercury signs/houses/stars across D1/D9/D24 and 4th/5th house influences.
- **Single Past-Event Calibration Question:** Confirms recharge style: *"Do you feel most genuinely recharged after deep one-on-one curiosity rabbit holes or quiet creative making?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - Deterministic code technique (`cacheStore: 'none_deterministic_code'`). Zero LLM tokens spent.
- **Findings & Output Persistence:**
  - Stored in `technique_outputs` under `techniqueCacheKey(v1|self.personality_joy|<contractHash>|<kundliId>|d:<digestVersion>|natal|-|-)`, and materialized in `area_builds`.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`; prewarmed with `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`; evicted after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) by `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - Sealed at rest under `SEALED_MODELS` (`KundliData`, `KundliDigest`, `TechniqueOutput`, `AreaBuild`) using `pii2:v1` AES-256-GCM.
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
