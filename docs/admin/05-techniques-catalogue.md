# 05 — The techniques catalogue, as registered on 2026-11-05

Generated from `technique_registry` (the catalogue in `src/techniques/catalog.ts`, seeded at boot; docs/admin/03). The Admin
Panel shows the same rows with their runs, timings and accuracy at https://admin.vedic-astrology.app/techniques. Regenerate
with the script noted at the end after the catalogue changes.

Every row is a contract (doc 53 §4.3): *Selected when* says which questions or boards choose it; *Contract* says what it reads, in which table layout, under which prompt, and what it returns.

Counts: 63 techniques (General Reading: 18, Self (You board): 15, Love: 14, Work: 16); 32 built, 0 partly built, 31 planned. Agents registered: 20.

## Summary

| Id | Technique | Category | Board | Status | Charts and tables read | Agents | Accuracy evidence |
|---|---|---|---|---|---|---|---|
| `general.annual` | Annual set analyst | general | General Reading chat | Built | facts (natal), Tithi Pravesha (annual), tithi pravesha dasha (annual) | `reading.analyst.annual` | staff |
| `general.clarify` | Clarify | general | General Reading chat | Built | — | `reading.clarify` | staff |
| `general.dasha` | Dasha analyst (all systems) | general | General Reading chat | Built | facts (natal), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), Vimshottari (dasha), Narayana (dasha) | `reading.analyst.dasha` | staff |
| `general.intake` | Intake | general | General Reading chat | Built | — | `reading.intake` | staff |
| `general.nakshatra` | Nakshatra analyst | general | General Reading chat | Built | facts (natal), janma (nakshatra), Vimshottari (dasha), transit overlay (transit) | `reading.analyst.nakshatra` | staff |
| `general.oracle` | Oracle and synthesizer | general | General Reading chat | Built | — | `reading.oracle`, `reading.synth` | staff |
| `general.prashna` | Question chart analyst | general | General Reading chat | Built | facts (natal), prashna (natal) | `reading.analyst.prashna` | staff |
| `general.promise` | House promise analyst | general | General Reading chat | Built | facts (natal), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), arudhas (jaimini), special lagnas (jaimini) | `reading.analyst.promise` | staff |
| `general.reader` | Oracle readers (R01–R14, P1–P3) | general | General Reading chat | Built | yogas (natal), doshas (natal), aspects (natal), argala (jaimini), bhava (natal), D9 (divisional), D30 (divisional), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D10 (divisional), Vimshottari (dasha), Narayana (dasha), Chara (dasha), Yogini (dasha), Tithi Ashtottari (dasha), dwisatpathi (dasha), applicable (dasha), strength (natal), transit overlay (transit), Tithi Pravesha (annual), Varshaphal (annual), sahams (annual), mudda (annual), patyayini (annual), prashna (natal), sphutas (natal) | `reading.reader` | staff |
| `general.transit` | Transit analyst | general | General Reading chat | Built | facts (natal), arudhas (jaimini), Vimshottari (dasha), Narayana (dasha), transit overlay (transit), Transit contacts (transit), transit at (transit) | `reading.analyst.transit` | staff |
| `general.validator` | Validator | general | General Reading chat | Built | — | `reading.validator` | staff |
| `digest.activation` | Activation calendar, thirty years ahead | general | General Reading chat | Planned | all systems (dasha), applicable (dasha), facts (natal) | — | none |
| `digest.annual_set` | Annual set, ten years back and ahead | general | General Reading chat | Planned | Tithi Pravesha (annual), Varshaphal (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D9 (divisional), D10 (divisional) | — | none |
| `digest.build` | Kundli digest (the first-time breakdown) | general | General Reading chat | Planned | dignities (natal), aspects (natal), argala (jaimini), arudhas (jaimini), house counts (natal), sav (ashtakavarga), facts (natal), relations (natal), avasthas (natal), strength.shadbala (natal), benefic malefic (natal), yogas (natal), doshas (natal), charakaraka (jaimini), sphutas (natal), Tithi Pravesha (annual), Varshaphal (annual), janma (nakshatra), panchanga (natal) | — | none |
| `general.jaimini` | Jaimini analyst | general | General Reading chat | Planned | charakaraka (jaimini), arudhas (jaimini), argala (jaimini), Narayana (dasha), Chara (dasha) | — | none |
| `general.person` | The person in your chart | general | General Reading chat | Planned | facts (natal), aspects (natal), D12 (divisional), D9 (divisional), D7 (divisional), D3 (divisional), Vimshottari (dasha) | — | none |
| `general.strength_yoga` | Strength and yoga analyst | general | General Reading chat | Planned | yogas (natal), doshas (natal), strength (natal), sav (ashtakavarga), avasthas (natal) | — | none |
| `general.varga_dynamics` | Varga dynamics analyst | general | General Reading chat | Planned | D2 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), D12 (divisional), D24 (divisional), D30 (divisional), D60 (divisional), D16 (divisional), D20 (divisional), D27 (divisional), D40 (divisional), D45 (divisional), D81 (divisional), D108 (divisional), D144 (divisional) | — | none |
| `lucky.avoid_bands` | Avoid bands and good spans of the day | self | Lucky times | Built | kalams (panchang), muhurta (panchang) | `lucky.scenario_windows` | staff |
| `lucky.day_tables` | Shared day tables per place | self | Lucky times | Built | muhurta (panchang) | `lucky.day_tables` | none |
| `lucky.home.start_routine` | Start a routine | self | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.personal_overlay` | Personal overlay (tara, chandra bala and the chart marks) | self | Lucky times | Built | muhurta (panchang), tara (nakshatra), chandra bala (panchang) | `lucky.day_overlay` | staff |
| `lucky.study.exam_submit` | Exam or submit | self | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.travel.set_out` | Set out on a journey | self | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.panchang_limbs` | The five limbs of the day (vara, tithi, nakshatra, yoga, karana) | self | Lucky times | Planned | weekday (panchang), tithi (panchang), nakshatra (panchang), yoga (panchang), karana (panchang) | — | none |
| `self.activation` | Activation of houses 1, 4 and 5 with the Moon by every dasha system | self | You board | Planned | Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | — | none |
| `self.affliction` | Afflictions on houses 1, 4 and 5 with the Moon | self | You board | Planned | facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal) | — | none |
| `self.annual` | This year's chart for houses 1, 4 and 5 with the Moon | self | You board | Planned | Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual) | — | none |
| `self.nakshatra` | Nakshatra charter of houses 1, 4 and 5 with the Moon | self | You board | Planned | cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra) | — | none |
| `self.promise` | Natal promise of houses 1, 4 and 5 with the Moon | self | You board | Planned | facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal) | — | none |
| `self.protection` | What protects houses 1, 4 and 5 with the Moon | self | You board | Planned | aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | — | none |
| `self.transit` | Transits over houses 1, 4 and 5 with the Moon | self | You board | Planned | Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga) | — | none |
| `self.varga` | Owning divisional chart of houses 1, 4 and 5 with the Moon | self | You board | Planned | D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | — | none |
| `love.activation` | Activation of house 7 by every dasha system | love | Love board | Planned | Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D9 (divisional), D7 (divisional), D30 (divisional) | — | none |
| `love.affliction` | Afflictions on house 7 | love | Love board | Planned | facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal) | — | none |
| `love.annual` | This year's chart for house 7 | love | Love board | Planned | Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual) | — | none |
| `love.health` | How the relationship is | love | Love board | Planned | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | — | none |
| `love.meet` | Meeting someone | love | Love board | Planned | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | — | none |
| `love.nakshatra` | Nakshatra charter of house 7 | love | Love board | Planned | cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra) | — | none |
| `love.promise` | Natal promise of house 7 | love | Love board | Planned | facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal) | — | none |
| `love.protection` | What protects house 7 | love | Love board | Planned | aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D9 (divisional), D7 (divisional), D30 (divisional) | — | none |
| `love.reconcile` | Strain and reconciling | love | Love board | Planned | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | — | none |
| `love.transit` | Transits over house 7 | love | Love board | Planned | Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga) | — | none |
| `love.varga` | Owning divisional chart of house 7 | love | Love board | Planned | D9 (divisional), D7 (divisional), D30 (divisional) | — | none |
| `lucky.love.ask_out` | Ask someone out | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.love.clear_air` | Clear the air | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.love.first_date` | A first date | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.money.invest_buy` | Invest or buy | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.ask_raise` | Ask for a raise | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.hard_talk_boss` | A hard talk with the boss | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.interview` | Interview or pitch | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.send_resume` | Send a resume or application | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.sign_contract` | Sign a contract | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.start_project` | Start a project | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang) | `lucky.scenario_windows` | staff |
| `work.horizons` | Horizons (1, 3, 6, 12 months) | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `work.looking_back` | Looking back | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | area_checks:career |
| `work.present_tone` | Present tone | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | area_checks:career |
| `work.security_grade` | Job security by month | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `work.subarea_windows` | Windows ahead by sub-area | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `work.annual_family` | This year's chart (annual family) | work | Work board | Planned | Tithi Pravesha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D10 (divisional) | — | none |
| `work.conditional_family` | Conditional clock | work | Work board | Planned | applicable (dasha), conditional (dasha) | — | none |
| `work.d10_check` | D1 and D10 agreement on each dasha vote | work | Work board | Planned | D1 (divisional), D10 (divisional), D9 (divisional), D60 (divisional) | — | none |
| `work.karaka_family` | Karaka clock | work | Work board | Planned | karaka (dasha), chara karakas (jaimini), D10 (divisional) | — | none |

## General Reading

### Annual set analyst — `general.annual`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), Tithi Pravesha (annual), tithi pravesha dasha (annual)

**Algorithm:**

1. Intake picks the subjects; the graph runs this analyst once per subject, in parallel with the others
2. It is sent the evidence pack sections base, frame, annual, built from the stored dossier and the subject's frame (houses, karakas, vargas, arudhas, special lagnas)
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. Runs only when the graph has the Tithi Pravesha year chart and its dasha for the question

**Special:** Becomes general.annual_set in D3 (doc 53 §4.4): the current, previous and next year (TP and VP, D1, D9, D10) with their year dashas, sahams, muntha and year lord when served; the id stays so tagged runs keep joining. Selected for horizons within 24 months; a timing question on a longer horizon is a planned any-of rule

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term; horizon is now, 3m, 6m, 1y, custom

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP and VP of the current, previous and next year, D1, D9, D10, the frame's houses; year dashas; sahams in the frame's houses; muntha and year lord when served | annual_row | `src/reading/prompts/annual.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/28 §5; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.annual`  
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

**Reads:** facts (natal), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), Vimshottari (dasha), Narayana (dasha)

**Algorithm:**

1. Intake picks the subjects; the graph runs this analyst once per subject, in parallel with the others
2. It is sent the evidence pack sections base, frame, detail, varga, dasha, built from the stored dossier and the subject's frame (houses, karakas, vargas, arudhas, special lagnas)
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. The dasha section holds the Vimshottari periods inside the horizon, each period lord's place in the frame vargas and the running Narayana sign

**Special:** Becomes general.dasha_all_systems in D3 (doc 53 §4.4): every served system from the activation calendar, grouped into the seven families of doc 46 §B.4; the id stays so tagged runs keep joining

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term; horizon is now, 3m, 6m, 1y, 3y, life, custom

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · periods inside the horizon activating the frame's houses, every served system, grouped by family; Vimshottari MD/AD/PD at level 3; dasha.applicable<br>planet · D1 cards of the frame's house lords and karakas<br>house · D1 and the frame's vargas, the frame's houses | activation_row<br>planet_card<br>house_card | `src/reading/prompts/v2/dasha.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/03 §3; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.dasha`  
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

### Nakshatra analyst — `general.nakshatra`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), janma (nakshatra), Vimshottari (dasha), transit overlay (transit)

**Algorithm:**

1. Intake picks the subjects; the graph runs this analyst once per subject, in parallel with the others
2. It is sent the evidence pack sections base, frame, detail, dasha, transits, built from the stored dossier and the subject's frame (houses, karakas, vargas, arudhas, special lagnas)
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

### Question chart analyst — `general.prashna`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), prashna (natal)

**Algorithm:**

1. Intake picks the subjects; the graph runs this analyst once per subject, in parallel with the others
2. It is sent the evidence pack sections base, frame, prashna, built from the stored dossier and the subject's frame (houses, karakas, vargas, arudhas, special lagnas)
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. Runs only when the graph has the chart of the question moment

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term; the question names prashna

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

1. Intake picks the subjects; the graph runs this analyst once per subject, in parallel with the others
2. It is sent the evidence pack sections base, frame, detail, varga, arudha, built from the stored dossier and the subject's frame (houses, karakas, vargas, arudhas, special lagnas)
3. The model returns structured findings whose claims cite evidence ids in the pack
4. Output that is not JSON is repaired once; a timeout, parse, schema, model or no-data failure is recorded and the synthesizer goes on without it
5. The D1 house that owns the subject leads (doc 46 §B.11); the frame names its vargas, lords, karakas and arudhas

**Special:** Becomes general.house_promise in D3 (doc 53 §4.4); the id stays so tagged runs keep joining

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and the frame's vargas, the frame's houses<br>planet · D1 cards of the frame's house lords and karakas<br>point · arudhas and special lagnas of the frame<br>yoga · yogas touching the frame's houses or their lords | house_card<br>planet_card<br>point_row<br>yoga_row | `src/reading/prompts/v2/promise.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v2 | `general.oracle` |

**Source:** docs/reading-engine/03 §3; 53 §4.4  
**Code:** `src/reading/nodes/specialists.ts; packs/selector.ts ANALYST_SECTIONS.promise`  
**Agents:** `reading.analyst.promise`

### Oracle readers (R01–R14, P1–P3) — `general.reader`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** yogas (natal), doshas (natal), aspects (natal), argala (jaimini), bhava (natal), D9 (divisional), D30 (divisional), D1 (divisional), D2 (divisional), D3 (divisional), D4 (divisional), D7 (divisional), D10 (divisional), Vimshottari (dasha), Narayana (dasha), Chara (dasha), Yogini (dasha), Tithi Ashtottari (dasha), dwisatpathi (dasha), applicable (dasha), strength (natal), transit overlay (transit), Tithi Pravesha (annual), Varshaphal (annual), sahams (annual), mudda (annual), patyayini (annual), prashna (natal), sphutas (natal)

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

### Transit analyst — `general.transit`

**Built** · board: General Reading chat · accuracy: staff

**Reads:** facts (natal), arudhas (jaimini), Vimshottari (dasha), Narayana (dasha), transit overlay (transit), Transit contacts (transit), transit at (transit)

**Algorithm:**

1. Intake picks the subjects; the graph runs this analyst once per subject, in parallel with the others
2. It is sent the evidence pack sections base, frame, arudha, dasha, transits and transit_at, built from the stored dossier and the subject's frame (houses, karakas, vargas, arudhas, special lagnas)
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

### Activation calendar, thirty years ahead — `digest.activation`

**Planned** · board: General Reading chat · accuracy: none

**Reads:** all systems (dasha), applicable (dasha), facts (natal)

**Algorithm:**

1. Every period of every served dasha system (43 graha and rasi systems; level 3 for the six that offer it) from birth to thirty years ahead
2. Each period carries the houses it activates as the engine states them: for graha dashas the lord's house, the houses it owns and the houses it aspects (from the planet cards); for rasi dashas the sign's house and its lord's house
3. One row per period in kundli_activation (kundli_id, system, level, lord_or_sign, from, to, houses), so "which periods activate house 7 between 2027 and 2030 under any system" is one indexed query

**Selected when:** board is chat, you, love, work, lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · every served system, levels 1–3, birth to +30 years<br>planet · D1 cards (house, owns, aspects_to) of the nine planets | activation_row<br>planet_card | `none` | — | kundli_activation.v1 | `digest.build` |

**Source:** docs/reading-engine/53 §4.1, step 3  
**Code:** `not built (src/reading/digest/activation.ts, doc 53 step 3)`  
**Agents:** none yet

### Annual set, ten years back and ahead — `digest.annual_set`

**Planned** · board: General Reading chat · accuracy: none

**Reads:** Tithi Pravesha (annual), Varshaphal (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D9 (divisional), D10 (divisional)

**Algorithm:**

1. For each year from ten back to ten ahead, pull TP and VP in D1, D9 and D10 with their year dashas and sahams from the engine (about 380 calls per kundli, batched at registration, about 25 per minute)
2. Store each as kundli_data rows (type, variant year=Y) and write the digest annual rows from them
3. Mark the digest stale when a year is missing and queue the pull

**Selected when:** board is chat, you, love, work, lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · annual.* for Y in −10…+10, D1, D9, D10 | annual_row | `none` | — | kundli_digest.v1 | `digest.build` |

**Source:** docs/reading-engine/53 §4.1, step 2  
**Code:** `not built (src/reading/digest/annualSet.ts, doc 53 step 2)`  
**Agents:** none yet

### Kundli digest (the first-time breakdown) — `digest.build`

**Planned** · board: General Reading chat · accuracy: none

**Reads:** dignities (natal), aspects (natal), argala (jaimini), arudhas (jaimini), house counts (natal), sav (ashtakavarga), facts (natal), relations (natal), avasthas (natal), strength.shadbala (natal), benefic malefic (natal), yogas (natal), doshas (natal), charakaraka (jaimini), sphutas (natal), Tithi Pravesha (annual), Varshaphal (annual), janma (nakshatra), panchanga (natal)

**Algorithm:**

1. Deterministic, no model: read the kundli's stored kundli_data rows (ensureChartData fetches what is missing) and write kundli_digest rows in six sections, each with its source (type@variant@calc_version + JSON path)
2. house D<n>.h<1..12>: lord, lord's house, sign and dignity, co-lord, occupants (with dignity and nature), aspected_by graha / rasi, argala (primary, secondary, obstructed), SAV, class (kendra, trikona, dusthana, upachaya, maraka, badhaka when served), cusp star and its lord, arudha of the house, the Tajaka lord when the year chart is loaded — from dignities.dN, aspects.dN, argala.dN, arudhas.dN, house_counts, ashtakavarga, facts.houses (D1)
3. planet D<n>.<planet>: sign, house, degree, star and pada and star lord, dignity, retro, combust, war, dispositor and its house, dispositor chain (D1, from avasthas), avasthas, shadbala rank and ratio (D1), natural and functional nature (D1), owns houses, aspects_to, aspected_by, conjunctions (same sign; within 8° from avasthas.proximity_audit) — from dignities.dN, aspects.dN, relations.dN, avasthas.dN, strength.shadbala, benefic_malefic
4. yoga D1.<yoga id>: present, planets, houses, class (raja, dhana, mahapurusha, dosha, cancellation), source rule — from yogas, doshas, facts.yogas; per varga once the engine serves it
5. point AK…DK, A1…A12, UL, AL, SL, HL, GL, IL, MD, GK, sphutas: the point's sign and house in D1 and in each named varga, its lord and the lord's place — from charakaraka, arudhas(.dN), sphutas
6. annual TP<year> and VP<year>, ten years back to ten ahead: the year chart's lagna, house lords and occupants, aspects, sahams in houses, year dasha (Tithi Ashtottari, Mudda, Patyayini) periods, muntha and year lord once served — from annual.*@year=Y (D1, D9, D10)
7. star profile: Moon star and its lord, lagna star, the 27-star tara table from the Moon, gandanta flags — from facts.nakshatra_profile, panchanga.birth
8. It selects, counts, joins and dates; it never derives a sign, a lord, an aspect, a dignity or a yoga (doc 46 §C.3; the no-astrology test guards it)
9. Status on kundlis: pending → building → ready with digest_version and digest_built_at; stale when an input row's calc version changes or a new digest version ships; failed with the error type

**Special:** Roughly 170 stored rows read and 1,500–3,000 digest rows written per kundli, under 10 s on the API Lambda

**Selected when:** board is chat, you, love, work, lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · dignities.dN, aspects.dN, argala.dN, arudhas.dN, house_counts, ashtakavarga, facts.houses (D1); every served varga<br>planet · dignities.dN, aspects.dN, relations.dN, avasthas.dN, strength.shadbala, benefic_malefic; every served varga<br>yoga · yogas, doshas, facts.yogas (D1)<br>point · charakaraka, arudhas(.dN), sphutas<br>annual · annual.{tithi_pravesha,varsha,tithi_pravesha_dasha,mudda,patyayini,sahams}@year=Y, D1, D9, D10, Y in −10…+10<br>star · facts.nakshatra_profile, panchanga.birth | house_card<br>planet_card<br>yoga_row<br>point_row<br>annual_row<br>star_profile | `none` | — | kundli_digest.v1 | — |

**Source:** docs/reading-engine/53 §4.1; 46 §C.3  
**Code:** `not built (src/reading/digest/build.ts, doc 53 step 1)`  
**Agents:** none yet

### Jaimini analyst — `general.jaimini`

**Planned** · board: General Reading chat · accuracy: none

**Reads:** charakaraka (jaimini), arudhas (jaimini), argala (jaimini), Narayana (dasha), Chara (dasha)

**Algorithm:**

1. Read the point cards: AK, AmK, DK, UL, AL and the A-houses of the frame, with their places and lords
2. Read the argala on the frame's houses from the house cards
3. Read the Narayana and Chara periods inside the horizon from the activation calendar
4. Return findings citing the point and activation keys

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| point · AK, AmK, DK, UL, AL and the A-houses of the frame<br>house · D1, the frame's houses (argala column)<br>activation · Narayana and Chara periods inside the horizon | point_row<br>house_card<br>activation_row | `src/reading/prompts/readers/R04-jaimini.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v3 | `general.oracle` |

**Source:** docs/reading-engine/53 §4.4; 33 R4  
**Code:** `not built (code-path reader first, doc 53 step 5)`  
**Agents:** none yet

### The person in your chart — `general.person`

**Planned** · board: General Reading chat · accuracy: none

**Reads:** facts (natal), aspects (natal), D12 (divisional), D9 (divisional), D7 (divisional), D3 (divisional), Vimshottari (dasha)

**Algorithm:**

1. The person named in the question (mother, father, spouse, child, sibling) maps to a house and a varga of the owner's chart (oracle/readers.ts personIn); the reading never uses another person's birth data
2. Read the person's house card in D1 and the named varga, and the karaka's planet card
3. Return findings with about: the person, citing the digest keys

**Special:** Selected for the person subjects; the clarify slot other_person (any subject) is a planned any-of rule of the matcher

**Selected when:** board is chat; subject is children or siblings or marriage relationship

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and the person's varga (D12, D9, D7, D3), the person's house<br>planet · D1 card of the person's karaka | house_card<br>planet_card | `src/reading/prompts/readers/R13-person.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v3 | `general.oracle` |

**Source:** docs/reading-engine/53 §4.4; 33 R13  
**Code:** `not built (code-path reader first, doc 53 step 5; today readers.ts R13 covers it in the oracle flow)`  
**Agents:** none yet

### Strength and yoga analyst — `general.strength_yoga`

**Planned** · board: General Reading chat · accuracy: none

**Reads:** yogas (natal), doshas (natal), strength (natal), sav (ashtakavarga), avasthas (natal)

**Algorithm:**

1. Read the yoga register filtered by the frame's planets and houses: present yogas, doshas and cancellations with their class
2. Read the shadbala ranks and avasthas of the frame's lords and karakas, and the SAV of the frame's houses
3. Return findings with graces[]: the yogas and strengths that carry the subject, each citing its digest key

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| yoga · D1 yogas, doshas and cancellations joining the frame's planets or houses<br>planet · D1 cards of the frame's lords and karakas (shadbala_rank, nature, avasthas)<br>house · D1, the frame's houses (sav column) | yoga_row<br>planet_card<br>house_card | `src/reading/prompts/readers/R06-yoga-dosha.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v3 | `general.oracle` |

**Source:** docs/reading-engine/53 §4.4; 33 R5, R6  
**Code:** `not built (code-path reader first, doc 53 step 5)`  
**Agents:** none yet

### Varga dynamics analyst — `general.varga_dynamics`

**Planned** · board: General Reading chat · accuracy: none

**Reads:** D2 (divisional), D4 (divisional), D7 (divisional), D9 (divisional), D10 (divisional), D12 (divisional), D24 (divisional), D30 (divisional), D60 (divisional), D16 (divisional), D20 (divisional), D27 (divisional), D40 (divisional), D45 (divisional), D81 (divisional), D108 (divisional), D144 (divisional)

**Algorithm:**

1. The frame names the subject's vargas (D9 for marriage, D10 for career, D2, D4, D7, D24, D12, D30, D60 by frame); the deeper set (D16, D20, D27, D40, D45, D81, D108, D144) joins when the question type is why_meaning or the horizon is life
2. Read the house and planet cards of each named varga for the frame's houses
3. Flag where D1 and the varga agree: lord dignity in both, occupants in both; disagreement lowers confidence
4. Return findings that cite the digest keys of the varga rows

**Selected when:** board is chat; subject is career work or income wealth or debt loss expense or property home or vehicles or marriage relationship or children or health body or education learning or spirituality moksha or foreign relocation or travel journeys or siblings or litigation government or speculation lottery or general life direction or explain term; in D2, D4, D7, D9, D10, D12, D24, D30, D60, D16, D20, D27, D40, D45, D81, D108, D144

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · each frame varga, the frame's houses<br>planet · each frame varga, the frame's lords and karakas; the D1↔Dn agreement flags | house_card<br>planet_card | `src/reading/prompts/readers/R03-varga.md` | TODAY, SUBJECT, FRAME, HORIZON, REAL_WANT, QUESTION, FACTS | findings.v3 | `general.oracle` |

**Source:** docs/reading-engine/53 §4.4; 33 R3  
**Code:** `not built (code-path reader first, doc 53 step 5)`  
**Agents:** none yet

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

1. General: find the days in today −7 … today +14 that the place has no stored row for
2. General: call the engine's muhurta for at most two missing months at the place
3. General: store one row per day (day_tables) with its calc version and a hash of the payload; one sky for every user at that place

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans) | panchang_day | `none` | — | day_tables.v1 | — |

**Source:** docs/reading-engine/47 §3; 49 §4.1  
**Code:** `src/reading/luckyTimes/service.ts pullDayTables`  
**Agents:** `lucky.day_tables`

### Start a routine — `lucky.home.start_routine`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 12:00 local, cut to those hours, 20 minutes or more; plus brahma muhurta (+2)
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Monday, Thursday
6. General: tithi group, inside its own span: favoured (+1) bhadra; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) fixed, quick; avoided (−2) none
8. General: hora lord: favoured (+2) Sun, Moon, Jupiter; avoided (−3) none
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['home.start_routine']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Personal overlay (tara, chandra bala and the chart marks) — `lucky.personal_overlay`

**Built** · board: Lucky times · accuracy: staff

**Reads:** muhurta (panchang), tara (nakshatra), chandra bala (panchang)

**Algorithm:**

1. Personal: once per month and place, call the engine's muhurta with the person's natal fields
2. Personal: store each day's tara (the day's star counted from the Moon star: janma, sampat, vipat, kshema, pratyak, sadhaka, vadha, mitra, parama mitra), chandra bala (the Moon's house from the natal Moon) and grade (kundli_day_overlays)
3. Personal: use the engine's own good/bad verdicts: +1 / −1 each on every window of that day
4. Personal (planned, doc 53 §4.6): the hora lord's nature for this chart, functional benefic or malefic from the digest planet cards of D1, moves a window by ±1
5. Personal (planned, doc 53 §4.6): whether the day's tithi lord or star lord is a running dasha lord in the activation calendar, marked on the window

**Special:** The two chart marks are planned additions (doc 53 step 7); today only tara and chandra bala score

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the person's overlay for the same days (tara, chandra bala, grade)<br>planet · D1 cards of the seven hora lords (nature column); planned<br>activation · periods running on each day, every system; planned | panchang_day<br>planet_card<br>activation_row | `none` | — | day_overlay.v1 | — |

**Source:** docs/reading-engine/49 §4.1; 53 §4.6  
**Code:** `src/reading/luckyTimes/service.ts personalDays; windows.ts personalScore`  
**Agents:** `lucky.day_overlay`

### Exam or submit — `lucky.study.exam_submit`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 20:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Wednesday, Thursday
6. General: tithi group, inside its own span: favoured (+1) jaya, purna; avoided (piece dropped) rikta
7. General: star group, inside its own span: favoured (+1) quick; avoided (−2) sharp
8. General: hora lord: favoured (+2) Mercury, Jupiter; avoided (−3) none
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['study.exam_submit']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Set out on a journey — `lucky.travel.set_out`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 21:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): none
6. General: tithi group, inside its own span: favoured (+1) bhadra, nanda; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) moving, quick; avoided (−2) sharp
8. General: hora lord: favoured (+2) Moon, Venus, Mercury; avoided (−3) Saturn
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** The direction rule for each weekday is not yet applied.

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['travel.set_out']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### The five limbs of the day (vara, tithi, nakshatra, yoga, karana) — `lucky.panchang_limbs`

**Planned** · board: Lucky times · accuracy: none

**Reads:** weekday (panchang), tithi (panchang), nakshatra (panchang), yoga (panchang), karana (panchang)

**Algorithm:**

1. General: read the day's five limbs from the place's stored day row, each with its end time
2. General: vara: the weekday and its lord, favoured or avoided per the act's scenario row
3. General: tithi: its group (nanda, bhadra, jaya, rikta, purna; amavasya) per the scenario's tithi lists
4. General: nakshatra: the Moon's star and its group per the scenario's star lists
5. General: yoga (Sun + Moon longitude, 27 yogas): avoided — Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti; favoured — Siddhi, Shubha, Amrita, Brahma, Indra, Dhruva, Harshana, Sukarma, Priti, Ayushman, Saubhagya, Shobhana
6. General: karana (half tithi, 11 karanas): avoided — Vishti (Bhadra); favoured for most acts — Bava, Balava, Kaulava, Taitila, Gara, Vanija; the four fixed karanas (Shakuni, Chatushpada, Naga, Kimstughna) by the rule of the act
7. General: the general limbs decide the day gate: a day whose yoga or karana is avoided is gated out for the act
8. Personal: the person's marks (lucky.personal_overlay) then move a window by ±1; they never open a gated day

**Special:** Yoga and karana are stored in the day table today but not scored (doc 53 §1); this row scores them (doc 53 step 7)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14: vara, tithi, nakshatra, yoga, karana with end times | panchang_day | `none` | — | limbs.v1 | `lucky.avoid_bands` |

**Source:** docs/reading-engine/53 §4.6; Muhurta Chintamani; B.V. Raman, Muhurta  
**Code:** `not built (luckyTimes/windows.ts gains yoga and karana in DayRow and scenarioDay, doc 53 step 7)`  
**Agents:** none yet

### Activation of houses 1, 4 and 5 with the Moon by every dasha system — `self.activation`

**Planned** · board: You board · accuracy: none

**Reads:** Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional)

**Algorithm:**

1. Seven families: main graha clock, conditional clock, rasi clock, karaka clock, annual clock, transit clock, short confirmers (Yogini and Tithi Ashtottari voting only when they agree)
2. Polarity of each running planet to the house: supports when it lords, occupies, signifies, or lords the 5th, 9th or 11th from it; tests when it lords 6, 8 or 12 or sits 6, 8 or 12 from it
3. A dasha vote counts only when D1 and the owning varga (D1) agree; D9 breaks a tie; D60 only with a birth time to the minute
4. One planet, one vote across the graha clocks
5. Periods thirty years ahead from the activation calendar, graded benefic or malefic by the period lord's nature and dignity in D1 and D9

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · every served system, periods from today to +30 years activating houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK | activation_row<br>planet_card | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.4; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Afflictions on houses 1, 4 and 5 with the Moon — `self.affliction`

**Planned** · board: You board · accuracy: none

**Reads:** facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal)

**Algorithm:**

1. Lord in a dusthana; combust, in war or debilitated lord; malefic conjunction or drishti on the house or its lord
2. Papakartari, nodes on the axis, dosha membership, lord in a dead avastha
3. Each affliction names its release (its own period, a neecha bhanga pair, a benefic period with D1 and the varga agreeing) or none: the release date is the end of the afflicting planet's running period in the activation calendar
4. Afflictions set the baseline and name the blocker; they never flip a verdict alone

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>yoga · yogas and doshas joining houses 1,4,5,9,12 or their lords or the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>activation · running and next periods of the afflicting planets, houses 1,4,5,9,12 | house_card<br>planet_card<br>yoga_row<br>activation_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.3; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### This year's chart for houses 1, 4 and 5 with the Moon — `self.annual`

**Planned** · board: You board · accuracy: none

**Reads:** Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual)

**Algorithm:**

1. The year chart's lord of the house and its place: kendra/trikona with dignity confirms, 6/8/12 contradicts
2. Occupants, aspects and argala in the year chart at half weight; where the natal lord falls this year
3. The house's sahams in a kendra of the year chart with a strong lord
4. The running Mudda, Patyayini or year tithi ashtottari lord gives the month
5. Returns confirms, amplifies, contradicts or silent; changes confidence by one step and never makes a verdict alone

**Special:** Muntha, the year lord and Tajaka yogas are engine gaps

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP and VP of the current, previous and next year, houses 1,4,5,9,12, their sahams and year dashas | annual_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.6; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Nakshatra charter of houses 1, 4 and 5 with the Moon — `self.nakshatra`

**Planned** · board: You board · accuracy: none

**Reads:** cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra)

**Algorithm:**

1. Cusp star of the house: its mission; the lord's star: through whom it delivers; occupants' stars: their flavour
2. One charter line per star and house from the reviewed charter table (config, with its source)
3. When the running PD lord's star lord is the house's lord or karaka, the vote is delivered through the star: confidence one step up

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| star · Moon star, lagna star and the tara table<br>house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12 (cusp_star column)<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK | star_profile<br>house_card<br>planet_card | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.8; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Natal promise of houses 1, 4 and 5 with the Moon — `self.promise`

**Planned** · board: You board · accuracy: none

**Reads:** facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal)

**Algorithm:**

1. For houses 1, 4 and 5 with the Moon: lord in a kendra, trikona or the house itself +2; in 6, 8 or 12 −2
2. Lord's dignity +2 / −2 (neecha bhanga checked); functional benefic / malefic occupants and graha drishti ±1; rasi drishti ±0.5
3. Argala net ±1; SAV of the sign ≥ 28 / ≤ 22 ±1; bhava bala rank top 4 / bottom 4 ±1
4. Yogas that include the house or its lord +1 to +3; doshas touching it −1 to −2
5. Natural karaka strong / weak ±1 (Sun for the 1st, Moon and Mercury for the 4th, Jupiter for the 5th); arudha of the house with benefics / malefics ±1; its special lagna +1
6. Lord's avastha: x1.25 awake, x0.5 dead; cap the sum to −8..+8; below −3 the house is not promised
7. Each support is one row, "D1.h1 aspected_by Ju", with its digest key

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>point · AK, SL, AL<br>yoga · yogas and doshas joining houses 1,4,5,9,12 or their lords or the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.2; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### What protects houses 1, 4 and 5 with the Moon — `self.protection`

**Planned** · board: You board · accuracy: none

**Reads:** aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional)

**Algorithm:**

1. Jupiter's drishti on the lagna or the Moon (digest house card aspected_graha)
2. Neecha Bhanga and the other cancellations in the yoga register
3. Benefic argala on houses 1, 4 and 5
4. The dispositor of the lagna lord being strong (the digest planet card's dispositor chain and dignity)
5. Each protection is one row with its digest key; protections raise the floor of the verdict and never add a promise

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>point · AK, SL, AL<br>yoga · yogas and doshas joining houses 1,4,5,9,12 or their lords or the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.3; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Transits over houses 1, 4 and 5 with the Moon — `self.transit`

**Planned** · board: You board · accuracy: none

**Reads:** Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga)

**Algorithm:**

1. Slow planets in the house: Jupiter supports, Saturn tests unless 3, 6, 10 or 11 from the Moon with a bindu, Rahu amplifies, Ketu detaches
2. Slow planets on the lord, karaka or arudha (contacts with stations); double transit on the house
3. Sade sati and dhaiya phases; eclipses on the axis or the lord, with dates
4. Transit ashtakavarga bindus in the planet’s own BAV support or test

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| transit · shared sky with the overlay: Sa, Ju, Ra, Ke and eclipses over houses 1,4,5,9,12, their lords and arudhas, ±24 months<br>house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12 | transit_row<br>house_card | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.5; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Owning divisional chart of houses 1, 4 and 5 with the Moon — `self.varga`

**Planned** · board: You board · accuracy: none

**Reads:** D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional)

**Algorithm:**

1. Owning varga first: D1, D9, D20, D24, D12, D4, D7, D60
2. The natal lord of the house in the varga (sign, house, dignity); the varga's own house and lord; vargottama
3. The running period lord's place in the varga; the arudha of the house in the varga
4. Returns agrees when its net side matches the activation side; a dasha vote counts only then

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 12; in D1, D9, D20, D24, D12, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D20,D24,D12,D4,D7,D60 houses 1,4,5,9,12<br>planet · D1 and D9 cards of the lagna lord, the Moon, the Sun, the 4th and 5th lords, Mercury, Jupiter, Ketu and AK<br>point · arudhas of houses 1,4,5,9,12 in D1, D9, D20, D24, D12, D4, D7, D60 | house_card<br>planet_card<br>point_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.7; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

## Love

### Activation of house 7 by every dasha system — `love.activation`

**Planned** · board: Love board · accuracy: none

**Reads:** Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D9 (divisional), D7 (divisional), D30 (divisional)

**Algorithm:**

1. Seven families: main graha clock, conditional clock, rasi clock, karaka clock, annual clock, transit clock, short confirmers (Yogini and Tithi Ashtottari voting only when they agree)
2. Polarity of each running planet to the house: supports when it lords, occupies, signifies, or lords the 5th, 9th or 11th from it; tests when it lords 6, 8 or 12 or sits 6, 8 or 12 from it
3. A dasha vote counts only when D1 and the owning varga (D9) agree; D9 breaks a tie; D60 only with a birth time to the minute
4. One planet, one vote across the graha clocks
5. Periods thirty years ahead from the activation calendar, graded benefic or malefic by the period lord's nature and dignity in D1 and D9

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · every served system, periods from today to +30 years activating houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord | activation_row<br>planet_card | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.4; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Afflictions on house 7 — `love.affliction`

**Planned** · board: Love board · accuracy: none

**Reads:** facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal)

**Algorithm:**

1. Lord in a dusthana; combust, in war or debilitated lord; malefic conjunction or drishti on the house or its lord
2. Papakartari, nodes on the axis, dosha membership, lord in a dead avastha
3. Each affliction names its release (its own period, a neecha bhanga pair, a benefic period with D1 and the varga agreeing) or none: the release date is the end of the afflicting planet's running period in the activation calendar
4. Afflictions set the baseline and name the blocker; they never flip a verdict alone

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>yoga · yogas and doshas joining houses 7,5,11,2,4,8,12 or their lords or Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>activation · running and next periods of the afflicting planets, houses 7,5,11,2,4,8,12 | house_card<br>planet_card<br>yoga_row<br>activation_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.3; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### This year's chart for house 7 — `love.annual`

**Planned** · board: Love board · accuracy: none

**Reads:** Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual)

**Algorithm:**

1. The year chart's lord of the house and its place: kendra/trikona with dignity confirms, 6/8/12 contradicts
2. Occupants, aspects and argala in the year chart at half weight; where the natal lord falls this year
3. The house's sahams in a kendra of the year chart with a strong lord
4. The running Mudda, Patyayini or year tithi ashtottari lord gives the month
5. Returns confirms, amplifies, contradicts or silent; changes confidence by one step and never makes a verdict alone

**Special:** Muntha, the year lord and Tajaka yogas are engine gaps

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP and VP of the current, previous and next year, houses 7,5,11,2,4,8,12, their sahams and year dashas | annual_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.6; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### How the relationship is — `love.health`

**Planned** · board: Love board · accuracy: none

**Reads:** facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit)

**Algorithm:**

1. Present state of house 7 and D9 h7: support and strain this month from the activation, transit and annual layers
2. The tone from the votes of the layers (doc 45 §7)
3. Selected when the companion memory says love.status is dating or committed or married

**Selected when:** board is love; subject is marriage relationship; love status is dating or committed or married; about houses 7, 5, 11; in D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the eight Love layers of this kundli (love.promise … love.nakshatra) | findings_in | `none` | — | board_subarea.v1 | — |

**Source:** docs/reading-engine/53 §4.5; 46 §B.12  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Meeting someone — `love.meet`

**Planned** · board: Love board · accuracy: none

**Reads:** facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit)

**Algorithm:**

1. Promise and activation of house 7 and UL for a new bond; Venus and the 7th lord running or transited
2. Windows from the activation calendar where house 7, 5 or 11 is activated with D9 agreeing
3. Selected when the companion memory says love.status is single or dating

**Selected when:** board is love; subject is marriage relationship; love status is single or dating; about houses 7, 5, 11; in D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the eight Love layers of this kundli (love.promise … love.nakshatra) | findings_in | `none` | — | board_subarea.v1 | — |

**Source:** docs/reading-engine/53 §4.5; 46 §B.12  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Nakshatra charter of house 7 — `love.nakshatra`

**Planned** · board: Love board · accuracy: none

**Reads:** cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra)

**Algorithm:**

1. Cusp star of the house: its mission; the lord's star: through whom it delivers; occupants' stars: their flavour
2. One charter line per star and house from the reviewed charter table (config, with its source)
3. When the running PD lord's star lord is the house's lord or karaka, the vote is delivered through the star: confidence one step up

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| star · Moon star, lagna star and the tara table<br>house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12 (cusp_star column)<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord | star_profile<br>house_card<br>planet_card | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.8; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Natal promise of house 7 — `love.promise`

**Planned** · board: Love board · accuracy: none

**Reads:** facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal)

**Algorithm:**

1. For house 7: lord in a kendra, trikona or the house itself +2; in 6, 8 or 12 −2
2. Lord's dignity +2 / −2 (neecha bhanga checked); functional benefic / malefic occupants and graha drishti ±1; rasi drishti ±0.5
3. Argala net ±1; SAV of the sign ≥ 28 / ≤ 22 ±1; bhava bala rank top 4 / bottom 4 ±1
4. Yogas that include the house or its lord +1 to +3; doshas touching it −1 to −2
5. Natural karaka strong / weak ±1 (Venus for the 7th); arudha of the house with benefics / malefics ±1; its special lagna +1
6. Lord's avastha: x1.25 awake, x0.5 dead; cap the sum to −8..+8; below −3 the house is not promised
7. Each support is one row, "D1.h1 aspected_by Ju", with its digest key

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>point · UL, A7, DK, AL<br>yoga · yogas and doshas joining houses 7,5,11,2,4,8,12 or their lords or Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.2; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### What protects house 7 — `love.protection`

**Planned** · board: Love board · accuracy: none

**Reads:** aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D9 (divisional), D7 (divisional), D30 (divisional)

**Algorithm:**

1. Jupiter on house 7, on Venus or on UL (digest house and point cards aspected_graha)
2. The D9 7th lord dignified (digest house card D9.h7 lord_dignity)
3. Benefic argala on UL and on house 7
4. Each protection is one row with its digest key; protections raise the floor of the verdict and never add a promise

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>point · UL, A7, DK, AL<br>yoga · yogas and doshas joining houses 7,5,11,2,4,8,12 or their lords or Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.3; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Strain and reconciling — `love.reconcile`

**Planned** · board: Love board · accuracy: none

**Reads:** facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit)

**Algorithm:**

1. Afflictions on house 7, its lord, Venus and UL and their release dates (love.affliction)
2. Periods ahead where the afflicting planet stops running and a supporter of 7 or 5 starts (love.activation)
3. Protections that hold the bond (love.protection)
4. Selected when the companion memory says love.status is separated or complicated

**Selected when:** board is love; subject is marriage relationship; love status is separated or complicated; about houses 7, 5, 11; in D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the eight Love layers of this kundli (love.promise … love.nakshatra) | findings_in | `none` | — | board_subarea.v1 | — |

**Source:** docs/reading-engine/53 §4.5; 46 §B.12  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Transits over house 7 — `love.transit`

**Planned** · board: Love board · accuracy: none

**Reads:** Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga)

**Algorithm:**

1. Slow planets in the house: Jupiter supports, Saturn tests unless 3, 6, 10 or 11 from the Moon with a bindu, Rahu amplifies, Ketu detaches
2. Slow planets on the lord, karaka or arudha (contacts with stations); double transit on the house
3. Sade sati and dhaiya phases; eclipses on the axis or the lord, with dates
4. Transit ashtakavarga bindus in the planet’s own BAV support or test

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| transit · shared sky with the overlay: Sa, Ju, Ra, Ke and eclipses over houses 7,5,11,2,4,8,12, their lords and arudhas, ±24 months<br>house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12 | transit_row<br>house_card | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.5; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Owning divisional chart of house 7 — `love.varga`

**Planned** · board: Love board · accuracy: none

**Reads:** D9 (divisional), D7 (divisional), D30 (divisional)

**Algorithm:**

1. Owning varga first: D9, D7, D30
2. The natal lord of the house in the varga (sign, house, dignity); the varga's own house and lord; vargottama
3. The running period lord's place in the varga; the arudha of the house in the varga
4. Returns agrees when its net side matches the activation side; a dasha vote counts only then

**Selected when:** board is love; subject is marriage relationship; about houses 7, 5, 11, 2, 4, 8, 12; in D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D7,D30 houses 7,5,11,2,4,8,12<br>planet · D1 and D9 cards of Venus, Jupiter, the Moon, the 7th lord and the D9 7th lord<br>point · arudhas of houses 7,5,11,2,4,8,12 in D9, D7, D30 | house_card<br>planet_card<br>point_row | `none` | — | house_state.v1 | — |

**Source:** docs/reading-engine/46 §B.7; 53 §4.5  
**Code:** `not built (house-state engine, doc 46, read from the digest, doc 53 step 6)`  
**Agents:** none yet

### Ask someone out — `lucky.love.ask_out`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Tuesday, Saturday
3. General: candidates are each hora between 09:00 and 22:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Friday, Wednesday
6. General: tithi group, inside its own span: favoured (+1) nanda, bhadra; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) soft; avoided (−2) fierce, sharp
8. General: hora lord: favoured (+2) Venus, Mercury, Moon; avoided (−3) Mars, Saturn
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (relationship)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.ask_out']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Clear the air — `lucky.love.clear_air`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Tuesday
3. General: candidates are each hora between 09:00 and 22:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Monday, Friday
6. General: tithi group, inside its own span: favoured (+1) nanda; avoided (piece dropped) jaya
7. General: star group, inside its own span: favoured (+1) soft, fixed; avoided (−2) fierce
8. General: hora lord: favoured (+2) Moon, Venus; avoided (−3) Mars
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (relationship)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.clear_air']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### A first date — `lucky.love.first_date`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between 11:00 and 22:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Friday
6. General: tithi group, inside its own span: favoured (+1) nanda; avoided (piece dropped) amavasya
7. General: star group, inside its own span: favoured (+1) soft; avoided (−2) sharp
8. General: hora lord: favoured (+2) Venus, Moon; avoided (−3) Mars, Saturn
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (relationship)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['love.first_date']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

## Work

### Invest or buy — `lucky.money.invest_buy`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 19:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Thursday, Wednesday
6. General: tithi group, inside its own span: favoured (+1) bhadra, purna; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) fixed; avoided (−2) sharp, fierce
8. General: hora lord: favoured (+2) Jupiter, Mercury; avoided (−3) Saturn
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Mercury's motion is not yet checked.

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['money.invest_buy']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Ask for a raise — `lucky.work.ask_raise`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Saturday
3. General: candidates are each hora between sunrise and 18:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Thursday
6. General: tithi group, inside its own span: favoured (+1) purna, jaya; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) fixed, quick; avoided (−2) sharp, fierce
8. General: hora lord: favoured (+2) Jupiter, Sun; avoided (−3) Saturn
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (job)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.ask_raise']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### A hard talk with the boss — `lucky.work.hard_talk_boss`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Tuesday
3. General: candidates are each hora between sunrise and 18:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Monday, Thursday
6. General: tithi group, inside its own span: favoured (+1) nanda; avoided (piece dropped) jaya, amavasya
7. General: star group, inside its own span: favoured (+1) soft, fixed; avoided (−2) fierce, sharp
8. General: hora lord: favoured (+2) Moon, Jupiter, Venus; avoided (−3) Mars, Saturn
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (who)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.hard_talk_boss']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Interview or pitch — `lucky.work.interview`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 18:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Thursday, Sunday, Wednesday
6. General: tithi group, inside its own span: favoured (+1) jaya, bhadra; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) quick, soft; avoided (−2) fierce
8. General: hora lord: favoured (+2) Sun, Jupiter; avoided (−3) Saturn, Mars
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (job)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.interview']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Send a resume or application — `lucky.work.send_resume`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 20:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Wednesday, Thursday, Sunday
6. General: tithi group, inside its own span: favoured (+1) bhadra, nanda; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) quick, moving; avoided (−2) sharp
8. General: hora lord: favoured (+2) Mercury, Sun, Jupiter; avoided (−3) Saturn
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Asks one question first (job)

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.send_resume']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Sign a contract — `lucky.work.sign_contract`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: whole day avoided on: Saturday, Tuesday
3. General: candidates are each hora between sunrise and 19:00 local, cut to those hours, 20 minutes or more
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Thursday, Wednesday
6. General: tithi group, inside its own span: favoured (+1) bhadra, purna; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) fixed; avoided (−2) fierce, sharp
8. General: hora lord: favoured (+2) Jupiter, Mercury; avoided (−3) Saturn, Mars
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Special:** Mercury's motion is not yet checked; avoid signing while it moves backward.

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.sign_contract']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

### Start a project — `lucky.work.start_project`

**Built** · board: Lucky times · accuracy: staff

**Reads:** tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang)

**Algorithm:**

1. General: read the place's stored day row (engine muhurta: panchang at noon, horas, kalams, muhurtas)
2. General: no weekday is avoided
3. General: candidates are each hora between sunrise and 20:00 local, cut to those hours, 20 minutes or more; plus brahma muhurta (+2)
4. General: cut out the avoid bands (rahu kalam, yamagandam, gulikai, durmuhurtam, varjyam); drop pieces under 20 minutes
5. General: weekday favoured (+1): Monday, Wednesday, Thursday
6. General: tithi group, inside its own span: favoured (+1) bhadra, nanda; avoided (piece dropped) rikta, amavasya
7. General: star group, inside its own span: favoured (+1) quick, fixed; avoided (−2) sharp
8. General: hora lord: favoured (+2) Jupiter, Mercury, Moon; avoided (−3) Saturn
9. General: abhijit overlap of 10 minutes or more (+2); amrita gadiya overlap (+2); good muhurtas covering half the piece (+1)
10. Personal: overlay when the person has a chart: tara good +1 / bad −1, chandra bala good +1 / bad −1 (the engine's verdicts)
11. General: keep pieces scoring 3 or more; show the best two in time order

**Selected when:** board is lucky

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| panchang · the place's day rows today −7 … today +14 (five limbs, horas, avoid bands, good spans)<br>panchang · the person's overlay for the same days (tara, chandra bala, grade) | panchang_day<br>panchang_day | `none` | — | windows.v1 | — |

**Source:** Muhurta Chintamani (tithi and star groups); B.V. Raman, Muhurta (weekdays); Drik Panchang hora tutorial  
**Code:** `src/reading/luckyTimes/scenarios.ts SCENARIOS['work.start_project']; windows.ts scenarioDay`  
**Agents:** `lucky.scenario_windows`

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

### This year's chart (annual family) — `work.annual_family`

**Planned** · board: Work board · accuracy: none

**Reads:** Tithi Pravesha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D10 (divisional)

**Algorithm:**

1. Read the Tithi Pravesha chart of the current year and its D10
2. Find the running Mudda or Patyayini lord and its place in the year chart's D10
3. Read the houses of the rajya and karma sahams
4. Cast one vote (support, test or neutral) as the sixth family of the present tone

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP current year, D1 and D10, houses 10,6,1,2,11; rajya and karma sahams; year dasha running this month | annual_row | `none` | — | family_vote.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1 (family 5); 46 §B.6; 53 §4.5  
**Code:** `not built (career.ts FAMILIES_NOT_BUILT; reads the digest annual set, doc 53 step 3)`  
**Agents:** none yet

### Conditional clock — `work.conditional_family`

**Planned** · board: Work board · accuracy: none

**Reads:** applicable (dasha), conditional (dasha)

**Algorithm:**

1. Read which conditional dashas the engine says apply to the chart (dasha.applicable)
2. Take the running lords at three levels and cast the main clock's career polarity rule on them
3. No vote when none applies

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · conditional systems named by dasha.applicable, levels 1–3, periods covering this month ±1, houses 10,6,1 | activation_row | `none` | — | family_vote.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1 (family 2); 46 §B.4; 53 §4.5  
**Code:** `not built (career.ts FAMILIES_NOT_BUILT; reads the activation calendar, doc 53 step 3)`  
**Agents:** none yet

### D1 and D10 agreement on each dasha vote — `work.d10_check`

**Planned** · board: Work board · accuracy: none

**Reads:** D1 (divisional), D10 (divisional), D9 (divisional), D60 (divisional)

**Algorithm:**

1. For the running lord of the main, conditional and karaka clocks, read its place and dignity in D1, D10, D9 and D60
2. A dasha vote counts only when D1 and D10 agree on its side; D9 breaks a tie
3. D60 confirms only when the birth time is recorded to the minute, and never decides alone
4. When D1 and D10 disagree, the family's vote is split and not counted

**Special:** Waits for the house-state engine (doc 46)

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · running lords of the main, conditional and karaka clocks this month<br>planet · D1, D10, D9, D60 cards of those lords<br>house · D10 houses 10,6,1,2,11 | activation_row<br>planet_card<br>house_card | `none` | — | vote_check.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1; 46 §B.7; 53 §4.5  
**Code:** `not built (career.ts header: waits for doc 46; reads the D10 house cards of the digest, doc 53 step 3)`  
**Agents:** none yet

### Karaka clock — `work.karaka_family`

**Planned** · board: Work board · accuracy: none

**Reads:** karaka (dasha), chara karakas (jaimini), D10 (divisional)

**Algorithm:**

1. Read the running karaka dasha lord (dasha.karaka.l3)
2. AmK or the 10th lord running gives support unless it is afflicted in D10
3. One planet, one vote across the main, conditional and karaka clocks

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · karaka dasha level 3, periods covering this month ±1<br>point · AmK and the 10th lord in D1 and D10<br>planet · D10 card of the running karaka lord | activation_row<br>point_row<br>planet_card | `none` | — | family_vote.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1 (family 4); 46 §B.4; 53 §4.5  
**Code:** `not built (career.ts FAMILIES_NOT_BUILT; reads the activation calendar, doc 53 step 3)`  
**Agents:** none yet

## Agents registered (`agent_registry`)

| Id | Title | Kind | Module | Model | Price in / out per 1M |
|---|---|---|---|---|---|
| `area.career_inputs` | Career inputs loader | engine_pull | area / career | engine:transit_contacts | — |
| `area.career_map` | Career map builder | code | area / career | — | — |
| `lucky.day_tables` | Day tables puller | engine_pull | lucky_times / data | engine:muhurta | — |
| `lucky.day_overlay` | Personal day overlay puller | engine_pull | lucky_times / personal | engine:muhurta | — |
| `lucky.scenario_windows` | Scenario windows builder | code | lucky_times / scenarios | — | — |
| `reading.analyst.annual` | Annual chart analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.dasha` | Dasha analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.nakshatra` | Nakshatra analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.prashna` | Question chart analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.promise` | Promise analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.analyst.transit` | Transit analyst | llm | reading / analyst | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.clarify` | Clarify | llm | reading / clarify | bedrock:openai.gpt-oss-120b-1:0 | — |
| `reading.fast` | Fast path | llm | reading / fast | gemini-3.8-flash | $0.750000 / $3.750000 |
| `reading.intake` | Intake | llm | reading / intake | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.oracle` | Oracle | llm | reading / oracle | gemini-3.8-flash | $0.750000 / $3.750000 |
| `reading.reader` | Oracle reader | llm | reading / reader | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.specialist` | Specialist reader | llm | reading / specialist | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `reading.step` | Reading step | code | reading / step | — | — |
| `reading.synth` | Synthesizer | llm | reading / synth | gemini-3.8-flash | $0.750000 / $3.750000 |
| `reading.validator` | Validator | llm | reading / validator | gemini-3.1-flash-lite | $0.250000 / $1.500000 |

## How to regenerate

Run the server's seed (it happens at boot) so `technique_registry` matches `src/techniques/catalog.ts`, then regenerate this file from the table. The generator lives with the admin planning session's notes; any script that selects `technique_registry` and `agent_registry` and prints the sections above reproduces it.
