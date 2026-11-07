# Volume 01 — Architecture, Reusable Pieces, Date-Range Cache & Digest Techniques

> **Format**: One illustration per page (`Page 1 of 10` through `Page 10 of 10`), separated by `---`.  
> **Code References**: [`src/techniques/pieces.ts`](../../src/techniques/pieces.ts) · [`src/techniques/piecesDoc.ts`](../../src/techniques/piecesDoc.ts) · [`src/techniques/catalog.ts`](../../src/techniques/catalog.ts) · [`src/techniques/layouts.ts`](../../src/techniques/layouts.ts) · [`src/reading/digest/build.ts`](../../src/reading/digest/build.ts) · [`docs/reading-engine/56-technique-pieces-and-validity-windows.md`](../reading-engine/56-technique-pieces-and-validity-windows.md)

---

## Page 1 of 10 — Master Architecture: Digest Once, Assemble from Pieces, Cache by Date Range

Every astrological calculation is performed once by the **Calculation Engine** (`POST /api/export-horoscope`) and stored vertically in `kundli_data`. The deterministic **Kundli Digest** (`digest.build`, `digest.annual_set`, `digest.activation`) compiles those raw tables into six provenance-tagged sections (`house`, `planet`, `yoga`, `point`, `annual`, `star`) and a 30-year multi-system activation calendar (`kundli_activation`). Every technique across Chat, You, Love, Work, Lucky Times, and Life Reading is assembled from standardized **Reusable Pieces** and gated by `piece.cache.date_range_window`.

```mermaid
flowchart TD
    subgraph Tier1["Tier 1: Calculation Engine & Vertical Store"]
        CE["Calculation Engine (105+ Export Types)"] --> KD[("kundli_data (D1..D144, 43 Dashas, Yogas, Strengths)")]
        CE --> SHARED[("Shared Sky & Panchang: transit_range_skies + day_tables")]
    end

    subgraph Tier2["Tier 2: Deterministic Kundli Digest (Zero AI)"]
        KD --> D_BUILD["digest.build (agent: digest.build)"]
        KD --> D_ANN["digest.annual_set (agent: digest.annual_set)"]
        KD --> D_ACT["digest.activation (agent: digest.activation)"]
        D_BUILD & D_ANN --> TBL_DIG[("kundli_digest (house, planet, yoga, point, annual, star)")]
        D_ACT --> TBL_ACT[("kundli_activation (Birth to +30 Years, Levels 1-3)")]
    end

    subgraph Tier3["Tier 3: Standardized Reusable Reader & Loader Pieces"]
        TBL_DIG --> SLICERS["Digest Slicers (natal / annual):<br/>piece.digest.house_cards | planet_cards | yoga_register | point_cards | star_profile | annual_set"]
        TBL_ACT --> CAL_SLICE["Activation Loader (dasha):<br/>piece.activation.calendar_slice"]
        SHARED --> SKY_LOAD["Sky & Panchang Loaders (2h / 1d):<br/>piece.transit.sky_overlay | piece.panchang.day_limbs | piece.panchang.personal_overlay | piece.prashna.cast_2h"]
    end

    subgraph Tier4["Tier 4: Date-Range Window Cache Gate (piece.cache.date_range_window)"]
        SLICERS & CAL_SLICE & SKY_LOAD --> GATE{"kundli_technique_windows<br/>valid_from <= as_of < valid_to?"}
        GATE -->|"HIT (Valid Window)"| CACHED["Skip Agent (status: 'skipped', $0.00)<br/>Serve Stored Digested Output"]
        GATE -->|"MISS / Expired"| RUN_TECH["Run Technique Scorer or LLM Analyst"]
    end

    subgraph Tier5["Tier 5: Scorers, LLM Analysts, Synthesizer & Validator"]
        RUN_TECH --> CODE_SCORER["Deterministic Scorers & Code Readers:<br/>piece.scorer.* | piece.voter.* | piece.code_reader.rule_engine"]
        RUN_TECH --> LLM_ANALYST["LLM Analysts & Oracle Readers:<br/>piece.llm.specialist_analyst | piece.llm.oracle_reader"]
        CODE_SCORER & LLM_ANALYST --> STORE_WIN["Write [valid_from, valid_to) to kundli_technique_windows"]
        CACHED & STORE_WIN --> SYNTH["Synthesizer / Board Builder:<br/>piece.llm.synthesizer (general.oracle) | Area Boards | Life Dashboard"]
        SYNTH --> VALID["Validator:<br/>piece.validator.rule_and_model (general.validator)"]
    end
```

---

## Page 2 of 10 — Class 1 & 2 Pieces: Digest Slicers (`natal` / `1y`) & Time-Windowed Loaders (`2h` / `1d` / `dasha`)

Every technique reads its inputs exclusively through 12 named tabular layouts (`src/techniques/layouts.ts`). In `src/techniques/pieces.ts`, each `(section, layout)` pair is a single reusable **Reader Piece** (`reader:<section>/<layout>`), parameterized by the technique's `filter` (which houses, vargas, planets, or years to slice).

```mermaid
flowchart LR
    subgraph DigestSlicers["Class 1: Digest Slicers (from kundli_digest)"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>12 cols: varga, house, lord, lord_house, lord_dignity,<br/>occupants, aspected_graha, aspected_rasi, argala, sav, class, cusp_star"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>16 cols: varga, planet, sign, house, degree, star, dignity,<br/>retro, combust, dispositor, owns, aspects_to, aspected_by, conjunctions, shadbala_rank, nature"]
        P_YR["piece.digest.yoga_register<br/>(reader:yoga/yoga_row)<br/>7 cols: varga, yoga, present, class, planets, houses, rule"]
        P_PT["piece.digest.point_cards<br/>(reader:point/point_row)<br/>6 cols: point, varga, sign, house, lord, lord_house"]
        P_ST["piece.digest.star_profile<br/>(reader:star/star_profile)<br/>6 cols: point, star, pada, star_lord, tara, gandanta"]
        P_AN["piece.digest.annual_set<br/>(reader:annual/annual_row)<br/>12 cols: year, kind, varga, lagna, house, lord, occupants, aspects, sahams, year_dasha, muntha, year_lord"]
    end

    subgraph WindowedLoaders["Class 2: Time-Windowed Sky & Calendar Loaders"]
        P_AC["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>8 cols: system, family, level, lord_or_sign, from, to, houses, polarity"]
        P_TR["piece.transit.sky_overlay<br/>(reader:transit/transit_row)<br/>9 cols: date, planet, sign, house_from_lagna, house_from_moon, house_from_al, contact, station, bindus"]
        P_PD["piece.panchang.day_limbs &<br/>piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day)<br/>12 cols: date, place, vara, tithi, nakshatra, yoga, karana, horas, avoid_bands, good_spans, tara, chandra_bala"]
        P_PR["piece.prashna.cast_2h<br/>(reader:prashna/prashna_card)<br/>8 cols: asked_at, place, lagna, house, lord, occupants, moon_star, arudha"]
    end

    subgraph Consumers["Shared Across All 67 Catalogue Techniques"]
        C_GEN["General Reading (15 techniques)"]
        C_SELF["Self Board (8 techniques)"]
        C_LOVE["Love Board (11 techniques)"]
        C_WORK["Work Board (9 techniques)"]
        C_LUCKY["Lucky Times (17 techniques)"]
        C_LIFE["Life Reading (4 techniques)"]
    end

    DigestSlicers --> C_GEN & C_SELF & C_LOVE & C_WORK & C_LUCKY & C_LIFE
    WindowedLoaders --> C_GEN & C_SELF & C_LOVE & C_WORK & C_LUCKY & C_LIFE
```

| Reader Piece (`src/techniques/pieces.ts`) | Canonical Architectural Piece | Freshness Tier | Techniques Reusing This Piece |
|---|---|---|---|
| `reader:house/house_card` | `piece.digest.house_cards` | `natal` | 30 techniques (`general.*`, `self.*`, `love.*`, `work.*`, `life.*`, `digest.build`) |
| `reader:planet/planet_card` | `piece.digest.planet_cards` | `natal` | 29 techniques (`general.*`, `self.*`, `love.*`, `work.*`, `lucky.personal_overlay`, `life.*`, `digest.*`) |
| `reader:activation/activation_row` | `piece.activation.calendar_slice` | `dasha` | 21 techniques (`work.*`, `self.*`, `love.*`, `general.dasha`, `general.reader`, `lucky.personal_overlay`, `life.*`) |
| `reader:panchang/panchang_day` | `piece.panchang.day_limbs` / `personal_overlay` | `daily` | 17 techniques (`lucky.day_tables`, `lucky.panchang_limbs`, `lucky.avoid_bands`, `lucky.personal_overlay`, 13 `lucky.*` scenarios) |
| `reader:transit/transit_row` | `piece.transit.sky_overlay` | `transit` | 12 techniques (`work.*`, `self.transit`, `love.transit`, `general.transit`, `general.reader`, `life.*`) |
| `reader:yoga/yoga_row` | `piece.digest.yoga_register` | `natal` | 12 techniques (`self.*`, `love.*`, `general.promise`, `general.strength_yoga`, `general.reader`, `life.*`, `digest.build`) |
| `reader:point/point_row` | `piece.digest.point_cards` | `natal` | 11 techniques (`self.*`, `love.*`, `work.karaka_family`, `general.promise`, `general.jaimini`, `general.reader`, `digest.build`) |
| `reader:annual/annual_row` | `piece.digest.annual_set` | `annual` | 9 techniques (`work.annual_family`, `self.annual`, `love.annual`, `general.annual`, `general.reader`, `life.*`, `digest.*`) |
| `reader:star/star_profile` | `piece.digest.star_profile` | `natal` | 4 techniques (`self.nakshatra`, `love.nakshatra`, `general.nakshatra`, `digest.build`) |
| `reader:prashna/prashna_card` | `piece.prashna.cast_2h` | `question` | 2 techniques (`general.prashna`, `general.reader`) |

---

## Page 3 of 10 — Class 3 & 5 Pieces: Deterministic Scorers, Error-Correction Voters & LLM Agents

Techniques never duplicate scoring logic or prompt orchestration. Code techniques run through 8 deterministic **Scorer / Voter / Rule Engine Pieces** (`system: 'none'`), while conversational techniques run through 4 **LLM / Validation Pieces**.

```mermaid
flowchart TD
    subgraph DeterministicPieces["Class 3: Deterministic Scorers & Error-Correction Checkers (Zero AI)"]
        S_PROM["piece.scorer.promise_layer<br/>(houseLayers.ts promiseLayer / life/promise.ts)<br/>Scores D1 lord placement (+2), dignity (+2), benefic occupants/aspects (+1),<br/>SAV >= 28 (+1), yogas (+1..+2), avastha multiplier (x0.5..x1.25), shadbala >= 1.2 (+1)"]
        S_AFF["piece.scorer.affliction_layer<br/>(houseLayers.ts afflictionLayer, releaseOf)<br/>Scores dusthana lord (2), uncancelled debility (2), combustion (1), war (1),<br/>Sa/Ra/Ke/Ma aspect/conjunction (1..1.5), named doshas, and computes release date from activation"]
        S_PROT["piece.scorer.protection_layer<br/>(houseLayers.ts protectionLayer)<br/>Scores Jupiter drishti/occupancy (+2), unobstructed benefic argala (+1),<br/>dignified dispositor (+1), yoga cancellations (+2), owning varga lord dignity (+2)"]
        S_VARGA["piece.scorer.varga_agreement<br/>(career.ts workD10Check / houseLayers.ts vargaLayer)<br/>Enforces D1 + owning varga agreement (D9 tie-breaker; D60 only with exact minute birth time)"]
        S_NAK["piece.scorer.nakshatra_charter<br/>(houseLayers.ts nakshatraLayer)<br/>Scores primary house cusp star lord dignity (+1) and running PD lord star-lord delivery (+1.5)"]
        V_CLOCK["piece.voter.five_family_clock<br/>(career.ts presentState / houseLayers.ts familyVotes)<br/>Aggregates Main, Conditional, Rasi, Karaka, Annual, Transit, and Short Clocks (Yogini + Tithi Ashtottari must agree)"]
        V_SEC["piece.voter.security_gate<br/>(career.ts securityGrade)<br/>Checks End Lords (9, 5, 6, 8, 12) + Sa/Ra/Ke driver gate -> clear_protected, clear, watch, risk, high_risk"]
        R_CODE["piece.code_reader.rule_engine<br/>(codeReaders/readers.ts + rules.ts)<br/>Emits up to 8 weighted findings.v2 claims with digest.<section>.<key>.<field> evidence citations"]
    end

    subgraph LLMPieces["Class 5: LLM Analysts, Oracle Readers, Synthesizer & Validator"]
        L_SPEC["piece.llm.specialist_analyst<br/>(reading.analyst.{promise,dasha,annual,transit,nakshatra,prashna})<br/>Reads digest-backed pack sections -> returns structured findings.v2 JSON with evidence IDs"]
        L_READ["piece.llm.oracle_reader<br/>(reading.reader: R01..R14, P1..P3)<br/>Narrow curriculum readers over CHART CORE + horizon tables; natal readers reused across questions"]
        L_SYNTH["piece.llm.synthesizer<br/>(reading.oracle / reading.synth)<br/>Streams answer.markdown from findings_in + cited digest rows + confirmed person_facts"]
        L_VAL["piece.validator.rule_and_model<br/>(reading.validator)<br/>Under-5ms deterministic rule check + 2s budget model check -> triggers at most 1 addendum loop"]
    end

    DeterministicPieces --> OUT_CODE["Outputs: area_board.v1 | career_map.v1 | family_vote.v1 | vote_check.v1 | windows.v1 | life_reading.v2 | findings.v2"]
    LLMPieces --> OUT_LLM["Outputs: intent.v1 | findings.v2 | answer.markdown | validator.v1"]
```

---

## Page 4 of 10 — Class 4 Piece: The Date-Range Window Cache Gate (`piece.cache.date_range_window`)

Why re-run a technique or call an LLM when the astrological inputs it reads have not changed?
Even though the sky (`transit`), lagna (`prashna`), and planetary hours (`hora`) shift every ~2 hours, **each technique's contract declares the exact sections it reads**, which determines its natural validity window `[valid_from, valid_to)` (`src/techniques/pieces.ts validityWindow`).

```mermaid
flowchart TD
    REQ["Incoming Request for Technique T on Kundli K at Time as_of"] --> FW["1. Compute Freshness & Scope (src/techniques/pieces.ts)<br/>freshness = techniqueFreshness(T)<br/>scope = techniqueScope(T)"]
    FW --> WIN["2. Resolve Date-Range Window [valid_from, valid_to)<br/>- natal: [Epoch 0, null) (open until digest_version changes)<br/>- annual: [tp_year.from, tp_year.to) or 90d bucket<br/>- dasha: [running_period.from, running_period.to) or 30d bucket<br/>- daily: [local_day.from, local_day.to) or 24h bucket<br/>- transit: [floor(as_of / 2h) * 2h, +2h) (TECHNIQUE_TRANSIT_WINDOW_HOURS=2)"]
    WIN --> KEY["3. Compute Deterministic SHA-256 Cache Key<br/>techniqueCacheKey({ technique, kundliId, digestVersion, window, questionHash })<br/>Includes contractHash(T) so any prompt/algorithm edit auto-invalidates"]
    KEY --> QRY{"4. Lookup in kundli_technique_windows<br/>valid_from <= as_of < valid_to<br/>AND digest_version & contract_hash match?"}
    QRY -->|"HIT (< 5 ms)"| HIT["5a. Return Stored Digested Output<br/>Record AgentRun / ReadingAgentSpan with status: 'skipped'<br/>(0 prompt_tokens, 0 output_tokens, $0.00 cost)"]
    QRY -->|"MISS"| MISS["5b. Execute Technique Scorer or LLM Agent<br/>Store Output in kundli_technique_windows with [valid_from, valid_to)<br/>Record AgentRun with status: 'ok'"]
    HIT & MISS --> DOWN["6. Pass Output to Synthesizer (general.oracle) or Board Response"]
```

### Freshness Tiers & Validity Windows Across All 67 Catalogue Techniques

| Freshness Tier | Validity Range `[valid_from, valid_to)` | Env Config (`src/config/env.ts`) | Catalogue Count | Example Techniques |
|---|---|---|---|---|
| **`natal`** | `[1970-01-01T00:00:00Z, null)` — valid until `digest_version` or `contractHash` changes | `DIGEST_VERSION`, `TECHNIQUE_CACHE_VERSION` | **12** | `general.promise`, `general.varga_dynamics`, `general.nakshatra`, `general.strength_yoga`, `general.jaimini`, `general.person`, `self.promise`, `self.protection`, `self.varga`, `self.nakshatra`, `love.promise`, `love.protection`, `love.varga`, `love.nakshatra` |
| **`annual`** | `[year.from, year.to)` of running Tithi Pravesha / Varsha chart (fallback `90d` bucket) | `TECHNIQUE_ANNUAL_FALLBACK_DAYS=90` | **5** | `work.annual_family`, `self.annual`, `love.annual`, `general.annual`, `digest.annual_set` |
| **`dasha`** | `[runningPeriod.from, runningPeriod.to)` in `kundli_activation` (fallback `30d` bucket) | `TECHNIQUE_DASHA_FALLBACK_DAYS=30` | **11** | `work.conditional_family`, `work.karaka_family`, `work.d10_check`, `self.affliction`, `self.activation`, `love.affliction`, `love.activation`, `general.dasha`, `life.promise_scale`, `digest.activation` |
| **`daily`** | `[day.from, day.to)` at reference timezone place (fallback `24h` bucket) | `LUCKY_HORIZON_DAYS=28` | **17** | `lucky.day_tables`, `lucky.panchang_limbs`, `lucky.avoid_bands`, `lucky.personal_overlay`, all 13 `lucky.<area>.<act>` scenarios |
| **`transit`** | Epoch-aligned `2h` bucket `[floor(now / 2h) * 2h, +2h)` | `TECHNIQUE_TRANSIT_WINDOW_HOURS=2` | **16** | `work.present_tone`, `work.security_grade`, `work.subarea_windows`, `work.horizons`, `work.looking_back`, `self.transit`, `love.transit`, `love.meet`, `love.health`, `love.reconcile`, `general.transit`, `life.timing_agreement`, `life.mahadasha_charter`, `life.dashboard` |
| **`question`** | `[now, now)` — per-question live execution (`techniqueCacheKey = null`) | N/A | **6** | `general.intake`, `general.clarify`, `general.prashna`, `general.reader`, `general.oracle`, `general.validator` |

---

## Page 5 of 10 — Recipe Families: How 67 Techniques Collapse into Shared Tested Recipes

In `src/techniques/pieces.ts`, `families(TECHNIQUES)` groups techniques by their `familySignature` (`[sortedReaders, prompt, output, sortedAgents]`). Instead of 67 unrelated implementations, the catalogue collapses into compact **Recipe Families** where the machinery is identical and only the `selectors` or `filter` parameters differ.

```mermaid
flowchart LR
    subgraph Fam1["Family 1: Lucky Scenario Windows (13 Techniques)"]
        R_L1["Readers: reader:panchang/panchang_day (General + Personal)"]
        A_L1["Agent: lucky.scenario_windows (code, system: none)"]
        O_L1["Output: windows.v1 (daily_freshness)"]
        M_L1["Members (13): lucky.work.{sign_contract, send_resume, interview, ask_raise, start_project, hard_talk_boss},<br/>lucky.love.{ask_out, first_date, clear_air}, lucky.money.invest_buy,<br/>lucky.travel.set_out, lucky.study.exam_submit, lucky.home.start_routine"]
        R_L1 --> A_L1 --> O_L1 --> M_L1
    end

    subgraph Fam2["Family 2: Work Timeline & Sub-Area Map (3 Core + 2 Variant Techniques)"]
        R_W1["Readers: reader:house/house_card + reader:activation/activation_row + reader:transit/transit_row"]
        A_W1["Agents: area.career_inputs + area.career_map (code, system: none)"]
        O_W1["Output: career_map.v1 (transit_freshness)"]
        M_W1["Members: work.present_tone, work.horizons, work.looking_back<br/>(+ work.security_grade, work.subarea_windows)"]
        R_W1 --> A_W1 --> O_W1 --> M_W1
    end

    subgraph Fam3["Family 3: Self & Love 8-Layer House-State Engine (16 Techniques)"]
        R_SL["Readers: house_card, planet_card, point_row, yoga_row, activation_row, transit_row, annual_row, star_profile"]
        A_SL["Agents: area.self_board (8 self.*) & area.love_board (8 love.*)"]
        O_SL["Output: area_board.v1 (natal / dasha / annual / transit)"]
        M_SL["Members (16): {self,love}.{promise, affliction, protection, activation, transit, annual, varga, nakshatra}"]
        R_SL --> A_SL --> O_SL --> M_SL
    end

    subgraph Fam4["Family 4: Love Companion-Memory Sub-Areas (3 Techniques)"]
        R_LS["Reader: reader:findings/findings_in (8 Love layers)"]
        A_LS["Agent: area.love_board (code, system: none)"]
        O_LS["Output: board_subarea.v1"]
        M_LS["Members (3): love.meet (single/dating), love.health (dating/committed/married), love.reconcile (separated/complicated)"]
        R_LS --> A_LS --> O_LS --> M_LS
    end
```

---

## Page 6 of 10 — Error-Correction, Multi-System Voting & Anti-Hallucination Gates

Every board and reading technique passes through deterministic error-correction gates so that no single dasha, single planet, or unverified LLM claim can produce a false prediction.

```mermaid
flowchart TD
    subgraph Gate1["Gate 1: D1 + Owning Varga Agreement (piece.scorer.varga_agreement)"]
        D1_VOTE["Running Period Lord Polarity in D1"] & DN_VOTE["Running Period Lord Dignity/Place in Owning Varga (D10 / D9 / Dn)"]
        D1_VOTE & DN_VOTE --> CHECK_V{"Do D1 and Owning Varga Agree?"}
        CHECK_V -->|"Yes"| PASS_V["Vote Counts in Family Tally"]
        CHECK_V -->|"Tie"| D9_TIE["D9 Breaks Tie (D60 confirms only if birth time exact to 1 min)"]
        CHECK_V -->|"Disagree (Split)"| DROP_V["Vote Dropped (Neutral / Split)"]
    end

    subgraph Gate2["Gate 2: Multi-Family Clock Consensus (piece.voter.five_family_clock)"]
        PASS_V & D9_TIE --> FAMS["Clocks Vote Independently:<br/>1. Main (Vimshottari)<br/>2. Conditional (dasha.applicable)<br/>3. Rasi (Narayana / Chara)<br/>4. Karaka (Chara Karaka Dasha)<br/>5. Annual (Tithi Pravesha / Varsha)<br/>6. Short Clocks (Yogini + Tithi Ashtottari MUST agree)"]
        FAMS --> CONF["Confidence Rule:<br/>- Confirmed: >= max(3, 60% of available families) agree AND Main Clock agrees<br/>- Likely: >= 2 families agree and outnumber opposite side<br/>- Split: Both sides have 2+ families or Main Clock disagrees"]
    end

    subgraph Gate3["Gate 3: Evidence Citation & Post-Answer Validator (piece.validator.rule_and_model)"]
        ANALYST_OUT["Analyst / Code Reader Output (findings.v2)"] --> CITE_CHK["Every Claim Must Cite Digest Key:<br/>digest.<section>.<key>.<field>"]
        CITE_CHK --> ORACLE_SYNTH["general.oracle Streams Answer with Cited Digest Rows + Confirmed person_facts"]
        ORACLE_SYNTH --> VAL_RULE["general.validator:<br/>1. Deterministic Rules (< 5 ms)<br/>2. Model Check (2 s budget)<br/>-> Triggers at most 1 Addendum Loop (max 2 readers)"]
    end
```

---

## Page 7 of 10 — Companion Memory (`person_facts`) & Clarify Context Selection (`selectTechniques`)

Following the core product rule (*"Specific to this person, or not shown; ask before you answer, and let the chart lead the question"*), `selectTechniques(input)` in `src/techniques/contracts.ts` matches the confirmed `Intent` (`subjects`, `horizon`, `questionType`, `slots`) and the companion memory (`person_facts`) against every technique's `selectors`.

```mermaid
flowchart LR
    subgraph Inputs["Clarify Context & Companion Memory"]
        INT["Confirmed Intent (general.intake + general.clarify):<br/>- subjects[] (17 SubjectIds)<br/>- horizon (now, 3m, 6m, 1y, 3y, life, custom)<br/>- questionType (timing, yes_no, explain, why_meaning...)<br/>- slots[] (prashna, other_person, specific_event)"]
        MEM["Companion Memory (person_facts table):<br/>- work.status (employed, between_jobs, studying, own_business)<br/>- love.status (single, dating, committed, married, separated, complicated)<br/>- self.focus / family.children"]
        SURF["Active Surface / Board:<br/>chat | you | love | work | lucky | timeline"]
    end

    subgraph Matcher["Contract Selector Matcher (src/techniques/contracts.ts)"]
        SEL["selectTechniques({ intent, facts, board, slots })"]
    end

    subgraph Selected["Matched Technique Contracts & Sub-Area Filters"]
        T_CHAT["board = 'chat' -> Selects matching general.* analysts + code readers<br/>(e.g. general.annual only if horizon <= 24m; general.prashna only if slot 'prashna';<br/>general.person if subject in children/siblings/marriage or slot 'other_person')"]
        T_LOVE["board = 'love' -> Runs 8 love.* layers + selects lead sub-area from love.status:<br/>- single / dating -> love.meet<br/>- dating / committed / married -> love.health<br/>- separated / complicated -> love.reconcile"]
        T_WORK["board = 'work' -> Runs 9 work.* techniques + filters sub-areas by work.status:<br/>- get_job only for between_jobs / studying<br/>- promotion & job_security hidden for between_jobs / studying / own_business"]
    end

    INT & MEM & SURF --> SEL --> T_CHAT & T_LOVE & T_WORK
```

---

## Page 8 of 10 — `digest.build`: Kundli Digest (First-Time Breakdown)

| Field | Value |
|---|---|
| **Technique ID** | `digest.build` |
| **Title** | Kundli digest (the first-time breakdown) |
| **Category / Board / Status** | `general` · `chat` (selects on all boards: `chat, you, love, work, lucky, timeline`) · `built` |
| **Agents** | `digest.build` (`kind: 'code'`, `system: 'none'`) |
| **Output Contract** | `kundli_digest.v1` (writes 1,500–2,500 rows to `kundli_digest` + stamps `kundlis.digest_status = 'ready'`) |
| **Freshness / Scope** | `annual` (reads `annual.*` alongside `natal` tables; rebuilt only when `digest_version` or input `kundli_data` changes) · `kundli` |
| **Code Path** | [`src/reading/digest/build.ts`](../../src/reading/digest/build.ts) (`buildDigestRows`, `buildDigest`, `loadDigest`) |

```mermaid
flowchart LR
    subgraph EngineRows["Stored Calculation Engine Rows (kundli_data + kundli_facts)"]
        E_NAT["natal: dignities.dN, aspects.dN, avasthas.dN, house_counts,<br/>strength.shadbala, benefic_malefic, yogas, doshas, sphutas, panchanga, facts"]
        E_JAI["jaimini: argala.dN, arudhas.dN, charakaraka"]
        E_ASH["ashtakavarga: sav (D1)"]
        E_ANN["annual: tithi_pravesha, varsha, tithi_pravesha_dasha, mudda, patyayini, sahams"]
        E_NAK["nakshatra: janma (facts.nakshatra_profile)"]
    end

    subgraph DigestBuilder["Deterministic Digest Builder (agent: digest.build — Zero Astrology Derived in Node)"]
        STEP1["1. Select, count, join & date across ~400 stored rows<br/>Attach exact provenance source: [{ type, variant, calc_version, path }]"]
        STEP2["2. Build 6 Digest Sections in batches of 500 inside one DB transaction"]
    end

    subgraph DigestSections["Output: 6 Reusable Sections in kundli_digest"]
        S_H["piece.digest.house_cards<br/>(section: house, key: D<n>.h<1..12>, layout: house_card)"]
        S_P["piece.digest.planet_cards<br/>(section: planet, key: D<n>.<planet>, layout: planet_card)"]
        S_Y["piece.digest.yoga_register<br/>(section: yoga, key: D1.<id>, layout: yoga_row)"]
        S_PT["piece.digest.point_cards<br/>(section: point, key: <varga>.<id>, layout: point_row)"]
        S_A["piece.digest.annual_set<br/>(section: annual, key: TP<yr>.D<n> / VP<yr>.D<n>, layout: annual_row)"]
        S_S["piece.digest.star_profile<br/>(section: star, key: profile, layout: star_profile)"]
    end

    E_NAT & E_JAI & E_ASH & E_ANN & E_NAK --> STEP1 --> STEP2 --> S_H & S_P & S_Y & S_PT & S_A & S_S
```

---

## Page 9 of 10 — `digest.annual_set`: Annual Set, Ten Years Back and Ahead

| Field | Value |
|---|---|
| **Technique ID** | `digest.annual_set` |
| **Title** | Annual set, ten years back and ahead |
| **Category / Board / Status** | `general` · `chat` (all boards) · `built` |
| **Agents** | `digest.annual_set` (`kind: 'engine_pull'`, `engineType: 'annual'`) |
| **Synthesizer / Consumer** | Feeds `digest.build` → `kundli_digest.v1` (`section: 'annual'`) |
| **Freshness / Scope** | `annual` · `kundli` |
| **Code Path** | [`src/reading/digest/annualSet.ts`](../../src/reading/digest/annualSet.ts) (`ensureAnnualSet`; `event.ts runTopUp`) |

```mermaid
flowchart LR
    subgraph Horizon["21-Year Horizon (Current Year - 10 to + 10, Nearest First)"]
        KEYS["210 Keys per Kundli:<br/>- annual.tithi_pravesha (D1, D9, D10)<br/>- annual.varsha (D1, D9, D10)<br/>- annual.tithi_pravesha_dasha<br/>- annual.mudda<br/>- annual.patyayini<br/>- annual.sahams"]
    end

    subgraph Puller["Bounded Engine Puller (agent: digest.annual_set)"]
        CHK["1. Check which year rows are already ready in kundli_data (no engine call)"]
        PULL["2. Pull at most DIGEST_ANNUAL_MAX_CALLS (default 40) missing keys per run<br/>via ensureChartData from Calculation Engine"]
        STALE["3. If top-up stores new year rows on a ready kundli,<br/>mark digest_status = 'stale' so next sweep rebuilds annual section"]
    end

    subgraph OutputPiece["Output Piece in kundli_digest"]
        OUT_ANN["piece.digest.annual_set<br/>(reader:annual/annual_row)<br/>Feeds work.annual_family, self.annual, love.annual, general.annual, life.*"]
    end

    KEYS --> CHK --> PULL --> STALE --> OUT_ANN
```

---

## Page 10 of 10 — `digest.activation`: Activation Calendar, Thirty Years Ahead

| Field | Value |
|---|---|
| **Technique ID** | `digest.activation` |
| **Title** | Activation calendar, thirty years ahead |
| **Category / Board / Status** | `general` · `chat` (all boards) · `built` |
| **Agents** | `digest.activation` (`kind: 'code'`, `system: 'none'`) |
| **Synthesizer / Consumer** | Feeds `digest.build` → `kundli_activation.v1` (`kundli_activation` table) |
| **Freshness / Scope** | `dasha` (stores birth to +30 years; indexed by `(kundli_id, from_date, to_date)` and GIN `houses[]`) · `kundli` |
| **Code Path** | [`src/reading/digest/activation.ts`](../../src/reading/digest/activation.ts) (`buildActivationRows`, `activationFor`) |

```mermaid
flowchart LR
    subgraph Inputs["Stored Dasha Trees & D1 Cards"]
        D_TREES["kundli_data: All 43 Served Dasha Systems<br/>(Level 3 for 6 .l3 systems; Level 2 for others)<br/>+ dasha.applicable"]
        D_CARDS["piece.digest.planet_cards (D1: house, owns, aspects_to)<br/>+ piece.digest.house_cards (D1: sign -> house, lord_house)"]
    end

    subgraph Builder["Activation Calendar Builder (agent: digest.activation)"]
        MAP_FAM["1. Classify system into 7 families (doc 46 §B.4):<br/>vimshottari | conditional | yogini | tithi_ashtottari | rasi | karaka | other"]
        MAP_H["2. Tag each period (Birth to Today + 30 Years) with D1 houses activated:<br/>- Graha period: lord's house + houses owned + houses aspected (graha drishti)<br/>- Rasi period: sign's D1 house + sign lord's D1 house"]
    end

    subgraph Store["Indexed Activation Table (kundli_activation)"]
        TBL["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>B-Tree index on (kundli_id, from_date, to_date)<br/>GIN index on houses[]<br/>Also provides runningPeriod [from_date, to_date) to piece.cache.date_range_window!"]
    end

    D_TREES & D_CARDS --> MAP_FAM --> MAP_H --> TBL
```
