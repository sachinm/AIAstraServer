# Sthira karakas (sthira-kāraka, "fixed significators")

> Sthira karakas are a fixed planet-to-relative mapping (father, mother, siblings, maternal kin, paternal kin and children, spouse and in-laws, elder siblings) that does not change between charts. Their main stated job in the Jaimini system is timing the death or physical calamities of relatives (with Shoola-type dashas), and they stand in for a chara karaka lost to a tie. Widely taught, but used in practice mostly by Jaimini specialists.

## 1. Sources

- **JUS-R** 1.1.20-23 (Mars, Mercury, Jupiter, Venus significations of relatives); 1.1.24 Saturn weakest [archive.org](https://archive.org/details/Astrology_Books_by_B_Suryanarayana_Row).
- **JUS-A** Adhyaya 1 Pada 1 (approx. 1.1.20-24): Mars sister, brother-in-law, younger brother, mother; Mercury maternal relatives; Jupiter grandfather, husband, son; Venus "or rather the next four" Venus, Saturn, Sun, Moon for wife, parents, parents-in-law, mother's parents; Saturn weakest. Adhyaya 2 Pada 2 opening: stronger of Sun and Venus rules father; stronger of Moon and Mars rules mother [archive.org](https://archive.org/details/jaimini-kva-a-4-size).
- **BPHS-ELS** ch. 32 vv. 18-24 (site numbering, via summary): stronger of Sun/Venus father; stronger of Moon/Mars mother; Mars siblings; Mercury maternal relations; Jupiter paternal grandfather; Venus wife/father; Saturn sons (variant); plus house pairings [chapter 32](https://enjoylearningsanskrit.com/scriptures/parashara/chapter-32).
- **PVR** §8.1, §8.3 [PDF](https://www.vedicastrologer.org/articles/vedic_astro_textbook.pdf).

## 2. When it applies

Death and severe affliction of relatives (longevity of father, mother, siblings, spouse, children) in Jaimini longevity and Shoola/Niryana work; substitute for a chara karaka lost to a tie. Not for general relationship quality (use chara or naisargika).

## 3. Inputs required

Planet positions; a planet-strength comparison (Jaimini strength rules: conjunctions, dignity, aspects) to pick Sun vs Venus and Moon vs Mars; day/night birth flag if the day/night variant is used.

## 4. Calculation

| Relative | Sthira karaka |
|---|---|
| Father | stronger of Sun and Venus [TEXT JUS 2.2.1; BPHS-ELS 32.18] |
| Mother | stronger of Moon and Mars [TEXT JUS 2.2.2; BPHS-ELS 32.19] |
| Younger siblings, siblings' spouses | Mars [TEXT JUS 1.1.20] |
| Maternal relatives (uncles, aunts) | Mercury [TEXT JUS 1.1.21] |
| Paternal grandparents, husband, sons | Jupiter [TEXT JUS 1.1.22] |
| Wife, parents-in-law, maternal grandparents | Venus (Abhyankar distributes over Venus, Saturn, Sun, Moon) [TEXT JUS 1.1.23] |
| Elder siblings (or children, variant) | Saturn [MODERN PVR §8.3 n.27; COMM Rao note on 1.1.24] |

## 5. Interpretation rules

- Sthira karakas represent the relative's body directly (no counting houses from them) and are used to time that relative's death [MODERN PVR §8.3].
- For death of spouse use Jupiter in a female chart and Venus in a male chart [MODERN PVR §8.3].
- Do not substitute sthira karakas for naisargika ones in general prediction (e.g. marriage is the 7th from Venus, not from Jupiter) [MODERN PVR §8.3].

## 6. Variants and disputes

- Day/night variant: Sun father by day, Venus by night; Moon mother by night, Mars by day [MODERN PVR §8.3 n.26, as "some people opine"].
- Saturn: elder siblings vs children [MODERN PVR n.27; TEXT BPHS-ELS 32.20 summary lists Saturn for son].
- Jupiter as spouse karaka in male charts too ("some scholars") [MODERN PVR n.28].
- Abhyankar's reading of 1.1.23 spreads wife/parents/in-laws over four planets [COMM]; Rao keeps Venus for wife and in-laws [COMM].

## 7. Worked micro-example

Not needed: a lookup plus a two-way strength test.

## 8. Design notes for AI Astra

- **Engine status:** not found in `natal_export.py`; whether the library's Shoola/longevity code uses sthira karakas was not checked.
- **Engine addition:** `sthira_karakas: {father: {planet, rule:"stronger of Sun/Venus", strength_basis}, mother: {...}, ...}` with the strength comparison recorded.
- **Boards:** none directly. Death-of-relative timing must stay out of consumer boards; use only for internal consistency and for the tie fallback in chara karakas.
- **Pitfall:** the strength comparison has many rule variants; record which was used.

## 9. Open questions

- The Jaimini strength rules for choosing Sun vs Venus are in Adhyaya 2 and were not extracted in detail here.
- Rath, Iranganti and P. S. Sastri readings of 1.1.20-24 not checked.
