# Reading eval report (FAKE model, harness check only, not valid for any gate)

Chart G1 (golden, fixtures), as of 2026-10-24, engine `phase1` (flow `single`), model `default`.

## Headline

| Metric | Value | Gate |
|---|---|---|
| Questions passed | 8/12 | all |
| Assertions checked / verified / contradicted / unverifiable | 29 / 26 / 2 / 1 | contradicted = 0, unverifiable <= 10% (3%) |
| Median total latency | 149 ms | p50 not worse than baseline |
| Median first answer token (from request start) | 20 ms | < 10 s |
| Median input tokens (model-reported) | 6425 | down >= 50% vs baseline |
| Median evidence pack (estimated tokens) | 4062 | |
| Implicit cache share of input tokens | 63% | measured only |
| Mean cost per question | $0.0004 | |

## Input tokens vs the legacy raw-JSON prompt (same chart, same estimator: characters / 3.6)

| Prompt | Estimated input tokens |
|---|---|
| Legacy lean (biodata, D-1, D-9, Vimshottari, chara karakas) | 6605 |
| Legacy full (adds D-2, D-4, D-7, D-10, Narayana) | 19184 |
| Reading engine evidence pack, median | 4062 (+ ~1405 method/persona tokens, cached) |
| Change vs lean | 17% fewer |
| Change vs full | 72% fewer |

## Per question

| Id | Pass | Subjects | Format | Contradicted / checked | Coverage | Windows in horizon | Total ms | First token ms | Prompt tokens | Problems |
|---|---|---|---|---|---|---|---|---|---|---|
| Q1 | NO | career_work | timeline | 0 / 4 | 0 | 2/2 | 421 | 215 | 6961 | pack missing detail.career_work.houses.10; pack missing detail.income_wealth.houses.2; pack missing varga.career_work.D10; pack missing varga.income_wealth.D2; pack missing dasha.career_work.current; pack missing transits.career_work.double_transit; no mention: D-10; no mention: D-2 or hora; no mention: Saturn or Jupiter transit |
| Q2 | yes | property_home | timeline | 0 / 4 | 0.63 | 2/2 | 215 | 37 | 6425 | no mention: D-4 varga cited; no mention: Mars; no mention: 4th house/lord |
| Q3 | NO | speculation_lottery | direct | 1 / 3 | 0.8 | 0/0 | 118 | 15 | 6161 | no mention: 5th/11th/2nd houses |
| Q4 | yes | income_wealth | timeline | 0 / 4 | 0.83 | 1/2 | 220 | 17 | 5996 | no mention: 2nd/11th/9th houses |
| Q5 | yes | general_life_direction | narrative | 0 / 1 | 1 | 0/0 | 149 | 19 | 6942 | - |
| Q6 | yes | general_life_direction | narrative | 0 / 1 | 0.5 | 0/0 | 209 | 48 | 6489 | no mention: Swati; no mention: Hasta; no mention: tara; no mention: star lord |
| Q7 | yes | career_work | factor_table | 0 / 0 | 0.83 | 0/0 | 130 | 26 | 5946 | no mention: dasha |
| Q8 | yes | career_work | factor_table | 0 / 0 | 1 | 0/0 | 121 | 22 | 6623 | - |
| Q9 | yes | marriage_relationship | timeline | 0 / 4 | 0.75 | 2/2 | 256 | 20 | 6865 | no mention: D-9 / navamsa cited; no mention: 7th |
| Q10 | yes | property_home | watchlist | 0 / 1 | 1 | 0/0 | 137 | 13 | 5823 | - |
| Q11 | NO | explain_term | direct | 1 / 3 | 0.5 | 0/0 | 118 | 18 | 5407 | no mention: Sade Sati defined (7.5 years / Saturn over Moon); no mention: honest no (not in it) |
| Q12 | NO | career_work | timeline | 0 / 4 | 0 | 2/2 | 253 | 22 | 6940 | pack missing detail.career_work.houses.10; pack missing detail.income_wealth.houses.2; pack missing detail.marriage_relationship.houses.7; pack missing varga.career_work.D10; pack missing varga.marriage_relationship.D9; pack missing transits.marriage_relationship.double_transit; no mention: work; no mention: money; no mention: marriage |

## Contradicted assertions (review each)

- Q3: "Sa-Ke-Su" (chart says Sa-Ke-Ve): - Saturn-Ketu-Sun is running now.
- Q11: "Sa-Ke-Su" (chart says Sa-Ke-Ve): - Saturn-Ketu-Sun is running now.

Human rubric (file 07 §4) is not scored here; answers are in `answers/`.
