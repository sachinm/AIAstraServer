# Reading eval report (FAKE model, harness check only, not valid for any gate)

Chart G1 (golden, fixtures), as of 2026-10-24, engine `graph` (flow `graph`), model `default`.

## Headline

| Metric | Value | Gate |
|---|---|---|
| Questions passed | 8/12 | all |
| Assertions checked / verified / contradicted / unverifiable | 29 / 26 / 2 / 1 | contradicted = 0, unverifiable <= 10% (3%) |
| Median total latency | 227 ms | p50 not worse than baseline |
| Median first answer token (from request start) | 72 ms | < 10 s |
| Median input tokens (model-reported) | 17668 | down >= 50% vs baseline |
| Median evidence pack (estimated tokens) | 4062 | |
| Implicit cache share of input tokens | 61% | measured only |
| Mean cost per question | $0.0013 | |

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
| Q1 | NO | career_work | timeline | 0 / 4 | 0 | 2/2 | 687 | 404 | 18559 | pack missing detail.career_work.houses.10; pack missing detail.income_wealth.houses.2; pack missing varga.career_work.D10; pack missing varga.income_wealth.D2; pack missing dasha.career_work.current; pack missing transits.career_work.double_transit; no mention: D-10; no mention: D-2 or hora; no mention: Saturn or Jupiter transit |
| Q2 | yes | property_home | timeline | 0 / 4 | 0.63 | 2/2 | 346 | 126 | 17456 | no mention: D-4 varga cited; no mention: Mars; no mention: 4th house/lord |
| Q3 | NO | speculation_lottery | direct | 1 / 3 | 0.8 | 0/0 | 193 | 88 | 17668 | no mention: 5th/11th/2nd houses |
| Q4 | yes | income_wealth | timeline | 0 / 4 | 0.83 | 1/2 | 255 | 54 | 17531 | no mention: 2nd/11th/9th houses |
| Q5 | yes | general_life_direction | narrative | 0 / 1 | 1 | 0/0 | 225 | 90 | 25748 | - |
| Q6 | yes | general_life_direction | narrative | 0 / 1 | 0.5 | 0/0 | 227 | 83 | 24111 | no mention: Swati; no mention: Hasta; no mention: tara; no mention: star lord |
| Q7 | yes | career_work | factor_table | 0 / 0 | 0.83 | 0/0 | 239 | 70 | 17321 | no mention: dasha |
| Q8 | yes | career_work | factor_table | 0 / 0 | 1 | 0/0 | 191 | 54 | 17890 | - |
| Q9 | yes | marriage_relationship | timeline | 0 / 4 | 0.75 | 2/2 | 274 | 74 | 18153 | no mention: D-9 / navamsa cited; no mention: 7th |
| Q10 | yes | property_home | watchlist | 0 / 1 | 1 | 0/0 | 139 | 22 | 5823 | - |
| Q11 | NO | explain_term | direct | 1 / 3 | 0.5 | 0/0 | 137 | 21 | 5407 | no mention: Sade Sati defined (7.5 years / Saturn over Moon); no mention: honest no (not in it) |
| Q12 | NO | career_work | timeline | 0 / 4 | 0 | 2/2 | 293 | 72 | 18507 | pack missing detail.career_work.houses.10; pack missing detail.income_wealth.houses.2; pack missing detail.marriage_relationship.houses.7; pack missing varga.career_work.D10; pack missing varga.marriage_relationship.D9; pack missing transits.marriage_relationship.double_transit; no mention: work; no mention: money; no mention: marriage |

## Contradicted assertions (review each)

- Q3: "Sa-Ke-Su" (chart says Sa-Ke-Ve): - Saturn-Ketu-Sun is running now.
- Q11: "Sa-Ke-Su" (chart says Sa-Ke-Ve): - Saturn-Ketu-Sun is running now.

Human rubric (file 07 §4) is not scored here; answers are in `answers/`.
