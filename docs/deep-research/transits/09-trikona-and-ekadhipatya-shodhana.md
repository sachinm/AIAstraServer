# Trikona and Ekadhipatya shodhana (trikoṇa-śodhana, ekādhipatya-śodhana)

> Two reductions of each planet's BAV. They are applied before computing the pinda numbers that are used for
> longevity and for event timing by transit (see `10-shodhya-pinda.md`). They are not used for the plain transit score.

## 1. Sources
- **BPHS** (Santhanam) ch. 67, Trikona shodhana, and ch. 68, Ekadhipatya shodhana. Not verified at verse level in this pass; the rules below are the standard reading of these chapters.
- **Phaladeepika 24:3** names the shodhya pinda as "the figure after the two reductions". https://www.siva.sh/phaladeepika/24/1-5
- **Engine:** `horoscope/chart/ashtakavarga.py`, functions `_trikona_sodhana` (line 59) and `_ekadhipatya_sodhana` (line 80).

## 2. When it applies
To the BAV of each of the seven planets, for pinda work only.

## 3. Inputs required
- The BAV of each planet.
- The occupancy of each sign by natal planets.

## 4. Calculation / rule

### Trikona shodhana
[TEXT] BPHS 67, unverified at verse level. Work on the four trines of signs:

| Trine | Signs |
|---|---|
| Fire | Aries, Leo, Sagittarius |
| Earth | Taurus, Virgo, Capricorn |
| Air | Gemini, Libra, Aquarius |
| Water | Cancer, Scorpio, Pisces |

For each trine:
1. If any sign in the trine has 0, make no change.
2. If all three are equal, set all three to 0.
3. Otherwise, subtract the smallest of the three from each.

### Ekadhipatya shodhana
[TEXT] BPHS 68, unverified at verse level.
- Apply it to the pairs of signs with one lord: Mars, Venus, Mercury, Jupiter and Saturn. Skip Cancer and Leo.
- Apply it after trikona shodhana.
- Work through these cases in order:
  1. If either sign is 0, make no change.
  2. If both signs are occupied by natal planets, make no change.
  3. If one sign is occupied and the other is not:
     - the empty sign has fewer points: set it to 0;
     - the empty sign has more points: reduce it to the occupied sign's count.
  4. If neither sign is occupied:
     - equal points: set both to 0;
     - unequal points: set both to the smaller count.

**[COMM]** Commentators differ on edge cases (an occupied sign with fewer points, and the nodes counting as occupants). Check the engine's branches against the text.

## 5. Interpretation rules
- **[TEXT]** The reduced BAV (śodhita aṣṭakavarga) is used only for the pinda arithmetic. It is not used for the transit score.

## 6. Variants and disputes
- Whether Rahu and Ketu count as occupants in ekadhipatya: most say no.
- Some modern authors skip ekadhipatya entirely.

## 7. Worked micro-example
For the fire trine, Aries 4, Leo 2 and Sagittarius 5 reduce to 2, 0 and 3.

## 8. Design notes for AI Astra
- **Engine:** already implemented and exported through `natal_export.py`, which reports the sodhya pindas.
- **Engine addition:** export the post-shodhana BAV too, for audit.
- **User-facing:** none. This is an internal intermediate step.

## 9. Open questions
- Verify each ekadhipatya branch in the engine against the BPHS 68 verses. A harness should test charts where one sign of a pair is occupied.
