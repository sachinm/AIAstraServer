# Technique Specification: Transits Over Love & Partnership (`love.transit`)

**Technique ID:** `love.transit`  
**Category:** `love`  
**Board:** `love`  
**Status:** `built`  
**Owning Code Path:** `src/reading/area/houseLayers.ts transitLayer` (`src/reading/area/love.ts LOVE`, `boardService.ts getAreaBoard`)  
**Agent ID:** `area.love_board`  
**Accuracy Check:** `area_checks:love`

---

## 1. Executive Summary & Purpose

`love.transit` evaluates the current and ±24-month slow-planet sky overlay (Jupiter, Saturn, Rahu, Ketu, double transit, and eclipses) over the Love houses (`7, 5, 11, 2, 4, 8, 12`), the 7th lord, Venus, Moon, and `UL`/`A7`. It supplies the **Transit Family** vote to the Love board tone and surfaces dated outer-sky shifts without ever making live Radha calls on the page-render path (omitting cleanly with a gap note if no sky overlay is stored).

---

## 2. Untapped Radha Resources Mapped

Integrating Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` fixes major classical blind spots in `love.transit`:

- **Gochara Vedha & Virodha Vedha (Gap H1):** Currently neither Radha nor Server computes classical **Gochara Vedha** (e.g., when a benefic Jupiter transit in the 7th or 11th from the natal Moon is obstructed by a malefic planet transiting the Vedha spot). Adding Gochara Vedha + *Virodha Vedha* (cancellation when father/son pairs like Sun-Saturn or Mercury-Moon occupy mutually cancelling spots) to `transits_export.py` prevents `love.transit` from overclaiming support when a benefic transit is blocked.
- **Murti Nirnaya (Gap H2):** Computes the Moon's sign at the exact moment Saturn, Jupiter, Rahu, or Ketu enters a new sign (*Swarna/Gold*, *Rajata/Silver*, *Tamra/Copper*, *Loha/Iron*). This reveals whether a Saturn transit over the 7th or Moon brings solid loyalty (*Rajata/Tamra*) or heavy friction (*Loha*).
- **Transit Ashtakavarga (`transit_ashtakavarga`, Gap H5):** `src/techniques/catalog.ts:638` already specifies *"Transit ashtakavarga bindus in the planet's own BAV support or test"*, yet `src/reading/chartData/catalog.ts:263` marks `transit_ashtakavarga` as `served: false`. Flipping `served: true` supplies BAV (`0..8`), SAV, and Kakshya `has_bindu` validation for Saturn/Jupiter over houses `7, 5, 11`.
- **Divisional Transit Overlays (`D9`, `D7`, Gap H7):** Evaluates slow transits relative to `D9` 7th house and `D9` Venus alongside `D1` natal positions.
- **Multi-Year Exact Transit Contacts (2027–2036, Gap R5):** Extends slow-planet natal degree contacts and station dates beyond 2026 (`docs/TODOS.md:240`) so upcoming relationship triggers remain accurate for the next decade.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

### 3.1 Declared Charts (`src/techniques/catalog.ts:634, 663-667`)
```typescript
[
  c('transit', 'transit_contacts'),
  c('transit', 'double_transit'),
  c('transit', 'sade_sati'),
  c('transit', 'eclipses'),
  c('ashtakavarga', 'transit_ashtakavarga'),
  // Priority 2 additions: Gochara Vedha, Murti Nirnaya, Divisional Transit (D9/D7)
]
```

### 3.2 Contract Inputs (`src/techniques/catalog.ts:639`, `src/techniques/layouts.ts`)
| Section | Filter | Layout (`layouts.ts`) | Priority #2 Enrichment |
| :--- | :--- | :--- | :--- |
| `transit` | `shared sky with the overlay: Sa, Ju, Ra, Ke and eclipses over houses 7,5,11,2,4,8,12, their lords and arudhas, ±24 months` | `transit_row` | `bindus` (BAV + Kakshya `has_bindu`), Vedha obstruction status, Murti Nirnaya, 2027–2036 contacts |
| `house` | `D1,D9,D7,D30 houses 7,5,11,2,4,8,12` | `house_card` | `sav` points and `D9.h7` / `D7.h5` targets for divisional Gochar |

### 3.3 Output Schema & Oracle Synthesis Structure
- **Contract Output:** `area_board.v1` (dated transit support/pressure items + Transit family vote `{ vote: 'support' | 'test' | 'neutral', rows[] }`).
- **Synthesis Payload (`findings_in`):** Supplies `{ technique: 'love.transit', claim, evidence, polarity, weight, about: 'love.sky' }`:
  - Jupiter in `7/5/11` without Vedha and with BAV `>= 4`: `support` (`+1.5 .. +2.5`); obstructed by Vedha: softened to `neutral` (`+0.5`).
  - Saturn over `7/L7/Ve` (unless `3/6/10/11` from Moon with bindu), Rahu/Ketu axis pressure, or eclipses on `h7/Ve`: `test` (`-1.0 .. -2.5`), calibrated by Murti Nirnaya.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Pipeline Step:** **Step 1 (Background Overlay Pre-pull)** stores `kundli_transit_overlays`. **Step 2 (`transitLayer`)** executes deterministically inside `boardService.ts getAreaBoard` -> `houseLayers.ts`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `area.love_board`.
  - **Tagged `technique_id` (`withAgentRun`):** `love.transit` (`category: 'love'`).
  - **Span Level:** `stage` (`kind: 'code'`).
- **Execution Boundary & Runtime Limits:**
  - **Runtime:** Pure TypeScript selection over stored `TransitRangePayload` + `transit_ashtakavarga` (`< 10 ms`). Zero live Radha calls on the board request path; zero Node astrological math (Vedha pairs, Murti metals, Kakshya bindus, and house-from-lagna/Moon are precomputed by Radha).

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates outer sky pressure into grounded, non-fatalistic relationship timing (e.g., *"External pressures around shared schedules ease gradually through late summer, giving conversations more breathing room."*).
- **Jargon Redaction Rules:** Strictly strips *Gochara Vedha*, *Virodha Vedha*, *Murti Nirnaya*, *Swarna/Loha*, *Ashtakavarga*, *BAV/SAV*, *Kakshya*, *Rahu/Ketu*, *Sade Sati*, and internal engine names (`Radha`, `pyjhora`).
- **Evidence Array Encapsulation:** Structured keys inside `evidence[]` (e.g., `['trans:Ju:h7:bav=5:kakshya_bindu=1', 'vedha:Ju:clear', 'trans:Sa:murti=silver:h4_moon', 'eclipse:axis_1_7:2027-02-20']`).
- **One-Tap "Chart Details":** Displays the transiting planet, its current house relative to Lagna and Moon, BAV/Kakshya bindu backing, Vedha obstruction check, and exact exit/station dates.
- **Single Past-Event Calibration Question:** When a major slow planet crossed or stationed on `Ve`, `L7`, or `h7` in the past year, connects to a confirmation prompt on relationship turning points.

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:** `usesLlmCache: false` (`cacheStore: 'none_deterministic_code'`). Feeds `family.sky` and `lineman.love` in `love.reading.oracle` (`parts[0]` >= 1,024 tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`).
- **Findings & Output Persistence:** Shared sky rows live in `transit_range_skies` (`owner: system`); personal overlays live in `kundli_transit_overlays`; Love board outputs cache in `area_builds` and `technique_outputs` (`freshness: 'transit'` / 2h–daily bucket).
- **45-Minute Inactivity Lifecycle:** Registered in `src/techniques/subagentCachePlan.ts`; consumption invokes `informIndividualCacheUsed({ userId, kundliId })` and `recycleIndividualCaches` (`src/reading/llm/cacheSweep.ts`) purges inactive `technique_outputs` after 45 minutes.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx.userId, targetUserId)` (`src/graphql/rbac.ts:62`).
  - `KundliTransitOverlay`, `AreaBuild`, `TechniqueOutput`, and `KundliDigest` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - HTTP responses send `Cache-Control: private, no-store, no-cache, must-revalidate`.
