# Volume 04 — Love Board (`love.*` / `love` Board) One-Per-Page Illustrations

> **Format**: One illustration per page (`Page 1 of 11` through `Page 11 of 11`), separated by `---`.  
> **Category / Board**: `love` · `love`  
> **Houses, Vargas & Karakas**: Houses `7, 5, 11, 2, 4, 8, 12` · Vargas `D9, D7, D30` (with `D1`) · Planets `Venus, Jupiter, Moon, 7th lord, D9 7th lord` · Points `UL, A7, DK, AL`  
> **Code References**: [`src/techniques/catalog.ts`](../../src/techniques/catalog.ts) · [`src/reading/area/houseLayers.ts`](../../src/reading/area/houseLayers.ts) · [`src/reading/area/love.ts`](../../src/reading/area/love.ts) · [`src/reading/area/boardService.ts`](../../src/reading/area/boardService.ts)

---

## Page 1 of 11 — `love.promise`: Natal Promise of House 7

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.promise` — Natal promise of house 7 |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `natal:{facts,house_counts,dignities,aspects,strength.bhava,yogas,doshas,avasthas}`, `jaimini:{argala,arudhas}`, `ashtakavarga:sav` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D9', 'D7', 'D30']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`: `D1,D9,D7,D30 houses 7,5,11,2,4,8,12`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: `D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord`) · `reader:point/point_row` (`piece.digest.point_cards`: `UL, A7, DK, AL`) · `reader:yoga/yoga_row` (`piece.digest.yoga_register`: yogas/doshas joining houses `7,5,11,2,4,8,12` or Love planets) |
| **Agent & Scorer Pieces** | `agent:area.love_board` (`piece.scorer.promise_layer`: `promiseLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (`open` window: `to = null`, valid until `digest_version` changes) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts promiseLayer; love.ts LOVE; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.2; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph DigestSlicers["Reusable Digest Slicers (Freshness: natal, Scope: kundli)"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>D1,D9,D7,D30 Houses 7,5,11,2,4,8,12"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>D1 & D9: Venus, Jupiter, Moon, 7th Lord, D9 7th Lord"]
        P_PT["piece.digest.point_cards<br/>(reader:point/point_row: UL, A7, DK, AL)"]
        P_YR["piece.digest.yoga_register<br/>(reader:yoga/yoga_row: Love Houses & Planets)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [Epoch 0, open)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Love Promise Scorer (piece.scorer.promise_layer — agent:area.love_board)"]
        S1["1. Read D1 house cards for houses 7, 5, 11, 2, 4, 8, 12:<br/>- Lord in own house or kendra/trikona: +2; exalted/own/moolatrikona: +2"]
        S2["2. Functional benefic occupant or graha drishti: +1 each;<br/>SAV >= 28: +1; supporting yogas on 7th/Venus/DK: +1..+2"]
        S3["3. Scale by lord's avastha (x0.5 mrita/sushupta, x1.25 jagrat/deepta);<br/>Venus/Jupiter/7th lord dignified in D1 (+1) or shadbala >= 1.2 (+1)"]
        S1 --> S2 --> S3
    end

    subgraph Output["Love Board Supports"]
        OUT["output:area_board.v1<br/>Plain-language bond supports with digest evidence keys"]
    end

    P_HC & P_PC & P_PT & P_YR --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 2 of 11 — `love.affliction`: Afflictions on House 7

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.affliction` — Afflictions on house 7 |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `natal:{facts,dignities,aspects,doshas,avasthas,house_counts}` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D9', 'D7', 'D30']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`) · `reader:planet/planet_card` (`piece.digest.planet_cards`) · `reader:yoga/yoga_row` (`piece.digest.yoga_register`: Kalathra dosha, Manglik dosha, cancellations) · `reader:activation/activation_row` (`piece.activation.calendar_slice`: running & next periods of afflicting planets on houses `7,5,11,2,4,8,12`) |
| **Agent & Scorer Pieces** | `agent:area.love_board` (`piece.scorer.affliction_layer`: `afflictionLayer`, `releaseOf`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`, fallback `30d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts afflictionLayer, releaseOf; love.ts LOVE; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.3; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest Slicers + Activation Slice (Freshness: dasha, Scope: kundli)"]
        P_DIG["piece.digest.house_cards + planet_cards + yoga_register<br/>(House 7, Venus, 7th Lord, Kalathra & Manglik Doshas)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>Running periods of afflicting planets on houses 7,5,11,2,4,8,12"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Love Affliction Scorer (piece.scorer.affliction_layer)"]
        A1["1. 7th/area lord in dusthana (2), uncancelled debility (2), combust (1, no release), or in war (1)"]
        A2["2. Saturn, Rahu, Ketu or Mars occupying house (1.5) or aspecting house / Venus / 7th lord (1)"]
        A3["3. Uncancelled Kalathra or Manglik doshas in yoga register"]
        A4["4. Compute Release Date (releaseOf): end date (to_date) of the afflicting planet's<br/>running period in kundli_activation (used by love.reconcile!)"]
        A1 --> A2 --> A3 --> A4
    end

    subgraph Output["Love Board Pressures & Release Dates"]
        OUT["output:area_board.v1<br/>Relationship pressures with exact release dates"]
    end

    P_DIG & P_ACT --> GATE
    GATE -->|"HIT (valid_from <= now < valid_to)"| OUT
    GATE -->|"MISS"| A1
    A4 --> OUT
```

---

## Page 3 of 11 — `love.protection`: What Protects House 7

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.protection` — What protects house 7 |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `natal:{aspects,dignities,yogas,avasthas}`, `jaimini:argala`, `divisional:{D9,D7,D30}` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D9', 'D7', 'D30']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`) · `reader:planet/planet_card` (`piece.digest.planet_cards`) · `reader:point/point_row` (`piece.digest.point_cards`: `UL, A7, DK, AL`) · `reader:yoga/yoga_row` (`piece.digest.yoga_register`) |
| **Agent & Scorer Pieces** | `agent:area.love_board` (`piece.scorer.protection_layer`: `protectionLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (`open` window: `to = null`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts protectionLayer; love.ts LOVE; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.3; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph DigestInputs["Reusable Digest Slicers (Freshness: natal, Scope: kundli)"]
        P_HC["piece.digest.house_cards (D1, D9, D7, D30 Houses 7,5,11,2,4,8,12)"]
        P_PC["piece.digest.planet_cards (D1 & D9: Venus, Jupiter, Moon, 7th Lord, D9 7th Lord)"]
        P_PT["piece.digest.point_cards (UL, A7, DK, AL)"]
        P_YR["piece.digest.yoga_register (Neecha Bhanga & Dosha Cancellations)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [Epoch 0, open)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Love Protection Scorer (piece.scorer.protection_layer)"]
        P1["1. Jupiter occupying or aspecting House 7, Venus, or Upapada Lagna (UL/DK/A7): +2"]
        P2["2. Unobstructed primary benefic argala on House 7 or UL: +1;<br/>7th lord's dispositor dignified in D1: +1"]
        P3["3. Yoga cancellation (Neecha Bhanga, Manglik cancellation) naming 7th lord or Venus: +2"]
        P4["4. Owning varga protection check: D9 7th house lord (D9.h7) dignified: +2"]
        P1 --> P2 --> P3 --> P4
    end

    subgraph Output["Love Board Protections"]
        OUT["output:area_board.v1<br/>Bond protections (also feeds love.reconcile)"]
    end

    P_HC & P_PC & P_PT & P_YR --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| P1
    P4 --> OUT
```

---

## Page 4 of 11 — `love.activation`: Activation of House 7 by Every Dasha System

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.activation` — Activation of house 7 by every dasha system |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `dasha:{vimshottari,conditional,narayana,chara,karaka,yogini,tithi_ashtottari}`, `annual:tithi_pravesha_dasha`, `divisional:{D9,D7,D30}` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D9', 'D7', 'D30']` |
| **Reader Pieces** | `reader:activation/activation_row` (`piece.activation.calendar_slice`: every served system from today to `+30y` activating houses `7,5,11,2,4,8,12`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: D1 and D9 cards of period lords) |
| **Agent & Voter Pieces** | `agent:area.love_board` (`piece.voter.five_family_clock`: `gradeRow`, `familyVotes`, `aheadWindows`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` (`[runningPeriod.from, runningPeriod.to)` from `kundli_activation`, fallback `30d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts gradeRow, familyVotes, aheadWindows; love.ts LOVE; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.4; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Activation Calendar Slice + Planet Cards (Freshness: dasha, Scope: kundli)"]
        P_ACT["piece.activation.calendar_slice<br/>(reader:activation/activation_row)<br/>All served systems (-13m to +30y) activating houses 7,5,11,2,4,8,12 (Levels 1-2)"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>D1 & D9 Cards of Period Lords"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: dasha [runningPeriod.from, runningPeriod.to)<br/>scope: kundli"}
    end

    subgraph Voter["Multi-System Love Dasha Voter (piece.voter.five_family_clock)"]
        V1["1. Grade each period lord (gradeRow): functional benefic +1 / malefic -1;<br/>dignity in D1 +-1 and D9 +-1; owns Love house (+1) vs dusthana (-1)"]
        V2["2. Five-family clock vote (familyVotes): Main, Conditional, Sign, Karaka,<br/>and Short Clocks (Yogini + Tithi Ashtottari agree)"]
        V3["3. Build Windows Ahead (aheadWindows): 36m sub-area windows (meet, health, reconcile)<br/>+ 30y main-clock turning points"]
        V1 --> V2 --> V3
    end

    subgraph Output["Love Board Activation & Windows"]
        OUT["output:area_board.v1<br/>Present clock votes & dated relationship windows"]
    end

    P_ACT & P_PC --> GATE
    GATE -->|"HIT (valid_from <= now < valid_to)"| OUT
    GATE -->|"MISS"| V1
    V3 --> OUT
```

---

## Page 5 of 11 — `love.transit`: Transits Over House 7

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.transit` — Transits over house 7 |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `transit:{transit_contacts,double_transit,sade_sati,eclipses}`, `ashtakavarga:transit_ashtakavarga` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D9', 'D7', 'D30']` |
| **Reader Pieces** | `reader:transit/transit_row` (`piece.transit.sky_overlay`: shared sky with overlay for Sa, Ju, Ra, Ke and eclipses over houses `7,5,11,2,4,8,12`, their lords and arudhas, `±24m`) · `reader:house/house_card` (`piece.digest.house_cards`) |
| **Agent Piece** | `agent:area.love_board` (`transitLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'transit'` (epoch-aligned `2h` window `TECHNIQUE_TRANSIT_WINDOW_HOURS=2`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts transitLayer; love.ts LOVE; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.5; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Sky Overlay Loader + House Cards (Freshness: transit = 2h, Scope: kundli)"]
        P_TR["piece.transit.sky_overlay<br/>(reader:transit/transit_row)<br/>Stored Sky Overlay covering today:<br/>Ju, Sa, Ra, Ke over Houses 7,5,11,2,4,8,12, Lords & UL"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>D1,D9,D7,D30 Houses 7,5,11,2,4,8,12"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate (2h Window)"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: transit [bucket_2h.from, bucket_2h.to)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Love Transit Layer (transitLayer — agent:area.love_board)"]
        T1["1. Read stored sky overlay covering today (never fetched live here)"]
        T2["2. Jupiter in Love houses (7, 5, 11, 2, 4) -> Support until ingress date<br/>Saturn, Rahu or Ketu in Love houses -> Pressure until ingress date"]
        T3["3. Cast 1 net vote (support / test / neutral) into Love board tone"]
        T1 --> T2 --> T3
    end

    subgraph Output["Love Board Transit Vote & Spans"]
        OUT["output:area_board.v1<br/>Dated transit supports/pressures + 1 tone vote"]
    end

    P_TR & P_HC --> GATE
    GATE -->|"HIT (inside 2h window)"| OUT
    GATE -->|"MISS"| T1
    T3 --> OUT
```

---

## Page 6 of 11 — `love.annual`: This Year's Chart for House 7

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.annual` — This year's chart for house 7 |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `annual:{tithi_pravesha,sahams,mudda,patyayini,tithi_pravesha_dasha}` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D9', 'D7', 'D30']` |
| **Reader Pieces** | `reader:annual/annual_row` (`piece.digest.annual_set`: TP and VP of current, previous and next year, houses `7,5,11,2,4,8,12`, their sahams and year dashas) |
| **Agent Piece** | `agent:area.love_board` (`currentYear`, `annualLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'annual'` (`[year.from, year.to)` of running Tithi Pravesha / Varsha chart, fallback `90d`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts currentYear, annualLayer; love.ts LOVE; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.6; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Annual Digest Slicer (Freshness: annual, Scope: kundli)"]
        P_ANN["piece.digest.annual_set<br/>(reader:annual/annual_row)<br/>TP & VP Year Charts covering today:<br/>Houses 7,5,11,2,4,8,12, Sahams (vivaha, preeti, santapa, paradara) & Year Dashas"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: annual [year.from, year.to)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Love Annual Scorer (currentYear + annualLayer)"]
        Y1["1. Pick year chart whose year dashas cover today (Tithi Pravesha before Varsha)"]
        Y2["2. Year lord of House 7 / Love houses in own house or kendra/trikona without debility -> Confirms;<br/>in dusthana -> Contradicts"]
        Y3["3. Marriage/love sahams in kendra -> Confirms (santapa & paradara sahams in kendra -> Contradict!)<br/>4. Emit 1 vote in Love board tone + 1 plain line under 'This year'"]
        Y1 --> Y2 --> Y3
    end

    subgraph Output["Love Board Annual Section"]
        OUT["output:area_board.v1<br/>'This year' summary line + 1 tone vote"]
    end

    P_ANN --> GATE
    GATE -->|"HIT (valid for entire TP/VP year!)"| OUT
    GATE -->|"MISS"| Y1
    Y3 --> OUT
```

---

## Page 7 of 11 — `love.varga`: Owning Divisional Chart of House 7

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.varga` — Owning divisional chart of house 7 |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `divisional:{D9,D7,D30}` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D9', 'D7', 'D30']` |
| **Reader Pieces** | `reader:house/house_card` (`piece.digest.house_cards`: `D1,D9,D7,D30 houses 7,5,11,2,4,8,12`) · `reader:planet/planet_card` (`piece.digest.planet_cards`) · `reader:point/point_row` (`piece.digest.point_cards`: arudhas of houses `7,5,11,2,4,8,12` in `D9, D7, D30`) |
| **Agent & Scorer Pieces** | `agent:area.love_board` (`piece.scorer.varga_agreement`: `vargaLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (`open` window: `to = null`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts vargaLayer; love.ts LOVE; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.7; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest House, Planet & Point Slicers (Freshness: natal, Scope: kundli)"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card)<br/>Owning Vargas (D9, D7, D30) for Primary Houses 7, 5, 11"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card)<br/>D1 Lords & Venus Placed in D9, D7, D30"]
        P_PT["piece.digest.point_cards<br/>(reader:point/point_row: Arudhas in D9, D7, D30)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [Epoch 0, open)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Varga Agreement Scorer (piece.scorer.varga_agreement — vargaLayer)"]
        V1["1. For primary houses 7, 5, 11 in owning vargas (D9 first, then D7, D30):<br/>- Natal D1 lord dignified in owning varga -> +1.5 support; debilitated -> 1.5 test"]
        V2["2. Varga house lord (e.g. D9.h7 lord) dignified or in kendra/trikona -> +1 support;<br/>in dusthana or debilitated -> 1 test"]
        V3["3. Planet occupying same house in D1 and D9 (vargottama placement) -> +1 support<br/>4. Net verdict (agrees / disagrees / neutral) joins Love board supports & pressures"]
        V1 --> V2 --> V3
    end

    subgraph Output["Love Board Varga Confirmation"]
        OUT["output:area_board.v1<br/>Navamsha (D9) & divisional agreement lines"]
    end

    P_HC & P_PC & P_PT --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| V1
    V3 --> OUT
```

---

## Page 8 of 11 — `love.nakshatra`: Nakshatra Charter of House 7

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.nakshatra` — Nakshatra charter of house 7 |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `nakshatra:{cusp_nak,star_lord,occupant_stars}` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D9', 'D7', 'D30']` |
| **Reader Pieces** | `reader:star/star_profile` (`piece.digest.star_profile`: Moon star, lagna star, tara table) · `reader:house/house_card` (`piece.digest.house_cards`: `cusp_star` column of houses `7,5,11`) · `reader:planet/planet_card` (`piece.digest.planet_cards`: D1 cards of cusp star lords & Venus/7th lord) |
| **Agent & Scorer Pieces** | `agent:area.love_board` (`piece.scorer.nakshatra_charter`: `nakshatraLayer`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:area_board.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` (`open` window: `to = null`) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/houseLayers.ts nakshatraLayer; love.ts LOVE; boardService.ts getAreaBoard` (`docs/reading-engine/46 §B.8; 53 §4.5; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["Digest Star, House & Planet Slicers (Freshness: natal, Scope: kundli)"]
        P_ST["piece.digest.star_profile<br/>(reader:star/star_profile: Moon Star, Lagna Star, Tara Table)"]
        P_HC["piece.digest.house_cards<br/>(reader:house/house_card: Cusp Stars of Houses 7, 5, 11)"]
        P_PC["piece.digest.planet_cards<br/>(reader:planet/planet_card: D1 Cards of Star Lords & Venus)"]
    end

    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"piece.cache.date_range_window<br/>validityWindow: natal [Epoch 0, open)<br/>scope: kundli"}
    end

    subgraph Scorer["Deterministic Nakshatra Charter Scorer (piece.scorer.nakshatra_charter)"]
        N1["1. Read cusp stars of primary houses 7, 5, 11 and star profile from digest"]
        N2["2. Primary house cusp star lord dignified or functional benefic in D1 -> +1 support;<br/>debilitated in D1 -> 1 pressure"]
        N3["3. Running period lord's star lord is the 7th lord or Venus<br/>-> Period delivers bond results through the star (+1.5 support)"]
        N1 --> N2 --> N3
    end

    subgraph Output["Love Board Nakshatra Supports"]
        OUT["output:area_board.v1<br/>Star-delivery supports & pressures"]
    end

    P_ST & P_HC & P_PC --> GATE
    GATE -->|"HIT (status: cached/skipped)"| OUT
    GATE -->|"MISS"| N1
    N3 --> OUT
```

---

## Page 9 of 11 — `love.meet`: Meeting Someone (`love.status` in `single, dating`)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.meet` — Meeting someone |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `natal:facts`, `divisional:D9`, `dasha:vimshottari`, `transit:transit_contacts` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11]`, `vargas: ['D9']`, `facts: { 'love.status': ['single', 'dating'] }` |
| **Reader Pieces** | `reader:findings/findings_in` (`"the eight Love layers of this kundli (love.promise … love.nakshatra)"`) |
| **Agent Piece** | `agent:area.love_board` (`LOVE_LEAD`, `LOVE_FIT`, `shapeBoard`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:board_subarea.v1` |
| **Date-Range Window Cache** | `freshness: 'question'` / `'transit'` (composes over the 8 cached `love.*` layers in < 1 ms) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/love.ts LOVE_LEAD, LOVE_FIT; boardService.ts shapeBoard` (`docs/reading-engine/53 §4.5; 46 §B.12; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["8 Cached Love Layers + Companion Memory (person_facts)"]
        LAYERS["reader:findings/findings_in<br/>(love.promise, love.activation, love.varga, love.transit...)"]
        FACT["person_facts: love.status in ['single', 'dating']"]
    end

    subgraph SubareaShaper["Sub-Area Selector & Shaper (LOVE_LEAD / LOVE_FIT — agent:area.love_board)"]
        M1["1. Check promise & activation of House 7 and UL for a new bond;<br/>Venus and 7th lord running or transited"]
        M2["2. Select windows from love.activation where house 7, 5 or 11 is activated<br/>with D9 agreeing (love.varga)"]
        M3["3. Lead the Love board with 'Meeting someone' when love.status is single or dating;<br/>hide incompatible sub-area windows"]
        M1 --> M2 --> M3
    end

    subgraph Output["Shaped Sub-Area View"]
        OUT["output:board_subarea.v1<br/>Leads Love board for single / dating users"]
    end

    LAYERS & FACT --> M1
    M3 --> OUT
```

---

## Page 10 of 11 — `love.health`: How the Relationship Is (`love.status` in `dating, committed, married`)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.health` — How the relationship is |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `natal:facts`, `divisional:D9`, `dasha:vimshottari`, `transit:transit_contacts` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11]`, `vargas: ['D9']`, `facts: { 'love.status': ['dating', 'committed', 'married'] }` |
| **Reader Pieces** | `reader:findings/findings_in` (`"the eight Love layers of this kundli (love.promise … love.nakshatra)"`) |
| **Agent Piece** | `agent:area.love_board` (`LOVE_LEAD`, `LOVE_FIT`, `shapeBoard`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:board_subarea.v1` |
| **Date-Range Window Cache** | Composes over the 8 cached `love.*` layers · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/love.ts LOVE_LEAD, LOVE_FIT; boardService.ts shapeBoard` (`docs/reading-engine/53 §4.5; 46 §B.12; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["8 Cached Love Layers + Companion Memory (person_facts)"]
        LAYERS["reader:findings/findings_in<br/>(love.activation, love.transit, love.annual, love.varga...)"]
        FACT["person_facts: love.status in ['dating', 'committed', 'married']"]
    end

    subgraph SubareaShaper["Sub-Area Selector & Shaper (LOVE_LEAD / LOVE_FIT — agent:area.love_board)"]
        H1["1. Read present state of House 7 and D9 h7:<br/>support and strain this month from activation, transit and annual layers"]
        H2["2. Compute relationship tone from the votes of the layers (doc 45 §7)"]
        H3["3. Lead the Love board with 'How the relationship is' when love.status<br/>is dating, committed, or married"]
        H1 --> H2 --> H3
    end

    subgraph Output["Shaped Sub-Area View"]
        OUT["output:board_subarea.v1<br/>Leads Love board for dating / committed / married users"]
    end

    LAYERS & FACT --> H1
    H3 --> OUT
```

---

## Page 11 of 11 — `love.reconcile`: Strain and Reconciling (`love.status` in `separated, complicated`)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reconcile` — Strain and reconciling |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `natal:facts`, `divisional:D9`, `dasha:vimshottari`, `transit:transit_contacts` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship']`, `houses: [7, 5, 11]`, `vargas: ['D9']`, `facts: { 'love.status': ['separated', 'complicated'] }` |
| **Reader Pieces** | `reader:findings/findings_in` (`"the eight Love layers of this kundli (love.promise … love.nakshatra)"`) |
| **Agent Piece** | `agent:area.love_board` (`LOVE_LEAD`, `LOVE_FIT`, `shapeBoard`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece** | `output:board_subarea.v1` |
| **Date-Range Window Cache** | Composes over the 8 cached `love.*` layers · `scope: 'kundli'` |
| **Code & Source** | `src/reading/area/love.ts LOVE_LEAD, LOVE_FIT; boardService.ts shapeBoard` (`docs/reading-engine/53 §4.5; 46 §B.12; 54 §3`) |

```mermaid
flowchart LR
    subgraph Inputs["8 Cached Love Layers + Companion Memory (person_facts)"]
        LAYERS["reader:findings/findings_in<br/>(love.affliction, love.activation, love.protection)"]
        FACT["person_facts: love.status in ['separated', 'complicated']"]
    end

    subgraph SubareaShaper["Sub-Area Selector & Shaper (LOVE_LEAD / LOVE_FIT — agent:area.love_board)"]
        R1["1. Read afflictions on House 7, its lord, Venus and UL<br/>along with their exact release dates (from love.affliction)"]
        R2["2. Find windows ahead where the afflicting planet stops running<br/>and a supporter of House 7 or 5 starts (from love.activation)"]
        R3["3. Highlight protections that hold the bond (from love.protection)<br/>and lead the Love board when love.status is separated or complicated"]
        R1 --> R2 --> R3
    end

    subgraph Output["Shaped Sub-Area View"]
        OUT["output:board_subarea.v1<br/>Leads Love board for separated / complicated users"]
    end

    LAYERS & FACT --> R1
    R3 --> OUT
```

---

## Page 12 of 12 — `research.love_dashboard_qa`: Research Love & Relationships Dashboard Deep-Dive & Nov/Thanksgiving/Dec/New Year Zoom-In

| Field | Value |
|---|---|
| **Technique ID / Title** | `research.love_dashboard_qa` — Research Love & Relationships Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year zoom-in |
| **Category / Board / Status** | `love` · `love` · `built` |
| **Charts Declared** | `natal:{facts,dignities,aspects,avasthas,yogas,doshas,strength.shadbala}`, `ashtakavarga:sav`, `jaimini:{charakaraka,arudhas}`, `nakshatra:{janma,cusp_nak}`, `divisional:{D1,D9,D7,D10,D2,D4,D12,D20,D24,D60}`, `dasha:{vimshottari,yogini,tithi_ashtottari,narayana,karaka}`, `annual:{tithi_pravesha,varsha}`, `transit:{transit_contacts,sade_sati}`, `panchang:muhurta` |
| **Selectors** | `boards: ['love']`, `subjects: ['marriage_relationship', 'children', 'family_home']`, `houses: [7, 5, 11, 2, 4, 8, 12]`, `vargas: ['D1', 'D9', 'D7']` |
| **Reader Pieces** | `reader:house/house_card` (`D1..D60_h1..12`) · `reader:planet/planet_card` · `reader:yoga/yoga_row` · `reader:point/point_row` · `reader:star/star_profile` · `reader:activation/activation_row` · `reader:annual/annual_row` · `reader:transit/transit_row` |
| **Agent Piece** | `agent:research.love_dashboard_builder` (`buildLoveResearchDashboard`, `verifyLoveDashboardQaReport`, `kind: 'code'`, `system: 'none'`) |
| **Output Piece / Synthesizer** | `output:research_love_dashboard.v1` · feeds `research.technical_verifier` |
| **Date-Range Window Cache** | `freshness: 'transit'` (`2h` window) · `scope: 'kundli'` |
| **Code & Source** | `src/reading/research/loveDashboardQa.ts buildLoveResearchDashboard, verifyLoveDashboardQaReport` (`docs/admin/09 §4.1; docs/reading-engine/46 §B; 54 §3; 55 §2`) |

```mermaid
flowchart LR
    subgraph StagingInputs["Isolated Research Staging & Digest Slicers (Freshness: transit = 2h)"]
        R_DIG["research_digests + research_activations<br/>(D1, D9, D7, UL, DK, A7, Vivaha/Preethi Sahams)"]
    end

    subgraph Builder["Research Love Dashboard Builder (agent:research.love_dashboard_builder)"]
        L1["1. Run production Love board (buildBoard LOVE, resolveAreaShades, buildCalmPlaybook)<br/>over 7H, 5H, 11H, 2H, 4H, 8H, 12H and D1/D9/D7"]
        L2["2. Synthesize Covenant & Partnership Charter + Nov/Thanksgiving/Dec/New Year relationship windows"]
        L3["3. Record 10-step reverse-engineered technical trace and run 8-gate technical verifier"]
        L1 --> L2 --> L3
    end

    subgraph Output["Staged Love Dashboard Run"]
        OUT["output:research_love_dashboard.v1<br/>Feeds synthesizer: research.technical_verifier"]
    end

    R_DIG --> L1
    L3 --> OUT
```

---

---

---

---

<!-- love.reading pages: generated by scripts/write-self-reading-pages.ts -->

## Page 13 of 20 — `love.reading.diagnosis`: Love reading: your love life, in short (three sentences from the Love panels and chapters)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reading.diagnosis` — Love reading: your love life, in short (three sentences from the Love panels and chapters) |
| **Category / Board / Status** | `love` · `love` · `planned` |
| **Charts Declared** | `natal:panel claims` |
| **Selectors** | `{"boards":["love"],"houses":[7],"vargas":["D1","D9"]}` |
| **Reader Pieces** | `reader:findings/findings_in` (claims of love.reading.heart, partner, bond, circle, chapters) |
| **Agent Piece** | none until the spend yes (`system: none`) |
| **Output Piece** | `output:board_diagnosis.v1` |
| **Date-Range Window Cache** | `freshness: 'question'` · `scope: 'kundli'` |
| **Code & Source** | `board.diagnosis (planned) with DIAGNOSIS_LOVE` (docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:findings/findings_in<br/>claims of love.reading.heart, partner, bond, circle, chapters"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: question<br/>key includes the reading clock"}
    end
    subgraph Steps["love.reading.diagnosis"]
        S1["1. Built last from the claims of the Love fact panels that fit love.status and of love.reading.chapters"]
        S2["2. How the person loves and what they draw; the central tension (strongest knot on 7, Ve, UL or DK, or the heaviest running affliction with its release); where love stands now, dated"]
        S1 --> S2
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_diagnosis.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S2 --> OUT
```

---

## Page 14 of 20 — `love.reading.chapters`: Love reading: your chapters for love (board.chapters filtered to the love houses)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reading.chapters` — Love reading: your chapters for love (board.chapters filtered to the love houses) |
| **Category / Board / Status** | `love` · `love` · `planned` |
| **Charts Declared** | `dasha:reading clock L1-L2`, `dasha:confirming clocks L1` |
| **Selectors** | `{"boards":["love"],"houses":[7,5,11,2,8,4,12],"vargas":["D1","D9"]}` |
| **Reader Pieces** | `reader:activation/activation_row` (reading clock L1-L2 and confirming clocks L1, houses 7,5,11,2,8,4,12) · `reader:planet/planet_card` (D1 cards of the chapter lords) |
| **Agent Piece** | none until the spend yes (`system: none`) |
| **Output Piece** | `output:board_chapters.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/chapters.ts as board.chapters (filter planned)` (docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:activation/activation_row<br/>reading clock L1-L2 and confirming clocks L1, houses 7,5,11,2,8,4,12"]
        I2["reader:planet/planet_card<br/>D1 cards of the chapter lords"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: dasha<br/>key includes the reading clock"}
    end
    subgraph Steps["love.reading.chapters"]
        S1["1. board.chapters with houses 7,5,11,2,8,4,12 and planets L7, Ve, DK, Ju, Mo"]
        S2["2. Per chapter: the love houses the lord activates; UL or A7 held by the chapter sign on a sign clock"]
        S1 --> S2
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_chapters.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S2 --> OUT
```

---

## Page 15 of 20 — `love.reading.heart`: Love reading: how you love (Venus, Moon, 5th lord, D9 7th)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reading.heart` — Love reading: how you love (Venus, Moon, 5th lord, D9 7th) |
| **Category / Board / Status** | `love` · `love` · `planned` |
| **Charts Declared** | `divisional:D1`, `divisional:D9` |
| **Selectors** | `{"boards":["love"],"houses":[5,7],"vargas":["D1","D9"]}` |
| **Reader Pieces** | `reader:planet/planet_card` (D1 and D9 cards of Ve, Mo, L5) · `reader:house/house_card` (D1 h5, h7; D9 h7) |
| **Agent Piece** | none until the spend yes (`system: none`) |
| **Output Piece** | `output:board_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` · `scope: 'kundli'` |
| **Code & Source** | `not built` (docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:planet/planet_card<br/>D1 and D9 cards of Ve, Mo, L5"]
        I2["reader:house/house_card<br/>D1 h5, h7; D9 h7"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: natal<br/>key includes the reading clock"}
    end
    subgraph Steps["love.reading.heart"]
        S1["1. planetChain Ve, Mo, L5 (D1 and D9)"]
        S2["2. houseFrame D1 h5, h7; D9 h7 and D9 Ve"]
        S3["3. Facts only: how the person loves, what they feel, romance and play, the inner shape of partnership"]
        S1 --> S2 --> S3
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 16 of 20 — `love.reading.partner`: Love reading: the partner you draw (7th, its lord, DK, UL, A7, D9 7th)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reading.partner` — Love reading: the partner you draw (7th, its lord, DK, UL, A7, D9 7th) |
| **Category / Board / Status** | `love` · `love` · `planned` |
| **Charts Declared** | `divisional:D1`, `divisional:D9`, `jaimini:charakaraka`, `jaimini:arudhas` |
| **Selectors** | `{"boards":["love"],"houses":[7],"vargas":["D1","D9"]}` |
| **Reader Pieces** | `reader:house/house_card` (D1 h7; D9 h7) · `reader:planet/planet_card` (D1 and D9 cards of L7, the DK planet, h7 occupants) · `reader:point/point_row` (DK, UL, A7, D9 lagna) |
| **Agent Piece** | none until the spend yes (`system: none`) |
| **Output Piece** | `output:board_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` · `scope: 'kundli'` |
| **Code & Source** | `not built` (docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:house/house_card<br/>D1 h7; D9 h7"]
        I2["reader:planet/planet_card<br/>D1 and D9 cards of L7, the DK planet, h7 occupants"]
        I3["reader:point/point_row<br/>DK, UL, A7, D9 lagna"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: natal<br/>key includes the reading clock"}
    end
    subgraph Steps["love.reading.partner"]
        S1["1. houseFrame D1 h7; planetChain L7 and the DK planet; D9 h7 and its lord; chains of h7 occupants and aspecting planets"]
        S2["2. Shown for single, dating, complicated; never a yes or no on marriage"]
        S1 --> S2
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S2 --> OUT
```

---

## Page 17 of 20 — `love.reading.bond`: Love reading: the bond itself (7th, 2nd, 4th, 8th, UL and its 2nd, D9, D7)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reading.bond` — Love reading: the bond itself (7th, 2nd, 4th, 8th, UL and its 2nd, D9, D7) |
| **Category / Board / Status** | `love` · `love` · `planned` |
| **Charts Declared** | `divisional:D1`, `divisional:D9`, `divisional:D7`, `jaimini:arudhas` |
| **Selectors** | `{"boards":["love"],"houses":[7,2,4,8],"vargas":["D1","D9","D7"]}` |
| **Reader Pieces** | `reader:house/house_card` (D1 h7,2,4,8; D9 h7,1; D7 h1) · `reader:planet/planet_card` (D1 cards of L7, L2, L8, Ju) · `reader:point/point_row` (UL, A7, DK) |
| **Agent Piece** | none until the spend yes (`system: none`) |
| **Output Piece** | `output:board_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` · `scope: 'kundli'` |
| **Code & Source** | `not built` (docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:house/house_card<br/>D1 h7,2,4,8; D9 h7,1; D7 h1"]
        I2["reader:planet/planet_card<br/>D1 cards of L7, L2, L8, Ju"]
        I3["reader:point/point_row<br/>UL, A7, DK"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: natal<br/>key includes the reading clock"}
    end
    subgraph Steps["love.reading.bond"]
        S1["1. houseFrame D1 h7, h2, h4, h8; D9 h7, h1; D7 h1"]
        S2["2. planetChain L7, L2, L8, Ju; UL and its 2nd, A7, DK"]
        S3["3. Shown for dating, committed, married, separated; separation never a verdict"]
        S1 --> S2 --> S3
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 18 of 20 — `love.reading.circle`: Love reading: who else is in it (family, in-laws, friends, children as facts)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reading.circle` — Love reading: who else is in it (family, in-laws, friends, children as facts) |
| **Category / Board / Status** | `love` · `love` · `planned` |
| **Charts Declared** | `divisional:D1`, `divisional:D7`, `jaimini:charakaraka` |
| **Selectors** | `{"boards":["love"],"houses":[2,4,11,5],"vargas":["D1","D7"]}` |
| **Reader Pieces** | `reader:house/house_card` (D1 h2,4,11,5; D7 h5) · `reader:planet/planet_card` (D1 cards of L2, L4, L11, Mo, Ju) · `reader:point/point_row` (MK, PK, A11) |
| **Agent Piece** | none until the spend yes (`system: none`) |
| **Output Piece** | `output:board_panel.v1` |
| **Date-Range Window Cache** | `freshness: 'natal'` · `scope: 'kundli'` |
| **Code & Source** | `not built` (docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:house/house_card<br/>D1 h2,4,11,5; D7 h5"]
        I2["reader:planet/planet_card<br/>D1 cards of L2, L4, L11, Mo, Ju"]
        I3["reader:point/point_row<br/>MK, PK, A11"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: natal<br/>key includes the reading clock"}
    end
    subgraph Steps["love.reading.circle"]
        S1["1. houseFrame D1 h2, h4, h11, h5; D7 h5"]
        S2["2. planetChain L2, L4, L11, Mo, Ju; MK, PK, A11"]
        S3["3. Shown for committed, married, separated, complicated; nothing about a child under 18"]
        S1 --> S2 --> S3
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_panel.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S3 --> OUT
```

---

## Page 19 of 20 — `love.reading.struggle`: Love reading: what tests it (board.struggle filtered to love)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reading.struggle` — Love reading: what tests it (board.struggle filtered to love) |
| **Category / Board / Status** | `love` · `love` · `planned` |
| **Charts Declared** | `divisional:D1`, `natal:doshas`, `dasha:reading clock L1-L3` |
| **Selectors** | `{"boards":["love"],"houses":[7,5,8,12],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:planet/planet_card` (D1 cards of L7, Ve, DK, Mo) · `reader:house/house_card` (D1 h7,5,8,12) · `reader:yoga/yoga_row` (Kalathra, Manglik rows) · `reader:activation/activation_row` (reading clock L1-L3 running) |
| **Agent Piece** | none until the spend yes (`system: none`) |
| **Output Piece** | `output:board_struggle.v1` |
| **Date-Range Window Cache** | `freshness: 'dasha'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/struggle.ts as board.struggle (filter planned)` (docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:planet/planet_card<br/>D1 cards of L7, Ve, DK, Mo"]
        I2["reader:house/house_card<br/>D1 h7,5,8,12"]
        I3["reader:yoga/yoga_row<br/>Kalathra, Manglik rows"]
        I4["reader:activation/activation_row<br/>reading clock L1-L3 running"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: dasha<br/>key includes the reading clock"}
    end
    subgraph Steps["love.reading.struggle"]
        S1["1. board.struggle with planets L7, Ve, DK, Mo, the UL lord and houses 7,5,8,12"]
        S2["2. Sa, Ma, Ra, Ke on or aspecting 7, Ve or UL; Kalathra and Manglik rows; L7 in 6/8/12; Ve debilitated without a cancellation; release from the reading clock"]
        S1 --> S2
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_struggle.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 & I2 & I3 & I4 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S2 --> OUT
```

---

## Page 20 of 20 — `love.reading.year`: Love reading: this year (board.year filtered to love)

| Field | Value |
|---|---|
| **Technique ID / Title** | `love.reading.year` — Love reading: this year (board.year filtered to love) |
| **Category / Board / Status** | `love` · `love` · `planned` |
| **Charts Declared** | `annual:tithi_pravesha`, `annual:varsha` |
| **Selectors** | `{"boards":["love"],"houses":[7],"vargas":["D1"]}` |
| **Reader Pieces** | `reader:annual/annual_row` (TP and VP D1 of the running year) |
| **Agent Piece** | none until the spend yes (`system: none`) |
| **Output Piece** | `output:board_year.v1` |
| **Date-Range Window Cache** | `freshness: 'annual'` · `scope: 'kundli'` |
| **Code & Source** | `src/reading/self/panels/year.ts as board.year (filter planned)` (docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46) |

```mermaid
flowchart LR
    subgraph Inputs["Shared slicers (src/reading/self/slices.ts)"]
        I1["reader:annual/annual_row<br/>TP and VP D1 of the running year"]
    end
    subgraph CacheGate["Date-Range Window Cache Gate"]
        GATE{"technique_outputs<br/>freshness: annual<br/>key includes the reading clock"}
    end
    subgraph Steps["love.reading.year"]
        S1["1. board.year on house 7, Venus, the natal L7 and the UL sign; Vivaha and Preethi sahams when stored"]
        S1
    end
    subgraph Output["Board reading panel"]
        OUT["output:board_year.v1<br/>claims with text, detail, certainty, evidence"]
    end
    I1 --> GATE
    GATE -->|"HIT"| OUT
    GATE -->|"MISS"| S1
    S1 --> OUT
```
