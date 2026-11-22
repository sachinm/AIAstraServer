# Naisargika karakas (naisargika-kāraka, "natural significators")

> Naisargika karakas are the natural significations of the nine planets (and the natural planet for each house): Sun for self and father, Moon for mother and mind, Venus for marriage, Jupiter for children and fortune, Saturn for longevity and losses, and so on. They answer "which planet naturally rules this matter?" and are used everywhere in Parashari reading, in Jaimini as the "house from the karaka" reference, and as the default when chara and sthira roles do not apply. The most widely used of the three karaka types.

## 1. Sources

- **BPHS-ELS** ch. 32 vv. 31-37 (bhava karakas: planets as karakas of houses) [chapter 32](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-32). The full significations of each planet are in BPHS's planetary-characters chapter (ch. 3), not extracted here.
- **JUS-R** 1.1 TOC lists "Naisargikakaraka or Permanent Lord" and Rao's note on 1.1.11 says naisargika karakas supply a karakatva left empty by ties [COMM] [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row).
- **PVR** §8.1, §8.4, Tables 15-16 [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).

## 2. When it applies

Every chart, every topic, for "general results" (*phalita*). In Jaimini-style work they define reference points such as 7th from Venus (marriage), 5th from Jupiter (children), 4th from Moon (mother), 10th from Mercury (work, per PVR's table).

## 3. Inputs required

Planet signs and houses; the static karaka table; optionally the house-from-karaka counts.

## 4. Calculation

No calculation beyond counting houses from the karaka planet. Primary house karakas as given by PVR Table 15 (paraphrase): 1st Sun; 2nd Jupiter; 3rd Mars; 4th Moon; 5th Jupiter; 6th Mars; 7th Venus; 8th Saturn; 9th Jupiter; 10th Mercury; 11th Jupiter; 12th Saturn [MODERN PVR §8.4]. BPHS's bhava-karaka list gives several planets for some houses (e.g. 10th: Sun, Mercury, Jupiter, Saturn) [TEXT BPHS-ELS 32.34, via summary; check print edition].

## 5. Interpretation rules

- For naisargika karakas, take the relevant house **from** the karaka (7th from Venus shows husband/wife for marriage timing), unlike sthira and chara karakas which are the person themselves [MODERN PVR §8.3].
- Naisargika karakas show impersonal things and all of creation, presided by Brahma; chara karakas by Vishnu (sustenance, people), sthira by Shiva (death) [MODERN PVR §8.1]. This tri-deity framing is PVR/SJC, not found in the sutras read.
- Use the karaka type that matches the question: birth of children → 5th from Jupiter; achievements and suffering through children → PK; death of a child → Jupiter as sthira [MODERN PVR §8.4].

## 6. Variants and disputes

- Bhava karaka lists differ between texts (BPHS vs Phaladeepika vs Saravali) for houses 4, 6, 10. PVR gives one primary planet per house.
- Venus for marriage in both sexes (PVR) vs Jupiter for husband in female charts (common Parashari practice) [MODERN; disputed].

## 7. Worked micro-example

Marriage timing in PVR's transit example: natal 7th lord and Venus, and the 7th from Venus, are checked against transits; Jupiter aspecting the natal 7th and its lord at the wedding [MODERN PVR §25, Example 104].

## 8. Design notes for AI Astra

- **Engine status:** static knowledge; not an engine output. Whether any existing export already gives houses counted from a planet was not checked.
- **Engine addition:** export a `naisargika_frames` block: for each life area the karaka planet and the 12 houses counted from it (e.g. `from_venus`, `from_jupiter`, `from_moon`), so no reader counts houses itself.
- **Boards:** Love (Venus frame), family (Moon, Sun, Jupiter frames), Work (Mercury/Saturn/Sun frames).
- **Weight:** baseline layer under every reading; lower than house lords for timing, higher than chara karakas for "what kind of thing".
- **Pitfall:** do not let a reader switch karaka type mid-reading; record the type with each claim.

## 9. Open questions

- BPHS ch. 3 planetary significations and the full bhava-karaka verse were not extracted line by line.
