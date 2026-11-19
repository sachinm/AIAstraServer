# Rasi drishti (rāśi-dṛṣṭi, sign aspects)

> In the Jaimini and Parashari sign-aspect scheme, whole signs aspect whole signs: each movable sign aspects the three fixed signs except the one next to it, each fixed sign aspects the three movable signs except the one next to it, and each dual sign aspects the other three dual signs. A planet aspects whatever its sign aspects. Rasi drishti is the default aspect for all Jaimini work (karakamsha, arudha, raja yogas, rasi dashas). It is a fixed geometric rule with no textual dispute about the pattern itself, only about how it combines with planetary aspects.

## 1. Sources

- **JUS-R** 1.1.2-4, romanised in the OCR as "Abhipasyanti rikshani" (signs aspect each other, in front), "Parsvabhe cha" (translated by Rao as "excepting the next signs"), "Tannishthascha tadvat" (planets in them aspect likewise). Rao's note gives the pattern sign by sign (e.g. Cancer aspects Scorpio, Aquarius, Taurus but not Leo) [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row).
- **JUS-A** opening of 1.1 (unnumbered in OCR): "divisions aspect the divisions in front; so also the divisions at the two sides; the planets occupying the divisions aspect similarly" [archive.org](https://archive.org/details/jaimini-kva-a-4-size).
- **BPHS-ELS** ch. 8 vv. 2-5 (via summary): movable and fixed aspect each other except the adjacent; dual signs aspect duals; planets in them aspect likewise [chapter 8](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-8).
- **PVR** §10.1-10.3, Figure 2 [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).

## 2. When it applies

All Jaimini techniques; Parashari readers use it alongside graha drishti. Life areas: all (it is a connection rule, not a topic).

## 3. Inputs required

Sign of each planet and special point (lagna, AL, UL, HL, GL, karakamsha etc.).

## 4. Calculation

Aspect table (symmetrical: if X aspects Y then Y aspects X):

| Sign | Aspects |
|---|---|
| Aries (movable) | Leo, Scorpio, Aquarius |
| Taurus (fixed) | Cancer, Libra, Capricorn |
| Gemini (dual) | Virgo, Sagittarius, Pisces |
| Cancer | Scorpio, Aquarius, Taurus |
| Leo | Libra, Capricorn, Aries |
| Virgo | Sagittarius, Pisces, Gemini |
| Libra | Aquarius, Taurus, Leo |
| Scorpio | Capricorn, Aries, Cancer |
| Sagittarius | Pisces, Gemini, Virgo |
| Capricorn | Taurus, Leo, Scorpio |
| Aquarius | Aries, Cancer, Libra |
| Pisces | Gemini, Virgo, Sagittarius |

Rule: movable → fixed except the next sign; fixed → movable except the previous sign; dual → other duals [TEXT JUS 1.1.2-4; BPHS-ELS 8.2-5; MODERN PVR §10.3].

## 5. Interpretation rules

- A planet aspects the signs its sign aspects, and the houses and planets in them [TEXT JUS 1.1.4 (Rao); MODERN PVR §10.3].
- Rasi drishti is "knowledge/desire" based and works alongside graha drishti; Rao insists predictions combine both [COMM Rao note on 1.1.4]. PVR ranks influence: rasi drishti small, graha drishti more concrete, argala decisive [MODERN PVR §10.5].
- Jaimini yogas that say "aspected by" (e.g. same planet aspecting lagna, HL and GL; benefic aspect on UL) mean rasi drishti unless stated otherwise [MODERN SJC practice; PVR §11.7.3].

## 6. Variants and disputes

- **Reading of 1.1.3 "pārśvabhe ca".** Rao renders it "excepting the next (adjacent) signs" [COMM JUS-R]; Abhyankar renders it "so also they aspect the divisions at the two sides" [COMM JUS-A], i.e. the signs flanking the opposite sign. Both readings yield the same final table (movable/fixed signs aspect the three non-adjacent signs of the other quality; duals aspect duals), so the dispute is grammatical, not practical.
- Whether Jaimini "aspect" ever means graha drishti in a given sutra is a commentator call, decided case by case.
- Strength or degree-based weighting of rasi drishti: no text read gives one; it is all-or-nothing.

## 7. Worked micro-example

Planet in Libra aspects houses and planets in Aquarius, Taurus and Leo [MODERN PVR §10.3].

## 8. Design notes for AI Astra

- **Engine status:** `house.py` has `raasi_drishti_from_chart` and helpers (`aspected_houses_of_the_planet`, `aspected_raasis_of_the_raasi`). `natal_export.py::drishti_tables` exports both `graha_drishti` and `rasi_drishti` for a chart (from `house.raasi_drishti_from_chart`).
- **Engine addition:** rasi aspects on special points are not in that table: `rasi_drishti: {by_planet: [...signs, houses, planets], by_sign: [...], on_points: {AL, UL, HL, GL, KL: [aspecting planets]}}` for D1 and D9.
- **Boards:** every Jaimini-based card needs it; especially Love (aspects on UL and its 2nd), Work (aspects on AL/10th from AL, KL), Lucky (on HL, SL).
- **Pitfall:** readers must not mix graha and rasi aspects silently; label each aspect with its type.

## 9. Open questions

- None on the pattern. Usage in specific sutras (rasi vs graha) remains commentator-dependent.
