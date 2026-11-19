# Shashtihayani dasha (ṣaṣṭihāyanī / ṣaṣṭisamā daśā)

> A 60-year nakshatra dasha of eight lords (Ketu left out) counted from Ashwini in groups of 3 and 4 stars, for charts with the Sun in the lagna sign. Jupiter, Sun and Mars get 10 years; the rest 6. About one chart in twelve. Research use.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| Sun in lagna; count from Ashwini in a 3-4-3 pattern | ELS/AE 46.40 | [TEXT] |
| Jupiter, Sun, Mars 10 years; Moon, Mercury, Venus, Saturn, Rahu 6 | ELS/AE 46.41 | [TEXT] |
| Controlling planet Moon | PVR 2014 | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt · https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf

## 2. When it applies

Sun in the lagna sign (whole sign). [TEXT]

## 4. Calculation

Order and years (AE 46.41): Jupiter 10, Sun 10, Mars 10, Moon 6, Mercury 6, Venus 6, Saturn 6, Rahu 6 = 60.

Star groups from the engine (`shastihayani.py`: `dhasa_adhipathi_star_count = {Jup 3, Sun 4, Mars 3, Moon 4, Merc 3, Ven 4, Sat 3, Rahu 4}`, total 28, so Abhijit is counted). Expanded from Ashwini (my expansion, check against a live run):

| Lord | Years | Stars |
|---|---|---|
| Jupiter | 10 | Ashwini, Bharani, Krittika |
| Sun | 10 | Rohini, Mrigashira, Ardra, Punarvasu |
| Mars | 10 | Pushya, Ashlesha, Magha |
| Moon | 6 | P.Phalguni, U.Phalguni, Hasta, Chitra |
| Mercury | 6 | Swati, Vishakha, Anuradha |
| Venus | 6 | Jyeshtha, Mula, P.Ashadha, U.Ashadha |
| Saturn | 6 | Abhijit, Shravana, Dhanishta |
| Rahu | 6 | Shatabhisha, P.Bhadrapada, U.Bhadrapada, Revati |

Balance: as Ashtottari, years spread over the lord's star group. AD = MD × AD / 60.

## 6. Variants and disputes

- Whether Abhijit is counted (engine: yes, via the 28-star group counts). With 27 stars the 3-4-3 pattern cannot close evenly.
- "Sun in lagna" by sign (engine) vs within the lagna bhava by degree: no textual support found for the bhava reading.

## 8. Design notes for AI Astra

Engine checks it already. Engine addition: export the star-group arc used for the balance. Research use.

## 9. Open questions

Confirm the engine's star groups with a live run (Moon in Uttara Ashadha / Shravana edge cases).
