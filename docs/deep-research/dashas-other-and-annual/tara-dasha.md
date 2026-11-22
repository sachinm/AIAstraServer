# Tara Dasha (tārā-daśā)

> Tara dasha keeps the nine Vimshottari lords and their years (6 to 20 years, 120 years in all) but does not order them
> from the Moon's nakshatra. The sequence starts from the strongest planet in a kendra. The nine periods are named after
> the nine taras: janma, sampat, vipat, kṣema, pratyari, sādhaka, vadha, mitra and paramamitra. It is a conditional
> variant of Vimshottari, not a pure nakshatra dasha. Rath's school applies it when all four kendras are occupied.
> Parashara lists it among the systems "not universally accepted". It is rarely used.

## 1. Sources (text, edition, chapter:verse; URLs)

| Rule | Source | Tag |
|---|---|---|
| Named; not universally accepted | BPHS 46.11 (site numbering) — https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 | [TEXT] |
| Some authorities identify Tara dasha with Vimshottari | BPHS 46.207 | [TEXT] |
| The nine taras listed; counted from a strong planet in a kendra (*kendrasthabalino grahāt*) | BPHS 46.208 | [TEXT] |
| The period goes to the planet placed in the kendra (*yasya kendre sthitaḥ kheṭaḥ*) | BPHS 46.209 | [TEXT] |
| Applicable if all four kendras are occupied; Rath ordering; options for dasha balance | AIAstra_Radha `src/jhora/horoscope/dhasa/graha/tara.py` (docstring and TODOs) | engine / [MODERN] |

## 2. When it applies (which charts, which life areas)

- **Condition.** SJC uses it when all four kendras (1, 4, 7 and 10) are occupied ([MODERN], as recorded in the engine
  docstring). BPHS 46.208–209 says only that the count goes from a strong kendra planet.
- **Life areas.** General timing, like Vimshottari.

## 3. Inputs required (exact chart data)

- Planets in kendras from the Lagna, and their strengths.
- Vimshottari years.
- Moon's nakshatra position, if a dasha balance is applied (engine option).

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

1. **Rank the kendra planets.** List the planets in kendras and rank them by strength. The strongest is the first dasha
   lord (janma tārā).
2. **Order of the lords.** It follows the strength of planets in kendras, then panapharas and apoklimas [MODERN reading].
   The engine, by code reading:
   - takes the strongest planet in the four kendras from the Lagna as the first lord;
   - continues in one of two fixed lord orders;
   - applies a Vimshottari-style balance from the Moon's nakshatra;
   - does **not** enforce the "all four kendras occupied" condition.

   The two fixed orders:
   - **Rath:** Venus, Moon, Ketu, Saturn, Jupiter, Mercury, Rahu, Mars, Sun.
   - **"Parasara":** Venus, Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury, Ketu, which is the Vimshottari order.
3. **Periods.** The Vimshottari years: Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17, Ketu 7,
   Venus 20.
4. **Balance at birth.** The engine offers three options (TODO in the engine):
   - none;
   - the Moon's Vimshottari balance;
   - a reverse balance for apasavya nakshatras.
5. **Antardashas.** Same order from the dasha lord, sized proportionally as in Vimshottari.
6. **Year length.** The engine uses the sidereal year.

## 5. Interpretation rules (tagged)

- **Tara names.** Each successive period carries its tara name. Vipat (3rd), pratyari (5th) and vadha (7th) are
  difficult; sampat (2nd), kṣema (4th), sādhaka (6th), mitra (8th) and paramamitra (9th) are supportive. [TEXT] 46.208
  lists the names; the evaluative reading is [COMM] standard tara doctrine.

## 6. Variants and disputes (school by school)

- **Identity.** Some say Tara is Vimshottari itself (46.207), while 46.208–209 says it is reordered by kendra planets.
- **Fixed order vs strength ranking.** The engine's fixed Rath list is not derived from strength ranking. It needs a
  source check against Rath's text.

## 7. Worked micro-example (optional, short)

All four kendras are occupied and Jupiter in the 10th is strongest. Tara dasha then starts with Jupiter (16 years) as
janma tārā. The next strongest kendra planet becomes sampat, and so on.

## 8. Design notes for AI Astra

- **Applicability flag.** The engine should return `applicable: true/false` (all kendras occupied) with the reason, plus
  the order basis.
- **Boards.** Only when applicable: as a second opinion beside Vimshottari on Self, Love and Work.
- **Weight.** Low.
- **Pitfall.** The nakshatra-dasha researcher may also cover this system. Keep one canonical spec and cross-link.

## 9. Open questions

- Rath's source for the fixed order in the engine's `dhasa_adhipathi_dict_sanjay_rath`.
- Whether a balance at birth applies.
