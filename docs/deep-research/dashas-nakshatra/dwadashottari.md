# Dwadashottari dasha (dvādaśottarī daśā)

> A 112-year nakshatra dasha of eight lords (Venus left out), counted from the birth star to Revati, for natives born in a Venus amsha, read as lagna in a Taurus or Libra navamsha. Used in research by PVR/JHora users; little traditional practice.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| `śukrāṃśake prajātasya vicintyā dvādaśottarī \| janmabhāt pauṣṇabhaṃ yāvat saṃkhyā hi vasutaṣṭitā` | ELS 46.27 | [TEXT] |
| Lords and years 7, 9 … 21 (rule "2 and 7": start 7, step 2) | ELS/AE 46.28 | [TEXT] |
| Lagna in a navamsha owned by Venus | AE 46.27; PVR 2014 | [TEXT translation; MODERN] |
| Controlling planet Ketu; reverse count "viparītaṃ ketoḥ" | PVR 2014 | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-27 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt · https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf

## 2. When it applies

`śukrāṃśake prajātasya` = "of one born in a Venus amsha". AE, PVR and the engine read it as navamsha lagna in Taurus or Libra (one chart in six). ELS's English ("Venus in the navamsha") is a weaker reading: the verse does not mention Venus's own position. [TEXT]

## 3. Inputs required

Lagna longitude (for D9 lagna); Moon longitude.

## 4. Calculation

Count from the birth star **forward to Revati** (`janmabhāt pauṣṇabhaṃ yāvat`), divide by 8; remainder → lord (1 = Sun). Equivalent: lords run backwards through the zodiac from Revati. Engine table (`dwadasottari.py`, seed 27):

| Lord | Years | Nakshatras |
|---|---|---|
| Sun | 7 | 27 Revati, 19 Mula, 11 P.Phalguni, 3 Krittika |
| Jupiter | 9 | 26, 18, 10, 2 |
| Ketu | 11 | 25, 17, 9, 1 |
| Mercury | 13 | 24, 16, 8 |
| Rahu | 15 | 23, 15, 7 |
| Mars | 17 | 22, 14, 6 |
| Saturn | 19 | 21, 13, 5 |
| Moon | 21 | 20, 12, 4 |

Total 112. MD order Sun → Jupiter → Ketu → … → Moon. Balance by the 46.16 rule; AD = MD × AD / 112.

## 5. Interpretation rules

As Vimshottari through BPHS ch. 47–48 [COMM/MODERN]. PVR: prefer only if Ketu is strong [MODERN].

## 6. Variants and disputes

- Reading of `śukrāṃśa` (above).
- Whether "count to Revati" also reverses the MD sequence (it does not in the engine or in PVR; only the star-to-lord mapping runs backwards).

## 8. Design notes for AI Astra

- Engine already checks D9 lagna Taurus/Libra. Export the flag and the D9 lagna margin (a navamsha is 3°20′; birth-time error of ~13 minutes crosses one).
- Research use only.

## 9. Open questions

- GC Sharma's and Santhanam's renderings of 46.27 not compared directly.
