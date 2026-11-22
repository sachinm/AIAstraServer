# Deep research: classical dasha systems and prediction techniques

The starting point for design and planning work on what AI AdAstra computes and reads. It holds what the original
classical texts teach (BPHS, the Jaimini Upadesa Sutras, Phaladeepika, Saravali, the Tajika texts, Brihat Jataka and
others), one file per technique, and a review of how the current technique specs, stored technique contracts and
engine exports compare with them. Written 2026-11-18. The narrative summary is
[`reports/Vedic dasha systems and prediction techniques.md`](../../reports/Vedic%20dasha%20systems%20and%20prediction%20techniques.md);
the comparison is [`current-specs-review/06-gap-matrix.md`](current-specs-review/06-gap-matrix.md) and the order of
work is [`current-specs-review/07-recommendation.md`](current-specs-review/07-recommendation.md). Findings are filed
in [`docs/TODOS.md`](../TODOS.md) under "Filed 2026-11-18 by the classical-techniques deep research".

Rule that runs through every file: the engine (`AIAstra_Radha`) is the only source of astrological data. Where a file
says "engine addition", Node computes nothing. Engine names (the repo and the vendored library) appear in these
internal docs only; never in readings or user-facing copy.

## The shared file template

Every technique file in the eight classical folders follows one template:

1. **Sources** — text, edition, chapter:verse, URLs.
2. **When it applies** — which charts and which life areas.
3. **Inputs required** — the exact chart data, all from the engine.
4. **Calculation** (or rule) — start, order, period table, sub-period rule, year length.
5. **Interpretation rules** — each tagged by evidence level.
6. **Variants and disputes** — school by school.
7. **Worked micro-example** — short.
8. **Design notes for AI Astra** — what the engine must output, which board uses it, engine findings.
9. **Open questions.**

Each folder has a `00-overview.md` (sources, comparison table, decision flow, engine findings, board mapping). The
`current-specs-review/` folder has its own numbered structure (00-07), and `sanjay-rath/` has its own README.

## Evidence legend

| Tag | Meaning |
|---|---|
| **[TEXT]** | Stated in a classical text (verse cited) |
| **[COMM]** | A traditional or translator commentary on the text (e.g. Suryanarain Rao's and Abhyankar's notes on Jaimini), or the common traditional reading; often "as reported" |
| **[MODERN]** | A modern school: SJC (Sanjay Rath, P.V.R. Narasimha Rao), K.N. Rao / BVB, B.V. Raman, Iranganti Rangacharya. KP is not used |
| **[REGIONAL]** | A regional practice with no pan-Indian text (Rahu kalam, choghadiya) — `tajika-prashna-muhurta/` |
| **[ENGINE]** | What the engine code does, where no text was read — `dashas-rasi-jaimini/` |
| **(V) / (R) / (U)** | `natal-techniques/` only: (V) rule seen in a source this session; (R) recalled, verse number not checked; (U) no verse located. **V-Sa** = read from an untranslated Sanskrit page by a fetch model (provisional) |
| **verify** | `tajika-prashna-muhurta/` muhurta files: chapter-level citation only; check the verse before encoding |
| **run / code** | Engine findings: **run** = the researcher executed the engine; **code** = read from code only |
| **[A] [B] [C] [Inferred] [Sensitive]** | `sanjay-rath/` source tiers: Rath's own text, his students, third party, our inference, and rules about death or illness held for a product decision |

## Edition and numbering caveats

- **BPHS chapter numbering differs by edition.** Three numberings are in use across these files:
  - the **Santhanam-numbered English e-text** on archive.org ("Parashara Hora Sastra", 97 chapters; translator not
    named on the page; its scheme matches R. Santhanam's Ranjan 1984 translation): dashas ch. 46, effects 47-48,
    Kalachakra 49, rasi dashas 50, antardasha working 51, antardasha results 52-60, pratyantar 61-63, ashtakavarga
    66-72, Sudarshana 74;
  - **enjoylearningsanskrit.com** (Sanskrit with an English gloss, verse pages): matches the e-text's chapter numbers
    for the chapters used; within ch. 46 the verse numbers of the two agree only for vv. 12-43 (the conditional
    dashas), so check other verse numbers in both. Its English glosses are sometimes wrong (46.15 "19" for Mercury's 17 years; 46.34 "33"
    for 30; 46.89 Kalachakra digits not reversed: 58/38/68 for 85/83/86) and some verses were cut off (48.18);
  - the **G.C. Sharma (Sagar) edition on wisdomlib**: about **+2** in the dasha and ashtakavarga chapters (Results of
    Dasas 49 vs 47; Sun antardasha 54 vs 52; Ishta/Kashta 30 vs 28; Ashtakavarga 68 vs 66).
  - A second archive.org item, "BPHSEnglish" vol. 2 (file labelled R. Santhanam; preface may name G.S. Kapoor), used
    by `dashas-rasi-jaimini/`, has poor OCR: its verse numbers are ±2 and Rath cites the rasi antardasha rule as
    50.30-31 where that file has 51.5-12.
- **Jaimini Upadesa Sutras.** Suryanarain Rao (1949) and Abhyankar (1951) number Adhyaya 1 Pada 1 differently
  (Abhyankar runs one behind from argala to Putra-karaka and has a Pitri-karaka sutra Rao lacks); concordance in
  `jaimini-apparatus/00-overview.md` §2. Adhyayas 3-4 were not read.
- **Phaladeepika.** `transits/` uses the siva.sh numbering (from V. Subrahmanya Sastri 1950); `dasha-results/` used the
  wisdomlib OCR of the same translation; `natal-techniques/` could not reach it and every PD verse there is recalled.
- **Tajika.** Nilakantha's verse numbers are as quoted in Balabhadra's *Hayanaratna* (Gansten 2020), not checked against
  the Sanskrit editions.
- **Muhurta Chintamani and Prashna Marga** were cited at chapter level only.
- **Engine commit.** `current-specs-review/` read `b902bea` (`origin/release-candidate-staging`). Some researchers read
  the local engine checkout, which is 35 files behind; where they disagree with `current-specs-review/03`, 03 wins.
- **Stale statement in one folder.** `dashas-nakshatra/00-overview.md` §5 and its notes say the live dasha export is
  2 levels deep. That is true only for the legacy `vimsottari_dasa` / `narayana_dasa` types and the annual dashas;
  every `dasha.*` type defaults to 4 levels, max 6 (rasi 5, Kalachakra 1), and the server asks for 3 (`03` §3.1).

## Every file

### `current-specs-review/` — what AI AdAstra specifies, stores and computes, set against the texts

| File | What it holds |
|---|---|
| [00-overview.md](current-specs-review/00-overview.md) | Scope, the shape of the system in one paragraph, six key observations |
| [01-technique-spec-inventory.md](current-specs-review/01-technique-spec-inventory.md) | Every spec under `docs/techniques/` with its techniques, dashas, vargas and inputs; spec contradictions S1-S12 |
| [02-stored-technique-contracts.md](current-specs-review/02-stored-technique-contracts.md) | Tables, the kundli digest's six sections, activation calendar, the 142-row catalogue, chart-type serving, discrepancies D1-D12 |
| [03-engine-exports.md](current-specs-review/03-engine-exports.md) | Every engine export type, the 43 dasha systems and their levels, what the library has but the engine does not serve, 19 engine issues |
| [04-reading-engine-technique-usage.md](current-specs-review/04-reading-engine-technique-usage.md) | How reading-engine docs 11-81 choose and combine techniques; the seven dasha families and five clocks; per-board dependencies |
| [05-findings.md](current-specs-review/05-findings.md) | 25 places Node computes astrology, 18 spec/data contradictions, 10 engine gaps, missing pieces |
| [06-gap-matrix.md](current-specs-review/06-gap-matrix.md) | One row per classical technique: source, purpose, spec, stored contract, engine status, boards, priority (P0-P3) |
| [07-recommendation.md](current-specs-review/07-recommendation.md) | The one recommended sequence of engine fixes, additions and spec changes |

### `dashas-nakshatra/` — nakshatra (graha-period) dashas from BPHS ch. 46

| File | What it holds |
|---|---|
| [00-overview.md](dashas-nakshatra/00-overview.md) | Systems, conditions, shared mechanics (seed, balance, sub-periods, year length), results chapters, design notes |
| [01-applicability-matrix.md](dashas-nakshatra/01-applicability-matrix.md) | Every conditional dasha's Sanskrit condition, readings, engine check and what to do when several apply |
| [vimshottari.md](dashas-nakshatra/vimshottari.md) | The chief 120-year dasha: order, balance, levels, Utpanna/Kshema variants, year length |
| [ashtottari.md](dashas-nakshatra/ashtottari.md) | 108-year conditional dasha; Rahu rule and the paksha rule (46.17, 46.23) |
| [shodashottari.md](dashas-nakshatra/shodashottari.md) | 116-year conditional dasha (lagna hora + paksha) |
| [dwadashottari.md](dashas-nakshatra/dwadashottari.md) | 112-year conditional dasha (born in a Venus amsha) |
| [panchottari.md](dashas-nakshatra/panchottari.md) | 105-year conditional dasha; the disputed *arkāṃśa* condition |
| [shatabdika.md](dashas-nakshatra/shatabdika.md) | 100-year conditional dasha (vargottama lagna) |
| [chaturashiti-sama.md](dashas-nakshatra/chaturashiti-sama.md) | 84-year conditional dasha (10th lord in the 10th) |
| [dwisaptati-sama.md](dashas-nakshatra/dwisaptati-sama.md) | 72-year conditional dasha (lagna lord and 7th lord exchange places) |
| [shashtihayani.md](dashas-nakshatra/shashtihayani.md) | 60-year conditional dasha (Sun in lagna) |
| [shattrimsha-sama.md](dashas-nakshatra/shattrimsha-sama.md) | 36-year conditional dasha (day/night + lagna hora) |
| [yogini.md](dashas-nakshatra/yogini.md) | 36-year Yogini dasha; the engine's star mapping finding |
| [kalachakra.md](dashas-nakshatra/kalachakra.md) | Kalachakra: savya/apasavya wheels, deha/jeeva, gatis, paramayush |
| [tara.md](dashas-nakshatra/tara.md) | Tara dasha (Vimshottari reordered by kendra planets) |
| [moola.md](dashas-nakshatra/moola.md) | Moola / Lagna-kendradi graha dasha (SJC) and the engine's naming clash |

### `dashas-rasi-jaimini/` — sign dashas from BPHS and the Jaimini Upadesa Sutras

| File | What it holds |
|---|---|
| [00-overview.md](dashas-rasi-jaimini/00-overview.md) | Sources, the 20 rasi dasas, common machinery C1-C7, how results are judged, school matrix |
| [01-which-rasi-dasha-for-what.md](dashas-rasi-jaimini/01-which-rasi-dasha-for-what.md) | One table: what each sign dasa is for, by source, and its use in AI Astra |
| [chara-dasha.md](dashas-rasi-jaimini/chara-dasha.md) | Chara dasa: schools' seeds, ±1 rule, cycles; engine method and antardasa bugs |
| [narayana-dasha.md](dashas-rasi-jaimini/narayana-dasha.md) | Narayana (Padakrama) dasa on D1 and on vargas; engine antardasa bug |
| [sudasa.md](dashas-rasi-jaimini/sudasa.md) | Sudasa from Sree Lagna, for wealth and status |
| [lagna-kendradi-rasi-dasha.md](dashas-rasi-jaimini/lagna-kendradi-rasi-dasha.md) | Lagna Kendradi rasi dasa (material prosperity) |
| [karaka-kendradi-rasi-dasha.md](dashas-rasi-jaimini/karaka-kendradi-rasi-dasha.md) | Atmakaraka Kendradi rasi dasa (engine only; no purpose in text) |
| [lagnadi-rasi-dasha.md](dashas-rasi-jaimini/lagnadi-rasi-dasha.md) | BPHS "Rasi" dasa and its link to Sree Lagna |
| [drig-dasha.md](dashas-rasi-jaimini/drig-dasha.md) | Drig dasa for spiritual growth; years dispute |
| [trikona-dasha.md](dashas-rasi-jaimini/trikona-dasha.md) | Trikona dasa |
| [yogardha-dasha.md](dashas-rasi-jaimini/yogardha-dasha.md) | Yogardha dasa (half Chara, half Sthira years) |
| [mandooka-dasha.md](dashas-rasi-jaimini/mandooka-dasha.md) | Mandooka ("frog") dasa; unsettled variants |
| [sthira-dasha.md](dashas-rasi-jaimini/sthira-dasha.md) | Sthira dasa (longevity; internal only) |
| [brahma-dasha.md](dashas-rasi-jaimini/brahma-dasha.md) | Brahma-started dasa (longevity; not served) |
| [shoola-dasha.md](dashas-rasi-jaimini/shoola-dasha.md) | Jaimini Shoola dasa from 1st/7th (death timing; internal) |
| [niryana-shoola-dasha.md](dashas-rasi-jaimini/niryana-shoola-dasha.md) | BPHS "Shoola" = Niryana Shoola from 2nd/8th (internal) |
| [navamsha-dasha.md](dashas-rasi-jaimini/navamsha-dasha.md) | Navamsa dasa (longevity, bhava results) |
| [padanathamsha-dasha.md](dashas-rasi-jaimini/padanathamsha-dasha.md) | Padanathamsa and Pada-navamsa dasa |
| [tara-lagna-dasha.md](dashas-rasi-jaimini/tara-lagna-dasha.md) | Tara-amsa / Tara Lagna rasi dasa (wealth status) |
| [varnada-dasha.md](dashas-rasi-jaimini/varnada-dasha.md) | Varnada dasa (unverified) |
| [chara-paryaya-dasha.md](dashas-rasi-jaimini/chara-paryaya-dasha.md) | Paryaya / Chara Paryaya dasa (no text read) |
| [chakra-dasha.md](dashas-rasi-jaimini/chakra-dasha.md) | Chakra dasa (10 years per sign) |

### `dasha-results/` — how a running period is judged (dasha-phala)

| File | What it holds |
|---|---|
| [00-overview.md](dasha-results/00-overview.md) | The ten-step decision flow from MD/AD/PD lords to a verdict; edition key; engine outputs needed |
| [dasha-lord-condition-principles.md](dasha-results/dasha-lord-condition-principles.md) | Owned/occupied house, dignity scale, arohini/avarohini, placement at the dasha start, thirds |
| [functional-nature-laghu-parashari.md](dasha-results/functional-nature-laghu-parashari.md) | Functional benefics and malefics, yogakaraka, kendradhipati dosha (BPHS 34, PD 20) |
| [mahadasha-results-per-planet.md](dasha-results/mahadasha-results-per-planet.md) | Per-planet mahadasha results, strong vs weak |
| [antardasha-results-per-pair.md](dasha-results/antardasha-results-per-pair.md) | 81 antardasha pairs as rules; position from the MD lord; friendship |
| [rahu-ketu-dasha-results.md](dasha-results/rahu-ketu-dasha-results.md) | Node periods by house and association |
| [yoga-fructification-in-dasha.md](dasha-results/yoga-fructification-in-dasha.md) | When raja and dhana yogas deliver |
| [maraka-dasha-rules.md](dasha-results/maraka-dasha-rules.md) | Maraka periods (internal health-caution flag only) |
| [dasha-transit-combination.md](dasha-results/dasha-transit-combination.md) | Dasha lord's transit, Sun-ingress month, double transit |
| [house-activation-bhavat-bhavam-karaka.md](dasha-results/house-activation-bhavat-bhavam-karaka.md) | Which life area and which person a period activates |
| [pratyantar-and-deeper-levels.md](dasha-results/pratyantar-and-deeper-levels.md) | The thin classical basis for L3-L5 |
| [dasha-sandhi-and-chidra.md](dasha-results/dasha-sandhi-and-chidra.md) | Junctions and the end of a dasha (no classical verse found) |
| [dasha-remedies-bphs.md](dasha-results/dasha-remedies-bphs.md) | The BPHS remedy table for periods |

### `dashas-other-and-annual/` — strength, longevity, annual and cyclic clocks

| File | What it holds |
|---|---|
| [00-overview.md](dashas-other-and-annual/00-overview.md) | Comparison of every minor and annual clock; how annual dashas layer with the natal dasha; engine findings |
| [naisargika-dasha.md](dashas-other-and-annual/naisargika-dasha.md) | Natural-age periods (BPHS 43.16-17) |
| [ayurdaya-dashas-pinda-amsa-nisarga.md](dashas-other-and-annual/ayurdaya-dashas-pinda-amsa-nisarga.md) | Longevity-based Pinda, Amsa, Nisarga dashas (research only) |
| [moola-dasha.md](dashas-other-and-annual/moola-dasha.md) | Mula dasha of Brihat Jataka / SJC vs the engine's rasi "moola" |
| [sandhya-and-pachaka-dasha.md](dashas-other-and-annual/sandhya-and-pachaka-dasha.md) | Sandhya and Pachaka dashas (BPHS 46.204-206) |
| [ashtakavarga-dasha.md](dashas-other-and-annual/ashtakavarga-dasha.md) | Ashtakavarga as a strength modifier of periods |
| [tara-dasha.md](dashas-other-and-annual/tara-dasha.md) | Tara dasha as a minor clock (BPHS 46.207-209) |
| [sudarshana-chakra-dasha.md](dashas-other-and-annual/sudarshana-chakra-dasha.md) | Sudarshana Chakra year/month/2.5-day focus (BPHS 74); engine seed bug |
| [mudda-dasha.md](dashas-other-and-annual/mudda-dasha.md) | Mudda (Varsha Vimshottari); the engine's start-lord bug, verified by a run |
| [patyayini-dasha.md](dashas-other-and-annual/patyayini-dasha.md) | Patyayini in-year dasha (matches PVR, run) |
| [varsha-narayana-dasha.md](dashas-other-and-annual/varsha-narayana-dasha.md) | Varsha Narayana in-year sign dasha |
| [tithi-pravesha-chart-and-year-lord.md](dashas-other-and-annual/tithi-pravesha-chart-and-year-lord.md) | Tithi Pravesha chart, its year lord and year dasha |
| [planetary-maturity-ages-and-progressions.md](dashas-other-and-annual/planetary-maturity-ages-and-progressions.md) | Maturity ages and progression-like clocks (unsourced, off by default) |

### `jaimini-apparatus/` — Jaimini and Parashari special tools (non-dasha)

| File | What it holds |
|---|---|
| [00-overview.md](jaimini-apparatus/00-overview.md) | Sources, sutra-numbering concordance, engine status per tool, life-area routing |
| [chara-karakas.md](jaimini-apparatus/chara-karakas.md) | Seven vs eight chara karakas, ties, node handling |
| [sthira-karakas.md](jaimini-apparatus/sthira-karakas.md) | Fixed significators of relatives |
| [naisargika-karakas.md](jaimini-apparatus/naisargika-karakas.md) | Natural significators per matter |
| [rasi-drishti.md](jaimini-apparatus/rasi-drishti.md) | Sign aspects |
| [argala-virodhargala.md](jaimini-apparatus/argala-virodhargala.md) | Argala and its obstruction; node reversal dispute |
| [arudha-padas.md](jaimini-apparatus/arudha-padas.md) | Bhava and graha padas; the arudha exception readings |
| [upapada-lagna.md](jaimini-apparatus/upapada-lagna.md) | Upapada (A12) for marriage and spouse |
| [karakamsha-swamsha.md](jaimini-apparatus/karakamsha-swamsha.md) | Karakamsha and Swamsha for vocation, spirituality, spouse |
| [special-lagnas.md](jaimini-apparatus/special-lagnas.md) | Bhava, Hora, Ghati, Varnada, Sri, Indu lagnas and Pranapada |
| [jaimini-raja-yogas.md](jaimini-apparatus/jaimini-raja-yogas.md) | Raja yogas by karakas, padas and special lagnas |
| [jaimini-yogas-career-spouse-children.md](jaimini-apparatus/jaimini-yogas-career-spouse-children.md) | Area yogas from karakamsha, UL and AL |
| [jaimini-longevity.md](jaimini-apparatus/jaimini-longevity.md) | Three-pair method, Rudra, Maheshvara, Brahma (internal only) |
| [upagrahas.md](jaimini-apparatus/upagrahas.md) | Gulika/Mandi, Kala and Dhuma groups |
| [sahams-natal.md](jaimini-apparatus/sahams-natal.md) | Sahams in natal use (PVR) |

### `natal-techniques/` — the promise layer of Parashari judgement

| File | What it holds |
|---|---|
| [00-overview.md](natal-techniques/00-overview.md) | The classical order of judgement (promise → strength → timing), weighting, engine findings |
| [01-bhava-analysis-method.md](natal-techniques/01-bhava-analysis-method.md) | How a house is judged: occupants, lord, karaka, derived house |
| [02-house-significations.md](natal-techniques/02-house-significations.md) | Reference table of house significations |
| [03-graha-drishti.md](natal-techniques/03-graha-drishti.md) | Planetary aspects and partial aspects |
| [04-planetary-dignity.md](natal-techniques/04-planetary-dignity.md) | Exaltation, moolatrikona, own sign, friendships |
| [05-combustion-retrogression-graha-yuddha.md](natal-techniques/05-combustion-retrogression-graha-yuddha.md) | Combustion, retrogression, planetary war |
| [06-shadbala.md](natal-techniques/06-shadbala.md) | Six-fold strength and its minimums |
| [07-bhava-bala.md](natal-techniques/07-bhava-bala.md) | House strength |
| [08-ishta-kashta-phala.md](natal-techniques/08-ishta-kashta-phala.md) | Benign vs harsh potential; two formulas |
| [09-vimshopaka-bala.md](natal-techniques/09-vimshopaka-bala.md) | Varga-dignity strength and vaiseshikamsa counts |
| [10-avasthas.md](natal-techniques/10-avasthas.md) | Planetary states (Baladi, Jagradadi, Deeptadi, Lajjitadi, Shayanadi) |
| [11-shodashavarga-divisional-charts.md](natal-techniques/11-shodashavarga-divisional-charts.md) | The sixteen vargas and what each is for (D7 = children) |
| [12-yoga-pancha-mahapurusha.md](natal-techniques/12-yoga-pancha-mahapurusha.md) | Pancha Mahapurusha yogas |
| [13-yoga-raja-parashari.md](natal-techniques/13-yoga-raja-parashari.md) | Parashari raja yogas and yogakarakas |
| [14-yoga-dhana.md](natal-techniques/14-yoga-dhana.md) | Wealth and penury yogas |
| [15-yoga-chandra.md](natal-techniques/15-yoga-chandra.md) | Lunar yogas (Sunapha, Anapha, Durudhara, Kemadruma, Adhi) |
| [16-yoga-surya.md](natal-techniques/16-yoga-surya.md) | Solar yogas (Vesi, Vosi, Ubhayachari) |
| [17-yoga-nabhasa.md](natal-techniques/17-yoga-nabhasa.md) | The 32 Nabhasa pattern yogas |
| [18-yoga-arishta-balarishta.md](natal-techniques/18-yoga-arishta-balarishta.md) | Arishta and balarishta and their cancellation (internal only) |
| [19-yoga-viparita-raja.md](natal-techniques/19-yoga-viparita-raja.md) | Viparita raja yogas (Harsha, Sarala, Vimala) |
| [20-yoga-neecha-bhanga-raja.md](natal-techniques/20-yoga-neecha-bhanga-raja.md) | Cancellation of debilitation |
| [21-yoga-parivartana.md](natal-techniques/21-yoga-parivartana.md) | Exchange of signs |
| [22-yoga-common-named.md](natal-techniques/22-yoga-common-named.md) | Gajakesari, Budhaditya, Amala, Lakshmi, Saraswati and others |
| [23-nakshatra-natal-reading.md](natal-techniques/23-nakshatra-natal-reading.md) | Janma nakshatra, pada and star lords |
| [24-longevity-classification.md](natal-techniques/24-longevity-classification.md) | Alpa, madhya, purna (internal only) |

### `transits/` — gochara under the dasha, and ashtakavarga

| File | What it holds |
|---|---|
| [00-overview.md](transits/00-overview.md) | How transits are subordinated to dasha and promise; the order of filters; engine outputs |
| [01-gochara-from-moon.md](transits/01-gochara-from-moon.md) | Good and bad houses from the Moon (PD 26, Brihat Samhita 104) |
| [02-vedha-and-vama-vedha.md](transits/02-vedha-and-vama-vedha.md) | Obstruction pairs and reverse obstruction |
| [03-latta.md](transits/03-latta.md) | Planetary kicks on nakshatras |
| [04-tara-bala-and-chandra-bala.md](transits/04-tara-bala-and-chandra-bala.md) | Daily star and Moon strength |
| [05-transit-over-natal-points.md](transits/05-transit-over-natal-points.md) | Transit over natal planets, lagna and sensitive points |
| [06-nakshatra-transit-and-sarvatobhadra.md](transits/06-nakshatra-transit-and-sarvatobhadra.md) | Tara cycle, nakshatra vedha, saptashalaka grid, Sarvatobhadra |
| [07-bhinnashtakavarga.md](transits/07-bhinnashtakavarga.md) | BAV tables per planet; three engine cells differ from PD 23 |
| [08-sarvashtakavarga.md](transits/08-sarvashtakavarga.md) | SAV and the 28 rule |
| [09-trikona-and-ekadhipatya-shodhana.md](transits/09-trikona-and-ekadhipatya-shodhana.md) | The two reductions |
| [10-shodhya-pinda.md](transits/10-shodhya-pinda.md) | Rasi, graha and shodhya pinda; Virgo multiplier |
| [11-kakshya.md](transits/11-kakshya.md) | Eight divisions of a sign for transit timing |
| [12-prastara-ashtakavarga.md](transits/12-prastara-ashtakavarga.md) | The prastara grid |
| [13-ashtakavarga-predictions.md](transits/13-ashtakavarga-predictions.md) | AV predictions for houses, longevity and events |
| [14-saturn-and-jupiter-transit-rules.md](transits/14-saturn-and-jupiter-transit-rules.md) | Sade Sati, Kantaka, Ashtama Shani, Jupiter rules |
| [15-murti-nirnaya.md](transits/15-murti-nirnaya.md) | Gold, silver, copper, iron grading of ingresses |
| [16-rahu-ketu-and-eclipses.md](transits/16-rahu-ketu-and-eclipses.md) | Node transits and eclipses on natal points |
| [17-double-transit.md](transits/17-double-transit.md) | Jupiter and Saturn double transit [MODERN] |
| [18-lagna-vs-moon.md](transits/18-lagna-vs-moon.md) | Reference point for transits |
| [19-retrograde-and-stations.md](transits/19-retrograde-and-stations.md) | Retrograde and stationary planets in transit |

### `tajika-prashna-muhurta/` — annual charts, horary and electional timing

| File | What it holds |
|---|---|
| [00-overview.md](tajika-prashna-muhurta/00-overview.md) | Source base, how the year integrates with the natal chart, engine outputs per person-year / place-day, findings |
| [varsha-pravesha.md](tajika-prashna-muhurta/varsha-pravesha.md) | Casting the sidereal solar return |
| [muntha.md](tajika-prashna-muhurta/muntha.md) | The Muntha (progressed year point) |
| [varshesha-panchadhikari.md](tajika-prashna-muhurta/varshesha-panchadhikari.md) | Year lord from the five office-holders; engine rule differs |
| [tajika-aspects-deeptamsha.md](tajika-prashna-muhurta/tajika-aspects-deeptamsha.md) | Tajika aspects, orbs and numeric strength |
| [tajika-yogas.md](tajika-prashna-muhurta/tajika-yogas.md) | The sixteen Tajika yogas |
| [tajika-sahams.md](tajika-prashna-muhurta/tajika-sahams.md) | Sahams, formulas, day/night and the add-one-sign dispute |
| [tri-pataki-chakra.md](tajika-prashna-muhurta/tri-pataki-chakra.md) | The three-flag diagram |
| [harsha-bala-pancha-vargiya-bala.md](tajika-prashna-muhurta/harsha-bala-pancha-vargiya-bala.md) | Tajika strengths; Venus joy-house finding |
| [masa-pravesha.md](tajika-prashna-muhurta/masa-pravesha.md) | Monthly charts and the month lord |
| [prashna-fundamentals.md](tajika-prashna-muhurta/prashna-fundamentals.md) | Horary charts (Prashna Marga, Shatpanchashika), chapter level |
| [panchang-five-limbs.md](tajika-prashna-muhurta/panchang-five-limbs.md) | Tithi, vara, nakshatra, yoga, karana and their uses |
| [kalam-bands-rahu-yamaganda-gulika.md](tajika-prashna-muhurta/kalam-bands-rahu-yamaganda-gulika.md) | Rahu kalam, Yamaganda, Gulika [REGIONAL] |
| [abhijit-and-day-muhurtas.md](tajika-prashna-muhurta/abhijit-and-day-muhurtas.md) | Abhijit, dur-muhurta, the 30 muhurtas |
| [hora.md](tajika-prashna-muhurta/hora.md) | Planetary hours |
| [choghadiya.md](tajika-prashna-muhurta/choghadiya.md) | Choghadiya vs Tamil Gowri [REGIONAL] |
| [tarabala-chandrabala.md](tajika-prashna-muhurta/tarabala-chandrabala.md) | Personal day filters |
| [muhurta-doshas.md](tajika-prashna-muhurta/muhurta-doshas.md) | Panchaka, Bhadra, Gandanta and other doshas |
| [muhurta-events.md](tajika-prashna-muhurta/muhurta-events.md) | Marriage, travel and business-start muhurta |

### `sanjay-rath/` — Sanjay Rath's method (SJC), written before this set

| File | What it holds |
|---|---|
| [README.md](sanjay-rath/README.md) | Index, source tiers, Rath in one page |
| [01-sources-and-lineage.md](sanjay-rath/01-sources-and-lineage.md) | Rath's books and pages, his students, source weight |
| [02-reading-procedure-and-precedence.md](sanjay-rath/02-reading-procedure-and-precedence.md) | Order of reading and precedence rules |
| [03-jaimini-apparatus.md](sanjay-rath/03-jaimini-apparatus.md) | Karakas, karakamsa, padas, special lagnas, argala in Rath's use |
| [04-dasha-selection-and-ranking.md](sanjay-rath/04-dasha-selection-and-ranking.md) | Vimshottari seed and riders, conditional dashas, which rasi dasha for which question |
| [05-timing-transits-annual-prashna.md](sanjay-rath/05-timing-transits-annual-prashna.md) | Transits, Tithi Pravesha, Sudarshana, agreement, prashna |
| [06-vargas.md](sanjay-rath/06-vargas.md) | Divisional charts, karya bhava, varga Narayana |
| [07-self-mind-spirituality.md](sanjay-rath/07-self-mind-spirituality.md) | Temperament, fortune, spirituality |
| [08-career-and-wealth.md](sanjay-rath/08-career-and-wealth.md) | 10th house, AL, A10, D10; wealth from AL, HL, Sudasa |
| [09-love-marriage-children-family.md](sanjay-rath/09-love-marriage-children-family.md) | Romance, marriage, children, parents, siblings |
| [10-health-education-property-travel-litigation.md](sanjay-rath/10-health-education-property-travel-litigation.md) | Health (sensitive), education, property, travel, litigation |
| [11-yogas-afflictions-protections-remedies.md](sanjay-rath/11-yogas-afflictions-protections-remedies.md) | Testing yogas, afflictions, protections, remedies |
| [12-chart-verification-and-rectification.md](sanjay-rath/12-chart-verification-and-rectification.md) | Chart verification and birth-time rectification |
| [13-user-questions.md](sanjay-rath/13-user-questions.md) | The 49-question bank and the factor each tests |
| [14-technique-mapping.md](sanjay-rath/14-technique-mapping.md) | 75 Rath methods mapped onto existing technique ids |
| [15-sensitive-rules-and-gaps.md](sanjay-rath/15-sensitive-rules-and-gaps.md) | Sensitive rules (titles only), open gaps, corrections |

## How to use this for design

1. **Start from the gap matrix, not the folders.** [`06-gap-matrix.md`](current-specs-review/06-gap-matrix.md) has one
   row per technique with its priority. Work P0 rows first (wrong data served today), then the P1 rows a board needs.
   [`07-recommendation.md`](current-specs-review/07-recommendation.md) gives the order.
2. **Read the technique file's §4 and §8 before writing any engine contract.** §4 is the calculation as the text
   gives it; §8 lists the exact fields the engine must output. Copy the variant choices into the contract as a
   `variant` field instead of picking one silently; §6 says which variants exist.
3. **Respect the evidence tag when you write a rule.** [TEXT] rules can drive a verdict; [COMM] and [MODERN] rules are
   school choices and must be labelled as such; (R) or "verify" items need a print-edition check before they are
   quoted or hard-coded.
4. **Precedence across layers is settled across the folders:** natal promise first; the natal dasha opens the window
   (Vimshottari leads, other dashas confirm); transits time it inside the dasha; the annual chart confirms or denies
   within a year; in-year dashas (Mudda, Patyayini) and Sudarshana time the month. Only the first two links are
   explicit in the texts; the rest is the shared modern practice, consistent with the texts.
5. **Keep sensitive tools internal.** Longevity dashas (Sthira, Shoola, Niryana Shoola, Brahma, Navamsa), maraka,
   arishta and Jaimini longevity are documented for completeness and never reach a reading.
6. **Every finding goes to `docs/TODOS.md`.** The entries from this set are under "Filed 2026-11-18 by the
   classical-techniques deep research", with the matrix row id in brackets.
7. **Board routing in one line each:** You — lagna, Moon, AK, karakamsha, Narayana D1, Sudarshana; Love — 7th and 5th,
   Venus, DK, UL, D9 (D7 is children); Work — 10th/6th/11th, AmK, A10, D10, Sudasa and Narayana D10; Lucky — panchang,
   tara and chandra bala, transits of the day.
