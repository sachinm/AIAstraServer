# Volume 06 — Lucky Times (`lucky.*`) & Life Reading (`life.*`) One-Per-Page Illustrations

> **Format**: One illustration per page (`Page 1 of 21` through `Page 21 of 21`), separated by `---`.  
> **Boards**: `lucky` (Pages 1–17: 4 shared Panchang/Overlay techniques + 13 Act Scenarios) · `timeline` (Pages 18–21: 4 Life Reading & Long-Term Mahadasha Charter techniques)  
> **Code References**: [`src/techniques/catalog.ts`](../../src/techniques/catalog.ts) · [`src/reading/luckyTimes/scenarios.ts`](../../src/reading/luckyTimes/scenarios.ts) · [`src/reading/luckyTimes/windows.ts`](../../src/reading/luckyTimes/windows.ts) · [`src/reading/luckyTimes/service.ts`](../../src/reading/luckyTimes/service.ts) · [`src/reading/life/promise.ts`](../../src/reading/life/promise.ts) · [`src/reading/life/timing.ts`](../../src/reading/life/timing.ts) · [`src/reading/life/charter.ts`](../../src/reading/life/charter.ts) · [`src/reading/life/compose.ts`](../../src/reading/life/compose.ts)

---

## Page 1 of 21 — `lucky.day_tables`: Shared Day Tables per Place (5 Reference Timezones)

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.day_tables` — Shared day tables per place |
| **Category / Board / Status** | `self` · `lucky` · `built` |
| **Charts Declared** | `panchang:muhurta` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs`: `"the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)"`) |
| **Agent Piece** | `agent:lucky.day_tables` (`kind: 'engine_pull'`, `engineType: 'muhurta'`, `system: 'none'`) |
| **Output Piece** | `output:day_tables.v1` (writes to shared `day_tables` per `(place_key, date, ayanamsa)`) |
| **Date-Range Window Cache** | `freshness: 'daily'` (each `day_tables` row is immutable for its `(place_key, date)` across all users in that reference timezone!) · `scope: 'kundli'` |
| **Env Config (`src/config/env.ts`)** | `LUCKY_HORIZON_DAYS=28`, `LUCKY_PREPULL_DAYS=28`, `LUCKY_REFERENCE_PLACES` (`us-east` / New York, `us-central` / Chicago, `us-mountain` / Denver, `us-west` / San Jose, `in-ist` / Pune) |
| **Code & Source** | `src/reading/luckyTimes/service.ts pullDayTables, prepullUniversalDayTables; places.ts` (`docs/reading-engine/47 §3; 49 §4.1; 53 §4.6`) |

```mermaid
flowchart LR
    subgraph EnvConfig["Environment-Driven Reference Places (src/config/env.ts)"]
        PLACES["LUCKY_REFERENCE_PLACES (5 Timezones):<br/>1. us-east (America/New_York)<br/>2. us-central (America/Chicago)<br/>3. us-mountain (America/Denver)<br/>4. us-west (America/Los_Angeles)<br/>5. in-ist (Asia/Kolkata)<br/>Horizon: LUCKY_HORIZON_DAYS = 28 days ahead"]
    end

    subgraph Prepull["Universal Deterministic Prepull (agent:lucky.day_tables — Zero AI)"]
        D1["1. Find missing dates in 2-4 week horizon (or today -7 .. today +14) per reference place"]
        D2["2. Call Calculation Engine 'muhurta' deterministically for missing months"]
        D3["3. Store 1 row per (place_key, date, ayanamsa) in day_tables with calc_version & source_hash"]
        D1 --> D2 --> D3
    end

    subgraph SharedStore["Shared Panchang Store (One Sky for Every User in Timezone)"]
        OUT["output:day_tables.v1 -> piece.panchang.day_limbs<br/>(reader:panchang/panchang_day)"]
    end

    PLACES --> D1
    D3 --> OUT
```

---

## Page 2 of 21 — `lucky.panchang_limbs`: The Five Limbs of the Day (`vara, tithi, nakshatra, yoga, karana`)

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.panchang_limbs` — The five limbs of the day (vara, tithi, nakshatra, yoga, karana) |
| **Category / Board / Status** | `self` · `lucky` · `built` |
| **Charts Declared** | `panchang:{weekday,tithi,nakshatra,yoga,karana}` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs`: `"the place's day rows today −7 … today +14: vara, tithi, nakshatra, yoga, karana with end times"`) |
| **Agent Piece** | `agent:lucky.scenario_windows` (`kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:limbs.v1` · feeds `lucky.avoid_bands` (and every `lucky.<area>.<act>` scenario) |
| **Date-Range Window Cache** | `freshness: 'daily'` (`[day.from, day.to)` at the local place) · `scope: 'kundli'` |
| **Env Config (`src/config/env.ts`)** | `LUCKY_YOGA_AVOID`, `LUCKY_YOGA_FAVOUR` (includes Siddha #21), `LUCKY_KARANA_AVOID` (`Vishti`), `LUCKY_FIXED_KARANA_AVOID` (`Shakuni, Chatushpada, Naga`), `LUCKY_KARANA_FAVOUR`, `LUCKY_FIXED_KARANA_FAVOUR` (`Kimstughna`), `LUCKY_AMRITA_SIDDHI_ENABLED` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts; windows.ts dayLimbs, scenarioDay; service.ts getRange` (`docs/reading-engine/53 §4.6, 54 §6`) |

```mermaid
flowchart LR
    subgraph Inputs["Shared Day Row + Env-Driven Rule Lists (src/config/env.ts)"]
        P_DAY["piece.panchang.day_limbs<br/>(reader:panchang/panchang_day)<br/>Vara, Tithi, Nakshatra, Yoga, Karana + End Times"]
        ENV["Configurable Env Rule Lists:<br/>- LUCKY_YOGA_AVOID (9 yogas) / LUCKY_YOGA_FAVOUR (12 yogas incl. Siddha #21)<br/>- LUCKY_KARANA_AVOID (Vishti) + LUCKY_FIXED_KARANA_AVOID (Shakuni, Chatushpada, Naga)<br/>- LUCKY_KARANA_FAVOUR (6 movable) + LUCKY_FIXED_KARANA_FAVOUR (Kimstughna +1)<br/>- LUCKY_AMRITA_SIDDHI_ENABLED (weekday + star combo +1)"]
    end

    subgraph LimbEvaluator["Five-Limb Evaluator (dayLimbs — agent:lucky.scenario_windows)"]
        L1["1. Vara: weekday & lord + Amrita Siddhi check (+1 when enabled)"]
        L2["2. Tithi: group (nanda, bhadra, jaya, rikta, purna, amavasya) inside its span"]
        L3["3. Nakshatra: star group (fixed, moving, quick, soft, fierce, sharp, mixed) inside its span"]
        L4["4. Yoga & Karana Gate: avoided yoga or karana span is cut out like an avoid band<br/>(a day it fills is gated out with yoga_avoid / karana_avoid);<br/>favoured yoga (+1); Kimstughna (+1 on auspicious beginnings)"]
        L1 --> L2 --> L3 --> L4
    end

    subgraph Output["General Five-Limb Verdicts"]
        OUT["output:limbs.v1<br/>Feeds lucky.avoid_bands & all 13 scenario scorers"]
    end

    P_DAY & ENV --> L1
    L4 --> OUT
```

---

## Page 3 of 21 — `lucky.avoid_bands`: Avoid Bands and Good Spans of the Day

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.avoid_bands` — Avoid bands and good spans of the day |
| **Category / Board / Status** | `self` · `lucky` · `built` |
| **Charts Declared** | `panchang:{kalams,muhurta}` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs`: `"the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)"`) |
| **Agent Piece** | `agent:lucky.scenario_windows` (`avoidBands`, `nowState`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:day_bands.v1` |
| **Date-Range Window Cache** | `freshness: 'daily'` (`[day.from, day.to)` at the local place) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/luckyTimes/windows.ts avoidBands, nowState; service.ts getRange` (`docs/reading-engine/49 §4.1; 47 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Stored Day Row at Reference Place"]
        P_DAY["piece.panchang.day_limbs<br/>(reader:panchang/panchang_day)<br/>Kalams & Muhurtas of the Day"]
    end

    subgraph BandExtractor["General Band Extractor (avoidBands + nowState — agent:lucky.scenario_windows)"]
        B1["1. Extract Avoid Bands in time order (past-midnight ends handled):<br/>Rahu Kalam, Yamagandam, Gulikai, every Durmuhurtam & Varjyam span"]
        B2["2. Extract Good Spans:<br/>Brahma Muhurta, Abhijit Muhurta, and every Amrita Gadiya"]
        B3["3. Compute 'Now' State:<br/>Running avoid band first -> else running good span -> else next good span"]
        B1 --> B2 --> B3
    end

    subgraph Output["Day Bands Contract"]
        OUT["output:day_bands.v1<br/>General avoid bands, good spans & live 'now' banner"]
    end

    P_DAY --> B1
    B3 --> OUT
```

---

## Page 4 of 21 — `lucky.personal_overlay`: Personal Overlay (`tara, chandra bala` and the Chart Marks)

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.personal_overlay` — Personal overlay (tara, chandra bala and the chart marks) |
| **Category / Board / Status** | `self` · `lucky` · `built` |
| **Charts Declared** | `panchang:{muhurta,chandra_bala}`, `nakshatra:tara` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces** | `reader:panchang/panchang_day` (`piece.panchang.personal_overlay`: `"the person's overlay for the same days (tara, chandra bala, grade)"`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: `D1 cards of the seven hora lords (nature column)`) · `reader:activation/activation_row` (`piece.activation.calendar_slice`: `periods running on each day, every system`) |
| **Agent Piece** | `agent:lucky.day_overlay` (`kind: 'engine_pull'`, `engineType: 'muhurta'`) + `windows.ts personalScore` |
| **Output Piece** | `output:day_overlay.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` / `'daily'` (stored once per month and place in `kundli_day_overlays`; combined with cached D1 functional nature & running dasha lords) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/luckyTimes/service.ts personalDays, functionalNatureOf, runningDashaLordsOf; windows.ts personalScore` (`docs/reading-engine/49 §4.1; 53 §4.6`) |

```mermaid
flowchart LR
    subgraph Inputs["Personal Overlay + Digest Planet Cards + Activation Slice"]
        P_OV["piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day)<br/>kundli_day_overlays: Tara (9 taras from Moon star) & Chandra Bala"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>D1 Cards of 7 Hora Lords (functional nature column)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>Running Dasha Lords on each day"]
    end

    subgraph CacheGate["Monthly Overlay Cache + Date-Range Window Gate"]
        GATE{"kundli_day_overlays (1 engine call / month / place)<br/>+ piece.cache.date_range_window"}
    end

    subgraph Scorer["Personal Mark Scorer (personalScore — Never Opens a Gated Day!)"]
        M1["1. Tara Bala verdict from Calculation Engine: good +1 / bad -1"]
        M2["2. Chandra Bala verdict from Calculation Engine: good +1 / bad -1"]
        M3["3. Hora lord's functional nature in D1 digest (functionalNatureOf):<br/>functional benefic +1 / functional malefic -1"]
        M4["4. Day's tithi lord or star lord is a running dasha lord in kundli_activation<br/>(runningDashaLordsOf): +1 personal:dasha_lord"]
        M1 --> M2 --> M3 --> M4
    end

    subgraph Output["Personal Day Marks"]
        OUT["output:day_overlay.v1<br/>Moves candidate windows by +-1 ('For you' in Why sheet)"]
    end

    P_OV & P_PC & P_ACT --> GATE --> M1
    M4 --> OUT
```

---

## Page 5 of 21 — `lucky.work.sign_contract`: Sign a Contract

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.work.sign_contract` — Sign a contract |
| **Category / Board / Status** | `work` · `lucky` · `built` |
| **Charts Declared** | `panchang:{tithi,nakshatra,weekday,hora,muhurta,kalams,yoga,karana}` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) |
| **Agent Piece / Recipe Family** | `agent:lucky.scenario_windows` · Member `1 of 13` of the `lucky.*` Scenario Family (`output:windows.v1`, `freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['work.sign_contract']`)** | Hours: `sunrise..19:00` · Floor: `3` · `dayFavour: [Thursday, Wednesday]` · `dayAvoid: [Saturday, Tuesday]` · `tithiFavour: [bhadra, purna]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [fixed]` · `starAvoid: [fierce, sharp]` · `horaFavour: [Jupiter, Mercury]` · `horaAvoid: [Saturn, Mars]` · `v1Note`: *"Mercury's motion is not yet checked; avoid signing while it moves backward."* |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.sign_contract']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Reusable Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_GEN["piece.panchang.day_limbs (reader:panchang/panchang_day)<br/>Shared Day Row: Sunrise..19:00 Horas, Kalams, 5 Limbs"]
        P_PER["piece.panchang.personal_overlay (reader:panchang/panchang_day)<br/>Personal Tara, Chandra Bala, Hora Nature, Dasha Lord"]
    end

    subgraph Scorer["Scenario Pipeline (scenarioDay — agent:lucky.scenario_windows)"]
        G1["General Gate: Avoid whole day on Saturday, Tuesday;<br/>cut Rahu/Yama/Gulika/Durmuhurta/Varjyam, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithi spans (drop pieces < 20 min)"]
        G2["General Score: Thu/Wed (+1); Bhadra/Purna tithi (+1);<br/>Fixed star (+1) vs Fierce/Sharp (-2); Favoured Yoga (+1);<br/>Jupiter/Mercury hora (+2) vs Saturn/Mars hora (-3);<br/>Abhijit/Amrita (+2), Good Muhurta (+1)"]
        P1["Personal Score: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Lord Benefic/Malefic (+-1), Running Dasha Lord (+1)"]
        FLT["Filter: Keep pieces >= Floor (3); return best 2 windows in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1<br/>Top 2 windows/day + 'For everyone' & 'For you' Why sheet"]
    end

    P_GEN & P_PER --> G1
    FLT --> OUT
```

---

## Page 6 of 21 — `lucky.work.send_resume`: Send a Resume or Application

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.work.send_resume` — Send a resume or application |
| **Category / Board / Status** | `work` · `lucky` · `built` |
| **Selectors / One-Tap Ask** | `boards: ['lucky']` · `ask: 'job'` (asks one question first before showing layer) |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['work.send_resume']`)** | Hours: `sunrise..20:00` · Floor: `3` · `dayFavour: [Wednesday, Thursday, Sunday]` · `dayAvoid: []` · `tithiFavour: [bhadra, nanda]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [quick, moving]` · `starAvoid: [sharp]` · `horaFavour: [Mercury, Sun, Jupiter]` · `horaAvoid: [Saturn]` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.send_resume']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..20:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['work.send_resume'] — ask: 'job')"]
        G1["General Gate: Cut Kalams/Durmuhurta/Varjyam, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithis (keep pieces >= 20 min)"]
        G2["General Score: Wed/Thu/Sun (+1); Bhadra/Nanda tithi (+1);<br/>Quick/Moving star (+1) vs Sharp (-2); Favoured Yoga (+1);<br/>Mercury/Sun/Jupiter hora (+2) vs Saturn hora (-3); Abhijit/Amrita (+2)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 7 of 21 — `lucky.work.interview`: Interview or Pitch

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.work.interview` — Interview or pitch |
| **Category / Board / Status** | `work` · `lucky` · `built` |
| **Selectors / One-Tap Ask** | `boards: ['lucky']` · `ask: 'job'` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['work.interview']`)** | Hours: `sunrise..18:00` · Floor: `3` · `dayFavour: [Thursday, Sunday, Wednesday]` · `dayAvoid: []` · `tithiFavour: [jaya, bhadra]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [quick, soft]` · `starAvoid: [fierce]` · `horaFavour: [Sun, Jupiter]` · `horaAvoid: [Saturn, Mars]` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.interview']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..18:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['work.interview'] — ask: 'job')"]
        G1["General Gate: Cut Avoid Bands, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithis (keep pieces >= 20 min)"]
        G2["General Score: Thu/Sun/Wed (+1); Jaya/Bhadra tithi (+1);<br/>Quick/Soft star (+1) vs Fierce (-2); Favoured Yoga (+1);<br/>Sun/Jupiter hora (+2) vs Saturn/Mars hora (-3); Abhijit/Amrita (+2)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 8 of 21 — `lucky.work.ask_raise`: Ask for a Raise

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.work.ask_raise` — Ask for a raise |
| **Category / Board / Status** | `work` · `lucky` · `built` |
| **Selectors / One-Tap Ask** | `boards: ['lucky']` · `ask: 'job'` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['work.ask_raise']`)** | Hours: `sunrise..18:00` · Floor: `3` · `dayFavour: [Thursday]` · `dayAvoid: [Saturday]` · `tithiFavour: [purna, jaya]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [fixed, quick]` · `starAvoid: [sharp, fierce]` · `horaFavour: [Jupiter, Sun]` · `horaAvoid: [Saturn]` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.ask_raise']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..18:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['work.ask_raise'] — ask: 'job')"]
        G1["General Gate: Avoid Saturday; cut Avoid Bands, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithis (keep pieces >= 20 min)"]
        G2["General Score: Thursday (+1); Purna/Jaya tithi (+1);<br/>Fixed/Quick star (+1) vs Sharp/Fierce (-2); Favoured Yoga (+1);<br/>Jupiter/Sun hora (+2) vs Saturn hora (-3); Abhijit/Amrita (+2)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 9 of 21 — `lucky.work.start_project`: Start a Project

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.work.start_project` — Start a project |
| **Category / Board / Status** | `work` · `lucky` · `built` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['work.start_project']`)** | Hours: `sunrise..20:00` · `useBrahma: true` (+2) · `BEGINNING_LIMBS` (`Kimstughna` fixed karana +1 bonus) · Floor: `3` · `dayFavour: [Monday, Wednesday, Thursday]` · `dayAvoid: []` · `tithiFavour: [bhadra, nanda]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [quick, fixed]` · `starAvoid: [sharp]` · `horaFavour: [Jupiter, Mercury, Moon]` · `horaAvoid: [Saturn]` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.start_project']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..20:00 + Brahma Muhurta)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['work.start_project'] — Beginning Act)"]
        G1["General Gate: Cut Avoid Bands, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithis; include Brahma Muhurta (+2)"]
        G2["General Score: Mon/Wed/Thu (+1); Bhadra/Nanda tithi (+1);<br/>Quick/Fixed star (+1) vs Sharp (-2); Favoured Yoga (+1);<br/>Kimstughna fixed karana bonus (+1);<br/>Jupiter/Mercury/Moon hora (+2) vs Saturn hora (-3)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 10 of 21 — `lucky.work.hard_talk_boss`: A Hard Talk with the Boss

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.work.hard_talk_boss` — A hard talk with the boss |
| **Category / Board / Status** | `work` · `lucky` · `built` |
| **Selectors / One-Tap Ask** | `boards: ['lucky']` · `ask: 'who'` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['work.hard_talk_boss']`)** | Hours: `sunrise..18:00` · Floor: `3` · `dayFavour: [Monday, Thursday]` · `dayAvoid: [Tuesday]` · `tithiFavour: [nanda]` · `tithiAvoid: [jaya, amavasya]` · `starFavour: [soft, fixed]` · `starAvoid: [fierce, sharp]` · `horaFavour: [Moon, Jupiter, Venus]` · `horaAvoid: [Mars, Saturn]` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.hard_talk_boss']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..18:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['work.hard_talk_boss'] — ask: 'who')"]
        G1["General Gate: Avoid Tuesday; cut Avoid Bands, avoided Yogas & Karanas,<br/>and Jaya/Amavasya tithis (keep pieces >= 20 min)"]
        G2["General Score: Mon/Thu (+1); Nanda tithi (+1);<br/>Soft/Fixed star (+1) vs Fierce/Sharp (-2); Favoured Yoga (+1);<br/>Moon/Jupiter/Venus hora (+2) vs Mars/Saturn hora (-3)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 11 of 21 — `lucky.love.ask_out`: Ask Someone Out

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.love.ask_out` — Ask someone out |
| **Category / Board / Status** | `love` · `lucky` · `built` |
| **Selectors / One-Tap Ask** | `boards: ['lucky']` · `ask: 'relationship'` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['love.ask_out']`)** | Hours: `09:00..22:00` · Floor: `3` · `dayFavour: [Friday, Wednesday]` · `dayAvoid: [Tuesday, Saturday]` · `tithiFavour: [nanda, bhadra]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [soft]` · `starAvoid: [fierce, sharp]` · `horaFavour: [Venus, Mercury, Moon]` · `horaAvoid: [Mars, Saturn]` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.ask_out']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: 09:00..22:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['love.ask_out'] — ask: 'relationship')"]
        G1["General Gate: Avoid Tuesday & Saturday; cut Avoid Bands, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithis (keep pieces >= 20 min)"]
        G2["General Score: Fri/Wed (+1); Nanda/Bhadra tithi (+1);<br/>Soft star (+1) vs Fierce/Sharp (-2); Favoured Yoga (+1);<br/>Venus/Mercury/Moon hora (+2) vs Mars/Saturn hora (-3)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 12 of 21 — `lucky.love.first_date`: A First Date

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.love.first_date` — A first date |
| **Category / Board / Status** | `love` · `lucky` · `built` |
| **Selectors / One-Tap Ask** | `boards: ['lucky']` · `ask: 'relationship'` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['love.first_date']`)** | Hours: `11:00..22:00` · Floor: `3` · `dayFavour: [Friday]` · `dayAvoid: []` · `tithiFavour: [nanda]` · `tithiAvoid: [amavasya]` · `starFavour: [soft]` · `starAvoid: [sharp]` · `horaFavour: [Venus, Moon]` · `horaAvoid: [Mars, Saturn]` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.first_date']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: 11:00..22:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['love.first_date'] — ask: 'relationship')"]
        G1["General Gate: Cut Avoid Bands, avoided Yogas & Karanas,<br/>and Amavasya tithi (keep pieces >= 20 min)"]
        G2["General Score: Friday (+1); Nanda tithi (+1);<br/>Soft star (+1) vs Sharp (-2); Favoured Yoga (+1);<br/>Venus/Moon hora (+2) vs Mars/Saturn hora (-3)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 13 of 21 — `lucky.love.clear_air`: Clear the Air

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.love.clear_air` — Clear the air |
| **Category / Board / Status** | `love` · `lucky` · `built` |
| **Selectors / One-Tap Ask** | `boards: ['lucky']` · `ask: 'relationship'` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['love.clear_air']`)** | Hours: `09:00..22:00` · Floor: `3` · `dayFavour: [Monday, Friday]` · `dayAvoid: [Tuesday]` · `tithiFavour: [nanda]` · `tithiAvoid: [jaya]` · `starFavour: [soft, fixed]` · `starAvoid: [fierce]` · `horaFavour: [Moon, Venus]` · `horaAvoid: [Mars]` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.clear_air']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: 09:00..22:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['love.clear_air'] — ask: 'relationship')"]
        G1["General Gate: Avoid Tuesday; cut Avoid Bands, avoided Yogas & Karanas,<br/>and Jaya tithi (keep pieces >= 20 min)"]
        G2["General Score: Mon/Fri (+1); Nanda tithi (+1);<br/>Soft/Fixed star (+1) vs Fierce (-2); Favoured Yoga (+1);<br/>Moon/Venus hora (+2) vs Mars hora (-3)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 14 of 21 — `lucky.money.invest_buy`: Invest or Buy

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.money.invest_buy` — Invest or buy |
| **Category / Board / Status** | `work` (money area maps to `work` category) · `lucky` · `built` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['money.invest_buy']`)** | Hours: `sunrise..19:00` · Floor: `3` · `dayFavour: [Thursday, Wednesday]` · `dayAvoid: []` · `tithiFavour: [bhadra, purna]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [fixed]` · `starAvoid: [sharp, fierce]` · `horaFavour: [Jupiter, Mercury]` · `horaAvoid: [Saturn]` · `v1Note`: *"Mercury's motion is not yet checked."* |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['money.invest_buy']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..19:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['money.invest_buy'])"]
        G1["General Gate: Cut Avoid Bands, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithis (keep pieces >= 20 min)"]
        G2["General Score: Thu/Wed (+1); Bhadra/Purna tithi (+1);<br/>Fixed star (+1) vs Sharp/Fierce (-2); Favoured Yoga (+1);<br/>Jupiter/Mercury hora (+2) vs Saturn hora (-3)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 15 of 21 — `lucky.travel.set_out`: Set Out on a Journey

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.travel.set_out` — Set out on a journey |
| **Category / Board / Status** | `self` (travel area maps to `self` category) · `lucky` · `built` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['travel.set_out']`)** | Hours: `sunrise..21:00` · Floor: `3` · `dayFavour: []` · `dayAvoid: []` · `tithiFavour: [bhadra, nanda]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [moving, quick]` · `starAvoid: [sharp]` · `horaFavour: [Moon, Venus, Mercury]` · `horaAvoid: [Saturn]` · `v1Note`: *"The direction rule for each weekday is not yet applied."* |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['travel.set_out']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..21:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['travel.set_out'])"]
        G1["General Gate: Cut Avoid Bands, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithis (keep pieces >= 20 min)"]
        G2["General Score: Bhadra/Nanda tithi (+1);<br/>Moving/Quick star (+1) vs Sharp (-2); Favoured Yoga (+1);<br/>Moon/Venus/Mercury hora (+2) vs Saturn hora (-3)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 16 of 21 — `lucky.study.exam_submit`: Exam or Submit

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.study.exam_submit` — Exam or submit |
| **Category / Board / Status** | `self` (study area maps to `self` category) · `lucky` · `built` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['study.exam_submit']`)** | Hours: `sunrise..20:00` · Floor: `3` · `dayFavour: [Wednesday, Thursday]` · `dayAvoid: []` · `tithiFavour: [jaya, purna]` · `tithiAvoid: [rikta]` · `starFavour: [quick]` · `starAvoid: [sharp]` · `horaFavour: [Mercury, Jupiter]` · `horaAvoid: []` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['study.exam_submit']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..20:00)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['study.exam_submit'])"]
        G1["General Gate: Cut Avoid Bands, avoided Yogas & Karanas,<br/>and Rikta tithi (keep pieces >= 20 min)"]
        G2["General Score: Wed/Thu (+1); Jaya/Purna tithi (+1);<br/>Quick star (+1) vs Sharp (-2); Favoured Yoga (+1);<br/>Mercury/Jupiter hora (+2); Abhijit/Amrita (+2)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 17 of 21 — `lucky.home.start_routine`: Start a Routine

| Field | Value |
|---|---|
| **Technique ID / Title** | `lucky.home.start_routine` — Start a routine |
| **Category / Board / Status** | `self` (home area maps to `self` category) · `lucky` · `built` |
| **Selectors** | `boards: ['lucky']` |
| **Reader Pieces & Agent** | `reader:panchang/panchang_day` (`piece.panchang.day_limbs` + `piece.panchang.personal_overlay`) · `agent:lucky.scenario_windows` (`freshness: 'daily'`, `scope: 'kundli'`) |
| **Scenario Rule (`SCENARIOS['home.start_routine']`)** | Hours: `sunrise..12:00` · `useBrahma: true` (+2) · `BEGINNING_LIMBS` (`Kimstughna` fixed karana +1 bonus) · Floor: `3` · `dayFavour: [Monday, Thursday]` · `dayAvoid: []` · `tithiFavour: [bhadra]` · `tithiAvoid: [rikta, amavasya]` · `starFavour: [fixed, quick]` · `starAvoid: []` · `horaFavour: [Sun, Moon, Jupiter]` · `horaAvoid: []` |
| **Code & Source** | `src/reading/luckyTimes/scenarios.ts SCENARIOS['home.start_routine']; windows.ts scenarioDay` |

```mermaid
flowchart LR
    subgraph Inputs["Panchang & Personal Overlay Pieces (Freshness: daily)"]
        P_IN["piece.panchang.day_limbs + piece.panchang.personal_overlay<br/>(reader:panchang/panchang_day: Sunrise..12:00 + Brahma Muhurta)"]
    end

    subgraph Scorer["Scenario Scorer (SCENARIOS['home.start_routine'] — Beginning Act)"]
        G1["General Gate: Cut Avoid Bands, avoided Yogas & Karanas,<br/>and Rikta/Amavasya tithis; include Brahma Muhurta (+2)"]
        G2["General Score: Mon/Thu (+1); Bhadra tithi (+1);<br/>Fixed/Quick star (+1); Favoured Yoga (+1);<br/>Kimstughna fixed karana bonus (+1); Sun/Moon/Jupiter hora (+2)"]
        P1["Personal Overlay: Tara (+-1), Chandra Bala (+-1),<br/>D1 Hora Nature (+-1), Running Dasha Lord (+1)"]
        FLT["Keep pieces scoring >= 3; emit best 2 in time order"]
        G1 --> G2 --> P1 --> FLT
    end

    subgraph Output["Best Windows Per Day"]
        OUT["output:windows.v1"]
    end

    P_IN --> G1
    FLT --> OUT
```

---

## Page 18 of 21 — `life.promise_scale`: Life Areas — The Weighed Promise Scale (13 Areas)

| Field | Value |
|---|---|
| **Technique ID / Title** | `life.promise_scale` — Life areas: the weighed promise scale |
| **Category / Board / Status** | `general` · `timeline` · `built` |
| **Charts Declared** | `natal:{digest.house,digest.planet,digest.yoga}`, `divisional:{D9,owning varga}`, `dasha:kundli_activation`, `annual:digest.annual`, `transit:transit_snapshot.double_transit` |
| **Selectors** | `boards: ['timeline']`, `houses: [1..12]`, `vargas: ['D1', 'D9', 'D2', 'D3', 'D4', 'D7', 'D10', 'D12', 'D20', 'D24', 'D30']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`: D1 area houses + D9 + owning varga primary house) · `reader:planet/planet_card` (`piece.digest.planet_cards`: D1 area karakas + primary house lord in D9 & owning varga + `dashaCharter.fruition`) · `reader:yoga/yoga_row` (`piece.digest.yoga_register`: D1 yogas on area houses/lords) · `reader:activation/activation_row` (`piece.activation.calendar_slice`: periods running today, levels 1–2) |
| **Agent & Scorer Pieces** | `agent:life.dashboard` (`piece.scorer.promise_layer`: `promiseScale`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:life_promise.v1` · feeds `life.dashboard` |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`, fallback `30d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/life/promise.ts promiseScale` (`docs/reading-engine/34 §2, §3; 54 §4; 55 §4.1`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest House, Planet & Yoga Slicers + Running Activation Slice"]
        P_DIG["piece.digest.house_cards + planet_cards + yoga_register<br/>13 Areas: self (1,9,10), money (2,11,9,5 D2), work (10,6,1 D10),<br/>home (4,2,11 D4), marriage (7,2,11,12 D9), children (5,9 D7),<br/>parents (4,9 D12), siblings (3,11,1 D3), legal (6,10,8 D30),<br/>health (1,6,8 D30), travel (12,9,3,7 D4), learning (4,5,2,9 D24), dharma (9,12,8,5 D20)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row: periods running today, L1-L2)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph Scorer["5-Pillar 100-Point Promise Scale (promiseScale — agent:life.dashboard)"]
        W1["1. D1 Weight (35): primary house (x2) & secondary houses (x1) lord dignity, house class,<br/>occupants, SAV (>=28 vs <=24), argala, karaka nature/dignity/combustion, yogas vs doshas"]
        W2["2. Vargas Weight (20): D9 (10) + Owning Varga (10): primary house lord & occupants + D1 lord dignity there<br/>-> Verdict from D1 + Vargas ONLY: >=60% Promised, 40-59% Partial, <40% Not Written"]
        W3["3. Dashas (25): running periods today (Vimshottari 8, Rasi 6, Conditional 4, Yogini 3, Tithi Ashtottari 2, Others 2)<br/>+ 9x9 AD-from-MD fruition check from planet card dashaCharter.fruition"]
        W4["4. Annual (10): TP (6) + VP (4) primary house · 5. Transit (10): stored double transit vs Sa/Ra/Ke"]
        W1 --> W2 --> W3 --> W4
    end

    subgraph Output["13-Area Promise Scale"]
        OUT["output:life_promise.v1<br/>Feeds synthesizer: life.dashboard"]
    end

    P_DIG & P_ACT --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| W1
    W4 --> OUT
```

---

## Page 19 of 21 — `life.timing_agreement`: Life Areas — When It Improves, by Agreement Across Systems

| Field | Value |
|---|---|
| **Technique ID / Title** | `life.timing_agreement` — Life areas: when it improves, by agreement across systems |
| **Category / Board / Status** | `general` · `timeline` · `built` |
| **Charts Declared** | `natal:{digest.house,digest.planet,digest.yoga}`, `divisional:{D9,owning varga}`, `dasha:kundli_activation`, `annual:digest.annual`, `transit:transit_snapshot.double_transit` |
| **Selectors** | `boards: ['timeline']`, `houses: [1..12]`, `vargas: ['D1'..'D30']` |
| **Reader Pieces** | `reader:activation/activation_row` (`piece.activation.calendar_slice`: `every family, levels 1-2, today to +15 years, the area houses`) · `reader:annual/annual_row` (`piece.digest.annual_set`: `TP and VP of each year a window touches, D1 card of the primary house`) · `reader:transit/transit_row` (`piece.transit.sky_overlay`: `stored natal-overlay double_transit windows and Saturn/Rahu/Ketu rows`) |
| **Agent Piece** | `agent:life.dashboard` (`areaTiming`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:life_windows.v1` · feeds `life.dashboard` |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Env Config (`src/config/env.ts`)** | `LIFE_HORIZON_YEARS=15` (clamped `5..30`) |
| **Code & Source** | `src/reading/life/timing.ts areaTiming` (`docs/reading-engine/34 §2, §3; 54 §4`) |

```mermaid
flowchart LR
    subgraph Inputs["15-Year Activation Slice + Annual Set + Stored Transit Overlay"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row: all families, L1-L2, today..+15y)"]
        P_ANN["piece.digest.annual_set<br/>(reader:annual/annual_row: TP & VP of years touched)"]
        P_TR["piece.transit.sky_overlay<br/>(reader:transit/transit_row: stored double_transit & Sa/Ra/Ke)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph TimingEngine["Cross-System Agreement Scorer (areaTiming — agent:life.dashboard)"]
        T1["1. Candidates: every Vimshottari sub-period (L2, else L1) in next LIFE_HORIZON_YEARS (15y)<br/>activating an area house without testing it"]
        T2["2. Cross-System Gate: Dated window ONLY when Vimshottari AND >= 1 of<br/>(Conditional, Rasi, Yogini, Tithi Ashtottari) agree (otherwise year-only 'possibility')"]
        T3["3. Score = 55 x promise_ratio + Vimshottari (8) + agreeing_family_weights<br/>- contradicting_family_weights + TP (6) + VP (4) + Double Transit (10)"]
        T4["4. Grade: >=70 strong, 50-69 moderate, <50 weak; keep best 3 dated windows in date order"]
        T1 --> T2 --> T3 --> T4
    end

    subgraph Output["Top 3 Dated Windows Per Area"]
        OUT["output:life_windows.v1<br/>Feeds synthesizer: life.dashboard"]
    end

    P_ACT & P_ANN & P_TR --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| T1
    T4 --> OUT
```

---

## Page 20 of 21 — `life.mahadasha_charter`: Remaining Largest Mahadasha (10–18+ Yrs) and Antardasha Life Charter

| Field | Value |
|---|---|
| **Technique ID / Title** | `life.mahadasha_charter` — Remaining largest Mahadasha (10-18+ yrs) and Antardasha life charter |
| **Category / Board / Status** | `general` · `timeline` · `built` |
| **Charts Declared** | `natal:{digest.house,digest.planet,digest.yoga}`, `divisional:{D9,owning varga}`, `dasha:kundli_activation`, `annual:digest.annual`, `transit:transit_snapshot.double_transit` |
| **Selectors** | `boards: ['timeline']`, `houses: [1..12]`, `vargas: ['D1'..'D30']` |
| **Reader Pieces** | `reader:house/house_card` · `reader:planet/planet_card` · `reader:yoga/yoga_row` · `reader:activation/activation_row` · `reader:annual/annual_row` · `reader:transit/transit_row` |
| **Agent Piece** | `agent:life.dashboard` (`buildMahadashaCharter`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:life_charter.v1` · feeds `life.dashboard` |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Env Config (`src/config/env.ts`)** | `LIFE_CHARTER_MIN_REMAINING_YEARS=10`, `LIFE_CHARTER_HORIZON_YEARS=20`, `LIFE_CHARTER_MAX_AREAS_PER_AD=3` |
| **Code & Source** | `src/reading/life/charter.ts buildMahadashaCharter` (`docs/reading-engine/34 §3–§5; 55 §4`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest House/Planet/Yoga Slicers + 20-Year Activation, Annual & Transit Slices"]
        P_PROM["piece.digest.house_cards + planet_cards (with dashaCharter) + yoga_register"]
        P_TIME["piece.activation.calendar_slice + piece.digest.annual_set + piece.transit.sky_overlay"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph CharterBuilder["Long-Term Mahadasha & Antardasha Charter Builder (buildMahadashaCharter)"]
        C1["1. Select running Vimshottari Mahadasha if >= LIFE_CHARTER_MIN_REMAINING_YEARS (10y) left;<br/>else select largest MD in LIFE_CHARTER_HORIZON_YEARS (20y) + carry running MD as transition bridge"]
        C2["2. Build MD Touch Map from D1 planet card & dashaCharter:<br/>houses owned, occupied, star-lord house, dispositor house, co-owned, drishti, active yogas"]
        C3["3. Synthesize per-area life charters (anchor, growth, guarded) across the 13 life areas"]
        C4["4. Enumerate chronological Antardashas (L2) and score 13 areas across 5 pillars:<br/>D1+varga promise, 9x9 AD-from-MD fruition, multi-dasha agreement, TP/VP annual, stored transit gates"]
        C1 --> C2 --> C3 --> C4
    end

    subgraph Output["Multi-Decade Life Charter"]
        OUT["output:life_charter.v1<br/>Feeds synthesizer: life.dashboard"]
    end

    P_PROM & P_TIME --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| C1
    C4 --> OUT
```

---

## Page 21 of 21 — `life.dashboard`: Your Life at a Glance and Long-Term Mahadasha Charter

| Field | Value |
|---|---|
| **Technique ID / Title** | `life.dashboard` — Your life at a glance and long-term Mahadasha charter |
| **Category / Board / Status** | `general` · `timeline` · `built` |
| **Charts Declared** | `natal:{digest.house,digest.planet,digest.yoga}`, `divisional:{D9,owning varga}`, `dasha:kundli_activation`, `annual:digest.annual`, `transit:transit_snapshot.double_transit` |
| **Selectors** | `boards: ['timeline']`, `houses: [1..12]`, `vargas: ['D1'..'D30']` |
| **Reader Pieces** | `reader:house/house_card` · `reader:planet/planet_card` · `reader:yoga/yoga_row` · `reader:activation/activation_row` · `reader:annual/annual_row` · `reader:transit/transit_row` (consumes `life.promise_scale`, `life.timing_agreement`, `life.mahadasha_charter`) |
| **Agent Piece** | `agent:life.dashboard` (`composeDashboard`, `getLifeReading`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:life_reading.v2` (stored per kundli per day in `area_builds` with `area = 'life'` and in `technique_outputs`) |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) + `area_builds` daily cache · `scope: 'kundli'` |
| **Code & Source** | `src/reading/life/compose.ts composeDashboard; service.ts getLifeReading` (`docs/reading-engine/34 §1, §5 Part 1; 54 §4; 55 §4`) |

```mermaid
flowchart LR
    subgraph Upstream["3 Deterministic Life Sub-Techniques + Companion Memory (person_facts)"]
        L_PROM["life.promise_scale (life_promise.v1)"]
        L_TIME["life.timing_agreement (life_windows.v1)"]
        L_CHAR["life.mahadasha_charter (life_charter.v1)"]
        FACTS["person_facts: work.status, love.status, family.children"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate + area_builds(area='life')"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>+ area_builds daily store (scope: kundli)"}
    end

    subgraph Composer["Life Dashboard Composer (composeDashboard — Zero AI / Template Sentences Only)"]
        D1["1. Digest Gate: if digest_status != 'ready', return 'preparing' and queue kundli-digest"]
        D2["2. Filter active areas: show area ONLY when it has a current pressure or a dated window"]
        D3["3. Compose per-area cards:<br/>- Issue: heaviest current test line with end date + 1 confirming question from person_facts<br/>- Cause: current test planets + withholding planets + running periods<br/>- Solution: 2 practical steps, date to hold until, best window to act in, strongest benefic weekday/gesture"]
        D4["4. Compose 'Rule for Now' (hold-and-prepare vs act-on-what-is-ready) + Mahadasha Charter cards"]
        D1 --> D2 --> D3 --> D4
    end

    subgraph Output["Complete Life Reading Dashboard"]
        OUT["output:life_reading.v2<br/>Rendered on Profile -> Timeline screen"]
    end

    L_PROM & L_TIME & L_CHAR & FACTS --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| D1
    D4 --> OUT
```
