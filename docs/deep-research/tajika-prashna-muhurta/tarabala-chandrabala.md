# Tarabala and Chandrabala (tārā-bala, candra-bala)

> These are the two personal filters muhurta applies on top of the shared panchang. *Tārābala* counts the day's
> nakṣatra from the person's birth star in cycles of nine "stars" (Janma, Sampat, Vipat …) and marks some as harmful.
> *Candrabala* counts the Moon's current sign from the natal Moon sign and approves only some houses (8th =
> *candrāṣṭama*, the worst). Every muhurta text and modern app uses them. They are the minimum that makes a "lucky
> time" personal. The rules are simple, and the house sets are stable.

## 1. Sources

| Text | Status |
|---|---|
| *Muhūrta-cintāmaṇi*, Gocara-prakaraṇa (ch. 4) and Śubhāśubha | Chapter level. **Verse not verified** |
| *Muhūrta-mārtaṇḍa*, *Kālaprakāśikā* | Not read |
| Doc 47 §3.2 (repo): Drik's wording for taras; chandrabala 1, 3, 6, 7, 10, 11 good; 4, 8, 12 bad | Repo background |

## 2. When it applies

Every elected moment for a person, and the personal overlay of Lucky Times.

## 3. Inputs required

The person's janma nakṣatra (natal Moon star) and natal Moon sign; the day's nakṣatra and Moon sign at the moment (with change times).

## 4. Calculation

**Tārābala [TEXT]:** n = count from the janma star to the day's star, inclusive. r = n mod 9 (r = 0 means 9).

| r | Tārā | Quality |
|---|---|---|
| 1 | Janma | Mixed. Avoid major starts and medical procedures [COMM] |
| 2 | Sampat (wealth) | Good |
| 3 | Vipat (danger) | Bad |
| 4 | Kṣema (well-being) | Good |
| 5 | Pratyari / Pratyak (obstacle) | Bad |
| 6 | Sādhaka (accomplishment) | Good |
| 7 | Vadha / Naidhana (death) | Worst |
| 8 | Mitra (friend) | Good |
| 9 | Parama-mitra (great friend) | Good |

[COMM] The bad tārās are milder in the 2nd and 3rd cycles of nine. Remedies by gift are prescribed for the 3rd, 5th and 7th.

**Candrabala [TEXT]:** h = the house of the transiting Moon counted from the natal Moon sign.
Good: 1, 3, 6, 7, 10, 11. Bad: 4, 8, 12 (8 = candrāṣṭama, about 2¼ days a month). Mixed: 2, 5, 9 [COMM]
(some count 2, 5, 9 good in the bright fortnight).
[COMM] Rule attributed to the muhurta texts: in the bright fortnight candrabala matters most, in the dark fortnight tārābala. Verse not verified.

## 5. Interpretation rules

- [TEXT] A muhurta with a good panchang but a bad tārā or candrāṣṭama is rejected for that person.
- [COMM] Good candrabala can lift a weak tārā, but not the 7th tārā.

## 6. Variants and disputes

Counting the inclusive vs. exclusive star (the inclusive convention is standard). Whether to use the star at sunrise or at the moment (use the moment). 2/5/9 houses.

## 8. Design notes for AI Astra

- Engine (served): `muhurta` with natal fields returns `days[].tara`, `chandra_bala` and `grade` at noon (doc 47 §1).
  `drik.thaaraabalam` uses r = count mod 9 with good = {Paramitra, Sampat, Kshema, Sadhaka, Mitra}, which matches.
- **Check:** `drik.chandrabalam` uses `cb_good = [1,3,6,7,10]`. **The 11th is missing**, but the texts and doc 47
  include it. Verify which function `daily_export` uses for `chandra_bala`, and file the 11th-house omission for the
  engine-rule-verifier.
- Engine additions: per-transition values (the Moon's star and sign changes inside the day, so tārā and candrabala
  change mid-day); a `chandrashtama` boolean with start and end times; and the tārā name and cycle number.
- Serves: the personal overlay of Lucky Times (one engine call per person per month, doc 47 §3.2), and every event muhurta. Weight: a hard personal gate for big starts (Vipat, Pratyari, Vadha, candrāṣṭama). A soft modifier otherwise.

## 9. Open questions

- The bright/dark-fortnight priority rule is a verse-level check.
