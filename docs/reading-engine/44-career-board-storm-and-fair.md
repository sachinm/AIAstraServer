# 44 — The career board: the storm entrance and the fair-weather entrance

Status: design, 2026-11-05. The UI/UX of the Career map in [doc 42](42-life-area-reading-career.md) §B.7. The chart rules
that decide the state are [doc 43](43-career-reading-technique.md) §8. Written by a design agent from Sachin's brief and
adopted here. Mockup: [42-career-dashboard-mockup.html](42-career-dashboard-mockup.html) (it has a state switcher).

## 0. Answer first

1. **The present comes first.** Promises one or two years out do not help someone in a hard stretch at work today. The
   board decides where the person is now, and that decides everything on the first screen.
2. **Two entrances, as Sachin put it: a hospital ER and a six-star resort.** A person in a storm (a hurricane, a flood,
   twelve feet of snow) gets the ER: triage, this week, when it eases, what to protect, one calm action. A person in fair
   weather gets the resort: the opportunity named, the date it closes, what to ask for, the act days. A neutral lobby
   serves the calm stretches in between.
3. **Five states:** Storm and Clearing (ER), Calm (lobby), Late summer and Fair (resort). Rules in doc 43 §8.
4. **The weather lives in the structure, not in the words, when it hurts.** The ER boards use no weather words at all.
   A real ER never puts up a sign saying "you are in an emergency"; it works faster and quieter. Seasonal words are
   allowed only on the resort and lobby boards.
5. **The person's one tap sets the entrance; the chart sets the content.** A grade is never hidden.
6. **A storm has care levels** (doc 43 §8.2): the ER when the job itself is at risk; urgent care for a named problem
   such as politics or a boss at odds; a doctor's-visit card for a nagging problem; a check-up when nothing is wrong.
7. **The words follow the person's work level** (doc 43 §8.3): employee, manager, executive, specialist, hourly worker,
   solo owner, owner with staff, several businesses.

## 1. The two entrances

**ER (Storm, Clearing).** Triage order, one thing per card, nothing to scroll past before the essentials.
1. **Headline**: plain words, the situation, and a date when there is one.
2. **This week**: two lists side by side, *Needs care* (hold days, the one pressured sub-area) and *Safe to do* (act days
   for small moves), from day rows.
3. **When it eases**: one date (`ease_date`) and "5 of 9 clocks agree". With no date in the span: "We'll show a date as
   soon as one appears". No date is ever invented.
4. **Protect**: at most three items, only from the bad-period concerns that fire (doc 43 §5), each written as a step:
   "Keep a copy of your appraisals", "Build three months of savings", "Keep your references current".
5. **One calm action**: one button that opens the drawer on "what to do this week".
6. **Support**: a quiet line, "If work stress is affecting your sleep or health, talking to someone helps", linked to the
   support page.
7. **"What comes after"**: one link at the bottom holding the horizons, the timeline and the fair windows that follow.

**Resort (Fair, Late summer).** Welcome, then the opportunity, then the means to act.
1. **Headline**: the opportunity and the date the window closes.
2. **The window**: sub-area, dates, peak, score, clocks that agree.
3. **What to ask for**: two or three asks from the window's sub-area (a raise, a stretch role, an introduction).
4. **Act days this month**: a 7-day strip.
5. **More open doors**: the other active support windows.
6. **Next season**: one line, "A slower stretch from {date}; big moves before then". Never hidden.
7. Horizons, timeline and week view below.

**Urgent care (Storm without the job at risk).** Most hard stretches are not about losing the job: politics, a boss at
odds, credit taken, a project that keeps slipping, a pay cut (doc 43 §8.2). The ER's calm structure stays, but the
board names the problem instead of the job's safety:
1. **Headline**: the problem in plain words and when it eases: "Friction with your manager. It eases from {ease_date}".
2. **Your job is not the issue**: one line, the security grade in words ("No sign of a job ending").
3. **What helps**: three steps from the trouble's signature (for politics: "Keep decisions in writing", "Let results
   speak in the review", "Find one ally above the conflict").
4. **What not to do**: one line ("Don't resign in the middle of it").
5. **This week**: the act and hold days.
6. **Also in this stretch**: lower-level troubles that fire too.
7. "What comes after" holds the rest, as on the ER.

A doctor's-visit problem (it fires from periods only, or from fast transits only) does not change the entrance: it shows
as a "What's slowing you" card at the top of the lobby or resort.

**Work level.** The board's words follow the person's level (doc 43 §8.3): "promotion" for an employee becomes "a bigger
client or a second business" for an owner, and "your manager" becomes "your partners or key clients". The level is asked
once in the profile; the chart's estimate is used only when the person skips.

**Lobby (Calm).** The next opening, small wins in the next 90 days, a short security line, and the horizons open. This is
the one state where the long view helps.

## 2. Each state at 360 px wide

| | Storm | Clearing | Calm | Late summer | Fair |
|---|---|---|---|---|---|
| **Headline** | "A demanding stretch at work. It eases from {ease_date}"; without a date, "A demanding stretch at work: what helps this week" | "The pressure is lifting. From {boundary_date}, a better time to move" | "A steady period at work. Build until {next_window_start}" | "Finish what you started before {window_end}" | "A strong season for your {sub_area}. Ask before {window_end}" |
| **Colour** | Cool neutral greys, high-contrast ink, one calm teal accent; no red or amber fills; grades in text with an icon | The storm palette with a pale warm band at the top that widens as the date nears | Warm off-white | Gold accents on warm white | Warm white, green and gold, a soft tinted hero |
| **Density** | Low: one item per card, 18 px body, generous spacing | Low | Medium | Medium | Medium, hero with open space |
| **Motion** | None | One fade on the date card | Standard | Light | A light reveal on the hero; all motion off under reduced motion |
| **Type** | Headline 600 at 22 px; nothing heavier | As Storm | Normal | Headline 650 | Headline 700 at 26 px |
| **First screen** | Headline, This week, When it eases | Headline, a now-to-next bar with the date, the "Before {date}" list | Headline, Next opening, Small wins | Headline, a closing-window bar, the Finish list | Headline, the window card, What to ask for |
| **Demoted** | Everything long-range sits behind "What comes after"; the test's peak date never appears on the first screen | Horizons collapsed; timeline opens at 6 months | Nothing | Horizons collapsed | Tests only in the timeline; horizons collapsed except 3 months |
| **Security strip** | In full, fourth: the grade in words, what it means and does not mean, "In your past this held {n} of {m}", the next change date | Two parts: now, then {date} | Short line | Two parts | Short: "No sign of a job ending through {date}" with how often that held |

**Grade words shown to the person:** clear and protected → "Steady ground, with support"; clear → "No sign of a job
ending"; watch → "Keep an eye on things"; risk → "Time to prepare"; high risk → "Prepare now".

**Copy examples** (placeholder dates; real ones come from rows):
- **Storm.** *A demanding stretch at work. It eases from 14 Feb 2027.* "Here's what needs care this week, and what's safe
  to do." Card: "**When it eases: 14 Feb 2027.** Five of nine clocks agree the pressure on your role lifts after this
  date. Until then, keep records and keep big decisions for act days."
- **Clearing.** *The pressure is lifting. From 9 Jan 2027, a better time to move.* "Your first strong window for a change
  opens on 22 Jan (score 74, 6 of 9 clocks). Before then: update your CV and talk to two people."
- **Calm.** *A steady period at work. Build until 5 Sep 2027.* "Next opening: a job change on 5 Sep 2027, score 68.
  Small wins before then: 12 Jul and 2 Aug."
- **Late summer.** *Finish what you started before 30 Mar 2027.* "Your best remaining act days are 12, 18 and 25 Mar.
  After that, a slower stretch suited to steady work."
- **Fair.** *A strong season for your promotion. Ask before 20 Jun 2027.* "Your window is 3 Apr – 20 Jun, peaking around
  15 May. Score 81, 7 of 9 clocks. Ask for the conversation in April."

## 3. The self-report

"How is work for you right now?" with *Tough / Okay / Going well / Skip*. After *Tough*, an optional second tap: *No job
yet / Fear of losing it / Boss or politics / Pay / Feeling stuck*, which picks the sub-area the board leads with. Asked
on first open, then after 30 days or when the chart's state changes.

| Chart | Person says | Board | Rule |
|---|---|---|---|
| Fair or Calm | Tough | ER | Name the feeling; the chart's next opening becomes "when it eases" |
| Storm | Going well | Resort | The security strip stays at its true grade, worded "a good time to strengthen your position" |
| Storm | Okay | ER, softer copy | "A demanding stretch" stays; the support line is kept |
| Any | Skip | The chart's state | |

**Confidence on screen** (doc 43 §8.1). A *Confirmed* state is stated plainly. A *Likely* state adds "Most of your chart
points this way" under the headline. A *Split* state does not choose an entrance: the board opens on the lobby with the
self-report question first, and the answer picks the entrance. The drawer's "Why we think so" shows the seven families'
votes and, for each running period lord, its place in D1, D10, D9 and D60.

## 4. Moving between weathers

- The usual path: Storm → Clearing → Calm or Fair; Fair → Late summer → Calm or Storm.
- The state changes only at a window boundary or a new self-report, and holds at least 7 days. A worse security grade
  moves the board into Storm at once, opening with "Things have changed since your last visit. Here's this week."
- When a storm ends, the next visit opens with a one-time card, "The demanding stretch that began {start_date} has
  passed", with ledger buttons: *Held up / Changed jobs / Lost the job / Other*.
- If the person still says *Tough* after the chart has cleared, they keep the ER, with the chart's opening as the way out.
- The colour change is a slow cross-fade, announced through `aria-live="polite"`, and off under reduced motion.

## 5. Where the metaphor lives, and why

The ER boards contain no weather words: not "storm", not "weather the storm", not "silver lining"; the bottom link is
"What comes after", not "After the storm". There are no storm or lightning icons anywhere; the ER's cue is its stillness.
Reasons: someone being laid off hears "you're in a storm" as trivial or dramatic; "the storm will pass" reads as a
promise, while "It eases from {date}, 5 of 9 clocks agree" stays honest; and on a fair-weather board, seasonal words feel
like hospitality, so they belong there.

## 6. Risks and guards

| Risk | Guard |
|---|---|
| False reassurance on the resort board | "Next season" is always shown; the security strip always shows how often the grade held; "safe" and "guaranteed" are never used; an approximate birth time is stated |
| Anxiety in the ER | No countdown to the worst day; the headline carries the easing date; only concerns that fire are listed, each as a protection; no red; the one action opens on what to do |
| A flippant metaphor | No weather words on ER boards; copy is checked against a banned list (storm, hurricane, flood, disaster, guaranteed, absolutely) in a unit test over the i18n strings |
| A board that flips | Boundaries only, 7-day minimum |
| Invented dates | Headlines bind only to `ease_date`, `boundary_date`, `window_end`, `next_window_start`; a null field uses the dateless pattern |
| Self-report used against the person | Optional, sealed, deletable, never shown back as a fact; it changes order and tone, never a grade |
| Distress beyond work | The support line on the ER; self-harm cues get doc 24's fixed reply; the self-report never triggers a mood reading |
| Resigning in anger in a storm | Act days in the ER are labelled for small moves; job-change advice appears only inside a support window with a start gate |
| Accessibility | One column, 44 px tap targets, state in text and not only colour, the headline is the page heading, motion respects reduced motion |

## 7. What this adds to the build (doc 42)

- **Backend:** `present_state` (`storm|clearing|calm|late_summer|fair`), `confidence` (`confirmed|likely|split`),
  `votes` (the seven families with their D1/D10/D9/D60 checks), `care_level` (`er|urgent|doctor|checkup`), `troubles`
  (the signatures of doc 43 §8.2 that fire, each with its ease date), `work_level` (asked, or the chart's estimate with
  its evidence and ceiling), `ease_date`, `boundary_date`, `window_end`,
  `next_window_start`, `severity`, `way_out_window_id`, all computed in `src/reading/area/weather.ts` from the window and
  week rows (doc 43 §8), stored on `area_builds`, recomputed daily from stored rows without a rebuild.
- **API:** `GET /api/area/career` adds `present: { state, entrance, ease_date, boundary_date, window_end,
  next_window_start, severity, way_out }`; `POST /api/area/career/self-report` `{ answer: tough|okay|going_well|skip,
  hardest? }` → 204, sealed, deletable via `DELETE /api/area/career/self-report`; `PUT /api/profile/work-level`
  `{ level }` → 204 (sealed, deletable), read by every area build.
- **Web:** one board component per entrance (`ErBoard`, `UrgentBoard`, `LobbyBoard`, `ResortBoard`) sharing the cards;
  a work-level question in the profile; a banned-word test over the ER and urgent-care strings.

## 8. Verdict

| Option | Verdict |
|---|---|
| **Five weather states, ER and resort entrances, metaphor in structure only on the ER (chosen)** | The present comes first; neither board sounds flippant |
| One layout with a "hard time" toggle | Rejected: asks a struggling person to configure an app, and the default still opens on long promises |
| Weather words in every headline ("You're in a storm") | Rejected: trivialises suffering and reads as a promise |
| Three states (storm, calm, fair) | Rejected: no screen that says "it eases on {date}" or "finish while it is open", the two most useful lines |
| Chart only, no self-report | Rejected: a fair board shown to someone in a hard week reads as tone-deaf |
| A separate "severe storm" state | Rejected: severity changes density, not the entrance |
