# Technique Specification: Jaimini Karakamsha & Swamsha Analyst (`general.jaimini_karakamsha`)

**Technique ID:** `general.jaimini_karakamsha`  
**Category:** `general`  
**Board:** `chat` (cross-routed to `you` and `work` boards)  
**Status:** `planned` (Priority #2 Gap R6 — new technique specification)  
**Owning Code Path:** `src/reading/codeReaders/readers.ts` (`jaiminiKarakamsha` — proposed); `src/reading/area/houseLayers.ts`; `src/techniques/catalog.ts`  
**Agent ID:** `reading.code.jaimini` / `reading.code.jaimini_karakamsha` (paired optional model reader: `R04`)  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`general.jaimini_karakamsha` closes Priority #2 Required Gap **R6** (`docs/reading-engine/80-radha-and-catalogue-gap-analysis.md:47`) by systematically evaluating **Karakamsha Lagna (`KL`)**—the sign occupied by the Atmakaraka (`AK`) in Navamsha (`D9`), projected back onto `D1`—and **Swamsha** (reading `D9` directly with the `AK` sign as the ascendant). Unlike the existing `general.jaimini` (`catalog.ts:980`), which only checks D1 Chara Karakas, Arudha house classes, and Argala, `general.jaimini_karakamsha` unlocks classical Jaimini soul-aim, innate vocation (10th from `KL` and occupants of `KL`), spiritual inclination (12th from `KL` / Ketu), and subconscious talent routing into Self, Work, and General Reading synthesis.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` required by `general.jaimini_karakamsha`:

- **Karakamsha Lagna (`KL`) & Swamsha Reference Frame in Radha + Digest (`Gap R6`):**
  - Currently Radha exports `charakaraka` (`AK..DK`) and `varga.d9`, while `digest/build.ts` places `AK` in `D9` as `point D9.AK`, leaving `KL` (the `D1` house corresponding to `AK`'s `D9` sign) and **relative houses from `Swamsha` (`D9` houses counted from `AK`)** unexported as first-class `point_row` / `house_card` structures.
  - Because Node is **strictly forbidden** from computing `(sign_i - ak_sign_i) % 12 + 1` (`AGENTS.md`, `GEMINI.md`), Radha (`natal_export.py`) must compute and export the pre-mapped `karakamsha` frame (`kl_sign`, `kl_house_in_d1`, `occupants_in_d1`, `aspects_on_kl`, `houses_from_kl: 1..12` in D1 and `swamsha_houses: 1..12` in D9).
- **D9 Explicit `house`, `lagna`, `owns`, `aspects_to`, and `dignity` (`Gap R3`):**
  - Ensures `D9` planetary dignities, Rasi Drishti (Jaimini sign aspects), and `D9.AK` placement are complete in `kundli_digest`.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):**
  - Grades the multi-varga potency of the `AK` planet and the lords of the 9th/10th/12th from `KL`/`Swamsha`.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` to register in `src/techniques/catalog.ts`):**
  ```typescript
  [
    c('jaimini', 'charakaraka'), c('jaimini', 'arudhas'),
    c('divisional', 'D1'), c('divisional', 'D9'),
    c('natal', 'dignities'), c('natal', 'aspects'),
    c('natal', 'strength.vimsopaka'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('point', 'D1 and D9 AK, AmK, and engine-exported Karakamsha (KL) / Swamsha reference points', 'point_row')`
  - `inp('house', 'D1 houses from Karakamsha (1, 5, 9, 10, 12 from KL) and D9 Swamsha houses', 'house_card')`
  - `inp('planet', 'D1 and D9 cards of AK, AmK, planets in KL/Swamsha, and Ketu/Jupiter/Saturn', 'planet_card')`
- **Contract Output Schema:** `'findings.v3'` while `status: 'planned'` (strictly complying with `tests/unit/techniques/contracts.test.ts:57`, which requires `'findings.v3'` for planned `general.oracle` techniques; `contract.inputs` may also remain `[]` while `planned` per `src/techniques/contracts.ts:134`; also consumable by `self.reading.atma`, `self.character_arc`, and `work.reading.vocation` once built).
- **Oracle Synthesis Payload (`findings_in`):**
  - Deterministic claims (`<= 8` claims, `weight: 1..2`) derived from a reviewed Jaimini Sutras rule table (e.g., *Jaimini Upadesa Sutras 1.2*):
    - Benefics (Jupiter/Venus/Mercury/waxing Moon) in or aspecting `KL`/`Swamsha` -> innate skill & ethical clarity (`support`, `weight: 2`).
    - Ketu in 12th from `KL` or 12th lord strong from `KL` -> contemplative/moksha orientation (`support/neutral`, `weight: 1`).
    - 10th from `KL` / `Swamsha` occupied or aspected by Mercury/Sun/Saturn/Mars -> concrete vocational archetype (`support`, `weight: 2`).
    - Malefic/node affliction on `KL` without benefic aspect -> restless ambition / testing ego lessons (`pressure`, `weight: 1`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Digest Build (`digest.build`):** Ingests Radha's `karakamsha` / `swamsha` export into `kundli_digest` (`point` and `house` sections) with zero Node house arithmetic.
  2. **Deterministic Code Reader (`general.jaimini_karakamsha`):** Executes in `< 5 ms` inside `runCodeReadersCached` (`src/reading/codeReaders/readers.ts`) when `kundli_digest` is ready, and injects structured `KL`/`Swamsha` claims into `self.reading.atma` and `work.reading.vocation`.
  3. **Oracle Synthesis (`general.oracle`):** Merges claims into the General Reading brief.
- **AsyncLocalStorage Trace Span (`src/reading/metrics/trace.ts`):**
  - Register `'jaimini_karakamsha'` in `CODE_READERS` (`src/reading/metrics/trace.ts:36`) and `AGENTS` (`src/agents/registry.ts`).
  - `agentIdOf('code:jaimini_karakamsha')` -> `'reading.code.jaimini_karakamsha'`.
  - `techniqueIdOf('code:jaimini_karakamsha')` -> `'general.jaimini_karakamsha'`.
  - `category`: `categoryOfSubject(subject)` (`self | work | general`).
  - `level`: `'stage'` (deterministic code reader, `0` LLM calls).
- **Execution Boundary & Runtime Limits:**
  - `< 5 ms` CPU budget; zero raw `kundli_data` queries on request path.
  - Strict zero-math rule: Node never calculates relative house offsets from `D9.AK` using modular arithmetic; Radha must supply all `KL` and `Swamsha` house mappings.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates Jaimini soul-purpose and vocational aptitudes into clear, motivating second-person insights (e.g., *"You are naturally wired for work that blends analytical craft with teaching or mentoring—purely administrative roles leave you restless."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on consumer surfaces: *Karakamsha*, *Swamsha*, *Atmakaraka*, *Amatyakaraka*, *Jaimini*, *Rasi Drishti*, *Navamsha*, *D9*, *Moksha*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All Jaimini markers remain inside `evidence[]`:
    `['digest.point.D9.AK:Me_Virgo', 'digest.point.D1.KL:h7_Virgo', 'digest.house.KL.h10.occupants:Ju', 'digest.house.KL.h12.occupants:Ke']`.
- **One-Tap "Chart Details":** Displays the native's core temperament planet (`AK`), inner-purpose lens (`KL`/`Swamsha`), and 10th-from-purpose vocational drivers.
- **Single Past-Event Calibration Question:** Grounds innate calling in lived history: *"Have you consistently felt most alive when your work lets you teach, build, or solve deep problems independently?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds concise `KL`/`Swamsha` claims into downstream `general.oracle`, `self.v2.oracle`, and `work.reading_oracle` prefixes.
- **Findings & Output Persistence:**
  - Wrapped in `withTechniqueOutput` and stored in `technique_outputs` (`techniqueCacheKey(v1|general.jaimini_karakamsha|<contractHash>|<kundliId>|d:<digestVersion>|natal|-|-)`); invalidated by `buildDigest` (`deleteKundliTechniqueOutputs`).
- **45-Minute Inactivity Lifecycle:**
  - Register `'general.jaimini_karakamsha': ['code:jaimini_karakamsha', 'R04']` in `src/techniques/subagentCachePlan.ts` (`recycledEvery45m: true`).
  - Live reads call `informIndividualCacheUsed({ userId, kundliId })`; inactive outputs recycle after 45 minutes (`READING_CACHE_RECYCLE_MINUTES=45`) via `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliDigest` and `TechniqueOutput` encrypted at rest under `SEALED_MODELS` (`pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.
