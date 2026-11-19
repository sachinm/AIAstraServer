# House significations (bhāva kāraka-tattva) — reference table

> This is what each of the 12 houses signifies according to BPHS, with the main karakas (natural significators) and the classical house groupings. It is the lookup every other technique relies on: a house is chosen for a question, then judged with file 01. The table is a reference; the texts broadly agree, and later works (Phaladeepika, Jataka Parijata, Sarvartha Chintamani) mostly add items.

## 1. Sources
- **BPHS ch. 11 "Judgement of houses"** (Santhanam numbering), opening verses (≈11.2-13) list the significations of houses 1-12 (R; chapter V in the BPHS-ET contents, verse numbers not checked). E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **BPHS ch. 12-23**: the effects of houses 1-12, with further significations (R).
- **BPHS ch. 32 "Karakas"**: the house karakas (R).
- **Phaladeepika ch. 1** (house names) and **ch. 15** (karakas) (R).
- **Jataka Parijata** and **Sarvartha Chintamani**: expanded lists (R).

## 2. When it applies
To choose the house(s) for any question, in D1 and in every varga.

## 3. Inputs required
None beyond the lagna sign. This is static reference data.

## 4. Calculation / rule — the table
| H | Sanskrit | BPHS core significations (paraphrased, R) | Karaka(s) (BPHS 32 / PD 15, R) | Groups |
|---|---|---|---|---|
| 1 | Tanu / Lagna | Body, complexion, nature, health, happiness and sorrow, fame, self | Sun | Kendra, trikona |
| 2 | Dhana | Wealth, family, speech, food, face and right eye, early education, death-inflicting (maraka) | Jupiter | Panaphara, maraka |
| 3 | Sahaja | Courage, younger siblings, servants, short journeys, effort, ears | Mars | Apoklima, upachaya, 3-6-11 |
| 4 | Sukha / Bandhu | Mother, home, land, vehicles, relatives, happiness, heart, basic schooling | Moon (mother), Mercury (education), Venus (vehicles), Mars (land) | Kendra |
| 5 | Putra | Children, intelligence, mantra, learning, discrimination, past merit (purva punya) | Jupiter | Trikona, panaphara |
| 6 | Ari / Ripu | Enemies, disease, debts, litigation, maternal uncle, service, injuries | Mars, Saturn | Dusthana, upachaya |
| 7 | Yuvati / Kalatra | Spouse, marriage, partnerships, trade, travel, sexual life, death-inflicting (maraka) | Venus (Jupiter for a woman's husband, [COMM]) | Kendra, maraka |
| 8 | Randhra / Ayu | Longevity, obstacles, sudden events, inheritance, hidden matters, chronic illness | Saturn | Dusthana, panaphara |
| 9 | Dharma / Bhagya | Fortune, father (in BPHS's usual reading), guru, religion, pilgrimage, higher learning | Jupiter, Sun (father) | Trikona |
| 10 | Karma | Profession, status, power, authority, honour, father (in some schools), actions | Sun, Mercury, Jupiter, Saturn | Kendra, upachaya |
| 11 | Labha | Gains, income, elder siblings, fulfilment of desires | Jupiter | Panaphara, upachaya |
| 12 | Vyaya | Expenses, losses, foreign lands, bed pleasures, liberation (moksha), confinement | Saturn | Dusthana, apoklima |

Groupings (BPHS, R):
- Kendra: 1, 4, 7, 10.
- Trikona: 1, 5, 9.
- Panaphara: 2, 5, 8, 11.
- Apoklima: 3, 6, 9, 12.
- Upachaya: 3, 6, 10, 11.
- Dusthana (trik): 6, 8, 12.
- Maraka: 2, 7.
- Purushartha triangles:
  - Dharma: 1, 5, 9.
  - Artha: 2, 6, 10.
  - Kama: 3, 7, 11.
  - Moksha: 4, 8, 12.

## 5. Interpretation rules
- [TEXT] A house's matters flourish when it, its lord and its karaka are strong (BPHS 11, R).
- [COMM] For relatives, use derived houses. Examples:
  - The spouse's family is the 2nd from the 7th = the 8th.
  - The father's mother is the 4th from the 9th = the 12th.
- [MODERN] The father is shown by the 9th in BPHS and in North Indian practice. Some South Indian practice uses the 10th. SJC uses the 9th for father and the 10th for karma.

## 6. Variants and disputes
- **9th vs 10th for the father**: as above.
- **4th for education vs the 5th for learning**: both are used. The 4th is schooling and degrees; the 5th is intelligence and the 24th varga (D24).
- **Sarvartha Chintamani and Jataka Parijata** add many minor items (e.g. the 3rd for ears and throat, the 12th for the left eye). These are compatible, not conflicting.

## 7. Worked micro-example
For "will I own a house?":
- 4th house, its lord and its karakas (Mars for land, Venus for comfort).
- Confirm in D4 (file 11).

## 8. Design notes for AI Astra
- Keep this table in the engine or the technique catalogue as data, labelled by text. It must not be re-derived in Node code paths; the readers get it from the engine's house card (`house.significations`, `house.karakas`, `house.groups`).
- **Board mapping**:
  - Self: 1, plus 5 and 9.
  - Love: 7, plus 5, 2, 8 and 12.
  - Work: 10, plus 6, 2 and 11.
  - Lucky: 9, plus 11.
- **Pitfall**: the 8th and 12th carry frightening words in classical lists (death, confinement). The prompt must translate them into everyday terms (the doc 45 vocabulary rules).

## 9. Open questions
- Check the exact BPHS 11 verse numbering against Santhanam's print.
- Should the engine carry per-house karaka lists by school (BPHS vs Phaladeepika)?
