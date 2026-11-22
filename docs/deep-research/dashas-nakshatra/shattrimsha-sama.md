# Shat-trimshat-sama dasha (ṣaṭtriṃśatsamā daśā)

> A 36-year nakshatra dasha of eight lords with 1 to 8 years (the same lords and years as Yogini) counted from Shravana, for day births with lagna in the Sun's hora or night births with lagna in the Moon's hora. It repeats more than three times in a life. About half of charts qualify. Research use.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| Count from Shravana, ÷ 8; Moon first | ELS/AE 46.42 | [TEXT] |
| Years 1 … 8; day birth in Sun's hora, night birth in Moon's hora | ELS/AE 46.43 | [TEXT] |
| Day = Sun in the visible half from lagna; controlling planet Mercury | PVR 2014 | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt · https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf

## 2. When it applies

Day birth (sunrise to sunset) with lagna in the Sun's hora, or night birth with lagna in the Moon's hora. [TEXT]

## 4. Calculation

Count from Shravana (22) to the birth star, ÷ 8. Engine table (`shattrimsa_sama.py`, seed 22):

| Lord | Years | Nakshatras |
|---|---|---|
| Moon | 1 | 22, 3, 11, 19 |
| Sun | 2 | 23, 4, 12, 20 |
| Jupiter | 3 | 24, 5, 13, 21 |
| Mars | 4 | 25, 6, 14 |
| Mercury | 5 | 26, 7, 15 |
| Saturn | 6 | 27, 8, 16 |
| Venus | 7 | 1, 9, 17 |
| Rahu | 8 | 2, 10, 18 |

Total 36; cycles repeat. Balance by 46.16; AD = MD × AD / 36.

## 6. Variants and disputes

PVR's "visible half" day/night differs from sunrise/sunset near the horizon [MODERN].

## 8. Design notes for AI Astra

Engine addition: `applicability_check` is missing (TODO in `applicability.py`). Add it with sunrise/sunset by default. Research use.

## 9. Open questions

None specific.
