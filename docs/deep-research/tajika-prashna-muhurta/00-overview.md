# Tajika annual charts, Prashna and Muhurta: overview

> This folder documents three timing families from the classical texts so product design can use them. (1) **Tajika
> varṣaphala**: the annual solar-return chart and its apparatus (Muntha, year lord, Tajika aspects and yogas, sahams,
> strengths, monthly charts). (2) **Praśna**: horary charts for the moment a question is asked. (3) **Muhūrta /
> pañcāṅga**: the quality of a moment for a place, with a personal overlay, for the Lucky Times board. Annual dashas
> (Mudda, Patyayini) and Sudarśana are covered by another researcher's files and only referenced here.

## 1. Files

| File | Topic | Engine today |
|---|---|---|
| `varsha-pravesha.md` | Casting the annual chart (sidereal solar return) | Served (`annual.varsha`) |
| `muntha.md` | Muntha | Served (sign and lord) |
| `varshesha-panchadhikari.md` | Year lord from the five office-holders | Served, **rule differs from texts** |
| `tajika-aspects-deeptamsha.md` | Tajika aspects, orbs, numeric strength | Partly served (sign aspects; orbs match) |
| `tajika-yogas.md` | The 16 yogas | 10 served, 2 stubs, 4 missing |
| `tajika-sahams.md` | Sahams, formulas, day/night, add-one-sign | Served, **day/night basis to check** |
| `tri-pataki-chakra.md` | Tri-pataki | Not served |
| `harsha-bala-pancha-vargiya-bala.md` | Tajika strengths | Functions exist, not exported. **Venus joy-house to check** |
| `masa-pravesha.md` | Monthly charts and month lord | Month lords served (mean-month instant) |
| `prashna-fundamentals.md` | Prashna (Praśna Mārga, Praśnatantra, Ṣaṭpañcāśikā) | `prashna` chart served |
| `panchang-five-limbs.md` | Tithi, vāra, nakṣatra, yoga, karaṇa and their uses | Served (noon). Classes done in Node today |
| `kalam-bands-rahu-yamaganda-gulika.md` | Rahu kalam, Yamaganda, Gulika [REGIONAL] | Served |
| `abhijit-and-day-muhurtas.md` | Abhijit, dur-muhurta, 30 muhurtas | Served |
| `hora.md` | Planetary hours | Served (length rule to document) |
| `choghadiya.md` | Choghadiya [REGIONAL] vs. Tamil Gowri | Function exists, not served. **Scheme to verify** |
| `tarabala-chandrabala.md` | Personal filters | Served. **Chandrabala 11th house missing in one function** |
| `muhurta-doshas.md` | Pañcaka, Bhadrā, Gaṇḍānta and others | Mostly not served. **`panchaka_rahitha` is the Kerala scheme** |
| `muhurta-events.md` | Marriage, travel, business start | Not served (proposed `muhurta_search`) |

## 2. Source base and its limits

- **Tajika:** the main primary source used is Balabhadra's *Hāyanaratna* (1649) in Martin Gansten's critical edition and
  translation (Motilal Banarsidass 2020), which is on wisdomlib.org. It quotes Nīlakaṇṭha's *Saṃjñātantra* and
  *Varṣatantra* (the *Tājika-Nīlakaṇṭhī*, 16th c.; dated 1587 CE in one Wikipedia article and 1544 in another, a
  conflict) verse by verse, together with Samarasiṃha, Yādava, Gaṇeśa (*Tājikabhūṣaṇa*), Tejaḥsiṃha and others.
  Nīlakaṇṭha verse numbers in these files are **"as quoted in HR, Gansten numbering"**. They were not checked
  against the Sanskrit editions on archive.org (`tajika_nilakanthi`, `dhjc-tajika-nilakanthi-satika-sa-udaharana…`).
- **Muhurta:** *Muhūrta-cintāmaṇi* exists on archive.org only as Sanskrit and Hindi scans. No English translation is
  online. The muhurta files cite **chapter level only**, and every verse-level claim is marked "verify". This is the
  weakest part of this research.
- **Prashna:** the *Praśna Mārga* table of contents (Raman tr.) was read. Verse text was not. Authorship conflict:
  the brief says Harihara, but the sources say a Nambūtiri of Edakkad, 1649.
- Secondary web summaries (astrobix, scribd, blog pages) were consulted and found to garble definitions (e.g. Yamayā as
  "prohibition"). They are not used as authority.

## 3. Key questions answered

### 3.1 Exact rules with verse references

See each file's §1 and §4. The strongest verse-level coverage: Muntha (Saṃj. 1.66, Varṣ. 2.1), year lord (Samarasiṃha;
Muktāvalī ṭ. 4.3–4, 4.9; Yādava 7.3–7), orbs (Daivajñālaṃkṛti 8.9, Tājikasāra 88), aspect values (Saṃj. 2.11–12),
yogas (Saṃj. 2.17–2.74, TBh 4.4–4.30, Yādava 6.5–6.35), sahams (Saṃj. 3.5–3.24), haddā (Saṃj. 1.33–38), and month lord
(Varṣ. 18.3–6). Muhurta and prashna: chapter level.

### 3.2 How the annual chart is integrated with the natal chart and natal dasha

What the texts read in this pass say:
- [TEXT] They integrate the year with the **natal chart**, not with natal Vimśottarī. A planet that rules a natal
  house, is strong in the year and aspects that house delivers it. Without the aspect the result is "like a dream"
  (Yādava 12.10). The same planet in the same sign in both charts gives full results (Samarasiṃha). Muntha is read in
  both charts (Samarasiṃha; *Hillājatājika*). The year lagna is read as a natal house (Praśnavaiṣṇava 13.73–75). The
  Sun strong in both charts gives real gain, and strong only in the year gives gain "in a dream" (Bṛhajjātaka 8.22, quoted in HR ch. 7 §11).
- [TEXT] Timing inside the year comes from **Tajika's own period systems**: Mudda (the Gaurī school) when the natal
  Moon-sign lord is strong in the year, and others (HR ch. 7 §11). Muntha results come in its lord's period. The other
  researcher covers Mudda and Patyayini.
- [TEXT, gap] None of the Tajika passages read prescribes combining the annual chart with the **natal
  Vimśottarī** mahādaśā. That rule ("the annual chart only times what the natal dasha promises") is a
  [MODERN] doctrine (Raman, K.N. Rao, Sanjay Rath/SJC). It is sound practice and already AI Astra's architecture
  (`general.annual.md`: TP and VP as confirmation).

**Recommended precedence for AI Astra** (design inference, not a text rule): natal promise → natal dasha (Vimśottarī +
others) → transits → annual chart (year lord, Muntha, yogas for the asked house, sahams) → Mudda/Patyayini month timing →
monthly chart. The annual layer can **confirm or deny within a year**. It does not create events the natal layer does not support.

### 3.3 What the engine must output

**Per person-year (annual chart):**

| Block | Fields |
|---|---|
| Return | instant (UTC and local), place used, `is_day_revolution`, weekday and panchanga at the instant, calc_version |
| Charts | D1, D9 (for dignities) of the varṣa chart; varṣa lagna's natal house |
| Muntha | sign, lord, annual house, natal house, aspects on it, lord's dignity and house; optional longitude and monthly steps |
| Year lord | candidates with offices, aspect to the lagna (kind, strength), pañcavargīya; the winner; the rule path; the strength grade |
| Strength | pañcavargīya (5 components, /20) and harṣa (4 components, /20) per planet |
| Aspects | per pair: Tajika kind, distance, gap, within-orb rule, applying/separating, 60-point strength |
| Yogas | for each house 1–12 (and key sahams): yogas between the varṣa-lagna lord and the house lord (+ Moon), with grade and degrees or days to perfection; all 16 kinds; Kuttha and Duruḥpha as planet flags |
| Sahams | ~50, each with formula id, day/night basis (revolution), add-one-sign flag, sign, lord, house, aspects |
| Months | 12 month instants (true Sun +30°), month lagna, month lord with candidates |
| Tri-pataki (low) | the Moon and planets moved, malefic or benefic on the Moon |

**Per place-day (shared Lucky Times table, doc 47):** sunrise, sunset, moonrise and moonset; the five limbs at sunrise
and noon with every change time and class tags (tithi group, vāra nature, star class and face, avoided yoga, karaṇa
kind, combination yogas); the 30 muhūrtas with Abhijit (and exception reason), dur-muhūrta and the good named
muhūrtas; Rahu kalam, Yamagaṇḍa and Gulika (day and night, tagged regional); varjyam and amṛta; 24 horās (with the
length rule); choghadiya and/or Gowri (scheme-tagged); doṣa spans (Pañcaka with scope, Bhadrā with residence and
mukha/puccha, gaṇḍānta by kind, Venus or Jupiter combust, mala-māsa); the udaya-lagna table; chandrāṣṭama sign.

**Per person-day (overlay):** tārā (name, cycle, quality) and candrabala at each Moon change, chandrāṣṭama span, and
the Moon's house from the natal lagna and Moon.

**Per event search:** ranked windows with passed and failed rules, doṣas, cancellations and the rule source (`muhurta-events.md`).

## 4. Engine findings to file (the caller files them in `docs/TODOS.md`. This researcher may not)

1. Year-lord selection (`tajaka._get_the_lord_of_tajaka_chart`) prefers benefic-aspect candidates and then takes the
   strength maximum over **all** candidates, including ones that do not aspect the lagna. It falls back to the
   Sun/Moon-sign lord. The texts require an aspect and choose the strongest among the aspecting candidates.
2. `lord_of_the_year` and `lord_of_the_month` use mean-year and mean-month instants (`jd_at_dob + years × year_value`), not the true solar return or the +30° Sun ingress that the served chart uses.
3. `annual.sahams` reverses formulas by **natal** day/night (`annual_export.py:740`). The Tajika texts use the revolution's day/night.
4. `const.harsha_bala_houses` gives Venus's joy house as the 12th. The texts give the 5th.
5. `tajaka_yoga.get_gairi_kamboola_yoga_planet_pairs` and `get_khallasara_yoga_planet_pairs` are stubs that return
   None. Dutthottha-davīra, Tambīra, Kuttha and Duruḥpha are not implemented.
6. `drik.chandrabalam` uses good houses `[1,3,6,7,10]`. The 11th is missing.
7. `drik.panchaka_rahitha` is the Kerala/Tamil sum-mod-9 pañcaka, not the Dhaniṣṭhā Pañcaka of MC. The names collide.
8. `drik.gauri_choghadiya`: verify whether it returns the North Indian choghadiya or the Tamil Gowri pañcāṅgam.
9. Tajika "semi_sextile" (signs 2 and 12) in the aspect export: the Tajika texts give no aspect there. Make sure it is not used in yogas or year-lord logic.

## 5. Board and reading map

| Product surface | Techniques | Weight |
|---|---|---|
| Lucky Times (Today, Week, Month) | Five limbs, avoid bands, Abhijit, horā, choghadiya, doṣas, tārā and candrabala, event rules | Primary |
| Self / Love / Work "this year" cards | Year lord, Muntha house, yogas for the 1st / 7th and 5th / 10th houses, Vivāha, Karma and Rājya sahams, month lords | Confirmation under natal dasha and transits |
| General readings (`general.annual`) | All of the Tajika apparatus as evidence; TP first, VP confirming (existing design) | Secondary |
| Chat "will X happen" | Optional praśna chart as a second witness | Secondary, product decision pending |

Words: no Tajika, saham, muntha or Sanskrit terms on consumer surfaces (`general.annual.md` §5; doc 45). Never name the engine.

## 6. Recommendation

Fix the year-lord, saham day/night, month-instant and harṣa table issues in the engine first (small, high-leverage,
and they change what readers say). Then add `tajaka_yogas_for(house)` with the four missing yogas. Then serve the
place-day doṣa and class tags so Lucky Times stops deriving them in Node. Before any muhurta rule table is fixed in the
engine, do a dedicated verse-level pass through *Muhūrta-cintāmaṇi* ch. 1, 2, 6 and 11 (Sanskrit plus the G.C. Sharma English).
