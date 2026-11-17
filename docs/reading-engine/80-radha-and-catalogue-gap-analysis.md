# 80. Radha Engine & Server Catalogue Gap Analysis (Priority 2)

**Date:** 2026-11-17  
**Status:** Complete Code Audit (`AIAstra_Radha` vs `AIAstra_Server`)  
**Related Docs:** `76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`, `78-love-work-dashboard-separation-and-cards.md`, `docs/TODOS.md`

---

## Executive Summary

Code-level audit comparing `AIAstra_Radha` (`pyjhora` exports) and `AIAstra_Server` (`src/reading/chartData/catalog.ts`, `src/techniques/catalog.ts`, `src/reading/digest/build.ts`, `src/reading/dasha/dashaAssessment.ts`):

1. **Divisional Charts (Vargas D1..D60):**
   - Radha natively computes **23 varga factors** (`D1..D60` plus `D81, D108, D144`), **but**:
     - **Server `SERVED_VARGAS` filter (`src/reading/chartData/catalog.ts:133`)** only serves `{1, 2, 4, 7, 9, 10}`, leaving `D3, D5, D6, D8, D11, D12, D16, D20, D24, D27, D30, D40, D45, D60` marked `served: false` so `ensureChartData` refuses to pull them dynamically.
     - **Radha `_build_placements_json` (`src/jhora/export.py:887–901`)** omits explicit `house` numbers (1..12) from the varga Lagna, a top-level `lagna` object, lordships, and varga dignities — causing `build.ts` (`placementCards`) to leave `house = null`, `owns = []`, `aspectsTo = []`, `aspectedBy = []`.
     - **Radha `VARGA_SCOPE` (`src/jhora/natal_export.py:54`)** excludes `D5, D6, D8, D11, D40, D45` from Arudha & Argala exports.
     - **Divisional Ashtakavarga** is missing (D1 only).

2. **Tithi Pravesh (TP) Annual Engine:**
   - **Critical Fail-Closed Bug:** `AIAstra_Radha/src/jhora/annual_export.py:736–746` (`run_annual`) omits `yearLord` / `year_lord` (*Vaaresha*), `panchanga`, `hora`, `vaara`, `yoga`, and `karana` from `annual.tithi_pravesha` (even though `pressure_inventory_export.py:44–46` computes the weekday lord).
   - Meanwhile, `AIAstra_Server/src/reading/digest/build.ts:1177–1196` only parses `yearLord` when `kind === 'VP'` (Varshaphala), leaving `yearLord` undefined for `kind === 'TP'` — which triggers the fail-closed fallback to `stance = 'get_through'` in `src/reading/dasha/dashaAssessment.ts:414–419`.
   - Radha supports `tithi_ashtottari`, `mudda`, and `patyayini` for TP, but lacks a compressed 365-day **TP Vimshottari** dasha and TP Muntha/Sahams/Tajika yogas.
   - Server marks `annual.tithi_pravesha` and `annual.varsha` as `served: false` in `catalog.ts:238–246`, blocking dynamic divisional TP pulls (`divisional_chart_factor=10`, etc.).

3. **Transits & Divisional Transits:**
   - Radha has `daily_grade` (Tara/Chandra Bala), `muhurta`, and `transit_ashtakavarga` (BAV/SAV/Kakshya) in `daily_export.py`, all marked `served: false` in `catalog.ts:261–263`.
   - Neither Radha nor Server implements **Gochara Vedha** (transit obstruction), **Murti Nirnaya** (Swarna/Rajata/Tamra/Loha Moon-at-ingress vehicle), or **Divisional Transit Overlays** (Gochar in D9/D10/D7/D11).
   - Stored transit contacts stop at 2026 (`docs/TODOS.md:104`), blinding exact natal hits for 2027–2036.

4. **Other Uncatalogued Jyotish Systems:**
   - **Already built in Radha (`pyjhora`), unexported to JSON API:** Ashtakoota/Dasakoota compatibility (`match/compatibility.py`), Sudarshana Chakra (`dhasa/sudharsana_chakra.py`), Pancha Pakshi Shastra (`panchanga/pancha_paksha.py`), Sarvatobhadra Chakra & Kota Chakra (`ui/chakra.py` — needs headless extraction).
   - **Exported by Radha, unserved/untapped in Server:** `strength.bhava`, `strength.vimsopaka`, `strength.harsha`, `dasha.chara`, `annual.tajaka`, `annual.sahams`, `prashna`, `daily_grade`, `muhurta`, `transit_ashtakavarga`.
   - **Missing in both / Server techniques:** Jaimini **Karakamsha Lagna (KL) & Swamsha** technique, **Bhava Chalit planetary shifts**, **Indu/Ghati/Varnada Lagna** standalone types, **Bhrigu Nandi Nadi**, and **KP Sub-Lords**.

---

## Prioritized Action Matrix

| Priority | Gap / Component | Target | Owning File & Symbol | Required Action |
| :--- | :--- | :--- | :--- | :--- |
| **Required (R1)** | TP `yearLord` (*Vaaresha*) + Panchanga | Radha + Server | `annual_export.py` (`run_annual`), `digest/build.ts:1177` | Export `yearLord`, `vaara`, `hora`, `tithi`, `nakshatra`, `yoga`, `karana` in `annual.tithi_pravesha`; parse `yearLord` for `kind === 'TP'` in `build.ts`. |
| **Required (R2)** | Unlock all 23 Vargas in Server | Server | `chartData/catalog.ts:133` (`SERVED_VARGAS`) | Expand `SERVED_VARGAS` beyond `{1,2,4,7,9,10}` to include `D3, D5, D6, D8, D11, D12, D16, D20, D24, D27, D30, D40, D45, D60`. |
| **Required (R3)** | Varga `house`, `lagna`, lordships & dignities | Radha + Server | `export.py:887` (`_build_placements_json`), `build.ts:589` | Return `house` (1..12), `lagna`, lordships, and varga dignity on every `varga.d<N>` row. |
| **Required (R4)** | Dynamic TP Divisional Pulls | Server | `chartData/catalog.ts:238`, `chartData/store.ts:120` | Mark `annual.tithi_pravesha` / `annual.varsha` served with `divisional_chart_factor`. |
| **Required (R5)** | Multi-year Exact Transit Contacts (2027–2036) | Radha + Server | `transit_contacts_export.py`, `pull-sachin-annual.ts` | Extend contact generation & storage beyond 2026 (`TODOS.md:104`). |
| **Required (R6)** | Jaimini Karakamsha & Swamsha | Server | `techniques/catalog.ts`, `reading/area/houseLayers.ts` | Add `general.jaimini_karakamsha` and route KL/Swamsha into Self/Work. |
| **High-Value (H1)** | Gochara Vedha & Virodha Vedha | Radha + Server | `transits_export.py`, `digest/types.ts` | Compute transit obstruction pairs so favorable Gochar isn't overclaimed when obstructed. |
| **High-Value (H2)** | Murti Nirnaya | Radha + Server | `transits_export.py`, `reading/timeline/transits.ts` | Compute Swarna/Rajata/Tamra/Loha transit vehicle at Saturn/Jupiter/Rahu ingress. |
| **High-Value (H3)** | Headless Ashtakoota / Dasakoota Synastry | Radha + Server | `compatibility.py` -> `export.py`, `techniques/catalog.ts` | Expose compatibility JSON endpoint for Relationship/Marriage partner matching. |
| **High-Value (H4)** | Headless Sudarshana Chakra (3 Wheels) | Radha + Server | `sudharsana_chakra.py` -> `export.py` | Expose Lagna/Moon/Sun 3-wheel synthesis. |
| **High-Value (H5)** | Serve Ashtakavarga, Daily Grade & Muhurta | Server | `chartData/catalog.ts:261–263` | Flip `served: true` for `daily_grade`, `muhurta`, `transit_ashtakavarga`. |
| **High-Value (H6)** | Bhavabala & Vimshopaka Bala | Server | `chartData/catalog.ts:197–198`, `techniques/catalog.ts` | Flip `served: true` for `strength.bhava` & `strength.vimsopaka`. |
| **High-Value (H7)** | Divisional Transit Overlays (D9/D10/D7/D11) | Radha + Server | `transits_export.py` | Add divisional transit sign/contact scope beyond `natal`. |
| **High-Value (H8)** | Bhava Chalit Planetary Shifts | Radha + Server | `natal_export.py`, `digest/build.ts` | Export explicit sign-to-bhava shift map (`houseShift`). |
| **Optional (O1–O3)** | Sarvatobhadra Chakra, Kota Chakra, Pancha Pakshi, TP Compressed Vimshottari | Radha + Server | `ui/chakra.py`, `pancha_paksha.py`, `annual_export.py:69` | Decouple Qt UI chakras into headless JSON exports; add Pancha Pakshi to Lucky Times; add TP compressed Vimshottari. |
