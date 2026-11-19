# Shodashavarga — the sixteen divisional charts (ṣoḍaśavarga)

> Each sign is divided into n parts, and each part is mapped to a sign, giving a divisional chart Dn. BPHS names sixteen: D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45 and D60. Each varga is the "magnified" chart of one life area. A promise in D1 is confirmed or denied by the relevant varga. Planets in the same sign in D1 and D9 (vargottama) gain strength. Counts of good dignities across vargas earn named grades (file 09).
>
> D9 is used universally. D10, D7, D4, D12, D24 and D60 are used heavily by modern schools (K.N. Rao and BVB for D10, SJC). Higher vargas need an accurate birth time: D60 changes every 2 minutes or so.

## 1. Sources
- **BPHS ch. 6 "Shodasa vargas"** (Santhanam numbering = BPHS-ET):
  - calculation of each varga and its uses (R; verse numbers not checked);
  - vv. 42-53: the names of the varga-count grades (V).
- **BPHS ch. 7**: divisional considerations and Vimshopaka (V).
- E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **Brihat Jataka ch. 1**: hora, drekkana, navamsa, dwadasamsa and trimsamsa (shadvarga) (R).
- **Saravali ch. 3** (R).
- [MODERN] SJC (Sanjay Rath, *Vedic Remedies*, *Crux of Vedic Astrology*): the deity sequences of vargas and the D60 deities. K.N. Rao: D10 rules.

## 2. When it applies
All natal charts; the varga follows the life area of the question.

## 3. Inputs required
Sidereal longitude of each planet and of the lagna, to arc-second precision, plus the accuracy of the birth time.

## 4. Calculation / rule
Let s be the sign (1-12), d the degree in the sign, and p = floor(d ÷ (30/n)) + 1 the part number.

| Varga | Name | Part size | Mapping rule (BPHS, Parashara method, R) | Signifies (BPHS 6, R) |
|---|---|---|---|---|
| D1 | Rasi | 30° | the sign itself | Body, everything |
| D2 | Hora | 15° | Odd sign: 1st half Leo (Sun), 2nd half Cancer (Moon). Even sign: the reverse | Wealth |
| D3 | Drekkana | 10° | 1st part = same sign, 2nd = 5th from it, 3rd = 9th | Siblings, courage |
| D4 | Chaturthamsa | 7°30′ | 1st, 4th, 7th and 10th from the sign | Fortune, property, home |
| D7 | Saptamsa | 4°17′ | Odd sign: count from the same sign. Even: count from the 7th | Children, progeny |
| D9 | Navamsa | 3°20′ | Fire signs start from Aries, earth from Capricorn, air from Libra, water from Cancer | Spouse, dharma, inner strength of planets |
| D10 | Dasamsa | 3° | Odd: from the same sign. Even: from the 9th | Power, profession, status |
| D12 | Dwadasamsa | 2°30′ | From the same sign | Parents |
| D16 | Shodasamsa | 1°52′30″ | Movable signs from Aries, fixed from Leo, dual from Sagittarius | Vehicles, comforts, happiness |
| D20 | Vimsamsa | 1°30′ | Movable from Aries, fixed from Sagittarius, dual from Leo | Spiritual practice, worship |
| D24 | Chaturvimsamsa (Siddhamsa) | 1°15′ | Odd: from Leo. Even: from Cancer | Learning, education |
| D27 | Saptavimsamsa (Bhamsa) | 1°6′40″ | Fire from Aries, earth from Cancer, air from Libra, water from Capricorn | Strength and weakness, stamina |
| D30 | Trimsamsa | unequal | Odd: Mars 0-5 (Aries), Saturn 5-10 (Aquarius), Jupiter 10-18 (Sagittarius), Mercury 18-25 (Gemini), Venus 25-30 (Libra). Even: Venus 0-5 (Taurus), Mercury 5-12 (Virgo), Jupiter 12-20 (Pisces), Saturn 20-25 (Capricorn), Mars 25-30 (Scorpio) | Misfortunes, evils, character |
| D40 | Khavedamsa | 0°45′ | Odd: from Aries. Even: from Libra | Auspicious and inauspicious effects (maternal legacy, [MODERN]) |
| D45 | Akshavedamsa | 0°40′ | Movable from Aries, fixed from Leo, dual from Sagittarius | All matters (paternal legacy, character, [MODERN]) |
| D60 | Shashtyamsa | 0°30′ | Take d × 2, drop the fraction, add 1, count from the sign itself. Each part has a named deity, benefic or malefic | All matters; past-life karma |

**Vargottama**: a planet occupying the same sign in D1 and D9. It is treated as strong, comparable to own-sign dignity [TEXT, BJ/Saravali, R].

**Varga judgement steps** [COMM/MODERN synthesis]:
1. Find the D1 house and its lord for the question (file 01).
2. In the relevant varga, check the dignity of the D1 lord and karaka. Own, exalted or friendly confirms.
3. Read the varga's own lagna, and the varga's house for the matter (e.g. the 10th of D10). Ask whether its lord is in a kendra or trikona of the varga.
4. Count the vaiseshikamsa grade (file 09).
5. Planets debilitated in D9 lose much of their D1 promise. Planets exalted in D9 gain.

## 5. Interpretation rules
- [TEXT] Each varga is to be consulted for its own signification (BPHS 6, R).
- [TEXT] Planets in the vargas of benefics, own vargas or exaltation vargas give good results. Those in vargas of malefics or enemies give bad ones (BPHS 7, R).
- [TEXT] Count the good vargas a planet holds; more good vargas mean better results, with named grades (BPHS 6.42-53, V).
- [COMM] Vargottama planets give results like their own sign (R).
- [MODERN] K.N. Rao (BVB): the 10th lord of D10 and the D1 10th lord's position in D10 decide career rise. Do not read D10 without the D1 promise.
- [MODERN] SJC: D60 is the most important after D1 for the karmic root, but only with a rectified time.

## 6. Variants and disputes
- **D2 Hora**: the Parashara hora (Sun/Moon halves) vs Raman's/Kashinath's alternatives (parivritti cyclic). The engine supports `_hora_chart_raman_method`, `_hora_chart_kashinath` and `_hora_traditional_parasara_chart`.
- **D3**: the Parashara method vs the Jagannatha drekkana (SJC, for Jaimini) vs the Somanatha method.
- **D9**: the Parashara method vs the Kalachakra navamsa (engine `_navamsa_kalachakra`).
- **D10 and D16-D45**: the starting rules vary in some modern books.
- **D60**: the deity names and benefic/malefic status vary slightly by edition. The sequence is reversed for even signs (BPHS, R).
- Extra non-BPHS vargas (D5, D6, D8, D11, D81, D108, D144, D150) are from Tajika, Nadi or SJC sources and are not part of the shodashavarga.

## 7. Worked micro-example
Venus at 7° Gemini:
- D9: Gemini is an air sign, so counting starts from Libra; 7° is the 3rd part (6°40′-10°), so Sagittarius.
- D1 Gemini ≠ D9 Sagittarius, so Venus is not vargottama. In Sagittarius (Jupiter's sign) Venus is in a neutral's sign.

## 8. Design notes for AI Astra
- **Engine already has**: every varga with method variants in `charts.py` (`divisional_chart`, `hora_chart`, …, `shashtyamsa_chart`, plus custom and mixed charts). `general.promise.md` notes the served set is currently limited to D1, D2, D4, D7, D9 and D10.
- **Must output per varga**:
  - lagna and planet signs;
  - dignity per planet;
  - house of each planet from the varga lagna;
  - the method id;
  - the vargottama flag (D1 vs D9 at minimum; optionally D1 vs every varga);
  - D60 part number and deity with benefic/malefic tag;
  - a birth-time sensitivity: the minutes until the lagna or each planet changes varga sign.
- **Board use**:
  - Work: D10.
  - Love: D9 (and D7 for children).
  - Self: D1, D9, D27 and D30.
  - Home: D4.
  - Parents: D12.
  - Learning: D24.
  - Spiritual: D20.
- **Weight**: confirmatory. The D1 promise must exist first.
- **Pitfall**: hide high vargas (D40-D60) when the birth-time sensitivity is under about 5 minutes. Never present D60 deities to users.

## 9. Open questions
- Decide the default method per varga (the product should fix one, with variants available for research).
- Expanding `SERVED_VARGAS` is already tracked in the repo docs (general.promise.md gaps R2/R3).
