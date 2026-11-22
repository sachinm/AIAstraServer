# Special lagnas (viśeṣa lagna): Bhava, Hora, Ghati, Varnada, Sri, Indu lagna and Pranapada

> Special lagnas are alternative ascendants. Bhava, Hora and Ghati lagnas start at the Sun's sunrise longitude and advance at fixed rates (one sign per 5, 2½ and 1 ghati); Hora lagna is read for wealth and Ghati lagna for power and fame. Varnada lagna combines the lagna and hora lagna and drives Varnada dasha and longevity of relatives. Sri lagna (modern, SJC) adds the Moon's nakshatra fraction of the zodiac to the lagna, for prosperity. Indu lagna (Uttara Kalamrita) uses planetary "kalas" of the 9th lords for wealth. Pranapada is a fast-moving point used to check birth time and judge the auspiciousness of birth. Reliability depends heavily on exact birth time (GL moves 1°15' per minute).

## 1. Sources

- **BPHS-ELS** ch. 5 vv. 1-9 (site numbering, via summary): Bhava lagna from sunrise in units of 5 ghatis; Hora lagna in units of 2½ ghatis; Ghati lagna one sign per ghati; each from the Sun at sunrise; draw a separate chart for each. vv. 10-24 Varnada (counting from Aries for odd and from Pisces for even lagna to lagna and to HL; add if same parity, subtract if different; stronger of lagna and HL governs; Varnada dasha; 7th from varnada for spouse's longevity, 11/3/5/4/9 for siblings, son, mother, father) [chapter 5](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-5).
- **BPHS-ELS** ch. 3 vv. 71-74: Pranapada calculation from the Sun's sign type and time; Pranapada in trine, 4th, 10th (or 11th) from lagna → auspicious birth, else inauspicious [chapter 3](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-3).
- **BPHS-ELS** ch. 39 v. 24: lagna, HL and GL (all three or two) aspected by an exalted planet → raja yoga [chapter 39](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-39).
- **JUS-A** 1.3.24: one planet aspecting janma lagna, hora lagna and ghatika lagna → king [archive.org](https://archive.org/details/jaimini-kva-a-4-size). **JUS-R** 1.1 TOC lists Varnada, Ghatika, Bhava, Chandra and Hora lagnas and their uses [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row). JUS-A 2.1.6: longevity pair "Ascendant and the Ascendant hour" (lagna and hora lagna).
- **PVR** ch. 5 (BL, HL, GL, Sri lagna, computation and use), §7.3.7-8, §11.7.3(6)-(8) [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).
- **UK** ch. IV (Sastri tr., p. 97; verse number not legible in OCR; a secondary source cites ch. 4 sl. 27): Indu lagna; summarised in repo note `research_notes/Sanjay Rath open method gaps/indu_lagna.md` with [archive.org text](https://archive.org/stream/uttara-kalamritam./Uttara%20kalamritam._djvu.txt).

## 2. When it applies

All charts with a reliable birth time (to the minute for GL). Life areas: wealth (HL, Sri lagna, Indu lagna), power, status, fame, career promotion and elections (GL), longevity and relatives (Varnada), birth-time rectification and quality of birth (Pranapada, BL).

## 3. Inputs required

Sunrise time (PVR prefers upper limb) and the Sun's longitude at sunrise; birth time; lagna longitude; Moon longitude and nakshatra; 9th lords from lagna and Moon (Indu); Sun's sign type (Pranapada); lagna and HL parity (Varnada); planet strengths for "stronger of lagna and HL".

## 4. Calculation

Let t = minutes from sunrise to birth; S = Sun's longitude at sunrise.
- **Bhava lagna (BL)** = S + t × 0.25° (1 sign per 5 ghatis = 2 hours) [TEXT BPHS-ELS 5.2-3; MODERN PVR §5.2 gives 1° per 4 minutes].
- **Hora lagna (HL)** = S + t × 0.5° (1 sign per 2½ ghatis = 1 hour) [TEXT BPHS-ELS 5.4-5; MODERN PVR §5.3].
- **Ghati lagna (GL)** = S + t × 1.25° (1 sign per ghati = 24 minutes) [TEXT BPHS-ELS 5.7-8; MODERN PVR §5.4].
- **Varnada lagna (VL):** for lagna and HL, count from Aries (odd sign, forward) or from Pisces (even sign, backward) to the sign; add the two counts if both odd or both even, subtract if mixed; count the result from Aries or Pisces as before [TEXT BPHS-ELS 5.11-15]. Several modern variants (see §6).
- **Sri lagna (SL):** fraction f of the Moon's nakshatra traversed; SL = lagna + f × 360° [MODERN PVR §5.7; no classical verse found].
- **Indu lagna:** kalas Sun 30, Moon 16, Mars 6, Mercury 8, Jupiter 10, Venus 12, Saturn 1; add the kalas of the 9th lord from lagna and the 9th lord from the Moon; divide by 12; count the remainder (0 → 12) from the Moon's sign [TEXT UK ch. IV via repo note].
- **Pranapada:** BPHS gives a time-based rule tied to the Sun's movable/fixed/dual sign (vv. 71-72); the summarised verse is not clear enough to restate exactly. Engine library has `pranapada_lagna` (method not reviewed here).

## 5. Interpretation rules

- HL = self from the point of view of money and prosperity; GL = self from the point of view of power, fame, authority; time businessmen from HL and politicians from GL [MODERN PVR §5.6, §7.3.7-8].
- Same planet aspecting lagna, HL and GL → raja yoga [TEXT JUS-A 1.3.24; BPHS-ELS 39.24 (exalted planet aspecting all three or two)]; planets joining/aspecting HL give wealth, GL power; extends to lords and ownership [MODERN PVR §11.7.3(6)]; lagna, HL and GL each holding an own/exalted planet → king [MODERN PVR §11.7.3(8)].
- Sri lagna is used for prosperity, especially as the starting point of Sudasa [MODERN PVR §5.7, ch. 20].
- Indu lagna: benefic without malefic → very great wealth; malefic → modest wealth; exalted malefic → very great wealth again [TEXT UK ch. IV]. Kendra/trikona and 3/6/8/12 dasha rules from Indu lagna are modern and unsourced classically (repo note).
- Varnada: malefic association in trines from VL ends life in that sign's dasha; 7th from VL for spouse's longevity, 11th/3rd siblings, 5th son, 4th mother, 9th father [TEXT BPHS-ELS 5.16-20].
- Pranapada in trine, 4th, 10th or 11th from lagna → auspicious birth [TEXT BPHS-ELS 3.73-74]; used for birth-time rectification [MODERN].

## 6. Variants and disputes

- **Sunrise definition:** disc centre vs upper limb [MODERN PVR §5.5]; shifts GL by over a degree.
- **Varnada lagna:** the engine library implements five methods (Sanjay Rath, Jha-Pandey, B. V. Raman, Santhanam, Sharma) in `charts.py`; they differ on counting direction and on whether the result is counted from Aries/Pisces or from lagna. Which is classical is unresolved here.
- **Sri lagna** has no classical verse in sources read; it is an SJC/PVR construct (possibly tradition-based).
- **Indu lagna:** some calculators count "7 from the Moon"; conflicts with the verse (repo note).
- **Ghati lagna vs Ghatika:** same thing; BPHS cites Narada for the rate.

## 7. Worked micro-example

PVR Examples 8-9: sunrise 6:37, Sun 24°17' Capricorn, birth 19:23 (766 min). HL = 294°17' + 383° → 17°17' Aquarius. GL = 294°17' + 957°30' → 21°47' Virgo.

Inconsistency in the source: PVR's BL Example 7 adds 1° per minute (766°, giving 10°17' Pisces), which contradicts both his own stated rate (one sign per 2 hours = 0.25°/min) and BPHS 5.2-3 (one sign per 5 ghatis). At 0.25°/min the same data give 294°17' + 191°30' = 125°47' = 5°47' Leo. PVR also notes he does not use BL in the book. The engine should follow the BPHS rate and record it.

## 8. Design notes for AI Astra

- **Engine status:** `natal_export.py::_map_special_points` exports SL, HL, Gulika and Maandi per varga. The library also has `drik.special_ascendant` (BL/HL/GL family), `drik.pranapada_lagna`, `drik.indu_lagna`, `drik.sree_lagna`, `charts.varnada_lagna` (five methods) and `charts.special_lagna_longitudes`; these are not in `natal_export.py`.
- **Engine additions:** export GL, BL, VL (with `method`), Indu lagna (with kala sum and remainder), Pranapada, each with sign, degree, house from lagna, occupants and rasi aspects, for D1 and D9 (and D10 for GL); a `special_lagna_yogas` block: planets common to lagna/HL/GL by occupation, rasi aspect or lordship (PVR rule 6) and own/exalted occupants (rule 8); a `birth_time_sensitivity` field (minutes until GL/HL change sign).
- **Boards:** Lucky/money (HL, SL, Indu), Work (GL for promotions and power), Self (raja yoga flags).
- **Weight:** medium; high only when birth time is verified. Show as supporting evidence, not as lead claims.
- **Pitfalls:** GL is meaningless with rounded birth times; pyjhora's own varga mapping of these points is not trusted by the export (see docstring in `_map_special_points`), so new points must use the same mapping.

## 9. Open questions

- Exact Pranapada rule (BPHS 3.71-72) needs a print-edition reading.
- Classical source of Sri lagna.
- Which Varnada method SJC teaches as default; Rath's method exists in the library but was not compared with BPHS here.
- Kunda lagna and Bhrigu bindu exist in the library but are outside this scope.
