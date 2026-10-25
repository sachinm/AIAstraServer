# 15 — Bucket classifier: how a question gets its bucket, score and confidence

Added 2026-10-25. Code: `src/reading/buckets/taxonomy.ts`, `src/reading/buckets/classifier.ts`. Tests: `tests/unit/reading/buckets.test.ts` with the labelled set in `tests/fixtures/buckets/labelled.ts`. This is item 1 of the bucket-first brief and step `t0` of file 13.

**Scope:** English only for now (Sachin, 2026-10-25). Hindi and other languages come later, with answers in the asker's language.

## 1. What it does

Before any model call, every question is put into one of 14 buckets (or `unknown`). The classifier also extracts the slots the question already gives and lists the slots the bucket needs that are still missing. It is a pure function with no I/O, typically well under 1 ms (p95 under 5 ms is a test).

```
question ──► normalise ──► tokens + index ──► cue scores per bucket ──► tie-breaks ──► bucket + confidence
                                    └──► slots (horizon, person, sub-bucket, background, event) ──► missing slots
                                    └──► question kind ──► template (T1–T10)
                                    └──► unanswerable flags (death timing, lottery numbers …) ──► coaching
```

Stage 2 (one small model call with a closed JSON schema) runs only when stage 1 is unsure. Stage 3 is the `unknown` bucket, which the coaching module answers by guiding the user to an answerable question.

## 2. The buckets (taxonomy.ts)

| Bucket | Covers (file 10 rows) | Frame read | Required slots | Default template |
|---|---|---|---|---|
| love_relationships | romance, relationship quality (1, 2) | marriage_relationship | horizon | T2 |
| marriage | timing, health of a marriage (3, 4) | marriage_relationship | horizon | T2 |
| career_job | direction, current job, search, service vs own (5, 6, 7, 9, 10) | career_work | horizon, sub_bucket | T2 |
| money_wealth | income, debt, windfalls (12, 13, 26) | income_wealth | horizon | T2 |
| business | start, grow, partners (11) | career_work + income_wealth | horizon | T2 |
| property_vehicles | home, land, vehicles (14, 15) | property_home | horizon | T2 |
| education | exams, higher studies, field (8, 9) | education_learning | horizon | T2 |
| health_windows | vigilance and recovery windows (16, 17, 18) | health_body | horizon | T9 |
| family_children | children, parents, siblings (19, 20, 21) | children | horizon, subject_person | T2 |
| foreign_legal | abroad, visas, court cases (23, 24) | foreign_relocation | horizon | T2 |
| spirituality_direction | purpose, spiritual phase, nakshatras (25, 27) | general_life_direction | none | T6 |
| time_window_outlook | month or year ahead, current difficulty, transit meaning (28, 29) | general_life_direction | horizon | T9 |
| explain_term | what a term means | explain_term | none | T10 |
| compatibility | two-chart readings (21, 22) | marriage_relationship | other_person | T8 |
| unknown | no life area found | general_life_direction | none | T6 |

Each bucket also lists sub-buckets (for example career: job change, promotion, job search, workplace trouble, career direction), some of which switch the frame or template. Every bucket carries policy flags: `no_remedies` and `no_death_prediction` always; health adds `no_medical_advice` and `vigilance_only`; money, business and property add `no_amounts`; foreign/legal adds `no_legal_advice`; compatibility adds `needs_second_chart`.

## 3. How the score is computed

### 3.1 Normalise and index

1. Cut the question to 2000 characters.
2. Unicode NFKC, lower case, drop apostrophes ("wife's" becomes "wifes", "don't" becomes "dont"), turn everything else that is not a letter or digit into a space, keep "?" as its own token.
3. Split into tokens once and build a map from each token to the positions where it occurs.

Everything after this is lookups in that map, so the work grows linearly with the length of the question. There are no regular expressions with nested repetition, which is why the adversarial tests (100,000 characters of the same letter, 20,000 repetitions of "next") finish in under 50 ms.

### 3.2 Cues and weights

Each bucket has a list of cues: single words or short phrases, each with a weight between 0.3 and 2.2. Examples:

| Bucket | Strong cues (weight) | Weak cues (weight) |
|---|---|---|
| career_job | promotion 1.3, job 1.2, career 1.2, interview 1.0 | work 0.7, hike 0.6, company 0.4, team 0.3 |
| marriage | marry / married / marriage 1.3, wedding 1.2, divorce 1.2 | wife / husband 0.9, arranged 0.6 |
| money_wealth | lottery / jackpot 1.4, debt 1.3, money / income 1.2 | save 0.6, loss 0.6 |
| compatibility | kundli milan / gun milan / ashtakoota 2.2, compatible 1.8, wifes chart 1.8 | match 0.9 |
| time_window_outlook | bad phase / rough patch 1.1, this month 1.0 | transit 0.6, everything 0.4 |

The weights encode how specific a word is. "Promotion" almost always means career, so it weighs 1.3. "Work" appears in many questions ("will my marriage work?"), so it weighs 0.7. A phrase cue is matched only on token boundaries, so "ex" does not fire inside "next".

**Bucket score** = the sum of the weights of every cue occurrence in the question, minus the weight of each occurrence that is negated. Buckets that end at zero or below are dropped.

### 3.3 Negation

Only meta-negation removes a topic: a negator (`not`, `no`, `dont`, `never` …) together with a topic word (`about`, `asking`, `regarding`, `interested`, `care` …) within the four tokens before the cue, or `except`, `besides`, `other than`, `apart from`, `forget about`, `nothing to do with`, `leave aside`.

An ordinary negative keeps the topic. "Why am I not getting a job?" is still a career question, and "My marriage is not going well" is still about marriage. Both are tests.

### 3.4 Ranking and tie-breaks

Buckets are sorted by score. Five rules then settle cases the weights alone get wrong:

1. If love ranks first but marriage scores 1.1 or more, marriage wins ("girlfriend" plus "marry").
2. Compatibility at 1.6 or more always wins (it needs a second chart, so missing it is costly).
3. If money ranks first but business scores 1.2 or more, business wins ("profit in my shop").
4. If the time-window outlook ranks first but a specific life area scores 1.0 or more, the life area wins ("How does this month look for my career?" is a career question with a one-month horizon).
5. If love ranks first but family scores at least as much, family wins ("my relationship with my father").

Two overrides come before scoring:

- **Explain a term:** a definition head ("what is", "explain", "define", "meaning of" …) plus a known term (Sade Sati, dasha, nakshatra, manglik …), unless the sentence is about the person's own chart ("over my", "for me", "in my").
- **No cues at all:** if the question names a planet and a transit cue ("Ketu is transiting over my natal Jupiter"), it goes to the time-window outlook with confidence 0.8; otherwise it is `unknown` with confidence 0.2.

### 3.5 Confidence

With `s1` the top score and `s2` the second:

```
strength   = min(1, s1 / 1.5)          how much evidence there is (1.5 = two strong cues or one very strong)
margin     = (s1 − s2) / s1            how clearly the top bucket beats the next
confidence = min(0.99, 0.30 + 0.35 × strength + 0.35 × margin)

caps:  s1 < 0.8 (one weak cue only)                    → at most 0.60
       two or more other buckets score 0.6 or more      → at most 0.55 (multi-subject question)
```

Below the threshold (`READING_CLASSIFIER_THRESHOLD`, default 0.70) the question goes to the model stage in `auto` mode, or the clarifier asks which area is meant.

### 3.6 Worked examples (real output of `classifyRules`, as of 2026-10-24)

| Question | Scores | Bucket | Confidence | Why |
|---|---|---|---|---|
| Should I change jobs this year? | career 1.2 | career_job / job_change | 0.93 | 0.30 + 0.35 × 0.80 + 0.35 × 1.00. Horizon "this year" = 24 Oct to 31 Dec 2026. Kind compare, template T5. Nothing missing. |
| When will I get married? | marriage 1.3 | marriage / marriage_timing | 0.95 | 0.30 + 0.35 × 0.87 + 0.35. Kind timing, template T2. Missing: horizon, so the clarifier asks for the period. |
| How will my work, money and marriage go over the next 3 years? (golden Q12) | marriage 1.3, money 1.2, career 0.7 | marriage, also money and career | 0.55 | Uncapped 0.63 (margin only 0.08); capped at 0.55 because two other areas score 0.6 or more. The clarifier asks which to read first. |
| Not about my marriage, I want to know about my job | career 1.2 (marriage negated) | career_job | 0.93 | "not … about" removes the marriage cue. Missing: horizon, sub_bucket. |
| Why am I not getting a job? | career 1.2 | career_job | 0.93 | Ordinary negative, topic kept. Kind why, template T3. |
| What does my chart say? | spirituality 0.4 | spirituality_direction | 0.60 | One weak cue: uncapped 0.74, capped at 0.60, so the model or the clarifier decides. |
| How is my relationship with my father? | love 0.9, family 0.9 | family_children / parents_siblings | 0.51 | Tie-break 5 picks family; equal scores give margin 0, so confidence stays low and the model stage confirms. |
| Ketu is transiting over my natal Jupiter, what does that mean for me? | none | time_window_outlook / transit_meaning | 0.80 | Planet plus transit cue with no life area. Template T4. |
| When will I die? | health 1.0 | health_windows | 0.88 | Flagged `death_timing`: template T10 with the policy answer and a redirect to health-vigilance windows. |
| Hello | none | unknown | 0.20 | Flagged `no_subject`: coaching shows how to ask. |

## 4. Slots

| Slot | How it is found | Examples |
|---|---|---|
| horizon | spans ("next 6 months", "within three months", "over the next 2 years") mapped to now / 3m / 6m / 1y / 3y or a date range; "this year" = today to 31 Dec; "next year" and "next month" = that calendar period; "by March", "before June 2027", "in 2028", "between Nov 2026 and Apr 2027" = date ranges; "now", "soon", "lifetime", "next few months/years" | "by March" on 24 Oct 2026 = 24 Oct 2026 to 31 Mar 2027 |
| subject_person | "my son's career", "will my daughter clear", "for my mother" = that person; otherwise first person = me | "my wife's career" = spouse |
| sub_bucket | first matching cue list for the bucket | career: change, switch, quit = job_change |
| background (career, business) | "lost my job" = between jobs; "my business" = self-employed; "student" = studying; "my boss", "current job" = employed | |
| other_person (compatibility) | partner, wife, fiance, "a girl", "my match" | |
| specific_event | "moving to Dubai", "promotion in March" | |

**Missing slots** = the bucket's required slots minus those found. The clarifier (file 13 §2) asks for them one at a time, horizon first, at most two turns, then proceeds with the bucket's default and says what it assumed.

## 5. Question kind and template

The kind comes from the opening words: "when", "how long", "which month" = timing; "why", "what does … mean" = why; "should I … or" = compare; "will / is / can …" = yes or no; otherwise describe; definition head plus term = explain.

| Condition (first match wins) | Template |
|---|---|
| explain term, or an unanswerable flag other than no_subject | T10 |
| compatibility | T8 |
| nakshatra portrait | T7 |
| why + a named planet or transit | T4 |
| why otherwise | T3 |
| sub-bucket that says T3 or T4 (current difficulty, transit meaning, breakup) | that template |
| compare | T5 |
| yes or no (T9 for "this month" outlook) | T1 |
| timing | T2 |
| otherwise the sub-bucket's or bucket's default | |

## 6. Questions astrology cannot answer as posed

| Flag | Triggers | What happens |
|---|---|---|
| death_timing | "when will I die", "how long will I live", "when will my … die" | T10 policy answer; redirect to health-vigilance windows; never a date |
| lottery_numbers | lottery or jackpot plus "number(s)" | T10; redirect to gain windows only |
| exact_amount | "how much money", "how many lakhs", "what salary will I" | T10; redirect to growth windows, no amounts |
| exact_clock_time | "at 3 pm", "3:30 pm" | T10; redirect to the day's quality, not the minute |
| diagnosis | "do I have cancer", "which disease" | T10; redirect to vigilance windows; no medical advice |
| weather | rain, weather | T10 |
| no_subject | no life area and "will it happen", "yes or no", or three words or fewer | unknown bucket; coaching chips |

## 7. Model stage (stage 2)

Runs only when `READING_CLASSIFIER_MODE=auto` (default) and stage 1 gave confidence below the threshold, or the bucket is `unknown`. Death-timing questions never go to the model. One call to `READING_MODEL_INTAKE`, no thinking, at most 150 output tokens, 4 s timeout, response schema restricted to the bucket ids, horizon ids and person ids. Slots the rules already found are never overwritten. If the model is less sure than the rules, or fails, the rules answer stands. `READING_CLASSIFIER_MODE=rules` never calls a model; `llm` always does. Not yet measured against a real model (no Gemini credits).

## 8. How it reaches the rest of the engine

`runIntake` attaches the result to every intent as `intent.classification` (bucket, sub-bucket, other buckets, confidence, slots, missing, template, policy, unanswerable flag, kind, source, ms). The existing subject choice is unchanged, except that when intake found no subject and the classifier is confident, the bucket's frame becomes the subject. The SSE `intent` event carries the classification, so the web can show the bucket, the template frame and the clarify questions.

## 9. Measured (unit tests, 165 labelled English questions)

| Check | Bar | Result |
|---|---|---|
| Overall accuracy | at least 90 % | passes |
| Recall and precision per bucket | at least 75 % each | all buckets pass; lowest were career recall 0.89 and spirituality precision 0.82 before the last tuning round |
| Sub-bucket agreement where labelled | at least 85 % | passes |
| Horizon agreement where labelled | at least 90 % | passes |
| p95 time per question | under 5 ms | passes (typically under 1 ms) |
| Adversarial inputs | under 50 ms each | passes |

## 10. Changing it

- **New cue:** add `[word or phrase, weight]` to the bucket in `CUES`, and add a labelled question that needs it. Run `npx vitest run tests/unit/reading/buckets.test.ts`; the precision and recall report prints per bucket on failure.
- **New bucket:** add a row in `BUCKETS` (taxonomy.ts), cues in `CUES`, sub-bucket cues in `SUB_CUES`, and at least five labelled questions.
- **Weights:** 1.2 to 1.4 for a word that almost always means that area; 0.9 to 1.1 for a likely but shared word; 0.3 to 0.7 for weak context words. Phrases that settle the bucket on their own (kundli milan) go to 1.8 to 2.2.
