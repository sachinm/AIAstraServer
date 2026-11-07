# Volume 03 — Self / You Board (`self.*` / `you` Board) One-Per-Page Illustrations

> **Format**: One illustration per page (`Page 1 of 10` through `Page 10 of 10`), separated by `---`.  
> **Category / Board**: `self` · `you`  
> **Houses & Vargas**: Houses `1, 4, 5, 9, 12` with the Moon · Vargas `D1, D9, D20, D24, D12, D4, D7, D60`  
> **Code References**: [`src/techniques/catalog.ts`](../../src/techniques/catalog.ts) · [`src/reading/area/houseLayers.ts`](../../src/reading/area/houseLayers.ts) · [`src/reading/area/self.ts`](../../src/reading/area/self.ts) · [`src/reading/area/boardService.ts`](../../src/reading/area/boardService.ts)

---

## Page 1 of 10 — `self.promise`: Natal Promise of Houses 1, 4 and 5 with the Moon

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.promise` — Natal promise of houses 1, 4 and 5 with the Moon |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:{facts,house_counts,dignities,aspects,strength.bhava,yogas,doshas,avasthas}`, `jaimini:{argala,arudhas}`, `ashtakavarga:sav` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 12]`, `vargas: ['D1', 'D9', 'D20', 'D24', 'D12', 'D4', 'D7', 'D60']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`: `D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: `D1 and D9 cards of lagna lord, Moon, Sun, 4th and 5th lords, Mercury, Jupiter, Ketu and AK`) · `reader:point/point_row` (`piece.digest.point_cards`: `AK, SL, AL`) · `reader:yoga/yoga_row` (`piece.digest.yoga_register`: yogas/doshas joining houses `1,4,5,9,12` or Self planets) |
| **Agent & Scorer Pieces** | `agent:area.self_board` (`piece.scorer.promise_layer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (`open` window: `to = null`, valid until `digest_version` or `contractHash` changes) · `scope: 'kundli'` (`withTechniqueOutput` skips re-scoring on every subsequent You board open!) |
| **Code & Source** | `src/reading/area/houseLayers.ts promiseLayer; self.ts SELF; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.2; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph DigestSlicers["Reusable Digest Slicers (Freshness: natal, Scope: kundli)"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>D1,D9,D20,D24,D12,D4,D7,D60 Houses 1,4,5,9,12"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>D1 & D9: Lagna Lord, Moon, Sun, 4th/5th Lords, Me, Ju, Ke, AK"]
        P_PT["piece.digest.point_cards<br/>(reader:point/point_row: AK, SL, AL)"]
        P_YR["piece.digest.yoga_register<br/>(reader:yoga/yoga_row: Self Houses & Planets)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [Epoch 0, open)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Promise Scorer (piece.scorer.promise_layer — agent:area.self_board)"]
        S1["1. Read D1 house card for each of houses 1, 4, 5, 9, 12:<br/>- Lord in own house or kendra/trikona: +2<br/>- Lord exalted, own or moolatrikona: +2"]
        S2["2. Functional benefic occupant or graha drishti: +1 each (malefic: -1 for score)<br/>- SAV of house >= 28: +1; present yoga on house/lord: +1..+2 by class"]
        S3["3. Scale supports by lord's avastha: x0.5 (mrita/sushupta), x1.25 (jagrat/deepta)<br/>- Self planets dignified in D1 (+1) or shadbala ratio >= 1.2 (+1)"]
        S1 --> S2 --> S3
    end

    subgraph Output["You Board Supports"]
        OUT["output:area_board.v1<br/>Plain-language support lines with digest evidence keys"]
    end

    P_HC & P_PC & P_PT & P_YR --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 2 of 10 — `self.affliction`: Afflictions on Houses 1, 4 and 5 with the Moon

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.affliction` — Afflictions on houses 1, 4 and 5 with the Moon |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:{facts,dignities,aspects,doshas,avasthas,house_counts}` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 12]`, `vargas: ['D1', 'D9', 'D20', 'D24', 'D12', 'D4', 'D7', 'D60']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`) · `reader:planet/planet_card` (`piece.digest.planet_cards`) · `reader:yoga/yoga_row` (`piece.digest.yoga_register`: Kemadruma, doshas, cancellations) · `reader:activation/activation_row` (`piece.activation.calendar_slice`: running & next periods of afflicting planets on houses `1,4,5,9,12`) |
| **Agent & Scorer Pieces** | `agent:area.self_board` (`piece.scorer.affliction_layer`: `afflictionLayer`, `releaseOf`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` (pressures with release `until` dates) |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`, or `30d` fallback bucket) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts afflictionLayer, releaseOf; self.ts SELF; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.3; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest Slicers + Activation Slice (Freshness: dasha, Scope: kundli)"]
        P_DIG["piece.digest.house_cards + planet_cards + yoga_register<br/>(Houses 1,4,5,9,12, Lagna Lord, Moon, Kemadruma, Gandanta)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>Running periods of afflicting planets on houses 1,4,5,9,12"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Affliction & Release Scorer (piece.scorer.affliction_layer)"]
        A1["1. House lord in dusthana (2), debilitated without cancellation in yoga register (2),<br/>combust (1, no release), or in planetary war (1)"]
        A2["2. Saturn, Rahu or Ketu occupying house (1.5) or aspecting house/Self planets (1)<br/>3. Uncancelled Kemadruma or doshas on houses; Moon in gandanta"]
        A3["4. Compute Release Date (releaseOf): end date (to_date) of the afflicting planet's<br/>period running today in kundli_activation (main clock first, else any family)"]
        A1 --> A2 --> A3
    end

    subgraph Output["You Board Pressures & Release Dates"]
        OUT["output:area_board.v1<br/>Pressures with exact 'until' release dates"]
    end

    P_DIG & P_ACT --> GATE
    GATE -->|"HIT (valid_from <= now < valid_to)"| OUT
    GATE -->|"MISS"| A1
    A3 --> OUT
```

---

## Page 3 of 10 — `self.protection`: What Protects Houses 1, 4 and 5 with the Moon

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.protection` — What protects houses 1, 4 and 5 with the Moon |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:{aspects,dignities,yogas,avasthas}`, `jaimini:argala`, `divisional:{D1,D9,D20,D24,D12,D4,D7,D60}` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 12]`, `vargas: ['D1'..'D60']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`) · `reader:planet/planet_card` (`piece.digest.planet_cards`) · `reader:point/point_row` (`piece.digest.point_cards`) · `reader:yoga/yoga_row` (`piece.digest.yoga_register`) |
| **Agent & Scorer Pieces** | `agent:area.self_board` (`piece.scorer.protection_layer`: `protectionLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (`open` window: `to = null`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts protectionLayer; self.ts SELF; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.3; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph DigestInputs["Reusable Digest Slicers (Freshness: natal, Scope: kundli)"]
        P_HC["piece.digest.house_cards (D1..D60 Houses 1,4,5,9,12)"]
        P_PC["piece.digest.planet_cards (D1 & D9 Self Planets & Dispositors)"]
        P_PT["piece.digest.point_cards (AK, SL, AL)"]
        P_YR["piece.digest.yoga_register (Neecha Bhanga & Cancellations)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [Epoch 0, open)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Protection Scorer (piece.scorer.protection_layer)"]
        P1["1. Jupiter occupying or aspecting houses 1,4,5,9,12, Self planets, or AK/SL/AL houses: +2"]
        P2["2. Unobstructed primary benefic argala on houses: +1;<br/>house lord's dispositor dignified in D1: +1"]
        P3["3. Cancellation in yoga register (Neecha Bhanga, etc.) naming house lord or Self planet: +2"]
        P4["4. Owning varga check: D9 1st house lord (D9.h1) dignified: +2"]
        P1 --> P2 --> P3 --> P4
    end

    subgraph Output["You Board Protections"]
        OUT["output:area_board.v1<br/>Protections that raise the floor of the verdict"]
    end

    P_HC & P_PC & P_PT & P_YR --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| P1
    P4 --> OUT
```

---

## Page 4 of 10 — `self.activation`: Activation of Houses 1, 4 and 5 by Every Dasha System

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.activation` — Activation of houses 1, 4 and 5 with the Moon by every dasha system |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `dasha:{vimshottari,conditional,narayana,chara,karaka,yogini,tithi_ashtottari}`, `annual:tithi_pravesha_dasha`, `divisional:{D1,D9,D20,D24,D12,D4,D7,D60}` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 12]`, `vargas: ['D1'..'D60']` |
| **Reader Pieces** | `reader:activation/activation_row` (`piece.activation.calendar_slice`: every served system from `-13m` to `+30y` activating houses `1,4,5,9,12`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: D1 and D9 cards of period lords) |
| **Agent & Voter Pieces** | `agent:area.self_board` (`piece.voter.five_family_clock`: `gradeRow`, `familyVotes`, `aheadWindows`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` (family votes + 36-month sub-area windows + 30-year turning points) |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`, fallback `30d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts gradeRow, familyVotes, aheadWindows; self.ts SELF; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.4; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Activation Calendar Slice + Planet Cards (Freshness: dasha, Scope: kundli)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>All served systems (-13m to +30y) activating houses 1,4,5,9,12 (Levels 1-2)"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>D1 & D9 Cards of Period Lords"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph Voter["Multi-System Dasha Voter (piece.voter.five_family_clock)"]
        V1["1. Grade each period lord (gradeRow): functional benefic +1 / malefic -1;<br/>dignity in D1 +-1 and D9 +-1; owns house 1,4,5,9,12 (+1) vs dusthana (-1)"]
        V2["2. Five-family clock vote (familyVotes): Main, Conditional, Sign, Karaka,<br/>and Short Clocks (Yogini + Tithi Ashtottari vote only when both agree);<br/>support >= +0.5, test <= -0.5"]
        V3["3. Build Windows Ahead (aheadWindows): merge level-2 periods in next 36m<br/>by sub-area planet/house; mark main-clock shifts inside 30y as turning points"]
        V1 --> V2 --> V3
    end

    subgraph Output["You Board Activation & Windows"]
        OUT["output:area_board.v1<br/>Present clock votes, 36m sub-area windows & 30y turning points"]
    end

    P_ACT & P_PC --> GATE
    GATE -->|"HIT (valid_from <= now < valid_to)"| OUT
    GATE -->|"MISS"| V1
    V3 --> OUT
```

---

## Page 5 of 10 — `self.transit`: Transits Over Houses 1, 4 and 5 with the Moon

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.transit` — Transits over houses 1, 4 and 5 with the Moon |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `transit:{transit_contacts,double_transit,sade_sati,eclipses}`, `ashtakavarga:transit_ashtakavarga` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 12]`, `vargas: ['D1'..'D60']` |
| **Reader Pieces** | `reader:transit/transit_row` (`piece.transit.sky_overlay`: shared sky with overlay for Sa, Ju, Ra, Ke and eclipses over houses `1,4,5,9,12`, their lords and arudhas, `±24m`) · `reader:house/house_card` (`piece.digest.house_cards`) |
| **Agent Piece** | `agent:area.self_board` (`transitLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'transit'` (epoch-aligned `2h` window `TECHNIQUE_TRANSIT_WINDOW_HOURS=2`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts transitLayer; self.ts SELF; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.5; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Sky Overlay Loader + House Cards (Freshness: transit = 2h, Scope: kundli)"]
        P_TR["piece.transit.sky_overlay<br/>(reader:transit/transit_row)<br/>Stored Sky Overlay covering today:<br/>Ju, Sa, Ra, Ke house_from_lagna & Sade Sati spans"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>D1..D60 Houses 1,4,5,9,12"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate (2h Window)"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Transit Layer (transitLayer — agent:area.self_board)"]
        T1["1. Read stored sky overlay (never fetches live here; omitted with note if absent)"]
        T2["2. Jupiter in house 1,4,5,9,12 -> Support until ingress date<br/>Saturn, Rahu or Ketu in house 1,4,5,9,12 -> Pressure until ingress date"]
        T3["3. Running Sade Sati span -> Pressure on Self until span end date<br/>4. Cast 1 net vote (support / test / neutral) into You board tone"]
        T1 --> T2 --> T3
    end

    subgraph Output["You Board Transit Vote & Spans"]
        OUT["output:area_board.v1<br/>Dated transit supports/pressures + 1 tone vote"]
    end

    P_TR & P_HC --> GATE
    GATE -->|"HIT (inside 2h window)"| OUT
    GATE -->|"MISS"| T1
    T3 --> OUT
```

---

## Page 6 of 10 — `self.annual`: This Year's Chart for Houses 1, 4 and 5 with the Moon

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.annual` — This year's chart for houses 1, 4 and 5 with the Moon |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `annual:{tithi_pravesha,sahams,mudda,patyayini,tithi_pravesha_dasha}` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 12]`, `vargas: ['D1'..'D60']` |
| **Reader Pieces** | `reader:annual/annual_row` (`piece.digest.annual_set`: TP and VP of current, previous and next year, houses `1,4,5,9,12`, their sahams and year dashas) |
| **Agent Piece** | `agent:area.self_board` (`currentYear`, `annualLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'annual'` (`[year.from, year.to)` of running Tithi Pravesha / Varsha chart, fallback `90d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts currentYear, annualLayer; self.ts SELF; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.6; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Annual Digest Slicer (Freshness: annual, Scope: kundli)"]
        P_ANN["piece.digest.annual_set<br/>(reader:annual/annual_row)<br/>TP & VP Year Charts covering today:<br/>Houses 1,4,5,9,12, Sahams & Year Dashas"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: annual [year.from, year.to)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Annual Scorer (currentYear + annualLayer)"]
        Y1["1. Pick year chart whose year dashas cover today (Tithi Pravesha preferred over Varsha)"]
        Y2["2. Year lord of each Self house in own house or kendra/trikona without debility -> Confirms;<br/>in dusthana -> Contradicts"]
        Y3["3. Self sahams in a kendra of the year chart -> Confirms<br/>4. Emit 1 vote in You board tone + 1 plain line under 'This year'"]
        Y1 --> Y2 --> Y3
    end

    subgraph Output["You Board Annual Section"]
        OUT["output:area_board.v1<br/>'This year' summary line + 1 tone vote"]
    end

    P_ANN --> GATE
    GATE -->|"HIT (valid for entire TP/VP year!)"| OUT
    GATE -->|"MISS"| Y1
    Y3 --> OUT
```

---

## Page 7 of 10 — `self.varga`: Owning Divisional Chart of Houses 1, 4 and 5 with the Moon

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.varga` — Owning divisional chart of houses 1, 4 and 5 with the Moon |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:{D1,D9,D20,D24,D12,D4,D7,D60}` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 12]`, `vargas: ['D1'..'D60']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`: `D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12`) · `reader:planet/planet_card` (`piece.digest.planet_cards`) · `reader:point/point_row` (`piece.digest.point_cards`: arudhas of houses `1,4,5,9,12` in `D1..D60`) |
| **Agent & Scorer Pieces** | `agent:area.self_board` (`piece.scorer.varga_agreement`: `vargaLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (`open` window: `to = null`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts vargaLayer; self.ts SELF; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.7; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest House, Planet & Point Slicers (Freshness: natal, Scope: kundli)"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>Owning Vargas (D9, D20, D24, D12, D4, D7, D60) for Primary Houses 1, 4, 5"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>D1 Lords Placed in Owning Vargas"]
        P_PT["piece.digest.point_cards<br/>(reader:point/point_row: Arudhas in Vargas)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [Epoch 0, open)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Varga Agreement Scorer (piece.scorer.varga_agreement — vargaLayer)"]
        V1["1. For primary houses 1, 4, 5 in owning vargas (D9, D20, D24, D12, D4, D7, D60):<br/>- Natal D1 lord dignified in owning varga -> +1.5 support; debilitated -> 1.5 test"]
        V2["2. Varga house lord dignified or in kendra/trikona -> +1 support;<br/>in dusthana or debilitated -> 1 test"]
        V3["3. Planet occupying same house in D1 and owning varga (vargottama placement) -> +1 support<br/>4. Net verdict (agrees / disagrees / neutral) joins board supports & pressures"]
        V1 --> V2 --> V3
    end

    subgraph Output["You Board Varga Confirmation"]
        OUT["output:area_board.v1<br/>Divisional agreement supports & pressures"]
    end

    P_HC & P_PC & P_PT --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| V1
    V3 --> OUT
```

---

## Page 8 of 10 — `self.nakshatra`: Nakshatra Charter of Houses 1, 4 and 5 with the Moon

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.nakshatra` — Nakshatra charter of houses 1, 4 and 5 with the Moon |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `nakshatra:{cusp_nak,star_lord,occupant_stars}` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 12]`, `vargas: ['D1'..'D60']` |
| **Reader Pieces** | `reader:star/star_profile` (`piece.digest.star_profile`: Moon star, lagna star, tara table) · `reader:house/house_card` (`piece.digest.house_cards`: `cusp_star` column of houses `1,4,5`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: D1 cards of cusp star lords & period star lords) |
| **Agent & Scorer Pieces** | `agent:area.self_board` (`piece.scorer.nakshatra_charter`: `nakshatraLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (`open` window: `to = null`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts nakshatraLayer; self.ts SELF; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.8; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest Star, House & Planet Slicers (Freshness: natal, Scope: kundli)"]
        P_ST["piece.digest.star_profile<br/>(reader:star/star_profile: Moon Star, Lagna Star, Tara Table)"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card: Cusp Stars of Houses 1, 4, 5)"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card: D1 Cards of Star Lords)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [Epoch 0, open)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Nakshatra Charter Scorer (piece.scorer.nakshatra_charter)"]
        N1["1. Read cusp stars of primary houses 1, 4, 5 and star profile from digest"]
        N2["2. Primary house cusp star lord dignified or functional benefic in D1 -> +1 support;<br/>debilitated in D1 -> 1 pressure"]
        N3["3. Running period lord's star lord is the house lord or a Self karaka (Sun, Moon, Me, Ju)<br/>-> Period delivers through the star (+1.5 support)"]
        N1 --> N2 --> N3
    end

    subgraph Output["You Board Nakshatra Supports"]
        OUT["output:area_board.v1<br/>Star-delivery supports & pressures with digest evidence keys"]
    end

    P_ST & P_HC & P_PC --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| N1
    N3 --> OUT
```

---

## Page 9 of 10 — `research.self_dashboard_qa`: Research Self Dashboard Deep-Dive & Nov/Thanksgiving/Dec/New Year Zoom-In

| Field | Value |
|---|---|
| **Technique ID / Title** | `research.self_dashboard_qa` — Research Self Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year zoom-in |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:{facts,dignities,aspects,avasthas,yogas,doshas,strength.shadbala}`, `ashtakavarga:sav`, `jaimini:{charakaraka,arudhas,argala}`, `nakshatra:{janma,cusp_nak}`, `divisional:{D1,D9,D10,D20,D24,D12,D2,D4,D7,D60}`, `dasha:{vimshottari,yogini,tithi_ashtottari,narayana,chara,karaka}`, `annual:{tithi_pravesha,varsha,tithi_pravesha_dasha}`, `transit:{transit_contacts,sade_sati}`, `panchang:muhurta` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha', 'career_work']`, `houses: [1..12]`, `vargas: ['D1', 'D9', 'D10', 'D20', 'D24', 'D12', 'D2', 'D4', 'D7', 'D60']` |
| **Reader Pieces** | `reader:house/house_card` · `reader:planet/planet_card` · `reader:yoga/yoga_row` · `reader:point/point_row` · `reader:star/star_profile` · `reader:activation/activation_row` · `reader:annual/annual_row` · `reader:transit/transit_row` |
| **Agent Piece** | `agent:research.self_dashboard_builder` (`hydrateResearchSubject`, `buildSelfResearchDashboard`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:research_self_dashboard.v1` (feeds `research.technical_verifier`) |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/research/selfDashboardQa.ts hydrateResearchSubject, buildSelfResearchDashboard` (`docs/admin/09 §4.1; docs/reading-engine/46 §B; 54 §3; 55 §2`) |

```mermaid
flowchart LR
    subgraph StagingInputs["Isolated Research Staging & Digest Slicers (Freshness: transit = 2h, Scope: kundli)"]
        R_DIG["research_digests + research_activations<br/>(house_card, planet_card, yoga_row, point_row, star_profile, annual_row, activation_row, transit_row)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph Builder["Research Self Dashboard Builder (agent:research.self_dashboard_builder)"]
        B1["1. Hydrate synthetic age-bracket or profession persona into isolated research_* staging tables"]
        B2["2. Run production Self board (buildBoard SELF, resolveAreaShades, buildCalmPlaybook)<br/>+ 12-house D1 & 10-varga deep-dive matrix"]
        B3["3. Zoom in temporally across Nov, Thanksgiving Week, Dec, and New Year (9 weeks + 14-day strip)<br/>+ record 10-step technical trace"]
        B1 --> B2 --> B3
    end

    subgraph Output["Staged Self Dashboard Run"]
        OUT["output:research_self_dashboard.v1<br/>Feeds synthesizer: research.technical_verifier"]
    end

    R_DIG --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| B1
    B3 --> OUT
```

---

## Page 10 of 10 — `research.technical_verifier`: Independent Technical Verifier Agent (8-Gate Classical & Governance Audit)

| Field | Value |
|---|---|
| **Technique ID / Title** | `research.technical_verifier` — Independent Technical Verifier Agent (8-gate classical & governance audit) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | Same 35 chart sources as `research.self_dashboard_qa` + `findings_in` from the 10-step technical trace |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'health_body', 'education_learning', 'spirituality_moksha']`, `houses: [1, 4, 5, 9, 10, 12]`, `vargas: ['D1', 'D9', 'D10', 'D20', 'D24']` |
| **Reader Pieces** | `reader:house/house_card` · `reader:planet/planet_card` · `reader:yoga/yoga_row` · `reader:point/point_row` · `reader:star/star_profile` · `reader:activation/activation_row` · `reader:annual/annual_row` · `reader:transit/transit_row` · `reader:findings/findings_in` |
| **Agent Piece** | `agent:research.technical_verifier` (`verifySelfDashboardRun`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:research_verifier_audit.v1` |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/research/selfDashboardQa.ts verifySelfDashboardRun` (`docs/admin/09 §4.1.4; SOUL.md; BPHS`) |

```mermaid
flowchart LR
    subgraph AuditInputs["Staged Digest + Self Dashboard Run (findings_in)"]
        IN_RUN["output:research_self_dashboard.v1<br/>(board_data, house_varga_matrix, temporal_data, trace_data, reading_prose)"]
        IN_DIG["research_digests + research_activations"]
    end

    subgraph Verifier["8-Gate Independent Classical & Governance Audit (agent:research.technical_verifier)"]
        G1["Gates 1-4: D1 Lordship Integrity, 10-Varga Agreement,<br/>7-Family Dasha Convergence, SAV & Shadbala Bounds"]
        G2["Gates 5-8: Yoga/Avastha/Jupiter Protection Floor, Nakshatra & Tara/Chandra Bala,<br/>Nov-New Year Chronology, and SOUL.md Rule 0 & Playbook Compliance"]
        G1 --> G2
    end

    subgraph Output["Verifier Audit Receipt"]
        OUT["output:research_verifier_audit.v1<br/>0-100% accuracy score + pass/warn/fail verdict"]
    end

    IN_RUN & IN_DIG --> G1
    G2 --> OUT
```
