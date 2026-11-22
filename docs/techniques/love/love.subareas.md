# Technique Specification: Love Sub-Areas — Meeting Someone, Relationship Health & Reconciling (`love.subareas`)

**Technique IDs:** `love.meet`, `love.health`, `love.reconcile`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/love.ts LOVE_LEAD, LOVE_FIT`; `src/reading/area/boardService.ts shapeBoard`  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.subareas` (`love.meet`, `love.health`, and `love.reconcile`) shapes the shared eight-layer Love board (`love.promise` .. `love.nakshatra`) to match the user's actual relationship context (`person_facts` `love.status`):
- **`love.meet`** leads when `love.status` is `single` or `dating`, highlighting `7th/5th/11th` + `UL` windows with `D9` agreement.
- **`love.health`** leads when `love.status` is `dating`, `committed`, or `married`, focusing on present-month support vs strain in `7th` and `D9 h7`.
- **`love.reconcile`** leads when `love.status` is `separated` or `complicated`, pairing `love.affliction` release dates with `love.activation` recovery periods and `love.protection` anchors.

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` directly improves each status-gated sub-area without changing the read-time shaping contract:

- **Headless Ashtakoota & Dasakoota Compatibility (`match/compatibility.py`, Gap H3):** Enhances `love.health` and `love.reconcile` when a partner's birth data is available by adding objective 36-point Ashtakoota and 10-koota Dasakoota strength/dosha cancellation context alongside individual `D1`/`D9` layers.
- **D9 Navamsha & D7 Saptamsha Enrichment (`varga.d9`, `varga.d7`, Gaps R2 / R3):**
  - `love.meet` explicitly gates meeting windows on *"where house 7, 5 or 11 is activated with D9 agreeing"* (`src/techniques/catalog.ts:765`). Explicit `D9` `house`, `owns`, and `dignity` fields make `D9` window filtering accurate.
  - `love.health` benefits from `D7` (continuity/joy) alongside `D9 h7` current state.
- **D30 Trimshamsha Unlock (`varga.d30`, Gaps R2 / R3):** Elevates `love.reconcile` by uncovering hidden subconscious patterns (`love.affliction`) and their exact period release dates.
- **Gochara Vedha, Murti Nirnaya & Transit Ashtakavarga (Gaps H1 / H2 / H5):** Prevents `love.meet` from highlighting obstructed Jupiter/Venus dating windows (`Vedha`) and informs `love.health` / `love.reconcile` whether Saturn/Rahu pressure eases into constructive growth (*Rajata/Tamra*) or requires patience (*Loha*).
- **Tithi Pravesha `yearLord` & Annual `D9` (Gaps R1 / R4):** Fixes annual tone calibration inside `love.health` and `love.meet` so promising relationship years are not forced into `get_through` defensiveness.
- **Multi-Year Exact Transit Contacts (2027–2036, Gap R5):** Keeps `love.meet` and `love.reconcile` forward windows accurate across the next 36 months and beyond.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:775`)
```typescript
[
  c('natal', 'facts'),
  c('divisional', 'D9'),
  c('dasha', 'vimshottari'),
  c('transit', 'transit_contacts'),
  // Inherited via the 8 Love layers: D7, D30, conditional/narayana/chara/karaka dashas,
  // annual.tithi_pravesha, transit_ashtakavarga, strength.bhava, strength.vimsopaka
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:782`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `findings` | `the eight Love layers of this kundli (love.promise … love.nakshatra)` | `findings_in` | Enriched `D9`/`D7`/`D30`, `Bhava/Vimsopaka`, `TP yearLord`, `Vedha`, `Ashtakavarga` |
| `person` *(runtime)* | `person_facts` (`love.status`) | `person_pack` | Routes `LOVE_LEAD` and `LOVE_FIT` cleanly without rebuilding chart layers |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `board_subarea.v1` (`AreaBoardBody` shaped with `leadSubarea`, visible `subareaWindows`, `tone`, `supports`, `pressures`, `protections`, `ahead`, `lookingBack`).
- **Synthesis Payload (`findings_in`):** Supplies status-scoped sub-area findings to `love.reading.oracle` (`lineman.love`) with `selectors.facts = { 'love.status': [...] }` so `love.reading.diagnosis` and `lineman.love` never speak to a married user as if single, or vice versa.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 2 (Read-Time Board Shaping)** in `boardService.ts shapeBoard` over the cached `area_builds` output of the eight `love.*` layers (`houseLayers.ts`).
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.meet` | `love.health` | `love.reconcile` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript filtering/relabeling (`< 5 ms`). Zero LLM calls; zero DB chart reads during shaping (`shapeBoard` operates in memory over the shared daily `area_builds` payload + `person_facts`).
  - **Status Gate:** When `love.status` is unknown (`null`), `boardService` sets `ask: true` so the UI asks one gentle tap question (*"What best describes your relationship status right now?"*) instead of guessing.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:**
  - `love.meet`: *"A natural opening for meaningful new connections runs from April 18 through July 30—say yes to social introductions."*
  - `love.health`: *"Partnership warmth is steady this month, though busy schedules call for intentional, distraction-free check-ins."*
  - `love.reconcile`: *"Active strain around unspoken expectations begins easing after September 12; focus on calm listening until then."*
- **Jargon Redaction Rules:** Strictly forbids *Upapada*, *UL*, *D9*, *D7*, *D30*, *Vedha*, *Ashtakavarga*, *Dashas*, and internal engine names (`Radha`, `pyjhora`). Never makes fatalistic marriage/divorce verdicts.
- **Evidence Array Encapsulation:** Structured provenance preserved in `evidence[]` (`['subarea:meet:2027-04-18..2027-07-30', 'd9_agree:Ju', 'status_fit:single']`).
- **One-Tap "Chart Details":** Shows the sub-area's qualifying layers (which houses, planets, and timing systems drove the window) without exposing jargon on the card face.
- **Single Past-Event Calibration Question:** Offers one-tap `love.status` confirmation if missing, plus `Looking back` past-year turning-point confirmation.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `love.reading.oracle` (`lineman.love`), where the immutable chart slices stay cached in `parts[0]` (`>= 1,024` tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`) and `love.status` rides in `parts[1]`.
- **Findings & Output Persistence:** Underlying board layers cache once per validity window in `area_builds` (`area: 'love'`) and `technique_outputs`; `shapeBoard` applies `love.status` dynamically so status changes never require re-running chart builds.
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `AreaBuild`, `TechniqueOutput`, `PersonFact`, and `KundliDigest` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.

---

## Dasha systems read by this technique (rule of 2026-11-21, `docs/techniques/12`)

This section overrides any narrower list of dasha systems above.

- **Which systems:** every dasha system the engine says applies to the person (`dasha.applicable`). A conditional
  dasha that does not apply, or that the engine has not checked, is not read.
- **Which periods:** for each of those systems, the **running maha dasha** (with its sub-periods and its closing
  stretch) and the **next maha dasha** (its lord or sign, its start date, its first sub-period, and what changes).
- **How they confirm:** the star voice (Vimshottari with the conditional dasha that applies) and the sign voice
  (Narayana) must both point to this technique's significators for "confirmed". Systems of one family are one voice.
  At most four voices are counted (star, sign, purpose, year); every other system is reported as support and never
  raises the count. Longevity dashas are read and never named to the person.
- **Tested against, for this technique:** dating: the 5th, Venus, D9, A7 · marriage: the D9 lagna and 7th lord, UL, Darakaraka · friends: the 11th from the lagna and from the AL · allies: the 7th and 3rd.
- **Purpose voice:** marriage: Narayana on D9 when cast. Dating, friends and allies have none; the research has no timing rule for friends, and the reading says so.
- **Where the reading comes from:** the stored cells and the weave of the preparation queue (`docs/techniques/11`
  §4.4), not a fresh read of the dasha rows. The code and the lens recipes change with that build; until then this
  technique reads the systems listed above.
