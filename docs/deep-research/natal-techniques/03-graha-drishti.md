# Graha drishti — planetary aspects (graha dṛṣṭi)

> Graha drishti is how a planet influences houses and planets other than the one it occupies.
> - All planets aspect the 7th house from themselves in full.
> - Mars, Jupiter and Saturn have extra full aspects.
> - Every planet also casts partial aspects (¼, ½, ¾) on the 3rd/10th, 5th/9th and 4th/8th.
>
> BPHS also gives a degree-based formula (sphuta drishti) that yields a value in virupas, used in Shadbala and Bhava bala. Sign-based (whole-house) full aspects are used for everyday reading; the sphuta values are used for strength arithmetic. Rasi drishti (sign aspects, Jaimini) is covered elsewhere.

## 1. Sources
- **BPHS ch. 26 "Evaluation of Drishtis of Grahas"** (Santhanam numbering = BPHS-ET):
  - vv. 2-5: the aspects on the 3rd/10th, 5th/9th and 4th/8th rise "in slabs of quarters"; all planets aspect the 7th fully; Saturn, Jupiter and Mars aspect the 3rd/10th, 5th/9th and 4th/8th respectively in full (V). The fraction symbols are garbled in the e-text; the ¼, ½, ¾ values are (R).
  - vv. 6-8: aspect value from the longitude difference (aspecting minus aspected) (V).
  - vv. 9-12: special rules for Saturn, Mars and Jupiter (V).
  - E-text: https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- **BPHS-GCS** (wisdomlib) numbers this ch. 28 "Evaluation of Planetary Aspects" (V, table of contents).
- **Brihat Jataka 2.13**: tridaśa, trikoṇa, caturasra, saptama (3/10, 5/9, 4/8, 7th), with the special full aspects of Saturn, Jupiter and Mars (V, Sanskrit keyword reading; BJ-Neely, https://www.wisdomlib.org/hinduism/book/brihat-jataka-by-varahamihira-sanskrit-english/d/doc1501537.html).
- **Saravali ch. 4** and **Phaladeepika ch. 2** restate them (R).

## 2. When it applies
- All charts: D1 for reading. Vargas mostly use only sign-based full aspects.
- All life areas.

## 3. Inputs required
- Sidereal longitudes of the planets and of the bhava madhyas.
- Sign positions.

## 4. Calculation / rule
**Sign-based**, counting from the planet's sign:

| House from planet | All planets | Special full |
|---|---|---|
| 3rd, 10th | ¼ | Saturn full |
| 4th, 8th | ¾ | Mars full |
| 5th, 9th | ½ | Jupiter full |
| 7th | full | — |

Rahu and Ketu: BPHS does not give them graha drishti clearly. Many give Rahu the 5th, 7th and 9th like Jupiter [COMM/MODERN, disputed].

**Sphuta drishti** (BPHS 26.6-8, V for the method; piecewise values R, matching Raman). Let K = aspected longitude − aspecting longitude (0-360).

The BPHS-ET wording reads "deduct the longitude of the Grah that receives the Drishti from that of the Grah which gives it", which is the reverse. Taken literally, that would give a 4th-house aspect only 15 virupas. The table below follows Raman's direction, which reproduces the ¼, ½, ¾ quarters. Flag the wording as a translation issue.

Value in virupas:

| K range | Drishti |
|---|---|
| 0-30 | 0 |
| 30-60 | (K − 30) / 2 |
| 60-90 | (K − 60) + 15 |
| 90-120 | (120 − K) / 2 + 30 |
| 120-150 | 150 − K |
| 150-180 | (K − 150) × 2 |
| 180-300 | (300 − K) / 2 |
| 300-360 | 0 |

These values peak at 60 at K = 180 and reach 45 at 90 and 30 at 120. That matches the ¾ (4th) and ½ (5th) quarters at the centre of each sign.

Special adjustments (26.9-12, V that they exist; values R):
- Saturn adds to reach 60 at its 3rd/10th aspects.
- Mars adds to reach 60 at its 4th/8th.
- Jupiter adds to reach 60 at its 5th/9th.

## 5. Interpretation rules
- [TEXT] A full aspect transmits the planet's nature to the house or planet aspected. A benefic aspect protects; a malefic aspect damages (BPHS 11, 26, R).
- [TEXT] Drik bala = ¼ (benefic drishti − malefic drishti) (BPHS 27, R).
- [COMM] An aspect from a house's own lord strengthens it even if the lord is a malefic.
- [MODERN] Most practitioners read only full sign-based aspects in delineation and use sphuta values only in balas. Partial aspects are rarely cited in readings.

## 6. Variants and disputes
- **Rahu/Ketu aspects**: none, the 5th/7th/9th, or the 5th/7th/9th/12th, by school. SJC gives Rahu the 5th, 7th, 9th and 12th via rasi drishti logic (R).
- **Sign-based vs degree-based** full aspects: some (Raman, KP-influenced) use orbs; Parashari readers mostly use signs.
- **Sphuta special-aspect corrections** differ slightly between commentators.

## 7. Worked micro-example
Saturn at 10° Aries aspects Cancer (its 4th):
- Sign-based, this is a ¾ aspect.
- Sphuta for a planet at 10° Cancer: K = 90, value 45 virupas (¾).

Saturn's special aspect falls on Gemini (3rd) and Capricorn (10th) in full.

## 8. Design notes for AI Astra
- **Engine already has**:
  - `house.graha_drishti_from_chart`;
  - `aspected_planets/houses_of_the_planet`;
  - `planets_aspecting_the_planet`;
  - `strength._drik_bala` and `planet_aspect_relationship_table`.
- **Must output per planet**:
  - the houses and planets fully aspected (sign-based);
  - the sphuta drishti value (virupas) on every planet and bhava madhya;
  - the Rahu/Ketu aspect rule used, as a flag.
- **Board use**: every house card lists aspects received with the benefic/malefic tag and value.
- **Pitfall**: be explicit whether "aspect" means full sign-based or sphuta above a threshold. Mixing them confuses readers.

## 9. Open questions
- Confirm the Saturn, Mars and Jupiter sphuta corrections against a clean BPHS print.
- Product decision: should Rahu and Ketu aspect (and which houses)?
