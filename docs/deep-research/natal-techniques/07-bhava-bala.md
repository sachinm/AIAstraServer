# Bhava Bala — strength of houses (bhāvabala)

> Bhava Bala gives each of the 12 houses a numerical strength. It is built from the strength of the house lord, the house's directional strength by sign type, and the aspects the house cusp receives. It answers "which areas of life have more capacity to flourish". BPHS defines it alongside Shadbala, and Raman popularised the working. It is used mainly for ranking houses against each other, less often as an absolute verdict.

## 1. Sources
- **BPHS ch. 27** (Santhanam numbering; BPHS-ET archive.org e-text): https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
  - 27.26-29 (V): the sign-type (dig) component is converted to degrees and divided by 3; add a quarter of benefic aspect, subtract a quarter of malefic aspect; add the lord's strength.
  - 27.30-31 (V): +1 rupa when Jupiter or Mercury occupies the bhava; −1 rupa for Saturn, Mars or Sun; 15 virupas by time of birth (day or night signs).
- [MODERN] B.V. Raman, *Graha and Bhava Balas*: the full working and the commonly quoted strong-house points.

## 2. When it applies
- D1 bhavas, ideally using bhava madhya (cusp-based), not whole signs.
- Used for every life area: the house governing the subject is ranked against the other 11.

## 3. Inputs required
- Bhava madhya longitudes (Sripati or equal-house system, stated).
- Shadbala total of each house lord.
- Sign of each cusp, classified as:
  - nara (human): Gemini, Virgo, Libra, Aquarius, first half of Sagittarius;
  - jalachara (water): Cancer, Pisces, second half of Capricorn;
  - keeta: Scorpio;
  - chatushpada (quadruped): Aries, Taurus, Leo, second half of Sagittarius, first half of Capricorn.
- Sphuta drishti of every planet on each cusp.
- Occupants.
- Day or night birth.

## 4. Calculation / rule
1. **Bhavadhipati bala**: the Shadbala total (virupas) of the house lord.
2. **Bhava dig bala**: each sign class is strongest in one house:
   - nara in the 1st;
   - jalachara in the 4th;
   - keeta in the 7th;
   - chatushpada in the 10th.

   Strength falls with distance from that house. Raman's working gives 60 at the strong house and loses 10 per house away, to 0 at the opposite house (R). BPHS states a division by 3 of the arc (27.26-29, V).
3. **Bhava drik bala**: ¼ of (benefic sphuta drishti − malefic sphuta drishti) on the cusp. Jupiter's and Mercury's aspects are counted in full in Raman's working (R).
4. **Occupation adjustments** (27.30-31, V): +60 virupas if Jupiter or Mercury is in the bhava; −60 if Saturn, Mars or the Sun is.
5. **Day/night adjustment** (27.30-31, V): +15 virupas to bhavas in day signs for a day birth, or in night signs for a night birth (Raman's sign classes, R).
6. Total in virupas, then rupas. Rank 1..12.

Thresholds: BPHS gives no fixed minimum for bhavas (none found, U). [MODERN] Raman: above about 7.5 rupas is strong, below 5 is weak, used as rough bands.

## 5. Interpretation rules
- [TEXT] A house with a strong lord and benefic aspect prospers. Malefic aspect reduces it (BPHS 27.26-29, V; and the bhava-judgement chapter 11, R).
- [MODERN] Raman: read the top three and bottom three houses as the life's strong and weak arenas.
- [MODERN] SJC and PVR use bhava bala little. They prefer the lord's placement, argala and arudha.

## 6. Variants and disputes
- **House system**:
  - Sripati, equal from lagna, or whole sign. Results differ when a cusp falls near a sign boundary.
  - The engine's `bhava_bala` uses its bhava chart. Record which system.
- **Occupant adjustment**: some workings apply ±60 only to planets within the bhava's span (cusp-based); others apply it by sign.
- **Sign class of split signs** (Sagittarius, Capricorn) follows the half of the sign the cusp falls in.

## 7. Worked micro-example
- The 10th cusp is in Aries (chatushpada, strong in the 10th): dig bala 60.
- The lord Mars totals 330 virupas.
- Net drik on the cusp is +12 and Jupiter occupies it (+60). The cusp is not in a day sign for this birth, so there is no time bonus.
- Total ≈ 462 virupas ≈ 7.7 rupas: strong career house.

## 8. Design notes for AI Astra
- **Engine already has**: `strength.bhava_bala()` with `_bhava_adhipathi_bala`, `_bhava_dig_bala` and `_bhava_drik_bala` (`AIAstra_Radha/src/jhora/horoscope/chart/strength.py`). The repo doc `general.promise.md` says `strength.bhava` is not yet served to the reader.
- **Must output per house**:
  - the components;
  - the total in rupas;
  - the rank 1..12;
  - the house system used;
  - a band (strong/average/weak) with the band source labelled [MODERN].
- **Board use**:
  - Self: the top and bottom houses.
  - Love: the 7th rank.
  - Work: the 10th, 6th and 11th ranks.

  It confirms or tempers the promise from the lord placement (file 01). Weight it below the lord's dignity and placement.
- **Pitfalls**: do not treat a weak 8th or 12th bhava bala as good news without reading the lord's role.

## 9. Open questions
- Raman's day/night sign list and the exact dig bala decrement need a printed-source check.
- Should the product use Sripati bhavas for bala but whole signs for occupancy? This needs a single documented rule.
