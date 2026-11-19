# Ashtakavarga predictions: houses, longevity and event timing (aṣṭakavarga-phala)

> This file covers how the classical texts turn BAV and SAV numbers into predictions:
> - a transit score by bindus;
> - house strength;
> - event timing through pinda-derived points (see `10-shodhya-pinda.md`);
> - longevity.
>
> The transit score by bindus is the most practical and the most textual, from Phaladeepika 23 and 26. Longevity by
> pinda is textual (BPHS) but is not for product use.

## 1. Sources
- **Phaladeepika 23:10, 23:16-20, 24:1-5, 26:41** (siva.sh):
  - https://www.siva.sh/phaladeepika/23/6-10
  - https://www.siva.sh/phaladeepika/23/16-20
  - https://www.siva.sh/phaladeepika/24/1-5
  - https://www.siva.sh/phaladeepika/26/41-45
- **BPHS** (Santhanam) ch. 70 (effects), ch. 71 (longevity), ch. 72. Not verified at verse level here.

## 2. When it applies
- Any transit verdict for one of the seven planets.
- Natal house strength.
- Relative-related timing.

## 3. Inputs required
- BAV, SAV and the prastara.
- The reduced BAV and the shodhya pindas.
- The transits.

## 4. Calculation / rule
1. **Transit score.** Take BAV(P, sign) for the sign P transits, and grade it.
   - [TEXT] PD 26:41: many bindus give good results, even in the 6th, 8th or 12th.
   - [COMM] Working bands: 0-3 weak or harmful, 4 mixed, 5-8 increasingly good.
   - BPHS ch. 70 is said to give a result for each count from 0 to 8. That chapter was not read in this pass, so no
     per-count table is given here. See §9.

2. **Sign support.** SAV(sign) against 28 ([TEXT] PD 23:20).
3. **Timing inside the sign.** The kakshya with a bindu ([TEXT] PD 23:16).
4. **Natal dignity filter.** [TEXT] PD 23:10: a planet that is dignified natally sustains its AV good; a weak one does not.
5. **House strength.** SAV of each house from the Lagna. [COMM] The 11th should be more than the 10th, the 12th less than the 11th, and the Lagna more than the 12th.
6. **Relative and event points.** Saturn and Sun transits over the pinda-derived nakshatra or sign, under the dasha ([TEXT] PD 24:1-5).
7. **[COMM] BAV of the house's karaka.** The bindus in a house in the karaka's BAV show that house's matter: Jupiter's bindus in the 5th for children, Venus's in the 7th for the spouse, the Sun's in the 9th for the father, the Sun's in the 10th for career.

## 5. Interpretation rules
- **[TEXT]** Steps 1-4 and 6 above.
- **[COMM]** When gochara (house from the Moon) and AV disagree, AV prevails. This follows from PD 26:41, which explicitly lets AV override the 6th, 8th and 12th.
- **[MODERN] K.N. Rao and C.S. Patel:** Saturn transiting a sign with 4 or more BAV bindus and 28 or more SAV is "productive even when hard". Jupiter transiting a sign with a low BAV gives little, even from a good house.

## 6. Variants and disputes
- **Combining gochara and AV:**
  - PD makes AV override gochara (26:41).
  - Some practitioners require both to agree before calling a transit good.
  - Product choice: show AV as the primary score and gochara as context.
- **Bindu or rekha conventions** differ between BPHS and PD (see `07-bhinnashtakavarga.md`).

## 7. Worked micro-example
1. Saturn enters the 12th from the Moon, the start of Sade Sati, in a sign where Saturn's BAV is 5 and the SAV is 31.
2. PD 26:41 together with 23:20 means the phase is constructive (effort that pays) rather than ruinous.
3. The kakshyas of Mars and Jupiter, if they carry bindus, are the best weeks.

## 8. Design notes for AI Astra
- **Engine:** BAV, SAV and kakshya per day already exist.
- **Engine additions:**
  - a `bav_band` label;
  - a `natal_dignity` flag for the transiting planet (exalted, own sign, friend's sign, enemy's sign, debilitated), already available from natal facts;
  - pinda points.
- **Board:** the transit score of every slow-planet tile in Self, Love and Work.
- **Weight:** AV is the strongest classical transit modifier and should outrank plain gochara.
- **Pitfall:** never surface longevity or death timing.

## 9. Open questions
- Verify the BPHS 70 0-8 scale and the house-comparison rules at verse level, using the Santhanam PDF on archive.org.
