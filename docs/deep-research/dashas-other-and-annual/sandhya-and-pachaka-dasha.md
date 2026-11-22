# Sandhya Dasha and Pachaka Dasha (sandhyā-daśā, pācaka-daśā)

> Sandhya divides the full human life span (paramāyus, 120 years) into twelve equal sign periods of 10 years each,
> starting from the Lagna sign. Pachaka is the rule for dividing each 10-year Sandhya into twelve unequal sub-periods:
> the first sign gets 6 shares, the next three get 3 each and the remaining eight get 2 each, out of 31. It answers
> "which house of life is in focus this decade, and which sign within it?" Parashara names both among the systems
> "not universally accepted" (BPHS 46.11). Modern use is rare and it has no strong advocate school.

## 1. Sources (text, edition, chapter:verse; URLs)

BPHS uses site numbering: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46

| Rule | Source | Tag |
|---|---|---|
| Sandhya and Pachaka named; not universally accepted | BPHS 46.11 (*aṣṭavargadaśā sandhyādaśā pācakasaṃjñikā … na sarvasammatāḥ*) | [TEXT] |
| Sandhya = one-twelfth of paramāyus | BPHS 46.204 | [TEXT] |
| Pachaka: *sandhyā rasaguṇā kāryā candravahnihṛtā phalam / saṃsthāpyaṃ prathame koṣṭhe tadardhaṃ triṣu vinyaset*: multiply the sandhya by 6, divide by 31, place the result in the first cell and half of it in each of the next three cells | BPHS 46.205 — https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-205. The site glosses it as ×18 ÷ 3; see §6. | [TEXT] |
| One-third of the first value goes in each of the remaining eight cells (*tribhāgaṃ vasukoṣṭheṣu*), for all twelve | BPHS 46.206 | [TEXT] |
| Engine: Sandhya of 10 years per sign from the Lagna sign; Pachaka sub-periods of 60/31, 30/31 ×3 and 20/31 ×8 years | AIAstra_Radha `src/jhora/horoscope/dhasa/raasi/sandhya.py` | engine |

## 2. When it applies (which charts, which life areas)

- **Chart.** Every natal chart; no condition is stated.
- **Life areas.** Decade-level house focus:
  - the 1st house runs ages 0–10;
  - the 2nd house runs ages 10–20;
  - and so on, ending with the 12th house at ages 110–120.

## 3. Inputs required (exact chart data)

- The Lagna sign.
- The birth instant.
- The planets in each sign, for reading the result.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

1. **Paramayu** = 120 years for humans [COMM; the engine's docstring]. Sandhya = 120/12 = 10 years (BPHS 46.204).
2. **Mahadashas.** Start from the Lagna sign at birth, with no balance. Run forward through the 12 signs, 10 years each:
   Lagna at ages 0–10, the 2nd sign at 10–20, and so on.
3. **Pachaka sub-periods** within each Sandhya, starting from the dasha sign and going forward:

   | Cell | Shares | Years |
   |---|---|---|
   | 1st (the dasha sign itself) | 6 | 10 × 6/31 = 1.935 (≈ 23.2 months) |
   | 2nd, 3rd, 4th | 3 each | 0.968 each (≈ 11.6 months) |
   | 5th–12th | 2 each | 0.645 each (≈ 7.7 months) |

   The total is 6 + 9 + 16 = 31 shares = 10 years exactly.
4. **Year length.** Not stated in the text. The engine uses the sidereal year.
5. **Sub-sub-periods.** Not given in the text. Applying the same 6/3/2 pattern recursively is an inference.

## 5. Interpretation rules (tagged)

- **Text.** BPHS gives no interpretation rules specific to Sandhya. The general sign-dasha rules apply: benefics in or
  aspecting the dasha sign, the lord's strength, and the house it rules from the Lagna. [COMM]/[MODERN] by analogy.
- **Decade theme.** The house number from the Lagna gives the decade theme. For example, the 4th house at ages 30–40
  gives home and property, and the 7th house at ages 60–70 gives partner and public life. [MODERN] inference.

## 6. Variants and disputes (school by school)

- **Reading the number words.**
  - The site reads *rasaguṇā* as 6 × 3 = 18 and *candravahni* as 1 × 3 = 3, so ×6.
  - The reading that conserves the 10 years is *rasa*-*guṇā* = "multiplied by six" (*guṇa* as "multiplied", not the
    number 3). *Candra-vahni* in right-to-left bhūtasaṅkhyā (1, 3) gives 31.
  - So: ×6 ÷ 31. Only this reading makes 1 cell × 6 + 3 cells × 3 + 8 cells × 2 = 31/31 of the Sandhya.
  - The engine uses this reading (`_panchaka_duration`).
- **Antardasha options in the engine.**
  - Plain Sandhya: 12 equal antardashas of 10/12 year.
  - Pachaka: the 6/3/2 pattern.
- **Paramayu.** Some readers use 120 years; Parashara elsewhere mentions longer paramāyus for other ages (yugas) or
  beings. The engine fixes 120.

## 7. Worked micro-example (optional, short)

Lagna Leo, age 34: the 4th Sandhya, Scorpio, runs ages 30–40.

- Pachaka: Scorpio 30.00–31.94, then Sagittarius, Capricorn and Aquarius about 0.97 years each (to 34.84).
- At 34 the person is in the Aquarius pachaka.

## 8. Design notes for AI Astra

- **Engine output.** The engine already outputs `sandhya`; `dasha_export` has a `get_dhasa_antardhasa` mapping. It
  should also expose `use_panchaka_variation` as a Pachaka variant row set, labelled as Pachaka.
- **Boards.**
  - The You board, as a slow "decade theme".
  - Possibly Lucky, never as a primary driver.
- **Weight.** Very low; Parashara himself disclaims it. Use only when it agrees with Vimshottari plus transits.
- **Pitfall.** Every person with the same Lagna has the same decade map. To avoid generic text, it needs the
  person-specific planets in that sign.

## 9. Open questions

- Is the paramāyus for Sandhya 120 years, or another figure? 46.204 says only "parāyus".
- Does Pachaka start from the dasha sign, or from the Lagna, inside each Sandhya? The text says "first cell"; the engine
  uses the dasha sign.
- Direction for even signs: always forward (engine), or reversed? The text is silent.
