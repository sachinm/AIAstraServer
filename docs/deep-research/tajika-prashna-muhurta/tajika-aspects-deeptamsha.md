# Tajika aspects and orbs (dṛṣṭi, dīptāṃśa)

> Tajika uses its own aspect system, unlike Parāśara's. Aspects are counted by sign distance and come in four kinds:
> open friend, secret friend, secret enemy and open enemy. Each planet has an "orb of light" (dīptāṃśa), and an aspect
> works fully only when the planets are within orb. Every Tajika yoga (`tajika-yogas.md`) and the year-lord rule
> depend on this. The doctrine comes from Perso-Arabic astrology (Gansten 2018, *History of Science in South Asia* 6).
> The orbs are stable across texts. The aspect strengths are disputed.

## 1. Sources

| Text | Numbering | Rule |
|---|---|---|
| Samarasiṃha, *Tājikaśāstra*; Vāmana; Haribhaṭṭa, *Tājikasāra* 57, 61 | as quoted in *Hāyanaratna* (Gansten 2020) ch. 2 §1 | Four kinds and their house distances |
| Nīlakaṇṭha, Saṃjñātantra 2.11–12 | HR ch. 2 §3 | 60-point aspect-strength constants by sign distance |
| Saṃjñātantra 2.14 | HR ch. 2 §1 | Full results within the planet's own orb, middling beyond it |
| Orbs: Tejaḥsiṃha, *Daivajñālaṃkṛti* 8.9; *Tājikasāra* 88; *Praśnavaiṣṇava* (Rāhu) | HR ch. 3 §1 | Sun 15, Moon 12, Mars 8, Mercury 7, Jupiter 9, Venus 7, Saturn 9, (Rāhu 12) |
| *Tājikamuktāvalī* 44 | HR ch. 2 §1 | Applying vs. separating gives future vs. past |
| Gansten, "Origins of the Tājika System of Astrological Aspects and Dignities", HSSA 6 (2018) | erudit.org (403 on fetch) | Historical origin. Not read |

URLs: `.../doc1500892.html` (kinds), `.../doc1500894.html` (values), `.../doc1500903.html` (orbs).

## 2. When it applies

Annual, monthly and daily revolution charts, and Tajika praśna (Nīlakaṇṭha's Praśnatantra). It is not used in natal
Parāśari reading.

## 3. Inputs required

Sidereal longitudes of the seven planets (Rāhu optional) in the revolution chart, their daily speeds (to tell faster
from slower, and applying from separating), and retrograde flags.

## 4. Calculation

**Aspect kind by sign distance (counted inclusively from the aspecting planet) [TEXT]:**

| Distance | Kind | Strength: Vāmana / Haribhaṭṭa | Strength: Samarasiṃha |
|---|---|---|---|
| 1 (same sign) | open enemy (kṣuta / conjunction). Vāmana: good. Reconciled by dignity | full | full |
| 3, 11 | secret friend (*tasdī*) | ¼ | ⅔ (3rd), ⅙ (11th) |
| 4, 10 | secret enemy (*taravī*) | ½ | ¼ |
| 5, 9 | open friend (*taślī*) | ¾ | ¾ |
| 7 | open enemy (*mukāvilā*) | full | full |
| 2, 6, 8, 12 | no aspect | — | — |

The Yavana names come from an unattributed stanza quoted in HR.

**Numerical aspect strength (60 points = 1 rūpa) [TEXT] Saṃj. 2.11–12** (HR ascribes the constants to
Samarasiṃha's scheme). Constants by full signs of distance from aspecting to aspected planet:

| Signs | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Points | 60 | 0 | 40 | 15 | 45 | 0 | 60 | 0 | 45 | 15 | 10 | 0 |

Interpolate linearly within the sign: `value = c[s] + (c[s+1] − c[s]) × deg/30`. Divide by 3 for the 20-point viṃśopaka scale.
HR footnote: Samarasiṃha and Nīlakaṇṭha differ from Balabhadra's easy method on the two sextiles, the two squares
and the dexter trine. This table is not symmetric (dexter vs. sinister).

**Orbs (dīptāṃśa) [TEXT]:** Sun 15°, Moon 12°, Mars 8°, Mercury 7°, Jupiter 9°, Venus 7°, Saturn 9°. Rāhu 12° (Praśnavaiṣṇava only).
A planet's sphere reaches its orb on each side of its degree (Saṃj. 2.14: "ahead and behind").

**Mutual orb.** The HR pages fetched do not state a half-sum rule. They test each planet "within its own orb".
[MODERN] Many modern authors (e.g. B.V. Raman, *Varshaphal*) use the average of the two orbs (half-sum). The engine
checks whether either planet is inside the other's orb (§8). This needs a decision.

**Applying vs. separating [TEXT]** (Muktāvalī 44): if the faster planet has not yet reached the slower one's aspect
point, the result is in the future. If it has passed, the result is past. If they are equal, it is present.

## 5. Interpretation rules

- [TEXT] Friendly aspects (3/11, 5/9) give agreement and help. Hostile ones (1, 4/10, 7) give conflict, danger or
  effort. Within 12° (Samarasiṃha, Vāmana) or within orb (Tājikaratnamālā) they act fully. Beyond that, the effect is ordinary or middling.
- [TEXT] Tājikasāra 61 and Vāmana: benefics in friendly or malefics in hostile aspect give full results. The reverse
  gives half. Mixed gives three quarters.
- [TEXT] Conjunction (same sign) is good when the planets are dignified (own, exalted, friend's sign), and bad when
  they are in a neutral or enemy sign or debilitated (HR's reconciliation of Samarasiṃha vs. Vāmana).

## 6. Variants and disputes

- Strength fractions for 3/11 and 4/10 (above). Nīlakaṇṭha's exact verse values were not seen directly.
- Conjunction good or bad (above). Dykes 2019 reads Sahl as counting only opposition as inimical (HR ch. 2 §1 note).
- Mutual orb: own orb vs. half-sum (above).

## 7. Worked micro-example

Venus at 10° Virgo, Jupiter at 14° Capricorn. The distance is 5 signs inclusive (Vi→Cp = 5th), an open-friendly
trine. The degree gap is 4°, inside both Venus's 7° and Jupiter's 9°. Venus is faster and behind, so it is applying:
an Itthaśāla (`tajika-yogas.md`).
Numeric strength (Jupiter − Venus = 124°: 4 signs + 4°) = 45 + (0 − 45) × 4/30 = 39 of 60.

## 8. Design notes for AI Astra

- Engine (served): `annual.tajaka.aspects` lists sign-based relations named `trinal`, `sextile`, `square`,
  `semi_sextile`, `opposition` and `conjunction` (`tajaka.py` 33–352). Orbs: `const.deeptaamsa_of_planets =
  [15,12,8,7,9,7,9]`, which matches the texts. The orb test, `both_planets_within_their_deeptamsa`, checks whether
  either planet lies in the other's orb range, with a 1° allowance at the edge.
- Engine additions: per pair `{kind: open_friend|secret_friend|secret_enemy|open_enemy, distance_signs,
  degree_gap, within_orb (own | mutual | none), applying|separating, strength_60 (Saṃj. 2.11–12 table)}`.
  Also make `orb_rule` a parameter (`own` | `half_sum`) and report which was used. Node only selects rows.
- The `semi_sextile` label is risky. Distances 2 and 12 have **no** Tajika aspect. Check that the engine does not
  count them as aspects anywhere in yogas or year-lord selection (engine-rule-verifier task, doc 46 §D.2).
- Weight: infrastructure. Never shown to users by name.

## 9. Open questions

- Nīlakaṇṭha's own strength values (Saṃj. 2.x) should be read from the Sanskrit to confirm the table.
- Half-sum vs. own orb needs a product default. Recommend own-orb (closest to the texts quoted), with half-sum as an option.
