# Kakshya (kakṣyā), the eight orbits within a sign

> Each sign is divided into eight parts of 3°45'. They are allotted in descending orbital order: Saturn, Jupiter, Mars,
> Sun, Venus, Mercury, Moon, Lagna. A planet's transit gives the good result of a bindu only while it moves through the
> kakshya of the contributor who gave that bindu. This turns a sign-long verdict into sub-windows: about 1.5 months
> for Jupiter, 3-4 months for Saturn, and about 3 hours for the Moon. Textual: Phaladeepika 23:16-19.

## 1. Sources
- **Phaladeepika 23:16, 23:18, 23:19** (siva.sh): https://www.siva.sh/phaladeepika/23/16-20
- **Degree table** (secondary): https://www.slideshare.net/slideshow/the-use-of-asthakavarga-as-a-predictive-technique/25369219

## 2. When it applies
Transit timing inside a sign, for each of the seven planets.

## 3. Inputs required
- The transiting planet's longitude within its sign.
- The prastara of that planet's BAV: which reference gave a bindu in that sign.

## 4. Calculation / rule
1. [TEXT] PD 23:16, 23:19. Divide the sign into 8 equal parts:

   | # | Lord | From | To |
   |---|---|---|---|
   | 1 | Saturn | 0°00' | 3°45' |
   | 2 | Jupiter | 3°45' | 7°30' |
   | 3 | Mars | 7°30' | 11°15' |
   | 4 | Sun | 11°15' | 15°00' |
   | 5 | Venus | 15°00' | 18°45' |
   | 6 | Mercury | 18°45' | 22°30' |
   | 7 | Moon | 22°30' | 26°15' |
   | 8 | Lagna | 26°15' | 30°00' |

2. Kakshya index = floor(longitude in the sign / 3.75) + 1, capped at 8.
3. [TEXT] PD 23:16, 23:18. Look up whether the kakshya lord contributed a bindu to this sign in the transiting planet's own BAV, using the prastara (see `12-prastara-ashtakavarga.md`).
   - If yes, the planet gives that bindu's good result now.
   - If no, it gives no good result now (malefic or neutral).

## 5. Interpretation rules
- **[TEXT] PD 23:16:** the result of a bindu fructifies in its contributor's kakshya.
- **[COMM][MODERN] C.S. Patel and K.N. Rao:** a slow planet with a high BAV in the sign gives its peak in the kakshyas that carry a bindu. A low-BAV sign may still give brief relief in a bindu kakshya.
- **Arithmetic (not a text rule):** one kakshya is 1/8 of a sign. Before retrograde motion, Jupiter spends about 45 days in each kakshya and Saturn about 110 days. This gives month-level timing for the slow planets.

## 6. Variants and disputes
- **The boundary at exactly 3°45':** the engine puts it in kakshya 2, consistent with the table.
- **Kakshya-based vedha:** some modern authors apply vedha within kakshyas. That is not in the text.

## 7. Worked micro-example
1. Saturn is at 9° Aquarius: kakshya 3, Mars.
2. In the prastara of Saturn's BAV, Mars gave Aquarius a bindu.
3. So this is a good window, until Saturn reaches 11°15'.

## 8. Design notes for AI Astra
- **Engine:** `kakshya_of` and `kakshya.has_bindu` already exist in `run_transit_ashtakavarga`.
- **Engine addition:** kakshya entry and exit dates for Jupiter and Saturn across the horizon, so the boards can show dated sub-windows.
- **Board:** Self, Love and Work, at month resolution for Jupiter and Saturn.
- **Weight:** a high-resolution modifier inside a transit already judged by sign.
- **Pitfall:** do not use kakshya for Rahu and Ketu (no BAV), and do not use it for the Moon beyond the day view.

## 9. Open questions
- Does any classical text give kakshya results for a planet transiting a sign with 0 BAV? Not seen in PD 23.
