# 07 — Evaluation

The engine is only "accurate" if we can show it. This file defines the fixed question set, the automated checks and the rubric. Evals run locally (`npm run eval:readings`) against the golden chart and against a small panel of real charts, and must run before any change to prompts, packs, models or the dossier schema.

## 1. Charts

| Chart | Source | Use |
|---|---|---|
| G1 — golden | `notes.txt` / `kundli.json` (2002-04-27 17:05 IST, 28N55 77E01) exported from Jagannatha Hora | dossier correctness vs JHora; all golden questions |
| P1–P5 — panel | five real users (Sachin and consenting testers), stored by user id in `evals/panel.json` (git-ignored) | variety of lagnas, running dashas, transits |
| S1–S3 — synthetic edge cases | gandanta Moon; Scorpio/Aquarius lagna (dual lords); retro+combust 10th lord | branch coverage of rules |

## 2. Golden questions (the fixed set)

Sachin's test questions are the first six. Each row states the method elements the reading **must** use; the checker looks for them in the structured findings, not in prose.

| # | Question | Subject(s) | Horizon | Must use | Format |
|---|---|---|---|---|---|
| Q1 | "I am having a lot of problems with my work and with money. I am not happy. When does this improve?" | career_work, income_wealth | 1y | 10th/6th and 2nd/11th lords, D-10, D-2, AmK, current MD-AD-PD class per subject, Saturn/Jupiter transit on 10th/2nd/11th, double transit, windows table | timeline |
| Q2 | "When am I going to buy a house?" | property_home | 3y | 4th lord, Mars, Moon, D-4 (D-1 4th lord in D-4), A4, deliverer dashas, Saturn/Jupiter on 4th and 4th lord | timeline |
| Q3 | "When am I going to win the lottery?" | speculation_lottery | 1y | 5th/11th/2nd, Rahu, Jupiter, D-2; **must** reframe as gain windows with caveat; no win prediction | direct |
| Q4 | "When will I make a million dollars? In the next 3 or 6 months is a big jump coming?" | income_wealth | 6m | 2nd/11th/9th, Jupiter, Indu Lagna, D-2, PD-level windows in 6 months, transit triggers; **must not** state amounts | timeline |
| Q5 | "Ketu is transiting over my Jupiter. What does that even mean for me?" | why_meaning (+ auto subject from Jupiter lordships) | now→6m | transit table rows for Ke over natal Ju (sign, nakshatra, exact-degree window), houses Jupiter owns/occupies, Rahu opposite, tara of transit nakshatra, dasha context | narrative |
| Q6 | "Tell me about my nakshatras — look at it from all the different ways." | general_life_direction (nakshatra deep dive) | life | all eight layers with facts: janma, lagna, star-lords of lagna lord/10th lord/dasha lords, tara table, pada→navamsa, current transit nakshatras, AL nakshatra, gandanta/pushkara flags | narrative |
| Q7 | "Should I change jobs this year?" | career_work | to Dec 31 | 10th/6th, D-10 lagna and 10th, AmK, dasha class, Saturn transit from Moon, double transit; compare stay vs move windows | factor_table |
| Q8 | "What does my D-10 say about the kind of work I am suited for?" | career_work (describe) | life | D-10 lagna, lord, 10th in D-10, planets in D-10 kendras, D-1 10th lord in D-10, Sun/Saturn/Mercury dignities | narrative |
| Q9 | "When will I get married?" | marriage_relationship | 3y | 7th lord, Venus/Jupiter, DK, UL, D-9 (lagna, 7th, D-1 7th lord in D-9), deliverer dashas, Jupiter transit on 7th/UL, double transit | timeline |
| Q10 | "Is this month a good time to sign a property deal?" | property_home | now | current PD, Saturn/Jupiter/Mars transits on 4th and lord this month, tara of the day planet transits, ashtakavarga of transited signs | watchlist |
| Q11 | "What is Sade Sati and am I in it?" | explain_term + health_body/general | now | definition; transit table sade-sati status with dates; Moon sign; honest "no" if not | direct |
| Q12 | "My work, my money, my marriage — what is coming in the next year?" | three subjects | 1y | clarify card must trigger (3 subjects); after confirm, three promise+dasha+transit passes, one nakshatra pass, merged windows | timeline |

## 3. Automated checks (run on every eval)

1. **Dossier correctness** (Python repo): golden chart vs JHora export for longitudes, nakshatra/pada, navamsa, special lagnas, Vimshottari dates; schema validation; property tests.
2. **Pack selector** (unit tests): for each subject the pack contains exactly the frame houses/lords/karakas/varga/arudha; horizon filtering of dasha and transit rows; stable ordering (byte-identical prefix across two builds).
3. **Grounding gate**: every surviving claim has evidence ids present in its pack (reconcile guarantees this; the test asserts `droppedClaims` ≤ 10 % per run, else the prompt regressed).
4. **Prose grounding checker** (`grounding/checker.ts`): a cheap model (`gemini-3.1-flash-lite`, structured output) extracts assertions from the final answer of the form `{planet|house, relation, value}` — e.g. `Mercury in 9th`, `10th lord is Mercury`, `Saturn Mahadasha until 2039`, `Ketu in Pisces until Dec 2026` — and the checker verifies each against the dossier/transit table. Report `checked`, `verified`, `contradicted`, `unverifiable`. Target: `contradicted = 0`; `unverifiable ≤ 10 %`. This is the headline accuracy number.
5. **Method coverage**: per golden question, the "must use" ids appear in `findings[].keyFacts ∪ claims[].evidence` (e.g. Q2 must cite `vargas.D4.*` and `houses.4.lord`). Score 0–1.
6. **Window sanity**: every window lies in the horizon, starts/ends on a PD boundary or an ingress date from the snapshot, and the table in the prose matches `windows[]` (dates parsed from the markdown table).
7. **Format compliance**: direct answer first (first paragraph ≤ 5 sentences), required table header present for `timeline`/`factor_table`, word count within the format cap, no images, no remedies (regex list), no dollar amounts in Q4, caveat present in Q3.
8. **Latency and cost**: per stage from `reading_runs.timings_ms` and `usage`; thresholds from file 05 (p50 complete ≤ 40 s, p95 ≤ 60 s; cost ≤ $0.12 per full reading).
9. **Determinism of the deterministic parts**: `prepare` and `reconcile` outputs are byte-identical across runs for the same inputs.

## 4. Human rubric (weekly, 1–5 each, two reviewers, Sachin is one)

| Dimension | 5 looks like |
|---|---|
| Method fidelity | Reads like a trained Parashari–Jaimini astrologer would: right houses, right varga, right karakas, dasha before transit, convergence stated |
| Specificity | Names the actual placements and dates; no generic sign-trait filler |
| Timing quality | Windows are dated, triggered, and ranked; "watch for" items are concrete |
| Honesty | Caveats where data is thin; no promises; disagreement between layers is said |
| Nakshatra depth | Star-lord logic and tara used, not just "your Moon is in Swati" |
| Presentation | Format obeyed, scannable, tables where comparison, direct answer first |
| Voice | PVR persona: humble, exacting, brief Sanskrit with gloss |

Release gate for each phase: automated checks green on all 12 questions × G1 + ≥ 3 panel charts; human rubric mean ≥ 4.0 with no dimension < 3.5; p50 latency within target.

## 5. Baseline first

Before Phase 1 ships, run the 12 questions through the **current** live path (2.5-flash, lean and full) on G1 and two panel charts and store answers + prose-grounding results in `evals/baseline/`. That gives the before/after numbers for grounding, D-1 bias (count of D-1-only reasoning on varga questions Q2/Q8/Q9), latency and cost.

## 6. Tooling

- `npm run eval:readings -- --chart G1 --questions all --engine current|phase1|graph` → JSON report + markdown summary in `evals/reports/<date>/`.
- `npm run eval:grounding -- --run <readingRunId>` → checker on any stored run (used in admin "why this answer").
- Eval runs cost real tokens (~$1.50 per full pass at Phase 2 prices); keep them manual, not CI-on-push, until paid billing and quotas are settled.
