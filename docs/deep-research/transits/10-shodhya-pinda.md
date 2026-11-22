# Shodhya pinda (śodhya-piṇḍa: rāśi-piṇḍa + graha-piṇḍa)

> A single number per planet, built from its reduced BAV. Combined with the bindus in a chosen house and divided by 27
> or 12, it yields a nakshatra or a sign. Saturn's or the Sun's transit over that point times events for the person or
> their relatives. It is used for longevity and for timing events concerning relatives. The method is textual in BPHS
> 69-71 and Phaladeepika 24.

## 1. Sources
- **Phaladeepika 24:1-5** (siva.sh; this chapter gives "AV effects after Horasara"): https://www.siva.sh/phaladeepika/24/1-5
- **BPHS** (Santhanam) ch. 69 (Pinda sadhana), ch. 71 (Longevity) and ch. 72. Multipliers and steps were not verified at verse level in this pass.
- **Engine:** `horoscope/chart/ashtakavarga.py:125-160`; exported by `natal_export.py:222-246`.

## 2. When it applies
- Natal: longevity estimates.
- Timing: danger or events for the father (Sun), the mother (Moon), siblings (Mars), and so on, triggered by Saturn's transit.

## 3. Inputs required
- The BAV after both shodhanas.
- The natal sign of each planet.

## 4. Calculation / rule
1. **Rasi pinda** = the sum over the 12 signs of (reduced bindus in the sign × the sign's multiplier).

   [TEXT] Rasi multipliers, BPHS 69:2-3 (enjoylearningsanskrit edition, https://enjoylearningsanskrit.com/scriptures/parashara/chapter-69):
   - Taurus and Leo ×10; Gemini and Scorpio ×8 (vasu); Aries and Libra ×7.
   - Capricorn and Virgo ×5: "mṛga-kanye ca pañcabhiḥ".
   - The remaining signs take their own number (sva-saṃkhyayā): Cancer 4, Sagittarius 9, Aquarius 11, Pisces 12.

   | Sign | Ar | Ta | Ge | Cn | Le | Vi | Li | Sc | Sg | Cp | Aq | Pi |
   |---|---|---|---|---|---|---|---|---|---|---|---|---|
   | Multiplier | 7 | 10 | 8 | 4 | 10 | 5 | 7 | 8 | 9 | 5 | 11 | 12 |

2. **Graha pinda** = the sum over the planets of (reduced bindus in the sign that planet occupies × the planet's multiplier).

   [TEXT] Graha multipliers, BPHS 69:4: Jupiter 10, Mars 8, Venus 7 (naga), Mercury 5 (sāyaka), the rest 5.

   | Planet | Sun | Moon | Mars | Mercury | Jupiter | Venus | Saturn |
   |---|---|---|---|---|---|---|---|
   | Multiplier | 5 | 5 | 8 | 5 | 10 | 7 | 5 |

3. **Shodhya pinda** = rasi pinda + graha pinda.
4. **[TEXT] PD 24:1-3, father:**
   1. Take the bindus in the 9th from the Sun, in the Sun's BAV.
   2. Multiply by the Sun's shodhya pinda.
   3. Divide by 27. The remainder, counted from Ashvini, gives a nakshatra.
   4. Saturn transiting that nakshatra, or one in trine to it, brings harm to the father.
5. **[TEXT] PD 24:4:** the event falls in the dasha of the 4th lord, or of the lord of the navamsa occupied by the 4th lord.
6. **[TEXT] PD 24:5:**
   1. Take the Sun's shodhya pinda × the bindus in the 8th from the Sun.
   2. Divide by 12. The remainder gives a sign.
   3. The Sun's transit of that sign gives the month.
7. **[COMM]** The same pattern applies to each karaka and its house: the Moon for the mother (4th), Mars for siblings (3rd), Venus for the spouse (7th), Jupiter for children (5th), Saturn for longevity (8th).

## 5. Interpretation rules
- **[TEXT]** PD 24:1-5 as above. Saturn timing is the year-level trigger and Sun timing the month-level trigger, both under the dasha (24:4).
- **[TEXT] Longevity:** BPHS 71 gives pinda-based longevity in years, unverified here. It is not for product use; see the pitfalls in §8.

## 6. Variants and disputes
- **Virgo multiplier: the engine disagrees with the text.**
  - The engine uses **6**: `rasimana_multipliers = [7,10,8,4,10,6,7,8,9,5,11,12]` in `ashtakavarga.py:126`.
  - BPHS 69:3 says **5**: "mṛga-kanye ca pañcabhiḥ", Capricorn and Virgo by five.
  - This changes every rasi pinda where the reduced Virgo bindus are non-zero, and so every pinda-derived transit point.
  - Needs a TODO. Check whether the engine follows a different published table (its `pvr_tests.py` may hold an example
    chart) before changing it.
- **Graha pinda:** some editions count only the reference planets' signs, others all the planets. The engine uses the occupied signs of the seven planets.

## 7. Worked micro-example
1. The Sun's shodhya pinda is 160, and the Sun's BAV has 4 bindus in the 9th from the Sun.
2. 640 / 27 leaves remainder 19, which is Mula (counting Ashvini = 1).
3. Saturn's transit through Mula, or through its trine stars Ashvini and Magha, flags the father's health, if the dasha agrees.

## 8. Design notes for AI Astra
- **Engine addition:** for each karaka, the derived nakshatra and sign, and their trines. Output as transit "sensitive points" in the overlay, with dates when Saturn or the Sun transits them.
- **Pitfall:** death and longevity timing must never be shown to users. Use the method only internally, as a caution weight for health and family boards, phrased gently, or drop it entirely.

## 9. Open questions
- Virgo multiplier: BPHS 69:3 gives 5 and the engine gives 6. Decide whether to fix the engine, after checking the PVR
  example chart.
- Confirm in the text whether the remainder 0 maps to Revati (27).
