# Ayurdaya Dashas: Pinda, Amsa, Nisarga (piṇḍāyu / aṃśāyu / nisargāyu daśā; Paiṇḍī, Āṃśī, Naisargika)

> These three classical longevity methods give each planet (and the Lagna) a number of years based on its position. The
> base is exaltation for Pinda, the navamsa count for Amsa and fixed years for Nisarga. Fixed reductions (haranas) for
> combustion, enemy sign, rising malefics and placement in the visible half of the chart are then applied. The sum is
> the life span, and each planet's own share serves as its dasha period. They answer "how long is the life span?" and,
> as dashas, "which planet runs which slice of it". Parashara names Paindi and Amshi dashas in his list (46.10). The next verse's "not universally accepted"
> clause (46.11) may or may not extend to them; this is unverified. Varahamihira (BJ ch. 7–8) and Kalyanavarma (Saravali) set out the method in full. Modern
> practice uses them almost only for longevity research, and the method is ethically sensitive.

## 1. Sources (text, edition, chapter:verse; URLs)

BPHS uses site numbering throughout: https://enjoylearningsanskrit.com/scriptures/parashara/chapter-43 and chapter-46.

| Rule | Source | Tag |
|---|---|---|
| Pindayu at deep exaltation: Sun 19, Moon 25, Mars 15, Mercury 12, Jupiter 15, Venus 21, Saturn 20 years. Half in deep debilitation, proportional in between (*anupātataḥ*). | BPHS 43.6–7. The site's Sanskrit for Venus reads *viṃśati* (20) but is glossed 21; 21 is the usual BJ value. | [TEXT] |
| Arc correction: if the arc from exaltation exceeds 6 signs, subtract it from 12 signs, then take that arc × the planet's years ÷ 12 signs | BPHS 43.8 | [TEXT] |
| Combust planet loses 1/2, except Venus and Saturn. One-third is lost in an enemy sign; the site's translation of the retrograde clause is loose. | BPHS 43.9 | [TEXT] |
| Chakrapata (visible-half) reduction: a malefic in the 12th loses all of its share, in the 11th 1/2, 10th 1/3, 9th 1/4, 8th 1/5, 7th 1/6. A benefic loses half of that. | BPHS 43.10. The site's translation is loose; this reading is the standard one. | [TEXT]/[COMM] |
| Lagna's years: the number of the sign, with fractions by degree; the full sign when the Lagna lord is strong | BPHS 43.14–15 | [TEXT] |
| Nisargayu years: Moon 1, Mars 2, Mercury 9, Venus 20, Jupiter 18, Sun 20, Saturn 50, called *daśā* | BPHS 43.16–17 | [TEXT] |
| Amsayu: the planet gives years equal to the navamsas it has traversed. ×3 in exaltation or own sign; ×2 in own navamsa, own drekkana or *uttama*; if both apply, triple only. | BPHS 43.18–22 | [TEXT] |
| Which method: one reading is Lagna lord strong → Amsa, Sun → Pinda, Moon → Nisarga. If two are equally strong, take half their sum; if all three, a third. | BPHS 43.31–32. The site's translation conflicts with its own Sanskrit (*ravau piṇḍodbhavaṃ*); the verse needs checking. | [TEXT] |
| Paramayu (full life) of 120 years | BPHS 43.24, 43.54 | [TEXT] |
| Paindi and Amshi dashas named; periods tied to the declared life-span shares | BPHS 46.10, 46.201 | [TEXT] |
| Same scheme: Pinda years, haranas, Satyacharya's Amsa method, choice by the strongest of Lagna/Sun/Moon, and dasha order in ch. 8 | Brihat Jataka ch. 7 (Ayurdaya) and ch. 8 (Dashantardasha). Chidambaram Iyer translation, Madras 1885 (Wellcome catalogue). Verse numbers not verified this pass. | [TEXT] |
| Same scheme in more detail, including krurodaya (malefic rising) harana | Saravali, longevity chapters (Rath cites Saravali 41–42 for dasha order). Not fetched. | [TEXT] |
| Krurodaya detail: the malefic nearest the Lagna degree counts; ignored if a benefic is nearer; halved if benefics aspect or occupy the Lagna | Santhanam's notes, as quoted in the engine's `aayu.py` docstrings | [COMM] |

## 2. When it applies (which charts, which life areas)

- **Chart.** The natal chart.
- **Life area.** Longevity (the alpa/madhya/purna classes). As dashas, each planet's slice of life.
- **Product scope.** The product must not predict death. That leaves two uses:
  - Rath's school: the dasha order (Mula-style) is used for karma and remedial timing, not for death.
  - Strength comparison: which planet "holds more of the life".

## 3. Inputs required (exact chart data)

- Sidereal longitudes of Sun..Saturn and the Lagna.
- Exaltation points.
- Combustion state (astangata) and retrograde state.
- Sign-lord friendship: natural, or compound (panchadha maitri) per school.
- Navamsa positions.
- Whole-sign houses from the Lagna, for chakrapata and krurodaya.
- The degree distance of malefics from the Lagna degree.
- Benefic aspects on the Lagna.
- Shadbala or another strength measure for Lagna, Sun and Moon, to choose the method.

## 4. Calculation (step by step; start, order, period table, sub-period rule, year length)

**A. Pindayu** (BPHS 43.6–10; BJ 7)

1. Find the arc from the planet to its deep-debilitation point (0–180°).
2. Base years = full years × (0.5 + 0.5 × arc/180).
3. Apply the haranas. Only the largest reduction applies when several compete (BJ/Saravali convention, [COMM]; not
   verified):
   - **Chakrapata:** a malefic in house 12 → 7 loses 1, 1/2, 1/3, 1/4, 1/5, 1/6 of its years; a benefic loses half of
     that.
   - **Shatrukshetra:** in an enemy sign, lose 1/3. Retrograde planets are exempt per BJ [COMM]. Mars is exempt in some
     readings; the engine has a flag for this.
   - **Astangata:** a combust planet loses 1/2, except Venus and Saturn.
   - **Krurodaya:** a malefic rising in the Lagna reduces the total. The rules are given under §1.
4. Add the Lagna's contribution (BPHS 43.14–15).
5. The sum is the life span, capped by paramayu.

**B. Amsayu** (BPHS 43.18–22; BJ 7, Satyacharya)

1. Years per planet = longitude ÷ 3°20′, the navamsas traversed counted from Aries, reduced mod 12.
2. Multiply by 3 in exaltation, own sign or retrograde. "Retrograde" is the BJ reading [COMM].
3. Multiply by 2 in own navamsa, own drekkana or vargottama.
4. If both apply, multiply by 3 only. The engine calls these multiplications *bharana*.
5. The haranas then apply.

**C. Nisargayu** (BPHS 43.16–17)

1. Fixed years: Moon 1, Mars 2, Mercury 9, Venus 20, Jupiter 18, Sun 20, Saturn 50.
2. Scale between debilitation (half) and exaltation (full), as for Pinda (the engine does this), then apply the haranas.

**D. Choice of method**

- The strongest of Lagna, Sun and Moon decides: Lagna → Amsa, Sun → Pinda, Moon → Nisarga (BJ 7 / BPHS 43.31).
- If two are equal, take half the sum; if all three, a third (BPHS 43.32).

**E. As dashas** (Paindi, Amshi, Naisargika ayur-dasha; BJ ch. 8 order, verse not verified)

1. The first dasha goes to the strongest of Lagna, Sun and Moon.
2. Then the planets in kendras from it, then panapharas, then apoklimas. Within a group, the stronger goes first.
3. Each dasha lasts that planet's computed years.
4. Antardasha weights follow the Naisargika rule (see `naisargika-dasha.md`).

**Year length.** Not stated in the texts reviewed. The engine uses the sidereal year.

**Caveat.** Items in §4 attributed to BJ or Saravali come from secondary or engine descriptions; the BJ and Saravali
text was not opened. This covers the retrograde exemption, ×3 for retrograde, vargottama as a ×2 case (BPHS says
*uttama*), harana precedence, and the Lagna/Sun/Moon → Amsa/Pinda/Nisarga mapping. Treat them as unread.

## 5. Interpretation rules (tagged)

- **Life-span class.** *dvāviṁśāt pūrvam alpāyuḥ … catuṣṣaṣṭyāḥ purastāt … dīrgham*. Short, medium and long life are
  under 22, 22–64 and 64 and over (BPHS 44.11, site numbering, verse checked). [TEXT]
  - The engine's `const.aayu_types` uses 0–32, 33–70 and 71–100, a different (BJ-style?) scheme. Flag it.
  - Out of product scope.
- **A planet's share is its strength.** A planet with large years after the haranas is "a long-lived signification".
  [MODERN] inference; not a text rule.
- **Harana as a quality signal.** A combust planet, or a malefic in the 12th or 11th, loses its share. The reductions
  double as affliction flags already captured by other engine outputs. [MODERN]

## 6. Variants and disputes (school by school)

- **Venus:** 20 or 21 years (BPHS text vs gloss; BJ 21).
- **Retrograde:** one-third reduction (one reading of BPHS 43.9) or exemption from the enemy-sign reduction (BJ, [COMM]).
- **Mars in an enemy sign:** reduced or exempt.
- **Method choice:**
  - "Strongest of Lagna/Sun/Moon" (BJ).
  - Or a mixed reading of BPHS 43.31. The site's English and Sanskrit conflict.
- **Engine.**
  - The engine's `aayu.py` carries two variant sets: Santhanam/BPHS and Varahamihira, via a Medium article.
  - Its own header says "DO NOT USE THIS YET – NOT FULLY IMPLEMENTED".
  - The krurodaya sub-rules are marked TODO.

## 7. Worked micro-example (optional, short)

The Sun at 10° Aries is at deep exaltation, so its base is 19 years. Combustion does not apply to the Sun itself. As a
malefic in the 12th house, chakrapata removes all of it; in the 7th it would lose only 1/6 (≈3.2 years).

## 8. Design notes for AI Astra

- **Do not surface longevity.** The product does not predict death or life span. These outputs may serve only:
  - the strength ranking of planets ("which planet carries the most life weight");
  - the Mula-style dasha order (see `moola-dasha.md`).
- **If the engine adds them, it should output per planet:**
  - base years;
  - each harana with its fraction and reason;
  - net years;
  - the method chosen and why;
  - the dasha sequence with dates.
- **Engine readiness.** The current engine module is self-declared incomplete. Treat this as an engine addition: finish
  `aayu.py` against BJ 7 and Saravali, with a verification harness. Node computes nothing.
- **Weight.** Very low for boards; research-only.

## 9. Open questions

- Fetch the BJ ch. 7–8 verse text (Iyer 1885 or Bhat) and Saravali's longevity chapters to pin down:
  - harana precedence (the largest only, or cumulative);
  - the retrograde rule;
  - the krurodaya details.
- Whether paramayu is 120 years 5 days (a commonly quoted refinement) was not verified.
- Which year length the texts imply.
