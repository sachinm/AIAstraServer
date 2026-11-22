# Technique Specification: Transits Over Houses 1, 4 and 5 with the Moon (`self.transit`)

**Technique ID:** `self.transit`  
**Category:** `self`  
**Board:** `you`  
**Status:** `built` (Priority #2 enhancement ready)  
**Owning Code Path:** `src/reading/area/houseLayers.ts` (`transitLayer`); `src/reading/self/sub/windows.ts` (`subWindows`); `src/reading/timeline/transits.ts`  
**Agent ID:** `area.self_board` (upstream: `transit_overlay`, `transit_contacts`; downstream: `self.sub.windows`, `self.sub.body_facts`, `family.sky`, `self.v2.oracle`)  
**Accuracy Check:** `area_checks:self`

---

## 1. Executive Summary & Purpose

`self.transit` tracks slow-moving planetary weather (Saturn, Jupiter, Rahu, Ketu), Sade Sati/Dhaiya spans, double transits, and eclipses crossing the 1st, 4th, 5th, 9th, and 12th houses, the Lagna, the natal Moon, and Arudha Lagna (`AL`). It converts raw transit overlays and natal-degree contacts (`±24 months`) into a clean vote on present atmosphere—distinguishing supportive openings from temporary pressure—so `self.sub.windows`, `self.sub.body_facts`, and `self.v2.now` accurately date when current weather lifts.

---

## 2. Untapped Radha Resources Mapped

Priority #2 capabilities from `docs/reading-engine/80-radha-and-catalogue-gap-analysis.md` mapped to `self.transit`:

- **Transit Ashtakavarga (`transit_ashtakavarga` with Kakshya, Gaps R-matrix & H5):**
  - Currently marked `served: false` in `src/reading/chartData/catalog.ts:263`.
  - Radha `daily_export.py:703–765` (`run_transit_ashtakavarga`) outputs natal SAV points per house, planet BAV points in the transited sign, and exact Kakshya breakdown (8 divisions of $3^\circ 45'$ per sign ruled by Saturn..Lagna) with `has_bindu: boolean`.
  - Transforms `self.transit` grading: a Saturn transit over 1st/4th/Moon with high BAV ($\ge 4$) and `kakshya.has_bindu === true` is downgraded from harsh wear to structured discipline, while Jupiter in a `0-bindu` kakshya is moderated rather than overclaimed.
- **Gochara Vedha & Virodha Vedha (Gap H1):**
  - Upgrades `transits_export.py` to compute classical transit obstruction pairs from natal Moon and Lagna.
  - Prevents `self.transit` from promising an unobstructed Jupiter support window over 1st/5th when a simultaneous planet occupies its Vedha house.
- **Murti Nirnaya (Gap H2):**
  - Computes the Moon-at-ingress vehicle (*Swarna*, *Rajata*, *Tamra*, *Loha*) when Saturn, Jupiter, or Rahu enter a new sign over `1, 4, 5, 9, 12`, distinguishing silver/gold resilience from iron/copper strain.
- **Divisional Transit Overlays (`D9`, `D24`, `D30`, Gap H7) & Multi-Year Contacts (2027–2036, Gap R5):**
  - Extends `transit_contacts_export.py` past the current 2026 horizon (`docs/TODOS.md:240`) through 2036 so multi-year projections (`self.v2.stuck`, `self.v3.cards`) remain grounded.
  - Adds D9/D30 transit overlays to verify whether a slow transit hits inner emotional/bodily resilience.

---

## 3. Contract Inputs, Outputs & Synthesis Payload Structure

- **Declared Charts (`TechniqueDef.charts` in `src/techniques/catalog.ts:634`):**
  ```typescript
  [
    c('transit', 'transit_contacts'), c('transit', 'double_transit'),
    c('transit', 'sade_sati'), c('transit', 'eclipses'),
    c('ashtakavarga', 'transit_ashtakavarga'), c('transit', 'transit_overlay'),
  ]
  ```
- **Contract Inputs (`inp(section, filter, layout)` from `src/techniques/layouts.ts`):**
  - `inp('transit', 'shared sky with the overlay: Sa, Ju, Ra, Ke and eclipses over houses 1,4,5,9,12, their lords and arudhas, ±24 months (plus kakshya_bindu, vedha, murti_nirnaya)', 'transit_row')`
  - `inp('house', 'D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12 (sav column)', 'house_card')`
- **Contract Output Schema:** `'area_board.v1'` (aligns with `self.sub.windows` `'self_v2.window_set'`).
- **Oracle Synthesis Payload (`findings_in`):**
  - `{ technique: 'self.transit', claim: string, evidence: string[], polarity: 'support' | 'pressure' | 'mixed', weight: number, window: { from: string, to: string } }`.
  - Weight & moderation rules: Unobstructed Jupiter (`+1.5`, reduced to `+0.5` if Gochara Vedha present or `has_bindu === false`), Saturn/Sade Sati (`-1.5`, softened to `-0.5` if `3/6/10/11` from Moon with `bav >= 4` and Silver/Gold Murti), Rahu/Ketu/Eclipses (`-1.0` pressure/amplification). Feeds one net vote into the Self board tone and supplies dated sky spans to `family.sky`.

---

## 4. Execution Step, Trace Span & Execution Boundary

- **Step within Pipeline:**
  1. **Shared Sky & Overlay Sync:** Shared sky rows (`TransitRangeSky`) and person-specific overlays (`KundliTransitOverlay`, `transit_ashtakavarga`) are loaded from DB without live Radha calls on board render (`never fetched here`).
  2. **Deterministic Sky Layer (`self.transit` / `self.sub.windows`):** Evaluates active transits over `1, 4, 5, 9, 12`, Lagna, Moon, and `AL` at `asOf`.
  3. **Family Sky & Oracle Synthesis (`family.sky` -> `self.v2.oracle`):** `family.sky` slices window rows (padded $\ge 1024$ tokens in `parts[0]`) and writes findings to `reading_findings_cache`.
- **Execution Tagging & Telemetry Spans:**
  - Board sub-technique and area execution spans are registered and tagged via `withAgentRun` (`src/agents/registry.ts`) and telemetry profiler (`src/telemetry/pageTiming.ts`); `trace.ts` handles general chat reading spans (`agentIdOf`, `techniqueIdOf`).
  - **Registered `agent_id` (`withAgentRun`):** `'area.self_board'` (code layer) and `'family.sky'` (LLM reader).
  - **Tagged `technique_id` (`withAgentRun`):** `'self.transit'`.
  - `category`: `'self'`.
  - `level`: `'stage'` (`self.transit`), `'model_call'` (`family.sky` downstream).
- **Execution Boundary & Runtime Limits:**
  - `self.transit` runs deterministically in `< 15 ms`; omits itself cleanly with a diagnostic gap if no stored sky overlay exists (never blocks board load).
  - Zero Node astrological math: Kakshya numbers, `has_bindu`, Vedha obstructions, and Murti metals are computed solely by Radha.

---

## 5. User Experience & Zero-Jargon Compliance

- **Card Surface Prose:** Translates transits into clear, seasonal pacing guidance (e.g., *"The extra pressure on your energy and focus eases after February 2027, giving you clearer breathing room for personal projects."*).
- **Jargon Redaction Rules:**
  - Strictly prohibited on card faces: *Sade Sati*, *Dhaiya*, *Gochara*, *Vedha*, *Kakshya*, *Bindu*, *SAV*, *BAV*, *Murti Nirnaya*, *Swarna/Loha*, *Ashtakavarga*, *Rahu*, *Ketu*, *Radha*, *pyjhora*.
- **Evidence Array Encapsulation:**
  - All transit mechanics remain inside `evidence[]`:
    `['transit.Sa.h1_from_moon:sade_sati_peak', 'transit_av.Sa.bav:5.kakshya_bindu:true', 'transit.Ju.h5:unobstructed_vedha:false', 'murti.Sa:rajata']`.
- **One-Tap "Chart Details":** Displays planetary sign stay dates, Sade Sati phase, BAV/SAV bindu confirmation, Vedha status, and Murti classification.
- **Single Past-Event Calibration Question:** Checks lived resonance on recent slow ingresses (with specific planetary ingress details quarantined in `evidence[]`): *"Did daily responsibilities start feeling noticeably heavier around [boundary crossings of major outer planets]?"*

---

## 6. Caching, RBAC (`assertOwnAccount`) & PII Sealing (`SEALED_MODELS`)

- **LLM Prefix & Context Cache:**
  - `self.transit` executes deterministically without an LLM call (`cacheStore: 'none_deterministic_code'`).
  - Downstream `family.sky` pads its slow-sky window pack past `1,024` tokens in `parts[0]` (`cachePrefix: true`, `cacheOwner: { userId, kundliId }`) so Gemini `cachedContents` hits across Self/Love/Work boards.
- **Findings & Output Persistence:**
  - Shared sky rows (`TransitRangeSky`) are system-keyed (`owner: { via: 'system' }`).
  - Person overlays (`KundliTransitOverlay`) and outputs (`TechniqueOutput`, `ReadingFindingsCache` for `family.sky`) are user/kundli-scoped and cached under `techniqueCacheKey(..., skyStamp)`.
- **45-Minute Inactivity Lifecycle:**
  - Registered in `src/techniques/subagentCachePlan.ts`; prewarmed with `hit_count = 0`; live reads call `informIndividualCacheUsed({ userId, kundliId })`; evicted after 45 minutes of inactivity (`READING_CACHE_RECYCLE_MINUTES=45`) by `recycleIndividualCaches`.
- **RBAC & Data Privacy:**
  - Enforces `assertOwnAccount(ctx, targetUserId)` (`src/graphql/rbac.ts`).
  - `KundliTransitOverlay`, `TechniqueOutput`, `ReadingFindingsCache`, and `AreaBuild` are encrypted at rest under `SEALED_MODELS` (`src/lib/pii/fields.ts`, `pii2:v1` AES-256-GCM).
  - Emits `Cache-Control: private, no-store, no-cache, must-revalidate`.

## Who reads this technique (corrected 2026-11-22, `docs/techniques/11` rev 4 §4.9)

The lines above name `self.v2.oracle` (and other `self.v2.*` ids) as the reader. Checked on `develop` on 2026-11-22:

- **Today** the v2 Self build still runs (its retirement is built behind flags that are off), so the v2 Oracle is
  still one reader, beside the per-card pipeline.
- **In the preparation build** this technique's output is read through `self.sub.windows`, `self.sub.body_facts` and the `family.sky` reader by the natal core and the dated frame (`slices/natalPrefix.ts`), and from there by the family
  readers, the period readers, the lens linemen and the card Oracle. The v2 Oracle is not a reader on that
  path, and the preparation build never goes through `runSelfV2Build`.
- The technique ids `self.v2.oracle`, `self.v2.personalizer` and `self.v2.hero` are retired in the same change that
  switches `SELF_V2_RETIRED` on; until then the catalogue keeps them.
