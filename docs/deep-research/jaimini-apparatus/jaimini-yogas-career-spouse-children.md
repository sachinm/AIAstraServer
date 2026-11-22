# Jaimini yogas for career, spouse and children

> This file collects, by life area, the Jaimini and Parashari-Jaimini rules (from the karaka, pada, upapada and karakamsha apparatus) that read career/vocation, spouse/marriage and children. The tools themselves are defined in their own files; this file is the routing table a reading needs. The rules are classical but terse; modern SJC practice adds varga-specific padas (A10 in D10, A7 in D10) and UL-based marriage durations.

## 1. Sources

JUS-A 1.2, 1.3, 1.4 [archive.org](https://archive.org/details/jaimini-kva-a-4-size); JUS-R 1.2 [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row); BPHS-ELS ch. 29, 30, 32, 33 ([29](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-29), [30](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-30), [33](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-33)); PVR ch. 8-11 [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).

## 2. When it applies

All charts; Work, Love and family readings.

## 3. Inputs required

Chara karakas (AK, AmK, DK, PK) with scheme; karakamsha frame (D9 and D1); AL, A7, A10, A5, UL with houses from them; occupants, dignities and rasi aspects; D10 padas (modern).

## 4. Calculation

No new calculation; uses the frames in `chara-karakas.md`, `karakamsha-swamsha.md`, `arudha-padas.md`, `upapada-lagna.md`.

## 5. Interpretation rules

### Career and vocation
- Planets in karakamsha give the vocation (Sun government; Moon+Venus learning/arts; Mars weapons, fire, engineering; Mercury trade, crafts, law; Jupiter teaching/scripture; Venus government association; Saturn renowned in the family line of work; Rahu machinery, metals; Ketu trades) [TEXT JUS-R 1.2.14-22; BPHS-ELS 33.13-18].
- 10th from karakamsha: benefics stable wealth; malefics business loss; Mercury + Venus great business profit; Sun + Moon with Jupiter's aspect a ruler [TEXT BPHS-ELS 33.57-60].
- 5th from karakamsha (and karakamsha itself) for learned professions: authorship, logic, philosophy, music, mathematics/astrology (Ketu) [TEXT BPHS-ELS 33.39-44, 33.88-91].
- AmK is the minister/advisor and, in SJC practice, the significator of career direction [MODERN PVR §8.2 ("ministers", advisors)].
- 11th/12th from AL: income and expense sources by planet [TEXT JUS-A 1.3.1-12; BPHS-ELS 29.8-22].
- A10 in D10 = workplace; 10th from AL in D10 = status in career [MODERN PVR §9.3-9.4].
- Raja yogas: see `jaimini-raja-yogas.md` (malefics in 3/6 from lagna lord or 7th lord → army/command; Jupiter, Venus or Moon in 5th from them → high official [TEXT JUS-A 1.3.35-36]).

### Spouse and marriage
- DK is the spouse itself [MODERN PVR §8.3].
- UL and its 2nd: nature, family, health and continuity of marriage; malefics without benefic aspect → loss/renunciation [TEXT JUS-A 1.4.1-22; BPHS-ELS 30.1-22].
- 7th from lagna and from UL give the same results [TEXT JUS-A 1.4.23; BPHS-ELS 30.23].
- 7th from karakamsha: Moon + Jupiter very beautiful spouse; Venus passionate; Mercury artistic; Saturn older spouse; Rahu widow/divorcee [TEXT BPHS-ELS 33.47-48].
- A7 vs AL: kendra/trikona → harmony and wealth; 6/8/12 → enmity [TEXT JUS-A 1.3.18-21; BPHS-ELS 29.31-34].
- 8th from UL = duration of marriage; 2nd/7th from UL = end [MODERN PVR §9.4].
- Venus and Mars in the 2nd from svamsha → adultery; Venus/Mars in the 9th from karakamsha → harmful liaisons [TEXT BPHS-ELS 33.30, 33.54-55] (sensitive; internal only).

### Children
- Mercury, Saturn and Venus together in the 7th from lagna or UL → no issue [TEXT JUS-A 1.4.24].
- Sun, Rahu, Jupiter in the 9th (Abhyankar's reading; BPHS-ELS 30.25 summary does not name the house clearly) from AK, lagna, pada or UL → many sons; Moon → one son; mixed → a son late; Mars + Mercury (JUS-A) or Mars + Saturn (BPHS) → adoption; odd signs → many children (BPHS: daughters), Gemini/even → few [TEXT JUS-A 1.4.25-31; BPHS-ELS 30.25-29].
- Repeat the progeny test in the 5th-house navamsa and, per BPHS, in the trimshamsha with the progeny karaka [TEXT BPHS-ELS 30.30].
- PK is the child (and followers); 5th from Jupiter for birth of children; A5 for followers/mantra [MODERN PVR §8.4, Table 18].
- Venus afflicting lagna, pada or 8th → miscarriage or interrupted pregnancy [TEXT BPHS-ELS 30.32].

### Siblings (same pada)
- Saturn + Rahu in the 3rd/11th → loss of younger/elder siblings; Moon, Jupiter, Mercury, Mars there → many siblings; Ketu → sisters [TEXT JUS-A 1.4.32-38; BPHS-ELS 30.31-36]. The reference (lagna vs pada) differs between the two summaries.

## 6. Variants and disputes

- House for the children sutras: 9th (JUS-A translation) vs 5th (common reading; BPHS summary unclear). Needs a print check.
- Mars + Mercury vs Mars + Saturn for adoption (JUS-A vs BPHS-ELS).
- D1 vs D9 frame for karakamsha houses (see karakamsha file).
- Divorce from UL's 2nd/7th/8th is modern [MODERN PVR].

## 7. Worked micro-example

See PVR §9.4 UL example in `upapada-lagna.md`.

## 8. Design notes for AI Astra

- **Engine additions:** none beyond the frames listed in the other files; plus a `jaimini_area_flags` block that evaluates each rule above per chart with a rule id (e.g. `BPHS-ELS 33.59`, `JUS-A 1.4.24`), participating planets and frame (D1/D9), so readers cite rules instead of counting houses.
- **Boards:** Work (karakamsha planets, 10th from K, AmK, AL 10/11/12, A10 D10); Love (DK, UL block, 7th from K, A7-AL); family/children cards (PK, UL children rules).
- **Weight:** use as confirming layers next to Parashari house/lord analysis; vocation-type claims from karakamsha are strongest when echoed by the 10th lord and D10.
- **Pitfalls:** many sutra outcomes are harsh (no issue, adultery, loss of spouse); keep them as internal pressure flags; confirm with the user before predicting.

## 9. Open questions

- Children sutra house (5th vs 9th) and adoption pair need checking in Rao, Rath and a print BPHS.
- SJC's use of D10 padas (A7, A10) has no classical verse in sources read; it is PVR's extension.
