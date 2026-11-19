# Shodashottari dasha (ṣoḍaśottarī daśā)

> A 116-year nakshatra dasha of eight lords (Rahu left out) counted from Pushya, for charts where the lagna's hora matches the fortnight: Moon's hora in the dark half, Sun's hora in the bright half. It applies to about half of all charts. Practitioner use is light; PVR revived it for natal and annual (Tithi Pravesha) charts.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| Condition: `candrahorāgate kṛṣṇe sūryahorāgate sitī lagne … vicintyā ṣoḍaśottarī` | ELS 46.24 | [TEXT] |
| Count from Pushya, ÷ 8 | ELS/AE 46.25 | [TEXT] |
| Lords and years 11–18, Rahu excluded | ELS/AE 46.26 | [TEXT] |
| Paksha/day-night read as "visible half" geometry; controlling planet Jupiter | PVR 2014 | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46/verse-24 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt · https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf

## 2. When it applies

Lagna in the Moon's hora in krishna paksha, or lagna in the Sun's hora in shukla paksha. Hora: odd sign 0–15° Sun, 15–30° Moon; even sign 0–15° Moon, 15–30° Sun. [TEXT]

## 3. Inputs required

Lagna longitude; tithi (Sun–Moon elongation); Moon longitude.

## 4. Calculation

Count from Pushya (8) to the birth star inclusive, divide by 8, remainder → lord (remainder 1 = Sun). Engine table (`shodasottari.py`, seed 8):

| Lord | Years | Nakshatras |
|---|---|---|
| Sun | 11 | 8 Pushya, 16 Vishakha, 24 Shatabhisha, 5 Mrigashira |
| Mars | 12 | 9, 17, 25, 6 |
| Jupiter | 13 | 10, 18, 26, 7 |
| Saturn | 14 | 11, 19, 27 |
| Ketu | 15 | 12, 20, 1 |
| Moon | 16 | 13, 21, 2 |
| Mercury | 17 | 14, 22, 3 |
| Venus | 18 | 15, 23, 4 |

Total 116. Balance = years × untraversed fraction of the birth nakshatra (46.16 rule). AD = MD × AD / 116 from the MD lord.

## 5. Interpretation rules

Read as Vimshottari through BPHS ch. 47–48 [COMM/MODERN; BPHS states this only for Ashtottari]. PVR: use only if Jupiter is strong [MODERN].

## 6. Variants and disputes

- PVR defines shukla paksha as the Sun in the visible half from the Moon, krishna the reverse, and applies the rule inside varga and annual charts [MODERN]. The text uses the plain tithi-based fortnight.
- AE's English summary mixes 46.23 (Ashtottari's day/night rule) into Shodashottari; the Sanskrit keeps them apart.

## 8. Design notes for AI Astra

- Engine addition: `applicability_check` is missing (`applicability.py` TODO). Add it with the tithi-based reading by default and PVR's geometry as an option; export the margin to the 15° hora point and to new/full moon.
- Product: research-only until tested on the research kundlis; agreement evidence at most.

## 9. Open questions

- Which fortnight definition (tithi or visible-half) to adopt by default? Recommendation: tithi, since it is the plain reading.
