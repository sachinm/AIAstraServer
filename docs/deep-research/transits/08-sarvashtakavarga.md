# Sarvashtakavarga (sarvāṣṭakavarga)

> The sign-by-sign sum of the seven BAVs, 337 points in all. It scores how supportive each sign is for any planet that
> transits it, and how strong each house is natally. The 28-point threshold is textual: Phaladeepika 23:20.

## 1. Sources
- **Phaladeepika 23:20** (siva.sh): https://www.siva.sh/phaladeepika/23/16-20
- **BPHS ch. 66 and ch. 70** (Santhanam) on SAV house strength. Not verified at verse level in this pass.
- **[MODERN]** C.S. Patel, *Ashtakavarga*, and K.N. Rao. Not opened in this pass.

## 2. When it applies
- Transits of every planet, including the nodes, which have no BAV.
- Natal house strength.

## 3. Inputs required
The seven BAV tables.

## 4. Calculation / rule
1. SAV(sign) = the sum over the seven planets of BAV(planet, sign).
2. The total over all twelve signs is always 337.
3. **[TEXT] PD 23:20:**
   - more than 28 in a sign: planets transiting it give good results;
   - fewer than 28: danger or sorrow, in proportion to the shortfall;
   - exactly 28: not stated.
4. **Inference:** 337 / 12 ≈ 28.1, so 28 is simply the average. "Above average" means good.

## 5. Interpretation rules
- **[TEXT] PD 23:20:** the threshold, as in §4.
- **[COMM]** The 11th house should hold more than the 10th, the 12th fewer than the 11th, and the Lagna more than the 12th: gains exceed effort, and expense stays below income. Attributed to BPHS 70; verse not verified.
- **[MODERN] C.S. Patel and K.N. Rao:**
  - 30 or more is strong;
  - 25 or fewer is weak;
  - a slow planet transiting a strong sign with good BAV and kakshya gives clear results.
  
  These bands are modern refinements of PD's 28.
- **[MODERN]** The sum over a trine of houses, such as 1-5-9 or 2-6-10, is used for the dharma, artha, kama and moksha balance.

## 6. Variants and disputes
- **Shodhana:** some schools reduce SAV after trikona and ekadhipatya shodhana before reading houses. PD 23:20 uses the unreduced SAV for transits.
- **Lagna's points:** whether to include the Lagna's points (the "8th BAV") changes the totals. PD does not include them.

## 7. Worked micro-example
1. Aquarius has a SAV of 33.
2. Saturn's Sade Sati peak falls in Aquarius for an Aquarius-Moon native.
3. The strong SAV softens the peak.

## 8. Design notes for AI Astra
- **Engine:** `sav_by_sign`, and the per-day `sav` for each transiting body, already exist in `run_transit_ashtakavarga`.
- **Engine addition:** a `sav_band` label, with the thresholds set in one place: the text's 28 by default, the modern 25/30 bands optional.
- **Board:** every slow-planet tile. It is the only AV score for Rahu and Ketu.
- **Weight:** medium. BAV plus kakshya is sharper for any single planet.

## 9. Open questions
- Verse-level BPHS rules for SAV house comparisons (11th > 10th, and so on).
- Should the product show 28 as the line, or the modern 25/30 bands? This is a product decision.
