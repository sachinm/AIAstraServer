# Conditional dasha applicability matrix (sopādhika daśā)

> BPHS teaches Vimshottari as the general dasha, then nine conditional nakshatra dashas, each with a one-line chart condition. This file lists every condition as the Sanskrit gives it, how translators and modern schools read it, what the engine does today, and what to do when more than one applies. BPHS gives no priority rule; every selection method below is [MODERN].

Numbering: **ELS** = BPHS Sanskrit on enjoylearningsanskrit.com (ch. 46, 210 verses). **AE** = archive.org English e-text, chapter scheme as usually cited for R. Santhanam (translator not confirmed). Verse numbers agree between the two for vv. 12–43. Sources and caveats are in `research_notes/Vedic dasha systems and prediction techniques/dashas-nakshatra.md`.

## 1. Sources

- BPHS ch. 46 vv. 17–43 (conditional nakshatra dashas), 46.195–200 (Yogini), 46.207–209 (Tara), 46.52–154 (Kalachakra). [TEXT]
  - https://enjoylearningsanskrit.com/scriptures/parashara/chapter-46 (per-verse pages `/verse-N`)
  - https://archive.org/stream/ParasharaHoraSastra/BrihatParasharaHoraSastraVedicAstrologyEbook_djvu.txt
- P.V.R. Narasimha Rao, *Unified Nakshatra Dasa Approach: In Annual & Natal Charts* (v4, 2014). https://www.vedicastrologer.org/articles/pp_cond_dasas.pdf [MODERN]
- Engine: `AIAstra_Radha/src/jhora/horoscope/dhasa/graha/applicability.py` and each module's `applicability_check`.

## 2. The matrix

| Dasha (years) | Sanskrit condition (ELS) | Plain condition [TEXT] | Other readings | Seed star, count | Engine check today | PVR controlling planet [MODERN] |
|---|---|---|---|---|---|---|
| **Vimshottari** (120) | none (46.12–14: `mukhyā`, chief) | Applies to all charts | Start can move to lagna or other stars (see `vimshottari.md`) | Krittika, ÷ 9 | Always computed | n/a (default) |
| **Ashtottari** (108) | 46.17 `lagneśāt kendrakoṇasthe rāhau lagnaṃ vinā sthite` | Rahu in a kendra or trikona **from the lagna lord**, Rahu not in lagna | | Ardra; 4-3-4-3 stars per lord | Yes (Rahu rule only) | Mars |
| Ashtottari, 2nd rule | 46.23 `kṛṣṇapakṣe divā janma śuklapakṣe tathā niśi` | Day birth in the dark fortnight, or night birth in the bright fortnight | A summariser's reading of AE attaches this to Shodashottari; the Sanskrit names Ashtottari. Popular in North India as the Ashtottari rule. | same | **Not implemented** | n/a |
| **Shodashottari** (116) | 46.24 `candrahorāgate kṛṣṇe sūryahorāgate sitī lagne` | Lagna in Moon's hora in the dark fortnight, or in Sun's hora in the bright fortnight | PVR: "paksha" = Sun in the visible half from Moon (or the reverse) | Pushya, ÷ 8 | **Not implemented** (TODO in `applicability.py`) | Jupiter |
| **Dwadashottari** (112) | 46.27 `śukrāṃśake prajātasya` | Born in a Venus amsha: read as lagna in a Taurus or Libra navamsha | ELS English: "Venus in the navamsha" (weak) | Birth star → Revati counted backwards, ÷ 8 | Yes (D9 lagna in Taurus/Libra) | Ketu |
| **Panchottari** (105) | 46.29 `arkāṃśa karkalagne` | Cancer lagna + `arkāṃśa` | (a) AE: rasi lagna Cancer **and** Cancer dwadashamsha; (b) PVR: lagna in Cancer **dwadashamsha** only (arka = 12); (c) ELS English: Cancer lagna in the Sun's (Leo) navamsha | Anuradha (`mitrarkṣa`), ÷ 7 | Yes, reading (b): D12 lagna = Cancer | Venus |
| **Shatabdika** (100) | 46.32 vargottama lagna | Lagna in the same sign in rasi and navamsha | none found | Revati, ÷ 7 | Yes | Sun |
| **Chaturashiti-sama** (84) | 46.35 | 10th lord in the 10th house | none found | Swati, ÷ 7 | Yes | Saturn |
| **Dwisaptati-sama** (72) | 46.38 `lagneśe saptame yasya lagne vā saptamādhipe` | Lagna lord in the 7th, **or** 7th lord in lagna | none (one English summary misread it as "lagna lord in 1st or 7th") | Mula, ÷ 8 | Yes | Rahu |
| **Shashtihayani** (60) | 46.40 | Sun in lagna (same sign as lagna) | Some read "Sun in the lagna bhava" by house cusp; text says lagna | Ashwini, 3/4 star groups | Yes (same sign) | Moon |
| **Shattrimsha-sama** (36) | 46.43 | Day birth with lagna in Sun's hora, or night birth with lagna in Moon's hora | PVR: day = Sun in the visible half from lagna | Shravana, ÷ 8 | **Not implemented** | Mercury |
| **Yogini** (36) | 46.195–200 | No condition in BPHS | Popular as a universal second dasha [MODERN, North Indian practice] | Birth star + 3, ÷ 8 | Always computable | n/a |
| **Tara** (120) | 46.207–209 | Not a condition: the dasha belongs to planets in kendras | Listed among the less-accepted systems (46.11) | Moon's star for balance | Computable (two orders) | n/a |
| **Kalachakra** (paramayush 83–100) | 46.52–95 | No condition; called the most authoritative of its group (46.6) | | Moon's nakshatra pada | Computable | n/a |

Hora convention: in an odd sign the first 15° is the Sun's hora and the second 15° the Moon's; in an even sign the reverse (standard Parashari hora, BPHS hora-varga chapter). Bright fortnight = tithis 1–15 from new moon. Day = between local sunrise and sunset. The text does not define these again for the dashas; PVR's "visible half" geometry is a [MODERN] substitute that changes results near sunrise and sunset.

### How often each applies (rough)
PVR's estimates [MODERN]: three conditions (Shodashottari, Ashtottari-46.23, Shattrimsha) hit about 50% of charts each; Dwisaptati about 16.7%; the rarest (Panchottari D12 reading, Shashtihayani) about 8.33%. Ashtottari's Rahu rule hits roughly half of charts too (kendra + trikona from the lagna lord cover 6 of 12 signs, minus lagna).

## 3. What to do when several apply

1. **The text** [TEXT]: silent. Each verse says the dasha "should be considered" (`cintyā`, `vicintyā`), not "must replace Vimshottari". Vimshottari is called chief (46.3, 46.14).
2. **PVR** [MODERN] (2014): the conditions are necessary, not sufficient. Among the applicable ones, take the dasha whose controlling planet is strongest (exalted > moolatrikona > own > great friend > friend; neutral, enemy and debilitated planets disqualify; weak at sign edges, combust or afflicted by 6th/8th lords; extra strong with the 9th or 10th lord). If none is strong, use Vimshottari. He validates mostly on varga charts of annual Tithi Pravesha charts, using his own Pushya-paksha ayanamsa.
3. **Common practice** [MODERN, BVB/K.N. Rao school and most Indian practitioners]: Vimshottari always leads. A conditional dasha (often Yogini, Ashtottari if eligible) serves as a confirming second clock: an event is timed with confidence when two dashas point to the same planets or houses.
4. **Rare-condition-first** [MODERN, informal]: some practitioners prefer the rarest applicable condition (Shashtihayani, Panchottari, Chaturashiti) as "more specific". PVR argues against ignoring the 50%-frequency dashas.

## 4. Design notes for AI Astra

- Engine addition: one `applicable_conditional_dashas` output per kundli, with **one boolean per condition per reading** (`ashtottari_rahu`, `ashtottari_paksha`, `shodashottari_hora_paksha`, `panchottari_d12_only`, `panchottari_rasi_and_d12`, `shattrimsha_hora_daynight` etc.). Store it in the kundli digest. Node never evaluates these conditions.
- Engine addition: PVR's controlling-planet strength per applicable dasha, so a product rule can choose a dasha without Node computing dignity.
- Product rule (recommendation): Vimshottari is the lead clock on every board. Show a conditional dasha only as **agreement evidence**: "two timing systems point to this window". Do not let the selection rule change the main timeline silently.
- Pitfall: hora and paksha conditions flip near sunrise, sunset, the 15° point and new/full moon. Keep the margin (degrees or minutes to the boundary) in the engine output so the UI never claims a conditional dasha for a chart sitting on a boundary with an uncertain birth time.

## 5. Open questions

- Which Panchottari reading should the engine default to? Recommendation: keep PVR's D12-only reading as the default (it matches JHora practice) and expose the strict reading as a flag.
- Does JHora implement 46.23 for Ashtottari? Not checked.
- GC Sharma's rendering of 46.27 and 46.29 not checked.
