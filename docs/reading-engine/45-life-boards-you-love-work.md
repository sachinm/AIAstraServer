# 45 — Life boards: You, Love, Work. One product, three dashboards, for people who have never heard of a trine

Status: **design and build plan, 2026-11-05. Finalises the dashboard direction.** It supersedes the user-facing parts of
[doc 44](44-career-board-storm-and-fair.md) (names, entrances, words) and generalises [doc 42](42-life-area-reading-career.md)
and [doc 43](43-career-reading-technique.md) from one area to three. The chart rules in doc 43 §3–§8 stand; only their
names change (§18). No code is written. Written from Sachin's briefs of 2026-11-05 and four surveys the same day: the
web app, the stored chart data, the market, and the Co-Star logged-in design.

## 0. Answer first

1. **The product is the operating system for a person's life.** After sign-in the person lands on **Today**, not in a
   chat box. Under it sit three boards read from the 12-house map: **You** (house 1), **Love** (house 7), **Work**
   (house 10). Chat stays as the fifth tab, **Ask**. Nine further boards (money, home, family, learning, health facts,
   luck, travel, gains, rest) are new config files on the same machine, later.
2. **Apple standard: digested, never raw.** No planet, dasha, nakshatra, house, trine or square on any first screen. The
   person reads a finished conclusion in their own terms ("A heavy stretch with your manager. It eases from 1 Feb").
   The workings are one tap down, in plain words; the technical chart is a Settings toggle for astrologers (§3.4).
3. **Our brand, Co-Star's cleanliness.** We keep our dark-sky look, name and voice. We borrow Co-Star's structure: one
   line first, a plain list, almost no chrome, a tab bar, a short "good for / better to wait" pair. We do not borrow its
   planet-first organisation or its harsh tone (§3.2).
4. **Organised by worry, not by planet.** Every board is a list of the things people lose sleep over ("Will this job
   hold?", "Why do we keep fighting?", "Who am I becoming?"). Each worry gets one verdict, one window, one thing to do.
5. **A time ladder, and it starts with the past.** *Looking back* (6 months, this year, last year) → *Now* → *Ahead*
   (1 month, 3 months, 6–9 months, 1–2 years). The back-check is how a person learns to trust the forward view, and each
   answer they give is measured data (§9).
6. **No hospital, weather or danger words on any screen.** The idea that a person in a hard stretch needs a calm,
   quick, bare board and a person in a good stretch needs a welcoming, open one stays. It lives in layout and pace, never
   in labels. Five **tones** replace the old names: *Demanding, Easing, Steady, Open, Closing* (§7).
7. **Build order:** Work first (most designed), then Love, then You. **Tab order** is You, Love, Work, because "who am
   I" is the primary board. Phase 0 builds the shell, Today and the tone engine once for all three (§15).
8. **One recommendation:** one generic board engine (area configs, dates by code, agents for meaning), one shell, three
   configs, shipped behind a flag with template text first and no model cost (§16).

## 1. Start: the system as it is, facts checked 2026-11-05

**The web app** (`AIAstra_WEB/src`, surveyed today):

| Fact | Detail |
|---|---|
| First screen after sign-in | `/dashboard/chat` (`routes.tsx`). There is no home, overview or "today" view anywhere; nothing shows today's sky, a day grade or a panchang |
| Navigation | Top bar with logo, usage bar (free plan) and an avatar menu: Chat, Charts, Remedies, Mantras/Horoscope, Profile, Plan, Life timeline, Settings, Log out. No tab bar |
| Profile | Four tabs: Details, Plan, Life timeline (past reading behind `VITE_TIMELINE_ENABLED`, plus the life-events ledger), Settings |
| Design system | Hand-written Tailwind 3, `lucide-react`, no component library, no tokens (`theme.extend` is empty), dark only, a card class string copied into every file, English-only i18n with most copy hard-coded |
| Existing area words | Chat chips: Work and career, Money, Relationship, Marriage timing, Property, This month, My nakshatras. Past reading filters: Career and Wealth, Education, Relationships and Family, Relocation, Health and Psychology |
| Half-built or broken | Mantras and Remedies build colour classes at runtime (`from-${color}-900/10`), which Tailwind never generates; the mantra play button is a fake progress bar; `assistantApi.askAssistant` has no caller |

**The data** (`AIAstra_Server`, stored per person):

| Layer | What exists |
|---|---|
| Charts | D1, D2, D3, D4, D7, D9, D10, D12, D30, D60 in the dossier (`vargas`); D16, D20, D24, D27 as catalog rows only; D5, D6, D8, D11, D40, D45 not served |
| Houses and points | 12 houses with lords, occupants, aspects, argala, strength, class; cusp nakshatra per house (`cusp_nak`); arudhas A1–A12, AL, UL; Jaimini karakas (AK … DK); special lagnas; 18 yogas and 8 doshas present in the sample; planet nakshatra, pada, dignity, strength, avasthas |
| Dashas | 40-plus systems in the catalog; Vimshottari, Yogini, Tithi Ashtottari, Karaka, Dwisatpathi and Kaala at three levels; Narayana, Chara, Sudasa and others at two; `dasha.applicable` for the conditional ones |
| Annual | Tithi Pravesha, its dasha, Mudda, Patyayini and the 36 sahams per year (current year pulled at registration; 18 years for the past reading); the annual D10 is available on demand, not pulled by default |
| Transits | One shared sky for all users plus the per-person houses overlay (doc 35, `transit-sky-shared-for-all-users`); eclipses, stations, sade sati phases, double transit |
| Timeline v2 | Markers for parents, siblings, love and marriage, children, career, business, money, residence, property, education, health; gates D, T, E; the ledger and calibration; builds cover the past 18 years only |

**Gaps that matter for these boards** (each filed in `docs/TODOS.md`, §14 step 1):
1. There is no `self` marker and no annual (S5) system in the timeline engine.
2. There is no two-chart engine output (no Ashtakoota, no synastry), so partner comparison cannot be built yet.
3. There is no daily panchang, tarabala or chandrabala fetch, so "today" lines cannot be computed per person yet.
4. Past-reading ratings are probably not persisting: the `past_life_reading` data type is not seeded in
   `chart_data_types` and the foreign key is restrictive (`pastReadingFlow.ts:1125-1191`). Verify before building on it.
5. The shared sky's per-person overlay is not wired into readers; the daily pull needs the deploy session.

**The market** (research 2026-11-05; sources at the end):

| Product | What they get right | What we do differently |
|---|---|---|
| **Co-Star** | A day at a glance across six areas in three words; plain list; stark tone; ~30 M registered | Our organising unit is the worry, not the planet; our tone is steady, not harsh; we show dates a month to two years out |
| **The Pattern** | The only mass app built on *periods*: names the phase and how long it lasts, hides the mechanics, and has a "Time Travel" to any past date | We are per-person and dasha-based, we give a dated verdict per worry, and we make the back-check a first-run step |
| **align27** | Green/Amber/Red for every day, golden moments, a 180-day planner, rituals by area | Not a traffic light on days; one tone per area with a date it changes |
| Astrotalk, InstaAstro | Human astrologers by the minute; very large revenue (Astrotalk FY25 ₹1,214 Cr) | We are the self-serve first answer; chat hands off to a person later if wanted |
| Oura, WHOOP, Apple Weather | One verdict first, contributors one tap away, "now → next → long range" in that order, scrub to any date | Same hierarchy for a life |

No product shows a per-person, dasha-indexed back-check against the person's own past. That is open ground (Astro
Kanu and AskSoma keep public prediction logs; AstroNidan advertises past validation; none is per-user and mass-market).

## 2. The product in one page

**Who:** a person with a worry, not a person who knows what a nakshatra is. They come for "where am I", "what's coming",
"what should I do".

**Promise:** *"We know where you are in your work, your love and yourself, we can show you the last year to prove it, and
we tell you what the next month to two years hold, with dates."*

**What makes it stick:** Today gives a reason to open daily; Looking back makes the first session feel uncanny; Ahead
makes it worth paying; the person's own answers make it better each month.

**Moat:** the same chart read through many independent timing families, with every date traceable to a stored row and an
honest *not promised* when the chart does not promise something. No competitor shows that.

**Free and paid (proposal for Sachin, §17):** free = Today, one tone line per board, Looking back (the rapport hook), and
the next 30 days; paid = 3 months to 2 years, the dated windows, the worry pages in full, partner comparison. Market
norms: monthly $3.99–$14.99, annual about 7–9× monthly, no weekly trap, the category's 1-star reviews are about surprise
charges.

## 3. Design language: Apple-grade, digested

### 3.1 Ten rules (every screen is checked against them)

| # | Rule | In practice |
|---|---|---|
| 1 | **Digested, never raw** | The first screen of any board has a headline, one sentence and one action. No jargon, no tables, no charts of the sky |
| 2 | **One idea per screen** | Three things above the fold at most; the rest scrolls or opens a sheet |
| 3 | **Chosen defaults** | The app decides the tone, the order and what is shown first. The person is never asked to configure a view |
| 4 | **Depth on demand, in three levels** | Digest (default) → *Why we think so* (plain-language sheet) → *Chart details* (Settings toggle for astrologers). Never mixed on one screen |
| 5 | **Plain words, second person** | "You", not "the native". Dates as a person says them: "from 1 Feb", "before 7 May" |
| 6 | **Quiet by default** | Large titles, generous space, 17 px body, 44 px targets, one accent colour per board, no gradients on content, no red |
| 7 | **State in text, not only colour** | Every tone is a word and an icon; colour is a second cue. Works in greyscale and in dark and light |
| 8 | **Calm motion** | One fade or slide per change, 200–300 ms, all off under reduced motion |
| 9 | **Honest by construction** | A confidence word is shown when it is not certain; a date is shown only when a stored row supports it; *not promised* is said plainly |
| 10 | **Private by default** | Self-reports, answers and love-life data are sealed and deletable; nothing is shown to anyone else |
| 11 | **Modular, not a scroll** (Sachin, 2026-11-05) | A screen never stacks sections vertically for the person to scroll past. Sibling sections (areas, worries, horizons, the week's picks) are one panel: a swipeable carousel with chips and dots on the phone and tablet, a tab panel on the desktop. The person jumps to what they care about; the first card is the one the engine ranks highest |
| 12 | **Set once, never mentioned** (Sachin, 2026-11-05) | Place, time zone, birth details, work level and relationship status are set in the profile once. No screen restates them, no header or footer carries "San Jose · America/Los_Angeles (UTC−8)", and no screen explains itself. A board shows the verdict, the time and one line; the reasoning lives under Why and the settings under the profile |
| 13 | **Ask before you answer** (Sachin, 2026-11-05) | When the situation is unknown, the board or the chat asks one or two one-tap questions first ("Do you have a job right now?", "Is this about your boss?") and predicts only for that situation. A general prediction that can be caught wrong is never made. Answers are stored with the profile (rule 12) and not asked again while fresh (§3.5) |

### 3.2 Our brand and what we borrow from Co-Star

We keep the AI AdAstra name, the dark sky background (`.app-sky`), the purple and pink brand accent (used for titles and
primary buttons only), the voice of a warm guide and the existing logo. Added: design tokens (colour, type, space,
radius) in one place, a light theme, and a shared set of cards and sheets in place of the copied class string.

| Borrow from Co-Star | How we adapt it |
|---|---|
| One line first (their daily epigram) | A headline per board and a "For you today" line on Today |
| Day at a glance: a few life areas, one word each | Three boards, one tone word each (§7), with the date it changes |
| Plain list with thin dividers, almost no cards | Worry rows with a one-line answer chip; cards only for the main window |
| Do and Don't pair | "Good for" and "Better to wait" (two short lists of at most three items) |
| Bottom tab bar | Today · You · Love · Work · Ask |
| A natal page that reads like a short profile | *You* has "Who you are" in plain paragraphs, no planet list |
| Friends | Later: Love's partner comparison (§8.2, Phase 3). Co-Star opens the friend's chart first, then a grid by area (emotions, communication, conflict style); ours opens the area grid first |
| Epigram first, reasoning behind "Details →" (the transit is named only in the detail layer, never in the push) | Exactly our depth rule 4: headline first, *Why we think so* one tap down, Chart details behind a toggle |
| One refresh at midnight and **one** push a day, one line | One daily push at the person's morning, one line, naming the board that changed ("Work: a good window opens 12 Mar") |
| Three-and-three Do / Don't | "Good for" / "Better to wait", at most three each, concrete nouns |
| Chart as a table-or-wheel toggle with tap-to-scroll | *You → Your chart*: a plain profile first; the table/wheel appears behind Chart details |
| Transits chosen by what the person keeps opening | Order worry rows by what the person opens and confirms (Phase 3) |
| Sample-then-unlock at the exact section it enriches | The paywall sits on the worry or window it unlocks, with the first sentence visible, not a global gate |
| Design stance: "feels like paper", plain text and whitespace, no splashy banners, "a friend in your living room" | Same stance; lists with thin dividers over cards |

**What Co-Star gets wrong, which we avoid** (design critiques of the app, Pratt Institute 2022 and 2024, and App Store
reviews): body text "tiny" and light-weight; everything centre-aligned; tabs with abstract icons and small labels, so
the natal chart is hard to find; templated sentences that repeat day to day; a 2025 update that moved half the daily
reading behind a subscription of about $9 a month. We use 17 px body, left-aligned reading text, labelled tabs, daily
variety (the daily layer, Phase 3) and a paywall that never hides the day's headline.

Not borrowed: planet names as headings, the stark or jarring tone, black-and-white only, notifications that scold. Our
notifications say what changed and what to do ("Your Work board changed: a good window opens on 12 Mar").

### 3.3 Words: the banned list and what to say instead

The test (§14 step 4) scans every string a person can see, in all three layouts, for these.

| Never on screen | Say instead |
|---|---|
| storm, hurricane, flood, blizzard, disaster, weather, season, forecast | tone words of §7; "stretch", "window", "period" |
| hospital, emergency, ER, urgent care, doctor, surgery, triage | none; the calm layout does the work |
| resort, six-star, VIP, private jet | none; the open layout does the work |
| guaranteed, certain, absolutely, 100 %, safe | "no sign of", "looks steady", "most of your chart points this way" |
| planet names as subjects, dasha, mahadasha, antardasha, nakshatra, tithi, house, lord, trine, square, conjunction, transit, retrograde, saham, varga, D10 | "your current chapter", "this year's chart", "a slow-moving influence", "the sky this month" (Chart details may use them) |
| layoff-style fear words as headlines: fired, sacked, doomed | "a risk to the role", "time to prepare" (only inside the job-security row, never as a headline) |

### 3.4 Three depths

1. **Digest** (default, everyone): headline, sentence, action, dates.
2. **Why we think so** (a bottom sheet, plain words): "Your current chapter and this year's chart both point to
   pressure on pay. Four of seven independent signals agree." Lists the signals as sentences, not terms.
3. **Chart details** (Settings → "Show chart details", off by default): the family votes, the periods, the divisional
   charts, the sahams, with their real names. This is the old drawer of doc 44 §3.

### 3.5 The interview: ask before you answer

The chart cannot see whether the person has a job, whether the boss is the problem, or whether they are single. Guessing
produces the general prediction that gets caught wrong. So every board and every chat answer starts from **known
facts**, and asks for the missing ones with one tap each, in the person's words, never as a form.

| Trigger | Question (one tap) | What it changes | Stored as |
|---|---|---|---|
| First open of Work; Work worry rows; any career question in Ask | "Do you have a job right now?" → *Yes · Between jobs · Own business · Studying* | which worries lead (getting a job vs holding it), the words (clients vs manager), the signatures read | `profile.work_status` (rule 12; re-asked after 90 days or when the person taps "Something changed") |
| A Work tone of Demanding or a "workplace trouble" question | "Is this about your boss, the politics, the pay, or the role itself?" | which trouble signature and care level the board reads first; the headline | `area_self_reports.hardest` (sealed) |
| A hard-talk or interview scenario on Lucky times | "Is it your boss, a peer, a client, or a panel?" | the hora and star rules (authority vs peers), the avoid list | the scenario card only; not stored |
| First open of Love; any love question | "Right now are you single, seeing someone, or committed?" | whether meeting, keeping or mending leads; which points are read (UL vs 5th) | `profile.relationship_status` (sealed, deletable, re-asked after 90 days) |
| A Love strain tone | "Is this about distance, a fight, family, or trust?" | the strain signature and the what-helps list | `area_self_reports.hardest` |
| Any time horizon beyond 3 months | "Are you planning something, or just checking?" → *Planning · Checking* | planning shows the windows with dates; checking shows the tone only | not stored |
| A date in the past (Looking back) | "Did that feel right?" (§9) | the person's confirmed count; calibration | `area_checks` |

Rules: at most two questions before an answer; the question names the person's situation, never a chart term; a skipped
question gets the chart's estimate with "we're assuming you're employed" shown once; the answer is never shown back as
a fact and never changes a grade, only what is read first and how it is worded; the chat's Clarify step (doc 17) uses
the same questions and the same stored answers, so the person is not asked twice across chat and boards.

## 4. The map of the app

| Tab | What it is | Built from |
|---|---|---|
| **Today** (new home) | The date, one line for you, three board cards (tone word + one line + the date it changes), a "Good for / Better to wait" pair, an *Ask* bar | Tones of the three boards plus the daily layer (Phase 3; until then the state lines only) |
| **You** | House 1 board. Pages: Overview, Who you are, Chapters, Your year, Practices, Looking back | §8.3 |
| **Love** | House 7 board | §8.2 |
| **Work** | House 10 board | §8.1 and docs 42–43 |
| **Ask** | The existing chat, unchanged; answers cite a board ("see Work → Job change") and chips now deep-link into boards | existing `chat-interface/` |

The avatar menu keeps Plan, Settings, Life events and Log out. **Charts** moves to *You → Your chart* (a plain profile
plus, behind the Chart details toggle, the existing biodata cards). **Remedies** and **Mantras** move to *You →
Practices*, filtered by board. **Life timeline** becomes *You → Looking back* and *Life events*. The route
`/dashboard/chat` stays as the Ask tab; `/` for a signed-in user goes to Today when `VITE_BOARDS_ENABLED=1`.
On a phone the tab bar is at the bottom; on a desktop it is a left rail with the same five items.

### 4.1 Today, top to bottom

1. **Date and greeting:** "Thursday 5 Nov". A small avatar at the right opens the menu.
2. **For you today:** one line, 20 px (example: "A good day to finish what you started. Keep big decisions for the
   afternoon."). Phase 0 shows the headline of the board with the most urgent tone until the daily layer exists.
3. **Three board cards:** You, Love, Work. Each: tone word with icon, one sentence, the next date ("eases from 1 Feb"),
   a chevron. Tapping opens the board's Overview.
4. **Good for / Better to wait:** two lists of at most three items, from the day rows (Phase 3).
5. **What changed:** shown only when a tone changed since the last visit ("Work moved from Demanding to Easing"), once.
6. **Ask bar:** "Ask anything about your life". Opens the chat.

## 5. The 12-house framework: the map under every board

### 5.1 Houses as life areas people recognise

| House | The person's area | What they worry about | Charts that sharpen it | Board |
|---|---|---|---|---|
| 1 | **Self** | Who am I, why am I stuck, confidence, identity, my energy | D1, D9, D60 (exact birth time only), D20 | **You** |
| 2 | Money in hand, family, speech | Savings, family money, how I speak | D2 | later |
| 3 | Skills, effort, siblings | Courage, learning a skill, brothers and sisters | D3 | later |
| 4 | Home, peace, mother, property | Where to live, a home purchase, inner peace | D4, D12, D16 | later |
| 5 | Creativity, romance, children, study | Falling in love, children, exams | D7, D24 | partly **Love** |
| 6 | Daily work, debts, health routines | Overwork, debts, rivals, routine health (facts only) | D6 (not served), D30 | partly **Work** |
| 7 | **Partnership** | Meeting someone, marriage, fights, staying together | D9 | **Love** |
| 8 | Change, shared money, the hidden | Sudden change, inheritance, intimacy, depth | D9, D30 | partly **Love** |
| 9 | Luck, mentors, belief, travel | When will luck turn, guidance, long journeys | D9, D12 | later |
| 10 | **Career** | Job, promotion, security, pay, direction | D10 (first), D1, D9, D24, D60 | **Work** |
| 11 | Gains, friends, goals | Income growth, networks, wishes coming true | D2, D10 | partly **Work** |
| 12 | Rest, loss, faraway places, inner life | Sleep, going abroad, letting go, spiritual path | D12, D20 | partly **You** |

The three boards are the primary readings of houses 1, 7 and 10, each supported by the houses it travels with. The other
nine become boards the same way (§15 Phase 4).

### 5.2 The nakshatra layer (27 stars, 108 quarters)

Sachin asked for "32 or 36 nakshatras" inside each house. The classical count is **27 nakshatras (28 with Abhijit)**,
each with four quarters (padas), 108 in all; 36 is the number of annual sahams, which is a separate layer already
stored. The star layer enters every board in three places:

| Use | Source field | What it adds in plain words |
|---|---|---|
| **The area's style** | the nakshatra at the house's cusp (`houses.N.cusp_nak`) and of the house lord | *How* this area shows up for the person: e.g. for love, "slow to trust, loyal once committed"; for work, "needs a mission, not just a role". One short sentence, from a reviewed table of 27 styles per area |
| **Who delivers** | the star lord chain (`bodies.P.star_lord`) of the planets running now | Which planet's theme is the one that actually brings the event; used in "Why we think so" |
| **Today's feel** | the Moon's star today against the person's birth star (`taras_from_janma`): the tara | A good, neutral or hard day for *this* person; feeds Today's "Good for / Better to wait" (Phase 3) |

The 27 style sentences per area are config (`nakshatraStyles.<area>.ts`), written once by an agent and reviewed by an
astrologer before they ship (Sachin's review step, §17). They are never shown with the star's name on a first screen.

### 5.3 How a house becomes a board: the config

Every board is one file, `src/reading/area/boards/<board>.ts`, with: the primary and supporting houses; karakas; Jaimini
points; the divisional charts in order of priority; the worries (§8) each with its houses, charts and gates; the polarity
rules that decide the tone (§7); the trouble signatures; the ledger categories; and the nakshatra style table. The window
engine, tone engine, agents and screens are shared. Adding a board is a config file plus its copy.

## 6. The page template: every board is at most four pages

A single screen cannot hold a life area, so each board splits into the same four pages, reached from a segmented control
under the title: **Now · Looking back · Ahead · Worries**.

| Page | Shows | Does not show |
|---|---|---|
| **Now** (Overview) | Tone word and headline; one sentence; the date it changes; *Good for / Better to wait* (this week); the one action; the main worry if one is pressing; a quiet "Why we think so" link | The timeline, horizons, other worries |
| **Looking back** | The last 6 months, this year so far, last year: one digest sentence each with the tone it had, and three moments to confirm (§9) | Predictions |
| **Ahead** | The ladder: **1 month**, **3 months**, **6–9 months**, **1–2 years**. Each rung: one sentence, the best window, the hardest stretch, a confidence word. Beyond a rung's confidence limit nothing is shown (§10) | Days beyond a month |
| **Worries** | The list of worries for this board, each with a one-line answer chip ("Looks steady", "Opens 12 Mar", "Eases 1 Feb", "Not shown in your chart"). Tapping opens the **worry page** | |

**A worry page:** the question as the title; the verdict in one sentence (promised and open, promised but waiting,
not promised); the window in dates; "What helps" (up to three steps); "Better to wait on" (up to two); a ledger row
("Did this happen? Yes / Partly / Not yet / Wrong date"); "Why we think so" as a sheet.

**Layout by tone** (all boards): see §7. The same four pages exist in every layout; only the order and density of
Now changes.

## 7. The present tone, for every board

The question "where is this person right now in this area?" is answered the same way for every board, by the
seven-family vote of doc 43 §8.1, with the area's houses and charts from its config in place of the career ones. The
rules, thresholds, confidence levels (confirmed, likely, split), steadiness (7 days), ties and the person's own word are
unchanged. Only the names change:

| Tone (shown) | Internal key | Was (doc 43/44) | Layout | What the person sees first | Fields |
|---|---|---|---|---|---|
| **Demanding** | `demanding` | Storm | **Support** | This week's two short lists, when it eases, what to protect, one calm action | `ease_date`, `severity` |
| **Easing** | `easing` | Clearing | **Support, stepping down** | A now-to-next bar with the date, the "before it opens" list | `boundary_date`, first window after |
| **Steady** | `steady` | Calm | **Overview** | The next opening, small wins in 90 days, a short note on what is stable | `next_window_start` |
| **Closing** | `closing` | Late summer | **Opportunity** | "Finish what you started before {date}", act days left | `window_end` |
| **Open** | `open` | Fair | **Opportunity** | The window, what to ask for, act days, the next slower stretch | `window_end`, peak |

Care levels in doc 43 §8.2 become internal keys `role_risk`, `named_trouble`, `slowing`, `none`; they decide which
Support layout items appear and are never shown as labels. The old board names (ER, urgent care, lobby, resort) exist
nowhere in the product.

**Layout principles** (the hospital-versus-hotel idea, as pace, not words):
- **Support:** low density, 18 px body, one item per card, neutral cool palette with the board accent, no motion. The
  first screen answers *what do I do this week, and when does it ease*. Everything long-range sits under "What comes
  after". A calm line: "If this is weighing on you, talking to someone helps", linked to the support page.
- **Overview:** medium density, the long view opens by default. The one state where horizons lead.
- **Opportunity:** a warmer palette (still the board accent), a larger headline, the window as the hero card, "what to
  ask for", act days, and always "the slower stretch from {date}" so it never over-promises.

**Copy, per tone, per board** (placeholder dates; real ones come from stored rows):

| | Work | Love | You |
|---|---|---|---|
| Demanding | "A demanding stretch at work. It eases from 10 Dec." | "A strained stretch in love. It eases from 3 Mar." | "A heavy stretch for you. It lightens from 18 Jan." |
| Easing | "The pressure is lifting. From 10 Dec, a better time to move." | "Things are softening. From 3 Mar, a better time to talk." | "You're coming out of it. From 18 Jan, a better time to start." |
| Steady | "A steady period at work. Build until 24 Sep." | "A settled stretch in love. A new opening on 24 Sep." | "A steady stretch. Good for habits and rest until 24 Sep." |
| Closing | "Finish what you started before 12 Oct." | "A good window for a decision closes 12 Oct." | "A strong stretch for change closes 12 Oct." |
| Open | "A strong stretch for your promotion. Ask before 7 May." | "A warm opening for love. Say yes to introductions before 7 May." | "A clear stretch for a fresh start. Begin before 7 May." |

**The person's own word** (doc 44 §3, kept): "How is {work / love / your month} for you right now?" with *Tough / Okay /
Going well / Skip*. The answer picks the layout; the chart fills the content; a grade is never hidden; the answer is
sealed and deletable. A *split* verdict opens the Overview with this question first.

## 8. The three boards

### 8.1 Work (the 3rd tab): house 10, D10

Doc 42 (module), 43 (technique) and 44 (board, now renamed per §18) stand. Summary of what changes in them:
- The 17 ranked sub-areas (doc 43 §2) become the **Worries** page of Work. Tier 1 first: getting a job, job change,
  promotion, job security, work abroad, career direction. Each row's chip uses the worry's verdict.
- **Job security** is a row, never a headline. Its words: "No sign of a job ending", "Keep an eye on things", "Time to
  prepare" (doc 43 §7). The method states what its layers say; it never promises.
- **Work level** (doc 43 §8.3) is asked once in *You → About you* ("What best describes your work now?") and re-labels
  the worries ("a bigger client" for an owner).
- The trouble signatures of doc 43 §8.2 (boss, politics, projects, credit, pay cut, burnout) feed the **Demanding**
  layout's "Needs care" and "What helps"; they are never labelled with their care-level names.

### 8.2 Love (the 2nd tab): house 7, D9

**What it reads** (all stored today unless marked): the 7th house, its lord and occupants; Venus and Jupiter (the
significators of love); the 5th (romance), 2nd (family life), 8th (depth, strain), 11th (fulfilment), 12th (intimacy,
separation) and 4th (peace at home); Jaimini's partner point (`karakas.chara.DK`), the partner-image points UL and A7
(`arudhas`); **D9** first, then D1 and D7; the Venus and Mars dignities, the relationship-related doshas, and the sahams
for marriage and passion (`vivaha`, `paradara`, `preethi`); the dasha clocks of doc 43 §3.2 with the marriage-specific
conditional dashas; the Tithi Pravesha year chart and its marriage saham; slow transits over the 7th, its lord, Venus
and the Moon. **Not available yet:** two-chart compatibility (§1 gap 2).

**Worries (provisional ranking, to be replaced by our own counts once questions carry bucket labels; the order follows
what astrology apps list as the most common questions and needs the same TODO as career's):**

| Tier | Worry (what the person types) | Verdict form |
|---|---|---|
| 1 | When will I meet someone / find love? | Window, or *not shown in your chart* |
| 1 | Will I marry, and when? Why is it delayed? | Promised/waiting/blocked + release date |
| 1 | Will we stay together? (a named partner) | Strain windows, easing date; no "yes/no" |
| 1 | Why do we keep fighting? (patterns) | The recurring pattern in plain words, when it softens |
| 2 | Is this the right person? | Phase 3: needs two charts; until then, "what you tend to need" |
| 2 | Can we get back together? | A window where reconciliation signals agree, or none |
| 2 | Will my family accept this? | Pressure windows and the one that eases |
| 2 | Will we move in together / get engaged? | Commitment windows |
| 3 | Long distance or a partner from abroad | Travel-linked windows |
| 3 | A second chance at marriage | The same promise read from the second-marriage points |
| 3 | Trust and intimacy worries | Pattern card; no sexual detail |
| 3 | Children | Opens the later *Family* board |

**Love-specific rules.** Strain is named as **distance, tension, pressure from outside, or a pause**; the product never
says "divorce" or "your partner is cheating" as a verdict; separation signals appear as *strain windows* with what helps
("Say what you need before the 20th", "Avoid deciding anything big in the last week of March"). A safety line appears on
every Love tone if the person's words (chat or self-report) suggest harm or abuse: the fixed reply of doc 24, a support
page link, no astrology. Love data (names, events, answers) is sealed like the ledger. Same-sex and non-marriage
relationships are first-class: the board reads the person's partner point, not a gendered template.

**Dates:** the engine's windows for the `love_marriage` marker (stored today) become the worries' windows; the new
ledger categories (§14 step 3) let the person confirm meets, commitments, reconciliations and distance.

### 8.3 You (the 1st tab): house 1, with the Moon, 4th and 5th

You is the personal area, the one in the profile that is browsed, not asked (Sachin, 2026-11-05). It is the first tab
and the home of the things that belong to the person rather than to a question.

| Page | What it shows | From |
|---|---|---|
| **Overview** | **The companion** ([doc 48](48-companion-memory-on-the-you-board.md)): one line from it, one question or one observation, the person's one-tap answer; it remembers what it learns and every board and the chat read the same memory. Under it, the tone for you now and one practice for the week | Companion facts (doc 48 §4.3), Self tone (§7) |
| **Who you are** | Three or four short paragraphs: how you move through the world, what you're good at, what trips you up, how you recharge. No planet names. Each paragraph has a "Why" sheet | Lagna, its lord, the Moon and the Moon's star, the 4th and 5th, strong yogas, D9 for inner nature, the Atmakaraka (`karakas.chara.AK`), the star style table (§5.2) |
| **Chapters** | Your life as chapters (e.g. "2022–2038: Building" and the sub-chapter you are in), each with a plain name, what it asks of you and what it gives. A bar from birth to 100 with "you are here" | The main dasha clock's sub-periods, named by theme (doc 43 §3.2 mapping to plain chapter names) |
| **Your year** | The theme of the year from the last birthday to the next: three lines and the months that matter | Tithi Pravesha chart, its dasha, Mudda and sahams |
| **Practices** | Routines, mantras, colours and gem advice that suit the current chapter, with a "start this week" button; the existing Remedies and Mantras content, regrouped and fixed | existing `remedies/`, `mantras/` plus the chapter and tone |
| **Looking back** | The last 6 months, this year, last year for the person themselves, with moments to confirm (§9) | blind-cast over the `self` marker |
| **About you** | Name, birth details, work level, relationship status (optional), language; the existing Details tab | existing `ProfileSection` |
| **Your chart** | A plain profile; with Chart details on: the old biodata cards and the D1/D9 wheels | existing `charts/` |

**Worries on You:** Who am I and what is my purpose; why do I feel stuck; confidence and self-worth; what chapter am I
in; when will my luck turn; the spiritual path; habits and routines; decisions I keep postponing. Mood is a *day*
signal, not a diagnosis: Today shows "a lighter day / a heavier day", never a mental-health statement, and health is
facts only (doc 18). The self-harm cue gets doc 24's fixed reply.

## 9. Looking back: how rapport is built

Sachin: *"the more we get things right, the more the person depends on us for the next month, three months, six to nine
months and one to two years."* Looking back is the first-run step that earns that.

**What it does.** For each board the engine runs the same tone rules over the person's past (the past 24 months of
stored clocks and the past sky) and states, in plain words, how each stretch was: "Mar–May 2026 was a demanding stretch at
work." It then asks, one at a time, whether it matches.

**Choosing the moments** (code, not an agent): from the last 24 months pick up to three per board with
1. the **sharpest edges**, a tone change at a period boundary, with 5 or more of 7 families agreeing (confirmed);
2. a **mix of directions**: never only hard stretches, never only good ones, so it is not flattery or doom;
3. spread over *last 6 months*, *this year*, *last year*.

**The question.** One card, one moment: "Spring 2026 looks like a demanding stretch at work. Did that feel right?"
*Yes / Partly / Not really / Skip*. After *Partly* or *Not really*, an optional "What was it like?" with three chips
(different timing / different area / it was fine). The answer is stored in `area_checks` and, when it names an event,
offered as a ledger entry ("Did you change jobs then?").

**What the person sees.** After three answers: "You confirmed 2 of 3." The count is the person's own, never a
claimed accuracy. Our accuracy is measured across everyone and reported by confidence level to staff only, as in
doc 43 §8.1; a public accuracy claim waits until the sample is large enough (§17).

**Rules.** Never show a past moment the chart cannot support (no edges, fewer than 4 families) — better to show two good
moments than three weak ones. With an approximate birth time, ask only about period-based moments (months, not days),
skip chart-dependent ones, and say so. The questions are asked on first open of each board and again after 30 days.
Looking back is free: it is the hook.

## 10. The time ladder: how far ahead, with what detail

| Rung | Detail shown | Why that much | Rule to show it |
|---|---|---|---|
| **1 month** | Week by week; act and hold days (Phase 3, once the daily layer exists; before that, the weeks) | Fast clocks and the sky agree within days | 4 or more families agree; confirmed or likely |
| **3 months** | Week-level windows; the best and hardest stretch | Mid clocks; transit dates are accurate to the week | The same |
| **6–9 months** | Month-level windows; the main opening or pressure | Period boundaries are exact; transit overlaps are approximate | 4 of 7 or more; the main clock validated by D1 and the area chart |
| **1–2 years** | Season-level only: "Spring 2027 is the strongest stretch for a change" | Only the slow clocks speak this far | 5 of 7 or more and at least one major window; otherwise the rung says "Nothing large is moving" |

Nothing beyond 2 years is shown on the boards. Confidence words follow the rung (*confirmed*, *likely*), and a rung that
does not meet its rule is hidden, not softened. Every date has a source row.

## 11. How it works when done

### 11.1 Backend (flows end to end)

1. **Build** `POST /api/area/:area/build` (`area` ∈ `self|love|career`). Stages: **data** (check stored layers; request
   the daily sky and overlay from the deploy session only when missing; 60 s), **windows** (clocks, windows, horizons,
   weeks for the next 24 months and the last 24 months; 20 s, no LLM), **tone** (`weather.ts` renamed `tone.ts`, §18;
   runs on stored rows, daily; 2 s), **checks** (choose the Looking-back moments; 2 s), **readers** (Phase 2: seven
   readers in parallel, 90 s timeout each, one retry), **oracle** (Phase 2: words the cards and validates every date
   against `area_windows`, 60 s). The whole Phase 1 build is under 90 s; Phase 2 under 4 min. Concurrency: one build
   per person per area; a second request returns the running build (409 with its id).
2. **Daily refresh** (EventBridge at 03:00 UTC): recompute tone, today lines and weeks from stored rows for people who
   opened the app in the last 14 days; no engine calls beyond the shared sky job; failures are logged and the last good
   tone is kept.
3. **Self-report and check answers:** written sealed to `area_self_reports` and `area_checks`; deletable.
4. **Failure handling:** a failed stage keeps the last good build; the app shows it with "Updated {date}"; nothing is
   charged. A null date field means the dateless headline pattern (doc 44 §6).

### 11.2 API (extends doc 42 §B.5; the `/api/area/:area` shape is kept)

| Endpoint | Request | Response | Errors |
|---|---|---|---|
| `GET /api/area/today` | | `{ date, line, boards: [{ area, tone, headline, next_date }], good_for[], wait_on[], changed? }` | 404 flag off; 202 when no build yet |
| `GET /api/area/:area` | `?page=now|back|ahead|worries` | `{ tone, layout, confidence, headline, sentence, next_date, action, good_for[], wait_on[], ladder[], worries[], back{ ranges[], moments[] }, details? }` (`details` only with Chart details on) | 404, 202 building, 409 |
| `GET /api/area/:area/worries/:id` | | `{ question, verdict, window, helps[], wait_on[], why[], ledger_prompt }` | 404 |
| `POST /api/area/:area/build` | `{ span? }` | `202 { build_id }` | 409 running, 429 daily cap |
| `GET /api/area/builds/:id` | | `{ stage, progress, error? }` | |
| `POST /api/area/:area/self-report` | `{ answer, hardest? }` | 204; `DELETE` to remove | 400 |
| `POST /api/area/:area/checks/:id` | `{ answer: yes|partly|no|skip, note? }` | `{ confirmed, asked }` | 404 |
| `POST /api/area/windows/:id/feedback` | `{ outcome }` | 204 (ledger) | |
| `PUT /api/profile/work-level` | `{ level }` | 204 | 400 |

### 11.3 Frontend and UI states

| Screen state | What the person sees | Timing |
|---|---|---|
| First open of a board, never built | "Getting to know your chart…" with the Looking-back questions available as soon as the windows stage ends (the build does not block the first question) | Windows ready in ~30–60 s; skeleton rows meanwhile |
| Building | One line of progress ("Reading your last two years"); no percentages | Poll every 3 s, stop at 5 min |
| Ready | The Now page in the tone's layout | Instant from cache |
| Partial (a layer is missing) | The page plus "Some detail will appear once your daily chart is ready" | |
| Failed | "We could not update your board. Showing {date}. Try again." | Retry repeats the build |
| Tone changed | A one-time card at the top: "Work moved from Demanding to Easing on 3 Mar" | Once |

### 11.4 Components

`AppTabBar`, `TodayScreen`, `BoardScreen` (segmented pages), `ToneHeader`, `WorryRow`, `WorryPage`, `LadderRung`,
`LookingBackCard`, `WhySheet`, `GoodForPair`, `SupportLayout`, `OverviewLayout`, `OpportunityLayout`, shared tokens
(`src/styles/tokens.css`), light and dark themes, i18n strings in the catalogue (the first board strings to leave
hard-coded English). Files in `AIAstra_WEB/src/boards/`.

## 12. Architecture

```
Web (Today · You · Love · Work · Ask) ──GET/POST──> API (Express on Lambda) ──async──> area build worker
                                                                              │
   stage data:    kundli_data + dossier ◄── background pull (doc 31) ◄── engine
                  shared sky + overlay ◄── doc 35 jobs (deploy session) ◄──── engine
   stage windows: clocks.ts → windows.ts → horizons.ts → tone.ts   (Node, no astrology, no LLM)
   stage checks:  checks.ts picks Looking-back moments
   stage readers: 7 readers in parallel (Gemini, Phase 2)   stage oracle: words + date validator
                  └──> Postgres: area_builds, area_windows, area_weeks, area_checks, area_self_reports (text sealed)
Answers + ledger ──> calibration (doc 29 §5) ──> next build's weights
Chat question ──> Clarify chip (love | work | self) ──> board worry ──> answer cites the board
```

Boundaries: the engine supplies every astrological value; the window engine only selects and intersects; readers
cannot change dates; the Oracle's output is validated against `area_windows` before it is stored. Node computes
nothing astrological.

## 13. Ingredients

| Need | Who |
|---|---|
| Daily sky and per-person overlay for the span | deploy session (engine credentials) |
| Migrations (`area_*`, `area_checks`, `area_self_reports`) applied on the test database | agent, under the standing OK; production: Sachin |
| Gemini key, model, call count and cost for Phase 2 | Sachin (no call before his yes) |
| Astrologer review of: Love's worry map, the 27 star styles per area, the chapter names, the Phase 1 outputs on three kundlis | Sachin |
| Tokens, tab bar and light theme in the web app | agent |
| `VITE_BOARDS_ENABLED`, `AREA_ENABLED` on staging | deploy session |
| Golden data: the Sumit career charter; Sachin's retrospective (doc 37); a second kundli for Love | stored / Sachin |
| Libraries | none new |

## 14. Action steps in sequence

1. **File the findings** in `docs/TODOS.md`: no `self` marker; no synastry; no daily panchang fetch; past-reading
   ratings not persisting (verify first); annual D10 not pulled; the Mantras/Remedies dynamic-class bug; no design tokens.
   (Done in this commit.)
2. **Tokens and shell (web):** `tokens.css` (dark and light), `AppTabBar`, the Today route behind `VITE_BOARDS_ENABLED`,
   the avatar menu regrouped, Charts/Remedies/Mantras re-homed under You. Fix the dynamic colour classes. Parallel with 3.
3. **Engine config:** `boards/career.ts` (from doc 42), `boards/love.ts`, `boards/self.ts`; `self` marker and the new
   ledger categories (`relationship.meet/commit/reconcile/family_accept/distance`, `self.turning_point/new_chapter/
   recovery`, and the career ones of doc 42); unit tests that every field path exists in two kundlis. Parallel with 2.
4. **Tone engine** `tone.ts` (generalised from doc 43 §8) and the **banned-word test** over all visible strings.
   Depends on 3.
5. **Windows and horizons** for the three boards; golden test against the Sumit career windows. Depends on 3.
6. **Checks:** `checks.ts` (choose moments), the `area_checks` migration, `LookingBackCard`. Depends on 4 and 5.
7. **Boards (web):** `BoardScreen` with the four pages, `WorryRow/Page`, `LadderRung`, `WhySheet`, layouts, template
   text for all tones; component tests; Today. Starts on mock data in parallel with 4–6.
8. **Pull the daily sky and overlay** for the golden kundli (deploy session). Parallel from the start.
9. **Phase 1 check on staging** behind the flags; screenshots into `docs/screenshots/boards/`.
10. **Phase 2 (after Sachin's yes):** readers and Oracle per board, Clarify chips, the star styles, eval on three
    kundlis; the date validator.
11. **Phase 3:** the daily layer (Today's line, Good for / Better to wait), notifications, feedback to calibration.
12. **Phase 4:** the other nine boards as configs; partner comparison (needs the engine's two-chart output); DOCX export.

## 15. Development phases

| Phase | Steps | Ships | Check that closes it | Deferred |
|---|---|---|---|---|
| 0 Shell and foundation | 1, 2, 3, 4, 8 | Tokens, tab bar, Today with the tone lines, the three configs, the tone engine and the banned-word test, behind a flag. Work only fully filled | Banned-word test green; screenshots of Today and each tone on 360 px, light and dark | The other boards' content |
| 1 Work, Love, You deterministic | 5, 6, 7, 9 | The three boards with template text, the ladder, Looking back, no model cost | Golden test reproduces the Sumit promotion and Jupiter windows; Looking back runs on three kundlis; screenshots per state | Agent text, daily layer |
| 2 Agents | 10 | Readers, Oracle, Clarify chips, star styles | No date outside `area_windows`; eval on three kundlis; astrologer sign-off | Daily layer |
| 3 Daily and calibration | 11 | Today's line, Good for / Better to wait, notifications, per-person weights | Ten answers change a build as expected | Partner comparison |
| 4 More boards | 12 | Money, Home, Family, Learning, Luck, Travel, Gains, Rest, Health facts | One golden per board | |

## 16. Recommendation

Build **one board engine and one shell**; add boards as configs. Ship Phase 0 and Phase 1 with no model cost so the dates
can be checked against the hand-made Sumit charter before any text is generated. Lead with Work because its method is
documented; Love next because the most-asked worries are there; You last because it is mostly regrouping what exists plus
the chapter and style tables. Keep our brand, borrow Co-Star's structure, and hold the Apple standard of digested
screens from the first commit.

| Option | Verdict |
|---|---|
| **One board engine, three configs, shell first (chosen)** | Reuses doc 42–43; each new board is cheap; one design system |
| Three separate dashboards built one after another | Rejected: triples the engine and drifts the design |
| One long "life dashboard" on a single screen | Rejected: too heavy; Sachin asked for separate pages |
| Planet-first pages like Co-Star | Rejected: Sachin's rule, and the audience does not know planets |
| Weather and hospital words as labels | Rejected: Sachin's rule; they stay as design intent only |
| Chat stays the home | Rejected: nothing to return to daily |
| A public "99 % accurate" claim | Rejected: unprovable; show the person's own confirmed count |

## 17. Open points for Sachin

1. Approve the **tone words** (Demanding, Easing, Steady, Open, Closing) or give your own five.
2. Approve **tab order and names**: Today · You · Love · Work · Ask.
3. Approve **free versus paid** (§2) or change it; this is pricing and yours.
4. Phase 2 spend: the Gemini key and model, and call counts (8 per build per board), before any call.
5. Astrologer review: Love's worry map and the 27 star styles per area.
6. Whether "Looking back" may use the person's chat history to pre-fill moments (privacy B1 keys apply).
7. When a public accuracy figure may be claimed, and how large the sample must be first.

## 18. What changes in docs 42–44

| In | Old | New |
|---|---|---|
| doc 44 | The whole board design (ER, urgent care, lobby, resort, weather words) | Superseded for the UI by §3, §6, §7 here; kept for its risks table and the self-report rules |
| doc 43 §8 | States storm, clearing, calm, late summer, fair; care levels ER/urgent/doctor/check-up | Keys `demanding, easing, steady, closing, open`; care keys `role_risk, named_trouble, slowing, none`; rules unchanged |
| doc 43 §8.1 | Career houses in the polarity table | Per board from its config |
| doc 42 B.5/B.7 | `GET /api/area/career`, "Career map" tab, `weather.ts` | `GET /api/area/:area`, the Work board, `tone.ts`; `weather.ts` renamed |
| mockup | Storm/ER buttons and words | Replaced by `45-boards-mockup.html` |

## Sources

- Co-Star day at a glance, Power/Pressure/Trouble: https://costarastrology.zendesk.com/hc/en-us/articles/13692086020749-What-s-the-meaning-of-power-pressure-trouble
- The Pattern timing and Time Travel: https://www.bustle.com/life/pattern-app-review-features-price , https://blog.whisper.day/reviews/the-pattern-review-2026/
- align27 day colours, Moon tracker, 180-day planner: https://apps.apple.com/gb/app/align27-vedic-astrology-guide/id1364184571 , https://align27.com/
- Oura readiness: https://ouraring.com/readiness-score ; WHOOP: https://developer.whoop.com/docs/whoop-101
- Credit Karma redesign (what changed first): https://www.creditkarma.com/about/commentary/credit-karmas-new-app-redesign-available-now-on-android-and-ios
- Apple Weather layout: https://www.techrepublic.com/article/how-to-use-apple-weather/
- Astrotalk FY25: https://www.outlookbusiness.com/start-up/news/astrotalk-reports-85-revenue-growth-in-fy25-as-tier-i-cities-boost-platform-activity
- Past-prediction logs: https://astrokanu.com/verified-predictions , https://asksoma.ai/compare/best/most-accurate-ai-astrology-app
- Pricing norms: https://unstar.app/blog/co-star-sanctuary-pattern-nebula-stellium-astrology-apps-ranked-2026
