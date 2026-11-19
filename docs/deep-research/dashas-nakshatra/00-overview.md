# Nakshatra and graha-period dashas: overview (uḍu daśā)

> A dasha is a clock that hands life, in turn, to planets (or signs) for set spans of years. Nakshatra (udu) dashas start the clock from where the Moon sits inside its nakshatra at birth. BPHS ch. 46 teaches Vimshottari as the chief system, nine conditional nakshatra dashas for charts that meet a condition, and Yogini, Tara and Kalachakra among a longer list. This folder documents each from the Sanskrit and the main translations so the engine (AIAstra_Radha) and the boards can use them.

## 1. Sources

- **BPHS ch. 46** (Sanskrit, ELS numbering; 210 verses): https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 [TEXT]
- **BPHS English e-text** (AE; chapter scheme usually cited as R. Santhanam's; translator not confirmed): https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt [TEXT]
- **PVR Narasimha Rao**, *Unified Nakshatra Dasa Approach* (2014): https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf [MODERN]
- **Sanjay Rath**, Vimshottari notes on Utpanna/Kshema/Adhana: https://srath.com/?p=872 [MODERN]
- **Engine**: `AIAstra_Radha/src/jhora/horoscope/dhasa/graha/*.py`, `raasi/kalachakra.py`, `const.py`.
- Research notes, uncertainties and engine findings: `research_notes/Vedic dasha systems and prediction techniques/dashas-nakshatra.md`.

## 2. Files in this folder

| File | System | Years | Condition (BPHS) | Status in practice |
|---|---|---|---|---|
| `vimshottari.md` | Vimshottari | 120 | none: the chief dasha | Universal default |
| `ashtottari.md` | Ashtottari | 108 | Rahu kendra/trikona from lagna lord, not in lagna; or day-krishna / night-shukla birth | Common second dasha (North India) |
| `shodashottari.md` | Shodashottari | 116 | Lagna Moon-hora + dark fortnight, or Sun-hora + bright | Research use |
| `dwadashottari.md` | Dwadashottari | 112 | Lagna in a Venus navamsha | Research use |
| `panchottari.md` | Panchottari | 105 | Cancer lagna with `arkāṃśa` (disputed) | Research use |
| `shatabdika.md` | Shatabdika | 100 | Vargottama lagna | Research use |
| `chaturashiti-sama.md` | Chaturashiti-sama | 84 | 10th lord in 10th | Research use |
| `dwisaptati-sama.md` | Dwisaptati-sama | 72 | Lagna lord in 7th or 7th lord in lagna | Research use |
| `shashtihayani.md` | Shashtihayani | 60 | Sun in lagna | Research use |
| `shattrimsha-sama.md` | Shat-trimshat-sama | 36 | Day + Sun-hora lagna, or night + Moon-hora lagna | Research use |
| `yogini.md` | Yogini | 36 | none | Widely used second dasha |
| `kalachakra.md` | Kalachakra | 83–100 per pada | none | Specialist (SJC, South India) |
| `tara.md` | Tara | 120 | planets in kendras | Rare (SJC) |
| `moola.md` | Moola (Lagna-kendradi graha) | 120 | none | SJC, karma/remedy reading |
| `01-applicability-matrix.md` | all conditional dashas | | conditions, readings, engine state, selection | |

## 3. Shared mechanics

1. **Seed.** Each system names a starting nakshatra (Krittika for Vimshottari, Ardra for Ashtottari, Pushya for Shodashottari …). Count from the seed to the birth star; the remainder after dividing by the number of lords gives the first lord (46.13, 46.25 and parallels). Dwadashottari counts from the birth star to Revati (backwards).
2. **Balance at birth.** First MD is shortened by the part of the Moon's nakshatra already crossed: balance = full years × (degrees left in the nakshatra ÷ 13°20′) (46.16). Kalachakra uses the pada (3°20′) and the pada's paramayush instead.
3. **Sub-periods.** BPHS (AE 51.1): AD = MD years × AD lord's years ÷ total years of the system, starting with the MD lord and following the MD order; deeper levels repeat the same proportion. Engine offers six orderings (`antardhasa_option` 1–6) and a "tribhagi" (one-third) variant.
4. **Year length.** The text does not settle it. The engine uses the sidereal year (365.256364 days) by default; 360-day savana and 365.2422 tropical years exist as constants. See `vimshottari.md` §6.

## 4. Results chapters (which BPHS chapters read a running dasha)

AE chapter numbers (map to `../dasha-results/` for the content):

| AE ch. | Content | Applies to |
|---|---|---|
| 47 | Effects of each planet's dasha by dignity and placement; dreshkana gives early/middle/late fruition | Any graha dasha (no system named) |
| 48 | Bhava-lord dashas (heading names Vimshottari) | Vimshottari; by inference all graha dashas |
| 49 | Kalachakra effects | Kalachakra (ELS also has house results at 46.131–154) |
| 50 | Chara and other rasi dashas | Rasi dashas (other folder) |
| 51 | Working out antardashas | All |
| 52–60 | Antardasha results inside each Vimshottari MD (Sun, Moon, Mars, Rahu, Jupiter, Saturn, Mercury, Ketu, Venus) | Vimshottari; reused for other graha dashas when the pair exists |
| 61–63 | Pratyantar, sookshma, prana results | Vimshottari |
| 64 | Antardashas in Kalachakra | Kalachakra |

BPHS 46.22 says Ashtottari results are judged as in Vimshottari [TEXT]. Nothing in BPHS says this for the other conditional dashas; reading them through ch. 47–48 is the universal practice [MODERN/COMM].

## 5. Design notes for AI Astra

- **The engine computes every dasha; Node never computes one.** Today the live export carries Vimshottari to 2 levels (MD + AD). Engine additions needed for this folder: (a) applicability flags for every condition and reading (matrix), (b) Yogini and one chosen conditional dasha to at least 3 levels, (c) Kalachakra with deha/jeeva and gati flags, (d) the dasha year length used, written into every export so the UI can explain date drift.
- **Weight.** Vimshottari leads every board. Yogini or an applicable conditional dasha is used only as agreement evidence. Kalachakra and Tara are research outputs for the admin research page, not board drivers, until tested on the research kundlis.
- **Boards.** Self: MD/AD theme + period tone. Love/Work: dasha lords' bhava ownership (7th/5th for Love; 10th/6th/11th for Work), as in BPHS ch. 48. Lucky: day-level work comes from transits and panchang, not dashas below prana.
- **Pitfalls.** Birth-time error shifts every dasha date. The Moon moves about 0.5° per hour and a nakshatra is 13°20′, so one hour of birth-time error is about 3.75% of a nakshatra: 0.2–0.75 years of a 6–20 year Vimshottari MD (about 3–9 months). Ten minutes is about 2–6 weeks. An ayanamsa difference of 1° moves dates by 7.5% of the running MD. Show date ranges, not exact days, unless the birth time is rectified.

## 6. Open questions

- Which reading of the Panchottari and Dwadashottari conditions (see matrix)?
- Whether to adopt PVR's controlling-planet selection or keep Vimshottari fixed as lead (recommendation: Vimshottari fixed).
- GC Sharma edition differences not checked.
