# Vimshopaka Bala and varga-dignity counts (viṃśopaka bala, vaiśeṣikāṃśa)

> Vimshopaka is a 20-point score of how well a planet is placed across a set of divisional charts (6, 7, 10 or 16 vargas). Each varga carries a weight, and the planet's dignity in that varga is scaled. The companion count, Vaiseshikamsha, records how many of those vargas the planet occupies with good dignity and names the result (Parijata, Uttama … Sri Vallabha). Both answer "is this planet's promise robust across the life-areas the vargas govern?". BPHS gives exact weights. The method is widely used by Parashari astrologers (Santhanam, PVR, SJC) as a quality score.

## 1. Sources
- **BPHS ch. 7** (Santhanam numbering = BPHS-ET), all (V):
  - vv. 17-19: shadvarga weights;
  - v. 18: saptavarga;
  - v. 20: dasavarga;
  - vv. 21-25: shodasavarga;
  - vv. 26-27: below 5 the planet cannot give auspicious results.
- **BPHS ch. 6 vv. 42-53** (V): the names of the varga-count grades.
- E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- [MODERN] P.V.R. Narasimha Rao, *Vedic Astrology: An Integrated Approach* (dignity point scale, R).

## 2. When it applies
- All planets (Sun to Saturn; Rahu and Ketu by convention).
- Shadvarga is the general strength measure. Dasavarga and shodasavarga are used for fine judgement.

## 3. Inputs required
- The sign of each planet in D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45 and D60.
- Sign lords.
- Compound relationship (file 04).
- Own, MT and exaltation status in each varga.

## 4. Calculation / rule
**Weights per scheme** (sum = 20):

| Varga | Shadvarga | Saptavarga | Dasavarga | Shodasavarga |
|---|---|---|---|---|
| D1 | 6 | 5 | 3 | 3.5 |
| D2 | 2 | 2 | 1.5 | 1 |
| D3 | 4 | 3 | 1.5 | 1 |
| D4 | – | – | – | 0.5 |
| D7 | – | 2.5 | 1.5 | 0.5 |
| D9 | 5 | 4.5 | 1.5 | 3 |
| D10 | – | – | 1.5 | 0.5 |
| D12 | 2 | 2 | 1.5 | 0.5 |
| D16 | – | – | 1.5 | 2 |
| D20 | – | – | – | 0.5 |
| D24 | – | – | – | 0.5 |
| D27 | – | – | – | 0.5 |
| D30 | 1 | 1 | 1.5 | 1 |
| D40 | – | – | – | 0.5 |
| D45 | – | – | – | 0.5 |
| D60 | – | – | 5 | 4 |

The saptavarga fractions and the dasavarga "1.5" are OCR-garbled in BPHS-ET and are read so that each column sums to 20.

**Dignity factor per varga** [COMM, Santhanam-style, R]:

| Dignity | Points out of 20 |
|---|---|
| Own sign | 20 |
| Great friend | 18 |
| Friend | 15 |
| Neutral | 10 |
| Enemy | 7 |
| Great enemy | 5 |

Some workings give exaltation and MT 20 as well.

Score = Σ (weight × points ÷ 20).

**Bands** (BPHS 7.26-27):
- below 5: incapable of good (V);
- 5-10, 10-15 and 15-20: rising grades of result (R; the exact wording of the upper bands was not checked).

**Vaiseshikamsha** (count of vargas with own, MT or exalted dignity; BPHS 6.42-53). The names for counts 2-4 in shodasavarga and all of dasavarga were seen (V). The shodasavarga names for counts 5-16 are recalled (R):

| Count | Shadvarga | Dasavarga | Shodasavarga |
|---|---|---|---|
| 2 | Kimshuka | Parijata | Bhedaka |
| 3 | Vyanjana | Uttama | Kusuma |
| 4 | Chamara | Gopura | Nagapushpa |
| 5 | Chatra | Simhasana | Kanduka |
| 6 | Kundala | Paravata | Kerala |
| 7 | Mukuta (saptavarga) | Devaloka | Kalpavriksha |
| 8 | – | Brahmaloka | Chandanavana |
| 9 | – | Airavata (Sakravahana) | Poornachandra |
| 10 | – | Shridhama | Uchchaisrava |
| 11-16 | – | – | Dhanvantari, Suryakanta, Vidruma, Indrasana, Goloka, Sri Vallabha (R order) |

## 5. Interpretation rules
- [TEXT] A total below 5 means the planet cannot give auspicious results (BPHS 7.26-27, V). Higher totals mean steadily better results (R).
- [TEXT] Planets in Parijata and higher dasavarga grades give good qualities, status and wealth in rising order (BPHS 6, R).
- [COMM] Santhanam: use shadvarga for general strength and shodasavarga for refined judgement.
- [MODERN] PVR: Vimshopaka is a better "quality" score than Shadbala for judging dignity across life-areas.

## 6. Variants and disputes
- **Which relationship to use**: natural or compound. Santhanam uses compound (R). Some software uses natural only.
- **Whether exaltation and MT are counted** in the dignity points.
- **Which varga calculation method** to use (e.g. Parashara hora vs Raman hora; file 11). This changes the scores.
- **Rahu and Ketu** dignities are disputed (file 04).

## 7. Worked micro-example
- In shadvarga Venus is:
  - own in D1 (6 × 20/20 = 6);
  - a friend in D2 (2 × 15/20 = 1.5);
  - an enemy in D3 (4 × 7/20 = 1.4);
  - exalted in D9, scored as own (5);
  - neutral in D12 (1);
  - a friend in D30 (0.75).
- Total ≈ 15.65 out of 20: high.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `charts.vimsopaka_shadvarga/sapthavarga/dhasavarga/shodhasavarga_of_planets`;
  - `charts.vaiseshikamsa_*_of_planets`.

  `general.promise.md` notes `strength.vimsopaka` is not yet served.
- **Must output per planet per scheme**:
  - the score out of 20;
  - the per-varga dignity row;
  - the vaiseshikamsa count and grade name;
  - the relationship type (natural or compound) and varga methods used.
- **Board use**:
  - Self: the "how dependable is each planet" meter.
  - Work: the 10th lord across D10.
  - Love: the 7th lord and Venus across D9.
- **Weight**: a second-tier confirmer after D1 dignity and the D9 check.
- **Pitfall**: do not show grade names (Parijata etc.) to users as jargon; translate them to "well supported across X of Y areas".

## 9. Open questions
- Verify the print values of the saptavarga fractions and the dignity point table (Santhanam vs others).
- Should the default scheme be shadvarga (BPHS general) or shodasavarga?
