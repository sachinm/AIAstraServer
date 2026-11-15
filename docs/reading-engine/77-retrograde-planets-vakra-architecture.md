# 77 — Retrograde Planets (*Vakra Grahas*) Across `D1–D144`, Tithi Pravesha, Transits & Reading Techniques

**Status:** Active (`v1.0`, `2026-11-15`)  
**Scope:** `AIAstra_Radha` (`src/jhora/motion_export.py` + all `D1..D144` natal, annual, prashna, transit, daily, and pressure exports) & `AIAstra_Server` (`src/config/env.ts`, `src/reading/digest/*`, `src/reading/dasha/*`, board/life/timeline/lucky-times/reader techniques, prompts, and 8-gate technical verifier).

---

## 1. Classical Jyotish Foundations & Astronomical Grounding

In Vedic astrology (*Brihat Parashara Hora Shastra* Ch. 27, *Phaladeepika* Ch. 4, *Saravali*, *Uttara Kalamrita* Ch. 2 Sloka 6, *Bhrigu/Nandi Nadi*, and *Tajika Neelakanthi*), planetary motion (*Gati*) is never binary:

1. **True *Vakri* Grahas (`Mars`, `Mercury`, `Jupiter`, `Venus`, `Saturn`) vs. Luminaries & Nodes**:
   - **Sun (`Su`) & Moon (`Mo`)**: Never retrograde (`is_retrograde = false`, `motion_kind = "direct"`), moving in `manda` / `sama` / `chara` speed bands.
   - **Rahu (`Ra`) & Ketu (`Ke`)**: Mean-retrograde / *Pratiloma* shadow nodes (`is_retrograde = false`, `is_mean_retrograde = true`, `motion_kind = "pratiloma"`, `motion_state = "pratiloma"`). Keeping `is_retrograde: false` prevents Parashari *Vakra* / *Cheshta Bala* / *Shakta* rules from misfiring on 100% of charts while explicitly recording nodal backward motion.
   - **Five *Taragrahas* (`Ma`, `Me`, `Ju`, `Ve`, `Sa`)**: Experience true apparent geocentric retrogression (`speed_deg_per_day < 0`, `is_retrograde = true`, `motion_kind = "vakra"`).

2. **Eightfold Motion (*Ashtagati*, BPHS Ch. 27)**:
   - `vikala` (*Stambhana* / Stationary: `|speed| <= JHORA_STATION_SPEED_RATIO * mean_speed`, default `5%`): Concentrated turning point; significations freeze, intensify, and pivot sharply.
   - `vakra` (Retrograde within the sign where it stationed): Maximum *Gati Cheshta* (`60` virupas), internalized effort, iterative/second-pass mastery.
   - `anuvakra` (Retrograde after backing into the preceding `D1` sign): `30` virupas; bridges unfinished lessons from the next house back into the occupied house.
   - `mandatara` (Very slow direct, `<= 25%` mean): `15` virupas; deliberate, heavy pacing.
   - `manda` (Slow direct, `<= 50%` mean): `30` virupas; measured progress.
   - `sama` (Normal direct): `7.5` virupas; standard baseline flow.
   - `chara` (Fast direct, `>= 115%` mean): `45` virupas; brisk external momentum.
   - `atichara` (Accelerated forward motion, `>= 150%` mean): `30` virupas; rapid, compressed developments requiring grounding.

3. **True-Speed Combustion Orbs (*Moodha / Asta*, BPHS)**:
   - Direct vs. retrograde longitudinal orbs from the Sun:
     - `Moon`: `12°`
     - `Mars`: `17°`
     - `Mercury`: `14°` direct / **`12°` retrograde**
     - `Jupiter`: `11°`
     - `Venus`: `10°` direct / **`8°` retrograde**
     - `Saturn`: `15°`

---

## 2. Dignity × Retrograde Regimes (`RETROGRADE_DIGNITY_MODEL`)

Controlled via `getRetrogradeDignityModel()` in `src/config/env.ts`:

- **`nuanced_parashari` (Default)**:
  - **Exalted + Retrograde (`uccha_vakra`)**: High *Uchcha Bala* + high *Cheshta Bala*, moderated from effortless linear ease (`+1.5` -> `+1.0` default via `RETROGRADE_UCCHA_SCORE_MODERATION`) because results arrive through perfectionism, non-linear detours, or a deliberate second pass rather than conventional first-try smoothness.
  - **Debilitated + Retrograde (`neecha_vakra`)**: High *Cheshta Bala* refuses passive collapse; uplifts non-vargottama debilitation (`+0.75` default via `RETROGRADE_NEECHA_SCORE_UPLIFT`, shifting `-1.0..-1.3` toward resilient second-attempt breakthrough) when `D9` is neutral or redeeming, **while preserving strict guardrails on *Neecha Vargottama* (`isNeechaVargottama`)** so chronic structural friction is never mislabeled as effortless luck.
  - **Own / Moolatrikona + Retrograde (`swakshetra_vakra`)**: Deep self-reliant autonomy and durable mastery built on one's own terms.
- **`uttara_kalamrita_strict` (Lab A/B Replay Option)**:
  - Applies *Uttara Kalamrita* Ch. 2 Sloka 6 polarity inversion on non-*Neecha Vargottama* placements for comparative calibration studies.

---

## 3. Per-Planet Behavioral Playbook (Digested Plain-English Register)

Every consumer `Read` and `Short` card face translates astrological mechanics into plain, specific, jargon-free English (`plainProse()` / `redactChartTerms()`), while `Chart details` cites exact engine fields:

| Planet | Technical Engine Signature | Plain-English Behavioral & Timing Counsel |
|---|---|---|
| **Mars (`Ma`)** | `retro=true`, `motion_state`, `cheshta_bala` | Internalized drive, strategic pacing, and strong second-wind stamina; progress comes from measured, deliberate execution rather than impulsive confrontation or bottled-up tension. |
| **Mercury (`Me`)** | `retro=true`, `combust`, `motion_state` | Iterative, systems-level thinking that spots details others miss; thrives on editing, auditing, and second-look verification — confirm written terms rather than relying on rushed verbal assumptions. |
| **Jupiter (`Ju`)** | `retro=true`, `dignity`, `cheshta_bala` | Self-tested judgment and first-principles wisdom over borrowed orthodoxy; lasting expansion and recognition compound once the plan is refined firsthand. |
| **Venus (`Ve`)** | `retro=true`, `combust`, `d9` confirmation | Selective, deeply personal standards in affection, loyalty, and craft; favors genuine alignment and repairing/clarifying bonds over performative social ease or rushed commitments. |
| **Saturn (`Sa`)** | `retro=true`, `pending_karma`, `cheshta_bala` | High internal accountability and refusal of hollow structure; areas touched often require restructuring or a second build cycle, forging durable, self-authored mastery. |

---

## 4. Divisional Charts (`D1–D144`), Tithi Pravesha & Transits

1. **All 23 Divisional Charts (`D1..D144`)**:
   - `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144`.
   - Every planet placement across Natal, Tithi Pravesha / Varsha, Prashna, and Transit exports carries `is_retrograde`, `is_mean_retrograde`, `motion_kind`, `speed_deg_per_day`, `is_stationary`, `motion_state`, `combust`, `cheshta_bala`, `varga_reckoning` (`"direct" | "reverse"`), and `varga_sandhi` (`bool`).
2. **Post-36 `D1 + D9` & Departmental Vargas (`D10`, `D7`, `D30`, `D24`, `D20`)**:
   - Above `D9_MATURITY_AGE_YEARS` (`36`), `evaluateD1D9MutualConfirmation` and `evaluateActiveDashaWithVargaAndTP` incorporate `vakraRegime`, `motionState`, and `cheshtaBala` for both Mahadasha and Antardasha lords across all 40+ dasha clocks.
3. **Tithi Pravesha (`annual.tithi_pravesha` `D1..D144`)**:
   - Evaluates planetary motion at the exact return instant (`ret_jd`), surfacing `yearLordRetro`, `yearLordMotionState`, `horaLordRetro`, `lagnaLordRetro`, and `AnnualRow.planets`. A retrograde or stationary TP Year Lord shifts the annual operating posture toward review, renegotiation, auditing, and completing unfinished business before over-extending.
4. **Transits, Multi-Pass Contacts & Daily Lucky Times**:
   - `TRANSIT_RANGE_BODIES` (`Sa,Ju,Ma,Me,Ve,Ra,Ke`) and `pressure_inventory` (`Sa,Ju,Ma,Me,Ve` stations over 550 days) capture all 5 taragraha stations and 3-pass retrograde loops (`exact_hits`).
   - Lucky Times (`muhurta.planet_motion`) down-ranks/flags contract-signing and investment windows during Mercury retrograde/stationary/combust days and courtship-initiation windows during Venus retrograde/combust days via env-configurable scenario maps.

---

## 5. Boundaries, Caching & Verification Guarantees

- **Zero Astrological Math in Node**: All speeds, *Ashtagati* classifications, combustion orbs, *Cheshta Bala* virupas, and `D1..D144` varga reckoning are computed exclusively in `AIAstra_Radha`.
- **Cache Hygiene**: Digest schema bumps `DIGEST_VERSION = 'd1.2026-11-15-vakra'`; explicit Gemini prefix caches remain anchored in `parts[0]` (`llm_cache_entries` + 45-minute `recycleIndividualCaches` cleanup).
- **8-Gate Technical Verifier (`research.technical_verifier`)**: Verifies retrograde regime fidelity, *Neecha Vargottama* non-inversion, TP `yearLordRetro` alignment, and zero astrological/engine jargon on consumer card faces (`>= 95%` pass threshold).

---

## 6. How Reading Techniques & Engines Ingest Retrograde (*Vakra*) Data

Every astrological module and reading pipeline across AI AdAstra is informed by the retrograde enhancements:

### 6.1 Dasha Assessment & Multi-Clock Timing (`src/reading/dasha/`)
- **`retrogradeRules.ts`**:
  - Implements `evaluateVakraDignityRegime()` governing `Ma`, `Me`, `Ju`, `Ve`, and `Sa`.
  - Under `nuanced_parashari`, `uccha_vakra` applies a moderate score adjustment (`-0.35`) reflecting perfectionism and revision cycles, while `neecha_vakra` provides uplift (`+0.75`) reflecting resilient second-attempt breakthrough.
  - **Absolute Invariant**: `isNeechaVargottama` (debilitated in the same sign across D1 and D9) is NEVER inverted into strength, even with maximum Cheshta Bala; it remains a fixed structural boundary (*Drudha Karma*).
- **`dashaAssessment.ts`**:
  - `evaluateActiveDashaWithVargaAndTP()` resolves active Mahadasha and Antardasha lords across all 40+ dasha families. If the lord is retrograde or stationary (`vikala`), its operational mode shifts from straightforward forward momentum to iterative refinement and renegotiation.
  - Tithi Pravesha integration flags `yearLordRetro` and `yearLordMotionState` to steer the year's posture (`iterative_review` vs. `linear_build`).

### 6.2 Board Sub-Techniques & Narrative Cards (`src/reading/self/`, `src/reading/area/`)
- **Self 3-Decade Character Arc (`self.character_arc`)**:
  - Synthesizes the active Mahadasha lord's retrograde status across Last 10 Years, Who You Are Now, and Next 10 Years. When a chapter lord is retrograde, the narrative frames that decade around building resilience through second-pass mastery and course correction.
- **Self Personality & Joy (`self.personality_joy`)**:
  - Ingests Mercury's motion state in D1, D9, and D24. A retrograde Mercury reflects an introspective, deeply analytical intellect that prefers double-checking details and editing over superficial speed.
- **Career & Work Arcs (`src/reading/area/career.ts`)**:
  - D10 (Dasamsa) checks incorporate retrograde motion of the 10th lord and Karakas (Sun, Saturn, Mercury, Jupiter). Retrograde lords in D10 highlight iterative career pivots and specialized domain mastery.

### 6.3 Lucky Times & Muhurta Scenarios (`src/reading/luckyTimes/`)
- **`scenarios.ts` & `windows.ts`**:
  - Read `muhurta.planet_motion` from Radha's day row.
  - Enforces `getLuckyRetrogradeAvoidMap()`:
    - **Mercury Retrograde/Stationary/Combust**: Down-ranks contract signing (`work.sign_contract`), major purchases (`money.invest_buy`), and product launches (`work.launch`).
    - **Venus Retrograde/Combust**: Down-ranks courtship initiation and luxury purchases.
    - **Mars Retrograde**: Down-ranks high-friction confrontations and risky surgical procedures.
  - Graceful fallback: If `planet_motion` is absent in legacy day rows, scoring continues without penalty.

### 6.4 Code Readers & Oracle Synthesis (`src/reading/codeReaders/`, `src/reading/oracle/`)
- **`vargaDynamics()`**:
  - Checks for *Neecha Vargottama* before applying any vargottama bonuses. When present, emits a `varga_agree_weak` finding with an explicit structural boundary note.
  - For non-vargottama retrograde planets, emits cited claims documenting second-pass development.
- **Oracle Brief & Grounding (`brief.ts`)**:
  - Groups grounded retrograde observations under their respective planetary tags while strictly scrubbing technical jargon (`vakra`, `cheshta_bala`, etc.) from consumer-facing text.

### 6.5 Research Verifier (`research.technical_verifier`)
- Audits Gate 2 (Divisional Varga Alignment) to confirm that no retrograde debilitated planet in D1+D9 has been falsely inverted into strength.
- Audits Gate 7 (Temporal Continuity) to confirm that `yearLordRetro` is accurately factored into annual review postures.
- Audits Gate 8 (SOUL.md Compliance) to guarantee that zero banned engine names or Sanskrit motion jargon leak onto consumer card faces.
