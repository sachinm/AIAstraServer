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

---

## Page 11 of 12 — `self.character_arc`: Character Evolution Across Three Decades (Last 10 Years · Now · Next 10 Years)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.character_arc` — Character evolution across three decades (Last 10 Years · Now · Next 10 Years) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:{facts,dignities,aspects,avasthas}`, `divisional:D9`, `jaimini:{charakaraka,arudhas}`, `dasha:{vimshottari,narayana}` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'spirituality_moksha', 'health_body']`, `houses: [1, 4, 5, 9, 10, 12]`, `vargas: ['D1', 'D9']` |
| **Reader Pieces** | `reader:house/house_card` (`D1,D9_h1,4,5,9,10,12`) · `reader:planet/planet_card` · `reader:point/point_row` · `reader:activation/activation_row` |
| **Agent Piece** | `agent:area.self_board` (`buildSelfCharacterArc`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:self_character_arc.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/selfCharacterAndJoy.ts buildSelfCharacterArc` (`BPHS Ch. 12, 45–51; Jaimini Upadesa Sutras; Sanjay Rath Crux of Vedic Astrology; docs/reading-engine/45 §3.3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest + Activation Slicers (Freshness: dasha, Scope: kundli)"]
        P_HC["reader:house/house_card<br/>(D1,D9_h1,4,5,9,10,12)"]
        P_PC["reader:planet/planet_card<br/>(Lagna lord, AK, Sun, Moon & decade MD/AD lords)"]
        P_ACT["reader:activation/activation_row<br/>(Vimshottari & Narayana periods from -10y to +10y)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph ArcBuilder["3-Decade Character Evolution Builder (buildSelfCharacterArc)"]
        A1["1. Past 10 Years (asOf - 10y .. asOf): dominant Vimshottari MD/AD & Narayana Rasi period<br/>+ lord's D1/D9 house, dignity, and avastha"]
        A2["2. Who You Are Now (asOf): Lagna (D1.h1), Paka Lagna (L1 house), Atmakaraka (AK),<br/>and active MD/AD lord in D1 & D9"]
        A3["3. Next 10 Years (asOf .. asOf + 10y): upcoming/continuing Vimshottari MD/AD & Narayana period<br/>+ D9 Navamsa dharma maturation"]
        A1 --> A2 --> A3
    end

    subgraph Output["You Board 3-Decade Character Arc"]
        OUT["output:self_character_arc.v1<br/>Past 10y · Now · Next 10y plain-English character cards with digest evidence"]
    end

    P_HC & P_PC & P_ACT --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| A1
    A3 --> OUT
```

---

## Page 12 of 12 — `self.personality_joy`: Purely Vedic Personality & What Brings You Joy (Chandra · Budha · 4th/5th Bhava)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.personality_joy` — Purely Vedic personality & what brings you joy (Chandra · Budha · 4th/5th Bhava) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:{facts,dignities,aspects,avasthas}`, `nakshatra:{janma,cusp_nak}`, `divisional:{D9,D24}`, `ashtakavarga:sav` |
| **Selectors** | `boards: ['you']`, `subjects: ['general_life_direction', 'education_learning', 'health_body']`, `houses: [1, 3, 4, 5]`, `vargas: ['D1', 'D9', 'D24']` |
| **Reader Pieces** | `reader:planet/planet_card` (`Mo & Me in D1, D9, D24`) · `reader:house/house_card` (`D1_h1,3,4,5`) · `reader:star/star_profile` (`Janma star & cusp stars`) |
| **Agent Piece** | `agent:area.self_board` (`buildSelfPersonalityAndJoy`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:self_personality_joy.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (valid until digest version or contract changes) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/selfCharacterAndJoy.ts buildSelfPersonalityAndJoy` (`BPHS Ch. 3, 15, 16; Phaladeepika Ch. 2, 8; Lunar Astro Moon-Mercury synthesis; docs/reading-engine/45 §3.3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest Slicers (Freshness: natal, Scope: kundli)"]
        P_PC["reader:planet/planet_card<br/>(Moon & Mercury in D1, D9, D24)"]
        P_HC["reader:house/house_card<br/>(D1_h1,3,4,5 + SAV bindus)"]
        P_ST["reader:star/star_profile<br/>(Janma Nakshatra & 4th/5th cusp stars)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [open]<br/>scope: kundli"}
    end

    subgraph JoyBuilder["Vedic Chandra-Budha Personality & Joy Builder (buildSelfPersonalityAndJoy)"]
        J1["1. Read Chandra (Moon: Manas, emotional temperament, Janma star, D9 Moon, 4th house Sukha Bhava)"]
        J2["2. Read Budha (Mercury: Buddhi, curiosity, wit, play, D9/D24 Mercury, 5th house creative joy, 3rd house craft)"]
        J3["3. Synthesize personality summary, 4 concrete joy activities, and personal recharge rule"]
        J1 --> J2 --> J3
    end

    subgraph Output["You Board Personality & Joy Profile"]
        OUT["output:self_personality_joy.v1<br/>Plain-English personality & joy items with Vedic Moon/Mercury evidence"]
    end

    P_PC & P_HC & P_ST --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| J1
    J3 --> OUT
```

---

---

---

---

---

---

---

<!-- self.reading pages: generated by scripts/write-self-reading-pages.ts -->

## Page 13 of 25 — `self.reading.diagnosis`: Who you are, in short (three sentences built from the other panels, shown first)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.diagnosis` — You reading: Who you are, in short (three sentences built from the other panels, shown first) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:panel claims` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:findings/findings_in` (claims of self.reading.lagna, struggle, yogas, chapters) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:board_diagnosis.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/diagnosis.ts diagnosisPanel, tensionSource (board.diagnosis, Self instance)` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:findings/findings_in<br/>claims of self.reading.lagna, struggle, yogas, chapters"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: dasha<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.diagnosis"]
        S1["1. Built last from the claims of self.reading.lagna, struggle, yogas and chapters; adds no fact"]
        S2["2. Sentence 1, direction and footing: the lagna panel lead and the lagna lord state"]
        S3["3. Sentence 2, the central tension: a struggle the reading clock is running now (it has a release date), else the first knot, else the first struggle"]
        S4["4. Sentence 3, where you stand now: the running chapter and sub-chapter with their dates"]
        S5["5. Every sentence cites its source claims as claim:<id>; a 'no' to it withholds them too; the confirm question asks about sentence 2"]
        S1 --> S2 --> S3 --> S4 --> S5
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_diagnosis.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S5 --> OUT
```

---

## Page 14 of 25 — `self.reading.clock`: the reading clock (preferred, applicable or default dasha system, and the confirming clocks)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.clock` — You reading: the reading clock (preferred, applicable or default dasha system, and the confirming clocks) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `dasha:dasha.applicable`, `dasha:all served systems` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:activation/activation_row` (systems present and their family (conditional = engine says applies)) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_clock.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/clock.ts resolveClock; service.ts getSelfReading` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:activation/activation_row<br/>systems present and their family (conditional = engine says applies)"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: dasha<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.clock"]
        S1["1. Read kundlis.preferred_dasha and the distinct systems with their family in kundli_activation"]
        S2["2. Use the preferred system when it has periods; else the first system of SELF_CLOCK_CONDITIONAL_ORDER that the engine marked applicable (family conditional); else vimsottari"]
        S3["3. Confirming clocks: SELF_CONFIRM_SYSTEMS minus the reading clock, kept only when periods exist"]
        S1 --> S2 --> S3
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_clock.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 15 of 25 — `self.reading.lagna`: Who you are (1st house, lagna lord, arudha lagna, rising star, Moon lagna, D9 lagna)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.lagna` — You reading: Who you are (1st house, lagna lord, arudha lagna, rising star, Moon lagna, D9 lagna) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:D1`, `divisional:D9`, `natal:dignities`, `natal:aspects`, `natal:avasthas`, `jaimini:arudhas`, `nakshatra:cusp star` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1],"vargas":["D1","D9"]}` |
| **Reader Pieces** | `reader:house/house_card` (D1 h1, the D1 house the Moon occupies, D9 h1) · `reader:planet/planet_card` (D1 and D9 cards of the lagna lord; D1 cards of planets aspecting h1 and of the Moon) · `reader:point/point_row` (D1 AL) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/lagna.ts lagnaPanel; slices.ts planetChain, houseFrame, pointOf` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:house/house_card<br/>D1 h1, the D1 house the Moon occupies, D9 h1"]
        I2["reader:planet/planet_card<br/>D1 and D9 cards of the lagna lord; D1 cards of planets aspecting h1 and of the Moon"]
        I3["reader:point/point_row<br/>D1 AL"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: natal<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.lagna"]
        S1["1. houseFrame D1 h1: sign, lord, occupants, graha and rasi drishti, SAV, cusp star"]
        S2["2. planetChain of the lagna lord: D1 house (where the self is lived), dignity and avastha ripeness (how it is held), conjunctions; D9 card"]
        S3["3. Claims: lord_house, lord_state, lord_company, on_self (occupants; graha drishti split into helped / pressed by the engine functional nature), star (cusp star lord), seen (AL house), moon_lagna (the D1 house the Moon occupies, read as a frame), inner (D9 h1 lord house)"]
        S4["4. A missing field drops its claim and records a gap; no default value is ever printed"]
        S1 --> S2 --> S3 --> S4
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S4 --> OUT
```

---

## Page 16 of 25 — `self.reading.mind`: Your mind (Moon, Mercury, 3rd, 4th and 5th houses)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.mind` — You reading: Your mind (Moon, Mercury, 3rd, 4th and 5th houses) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:D1`, `divisional:D9`, `natal:dignities`, `natal:yogas`, `nakshatra:Moon star`, `ashtakavarga:sav` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[3,4,5],"vargas":["D1","D9"]}` |
| **Reader Pieces** | `reader:planet/planet_card` (D1 and D9 cards of Mo, Me) · `reader:house/house_card` (D1 h3, h4, h5 and every D1 house (sav column)) · `reader:yoga/yoga_row` (cancellation rows naming Mo) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/mind.ts mindPanel` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:planet/planet_card<br/>D1 and D9 cards of Mo, Me"]
        I2["reader:house/house_card<br/>D1 h3, h4, h5 and every D1 house (sav column)"]
        I3["reader:yoga/yoga_row<br/>cancellation rows naming Mo"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: natal<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.mind"]
        S1["1. planetChain Mo: house, dignity (with a cancellation row lifting debility), conjunctions and aspects, star lord"]
        S2["2. planetChain Me (thinking): house and dignity"]
        S3["3. houseFrame D1 h3 (courage and effort), h4 (what peace depends on, SAV against the chart mean), h5 (intelligence): where each lord sits, occupants"]
        S1 --> S2 --> S3
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 17 of 25 — `self.reading.atma`: Your soul aim (atmakaraka, karakamsa, Sun, Jupiter, 9th and 12th houses)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.atma` — You reading: Your soul aim (atmakaraka, karakamsa, Sun, Jupiter, 9th and 12th houses) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `jaimini:charakaraka`, `divisional:D1`, `divisional:D9`, `natal:avasthas` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1,9,12],"vargas":["D1","D9"]}` |
| **Reader Pieces** | `reader:point/point_row` (D1 and D9 AK) · `reader:planet/planet_card` (D1 cards of the AK planet, Su and Ju; D9 cards in the karakamsa sign) · `reader:house/house_card` (D1 h9, h12) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/atma.ts atmaPanel` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:point/point_row<br/>D1 and D9 AK"]
        I2["reader:planet/planet_card<br/>D1 cards of the AK planet, Su and Ju; D9 cards in the karakamsa sign"]
        I3["reader:house/house_card<br/>D1 h9, h12"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: natal<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.atma"]
        S1["1. pointOf D1 AK: the karaka planet (PointRow.planet); planetChain of that planet: house, dignity, ripeness, shadbala rank"]
        S2["2. pointOf D9 AK: its sign is the karakamsa and its house is counted from the D9 lagna by the engine; D9 planets in that sign"]
        S3["3. The Sun when it is not the AK; planetChain Ju (judgement and faith); houseFrame D1 h9 (purpose) and h12 (letting go)"]
        S4["4. Withheld with a gap when the AK planet is not stored (digest built before 2026-11-07)"]
        S1 --> S2 --> S3 --> S4
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S4 --> OUT
```

---

## Page 18 of 25 — `self.reading.yogas`: Gifts and knots (yogas and doshas on the self)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.yogas` — You reading: Gifts and knots (yogas and doshas on the self) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:yogas`, `natal:doshas` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1,4,5,9],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:yoga/yoga_row` (D1 rows naming L1, Mo, Su, AK or houses 1,4,5,9) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/yogas.ts yogasPanel; slices.ts yogasTouching` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:yoga/yoga_row<br/>D1 rows naming L1, Mo, Su, AK or houses 1,4,5,9"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: natal<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.yogas"]
        S1["1. yogasTouching: present D1 yoga and dosha rows naming the lagna lord, Mo, Su or the AK planet, or houses 1, 4, 5, 9; one row per name"]
        S2["2. Gift or knot from the engine class (raja, dhana, viparita, cancellation are gifts; dosha and affliction are knots); gifts first; a manglik row only when it touches house 1"]
        S1 --> S2
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S2 --> OUT
```

---

## Page 19 of 25 — `self.reading.struggle`: What you struggle with (afflictions on the self with release dates from the reading clock)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.struggle` — You reading: What you struggle with (afflictions on the self with release dates from the reading clock) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:D1`, `natal:dignities`, `natal:avasthas`, `natal:benefic_malefic`, `natal:house_counts`, `dasha:reading clock L1-L3` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1,4,5],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:planet/planet_card` (D1 cards of L1, Mo, Su, AK and the malefics named) · `reader:house/house_card` (D1 h1, h4, h5 (class column)) · `reader:activation/activation_row` (reading clock levels 1-3 covering today) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/struggle.ts strugglePanel; slices.ts runningChain` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:planet/planet_card<br/>D1 cards of L1, Mo, Su, AK and the malefics named"]
        I2["reader:house/house_card<br/>D1 h1, h4, h5 (class column)"]
        I3["reader:activation/activation_row<br/>reading clock levels 1-3 covering today"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: dasha<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.struggle"]
        S1["1. Lagna lord in a house the engine classes dusthana"]
        S2["2. Lagna lord, Mo, Su or AK debilitated (a cancellation row noted) or with avastha ripeness unripe or dried seed"]
        S3["3. A natural and functional malefic on or aspecting h1, with or aspecting the Moon, or in h5; the h4 lord in a dusthana"]
        S4["4. Release: when the named planet is a running lord of the reading clock, the end date of that stored period; those come first; at most 6 claims"]
        S1 --> S2 --> S3 --> S4
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S4 --> OUT
```

---

## Page 20 of 25 — `self.reading.chapters`: Your chapters (previous, running and next main period of the reading clock, the running sub-period, confirmed by other clocks)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.chapters` — You reading: Your chapters (previous, running and next main period of the reading clock, the running sub-period, confirmed by other clocks) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `dasha:reading clock L1-L2`, `dasha:vimshottari`, `dasha:narayana`, `dasha:chara`, `dasha:yogini`, `dasha:karaka`, `dasha:tithi_ashtottari`, `natal:avasthas dasha_charter` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:activation/activation_row` (reading clock levels 1-2 and confirming clocks level 1, life span) · `reader:planet/planet_card` (D1 cards of the chapter lords) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/chapters.ts chaptersPanel, confirmShift; slices.ts mdSpine, mainStarts` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:activation/activation_row<br/>reading clock levels 1-2 and confirming clocks level 1, life span"]
        I2["reader:planet/planet_card<br/>D1 cards of the chapter lords"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: dasha<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.chapters"]
        S1["1. mdSpine of the reading clock: previous, running, next level-1 periods; the running and next level-2 periods"]
        S2["2. Words from the houses kundli_activation says each period activates, and the lord D1 card (faculty, house)"]
        S3["3. Sub-chapter flavour: the engine fruition class of the sub lord from the main lord (dasha_charter), with its 2/12 and 6/8 flags"]
        S4["4. Confirmation: a confirming clock agrees when one of its level-1 periods starts within SELF_CHAPTER_BOUNDARY_MONTHS of the chapter start; confirmed at SELF_CHAPTER_CONFIRM_MIN, likely at 1, split at 0 (sentence withheld, dates kept)"]
        S1 --> S2 --> S3 --> S4
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S4 --> OUT
```

---

## Page 21 of 25 — `self.reading.body`: Your body (what the chart and the sky put on the body; facts only)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.body` — You reading: Your body (what the chart and the sky put on the body; facts only) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:D1`, `divisional:D30`, `natal:dignities`, `natal:benefic_malefic`, `dasha:reading clock L1-L2`, `transit:sky overlay when stored` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1,6,8],"vargas":["D1","D30"]}` |
| **Reader Pieces** | `reader:house/house_card` (D1 h1, h6, h8; D30 h1) · `reader:planet/planet_card` (D1 cards of L1, Su and malefics on h1) · `reader:activation/activation_row` (reading clock L1-L2 running) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/body.ts bodyPanel` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:house/house_card<br/>D1 h1, h6, h8; D30 h1"]
        I2["reader:planet/planet_card<br/>D1 cards of L1, Su and malefics on h1"]
        I3["reader:activation/activation_row<br/>reading clock L1-L2 running"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: dasha<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.body"]
        S1["1. Footing: the lagna lord dignity and the Sun dignity (D1 cards)"]
        S2["2. Now: the reading clock running sub-period or main-period lord sitting in or activating houses 6 or 8, with its end date"]
        S3["3. Pressed: natural and functional malefics on or aspecting the 1st; wear: where the 6th lord sits"]
        S4["4. Shape: the planet on the D30 1st (occupant, else lord) to one of four shapes from BODY_WORDS (heat, dryness, heaviness, fluids), undated"]
        S5["5. Never an illness, organ, symptom, treatment or doctor; a sensitive passage keeps only the rest line; the stored sky is read when present, else a gap"]
        S1 --> S2 --> S3 --> S4 --> S5
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S5 --> OUT
```

---

## Page 22 of 25 — `self.reading.purview`: the whole-chart purview check (board.purview, Self instance)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.purview` — You reading: the whole-chart purview check (board.purview, Self instance) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:D1`, `divisional:D9`, `natal:yogas`, `dasha:reading clock`, `nakshatra:gandanta` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1],"vargas":["D1","D9"]}` |
| **Reader Pieces** | `reader:findings/findings_in` (claims of every Self panel) · `reader:planet/planet_card` (D1 and D9 cards of L1, Mo, Su, AK) · `reader:yoga/yoga_row` (cancellation rows) · `reader:activation/activation_row` (reading clock running) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:purview.v1` |
| **Date-Range Window Cache** | `freshness: 'question'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/purview.ts runPurview, applyPurview` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:findings/findings_in<br/>claims of every Self panel"]
        I2["reader:planet/planet_card<br/>D1 and D9 cards of L1, Mo, Su, AK"]
        I3["reader:yoga/yoga_row<br/>cancellation rows"]
        I4["reader:activation/activation_row<br/>reading clock running"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: question<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.purview"]
        S1["1. Runs over the full digest and the reading clock after the panels: lagna lord standing, cancellations, combustion and retrograde, functional nature by lagna, vargottama, gandanta, dasha applicability, MD-AD 6/8 and 2/12, the stored sky, the sensitive core"]
        S2["2. Each rule returns override, veto or annotate with its source and rows; a vetoed claim leaves the card and stays under Chart details"]
        S1 --> S2
    end
    subgraph Output["Board reading panel"]
        OUT["output:purview.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 & I4 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S2 --> OUT
```

---

## Page 23 of 25 — `self.reading.audit`: the code auditor over the cards (board.auditor, code half)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.audit` — You reading: the code auditor over the cards (board.auditor, code half) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:dossier rows` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:findings/findings_in` (the cards and claims of the build) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:code_audit.v1` |
| **Date-Range Window Cache** | `freshness: 'question'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/audit.ts auditCards` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:findings/findings_in<br/>the cards and claims of the build"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: question<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.audit"]
        S1["1. Every card line: at most 22 words, a range, claim ids that exist and were not vetoed, evidence keys that resolve to stored rows"]
        S2["2. Every date in a line equals a stored period boundary of the activation calendar or the year chart; no banned chart, body, lifetime or doom word"]
        S3["3. A failing line leaves the card; the verdict is fail when any line failed; the result is stored in the dossier"]
        S1 --> S2 --> S3
    end
    subgraph Output["Board reading panel"]
        OUT["output:code_audit.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 24 of 25 — `self.reading.year`: This year (Tithi Pravesha and Varsha charts on the self)

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.year` — You reading: This year (Tithi Pravesha and Varsha charts on the self) |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `annual:tithi_pravesha`, `annual:varsha`, `annual:mudda` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"],"houses":[1],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:annual/annual_row` (TP and VP D1 of the running year) |
| **Agent Piece** | `agent:self.reading_panel` (`system: none`) |
| **Output Piece** | `output:self_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'annual'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/year.ts yearPanel, runningMudda` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:annual/annual_row<br/>TP and VP D1 of the running year"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: annual<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.year"]
        S1["1. The VP D1 row whose Mudda periods cover today picks the year"]
        S2["2. TP D1 row of that year: the house holding the natal lagna lord and its dignity there, its company; the year h1 lord house"]
        S3["3. The running Mudda lord as the short clock of the year; withheld when no year row covers today"]
        S1 --> S2 --> S3
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 25 of 25 — `self.reading.oracle`: AI family sub-agents, Self Lineman, and Self Oracle synthesis

| Field | Value |
|---|---|
| **Technique ID / Title** | `self.reading.oracle` — You reading: AI family sub-agents, Self Lineman, and Self Oracle synthesis |
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:panel claims`, `divisional:D1`, `divisional:D9`, `divisional:D10`, `divisional:D30`, `dasha:reading clock`, `annual:tithi_pravesha`, `transit:sky overlay` |
| **Selectors** | `{"boards":["you"],"subjects":["general_life_direction"]}` |
| **Reader Pieces** | `reader:house/house_card` (D1 and divisional house cards 1..12) · `reader:planet/planet_card` (D1 and divisional planet cards with avasthas and dasha_charter) · `reader:yoga/yoga_row` (D1 yogas, doshas, and cancellations) · `reader:point/point_row` (D1/D9 chara karakas, arudha padas, and Lunar Astro points) · `reader:star/star_profile` (Moon star, lagna star, gandanta, and pending karma houses) · `reader:annual/annual_row` (running Tithi Pravesha and Varsha annual charts) · `reader:activation/activation_row` (reading clock L1-L3 and confirming clocks L1) |
| **Agent Piece** | `agent:self.reading_oracle`, `agent:family.rasi`, `agent:family.varga`, `agent:family.dasha`, `agent:family.year`, `agent:family.sky`, `agent:lineman.self` (`system: src/reading/prompts/oracle/self.md`) |
| **Output Piece** | `output:self_reading.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/oracle.ts runSelfOracle, runFamilySubAgents, runSelfLineman` (docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas); docs/reading-engine/63 §4.1) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:house/house_card<br/>D1 and divisional house cards 1..12"]
        I2["reader:planet/planet_card<br/>D1 and divisional planet cards with avasthas and dasha_charter"]
        I3["reader:yoga/yoga_row<br/>D1 yogas, doshas, and cancellations"]
        I4["reader:point/point_row<br/>D1/D9 chara karakas, arudha padas, and Lunar Astro points"]
        I5["reader:star/star_profile<br/>Moon star, lagna star, gandanta, and pending karma houses"]
        I6["reader:annual/annual_row<br/>running Tithi Pravesha and Varsha annual charts"]
        I7["reader:activation/activation_row<br/>reading clock L1-L3 and confirming clocks L1"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: dasha<br/>key includes the reading clock"}
    end
    subgraph Steps["self.reading.oracle"]
        S1["1. Slices the stored kundli_digest, kundli_activation, and stored sky overlay into five structured chart family packs (family.rasi D1, family.varga D2-D60, family.dasha reading clock & 9x9 fruition charter, family.year Tithi Pravesha/Varsha, and family.sky slow transits)"]
        S2["2. Runs the five family AI sub-agents with Gemini cachedContents prefix caching (immutable chart pack in parts[0], dynamic horizon suffix in parts[1]) and cross-Lambda reading_findings_cache persistence to extract afflictions, malefics, graces, varga agreements, and what helps, delays, or delivers the running Mahadasha promise and when"]
        S3["3. Compiles the family sub-agent findings, the nine deterministic Self panel claims, the whole-chart purview rules, and the confirmed self.confirm.* facts through the Self Lineman AI agent (lineman.self) into a unified brief"]
        S4["4. Synthesizes the personalized You reading through the Self Oracle prompt (oracle/self.md), stores the output in technique_outputs, and validates every cited evidence key against the stored chart keys under the $1.00 spend guard"]
        S1 --> S2 --> S3 --> S4
    end
    subgraph Output["Board reading panel"]
        OUT["output:self_reading.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 & I4 & I5 & I6 & I7 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S4 --> OUT
```

---

# Self board v2 (docs/reading-engine/66 §4.8): sub-techniques and area selections

---

## Page 26 of 47 — `self.sub.clock`: Self v2 S1: the primary dasha clock and its confirming clocks

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `dasha:dasha.applicable`, `dasha:all served systems` |
| **Inputs** | `activation/activation_row` (systems present and their family; dasha.applicable) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.clock_resolution` |
| **Code** | `src/reading/self/sub/clock.ts subClock; src/reading/self/clock.ts resolveClock` |

1. Read kundlis.preferred_dasha and the systems present in kundli_activation with their family (defaultSystemsPresent: a conditional system the engine does not mark applicable comes back as family other)
2. resolveClock: the preferred system when it has periods, else the first SELF_CLOCK_CONDITIONAL_ORDER system of family conditional (reason conditional_applies), else vimsottari (default)
3. confirming = SELF_CONFIRM_SYSTEMS present, minus the primary; applicable = every present system whose family is not other; notApplicable = the rest, reason not_marked_applicable_by_engine

---

## Page 27 of 47 — `self.sub.periods`: Self v2 S2: previous, running and next main period, running sub and sub-sub, charter relation, boundaries

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `dasha:primary clock L1-L3`, `natal:dasha charter` |
| **Inputs** | `activation/activation_row` (primary clock L1-L2 over the life, L3 asOf ±12 months) · `planet/planet_card` (D1 card of the main lord (dasha_charter)) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.period_frame` |
| **Code** | `src/reading/self/sub/periods.ts subPeriods, charterRelation; slices.ts mdSpine, runningChain` |

1. mdSpine and runningChain over the stored activation rows of the primary clock at asOf: previous, running and next level-1 period, the running level-2 and level-3 period
2. subRelation: the main lord D1 card dashaCharter.fruition[sub lord] as the engine stored it: 6/8 when isShadAshtaka68, 2/12 when isDwirdwadasha212, else its fruitionClass; null and a gap when not stored (rasi clocks have none)
3. boundaries: the from/to of the three main periods, of every sub period of the running main period and of the running sub-sub period, de-duplicated, sorted
4. No running level-1 period: the frame is null and a gap is recorded

---

## Page 28 of 47 — `self.sub.windows`: Self v2 S3: dated windows around today (degraded: activation and the stored sky overlay until kundli_pressure lands)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `dasha:primary clock L1-L3`, `transit:stored sky overlay`, `natal:functional nature` |
| **Inputs** | `activation/activation_row` (primary clock L1-L3 asOf ±36 months) · `transit/transit_row` (stored sky overlay covering asOf) · `planet/planet_card` (D1 functional nature of period lords) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.window_set` |
| **Code** | `src/reading/self/sub/windows.ts subWindows, windowRows` |

1. Rows: every primary-clock activation row overlapping asOf ±36 months (matters from its stored houses through SELF.matters) and the sky overlay ingresses of SELF_V2_WINDOW_TRANSIT_PLANETS (house_from_lagna, house_from_moon as stored), Sade Sati and dhaiya spans
2. Polarity: the period lord D1 card functional label through FUNCTIONAL_POLARITY (malefic presses, benefic supports, neutral mixed); transits and sign periods mixed; strength 2 for every row (the engine stores no grade); degraded true with gaps
3. strip = rows overlapping asOf ±6 months; heaviestNow = the live pressing row by strength then soonest end; easesAt = its end when stored; nextSupportFrom = the first supporting row starting after asOf
4. startedLast12m = rows that started in the last 12 months; endingNext6m = rows ending in the next 6 months; byMatter groups the strip; since/until only where the stored row has them

---

## Page 29 of 47 — `self.sub.promise`: Self v2 S4: the promise ledger (gifts, knots, graces) from stored yoga and dosha rows and the charter flags

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:yogas`, `natal:doshas`, `natal:dasha charter` |
| **Inputs** | `yoga/yoga_row` (D1 yogas and doshas with class and details) · `planet/planet_card` (D1 cards (house, owns, dasha_charter yogi flags)) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.promise_ledger` |
| **Code** | `src/reading/self/sub/promise.ts subPromise; src/reading/self/v2words.ts PROMISE_KIND_BY_CLASS, SELF_MATTERS, SELF_PEOPLE` |

1. Each D1 yoga/dosha row (varga rows left out): kind from its stored class through PROMISE_KIND_BY_CLASS (cancellation grace; dosha, affliction knot; raja, mahapurusha, dhana, viparita gift); rows with no such class are left out with a gap
2. Duplicates by name and kind are dropped; matter = SELF.matters of the first stored house, who = SELF.people of every stored house; evidence = the yoga key and its planets
3. A knot whose stored dosha details say hasExceptions adds a grace that cancels it
4. A planet whose D1 dashaCharter isYogi adds a gift, isAvayogi a knot, on the matter of its stored house; strength 2 (the engine stores no grade) with a gap

---

## Page 30 of 47 — `self.sub.risk`: Self v2 S5: the risk ledger (what could go wrong, from where, from who, since, until, what holds it)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `dasha:primary clock`, `transit:stored sky overlay`, `natal:yogas` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.periods, self.sub.windows, self.sub.promise in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.risk_ledger` |
| **Code** | `src/reading/self/sub/risk.ts subRisk; src/reading/self/v2words.ts RISK_WHAT` |

1. Join of S2, S3 and S4 only: every S3 row live at asOf whose polarity presses and that has a planet and stored houses
2. matter = its first matter; what = RISK_WHAT[planet]; from = planet, first stored house, window id and the yoga id of an S4 knot naming the same planet; who = SELF.people of its houses
3. since/until = the window dates where stored; holds = S4 graces naming the same planet or cancelling that knot
4. top3 = the three rows with the highest engine strength, then the soonest until

---

## Page 31 of 47 — `self.sub.mind_facts`: Self v2 S6: mind facts (feeling, thinking, peace, judgement, candidate patterns), evidence keys only

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:D1`, `divisional:D9`, `natal:yogas`, `nakshatra:star profile` |
| **Inputs** | `planet/planet_card` (D1/D9 Moon, Mercury, Jupiter, Rahu, Saturn, Ketu, 4th and 5th lords) · `house/house_card` (D1 h4, h5) · `yoga/yoga_row` (D1 yogas naming the Moon) · `star/star_profile` (star profile) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.mind_facts` |
| **Code** | `src/reading/self/sub/mind.ts subMindFacts` |

1. feeling: Moon D1 and D9 cards, the star profile, D1 yoga rows naming the Moon; thinking: Mercury D1 and D9, the 5th; peace: the 4th and its lord card; judgement: the 5th lord card and Jupiter
2. candidatePatterns: the stored D1 house of each SELF_V2_MIND_PATTERN_PLANETS planet, and every planet in the Moon card aspectedBy
3. A missing card or house is a gap, never a default; the Oracle names the pattern

---

## Page 32 of 47 — `self.sub.body_facts`: Self v2 S7: body facts (footing, wear, shape, live lords on body houses, live transits over lagna and Moon)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:D1`, `divisional:D30`, `jaimini:A6`, `dasha:primary clock`, `transit:stored sky overlay` |
| **Inputs** | `house/house_card` (D1 h1, h6, h8; D30 h1) · `planet/planet_card` (D1 lagna lord, Su, Mo, Ma, Sa) · `point/point_row` (D1 A6) · `findings/findings_in` (outputs of self.sub.windows in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.body_facts` |
| **Code** | `src/reading/self/sub/body.ts subBodyFacts` |

1. footing: h1, lagna lord, Sun; wear: h6, h8, Mars, Saturn, A6; shape: D30 h1, Moon (evidence keys; a missing row is a gap)
2. liveLords: the running L1-L3 periods of the primary clock whose stored activation houses include SELF_V2_BODY_HOUSES
3. liveTransits: S3 live overlay rows of SELF_V2_BODY_TRANSIT_PLANETS with stored house_from_lagna or house_from_moon 1, and Sade Sati
4. sensitive: the engine flag only; none is stored, so false with a gap

---

## Page 33 of 47 — `self.sub.presence_facts`: Self v2 S8: presence facts (bearing, style, adornment, face, public vs private, best window, live care)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `divisional:D1`, `divisional:D9`, `jaimini:AL`, `dasha:primary clock` |
| **Inputs** | `house/house_card` (D1 h1, h2, h4) · `planet/planet_card` (D1/D9 Venus, lagna lord, Moon) · `point/point_row` (D1 AL) · `activation/activation_row` (primary clock L1-L2) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.presence_facts` |
| **Code** | `src/reading/self/sub/presence.ts subPresenceFacts` |

1. bearing: h1 and the lagna lord; style: planets the h1 card lists as occupants and graha drishti; adornment: Venus D1 and D9; face: h2; publicVsPrivate: AL, Moon, h4
2. bestWindow: the most recent completed L1 or L2 period of the primary clock whose lord is in SELF_V2_PRESENCE_PLANETS or is the lagna lord
3. liveCare: the running sub period when its lord is one of them

---

## Page 34 of 47 — `self.sub.year`: Self v2 S9: the year frame from the stored annual row covering today

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `annual:Varshaphal mudda` |
| **Inputs** | `annual/annual_row` (VP D1 rows with mudda periods) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.year_frame` |
| **Code** | `src/reading/self/sub/year.ts subYear; panels/year.ts runningMudda` |

1. runningMudda: the stored VP D1 annual row whose mudda periods cover asOf; its span is the year, the running mudda period the short clock
2. yearLagna and yearLord are evidence keys only when the row stores them, else null with a gap
3. No stored row covers asOf: noCoverage true, nothing taken from another year

---

## Page 35 of 47 — `self.sub.profile`: Self v2 S10: the person profile pack (age band, stated gender, role, facts, declined, confirms, mood)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:none (person facts)` |
| **Inputs** | `text/text_in` (auth and person_facts of the user) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.profile_pack` |
| **Code** | `src/reading/self/sub/profile.ts subProfile; src/reading/person/profile.ts loadProfilePack` |

1. loadProfilePack: auth (birth date, gender, role) and person_facts in two reads
2. Age is calendar arithmetic over the typed birth date, banded by SELF_AGE_BANDS; gender null when not stated; declined keys listed; the last five confirm answers; the mood of today only; a stable hash

---

## Page 36 of 47 — `self.v2.now`: Self v2 area: Right now (hero) (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/now.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): heaviest live window, eases date, next support, six-month strip (non-mixed rows), running sub-sub period, the ledger top3
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon six_months_each_way; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.now

---

## Page 37 of 47 — `self.v2.stuck`: Self v2 area: Where you get stuck (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/stuck.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): heaviest live window, pressing windows started in the last 12 months still running, every live ledger row, standing knots, mind candidate patterns
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon live_plus_standing; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.stuck

---

## Page 38 of 47 — `self.v2.chapter`: Self v2 area: This chapter (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/chapter.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): running sub period, its charter relation to the main lord, non-mixed strip windows inside it, the live ledger rows
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon sub_period; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.chapter

---

## Page 39 of 47 — `self.v2.diagnosis`: Self v2 area: In short (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/diagnosis.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): bearing keys, the ledger top row, running main and sub period
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon sub_period; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.diagnosis

---

## Page 40 of 47 — `self.v2.lagna`: Self v2 area: Who you are (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/lagna.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): bearing and public/private keys, promise entries on self_and_body
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.lagna

---

## Page 41 of 47 — `self.v2.mind`: Self v2 area: How you think (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/mind.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): feeling, thinking, peace and judgement keys, candidate patterns, promise entries and ledger rows on ideas and home
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always_plus_live; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.mind

---

## Page 42 of 47 — `self.v2.body`: Self v2 area: Body & energy (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/body.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): footing, wear and shape keys, live lords on body houses, live transits, ledger rows on body, work load and the sudden
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon live_plus_standing; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.body

---

## Page 43 of 47 — `self.v2.drive`: Self v2 area: Drive & ambition (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/drive.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): promise entries, ledger rows and live non-mixed windows on effort, career, gains, money and ideas
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always_plus_live; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.drive

---

## Page 44 of 47 — `self.v2.presence`: Self v2 area: How you come across (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/presence.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): bearing, style, adornment, face and public/private keys, the best past window, the live care line
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always_plus_live; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.presence

---

## Page 45 of 47 — `self.v2.yogas`: Self v2 area: Gifts & knots (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/yogas.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): every promise entry, gifts then knots then graces
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.yogas

---

## Page 46 of 47 — `self.v2.chapters`: Self v2 area: Chapters (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/chapters.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): previous, running and next main period, running sub period, L1/L2 boundaries inside the running main period
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon chapter; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.chapters

---

## Page 47 of 47 — `self.v2.year`: Self v2 area: This year (selection over the self.sub outputs into an AreaBrief)

| Field | Value |
|---|---|
| **Category / Board / Status** | `self` · `you` · `built` |
| **Charts Declared** | `natal:self.sub outputs` |
| **Inputs** | `findings/findings_in` (outputs of self.sub.* in the build context) |
| **Agent** | `self.reading_panel` (code, `system: 'none'`) |
| **Output** | `self_v2.area_brief` |
| **Code** | `src/reading/self/areas/year.ts; areas/index.ts buildAreaBriefs` |

1. Pure selection over ctx.sub (no database, no digest read): the year frame lagna, year lord and short clock; nothing when noCoverage
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon twelve_months; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.year
