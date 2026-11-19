# Shadbala — six-fold planetary strength (ṣaḍbala)

> Shadbala measures how able each of the seven visible planets (Sun to Saturn) is to deliver what it signifies. It adds six sources of strength in virupas (60 virupas = 1 rupa): positional (sthana), directional (dig), temporal (kala), motional (cheshta), natural (naisargika) and aspectual (drik). The total is compared with a minimum per planet. It answers whether a planet is strong enough to deliver its promise. It does not say whether the results will be good or bad; that is Ishta/Kashta (file 08). BPHS is the root text, and almost every modern school uses it through B.V. Raman's *Graha and Bhava Balas*. It is reliable as a relative ranking. The absolute thresholds are disputed in detail (see §6).

## 1. Sources
- **BPHS ch. 27 "Evaluation of Strengths"** (Santhanam chapter numbering), checked in the archive.org e-text (BPHS-ET, translator not named): https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt. In the Girish Chand Sharma edition on wisdomlib (BPHS-GCS) the chapter numbers are shifted by about 2 in this region.
  - 27.14 naisargika order (V)
  - 27.20 yuddha bala (V)
  - 27.32-33 total minimums (V)
  - 27.34-36 component minimums (V)
  - Component formulas 27.1-31 (R; verse-level split not checked)
- **Brihat Jataka 2.19-21** (BJ-Neely Sanskrit, wisdomlib): sthana, dig, cheshta and kala strengths are named qualitatively, without numbers (V, keyword reading only).
- **Saravali ch. 4-5** (Santhanam transl.) and **Phaladeepika ch. 4 "Shadbala"** (V. Subrahmanya Sastri 1950) restate them (R).
- [MODERN] B.V. Raman, *Graha and Bhava Balas* (computational standard; source of the "Sun 5 rupas" table).

## 2. When it applies
- Every natal chart (D1). It is used to:
  - pick the strongest planet or lord when several compete (house judgement, yoga strength, dasha ripening);
  - choose the longevity method (BPHS 43.30-32 compares Lagna, Sun and Moon strength);
  - weight karakas.
- It applies to all life areas indirectly, through the lord and karaka of the house concerned.

## 3. Inputs required
- Sidereal longitudes, speeds and declinations of the Sun to Saturn.
- Birth JD and place. Sunrise and sunset, local midnight and noon.
- Lunar phase (Sun-Moon elongation).
- Lords of year, month, weekday and hora (Ahargana-based).
- Signs in the Saptavarga: D1, D2, D3, D7, D9, D12, D30.
- Mean longitudes for cheshta kendra.
- Planetary latitudes, for the war rule.
- Graha drishti values (sphuta drishti), for drik bala.

## 4. Calculation / rule
Unit: virupa (shashtiamsha). 60 virupas = 1 rupa.

| Bala | Sub-components (BPHS 27, R unless marked) | Max / notes |
|---|---|---|
| **Sthana** | Uccha: (180° − distance from deep debilitation) ÷ 3 | 60 |
| | Saptavargaja: per varga, MT 45, own 30, great friend 22.5, friend 15, neutral 7.5, enemy 3.75, great enemy 1.875 | summed over 7 vargas |
| | Ojayugmarasyamsa: Moon and Venus get 15 in an even sign; the others get 15 in an odd sign; scored in D1 and D9 | 30 |
| | Kendradi: kendra 60, panaphara 30, apoklima 15 | 60 |
| | Drekkana: male planets (Su, Ma, Ju) in the 1st decanate, neuter (Me, Sa) in the 2nd, female (Mo, Ve) in the 3rd | 15 |
| **Dig** | Zero point opposite the strong house. Strong houses: Ju and Me in the 1st, Su and Ma in the 10th, Sa in the 7th, Mo and Ve in the 4th. Arc from the zero point ÷ 3 | 60 |
| **Kala** | Nathonnata: Mo, Ma, Sa strong at midnight; Su, Ju, Ve at noon; Me always 60 | 60 |
| | Paksha: for benefics, Sun-Moon elongation ÷ 3; for malefics, 60 minus that; the Moon's paksha bala is doubled in many workings | 60 (120 for Mo) |
| | Tribhaga: day thirds go to Me, Su, Sa; night thirds to Mo, Ve, Ma; Ju always 60 | 60 |
| | Abda 15, Masa 30, Vara 45, Hora 60 to the respective lords | |
| | Ayana: from declination (kranti) | 60 (Sun doubled) |
| | Yuddha: the Shadbala difference is added to the victor and taken from the loser (27.20, V) | |
| **Cheshta** | Ma-Sa: from cheshta kendra (mean minus true longitude, with sighrocca) ÷ 3. The Sun's value is taken as its ayana bala and the Moon's as its paksha bala (convention, R). Vakra (retrograde) is the maximum | 60 |
| **Naisargika** | Fixed: Su 60, Mo 51.43, Ve 42.86, Ju 34.29, Me 25.71, Ma 17.14, Sa 8.57. Order Sa < Ma < Me < Ju < Ve < Mo < Su (27.14, V) | 60 |
| **Drik** | ¼ of (sum of benefic sphuta drishti − sum of malefic sphuta drishti) received | ± |

**Required minimum totals** (BPHS-ET 27.32-33, V). The verse gives 390, 360, 300, 420, 390, 330, 300 virupas "for Surya etc.":

| Planet | Virupas | Rupas |
|---|---|---|
| Sun | 390 | 6.5 |
| Moon | 360 | 6.0 |
| Mars | 300 | 5.0 |
| Mercury | 420 | 7.0 |
| Jupiter | 390 | 6.5 |
| Venus | 330 | 5.5 |
| Saturn | 300 | 5.0 |

The planet order is the standard Su→Sa order and is inferred, not spelled out. A planet that exceeds its minimum is "very strong" and favourable. A very strong Saturn gives long life "and miseries" (27.32-33, V).

**Component minimums** (BPHS-ET 27.34-36, V), in the order the e-text lists them:

| Planets | Sthana | Dig | Kala* | Cheshta* | Ayana |
|---|---|---|---|---|---|
| Ju, Me, Su | 165 | 35 | 50 | 112 | 30 |
| Mo, Ve | 133 | 50 | 30 | 100 | 40 |
| Ma, Sa | 96 | 30 | 40 | 67 | 20 |

\*Raman's widely copied table reads Kala 112/100/67 and Cheshta 50/30/40, the reverse pair. The e-text order may be an OCR or translation transposition. Treat as unresolved (§6).

**Ratio**: Shadbala ÷ required. A ratio ≥ 1 means adequate. The ranking by ratio is the usual "strongest planet" order.

## 5. Interpretation rules
- [TEXT] A planet above its minimum gives the results of its houses and karakatva well. One below it struggles (BPHS 27.32-33, V).
- [TEXT] Strength amplifies whatever the planet signifies. A strong Saturn means long life with hardship (27.33, V). Shadbala alone does not decide benefit.
- [TEXT] Yuddha: the defeated planet's strength is transferred to the victor (27.20, V).
- [COMM/MODERN] Raman: Ishta and Kashta must be read beside Shadbala to know the quality of results. A planet strong in Shadbala but high in Kashta gives strong *trouble*.
- [MODERN] PVR Narasimha Rao and SJC use Shadbala mainly as a tie-breaker and lean on dignity, varga and avasthas for quality. K.N. Rao's school uses it sparingly.
- [MODERN] Rahu and Ketu have no classical Shadbala. Some software assigns proxies; this is not textual.

## 6. Variants and disputes
- **Sun's minimum**: BPHS-ET reads 390 virupas (6.5 rupas). Raman's table (R) and the engine use 5 rupas. Some online calculators also list 6.5 for the Sun (seen in search snippets, not confirmed page by page). Unresolved. Expose both values.
- **Kala/Cheshta component minimums** are swapped between BPHS-ET and Raman (see the table above).
- **Cheshta of the luminaries**: the conventions differ (Sun = ayana bala, Moon = paksha bala). Raman follows this convention, and some programs compute a real cheshta value.
- **Moon's paksha bala doubling** and **Sun's ayana doubling**: present in Raman and absent in some readings.
- **Saptavargaja**: some use exaltation and debilitation in the dignity ladder; BPHS uses relationship plus MT and own.
- **Drik bala**: some include the special aspects only through the sphuta formula; others add full special aspects.

## 7. Worked micro-example
- Jupiter totals 420 virupas = 7.0 rupas, against a minimum of 6.5, so the ratio is 1.08: adequate.
- Mercury totals 380 virupas = 6.33 rupas, against 7, so the ratio is 0.90: weak although its absolute total is close to Jupiter's.
- The ratio, not the raw total, is what ranks them.

## 8. Design notes for AI Astra
- **Engine already has**: `strength.shad_bala()` in `AIAstra_Radha/src/jhora/horoscope/chart/strength.py`. It returns sthana, kala, dig, cheshta, naisargika, drik, total (virupas), rupas and ratio.
- **Engine finding**: `strength.py:806` `sb_req = [5,6,5,7,6.5,5.5,5]` uses Sun = 5. BPHS-ET reads 6.5. File as an engine decision. Output both `required_rupas_bphs` and `required_rupas_raman` with the source, or pick one and label it.
- **Engine additions**:
  1. Per-component minimum flags, using the 165/35/… table with the ordering dispute stated.
  2. A `strength_rank` by ratio (1..7).
  3. The yuddha participants and winner rule used (see file 05).
  4. A `text` tag on each threshold.
- **Board use**:
  - Self board: the strongest and weakest planet in plain words.
  - Love and Work: the strength of the 7th and 10th lords and karakas.
  - Readings: a tie-breaker between competing lords. Weight it below dignity, varga and yogas for *quality*, and above them for *capacity*.
- **Pitfalls**:
  - Never present a ratio below 1 as "bad". It means low capacity, not bad results.
  - Never let a reader compute the ratio. The engine sends it.

## 9. Open questions
- Which edition does Santhanam's printed text (not the e-text) use for the Sun's minimum and for the Kala/Cheshta order? Check a print copy.
- Should the product show Shadbala to users at all, or only use it internally for ranking?
