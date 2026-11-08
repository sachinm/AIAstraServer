# Handover Document — Techniques Lab (`Self`, `Love`, `Work`) & Multi-Age-Group Benchmark
**Date**: 2026-11-08  
**Repos**: `AIAstra_Server` (`develop` / `release-candidate-staging`) & `aiadastra_admin` (`develop` / `release-candidate-staging`)

---

## 1. Executive Summary & Deployment Status

1. **`Self`, `Love`, and `Work` Reading Boards Fully Wired in Admin Techniques Lab**:
   - All **25 reading panel techniques** (`9 Self`: `diagnosis`, `chapters`, `lagna`, `mind`, `body`, `atma`, `yogas`, `struggle`, `year`; `8 Love`: `diagnosis`, `chapters`, `heart`, `partner`, `bond`, `circle`, `struggle`, `year`; `8 Work`: `diagnosis`, `chapters`, `vocation`, `standing`, `ground`, `gain`, `struggle`, `year`) are marked `status: 'built'` in `src/techniques/catalog.ts` and wired in `POST /api/admin-lab/run`, `GET /api/admin-lab/dossiers`, and `GET /api/admin-lab/runs/:id`.
   - Shared **Stage 1 AI Sub-Agents** (`family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`) slice from `kundli_digest` + `kundli_activation` + universal `sky`, cache their findings in `reading_findings_cache` (`self:<kundliId>:family.*`), and are reused across `Self`, `Love`, and `Work` at **$0.00 and 0 LLM calls** once warm.
   - **Stage 2 Board Linemen** (`lineman.self`, `lineman.love`, `lineman.work`) and **Stage 3 Board Oracles** (`self.reading.oracle`, `love.reading.oracle`, `work.reading.oracle`) reuse the exact same Gemini `cachedContents` prefix (`parts[0]` = `linemanPrefix`).
   - All 45-minute individual used-cache recycling hooks (`informIndividualCacheUsed` / `recycleIndividualCaches` across Gemini `cachedContents`, `reading_findings_cache`, `technique_outputs`, and in-memory memos) are wired and protected against premature eviction during active runs.

2. **Bugs Fixed in This Checkpoint**:
   - **`src/reading/area/selfCharacterAndJoy.ts` Chara Karaka `PointRow.planet` Fix**: Fixed all 5 occurrences (`buildSelfCharacterArc`, `buildLoveRelationshipArc`, `buildWorkCharacterArc`, `buildWorkVocationAndPersonality`) where `akPoint?.lord`, `dkPoint?.lord`, and `amkPoint?.lord` (the sign dispositor) were read instead of `point?.planet ?? point?.lord` (the Chara Karaka planet itself).
   - **Legacy Chara Karaka `pointOf` Backfill (`src/reading/self/slices.ts`) & `dasha.applicable` Guard (`src/reading/self/service.ts`)**: Added automatic `PointRow.planet` backfill from D1 planet degrees (`AK` → `DK`) for legacy digests built before `2026-11-07`, and filtered `defaultSystemsPresent` against `kundli_data` `dasha.applicable` so non-applicable conditional dashas stored in older `kundli_activation` rows are downgraded to `'other'`.
   - **Complete `love.reading.*` & `work.reading.*` Astrological Coverage (`src/reading/self/panels/love.ts`, `src/reading/self/panels/work.ts`)**:
     - Added `D9.H5` (`house:D9.h5`) to `love.reading.heart`, `Ve`/`Ju` karakas + `D9.L7` (`planet:D9.<L7>`) to `love.reading.partner`, `UL` lord (`planet:D1.<UL.lord>`) to `love.reading.bond`, domain planet parameterization (`[L7, Ve, DK, Mo, Ju]`) + sign-based sub-period support to `love.reading.chapters` & `love.reading.struggle`, and `TP.H5`, `Vivaha`/`Preethi` sahams, and `tithi_ashtottari` fallback to `love.reading.year`.
     - Added `Sa`/`Me`/`Su`/`Ju` karakas + `D10.L10` (`planet:D10.<L10>`) + `D9.AK` Karakamsa (`point:D9.AK`, `planet:D9.<AK>`) to `work.reading.vocation`, `H10` `argala` to `work.reading.standing`, `Ma` (`planet:D1.Ma`) stamina to `work.reading.ground`, `IL` (`point:D1.IL` Indu Lagna) to `work.reading.gain`, domain planet parameterization (`[L10, AmK, Sa, Su, Me, Ju]`) + sign-based sub-period support to `work.reading.chapters` & `work.reading.struggle`, and `TP.H6/H11`, `Karma`/`Rajya`/`Artha` sahams, and `tithi_ashtottari` fallback to `work.reading.year`.
   - **`card.ts` & `purview.ts` Claim ID Alignment**: Aligned `PRIORITY` in `src/reading/self/card.ts` and `targetClaims` / `affects` in `src/reading/self/purview.ts` with the exact claim IDs produced by `love.ts` and `work.ts`.
   - **Generalized `body.ts`, Sign-Clock Sub-Periods in `chapters.ts` / `struggle.ts`, & `TP` Fallback in `year.ts`**: Removed Pisces-specific keyboard/technical wording from `body.hands_neck_nerves`, added sign-period lord resolution (`r.lord ?? view.houses('D1').find(h => h.sign === r.sign)?.lord`) in `chapters.ts` and `struggle.ts`, and allowed `yearPanel` to run from `TP` + `activeTpAshtottariPeriod` when `VP` `mudda` is absent.
   - **Admin Lab UI & Adapter Fixes (`aiadastra_admin`)**: Fixed `dossierToLabRun` in `api/src/labAdapter.ts` to pass `runBoard` into `readersOf`, and updated `web/src/pages/TechniquesLab.tsx` to clear stale `technique` selection when switching between `Self`, `Love`, and `Work` tabs.

---

## 2. Four-School Vedic Astrology Audit (`Self`, `Love`, `Work`)

| Board | Technique | Parashara (D1/Vargas/Yogas/Avasthas) | Jaimini (Karakas/Arudhas/Argala/Rasi Dashas) | Pt. Sanjay Rath (UL/A7/A10/AL/SL/HL/GL/Karakamsa) | Lunar Astro / Deepanshu Giri (Bhrigu/Dispositor Chains/6-8 & 2-12/Pending Karma) | Status & Next Expansion |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Self** | `self.reading.lagna` | H1, L1 D1+D9, occupants/aspects, Moon-Lagna, Janma Star | AL (Arudha Lagna) | AL placement & lord | Star-lord & dispositor chain | **Built & Verified** |
| **Self** | `self.reading.mind` | Mo, Me, H4/L4, H3/L3, H5/L5, D9/D24 | MK, PK | Manas (Mo) vs Buddhi (Me) | Nakshatra chain | **Built & Verified** |
| **Self** | `self.reading.body` | All 12 houses (H1..H12), D1/D9/D30/D60, SAV, TP/VP 2025–2027 | AL, SL, HL, GL, A6, A8, H1 Argala, Narayana | Mandi (MD), Gulika (GK), Prana/Deha/Mrityu Sphutas | Multi-clock convergence + Gochara + Khara (K64M/KD22) | **Built & Verified** |
| **Self** | `self.reading.atma` | Su, Ju, H9/L9, H12/L12 | AK (`PointRow.planet`), Karakamsa (`D9.AK`) | Karakamsa sign/house + co-occupants | AK avastha & shadbala | **Built & Verified** (with `PointRow.planet` backfill) |
| **Self** | `self.reading.yogas` | Gift & Knot yogas touching `[L1, Mo, Su, AK]` & `[1, 4, 5, 9, 10]` | — | Neecha-bhanga & Viparita checks | Delivery ripeness gate | **Built & Verified** |
| **Self** | `self.reading.chapters` | Primary reading clock + Vimshottari | Narayana + Chara confirming clocks | Conditional dasha applicability (`dasha.applicable`) | 9×9 Antardasha fruition (`isShadAshtaka68`, `isDwirdwadasha212`) | **Built & Verified** |
| **Self** | `self.reading.struggle` | L1/Mo/Su/AK debility, ripeness, dusthana, malefics on H1/Mo/H4/H5 | — | — | Exact release dates from reading clock | **Built & Verified** |
| **Self** | `self.reading.year` | TP & VP D1 (2025/2026/2027), L1 in TP, TP H1 lord | — | `tithi_ashtottari` (with 108y→1y compression) & `mudda` | — | **Built & Verified** |
| **Self** | `self.reading.diagnosis` | 3-part synthesis (`direction`, `tension`, `now`) | — | Purview whole-chart vetoes & annotations | — | **Built & Verified** |
| **Love** | `love.reading.heart` | H5, L5, Ve, Mo, D9.H5, D9.H7, D9.Ve | A7, UL | Romance (`A7`) vs covenant (`UL`) | Venus/Moon state & cancellation | **Built & Verified** |
| **Love** | `love.reading.partner` | H7, L7, Ve, Ju, D9.H7, D9.L7, H7 SAV | DK (`PointRow.planet`), UL, A7 | UL + UL lord + A7 | Dispositor & D9 confirmation | **Built & Verified** |
| **Love** | `love.reading.bond` | H2/L2, H4/L4, H7/L7, H8/L8, Ju, D9.H1/H7, D7.H1 | H7 Argala & Virodhargala | UL sustenance & 8th-house repair | — | **Built & Verified** |
| **Love** | `love.reading.circle` | H2/L2, H4/L4, H11/L11, H5/L5, D7.H5 | MK, PK, A11 | — | — | **Built & Verified** |
| **Love** | `love.reading.chapters` | Multi-clock filtered to `[7, 5, 11, 2, 8, 4, 12]` & `[L7, Ve, DK, Mo, Ju]` | UL/A7 sign-period detection | — | 9×9 AD fruition | **Built & Verified** |
| **Love** | `love.reading.struggle` | L7/Ve/DK/Mo/UL lord dusthana/debility/ripeness, Manglik/Kalathra doshas | — | Upapada/Kalathra knots | Dated release from reading clock | **Built & Verified** |
| **Love** | `love.reading.year` | TP & VP D1 on H7, H5, L7, Ve | — | `Vivaha`/`Preethi` sahams, `mudda` & `tithi_ashtottari` | — | **Built & Verified** |
| **Love** | `love.reading.diagnosis` | 3-part Love synthesis (`heart`/`partner` + `struggle` + `chapters`) | — | `purview.seventh_lord_standing` | — | **Built & Verified** |
| **Work** | `work.reading.vocation` | H10, L10, H3, H5, Sa/Me/Su/Ju, D10.H1/H10/L10 | AmK (`PointRow.planet`), D9.AK | Karakamsa (`D9.AK`) & D10 Dasamsa | — | **Built & Verified** |
| **Work** | `work.reading.standing` | Su, L10, H10 SAV | AL, A10, H10 Argala & Virodhargala | GL (Ghatika), HL (Hora), SL (Sree), A10 (Rajyapada) | — | **Built & Verified** |
| **Work** | `work.reading.ground` | H6/L6, H3/L3, H7/L7, H12/L12, D10.H6/H3, Sa & Ma stamina | A6 (Rogapada), A3 (Vikramapada) | — | — | **Built & Verified** |
| **Work** | `work.reading.gain` | H11/L11, H2/L2, D2.H1, D10.H11, Dhana/Raja yogas, SAV H2/H10/H11 | A11 (Labhapada), A2 (Dhanapada), IL (Indu Lagna) | Indu Lagna (`IL`) & Arudha Padas | — | **Built & Verified** |
| **Work** | `work.reading.chapters` | Multi-clock filtered to `[10, 6, 11, 2, 9, 3, 5, 7]` & `[L10, AmK, Sa, Su, Me, Ju]` | A10/AL sign-period detection | — | 9×9 AD fruition | **Built & Verified** |
| **Work** | `work.reading.struggle` | L10/L6/Sa/AmK/Su dusthana/debility/ripeness, H6/H11 friction | — | — | Dated release from reading clock | **Built & Verified** |
| **Work** | `work.reading.year` | TP & VP D1 on H10, H6, H11, L10, Sa | — | `Karma`/`Rajya`/`Artha`/`Labha` sahams, `mudda` & `tithi_ashtottari` | — | **Built & Verified** |
| **Work** | `work.reading.diagnosis` | 3-part Work synthesis (`vocation`/`standing` + `struggle` + `chapters`) | — | `purview.tenth_lord_standing` | — | **Built & Verified** |

---

## 3. 12-Person Multi-Age-Group Cohort (`20s` to `70s`) & Next Step Instructions

### 3.1 Verified 12-Person Cohort (`ready` in PostgreSQL)

| # | Age Bracket | User ID | Kundli ID | DOB | Age | Sex | Lagna |
| :- | :--- | :--- | :--- | :--- | :-: | :-: | :--- |
| 1 | **20s (Early)** | `66d2b5dc-6e92-497e-bcd6-524e08aedc0e` | `d13bae8a-6575-487c-9c5f-65895c989561` | `2006-07-13` | 20 | M | Leo |
| 2 | **20s (Early)** | `d73cd8af-62cf-4ed7-9204-156d88aeca3d` | `de3223e3-0263-4275-bd9e-633f4d87c557` | `2006-10-23` | 20 | F | Cancer |
| 3 | **20s (Mid)** | `132c6e0e-2671-4ce9-8951-d2c852685546` | `130e0c3e-65f4-4d77-b1fb-b2082c796646` | `2002-04-27` | 24 | M | Virgo |
| 4 | **20s (Late)** | `7258d572-991d-408f-8280-f17850cc5362` | `6514751c-9b30-45e6-bad6-0a56415e067b` | `1998-12-17` | 27 | F | Pisces |
| 5 | **30s (Early)** | `c32e2dc3-a39c-4177-ab31-fe7ccddca893` | `ab0aa96f-7552-4e57-8077-af839274dd73` | `1994-07-14` | 32 | M | Scorpio |
| 6 | **30s (Mid)** | `ecf427b1-ab0e-4c5c-a6a0-9ab92aefc17b` | `617468bb-38b3-4b50-bffb-4dd2c76a4856` | `1990-01-01` | 36 | — | Virgo |
| 7 | **40s (Early)** | `d6324704-7418-4f73-8572-4b9217719cf8` | `3784ca07-66ba-4319-8b90-4a64073032ac` | `1985-10-14` | 41 | M | Aquarius |
| 8 | **40s (Mid)** | `19b210cd-d24a-4aed-a54a-ae8e2a1b7df2` | `c584c0a3-841b-451b-a2ed-f5709c5fb31d` | `1980-10-14` | 46 | M | Pisces (Sachin) |
| 9 | **50s (Early)** | `74aa9300-b095-494a-9fd6-40be1bae0f91` | `75b0d618-90b7-4db6-bff8-cc7bb0ed561f` | `1975-09-06` | 51 | M | Sagittarius (Sumit) |
| 10 | **50s (Mid)** | `3166391e-f326-47f6-b78c-d3147f551ced` | `be89e63f-2b63-4d48-a29e-c18df012522a` | `1972-08-23` | 54 | F | Gemini |
| 11 | **60s (Mid)** | `ecf5083d-9acc-439e-a6c8-1b5ce01bd218` | `af8ca446-cc1b-4e9c-bc2b-cc17300bbb37` | `1961-05-24` | 65 | M | Virgo |
| 12 | **70s (Late)** | `9ef36c78-f92d-4b48-bf6d-59d5874e0b0d` | `858f2f20-041c-4c74-8e7e-3fa4f251e19d` | `1947-01-16` | 79 | M | Leo |

### 3.2 Exact Next Steps for the Resuming Session

1. **Refresh Digests for the 12-Person Cohort (`$0.00` LLM Spend)**:
   - Run `buildDigest(prisma, kundliId, { fetch: false })` across the 12 kundlis above so their `kundli_digest` (`PointRow.planet` on `AK..DK`) and `kundli_activation` (`dasha.applicable` filter) are persisted in PostgreSQL alongside the in-memory fallbacks added in `slices.ts` and `service.ts`.
   - For `fa3c74c9-2777-4083-907c-b41d4646fd94` (`rohaan`), run `topUpAnnualSet` / `buildDigest(prisma, kundliId, { fetch: true })` if multi-year `annual:VP` / `annual:TP` rows need to be pulled from Radha.
2. **Run the 12-Person Multi-Age-Group Benchmark (`scripts/benchmark-10-people-boards.ts`)**:
   - Update `scripts/benchmark-10-people-boards.ts` with the 12-person cohort table above and execute it (`npx.cmd tsx scripts/benchmark-10-people-boards.ts`).
   - Because 9 of the 12 people already have warm `family.*`, `lineman.*`, and `*.reading.oracle` caches in PostgreSQL (cumulative spend so far: **$0.3474**), running the remaining 3 subjects (`132c6e0e`, `c32e2dc3`, `3166391e`) will cost only **~$0.11**, keeping total spend at **~$0.46** (well under the **$1.00** cap!).
3. **Browser Click-Through & Independent Reviewer Sign-Off**:
   - Verify live browser click-through on `https://admin.vedic-astrology.app/techniques-lab` across `Self`, `Love`, and `Work` (`Inputs`, `Flow`, `Purview`, `Linemen`, `Brief`, `Output`, `Audit`, `Cost`), and run an independent reviewer sub-agent over `docs/research/10-person-self-love-work-benchmark.md`.
