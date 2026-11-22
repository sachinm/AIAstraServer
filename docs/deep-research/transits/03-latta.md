# Latta, the planetary kicks (lattā)

> Each planet "kicks" the nakshatra a fixed number of stars ahead of or behind its own. If that star is the person's
> janma nakshatra, or the star chosen for an event, it brings trouble. Latta is textual (Phaladeepika 26:42-45). It is
> used mainly in muhurta, especially for marriage, and for daily checks.

## 1. Sources
- **Phaladeepika 26:42-45** (siva.sh numbering): https://www.siva.sh/phaladeepika/26/41-45
- **Marriage-muhurta use** (secondary): https://astrobix.com/articles/Usefulness-of-Muhurat-in-daily-Life-and-Latta-Dosha.aspx
- **Muhurta Chintamani, vivaha-prakarana:** not opened in this pass.

## 2. When it applies
- Daily transits of the Moon and the planets over the janma star.
- Muhurta selection.

## 3. Inputs required
- The nakshatra of each transiting planet.
- The person's janma nakshatra, the Moon's star at birth.

## 4. Calculation / rule
[TEXT] PD 26:42-43. Counts are inclusive, starting from the planet's own star.

| Planet | Star kicked | Direction |
|---|---|---|
| Sun | 12th | forward (puro-lattā) |
| Mars | 3rd | forward |
| Jupiter | 6th | forward |
| Saturn | 8th | forward |
| Venus | 5th | backward (pṛṣṭha-lattā) |
| Mercury | 7th | backward |
| Rahu | 9th | backward |
| Moon | 22nd | backward |
| Ketu | not given in PD 26:42-43 | — |

With stars numbered 1-27, wrapping past 27 back to 1:
- **Forward:** kicked star = planet's star + n − 1.
- **Backward:** kicked star = planet's star − n + 1.

## 5. Interpretation rules
- **[TEXT] PD 26:44:** if the latta falls on the janma star, sickness and distress follow.
- **[TEXT] PD 26:45:** the effect depends on which planet kicks.

  | Kicking planet | Effect |
  |---|---|
  | Sun | ruin of undertakings |
  | Rahu or Ketu | misery |
  | Jupiter | death, loss of relatives, fear |
- **[COMM] Marriage muhurta:** the wedding star must be free of latta. Latta from a malefic weighs more than latta from a benefic.

## 6. Variants and disputes
- **Ketu.** PD 26:42-43 does not give Ketu's count. PD 26:45 still names an effect for Ketu's latta, so some count is implied.
  - The engine's constant (`const.py:1003`) gives Ketu 9 backward, like Rahu.
- **27 vs 28 stars.** The engine's latta function in `charts.py` counts with Abhijit, so 28 stars. PD 26 counts in 27.
  - The two counts give different kicked stars near Uttarashadha and Shravana. One rule is needed.

## 7. Worked micro-example
1. Saturn is in Shatabhisha, star 24.
2. Its 8th star forward: 24 + 8 − 1 = 31, which wraps to 4, Rohini.
3. A person born in Rohini is under Saturn's latta.

## 8. Design notes for AI Astra
- **Shared sky:** `latta_star` for each planet, each day. This is an engine export to add; the helper already exists in `charts.py` but is not exported.
- **Overlay:** `latta_on_janma: [planets]`.
- **Board:** Lucky and Today.
- **Weight:** low. Never use it as the headline of a life reading.

## 9. Open questions
- Ketu's count, and 27 versus 28 stars: confirm both in Muhurta Chintamani and choose one rule.
