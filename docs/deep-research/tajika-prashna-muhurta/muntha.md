# Muntha (munthahā / inthihā)

> Muntha is a point in the annual chart. It starts at the natal lagna and moves one sign for each completed year of
> life, so it returns to the natal lagna every 12 years. Its house in the annual chart, and its house in the natal
> chart, show the area of life that is "activated" for the person that year. Its lord is one of the five candidates
> for year lord. Every Tajika text uses it. It is the Indian form of the Perso-Arabic *intihā'* (profection), and its
> calculation is simple and reliable.

## 1. Sources

| Text | Numbering | Rule |
|---|---|---|
| Nīlakaṇṭha, Saṃjñātantra 1.66; Varṣatantra 2.1 | as quoted in *Hāyanaratna* (Gansten 2020) ch. 5 §1 | Sign-level rotation. The second half of the verse gives the Tājikasāra view (add the lagna's degrees) |
| Samarasiṃha, *Tājikaśāstra* | HR ch. 5 §1 (no verse number) | Divide the years elapsed by 12. Count the remainder from the natal lagna |
| Tejaḥsiṃha, *Daivajñālaṃkṛti* 13.1 | HR | One house per year |
| Maṇittha, *Varṣaphala* 6–7 | HR | Remainder from the ascendant gives the inthihā |
| *Tājikamuktāvalī* ṭippaṇī 4.1–2 | HR | Adds one to the elapsed years before dividing (inclusive count). Monthly increment 2½° (30°/12). Daily increment = monthly ÷ days |
| Haribhaṭṭa, *Tājikasāra* 126 | HR | Adds the natal lagna's degrees, which gives a degree-level Muntha |
| Yādava, *Tājikayogasudhānidhi* 8.1, 8.5 | HR | Etymology. With mixed influences, the strongest planet decides |
| Varṣatantra 2.17 | HR ch. 5 §4–5 | Muntha in a house with a malefic *kṣuta* (hostile) aspect: that house's good is destroyed |
| *Hillājatājika* | HR ch. 5 §4 | Muntha results come in its lord's period. Natal-good and annual-good placement gives benefit across the whole year |

URLs: <https://www.wisdomlib.org/hinduism/book/hayanaratna-the-jewel-of-annual-astrology/d/doc1500929.html> (calculation),
`.../doc1500932.html` (natal and annual), `.../doc1500930.html`, `.../doc1500931.html` (results by house). The last two were not fetched.

## 2. When it applies

Annual chart, all life areas. Muntha can also be found from a query (praśna) (HR ch. 5 §6). The monthly Muntha moves
2½° a month (Muktāvalī).

## 3. Inputs required

Natal lagna (sign and degree). Completed years of age at the revolution. Annual chart (to read Muntha's house there)
and natal chart (to read Muntha's sign in it).

## 4. Calculation

1. [TEXT] `muntha_sign = (natal_lagna_sign + completed_years) mod 12` (Samarasiṃha, Saṃj. 1.66). At age 0 (the birth
   year) Muntha is in the natal lagna sign. In the 2nd year of life (1 year completed) it is in the 2nd sign.
   Note: the Muktāvalī's "add one" is the same thing, written as an inclusive count.
2. [TEXT, variant] Degree-level: Muntha takes the natal lagna's degree (Tājikasāra 126; Nīlakaṇṭha's second half-verse).
   Within the year it advances 2½° a month (Muktāvalī).
3. Read: (a) the house Muntha occupies in the annual chart (counted from the varṣa lagna); (b) the sign's natal house;
   (c) Muntha's lord (sign lord) and that lord's strength and aspects; (d) aspects on Muntha.

## 5. Interpretation rules

- [TEXT] Good annual houses for Muntha in the Tajika texts are generally the 9, 10, 11, 1, 5 and 2 (HR ch. 5 §3 lists
  results for each of the 12 houses. That page was not fetched, so the house list is the [COMM]/[MODERN] standard
  set, verse not verified). Muntha in the 4, 6, 7, 8 or 12 is troubled (Samarasiṃha, as below).
- [TEXT] Samarasiṃha: if Muntha falls in the natal 4, 6, 7, 8 or 12 and malefics are involved in the year, that house
  is spoiled. Benefics joined with its lord give good results.
- [TEXT] *Hillājatājika*: bad placement in both charts plus malefics is very bad. Good placement in both gives great
  happiness. Results arrive in the Muntha lord's period. Natal benefics give good results in the first half of the
  year, and a good revolution carries them into the second half.
- [TEXT] Vāmana: the Muntha lord, its friends or strong benefics conjoining or aspecting Muntha support it. The lord's
  enemies or weak malefics harm it.
- [TEXT] Varṣatantra 2.17: a hostile (kṣuta) aspect from a malefic on Muntha's house destroys that house's good.
- [MODERN] Raman and others: the Muntha lord combust, retrograde or in 6/8/12 of the annual chart makes for a weak
  year. A widely used simplification.

## 6. Variants and disputes

- Sign-only vs. degree-level (above). Most authorities use sign-level. Degree-level matters only for aspects within orb.
- Whether Muntha is a full "planet" for Tajika aspect and yoga purposes. Some modern practitioners compute Ithasala
  with Muntha. The texts quoted use it as a point that is aspected, not as one that applies.

## 7. Worked micro-example

Natal lagna Cancer (sign 4). At the revolution after the 34th birthday, 34 years are completed. 34 mod 12 = 10, and
4 + 10 = 14, which wraps to sign 2: Muntha in Taurus. Its lord is Venus. If the varṣa lagna is Capricorn, Muntha is
in the 5th of the annual chart (a good house) and in the natal 11th. That reads as gains through creative or child
matters this year, if Venus is strong.

## 8. Design notes for AI Astra

- Engine (served): `annual.tajaka` returns `muntha_sign` and `muntha_lord` from `tajaka.muntha_house(natal_lagna_sign,
  years_completed)` = `(lagna + years) % 12`. That is sign-level and matches Samarasiṃha and the Saṃj. first half.
- Engine additions: `muntha.annual_house` (counted from the varṣa lagna) and `muntha.natal_house`. Optionally
  `muntha.longitude` (degree variant, flagged) and `muntha.monthly[]` (2½° steps). Also aspects on Muntha (who, which
  Tajika aspect, within orb or not) and the Muntha lord's dignity and house in the year chart.
- Serves: the annual reader, the Self board "theme of your year" card, and the year-to-year calibration question ("did
  <area> come up around <return date>?").
- Weight: high among Tajika factors for which area is active. It is still secondary to natal dasha (`00-overview.md`).
- Pitfall: off-by-one between "completed years" and "running year". Pin it with a test: age 0 → natal lagna.

## 9. Open questions

- The house-by-house results (HR ch. 5 §3) were not fetched. Before copy is written, verify the good and bad house list against Varṣatantra ch. 2.
- Muntha from a query (HR ch. 5 §6) could serve the Prashna feature later. Not researched.
