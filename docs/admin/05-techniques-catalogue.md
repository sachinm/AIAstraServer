# 05 — The techniques catalogue, as registered on 2026-11-06

Generated from `technique_registry` (the catalogue in `src/techniques/catalog.ts`, seeded at boot; docs/admin/03). The Admin
Panel shows the same rows with their runs, timings and accuracy at https://admin.vedic-astrology.app/techniques. Regenerate
with `npx tsx scripts/write-techniques-doc.ts` after the catalogue changes.

Every row is a contract (doc 53 §4.3): *Selected when* says which questions or boards choose it; *Contract* says what it reads, in which table layout, under which prompt, and what it returns.

Counts: 66 techniques (Self (You board): 15, Love: 14, Work: 16, General Reading: 21); 66 built, 0 partly built, 0 planned. Agents registered: 30.

## Summary

| Id | Technique | Category | Board | Status | Charts and tables read | Agents | Accuracy evidence |
|---|---|---|---|---|---|---|---|
| `lucky.avoid_bands` | Avoid bands and good spans of the day | self | Lucky times | Built | kalams (panchang), muhurta (panchang) | `lucky.scenario_windows` | staff |
| `lucky.day_tables` | Shared day tables per place | self | Lucky times | Built | muhurta (panchang) | `lucky.day_tables` | none |
| `lucky.home.start_routine` | Start a routine | self | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.panchang_limbs` | The five limbs of the day (vara, tithi, nakshatra, yoga, karana) | self | Lucky times | Built | weekday (panchang), tithi (panchang), nakshatra (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.personal_overlay` | Personal overlay (tara, chandra bala and the chart marks) | self | Lucky times | Built | muhurta (panchang), tara (nakshatra), chandra bala (panchang) | `lucky.day_overlay` | staff |
| `lucky.study.exam_submit` | Exam or submit | self | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.travel.set_out` | Set out on a journey | self | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `self.activation` | Activation of houses 1, 4 and 5 with the Moon by every dasha system | self | You board | Built | Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | `area.self_board` | area_checks:self |
| `self.affliction` | Afflictions on houses 1, 4 and 5 with the Moon | self | You board | Built | facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal) | `area.self_board` | area_checks:self |
| `self.annual` | This year's chart for houses 1, 4 and 5 with the Moon | self | You board | Built | Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual) | `area.self_board` | area_checks:self |
| `self.nakshatra` | Nakshatra charter of houses 1, 4 and 5 with the Moon | self | You board | Built | cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra) | `area.self_board` | area_checks:self |
| `self.promise` | Natal promise of houses 1, 4 and 5 with the Moon | self | You board | Built | facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal) | `area.self_board` | area_checks:self |
| `self.protection` | What protects houses 1, 4 and 5 with the Moon | self | You board | Built | aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | `area.self_board` | area_checks:self |
| `self.transit` | Transits over houses 1, 4 and 5 with the Moon | self | You board | Built | Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga) | `area.self_board` | area_checks:self |
| `self.varga` | Owning divisional chart of houses 1, 4 and 5 with the Moon | self | You board | Built | D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | `area.self_board` | area_checks:self |
| `love.activation` | Activation of house 7 by every dasha system | love | Love board | Built | Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D9 (divisional), D7 (divisional), D30 (divisional) | `area.love_board` | area_checks:love |
| `love.affliction` | Afflictions on house 7 | love | Love board | Built | facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal) | `area.love_board` | area_checks:love |
| `love.annual` | This year's chart for house 7 | love | Love board | Built | Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual) | `area.love_board` | area_checks:love |
| `love.health` | How the relationship is | love | Love board | Built | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | `area.love_board` | area_checks:love |
| `love.meet` | Meeting someone | love | Love board | Built | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | `area.love_board` | area_checks:love |
| `love.nakshatra` | Nakshatra charter of house 7 | love | Love board | Built | cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra) | `area.love_board` | area_checks:love |
| `love.promise` | Natal promise of house 7 | love | Love board | Built | facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal) | `area.love_board` | area_checks:love |
| `love.protection` | What protects house 7 | love | Love board | Built | aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D9 (divisional), D7 (divisional), D30 (divisional) | `area.love_board` | area_checks:love |
| `love.reconcile` | Strain and reconciling | love | Love board | Built | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | `area.love_board` | area_checks:love |
| `love.transit` | Transits over house 7 | love | Love board | Built | Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga) | `area.love_board` | area_checks:love |
| `love.varga` | Owning divisional chart of house 7 | love | Love board | Built | D9 (divisional), D7 (divisional), D30 (divisional) | `area.love_board` | area_checks:love |
| `lucky.love.ask_out` | Ask someone out | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.love.clear_air` | Clear the air | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.love.first_date` | A first date | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.money.invest_buy` | Invest or buy | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.ask_raise` | Ask for a raise | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.hard_talk_boss` | A hard talk with the boss | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.interview` | Interview or pitch | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.send_resume` | Send a resume or application | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.sign_contract` | Sign a contract | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.start_project` | Start a project | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `work.annual_family` | This year's chart (annual family) | work | Work board | Built | Tithi Pravesha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D10 (divisional) | `area.career_inputs`, `area.career_map` | staff |
| `work.conditional_family` | Conditional clock | work | Work board | Built | applicable (dasha), conditional (dasha) | `area.career_inputs`, `area.career_map` | staff |
| `work.d10_check` | D1 and D10 agreement on each dasha vote | work | Work board | Built | D1 (divisional), D10 (divisional), D9 (divisional), D60 (divisional) | `area.career_inputs`, `area.career_map` | staff |
| `work.horizons` | Horizons (1, 3, 6, 12 months) | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `work.karaka_family` | Karaka clock | work | Work board | Built | karaka (dasha), chara karakas (jaimini), D10 (divisional) | `area.career_inputs`, `area.career_map` | staff |
| `work.looking_back` | Looking back | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | area_checks:career |
| `work.present_tone` | Present tone | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | area_checks:career |
| `work.security_grade` | Job security by month | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `work.subarea_windows` | Windows ahead by sub-area | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `digest.activation` | Activation calendar, thirty years ahead | general | General Reading chat | Built | all systems (dasha), applicable (dasha), facts (natal) | `digest.activation` | none |
| `digest.annual_set` | Annual set, ten years back and ahead | general | General Reading chat | Built | Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D9 (divisional), D10 (divisional) | `digest.annual_set` | none |
| `digest.build` | Kundli digest (the first-time breakdown) | general | General Reading chat | Built | dignities (natal), aspects (natal), argala (jaimini), arudhas (jaimini), house counts (natal), sav (ashtakavarga), facts (natal), avasthas (natal), strength.shadbala (natal), benefic malefic (natal), yogas (natal), doshas (natal), charakaraka (jaimini), sphutas (natal), Tithi Pravesha (annual), varsha (annual), janma (nakshatra), panchanga (natal) | `digest.build` | staff |
| `general.annual` | Annual set analyst | general | General Reading chat | Built | facts (natal), Tithi Pravesha (annual), tithi pravesha dasha (annual), varsha (annual), sahams (annual), mudda (annual), patyayini (annual), tajaka (annual) | `reading.analyst.annual` | staff |
| `general.clarify` | Clarify | general | General Reading chat | Built | — | `reading.clarify` | staff |
| `general.dasha` | Dasha analyst (all systems) | general | General Reading chat | Built | facts (natal), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), Vimshottari (dasha), Narayana (dasha), conditional (dasha), Chara (dasha), karaka (dasha), Yogini (dasha), Tithi Ashtottari (dasha) | `reading.analyst.dasha` | staff |
| `general.intake` | Intake | general | General Reading chat | Built | — | `reading.intake` | staff |
| `general.jaimini` | Jaimini analyst | general | General Reading chat | Built | charakaraka (jaimini), arudhas (jaimini), argala (jaimini), Narayana (dasha), Chara (dasha) | `reading.code.jaimini` | staff |
| `general.nakshatra` | Nakshatra analyst | general | General Reading chat | Built | facts (natal), janma (nakshatra), Vimshottari (dasha), transit overlay (transit) | `reading.analyst.nakshatra` | staff |
| `general.oracle` | Oracle and synthesizer | general | General Reading chat | Built | — | `reading.oracle`, `reading.synth` | staff |
| `general.person` | The person in your chart | general | General Reading chat | Built | facts (natal), aspects (natal), D12 (divisional), D9 (divisional), D7 (divisional), D3 (divisional), Vimshottari (dasha) | `reading.code.person` | staff |
| `general.prashna` | Question chart analyst | general | General Reading chat | Built | facts (natal), prashna (natal) | `reading.analyst.prashna` | staff |
| `general.promise` | House promise analyst | general | General Reading chat | Built | facts (natal), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), arudhas (jaimini), special lagnas (jaimini) | `reading.analyst.promise` | staff |
| `general.reader` | Oracle readers (R01–R14, P1–P3) | general | General Reading chat | Built | yogas (natal), doshas (natal), aspects (natal), argala (jaimini), bhava (natal), D9 (divisional), D30 (divisional), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D10 (divisional), Vimshottari (dasha), Narayana (dasha), Chara (dasha), Yogini (dasha), Tithi Ashtottari (dasha), dwisatpathi (dasha), applicable (dasha), strength (natal), transit overlay (transit), Tithi Pravesha (annual), varsha (annual), sahams (annual), mudda (annual), patyayini (annual), prashna (natal), sphutas (natal) | `reading.reader` | staff |
| `general.strength_yoga` | Strength and yoga analyst | general | General Reading chat | Built | yogas (natal), doshas (natal), strength (natal), sav (ashtakavarga), avasthas (natal) | `reading.code.strength_yoga` | staff |
| `general.transit` | Transit analyst | general | General Reading chat | Built | facts (natal), arudhas (jaimini), Vimshottari (dasha), Narayana (dasha), transit overlay (transit), Transit contacts (transit), transit at (transit) | `reading.analyst.transit` | staff |
| `general.validator` | Validator | general | General Reading chat | Built | — | `reading.validator` | staff |
| `general.varga_dynamics` | Varga dynamics analyst | general | General Reading chat | Built | D2 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), D12 (divisional), D24 (divisional), D30 (divisional), D60 (divisional), D16 (divisional), D20 (divisional), D27 (divisional), D40 (divisional), D45 (divisional), D81 (divisional), D108 (divisional), D144 (divisional) | `reading.code.varga_dynamics` | staff |
| `life.dashboard` | Your life at a glance (Part 1 of the life reading) | general | Timeline | Built | digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit) | `life.dashboard` | none |
| `life.promise_scale` | Life areas: the weighed promise scale | general | Timeline | Built | digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit) | `life.dashboard` | none |
| `life.timing_agreement` | Life areas: when it improves, by agreement across systems | general | Timeline | Built | digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit) | `life.dashboard` | none |

## Self (You board)

### Avoid bands and good spans of the day — `lucky.avoid_bands`

**Built** · board: Lucky times · accuracy: staff

**Reads:** kalams (panchang), muhurta (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta)
2. General: avoid bands: rahu kalam, yamagandam, gulikai, every durmuhurtam and varjyam span, in time order; an end before its start is read as past midnight
3. General: good spans: brahma muhurta, abhijit and every amrita gadiya
4. General: what is running now: an avoid band first, then a good span, else the next good span

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans) | panchang_day | `none` | — | day_bands.v1 | — |

**Source:** docs/reading-engine/49 §4.1; 47 §3  
**Code:** `src/reading/luckyTimes/windows.ts avoidBands, nowState; service.ts getRange`  
**Agents:** `lucky.scenario_windows`

### Shared day tables per place — `lucky.day_tables`

**Built** · board: Lucky times · accuracy: none

**Reads:** muhurta (panchang)

**Algorithm:**

1. General: find the days in the universal 2–4 week horizon (LUCKY_HORIZON_DAYS, default 28 days ahead) or today −7 … today +14 that the reference timezone place (us-east, us-central, us-mountain, us-west, in-ist) has no stored row for
2. General: call the engine's muhurta deterministically (no model) for missing months at the place
3. General: store one row per day (day_tables) with its calc version and a hash of the payload; one sky for every user in that reference timezone

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans) | panchang_day | `none` | — | day_tables.v1 | — |

**Source:** docs/reading-engine/47 §3; 49 §4.1; 53 §4.6  
**Code:** `src/reading/luckyTimes/service.ts pullDayTables, prepullUniversalDayTables; places.ts DAY_TABLE_PLACES, resolvePlacePreset`  
**Agents:** `lucky.day_tables`

### Start a routine — `lucky.home.start_routine`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 12:00 local, cut to those hours, 20 minutes or more; plus brahma muhurta (+2)
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Monday, Thursday
6. General: tithi group, inside its own span: favoured (+1) bhadra; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) fixed, quick; avoided (−2) none
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Sun, Moon, Jupiter; avoided (−3) none
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['home.start_routine']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### The five limbs of the day (vara, tithi, nakshatra, yoga, karana) — `lucky.panchang_limbs`

**Built** · board: Lucky times · accuracy: staff

**Reads:** weekday (panchang), tithi (panchang), nakshatra (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the day's five limbs from the place's stored day row, each with its end time (and full-day yogas/karanas when served)
2. General: vara: the weekday and its lord, favoured or avoided per the act's scenario row; Amrita Siddhi weekday + star combination adds +1 (amrita_siddhi)
3. General: tithi: its group (nanda, bhadra, jaya, rikta, purna; amavasya) per the scenario's tithi lists
4. General: nakshatra: the Moon's star and its group per the scenario's star lists
5. General: yoga (27 yogas, configurable via LUCKY_YOGA_AVOID / LUCKY_YOGA_FAVOUR): avoided — Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1, including Siddha #21) — Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
6. General: karana (11 karanas, configurable via LUCKY_KARANA_AVOID / LUCKY_FIXED_KARANA_AVOID / LUCKY_KARANA_FAVOUR / LUCKY_FIXED_KARANA_FAVOUR): avoided — Vishti (Bhadra) and the fixed karanas Shakuni, Chatushpada, Naga; favoured — Bava, Balava, Kaulava, Taitila, Gara, Vanija and Kimstughna (+1 on auspicious beginnings)
7. General: the general limbs decide the day gate: an avoided yoga or karana span is cut out of every candidate like an avoid band, so a day it fills is gated out for the act (day reason yoga_avoid / karana_avoid); a favoured yoga adds +1 to a piece inside its span
8. General: the day's yoga and karana (name and end hour) ride on each day of the range for the Why sheet
9. Personal: the person's marks (lucky.personal_overlay) then move a window by ±1; they never open a gated day

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14: vara, tithi, nakshatra, yoga, karana with end times | panchang_day | `none` | — | limbs.v1 | `lucky.avoid_bands` |

**Source:** docs/reading-engine/53 §4.6, 54 §6; Muhurta Chintamani; B.V. Raman, Muhurta  
**Code:** `src/reading/luckyTimes/scenarios.ts yogaAvoid/yogaFavour/karanaAvoid/karanaFavour, yogaName, karanaName, isAmritaSiddhi; windows.ts dayLimbs, scenarioDay; service.ts getRange`  
**Agents:** `lucky.scenario_windows`

### Personal overlay (tara, chandra bala and the chart marks) — `lucky.personal_overlay`

**Built** · board: Lucky times · accuracy: staff

**Reads:** muhurta (panchang), tara (nakshatra), chandra bala (panchang)

**Algorithm:**

1. Personal: once per month and place, call the engine's muhurta with the person's natal fields
2. Personal: store each day's tara (the day's star counted from the Moon star: janma, sampat, vipat, kshema, pratyak, sadhaka, vadha, mitra, parama mitra), chandra bala (the Moon's house from the natal Moon) and grade (kundli_day_overlays)
3. Personal: use the engine's own good/bad verdicts: +1 / −1 each on every window of that day
4. Personal: the hora lord's nature for this chart, functional benefic or malefic from the digest planet cards of D1, moves a window by ±1 (read through functionalNatureOf; no mark while the digest is not ready)
5. Personal: whether the day's tithi lord or star lord is a running dasha lord in the activation calendar (+1 on the window, read through runningDashaLordsOf)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the person's overlay for the same days (tara, chandra bala, grade)<br>planet · D1 cards of the seven hora lords (nature column)<br>activation · periods running on each day, every system | panchang_day<br>planet_card<br>activation_row | `none` | — | day_overlay.v1 | — |

**Source:** docs/reading-engine/49 §4.1; 53 §4.6  
**Code:** `src/reading/luckyTimes/service.ts personalDays, LuckyDeps.functionalNatureOf, LuckyDeps.runningDashaLordsOf; wiring.ts; windows.ts personalScore, scenarioDay`  
**Agents:** `lucky.day_overlay`

### Exam or submit — `lucky.study.exam_submit`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 20:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Wednesday, Thursday
6. General: tithi group, inside its own span: favoured (+1) jaya, purna; avoided (piece dropped) rikta
7. General: star group, inside its own span: favoured (+1) quick; avoided (−2) sharp
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Mercury, Jupiter; avoided (−3) none
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['study.exam_submit']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Set out on a journey — `lucky.travel.set_out`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 21:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): none
6. General: tithi group, inside its own span: favoured (+1) bhadra, nanda; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) moving, quick; avoided (−2) sharp
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Moon, Venus, Mercury; avoided (−3) Saturn
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** The direction rule for each weekday is not yet applied.

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['travel.set_out']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Activation of houses 1, 4 and 5 with the Moon by every dasha system — `self.activation`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional)

**Algorithm:**

1. Read every activation row from 13 months back to 30 years ahead that activates houses 1,4,5,9,12, to level 2
2. Grade the period lord: functional benefic +1 / malefic −1; dignity in D1 ±1 and in D9 ±1; it owns one of the houses +1, else owns a dusthana −1. A sign period is graded by the lord of that sign's D1 house card (+1 when that house is one of the area's)
3. Families vote like the Work board: main clock, conditional clock, sign clock, karaka clock, and the short clocks only when Yogini and Tithi Ashtottari agree; a system votes support at ≥ 0.5 and test at ≤ −0.5 of its level-weighted sum
4. Windows ahead: level-2 periods inside 36 months land in a sub-area when their lord is one of its distinguishing planets (a sign period when it activates one of its houses); overlaps merge; a main-clock change inside 30 years is a turning point

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · every served system, periods from today to +30 years activating houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK | activation_row<br>planet_card | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.4; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts gradeRow, familyVotes, aheadWindows; self.ts SELF; boardService.ts getAreaBoard`  
**Agents:** `area.self_board`

### Afflictions on houses 1, 4 and 5 with the Moon — `self.affliction`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal)

**Algorithm:**

1. The lord in a house the engine labels dusthana: 2; debilitated without a cancellation in the yoga register: 2; combust: 1 (no release); in planetary war: 1
2. Saturn or a node (Love: also Mars) occupying the house: 1.5, aspecting it: 1; the same conjunct or aspecting the area's planets
3. The named yogas of the area (Kemadruma for Self; Kalathra and Manglik for Love) and doshas on the houses, unless the register lists their cancellation; the Moon in gandanta for Self
4. Each pressure's until-date: the end of the afflicting planet's period running today in the activation calendar (the main clock first, else any family); none when it is not running

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>yoga · yogas and doshas joining houses 1,4,5,9,12 or their lords or the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>activation · running and next periods of the afflicting planets, houses 1,4,5,9,12 | house_card<br>planet_card<br>yoga_row<br>activation_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.3; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts afflictionLayer, releaseOf; self.ts SELF; boardService.ts getAreaBoard`  
**Agents:** `area.self_board`

### This year's chart for houses 1, 4 and 5 with the Moon — `self.annual`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual)

**Algorithm:**

1. Pick the year chart whose year dashas cover today (the tithi pravesha before the varsha chart)
2. Each house's year lord in the house itself or a kendra/trikona of the year chart without debility: confirms; in a dusthana: contradicts
3. The area's sahams in a kendra of the year chart: confirms (Love: santapa and paradara there contradict)
4. The sum is one vote in the tone and one plain line under This year

**Special:** Muntha, the year lord and Tajaka yogas are engine gaps

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP and VP of the current, previous and next year, houses 1,4,5,9,12, their sahams and year dashas | annual_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.6; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts currentYear, annualLayer; self.ts SELF; boardService.ts getAreaBoard`  
**Agents:** `area.self_board`

### Nakshatra charter of houses 1, 4 and 5 with the Moon — `self.nakshatra`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra)

**Algorithm:**

1. Read the cusp stars of houses 1, 4, 5 and the star profile (Moon star, tara table) from the digest
2. When a primary house's cusp star lord is dignified or a functional benefic in D1: +1 support; when debilitated in D1: 1 pressure
3. When a running period lord's star lord is the house's lord or one of the area's karakas, the period delivers through the star (+1.5 support)

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| star · Moon star, lagna star and the tara table<br>house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12 (cusp_star column)<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK | star_profile<br>house_card<br>planet_card | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.8; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts nakshatraLayer; self.ts SELF; boardService.ts getAreaBoard`  
**Agents:** `area.self_board`

### Natal promise of houses 1, 4 and 5 with the Moon — `self.promise`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal)

**Algorithm:**

1. For each of houses 1, 4 and 5 with the Moon: read the D1 house card from the digest
2. The lord in the house itself or in a house the engine labels kendra or trikona: +2; the lord's dignity exalted, own or moolatrikona: +2
3. Each occupant and each graha drishti whose functional nature the engine labels benefic: +1 (malefic: −1, kept for the score only)
4. SAV of the house ≥ 28: +1; a yoga in the register whose houses or planets include the house or its lord: +1 to +2 by class
5. The lord's avastha scales the supports: x0.5 when mrita or sushupta, x1.25 when jagrat or deepta
6. The area's planets: dignified in D1 +1; shadbala ratio ≥ 1.2 +1
7. Each support becomes one plain line; the digest keys go in its evidence

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>point · AK, SL, AL<br>yoga · yogas and doshas joining houses 1,4,5,9,12 or their lords or the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.2; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts promiseLayer; self.ts SELF; boardService.ts getAreaBoard`  
**Agents:** `area.self_board`

### What protects houses 1, 4 and 5 with the Moon — `self.protection`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional)

**Algorithm:**

1. Jupiter aspecting or occupying the houses, aspecting or joining the area's planets, or aspecting the house of its points: +2
2. Benefic argala on the houses (primary argala, not obstructed, functional benefic): +1; the house lord's dispositor dignified: +1
3. A cancellation in the yoga register (neecha bhanga and the like) naming a house lord or one of the area's planets: +2
4. The owning varga check: the varga house lord dignified (Love: D9 h7; Self: D9 h1): +2

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>point · AK, SL, AL<br>yoga · yogas and doshas joining houses 1,4,5,9,12 or their lords or the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.3; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts protectionLayer; self.ts SELF; boardService.ts getAreaBoard`  
**Agents:** `area.self_board`

### Transits over houses 1, 4 and 5 with the Moon — `self.transit`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga)

**Algorithm:**

1. Read the kundli's stored sky overlay covering today (never fetched here); omitted with a note when none is stored
2. Jupiter in one of the houses (the engine's house_from_lagna): a support until it moves on; Saturn: a pressure until it moves on; Rahu or Ketu: a pressure
3. Self: a running sade sati span is a pressure until its end
4. The layer is one vote in the tone

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| transit · shared sky with the overlay: Sa, Ju, Ra, Ke and eclipses over houses 1,4,5,9,12, their lords and arudhas, ±24 months<br>house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12 | transit_row<br>house_card | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.5; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts transitLayer; self.ts SELF; boardService.ts getAreaBoard`  
**Agents:** `area.self_board`

### Owning divisional chart of houses 1, 4 and 5 with the Moon — `self.varga`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional)

**Algorithm:**

1. Read the owning divisional charts (D9, D20, D24, D12, D4, D7, D60) from the digest for houses 1, 4, 5
2. For each primary house: the natal D1 lord dignified in the owning varga supports (+1.5), debilitated tests (1.5); the varga house lord dignified or in a kendra/trikona supports (+1), in a dusthana or debilitated tests (1)
3. A planet occupying the same house in D1 and in the owning varga (vargottama placement) supports (+1)
4. The net side (agrees, disagrees or neutral) joins the board supports and pressures

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>point · arudhas of houses 1,4,5,9,12 in D1, D9, D20, D24, D12, D4, D7, D60 | house_card<br>planet_card<br>point_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.7; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts vargaLayer; self.ts SELF; boardService.ts getAreaBoard`  
**Agents:** `area.self_board`

## Love

### Activation of house 7 by every dasha system — `love.activation`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D9 (divisional), D7 (divisional), D30 (divisional)

**Algorithm:**

1. Read every activation row from 13 months back to 30 years ahead that activates houses 7,5,11,2,4,8,12, to level 2
2. Grade the period lord: functional benefic +1 / malefic −1; dignity in D1 ±1 and in D9 ±1; it owns one of the houses +1, else owns a dusthana −1. A sign period is graded by the lord of that sign's D1 house card (+1 when that house is one of the area's)
3. Families vote like the Work board: main clock, conditional clock, sign clock, karaka clock, and the short clocks only when Yogini and Tithi Ashtottari agree; a system votes support at ≥ 0.5 and test at ≤ −0.5 of its level-weighted sum
4. Windows ahead: level-2 periods inside 36 months land in a sub-area when their lord is one of its distinguishing planets (a sign period when it activates one of its houses); overlaps merge; a main-clock change inside 30 years is a turning point

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · every served system, periods from today to +30 years activating houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord | activation_row<br>planet_card | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.4; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts gradeRow, familyVotes, aheadWindows; love.ts LOVE; boardService.ts getAreaBoard`  
**Agents:** `area.love_board`

### Afflictions on house 7 — `love.affliction`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal)

**Algorithm:**

1. The lord in a house the engine labels dusthana: 2; debilitated without a cancellation in the yoga register: 2; combust: 1 (no release); in planetary war: 1
2. Saturn or a node (Love: also Mars) occupying the house: 1.5, aspecting it: 1; the same conjunct or aspecting the area's planets
3. The named yogas of the area (Kemadruma for Self; Kalathra and Manglik for Love) and doshas on the houses, unless the register lists their cancellation; the Moon in gandanta for Self
4. Each pressure's until-date: the end of the afflicting planet's period running today in the activation calendar (the main clock first, else any family); none when it is not running

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>yoga · yogas and doshas joining houses 7,5,11,2,4,8,12 or their lords or Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>activation · running and next periods of the afflicting planets, houses 7,5,11,2,4,8,12 | house_card<br>planet_card<br>yoga_row<br>activation_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.3; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts afflictionLayer, releaseOf; love.ts LOVE; boardService.ts getAreaBoard`  
**Agents:** `area.love_board`

### This year's chart for house 7 — `love.annual`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual)

**Algorithm:**

1. Pick the year chart whose year dashas cover today (the tithi pravesha before the varsha chart)
2. Each house's year lord in the house itself or a kendra/trikona of the year chart without debility: confirms; in a dusthana: contradicts
3. The area's sahams in a kendra of the year chart: confirms (Love: santapa and paradara there contradict)
4. The sum is one vote in the tone and one plain line under This year

**Special:** Muntha, the year lord and Tajaka yogas are engine gaps

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP and VP of the current, previous and next year, houses 7,5,11,2,4,8,12, their sahams and year dashas | annual_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.6; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts currentYear, annualLayer; love.ts LOVE; boardService.ts getAreaBoard`  
**Agents:** `area.love_board`

### How the relationship is — `love.health`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit)

**Algorithm:**

1. Present state of house 7 and D9 h7: support and strain this month from the activation, transit and annual layers
2. The tone from the votes of the layers (doc 45 §7)
3. Leads the Love board when the companion memory says love.status is dating or committed or married (love.ts LOVE_LEAD); its windows show only when love.status fits it (LOVE_FIT)

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11; in D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the eight Love layers of this kundli (love.promise … love.nakshatra) | findings_in | `none` | — | board_subarea.v1 | — |

**Source:** docs/reading-engine/53 §4.5; 46 §B.12; 54 §3  
**Code:** `src/reading/area/love.ts LOVE_LEAD, LOVE_FIT; boardService.ts shapeBoard`  
**Agents:** `area.love_board`

### Meeting someone — `love.meet`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit)

**Algorithm:**

1. Promise and activation of house 7 and UL for a new bond; Venus and the 7th lord running or transited
2. Windows from the activation calendar where house 7, 5 or 11 is activated with D9 agreeing
3. Leads the Love board when the companion memory says love.status is single or dating (love.ts LOVE_LEAD); its windows show only when love.status fits it (LOVE_FIT)

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11; in D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the eight Love layers of this kundli (love.promise … love.nakshatra) | findings_in | `none` | — | board_subarea.v1 | — |

**Source:** docs/reading-engine/53 §4.5; 46 §B.12; 54 §3  
**Code:** `src/reading/area/love.ts LOVE_LEAD, LOVE_FIT; boardService.ts shapeBoard`  
**Agents:** `area.love_board`

### Nakshatra charter of house 7 — `love.nakshatra`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra)

**Algorithm:**

1. Read the cusp stars of houses 7, 5, 11 and the star profile (Moon star, tara table) from the digest
2. When a primary house's cusp star lord is dignified or a functional benefic in D1: +1 support; when debilitated in D1: 1 pressure
3. When a running period lord's star lord is the house's lord or one of the area's karakas, the period delivers through the star (+1.5 support)

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| star · Moon star, lagna star and the tara table<br>house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12 (cusp_star column)<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord | star_profile<br>house_card<br>planet_card | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.8; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts nakshatraLayer; love.ts LOVE; boardService.ts getAreaBoard`  
**Agents:** `area.love_board`

### Natal promise of house 7 — `love.promise`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal)

**Algorithm:**

1. For each of house 7: read the D1 house card from the digest
2. The lord in the house itself or in a house the engine labels kendra or trikona: +2; the lord's dignity exalted, own or moolatrikona: +2
3. Each occupant and each graha drishti whose functional nature the engine labels benefic: +1 (malefic: −1, kept for the score only)
4. SAV of the house ≥ 28: +1; a yoga in the register whose houses or planets include the house or its lord: +1 to +2 by class
5. The lord's avastha scales the supports: x0.5 when mrita or sushupta, x1.25 when jagrat or deepta
6. The area's planets: dignified in D1 +1; shadbala ratio ≥ 1.2 +1
7. Each support becomes one plain line; the digest keys go in its evidence

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>point · UL, A7, DK, AL<br>yoga · yogas and doshas joining houses 7,5,11,2,4,8,12 or their lords or Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.2; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts promiseLayer; love.ts LOVE; boardService.ts getAreaBoard`  
**Agents:** `area.love_board`

### What protects house 7 — `love.protection`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D9 (divisional), D7 (divisional), D30 (divisional)

**Algorithm:**

1. Jupiter aspecting or occupying the houses, aspecting or joining the area's planets, or aspecting the house of its points: +2
2. Benefic argala on the houses (primary argala, not obstructed, functional benefic): +1; the house lord's dispositor dignified: +1
3. A cancellation in the yoga register (neecha bhanga and the like) naming a house lord or one of the area's planets: +2
4. The owning varga check: the varga house lord dignified (Love: D9 h7; Self: D9 h1): +2

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>point · UL, A7, DK, AL<br>yoga · yogas and doshas joining houses 7,5,11,2,4,8,12 or their lords or Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.3; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts protectionLayer; love.ts LOVE; boardService.ts getAreaBoard`  
**Agents:** `area.love_board`

### Strain and reconciling — `love.reconcile`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit)

**Algorithm:**

1. Afflictions on house 7, its lord, Venus and UL and their release dates (love.affliction)
2. Periods ahead where the afflicting planet stops running and a supporter of 7 or 5 starts (love.activation)
3. Protections that hold the bond (love.protection)
4. Leads the Love board when the companion memory says love.status is separated or complicated (love.ts LOVE_LEAD); its windows show only when love.status fits it (LOVE_FIT)

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11; in D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the eight Love layers of this kundli (love.promise … love.nakshatra) | findings_in | `none` | — | board_subarea.v1 | — |

**Source:** docs/reading-engine/53 §4.5; 46 §B.12; 54 §3  
**Code:** `src/reading/area/love.ts LOVE_LEAD, LOVE_FIT; boardService.ts shapeBoard`  
**Agents:** `area.love_board`

### Transits over house 7 — `love.transit`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga)

**Algorithm:**

1. Read the kundli's stored sky overlay covering today (never fetched here); omitted with a note when none is stored
2. Jupiter in one of the houses (the engine's house_from_lagna): a support until it moves on; Saturn: a pressure until it moves on; Rahu or Ketu: a pressure
3. Self: a running sade sati span is a pressure until its end
4. The layer is one vote in the tone

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| transit · shared sky with the overlay: Sa, Ju, Ra, Ke and eclipses over houses 7,5,11,2,4,8,12, their lords and arudhas, ±24 months<br>house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12 | transit_row<br>house_card | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.5; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts transitLayer; love.ts LOVE; boardService.ts getAreaBoard`  
**Agents:** `area.love_board`

### Owning divisional chart of house 7 — `love.varga`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** D9 (divisional), D7 (divisional), D30 (divisional)

**Algorithm:**

1. Read the owning divisional charts (D9, D7, D30) from the digest for houses 7, 5, 11
2. For each primary house: the natal D1 lord dignified in the owning varga supports (+1.5), debilitated tests (1.5); the varga house lord dignified or in a kendra/trikona supports (+1), in a dusthana or debilitated tests (1)
3. A planet occupying the same house in D1 and in the owning varga (vargottama placement) supports (+1)
4. The net side (agrees, disagrees or neutral) joins the board supports and pressures

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>point · arudhas of houses 7,5,11,2,4,8,12 in D9, D7, D30 | house_card<br>planet_card<br>point_row | `none` | — | area_board.v1 | — |

**Source:** docs/reading-engine/46 §B.7; 53 §4.5; 54 §3  
**Code:** `src/reading/area/houseLayers.ts vargaLayer; love.ts LOVE; boardService.ts getAreaBoard`  
**Agents:** `area.love_board`

### Ask someone out — `lucky.love.ask_out`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Tuesday, Saturday
3. General: candidates are each hora between 09:00 and 22:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Friday, Wednesday
6. General: tithi group, inside its own span: favoured (+1) nanda, bhadra; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) soft; avoided (−2) fierce, sharp
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Venus, Mercury, Moon; avoided (−3) Mars, Saturn
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (relationship)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.ask_out']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Clear the air — `lucky.love.clear_air`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Tuesday
3. General: candidates are each hora between 09:00 and 22:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Monday, Friday
6. General: tithi group, inside its own span: favoured (+1) nanda; avoided (piece dropped) jaya
7. General: star group, inside its own span: favoured (+1) soft, fixed; avoided (−2) fierce
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Moon, Venus; avoided (−3) Mars
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (relationship)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.clear_air']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### A first date — `lucky.love.first_date`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between 11:00 and 22:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Friday
6. General: tithi group, inside its own span: favoured (+1) nanda; avoided (piece dropped) amavasya
7. General: star group, inside its own span: favoured (+1) soft; avoided (−2) sharp
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Venus, Moon; avoided (−3) Mars, Saturn
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (relationship)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.first_date']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

## Work

### Invest or buy — `lucky.money.invest_buy`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 19:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Thursday, Wednesday
6. General: tithi group, inside its own span: favoured (+1) bhadra, purna; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) fixed; avoided (−2) sharp, fierce
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Jupiter, Mercury; avoided (−3) Saturn
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Mercury's motion is not yet checked.

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['money.invest_buy']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Ask for a raise — `lucky.work.ask_raise`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Saturday
3. General: candidates are each hora between sunrise and 18:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Thursday
6. General: tithi group, inside its own span: favoured (+1) purna, jaya; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) fixed, quick; avoided (−2) sharp, fierce
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Jupiter, Sun; avoided (−3) Saturn
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (job)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.ask_raise']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### A hard talk with the boss — `lucky.work.hard_talk_boss`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Tuesday
3. General: candidates are each hora between sunrise and 18:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Monday, Thursday
6. General: tithi group, inside its own span: favoured (+1) nanda; avoided (piece dropped) jaya, amavasya
7. General: star group, inside its own span: favoured (+1) soft, fixed; avoided (−2) fierce, sharp
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Moon, Jupiter, Venus; avoided (−3) Mars, Saturn
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (who)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.hard_talk_boss']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Interview or pitch — `lucky.work.interview`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 18:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Thursday, Sunday, Wednesday
6. General: tithi group, inside its own span: favoured (+1) jaya, bhadra; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) quick, soft; avoided (−2) fierce
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Sun, Jupiter; avoided (−3) Saturn, Mars
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (job)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.interview']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Send a resume or application — `lucky.work.send_resume`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 20:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Wednesday, Thursday, Sunday
6. General: tithi group, inside its own span: favoured (+1) bhadra, nanda; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) quick, moving; avoided (−2) sharp
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Mercury, Sun, Jupiter; avoided (−3) Saturn
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (job)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.send_resume']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Sign a contract — `lucky.work.sign_contract`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Saturday, Tuesday
3. General: candidates are each hora between sunrise and 19:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Thursday, Wednesday
6. General: tithi group, inside its own span: favoured (+1) bhadra, purna; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) fixed; avoided (−2) fierce, sharp
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Jupiter, Mercury; avoided (−3) Saturn, Mars
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Mercury's motion is not yet checked; avoid signing while it moves backward.

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.sign_contract']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Start a project — `lucky.work.start_project`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 20:00 local, cut to those hours, 20 minutes or more; plus brahma muhurta (+2)
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Monday, Wednesday, Thursday
6. General: tithi group, inside its own span: favoured (+1) bhadra, nanda; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) quick, fixed; avoided (−2) sharp
8. General: yoga (the engine's name at noon), inside its own span: avoided (cut out like an avoid band; a day it fills is gated out) Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured (+1) Siddhi, Siddha, Shubha, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
9. General: karana (the engine's name at noon), inside its own span: avoided (cut out; a day it fills is gated out) Vishti, Shakuni, Chatushpada, Naga; favoured (named, no score) Bava, Balava, Kaulava, Taitila, Gara, Vanija, Kimstughna
10. General: hora lord: favoured (+2) Jupiter, Mercury, Moon; avoided (−3) Saturn
11. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
12. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
13. Personal: the hora lord's functional nature for this chart, when the digest gives it: benefic +1 / malefic −1; it never opens a gated piece
14. General: keep pieces scoring 3 or more; show the best two in time order

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups, yogas and karanas); B.V. Raman, Muhurta (weekdays, yogas, karanas); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.start_project']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### This year's chart (annual family) — `work.annual_family`

**Built** · board: Work board · accuracy: staff

**Reads:** Tithi Pravesha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D10 (divisional)

**Algorithm:**

1. Read the Tithi Pravesha or Varsha chart covering the current month from the digest annual set
2. Grade the year chart's houses 10, 6 and 1 (lord in the house or kendra/trikona without debility supports; in a dusthana or debilitated tests)
3. Read the houses of the rajya and karma sahams (kendra supports, dusthana tests) and any running year dasha lord covering the month
4. Cast one vote (support, test or neutral) as the annual family of the present tone

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP current year, D1 and D10, houses 10,6,1,2,11; rajya and karma sahams; year dasha running this month | annual_row | `none` | — | family_vote.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1 (family 5); 46 §B.6; 53 §4.5  
**Code:** `src/reading/area/career.ts workAnnualVote, presentState; careerService.ts getCareer`  
**Agents:** `area.career_inputs`, `area.career_map`

### Conditional clock — `work.conditional_family`

**Built** · board: Work board · accuracy: staff

**Reads:** applicable (dasha), conditional (dasha)

**Algorithm:**

1. Read the conditional dasha rows covering this month from the activation calendar (family conditional, levels 1–2)
2. Grade each running lord by its career polarity and D1/D10 agreement (workD10Check); level 1 weighs 1, level 2 weighs 0.5
3. Cast support at ≥ 0.5, test at ≤ −0.5, else neutral; no vote when no conditional system applies

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · conditional systems named by dasha.applicable, levels 1–3, periods covering this month ±1, houses 10,6,1 | activation_row | `none` | — | family_vote.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1 (family 2); 46 §B.4; 53 §4.5  
**Code:** `src/reading/area/career.ts workConditionalVote, presentState; careerService.ts getCareer`  
**Agents:** `area.career_inputs`, `area.career_map`

### D1 and D10 agreement on each dasha vote — `work.d10_check`

**Built** · board: Work board · accuracy: staff

**Reads:** D1 (divisional), D10 (divisional), D9 (divisional), D60 (divisional)

**Algorithm:**

1. For the running lord of the main, conditional and karaka clocks, read its place and dignity in D1, D10, D9 and D60
2. A dasha vote counts only when D1 and D10 agree on its side; D9 breaks a tie
3. D60 confirms only when the birth time is recorded to the minute, and never decides alone
4. When D1 and D10 disagree, the family's vote is split and not counted

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · running lords of the main, conditional and karaka clocks this month<br>planet · D1, D10, D9, D60 cards of those lords<br>house · D10 houses 10,6,1,2,11 | activation_row<br>planet_card<br>house_card | `none` | — | vote_check.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1; 46 §B.7; 53 §4.5  
**Code:** `src/reading/area/career.ts workD10Check, presentState; careerService.ts getCareer`  
**Agents:** `area.career_inputs`, `area.career_map`

### Horizons (1, 3, 6, 12 months) — `work.horizons`

**Built** · board: Work board · accuracy: staff

**Reads:** Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal)

**Algorithm:**

1. From the windows ahead (work.subarea_windows), for 1, 3, 6 and 12 months from the start of this month take the windows that start inside
2. Rank by band order x 100 + score; keep the best support window and the hardest test window
3. The 6- and 12-month rungs show only windows at moderate band or above; the 1- and 3-month rungs at possible or above
4. A rung is quiet when neither clears its bar

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D10 houses 10,6,1,2,11<br>activation · families S1, S4, S2+S3, S6/S6D, S7 this month to +12 months<br>transit · contacts and double transit on houses 10,6,1 and their lords ±24 months | house_card<br>activation_row<br>transit_row | `none` | — | career_map.v1 | — |

**Source:** docs/reading-engine/45 §10  
**Code:** `src/reading/area/career.ts careerMap (horizons)`  
**Agents:** `area.career_inputs`, `area.career_map`

### Karaka clock — `work.karaka_family`

**Built** · board: Work board · accuracy: staff

**Reads:** karaka (dasha), chara karakas (jaimini), D10 (divisional)

**Algorithm:**

1. Read the karaka dasha rows covering this month from the activation calendar (family karaka)
2. AmK or the D1 10th lord running gives support unless debilitated in D10; a planet debilitated in D10 or lording a dusthana without owning 10, 1 or 6 gives test
3. Apply workD10Check so a split D1/D10 vote is not counted

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · karaka dasha level 3, periods covering this month ±1<br>point · AmK and the 10th lord in D1 and D10<br>planet · D10 card of the running karaka lord | activation_row<br>point_row<br>planet_card | `none` | — | family_vote.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1 (family 4); 46 §B.4; 53 §4.5  
**Code:** `src/reading/area/career.ts workKarakaVote, presentState; careerService.ts getCareer`  
**Agents:** `area.career_inputs`, `area.career_map`

### Looking back — `work.looking_back`

**Built** · board: Work board · accuracy: area_checks:career

**Reads:** Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal)

**Algorithm:**

1. Read the timeline grid for the career marker, built from the stored dashas, house table and transit contacts over 24 months back to 24 months ahead (timeline/pipeline.ts buildTimelineSpan)
2. Walk the 12 months before this month
3. A month is an edge when its band is moderate or above and either its side (test or support) differs from the month before or the month before was below moderate
4. Keep the last two test edges and the last two support edges, rank by band then by recency, keep three, show them in month order
5. The person answers yes, partly, no or skip to each moment; the answers are stored in area_checks (area career)

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D10 houses 10,6,1,2,11<br>activation · families S1, S4, S2+S3, S6/S6D, S7 −12 months to this month<br>transit · contacts and double transit on houses 10,6,1 and their lords ±24 months | house_card<br>activation_row<br>transit_row | `none` | — | career_map.v1 | — |

**Source:** docs/reading-engine/45 §9  
**Code:** `src/reading/area/career.ts careerMap (back); src/reading/area/careerService.ts recordCheck`  
**Agents:** `area.career_inputs`, `area.career_map`

### Present tone — `work.present_tone`

**Built** · board: Work board · accuracy: area_checks:career

**Reads:** Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal)

**Algorithm:**

1. Read the timeline grid for the career marker, built from the stored dashas, house table and transit contacts over 24 months back to 24 months ahead (timeline/pipeline.ts buildTimelineSpan)
2. Take this month with the month before and the month after
3. Group the systems into five voting families: Main clock = Vimshottari (S1); Sign clock = Narayana (S4); Short clocks = Yogini (S2) + Tithi Ashtottari (S3), votes only when both agree; Slow transits = Transit contacts (S6) + Double transit* (S6D); Jaimini points = Jaimini modifier (S7)
4. Per system, sum support and test over the three months: support when support exceeds test by 0.5 or more, test when test exceeds support by 0.5 or more, otherwise neutral; a family votes a side only when its active systems do not disagree
5. Grade this month's job security (work.security_grade)
6. Demanding when security is risk or high risk, or the month tests at moderate band or above with 2+ test families, or tests at any band with 2+ test families and fewer than 2 support families
7. Easing when demanding and the test run ends within one month and the next two months do not test at moderate or above
8. Open when the month supports at moderate or above with 2+ support families and is not demanding; closing when open, this is the last support month and one of the next two months tests at moderate or above
9. Pick the tone in the order easing, demanding, closing, open, steady
10. Confidence: confirmed when the agreeing families reach max(3, 60 % of the available families) and the main clock agrees; likely when 2+ agree and outnumber the other side; otherwise split. For steady: split when both sides have 2+ families, likely when one side has, confirmed otherwise
11. Dates: ease_date (first month after the test run), window_end (last day of the support run), next_window_start (first month of the next support run)

**Special:** Short clocks vote only when Yogini and Tithi Ashtottari agree. The conditional clock, this year's chart, karaka clock families are not built, so the thresholds scale to the families available

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D10 houses 10,6,1,2,11<br>activation · families S1, S4, S2+S3, S6/S6D, S7 ±24 months<br>transit · contacts and double transit on houses 10,6,1 and their lords ±24 months | house_card<br>activation_row<br>transit_row | `none` | — | career_map.v1 | — |

**Source:** docs/reading-engine/43 §8.1  
**Code:** `src/reading/area/career.ts presentState`  
**Agents:** `area.career_inputs`, `area.career_map`

### Job security by month — `work.security_grade`

**Built** · board: Work board · accuracy: staff

**Reads:** Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal)

**Algorithm:**

1. Read the timeline grid for the career marker, built from the stored dashas, house table and transit contacts over 24 months back to 24 months ahead (timeline/pipeline.ts buildTimelineSpan)
2. End lords: the lords of houses 9 and 5 (the 12th and 8th from the 10th) and of 6, 8 and 12 from the lagna, read from the engine's house cards
3. A month that is not testing: clear_protected when its band is moderate or above, else clear
4. A testing month has a gate when a driver planet (the strongest planet named by Vimshottari, Narayana, transit contacts, double transit, Yogini or Tithi Ashtottari) is an end lord, Rahu, Ketu or Saturn
5. Gate and high band: high_risk; gate and moderate band or above: risk; otherwise watch
6. Grade this month and the 12 after

**Special:** A test without a gate planet is only "watch"

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 houses 10,9,5,6,8,12 and their lords<br>activation · families S1, S4, S2+S3, S6/S6D, S7 ±24 months<br>transit · contacts and double transit on houses 10,6,1 and their lords ±24 months | house_card<br>activation_row<br>transit_row | `none` | — | career_map.v1 | — |

**Source:** docs/reading-engine/43 §6–§7  
**Code:** `src/reading/area/career.ts securityGrade`  
**Agents:** `area.career_inputs`, `area.career_map`

### Windows ahead by sub-area — `work.subarea_windows`

**Built** · board: Work board · accuracy: staff

**Reads:** Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal)

**Algorithm:**

1. Read the timeline grid for the career marker, built from the stored dashas, house table and transit contacts over 24 months back to 24 months ahead (timeline/pipeline.ts buildTimelineSpan)
2. Take every window of the grid that ends after the start of this month
3. A testing career window becomes job_security, graded at its peak month (work.security_grade)
4. A support career window becomes promotion when a driver is the 10th lord, the Sun, the 11th lord or the Ghati Lagna's lord; job_change when Narayana is active in it or a driver is Rahu or the lord of 12, 3 or 9; and always get_job
5. Support windows of the business marker become business; of the money marker, pay, when they overlap a career support window; of the residence marker, abroad, when a driver is Rahu or the 12th or 9th lord
6. Each window keeps its dates, peak month, band, score (to one decimal), the families active and the driver planets
7. Sort by start date, then get_job, job_change, promotion, job_security, abroad, pay, business
8. The service hides sub-areas that do not fit the person's stated work status (careerService.ts fitsStatus): get_job only for between_jobs or studying; promotion and job_security not for between_jobs, studying or own_business; business for own_business or when the status is unknown

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D10 houses 10,6,1,2,11<br>house · D1 houses 2,11 (money), 4 (residence), 7 (business) and their lords<br>activation · families S1, S4, S2+S3, S6/S6D, S7 ±24 months<br>transit · contacts and double transit on houses 10,6,1 and their lords ±24 months | house_card<br>house_card<br>activation_row<br>transit_row | `none` | — | career_map.v1 | — |

**Source:** docs/reading-engine/43 §2, §8.3  
**Code:** `src/reading/area/career.ts careerMap (ahead), careerSubareas`  
**Agents:** `area.career_inputs`, `area.career_map`

## General Reading

### Activation calendar, thirty years ahead — `digest.activation`

**Built** · board: General Reading chat · accuracy: none

**Reads:** all systems (dasha), applicable (dasha), facts (natal)

**Algorithm:**

1. Every period of every stored dasha tree (the .l3 tree to level 3 where stored, else the tree as stored, to level 2), from the stored birth date to thirty years after today
2. Each period carries the D1 houses it activates as the engine states them: a graha period the lord's house, the houses it owns and the houses its graha drishti falls on (its D1 planet card); a rasi period the sign's house (house_counts) and its lord's house (the D1 house card of the sign)
3. Families per doc 46 §B.4: vimshottari, conditional (the systems dasha.applicable lists), yogini, tithi_ashtottari, rasi, karaka (karaka, kaala, naisargika), other
4. One row per period in kundli_activation, written in the digest build; activationFor answers "which periods activate house 7 between 2027 and 2030 under any system" with one indexed query (range index, GIN on houses)

**Selected when:** board is chat, you, love, work, lucky, timeline

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · every stored system, levels 1–3, birth to +30 years<br>planet · D1 cards (house, owns, aspects_to) of the nine planets; D1 house cards and house_counts for rasi periods | activation_row<br>planet_card | `none` | — | kundli_activation.v1 | `digest.build` |

**Source:** docs/reading-engine/53 §4.1, step 3; 46 §B.4  
**Code:** `src/reading/digest/activation.ts buildActivationRows, activationFor`  
**Agents:** `digest.activation`

### Annual set, ten years back and ahead — `digest.annual_set`

**Built** · board: General Reading chat · accuracy: none

**Reads:** Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D9 (divisional), D10 (divisional)

**Algorithm:**

1. For each year from ten back to ten ahead (nearest first), the keys of the set: Tithi Pravesha and Varsha in D1, D9 and D10, the Tithi Pravesha year dasha (default system), Mudda, Patyayini and the sahams: 210 per kundli
2. Read which are stored (no engine call), then pull at most DIGEST_ANNUAL_MAX_CALLS (default 40) of the missing ones through ensureChartData, one at a time, stored as kundli_data year rows
3. Run before each kundli-digest build and with the time a sweep has left; when a top-up stored new rows the ready digest is marked stale and the next sweep rebuilds its annual section

**Selected when:** board is chat, you, love, work, lucky, timeline

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · annual.* for Y in −10…+10, D1, D9, D10 | annual_row | `none` | — | kundli_digest.v1 | `digest.build` |

**Source:** docs/reading-engine/53 §4.1, step 2  
**Code:** `src/reading/digest/annualSet.ts ensureAnnualSet; event.ts runTopUp`  
**Agents:** `digest.annual_set`

### Kundli digest (the first-time breakdown) — `digest.build`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** dignities (natal), aspects (natal), argala (jaimini), arudhas (jaimini), house counts (natal), sav (ashtakavarga), facts (natal), avasthas (natal), strength.shadbala (natal), benefic malefic (natal), yogas (natal), doshas (natal), charakaraka (jaimini), sphutas (natal), Tithi Pravesha (annual), varsha (annual), janma (nakshatra), panchanga (natal)

**Algorithm:**

1. Deterministic, no model: read every stored ready kundli_data row of the kundli and its dossier (with fetch set, ensureChartData first pulls the natal inputs that are missing) and build kundli_digest rows in six sections, each with its sources (type, variant, calc_version and JSON path)
2. house D<n>.h<1..12> for D1 and every varga with dignities.dN: sign, lord, lord's house, sign and dignity, co-lord (the dossier's, else the sign's natural lord when the engine names another lord), occupants with their dignity and the chart's benefic or malefic nature (argala table), aspected_by graha and rasi (aspects.dN), argala primary / secondary / obstructed (the dossier's for D1, else the argala.dN table: planets at the 2nd, 4th and 11th, at the 5th, and in the virodha places), SAV and class (D1: ashtakavarga, house_counts), cusp star (D1: facts.houses), the arudha of the house (arudhas.dN)
3. planet D<n>.<planet>: sign, house, degree, star, pada and star lord, dignity, retro, combust, war, dispositor and its house (dignities.dN); dispositor chain (avasthas), avasthas (avasthas.dN for D1, D9, D10, D16, D24), shadbala ratio and rank, natural and functional nature and houses owned (D1: facts.bodies, benefic_malefic; elsewhere the houses whose engine lord is the planet), aspects_to and aspected_by (aspects.dN), conjunctions (same sign). Vargas served only as placement rows (varga.dN without dignities.dN) get planet cards with sign, degree, star and pada, and no house cards: the engine states no house table for them
4. yoga D1.<id>: the present yogas and doshas and the dossier yogas, one row per name, class from the dossier where it names one
5. point <varga>.<id>: chara karakas placed by their planet's card in each varga; A1..A12 with AL and UL and the special points (SL, HL, GK, MD) of arudhas.dN; the dossier's special lagnas and the sphutas (D1); each with the lord of its sign and the lord's house from that chart's house table
6. annual TP<year>.D<n> and VP<year>.D<n> for every stored year chart: lagna and house cards (as above, from the year chart tables); for D1 the year dashas (Tithi Pravesha: tithi_pravesha_dasha per stored system; Varsha: Mudda, Patyayini) and, for Varsha, the sahams in houses
7. star profile: Moon star and its lord, lagna star, the tara of every star from the Moon star, gandanta flags (facts.nakshatra_profile; the D1 Moon card when there is no dossier)
8. Writes the rows and the activation calendar in one transaction (old rows deleted, batches of 500) and stamps kundlis.digest_status ready with digest_version and digest_built_at, only while the status is still building; failed with the error type on an error, leaving the old rows
9. It selects, counts, joins and dates; it never derives a sign, a lord, an aspect, a dignity, a yoga or a house (doc 46 §C.3; tests/unit/reading/digest/noAstrologyInNode.test.ts)

**Special:** About 400 stored rows read and 1,500–2,500 digest rows written per research kundli. Run by the kundli-digest event and the kundli-digest-sweep (pending, stale, failed, another version, or stuck building); a registration pull that stores new rows marks a ready digest stale

**Selected when:** board is chat, you, love, work, lucky, timeline

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · dignities.dN, aspects.dN, argala.dN, arudhas.dN; D1 also house_counts, ashtakavarga, facts.houses; D1 and the vargas with dignities.dN<br>planet · dignities.dN, aspects.dN, avasthas.dN; D1 also strength.shadbala, benefic_malefic, facts.bodies; varga.dN placement rows for the other vargas<br>yoga · yogas, doshas, facts.yogas (D1)<br>point · karaka.chara, arudhas(.dN), facts.special_lagnas, sphutas<br>annual · annual.{tithi_pravesha,varsha}@year=Y (D1, D9, D10), annual.{tithi_pravesha_dasha,mudda,patyayini,sahams}@year=Y, every stored year<br>star · facts.nakshatra_profile | house_card<br>planet_card<br>yoga_row<br>point_row<br>annual_row<br>star_profile | `none` | — | kundli_digest.v1 | — |

**Source:** docs/reading-engine/53 §4.1; 54 §2; 46 §C.3  
**Code:** `src/reading/digest/build.ts buildDigestRows, buildDigest; load.ts loadDigest; event.ts`  
**Agents:** `digest.build`

### Annual set analyst — `general.annual`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), Tithi Pravesha (annual), tithi pravesha dasha (annual), varsha (annual), sahams (annual), mudda (annual), patyayini (annual), tajaka (annual)

**Algorithm:**

1. Intake picks the subjects; the selected techniques decide which analysts run per subject (src/techniques/use.ts techniquesForQuestion; promise and dasha always), in parallel with each other
2. It is sent the evidence pack sections base, frame, annual, built for the subject's frame (houses, karakas, vargas, arudhas, special lagnas): from the kundli digest when its status is ready (packs/digestSource.ts, field by field, the dossier's value where the digest has none), else from the stored dossier
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. Runs when the graph or the digest has the Tithi Pravesha / Varsha year charts (current, previous and next year in D1, D9, D10), their year dashas, sahams, muntha, year lord and Tajaka yogas for the question

**Special:** Becomes general.annual_set in D3 (doc 53 §4.4): the current, previous and next year (TP and VP, D1, D9, D10) with their year dashas, sahams, muntha, year lord and Tajaka yogas when served; the id stays so tagged runs keep joining. Selected for horizons within 24 months (so the oracle reader R11 runs only then too). Reads the digest when it is ready for base and the multi-year annual set

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term; horizon is now, 3m, 6m, 1y, custom

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP and VP of the current, previous and next year, D1, D9, D10, the frame's houses; year dashas; sahams in the frame's houses; muntha and year lord when served | annual_row | `src/reading/prompts/annual.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/28 §5; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.annual; packs/digestSource.ts overlayDigest`  
**Agents:** `reading.analyst.annual`

### Clarify — `general.clarify`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** —

**Algorithm:**

1. Classify the question into a bucket by rules first
2. Phrase, resolve or ask the question-chart detail with a small model (900 ms budget), while the chart loads in the background
3. Declined topics are decided here and their text is never kept
4. Its confirmed intent (subject, horizon, question type, slots) and the companion memory select the techniques of the query (doc 53 §4.3 selectTechniques)

**Selected when:** board is chat

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| text · the question, the history of the thread, the clarify turns<br>text · the intake's intent: bucket, subjects, horizon, the slots filled and missing | text_in<br>text_in | `db:clarify.system` | TODAY, QUESTION, BUCKET, SLOTS, HISTORY | intent.v1 | — |

**Source:** docs/reading-engine/13; 48; 53 §4.3  
**Code:** `src/reading/clarify/planner.ts; service.ts`  
**Agents:** `reading.clarify`

### Dasha analyst (all systems) — `general.dasha`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), Vimshottari (dasha), Narayana (dasha), conditional (dasha), Chara (dasha), karaka (dasha), Yogini (dasha), Tithi Ashtottari (dasha)

**Algorithm:**

1. Intake picks the subjects; the selected techniques decide which analysts run per subject (src/techniques/use.ts techniquesForQuestion; promise and dasha always), in parallel with each other
2. It is sent the evidence pack sections base, frame, detail, varga, dasha, built for the subject's frame (houses, karakas, vargas, arudhas, special lagnas): from the kundli digest when its status is ready (packs/digestSource.ts, field by field, the dossier's value where the digest has none), else from the stored dossier
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. The dasha section holds the Vimshottari periods inside the horizon, each period lord's place in the frame vargas, the running Narayana sign, and (when the digest and activation calendar are ready) every served system overlapping the horizon in dasha.activation

**Special:** Becomes general.dasha_all_systems in D3 (doc 53 §4.4): every served system from the activation calendar, grouped into the seven families of doc 46 §B.4; the id stays so tagged runs keep joining. Reads the digest when it is ready for base, detail, varga and dasha.activation

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term; horizon is now, 3m, 6m, 1y, 3y, life, custom

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · periods inside the horizon activating the frame's houses, every served system, grouped by family; Vimshottari MD/AD/PD at level 3; dasha.applicable<br>planet · D1 cards of the frame's house lords and karakas<br>house · D1 and the frame's vargas, the frame's houses | activation_row<br>planet_card<br>house_card | `src/reading/prompts/v2/dasha.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/03 §3; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.dasha; packs/digestSource.ts overlayDigest`  
**Agents:** `reading.analyst.dasha`

### Intake — `general.intake`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** —

**Algorithm:**

1. Read the question into an intent: subjects, horizon, question type, format and named planets, and nothing else

**Selected when:** board is chat

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| text · the question, the history of the thread, the clarify turns | text_in | `src/reading/prompts/intake.md` | TODAY, QUESTION, HISTORY | intent.v1 | — |

**Source:** docs/reading-engine/41  
**Code:** `src/reading/nodes/intake.ts`  
**Agents:** `reading.intake`

### Jaimini analyst — `general.jaimini`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** charakaraka (jaimini), arudhas (jaimini), argala (jaimini), Narayana (dasha), Chara (dasha)

**Algorithm:**

1. Runs only when the kundli's digest is ready, on every subject the selectors pick, in the graph and the oracle flows (src/techniques/use.ts); code, no model
2. Reads the digest section of the subject's evidence pack (packs/digestSource.ts digestSection): the D1 point rows AK, AmK, DK, UL, AL and the frame's chara karakas and A-houses, the class of the house each sits in, and the argala lists of the frame houses
3. Each claim takes its side and weight from the rule table (src/reading/codeReaders/rules.ts CODE_READER_RULES, with sources) and cites the digest rows it read as evidence ids (digest.<section>.<digest key>.<field>); at most 8 claims, heaviest first
4. Layer score: the signed weights summed, a third of it rounded, clamped to -3..+3; the finding joins reconcile and the oracle brief like an analyst's (analyst jaimini)
5. A point in a house the engine classes kendra or trikona supports, in a dusthana obstructs (weight 1)
6. Argala on a frame house: more planets in primary argala than obstructing them supports (weight 1); as many or more obstructing is neutral (weight 1)
7. The Narayana and Chara rasi periods inside the horizon that activate a frame house or its lord support (weight 1, cited from digest.rasi)

**Special:** Code-path reader first (doc 53 step 5); a model reader on the same contract (R04 curriculum) waits for the spend yes

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| point · AK, AmK, DK, UL, AL and the chara karakas and A-houses of the frame<br>house · D1, the frame's houses and the houses the points sit in (argala, class columns) | point_row<br>house_card | `none` | — | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/53 §4.4; 33 R4; Jaimini Upadesa Sutras 1.1.5-9; PVR ch. 21-22  
**Code:** `src/reading/codeReaders/readers.ts jaimini; rules.ts`  
**Agents:** `reading.code.jaimini`

### Nakshatra analyst — `general.nakshatra`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), janma (nakshatra), Vimshottari (dasha), transit overlay (transit)

**Algorithm:**

1. Intake picks the subjects; the selected techniques decide which analysts run per subject (src/techniques/use.ts techniquesForQuestion; promise and dasha always), in parallel with each other
2. It is sent the evidence pack sections base, frame, detail, dasha, transits, built for the subject's frame (houses, karakas, vargas, arudhas, special lagnas): from the kundli digest when its status is ready (packs/digestSource.ts, field by field, the dossier's value where the digest has none), else from the stored dossier
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. Revised in D3 (doc 53 §4.4): the star profile, the cusp stars of the frame's houses and the star lords' places from the planet cards

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| star · Moon star, lagna star, the tara table, gandanta flags<br>house · D1, the frame's houses (cusp_star column)<br>planet · D1 cards of the star lords of the frame's cusps and the Moon | star_profile<br>house_card<br>planet_card | `src/reading/prompts/v2/nakshatra.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/03 §3; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.nakshatra`  
**Agents:** `reading.analyst.nakshatra`

### Oracle and synthesizer — `general.oracle`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** —

**Algorithm:**

1. Join the readers (or the graph analysts) into a brief
2. Write the answer from the findings, streaming it
3. An addendum may follow when the validator finds a missing part
4. In D3 it also receives the digest rows the findings cite (by key) and the confirmed person_facts (doc 53 §4.2, §4.4)

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · every finding of the readers or analysts of this query, with the digest rows they cite<br>text · the question, the history of the thread, the clarify turns | findings_in<br>text_in | `src/reading/prompts/oracle/system.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS, TEMPLATE | answer.markdown | `general.validator` |

**Source:** docs/reading-engine/39 §4.1; 41; 53 §4.4  
**Code:** `src/reading/oracle/flow.ts; src/reading/run.ts (synthesize)`  
**Agents:** `reading.oracle`, `reading.synth`

### The person in your chart — `general.person`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), aspects (natal), D12 (divisional), D9 (divisional), D7 (divisional), D3 (divisional), Vimshottari (dasha)

**Algorithm:**

1. The person named in the question (mother, father, spouse, child, sibling; oracle/readers.ts personIn), else the person subject's (spouse for marriage, child for children, sibling for siblings), maps to a house, a varga and a natural karaka of the owner's chart (codeReaders/rules.ts PERSON_SIGNIFIERS); the reading never uses another person's birth data
2. Runs only when the kundli's digest is ready, on every subject the selectors pick, in the graph and the oracle flows (src/techniques/use.ts); code, no model
3. Reads the digest section of the subject's evidence pack (packs/digestSource.ts digestSection): the person's house cards in D1 and the relationship varga and the karaka's planet cards
4. Each claim takes its side and weight from the rule table (src/reading/codeReaders/rules.ts CODE_READER_RULES, with sources) and cites the digest rows it read as evidence ids (digest.<section>.<digest key>.<field>); at most 8 claims, heaviest first
5. Layer score: the signed weights summed, a third of it rounded, clamped to -3..+3; the finding joins reconcile and the oracle brief like an analyst's (analyst person)
6. The lord of the person's house, its occupants and the karaka: strong (exalted, moolatrikona, own) supports, debilitated obstructs (weight 2); the house's SAV by the 28 / 22 rule (weight 1); every claim is about the person

**Special:** Selected for the person subjects and, by an any-of rule in src/techniques/use.ts, for the clarify slot other_person on any subject; the oracle flow keeps its model reader R13 beside it

**Selected when:** board is chat; subject is children or siblings or marriage relationship

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and the person's varga (D12, D9, D7, D3), the person's house<br>planet · D1 and the person's varga, the person's karaka | house_card<br>planet_card | `none` | — | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/53 §4.4; 33 R13; BPHS ch. 3, 32 (karakas)  
**Code:** `src/reading/codeReaders/readers.ts personReader; rules.ts`  
**Agents:** `reading.code.person`

### Question chart analyst — `general.prashna`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), prashna (natal)

**Algorithm:**

1. Intake picks the subjects; the selected techniques decide which analysts run per subject (src/techniques/use.ts techniquesForQuestion; promise and dasha always), in parallel with each other
2. It is sent the evidence pack sections base, frame, prashna, built for the subject's frame (houses, karakas, vargas, arudhas, special lagnas): from the kundli digest when its status is ready (packs/digestSource.ts, field by field, the dossier's value where the digest has none), else from the stored dossier
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. Runs only when the graph has the chart of the question moment

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| prashna · the cast of the question moment<br>house · D1 and the frame's vargas, the frame's houses | prashna_card<br>house_card | `src/reading/prompts/prashna.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/28 §5; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.prashna`  
**Agents:** `reading.analyst.prashna`

### House promise analyst — `general.promise`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), arudhas (jaimini), special lagnas (jaimini)

**Algorithm:**

1. Intake picks the subjects; the selected techniques decide which analysts run per subject (src/techniques/use.ts techniquesForQuestion; promise and dasha always), in parallel with each other
2. It is sent the evidence pack sections base, frame, detail, varga, arudha, built for the subject's frame (houses, karakas, vargas, arudhas, special lagnas): from the kundli digest when its status is ready (packs/digestSource.ts, field by field, the dossier's value where the digest has none), else from the stored dossier
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. The D1 house that owns the subject leads (doc 46 §B.11); the frame names its vargas, lords, karakas and arudhas

**Special:** Becomes general.house_promise in D3 (doc 53 §4.4); the id stays so tagged runs keep joining. Reads the digest when it is ready: base, detail, varga and arudha from its house, planet and point rows

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and the frame's vargas, the frame's houses<br>planet · D1 cards of the frame's house lords and karakas<br>point · arudhas and special lagnas of the frame<br>yoga · yogas touching the frame's houses or their lords | house_card<br>planet_card<br>point_row<br>yoga_row | `src/reading/prompts/v2/promise.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/03 §3; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.promise; packs/digestSource.ts overlayDigest`  
**Agents:** `reading.analyst.promise`

### Oracle readers (R01–R14, P1–P3) — `general.reader`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** yogas (natal), doshas (natal), aspects (natal), argala (jaimini), bhava (natal), D9 (divisional), D30 (divisional), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D10 (divisional), Vimshottari (dasha), Narayana (dasha), Chara (dasha), Yogini (dasha), Tithi Ashtottari (dasha), dwisatpathi (dasha), applicable (dasha), strength (natal), transit overlay (transit), Tithi Pravesha (annual), varsha (annual), sahams (annual), mudda (annual), patyayini (annual), prashna (natal), sphutas (natal)

**Algorithm:**

1. A rule on the question picks which readers run (never a model); the tier sets how many
2. Each reader gets one slice of the stored tables (its types) clipped to the horizon and the frame houses, and its own curriculum and budget
3. Natal readers are not sent the question, so their findings are reused across questions
4. Every call holds a reservation from the cost guard; a reader past the join deadline is dropped

**Special:** In D3 the CHART CORE becomes the digest house and planet cards of D1 plus the frame vargas (doc 53 §4.2)

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · CHART CORE (nine stored types) and D1 plus the frame vargas, the frame houses<br>planet · CHART CORE: every planet in D1<br>yoga · present yogas and doshas (R01, R06)<br>point · arudhas and argala of the frame (R03, R04)<br>activation · Vimshottari and the other dasha systems inside the horizon (R08, R09, R04)<br>transit · the question's transit rows (R07, R10, R13, P1–P3)<br>annual · TP, VP, sahams, Mudda and Patyayini of the years in the horizon (R11)<br>prashna · the cast when the question is prashna-eligible (R12) | house_card<br>planet_card<br>yoga_row<br>point_row<br>activation_row<br>transit_row<br>annual_row<br>prashna_card | `src/reading/prompts/readers/_shared.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/33 §2; 39 §4.1; 53 §4.2  
**Code:** `src/reading/oracle/readers.ts READERS; runReader.ts`  
**Agents:** `reading.reader`

### Strength and yoga analyst — `general.strength_yoga`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** yogas (natal), doshas (natal), strength (natal), sav (ashtakavarga), avasthas (natal)

**Algorithm:**

1. Runs only when the kundli's digest is ready, on every subject the selectors pick, in the graph and the oracle flows (src/techniques/use.ts); code, no model
2. Reads the digest section of the subject's evidence pack (packs/digestSource.ts digestSection): the D1 yoga register rows that join a frame house or a frame lord or karaka, the SAV of the frame houses and the shadbala of the frame lords
3. Each claim takes its side and weight from the rule table (src/reading/codeReaders/rules.ts CODE_READER_RULES, with sources) and cites the digest rows it read as evidence ids (digest.<section>.<digest key>.<field>); at most 8 claims, heaviest first
4. Layer score: the signed weights summed, a third of it rounded, clamped to -3..+3; the finding joins reconcile and the oracle brief like an analyst's (analyst strength_yoga)
5. A yoga the engine lists as present supports (weight 2) and goes to graces; a row of class dosha obstructs (weight 2)
6. SAV of a frame house: 28 or more supports, 22 or less obstructs (weight 1)
7. Shadbala ratio of a frame lord (the engine's rupas over the required): 1 or more supports, below 1 obstructs (weight 1); the rank is quoted

**Special:** Code-path reader first (doc 53 step 5); a model reader on the same contract (R05, R06 curricula) waits for the spend yes

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| yoga · D1 yogas, doshas and cancellations joining the frame's planets or houses<br>planet · D1 cards of the frame's lords and karakas (shadbala_rank, shadbala ratio)<br>house · D1, the frame's houses (sav column) | yoga_row<br>planet_card<br>house_card | `none` | — | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/53 §4.4; 33 R5, R6; BPHS ch. 27, 34-41, 66-72  
**Code:** `src/reading/codeReaders/readers.ts strengthYoga; rules.ts`  
**Agents:** `reading.code.strength_yoga`

### Transit analyst — `general.transit`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), arudhas (jaimini), Vimshottari (dasha), Narayana (dasha), transit overlay (transit), Transit contacts (transit), transit at (transit)

**Algorithm:**

1. Intake picks the subjects; the selected techniques decide which analysts run per subject (src/techniques/use.ts techniquesForQuestion; promise and dasha always), in parallel with each other
2. It is sent the evidence pack sections base, frame, arudha, dasha, transits and transit_at, built for the subject's frame (houses, karakas, vargas, arudhas, special lagnas): from the kundli digest when its status is ready (packs/digestSource.ts, field by field, the dossier's value where the digest has none), else from the stored dossier
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. The transits section holds the selected transit rows for the frame's houses and natal points, with the natal-degree contacts clipped to the horizon; transit_at is the sky at an asked date

**Special:** Revised in D3 (doc 53 §4.4): contacts to the lords and karakas, double transit, sade sati, eclipses and transit ashtakavarga scores from the shared sky and the overlay

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term; horizon is now, 3m, 6m, 1y, 3y, life, custom

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| transit · shared sky with the overlay for the frame's houses, lords and karakas inside the horizon; double transit; sade sati; eclipses; transit ashtakavarga<br>planet · D1 cards of the frame's house lords and karakas | transit_row<br>planet_card | `src/reading/prompts/v2/transit.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/03 §3; 28 §5; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.transit`  
**Agents:** `reading.analyst.transit`

### Validator — `general.validator`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** —

**Algorithm:**

1. After the answer has gone out, rules check it answered the question (under 5 ms, no model)
2. Then a cheap model call with a 2 s budget; on any failure the rules stand
3. It reports; the flow decides whether one loop back through at most two readers runs

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| text · the question, the clarify turns and the answer | text_in | `src/reading/prompts/oracle/validator.md` | QUESTION, CLARIFY_TURNS, ANSWER | validator.v1 | — |

**Source:** docs/reading-engine/39 §4.1  
**Code:** `src/reading/oracle/validator.ts`  
**Agents:** `reading.validator`

### Varga dynamics analyst — `general.varga_dynamics`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** D2 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), D12 (divisional), D24 (divisional), D30 (divisional), D60 (divisional), D16 (divisional), D20 (divisional), D27 (divisional), D40 (divisional), D45 (divisional), D81 (divisional), D108 (divisional), D144 (divisional)

**Algorithm:**

1. Runs only when the kundli's digest is ready, on every subject the selectors pick, in the graph and the oracle flows (src/techniques/use.ts); code, no model
2. Reads the digest section of the subject's evidence pack (packs/digestSource.ts digestSection): the house and planet cards of D1 and of each frame varga the digest holds (D9 for marriage, D10 for career, D2, D4, D7, D24, D12, D30, D60 by frame); the deeper set (D16, D20, D27, D40, D45, D81, D108, D144) joins when the question type is why_meaning or the horizon is life
3. Each claim takes its side and weight from the rule table (src/reading/codeReaders/rules.ts CODE_READER_RULES, with sources) and cites the digest rows it read as evidence ids (digest.<section>.<digest key>.<field>); at most 8 claims, heaviest first
4. Layer score: the signed weights summed, a third of it rounded, clamped to -3..+3; the finding joins reconcile and the oracle brief like an analyst's (analyst varga_dynamics)
5. For each frame house and varga: the D1 lord strong (exalted, moolatrikona, own) in D1 and in the varga supports (weight 2); debilitated in both obstructs (weight 2); strong in one and debilitated in the other is neutral (weight 1, promise and form disagree)
6. A planet occupying the frame house in D1 and the same house in the varga is neutral (weight 1, the bond repeats)

**Special:** Code-path reader first (doc 53 step 5); a model reader on the same contract (R03 curriculum) waits for the spend yes

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term; in D2, D4, D7, D9, D10, D12, D24, D30, D60, D16, D20, D27, D40, D45, D81, D108, D144

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and each frame varga, the frame's houses (lord, lord_dignity, occupants)<br>planet · D1 and each frame varga, the frame's house lords (dignity) | house_card<br>planet_card | `none` | — | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/53 §4.4; 33 R3; BPHS ch. 6-7; PVR ch. 9  
**Code:** `src/reading/codeReaders/readers.ts vargaDynamics; rules.ts`  
**Agents:** `reading.code.varga_dynamics`

### Your life at a glance (Part 1 of the life reading) — `life.dashboard`

**Built** · board: Timeline · accuracy: none

**Reads:** digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit)

**Algorithm:**

1. Needs the digest: when it is not ready the answer is preparing and the kundli is queued (digest_status pending unless building)
2. Per area run the promise scale (life.promise_scale) and the timing (life.timing_agreement)
3. Shown only when the area has a pressure now (a test line in the running periods or the sky) or a dated window
4. Issue: the heaviest current test line as a plain sentence with its end date, then one confirming question worded from the person's stored facts (work.status, love.status, family.children)
5. Cause: the planets of the current test lines and the withholding planets, the running periods that touch the area, and one plain sentence
6. Solution: two practical steps per area, the date to hold until, the best window to act in, and traditional support from the chart's strongest functional benefic (a weekday and a gesture)
7. Rule now: the running Vimshottari sub-period; its lord testing gives hold-and-prepare with what happens if broken, otherwise act on what is ready
8. Stored per kundli per day in area_builds (area life); template sentences only, no model

**Selected when:** board is timeline; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1, D9, D2, D3, D4, D7, D10, D12, D20, D24, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 houses of the area; D9 and the owning varga, primary house<br>planet · D1 karakas of the area; the primary house lord in D9 and the owning varga<br>yoga · D1 yogas on the area houses or their lords<br>activation · every family, levels 1-2, today to +15 years, the area houses<br>annual · TP and VP of each year a window touches, D1 card of the primary house<br>transit · stored natal-overlay double_transit windows and Saturn/Rahu/Ketu rows (read only; none fetched) | house_card<br>planet_card<br>yoga_row<br>activation_row<br>annual_row<br>transit_row | `none` | — | life_reading.v1 | — |

**Source:** docs/reading-engine/34 §1, §5 Part 1; 54 §4  
**Code:** `src/reading/life/compose.ts composeDashboard; service.ts getLifeReading`  
**Agents:** `life.dashboard`

### Life areas: the weighed promise scale — `life.promise_scale`

**Built** · board: Timeline · accuracy: none

**Reads:** digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit)

**Algorithm:**

1. Thirteen areas, each with D1 houses (primary first), karakas and an owning varga from the subject frames: self 1,9,10; money 2,11,9,5 (D2); work 10,6,1 (D10); home 4,2,11 (D4); marriage 7,2,11,12 (D9); children 5,9 (D7); parents 4,9 (D12); siblings 3,11,1 (D3); legal 6,10,8 (D30, else D10); health 1,6,8 (D30); travel 12,9,3,7 (D4); learning 4,5,2,9 (D24); dharma 9,12,8,5 (D20)
2. D1 (35): per area house (primary weighted 2, others 1) the lord's dignity, the class of the house the lord sits in (dusthana tests, kendra or trikona supports), each occupant's dignity or else its natural nature, SAV (28+ supports, 24 or less tests), argala open against obstructed; each karaka's functional nature, else dignity, else combustion; yogas on the area houses or their lords (raja, dhana, mahapurusha, cancellation support; doshas test)
3. Vargas (20): D9 for every area and the owning varga beside it when the digest holds it (10 + 10, else D9 alone): the primary house lord and occupants in that varga, and the D1 primary lord's dignity there
4. Dashas (25): the period running today in each family (Vimshottari 8, rasi 6, conditional 4, Yogini 3, Tithi Ashtottari 2, others 2), silent unless it activates an area house; otherwise its lord's functional nature, else dignity, decides the side; a rasi period reads the lord of its sign from the D1 house cards
5. Annual (10): this year's TP (6) and VP (4) D1 card of the primary house: lord dignity and occupants averaged
6. Transit (10): from the stored natal-overlay chart only: Saturn, Rahu or Ketu on an area house tests, a Jupiter-Saturn double transit on one supports
7. Each layer earns its weight times (support + half of neutral) over its lines; the score is the sum over the layers that are there, scaled to 100
8. Verdict from D1 and vargas only: 60 % or more promised, 40-59 % partial, under 40 % not written; withholding planets are the test lines' planets, heaviest first

**Special:** The antardasha lord's place from the mahadasha lord (6/8/12) is not read: it would be a derivation in Node; filed in docs/TODOS.md for the engine

**Selected when:** board is timeline; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1, D9, D2, D3, D4, D7, D10, D12, D20, D24, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 houses of the area; D9 and the owning varga, primary house<br>planet · D1 karakas of the area; the primary house lord in D9 and the owning varga<br>yoga · D1 yogas on the area houses or their lords<br>activation · periods running today, levels 1-2 | house_card<br>planet_card<br>yoga_row<br>activation_row | `none` | — | life_promise.v1 | `life.dashboard` |

**Source:** docs/reading-engine/34 §2, §3; 54 §4  
**Code:** `src/reading/life/promise.ts promiseScale`  
**Agents:** `life.dashboard`

### Life areas: when it improves, by agreement across systems — `life.timing_agreement`

**Built** · board: Timeline · accuracy: none

**Reads:** digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit)

**Algorithm:**

1. Candidates: each Vimshottari sub-period (level 2, else level 1) in the next 15 years that activates an area house and whose lord does not test the area
2. Another family agrees when one of its periods overlapping the window activates an area house without testing it; it contradicts when every such period tests it
3. Dated only when Vimshottari and at least one of conditional, rasi, Yogini or Tithi Ashtottari agree; otherwise the window is a possibility, written as one, with its year only
4. Score: 55 times the area's promise ratio + Vimshottari 8 + the agreeing families' weights - the contradicting families' weights + TP 6 and VP 4 when a year the window touches supports the primary house + 10 when a stored double transit falls on an area house inside the window
5. Grade: 70+ strong, 50-69 moderate, under 50 weak; the basis names how many systems agree, whether the year chart confirms, whether the sky confirms or could not be checked, and how many disagree
6. The best three dated windows by score, shown in date order

**Special:** The stored transit chart covers about two years; windows past it carry "the sky check is not available" and do not earn the transit points

**Selected when:** board is timeline; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1, D9, D2, D3, D4, D7, D10, D12, D20, D24, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · every family, levels 1-2, today to +15 years, the area houses<br>annual · TP and VP of each year a window touches, D1 card of the primary house<br>transit · stored natal-overlay double_transit windows and Saturn/Rahu/Ketu rows (read only; none fetched) | activation_row<br>annual_row<br>transit_row | `none` | — | life_windows.v1 | `life.dashboard` |

**Source:** docs/reading-engine/34 §2, §3; 54 §4  
**Code:** `src/reading/life/timing.ts areaTiming`  
**Agents:** `life.dashboard`

## Agents registered (`agent_registry`)

| Id | Title | Kind | Module | Model | Price in / out per 1M |
|---|---|---|---|---|---|
| `area.career_inputs` | Career inputs loader | engine_pull | area / career | engine:transit_contacts | — |
| `area.career_map` | Career map builder | code | area / career | — | — |
| `area.love_board` | Love board builder | code | area / love | — | — |
| `area.self_board` | You board builder | code | area / self | — | — |
| `digest.activation` | Activation calendar builder | code | digest / activation | — | — |
| `digest.annual_set` | Annual set puller | engine_pull | digest / annual | engine:annual | — |
| `digest.build` | Kundli digest builder | code | digest / build | — | — |
| `life.dashboard` | Life reading dashboard | code | life / dashboard | — | — |
| `lucky.day_overlay` | Personal day overlay puller | engine_pull | lucky_times / personal | engine:muhurta | — |
| `lucky.day_tables` | Day tables puller | engine_pull | lucky_times / data | engine:muhurta | — |
| `lucky.scenario_windows` | Scenario windows builder | code | lucky_times / scenarios | — | — |
| `reading.analyst.annual` | Annual chart analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.dasha` | Dasha analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.nakshatra` | Nakshatra analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.prashna` | Question chart analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.promise` | Promise analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.transit` | Transit analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.clarify` | Clarify | llm | reading / clarify | bedrock:openai.gpt-oss-120b-1:0 | — |
| `reading.code.jaimini` | Jaimini reader | code | reading / code_reader | — | — |
| `reading.code.person` | Person reader | code | reading / code_reader | — | — |
| `reading.code.strength_yoga` | Strength and yoga reader | code | reading / code_reader | — | — |
| `reading.code.varga_dynamics` | Divisional chart agreement | code | reading / code_reader | — | — |
| `reading.fast` | Fast path | llm | reading / fast | gemini-3.8-flash | $0.750000 / $3.750000 |
| `reading.intake` | Intake | llm | reading / intake | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.oracle` | Oracle | llm | reading / oracle | gemini-3.8-flash | $0.750000 / $3.750000 |
| `reading.reader` | Oracle reader | llm | reading / reader | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.specialist` | Specialist reader | llm | reading / specialist | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.step` | Reading step | code | reading / step | — | — |
| `reading.synth` | Synthesizer | llm | reading / synth | gemini-3.8-flash | $0.750000 / $3.750000 |
| `reading.validator` | Validator | llm | reading / validator | gemini-3.1-flash-lite | $0.250000 / $1.500000 |

## How to regenerate

Run `npx tsx scripts/write-techniques-doc.ts` to seed `technique_registry` and `agent_registry` (when `DATABASE_URL` is set) and regenerate `docs/admin/05-techniques-catalogue.md`.
