# Tri-pataki chakra (tri-patākī cakra, the "three-flag" diagram)

> A Tajika diagram for the year. The natal Moon and the natal planets are moved forward by fixed rules for the
> elapsed years and laid out on a three-line "flag" grid, with the varṣa lagna at the east. Malefics falling on the
> Moon warn of trouble that year. Benefics there promise gain. It is a minor, quick-check technique, rarely used
> outside Tajika specialists, and its rules are known only from a few verses.

## 1. Sources

| Text | Numbering | Content |
|---|---|---|
| *Tājikamuktāvali-ṭippaṇī* 1.17–20 | as quoted in *Hāyanaratna* (Gansten 2020) ch. 1 §7 | Construction and reading |
| Nīlakaṇṭha, Varṣatantra | Tripatākī is commonly cited from the Varṣatantra in modern books [MODERN]. **Not verified in this pass** | — |
| Wikipedia, *Tājika* | secondary | "a chart relating birth-chart planets to the annual chart's ascendant" |

URL: <https://www.wisdomlib.org/hinduism/book/hayanaratna-the-jewel-of-annual-astrology/d/doc1500888.html>.

## 2. When it applies

Annual chart. A general health and safety and good-or-bad-year screen.

## 3. Inputs required

Natal sign of the Moon and of each planet, years elapsed, and the varṣa lagna.

## 4. Calculation [TEXT] (Muktāvalī ṭ. 1.17–20)

1. Draw three horizontal and three vertical lines (the flags) and write the twelve signs on their ends. Put the
   varṣa lagna at the central eastern line.
2. Moon: (elapsed years + 1) mod 9 = r. Count r signs inclusively from the natal Moon's sign and place the Moon there.
3. Other planets: (elapsed years + 1) mod 4 = r. Count r signs from each planet's natal sign.
4. Look at which planets fall on the Moon's line or sign (the grid links signs along the flags).

## 5. Interpretation rules [TEXT]

Rāhu with the Moon is evil. The Sun brings affliction. Saturn brings illness. Mars brings bodily pain. Benefics with
the Moon bring victory, happiness and gain. The net result follows the relative strength of the benefics and malefics
(Muktāvalī ṭ. 1.17–20).
[MODERN] Some authors read the "vedha" (crossing) of the flag lines, not only conjunction. That is not in the passage quoted.

## 6. Variants and disputes

How the flags join signs, and whether mod-9 or mod-4 counting starts from 0 or 1, varies in modern presentations.
Rāhu's own motion rule is not given in the passage quoted.

## 7. Worked micro-example

Elapsed years 34, so 35 mod 9 = 8. Natal Moon in Aries: count 8 inclusively and the Moon goes to Scorpio. If the
moved Saturn also lands in Scorpio, that year warns of illness.

## 8. Design notes for AI Astra

- Engine: not served. pyjhora's `ui/chakra.py` draws chakras for its desktop UI. Check whether a tri-pataki function exists.
- Engine addition (low priority): `annual.tripataki{moon_sign, planets[{planet, sign}], on_moon[]}`.
- Weight: low. It could feed only a "take care this year" health or safety caution in the annual reader. Do not use it on boards.

## 9. Open questions

- Nīlakaṇṭha's own tripatākī verses were not located. Confirm the flag geometry from the Varṣatantra (1926 edition) before any build.
