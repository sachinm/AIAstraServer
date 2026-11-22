# Dashboard 03: Friendships & Social Circle (Cards 23–29)

**Document Status:** Architecture & Card Specification (Milestone 2 — Relationships Track)  
**Dashboard Slug:** `relationships.friendships` (sub-lens under `/love`)  
**Card Range:** Cards `#23` – `#29` (7 Cards Total)  
**Related Specs:** [`00-plan.md`](./00-plan.md), [`docs/reading-engine/78-love-work-dashboard-separation-and-cards.md`](../reading-engine/78-love-work-dashboard-separation-and-cards.md), [`docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`](../reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md), [`docs/reading-engine/75-self-foundation-card.md`](../reading-engine/75-self-foundation-card.md), [`docs/reading-engine/80-radha-and-catalogue-gap-analysis.md`](../reading-engine/80-radha-and-catalogue-gap-analysis.md)

---

## 1. Domain Overview & Astrological Separation Rationale

Platonic friendship, community belonging, and wise mentorship are governed by the **11th house** (*Labha Bhava* — true allies, social networks, shared aspirations), **3rd house** (peers, neighborhood circles, casual banter), **9th house** (elders, philosophical mentors, spiritual community), and **A11** (*Labha Pada*). Previously, friendships were buried as a single neglected sub-area inside a generic "Love" board (`love_friends`), conflating romantic longing (`5th`/`Venus`) with platonic loyalty (`11th`/`Jupiter`/`Mercury`). Separating **Friendships & Social Circle** gives users—whether single, married, or in transition—a dedicated sanctuary to pace their social battery, recognize loyal confidants, release draining circles without guilt, and welcome aligned communities.

### 1.1 Dashboard Metadata

| Property | Specification |
|---|---|
| **Default Routing (`person_facts`)** | Universal companion sub-lens under `/love` (Relationships); promoted automatically when `person_facts` highlights `social_isolation`, `relocated`, `seeking_community`, or `focus === 'friendships'`. |
| **Pinned Starter Cards (Default 5)** | `#23 friends.social_energy`, `#24 friends.core_allies`, `#25 friends.outgrowing_circles`, `#26 friends.finding_tribe`, `#27 friends.boundaries_drains`. |
| **Picker-Available Cards (2)** | `#28 friends.mentors_guides`, `#29 friends.reputation_belonging`. |
| **Primary Houses (`D1`)** | `11th` (loyal friends, social networks, collective gains), `3rd` (peers, siblings, casual associates, local gatherings), `9th` (mentors, teachers, dharmic community), `12th` (solitude, hermit recharge, energy leaks), `6th` (one-sided obligations, petty friction), `10th` (public social standing). |
| **Primary Karakas & Arudhas** | `Jupiter` (wise friends, mentors, generous allies), `Mercury` (intellectual peers, lively banter), `Moon` (emotional confidants, resonance), `Rahu` (diverse/unconventional networks), `Ketu` (shedding superficial circles), `A11` (*Labha Pada*), `AL` (*Arudha Lagna*), `BK` (*Bhratrukaraka* — siblings/mentors), `MK` (*Matrukaraka* — emotional comfort). |
| **Primary Divisional Charts** | `D1` (daily social circle), `D9` (*Navamsha* — karmic durability of allies & age-36+ gate), **`D11` (*Ekadashamsha* — via Engine Proxy until `D11` is served)**. |
| **Secondary / Diagnostic Vargas** | `D10` (`11th` house proxy for mixed social-professional circles), `D24` (`9th` house for intellectual mentors in Card `#28`), `D3` (*Drekkana* — peer/sibling dynamics). |

### 1.2 Full-Circle Coverage Matrix

| Functional Pillar | Cards Covered | What It Guarantees for the User |
|---|---|---|
| **Social Capacity & Pacing** | `#23` Your Social Energy This Year | Balances group participation against quiet solitude so social fatigue never feels like personal failure. |
| **Loyal Core & Mentors** | `#24` Friends Who Truly Carry You, `#28` Mentors & Supportive Guides | Identifies dependable, soul-aligned confidants and wise elders versus fair-weather acquaintances. |
| **Friction, Outgrowing & Limits** | `#25` Outgrowing Circles, `#27` Boundaries & Energy Drains | Normalizes natural friendship completions and provides clean boundaries against one-sided draining bonds. |
| **Belonging & Expansion** | `#26` Finding Your Tribe, `#29` Social Reputation & Belonging | Times aligned group openings and clarifies how the native's authentic presence lands in collective spaces. |

---

## 2. Shared Engine Contracts, `D11` Proxy & Age-36 `D9` Gate

### 2.1 Engine Boundary & `D11` (*Ekadashamsha*) Proxy Architecture
- **Zero Node Astrology:** All planetary coordinates, Nakshatra taras, `A11`/`AL`, `D1`/`D9`/`D10`/`D24` house cards, 40+ Dasha rows, and Tithi Pravesha returns come strictly from `kundli_digest` (`DigestView`) and `kundli_activation` (`ActivationRow[]`) computed by the backend calculation engine (`AIAstra_Radha` / `pyjhora`).
- **`D11` (*Ekadashamsha*) Engine Gap & Proxy (`doc 78` §5.1 & `doc 80`):** Although `D11` exists in `VARGA_FACTORS`, `SERVED_VARGAS` (`src/reading/chartData/catalog.ts:133`) currently serves `{1, 2, 4, 7, 9, 10}` and `VARGA_SCOPE` omits `D11` Arudha/Argala exports. Until `D11` is unlocked and served, Dashboard 03 cleanly proxies social-gain and friend-circle durability via **`D1 11th` + `A11` + `D9 11th` + `D10 11th`** without blocking launch or leaking gaps onto user-facing cards.
- **Caching & Sub-Technique Architecture:** Shared friendship ledgers run once as `love.sub.friends_*` into `technique_outputs`, area cards perform pure selection into `AreaBrief`, LLM prompts (`Oracle` + `Personalizer`) enforce stable cached natal prefixes (`parts[0]` >= 1,024 tokens, `cachePrefix: true`) with 45-minute used-cache recycling (`READING_CACHE_RECYCLE_MINUTES = 45`).
- **Strict Redaction (`SOUL.md` §1 & `doc 75`):** Zero engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) and zero Sanskrit jargon (`Labha Pada`, `Tara Bala`, `Ketu`) on card faces or Oracle Questions; evidence keys (`D1.h11`, `D1.pt.A11`, `D9.h11`) live exclusively inside **Chart details**.

### 2.2 Age-36 Navamsha (`D9`) Maturity Gate
Every card in Dashboard 03 enforces `ageYears > getD9MaturityAgeYears()` (`src/config/env.ts`, default `36`):
- **Pre-36 (`ageYears <= 36`):** Friendships revolve heavily around `D1` `3rd`/`11th` shared activities, school/early-career proximity, and experimentation.
- **Post-36 (`ageYears > 36`):** Mandatory joint `D1 + D9` confirmation (`evaluateD1D9MutualConfirmation`) on `11th lord`, `9th lord`, `Jupiter`, `Mercury`, and active MD/AD lords. Post-36 friendships shed performative popularity (`D1` `3rd`/`Rahu`) in favor of `D9` `11th`/`9th` shared values and quiet loyalty (`d9_redeemed` transforms early social awkwardness into deep chosen family; `d9_weakened` warns against superficial fair-weather crowds).

### 2.3 Anti-Sycophancy, 4-Tier Playbook & Toolbar Vetting
- **Rule 0 Multi-Entity Disambiguation (`SOUL.md` §2):** Never lump every friend or elder into one planetary stereotype; separate casual `3rd`-house peers, `11th`-house confidants/elder siblings, and `9th`-house mentors cleanly.
- **4-Tier Playbook (`SOUL.md` §3):** Every social handicap (e.g., `Ketu` detachment in `11th`, `6th`/`12th` drain) delivers `Sattvic`, `Rajasic`, `Mediocre`, and `Baseline` behavioral guidance.
- **5-Gate Toolbar Vetting:** Enforces `.agents/skills/dashboard-card-toolbar-vetting/SKILL.md` (`Chart details` always visible; optional tools gated; single past-event calibration question per card).

---

## 3. Card Specifications (Cards 23–29)

---

### Card 23: Your Social Energy This Year
- **Card Number:** `23`
- **Card Name:** `Your Social Energy This Year`
- **Card Slug:** `friends.social_energy`
- **Subtitle:** `When outward socializing energizes you, and when quiet solo recharge matters`
- **Default Placement:** Pinned starter card (`suggested: true`).

#### Area of Focus
Mapping the native's fluctuating bandwidth for socializing, group commitments, and extroverted engagement versus genuine physiological/emotional need for solitude and quiet recharge across the next 12 months.

#### Oracle Question
*"Across the coming 12 months, which dated stretches energize you through active social connection, and when do you genuinely need quieter solo time to recharge?"*
- **Window Grounding:** Divides the active TP return (`tp_start`..`tp_end`) into `Outward stretch` (`11th`/`3rd`/`Jupiter`) versus `Quiet recharge stretch` (`12th`/`Saturn`/`Ketu`), eliminating guilt over fluctuating social batteries.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Adapts to `age_band`, `work_load` (high-peopling jobs need more `12th` recharge), and `living_situation` (living alone vs. busy household).
- **Stance Resolution:** `build` (accept invitations, host small gatherings, expand calendar) during `11th`/`3rd`/`Moon` ease; `get_through` (protect evenings, say no without guilt, decline crowded events) when `12th`/`Saturn`/`Ketu` dominate or TP `yearLord` is unresolved.
- **4-Tier Behavioral Guidance:** *Sattvic:* Honor natural ebb and flow—be fully present when out and unapologetically restful when inward; *Rajasic:* Batch social commitments into high-energy weeks and block recovery days on your calendar; *Mediocre:* Force attendance when exhausted and feel resentful or flat; *Baseline:* Ghost reliable friends completely during quiet seasons without a brief honest check-in.
- **Single Past-Event Calibration Question:** *"Between [prior_inward_start] and [prior_inward_end], did group plans feel noticeably heavier than usual, making quiet time at home essential?"*

#### Full-Circle Coverage
Measures `11th` (social outwardness) vs. `12th` (solitude) tension -> names exact seasonal battery shifts (Timeline) -> gives practical calendar pacing (Action) -> routes high-battery windows to Card `#26` (Tribe) and drain-heavy seasons to Card `#27` (Boundaries) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Moon` and `Mercury` nakshatras (`Ashwini`/`Swati`/`Punarvasu` agile social cadence vs. `Uttara Bhadrapada`/`Anuradha`/`Moola` deeper selective solitude); tracks `Navatara` `Janma` (1), `Kshema` (4), `Mitra` (8) vs. `Vipat`/`Pratyak` battery dips.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Balances **`11th house`** (social gatherings, outer network) against **`12th house`** (seclusion, sleep, hermitage) and `3rd house` (casual local chatter). Checks `Moon` (*Manas* emotional stamina), `Mercury` (conversational bandwidth), `Saturn` cooling `11th`/`1st`, and `A11` vs. `AL` visibility load.
- **Divisional Charts (`D1`, `D9` + `D11` proxy):** Compares `D1` `11th`/`12th` energy with `D9` `11th`/`12th` (`D11` proxy via `D1 11th + A11 + D9 11th + D10 11th`). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `11th lord`, `Moon`, and `Mercury` reveals whether social stamina shifts toward fewer, deeper gatherings (`D9` inwardness).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`Vimshottari`, conditional, `Narayana`/`Chara`, `Yogini`) for `11th`/`3rd` sub-periods (high outreach) vs. `12th`/`8th`/`Saturn`/`Ketu` sub-periods (introverted recovery), weighted by `AntardashaFruitionCell` and `Moon`/`Mercury` `avasthaMultipliers`.
- **Transits (Gochara):** Tracks `Saturn` transiting `11th` or `1st`/`12th` from Moon (selective pruning of social energy), `Moon` *Chandra Bala*, `Venus`/`Mercury` transits through `11th`/`3rd`, and `SAV` bindus in `11th` vs. `12th`.
- **Tithi Pravesha (TP):** Anchored in `runningTithiPravesha` (`tp_start`..`tp_end`). Evaluates `TP Lagna`, `TP 11th` vs. `TP 12th`, `Muntha` house placement (`11th` outward vs. `12th` retreat), `yearLord`, and `Tithi Ashtottari` sub-periods.

#### Google Search Trends Synthesis
Synthesizes relatable modern queries (*"social battery horoscope"*, *"why do I feel socially drained astrology"*, *"introvert vs extrovert birth chart"*) by framing introversion/extroversion dynamically across time rather than locking someone into a static label.

#### Classical Attribution
- *BPHS* Ch. 14 (`3rd` peer engagement), Ch. 22 (`11th` social circles), Ch. 23 (`12th` solitude/retreat)
- *Phaladeepika* Ch. 26 (`Saturn` & `Moon` Gochara stamina shifts)
- *Tithi Pravesha* (Pt. Sanjay Rath) — `Muntha` in `11th` vs. `12th` annual energy focus
- *Muhurta Chintamani* — `Chandra Bala` & `Navatara` social receptivity

---

### Card 24: The Friends Who Truly Carry You
- **Card Number:** `24`
- **Card Name:** `The Friends Who Truly Carry You`
- **Card Slug:** `friends.core_allies`
- **Subtitle:** `The loyal confidants who truly show up, and where to invest your trust`
- **Default Placement:** Pinned starter card (`suggested: true`).

#### Area of Focus
Identifying the exact archetypes and relational qualities of loyal, ride-or-die confidants who genuinely show up during hard seasons—distinguishing true allies from superficial acquaintances.

#### Oracle Question
*"What kind of people show up as your most loyal, dependable friends—and where in your current life do those steadying allies reside?"*
- **Window Grounding:** Highlights when existing core allies step forward (`11th`/`Jupiter`/`Mitra` windows) and contrasts lifelong loyal anchors with transient acquaintances.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Respects `age_band` and `social_circle` context; uses `SOUL.md` Rule 0 to disambiguate distinct friend roles (practical elder/sibling vs. peer confidant vs. intellectual ally).
- **Stance Resolution:** `build` (invest time, reciprocate generosity, lean on trusted 2–3 friends) when `11th`/`A11`/`Jupiter` are strong; `get_through` (appreciate the few quiet constants rather than expecting a huge crowd) when `11th` has malefic load.
- **4-Tier Behavioral Guidance:** *Sattvic:* Cultivate mutual loyalty, show up in others' storms without tallying favors; *Rajasic:* Deliberately prioritize your top 3–5 high-integrity friendships over 50 shallow contacts; *Mediocre:* Neglect steady old friends while chasing glamorous newcomers; *Baseline:* Expect loyalty from people you only keep around for convenience or gossip.
- **Single Past-Event Calibration Question:** *"During a tough stretch around [past_support_dates], did one steady friend or sibling-like ally step up in a quiet, practical way?"*

#### Full-Circle Coverage
Profiles true-ally signatures (`11th` benefics/`A11`/`Mitra` taras) -> separates loyal core from fair-weather peers (`Rule 0`) -> guides active reciprocity (Action) -> pairs with Card `#25` (Outgrowing Circles) to prune noise (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `11th lord`, `A11` lord, and `Jupiter` nakshatras; checks `Mitra` (8th) and `Param Mitra` (9th) taras and friendly planetary stars (*Pushya*, *Anuradha*, *Punarvasu*, *Shravana*, *Revati*) indicating steadfast, faithful friends.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `11th house`, `11th lord`, **`A11` (*Labha Pada*)**, `Jupiter` (wise, generous allies), `Venus` (warm, supportive companions), unafflicted `Mercury` (communicative confidants), and `BK` (*Bhratrukaraka* — siblings/peer-allies). Inspects benefic `Argala` on `11th` and `Lagna`.
- **Divisional Charts (`D1`, `D9`, `D10` + `D11` proxy):** Uses `D1 11th + A11 + D9 11th + D10 11th` (`D11` proxy per `doc 78` §5.1). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `11th lord` and `Jupiter` shows whether early friend groups thin down into lifelong dharmic kinship (`d9_redeemed`/`confirmed_strong`).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`11th lord`, `Jupiter`, `9th lord`, or `Mitra`-tara AD/PD) showing when loyal friends play pivotal stabilizing roles; checks `AntardashaFruitionCell` `1/5/9` & `2/11` support.
- **Transits (Gochara):** Tracks `Jupiter` aspecting or transiting `11th`, `Lagna`, or `Moon` (allies appearing right on cue), `Saturn` in `11th` (older, sober, fiercely loyal friends rather than party crowds), and `SAV >= 30` in `11th`.
- **Tithi Pravesha (TP):** Evaluates `TP` `11th house`, `TP D9` `11th`, *Mitra/Punya Saham*, and `yearLord` connection to `11th`/`Jupiter`.

#### Google Search Trends Synthesis
Addresses enduring human search queries (*"true friends astrology"*, *"11th house friends birth chart"*, *"who are my real friends horoscope"*) with grounded insight into *what kind of friend* sustains the native—and how to be one in return.

#### Classical Attribution
- *BPHS* Ch. 22 (`11th` Labha/Mitra Bhava — friends & elder allies)
- *Jaimini Upadesha Sutras* (`A11` Labha Pada, `BK`, benefic `Argala`)
- *Phaladeepika* Ch. 18 (`11th` house friendships & planetary benefics)
- *SOUL.md* §2 (Rule 0 — disambiguating distinct allies across `3rd`, `11th`, and `9th`)

---

### Card 25: Outgrowing Circles & Friendship Friction
- **Card Number:** `25`
- **Card Name:** `Outgrowing Circles & Friendship Friction`
- **Card Slug:** `friends.outgrowing_circles`
- **Subtitle:** `Distinguishing temporary friendship friction from a natural season of outgrowing circles`
- **Default Placement:** Pinned starter card (`suggested: true`).

#### Area of Focus
Understanding why certain friendships cool off, fracture, or feel misaligned during transitional life chapters—normalizing natural karmic completion (`Ketu`/`Saturn` on `11th`/`A11`) without bitterness or paranoia.

#### Oracle Question
*"Why are certain friendships feeling distant or strained right now, and is this a temporary rough patch or a natural season of outgrowing an old circle?"*
- **Window Grounding:** Dates the pruning or friction cycle (`"Circle shift stretch: <from> – <to>"`) and distinguishes reversible misunderstandings from clean completions.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Sensitive to `life_transition` (`moved`, `married`, `new_job`, `sober/growth_shift`) and `age_band` (Saturn Return late-20s & post-36 `D9` circle pruning).
- **Stance Resolution:** `get_through` (release gracefully, don't force dead dynamics or start smear campaigns) during `Ketu`/`Saturn`/`6th`/`8th` hits to `11th`/`A11`; `build` (repair salvageable misunderstandings) once `Mercury`/`Jupiter` clarity returns.
- **4-Tier Behavioral Guidance:** *Sattvic:* Bless the shared past, release mismatched bonds peacefully, and wish them well; *Rajasic:* Address direct issues once cleanly; if unreciprocated, reallocate your time deliberately; *Mediocre:* Cling to expired group chats out of fear of change or passive-aggressively drift; *Baseline:* Gossip, retaliate, or burn bridges publicly during a `6th`/`Rahu` flare-up.
- **Single Past-Event Calibration Question:** *"Around [ketu_saturn_11th_start], did a long-standing friend or group dynamic begin quietly fading or feel suddenly out of sync?"*

#### Full-Circle Coverage
Diagnoses friction vs. natural completion (`Ketu`/`Saturn` vs. `6th`/`8th`/`Rahu`) -> names the cycle window (Timing) -> guides graceful release or clean repair (Action) -> routes space cleared to Card `#26` (Finding Your Tribe) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Checks `Ketu` and `Saturn` nakshatras relative to `11th lord` and `A11` lord; flags `Vipat` (3), `Pratyak` (5), `Vadha` (7) taras, or `64th Navamsha` (`K64M`) transit triggers affecting social harmony.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines `Ketu` or `Saturn` in/aspecting `11th` or `A11` (natural detachment/pruning of fake circles), `6th lord` (arguments/jealousy) or `8th lord` (sudden betrayal/estrangement) linked to `11th`, and `Rahu` creating clique factionalism or gossip (`11th`/`3rd`).
- **Divisional Charts (`D1`, `D9` + `D11` proxy):** Compares `D1` `11th` disruption with `D9` `11th` (`D11` proxy). Above `getD9MaturityAgeYears()` (`> 36`), `d9_weakened` or `confirmed_weak` on `11th lord` explains why superficial `D1` social networks dissolve post-36 to make room for authentic values.
- **Dasha Systems:** Identifies `Ketu`, `Saturn`, `6th`, or `8th` lord sub-periods (`resolveActiveMahadasha`) and `6/8` or `2/12` `AntardashaFruitionCell` transitions where old social contracts expire.
- **Transits (Gochara):** Tracks `Ketu` or `Saturn` transiting natal `11th house`, `11th lord`, or `A11`; `Rahu` creating sudden disillusionment in `11th`; `Mars` transiting `11th`/`3rd` (sharp peer arguments); `SAV < 25` in `11th` heightening sensitivity.
- **Tithi Pravesha (TP):** Checks `TP` `11th` afflicted by `6th`/`8th` lords, `Muntha` in `6th`/`8th`/`12th`, and `Tithi Ashtottari` sub-periods marking peak social-pruning dates.

#### Google Search Trends Synthesis
Addresses widespread modern distress queries (*"friendship breakup astrology"*, *"outgrowing friends birth chart"*, *"why do friends turn against me horoscope"*) by normalizing `Ketu`/`Saturn` pruning as healthy maturation rather than a character flaw.

#### Classical Attribution
- *BPHS* Ch. 17 (`6th` enmity), Ch. 19 (`8th` estrangement), Ch. 22 (`11th` network shifts)
- *Phaladeepika* Ch. 26 (`Ketu` & `Saturn` transit detachment in `11th`)
- *Jaimini Upadesha Sutras* (`A11` *Labha Pada* & *Virodhargala* on `11th`)
- *SOUL.md* §3 — Graceful `Sattvic` detachment vs. `Baseline` retaliation

---

### Card 26: Finding Your Tribe & New Communities
- **Card Number:** `26`
- **Card Name:** `Finding Your Tribe & New Communities`
- **Card Slug:** `friends.finding_tribe`
- **Subtitle:** `Dated windows and shared-interest spaces where kindred friends naturally appear`
- **Default Placement:** Pinned starter card (`suggested: true`).

#### Area of Focus
Timing when new, aligned friendships and kindred-spirit communities open up—and identifying the specific environments (learning groups, creative/hobby spaces, spiritual circles, professional guilds, or international networks) where those connections naturally spark.

#### Oracle Question
*"During which upcoming date windows—and through what kinds of spaces or shared interests—are you most strongly supported to meet kindred-spirit friends?"*
- **Window Grounding:** Pinpoints dated community-opening windows (`"Community opening window: <from> – <to>"`) so users invest effort when social doors are genuinely open.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `relocated` / `new_city`, `hobby_focus`, `age_band`, and `work_mode`.
- **Stance Resolution:** `build` (join clubs, attend workshops, host dinners, say yes to group invites) during `11th`/`9th`/`3rd` + `Jupiter`/`Rahu` openings; `get_through` (nurture 1–2 existing seeds quietly) during dormant `12th` windows.
- **4-Tier Behavioral Guidance:** *Sattvic:* Join communities centered on service, learning, or shared craft rather than status; *Rajasic:* Show up consistently for 8–12 weeks in one curated group to turn acquaintances into real friends; *Mediocre:* Attend one event, feel awkward, and conclude "nobody fits me"; *Baseline:* Latch onto high-drama cliques just to avoid eating alone.
- **Single Past-Event Calibration Question:** *"Around [prior_11th_jupiter_window], did a new group, class, or social circle unexpectedly bring warm new people into your life?"*

#### Full-Circle Coverage
Diagnoses aligned community venues (`3rd`/`9th`/`11th` + `Jupiter`/`Rahu`) -> dates opening windows (Timing) -> prescribes consistent low-pressure participation (Action) -> pairs with Card `#28` (Mentors) and `#29` (Belonging) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `11th lord`, `9th lord`, `3rd lord`, and `Jupiter`/`Rahu` nakshatras; checks `Sadhaka` (6), `Sampat` (2), `Mitra` (8), `Param Mitra` (9) taras for social expansion.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Maps venue by house link: `11th + 9th` (spiritual, travel, university, philosophical communities), `11th + 3rd` (neighborhood, writing, hobby, local clubs), `11th + 5th` (arts/parenting/creative groups), `Rahu` in `11th`/`A11` (diverse, tech, cross-cultural circles).
- **Divisional Charts (`D1`, `D9` + `D11` proxy):** Cross-checks `D1` `11th`/`9th`/`3rd` openings with `D9` `11th`/`9th` (shared values) and `D10` `11th` (`D11` proxy). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `D9` `11th`/`9th` ensures new adult friendships rest on authentic values (`d9_redeemed` / `confirmed_strong`).
- **Dasha Systems:** Tracks MD/AD/PD (`resolveActiveMahadasha` + *Chara/Narayana Dasha* of `11th`/`A11` sign) activating `11th`, `9th`, `3rd`, `Jupiter`, or dignified `Rahu`, with `1/5/9` or `2/11` `AntardashaFruitionCell` ease.
- **Transits (Gochara):** Tracks `Jupiter` transiting `11th`, `3rd`, `9th`, or `1st` (or aspecting `11th`/`A11`), `Venus`/`Mercury` triggering `11th`, `Rahu` energizing `11th` with fresh diverse networks, and `SAV >= 28` in `11th`.
- **Tithi Pravesha (TP):** Evaluates `TP` `11th` and `9th`, `Muntha` in `11th`/`3rd`/`9th`, `yearLord` linking to `11th`, and *Punya/Mitra Saham* activations inside `tp_start`..`tp_end`.

#### Google Search Trends Synthesis
Addresses growing adult-loneliness search intent (*"making new friends as an adult astrology"*, *"how to find my tribe birth chart"*, *"community and social circle horoscope"*) with actionable, non-cringey community-building timelines.

#### Classical Attribution
- *BPHS* Ch. 14 (`3rd` neighbors/peers), Ch. 20 (`9th` higher-purpose community), Ch. 22 (`11th` social networks)
- *Jaimini Upadesha Sutras* (`A11` *Labha Pada*, *Narayana/Chara Dasha* of `11th`)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Rahu` foreign/diverse groups, `Jupiter` wise communities)
- *K.N. Rao* — `Jupiter` & `Saturn` transits activating `11th` house networks

---

### Card 27: Boundaries & Energy Drains
- **Card Number:** `27`
- **Card Name:** `Boundaries & Energy Drains`
- **Card Slug:** `friends.boundaries_drains`
- **Subtitle:** `Spotting one-sided obligations early and holding kind, clear boundaries`
- **Default Placement:** Pinned starter card (`suggested: true`).

#### Area of Focus
Spotting one-sided friendships, chronic emotional dumping, blurred obligations, and subtle manipulation (`6th`/`12th`/`Rahu`/`Moon` sensitivity) so the native holds clean boundaries without needless drama.

#### Oracle Question
*"Where are personal boundaries blurring inside your friendships right now, and how can you protect your energy calmly without creating unnecessary conflict?"*
- **Window Grounding:** Highlights vulnerable sensitivity windows (`Moon`/`6th`/`12th` drain stretches) when people-pleasing or boundary fatigue peaks, and calmer dates to reset expectations.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored for empathetic or caregiving personalities (`Moon`/`12th`/`6th` emphasis); supports healthy "no" scripts without guilt.
- **Stance Resolution:** `get_through` (step back gently from draining vents, limit availability, protect sleep/time) during `6th`/`12th`/`Rahu–Moon` stretches; `build` (renegotiate mutual reciprocity cleanly) when `Mars`/`Saturn`/`Sun` clarity supports firm limits.
- **4-Tier Behavioral Guidance:** *Sattvic:* Say no kindly and clearly without over-explaining or rescuing people from their own choices; *Rajasic:* Enforce practical limits on late-night calls, favors, and unpaid emotional labor; *Mediocre:* Resentfully say "yes" while feeling used, then pull away silently; *Baseline:* Enable toxic dependency or blow up after months of silent accommodation.
- **Single Past-Event Calibration Question:** *"Around [6th_12th_moon_drain_dates], did a one-sided friendship or constant favor-asking leave you noticeably depleted?"*

#### Full-Circle Coverage
Detects boundary-leak wiring (`6th`/`12th`/`Moon`/`Rahu`) -> identifies peak vulnerability stretches (Timing) -> delivers calm boundary-setting scripts via the 4-Tier Playbook (Action) -> complements Card `#25` (Outgrowing Circles) and `#23` (Social Energy) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Moon` and `11th`/`12th` lord nakshatras (hyper-empathic *Ashlesha*, *Revati*, *Anuradha*, *Purva Bhadrapada*); flags `Pratyak` (5th — opposition/resistance) and `Vipat` (3rd) taras when draining dynamics surface.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines `12th house` (energy leakage, hidden emotional cost) and `6th house` (one-sided service/debt, petty envy) linked to `11th` or `A11`; `Moon` conjoined/aspected by `Rahu` or `Ketu` (porous boundaries, absorbing others' anxiety); weak `Mars` (difficulty saying no) or `6th lord` in `11th`.
- **Divisional Charts (`D1`, `D9` + `D11` proxy):** Evaluates `D1` `6th`/`11th`/`12th` alongside `D9` `11th`/`12th`/`Moon`. Post-36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `Moon` and `11th lord` shows whether boundary discernment strengthens (`d9_redeemed`) or remains an ongoing karmic discipline (`confirmed_weak`).
- **Dasha Systems:** Tracks `6th`/`12th` lord or `Rahu`/`Moon` sub-periods (`resolveActiveMahadasha`) and `2/12` or `6/8` `AntardashaFruitionCell` spans where giving outpaces receiving.
- **Transits (Gochara):** Tracks `Rahu`/`Ketu` transiting over natal `Moon` or `11th`, `Saturn` transiting `12th` from Lagna/Moon, `Mars` triggering `6th`/`12th`, and `SAV < 25` in `11th`/`12th` increasing susceptibility to social exhaustion.
- **Tithi Pravesha (TP):** Checks `TP` `6th` and `12th` houses, `Moon` dignity in `TP.D1`, *Kali Saham*, and `yearLord` pressure on the `6th/12th` axis.

#### Google Search Trends Synthesis
Addresses widely searched interpersonal struggles (*"draining friends astrology"*, *"setting boundaries with friends birth chart"*, *"toxic friendship signs horoscope"*) with practical, non-accusatory boundary literacy.

#### Classical Attribution
- *BPHS* Ch. 17 (`6th` debt/enmity), Ch. 23 (`12th` expenditure/drain)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Moon` mental vulnerability, `Mars` healthy boundary assertion)
- *Prasna Marga* Ch. 15 (spotting hidden emotional drains vs. mutual goodwill)
- *SOUL.md* §3 — 4-Tier boundary upgrade (`Sattvic` clean "no" vs. `Mediocre` people-pleasing)

---

### Card 28: Mentors, Elders & Supportive Guides
- **Card Number:** `28`
- **Card Name:** `Mentors, Elders & Supportive Guides`
- **Card Slug:** `friends.mentors_guides`
- **Subtitle:** `When wise elders and grounded mentors enter your path—and how to vet advice`
- **Default Placement:** Picker-available (`suggested: false`).

#### Area of Focus
Attracting, recognizing, and receiving wise counsel from experienced elders, teachers, spiritual/philosophical guides, and generous mentors (`9th house` + `Jupiter` + `D9 9th` + `D24 9th`).

#### Oracle Question
*"During which upcoming windows—and through what kinds of learning or community settings—are wise mentors, elders, or trusted advisors drawn into your path?"*
- **Window Grounding:** Pinpoints dated `9th`/`Jupiter` opening windows (`"Mentorship opening: <from> – <to>"`) and distinguishes genuine wise guides from self-serving authority figures.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored by `age_band` (seeking a mentor in 20s/30s vs. becoming a mentor while also having peer elders in 40s+) and `focus` (`spiritual`, `creative`, `life_guidance`).
- **Stance Resolution:** `build` (reach out to teachers, enroll in serious study, ask wise elders for perspective) when `9th`/`Jupiter`/`Sun` align; `get_through` (vet advice carefully, trust inner dharma over charismatic hype) if `Rahu`/`6th` afflicts `9th`.
- **4-Tier Behavioral Guidance:** *Sattvic:* Approach wise teachers with humility, curiosity, and readiness to practice what you learn; *Rajasic:* Seek out vetted domain elders and prepare thoughtful questions before asking for their time; *Mediocre:* Collect endless advice without applying it; *Baseline:* Surrender personal judgment blindly to charismatic gurus (`Rahu` in `9th` trap).
- **Single Past-Event Calibration Question:** *"Around [9th_or_jupiter_trigger_dates], did an older guide, teacher, or wise friend offer perspective that shifted your direction?"*

#### Full-Circle Coverage
Audits `9th` + `Jupiter` + `D9`/`D24` mentor receptivity -> disambiguates genuine elders from false teachers (`Rule 0`) -> dates connection windows (Timing) -> guides reciprocal mentorship (Action).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Jupiter`, `9th lord`, and `Sun` nakshatras (*Punarvasu*, *Pushya*, *Vishakha*, *Uttara Ashadha*, *Purva Bhadrapada*); checks `Param Mitra` (9th tara — supreme mentor) and `Sadhaka` (6th) taras.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `9th house` (*Dharma/Guru Bhava*), `9th lord`, `Jupiter` (*Naisargika Guru*), `Sun–Jupiter` benefic alignments, `BK` (*Bhratrukaraka* — guides/teachers), and `A9` (*Bhagya Pada*). Checks *Guru-Mangala* or *Gaja-Kesari* yogas vs. *Guru-Chandala* (`Jupiter–Rahu`, requiring careful discernment).
- **Divisional Charts (`D1`, `D9`, `D24`):** Pairs `D1` `9th` with **`D9` `9th`** (spiritual/moral mentors) and **`D24` `9th`** (intellectual/skill teachers, served when `D24` is enabled or via `D1`/`D9` `9th` + `Jupiter`). Above `getD9MaturityAgeYears()` (`> 36`), `evaluateD1D9MutualConfirmation` on `9th lord` and `Jupiter` shows mature peer-level wisdom exchanges (`confirmed_strong` / `d9_redeemed`).
- **Dasha Systems:** Tracks `9th lord`, `Jupiter`, `BK`, or `A9` sub-periods via `resolveActiveMahadasha` + `AntardashaFruitionCell` (`1/5/9` *Trikona* manifestation).
- **Transits (Gochara):** Tracks `Jupiter` transiting `1st`/`5th`/`9th`/`11th` or aspecting natal `9th`/`Lagna`/`Moon`, `Saturn` aspecting `9th` (seasoned, older, traditional elders), and `SAV >= 28` in `9th`.
- **Tithi Pravesha (TP):** Evaluates `TP` `9th house`, `yearLord` connection to `Jupiter`/`9th`, *Guru/Punya Saham*, and `Tithi Ashtottari` `Jupiter` windows inside `tp_start`..`tp_end`.

#### Google Search Trends Synthesis
Addresses reflective search queries (*"finding a mentor astrology"*, *"9th house guru and teachers"*, *"who will guide me in life birth chart"*) by combining classical `9th`/Jupiter doctrine with healthy critical discernment.

#### Classical Attribution
- *BPHS* Ch. 20 (`9th` Bhagya/Guru Bhava), Ch. 7 (*Siddhamsha D24* & *Navamsha D9*)
- *Jaimini Upadesha Sutras* (`BK`, `A9`, `Jupiter` karaka)
- *Phaladeepika* Ch. 17 (`9th` house teachers, dharma, and grace)
- *SOUL.md* §2 (Rule 0 — disambiguating constructive elders from unvetted authorities)

---

### Card 29: Social Reputation & Belonging
- **Card Number:** `29`
- **Card Name:** `Social Reputation & Belonging`
- **Card Slug:** `friends.reputation_belonging`
- **Subtitle:** `How your presence lands in wider groups, and deepening authentic belonging`
- **Default Placement:** Picker-available (`suggested: false`).

#### Area of Focus
Understanding how groups, social rooms, and communities naturally perceive the native (`AL` + `A11`) versus how the native feels inside—bridging image gaps to build authentic, lasting belonging.

#### Oracle Question
*"How does your presence naturally land inside groups and communities right now, and how can you cultivate deeper, authentic belonging without performing?"*
- **Window Grounding:** Maps periods when social goodwill and recognition rise (`AL`/`A11`/`10th–11th` harmony) versus awkward visibility or misinterpretation stretches (`Rahu`/`6th`/`12th` from `AL`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Adapts to `age_band` and `social_role` (community organizer, quiet contributor, newcomer).
- **Stance Resolution:** `build` (step into community contribution, host, share voice) when `AL`/`A11`/`Moon` enjoy benefic support; `get_through` (keep things low-key, let consistent actions speak over gossip) during `6th`/`8th`/`12th` from `AL` turbulence.
- **4-Tier Behavioral Guidance:** *Sattvic:* Let genuine kindness and reliability shape your reputation naturally; *Rajasic:* Show up visibly for community initiatives where your real strengths shine; *Mediocre:* Over-edit yourself to fit in and end up feeling unseen anyway; *Baseline:* Perform for status or react defensively to petty group gossip.
- **Single Past-Event Calibration Question:** *"Around [al_or_a11_trigger_dates], did you notice a shift in how a wider group or community viewed or welcomed you?"*

#### Full-Circle Coverage
Compares inner reality (`Lagna`) with outer social perception (`AL` & `A11`) -> diagnoses visibility friction vs. goodwill cycles (Timing) -> guides authentic contribution without people-pleasing (Action).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Moon` and `AL`/`A11` lord nakshatras (`Pushya`, `Anuradha`, `Uttara Bhadrapada`, `Rohini`, `Swati` foster quiet warmth and social trust); checks `Mitra` and `Kshema` taras for group ease.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines **`AL` (*Arudha Lagna*)** and **`A11` (*Labha Pada*)** interrelationship (`Kendra`/`Trikona`/`2-11` harmony vs. `6/8` or `12th` from `AL`), `10th–11th` lord *Sambandha* (earned social respect), and benefics in `2nd`/`4th`/`7th` from `AL` (graceful public perception).
- **Divisional Charts (`D1`, `D9` + `D11` proxy):** Compares `D1` `AL`/`A11` with `D9` `Lagna`/`11th` and `D10` `11th` (`D11` proxy). Above `getD9MaturityAgeYears()` (`> 36`), `evaluateD1D9MutualConfirmation` on `Lagna lord` and `11th lord` determines whether social reputation deepens with age (`confirmed_strong` / `d9_redeemed`) or exposes performative gaps (`d9_weakened`).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`AL` lord, `A11` lord, `10th`/`11th` lords, or *Narayana Dasha* of `AL`/`A11` signs) for seasons of heightened community standing vs. quiet privacy.
- **Transits (Gochara):** Tracks `Jupiter` aspecting `AL` or `A11` (warm collective goodwill), `Saturn` transiting `AL` (seriousness/responsibility in groups), `Rahu` on `AL` (polarized attention—high visibility + easy misreading), and `SAV` in `10th`/`11th`.
- **Tithi Pravesha (TP):** Evaluates `TP` `10th`/`11th` houses, *Yashas Saham* (fame/goodwill), `Muntha` in `10th`/`11th`, and `yearLord` impact on collective standing inside `tp_start`..`tp_end`.

#### Google Search Trends Synthesis
Addresses identity-in-community search queries (*"social reputation astrology"*, *"Arudha Lagna AL in society"*, *"do people like me birth chart"*) by explaining Jaimini `AL`/`A11` perception mechanics in warm, plain English.

#### Classical Attribution
- *Jaimini Upadesha Sutras* Ch. 1.1–1.4 (`Arudha Lagna AL`, `A11`, planets in Kendras/12th from `AL`)
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — *Arudha Lagna* vs. *Satyapeetha* (`Lagna`)
- *BPHS* Ch. 21–22 (`10th` standing & `11th` collective circles)
- *Tithi Pravesha* — *Yashas Saham* & annual `10th`/`11th` goodwill

---

## 4. Dashboard 03 Attribution & Source Catalog

| Source / Tradition | Author / Origin | Specific Sections / Concepts Applied | Role in Dashboard 03 |
|---|---|---|---|
| *Brihat Parashara Hora Shastra (BPHS)* | Maharishi Parashara | Ch. 14 (`3rd`), Ch. 17 (`6th`), Ch. 20 (`9th`), Ch. 21 (`10th`), Ch. 22 (`11th`), Ch. 23 (`12th`), Ch. 45–51 | House, Karaka, Dasha, and maturation structure across Cards `#23`–`#29`. |
| *Jaimini Upadesha Sutras* | Maharishi Jaimini | Ch. 1.1–1.4 (`AL`, `A9`, `A11`, `BK`, *Argala*, *Narayana/Chara Dasha*) | Social perception (`AL`), loyal allies (`A11`), mentors (`BK`/`A9`) in Cards `#24`, `#25`, `#26`, `#28`, `#29`. |
| *Phaladeepika* | Mantreswara | Ch. 17–18, Ch. 26 (*Gochara*) | `9th`/`11th` house fruit and `Ketu`/`Saturn` transit pruning in Cards `#23`, `#24`, `#25`, `#28`. |
| *Uttara Kalamrita* | Kalidasa | Kanda 1, Varga 4–5 | `Moon` sensitivity, `Mars` boundaries, `Rahu` diverse networks in Cards `#26`, `#27`. |
| *Prasna Marga* | Panakkattu Namboodiri | Ch. 15 | Discerning genuine goodwill vs. energy drains in Card `#27`. |
| *Tithi Pravesha* & *Crux of Vedic Astrology* | Pt. Sanjay Rath | `yearLord`, `Muntha`, *Punya/Mitra/Yashas Sahams*, `AL` vs. `Satyapeetha` | Bounded 12-month social energy and reputation windows across Cards `#23`–`#29`. |
| *Muhurta Chintamani* & *Lunar Astro* | Daivajna Rama / Deepanshu Giri | Navatara (`Mitra`, `Param Mitra`, `Kshema`, `Vipat`), `Chandra Bala`, `K64M` | Social receptivity timing and friction diagnosis in Cards `#23`, `#24`, `#25`, `#27`. |
| *AIAstra Architecture & Search Research* | Internal Specs (`docs/reading-engine/75`, `76`, `78`, `80`) | `D11` Engine Proxy (`D1 11th + A11 + D9 11th + D10 11th`), `getD9MaturityAgeYears()`, `SOUL.md` Rule 0 & 4-Tier Playbook | Engine gap mitigation, age-36 gate, and consumer friendship/community query alignment. |
