# 55 — Life Reading: Remaining Largest Mahadasha (10–18+ Years) & Antardasha Life-Charter Technique

**Date:** 2026-11-06
**Status:** Active build specification
**Depends on:** [Doc 34](./34-comprehensive-life-reading-from-radha-json.md), [Doc 45 §3.3](./45-area-boards-first-principles-and-user-journey.md), [Doc 53](./53-kundli-digest-and-technique-contracts.md), [Doc 54 §4](./54-build-contracts-digest-boards-life-reading.md)

---

## 1. Start (The System as It Is Today)

1. **Stored Data (~10,000 Rows per Kundli)**:
   - `kundli_digest` (`src/reading/digest/build.ts`) writes ~1,500–2,500 rows per chart across six sections (`house`, `planet`, `yoga`, `point`, `annual` for ±10 years across `TP`/`VP` in `D1`/`D9`/`D10`, and `star` across `D1–D144`).
   - `kundli_activation` (`src/reading/digest/activation.ts`) writes ~9,500–10,000 rows per chart across 43 dasha systems at levels 1–3 from birth to +30 years ahead.
   - `transit_snapshots` (`src/reading/life/sky.ts`) holds `double_transit` and slow-planet transits.
   - `kundli_data` (`data_type = 'avasthas'`) already contains `dasha_charter` (`mahadasha_charters` 5-vector charter and `antardasha_fruition_matrix` 9×9 Antardasha-from-Mahadasha fruition matrix), exported by Python (`avasthas_export.py`), but `src/reading/digest/build.ts` was not copying `dasha_charter` onto the `D1` `PlanetCard`.
2. **Existing Life Reading (`src/reading/life/`)**:
   - `life.promise_scale` (`src/reading/life/promise.ts`), `life.timing_agreement` (`src/reading/life/timing.ts`), and `life.dashboard` (`src/reading/life/compose.ts`) build Part 1 of Doc 34 ("Your life at a glance"): `rule_now` and the active area rows (`areas[]`) with their immediate issue, cause, top 3 improvement windows, and action rule.
   - **Gap**: The Life Reading does not yet chart out the individual's **remaining largest Mahadasha (when it has 10–18+ years left, or the major 10–20 year Mahadasha ahead)** across its chronological **Antardashas**, nor does it synthesize a **high-level Life Charter per life area** connecting birth & divisional promise (`D1` + `D9` + owning vargas), 9×9 Antardasha-from-Mahadasha fruition, multi-dasha convergence, annual `Tithi Pravesha` / `Varsha` charts, and transit gates.

---

## 2. End Goal

When a user opens **Profile → Timeline** (`GET /api/life-reading`):
1. The system identifies the individual's **remaining largest Mahadasha** (the running Mahadasha if it has `>= LIFE_CHARTER_MIN_REMAINING_YEARS` [default `10`] years remaining, or the longest Mahadasha in the `LIFE_CHARTER_HORIZON_YEARS` [default `20`] lookahead window with the current Mahadasha's remaining Antardashas included as a bridge).
2. It synthesizes a **High-Level Mahadasha Life Charter** (`headline` and `charter_summary`) and guides the reading **per life area** (`area_charters[]` classified as `anchor`, `growth`, or `guarded`), anchored in whether the promise is written in the birth chart (`D1`) and divisional charts (`D9` + the area's owning varga `D2–D30`).
3. It charts out every **Antardasha** (`antardashas[]`) across those 10–18+ years in sequence, connecting the ~10,000 digest & activation rows to assert for each Antardasha:
   - The **sub-period theme & tone** (`breakthrough`, `build`, `steady_work`, `careful`),
   - The **2–3 activated life areas** with their plain-English charter, timing confirmation (multi-dasha clocks, annual `TP`/`VP` charts, and `double_transit` / slow transits), and concrete action rule,
   - Full structured `evidence` (MD/AD lords, 9×9 `house_from_md` and `fruition_class`, star-lord/dispositor/co-lord links, agreeing dasha systems, annual chart years, transit houses) kept strictly inside collapsible **Chart details** so zero raw astrology jargon or engine names appear in visible prose.

---

## 3. Deliverable

1. **Environment Config (`src/config/env.ts`)**:
   - `LIFE_HORIZON_YEARS` (default `18`), `LIFE_CHARTER_MIN_REMAINING_YEARS` (default `10`), `LIFE_CHARTER_HORIZON_YEARS` (default `20`), `LIFE_CHARTER_MAX_AREAS_PER_AD` (default `3`).
2. **Digest Plumbing (`src/reading/digest/types.ts`, `src/reading/digest/build.ts`, `src/reading/life/promise.ts`)**:
   - `DashaCharterDigest` and `AntardashaFruitionCell` on `D1` `PlanetCard` with `DigestSource` provenance (`avasthas` → `dasha_charter.mahadasha_charters[i]` and `dasha_charter.antardasha_fruition_matrix.<P>`).
   - `promise.ts` reads `mdCard.dashaCharter?.fruition[ad]` for the 6/8/12 AD-from-MD adjustment.
3. **Technique Implementation (`src/reading/life/charter.ts`, `labels.ts`, `compose.ts`, `service.ts`)**:
   - `life.mahadasha_charter` registered in `src/techniques/catalog.ts` (with `selectors` and `contract`) and `src/agents/registry.ts`.
   - `LifeDashboard` (`GET /api/life-reading`) extended with `charter: LifeMahadashaCharter | null`.
4. **Frontend UI (`AIAstra_WEB`)**:
   - `src/lib/lifeReadingApi.ts` and `src/pages/timeline/LifeReadingDashboard.tsx` updated to display the Long-Term Life Charter (per-area charters + chronological Antardasha timeline + optional current-chapter bridge).

---

## 4. Exactly How It Works When Done

### 4.1 Backend
- **Mahadasha Selection**:
  - Reads `vimshottari` `level = 1` rows in `kundli_activation` where `endDate > asOf`.
  - If the current Mahadasha has `>= LIFE_CHARTER_MIN_REMAINING_YEARS` (default `10`) remaining, it is the primary chartered Mahadasha (`is_current = true`, `bridge = null`).
  - Otherwise, among all Mahadashas intersecting `[asOf, asOf + LIFE_CHARTER_HORIZON_YEARS]`, selects the Mahadasha with the largest duration in the window as the primary charter, and attaches the current Mahadasha's remaining Antardashas (`level = 2`, `endDate > asOf`) as `bridge`.
- **Per-Area Charter (`area_charters[]`)**:
  - Evaluates each of the 13 `LIFE_AREAS` by combining:
    1. Its `AreaPromise` (`verdict`: `'promised' | 'partial' | 'not_written'`, `d1Pts`, `vargaPts` across `D9` and owning vargas `D2..D30`),
    2. Direct activation by the Mahadasha lord (`ownHouses`, `placedHouse`, `rasiDrishtiHouses`, `grahaDrishtiHouses`, `dispositorHouse`, `starLordHouse`, and active `YogaRow`s),
    3. Peak and watch Antardasha windows across the Mahadasha span.
- **Antardasha Timeline (`antardashas[]`)**:
  - For each `vimshottari` `level = 2` sub-period `[from, to]` in the Mahadasha:
    - Reads the 9×9 `AntardashaFruitionCell` from `mdCard.dashaCharter?.fruition[adLord]`.
    - Scores all 13 life areas for that `[from, to]` slice by joining:
      1. `adLord` & `mdLord` house ownership, placement, aspects, and yogas in `D1`,
      2. `adLord` & area primary house dignity in `D9` and the area's owning varga (`D2..D30`),
      3. Secondary dasha family agreement (`conditional`, `rasi`, `yogini`, `tithi_ashtottari`, `karaka`) overlapping `[from, to]`,
      4. Annual `TP` and `VP` year charts (`annual` rows in `kundli_digest`) overlapping the years of `[from, to]`,
      5. Transit gates (`double_transit` and slow transits in `SkyView`) when `[from, to]` intersects the transit window.
    - Selects the top `LIFE_CHARTER_MAX_AREAS_PER_AD` (default `3`) areas and emits plain-language `headline`, per-area `summary`, `timing`, and `action`, plus `grade`, `basis`, and `evidence`.

### 4.2 API (`GET /api/life-reading`)
- Returns `{ status: 'ok', built_at, cached, rule_now, areas, charter }`.
- Cache key in `kundli_data` (`data_type = 'life_reading'`) bumps `LIFE_CACHE_VERSION` from `'v1'` to `'v2'` so previously cached v1 payloads without `charter` rebuild automatically on next read.

### 4.3 Frontend Experience & UI/UX
- Renders inside `LifeReadingDashboard.tsx` below "Your life at a glance":
  - **Your long-term life charter** header with remaining years badge and plain-language chapter theme.
  - **Charter by life area** cards showing each key area's role (`Core promise`, `Growth area`, `Area to guard`), birth & divisional chart backing, peak window, and long-term guidance.
  - **Year-by-year periods (Antardashas)** chronological cards (with an optional "Closing your current chapter" bridge strip when the current Mahadasha has `< 10` years left), each with phase tone badge, activated areas, timing confirmation, action rule, and a collapsible **Chart details** drawer.

---

## 5. Architecture

- **Zero Astrology in Node**: Node performs only selection, set membership, date-range overlap, and integer weighting over engine-computed fields (`tests/unit/reading/digest/noAstrologyInNode.test.ts`).
- **Zero Paid LLM Calls**: 100% deterministic code technique (`system: 'none'`).

---

## 6. Ingredients

- `src/config/env.ts`: `LIFE_HORIZON_YEARS`, `LIFE_CHARTER_MIN_REMAINING_YEARS`, `LIFE_CHARTER_HORIZON_YEARS`, `LIFE_CHARTER_MAX_AREAS_PER_AD`.
- `src/reading/digest/types.ts` & `src/reading/digest/build.ts`: `DashaCharterDigest`, `AntardashaFruitionCell`.
- `src/reading/life/charter.ts`, `labels.ts`, `promise.ts`, `compose.ts`, `service.ts`.
- `src/techniques/catalog.ts` & `src/agents/registry.ts`: `life.mahadasha_charter`.

---

## 7. Action Steps in Sequence

1. Add env helpers in `src/config/env.ts` and `DashaCharterDigest` in `src/reading/digest/types.ts` + `build.ts` + `promise.ts`.
2. Build `src/reading/life/charter.ts` and plain-language templates in `src/reading/life/labels.ts`; wire into `compose.ts` and `service.ts`.
3. Register `life.mahadasha_charter` in `src/techniques/catalog.ts` and `src/agents/registry.ts`.
4. Add unit tests (`tests/unit/reading/life/charter.test.ts`, `compose.test.ts`, `build.test.ts`, `catalog.test.ts`).
5. Update `AIAstra_WEB` (`src/lib/lifeReadingApi.ts`, `src/pages/timeline/LifeReadingDashboard.tsx`, `LifeReadingDashboard.test.tsx`).

---

## 8. Development Phases

- **Phase 1**: Digest `dashaCharter` + `life.mahadasha_charter` server implementation + server unit tests green.
- **Phase 2**: `AIAstra_WEB` UI rendering + web unit tests green + merge both branches into local `develop` with `--no-ff`.

---

## 9. One Recommendation

Build `life.mahadasha_charter` as a deterministic digest-backed technique inside `src/reading/life/charter.ts` included in `GET /api/life-reading` (`LIFE_CACHE_VERSION = 'v2'`).
