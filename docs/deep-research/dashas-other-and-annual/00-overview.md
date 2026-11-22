# Other and Annual Time-Cycles: Overview (minor and annual daśās; descriptive title, not a Sanskrit term)

> This file compares the strength-based, longevity-based, annual and cyclic clocks covered in this folder. It sets out
> each clock's span, purpose, textual standing and reliability, and how each layers with Vimshottari, the primary natal
> dasha. Nakshatra dashas (Vimshottari, Yogini, Tithi Ashtottari and others) and Jaimini rasi dashas are covered in
> sibling folders.

## 1. Sources (text, edition, chapter:verse; URLs)

- **BPHS.** Web edition at https://enjoylearningsanskrit.com/scriptures/parashara, 97 chapters, site numbering. It
  probably follows the Santhanam/G.C. Sharma arrangement, but this is unconfirmed.
  - Ch. 43: ayurdaya.
  - Ch. 44: longevity classes and maraka.
  - Ch. 46: dashas; 46.3–11 is the list, and 46.201–209 covers Paindi, Ashtakavarga, Sandhya, Pachaka and Tara.
  - Ch. 74: Sudarshana.
- **Brihat Jataka ch. 7–8, Saravali ch. 41–42, Jataka Parijata V.** Cited via Sanjay Rath; verses not verified.
- **Tajika Neelakanthi.** archive.org scan; not read this pass.
- **PVR Narasimha Rao, *Vedic Astrology: An Integrated Approach*, ch. 30.** Via the engine's encoded test examples.
- **Sanjay Rath.** srath.com.
- **Engine.** AIAstra_Radha (pyjhora) code.

## 2. When it applies (which charts, which life areas)

### Comparison table

| Clock | File | Span | Chart | Purpose | Standing | Reliability for events |
|---|---|---|---|---|---|---|
| Naisargika | `naisargika-dasha.md` | lifetime (fixed ages) | natal | life stage | [TEXT] BPHS 43.16–17; named in 46.10, whether 46.11's "not universally accepted" covers it is unverified; BJ/Saravali use it (via Rath) | low; background only |
| Pinda/Amsa/Nisarga ayur-dashas | `ayurdaya-dashas-pinda-amsa-nisarga.md` | lifetime | natal | longevity and slices of life | [TEXT] BPHS 43, BJ 7–8, Saravali | research only; longevity is out of product scope |
| Moola (Mula) | `moola-dasha.md` | lifetime | natal | karma and remedial (SJC); the engine's version is a rasi dasha | BJ-derived / [MODERN]; not in the BPHS list | low; unverified |
| Sandhya + Pachaka | `sandhya-and-pachaka-dasha.md` | lifetime, 10-year signs, months | natal | decade house theme | [TEXT] BPHS 46.204–206; "not universally accepted" | very low |
| Ashtakavarga dasha | `ashtakavarga-dasha.md` | (modifier) | natal | strength scaling of any period | [TEXT] BPHS 46.203; no period table | as a modifier: medium |
| Tara | `tara-dasha.md` | lifetime (120 years) | natal, conditional | Vimshottari reordered by kendra planets | [TEXT] BPHS 46.207–209; "not universally accepted" | low |
| Sudarshana Chakra | `sudarshana-chakra-dasha.md` | year / month / 2.5 days | natal | house of focus | [TEXT] BPHS 74 (full chapter) | medium-high for focus |
| Mudda | `mudda-dasha.md` | one year | natal Moon star + annual chart | in-year timer | Tajika practice; [MODERN] formula; verse not found | medium |
| Patyayini | `patyayini-dasha.md` | one year | Tajika annual chart | in-year timer | Tajika (Neelakanthi tradition, unverified) + PVR | medium |
| Varsha Narayana | `varsha-narayana-dasha.md` | one year (~3 days per Narayana year) | annual chart (any varga) | in-year sign focus | [MODERN] PVR | low-medium |
| Tithi Pravesha + year lord | `tithi-pravesha-chart-and-year-lord.md` | lunar year (~354/384 days) | TP chart | kind of year; year lord | [MODERN] SJC | medium (SJC) |
| Maturity ages / progressions | `planetary-maturity-ages-and-progressions.md` | fixed ages | none / natal | when a promise ripens | [MODERN]/folk, unsourced | very low |

## 3. Inputs required (exact chart data)

See each file. Every input comes from the engine. Node computes nothing: no weekday, hora, nakshatra, degree, house or
period arithmetic.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

### Primary vs secondary in the texts

The BPHS points below were read at verse level. The Varahamihira, Tajika and modern-school points are this researcher's
synthesis from secondary sources (Rath's site, engine-encoded PVR examples). The primary texts were not opened.

- **Parashara.**
  - Vimshottari is the principal (*mukhyā*) dasha (BPHS 46.3, 46.14).
  - 46.11 marks Ashtakavarga, Sandhya, Pachaka and "others beginning with Tara" as **not universally agreed**
    (*na … sarvasammatāḥ*).
  - Paindi, Amshi and Naisargika are listed in 46.10; whether the clause covers them is unverified.
  - Sudarshana gets its own chapter (74) and is presented as the method for annual, monthly and daily results, to be
    checked against Ashtakavarga (74.27–28).
- **Varahamihira** (BJ 7–8, via Rath). The longevity-based dashas and Naisargika plus Mula are **his** working dashas;
  Vimshottari is absent from BJ.
- **Tajika** (Neelakanthi and successors). For the annual chart, the in-year dashas (Patyayini, Mudda) are **primary**
  inside the year. The annual chart itself is secondary to the natal promise.
- **Modern schools.**
  - Primary: Vimshottari, plus Jaimini rasi dashas (Rath, K.N. Rao).
  - Annual layer: Tajika varshaphala with Mudda and Patyayini (PVR, K.N. Rao circle), and Tithi Pravesha with Tithi
    Ashtottari (Rath).
  - Focus clock: Sudarshana.
  - The rest are rarely used.

### Year-length inconsistency in the engine

| Module | Year length |
|---|---|
| Mudda | tropical year / 360-day scale |
| Patyayini | average Gregorian year |
| Sudarshana, Naisargika, Sandhya, Tara | sidereal year |
| Varsha Narayana | year / 360 × 3 |

Annual systems should anchor on the true varsha pravesh or TP instant, not birth JD + n × constant.

## 5. Interpretation rules (tagged)

### How to layer an annual dasha with the natal dasha

These rules are this researcher's synthesis of [MODERN] practice; PVR, K.N. Rao and Rath were not opened directly.
They rest on [TEXT] principles: agreement in BPHS 74.27–28, and BJ's "both dashas agree → sure" via Rath.

1. **Promise first.** The natal chart must promise the event: house, lord and karaka.
2. **Natal dasha window.** The natal Vimshottari mahadasha and antardasha (and the pratyantardasha, for months) must
   connect to the event houses. Without this, no annual layer can produce the event.
3. **Annual confirmation.** In the year's chart (solar return, or TP for SJC), the relevant house and lord, the Muntha
   and the year lord (Varsheshwara, or the TP vāra lord) must support it.
4. **In-year timing.** Within the year, the Mudda or Patyayini period lord must:
   - be the same planet as the natal dasha or antardasha lord; or
   - own or occupy the event house in the annual chart; or
   - be in Tajika aspect or Ithasala with its lord.

   When Mudda and Patyayini agree, confidence is highest.
5. **Focus check.** The Sudarshana year or month house should be the event house in at least one wheel, ideally the
   Lagna or Moon wheel, with good Ashtakavarga (BPHS 74.27–28).
6. **Transit trigger.** Transits (the transit researcher's scope) give the days.
7. **Disagreement rule.** When the layers disagree, the natal dasha outranks the annual chart, which outranks the
   in-year dasha. Ashtakavarga breaks ties for Sudarshana.

## 6. Variants and disputes (school by school)

- **Annual chart type.** Tajika solar return (Neelakanthi; most Indian practice) vs Tithi Pravesha (Rath). The two
  years do not align; see the TP file.
- **Mudda anchor and balance.** See `mudda-dasha.md`.
- **Moola naming.** The graha system vs the engine's rasi system.

## 7. Worked micro-example (optional, short)

A job change in 2027:

1. The natal Saturn–Mercury antardasha links the 10th and 6th houses.
2. The 2027 solar return has the Muntha in the 10th.
3. The Mercury Patyayini runs in July–August.
4. Mercury's Mudda overlaps in August.
5. The Sudarshana year house is the 10th from the Moon.
6. Jupiter's transit aspects the natal 10th in August.

Read: August 2027 is the strongest window.

## 8. Design notes for AI Astra

### Engine findings to file

The parent session must file these in `docs/TODOS.md`; this folder does not edit it.

1. **Mudda start-lord bug.** It was verified by running the engine. `mudda.varsha_vimsottari_dasha_start_date` adds
   `years` to a **planet id** instead of the lord's index in the Vimshottari order. The starting lord is wrong for natal
   Moon stars ruled by Rahu, Saturn, Mercury, Ketu or Venus: 15 of the 27 nakshatras. This affects `annual.mudda` and
   `annual.tithi_pravesha_dasha` (`mudda`).
2. **Sudarshana not natal-seeded.** `sudharsana_chakra_dhasa_for_divisional_chart` seeds from the chart at
   birth + N years, not the natal chart. It shifts by N − 1 (so age 0 starts at the 12th house), prints debug output,
   and is not exported.
3. **Naisargika differs from the texts.** It adds a 12-year Lagna period (132 years in total, against 120 in the texts).
   It splits antardashas equally rather than by the Saravali/Rath weights, and rounds them (about 7 days of drift).
4. **`aayu.py` incomplete.** It is self-declared "DO NOT USE"; the krurodaya TODOs are open. Also,
   `const.aayu_types` (0–32, 33–70, 71–100) differs from BPHS 44.11 (under 22, 22–64, 64 and over).
5. **Moola naming.** The engine's "moola" (`moola.py`) duplicates `kendradhi_rasi.py` (the Lagna Kendradi rasi dasha).
   It is not the BJ/SJC graha Mula dasha.
6. **Year lengths are inconsistent** across the annual modules.
7. **TP year fallback.** `vratha.tithi_pravesha` silently uses the current year when the year is less than or equal to
   the birth year.
8. **Tara.** `tara.py` does not enforce the "all four kendras occupied" condition stated in its own docstring. It
   starts from the strongest kendra planet, then follows a fixed lord list.

### Board mapping

| Board | Clocks |
|---|---|
| Today / Lucky | Sudarshana 2.5-day sign + panchang; TP year lord as colour |
| You / Self | Naisargika stage (context); Sudarshana year house; TP kind-of-year |
| Love | natal dasha → annual 5th and 7th → Mudda/Patyayini → Sudarshana 5th or 7th |
| Work | natal dasha → annual 10th/6th/11th → Mudda/Patyayini → Sudarshana 10th; Varsha Narayana in D10 |

### Weights

| Weight | Clocks |
|---|---|
| Highest | Vimshottari (not in this folder) |
| Medium | Patyayini, Mudda, Sudarshana, TP |
| Low | Varsha Narayana, Tara |
| Context only | Naisargika, Sandhya |
| Research only | ayur-dashas, Moola |
| Modifier only | Ashtakavarga |
| Off by default | maturity ages |

## 9. Open questions

- Primary-text checks still owed:
  - Tajika Neelakanthi (Patyayini, Mudda);
  - BJ 7–8 and Saravali 41–42 (ayurdaya, haranas, antardasha weights);
  - PVR ch. 30 (Mudda balance; Varsha Narayana base);
  - Rath's Tithi Pravesha text.
- The BPHS edition behind the site's numbering.
