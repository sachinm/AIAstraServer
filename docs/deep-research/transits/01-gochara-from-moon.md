# Gochara from the Moon (gocara-phala from candra-lagna)

> The base transit rule: each planet's transit gives good or bad results according to the house it occupies counted
> from the natal Moon sign (janma rāśi). Every classical gochara chapter uses it, and it is the most widely used transit
> rule in India. It is the starting point for the vedha, ashtakavarga and murti refinements. It is reliable as a first
> filter and weak alone.

## 1. Sources
- **Phaladeepika** (siva.sh numbering):
  - 26:1-5: good houses for the Sun, Moon, Mars and Saturn. https://www.siva.sh/phaladeepika/26/1-5
  - 26:6-8: good houses for Mercury, Jupiter and Venus. https://www.siva.sh/phaladeepika/26/6-10
  - 26:9 onward: house-by-house effects for each planet.
- **Brihat Samhita** ch. 104, Graha-gochara (Chidambaram Iyer, 1884). Effects are counted from the birth-Moon sign. https://www.wisdomlib.org/hinduism/book/brihat-samhita/d/doc229368.html (read from a search snippet only; the page was not opened)
- **Jataka Sara Deepa** gochara chapter, via a secondary summary: https://theeyeofvedas.blogspot.com/2025/11/chapter-44-gochara-phala-adhyaya.html
- **Muhurta Chintamani**, gochara-prakarana: not opened in this pass.

## 2. When it applies
Any natal chart and all life areas. The time scale runs from days (fast planets) to years (slow planets).

## 3. Inputs required
- The natal Moon sign.
- The sign of each transiting planet at the instant.

## 4. Calculation / rule
House = (transit sign − natal Moon sign) mod 12 + 1.

| Planet | Good houses from the Moon, [TEXT] PD 26:2-8 | Bad houses |
|---|---|---|
| Sun | 3, 6, 10, 11 | 1, 2, 4, 5, 7, 8, 9, 12 |
| Moon | 1, 3, 6, 7, 10, 11 | 2, 4, 5, 8, 9, 12 |
| Mars | 3, 6, 11 | all others |
| Mercury | 2, 4, 6, 8, 10, 11 | 1, 3, 5, 7, 9, 12 |
| Jupiter | 2, 5, 7, 9, 11 | 1, 3, 4, 6, 8, 10, 12 |
| Venus | 1, 2, 3, 4, 5, 8, 9, 11, 12 | 6, 7, 10 |
| Saturn | 3, 6, 11 | all others |
| Rahu, Ketu | see §6 (3, 6, 11 in most practice) | all others |

- **[TEXT] PD 26:2:** all planets are good in the 11th (upānta).
- **Vedha:** each good house holds only if it is not obstructed. See `02-vedha-and-vama-vedha.md`.

## 5. Interpretation rules
**[TEXT] PD 26:9-10, effects of the Sun by house from the Moon:**

| House | Effect |
|---|---|
| 1st | fatigue, loss of wealth, illness, travel |
| 2nd | loss of wealth, deception |
| 3rd | new position, gain, health, victory |
| 4th | illness, obstacles to pleasure |
| 5th | agitation, loss, illness |
| 6th | victory over disease and enemies |
| 7th | tiring travel, abdominal trouble, humiliation |
| 8th | fear, illness, quarrels, displeasure of rulers |

Later verses give the other planets in the same pattern. Not all of them were re-read in this pass.

**Other rules:**
- **[TEXT] PD 26:30:** a bad transit aspected by a benefic is neutralised, and so is a good transit aspected by a malefic.
- **[TEXT] PD 26:41:** bindus override houses. See `13-ashtakavarga-predictions.md`.
- **When within the sign a planet gives its result.** A traditional rule assigns each planet a part of the sign (the
  beginning, middle, end, or throughout). Versions differ, and the verse was not read in this pass, so no table is given
  here. See §9.

## 6. Variants and disputes
- **Rahu and Ketu.**
  - PD 26:2 includes the nodes (bhoginau) in its list. The online gloss reads them with the Sun, which would give 3, 6, 10, 11.
  - The Jataka Sara Deepa summary and most practitioners use 3, 6, 11, as for Saturn.
  - The engine should expose the house and make the verdict rule switchable.
- **Venus.**
  - The siva.sh English of 26:8 says Venus gives "bad effects" in the listed houses when their vedha houses are occupied.
  - 26:2 lists those same houses as good.
  - The reading consistent with both verses: Venus is good there unless the house is pierced.
- **[MODERN] Reference point.** Many modern astrologers also read transits from the Lagna. See `18-lagna-vs-moon.md`.

## 7. Worked micro-example
Natal Moon in Cancer; Saturn transits Virgo, the 3rd from the Moon. That transit is good, provided no planet other than
the Sun transits Gemini. Gemini is the 12th from the Moon and is the vedha house for Saturn's 3rd.

## 8. Design notes for AI Astra
- **Engine output,** per transiting planet per day:
  - `house_from_moon`, which already exists;
  - `gochara_good`, a boolean per the PD 26 table (engine addition);
  - a flag naming which node rule was applied.
- **Boards:** Today (Moon, Sun, Mercury, Venus, Mars) and the slow-planet tiles of Self, Love and Work.
- **Weight:** low alone. Combine with vedha and BAV before showing any verdict.
- **Pitfall:** never compute the house in Node. Read `house_from_moon` from the overlay.

## 9. Open questions
- Confirm the node rule in the Sastri 1950 print of PD 26:2 and in Muhurta Chintamani.
- Re-read PD 26:11-40 for the other planets' house-by-house effects, to fill the interpretation library.
- Find the verse that says in which part of a sign each planet gives its result. It is probably in PD 26:11-25 or in
  Muhurta Chintamani.
- Brihat Samhita 104 is cited from a search snippet only. Its page was not opened.
