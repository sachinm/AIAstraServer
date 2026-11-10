# 70 Phase 1. Why the clocks read heavy (2026-11-10)

Measured offline from the 9 `pressure_inventory` rows stored on staging (read-only dump, test data). No engine call,
no model call. Follows `70-phase1-clock-rows-2026-11-10.md`. The core rule was cross-checked by hand: over all 1,449
dasha and annual rows, one bad flag with no good flag is `presses` 463 times out of 463.

Decision for Sachin: the stopgap below counts the engine's stored `reasons` flags in the server. It computes no
astrology (it reads a stored list and counts it), but it does reshape the engine's verdict, so it needs a yes
against the rule that the engine alone gives astrological data. The engine change is the real fix.


Data: 9 stored inventories, 3 test kundlis (c584c0a3 one clock, 75b0d618 four clocks, de5a2275 four clocks). 884 dasha rows, 565 annual rows, 342 transit rows. Analysis scripts were kept out of the repo.

## Answer first

The tone is a plain OR over six "bad" flags that the engine stores in each row's `reasons` list. If any one flag is on, and the planet is not a functional benefic, the row is `presses`. The rule fits 884 of 884 dasha rows and 565 of 565 annual rows (100%).

Most of those flags belong to the planet, not to the period. They are fixed once per planet per kundli and copied to every row where that planet rules. So the tone is mostly a fixed label on each planet.

Numbers:
- 80% of period rows (L1-L3) press: 700 of 884. 81% on kundli 75b0d618 (302 of 375), 77% on de5a2275, 88% on c584c0a3.
- 20 of 26 kundli-planet pairs carry at least one bad flag (77%). Only 2 of 26 planets are functional benefic (Sun on 75b0d618, Saturn on de5a2275). Three Moons and one Mercury have no flag.
- Flag counts over the 26 planets: functional_malefic 12, kashta_over_ishta 11, in_dusthana 9, shadbala below 0.8 1. With these OR'd, most planets trip at least one.
- On each of 75b0d618 and de5a2275, seven of nine planets press on every single row they rule. The benefic planet never presses. Only Moon and Mercury (75b0d618) or Moon (de5a2275) vary.
- Row-level variation comes only from two relative flags (`2_12_from_parent`, `6_8_from_parent`). On a benefic planet they turn supports into mixed (30 rows).
- The server is not the cause. It copies the engine tone correctly.

## 1. Polarity counts

Dasha rows, all kundlis and clocks:

| level | rows | presses | mixed | supports | % presses |
|---|---|---|---|---|---|
| 1 | 19 | 14 | 2 | 3 | 74 |
| 2 | 93 | 72 | 12 | 9 | 77 |
| 3 | 772 | 614 | 93 | 65 | 80 |

Dasha rows per clock:

| kundli / clock | rows | % presses |
|---|---|---|
| c584c0a3 dwisatpathi | 52 | 88 |
| 75b0d618 narayana | 107 | 78 |
| 75b0d618 vimsottari | 45 | 84 |
| 75b0d618 yogini | 191 | 82 |
| 75b0d618 chathuraaseethi_sama | 32 | 78 |
| de5a2275 vimsottari | 24 | 79 |
| de5a2275 narayana | 83 | 77 |
| de5a2275 yogini | 196 | 76 |
| de5a2275 chara | 154 | 78 |

Other kinds (all inventories):

| kind | presses | mixed | supports |
|---|---|---|---|
| annual (565) | 399 (71%) | 115 | 51 |
| transit (342) | 198 (58%) | 63 | 81 |
| return (9) | 4 | 0 | 5 |

Annual rows follow the same OR rule as dasha. Transits use a different rule (below) and are more balanced.

## 2. Strength

Dasha strength by polarity (rows):

| polarity | strength 1 | strength 2 | strength 3 |
|---|---|---|---|
| presses (700) | 610 (87%) | 67 | 23 |
| mixed (107) | 77 | 0 | 30 |
| supports (77) | 77 (100%) | 0 | 0 |

Min / median / max: presses 1 / 1 / 3, mixed 1 / 1 / 3, supports 1 / 1 / 1.

By level (L3): presses s1 536, s2 59, s3 19; mixed s1 66, s3 27; supports s1 65.

Is strength informative for dasha rows? No.
- 87% of presses and all supports sit at 1. A threshold cannot split them.
- Strength does not follow the number of bad flags. Rows with 1, 2, 3 or 4 bad flags are almost all strength 1.
- Strength above 1 appears only on presses and mixed rows. It is a weak "not a plain row" signal, not a measure of weight.

Transit strength is informative: supports are 76 of 81 at strength 3, mixed are all strength 2, presses spread over 1/2/3 (104/64/30). For dasha it is not.

## 3. Inferred engine rule and accuracy

Rule R0 (dasha and annual):
- Bad flags: functional_malefic, in_dusthana, kashta_over_ishta, shadbala_ratio_below_0.8, 2_12_from_parent, 6_8_from_parent.
- Good flag: functional_benefic.
- Any bad flag and no good flag: presses.
- Good flag and no bad flag: supports.
- Good flag and only parent flags: mixed (30 rows).
- No flags at all: mixed (77 rows).
- A good flag together with a planet-level bad flag never occurs.

Bad-flag count against polarity: 0 flags gives mixed (77) or supports (77); 1 flag gives presses 245 or mixed 30 (benefic with parent flag); 2 flags presses 280; 3 flags presses 132; 4 flags presses 43. Piling up flags changes nothing.

Accuracy of candidate rules, dasha rows (annual in brackets):

| rule | accuracy |
|---|---|
| R0 any bad flag in `reasons` | 100.0% (100.0%) |
| always presses | 79.2% (70.6%) |
| houses_touched has 6, 8 or 12 | 61.0% (52.6%) |
| houses_touched has 6 or 8 | 59.6% (48.7%) |
| houses_touched count 4 or more | 64.0% (52.6%) |
| in_dusthana flag only | 51.6% (35.6%) |
| functional_malefic flag only | 51.8% (60.7%) |
| natural malefic planet (Su Ma Sa Ra Ke) | 34.2% (40.4%) |

Houses touched and matters do not drive polarity. The stored `reasons` do. "Always presses" beats every house-based guess.

Transit rule: polarity is exactly the `gochara_from_moon` table in the payload rules, by planet and house from the Moon (342 of 342). Saturn, Mars, Rahu, Ketu have `else: presses`, and Saturn presses on 9 of 12 houses.

## 4. Span tone, 2026-11-10 to 2028-02-10 (457 days)

Heavy-day share, % of days, per clock. All alternatives are pure selections over stored fields unless stated.

| clock | a current | b1 L1 | b2 L2 | c1 strength 2+ | c3 two+ flags | c4 three+ flags | d1 weighted |
|---|---|---|---|---|---|---|---|
| c584c0a3 dwisatpathi | 89 | 100 | 100 | 0 | 43 | 10 | 100 |
| 75b0d618 narayana | 80 | 0 | 66 | 7 | 53 | 20 | 7 |
| 75b0d618 vimsottari | 100 | 100 | 58 | 9 | 49 | 23 | 67 |
| 75b0d618 yogini | 80 | 7 | 80 | 5 | 53 | 18 | 26 |
| 75b0d618 chathuraaseethi_sama | 61 | 0 | 100 | 0 | 41 | 17 | 25 |
| de5a2275 vimsottari | 79 | 100 | 0 | 0 | 79 | 15 | 0 |
| de5a2275 narayana | 76 | 0 | 100 | 13 | 63 | 30 | 80 |
| de5a2275 yogini | 74 | 100 | 80 | 12 | 57 | 15 | 87 |
| de5a2275 chara | 77 | 100 | 24 | 14 | 63 | 23 | 34 |

Current rule heavy / mixed / light, same row order: 89/11/0, 80/13/7, 100/0/0, 80/12/8, 61/19/19, 79/21/0, 76/10/13, 74/16/10, 77/13/10.

- a: deepest covering row (L3 over L2 over L1), polarity mapped to tone. Selection. Heavy 61-100%, mean about 79%.
- b1 / b2: use the level 1 or level 2 row. Selection. Swings between 0% and 100% by clock. A level 1 period runs years, so one planet label decides the whole 15 months. Not a fix.
- c1 / c2: presses counts as heavy only if strength is 2+ (c2: 3). Selection. Heavy falls to 0-14% (c1) and 0-7% (c2) and almost everything turns mixed (74-100%). Strength is 1 on 87% of presses, so any threshold removes nearly all at once. No balanced threshold exists: strength 1 gives about 80% heavy, 2+ gives about 5%.
- c3: heavy only with two or more bad flags in `reasons`, else mixed. Selection over a stored field. Heavy 41-79%.
- c4: heavy only with three or more bad flags. Selection. Heavy 10-30%, mixed 57-90%. Closest to balanced. Light stays small (0-19%) because supports is rare.
- d1 (strength-weighted mean over L1+L2+L3, heavy +1, mixed 0, light -1, cut at +/-0.34): erratic by clock, 0% to 100% heavy. d2 and d3 (wider mixed band) give mostly mixed (0-95% heavy depending on clock). Strength is mostly 1, so the long L1/L2 rows dominate. Not stable enough to ship.

None of these fixes the cause. A real fix is an engine change.

## 5. Clocks agreeing on heavy per day

Only the two kundlis with four clocks (457 days each). "Heavy 3+" is at least 3 of 4 clocks heavy that day. "All 4" is all four.

| alternative | 75b0d618 heavy 3+ | 75b0d618 all 4 | de5a2275 heavy 3+ | de5a2275 all 4 |
|---|---|---|---|---|
| a current | 88% | 36% | 77% | 35% |
| b1 level 1 | 0% | 0% | 100% | 0% |
| b2 level 2 | 80% | 24% | 20% | 0% |
| c1 strength 2+ | 0% | 0% | 0% | 0% |
| c3 two+ flags | 33% | 7% | 53% | 23% |
| c4 three+ flags | 0% | 0% | 3% | 0% |
| d1 weighted | 11% | 0% | 28% | 0% |

Under the current rule, 3 or more of 4 clocks say heavy on 88% and 77% of days. A "confirmed heavy" status would be true most of the time, so it carries no information. Part of this is agreement by construction: the clocks share the same planet labels, so a flagged planet is heavy in every clock where it rules.

Agreement on "any one tone with 3+ clocks" is 80-90% under the current rule and also high under c1 and c4, because everything collapses to mixed. Confirmation only means something for heavy or light, not for the default tone.

## Recommendation

Change the engine to grade polarity instead of OR-ing flags (engine change). Suggested rule for the engine owner: count bad and good flags; presses needs two or more independent bad flags and no good flag; a single bad flag gives mixed; a good flag with no bad flag gives supports; the two parent-relative flags tilt a row from the planet's baseline and do not set it. Also give dasha rows a real strength (today 87% of presses are 1) and make functional_benefic reachable (it holds for 2 of 26 planets).

Stopgap until then: a selection in the server over the stored `reasons` list, heavy only with three or more bad flags (c4, 10-30% heavy days; "heavy in 3+ clocks" falls to 0-3%) or two or more (c3, 41-79%). It counts stored flags and computes no astrology. It only dilutes the label, since the planet-level flags stay the real driver. Do not use strength or level 1/2 rows as the fix.
