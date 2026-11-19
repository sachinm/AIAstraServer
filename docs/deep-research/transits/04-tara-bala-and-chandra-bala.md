# Tara bala and Chandra bala (tārā-bala, candra-bala)

> Two daily strength checks from muhurta texts. Tara bala counts the day's star, or a planet's star, from the janma
> nakshatra in cycles of nine. Chandra bala takes the house of the transiting Moon from the natal Moon. They decide
> whether a day is supportive for the person. They are universal in muhurta practice, and they are day-level only.

## 1. Sources
- **Muhurta Chintamani** (Rama Daivajna): tara and chandra-bala rules. Not opened in this pass, so verse numbers are not given.
- **Phaladeepika 26:28-29** (siva.sh) uses the same star counts from the janma star for malefic transits. https://www.siva.sh/phaladeepika/26/26-30
- **Chandra bala houses:** the Moon's good houses in PD 26:4 (1, 3, 6, 7, 10, 11) coincide with chandra bala. https://www.siva.sh/phaladeepika/26/1-5

## 2. When it applies
Day and muhurta selection: the Today and Lucky boards.

## 3. Inputs required
- The janma nakshatra and the natal Moon sign.
- The Moon's star and sign for the day, or the star of the transiting planet being checked.

## 4. Calculation / rule

### Tara bala
1. count = (day star − janma star) mod 27 + 1.
2. tara = (count − 1) mod 9 + 1.

| Tara | Name | Quality |
|---|---|---|
| 1 | Janma | mixed (tense; avoid for new work) |
| 2 | Sampat | good |
| 3 | Vipat | bad |
| 4 | Kshema | good |
| 5 | Pratyak (Pratyari) | bad |
| 6 | Sadhana (Sadhaka) | good |
| 7 | Naidhana (Vadha) | bad |
| 8 | Mitra | good |
| 9 | Parama mitra (Ati-mitra) | good |

The quality column is [COMM] traditional muhurta practice; no verse was verified.

### Chandra bala
1. house = (Moon's sign − natal Moon sign) mod 12 + 1.
2. Good in 1, 3, 6, 7, 10 and 11 (PD 26:4 houses).
3. Bad in 4, 8 and 12. The 8th is the worst (chandrāṣṭama) [COMM].
4. [COMM] In the bright half (śukla pakṣa), 2, 5 and 9 are also acceptable.

## 5. Interpretation rules
- **[COMM]** Tara bala is checked for the Moon's daily star. In the bright fortnight chandra bala weighs more; in the dark fortnight tara bala weighs more. Widely stated; verse not verified.
- **[TEXT] PD 26:28.** Malefics transiting the 1st, 3rd, 5th, 7th, 10th, 19th and 23rd stars from the janma star endanger life. Benefics there only spoil business.
  - Most of these counts are taras 3, 5 and 7 and their repeats.
  - The 1st, 10th and 19th are the janma triad.
- **[COMM]** The bad taras are remedied by gifts. That is out of product scope.

## 6. Variants and disputes
- **Tara names differ between modules of the engine:**
  - `daily_export.py` uses Pratyak, Sadhana, Naidhana, Parama Mitra.
  - `facts_export.py` uses Pratyari, Sadhaka, Vadha, Ati-mitra.
  - Both naming sets are traditional. The product should pick one display set.
- **Janma tara:** some schools call it bad, others mixed. The engine leaves it `null` (neither good nor bad).
- **Counting point:** some count tara from the star of the Lagna (lagna-tara). This is [MODERN]/SJC usage.

## 7. Worked micro-example
1. The janma star is Bharani (2) and the day's Moon is in Hasta (13).
2. count = (13 − 2) mod 27 + 1 = 12.
3. tara = (12 − 1) mod 9 + 1 = 3, Vipat: avoid starting things.

## 8. Design notes for AI Astra
- **Already in the engine:** `daily_export.py`, with `tara_of`, `chandra_bala_of` and `grade_of`.
- **Engine addition:** the tara of each slow planet's star counted from the janma star. This reuses the same function.
- **Board:** Today and Lucky. Never use it for multi-year readings.
- **Pitfall:** use one naming set in user-facing copy.

## 9. Open questions
- Verify the tara qualities and the paksha rule in Muhurta Chintamani, and get the verse numbers.
