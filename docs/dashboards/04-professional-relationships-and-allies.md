# Dashboard 04: Professional Relationships & Allies (Cards 30–37)

**Document Status:** Architecture & Card Specification (Milestone 2 — Relationships Track)  
**Dashboard Slug:** `relationships.professional` (`workrel.*` cards hosted under `/love` → **Allies** sub-lens, with contextual cross-links from `/work`)  
**Card Range:** Cards `#30` – `#37` (8 Cards Total)  
**Related Specs:** [`00-plan.md`](./00-plan.md), [`docs/reading-engine/78-love-work-dashboard-separation-and-cards.md`](../reading-engine/78-love-work-dashboard-separation-and-cards.md), [`docs/reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`](../reading-engine/76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md), [`docs/reading-engine/75-self-foundation-card.md`](../reading-engine/75-self-foundation-card.md), [`docs/reading-engine/80-radha-and-catalogue-gap-analysis.md`](../reading-engine/80-radha-and-catalogue-gap-analysis.md)

---

## 1. Domain Overview & Astrological Separation Rationale

Professional bonds—bosses, executive sponsors, peers, direct reports, co-founders, enterprise clients, industry allies, and legal counterparties—follow **D10 (*Dashamsha*)**, **6th house** (coworkers, subordinates, workplace rivalry), **7th house in D10** (business partners, clients, contracts), **10th house** (supervisors, authority, executive standing), **11th house** (industry networks and gains from partnerships), **A10** (*Rajya Pada*), and **A7** (*Dara Pada*). Reading a workplace conflict or co-founder dispute using `Venus` and `5th`/`7th` romance charts is astrological malpractice. Separating **Professional Relationships & Allies** into its own 8-card lens enables surgical multi-entity disambiguation (`SOUL.md` Rule 0) across vertical, horizontal, commercial, and contractual ties while keeping zero career-output bloat (`Dashboard 06` / `08` cover solo role growth and venture economics).

### 1.1 Dashboard Metadata

| Property | Specification |
|---|---|
| **Default Routing (`person_facts`)** | Hosted on the `love` board (`board = 'love'`, `subBoard = 'workrel'`) and accessible via `/love` (4th Relationships **Allies** sub-lens). Contextually cross-linked from `/work` when `work.status` / `work.level` signals employment, management, consulting, or business ownership—avoiding duplicate `BoardLayout` ownership across `/love` and `/work`. |
| **Pinned Starter Cards (Default 5)** | `#30 workrel.pulse`, `#31 workrel.bosses_authority`, `#32 workrel.team_politics`, `#34 workrel.clients_deals`, `#36 workrel.networking_allies` (auto-swaps `#33 workrel.cofounder_fit` or `#35 workrel.managing_people` to pinned when `work.role === 'founder' | 'manager'`). |
| **Picker-Available Cards (3)** | `#33 workrel.cofounder_fit`, `#35 workrel.managing_people`, `#37 workrel.contracts_disputes`. |
| **Primary Houses (`D1` & `D10`)** | `6th` (colleagues, subordinates, office rivals, daily service friction, litigation), `7th` (co-founders, commercial clients, contract counterparties), `10th` (bosses, executive authority, public stature), `11th` (industry allies, referral networks, gains), `5th` (direct reports, disciples/mentees), `8th` (settlements, hidden politics, audits), `9th` (executive sponsors/mentors). |
| **Primary Karakas & Arudhas** | `Sun` (authority, bosses, senior leadership), `Saturn` (hierarchy, workforce endurance, compliance), `Mercury` (peers, negotiations, contracts), `Jupiter` (counselors, sponsors, fair leadership), `Mars` (competitors, litigation edge), `Rahu` (politics, global networks), `A10` (*Rajya Pada*), `A7` (*Dara Pada*), `A11` (*Labha Pada*), `AmK` (*Amatyakaraka*), `DK` (commercial partners), `GK` (*Gnatikaraka* — rivals). |
| **Primary Divisional Charts** | `D10` (*Dashamsha* — `1st`, `6th`, `7th`, `10th`, `11th`), `D1` (gross workplace baseline), `D9` (*Navamsha* — age-36+ maturity & integrity gate), **`D11` (*Ekadashamsha* — via proxy until served)**, `D30` (*Trimshamsha* — office toxicity, betrayal, legal disputes). |

### 1.2 Full-Circle Coverage Matrix

| Functional Pillar | Cards Covered | What It Guarantees for the User |
|---|---|---|
| **Systemic Climate & Legal Safety** | `#30` Workplace Dynamics, `#37` Contracts & Disputes | Gives an annual interpersonal radar across the org and protects agreements/IP before disputes ignite. |
| **Vertical Relationships** | `#31` Bosses & Authority, `#35` Managing & Leading People | Navigates upward sponsorship (`9th`/`10th`/`Sun`) and downward leadership/delegation (`5th`/`6th`/`10th`) cleanly. |
| **Horizontal & Network Ties** | `#32` Colleagues & Politics, `#36` Networking & Allies | Protects against credit-stealing/gossip (`D30`/`6th`) while timing warm referrals and industry champions (`11th`/`A11`). |
| **Commercial & Partner Interfaces** | `#33` Co-Founder Fit, `#34` Clients, Deals & Trust | Screens co-founder equity/governance risks and pinpoints peak commercial negotiation windows (`7th`/`A7`/`D10`). |

---

## 2. Shared Engine Contracts, `D10`/`D30`/`D11` Routing & Rule 0 Disambiguation

### 2.1 Zero Node Astrology & Engine Boundary
- **Calculation Authority:** All `D1`, `D9`, `D10`, and `D30` placements, `A7`/`A10`/`A11` Arudhas, `AmK`/`DK`/`GK`, `AntardashaFruitionCell`, `SAV`, and `AnnualRow` Tithi Pravesha returns originate strictly from the backend calculation engine (`AIAstra_Radha` / `pyjhora`) into `kundli_digest` (`DigestView`) and `kundli_activation` (`ActivationRow[]`).
- **Engine Gaps Noted (`doc 80`):**
  - `D10` and `D9` are served natively in `SERVED_VARGAS`; `D30` (`SERVED_VARGAS` expansion `R2`) and `D11` (proxy via `D1 11th + A11 + D9 11th + D10 11th`) gracefully bridge via `D1 + D9 + D10` until `SERVED_VARGAS` unlocks `{30, 11}` and `_build_placements_json` returns explicit varga `house`/`lagna`/`dignity` fields (`R3`).
  - Until TP `yearLord` export (`R1`) is patched across `annual_export.py` and `build.ts`, missing `yearLord` fails closed to `stance = 'get_through'`.
- **Caching & Sub-Technique Architecture:** Shared workplace-ally ledgers run once as `workrel.sub.*` into `technique_outputs`; card renderers perform pure selection into `AreaBrief`; LLM prompts (`Oracle` + `Personalizer`) enforce cached natal prefixes (`parts[0]` >= 1,024 tokens, `cachePrefix: true`) with 45-minute used-cache recycling (`READING_CACHE_RECYCLE_MINUTES = 45`).
- **Strict Redaction (`SOUL.md` §1):** Zero internal engine names (`Radha`, `pyjhora`, `AIAstra_Radha`, `jhora`) or Sanskrit jargon on `ReadFace`/`ShortFace`/Oracle Questions; technical evidence (`D10.h6`, `D10.h7`, `D1.pt.A10`) stays in **Chart details**.

### 2.2 Rule 0 Anti-Sycophancy & Multi-Entity Disambiguation (`SOUL.md` §2)
Dashboard 04 is the flagship operational domain for **`SOUL.md` Rule 0**:
- Never accept *"an older colleague"* or *"my business partner"* at face value when the chart splits counterparties across separate planetary tracks!
- Cross-check **`7th` (co-founders/clients)**, **`6th` (employers/service rivals/subordinates)**, **`8th` (agency/legacy client pools)**, and **`11th` (elder allies/network sponsors)** across `D1`, `D9`, and `D10` alongside `A7`, `A10`, `A11`, and Nakshatra lords—e.g., separating a `Saturn + Mars + 4th-house` real-estate/construction partner from a `Mercury + 6th/8th` IT agency owner and an `11th-house` elder advisor.

### 2.3 Age-36 Navamsha (`D9`) Gate & 5-Gate Toolbar Vetting
- **Post-36 Gate (`ageYears > getD9MaturityAgeYears()`, default `36`):** Even though `D10` rules professional action, `evaluateD1D9MutualConfirmation` across `D1 + D9` for `10th lord`, `7th lord`, `Sun`, `Saturn`, `AmK`, and active MD/AD lords determines post-36 executive trustworthiness, authority durability (`confirmed_strong` / `d9_redeemed`), and partnership integrity (`d9_weakened` *False Promise* warns against charismatic but hollow co-founders or bosses).
- **4-Tier Playbook & Toolbar Vetting:** Every card enforces the 4-Tier Playbook (`Sattvic`, `Rajasic`, `Mediocre`, `Baseline`), 5-Gate optional tool vetting (`.agents/skills/dashboard-card-toolbar-vetting/SKILL.md`), and one past-event calibration question.

---

## 3. Card Specifications (Cards 30–37)

---

### Card 30: Workplace Dynamics This Year
- **Card Number:** `30`
- **Card Name:** `Workplace Dynamics This Year`
- **Card Slug:** `workrel.pulse`
- **Subtitle:** `The 12-month interpersonal climate across colleagues, managers, and clients`
- **Default Placement:** Pinned starter card (`suggested: true`).

#### Area of Focus
A 12-month early-warning radar mapping the overall interpersonal climate across the native's workplace—distinguishing smooth collaborative seasons from restructuring, political turbulence, or leadership friction.

#### Oracle Question
*"Across the next 12 months, what is the overall interpersonal rhythm in your workplace, and which dated stretches bring smooth teamwork versus political friction?"*
- **Window Grounding:** Slices the current TP year (`tp_start`..`tp_end`) into 3–6 distinct relational weather stretches (`Collaborative stretch`, `Watchful stretch`, `High-visibility stretch`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Adapts to `work.status` (`corporate_ic`, `manager`, `executive`, `freelance_agency`, `founder`) and `work_environment` (`remote` vs. `in_office`).
- **Stance Resolution:** `build` (initiate cross-team projects, align allies, pursue visible collaborations) when `D10` `6th`/`7th`/`10th`/`11th` and TP `yearLord` are strong; `get_through` (document agreements, stay neutral, avoid office factions) when `6th`/`8th`/malefic AD or unresolved `yearLord` dominates.
- **4-Tier Behavioral Guidance:** *Sattvic:* Treat everyone with steady dignity and refuse to participate in hallway gossip; *Rajasic:* Build explicit written alignment with key stakeholders before turbulent quarters; *Mediocre:* Get blindsided by sudden team reshuffles or react defensively; *Baseline:* Pick unnecessary fights with insecure peers during heated transits.
- **Single Past-Event Calibration Question:** *"Between [prior_work_pulse_start] and [prior_work_pulse_end], did team dynamics or leadership tone shift noticeably?"*

#### Full-Circle Coverage
Delivers the annual `D10` interpersonal climate map (Entry) -> separates systemic org weather from personal faults (Reframing) -> routes vertical friction to Cards `#31`/`#35`, peer rivalry to `#32`, commercial clients to `#34`, and contract risks to `#37` (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `D10 Lagna`, `10th lord`, and `6th lord` nakshatras; checks whether the active MD/AD lord and TP `yearLord` sit in `Sadhaka`/`Mitra`/`Kshema` taras (`Tara Bala = 1`) vs. `Pratyak`/`Vipat`/`Vadha` (`Tara Bala = 0`, workplace resistance).
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `D1` `6th` (daily coworkers), `7th` (partners/clients), `10th` (authority), and `11th` (allies), alongside `A10` (*Rajya Pada*), `AL`, and `AmK` (*Amatyakaraka*). Checks `D1` & `D10` polarity alignment (`work.d10_check`).
- **Divisional Charts (`D10`, `D1`, `D9`):** **`D10` (*Dashamsha*) is primary**: inspects `D10 Lagna`, `D10 6th`, `D10 7th`, `D10 10th`, and `D10 11th` houses and occupants. Above age 36 (`ageYears > getD9MaturityAgeYears()`), cross-validates active dasha lords and `AmK`/`10th lord` via `evaluateD1D9MutualConfirmation` (`D1 + D9`) to test executive integrity vs. hollow appearances.
- **Dasha Systems:** Calls `resolveActiveMahadasha` across conditional (e.g., *Chaturashiti Sama* if `10th lord` is in `10th`!), Vimshottari MD/AD/PD, Narayana/Chara, and Yogini; reads `AntardashaFruitionCell` (`4/7/10` authority consolidation vs. `6/8` office tension) and `avasthaMultipliers`.
- **Transits (Gochara):** Tracks `Saturn` and `Jupiter` transits aspecting `D1` `10th`/`6th`, `D10` `10th`/`Lagna` (via natal overlay), `Rahu` energizing ambition or politics in `6th`/`10th`, and `SAV` bindus in `6th`/`10th`/`11th`.
- **Tithi Pravesha (TP):** Anchored in `runningTithiPravesha` (`tp_start`..`tp_end`). Reads `TP Lagna`, `TP 6th`/`7th`/`10th`, **`TP D10`** (`tpRowIn(view, tp, 'D10')`), `yearLord` relationship to `10th`/`6th`, *Karya Siddhi Saham*, and `Tithi Ashtottari` sub-periods.

#### Google Search Trends Synthesis
Addresses broad annual workplace searches (*"workplace astrology 2026/2027"*, *"coworker dynamics horoscope"*, *"office environment birth chart"*) by turning `D10` interpersonal mechanics into clear quarterly communication and boundary expectations.

#### Classical Attribution
- *BPHS* Ch. 7 (*Dashamsha D10*), Ch. 17 (`6th`), Ch. 18 (`7th`), Ch. 21 (`10th`)
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — *Dashamsha* `6th` service vs. `7th` trade vs. `10th` authority
- *Tithi Pravesha* — `TP D10` & *Karya Siddhi Saham*
- *SOUL.md* §2 (Rule 0 — separating coworker, boss, and ally tracks)

---

### Card 31: Bosses, Authority & Mentors at Work
- **Card Number:** `31`
- **Card Name:** `Bosses, Authority & Mentors at Work`
- **Card Slug:** `workrel.bosses_authority`
- **Subtitle:** `Navigating bosses cleanly and timing genuine support from senior sponsors`
- **Default Placement:** Pinned starter card (`suggested: true`) for employed/corporate users.

#### Area of Focus
Navigating managers, demanding executives, board leadership, and cultivating senior sponsorship (`Sun` / `Saturn` / `9th` / `10th` in `D1 + D10` + `A10`)—clearly distinguishing hostile micromanagement from strict high-standards mentorship.

#### Oracle Question
*"How can you navigate senior leadership cleanly right now, and during which upcoming dates is executive sponsorship or recognition from authority most supportive?"*
- **Window Grounding:** Dates `Sun`/`Saturn` friction stretches (`"Authority tension: <from> – <to>"`) vs. `Jupiter`/`9th`/`10th` sponsorship windows (`"Executive support window: <from> – <to>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `work.status` (`ic`, `manager`, `contractor` reporting to client owners); uses `SOUL.md` Rule 0 to disambiguate multiple senior figures (e.g., an immediate micromanaging boss vs. a supportive skip-level sponsor).
- **Stance Resolution:** `build` (present wins, ask for scope/sponsorship, request skip-level visibility) when `Sun`/`Jupiter`/`9th`/`10th` align; `get_through` (deliver reliably, keep written status trails, avoid ego battles) when `Sun–Saturn` or `Mars–10th` clash is active.
- **4-Tier Behavioral Guidance:** *Sattvic:* Deliver impeccable work without flattery and treat senior wisdom with quiet respect; *Rajasic:* Translate your output into the metrics and priorities your manager actually cares about; *Mediocre:* Privately resent authority while seeking vague approval; *Baseline:* Trigger ego power struggles with an insecure boss during a tense transit.
- **Single Past-Event Calibration Question:** *"Around [sun_saturn_or_10th_dates], did friction with a manager—or an unexpected backing from a senior sponsor—shape your week-to-week standing?"*

#### Full-Circle Coverage
Disambiguates boss (`10th`/`Sun`/`Saturn`) vs. executive sponsor (`9th`/`Jupiter`) -> identifies current authority weather (Timing) -> prescribes upward-management strategy via the 4-Tier Playbook (Action) -> hands off to Job Growth (`#48` Promotion) or Contracts (`#37`) if toxic (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Sun`, `Saturn`, `9th lord`, and `10th lord` nakshatras (*Krittika*, *Uttara Phalguni*, *Uttara Ashadha* for sovereign leadership; *Pushya*, *Anuradha* for disciplined mentorship); checks `Pratyak` (resistance from superiors) vs. `Param Mitra` (sponsor backing).
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Inspects `Sun` (boss/executive power), `Saturn` (strict/older hierarchy), `Jupiter` (benevolent sponsor), `9th house` (senior mentors), `10th house` (direct authority/reporting line), **`A10` (*Rajya Pada*)**, and `Sun–Saturn` mutual aspects/conjunctions (*Pitru-Shani* authority tension vs. disciplined structure).
- **Divisional Charts (`D10`, `D1`, `D9`):** Checks `D10` `9th`/`10th`/`Lagna` and `Sun`/`Saturn` dignity in `D10`. Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `Sun`, `Saturn`, and `10th lord` reveals whether authority friction stems from early conditioning (`D1`) that settles post-36 (`d9_redeemed`) or persistent hierarchy testing (`confirmed_weak`).
- **Dasha Systems:** Evaluates `Sun`, `Saturn`, `9th`, or `10th` lord sub-periods (`resolveActiveMahadasha`) + `AntardashaFruitionCell` (`6/8` clash with boss vs. `1/5/9` or `4/7/10` sponsorship).
- **Transits (Gochara):** Tracks `Saturn` transiting `10th` or aspecting `Sun`/`10th lord` (demanding oversight), `Mars` transiting `10th`/`1st` (acute clashes with superiors), `Jupiter` aspecting `10th`/`9th`/`Sun` (executive protection), and `SAV` in `9th`/`10th`.
- **Tithi Pravesha (TP):** Evaluates `TP` `9th`/`10th` houses, `TP D10` `10th`, `Sun` dignity in `TP.D1`, and `yearLord` connection to `Sun`/`10th`.

#### Google Search Trends Synthesis
Addresses urgent career searches (*"difficult boss astrology"*, *"how to impress my manager birth chart"*, *"executive sponsor career horoscope"*) with non-sycophantic upward-management clarity.

#### Classical Attribution
- *BPHS* Ch. 20 (`9th` mentors/sponsors), Ch. 21 (`10th` authority/command), Ch. 3 (`Sun` & `Saturn` karakatvas)
- *Phaladeepika* Ch. 18 (`10th` house & leadership relations)
- *SOUL.md* §2 & §3 (Rule 0 disambiguating multiple senior figures + 4-Tier Playbook)

---

### Card 32: Colleagues, Teams & Office Politics
- **Card Number:** `32`
- **Card Name:** `Colleagues, Teams & Office Politics`
- **Card Slug:** `workrel.team_politics`
- **Subtitle:** `Spotting peer rivalry or credit friction early, and when workplace heat cools`
- **Default Placement:** Pinned starter card (`suggested: true`).

#### Area of Focus
Diagnosing peer rivalry, passive-aggressive gossip, credit-stealing, and shifting alliances among coworkers (`6th house` + `Mercury`/`Mars`/`Rahu` in `D10` + `D30`)—naming exact dates when political heat cools down.

#### Oracle Question
*"What peer friction, hidden competition, or team politics require careful documentation right now, and when does that tension clear?"*
- **Window Grounding:** Explicitly bounds political friction windows (`"Political caution stretch: <from> – <to>"`) and marks the easing date (`"Team dynamics normalize after <ease_date>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `work.status` (`corporate_ic`, `team_lead`, `remote` async teams); protects users without feeding office paranoia.
- **Stance Resolution:** `get_through` (keep decisions in writing, share credit cleanly, stay out of triangulation) during `Rahu`/`Mars`/`6th` hits in `D10`/`D30`; `build` (cross-functional collaboration, peer camaraderie) once `Mercury`/`Jupiter` clarify `6th`/`11th`.
- **4-Tier Behavioral Guidance:** *Sattvic:* Do clean work, give honest credit, and refuse to trade rumors; *Rajasic:* Keep concise written paper trails on deliverables and CC relevant stakeholders calmly; *Mediocre:* Overshare personal frustrations to "work friends" who repeat them; *Baseline:* Fight fire with fire in petty office gossip, risking reputation damage.
- **Single Past-Event Calibration Question:** *"Around [d10_6th_or_rahu_dates], did peer competition, credit confusion, or behind-the-scenes team friction spike?"*

#### Full-Circle Coverage
Identifies peer friction source (`6th`/`D10 6th`/`D30`) -> separates passing `Mars`/`Rahu` noise from deep rivalry (Diagnosis) -> gives dated caution windows and written hygiene habits (Action) -> pairs with Card `#37` (Disputes) if legal escalation threatens (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Checks `6th lord`, `Mercury`, `Mars`, and `Rahu` nakshatras; flags `Vipat` (3), `Pratyak` (5), `Vadha` (7) taras and `K64L` / `KD22` transit contacts triggering workplace friction.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Examines `6th house` (coworkers, competitors, daily friction), `3rd house` (peer communication), `GK` (*Gnatikaraka* — workplace rivals), `A6` (*Roga/Shatru Pada*), `Mercury` (peers/messages) afflicted by `Mars` (arguments) or `Rahu` (manipulation/gossip).
- **Divisional Charts (`D10`, `D30`, `D1`, `D9`):** **`D10` `6th` and `8th` houses** paired with **`D30` (*Trimshamsha*) `6th`** (once `D30` is unlocked in `SERVED_VARGAS`, with `D1` `6th`/`8th` + `D10` `6th` interim support). Above age 36 (`ageYears > getD9MaturityAgeYears()`), checks `Mercury` and `6th lord` across `D1 + D9` via `evaluateD1D9MutualConfirmation` for resilience against office drama.
- **Dasha Systems:** Evaluates `6th`/`8th` lord or `Mars`/`Rahu` AD/PD (`resolveActiveMahadasha`), flagging `6/8` *Shadashtaka* in `AntardashaFruitionCell` (`tone = 'careful'`) and computing the exact PD exit date.
- **Transits (Gochara):** Tracks `Mars` and `Rahu` transiting `6th`/`10th`/`1st`, `Mercury Retrograde` causing email/team misattribution, `Saturn` in `6th` (heavy workload but eventual victory over rivals — *Shatru Hanta*!), and `SAV` in `6th` vs. `10th`.
- **Tithi Pravesha (TP):** Checks `TP` `6th` house, `TP D10` `6th`, *Kali Saham*, and `yearLord` conflict with `6th`/`Mercury`.

#### Google Search Trends Synthesis
Addresses widely searched workplace distress queries (*"toxic coworkers astrology"*, *"surviving office politics birth chart"*, *"backstabbing colleagues horoscope"*) with calm, practical professionalism rather than paranoid scapegoating.

#### Classical Attribution
- *BPHS* Ch. 17 (`6th` Ripu/coworkers & competition), Ch. 30 (*D30 Trimshamsha*)
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — *Dashamsha* `6th` house service & peers
- *Jaimini Upadesha Sutras* (`GK` Gnatikaraka, `A6`)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Mercury` peers, `Saturn` outlasting rivals in `6th`)

---

### Card 33: Business Partners & Co-Founder Fit
- **Card Number:** `33`
- **Card Name:** `Business Partners & Co-Founder Fit`
- **Card Slug:** `workrel.cofounder_fit`
- **Subtitle:** `Whether partnering multiplies execution, and governance terms to lock in early`
- **Default Placement:** Picker-available (`suggested: false`, promoted automatically to pinned when `work.status` is `founder`, `partner`, or `self_employed`).

#### Area of Focus
Evaluating co-founder and commercial partner alignment—whether partnering multiplies execution (`D10 7th` + `A7` + `11th`) or breeds equity deadlock and governance risk (`D30 7th`), and what structural protections keep the alliance healthy.

#### Oracle Question
*"Does partnering or co-founding strengthen your trajectory right now, and what clear governance rules and timing windows protect the relationship?"*
- **Window Grounding:** Dates partner-selection/signing windows (`"Alliance formation window: <from> – <to>"`) versus deadlock/litigation-risk periods (`"Governance caution stretch: <from> – <to>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `work.status` (`founder`, `considering_partner`, `consultant`). Strictly applies `SOUL.md` Rule 0 to separate equity co-founders (`D10 7th`) from agency employers (`D10 6th`) and silent investors (`8th`/`11th`).
- **Stance Resolution:** `build` (co-create with clear vesting/operating agreements) when `D10 7th`, `A7`, and `11th` align cleanly; `get_through` (pause signing, tighten operating agreements, or remain solo) when `D30 7th` or `6/8` AD risk is elevated.
- **4-Tier Behavioral Guidance:** *Sattvic:* Partner only with complementary integrity and crystal-clear shared ethics; *Rajasic:* Put vesting schedules, decision tie-breakers, and clean exit clauses in writing while everyone is smiling; *Mediocre:* Split equity 50/50 on handshake trust because "we're friends"; *Baseline:* Rush into partnership out of loneliness or fear of solo responsibility.
- **Single Past-Event Calibration Question:** *"Around [d10_7th_or_a7_dates], did a partnership discussion, equity split, or joint-venture friction test your boundaries?"*

#### Full-Circle Coverage
Tests solo vs. partnered viability (`D10 1st` vs. `D10 7th`) -> disambiguates partner types (`Rule 0`) -> checks governance/litigation risk (`D30`) -> delivers signing timing & operating-agreement hygiene (Action) and connects to Card `#37` (Contracts) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `D10 7th lord`, `D1 7th lord`, `A7` lord, and `DK`/`Mercury` nakshatras; avoids signing formal operating agreements on `Vipat`, `Pratyak`, `Vadha` taras or `Gandanta` crossings.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `7th house` (commercial partnership), `7th lord` relationship to `Lagna lord` (mutual harmony vs. `6/8`/`2/12` clash), **`A7` (*Dara Pada*)** vs. **`AL`**, `11th house` (gains from partnership), and `Mercury–Jupiter` commercial ethics.
- **Divisional Charts (`D10`, `D30`, `D1`, `D9`, `D11` proxy):** **`D10` `7th` house & `7th lord`** are decisive for business partners (distinct from `D9` marriage!). Cross-checks `D10 11th` (`D11` proxy) for profit from partners and **`D30` `7th`** for breach/betrayal risk. Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `7th lord` and `DK` tests long-term relational staying power (`d9_weakened` warns of charming-but-unreliable co-founders).
- **Dasha Systems:** Evaluates `resolveActiveMahadasha` (`7th lord`, `11th lord`, `A7` lord, or *Narayana/Chara Dasha* of `D10 7th` sign) + `AntardashaFruitionCell` (`4/7/10` alignment vs. `6/8` equity split disputes).
- **Transits (Gochara):** Tracks `Jupiter` and `Saturn` double transit on `7th`/`11th` (`activateDoubleTransit`), `Rahu–Ketu` across `1st/7th` (volatile partner dynamics), `Mercury Retrograde` (defer contract finalization), and `SAV` in `7th` vs. `12th`.
- **Tithi Pravesha (TP):** Checks `TP D10` `7th` house, `TP` `7th`, `yearLord` link to `7th`/`11th`, and *Vanijya/Karya Siddhi Saham*.

#### Google Search Trends Synthesis
Addresses founder search queries (*"business partner compatibility astrology"*, *"co-founder breakup birth chart"*, *"should I take a business partner horoscope"*) with realistic governance discipline rather than naive "synastry luck."

#### Classical Attribution
- *BPHS* Ch. 7 (`D10` & `D30`), Ch. 18 (`7th` trade & partnerships)
- *Jaimini Upadesha Sutras* (`A7` *Dara Pada*, `7th` from `AL`, *Rasi Drishti*)
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — *Dashamsha* `7th` business partner vs. `D9` spouse
- *SOUL.md* §2 (Rule 0 — disambiguating distinct commercial partners)

---

### Card 34: Clients, Deals & Public Trust
- **Card Number:** `34`
- **Card Name:** `Clients, Deals & Public Trust`
- **Card Slug:** `workrel.clients_deals`
- **Subtitle:** `High-trust windows for pitching clients, negotiating deals, and winning buy-in`
- **Default Placement:** Pinned starter card (`suggested: true`) for consultants, sales, freelancers, and business owners.

#### Area of Focus
Timing peak windows for pitching, closing commercial deals, attracting inbound clients, and deepening public marketplace trust (`7th` / `A7` / `A10` in `D1 + D10` + `Mercury`/`Venus`).

#### Oracle Question
*"During which upcoming dated windows is pitching, negotiating deals, and winning client trust most strongly favored—and what strengthens your commercial positioning?"*
- **Window Grounding:** Pinpoints high-conversion pitch windows (`"Deal-closing window: <from> – <to>"`) versus slow follow-up stretches (`"Pipeline-nurturing stretch: <from> – <to>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `work.status` (`sales`, `freelancer`, `agency`, `founder`, or `client_facing_ic`).
- **Stance Resolution:** `build` (launch outreach, schedule enterprise pitches, propose retainers) during `7th`/`10th`/`11th`/`Jupiter`/`Mercury`/`Venus` windows; `get_through` (nurture existing accounts, refine proposals, double-check scope) during `Mercury Rx` or `12th`/`6-8` drag.
- **4-Tier Behavioral Guidance:** *Sattvic:* Serve client outcomes honestly and never promise deliverables you cannot uphold; *Rajasic:* Concentrate high-stakes proposals and pricing talks into peak `7th`/`10th` dates; *Mediocre:* Underprice work out of scarcity during quiet weeks; *Baseline:* Overpromise wildly to close a deal only to burn trust in delivery.
- **Single Past-Event Calibration Question:** *"Around [7th_or_a10_jupiter_dates], did inbound client inquiries, deal closures, or public referrals accelerate noticeably?"*

#### Full-Circle Coverage
Audits inbound marketplace pull (`7th`/`A7`/`A10`) -> separates `8th` agency/retainer pools from `7th` direct sales (`Rule 0`) -> times outreach & closing windows (Action) -> hands off signed engagements to Card `#37` (Contracts) (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Mercury` (negotiation), `Venus` (attraction/rapport), and `7th`/`10th` lord nakshatras; checks `Sampat` (2nd — wealth), `Sadhaka` (6th — achievement), and `Mitra` (8th) taras for pitch timing.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `7th house` (clients/commerce), `10th house` (market reputation), `8th house` (retainer/agency client pools), **`A7` (*Dara Pada*)**, **`A10` (*Rajya Pada*)**, and `AL`. Inspects *Budhaditya* (`Sun–Mercury`), *Lakshmi*, or `Mercury–Venus` yogas for persuasive clarity.
- **Divisional Charts (`D10`, `D1`, `D9`, `D2`):** Evaluates `D10` `7th` (clients), `D10` `10th` (authority), and `D10` `11th` (deal inflows), paired with `D1` `7th`/`A7` and `D2` (cash conversion). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `Mercury`, `Venus`, and `7th lord` measures whether public trust compounds effortlessly (`confirmed_strong`/`d9_redeemed`).
- **Dasha Systems:** Tracks `7th`/`10th`/`11th` lord or `Mercury`/`Venus`/`Jupiter` sub-periods (`resolveActiveMahadasha`) + `AntardashaFruitionCell` (`2/11` *Dhana-Labha* & `4/7/10` *Kendra* deal execution).
- **Transits (Gochara):** Tracks `Jupiter` transiting/aspecting `7th`, `10th`, `11th`, `A7`, or `A10`; `Mercury` and `Venus` direct motion through Kendras/Trikonas; avoiding `Mercury Retrograde` for final price-lock signatures; `SAV >= 30` in `7th`/`10th`.
- **Tithi Pravesha (TP):** Evaluates `TP` `7th`/`10th`/`11th`, `TP D10` `7th`, *Artha/Karya Siddhi Saham*, and `Tithi Ashtottari` sub-periods within `tp_start`..`tp_end`.

#### Google Search Trends Synthesis
Addresses commercial astrology queries (*"closing deals astrology"*, *"best time to pitch clients horoscope"*, *"client attraction birth chart"*) with actionable sales-cycle timing and integrity-first positioning.

#### Classical Attribution
- *BPHS* Ch. 18 (`7th` commerce/clients), Ch. 21 (`10th`), Ch. 7 (`D10`)
- *Jaimini Upadesha Sutras* (`A7`, `A10`, `AL` public trust & commercial magnetism)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Mercury` negotiation/trade, `Venus` rapport)
- *SOUL.md* §2 (`8th` house client-pool disambiguation)

---

### Card 35: Managing & Leading People
- **Card Number:** `35`
- **Card Name:** `Managing & Leading People`
- **Card Slug:** `workrel.managing_people`
- **Subtitle:** `How your leadership lands on direct reports, and delegating without friction`
- **Default Placement:** Picker-available (`suggested: false`, promoted to pinned when `person_facts` indicates `manager`, `director`, `founder`, or `team_lead`).

#### Area of Focus
Stepping into executive authority with calm fairness—understanding how the native's leadership style lands on direct reports, earning team loyalty (`5th` / `6th` / `10th` in `D10`), and delegating without micromanaging or abdicating.

#### Oracle Question
*"How does your leadership style land on the people who report to you right now, and how can you delegate cleanly and build steady team loyalty?"*
- **Window Grounding:** Dates management-expansion windows (`"Leadership stride: <from> – <to>"`) versus delegation-bottleneck stretches (`"Delegation test: <from> – <to>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `management_scope` (`new_manager` vs. `seasoned_executive` vs. `founder` with small team); hidden by default for pure individual contributors unless picked.
- **Stance Resolution:** `build` (coach reports, expand ownership, delegate core workflows) when `Sun`/`Jupiter`/`5th`/`10th` in `D10` are supported; `get_through` (keep feedback structured, avoid impulsive team reorganizations) during `Mars`/`Saturn`/`6th` tension.
- **4-Tier Behavioral Guidance:** *Sattvic:* Lead with clarity, protect your team upward, and develop their capability rather than hoarding credit; *Rajasic:* Set crisp outcomes, accountability cadences, and delegation boundaries; *Mediocre:* Micromanage details out of distrust—or avoid hard performance feedback until crisis; *Baseline:* Rule through volatility (`Mars`/`Rahu`) or rigid coldness (`Saturn`).
- **Single Past-Event Calibration Question:** *"Around [d10_5th_10th_trigger_dates], did stepping into a management decision, delegation shift, or team-morale issue test your leadership style?"*

#### Full-Circle Coverage
Audits leadership wiring (`Sun`/`Jupiter`/`Saturn` + `5th`/`6th`/`10th` in `D10`) -> identifies micromanagement vs. abdication blind spots (Diagnosis) -> gives dated coaching/delegation focus (Action) -> pairs with Card `#31` (Upward Authority) for full vertical alignment (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `Sun`, `Jupiter`, `10th lord`, and `5th lord` nakshatras (`Uttara Phalguni`, `Pushya`, `Vishakha`, `Anuradha`, `Punarvasu` support fair, steadying leadership); checks `Sadhaka` and `Param Mitra` taras for mentoring impact.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Maps vertical downward roles cleanly: **`5th house`** (disciples, mentees, loyal followers), **`6th house`** (subordinates, staff, daily execution), and **`10th house`** (executive command). Checks `Sun` (*Dig Bala* in `10th`!), `Jupiter` (wise coaching), `Saturn` (fair process & endurance), and `A10` vs. `A5`.
- **Divisional Charts (`D10`, `D1`, `D9`):** Inspects **`D10` `1st`, `5th`, `6th`, `10th`** and `Sun`/`Jupiter`/`Saturn` dignities in `D10`. Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `Sun`, `Jupiter`, and `10th lord` distinguishes earned, respected authority (`confirmed_strong`/`d9_redeemed`) from brittle ego posturing (`d9_weakened`).
- **Dasha Systems:** Evaluates `5th`/`10th`/`Sun`/`Jupiter` sub-periods (`resolveActiveMahadasha`) + `AntardashaFruitionCell` (`1/5/9` mentoring grace, `4/7/10` command consolidation vs. `6/8` direct-report turnover).
- **Transits (Gochara):** Tracks `Jupiter` aspecting `5th`/`10th`/`1st` (loyal team growth), `Saturn` transiting `6th`/`10th` (heavy managerial responsibility requiring patience), `Mars` in `5th`/`6th` (demanding performance resets), and `SAV` in `5th`/`6th`/`10th`.
- **Tithi Pravesha (TP):** Evaluates `TP D10` `5th`/`10th`, `TP Lagna`, `yearLord` dignity (`Sun`/`Jupiter`/`Saturn` strength), and `Muntha` in `10th`/`5th`.

#### Google Search Trends Synthesis
Addresses modern management searches (*"leadership style astrology"*, *"how to manage direct reports birth chart"*, *"delegation horoscope"*) by distinguishing `5th`-house mentoring from `6th`-house operational supervision in `D10`.

#### Classical Attribution
- *BPHS* Ch. 16 (`5th` followers/mentees), Ch. 17 (`6th` subordinates/staff), Ch. 21 (`10th` command), Ch. 3 (`Sun` Dig Bala in `10th`)
- *The Crux of Vedic Astrology* (Pt. Sanjay Rath) — *Dashamsha* `5th`/`6th`/`10th` team hierarchy
- *Phaladeepika* Ch. 18 (executive dignity & leadership endurance)
- *SOUL.md* §3 — 4-Tier ethical authority playbook

---

### Card 36: Networking & Career Allies
- **Card Number:** `36`
- **Card Name:** `Networking & Career Allies`
- **Card Slug:** `workrel.networking_allies`
- **Subtitle:** `Dated windows and channels for warm referrals, alumni ties, and industry champions`
- **Default Placement:** Pinned starter card (`suggested: true`).

#### Area of Focus
Identifying when and where to expand professional networks, secure warm introductions, activate alumni/industry champions, and turn loose acquaintances into mutually beneficial career allies (`11th` / `A11` / `D10 11th`).

#### Oracle Question
*"Where and during which upcoming date windows can you most effectively expand your professional circle, earn warm referrals, and connect with industry allies?"*
- **Window Grounding:** Highlights peak outreach/conference windows (`"Network momentum window: <from> – <to>"`) versus low-ROI seasons better spent sharpening craft quietly.

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `work.status` (`job_seeking`, `employed`, `founder`, `career_pivot`) and `relocated` / `remote` context.
- **Stance Resolution:** `build` (attend conferences, message warm contacts, publish thoughtful work, join industry guilds) when `11th`/`A11`/`Mercury`/`Jupiter`/`Rahu` align; `get_through` (nurture 2–3 high-trust existing contacts rather than cold-spraying) during `12th`/`Ketu` lulls.
- **4-Tier Behavioral Guidance:** *Sattvic:* Network by being genuinely helpful and curious about others' work before asking for anything; *Rajasic:* Target high-leverage conferences, warm intros, and peer roundtables during open dates; *Mediocre:* Network only in panic after losing a job or client; *Baseline:* Treat people transactionally (`Rahu` in `11th` shadow), burning warm goodwill fast.
- **Single Past-Event Calibration Question:** *"Around [11th_or_a11_opening_dates], did a timely referral, alumni reconnection, or industry introduction open a meaningful door?"*

#### Full-Circle Coverage
Identifies natural alliance channels (`11th`/`A11`/`Mercury`/`Rahu`) -> pinpoints outreach dates (Timing) -> guides authentic, non-transactional networking (Action) -> pairs with Card `#34` (Deals) or Work Dashboards `05`/`06`/`08` (Handoff).

#### Astrological Mechanics
- **Nakshatras:** Evaluates `11th lord`, `A11` lord, `Mercury`, and `Rahu` nakshatras (*Swati*, *Ardra*, *Shatabhisha*, *Hasta*, *Shravana*, *Rohini* amplify network reach); checks `Sampat`, `Sadhaka`, `Mitra`, and `Param Mitra` taras.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `11th house` (professional networks, gains, elder allies), **`A11` (*Labha Pada*)**, `Mercury` (warm messaging/referrals), `Jupiter` (generous champions), and `Rahu` in `11th` (global, cross-industry, tech networks). Checks `10th–11th` lord *Sambandha* (*Labha-Karma Yoga*).
- **Divisional Charts (`D10`, `D1`, `D9` + `D11` proxy):** Evaluates **`D10` `11th` house**, `D1` `11th` + `A11`, and `D9` `11th` (`D11` proxy per `doc 78` §5.1). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `11th lord` and `Mercury` shows reputation-backed networks (`confirmed_strong`) vs. flashy-but-empty contact lists (`d9_weakened`).
- **Dasha Systems:** Tracks `11th lord`, `A11` lord, `Mercury`, `Rahu`, or `Jupiter` sub-periods (`resolveActiveMahadasha` + *Narayana/Chara Dasha* of `11th`/`D10 11th` sign) with `2/11` & `1/5/9` `AntardashaFruitionCell` returns.
- **Transits (Gochara):** Tracks `Jupiter` transiting/aspecting `11th` or `A11` (generous sponsors), `Mercury` and `Venus` transiting `11th`/`10th`/`3rd`, `Rahu` energizing `11th` (international reach), and `SAV >= 30` in `11th`.
- **Tithi Pravesha (TP):** Evaluates `TP` `11th`, `TP D10` `11th`, `Muntha` in `11th`, `yearLord` connection to `11th`, and *Mitra/Labha Saham*.

#### Google Search Trends Synthesis
Addresses modern career-growth queries (*"career networking astrology"*, *"11th house professional network birth chart"*, *"how to find career allies horoscope"*) by turning `11th`/`A11`/`D10` mechanics into high-integrity, timed relationship building.

#### Classical Attribution
- *BPHS* Ch. 22 (`11th` Labha Bhava — gains & allies), Ch. 7 (`D10`)
- *Jaimini Upadesha Sutras* (`A11`, `11th` from `AL`, *Chara/Narayana Dasha*)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Mercury` networking, `Rahu` expansive cross-border circles)
- *Tithi Pravesha* — `TP D10` `11th` & *Mitra Saham*

---

### Card 37: Contracts, Disputes & Protection
- **Card Number:** `37`
- **Card Name:** `Contracts, Disputes & Protection`
- **Card Slug:** `workrel.contracts_disputes`
- **Subtitle:** `High-scrutiny signing windows and written safeguards against avoidable disputes`
- **Default Placement:** Picker-available (`suggested: false`, promoted to alert/pinned when `D30`/`6th`/`8th`/`Saturn–Rahu` dispute signatures peak).

#### Area of Focus
Protecting the native across employment contracts, severance terms, client agreements, IP ownership, equity disputes, and formal audits (`6th` / `8th` + `D30` + `Saturn`/`Rahu`/`Mars` in `D10`)—naming exact caution dates for legal review.

#### Oracle Question
*"Which upcoming date windows call for extra legal and contract scrutiny, and what safeguards protect you from avoidable workplace or partner disputes?"*
- **Window Grounding:** Explicitly bounds high-scrutiny signing/dispute windows (`"Contract scrutiny window: <from> – <to>"`) and clean execution dates (`"Clearer signing window: <from> – <to>"`).

#### Personalizer Goal
- **Profile Context (`person_facts`):** Tailored to `work.status` (`switching_jobs` / severance, `freelancer` / client MSA, `founder` / equity & IP, `executive` / non-compete). Never offers formal legal advice—recommends qualified legal counsel during high-risk astrological windows.
- **Stance Resolution:** `get_through` (pause hasty signatures, retain counsel, audit fine print, keep immaculate records) whenever `D30`/`6th`/`8th`/`Mercury Rx`/`6-8` AD risk is active; `build` (finalize clean, vetted agreements) once `Jupiter`/`9th`/`D10 7th` stabilize.
- **4-Tier Behavioral Guidance:** *Sattvic:* Honor every word you sign and insist on transparent, fair terms for both sides; *Rajasic:* Engage qualified legal/tax review, secure clear IP/severance clauses in writing, and avoid handshake ambiguity; *Mediocre:* Skim long contracts out of eagerness to start and miss restrictive traps; *Baseline:* Sign under pressure during a `Mercury Rx` / `Rahu–6th` fog or withhold records during a dispute.
- **Single Past-Event Calibration Question:** *"Around [d30_or_6th_8th_trigger_dates], did a contract fine-print issue, payment delay, or formal workplace dispute demand careful documentation?"*

#### Full-Circle Coverage
Detects legal/contract vulnerability (`6th`/`8th`/`D30`/`D10`) -> separates passing `Mercury Rx` static from serious `D30`/`Saturn–Rahu` exposure (Diagnosis) -> names exact caution vs. clean-signing windows (Timing) -> prescribes calm written safeguards and professional counsel (Action).

#### Astrological Mechanics
- **Nakshatras:** Inspects `6th lord`, `8th lord`, `Mercury` (documents), `Mars` (litigation), and `Saturn`/`Rahu` nakshatras; strictly avoids signing agreements during `Vipat` (3), `Pratyak` (5), `Vadha` (7) taras, `Gandanta`, or `K64L` / `KD22` transit hits.
- **Rasi (`D1`), Arudhas, Karakas & Yogas:** Assesses `6th house` (disputes, lawsuits, contract breaches), `8th house` (settlements, severance, hidden liabilities, audits), `7th house` (contract terms), `Mercury` (written clauses), `Saturn` (binding law), `Mars` (conflict), and `GK` (*Gnatikaraka* — legal opponents). Checks `A6` and `A8`.
- **Divisional Charts (`D30`, `D10`, `D1`, `D9`):** **`D30` (*Trimshamsha*) `6th`, `7th`, `8th`, and `Lagna`** paired with **`D10` `6th`, `7th`, `8th`** are the core forensic safeguard lens (using `D1` `6th`/`8th` + `D10` `6th`/`7th` while `SERVED_VARGAS` unlocks `D30`). Above age 36 (`ageYears > getD9MaturityAgeYears()`), `evaluateD1D9MutualConfirmation` on `6th lord`, `Mercury`, and `Saturn` indicates whether past legal naivety has matured into seasoned caution (`d9_redeemed`) or remains a blind spot (`confirmed_weak`).
- **Dasha Systems:** Evaluates `6th`/`8th` lord, `Saturn`, `Rahu`, or `Mars` sub-periods (`resolveActiveMahadasha`) + `AntardashaFruitionCell` (`6/8` *Shadashtaka* & `dusthana_reversal_crisis`), highlighting exact AD/PD entry and exit dates.
- **Transits (Gochara):** Tracks `Saturn–Rahu` or `Mars–Ketu` transiting `6th`/`7th`/`8th`/`10th`, `Mercury Retrograde` (hidden omissions in contracts), `Saturn` *Kantaka/Ashtama Shani*, `D1.KD22`/`D1.K64L` hits, and `SAV < 25` in `6th`/`7th`/`8th`.
- **Tithi Pravesha (TP):** Evaluates `TP` `6th`/`7th`/`8th`, `TP D30` (`tpRowIn` once enabled), *Kali/Mrityu Saham*, and `yearLord` placed in `6th`/`8th`/`12th` (failing closed to `stance = 'get_through'`).

#### Google Search Trends Synthesis
Addresses urgent protective queries (*"employment contract review astrology"*, *"workplace legal dispute birth chart"*, *"severance negotiation horoscope"*) by equipping professionals with sober signing-window intelligence and legal-audit discipline.

#### Classical Attribution
- *BPHS* Ch. 17 (`6th` disputes/litigation), Ch. 19 (`8th` settlements/audits), Ch. 30 (*Trimshamsha D30*)
- *Prasna Marga* Ch. 15–16 (diagnosing hidden contract flaws and dispute outcomes)
- *Uttara Kalamrita* Kanda 1, Varga 4–5 (`Mercury` written deeds, `6th`/`8th` legal risk, retrogradation omissions)
- *Muhurta Chintamani* — Avoiding `Vipat`/`Pratyak`/`Vadha` taras for formal agreements
- *Lunar Astro* — `KD22` / `K64L` transit caution & `Shelter-in-Place` legal documentation (`SKILL.md` §6)

---

## 4. Dashboard 04 Attribution & Source Catalog

| Source / Tradition | Author / Origin | Specific Sections / Concepts Applied | Role in Dashboard 04 |
|---|---|---|---|
| *Brihat Parashara Hora Shastra (BPHS)* | Maharishi Parashara | Ch. 7 (*D10 Dashamsha*, *D30 Trimshamsha*), Ch. 16 (`5th`), Ch. 17 (`6th`), Ch. 18 (`7th`), Ch. 19 (`8th`), Ch. 20 (`9th`), Ch. 21 (`10th`), Ch. 22 (`11th`), Ch. 45–51 | Full Bhava, Varga, and Dasha architecture across Cards `#30`–`#37`. |
| *Jaimini Upadesha Sutras* | Maharishi Jaimini | Ch. 1.1–1.4 (`AmK`, `DK`, `GK`, `A6`, `A7`, `A8`, `A10`, `A11`, `AL`, *Narayana/Chara Dasha*) | Commercial partners (`A7`), public authority (`A10`), allies (`A11`), and rivals (`GK`) across all 8 cards. |
| *The Crux of Vedic Astrology* | Pt. Sanjay Rath | *Dashamsha (D10)* house mapping (`5th` reports, `6th` peers/service, `7th` partners/clients, `10th` authority, `11th` allies) | Core `D10` interpersonal differentiation across Cards `#30`–`#37`. |
| *Phaladeepika* & *Saravali* | Mantreswara / Kalyana Varma | Ch. 17–18, Ch. 20 (*Neecha Bhanga* / *Vargottama*), Ch. 26 (*Gochara*) | Authority dynamics, `Saturn` in `6th`, and transit timing in Cards `#31`, `#32`, `#35`. |
| *Uttara Kalamrita* & *Prasna Marga* | Kalidasa / P. Namboodiri | Kanda 1 Varga 4–5 (`Mercury` contracts, retrogradation); Ch. 15–16 (disputes & hidden agendas) | Written agreements, `Mercury Rx` cautions, and office politics in Cards `#32`, `#34`, `#37`. |
| *Tithi Pravesha* & *Double Transit* | Pt. Sanjay Rath / K.N. Rao | `TP D10`, `yearLord`, *Karya Siddhi/Artha/Kali Sahams*, Jupiter+Saturn Double Transit | Annual workplace radar and partner/deal timing across Cards `#30`–`#37`. |
| *Muhurta Chintamani* & *Lunar Astro / SOUL.md* | Daivajna Rama / Deepanshu Giri / Internal | Navatara/Tara Bala, `KD22`/`K64L`, *Shelter-in-Place* documentation, **Rule 0 Multi-Entity Disambiguation**, **4-Tier Playbook** | Multi-track counterparty disambiguation, contract signing safety, and ethical prescriptions across all 8 cards. |
| *AIAstra Architecture & Search Research* | Internal Specs (`docs/reading-engine/75`, `76`, `78`, `80`) | `getD9MaturityAgeYears()`, `evaluateD1D9MutualConfirmation`, `D11`/`D30`/`yearLord` gap notes, Search trends | Age-36 gate, engine gap transparency, and consumer workplace query alignment. |
