# Volume 05 — Work Board (`work.*` / `work` Board) One-Per-Page Illustrations

> **Format**: One illustration per page (`Page 1 of 9` through `Page 9 of 9`), separated by `---`.  
> **Category / Board**: `work` · `work`  
> **Houses & Vargas**: Houses `10, 6, 1, 2, 11` (plus `9, 5, 8, 12` for security end lords; `4, 7` for residence/business sub-areas) · Vargas `D1, D10` (with `D9, D60` tie-breakers)  
> **Code References**: [`src/techniques/catalog.ts`](../../src/techniques/catalog.ts) · [`src/reading/area/career.ts`](../../src/reading/area/career.ts) · [`src/reading/area/careerService.ts`](../../src/reading/area/careerService.ts)

---

## Page 1 of 9 — `work.present_tone`: Present Tone

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.present_tone` — Present tone |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `dasha:{vimshottari,yogini,tithi_ashtottari,narayana}`, `transit:{transit_contacts,double_transit}`, `jaimini:modifier`, `natal:{house_counts,facts}` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`: `D1,D10 houses 10,6,1,2,11`) · `reader:activation/activation_row` (`piece.activation.calendar_slice`: `families S1, S4, S2+S3, S6/S6D, S7 ±24 months`) · `reader:transit/transit_row` (`piece.transit.sky_overlay`: `contacts and double transit on houses 10,6,1 and their lords ±24 months`) |
| **Upstream Feeders** | Receives `family_vote.v1` from `work.annual_family`, `work.conditional_family`, `work.karaka_family`, and `vote_check.v1` from `work.d10_check` |
| **Agent & Voter Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`piece.voter.five_family_clock`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Accuracy** | `output:career_map.v1` · `accuracy: 'area_checks:career'` |
| **Date-Range Window Cache** | `freshness: 'transit'` (epoch-aligned `2h` window `TECHNIQUE_TRANSIT_WINDOW_HOURS=2`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts presentState` (`docs/reading-engine/43 §8.1`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest Slicer + Activation & Transit Slices + Family Feeders"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card: D1,D10 houses 10,6,1,2,11)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row: ±24m)"]
        P_TR["piece.transit.sky_overlay<br/>(reader:transit/transit_row: contacts & double transit ±24m)"]
        FEED["Upstream Family Votes:<br/>work.annual_family, work.conditional_family,<br/>work.karaka_family, work.d10_check, work.security_grade"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate (2h Window)"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph Voter["5+ Family Clock Voter (piece.voter.five_family_clock — presentState)"]
        V1["1. Slice 3-month window (last month, this month, next month) from ±24m career grid"]
        V2["2. Per system: support when support - test >= 0.5; test when test - support >= 0.5;<br/>Short clocks vote ONLY when Yogini + Tithi Ashtottari agree;<br/>Dasha votes gated by work.d10_check"]
        V3["3. Pick Tone in strict priority order: easing -> demanding -> closing -> open -> steady<br/>4. Confidence: confirmed (>= max(3, 60% families) + Main clock agrees), likely, or split<br/>5. Compute ease_date, window_end, next_window_start"]
        V1 --> V2 --> V3
    end

    subgraph Output["Career Map Present State"]
        OUT["output:career_map.v1<br/>Present tone, confidence & transition dates"]
    end

    P_HC & P_ACT & P_TR & FEED --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| V1
    V3 --> OUT
```

---

## Page 2 of 9 — `work.security_grade`: Job Security by Month

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.security_grade` — Job security by month |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `dasha:{vimshottari,yogini,tithi_ashtottari,narayana}`, `transit:{transit_contacts,double_transit}`, `jaimini:modifier`, `natal:{house_counts,facts}` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`: `D1 houses 10,9,5,6,8,12 and their lords`) · `reader:activation/activation_row` (`piece.activation.calendar_slice`: `families S1, S4, S2+S3, S6/S6D, S7 ±24 months`) · `reader:transit/transit_row` (`piece.transit.sky_overlay`: `contacts and double transit on houses 10,6,1 and their lords ±24 months`) |
| **Agent & Voter Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`piece.voter.security_gate`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Accuracy** | `output:career_map.v1` · `accuracy: 'staff'` |
| **Date-Range Window Cache** | `freshness: 'transit'` (epoch-aligned `2h` window) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts securityGrade` (`docs/reading-engine/43 §6–§7`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest House Cards (End Lords) + Activation & Transit Grid"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>D1 Houses 10, 9 (12th from 10th), 5 (8th from 10th), 6, 8, 12"]
        P_GRID["piece.activation.calendar_slice + piece.transit.sky_overlay<br/>(Career Grid: This Month + 12 Months Ahead)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph SecurityGate["Deterministic Security Gate (piece.voter.security_gate — securityGrade)"]
        G1["1. Identify End Lords from D1 house cards:<br/>lords of houses 9 and 5 (12th & 8th from 10th) + lords of 6, 8, 12 from Lagna"]
        G2["2. Non-testing month:<br/>- Band >= moderate -> clear_protected<br/>- Below moderate -> clear"]
        G3["3. Testing month -> Check Driver Gate:<br/>Is the strongest active driver planet an End Lord, Rahu, Ketu, or Saturn?<br/>- No gate planet -> watch (a test without a gate is never risk!)<br/>- Gate + high band -> high_risk<br/>- Gate + moderate band -> risk"]
        G1 --> G2 --> G3
    end

    subgraph Output["13-Month Security Grades"]
        OUT["output:career_map.v1<br/>Monthly grade: clear_protected | clear | watch | risk | high_risk"]
    end

    P_HC & P_GRID --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| G1
    G3 --> OUT
```

---

## Page 3 of 9 — `work.subarea_windows`: Windows Ahead by Sub-Area

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.subarea_windows` — Windows ahead by sub-area |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `dasha:{vimshottari,yogini,tithi_ashtottari,narayana}`, `transit:{transit_contacts,double_transit}`, `jaimini:modifier`, `natal:{house_counts,facts}` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:house/house_card` (`D1,D10 houses 10,6,1,2,11`) · `reader:house/house_card` (`D1 houses 2,11 (money), 4 (residence), 7 (business) and their lords`) · `reader:activation/activation_row` (`±24 months`) · `reader:transit/transit_row` (`±24 months`) |
| **Agent Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`careerMap (ahead)`, `careerSubareas`, `fitsStatus`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Accuracy** | `output:career_map.v1` · `accuracy: 'staff'` |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts careerMap (ahead), careerSubareas; careerService.ts fitsStatus` (`docs/reading-engine/43 §2, §8.3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest House Cards (Career, Money, Residence, Business) + Grid"]
        P_HC1["piece.digest.house_cards<br/>(D1,D10 houses 10,6,1,2,11 + D1 houses 2,11,4,7)"]
        P_GRID["piece.activation.calendar_slice + piece.transit.sky_overlay<br/>(Career, Business, Money & Residence Grids Ahead)"]
        MEM["person_facts: work.status<br/>(employed | between_jobs | studying | own_business)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph Classifier["Sub-Area Window Classifier & Status Filter (careerSubareas + fitsStatus)"]
        C1["1. Testing career window -> job_security (graded at peak month via work.security_grade)"]
        C2["2. Support career window:<br/>- Driver is 10th lord, Sun, 11th lord or GL lord -> promotion<br/>- Narayana active or driver is Rahu / lord of 12, 3, 9 -> job_change<br/>- Always -> get_job"]
        C3["3. Other markers: business (7th marker support); pay (money support overlapping career support);<br/>abroad (residence support with Rahu or 12th/9th lord)"]
        C4["4. Filter by work.status (fitsStatus):<br/>- get_job: only between_jobs / studying<br/>- promotion & job_security: hidden for between_jobs / studying / own_business"]
        C1 --> C2 --> C3 --> C4
    end

    subgraph Output["Sorted Sub-Area Windows"]
        OUT["output:career_map.v1<br/>Dated sub-area windows sorted by start date"]
    end

    P_HC1 & P_GRID & MEM --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| C1
    C4 --> OUT
```

---

## Page 4 of 9 — `work.horizons`: Horizons (`1, 3, 6, 12` Months)

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.horizons` — Horizons (1, 3, 6, 12 months) |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `dasha:{vimshottari,yogini,tithi_ashtottari,narayana}`, `transit:{transit_contacts,double_transit}`, `jaimini:modifier`, `natal:{house_counts,facts}` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:house/house_card` (`D1,D10 houses 10,6,1,2,11`) · `reader:activation/activation_row` (`this month to +12 months`) · `reader:transit/transit_row` (`±24 months`) |
| **Agent Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`careerMap (horizons)`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Accuracy** | `output:career_map.v1` · `accuracy: 'staff'` |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts careerMap (horizons)` (`docs/reading-engine/45 §10`) |

```mermaid
flowchart LR
    subgraph Inputs["Windows Ahead (work.subarea_windows) over +1, +3, +6, +12 Months"]
        P_IN["piece.digest.house_cards + piece.activation.calendar_slice (0..+12m)<br/>+ piece.transit.sky_overlay"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph RungBuilder["4-Rung Horizon Ladder Builder (careerMap horizons)"]
        H1["1. Partition windows starting inside 1m, 3m, 6m, and 12m from start of this month"]
        H2["2. Rank each window by: band_order x 100 + score"]
        H3["3. Apply band floor per rung:<br/>- 1m & 3m rungs: show windows at 'possible' band or above<br/>- 6m & 12m rungs: show only windows at 'moderate' band or above"]
        H4["4. Keep best support window & hardest test window per rung; mark rung 'quiet' if neither clears bar"]
        H1 --> H2 --> H3 --> H4
    end

    subgraph Output["1 / 3 / 6 / 12-Month Horizon Rungs"]
        OUT["output:career_map.v1<br/>4 horizon rungs (best support, hardest test, or quiet)"]
    end

    P_IN --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| H1
    H4 --> OUT
```

---

## Page 5 of 9 — `work.looking_back`: Looking Back (12-Month Calibration Edges)

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.looking_back` — Looking back |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `dasha:{vimshottari,yogini,tithi_ashtottari,narayana}`, `transit:{transit_contacts,double_transit}`, `jaimini:modifier`, `natal:{house_counts,facts}` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:house/house_card` (`D1,D10 houses 10,6,1,2,11`) · `reader:activation/activation_row` (`-12 months to this month`) · `reader:transit/transit_row` (`±24 months`) |
| **Agent Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`careerMap (back)`, `recordCheck`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Accuracy** | `output:career_map.v1` · `accuracy: 'area_checks:career'` (stores user `yes | partly | no | skip` in `area_checks`) |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts careerMap (back); src/reading/area/careerService.ts recordCheck` (`docs/reading-engine/45 §9`) |

```mermaid
flowchart LR
    subgraph Inputs["Past 12 Months of Career Grid (-12m to This Month)"]
        P_IN["piece.digest.house_cards + piece.activation.calendar_slice (-12m..0m)<br/>+ piece.transit.sky_overlay"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph EdgeDetector["Retrospective Edge Detector (careerMap back)"]
        B1["1. Walk the 12 months before this month"]
        B2["2. Detect 'Edge' months: band >= moderate AND<br/>(side differs from prior month OR prior month was below moderate)"]
        B3["3. Keep last 2 test edges + last 2 support edges;<br/>rank by band then recency; keep top 3 in chronological order"]
        B4["4. User taps yes / partly / no / skip -> stored in area_checks (area = 'career') for empirical accuracy"]
        B1 --> B2 --> B3 --> B4
    end

    subgraph Output["3 Retrospective Calibration Moments"]
        OUT["output:career_map.v1<br/>Up to 3 dated past edges + area_checks calibration loop"]
    end

    P_IN --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| B1
    B4 --> OUT
```

---

## Page 6 of 9 — `work.annual_family`: This Year's Chart (Annual Family Vote)

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.annual_family` — This year's chart (annual family) |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `annual:{tithi_pravesha,tithi_pravesha_dasha,mudda,patyayini,sahams}`, `divisional:D10` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:annual/annual_row` (`piece.digest.annual_set`: `TP current year, D1 and D10, houses 10,6,1,2,11; rajya and karma sahams; year dasha running this month`) |
| **Agent Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`workAnnualVote`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:family_vote.v1` · feeds `work.present_tone` |
| **Date-Range Window Cache** | `freshness: 'annual'` (`[year.from, year.to)` of running Tithi Pravesha / Varsha chart, fallback `90d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts workAnnualVote, presentState; careerService.ts getCareer` (`docs/reading-engine/43 §8.1 (family 5); 46 §B.6; 53 §4.5`) |

```mermaid
flowchart LR
    subgraph Inputs["Annual Digest Slicer (Freshness: annual, Scope: kundli)"]
        P_ANN["piece.digest.annual_set<br/>(reader:annual/annual_row)<br/>TP / Varsha Current Year (D1 & D10 Houses 10,6,1,2,11),<br/>Rajya & Karma Sahams, Running Year Dasha"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: annual [year.from, year.to)<br/>scope: kundli"}
    end

    subgraph Voter["Annual Family Voter (workAnnualVote)"]
        A1["1. Read Tithi Pravesha or Varsha chart covering the current month from digest annual section"]
        A2["2. Grade year chart's houses 10, 6, 1:<br/>lord in own house or kendra/trikona without debility -> supports;<br/>lord in dusthana or debilitated -> tests"]
        A3["3. Grade Rajya & Karma sahams (kendra -> supports; dusthana -> tests)<br/>and active year dasha lord covering the month"]
        A4["4. Cast 1 family vote (support | test | neutral) as Family 5 of work.present_tone"]
        A1 --> A2 --> A3 --> A4
    end

    subgraph Output["Annual Family Vote"]
        OUT["output:family_vote.v1<br/>Feeds synthesizer: work.present_tone"]
    end

    P_ANN --> GATE
    GATE -->|"HIT (valid for active TP/VP period)"| OUT
    GATE -->|"MISS"| A1
    A4 --> OUT
```

---

## Page 7 of 9 — `work.conditional_family`: Conditional Clock

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.conditional_family` — Conditional clock |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `dasha:{applicable,conditional}` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:activation/activation_row` (`piece.activation.calendar_slice`: `conditional systems named by dasha.applicable, levels 1–3, periods covering this month ±1, houses 10,6,1`) |
| **Agent Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`workConditionalVote`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:family_vote.v1` · feeds `work.present_tone` |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`, fallback `30d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts workConditionalVote, presentState; careerService.ts getCareer` (`docs/reading-engine/43 §8.1 (family 2); 46 §B.4; 53 §4.5`) |

```mermaid
flowchart LR
    subgraph Inputs["Activation Calendar Slice (Freshness: dasha, Scope: kundli)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>Conditional Dasha Systems (dasha.applicable),<br/>Levels 1-2 covering this month ±1, Houses 10, 6, 1"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph Voter["Conditional Clock Voter (workConditionalVote)"]
        C1["1. Read conditional dasha rows covering this month from kundli_activation (family = 'conditional')"]
        C2["2. Grade each running lord by career polarity AND D1/D10 agreement (workD10Check);<br/>Level 1 weight = 1.0, Level 2 weight = 0.5"]
        C3["3. Sum weighted votes:<br/>- >= +0.5 -> support<br/>- <= -0.5 -> test<br/>- else -> neutral (no vote when no conditional system applies to this kundli)"]
        C1 --> C2 --> C3
    end

    subgraph Output["Conditional Family Vote"]
        OUT["output:family_vote.v1<br/>Feeds synthesizer: work.present_tone"]
    end

    P_ACT --> GATE
    GATE -->|"HIT (valid until running period ends)"| OUT
    GATE -->|"MISS"| C1
    C3 --> OUT
```

---

## Page 8 of 9 — `work.karaka_family`: Karaka Clock

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.karaka_family` — Karaka clock |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `dasha:karaka`, `jaimini:chara_karakas`, `divisional:D10` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:activation/activation_row` (`piece.activation.calendar_slice`: `karaka dasha level 3, periods covering this month ±1`) · `reader:point/point_row` (`piece.digest.point_cards`: `AmK and the 10th lord in D1 and D10`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: `D10 card of the running karaka lord`) |
| **Agent Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`workKarakaVote`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:family_vote.v1` · feeds `work.present_tone` |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`, fallback `30d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts workKarakaVote, presentState; careerService.ts getCareer` (`docs/reading-engine/43 §8.1 (family 4); 46 §B.4; 53 §4.5`) |

```mermaid
flowchart LR
    subgraph Inputs["Activation Slice + Point & Planet Slicers (Freshness: dasha, Scope: kundli)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row: family = 'karaka', this month ±1)"]
        P_PT["piece.digest.point_cards<br/>(reader:point/point_row: AmK & 10th Lord in D1 and D10)"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card: D10 Card of Running Karaka Lord)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph Voter["Karaka Clock Voter (workKarakaVote)"]
        K1["1. Read karaka dasha rows covering this month from kundli_activation (family = 'karaka')"]
        K2["2. Amtyakaraka (AmK) or D1 10th lord running -> support (unless debilitated in D10);<br/>planet debilitated in D10 or lording a dusthana without owning 10, 1 or 6 -> test"]
        K3["3. Apply workD10Check (piece.scorer.varga_agreement) so a split D1/D10 vote is dropped"]
        K1 --> K2 --> K3
    end

    subgraph Output["Karaka Family Vote"]
        OUT["output:family_vote.v1<br/>Feeds synthesizer: work.present_tone"]
    end

    P_ACT & P_PT & P_PC --> GATE
    GATE -->|"HIT (valid until karaka period ends)"| OUT
    GATE -->|"MISS"| K1
    K3 --> OUT
```

---

## Page 9 of 9 — `work.d10_check`: D1 and D10 Agreement on Each Dasha Vote

| Field | Value |
|---|---|
| **Technique ID / Title** | `work.d10_check` — D1 and D10 agreement on each dasha vote |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `divisional:{D1,D10,D9,D60}` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work']`, `houses: [10, 6, 1, 2, 11]`, `vargas: ['D1', 'D10']` |
| **Reader Pieces** | `reader:activation/activation_row` (`piece.activation.calendar_slice`: `running lords of the main, conditional and karaka clocks this month`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: `D1, D10, D9, D60 cards of those lords`) · `reader:house/house_card` (`piece.digest.house_cards`: `D10 houses 10,6,1,2,11`) |
| **Agent & Scorer Pieces** | `agent:area.career_inputs`, `agent:area.career_map` (`piece.scorer.varga_agreement`: `workD10Check`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:vote_check.v1` · feeds `work.present_tone` |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`, fallback `30d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/career.ts workD10Check, presentState; careerService.ts getCareer` (`docs/reading-engine/43 §8.1; 46 §B.7; 53 §4.5`) |

```mermaid
flowchart LR
    subgraph Inputs["Activation Slice + Divisional Planet & House Cards (Freshness: dasha)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>Running Lords of Main, Conditional & Karaka Clocks"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>D1, D10, D9, D60 Cards of Running Lords"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>D10 Houses 10, 6, 1, 2, 11"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph VargaGate["D1 + D10 Agreement Checker (piece.scorer.varga_agreement — workD10Check)"]
        D1["1. Read place & dignity of each running clock lord in D1, D10, D9, and D60"]
        D2["2. Agreement Rule:<br/>- D1 and D10 agree on side (support or test) -> Vote COUNTS<br/>- Tie on D10 -> D9 breaks the tie<br/>- D60 confirms ONLY when birth time is recorded to the exact minute (never decides alone)<br/>- D1 and D10 disagree -> Family vote is SPLIT and NOT counted"]
        D1 --> D2
    end

    subgraph Output["Varga Agreement Verdict"]
        OUT["output:vote_check.v1<br/>Feeds synthesizer: work.present_tone"]
    end

    P_ACT & P_PC & P_HC --> GATE
    GATE -->|"HIT (valid until period lord changes)"| OUT
    GATE -->|"MISS"| D1
    D2 --> OUT
```

---

## Page 10 of 10 — `research.work_dashboard_qa`: Research Work & Career Dashboard Deep-Dive & Nov/Thanksgiving/Dec/New Year Zoom-In

| Field | Value |
|---|---|
| **Technique ID / Title** | `research.work_dashboard_qa` — Research Work & Career Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year zoom-in |
| **Category / Board / Status** | `work` · `work` · `built` |
| **Charts Declared** | `natal:{facts,dignities,aspects,avasthas,yogas,doshas,strength.shadbala}`, `ashtakavarga:sav`, `jaimini:{charakaraka,arudhas}`, `nakshatra:{janma,cusp_nak}`, `divisional:{D1,D9,D10,D2,D24,D4,D7,D12,D20,D60}`, `dasha:{vimshottari,yogini,tithi_ashtottari,narayana,karaka}`, `annual:{tithi_pravesha,varsha}`, `transit:{transit_contacts,sade_sati}`, `panchang:muhurta` |
| **Selectors** | `boards: ['work']`, `subjects: ['career_work', 'wealth_income', 'business_partnership']`, `houses: [10, 6, 11, 2, 1, 9, 3]`, `vargas: ['D1', 'D10', 'D9', 'D2', 'D24']` |
| **Reader Pieces** | `reader:house/house_card` (`D1..D60_h1..12`) · `reader:planet/planet_card` · `reader:yoga/yoga_row` · `reader:point/point_row` · `reader:star/star_profile` · `reader:activation/activation_row` · `reader:annual/annual_row` · `reader:transit/transit_row` |
| **Agent Piece** | `agent:research.work_dashboard_builder` (`buildWorkResearchDashboard`, `verifyWorkDashboardQaReport`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:research_work_dashboard.v1` · feeds `research.technical_verifier` |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/research/workDashboardQa.ts buildWorkResearchDashboard, verifyWorkDashboardQaReport` (`docs/admin/09 §4.1; docs/reading-engine/43 §8; 46 §B; 54 §3; 55 §2`) |

```mermaid
flowchart LR
    subgraph StagingInputs["Isolated Research Staging & Digest Slicers (Freshness: transit = 2h)"]
        R_DIG["research_digests + research_activations<br/>(D1, D10, D9, D2, D24, AmK, A10, Karma/Samartha/Artha Sahams)"]
    end

    subgraph Builder["Research Work Dashboard Builder (agent:research.work_dashboard_builder)"]
        W1["1. Run production Work board (buildBoard WORK_RESEARCH_CONFIG, resolveAreaShades, buildCalmPlaybook)<br/>over 10H, 6H, 11H, 2H, 1H, 9H, 3H and D1/D10/D9/D2/D24"]
        W2["2. Synthesize Vocation & Execution Charter + Nov/Thanksgiving/Dec/New Year career windows"]
        W3["3. Record 10-step reverse-engineered technical trace and run 8-gate technical verifier"]
        W1 --> W2 --> W3
    end

    subgraph Output["Staged Work Dashboard Run"]
        OUT["output:research_work_dashboard.v1<br/>Feeds synthesizer: research.technical_verifier"]
    end

    R_DIG --> W1
    W3 --> OUT
```
