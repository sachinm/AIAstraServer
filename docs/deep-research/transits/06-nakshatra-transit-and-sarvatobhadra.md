# Nakshatra transit and the Sarvatobhadra chakra (nakṣatra-gocara, sarvatobhadra-cakra)

> Transits read by nakshatra rather than by sign, in three forms:
> - the 9-tara cycle from the janma star;
> - the named stars of the janma, karma and adhana triad (Phaladeepika 26:26-29);
> - grid "piercing" (vedha) in two chakras: the seven-line saptashalaka grid of PD 26:26 and the 9x9 Sarvatobhadra chakra.
>
> The tara cycle is universal. The Sarvatobhadra chakra is specialist; it is used for mundane work, muhurta and
> personal transits.

## 1. Sources
- **Phaladeepika 26:26-29** (siva.sh): a grid of 7 horizontal and 7 vertical lines, counted from Krittika starting in the NE. This is a saptashalaka-type chakra, not the 9x9 Sarvatobhadra. https://www.siva.sh/phaladeepika/26/26-30
- **Sarvatobhadra chakra:** attributed to Narada Samhita, and in some sources to the Brahmayamala. Narada Samhita was not opened in this pass.
  - Overview and the named stars: https://en.wikipedia.org/wiki/Sarvatobhadra_Chakra
  - All other sources found were secondary and are not cited.
- **The nine taras:** see `04-tara-bala-and-chandra-bala.md`.

## 2. When it applies
- The transits of all planets, especially the slow ones, over the person's stars, name syllable, sign, tithi group and weekday.
- Muhurta.

## 3. Inputs required
- The janma nakshatra.
- The first syllable of the person's name, if used.
- The nakshatras of the transiting planets, and their retrograde or fast status.

## 4. Calculation / rule

### A. The tara cycle
[COMM] For each transiting planet:
- count = (planet star − janma star) mod 27 + 1;
- tara = (count − 1) mod 9 + 1.

Malefics in taras 3, 5 and 7 are bad; see PD 26:28 in the next part.

### B. Named stars
[TEXT] PD 26:26-28.

| Star from janma | Name (common usage) | Text |
|---|---|---|
| 1st | Janma | PD 26:26 |
| 10th | Karma | PD 26:26 (karman) |
| 19th | Adhana | PD 26:26 (ādhāna); some sources give the 21st, see §6 |
| 3rd, 5th, 7th, 23rd | Vipat, Pratyari, Vadha, Vainashika | PD 26:28 lists 19, 10, 3, 1, 23, 5 and 7 |

- **[TEXT] PD 26:28.** Malefics afflicting these stars endanger life. Benefics there only cause failure in business.

### C. The saptashalaka grid of PD 26:26
- Draw 7 horizontal and 7 vertical lines, giving 28 line-ends.
- Place the stars from Krittika onward, starting in the NE.
- A planet on one end pierces the star at the other end of the same line.
- The Sun piercing the janma star means death; the adhana star, fear; the karma star, loss of wealth.

### D. The Sarvatobhadra chakra
[TEXT, unverified]
- **The grid:** 9x9 cells holding:
  - the 28 nakshatras, including Abhijit, on the outer ring;
  - the vowels and consonants (avakahada);
  - the 12 signs;
  - the tithi groups (Nanda, Bhadra, Jaya, Rikta, Purna);
  - the weekdays.
- **Vedha:** each planet pierces along three lines from its star: straight across, and the two diagonals.
- **Which lines are active:** this depends on the planet's motion (direct, retrograde or fast). Sources give different
  mappings, and none was verified against Narada Samhita, so no mapping is given here. See §9.

## 5. Interpretation rules
- **[TEXT]** PD 26:26-29 as above. The janma triad under eclipse or sankranti is the worst case.
- **[COMM]** Sarvatobhadra: malefic vedha on the janma star, name letter, sign, tithi and weekday together is the most severe. Benefic vedha protects.

## 6. Variants and disputes
- **The adhana and vainashika counts:**
  - adhana: the 19th in PD 26 and most sources; one Wikipedia version uses the 21st;
  - vainashika: the 22nd or the 23rd.
- **The two grids** (the 28-star saptashalaka grid and the 9x9 Sarvatobhadra) are often confused in modern writing. Keep them separate.

## 7. Worked micro-example
1. The janma star is Ashvini.
2. Saturn transits Ashlesha, the 9th star. That is tara 9, Parama mitra: mild.
3. Saturn then moves on to Magha, the 10th star. That is the karma star: work pressure.

## 8. Design notes for AI Astra
- **Engine additions:**
  - the tara and named-star label for each planet's star, counted from the janma star;
  - a Sarvatobhadra vedha list per day: shared grid positions, plus a per-person overlay of hits on the person's star, letter, sign, tithi and weekday;
  - the saptashalaka piercing per PD 26:26.
- **Board:** Lucky and Today; Self for the slow planets. Weight: low to medium.
- **Pitfall:** the name syllable is personal data. Only use it if the user has given it.

## 9. Open questions
- Read the Narada Samhita Sarvatobhadra verses and fix the motion-to-vedha line rule before building.
- Confirm the adhana count (19 versus 21).
