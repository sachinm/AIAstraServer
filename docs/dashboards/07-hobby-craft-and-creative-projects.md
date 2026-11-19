# Dashboard 07: Hobby, Craft & Creative Projects (Play, Mastery & Side-Hustle Discernment)

**Document ID:** `docs/dashboards/07-hobby-craft-and-creative-projects.md`  
**Board Route:** `/work` → Lens: `hobby_craft` (`work.status` = `creative` | `side_project` | `retired` | `sabbatical` | user-selected creative lens)  
**Card Range:** Cards 56–61 (6 Cards)  
**Primary Divisional Charts:** `D7` (Saptamsha — creative birth & progeny of the mind), `D24` (Siddhamsha — craft & technique mastery), `D16` (Shodashamsa — inner joy, beauty & sensory delight), `D10` (Dashamsha — monetization/shipping bridge only), `D2` (Hora — optional side-income evaluation), `D9` (Navamsha — gated at `ageYears > getD9MaturityAgeYears()`)  
**Engine & Data Boundary:** All planetary coordinates, divisional vargas (`D1`, `D7`, `D24`, `D16`, `D10`, `D2`, `D9`), dashas, transits, Ashtakavarga bindus, Arudha padas, Chara Karakas, and Tithi Pravesha rows are pre-computed by the external sidereal ephemeris engine and consumed from `kundli_digest` (`DigestView`) and `kundli_activation`. Node.js performs **zero** astrological calculations.

---

## 1. Domain Architecture & Full-Circle Coverage Guarantee

The **Hobby, Craft & Creative Projects** dashboard protects a vital, frequently neglected dimension of human work: creative self-expression, hands-on craft, play, and passion projects outside one's primary corporate paycheck. Modern hustle culture tells creators to monetize everything immediately—destroying joy—while generic career horoscopes ignore art, writing, music, woodworking, open-source coding, or side-projects entirely. In Vedic Jyotish, creative projects run on a completely different karmic engine than employment:

1. **Creative Progeny (`D7` Saptamsha + 5th House):** Classically, *Saptamsha* (`D7`) governs children—both biological progeny and **progeny of the mind** (books, music, art, software creations, inventions). Evaluating creative fertility requires `D7` Lagna, 5th, and 9th houses alongside `D1` 5th house (*Buddhi / Kalatmak* play).
2. **Craft & Manual Effort (`3rd House` + `D24` + `D16`):** The **3rd house** (*Parakrama / Hasta*) governs the hands, fine motor craft, writing, instruments, and courageous self-effort; **`D24`** tracks technical mastery of a medium; **`D16`** measures pure sensory joy (*Sukha*) so a hobby remains life-giving rather than becoming a second unpaid boss.
3. **The Monetization Boundary (`5th/D7` → `11th/D10/D2`):** Turning a beloved hobby into a side hustle is a deliberate structural bridge—only advised when `D7` and `5th` connect constructively to `11th`/`A11`/`D10`/`D2` without crushing `D16`/`5th` joy.
4. **Full-Circle Coverage Matrix (6 Cards):**
   - **Creative Rhythm, Medium & Dry Spells:** Cards **56** (*Your Creative Flow This Year*), **57** (*The Craft That Energizes You*), and **58** (*Creative Blocks & Motivation*).
   - **Monetization Discernment:** Card **59** (*Turning a Hobby Into a Side Hustle*).
   - **Completion, Shipping & Audience:** Cards **60** (*Finishing & Shipping Your Project*) and **61** (*Community & Audience for Your Work*).

### Default Pinned Cards & Sub-Technique Architecture
- **Default Pinned Starter Deck (4 Cards):** `craft.creative_flow` (56), `craft.energizing_medium` (57), `craft.creative_blocks` (58), `craft.shipping_projects` (60).
- **Card Picker Deck (Contextual / On-Demand):** `craft.monetize_hobby` (59), `craft.audience_community` (61).
- **Deterministic Sub-Technique Pipeline:** `work.sub.hobby_craft_ledger` executes once per `(kundliId, digest_version, asOf)`, extracting `D1 + D7 + D24 + D16 + D10 + D2 + D9` ledgers, active dasha systems, `A5`/`A11`/`PK`, and bounded TP containers into `technique_outputs`. Grouped LLM synthesis uses stable `parts[0]` prefix caching ($\ge 1,024$ tokens, `cachePrefix: true`, `cacheOwner: { userId, kundliId }`) and participates in 45-minute used-cache recycling (`READING_CACHE_RECYCLE_MINUTES=45`).

---

## 2. Dashboard-Wide Rules: Age-36 Gate, Multi-Clock Dashas & Bounded Tithi Pravesha

1. **Age-36 Navamsha (`D9`) Gate (`getD9MaturityAgeYears()`, default `36`):**
   - Pre-36 (`ageYears <= getD9MaturityAgeYears()`): Evaluates `D1 + D7 + D24 + D16` primarily to spot natural medium, playful spark, and early side-project energy.
   - Post-36 (`ageYears > getD9MaturityAgeYears()`): Enforces `evaluateD1D9MutualConfirmation` on Venus, Mercury, Moon, 3rd/5th lords, and active MD/AD lords alongside `D7`. Many people discover their truest, most unhurried creative voice post-36 when `D9` activates (*d9_redeemed* Venus/Mercury unlocking late-blooming artistry; *confirmed_weak* Saturnian perfectionism needing gentle play). Missing birth date records `age_unresolved` and falls back to `D1 + D7`.
2. **Active 40+ Dasha Systems & 9x9 Fruition Matrix:**
   - Queries `resolveActiveMahadasha` across conditional dashas, *Vimshottari*, *Narayana/Chara*, and *Yogini*. Evaluates the 9x9 Fruition Matrix (`AntardashaFruitionCell`)—specifically checking whether `1/5/9` Trikona links spark effortless flow or `6/8`/`2/12` patterns trigger self-criticism and creative winter—and 5-system Avasthas (e.g., *Bala* / *Yuva* playfulness vs *Vriddha* / *Mrita* dry spells).
3. **Bounded Annual Tithi Pravesha (`TITHI_PRAVESHA_YEAR_RULE`):**
   - Cuts the next 12 months into 3–6 engine-dated spans strictly inside `[tp_start, tp_end]` ($\le 400$ days) via `runningTithiPravesha` and `tpRowIn(view, tpInfo, 'D7')` / `'D24'`. Zero Gregorian `01-01` .. `12-31` fallbacks. Unresolved `yearLord` or contested clocks fail closed to `stance = 'get_through'`.
4. **Plain-English Surface:**
   - Card `ReadFace` and `ShortFace` use warm, grounded English with **zero** Sanskrit jargon or internal engine identifiers. Technical coordinates remain strictly in `evidence[]` for **Chart details**.
5. **Implementation Dependencies (`FACT_CATALOG`, `SERVED_VARGAS`, `ANNUAL_CHART_VARGAS`):**
   - **`FACT_CATALOG` (`src/profile/facts.ts`):** `FACT_CATALOG` defines `'work.status': ['yes', 'between_jobs', 'own_business', 'studying', 'retired']` and `'self.focus'` (which includes `'creativity'`). Spec tags (`creative`, `side_project`, `sabbatical`) map onto `self.focus = 'creativity'` + `work.status` (`retired`, `yes`, `between_jobs`) or require additive `FACT_CATALOG` extensions for `work.creative_medium` / `work.hours_available`.
   - **`SERVED_VARGAS` & `ANNUAL_CHART_VARGAS`:** `src/reading/chartData/catalog.ts:133` currently sets `SERVED_VARGAS = {1, 2, 4, 7, 9, 10}` and `src/reading/digest/annualSet.ts:11` sets `ANNUAL_CHART_VARGAS = [1, 9, 10]`. Natal `D16` and `D24` pulls—and `TP D7` / `TP D16` / `TP D24` (`tpRowIn`) annual pulls—depend on `docs/reading-engine/80` R1–R4 (`SERVED_VARGAS_LIST`, varga placement houses, `kind === 'TP'` `yearLord` parsing, and `ANNUAL_CHART_VARGAS` expansion), falling back cleanly to served `D1 + D7 + D9` until enabled.

---

## 3. Complete Card Specifications (Cards 56–61)

---

### Card 56: Your Creative Flow This Year
- **Card Key:** `craft.creative_flow`
- **Subtitle:** `When inspiration surges, and when quiet rest replenishes your imagination`
- **Default Placement:** Pinned (Starter Card #1) | **`showWhen`:** `work.status in ['creative', 'side_project', 'retired', 'sabbatical']` or user-pinned

#### Area of Focus
The 12-month seasonal tide of artistic inspiration, curiosity, imaginative play, and creative stamina—separating high-output flow quarters from quiet incubation stretches.

#### Oracle Question
> "What is the creative rhythm of your upcoming 12 months, and during which dated stretches will inspiration, playful experimentation, and output peak?"

#### Personalizer Goal & Stance
- **Goal:** Normalize creative seasonality (`person_facts`: `work.creative_medium`, `work.hours_available`). Teach creators to ride surge windows for bold generation and use quieter months for reading, wandering, and refilling the well rather than forcing sterile productivity.
- **Stance Logic:**
  - `build`: 3rd/5th/Venus/Mercury/Moon periods aligned in `D1 + D7`, supportive TP `yearLord`, and confirmed/leaning concordance. Encourages setting bold creative milestones, drafting new work, and protecting studio/maker hours.
  - `get_through`: Saturn/Ketu/12th pressure on 5th/`D7` or unresolved TP `yearLord`. Reframes the stretch as quiet incubation—journaling, sketching without judgment, and consuming inspiring art until the named spark date arrives.

#### Full-Circle Coverage
1. **Trigger:** Wanting to plan a creative year (novel, album, art series, indie app, craft) around natural energy tides.
2. **Evidence & Diagnosis:** Evaluates `D7` (Lagna, 5th, 9th) + `D1` 3rd/5th + Venus/Moon/Mercury active cycles inside `[tp_start, tp_end]`.
3. **Behavioral Action:** Maps peak generation vs fallow recharge spans (`PeriodStrip` + `KeyDates`) with 4-tier artistic discipline.
4. **Resolution:** Routes directly into Card 60 (*Finishing & Shipping Your Project*) during execution peaks or Card 58 (*Creative Blocks*) during dry spells.

#### Single Past-Event Calibration Question
> "Looking back over the past 6 to 9 months, did you experience a distinct stretch where creative ideas flowed effortlessly—followed by a quieter phase where your mind needed rest?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Create from genuine wonder and devotion to the craft itself, honoring fallow seasons as fertile soil rather than failure.
- **Rajasic (Pragmatic Leverage):** Block protected calendar hours strictly for creative work during peak flow windows, and batch low-effort organizing/research during quieter months.
- **Mediocre (Passive/Mixed):** Wait passively for sudden lightning strikes of mood without showing up to the desk, or force frantic output until creative joy turns sour.
- **Baseline (Zero-Loss Floor):** Never abandon basic physical rest or turn a restorative hobby into a source of harsh self-punishment during low-energy weeks.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks natal Moon's Janma Nakshatra and 5th lord's nakshatra against active AD/PD lords via `StarProfile.taras`. Venus/Moon/Mercury stars (*Rohini, Bharani, Purva Phalguni, Hasta, Revati, Shravana, Punarvasu*) under **Mitra** (8), **Param Mitra** (9), **Kshema** (4), or **Sadhaka** (6) Taras ignite vivid aesthetic flow; **Janma** (1) or **Pratyak** (5) turns focus inward toward quiet revision.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **5th house** (spontaneous genius/play), **3rd house** (hands-on sketching/writing/tinkering), **11th house** (enthusiasm/delight), **Venus** (beauty/arts), **Mercury** (craft/words), **Moon** (imagination), and **`A5` (Mantra Pada)**. Checks *Saraswati Yoga* (Mercury-Jupiter-Venus) and *Kalanidhi Yoga* (Jupiter-Venus-Mercury creative refinement).
- **Divisional Charts (`D7`, `D16`, `D24`, `D1`, `D9`):**
  - Core engine: **`D7` (Saptamsha)** Lagna, 5th house, and 5th lord—measuring "creative birth" capacity—crossed with **`D16` (Shodashamsa)** (pure inner joy) and **`D24`** (technical polish).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, verifies `evaluateD1D9MutualConfirmation` on Venus, Mercury, Moon, and 5th lord (`d9_redeemed` often awakens rich second-half artistic expression; *False Promise* warns against chasing external vanity over genuine craft).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`Venus`, `Moon`, `Mercury`, `Jupiter`, or 3rd/5th lord MD/AD/PD), checking 9x9 Matrix (`1/5/9` *Trikona* sub-periods spark effortless creative births) and Baladi/Jagradadi Avasthas (*Yuva* `1.00x` + *Jagrat* `1.00x` maximize artistic vitality).
- **Transits (Gochar) & Ashtakavarga:** Monitors **Venus** and **Mercury** transits over natal 1st/3rd/5th/11th, **Jupiter** casting 5th/9th/7th aspect onto natal 5th house or `D7` Lagna, and Moon transits through creative nakshatras. Checks `D1` 3rd/5th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D7')` and `tpRowIn(view, tpInfo, 'D16')`, `AnnualRow.yearLord` dignity relative to 5th/Venus, *Vidya* / *Kala* Sahams, and *Tithi Ashtottari* spans inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses niche yet passionate creative-astrology searches (*"creative inspiration astrology"*, *"best time to write or make art birth chart"*, *"creative flow horoscope"*). Artists, writers, and makers seek permission to work with their natural tides instead of burning out on rigid linear output expectations.

#### Classical Attribution
- *BPHS* Ch. 7 (`D7` Saptamsha, `D16` Shodashamsa, `D24` Siddhamsha), Ch. 14 & 16 (3rd manual craft & 5th *Buddhi*/creative progeny).
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D7` as creative/intellectual offspring beyond biological children.
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Venus, Moon, Mercury artistic and literary karakatvas).
- *Tithi Pravesha* (Pt. Sanjay Rath) — Annual `TP D7` creative flow periods.

---

### Card 57: The Craft That Energizes You
- **Card Key:** `craft.energizing_medium`
- **Subtitle:** `Matching your natural wiring to the hands-on medium that restores you`
- **Default Placement:** Pinned (Starter Card #2) | **`showWhen`:** `work.status in ['creative', 'side_project', 'retired', 'sabbatical']`

#### Area of Focus
Discovering which specific creative or hands-on medium—writing, visual design, music, woodworking, culinary craft, gardening, photography, or recreational coding—genuinely replenishes energy rather than feeling like a chore.

#### Oracle Question
> "Which creative mediums and hands-on crafts align most naturally with your planetary wiring to restore your vitality and unlock effortless expression?"

#### Personalizer Goal & Stance
- **Goal:** Give concrete, practical medium archetypes tailored to `person_facts` (`work.interests`, `work.day_job`)—especially helping analytical or left-brained workers pick tactile/aesthetic outlets that balance their daily grind rather than duplicating it.
- **Stance Logic:**
  - `build`: Clear planetary signature across `3rd`/`5th` lords + `D7`/`D24`/`D16` + supportive active period. Encourages investing in tools, studio space, or lessons in the aligned medium.
  - `get_through`: Scattered multi-planet pull or heavy day-job fatigue. Recommends low-barrier, zero-equipment play (sketchbook, 15-min instrument practice, evening walk photography) to restore joy first.

#### Full-Circle Coverage
1. **Trigger:** Wanting a fulfilling hobby after work, feeling uninspired by current pastimes, or choosing among artistic interests.
2. **Evidence & Diagnosis:** Maps planetary rulers of **3rd** (hands/tools), **5th** (imagination), **`D7`** (creative seed), **`D24`** (technique), and **`D16`** (sensory delight) to concrete mediums.
3. **Behavioral Action:** Delivers tailored medium recommendations and 4-tier practice rituals.
4. **Resolution:** Feeds energized practice directly into Card 56 (*Creative Flow*) and Card 60 (*Finishing & Shipping*).

#### Single Past-Event Calibration Question
> "Thinking back to activities you got completely lost in—where hours felt like minutes—were you working primarily with words/ideas, sound/rhythm, visual aesthetics, or shaping physical materials with your hands?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Choose a craft that brings pure presence, humility, and inner quiet—practicing for the sheer love of making rather than external applause.
- **Rajasic (Pragmatic Leverage):** Intentionally select a hobby whose elemental sensory mode counterbalances your day job (e.g., tactile woodworking/ceramics if you stare at spreadsheets all day).
- **Mediocre (Passive/Mixed):** Buy expensive gear for an aspirational identity you never actually touch, or pick a "productive" hobby solely because it looks impressive on social media.
- **Baseline (Zero-Loss Floor):** Protect beginner playfulness; never grade your restorative hobby by professional standards during your first months of exploration.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Uses Nakshatra deities and symbols directly:
  - *Hasta / Vishwakarma* (*Chitra* — celestial architect): sculpting, woodworking, fine mechanical craft, architecture, photography.
  - *Ashwini / Pushya / Rohini*: culinary arts, horticulture, healing crafts, ceramics, lush visual art.
  - *Swati / Shravana / Purva Phalguni*: music, vocal/acoustic craft, dance, rhythm.
  - *Ashlesha / Jyeshtha / Revati / Punarvasu*: storytelling, poetry, essay writing, indie game/code craft.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Maps **3rd house/lord** (manual dexterity/tools) + **5th house/lord** (creative soul) + strongest natural/active planet among: **Venus** (visual arts, harmony, design, music), **Mercury** (writing, wordcraft, coding, puzzles), **Mars** (fire/metal/wood/culinary/physical athletics), **Moon** (poetry, lyricism, textiles, water/cooking), **Saturn** (stone, clay, archival structure, traditional instruments), **Rahu** (digital media, synth, photography, film). Evaluates `A3` & `A5`.
- **Divisional Charts (`D7`, `D24`, `D16`, `D1`, `D9`):**
  - Triangulates **`D7`** (what wants to be born), **`D24`** (innate technical aptitude), and **`D16`** (what produces genuine emotional/sensory bliss).
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `D9` 3rd/5th/Venus/Mercury via `evaluateD1D9MutualConfirmation`—often revealing hidden late-blooming mediums (`d9_redeemed`) that were suppressed by early practical pressures.
- **Dasha Systems:** Identifies which creative karaka is currently awakened by `resolveActiveMahadasha` (`MD/AD`), showing why a lifelong writer might suddenly feel drawn to music or gardening during a Venus or Moon sub-period.
- **Transits (Gochar) & Ashtakavarga:** Checks transit Jupiter/Venus activating 3rd/5th/11th signs and `HouseCard.sav` in 3rd and 5th houses (high `SAV` = abundant tactile stamina).
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D7')` and `tpRowIn(view, tpInfo, 'D16')` Lagna/5th rulers and `yearLord` element (Fire/Earth/Air/Water) to spotlight the most restorative creative channel for the current lunar year.

#### Google Search Trends Synthesis
Addresses exploratory lifestyle-astrology searches (*"what creative hobby suits me astrology"*, *"my artistic talents birth chart"*, *"craft and talent astrology"*). Users burned out on screens and passive scrolling actively search for personalized creative outlets grounded in their own chart temperament.

#### Classical Attribution
- *BPHS* Ch. 3 (Planetary karakatvas & elements), Ch. 14 & 16 (3rd *Hasta/Vikrama* and 5th *Buddhi* Bhavas).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Detailed sensory, artistic, manual, and musical significations of Venus, Mercury, Mars, Moon, Saturn).
- *Taittiriya Brahmana* & *Muhurta Chintamani* (Nakshatra deities—e.g., Tvashtar/Chitra, Savitr/Hasta—governing specific crafts).
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — `D7`, `D16`, and `D24` interplay for artistic joy vs technical craft.

---

### Card 58: Creative Blocks & Loss of Motivation
- **Card Key:** `craft.creative_blocks`
- **Subtitle:** `Why the well feels dry right now, and when your creative spark returns`
- **Default Placement:** Pinned (Starter Card #3) | **`showWhen`:** `work.status in ['creative', 'side_project', 'retired', 'sabbatical']`

#### Area of Focus
Diagnosing writer's block, blank-canvas paralysis, harsh inner perfectionism, and sudden loss of artistic joy—distinguishing temporary creative winter from overwork bleed-over and pinpointing exact thaw dates.

#### Oracle Question
> "What is currently constricting your creative motivation or making self-expression feel heavy, and on what dated milestone does the spark naturally reopen?"

#### Personalizer Goal & Stance
- **Goal:** Dissolve artistic shame (`person_facts`: `work.creative_medium`, `work.stress_level`). Show creators that Saturnian/Ketuvian dry spells are cyclical pruning seasons—and give gentle, low-stakes exercises alongside the exact calendar date when creative warmth returns.
- **Stance Logic:**
  - `build`: Block-inducing Saturn/Ketu/12th transit or AD is lifting within the current TP window. Encourages gently reopening stalled drafts and starting small daily warmups.
  - `get_through`: Active Saturn/Ketu/12th hit on 5th/`D7`/Venus/Mercury, or `6/8` AD friction. Advises zero-pressure rest, consuming inspiring work without producing, and banning inner-critic editing until the named thaw date.

#### Full-Circle Coverage
1. **Trigger:** Staring at an unfinished manuscript/canvas for months, feeling numb toward a once-loved hobby, or perfectionist freeze.
2. **Evidence & Diagnosis:** Inspects Saturn (perfectionist constriction), Ketu (detachment/emptying), 12th house (loss of focus/exhaustion), and combustion/retrogression on 5th/`D7`/Venus/Mercury.
3. **Behavioral Action:** Maps exact thaw `KeyDates` and 4-tier anti-block habits.
4. **Resolution:** Transitions smoothly back into Card 56 (*Creative Flow*) or Card 60 (*Finishing & Shipping*).

#### Single Past-Event Calibration Question
> "Over the past 4 to 8 months, did harsh self-criticism—or feeling emotionally drained by other responsibilities—make even sitting down with your craft feel strangely heavy?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Forgive yourself during quiet seasons; treat creative silence as reverent composting rather than personal failure.
- **Rajasic (Pragmatic Leverage):** Lower the activation threshold drastically (10 ugly minutes a day, zero-stakes sketches, switching mediums briefly) so perfectionism has no room to stall you.
- **Mediocre (Passive/Mixed):** Doomscroll other artists' highlight reels while hating your own unfinished drafts, or abandon a meaningful project permanently during a temporary slump.
- **Baseline (Zero-Loss Floor):** Never delete or destroy unfinished manuscripts, art, or code during a Ketu/Saturn dry spell; archive them safely for future review.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks Moon, Venus, Mercury, and 5th lord under **Vipat** (3), **Pratyak** (5), or **Vadha** (7) Taras—plus **Gandanta** or **25th Manasa Nakshatra** pressure draining mental playfulness. Saturn/Ketu transiting the natal 5th lord's nakshatra dries up superficial inspiration to force deeper authenticity.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **5th house/lord** (creative spark) afflicted by Saturn (fear of judgment/perfectionism), Ketu (detachment/"what's the point?"), Mars (impatience), or **12th house** (sleep/burnout leakage). Checks **Venus** and **Mercury** combustion, debilitation, or *Papakartari Yoga* hemming in the 5th house or `A5`.
- **Divisional Charts (`D7`, `D16`, `D1`, `D9`):**
  - Cross-checks **`D7` 5th house/Lagna** against **`D16` (joy)**. If `D7` is strong while `D1` is strained, external life fatigue—not lack of talent—is blocking output.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, runs `evaluateD1D9MutualConfirmation` on 5th lord, Venus, and Mercury (`confirmed_weak` *Drudha Karma* highlights lifelong perfectionism needing structured 4-tier gentle rituals; `d9_redeemed` promises steady thaw).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`Saturn`, `Ketu`, `6th/8th/12th lord` sub-periods), 9x9 Matrix **Shadashtaka (`6/8`)** or **Dwirdwadasha (`2/12`)** tension, and *Sushupti* (`0.25x`) / *Mrita* (`0.10x`) Avastha phases on Venus/Mercury.
- **Transits (Gochar) & Ashtakavarga:** Monitors **Saturn** transiting or aspecting natal 5th house/Venus/Moon (*Sade Sati* dampening play), **Ketu** transiting 5th/1st (temporary creative ego-dissolution), and **Jupiter** approaching an aspect onto 5th/Lagna (the exact thaw trigger). Checks `D1` 5th `HouseCard.sav` ($< 25$ signals sensitivity to criticism).
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D7')` 5th/12th houses, `yearLord` stress, and exact *Tithi Ashtottari* sub-periods within `[tp_start, tp_end]` marking when Venus/Mercury/Jupiter periods lift the fog.

#### Google Search Trends Synthesis
Serves emotionally relatable search clusters (*"why do I have writer's block astrology"*, *"loss of creative motivation birth chart"*, *"how to overcome creative block horoscope"*). Makers and writers want to know whether their dry spell has an expiration date and how to stop judging themselves during creative winter.

#### Classical Attribution
- *BPHS* Ch. 16 & 23 (5th creative intelligence vs 12th loss/retreat).
- *Phaladeepika* Ch. 14 & 26 (Saturn/Ketu constricting 5th house & Venus/Mercury).
- *Prasna Marga* Ch. 24–26 (Loss of creative/mental clarity, *Manasa Nakshatra* & Gandanta diagnostics).
- *Saravali* Ch. 13–18 (Saturn-Venus and Ketu-Mercury perfectionism/detachment yogas).

---

### Card 59: Turning a Hobby Into a Side Hustle
- **Card Key:** `craft.monetize_hobby`
- **Subtitle:** `Whether to keep your passion pure play or build a sustainable side income`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['creative', 'side_project', 'employed']`

#### Area of Focus
The delicate decision of monetizing a beloved craft—evaluating whether commercializing a hobby adds sustainable income and momentum (`5th` → `11th`/`2nd`) or suffocates the joy (`D16`/`D7`) under client/algorithm pressure.

#### Oracle Question
> "Should your creative project remain a protected sanctuary of pure joy right now, or does your chart support turning it into a structured, sustainable side hustle?"

#### Personalizer Goal & Stance
- **Goal:** Counter toxic "monetize everything" pressure (`person_facts`: `work.side_hustle_goal`, `work.primary_income_stable`). Give honest guidance: either green-lighting low-friction monetization models (prints, workshops, digital products, consulting) or protecting a hobby from premature commercial burnout.
- **Stance Logic:**
  - `build`: Clean link between `5th/3rd` (`D7`) and `11th/2nd/10th` (`D10` + `D2`) with strong Mercury/Venus commercial skill and supportive TP `yearLord`. Supports testing small paid offers without quitting day-job security prematurely.
  - `get_through`: `D7`/`D16` thriving while `D10`/`D2`/`11th` show friction, `6/8` AD, or weak `yearLord`. Recommends keeping the craft sacred and unmonetized for now—or only selling low-obligation pre-made works rather than custom client commissions.

#### Full-Circle Coverage
1. **Trigger:** Friends asking "Why don't you sell these?", social-media hustle guilt, or wanting extra income from a passion skill.
2. **Evidence & Diagnosis:** Tests the bridge from **`D7`/5th** (creative joy) into **`D10`/10th** (market execution) and **`D2`/2nd/11th** (cashflow) without breaking **`D16`** (joy).
3. **Behavioral Action:** Maps test-launch vs pure-play windows (`PeriodStrip`) and delivers 4-tier gentle monetization rules.
4. **Resolution:** Connects validated side hustles into Card 60 (*Finishing & Shipping*), Card 61 (*Audience*), or Dashboard 08 (*Business & Field of Business*) if it scales full-time.

#### Single Past-Event Calibration Question
> "In the past, whenever you attached deadlines, client expectations, or money to something you originally did just for fun, did it energize your craft—or quietly drain the joy out of it?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Protect the sacred heart of your art—only share or sell from overflow and honest value, never warping your craft into frantic people-pleasing.
- **Rajasic (Pragmatic Leverage):** Test demand with low-friction, high-margin offerings (limited drops, digital templates, weekend workshops) before taking on custom client retainers or overhead.
- **Mediocre (Passive/Mixed):** Quit your stable income impulsively on a half-baked hobby dream, or obsess over pricing/algorithms before finishing ten solid pieces of work.
- **Baseline (Zero-Loss Floor):** Keep strict separation between restorative play hours and commercial fulfillment hours so making money never kills your love of the medium.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of 5th, 11th, and 2nd lords and Mercury (trade/pricing). *Vaishya* / commercial stars (*Rohini, Hasta, Swati, Shravana, Revati*) bridge art into commerce effortlessly; *Brahmin/Moksha* stars (*Punarvasu, Ashwini, Moola, Purva Bhadrapada*) prefer teaching, licensing, or patron models over aggressive sales hustling. Checks **Sampat** (2) and **Sadhaka** (6) Taras for pricing/launch timing.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Examines the **5th-to-11th** (*Dhana/Labha* from passion) and **5th-to-2nd** lord connections, `A5` (creative brand) ↔ `A11` (monetary gains) ↔ `A7` (customers), and **Mercury-Venus** (commercial aesthetics). Checks if 6th-house service demands conflict with 5th-house play.
- **Divisional Charts (`D7`, `D10`, `D2`, `D16`, `D1`, `D9`):**
  - Multi-varga bridge test: **`D7` (creative seed)** → **`D10` (market viability)** → **`D2` (Hora cashflow)** while checking **`D16`** so inner joy isn't crushed.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, runs `evaluateD1D9MutualConfirmation` on 5th lord, 11th lord, Mercury, and Venus (`confirmed_strong` or `d9_redeemed` supports turning mature lifelong crafts into respected second-act income streams).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` connecting 5th/3rd lords with 2nd/10th/11th lords, checking 9x9 Matrix **Dhana/Labha (`2/11` from MD)** and *Chara/Narayana Dasha* entering `A5`/`A11`.
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter** transiting 2nd/5th/11th (patronage and pricing ease), **Saturn** in 3rd/11th (patient side-business scaffolding), and `HouseCard.sav` comparison between **5th** and **11th** houses.
- **Tithi Pravesha (TP):** Inspects `tpRowIn(view, tpInfo, 'D7')`, `tpRowIn(view, tpInfo, 'D10')`, and `tpRowIn(view, tpInfo, 'D2')` alongside *Artha* and *Karya Siddhi* Sahams and `yearLord` links inside `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses huge side-economy search interest (*"should I monetize my hobby astrology"*, *"turning passion into business birth chart"*, *"side hustle horoscope"*). Modern creatives feel torn between protecting mental health and capturing side income; separating pure `D7` joy from `D10/D2` commerce answers that dilemma directly.

#### Classical Attribution
- *BPHS* Ch. 7 (`D7`, `D10`, `D2` Hora, `D16`), Ch. 13, 16, 21 (2nd, 5th, 11th Dhana connections).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`A5` ↔ `A11` ↔ `A7` creative commerce).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Mercury commercial craft + Venus artistic value).
- *Tithi Pravesha* (Pt. Sanjay Rath) — *Artha Saham* & `TP D7`/`D10`/`D2` side-venture testing.

---

### Card 60: Finishing & Shipping Your Project
- **Card Key:** `craft.shipping_projects`
- **Subtitle:** `Moving past endless tinkering to complete, publish, and release your work`
- **Default Placement:** Pinned (Starter Card #4) | **`showWhen`:** `work.status in ['creative', 'side_project', 'retired', 'sabbatical']`

#### Area of Focus
Crossing the final 20% finish line—conquering endless tweaking, unfinished hard drives, and fear of public judgment to actually finish, publish, exhibit, or ship a creative project.

#### Oracle Question
> "During which upcoming dated windows will your discipline, follow-through, and momentum align to finish polishing and publicly release your creative project?"

#### Personalizer Goal & Stance
- **Goal:** Help perpetual perfectionists (`person_facts`: `work.creative_medium`, `work.project_stage`) turn half-finished drafts into shipped artifacts by pairing Mars/Saturn completion energy with concrete release dates.
- **Stance Logic:**
  - `build`: Mars/Saturn/3rd/10th/11th execution alignment across `D7 + D10` + *Sadhaka* Tara + strong TP `yearLord`. Encourages locking a public release date, cutting scope cleanly, and hitting publish.
  - `get_through`: Retrograde Mercury/Venus or heavy `6/8` AD muddling final edits. Advises completing private final drafts, proofreading, and staging logistics quietly until the clean release window opens.

#### Full-Circle Coverage
1. **Trigger:** Sitting on a 90%-finished book, album, painting series, or indie tool for months or years.
2. **Evidence & Diagnosis:** Inspects **Mars** (finishing strike), **Saturn** (structural closure), **3rd house** (publishing/hands), **10th/11th houses** (public release) across `D7` and `D10`.
3. **Behavioral Action:** Maps polish vs launch `KeyDates` (`<= 6`) and delivers 4-tier shipping habits.
4. **Resolution:** Hands off smoothly to Card 61 (*Community & Audience for Your Work*) once shipped.

#### Single Past-Event Calibration Question
> "Looking at past creative projects you started with excitement, was the hardest hurdle coming up with the idea—or pushing through the unglamorous final edits to actually share it publicly?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Release your work as an honest offering into the world, detaching ego from perfection while honoring craftsmanship.
- **Rajasic (Pragmatic Leverage):** Freeze feature creep now—set a firm ship date inside a supportive *Sadhaka/Sampat* window, cut non-essential extras, and ship Version 1.0 cleanly.
- **Mediocre (Passive/Mixed):** Keep endlessly rewriting Chapter 1 or tweaking minor pixels to delay the vulnerability of being seen.
- **Baseline (Zero-Loss Floor):** Never miss basic legal/copyright/attribution hygiene or rush an unproofed public launch during a chaotic *Vipat/Vadha* retrograde window.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks active PD/Sookshma periods and Moon transits for **Sadhaka** (6/15/24 — goal accomplishment), **Kshema** (4/13/22 — safe consolidation), and **Mitra** (8/17/26) Taras. **Kshipra/Laghu (Swift)** nakshatras (*Ashwini, Pushya, Hasta*) favor rapid publishing; **Dhruva/Sthira (Fixed)** stars (*Rohini, Uttaras*) favor enduring landmark releases. Checks *Dhanishta*, *Krittika*, and *Anuradha* for Mars/Saturn completion stamina.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Focuses on **3rd house** (publishing, documentation, hands-on courage), **10th house** (public spotlight), **11th house** (culmination/fruit), **Mars** (decisive execution), and **Saturn** (finishing discipline). Checks *Karmajiva* & *Mars-Saturn* constructive discipline (turning critical perfectionism into clean deadlines) plus `A3` & `A10`.
- **Divisional Charts (`D7`, `D10`, `D1`, `D9`):**
  - Bridges **`D7`** (the completed creation) into **`D10`** (the public release/stage). Checks `D7` 10th/11th and `D10` 3rd/10th.
  - **Age-36 Gate:** If `ageYears > getD9MaturityAgeYears()`, checks `evaluateD1D9MutualConfirmation` on Mars, Saturn, and 3rd/10th lords—post-36 *confirmed_strong* or *d9_redeemed* Mars/Saturn unlocks patient, high-craft shipping discipline.
- **Dasha Systems:** Drills into **Levels 3–6** (PD/Sookshma/Prana inside `[-90d, +365d]`) via `resolveActiveMahadasha` (`Mars`, `Saturn`, `Mercury`, `3rd/10th/11th lord`), inspecting 9x9 Matrix (`Upachaya 3`, `Kendra 4/7/10`, `Labha 11` from MD) and *Jagrat* (`1.00x`) Avastha alertness.
- **Transits (Gochar) & Ashtakavarga:** Tracks Mars transiting 3rd/10th/11th (decisive finishing energy), Saturn stabilizing 3rd/11th, Jupiter aspecting 10th/11th (`activateDoubleTransit` on public release), and avoiding Mercury/Venus retrograde during final contract/platform launches. Checks 3rd & 11th `HouseCard.sav`.
- **Tithi Pravesha (TP):** Inspects **Karya Siddhi Saham** (accomplishment of work), `tpRowIn(view, tpInfo, 'D7')` and `tpRowIn(view, tpInfo, 'D10')`, Muntha in 3rd/10th/11th, and exact *Tithi Ashtottari* launch windows within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Reflects high-intent maker/author searches (*"how to finish creative projects astrology"*, *"best time to publish a book or launch art astrology"*, *"shipping creative work horoscope"*). Creators frequently battle the "last 10% curse" and want concrete muhurta-style timing windows to commit to a launch date.

#### Classical Attribution
- *BPHS* Ch. 14 & 20–21 (3rd *Parakrama*/publishing, 10th public arena, 11th completion).
- *Muhurta Chintamani* & *B.V. Raman — Muhurta* (Sadhaka Tara, Swift/Fixed Nakshatras for publishing and launches).
- *Tithi Pravesha* (Pt. Sanjay Rath) — *Karya Siddhi Saham* and `TP D7`/`D10` release triggers.
- *Phaladeepika* Ch. 14 & 26 (Mars/Saturn execution transits).

---

### Card 61: Community & Audience for Your Work
- **Card Key:** `craft.audience_community`
- **Subtitle:** `Finding appreciative readers, patrons, and fellow makers without selling out`
- **Default Placement:** Card Picker Deck | **`showWhen`:** `work.status in ['creative', 'side_project', 'retired', 'sabbatical']`

#### Area of Focus
Organic resonance and community building around creative output—identifying when work finds appreciative readers/viewers/patrons (`11th`/`A11`/`D7` 11th) and what authentic sharing channels work best without sleazy self-promotion.

#### Oracle Question
> "How and during which dated windows will your creative work connect most naturally with an appreciative audience, patrons, or kindred fellow makers?"

#### Personalizer Goal & Stance
- **Goal:** Help shy or anti-marketing creators (`person_facts`: `work.creative_medium`, `work.sharing_comfort`) share their work in aligned circles rather than shouting into hostile algorithms—distinguishing tight niche communities from broad public waves.
- **Stance Logic:**
  - `build`: 11th/`A11`/Moon/Venus/Jupiter alignment across `D1 + D7` + strong TP `yearLord`. Encourages submitting to showcases, hosting salons, publishing consistently, and connecting with creative peers.
  - `get_through`: Rahu/Ketu/Saturn friction on `A11`/11th risking vanity comparison or algorithm fatigue. Advises sharing intimately with a small, trusted guild of 5–10 peers rather than chasing mass metrics until the open wave arrives.

#### Full-Circle Coverage
1. **Trigger:** Posting creative work to crickets, hating self-promotion, or wanting to find kindred creative peers and patrons.
2. **Evidence & Diagnosis:** Evaluates **11th house**, **`A11` (Labha Pada)**, **`D7` 11th**, and Moon/Venus/Jupiter public-resonance links. *(Notes `D11` Ekadashamsha proxy via `D1` 11th + `A11` + `D9` 11th + `D7` 11th pending full `D11` engine export).*
3. **Behavioral Action:** Maps audience-resonance peaks (`PeriodStrip`) and prescribes 4-tier authentic sharing behaviors.
4. **Resolution:** Completes the creative cycle back into Card 56 (*Creative Flow*) or bridges commercial demand to Card 59 (*Monetizing*).

#### Single Past-Event Calibration Question
> "When your creative work received genuine appreciation in the past, did it come mainly through intimate word-of-mouth and small peer circles—or through broader public platforms?"

#### 4-Tier Behavioral Playbook
- **Sattvic (Optimal):** Share your finished work generously as a bridge of beauty and meaning, trusting the right listeners will find it without manipulative hype.
- **Rajasic (Pragmatic Leverage):** Focus on niche, high-trust communities (curated newsletters, local guilds, specialized showcases) where your exact planetary aesthetic resonates deeply.
- **Mediocre (Passive/Mixed):** Measure creative worth by daily social-media vanity metrics, or hide finished work completely out of fear of lukewarm algorithms.
- **Baseline (Zero-Loss Floor):** Never chase viral outrage or compromise artistic integrity for short-term clicks during a turbulent `A11` transit.

#### Deep Astrological Mechanics
- **Nakshatras, Padas & Navatara:** Checks nakshatras of `11th lord`, `A11`, Moon, and Venus. Public-magnet stars (*Rohini, Pushya, Purva Phalguni, Swati, Shravana, Revati*) draw warm patronage effortlessly; **Mitra** (8) and **Param Mitra** (9) Taras mark prime gallery/publication/community outreach dates.
- **Rasi, Houses, Karakas, Arudhas & Yogas:** Assesses **11th house** (patrons, fans, collective gains), **`A11` (Labha Pada)** (how audience perceives your gift), **`A5`**, **Moon** (public heart-resonance), **Venus** (aesthetic allure), and **Jupiter** (ethical/generous patronage). Checks *Moon-Venus* and *Jupiter-11th* aspect yogas.
- **Divisional Charts (`D7`, `D1`, `D9`, `D11 Proxy`):**
  - Evaluates **`D7` 11th house** (reception of creative offspring) alongside **`D11` proxy (`D1` 11th + `A11` + `D9` 11th + `D10` 11th)** until `D11` export is wired in the sidereal engine.
  - **Age-36 Gate:** Post-36 (`ageYears > getD9MaturityAgeYears()`), checks `evaluateD1D9MutualConfirmation` on 11th lord, Moon, and Venus (`confirmed_strong` yields loyal, multi-decade patronage rather than fleeting viral spikes).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`11th lord`, `5th lord`, `Venus`, `Jupiter`, `Moon`, or `Rahu` periods for broad digital reach), checking 9x9 Matrix (`2/11` *Labha* and `1/5/9` *Trikona* links) and *Narayana Dasha* hitting `A11` or `11th`.
- **Transits (Gochar) & Ashtakavarga:** Monitors **Jupiter** transiting 11th/3rd/5th/7th (expanding audience & generous mentors), **Rahu** in 11th (unconventional/digital reach—requiring strong `SAV` to keep quality high), and `D1` 11th `HouseCard.sav` ($\ge 30$ signals natural community magnetism).
- **Tithi Pravesha (TP):** Evaluates `tpRowIn(view, tpInfo, 'D7')` 11th house, *Yashas* / *Mitra* / *Labha* Sahams, Muntha in 11th/5th/9th, and *Tithi Ashtottari* audience peaks within `[tp_start, tp_end]`.

#### Google Search Trends Synthesis
Addresses heartfelt creator queries (*"will my art find an audience astrology"*, *"building a creative audience birth chart"*, *"where are my patrons astrology"*). Independent makers want to know where their authentic tribe lives—small curated salons vs broad internet stages—and when sharing effort yields real connection.

#### Classical Attribution
- *BPHS* Ch. 7 (`D7` Saptamsha) & Ch. 21 (11th *Labha* Bhava — community, friends, patrons).
- *Jaimini Upadesha Sutras* Ch. 1.1–1.3 (`A11` Labha Pada & `A5` Mantra Pada public reception).
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (Moon public rapport, Venus aesthetic magnetism, Jupiter patronage).
- *Tithi Pravesha* (Pt. Sanjay Rath) — *Yashas* Saham and `TP D7` 11th-house audience openings.

---

## 4. Attribution & Source Credits Summary

| Source / Tradition | Author / Lineage | Scope Applied in Dashboard 07 |
| :--- | :--- | :--- |
| *Brihat Parashara Hora Shastra (BPHS)* | Maharishi Parashara | `D7` Saptamsha, `D16` Shodashamsa, `D24` Siddhamsha, `D10` & `D2`, 3rd/5th/11th Bhavas, Ashtakavarga (`SAV`). |
| *Jaimini Upadesha Sutras* | Maharishi Jaimini | `A5` (Mantra Pada), `A11` (Labha Pada), `A3`, `A10`, Rasi Drishti, Narayana/Chara Dashas. |
| *Phaladeepika* | Mantreswara | Saturn/Ketu blocks on 5th house (Card 58), Mars/Saturn execution transits (Card 60), *Saraswati/Kalanidhi* yogas. |
| *Saravali* | Kalyana Varma | Saturn-Venus and Ketu-Mercury creative constriction yogas, Vargottama artistic endurance. |
| *Uttara Kalamrita* | Kalidasa | Detailed artistic, musical, literary, manual, and sensory karakatvas of Venus, Mercury, Mars, Moon, and Jupiter. |
| *Prasna Marga* | Panakkattu Namboodiri | Creative block / *Manasa Nakshatra* & Gandanta diagnostics, launch timing filters. |
| *Tithi Pravesha: Vedic Annual Horoscopy* & *Crux of Vedic Astrology* | Pt. Sanjay Rath (Puri Tradition) | `D7` as creative/mental offspring, `TP D7`/`D16`/`D24` annual containers, `yearLord`, *Vidya*/*Karya Siddhi*/*Yashas* Sahams. |
| *Taittiriya Brahmana* & *Muhurta Chintamani* / *B.V. Raman* | Vedic Samhitas / Daivajna Rama / B.V. Raman | Nakshatra deities (*Chitra*, *Hasta*, *Shravana*) for craft mediums; *Sadhaka*/*Sampat*/*Mitra* Taras for shipping. |
| *Timing Events Through Vimshottari Dasha* | K.N. Rao | Double transit (`S6D`) for public creative launches and patronage breakthroughs. |
| Internal Architecture & Research Specs | AI AdAstra Engineering | `docs/reading-engine/76`, `docs/reading-engine/78` (including `D11` proxy note), `SOUL.md`, `src/reading/dasha/dashaAssessment.ts`. |
