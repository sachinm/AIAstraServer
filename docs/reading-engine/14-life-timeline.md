# 14 — Life Timeline: the past 18 years read back, the next 18 read forward

Added 2026-10-24. A private module in the user's profile. The engine reads the user's life as a dated sequence of events from dashas and transits: **the past 18 years** to let the user say how accurate it is, and **the next 5–18 years** as foretold windows. Day-level data underneath; week-to-month windows on top. It is not open to chat queries until its accuracy is proven; it is the muscle that makes the chat answers trustworthy.

Why 18: one full Rahu–Ketu cycle is 18.6 years, so an 18-year look-back contains every nodal return, one and a half Jupiter cycles and more than half a Saturn cycle; every major transit configuration appears at least once in the calibration window.

## 1. What the user gets

- **Profile → My Life Timeline**: a horizontal timeline from `birth+… / today−18y` to `today+18y`, "now" marker in the middle, lanes per life area (studies, home and moves, family, love and marriage, work, money, health and body, travel, spirit), Mahadasha and Antardasha bands along the top ruler, Saturn and Jupiter sign bands below. Zoom: years → months → days (days show the transit events that make a window).
- **Past half** (muted): predicted windows with event classes ("change of school or course, Jun 2010 – Mar 2011", "a move of home, 2014", "father's work changed, 2016–17", "new relationship, late 2019", "physical caution, Aug 2021"). The user marks each **Happened · Partly · No · Wrong date (fix)** and can **add** events the engine missed (category + date + note). This is the calibration set.
- **Future half** (indigo): the same classes as windows with a likelihood tier and, once calibrated, a probability band; tapping a window opens a short card (T9-style): what, when, why (collapsed), what would confirm it early.
- **Accuracy scorecard**: "Of the 23 major windows in your past 18 years, 16 matched, 4 partly, 3 did not; average timing error 2.1 months." Shown to the user only; aggregated anonymously for calibration.
- **Private by design**: visible only to the account owner; excluded from chat context (`READING_TIMELINE_IN_CHAT=0`); feedback is never shown to anyone else; export and delete with the account.

## 2. Event classes (what the timeline predicts)

| Class | Astrological signature (houses from Lagna unless stated; karakas; typical triggers) |
|---|---|
| Schooling change / course / exam phase | 4, 5, 9, 2; Mercury, Jupiter; Rahu on 4/5; Saturn on 5; dasha of 4/5/9 lords |
| Move of home / city change | 4, 12, 3; Moon, Saturn, Rahu; Saturn or Rahu on 4; 4th lord period; Ketu on 4 (leaving) |
| Foreign stay | 12, 9, 7; Rahu; Rahu/Jupiter on 12/9; 12th lord period |
| Father's work / status change | 9 and 10th from 9th (= 6th); Sun; Saturn/Rahu on 9; 9th lord periods |
| Mother's health / change | 4 and 8th from 4th (= 11th); Moon; Saturn/Ketu on 4; Moon afflicted in transit |
| Birth in the family | 5, 2, 11; Jupiter; Jupiter on 5/9/11; 5th lord period (siblings: 3 and 5th from 3rd = 7) |
| New love | 5, 7, 11; Venus; Venus/Jupiter on 5/7; Venus or 5th lord period |
| Marriage | 7, 2, 11, UL; Venus/Jupiter, DK; double transit on 7/UL; 7th lord/Venus/DK periods |
| Break-up / separation | 7, 6, 12, 2nd from UL; Saturn, Rahu, Ketu; Saturn/Rahu on 7; 6th/12th-from-7th periods |
| Divorce | as separation plus 6 and 8, A7 afflicted, Rahu–Ketu on 1/7 axis |
| Job start / change | 10, 6, 2; Saturn, Sun; Saturn on 10, Jupiter on 10/11; 10th/6th lord periods |
| Promotion / recognition | 10, 11; Sun, Jupiter; Jupiter on 10/11; Sun period; SAV of 10 high |
| Business start | 7, 10, 3, 11; Mercury, Mars; Rahu on 11; 7th/10th lord periods |
| Money gain / windfall | 11, 2, 5, 9; Jupiter, Rahu; Jupiter/Rahu on 11/2; dhana-yoga lord periods |
| Money loss / debt | 12, 6, 8; Saturn, Ketu; Saturn/Ketu on 2/11; 12th lord period |
| Property purchase | 4, 11, 2; Mars, Venus; double transit on 4; 4th lord period |
| Vehicle | 4, 11; Venus; Venus on 4 |
| Accident / physical risk | 8, 6, 1, 3; Mars, Rahu, Ketu, Saturn; Mars+Rahu/Ketu on 8/1/3; 8th lord period with malefic transit |
| Illness / surgery / recovery | 6, 8, 12, 1; Lagna lord, Sun, Moon; Saturn/Ketu on 1/6/8; 6th/8th lord periods; Jupiter on 1/6/11 for recovery |
| Loss or bereavement in the family | 8 and 2nd/7th from the relative's house (father 9 → 10/3; mother 4 → 5/10; spouse 7 → 8/1); Saturn, Ketu; eclipses on those points; maraka periods **flagged internally, see policy §6** |
| Spiritual turn / pilgrimage / teacher | 9, 12, 5; Ketu, Jupiter; Ketu on 9/12/1; Ketu or Jupiter periods |
| Honour / public visibility | 10, 1, AL; Sun, Jupiter; Jupiter on AL/10 |
| Litigation / conflict phase | 6, 7, 8; Mars, Saturn; Mars/Saturn on 6/7 |

The class table is code (`src/timeline/eventClasses.ts`), each row with weights per factor, so tuning is a weight change recorded in git, not a prompt edit.

## 3. Pipeline

Runs as a batch job per user (worker Lambda, async, minutes), versioned by `facts_version + rules_version + calibration_version`; recomputed on birth-data change, quarterly, or on request.

1. **Segment**: Vimshottari MD → AD → PD across the 36-year range (PD level inside ±3 years of today, AD elsewhere); Narayana dasa AD; store segments with lords, their houses owned/occupied, dignity, star-lord, and the segment's **class per life area** (deliverer/supporter/neutral/obstructor from file 02 step 2).
2. **Static promise per area** (L1 of file 11) from the dossier → a base rate per event class (a chart with a strong 7th and Venus has a higher marriage base rate; a chart with 4th lord in 12th a higher relocation base rate).
3. **Dasha activation**: for each segment × event class, score the activation from the lords' house links (ownership, occupation, aspect, exchange, star-lord houses) weighted by the class table → coarse windows (L2).
4. **Transit triggers**: from the global transit snapshot extended to ±18 years (one-time compute, cached globally): Saturn, Jupiter, Rahu–Ketu by sign and nakshatra over natal points; double transits on each house; nakshatra returns; eclipses on natal points; Saturn/Jupiter/nodal returns; sade sati phases; Mars for month-level sharpening → trigger spikes per day (L3).
5. **Annual layer** (when the `annual` export exists): Tithi Pravesha chart per year, year lord, Mudda dasha → month themes (L5).
6. **Combine**: per day and class, `score = convergence(L1 base, L2 activation, L3 trigger, L4 second-school confirmation, L5 annual)` exactly as file 11; merge consecutive days above threshold into windows; cap windows per class per year; keep the top-N per year with the drivers (fact ids) attached.
7. **Calibrate** (§4) → tier and, when available, probability band.
8. **Narrate**: one model call per year (both halves) producing short cards from the windows and drivers using template T9 rules; provenance per card as in file 13 §4.
9. **Store**: `life_timelines`, `timeline_windows`; notify the user when ready.

Cost per timeline: compute is TypeScript (seconds); narration ≈ 36 short model calls on the specialist model ≈ $0.15–0.30; recompute quarterly. A Pro-plan feature (IMPROVEMENTS.md).

## 4. Calibration: from scores to probabilities

- **Labels** come from the user's past-half feedback (`timeline_feedback`: window id, verdict, corrected date, added events with class and date).
- **Fixed priors first**: a table per class mapping the convergence tier to a probability prior (e.g. marriage, strong tier → 0.65; move, strong → 0.55; accident, strong → 0.25) set conservatively and shown as tiers only.
- **Learned calibration** once a class has ≥ 200 labelled windows across users: isotonic or Platt mapping from score to observed hit rate, per class (and per cohort such as horizon length). Metrics tracked per class: Brier score, calibration curve, precision/recall at tier thresholds, mean absolute timing error in months.
- **Per-user adjustment**: a user whose past timeline scored high gets slightly tighter bands; a low score triggers a birth-time check (rectification prompt) before trusting the future half.
- **Display rule**: show a probability band ("about 55–65 %") only when the class has a learned calibration with Brier ≤ 0.20; otherwise tiers.
- **Feedback loop to chat**: calibration versions are recorded in every reading trace (file 13), so the chat's verdict tiers can later be replaced by calibrated bands per class.

## 5. Data model

```sql
life_timelines (id, user_id, profile_id, version, range_from, range_to, status, facts_version, rules_version, calibration_version, computed_at)
timeline_windows (id, timeline_id, from_date, to_date, area, event_class, score numeric, tier, prob_low, prob_high, drivers jsonb, narrative text, template, created_at)
timeline_feedback (id, user_id, window_id nullable, verdict, actual_from, actual_to, event_class, note, created_at)   -- window_id null = user-added event
calibration_models (id, event_class, cohort, method, params jsonb, brier, n_labels, trained_at, version)
timeline_jobs (id, user_id, profile_id, status, started_at, finished_at, error)
```

Indexes on `(timeline_id, from_date)`, `(user_id, created_at)`. Rows per user: a few thousand windows at most; narratives are short.

## 6. Policies

- **Death**: never "X will die in <window>". The past half may show "loss or bereavement in the family" windows for the user to confirm (this is valuable calibration data and users ask for it). The future half shows **family health-vigilance windows by relation** ("a period to watch your father's health, Mar–Sep 2029") with care framing; a stronger wording mode exists only behind an explicit consent dialog in settings and never for the user's own longevity (vigilance only, per file 02 and 09).
- **Accident / illness**: "physical caution" and "health vigilance" windows with the body system suggested by the planets, never a diagnosis.
- **Minors' events in the parent's timeline** (births, children's schooling) are read from the parent's chart only.
- **Privacy**: only the owner sees the timeline and feedback; encrypted at rest like birth data; excluded from logs; aggregated calibration uses no identifiers; opt-in checkbox at first open; delete with account.
- **Honesty**: every window shows its drivers; the scorecard is shown even when unflattering; tiers until calibration earns probabilities.

## 7. API and UI

- GraphQL: `myLifeTimeline(profileId, from, to, zoom)`, `timelineWindow(id)`, `submitTimelineFeedback(input)`, `addTimelineEvent(input)`, `requestTimelineRebuild(profileId)`, `myTimelineScorecard(profileId)`. All owner-scoped.
- UI (web): `src/pages/timeline/`: ruler with dasha bands, lanes, window pills with tier opacity, past/future styling, detail card, feedback controls, add-event sheet, scorecard header, filters by area, PDF export; keyboard and touch zoom; works at 390 px with a vertical layout.
- No chat access until `READING_TIMELINE_IN_CHAT=1`; when enabled, the chat may cite confirmed past events and calibrated future windows as extra evidence (ids `timeline.window.<id>`).

## 8. Evaluation and tuning

- **Backtests**: panel charts with known life events (testers who consent; Sachin's test charts): precision/recall per class, timing error, Brier against the fixed priors. Targets for the first release: recall ≥ 0.6 and precision ≥ 0.5 on the six most common classes (schooling, move, job change, new love, marriage, money gain), timing error ≤ 3 months median.
- Tuning is done on the class weights and thresholds in code, with the backtest as the gate; prompts only affect narration.
- A/B of narrative wording on feedback rates (do users engage more with plain or with astrological phrasing).

## 9. Phases

| Phase | Work | Gate |
|---|---|---|
| TL0 | Data model, segmentation, static promise, dasha activation, past-half UI, feedback capture | past timeline renders for the golden chart; feedback saved |
| TL1 | ±18-year transit snapshot, triggers, convergence windows, drivers, scorecard | backtest meets targets on panel charts |
| TL2 | Future half with tiers, narration cards, rebuild job, Pro gating | p95 job time < 5 min; cards grounded (checker) |
| TL3 | Calibration models, probability bands, per-user adjustment, rectification prompt | Brier ≤ 0.20 on the first calibrated classes |
| TL4 | Annual layer (needs Radha Tithi Pravesha), chat integration opt-in, PDF | — |
