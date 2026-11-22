# Technique Specification: Karaka Clock (`work.karaka_family`)

**Technique ID:** `work.karaka_family`  
**Category:** `work`  
**Board:** `work`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/career.ts workKarakaVote, presentState`; `src/reading/area/careerService.ts getCareer`  
**Agent ID:** `area.career_inputs`, `area.career_map`  
**Accuracy Check:** `staff`

---

## 1. Executive Summary & Purpose

`work.karaka_family` casts the **Karaka Clock** vote (`support`, `test`, or `neutral`) for `work.present_tone` by reading level-3 Jaimini/Parashari Karaka dasha periods covering the current month. It checks whether the active period lord is the **Amatyakaraka (`AmK`)** or the **D1 10th lord**, and gates its vote through `work.d10_check` (`workD10Check`) so a split `D1/D10` signal is safely discarded rather than creating noisy career advice.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` closes key blind spots in Karaka clock evaluation:

- **D10 Dashamsha Structural Enrichment (`varga.d10`, Gaps R2 / R3):** `work.karaka_family` explicitly requires `D10 card of the running karaka lord` and `AmK and the 10th lord in D1 and D10`. Currently, `_build_placements_json` (`AIAstra_Radha/src/jhora/export.py:887`) omits `house`, `owns`, and `dignity` on `varga.d10`, causing `digest/build.ts:612` to leave `house: null`. Populating explicit `D10` `house` (1..12), `owns`, and `dignity` restores exact `workKarakaVote` checks for D10 debility and dusthana ownership (`6, 8, 12`).
- **Jaimini Karakamsha & Swamsha Integration (Gap R6):** Connects the `AmK` and `AK` placements in `D9` (*Karakamsha/Swamsha*) with `D10` so Jaimini career signification (10th from Karakamsha) confirms whether an `AmK` period produces leadership recognition or behind-the-scenes strain.
- **Vimsopaka Bala (`strength.vimsopaka`, Gap H6):** Measures the 20-point multi-varga strength of `AmK` and the D1/D10 10th lords, distinguishing high-stamina `AmK` periods (`>= 14/20`) from weak ones.
- **Unlocking `dasha.karaka` & `dasha.chara` (Doc 80 §1.4):** Ensures `dasha.karaka` is marked served (`catalog.ts:174-186`) and hydrated into `kundli_activation` (`family: 'karaka'`, level 3), moving Karaka Clock out of `FAMILIES_NOT_BUILT` (`career.ts:46`).
- **Bhava Chalit Shifts (Gap H8):** Confirms whether `AmK` or the 10th lord shifts houses between Rasi and Bhava Chalit before labeling its D1 house role.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:280`)
```typescript
[
  c('dasha', 'karaka'),
  c('jaimini', 'chara_karakas'),
  c('divisional', 'D10'),
  // Priority 2 additions:
  // c('divisional', 'D9'), c('natal', 'strength.vimsopaka'), c('jaimini', 'arudhas.d10')
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:291`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `activation` | `karaka dasha level 3, periods covering this month ±1` | `activation_row` | Populated `family: 'karaka'` L1–L3 periods in `kundli_activation` |
| `point` | `AmK and the 10th lord in D1 and D10` | `point_row` | Explicit `D10` house/lord for `AmK`, `A10`, and `D9 AK` (Karakamsha) |
| `planet` | `D10 card of the running karaka lord` | `planet_card` | Explicit `D10` `house`, `dignity`, `owns`, `vimsopaka`, `houseShift` |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `family_vote.v1` (`{ family: 'karaka', label: 'Karaka clock', vote: 'support' | 'test' | 'neutral', planet: string | null }`), consumed by `work.present_tone`.
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'work.karaka_family', claim, evidence, polarity, weight, about: 'work.karaka' }`:
  - Running `AmK` or D1 `L10` (not debilitated in `D10`, passing `workD10Check`): `support` (`+1.5 .. +2.0`).
  - Lord debilitated in `D10` or owning `6/8/12` without owning `10/1/6` (passing `workD10Check`): `test` (`-1.5 .. -2.0`).
  - Split `D1/D10` vote: withheld (`neutral`, `0`).

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 1 (`digest.build` + `digest.activation`)** extracts `AmK` from `karaka.chara` and loads `dasha.karaka` rows. **Step 2 (`workKarakaVote`)** executes deterministically inside `career.ts presentState`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.career_map`.
  - **Tagged `technique_id` (`withAgentRun`):** `work.karaka_family` (`category: 'work'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript deterministic lookup (`< 5 ms`). Zero LLM calls; zero Node astrological math (Chara Karaka ranking and D10 dignities come exclusively from Radha).
  - **Cross-Varga Guard:** Always pipes its provisional vote through `workD10Check` (`work.d10_check`) before returning `support` or `test`.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates `AmK` and `D10` agreement into grounded professional language (e.g., *"Your core career driver aligns cleanly with your current role, supporting steady recognition for practical skill."*).
- **Jargon Redaction Rules:** Never exposes *Amatyakaraka*, *AmK*, *Chara Karaka*, *Karakamsha*, *Swamsha*, *Karaka Dasha*, *Dashamsha*, *Dusthana*, or internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured keys in `evidence[]` (e.g., `['karaka:AmK=Me', 'dasha_karaka:L3=Me', 'd10:Me:h10:own_sign', 'vimsopaka:Me:15.8']`).
- **One-Tap "Chart Details":** Shows the primary career indicator planet, the active Karaka clock window dates, and whether D1 and D10 agree.
- **Single Past-Event Calibration Question:** When an `AmK` period transition occurred in the past year, reinforces `work.looking_back` prompts around changes in professional responsibility.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `family.dasha` and `lineman.work` in `work.reading.oracle` via the cached digest prefix (`parts[0]` >= 1,024 tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Cached in `area_builds` (`area: 'career'`) and `technique_outputs` (`techniqueCacheKey` keyed by `kundliId`, `digestVersion`, and level-3 period boundary).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `KundliDigest`, and `KundliData` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.

---

## Dasha systems read by this technique (rule of 2026-11-21, `docs/techniques/12`)

This is the rule the technique is being built to. It replaces any narrower list of dasha systems above **when the
preparation build of `docs/techniques/11` ships**; until that release the code still reads the systems listed above.

- **Which systems:** every dasha system the engine says applies to the person (`dasha.applicable`). A conditional
  dasha that does not apply, or that the engine has not checked, is not read.
- **Which periods:** for each of those systems, the **running maha dasha** (with its sub-periods and its closing
  stretch) and the **next maha dasha** (its lord or sign, its start date, its first sub-period, and what changes).
- **How they confirm:** the star voice (Vimshottari with the conditional dasha that applies) and the sign voice
  (Narayana) must both point to this technique's significators for "confirmed". Systems of one family are one voice;
  every other system is reported as support and never raises the count. How many voices are counted is a house rule
  awaiting Sachin's confirmation: see `docs/techniques/12` §4 and §9. Longevity dashas are read and never named to the
  person.
- **Tested against, for this technique:** the Amatyakaraka and the 10th from it.
- **Purpose voice:** none: the karaka dashas are read and reported as support, never counted.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows.
