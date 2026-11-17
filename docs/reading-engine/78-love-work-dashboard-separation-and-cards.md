# 78. Love & Work Dashboard Separation, Vedic Divisional Methodology, Search-Trend Research & Card Architecture

**Date:** 2026-11-16  
**Status:** Research & Architecture Proposal  
**Related Docs:** `68-self-board-v3-your-cards-your-months.md`, `69-love-and-work-boards-v3.md`, `71-card-picker-art-and-card-options.md`, `75-self-foundation-card.md`, `76-d9-divisional-charts-dasha-tithi-pravesh-architecture.md`

---

## 1. Status of Admin-to-User Messaging

- **Server (`AIAstra_Server`) & Web (`AIAstra_WEB`):** **Implemented, tested, migrated, and deployed to `develop` & `release-candidate-staging`** (Lambda + Amplify) on 2026-11-15:
  - **Database:** `user_notifications` table (`UserNotification` Prisma model, migration `20261115100000_user_notifications_m53`), with `title`, `body`, and `metadata` AES-256-GCM sealed at rest in `SEALED_MODELS` (`src/lib/pii/fields.ts`).
  - **Server Admin API (`src/routes/adminNotificationRoutes.ts`):** `POST /api/admin-lab/notifications/send` and `GET /api/admin-lab/notifications` (guarded by `ADMIN_LAB=1` + `x-admin-lab-token`, recording `admin_actions` rows without PII body).
  - **Server Consumer API (`src/routes/notificationRoutes.ts`):** `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`, `DELETE /api/notifications/:id` (protected by `requireUser`).
  - **Web Header UI (`AIAstra_WEB/src/components/NotificationBell.tsx`):** Bell icon + unread badge (`9+` cap) + 60s visibility-aware polling + dropdown inbox mounted in `TopNavigation.tsx`.
- **Admin Module (`aiadastra_admin`):** **Not yet wired.** The 2026-11-15 buildout was scoped to Server and Web only; `aiadastra_admin` still needs the staff UI/API form calling `POST /api/admin-lab/notifications/send`.

---

## 2. Why Love & Work Dashboards Have Not Been Updated to Match Self v3

Review of the five recent workstreams (`dfdaae72`, `34362674`, `40acf766`, `870810d2`, `5087423f`) and `docs/reading-engine/69` + `71`:

1. **Explicit Sequencing Behind Self v3 & Self Foundation (`doc 69`, `doc 71`, `doc 75`):**
   - `doc 69` (*Love and Work boards v3*, approved 2026-11-09) explicitly deferred Love & Work v3 behind Self Phase B: *"Build after Self Phase B proves the card contract."*
   - `doc 71` (*The card picker gets art, and every card gets options*, 2026-11-10) built the shared picker & layout store (`src/reading/boards/catalogue.ts`, `/api/board/:board/v3/catalogue|layout`, and `AreaCards` on Love/Work), **but left Love/Work card readings unbuilt** because `Self` was still evolving its v3 card contract (`ShortFace`, `ReadFace`, `CardToolbar`, `SelfFoundation`, `doc 75`).
   - As a result, `LovePage.tsx` still renders `AreaBoardView` over `/api/area/love` and `WorkPage.tsx` still renders the Phase 1 `WorkPage` over `/api/area/career` — code-only boards with `AreaCards` chips bolted on, rather than the full Self v3 card/Oracle/Personalizer experience.
2. **Parallel Priorities Across the 5 Recent Threads:**
   - `dfdaae72`: Self v2/v3 UI polish, Personalize Wizard modal in header, left-sidebar space reclamation, technique badges, and live QA on `vedic-astrology.app`.
   - `34362674`: Enterprise security hardening (ASVS 5.0 L2), dual-plane error telemetry (`app_error_events`), Upstash Redis rate limiting, and staging deploys.
   - `40acf766`: Retrograde (*Vakra*) planet architecture, D9/Divisional varga routing (`doc 76`), and Self reading quality.
   - `870810d2`: AWS billing/quota audits, owner sign-up/sign-in email alerts (`ownerAlerts.ts`), and worktree cleanup.
   - `5087423f`: Admin-to-user messaging (Server + Web) and header Notification Bell.

---

## 3. Love & Relationships: Should Dating, Marriage, Friendships & Professional Relationships Be Separated?

### 3.1 Vedic Astrology Recommendation: **Yes — Separate by Bhava, Karaka, Arudha & Varga**

In Jyotish, lumping all human bonds into a single "Love" bucket blurs **completely different astrological mechanisms**:

| Relationship Domain | Primary Houses (`D1`) | Karakas & Arudhas | Primary Divisional Charts | Why It Cannot Share One Card Set |
| :--- | :--- | :--- | :--- | :--- |
| **Dating & Romance** | 5th (romance, attraction, courtship), 11th (desires), 12th (intimacy) | Venus (attraction), Mars (passion), Moon (emotional pull), **A5** (Mantra/Romance Pada) | **D1 + D9** (attraction vs capacity), **D7** (creative/romantic chemistry) | 5th house governs falling in love, dating, and passion; a person can have a vibrant 5th house (easy dating) and an afflicted 7th/D9 (hard commitment). |
| **Marriage & Committed Partnership** | 7th (legal/karmic union), 2nd (family/kutumba), 4th (domestic peace), 8th (longevity/in-laws), 12th | Jupiter (husband/dharma), Venus (wife/harmony), **DK** (Darakaraka), **UL** (Upapada Lagna) | **D9 (Navamsha)** (mandatory joint `D1+D9` confirmation, especially age 36+), **D30** (strain/crisis) | Marriage is governed by 7th + UL + D9 + 2nd/4th/8th, not 5th house flirtation. Asking a married person "Meeting someone" or a single person "In-laws" breaks trust. |
| **Friendships & Social Circle** | 11th (friends, groups, allies), 3rd (peers, siblings, neighbors), 9th (mentors) | Jupiter (wise friends), Mercury (peers), Moon (emotional confidants), **A11** (Labha Pada) | **D11 (Ekadashamsha)** *(note: add D11 export in Radha per `TODOS.md`)*, **D1 + D9** 11th | 11th house is platonic support, community, and who carries you when life is heavy. Malefics in 11th/A11 create fair-weather friends or sudden fallouts. |
| **Professional Relationships** | 6th (coworkers, subordinates, office rivals), 7th (business partners, clients), 10th (bosses/authority) | Sun (authority/boss), Saturn (discipline/hierarchy), Mercury (colleagues/trade), **A10 / A7** | **D10 (Dashamsha)** 6th/7th/10th/11th, **D11** (gains from partners), **D30** (disputes) | Workplace friction is 6th house / D10; co-founder/client trust is 7th in D10 + D11. It is astrological malpractice to read a boss conflict using Venus/D9. |

**Practical Product Architecture:**  
Rather than forcing 4 separate top-level tabs in the left sidebar (which clutters navigation), group **Dating & Romance**, **Marriage & Committed Partnership**, and **Friendships & Social Circle** under **Relationships** (with a clear segmented lens switcher or status-routed default), and place **Professional Relationships** either as a dedicated lens in **Work** (recommended for context) or bridged between Relationships and Work.

---

### 3.2 Google Search Trends: What People Actually Ask About Relationships

Aggregate search trends and practitioner data (60–70% of all astrology/tarot/psychic queries) show users cluster around **timing, hidden intent, pattern-breaking, and crisis resolution**:
1. **Dating & Romance:** *"Does he/she actually love me?"*, *"Mixed signals / intentions"*, *"Will my ex come back? (No-contact / Venus Retrograde)"*, *"Twin flame / karmic connection"*, *"Why do I keep repeating the same dating pattern?"*, *"When will I meet someone?"*
2. **Marriage & Commitment:** *"When will I get married / why is marriage delayed?"*, *"Love vs. arranged / family acceptance"*, *"Is this relationship going to last / lead to marriage?"*, *"Divorce or separation indicators / can we repair this?"*, *"Is my partner hiding something / trust issues?"*, *"In-laws and domestic peace."*
3. **Friendships:** *"Friendship compatibility / why do I feel drained by my circle?"*, *"Betrayal or distance with a close friend"*, *"Finding my true community / tribe."*
4. **Professional Relationships:** *"Why do I clash with my boss or coworker?"*, *"Toxic workplace politics / backstabbing"*, *"Is this business partner trustworthy?"*, *"Ideal co-founder / client dynamic."*

---

### 3.3 Proposed Relationship Dashboards & Cards (Full-Circle Coverage)

Every card below follows the Self v3 contract: **Area of Focus** + **Oracle Question** (chart-grounded, dated windows, zero jargon) + **Personalizer Goal** (plain-English coaching tailored to `person_facts`).

#### Dashboard A: Dating & Romance (10 Cards)
1. **Where Dating Stands (12-Month Pulse)** — *Oracle:* Map 5th/11th/Venus/Mars dasha + TP + transit windows. *Personalizer:* Give the year's emotional weather and best windows to put yourself out there vs pause.
2. **When You Meet Someone** — *Oracle:* Identify 5th/7th/11th/UL activation & Jupiter/Venus triggers. *Personalizer:* Name realistic windows for new introductions and what settings favor meeting.
3. **Why It's Taking Time** — *Oracle:* Diagnose Saturn/Rahu/Ketu blocks on 5th/7th/Venus and when they lift. *Personalizer:* Replace self-blame with the exact block and easing date.
4. **The Partner You Draw (Attraction Pattern)** — *Oracle:* Read `DK`, `A5`, 5th/7th lords, and Venus/Mars in D1+D9. *Personalizer:* Explain who you naturally magnetize vs who actually steadies you.
5. **How They Feel & Mixed Signals** — *Oracle:* Check 5th/7th/Moon/Mercury clarity vs Rahu/12th fog in active dasha. *Personalizer:* Help the user spot clarity vs projection without claiming mind-reading.
6. **Exes, No-Contact & Reopening Doors** — *Oracle:* Check retrograde Venus/Mercury, Ketu/Rahu sub-periods, and 5th/8th/12th returns. *Personalizer:* Clarify whether a return is karmic closure or a real second chance.
7. **Karmic Pull vs. Real Compatibility** — *Oracle:* Separate Rahu/Ketu/8th intensity from Jupiter/D9 stability. *Personalizer:* Distinguish chemistry/obsession from sustainable warmth.
8. **Intimacy & Emotional Safety** — *Oracle:* Read 4th/8th/12th + Moon/Venus comfort. *Personalizer:* Show what helps the user open up without over-giving.
9. **Breaking Your Dating Loop** — *Oracle:* Identify recurring 5th/6th/8th/12th Dasha-activated habits. *Personalizer:* Give one concrete behavioral shift for the current period.
10. **Turning Dating Into Commitment** — *Oracle:* Track 5th-to-7th handoff in D1+D9 and Jupiter transits. *Personalizer:* Name when a casual bond is ready to become exclusive—or when to walk away.

**Full-Circle Guarantee (Dashboard A):** Together, these 10 cards cover *timing* (1, 2, 3), *pattern & attraction* (4, 7, 9), *live ambiguity* (5, 6, 8), and *transition to commitment* (10).

#### Dashboard B: Marriage & Committed Partnership (12 Cards)
1. **Where Your Partnership Stands** — *Oracle:* 7th/UL/D9 + active Mahadasha/Antardasha + TP `yearLord`. *Personalizer:* 12-month state of the bond, period by period.
2. **Marriage Timing & Readiness (If Unmarried/Engaged)** — *Oracle:* D1+D9 7th/UL + Jupiter/Saturn double transit. *Personalizer:* When commitment matures and what needs to be settled first.
3. **Warmth & Day-to-Day Harmony** — *Oracle:* 4th/7th/Venus/Moon in D1+D9. *Personalizer:* Where ease lives between you and how to protect it.
4. **Distance, Strain & Conflict Cycles** — *Oracle:* 6th/8th/12th/Mars/Saturn/Rahu pressure on 7th/D9/D30 with exact ease dates. *Personalizer:* De-escalate tension with timing and practical boundaries (never a divorce verdict).
5. **Communication & Unspoken Resentments** — *Oracle:* 2nd/3rd/Mercury/Moon under stress. *Personalizer:* How to have hard conversations during supportive windows.
6. **Trust, Transparency & Hidden Stress** — *Oracle:* 8th/12th/Rahu/Ketu activations on 7th/D9. *Personalizer:* Address intuition/transparency anxieties constructively without paranoia.
7. **Repair & Reconciliation (During Separation/Crisis)** — *Oracle:* Check 7th/UL longevity + easing windows vs Ketu detachment. *Personalizer:* Show when a door can reopen and what repair requires.
8. **Family, In-Laws & Shared Home** — *Oracle:* 2nd/4th/8th houses + `UL` 2nd/4th. *Personalizer:* Navigate extended family pressure and household decisions.
9. **Shared Money & Responsibilities** — *Oracle:* 2nd/8th/11th in D1+D9+D2. *Personalizer:* Align financial expectations and uneven domestic/workloads.
10. **Children & Family Growth** — *Oracle:* 5th house/Jupiter + **D7 (Saptamsha)** active periods. *Personalizer:* Supportive windows for family planning or parenting harmony.
11. **Long-Term Longevity & Second Half of Life** — *Oracle:* D9 Navamsha strength (especially age 36+ per `doc 76`) + `UL`. *Personalizer:* Show how the marriage evolves and deepens over decades.
12. **Your Role & Growth Inside Marriage** — *Oracle:* Lagna/D9 Lagna + `AK` + `DK` interplay. *Personalizer:* What the partnership is asking *you* to mature into right now.

**Full-Circle Guarantee (Dashboard B):** Covers *macro state* (1, 11), *commitment/repair* (2, 7), *daily bond* (3, 4, 5, 6), *practical life* (8, 9, 10), and *personal evolution* (12).

#### Dashboard C: Friendships & Social Circle (7 Cards)
1. **Your Social Energy This Year** — *Oracle:* 11th/3rd/Moon/Mercury active periods. *Personalizer:* When to lean into community vs protect solo recharge time.
2. **The Friends Who Truly Carry You** — *Oracle:* Benefics in 11th/`A11`/D9 11th (and D11 once wired). *Personalizer:* Identify the type of loyal allies who show up for you.
3. **Outgrowing Circles & Friendship Friction** — *Oracle:* Ketu/Saturn/6th/8th hits to 11th/`A11`. *Personalizer:* Normalize why certain friendships fade or feel draining right now.
4. **Finding Your Tribe & New Communities** — *Oracle:* 11th/9th/3rd + Jupiter/Rahu openings. *Personalizer:* Where and when new aligned friendships form.
5. **Boundaries & Energy Drains** — *Oracle:* 6th/12th/Moon/Rahu sensitivity. *Personalizer:* Spot one-sided dynamics and set clean boundaries.
6. **Mentors, Elders & Supportive Guides** — *Oracle:* 9th/Jupiter/D9 9th. *Personalizer:* When wise counsel or community elders enter your path.
7. **Social Reputation & Belonging** — *Oracle:* `A11` + 10th/11th link. *Personalizer:* How groups experience you and how to deepen genuine belonging.

**Full-Circle Guarantee (Dashboard C):** Covers *capacity* (1), *loyal core* (2, 6), *friction/boundaries* (3, 5), and *expansion/belonging* (4, 7).

#### Dashboard D: Professional Relationships & Allies (8 Cards)
1. **Workplace Dynamics This Year** — *Oracle:* **D10** 6th/7th/10th/11th + D1 6th/10th. *Personalizer:* Overall climate with coworkers, bosses, and clients.
2. **Bosses, Authority & Mentors at Work** — *Oracle:* Sun/Saturn/9th/10th in D1+D10. *Personalizer:* How to handle demanding leadership or earn sponsorship.
3. **Colleagues, Teams & Office Politics** — *Oracle:* 6th house/Mercury/Mars/Rahu in D10 + D30. *Personalizer:* Navigate competition, credit-stealing, or team friction with dates.
4. **Business Partners & Co-Founder Fit** — *Oracle:* 7th in D10 + 11th/D11 gains + D30 contract risk. *Personalizer:* When partnerships multiply results vs create deadlock.
5. **Clients, Deals & Public Trust** — *Oracle:* 7th/`A7`/`A10` in D1+D10. *Personalizer:* Best windows for pitching, negotiating, and retaining key clients.
6. **Managing & Leading People** — *Oracle:* 5th/6th/10th + Sun/Jupiter/Saturn in D10. *Personalizer:* How your leadership lands on direct reports and when to delegate.
7. **Networking & Career Allies** — *Oracle:* 11th/`A11`/D10 11th. *Personalizer:* Warm introductions, referrals, and industry allies.
8. **Contracts, Disputes & Protection** — *Oracle:* 6th/8th + **D30** + Saturn/Rahu in D10. *Personalizer:* Windows to double-check agreements and avoid avoidable disputes.

**Full-Circle Guarantee (Dashboard D):** Covers *vertical* (bosses 2, reports 6), *horizontal* (colleagues 3, network 7), *external* (partners 4, clients 5), and *risk/climate* (1, 8).

---

## 4. Career & Work: Should Start of Career, Primary Job, Hobby & Business Be Separated?

### 4.1 Vedic Astrology Recommendation: **Yes — Each Uses a Distinct Divisional Lens**

In Jyotish, **Start of Career**, **Primary Job**, **Hobby**, and **Business** are fundamentally different karmic engines:

| Work Mode | Primary Houses (`D1`) | Karakas | Primary Divisional Charts | Why Separation Matters |
| :--- | :--- | :--- | :--- | :--- |
| **Start of Career (Graduation & First Break)** | 4th/5th/9th (education) -> 10th/6th (entry) | Mercury, Jupiter, `AmK` | **D24 (Siddhamsha)** + **D10** + **D1** | Tests whether academic degrees (`D24`) convert smoothly into a first role (`D10`), and guides the 20s *Saturn Return* / early Dasha transition. |
| **Primary Job (Employment)** | 6th (service, routine, colleagues), 10th (role, boss, status), 11th (salary) | Saturn (service), Sun (authority), `AmK` | **D10 (Dashamsha)** + **D2 (Hora)** | Evaluates promotion, job security, toxic boss/team, salary raises, and role changes within structured organizations. |
| **Hobby & Creative Side-Projects** | 3rd (self-effort, craft, hands), 5th (creativity, joy, play) | Venus (art), Mercury (craft), Moon (imagination) | **D7 (Saptamsha — creative birth)** + **D24** + **D16** | Protects joy and creative fertility (`D7`) without prematurely forcing corporate pressure onto a passion—while spotting when a hobby can monetize. |
| **Business & Field of Business** | 3rd (risk/initiative), 7th (clients/trade), 11th (scale/profit), 2nd (capital) | Mars (drive), Rahu (scale/disruption), Mercury (commerce), Sun (independence) | **D10 (1st/7th/11th)** + **D2 (Hora)** + **D4 (assets)** + **D11 (gains)** + **D30 (risk)** | Measures risk tolerance, liquid cashflow (`D2`), infrastructure (`D4`), client/partner viability, industry fit, and legal/fraud protection (`D30`). |

**Practical Product Architecture:**  
Keep **Work** as one top-level destination in the left sidebar, and let the user's `work.status` / `work.mode` (from the Personalize Wizard + board question) select or switch between the 4 focused sub-dashboards (**Career Start**, **Primary Job**, **Hobby & Craft**, **Business & Venture**), so a college graduate never sees "Managing Direct Reports" and a founder never sees "Getting a Promotion."

---

### 4.2 Google Search Trends: What People Actually Ask About Career, Work, Business & Graduation

Search trends and consultation data show four distinct clusters:
1. **Graduation & Career Start:** *"Am I on the right path after college?"*, *"Which job offer should I take?"*, *"Why can't I land my first break?"*, *"Saturn Return career confusion (ages 27–30)"*, *"Relocating / working abroad after graduation."*
2. **Primary Job:** *"When is the best time to change jobs / should I quit?"*, *"Will I get the promotion or raise?"*, *"How do I handle a toxic boss or coworker?"*, *"Job security / layoff anxiety"*, *"Why do I feel stuck or burnt out?"*
3. **Hobby & Creative Pursuits:** *"Should I turn my hobby/passion into a side hustle?"*, *"What creative outlet fits my chart?"*, *"Why did I lose motivation for my craft?"*
4. **Business & Field of Business:** *"Job vs. Business — am I built to be an entrepreneur?"*, *"What field/industry of business suits me best?"*, *"Is now a financially stable time to launch?"*, *"How do I attract clients and break through a revenue plateau?"*, *"Business partner trust & legal risk."*

---

### 4.3 Proposed Career & Work Dashboards & Cards (Full-Circle Coverage)

#### Dashboard E: Start of Career — Graduation & First Break (7 Cards)
1. **Your Career Launch Window (Next 12 Months)** — *Oracle:* D1+D10+D24 active Dasha/TP periods. *Personalizer:* When momentum opens for interviews, offers, and first-year traction.
2. **Turning Your Degree Into a Career** — *Oracle:* Bridge **D24** (education/skills) with **D10** (profession). *Personalizer:* Whether your field of study directly fuels your work or pivots into an adjacent strength.
3. **Landing Your First Role** — *Oracle:* 6th/10th/11th openings + Jupiter/Saturn transits. *Personalizer:* What to focus on during quiet months vs active hiring windows.
4. **Choosing Between Two Paths or Offers** — *Oracle:* Compare `AmK`/10th/D10/D2 alignments for stability vs growth. *Personalizer:* A practical decision lens when facing competing early-career options.
5. **Overcoming Imposter Syndrome & Early Doubt** — *Oracle:* Moon/Mercury/Saturn/Lagna stress in D1+D24. *Personalizer:* Separate temporary confidence dips from actual capability.
6. **Relocation & Working Abroad** — *Oracle:* 3rd/9th/12th + Rahu in D1+D10+D4. *Personalizer:* Whether moving cities/countries accelerates your start.
7. **Building Your 3-Year Foundation** — *Oracle:* Upcoming Mahadasha/Antardasha + Saturn maturity arc. *Personalizer:* What skills and habits to lock in over the next 1–3 years.

**Full-Circle Guarantee (Dashboard E):** Covers *timing* (1, 3), *education-to-work fit* (2, 4), *mindset & location* (5, 6), and *3-year trajectory* (7).

#### Dashboard F: Primary Job & Corporate Growth (11 Cards)
1. **Where Your Job Stands (12-Month Pulse)** — *Oracle:* D1+D10 6th/10th/11th + TP `yearLord` + active Dasha. *Personalizer:* Period-by-period tone of your working year.
2. **Job Security & Layoff / Restructuring Risk** — *Oracle:* 6th/8th/12th/Saturn/Rahu/Ketu pressure on D10. *Personalizer:* Honest readiness windows (when to prepare quietly vs stay put).
3. **Should You Stay or Change Jobs?** — *Oracle:* 6th->10th->11th vs 8th/12th shifts in D10. *Personalizer:* Timing for resume prep, interviews, and making the leap.
4. **Promotions, Titles & Recognition** — *Oracle:* Sun/Jupiter/10th/11th/`A10` in D1+D10. *Personalizer:* Windows to ask for a raise, title bump, or visible project.
5. **Salary, Bonuses & Cashflow** — *Oracle:* 2nd/11th + **D2 (Hora)** + D10 11th. *Personalizer:* Thin stretches vs openings for compensation growth.
6. **What Wears You (Burnout & Heavy Load)** — *Oracle:* 6th/8th/Saturn/Mars pressure + Moon/D30 strain. *Personalizer:* Name the source of burnout, when it eases, and how to pace.
7. **Bosses, Leadership & Politics** — *Oracle:* Sun/Saturn/6th/10th in D10. *Personalizer:* Navigate difficult managers or organizational politics cleanly.
8. **Leading Teams & Authority** — *Oracle:* 5th/10th/Sun/Jupiter in D10. *Personalizer:* Step into management and delegate effectively.
9. **Switching Industries or Roles** — *Oracle:* Rahu/Ketu/8th/D10 Lagna shifts. *Personalizer:* Whether a pivot is temporary restlessness or a true new chapter.
10. **Work Abroad & Remote Flexibility** — *Oracle:* 9th/12th/Rahu in D10+D4. *Personalizer:* Opportunities tied to foreign teams, travel, or relocation.
11. **What Skill to Build Next** — *Oracle:* **D24** + Mercury/Jupiter in D10. *Personalizer:* The highest-leverage capability to sharpen during calmer stretches.

**Full-Circle Guarantee (Dashboard F):** Covers *stability & change* (1, 2, 3, 9), *upside & money* (4, 5, 11), *stress & people* (6, 7, 8), and *geography* (10).

#### Dashboard G: Hobby, Craft & Creative Side-Projects (6 Cards)
1. **Your Creative Flow This Year** — *Oracle:* **D7 (Saptamsha)** + 5th/3rd/Venus/Mercury periods. *Personalizer:* When inspiration and output peak vs when to rest.
2. **The Craft That Energizes You** — *Oracle:* 3rd/5th lords + D7/D24/Venus/Mercury/Mars. *Personalizer:* Identify the creative/hands-on pursuits that restore your energy.
3. **Creative Blocks & Loss of Motivation** — *Oracle:* Saturn/Ketu/12th hits on 5th/D7. *Personalizer:* Why momentum stalled and when creative spark returns.
4. **Turning a Hobby Into a Side Hustle** — *Oracle:* 5th-to-11th/2nd link + D7->D10->D2 bridge. *Personalizer:* Whether to keep it pure joy or test monetizing it—and when.
5. **Finishing & Shipping Your Project** — *Oracle:* 3rd/11th/Mars/Saturn discipline in D7+D10. *Personalizer:* Windows to move from tinkering to publishing or launching.
6. **Community & Audience for Your Work** — *Oracle:* 11th/`A11`/D7 11th. *Personalizer:* How and when people resonate with what you create.

**Full-Circle Guarantee (Dashboard G):** Covers *inspiration* (1, 2, 3), *execution* (5), *audience* (6), and *monetization decision* (4).

#### Dashboard H: Business, Venture & Field of Business (11 Cards)
1. **Job vs. Business Readiness** — *Oracle:* Compare 6th (service) vs 3rd/7th/11th + D10 1st/7th + D2 (Hora). *Personalizer:* Clarify whether you thrive solo, as a founder, or in a hybrid transition.
2. **Your Ideal Field & Industry of Business** — *Oracle:* 10th/7th/2nd lords, `AmK`, **D10** strongest planets/elements, **D24**. *Personalizer:* Narrow down the actual business domains and roles that fit your wiring.
3. **Timing Your Launch or Major Pivot** — *Oracle:* D10 + D2 + Tithi Pravesha `yearLord` + Dasha openings. *Personalizer:* Green-light windows to incorporate, launch, or expand vs build quietly.
4. **Revenue, Cashflow & Profit Margins** — *Oracle:* **D2 (Hora)** + 2nd/11th + **D11** (once wired). *Personalizer:* Predict thin cashflow stretches vs high-margin inflows.
5. **Clients, Sales & Market Pull** — *Oracle:* 7th/`A7`/`A10` in D1+D10. *Personalizer:* When inbound demand rises and what messaging/positioning lands.
6. **Co-Founders & Business Partnerships** — *Oracle:* 7th in D10 + 11th/D11 + D30. *Personalizer:* Whether to go solo or partner—and what governance protects the bond.
7. **Hiring, Team & Delegation** — *Oracle:* 5th/6th/10th in D10. *Personalizer:* When to hire and where operational bottlenecks form.
8. **Capital, Assets & Infrastructure** — *Oracle:* **D4 (Chaturthamsha)** + 2nd/4th/11th. *Personalizer:* Decisions on equipment, leases, funding, or fixed assets.
9. **Scaling, Risk & Bold Moves** — *Oracle:* 3rd/11th + Rahu/Mars in D10. *Personalizer:* When bold expansion pays off vs when over-leveraging backfires.
10. **Legal, Contracts & Financial Safeguards** — *Oracle:* 6th/8th + **D30 (Trimshamsha)**. *Personalizer:* Specific risk windows to audit contracts, taxes, and compliance.
11. **Founder Energy & Avoiding Burnout** — *Oracle:* Lagna/Moon/6th/12th + D30. *Personalizer:* Sustain your stamina so the business doesn't consume your health.

**Full-Circle Guarantee (Dashboard H):** Covers *identity & domain* (1, 2), *launch & scale* (3, 9), *economics* (4, 5, 8), *people & partners* (6, 7), and *risk & sustainability* (10, 11).

---

## 5. Engine & Implementation Notes

1. **D11 (Ekadashamsha) Engine Gap:** Per `docs/TODOS.md`, Radha currently exports `D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D60` (14 vargas) and does **not** yet export `D11`. Friendships (Dashboard C) and Business Partnerships/Gains (Dashboards D & H) can launch immediately using `D1` 11th + `A11` + `D9` + `D10` + `D2`, and upgrade cleanly once `D11` is added to Radha.
2. **Card Count Discipline:** Each sub-dashboard proposes **6–12 cards** (well within the 5–25 range), with **4–5 suggested starter cards** pinned by default based on `person_facts` (`love.status`, `work.status`, `age_band`) and the rest available in the `+` Card Picker (`doc 71`).
3. **Zero Node Astrology Rule:** All divisional chart calculations, `UL`/`AL`/`A5`/`A7`/`A10`/`A11`, `DK`/`AmK`, `Dasha`, and `Tithi Pravesha` windows come strictly from Radha (`AIAstra_Radha`).
