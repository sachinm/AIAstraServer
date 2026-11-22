# Vedha and Vama-vedha (vedha, vāma-vedha / viparīta-vedha)

> Vedha means "piercing". A good transit is cancelled when another planet transits the paired obstruction house at the
> same time, counted from the natal Moon. Vama-vedha is the reverse: a bad transit is cancelled when a planet occupies
> the paired good house. Vedha is textual (Phaladeepika 26:3-8) and widely used. Vama-vedha is traditional, but no
> primary verse for it was located in this pass.

## 1. Sources
- **Vedha:** Phaladeepika 26:3-8, siva.sh numbering. https://www.siva.sh/phaladeepika/26/1-5 and https://www.siva.sh/phaladeepika/26/6-10
- **Exceptions (Sun-Saturn, Moon-Mercury):** Jataka Sara Deepa, via a secondary summary. https://theeyeofvedas.blogspot.com/2025/11/chapter-44-gochara-phala-adhyaya.html
- **Vama / vipreet vedha:** secondary sources only, low weight. Example: https://blog.indianastrologysoftware.com/?p=210

## 2. When it applies
Every gochara verdict counted from the Moon. See `01-gochara-from-moon.md`.

## 3. Inputs required
- The natal Moon sign.
- The signs of all transiting planets at the same instant.

## 4. Calculation / rule

### Vedha table
[TEXT] PD 26:3-8. Each pair reads good house → vedha house, counted from the natal Moon.

| Planet | Pairs (good → vedha) | Exception |
|---|---|---|
| Sun | 3→9, 6→12, 10→4, 11→5 | Saturn does not obstruct the Sun |
| Moon | 1→5, 3→9, 6→12, 7→2, 10→4, 11→8 | Mercury does not obstruct the Moon |
| Mars | 3→12, 6→9, 11→5 | — |
| Mercury | 2→5, 4→3, 6→9, 8→1, 10→8, 11→12 | The Moon does not obstruct Mercury |
| Jupiter | 2→12, 5→4, 7→3, 9→10, 11→8 | The vedha house must be empty of all planets |
| Venus | 1→8, 2→7, 3→1, 4→10, 5→9, 8→5, 9→11, 11→3, 12→6 | — |
| Saturn | 3→12, 6→9, 11→5 | The Sun does not obstruct Saturn |
| Rahu/Ketu | as Saturn: 3→12, 6→9, 11→5 [COMM] | — |

### Steps
1. Take planet P in good house H, counted from the Moon.
2. Find H's vedha house V in the table.
3. If any planet occupies V, P's good result is obstructed. The one exception is P's exempt partner in the table.

### Vama-vedha
[COMM]; no primary verse located.
- Read each pair backwards.
- **Condition:** P is in a bad house that the table lists as one of P's vedha houses, and another planet occupies the paired good house.
- **Result:** the bad result is obstructed.
- **Example:** the Sun in the 9th is relieved by a planet in the 3rd.
- The same exceptions apply as for vedha.

## 5. Interpretation rules
- **[TEXT]** An obstructed good transit gives no good. PD 26:3-8 makes the good result conditional on the vedha house being unoccupied.
- **[COMM]** Vedha lasts only while both planets hold their positions. Vedha from a fast planet on a slow-planet transit is an interruption of a few days, not a cancellation of the whole transit.
- **[COMM]** Vama-vedha softens a bad transit. It does not turn it into a good one.

## 6. Variants and disputes
- Some later authors apply vedha from the Lagna as well. The texts read here count only from the Moon.
- The verses read do not say whether the nodes cause vedha or suffer it.
- Sarvatobhadra vedha, piercing within a nakshatra grid, is a different technique. See `06-nakshatra-transit-and-sarvatobhadra.md`.

## 7. Worked micro-example
1. Moon in Aries.
2. Jupiter in Leo: the 5th from the Moon, a good house.
3. Mars in Cancer: the 4th from the Moon, Jupiter's vedha house for the 5th.
4. Jupiter's good result is withheld until Mars leaves Cancer.

## 8. Design notes for AI Astra
- **Engine addition,** per transiting planet per day, computed from the shared sky and the natal Moon sign:
  - `vedha: {obstructed: bool, by: [planets], pair: [H, V]}`
  - `vama_vedha: {relieved: bool, by: [...]}`
- **Status in the engine:** `general.transit.md` describes Gochara Vedha as ready. A grep of the engine's export modules (`src/jhora`) on 2026-11-18 found no vedha function. Treat it as missing until shown.
- **Use:** check Jupiter and Saturn windows against vedha so the reading does not overclaim.

## 9. Open questions
- Locate vama-vedha in Muhurta Chintamani or Jataka Parijata, and confirm its exceptions.
- Do the nodes obstruct? Decide one rule and label it.
