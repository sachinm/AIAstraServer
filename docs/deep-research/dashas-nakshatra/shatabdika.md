# Shatabdika dasha (śatābdikā / śatasamā daśā)

> A 100-year nakshatra dasha of seven planets counted from Revati, for charts whose lagna is vargottama (same sign in rasi and navamsha). Years double in pairs (5, 5, 10, 10, 20, 20, 30). About one chart in nine qualifies. Research use only.

## 1. Sources

| Rule | Edition, chapter:verse | Tag |
|---|---|---|
| Vargottama lagna; count from Revati, ÷ 7 | ELS/AE 46.32 | [TEXT] |
| Lords Sun, Moon, Venus, Mercury, Jupiter, Mars, Saturn | ELS/AE 46.33 | [TEXT] |
| Years 5, 5, 10, 10, 20, 20, 30 | AE 46.34 | [TEXT] |
| Controlling planet Sun | PVR 2014 | [MODERN] |

URLs: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 · https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt · https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf

## 2. When it applies

Lagna in the same sign in D1 and D9. Vargottama lagna occurs in the 1st navamsha of movable signs, the 5th of fixed signs and the 9th of dual signs. [TEXT]

## 3. Inputs required

Lagna longitude; Moon longitude.

## 4. Calculation

Count from Revati (27) to the birth star, ÷ 7. Engine table (`sataatbika.py`, seed 27):

| Lord | Years | Nakshatras |
|---|---|---|
| Sun | 5 | 27, 7, 14, 21 |
| Moon | 5 | 1, 8, 15, 22 |
| Venus | 10 | 2, 9, 16, 23 |
| Mercury | 10 | 3, 10, 17, 24 |
| Jupiter | 20 | 4, 11, 18, 25 |
| Mars | 20 | 5, 12, 19, 26 |
| Saturn | 30 | 6, 13, 20 |

Total 100. Balance by 46.16; AD = MD × AD / 100.

## 6. Variants and disputes

ELS's English shows the last term as 33; the 100-year total and AE give 30. No other dispute found.

## 8. Design notes for AI Astra

Engine checks vargottama lagna already. Export the flag with margin to the navamsha edge. Research use only.

## 9. Open questions

None specific.
