# 05 — The techniques catalogue, as registered on 2026-11-06

Generated from `technique_registry` (the catalogue in `src/techniques/catalog.ts`, seeded at boot; docs/admin/03). The Admin
Panel shows the same rows with their runs, timings and accuracy at https://admin.vedic-astrology.app/techniques. Regenerate
with `npx tsx scripts/write-techniques-doc.ts` after the catalogue changes.

Every row is a contract (doc 53 §4.3): *Selected when* says which questions or boards choose it; *Contract* says what it reads, in which table layout, under which prompt, and what it returns.

Counts: 136 techniques (Self (You board): 58, Love: 27, Work: 29, General Reading: 22); 136 built, 0 partly built, 0 planned. Agents registered: 54.

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
| `research.self_dashboard_qa` | Research Self Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year zoom-in | self | You board | Built | facts (natal), dignities (natal), aspects (natal), avasthas (natal), yogas (natal), doshas (natal), strength.shadbala (natal), sav (ashtakavarga), charakaraka (jaimini), arudhas (jaimini), argala (jaimini), janma (nakshatra), cusp nak (nakshatra), D1 (divisional), D9 (divisional), D10 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D2 (divisional), D4 (divisional), D7 (divisional), D60 (divisional), Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), Transit contacts (transit), Sade Sati (transit), muhurta (panchang) | `research.self_dashboard_builder` | staff |
| `research.technical_verifier` | Independent Technical Verifier Agent (8-gate classical & governance audit) | self | You board | Built | facts (natal), dignities (natal), aspects (natal), avasthas (natal), yogas (natal), doshas (natal), strength.shadbala (natal), sav (ashtakavarga), charakaraka (jaimini), arudhas (jaimini), argala (jaimini), janma (nakshatra), cusp nak (nakshatra), D1 (divisional), D9 (divisional), D10 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D2 (divisional), D4 (divisional), D7 (divisional), D60 (divisional), Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), Transit contacts (transit), Sade Sati (transit), muhurta (panchang) | `research.technical_verifier` | staff |
| `self.activation` | Activation of houses 1, 4 and 5 with the Moon by every dasha system | self | You board | Built | Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | `area.self_board` | area_checks:self |
| `self.affliction` | Afflictions on houses 1, 4 and 5 with the Moon | self | You board | Built | facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal) | `area.self_board` | area_checks:self |
| `self.annual` | This year's chart for houses 1, 4 and 5 with the Moon | self | You board | Built | Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual) | `area.self_board` | area_checks:self |
| `self.character_arc` | Character evolution across 3 decades (Last 10 Years -> Who You Are Now -> Next 10 Years) | self | You board | Built | facts (natal), dignities (natal), D1 (divisional), D9 (divisional), D10 (divisional), charakaraka (jaimini), Vimshottari (dasha), Narayana (dasha) | `area.self_board` | area_checks:self |
| `self.nakshatra` | Nakshatra charter of houses 1, 4 and 5 with the Moon | self | You board | Built | cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra) | `area.self_board` | area_checks:self |
| `self.personality_joy` | Vedic Moon & Mercury personality and what brings joy & fulfillment | self | You board | Built | facts (natal), dignities (natal), aspects (natal), D1 (divisional), D9 (divisional), D24 (divisional), janma (nakshatra) | `area.self_board` | area_checks:self |
| `self.promise` | Natal promise of houses 1, 4 and 5 with the Moon | self | You board | Built | facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal) | `area.self_board` | area_checks:self |
| `self.protection` | What protects houses 1, 4 and 5 with the Moon | self | You board | Built | aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | `area.self_board` | area_checks:self |
| `self.reading.atma` | You reading: Your soul aim (atmakaraka, karakamsa, Sun, Jupiter, 9th and 12th houses) | self | You board | Built | charakaraka (jaimini), D1 (divisional), D9 (divisional), avasthas (natal) | `self.reading_panel` | area_checks:self |
| `self.reading.audit` | You reading: the code auditor over the cards (board.auditor, code half) | self | You board | Built | dossier rows (natal) | `self.reading_panel` | area_checks:self |
| `self.reading.body` | You reading: Your body (what the chart and the sky put on the body; facts only) | self | You board | Built | D1 (divisional), D30 (divisional), dignities (natal), benefic malefic (natal), reading clock L1-L2 (dasha), sky overlay when stored (transit) | `self.reading_panel` | area_checks:self |
| `self.reading.chapters` | You reading: Your chapters (previous, running and next main period of the reading clock, the running sub-period, confirmed by other clocks) | self | You board | Built | reading clock L1-L2 (dasha), Vimshottari (dasha), Narayana (dasha), Chara (dasha), Yogini (dasha), karaka (dasha), Tithi Ashtottari (dasha), avasthas dasha_charter (natal) | `self.reading_panel` | area_checks:self |
| `self.reading.clock` | You reading: the reading clock (preferred, applicable or default dasha system, and the confirming clocks) | self | You board | Built | dasha.applicable (dasha), all served systems (dasha) | `self.reading_panel` | area_checks:self |
| `self.reading.diagnosis` | You reading: Who you are, in short (three sentences built from the other panels, shown first) | self | You board | Built | panel claims (natal) | `self.reading_panel` | area_checks:self |
| `self.reading.lagna` | You reading: Who you are (1st house, lagna lord, arudha lagna, rising star, Moon lagna, D9 lagna) | self | You board | Built | D1 (divisional), D9 (divisional), dignities (natal), aspects (natal), avasthas (natal), arudhas (jaimini), cusp star (nakshatra) | `self.reading_panel` | area_checks:self |
| `self.reading.mind` | You reading: Your mind (Moon, Mercury, 3rd, 4th and 5th houses) | self | You board | Built | D1 (divisional), D9 (divisional), dignities (natal), yogas (natal), Moon star (nakshatra), sav (ashtakavarga) | `self.reading_panel` | area_checks:self |
| `self.reading.oracle` | You reading: AI family sub-agents, Self Lineman, and Self Oracle synthesis | self | You board | Built | panel claims (natal), D1 (divisional), D9 (divisional), D10 (divisional), D30 (divisional), reading clock (dasha), Tithi Pravesha (annual), sky overlay (transit) | `self.reading_oracle`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.self` | area_checks:self |
| `self.reading.purview` | You reading: the whole-chart purview check (board.purview, Self instance) | self | You board | Built | D1 (divisional), D9 (divisional), yogas (natal), reading clock (dasha), gandanta (nakshatra) | `self.reading_panel` | area_checks:self |
| `self.reading.struggle` | You reading: What you struggle with (afflictions on the self with release dates from the reading clock) | self | You board | Built | D1 (divisional), dignities (natal), avasthas (natal), benefic malefic (natal), house counts (natal), reading clock L1-L3 (dasha) | `self.reading_panel` | area_checks:self |
| `self.reading.year` | You reading: This year (the Tithi Pravesha year; Varsha confirms) | self | You board | Built | Tithi Pravesha (annual), tithi pravesha dasha (annual), varsha (annual), mudda (annual) | `self.reading_panel` | area_checks:self |
| `self.reading.yogas` | You reading: Gifts and knots (yogas and doshas on the self) | self | You board | Built | yogas (natal), doshas (natal) | `self.reading_panel` | area_checks:self |
| `self.sub.body_facts` | Self v2 S7: body facts (footing, wear, shape, live lords on body houses, live transits over lagna and Moon) | self | You board | Built | D1 (divisional), D30 (divisional), A6 (jaimini), primary clock (dasha), stored sky overlay (transit) | `self.sub` | area_checks:self |
| `self.sub.clock` | Self v2 S1: the primary dasha clock and its confirming clocks | self | You board | Built | dasha.applicable (dasha), all served systems (dasha) | `self.sub` | area_checks:self |
| `self.sub.mind_facts` | Self v2 S6: mind facts (feeling, thinking, peace, judgement, candidate patterns), evidence keys only | self | You board | Built | D1 (divisional), D9 (divisional), yogas (natal), star profile (nakshatra) | `self.sub` | area_checks:self |
| `self.sub.periods` | Self v2 S2: previous, running and next main period, running sub and sub-sub, charter relation, boundaries | self | You board | Built | primary clock L1-L3 (dasha), dasha charter (natal) | `self.sub` | area_checks:self |
| `self.sub.presence_facts` | Self v2 S8: presence facts (bearing, style, adornment, face, public vs private, best window, live care) | self | You board | Built | D1 (divisional), D9 (divisional), AL (jaimini), primary clock (dasha) | `self.sub` | area_checks:self |
| `self.sub.profile` | Self v2 S10: the person profile pack (age band, stated gender, role, facts, declined, confirms, mood) | self | You board | Built | none (person facts) (natal) | `self.sub` | area_checks:self |
| `self.sub.promise` | Self v2 S4: the promise ledger (gifts, knots, graces) from stored yoga and dosha rows and the charter flags | self | You board | Built | yogas (natal), doshas (natal), dasha charter (natal) | `self.sub` | area_checks:self |
| `self.sub.risk` | Self v2 S5: the risk ledger (what could go wrong, from where, from who, since, until, what holds it) | self | You board | Built | primary clock (dasha), stored sky overlay (transit), yogas (natal) | `self.sub` | area_checks:self |
| `self.sub.windows` | Self v2 S3: dated windows around today (degraded: activation and the stored sky overlay until kundli_pressure lands) | self | You board | Built | primary clock L1-L3 (dasha), stored sky overlay (transit), functional nature (natal) | `self.sub` | area_checks:self |
| `self.sub.year` | Self v2 S9: the year frame from the Tithi Pravesha year whose return moment has passed | self | You board | Built | Tithi Pravesha (annual), tithi pravesha dasha (annual), Varshaphal mudda (annual) | `self.sub` | area_checks:self |
| `self.transit` | Transits over houses 1, 4 and 5 with the Moon | self | You board | Built | Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga) | `area.self_board` | area_checks:self |
| `self.v2.body` | Self v2 area: Body & energy (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.chapter` | Self v2 area: This chapter (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.chapters` | Self v2 area: Chapters (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.diagnosis` | Self v2 area: In short (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.drive` | Self v2 area: Drive & ambition (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.hero` | You board v2: the hero (tone, one dated sentence, one question) | self | You board | Built | reading clock (dasha), windows around today (transit) | `self.personalizer` | area_checks:self |
| `self.v2.lagna` | Self v2 area: Who you are (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.mind` | Self v2 area: How you think (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.now` | Self v2 area: Right now (hero) (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.oracle` | You board v2: Oracle over the ledgers and the area briefs | self | You board | Built | D1 (natal), D9 (divisional), D10 (divisional), D30 (divisional), reading clock (dasha), year chart (annual), sky overlay (transit) | `self.oracle.v2`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky` | area_checks:self |
| `self.v2.personalizer` | You board v2: Personalizer cards for this person | self | You board | Built | reading clock (dasha), windows around today (transit) | `self.personalizer` | area_checks:self |
| `self.v2.presence` | Self v2 area: How you come across (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.stuck` | Self v2 area: Where you get stuck (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.year` | Self v2 area: This year (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v2.yogas` | Self v2 area: Gifts & knots (selection over the self.sub outputs into an AreaBrief) | self | You board | Built | self.sub outputs (natal) | `self.reading_panel` | area_checks:self |
| `self.v3.cards` | You board v3: span-led cards for the next twelve months | self | You board | Built | D1 (natal), D9 (divisional), reading clock (dasha), confirming clocks (dasha), year chart (annual), Saturn passage (transit) | `self.oracle.v3`, `self.personalizer` | area_checks:self |
| `self.varga` | Owning divisional chart of houses 1, 4 and 5 with the Moon | self | You board | Built | D1 (divisional), D9 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D4 (divisional), D7 (divisional), D60 (divisional) | `area.self_board` | area_checks:self |
| `love.activation` | Activation of house 7 by every dasha system | love | Love board | Built | Vimshottari (dasha), conditional (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), tithi pravesha dasha (annual), Yogini (dasha), Tithi Ashtottari (dasha), D9 (divisional), D7 (divisional), D30 (divisional) | `area.love_board` | area_checks:love |
| `love.affliction` | Afflictions on house 7 | love | Love board | Built | facts (natal), dignities (natal), aspects (natal), doshas (natal), avasthas (natal), house counts (natal) | `area.love_board` | area_checks:love |
| `love.annual` | This year's chart for house 7 | love | Love board | Built | Tithi Pravesha (annual), sahams (annual), mudda (annual), patyayini (annual), tithi pravesha dasha (annual) | `area.love_board` | area_checks:love |
| `love.health` | How the relationship is | love | Love board | Built | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | `area.love_board` | area_checks:love |
| `love.meet` | Meeting someone | love | Love board | Built | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | `area.love_board` | area_checks:love |
| `love.nakshatra` | Nakshatra charter of house 7 | love | Love board | Built | cusp nak (nakshatra), star lord (nakshatra), occupant stars (nakshatra) | `area.love_board` | area_checks:love |
| `love.promise` | Natal promise of house 7 | love | Love board | Built | facts (natal), house counts (natal), dignities (natal), aspects (natal), argala (jaimini), sav (ashtakavarga), strength.bhava (natal), yogas (natal), doshas (natal), arudhas (jaimini), avasthas (natal) | `area.love_board` | area_checks:love |
| `love.protection` | What protects house 7 | love | Love board | Built | aspects (natal), dignities (natal), argala (jaimini), yogas (natal), avasthas (natal), D9 (divisional), D7 (divisional), D30 (divisional) | `area.love_board` | area_checks:love |
| `love.reading.audit` | Love reading: the code auditor over the cards (board.auditor, Love instance) | love | Love board | Built | dossier rows (natal) | `love.reading_panel` | area_checks:love |
| `love.reading.bond` | Love reading: the bond itself (7th, 2nd, 4th, 8th, UL and its 2nd, D9, D7) | love | Love board | Built | D1 (divisional), D9 (divisional), D7 (divisional), arudhas (jaimini) | `love.reading_panel` | area_checks:love |
| `love.reading.chapters` | Love reading: your chapters for love (board.chapters filtered to the love houses) | love | Love board | Built | reading clock L1-L2 (dasha), confirming clocks L1 (dasha) | `love.reading_panel` | area_checks:love |
| `love.reading.circle` | Love reading: who else is in it (family, in-laws, friends, children as facts) | love | Love board | Built | D1 (divisional), D7 (divisional), charakaraka (jaimini) | `love.reading_panel` | area_checks:love |
| `love.reading.clock` | Love reading: the reading clock and confirming clocks (Love instance) | love | Love board | Built | kundli_activation (dasha) | `love.reading_panel` | area_checks:love |
| `love.reading.diagnosis` | Love reading: your love life, in short (three sentences from the Love panels and chapters) | love | Love board | Built | panel claims (natal) | `love.reading_panel` | area_checks:love |
| `love.reading.heart` | Love reading: how you love (Venus, Moon, 5th lord, D9 7th) | love | Love board | Built | D1 (divisional), D9 (divisional) | `love.reading_panel` | area_checks:love |
| `love.reading.oracle` | Love reading: AI family sub-agents, Love Lineman, and Love Oracle synthesis | love | Love board | Built | panel claims (natal), D1 (divisional), D9 (divisional), D7 (divisional), reading clock (dasha), Tithi Pravesha (annual), sky overlay (transit) | `love.reading_oracle`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.love` | area_checks:love |
| `love.reading.partner` | Love reading: the partner you draw (7th, its lord, DK, UL, A7, D9 7th) | love | Love board | Built | D1 (divisional), D9 (divisional), charakaraka (jaimini), arudhas (jaimini) | `love.reading_panel` | area_checks:love |
| `love.reading.purview` | Love reading: the whole-chart purview check (board.purview, Love instance) | love | Love board | Built | D1 (divisional), D9 (divisional), yogas (natal), reading clock (dasha) | `love.reading_panel` | area_checks:love |
| `love.reading.struggle` | Love reading: what tests it (board.struggle filtered to love) | love | Love board | Built | D1 (divisional), doshas (natal), reading clock L1-L3 (dasha) | `love.reading_panel` | area_checks:love |
| `love.reading.year` | Love reading: this year (board.year filtered to love) | love | Love board | Built | Tithi Pravesha (annual), varsha (annual) | `love.reading_panel` | area_checks:love |
| `love.reconcile` | Strain and reconciling | love | Love board | Built | facts (natal), D9 (divisional), Vimshottari (dasha), Transit contacts (transit) | `area.love_board` | area_checks:love |
| `love.transit` | Transits over house 7 | love | Love board | Built | Transit contacts (transit), Double transit (transit), Sade Sati (transit), eclipses (transit), transit ashtakavarga (ashtakavarga) | `area.love_board` | area_checks:love |
| `love.varga` | Owning divisional chart of house 7 | love | Love board | Built | D9 (divisional), D7 (divisional), D30 (divisional) | `area.love_board` | area_checks:love |
| `lucky.love.ask_out` | Ask someone out | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.love.clear_air` | Clear the air | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.love.first_date` | A first date | love | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `research.love_dashboard_qa` | Research Love Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year relationship zoom-in | love | Love board | Built | facts (natal), dignities (natal), aspects (natal), avasthas (natal), yogas (natal), doshas (natal), strength.shadbala (natal), sav (ashtakavarga), charakaraka (jaimini), arudhas (jaimini), argala (jaimini), janma (nakshatra), cusp nak (nakshatra), D1 (divisional), D9 (divisional), D10 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D2 (divisional), D4 (divisional), D7 (divisional), D60 (divisional), Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), Transit contacts (transit), Sade Sati (transit), muhurta (panchang) | `research.love_dashboard_builder` | staff |
| `lucky.money.invest_buy` | Invest or buy | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.ask_raise` | Ask for a raise | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.hard_talk_boss` | A hard talk with the boss | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.interview` | Interview or pitch | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.send_resume` | Send a resume or application | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.sign_contract` | Sign a contract | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `lucky.work.start_project` | Start a project | work | Lucky times | Built | tithi (panchang), nakshatra (panchang), weekday (panchang), hora (panchang), muhurta (panchang), kalams (panchang), yoga (panchang), karana (panchang) | `lucky.scenario_windows` | staff |
| `research.work_dashboard_qa` | Research Work Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year career zoom-in | work | Work board | Built | facts (natal), dignities (natal), aspects (natal), avasthas (natal), yogas (natal), doshas (natal), strength.shadbala (natal), sav (ashtakavarga), charakaraka (jaimini), arudhas (jaimini), argala (jaimini), janma (nakshatra), cusp nak (nakshatra), D1 (divisional), D9 (divisional), D10 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D2 (divisional), D4 (divisional), D7 (divisional), D60 (divisional), Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), Transit contacts (transit), Sade Sati (transit), muhurta (panchang) | `research.work_dashboard_builder` | staff |
| `work.annual_family` | This year's chart (annual family) | work | Work board | Built | Tithi Pravesha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D10 (divisional) | `area.career_inputs`, `area.career_map` | staff |
| `work.conditional_family` | Conditional clock | work | Work board | Built | applicable (dasha), conditional (dasha) | `area.career_inputs`, `area.career_map` | staff |
| `work.d10_check` | D1 and D10 agreement on each dasha vote | work | Work board | Built | D1 (divisional), D10 (divisional), D9 (divisional), D60 (divisional) | `area.career_inputs`, `area.career_map` | staff |
| `work.horizons` | Horizons (1, 3, 6, 12 months) | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `work.karaka_family` | Karaka clock | work | Work board | Built | karaka (dasha), chara karakas (jaimini), D10 (divisional) | `area.career_inputs`, `area.career_map` | staff |
| `work.looking_back` | Looking back | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | area_checks:career |
| `work.present_tone` | Present tone | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | area_checks:career |
| `work.reading.audit` | Work reading: the code auditor over the cards (board.auditor, Work instance) | work | Work board | Built | dossier rows (natal) | `work.reading_panel` | area_checks:work |
| `work.reading.chapters` | Work reading: your chapters for work (board.chapters filtered to the work houses) | work | Work board | Built | reading clock L1-L2 (dasha), confirming clocks L1 (dasha) | `work.reading_panel` | area_checks:work |
| `work.reading.clock` | Work reading: the reading clock and confirming clocks (Work instance) | work | Work board | Built | kundli_activation (dasha) | `work.reading_panel` | area_checks:work |
| `work.reading.diagnosis` | Work reading: your work life, in short (three sentences from the Work panels and chapters) | work | Work board | Built | panel claims (natal) | `work.reading_panel` | area_checks:work |
| `work.reading.gain` | Work reading: what it pays (11th, 2nd, D2, D10 11th, dhana yogas of the work lords) | work | Work board | Built | D1 (divisional), D2 (divisional), D10 (divisional), yogas (natal) | `work.reading_panel` | area_checks:work |
| `work.reading.ground` | Work reading: where the work is now (6th, 3rd, 7th, 12th, D10 6th and 3rd) | work | Work board | Built | D1 (divisional), D10 (divisional) | `work.reading_panel` | area_checks:work |
| `work.reading.oracle` | Work reading: AI family sub-agents, Work Lineman, and Work Oracle synthesis | work | Work board | Built | panel claims (natal), D1 (divisional), D9 (divisional), D10 (divisional), D2 (divisional), reading clock (dasha), Tithi Pravesha (annual), sky overlay (transit) | `work.reading_oracle`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.work` | area_checks:work |
| `work.reading.purview` | Work reading: the whole-chart purview check (board.purview, Work instance) | work | Work board | Built | D1 (divisional), D9 (divisional), D10 (divisional), yogas (natal), reading clock (dasha) | `work.reading_panel` | area_checks:work |
| `work.reading.standing` | Work reading: how you are seen (AL, A10, Sun, 10th lord, D10 lagna) | work | Work board | Built | D1 (divisional), D10 (divisional), arudhas (jaimini) | `work.reading_panel` | area_checks:work |
| `work.reading.struggle` | Work reading: what tests it (board.struggle filtered to work) | work | Work board | Built | D1 (divisional), avasthas (natal), reading clock L1-L3 (dasha) | `work.reading_panel` | area_checks:work |
| `work.reading.vocation` | Work reading: what you are built to do (10th, its lord, D10, AmK, the four karakas, karakamsa) | work | Work board | Built | D1 (divisional), D9 (divisional), D10 (divisional), charakaraka (jaimini) | `work.reading_panel` | area_checks:work |
| `work.reading.year` | Work reading: this year (board.year filtered to work) | work | Work board | Built | Tithi Pravesha (annual), varsha (annual) | `work.reading_panel` | area_checks:work |
| `work.security_grade` | Job security by month | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `work.subarea_windows` | Windows ahead by sub-area | work | Work board | Built | Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Transit contacts (transit), Double transit (transit), modifier (jaimini), house counts (natal), facts (natal) | `area.career_inputs`, `area.career_map` | staff |
| `digest.activation` | Activation calendar, thirty years ahead | general | General Reading chat | Built | all systems (dasha), applicable (dasha), facts (natal) | `digest.activation` | none |
| `digest.annual_set` | Annual set, ten years back and ahead | general | General Reading chat | Built | Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D9 (divisional), D10 (divisional) | `digest.annual_set` | none |
| `digest.build` | Kundli digest (the first-time breakdown) | general | General Reading chat | Built | dignities (natal), aspects (natal), argala (jaimini), arudhas (jaimini), house counts (natal), sav (ashtakavarga), facts (natal), avasthas (natal), strength.shadbala (natal), benefic malefic (natal), yogas (natal), doshas (natal), charakaraka (jaimini), sphutas (natal), Tithi Pravesha (annual), varsha (annual), janma (nakshatra), panchanga (natal) | `digest.build` | staff |
| `general.annual` | Annual set analyst | general | General Reading chat | Built | facts (natal), Tithi Pravesha (annual), tithi pravesha dasha (annual), varsha (annual), sahams (annual), mudda (annual), patyayini (annual), tajaka (annual) | `reading.analyst.annual` | staff |
| `general.clarify` | Clarify | general | General Reading chat | Built | — | `reading.clarify`, `reading.clarify_monitor` | staff |
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
| `life.dashboard` | Your life at a glance and long-term Mahadasha charter | general | Timeline | Built | digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit) | `life.dashboard` | none |
| `life.mahadasha_charter` | Remaining largest Mahadasha (10-18+ yrs) and Antardasha life charter | general | Timeline | Built | digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit) | `life.dashboard` | none |
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

### Research Self Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year zoom-in — `research.self_dashboard_qa`

**Built** · board: You board · accuracy: staff

**Reads:** facts (natal), dignities (natal), aspects (natal), avasthas (natal), yogas (natal), doshas (natal), strength.shadbala (natal), sav (ashtakavarga), charakaraka (jaimini), arudhas (jaimini), argala (jaimini), janma (nakshatra), cusp nak (nakshatra), D1 (divisional), D9 (divisional), D10 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D2 (divisional), D4 (divisional), D7 (divisional), D60 (divisional), Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), Transit contacts (transit), Sade Sati (transit), muhurta (panchang)

**Algorithm:**

1. Hydrate synthetic age-bracket (ages 18, 20, 24, 28, 30, 32, 36, 40, 48, 56) or profession/life-stage persona kundlis into isolated research_* staging tables (research_kundlis, research_chart_data, research_digests, research_activations) without touching customer auth or kundlis
2. Run the production Self board (buildBoard SELF, resolveAreaShades, buildCalmPlaybook) and build the complete 12-house D1 + 10-varga (D1, D9, D10, D20, D24, D12, D2, D4, D7, D60) deep-dive matrix for Self, Love, and Work charter alignment
3. Map the charter & vocation mission (Teacher, Business, Real Estate, Electrician/Trade, Finance, Software Engineer, College Student, Expectant/New Parent, Divorce Recovery, Unemployed/Health Recovery) from D1 1H/4H/5H/9H/10H, D9, D10, D24, AK/AmK, SAV, and cusp nakshatras
4. Zoom in temporally from the Tithi Pravesha / Varsha annual chart through Vimshottari MD -> AD -> PD -> Sookshma, Yogini, Tithi Ashtottari, Narayana, slow transits, and daily Tara/Chandra Bala across November, Thanksgiving Week (Nov 23-29), December, and New Year (Dec 28-Jan 5) by week (9 weeks) and by day (14-day strip)
5. Record the 10-step technical trace (exact digest keys pulled, what was excluded and why, Parashara/Jaimini/Sanjay Rath/Lunar Astro/Tajaka rules applied, combination weights, and plain-English Oracle reading prose)

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha or career work; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1, D9, D10, D20, D24, D12, D2, D4, D7, D60

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 houses 1..12<br>planet · D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 every planet<br>yoga · all yogas, doshas and cancellations<br>point · AK, AmK, DK, AL, UL, SL, HL, GL, K64M, K64L, KD22, BB<br>star · Moon star, lagna star, tara table, gandanta and pending karma<br>activation · every served system covering Nov-Jan and ±30 years (levels 1..4)<br>annual · TP and VP of the current and next year with year dashas and sahams<br>transit · Sa, Ju, Ra, Ke slow transits, sade sati, and daily tara/chandra bala overlay | house_card<br>planet_card<br>yoga_row<br>point_row<br>star_profile<br>activation_row<br>annual_row<br>transit_row | `none` | — | research_self_dashboard.v1 | `research.technical_verifier` |

**Source:** docs/admin/09 §4.1; docs/reading-engine/46 §B; 54 §3; 55 §2  
**Code:** `src/reading/research/selfDashboardQa.ts hydrateResearchSubject, buildSelfResearchDashboard`  
**Agents:** `research.self_dashboard_builder`

### Independent Technical Verifier Agent (8-gate classical & governance audit) — `research.technical_verifier`

**Built** · board: You board · accuracy: staff

**Reads:** facts (natal), dignities (natal), aspects (natal), avasthas (natal), yogas (natal), doshas (natal), strength.shadbala (natal), sav (ashtakavarga), charakaraka (jaimini), arudhas (jaimini), argala (jaimini), janma (nakshatra), cusp nak (nakshatra), D1 (divisional), D9 (divisional), D10 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D2 (divisional), D4 (divisional), D7 (divisional), D60 (divisional), Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), Transit contacts (transit), Sade Sati (transit), muhurta (panchang)

**Algorithm:**

1. Independently read the staged research_digests, research_activations, and generated Self Dashboard run (board_data, house_varga_matrix, temporal_data, trace_data, reading_prose)
2. Verify Gate 1 (D1 House & Lordship Integrity) and Gate 2 (Divisional Varga Agreement across D9, D10, D20, D24, D12, D2, D4, D7, D60)
3. Verify Gate 3 (Multi-Clock Dasha Convergence across 7 families and MD/AD/PD/Sookshma dates) and Gate 4 (Ashtakavarga SAV >= 28 / <= 22 & Shadbala ratio >= 1.0 bounds)
4. Verify Gate 5 (Yoga, Avastha & Neecha Bhanga / Jupiter Protection floor) and Gate 6 (Nakshatra Janma/Cusp Star & daily Tara/Chandra Bala consistency)
5. Verify Gate 7 (November, Thanksgiving Week, December, and New Year chronological continuity) and Gate 8 (SOUL.md Rule 0, 4-Tier Sattvic/Rajasic/Mediocre/Baseline Playbook, and zero banned engine names)
6. Compute the 0-100% accuracy score, pass/warn/fail verdict (pass >= RESEARCH_VERIFIER_PASS_SCORE, default 95%), passed check receipts, and any missed astrological factors

**Selected when:** board is you; subject is general life direction or health body or education learning or spirituality moksha; about houses 1, 4, 5, 9, 10, 12; in D1, D9, D10, D20, D24

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 houses 1..12<br>planet · D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 every planet<br>yoga · all yogas, doshas and cancellations<br>point · AK, AmK, DK, AL, UL, SL, HL, GL, K64M, K64L, KD22, BB<br>star · Moon star, lagna star, tara table, gandanta and pending karma<br>activation · every served system covering Nov-Jan and ±30 years (levels 1..4)<br>annual · TP and VP of the current and next year with year dashas and sahams<br>transit · Sa, Ju, Ra, Ke slow transits, sade sati, and daily tara/chandra bala overlay<br>findings · the 10-step technical trace and Self dashboard claims under audit | house_card<br>planet_card<br>yoga_row<br>point_row<br>star_profile<br>activation_row<br>annual_row<br>transit_row<br>findings_in | `none` | — | research_verifier_audit.v1 | — |

**Source:** docs/admin/09 §4.1.4; SOUL.md; BPHS ch. 6-7, 27, 34-41, 46-51, 66-72; Jaimini Upadesa Sutras  
**Code:** `src/reading/research/selfDashboardQa.ts verifySelfDashboardRun`  
**Agents:** `research.technical_verifier`

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

### Character evolution across 3 decades (Last 10 Years -> Who You Are Now -> Next 10 Years) — `self.character_arc`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** facts (natal), dignities (natal), D1 (divisional), D9 (divisional), D10 (divisional), charakaraka (jaimini), Vimshottari (dasha), Narayana (dasha)

**Algorithm:**

1. Compute three 10-year life windows relative to today (asOf) and the person age (Last 10 Years e.g. their 20s if 30, Who You Are Now, and Next 10 Years)
2. Anchor the core temperament from D1 Lagna, Lagna lord (Paka Lagna), D9 Navamsa maturation of L1 and Moon, Sun, and Atmakaraka (AK)
3. Select the dominant Vimshottari Mahadasha/Antardasha and Narayana Rasi Dasha lords covering each 10-year window from kundli_activation
4. Translate the ruling planet nature, D1/D9 dignity, and activated house themes into plain-language traits, growth lessons, and practical shifts with zero chart jargon on the surface

**Selected when:** board is you; subject is general life direction or education learning or spirituality moksha; about houses 1, 4, 5, 9, 10; in D1, D9, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D10 houses 1,4,5,9,10<br>planet · D1,D9,D10 cards of L1, Su, Mo, AK and running MD/AD lords<br>point · AK, AmK, AL<br>activation · vimshottari and rasi periods from -10 years to +10 years | house_card<br>planet_card<br>point_row<br>activation_row | `none` | — | self_character_arc.v1 | — |

**Source:** BPHS Ch. 46-51 (Vimshottari Dasha Phala); Sanjay Rath Crux of Vedic Astrology (Lagna, Paka Lagna & D9 Maturation)  
**Code:** `src/reading/area/selfCharacterAndJoy.ts buildSelfCharacterArc; houseLayers.ts buildBoard`  
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

### Vedic Moon & Mercury personality and what brings joy & fulfillment — `self.personality_joy`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** facts (natal), dignities (natal), aspects (natal), D1 (divisional), D9 (divisional), D24 (divisional), janma (nakshatra)

**Algorithm:**

1. Read the Moon (Chandra: Manas) in D1 and D9: sign, house, dignity, Janma Nakshatra (StarProfile.moonStar), benefic/malefic drishti, and the 4th house (Sukha Bhava) to map emotional rhythm and what restores inner peace
2. Read Mercury (Budha: Buddhi, play, wit & curiosity) in D1, D9, and D24: sign, house, dignity, and aspects alongside the 5th house (creative joy) and 3rd house (hands-on craft) to map conversational style and intellectual flow
3. Synthesize four plain-language joy & fulfillment pillars: Everyday Joy & Flow (Moon + 4H), Mind, Curiosity & Play (Mercury + 5H), Social & Creative Recharge (3H + 11H + Moon/Mercury), and Restorative Sanctuary (D9 Moon + 4H/12H)
4. Keep all astrological identifiers inside structured evidence[] while rendering 100% digested plain English on the board

**Selected when:** board is you; subject is general life direction or education learning or health body; about houses 1, 3, 4, 5, 11, 12; in D1, D9, D24

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D24 houses 1,3,4,5,11,12<br>planet · D1,D9,D24 cards of Mo, Me, L4, L5, L3, Ju, Ve<br>star · Moon star, lagna star and tara table | house_card<br>planet_card<br>star_profile | `none` | — | self_personality_joy.v1 | — |

**Source:** BPHS Ch. 3, 15-16 (Chandra & Budha Karakatvas, 4H Sukha & 5H Buddhi); Taittiriya Brahmana (Janma Nakshatra)  
**Code:** `src/reading/area/selfCharacterAndJoy.ts buildSelfPersonalityAndJoy; houseLayers.ts buildBoard`  
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

### You reading: Your soul aim (atmakaraka, karakamsa, Sun, Jupiter, 9th and 12th houses) — `self.reading.atma`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** charakaraka (jaimini), D1 (divisional), D9 (divisional), avasthas (natal)

**Algorithm:**

1. pointOf D1 AK: the karaka planet (PointRow.planet); planetChain of that planet: house, dignity, ripeness, shadbala rank
2. pointOf D9 AK: its sign is the karakamsa and its house is counted from the D9 lagna by the engine; D9 planets in that sign
3. The Sun when it is not the AK; planetChain Ju (judgement and faith); houseFrame D1 h9 (purpose) and h12 (letting go)
4. Withheld with a gap when the AK planet is not stored (digest built before 2026-11-07)

**Selected when:** board is you; subject is general life direction; about houses 1, 9, 12; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| point · D1 and D9 AK<br>planet · D1 cards of the AK planet, Su and Ju; D9 cards in the karakamsa sign<br>house · D1 h9, h12 | point_row<br>planet_card<br>house_card | `none` | — | self_panel.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/atma.ts atmaPanel`  
**Agents:** `self.reading_panel`

### You reading: the code auditor over the cards (board.auditor, code half) — `self.reading.audit`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** dossier rows (natal)

**Algorithm:**

1. Every card line: at most 22 words, a range, claim ids that exist and were not vetoed, evidence keys that resolve to stored rows
2. Every date in a line equals a stored period boundary of the activation calendar or the year chart; no banned chart, body, lifetime or doom word
3. A failing line leaves the card; the verdict is fail when any line failed; the result is stored in the dossier

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the cards and claims of the build | findings_in | `none` | — | code_audit.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/audit.ts auditCards`  
**Agents:** `self.reading_panel`

### You reading: Your body (what the chart and the sky put on the body; facts only) — `self.reading.body`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), D30 (divisional), dignities (natal), benefic malefic (natal), reading clock L1-L2 (dasha), sky overlay when stored (transit)

**Algorithm:**

1. Footing: the lagna lord dignity and the Sun dignity (D1 cards)
2. Now: the reading clock running sub-period or main-period lord sitting in or activating houses 6 or 8, with its end date
3. Pressed: natural and functional malefics on or aspecting the 1st; wear: where the 6th lord sits
4. Shape: the planet on the D30 1st (occupant, else lord) to one of four shapes from BODY_WORDS (heat, dryness, heaviness, fluids), undated
5. Never an illness, organ, symptom, treatment or doctor; a sensitive passage keeps only the rest line; the stored sky is read when present, else a gap

**Selected when:** board is you; subject is general life direction; about houses 1, 6, 8; in D1, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h1, h6, h8; D30 h1<br>planet · D1 cards of L1, Su and malefics on h1<br>activation · reading clock L1-L2 running | house_card<br>planet_card<br>activation_row | `none` | — | self_panel.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/body.ts bodyPanel`  
**Agents:** `self.reading_panel`

### You reading: Your chapters (previous, running and next main period of the reading clock, the running sub-period, confirmed by other clocks) — `self.reading.chapters`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** reading clock L1-L2 (dasha), Vimshottari (dasha), Narayana (dasha), Chara (dasha), Yogini (dasha), karaka (dasha), Tithi Ashtottari (dasha), avasthas dasha_charter (natal)

**Algorithm:**

1. mdSpine of the reading clock: previous, running, next level-1 periods; the running and next level-2 periods
2. Words from the houses kundli_activation says each period activates, and the lord D1 card (faculty, house)
3. Sub-chapter flavour: the engine fruition class of the sub lord from the main lord (dasha_charter), with its 2/12 and 6/8 flags
4. Confirmation: a confirming clock agrees when one of its level-1 periods starts within SELF_CHAPTER_BOUNDARY_MONTHS of the chapter start; confirmed at SELF_CHAPTER_CONFIRM_MIN, likely at 1, split at 0 (sentence withheld, dates kept)

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · reading clock levels 1-2 and confirming clocks level 1, life span<br>planet · D1 cards of the chapter lords | activation_row<br>planet_card | `none` | — | self_panel.v1 | `self.reading.diagnosis` |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/chapters.ts chaptersPanel, confirmShift; slices.ts mdSpine, mainStarts`  
**Agents:** `self.reading_panel`

### You reading: the reading clock (preferred, applicable or default dasha system, and the confirming clocks) — `self.reading.clock`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** dasha.applicable (dasha), all served systems (dasha)

**Algorithm:**

1. Read kundlis.preferred_dasha and the distinct systems with their family in kundli_activation
2. Use the preferred system when it has periods; else the first system of SELF_CLOCK_CONDITIONAL_ORDER that the engine marked applicable (family conditional); else vimsottari
3. Confirming clocks: SELF_CONFIRM_SYSTEMS minus the reading clock, kept only when periods exist

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · systems present and their family (conditional = engine says applies) | activation_row | `none` | — | self_clock.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/clock.ts resolveClock; service.ts getSelfReading`  
**Agents:** `self.reading_panel`

### You reading: Who you are, in short (three sentences built from the other panels, shown first) — `self.reading.diagnosis`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** panel claims (natal)

**Algorithm:**

1. Built last from the claims of self.reading.lagna, struggle, yogas and chapters; adds no fact
2. Sentence 1, direction and footing: the lagna panel lead and the lagna lord state
3. Sentence 2, the central tension: a struggle the reading clock is running now (it has a release date), else the first knot, else the first struggle
4. Sentence 3, where you stand now: the running chapter and sub-chapter with their dates
5. Every sentence cites its source claims as claim:<id>; a "no" to it withholds them too; the confirm question asks about sentence 2

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · claims of self.reading.lagna, struggle, yogas, chapters | findings_in | `none` | — | board_diagnosis.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/diagnosis.ts diagnosisPanel, tensionSource (board.diagnosis, Self instance)`  
**Agents:** `self.reading_panel`

### You reading: Who you are (1st house, lagna lord, arudha lagna, rising star, Moon lagna, D9 lagna) — `self.reading.lagna`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), D9 (divisional), dignities (natal), aspects (natal), avasthas (natal), arudhas (jaimini), cusp star (nakshatra)

**Algorithm:**

1. houseFrame D1 h1: sign, lord, occupants, graha and rasi drishti, SAV, cusp star
2. planetChain of the lagna lord: D1 house (where the self is lived), dignity and avastha ripeness (how it is held), conjunctions; D9 card
3. Claims: lord_house, lord_state, lord_company, on_self (occupants; graha drishti split into helped / pressed by the engine functional nature), star (cusp star lord), seen (AL house), seen_fit (lagna-to-AL from the engine label of the AL house), moon_lagna (the D1 house the Moon occupies, read as a frame), inner (D9 h1 lord house)
4. A missing field drops its claim and records a gap; no default value is ever printed

**Selected when:** board is you; subject is general life direction; about houses 1; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h1, the D1 house the Moon occupies, D9 h1<br>planet · D1 and D9 cards of the lagna lord; D1 cards of planets aspecting h1 and of the Moon<br>point · D1 AL | house_card<br>planet_card<br>point_row | `none` | — | self_panel.v1 | `self.reading.diagnosis` |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/lagna.ts lagnaPanel; slices.ts planetChain, houseFrame, pointOf`  
**Agents:** `self.reading_panel`

### You reading: Your mind (Moon, Mercury, 3rd, 4th and 5th houses) — `self.reading.mind`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), D9 (divisional), dignities (natal), yogas (natal), Moon star (nakshatra), sav (ashtakavarga)

**Algorithm:**

1. planetChain Mo: house, dignity (with a cancellation row lifting debility), conjunctions and aspects, star lord
2. planetChain Me (thinking): house and dignity
3. houseFrame D1 h3 (courage and effort), h4 (what peace depends on, SAV against the chart mean), h5 (intelligence): where each lord sits, occupants
4. Moon yogas (BG-07): the engine rows for Sunapha, Anapha, Durudhara and Kemadruma when present; Durudhara is worded over Sunapha and Anapha
5. pointOf D1 A4 (home and peace as seen) and A5 (ideas as seen): the house the engine counts from the lagna

**Selected when:** board is you; subject is general life direction; about houses 3, 4, 5; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 and D9 cards of Mo, Me<br>house · D1 h3, h4, h5 and every D1 house (sav column)<br>yoga · cancellation rows naming Mo; the Moon yoga rows<br>point · D1 A4, A5 | planet_card<br>house_card<br>yoga_row<br>point_row | `none` | — | self_panel.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/mind.ts mindPanel`  
**Agents:** `self.reading_panel`

### You reading: AI family sub-agents, Self Lineman, and Self Oracle synthesis — `self.reading.oracle`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** panel claims (natal), D1 (divisional), D9 (divisional), D10 (divisional), D30 (divisional), reading clock (dasha), Tithi Pravesha (annual), sky overlay (transit)

**Algorithm:**

1. Slices the stored kundli_digest, kundli_activation, and stored sky overlay into five structured chart family packs (family.rasi D1, family.varga D2-D60, family.dasha reading clock & 9x9 fruition charter, family.year Tithi Pravesha/Varsha, and family.sky slow transits)
2. Runs the five family AI sub-agents with Gemini cachedContents prefix caching (immutable chart pack in parts[0], dynamic horizon suffix in parts[1]) and cross-Lambda reading_findings_cache persistence to extract afflictions, malefics, graces, varga agreements, and what helps, delays, or delivers the running Mahadasha promise and when
3. Compiles the family sub-agent findings, the nine deterministic Self panel claims, the whole-chart purview rules, and the confirmed self.confirm.* facts through the Self Lineman AI agent (lineman.self) into a unified brief
4. Synthesizes the personalized You reading through the Self Oracle prompt (oracle/self.md), stores the output in technique_outputs, and validates every cited evidence key against the stored chart keys under the $1.00 spend guard

**Selected when:** board is you; subject is general life direction

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and divisional house cards 1..12<br>planet · D1 and divisional planet cards with avasthas and dasha_charter<br>yoga · D1 yogas, doshas, and cancellations<br>point · D1/D9 chara karakas, arudha padas, and Lunar Astro points<br>star · Moon star, lagna star, gandanta, and pending karma houses<br>annual · running Tithi Pravesha and Varsha annual charts<br>activation · reading clock L1-L3 and confirming clocks L1 | house_card<br>planet_card<br>yoga_row<br>point_row<br>star_profile<br>annual_row<br>activation_row | `src/reading/prompts/oracle/self.md` | FACTS, TODAY | self_reading.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas); docs/reading-engine/63 §4.1  
**Code:** `src/reading/self/oracle.ts runSelfOracle, runFamilySubAgents, runSelfLineman`  
**Agents:** `self.reading_oracle`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.self`

### You reading: the whole-chart purview check (board.purview, Self instance) — `self.reading.purview`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), D9 (divisional), yogas (natal), reading clock (dasha), gandanta (nakshatra)

**Algorithm:**

1. Runs over the full digest and the reading clock after the panels: lagna lord standing, cancellations, combustion and retrograde, functional nature by lagna, vargottama, gandanta, dasha applicability, MD-AD 6/8 and 2/12, the stored sky, the sensitive core
2. Each rule returns override, veto or annotate with its source and rows; a vetoed claim leaves the card and stays under Chart details

**Selected when:** board is you; subject is general life direction; about houses 1; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · claims of every Self panel<br>planet · D1 and D9 cards of L1, Mo, Su, AK<br>yoga · cancellation rows<br>activation · reading clock running | findings_in<br>planet_card<br>yoga_row<br>activation_row | `none` | — | purview.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/purview.ts runPurview, applyPurview`  
**Agents:** `self.reading_panel`

### You reading: What you struggle with (afflictions on the self with release dates from the reading clock) — `self.reading.struggle`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), dignities (natal), avasthas (natal), benefic malefic (natal), house counts (natal), reading clock L1-L3 (dasha)

**Algorithm:**

1. Lagna lord in a house the engine classes dusthana
2. Lagna lord, Mo, Su or AK debilitated (a cancellation row noted) or with avastha ripeness unripe or dried seed
3. A natural and functional malefic on or aspecting h1, with or aspecting the Moon, or in h5; the h4 lord in a dusthana
4. Release: when the named planet is a running lord of the reading clock, the end date of that stored period; those come first; at most 6 claims

**Selected when:** board is you; subject is general life direction; about houses 1, 4, 5; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards of L1, Mo, Su, AK and the malefics named<br>house · D1 h1, h4, h5 (class column)<br>activation · reading clock levels 1-3 covering today | planet_card<br>house_card<br>activation_row | `none` | — | self_panel.v1 | `self.reading.diagnosis` |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/struggle.ts strugglePanel; slices.ts runningChain`  
**Agents:** `self.reading_panel`

### You reading: This year (the Tithi Pravesha year; Varsha confirms) — `self.reading.year`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** Tithi Pravesha (annual), tithi pravesha dasha (annual), varsha (annual), mudda (annual)

**Algorithm:**

1. Tithi Pravesha led (doc 66 §4.10): runningTithiPravesha picks the TP D1 row whose return moment has passed (tp_start ≤ the person's local now < tp_end; before the return of this year the previous year's TP is in force; never the calendar birthday, never the Varsha year in its place)
2. That TP D1 row: the house holding the natal lagna lord and its dignity there, its company; the year h1 lord house; claims range over the TP year
3. The TP year dasha period covering today is the short clock, only when the engine bounds it to the year (no rescaling in Node); the Varsha Mudda period is named in the detail as confirmation only
4. Withheld (gap) when no TP year covers today; tp_start not stored falls back to a bounded TP year-dasha span with a gap

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP D1 rows with tp_start/tp_end (or valid_from/valid_to) and the TP year dasha; VP D1 Mudda of today | annual_row | `none` | — | self_panel.v1 | — |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/year.ts yearPanel; src/reading/annual/tithiPravesha.ts runningTithiPravesha`  
**Agents:** `self.reading_panel`

### You reading: Gifts and knots (yogas and doshas on the self) — `self.reading.yogas`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** yogas (natal), doshas (natal)

**Algorithm:**

1. yogasTouching: present D1 yoga and dosha rows naming the lagna lord, Mo, Su or the AK planet, or houses 1, 4, 5, 9; one row per name
2. Gift or knot from the engine class (raja, dhana, viparita, cancellation are gifts; dosha and affliction are knots); gifts first; a manglik row only when it touches house 1
3. Ranking (BG-09): within gifts and within knots, by the mean of the stored avasthaMultipliers.effective, raised by half when a planet is the running main or sub period lord of the reading clock

**Selected when:** board is you; subject is general life direction; about houses 1, 4, 5, 9; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| yoga · D1 rows naming L1, Mo, Su, AK or houses 1,4,5,9 | yoga_row | `none` | — | self_panel.v1 | `self.reading.diagnosis` |

**Source:** docs/reading-engine/58; BPHS (lagna, lords, karakatva, avasthas ch. 45); Jaimini (chara karakas, karakamsa, arudha lagna); PVR Narasimha Rao, Integrated Approach (dasha delivery, conditional dashas)  
**Code:** `src/reading/self/panels/yogas.ts yogasPanel; slices.ts yogasTouching`  
**Agents:** `self.reading_panel`

### Self v2 S7: body facts (footing, wear, shape, live lords on body houses, live transits over lagna and Moon) — `self.sub.body_facts`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), D30 (divisional), A6 (jaimini), primary clock (dasha), stored sky overlay (transit)

**Algorithm:**

1. footing: h1, lagna lord, Sun; wear: h6, h8, Mars, Saturn, A6; shape: D30 h1, Moon (evidence keys; a missing row is a gap)
2. liveLords: the running L1-L3 periods of the primary clock whose stored activation houses include SELF_V2_BODY_HOUSES
3. liveTransits: S3 live overlay rows of SELF_V2_BODY_TRANSIT_PLANETS with stored house_from_lagna or house_from_moon 1, and Sade Sati
4. sensitive: the engine flag only; none is stored, so false with a gap

**Selected when:** board is you; subject is general life direction; about houses 1, 6, 8; in D1, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h1, h6, h8; D30 h1<br>planet · D1 lagna lord, Su, Mo, Ma, Sa<br>point · D1 A6<br>activation · running L1-L3 periods of the primary clock on SELF_V2_BODY_HOUSES<br>transit · S3 live overlay rows over lagna and Moon (read from the build context) | house_card<br>planet_card<br>point_row<br>activation_row<br>transit_row | `none` | — | self_v2.body_facts | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/body.ts subBodyFacts`  
**Agents:** `self.sub`

### Self v2 S1: the primary dasha clock and its confirming clocks — `self.sub.clock`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** dasha.applicable (dasha), all served systems (dasha)

**Algorithm:**

1. Read kundlis.preferred_dasha and the systems present in kundli_activation with their family (defaultSystemsPresent: a conditional system the engine does not mark applicable comes back as family other)
2. resolveClock: the preferred system when it has periods, else the first SELF_CLOCK_CONDITIONAL_ORDER system of family conditional (reason conditional_applies), else vimsottari (default)
3. confirming = SELF_CONFIRM_SYSTEMS present, minus the primary; applicable = every present system whose family is not other; notApplicable = the rest, reason not_marked_applicable_by_engine

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · systems present and their family; dasha.applicable | activation_row | `none` | — | self_v2.clock_resolution | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/clock.ts subClock; src/reading/self/clock.ts resolveClock`  
**Agents:** `self.sub`

### Self v2 S6: mind facts (feeling, thinking, peace, judgement, candidate patterns), evidence keys only — `self.sub.mind_facts`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), D9 (divisional), yogas (natal), star profile (nakshatra)

**Algorithm:**

1. feeling: Moon D1 and D9 cards, the star profile, D1 yoga rows naming the Moon; thinking: Mercury D1 and D9, the 5th; peace: the 4th and its lord card; judgement: the 5th lord card and Jupiter
2. candidatePatterns: the stored D1 house of each SELF_V2_MIND_PATTERN_PLANETS planet, and every planet in the Moon card aspectedBy
3. A missing card or house is a gap, never a default; the Oracle names the pattern

**Selected when:** board is you; subject is general life direction; about houses 4, 5; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1/D9 Moon, Mercury, Jupiter, Rahu, Saturn, Ketu, 4th and 5th lords<br>house · D1 h4, h5<br>yoga · D1 yogas naming the Moon<br>star · star profile | planet_card<br>house_card<br>yoga_row<br>star_profile | `none` | — | self_v2.mind_facts | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/mind.ts subMindFacts`  
**Agents:** `self.sub`

### Self v2 S2: previous, running and next main period, running sub and sub-sub, charter relation, boundaries — `self.sub.periods`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** primary clock L1-L3 (dasha), dasha charter (natal)

**Algorithm:**

1. mdSpine and runningChain over the stored activation rows of the primary clock at asOf: previous, running and next level-1 period, the running level-2 and level-3 period
2. subRelation: the main lord D1 card dashaCharter.fruition[sub lord] as the engine stored it: 6/8 when isShadAshtaka68, 2/12 when isDwirdwadasha212, else its fruitionClass; null and a gap when not stored (rasi clocks have none)
3. boundaries: the from/to of the three main periods, of every sub period of the running main period and of the running sub-sub period, de-duplicated, sorted
4. No running level-1 period: the frame is null and a gap is recorded

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · primary clock L1-L2 over the life, L3 asOf ±12 months<br>planet · D1 card of the main lord (dasha_charter) | activation_row<br>planet_card | `none` | — | self_v2.period_frame | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/periods.ts subPeriods, charterRelation; slices.ts mdSpine, runningChain`  
**Agents:** `self.sub`

### Self v2 S8: presence facts (bearing, style, adornment, face, public vs private, best window, live care) — `self.sub.presence_facts`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (divisional), D9 (divisional), AL (jaimini), primary clock (dasha)

**Algorithm:**

1. bearing: h1 and the lagna lord; style: planets the h1 card lists as occupants and graha drishti; adornment: Venus D1 and D9; face: h2; publicVsPrivate: AL, Moon, h4
2. bestWindow: the most recent completed L1 or L2 period of the primary clock whose lord is in SELF_V2_PRESENCE_PLANETS or is the lagna lord
3. liveCare: the running sub period when its lord is one of them

**Selected when:** board is you; subject is general life direction; about houses 1, 2, 4; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h1, h2, h4<br>planet · D1/D9 Venus, lagna lord, Moon<br>point · D1 AL<br>activation · primary clock L1-L2 | house_card<br>planet_card<br>point_row<br>activation_row | `none` | — | self_v2.presence_facts | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/presence.ts subPresenceFacts`  
**Agents:** `self.sub`

### Self v2 S10: the person profile pack (age band, stated gender, role, facts, declined, confirms, mood) — `self.sub.profile`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** none (person facts) (natal)

**Algorithm:**

1. loadProfilePack: auth (birth date, gender, role) and person_facts in two reads
2. Age is calendar arithmetic over the typed birth date, banded by SELF_AGE_BANDS; gender null when not stated; declined keys listed; the last five confirm answers; the mood of today only; a stable hash

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| person · auth (birth date, gender, role) and person_facts of the user | person_pack | `none` | — | self_v2.profile_pack | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/profile.ts subProfile; src/reading/person/profile.ts loadProfilePack`  
**Agents:** `self.sub`

### Self v2 S4: the promise ledger (gifts, knots, graces) from stored yoga and dosha rows and the charter flags — `self.sub.promise`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** yogas (natal), doshas (natal), dasha charter (natal)

**Algorithm:**

1. Each D1 yoga/dosha row (varga rows left out): kind from its stored class through PROMISE_KIND_BY_CLASS (cancellation grace; dosha, affliction knot; raja, mahapurusha, dhana, viparita gift); rows with no such class are left out with a gap
2. Duplicates by name and kind are dropped; matter = SELF.matters of the first stored house, who = SELF.people of every stored house; evidence = the yoga key and its planets
3. A knot whose stored dosha details say hasExceptions adds a grace that cancels it
4. A planet whose D1 dashaCharter isYogi adds a gift, isAvayogi a knot, on the matter of its stored house; strength 2 (the engine stores no grade) with a gap

**Selected when:** board is you; subject is general life direction; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| yoga · D1 yogas and doshas with class and details<br>planet · D1 cards (house, owns, dasha_charter yogi flags) | yoga_row<br>planet_card | `none` | — | self_v2.promise_ledger | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/promise.ts subPromise; src/reading/self/v2words.ts PROMISE_KIND_BY_CLASS, SELF_MATTERS, SELF_PEOPLE`  
**Agents:** `self.sub`

### Self v2 S5: the risk ledger (what could go wrong, from where, from who, since, until, what holds it) — `self.sub.risk`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** primary clock (dasha), stored sky overlay (transit), yogas (natal)

**Algorithm:**

1. Join of S2, S3 and S4 only: every S3 row live at asOf whose polarity presses and that has a planet and stored houses
2. matter = its first matter; what = RISK_WHAT[planet]; from = planet, first stored house, window id and the yoga id of an S4 knot naming the same planet; who = SELF.people of its houses
3. since/until = the window dates where stored; holds = S4 graces naming the same planet or cancelling that knot
4. top3 = the three rows with the highest engine strength, then the soonest until
5. An engine annual row (the Tithi Pravesha year) that presses on a matter is a risk row like any other, with from.chart = year

**Selected when:** board is you; subject is general life direction; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · S2 periods and S3 primary-clock rows live at asOf (read from the build context)<br>transit · S3 stored sky overlay rows live at asOf (read from the build context)<br>yoga · S4 knots and graces naming the same planet (read from the build context) | activation_row<br>transit_row<br>yoga_row | `none` | — | self_v2.risk_ledger | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/risk.ts subRisk; src/reading/self/v2words.ts RISK_WHAT`  
**Agents:** `self.sub`

### Self v2 S3: dated windows around today (degraded: activation and the stored sky overlay until kundli_pressure lands) — `self.sub.windows`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** primary clock L1-L3 (dasha), stored sky overlay (transit), functional nature (natal)

**Algorithm:**

1. Rows: every primary-clock activation row overlapping asOf ±36 months (matters from its stored houses through SELF.matters) and the sky overlay ingresses of SELF_V2_WINDOW_TRANSIT_PLANETS (house_from_lagna, house_from_moon as stored), Sade Sati and dhaiya spans
2. Polarity: the period lord D1 card functional label through FUNCTIONAL_POLARITY (malefic presses, benefic supports, neutral mixed); transits and sign periods mixed; strength 2 for every row (the engine stores no grade); degraded true with gaps
3. strip = rows overlapping asOf ±6 months; heaviestNow = the live pressing row by strength then soonest end; easesAt = its end when stored; nextSupportFrom = the first supporting row starting after asOf
4. startedLast12m = rows that started in the last 12 months; endingNext6m = rows ending in the next 6 months; byMatter groups the strip; since/until only where the stored row has them
5. Engine calc_version 2: pressure_inventory kind annual rows (the Tithi Pravesha year window with its year lord and the houses the year lagna activates; level-2 year periods) and kind return rows (Saturn and Jupiter returns) are windows too, kept in degraded mode as well since they hold on every clock

**Selected when:** board is you; subject is general life direction; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · primary clock L1-L3 asOf ±36 months<br>transit · stored sky overlay covering asOf<br>planet · D1 functional nature of period lords | activation_row<br>transit_row<br>planet_card | `none` | — | self_v2.window_set | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/windows.ts subWindows, windowRows`  
**Agents:** `self.sub`

### Self v2 S9: the year frame from the Tithi Pravesha year whose return moment has passed — `self.sub.year`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** Tithi Pravesha (annual), tithi pravesha dasha (annual), Varshaphal mudda (annual)

**Algorithm:**

1. Tithi Pravesha led (doc 66 §4.10): runningTithiPravesha picks the TP D1 row whose return moment has passed (tp_start ≤ the person's local now < tp_end; before the return of this year the previous year's TP is in force; never the calendar birthday, never the Varsha year in its place); from/to = the TP year (tp_start -> tp_end), tpStart/tpEnd the exact moments when stored
2. yearLagna = the TP row lagna; yearLord = the TP row year lord when stored, else the engine annual pressure row (level 1) covering today; null with a gap otherwise
3. shortClock = the TP year dasha period covering today, only when the engine bounds that dasha to the year; confirmClock = the Varsha Mudda period covering today (confirms only)
4. No TP year covers asOf (or tp_start not stored and no bounded TP year dasha covers it): noCoverage true; the Varsha year is never used in its place

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · TP D1 rows with tp_start/tp_end (or valid_from/valid_to) and the TP year dasha; VP D1 Mudda; pressure_inventory annual rows | annual_row | `none` | — | self_v2.year_frame | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/sub/year.ts subYear; src/reading/annual/tithiPravesha.ts runningTithiPravesha`  
**Agents:** `self.sub`

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

### Self v2 area: Body & energy (selection over the self.sub outputs into an AreaBrief) — `self.v2.body`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): footing, wear and shape keys, live lords on body houses, live transits, ledger rows on body, work load and the sudden
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon live_plus_standing; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.body

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context)<br>transit · self.sub.windows sky rows (build context) | planet_card<br>activation_row<br>transit_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/body.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: This chapter (selection over the self.sub outputs into an AreaBrief) — `self.v2.chapter`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): running sub period, its charter relation to the main lord, non-mixed strip windows inside it, the live ledger rows
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon sub_period; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.chapter

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context) | planet_card<br>activation_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/chapter.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: Chapters (selection over the self.sub outputs into an AreaBrief) — `self.v2.chapters`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): previous, running and next main period, running sub period, L1/L2 boundaries inside the running main period
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon chapter; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.chapters

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context) | planet_card<br>activation_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/chapters.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: In short (selection over the self.sub outputs into an AreaBrief) — `self.v2.diagnosis`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): bearing keys, the ledger top row, running main and sub period
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon sub_period; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.diagnosis

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context) | planet_card<br>activation_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/diagnosis.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: Drive & ambition (selection over the self.sub outputs into an AreaBrief) — `self.v2.drive`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): promise entries, ledger rows and live non-mixed windows on effort, career, gains, money and ideas
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always_plus_live; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.drive

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context) | planet_card<br>activation_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/drive.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### You board v2: the hero (tone, one dated sentence, one question) — `self.v2.hero`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** reading clock (dasha), windows around today (transit)

**Algorithm:**

1. The Personalizer writes the tone (demanding, heavy, mixed, easing, steady or open), one sentence naming the life area and the date it changes, and one yes-or-no question on the strongest dated claim of the live areas
2. Code fills the six-month window strip, the easing date and the next check from the stored windows
3. The question is kept only when its claim id is in the Oracle document; the hero is withheld when the live areas are missing, all only possible, or split between strong and possible

**Selected when:** board is you; subject is general life direction

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · the six-month window strip and the easing date (S3) | activation_row | `src/reading/prompts/personalizer/self.md` | TODAY, FACTS | self_v2_hero.v1 | — |

**Source:** docs/reading-engine/66 §4.1, §4.8; BPHS (lordship, dignity, avasthas, dasha-lord rules); Jaimini (karakas, arudhas); SOUL.md four tiers  
**Code:** `src/reading/self/v2/personalizerValidate.ts validateHero, heroSplit`  
**Agents:** `self.personalizer`

### Self v2 area: Who you are (selection over the self.sub outputs into an AreaBrief) — `self.v2.lagna`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): bearing and public/private keys, promise entries on self_and_body
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.lagna

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context) | planet_card<br>activation_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/lagna.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: How you think (selection over the self.sub outputs into an AreaBrief) — `self.v2.mind`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): feeling, thinking, peace and judgement keys, candidate patterns, promise entries and ledger rows on ideas and home
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always_plus_live; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.mind

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context) | planet_card<br>activation_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/mind.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: Right now (hero) (selection over the self.sub outputs into an AreaBrief) — `self.v2.now`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): heaviest live window, eases date, next support, six-month strip (non-mixed rows), running sub-sub period, the ledger top3
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon six_months_each_way; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.now

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context)<br>transit · self.sub.windows sky rows (build context)<br>person · self.sub.profile confirms (build context) | planet_card<br>activation_row<br>transit_row<br>person_pack | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/now.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### You board v2: Oracle over the ledgers and the area briefs — `self.v2.oracle`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (natal), D9 (divisional), D10 (divisional), D30 (divisional), reading clock (dasha), year chart (annual), sky overlay (transit)

**Algorithm:**

1. Builds every agent slice from the build context and the rows the sub-techniques loaded (no database read): the five family packs (family.sky padded past 1,024 tokens with its window rows) and the Oracle prefix (the family.rasi and family.varga natal packs plus the whole promise ledger), stable per digest version
2. Warms every prefix in parallel in the explicit cache before the first agent call; each region has its llm_cache_entries row and the 45-minute recycler is informed after each call
3. Runs the five family readers in parallel, read through reading_findings_cache
4. Runs the Oracle as three parallel calls of three or four areas each over the same cached prefix, the suffix carrying the clock, periods, windows summary, the twelve heaviest risk-ledger rows, the eight strongest promise entries, the mind, body, presence and year facts, the eleven area briefs, the family findings and the confirms
5. Merges the three JSON documents and validates them with the area validator: every evidence key from the input (claim ids keep their claim: prefix), every date inside a period, window or year span the input carries, caps; up to three patterns for mind and stuck
6. Stores only a complete, validated document in technique_outputs, keyed by digest version, clock, boundary stamps, input hash and prompt hash

**Selected when:** board is you; subject is general life direction

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and divisional house cards 1..12 (the family.rasi and family.varga packs)<br>planet · D1 and divisional planet cards with avasthas and dasha_charter<br>yoga · D1 yogas, doshas and cancellations behind the promise ledger<br>point · D1/D9 chara karakas, arudha padas and special lagnas<br>star · Moon star, lagna star, gandanta<br>annual · the running year chart and its short clock (S9)<br>activation · the reading clock L1-L3, its boundaries and the windows around today (S2, S3) | house_card<br>planet_card<br>yoga_row<br>point_row<br>star_profile<br>annual_row<br>activation_row | `src/reading/prompts/oracle/self-areas-v2.md` | TODAY, FACTS | self_v2_oracle.v1 | — |

**Source:** docs/reading-engine/66 §4.1, §4.8; BPHS (lordship, dignity, avasthas, dasha-lord rules); Jaimini (karakas, arudhas); SOUL.md four tiers  
**Code:** `src/reading/self/v2/build.ts runSelfV2Build; src/reading/self/v2/oracle.ts runOracleV2; src/reading/self/v2/slices.ts buildSelfV2Slices`  
**Agents:** `self.oracle.v2`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`

### You board v2: Personalizer cards for this person — `self.v2.personalizer`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** reading clock (dasha), windows around today (transit)

**Algorithm:**

1. Takes the validated Oracle document as the cached prefix (stable per Oracle key) and the profile pack (age band, stated gender or none, role, facts, declined topics, last confirms, mood) with the windows summary as the suffix
2. Writes one card per area (headline, two or three short paragraphs, patterns, the four-step ladder best, practical, drift, floor, dates copied from the Oracle) in plain second person, JSON by schema
3. Validates every headline and body sentence against a source (an Oracle paragraph id or evidence key), every date against the Oracle document, and rejects chart terms, engine names, internal ids, medical words and, when no gender is stated, gendered words; a card with no body is withheld and the Oracle headline, redacted, stands in
4. Stores the hero and cards in technique_outputs under the Oracle key, the profile hash and the prompt hash, so a profile change re-runs only this step

**Selected when:** board is you; subject is general life direction

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · the windows summary around today (S3): heaviest now, eases at, next support from | activation_row | `src/reading/prompts/personalizer/self.md` | TODAY, FACTS | self_v2_cards.v1 | — |

**Source:** docs/reading-engine/66 §4.1, §4.8; BPHS (lordship, dignity, avasthas, dasha-lord rules); Jaimini (karakas, arudhas); SOUL.md four tiers  
**Code:** `src/reading/self/v2/personalizer.ts runPersonalizer; src/reading/self/v2/personalizerValidate.ts validatePersonalDoc`  
**Agents:** `self.personalizer`

### Self v2 area: How you come across (selection over the self.sub outputs into an AreaBrief) — `self.v2.presence`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): bearing, style, adornment, face and public/private keys, the best past window, the live care line
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always_plus_live; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.presence

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context) | planet_card<br>activation_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/presence.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: Where you get stuck (selection over the self.sub outputs into an AreaBrief) — `self.v2.stuck`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): heaviest live window, pressing windows started in the last 12 months still running, every live ledger row, standing knots, mind candidate patterns
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon live_plus_standing; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.stuck

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>activation · self.sub.periods and self.sub.windows dasha rows (build context) | planet_card<br>activation_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/stuck.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: This year (selection over the self.sub outputs into an AreaBrief) — `self.v2.year`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): the Tithi Pravesha year frame (return moment passed): lagna, year lord, TP short clock and the Varsha Mudda confirming clock; nothing when noCoverage
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon twelve_months; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.year

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context)<br>annual · self.sub.year frame (build context) | planet_card<br>annual_row | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/year.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### Self v2 area: Gifts & knots (selection over the self.sub outputs into an AreaBrief) — `self.v2.yogas`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** self.sub outputs (natal)

**Algorithm:**

1. Pure selection over ctx.sub (no database, no digest read): every promise entry, gifts then knots then graces
2. Claims carry a fact tag, evidence keys and a range; dates carry a label tag; ledger and promise ids are listed; no prose for the person
3. Horizon always; refreshStamp = the clock plus the stamps of SELF_V2_REFRESH.yogas

**Selected when:** board is you; subject is general life direction; about houses 1; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards behind the self.sub outputs (build context) | planet_card | `none` | — | self_v2.area_brief | — |

**Source:** docs/reading-engine/66 §4.3, §4.8; BPHS (lords, karakatva, functional nature, avasthas); PVR Narasimha Rao, Integrated Approach (dasha delivery, charter); words tables src/reading/self/v2words.ts  
**Code:** `src/reading/self/areas/yogas.ts; areas/index.ts buildAreaBriefs`  
**Agents:** `self.reading_panel`

### You board v3: span-led cards for the next twelve months — `self.v3.cards`

**Built** · board: You board · accuracy: area_checks:self

**Reads:** D1 (natal), D9 (divisional), reading clock (dasha), confirming clocks (dasha), year chart (annual), Saturn passage (transit)

**Algorithm:**

1. Builds the year frame from stored pressure_inventory rows only: the next twelve months cut on the reading clock level-3 (else level-2) period edges and the Tithi Pravesha year edge, neighbours with the same copied tone merged, at most six spans
2. Copies each span tone from the engine polarity of the period row covering its first day (presses heavy, mixed mixed, supports light) and counts the other clocks (the year chart rows and the stored inventories of the confirming and applicable clocks) that share it
3. Runs the Oracle as three parallel calls over the v2 natal prefix with the year frame as the suffix; validates each card (every span answered once with the frame tone, heavy never build, light never get_through, evidence keys and dates from the input, a knot as well as a gift) and re-asks failed cards once
4. Runs the Personalizer once per Oracle call, in parallel, over the Oracle cards and the person; validates the line, asks, obstacle and the if-then step with the v2 text checks
5. Stores the cards beside the frame in technique_outputs, keyed by clock, frame, Oracle prefix, profile, sections and prompt hashes

**Selected when:** board is you; subject is general life direction

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · the year frame spans from the stored pressure inventories | activation_row | `src/reading/prompts/oracle/self-cards-v3.md` | TODAY, FACTS | self_v3_cards.v1 | — |

**Source:** docs/reading-engine/66 §4.1, §4.8; BPHS (lordship, dignity, avasthas, dasha-lord rules); Jaimini (karakas, arudhas); SOUL.md four tiers  
**Code:** `src/reading/self/v3/build.ts runSelfV3Cards; src/reading/self/v3/yearFrame.ts buildYearFrameV3; src/reading/self/v3/oracle.ts runOracleV3; src/reading/self/v3/personalizer.ts runPersonalizerV3`  
**Agents:** `self.oracle.v3`, `self.personalizer`

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

### Love reading: the code auditor over the cards (board.auditor, Love instance) — `love.reading.audit`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** dossier rows (natal)

**Algorithm:**

1. Every card line: at most 22 words, a range, claim ids that exist and were not vetoed, evidence keys that resolve to stored rows

**Selected when:** board is love; about houses 7; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the cards and claims of the build | findings_in | `none` | — | code_audit.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/audit.ts auditCards`  
**Agents:** `love.reading_panel`

### Love reading: the bond itself (7th, 2nd, 4th, 8th, UL and its 2nd, D9, D7) — `love.reading.bond`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** D1 (divisional), D9 (divisional), D7 (divisional), arudhas (jaimini)

**Algorithm:**

1. houseFrame D1 h7, h2, h4, h8; D9 h7, h1; D7 h1
2. planetChain L7, L2, L8, Ju; UL and its 2nd, A7, DK
3. Shown for dating, committed, married, separated; separation never a verdict

**Selected when:** board is love; about houses 7, 2, 4, 8; in D1, D9, D7

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h7,2,4,8; D9 h7,1; D7 h1<br>planet · D1 cards of L7, L2, L8, Ju<br>point · UL, A7, DK | house_card<br>planet_card<br>point_row | `none` | — | board_panel.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/love.ts bondPanel`  
**Agents:** `love.reading_panel`

### Love reading: your chapters for love (board.chapters filtered to the love houses) — `love.reading.chapters`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** reading clock L1-L2 (dasha), confirming clocks L1 (dasha)

**Algorithm:**

1. board.chapters with houses 7,5,11,2,8,4,12 and planets L7, Ve, DK, Ju, Mo
2. Per chapter: the love houses the lord activates; UL or A7 held by the chapter sign on a sign clock

**Selected when:** board is love; about houses 7, 5, 11, 2, 8, 4, 12; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · reading clock L1-L2 and confirming clocks L1, houses 7,5,11,2,8,4,12<br>planet · D1 cards of the chapter lords | activation_row<br>planet_card | `none` | — | board_chapters.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/love.ts loveChaptersPanel`  
**Agents:** `love.reading_panel`

### Love reading: who else is in it (family, in-laws, friends, children as facts) — `love.reading.circle`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** D1 (divisional), D7 (divisional), charakaraka (jaimini)

**Algorithm:**

1. houseFrame D1 h2, h4, h11, h5; D7 h5
2. planetChain L2, L4, L11, Mo, Ju; MK, PK, A11
3. Shown for committed, married, separated, complicated; nothing about a child under 18

**Selected when:** board is love; about houses 2, 4, 11, 5; in D1, D7

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h2,4,11,5; D7 h5<br>planet · D1 cards of L2, L4, L11, Mo, Ju<br>point · MK, PK, A11 | house_card<br>planet_card<br>point_row | `none` | — | board_panel.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/love.ts circlePanel`  
**Agents:** `love.reading_panel`

### Love reading: the reading clock and confirming clocks (Love instance) — `love.reading.clock`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** kundli_activation (dasha)

**Algorithm:**

1. kundli.preferred_dasha when present in kundli_activation; else the first conditional dasha present; else vimshottari
2. Confirming clocks in configured order from what is stored

**Selected when:** board is love; about houses 7; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · distinct (system, family) at level 1 | activation_row | `none` | — | self_clock.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/clock.ts resolveClock`  
**Agents:** `love.reading_panel`

### Love reading: your love life, in short (three sentences from the Love panels and chapters) — `love.reading.diagnosis`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** panel claims (natal)

**Algorithm:**

1. Built last from the claims of the Love fact panels that fit love.status and of love.reading.chapters
2. How the person loves and what they draw; the central tension (strongest knot on 7, Ve, UL or DK, or the heaviest running affliction with its release); where love stands now, dated

**Selected when:** board is love; about houses 7; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · claims of love.reading.heart, partner, bond, circle, chapters | findings_in | `none` | — | board_diagnosis.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/love.ts loveDiagnosisPanel`  
**Agents:** `love.reading_panel`

### Love reading: how you love (Venus, Moon, 5th lord, D9 7th) — `love.reading.heart`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** D1 (divisional), D9 (divisional)

**Algorithm:**

1. planetChain Ve, Mo, L5 (D1 and D9)
2. houseFrame D1 h5, h7; D9 h7 and D9 Ve
3. Facts only: how the person loves, what they feel, romance and play, the inner shape of partnership

**Selected when:** board is love; about houses 5, 7; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 and D9 cards of Ve, Mo, L5<br>house · D1 h5, h7; D9 h7 | planet_card<br>house_card | `none` | — | board_panel.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/love.ts heartPanel`  
**Agents:** `love.reading_panel`

### Love reading: AI family sub-agents, Love Lineman, and Love Oracle synthesis — `love.reading.oracle`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** panel claims (natal), D1 (divisional), D9 (divisional), D7 (divisional), reading clock (dasha), Tithi Pravesha (annual), sky overlay (transit)

**Algorithm:**

1. Reuses the five shared chart family sub-agent findings (family.rasi, family.varga, family.dasha, family.year, family.sky) from reading_findings_cache across Self, Love, and Work
2. Compiles the family sub-agent findings, the eight deterministic Love panel claims, and the whole-chart purview rules through the Love Lineman AI agent (lineman.love) into a unified Love brief
3. Synthesizes the personalized Love reading through the Love Oracle synthesizer (love.reading_oracle), stores the output in technique_outputs, and validates every cited evidence key against the stored chart keys under the $1.00 spend guard

**Selected when:** board is love; about houses 7, 5, 11, 2, 8, 4, 12; in D1, D9, D7

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and divisional house cards 1..12<br>planet · D1 and divisional planet cards with avasthas and dasha_charter<br>yoga · D1 yogas, doshas, and cancellations<br>point · D1/D9 chara karakas, arudha padas, and Lunar Astro points<br>star · Moon star, lagna star, gandanta, and pending karma houses<br>annual · running Tithi Pravesha and Varsha annual charts<br>activation · reading clock L1-L3 and confirming clocks L1 | house_card<br>planet_card<br>yoga_row<br>point_row<br>star_profile<br>annual_row<br>activation_row | `src/reading/prompts/oracle/self.md` | FACTS, TODAY | self_reading.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46; docs/reading-engine/63 §4.1  
**Code:** `src/reading/self/oracle.ts runSelfOracle`  
**Agents:** `love.reading_oracle`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.love`

### Love reading: the partner you draw (7th, its lord, DK, UL, A7, D9 7th) — `love.reading.partner`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** D1 (divisional), D9 (divisional), charakaraka (jaimini), arudhas (jaimini)

**Algorithm:**

1. houseFrame D1 h7; planetChain L7 and the DK planet; D9 h7 and its lord; chains of h7 occupants and aspecting planets
2. Shown for single, dating, complicated; never a yes or no on marriage

**Selected when:** board is love; about houses 7; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h7; D9 h7<br>planet · D1 and D9 cards of L7, the DK planet, h7 occupants<br>point · DK, UL, A7, D9 lagna | house_card<br>planet_card<br>point_row | `none` | — | board_panel.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/love.ts partnerPanel`  
**Agents:** `love.reading_panel`

### Love reading: the whole-chart purview check (board.purview, Love instance) — `love.reading.purview`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** D1 (divisional), D9 (divisional), yogas (natal), reading clock (dasha)

**Algorithm:**

1. Runs over the full digest and the reading clock after the Love panels: 7th lord standing, cancellations, combustion and retrograde, vargottama, gandanta, dasha applicability, MD-AD 6/8 and 2/12, Upapada/Darapada, and the stored sky

**Selected when:** board is love; about houses 7, 5; in D1, D9

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · claims of every Love panel<br>planet · D1 and D9 cards of L7, L5, Ve, Mo, DK<br>yoga · cancellation rows<br>activation · reading clock running | findings_in<br>planet_card<br>yoga_row<br>activation_row | `none` | — | purview.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/purview.ts runPurview, applyPurview`  
**Agents:** `love.reading_panel`

### Love reading: what tests it (board.struggle filtered to love) — `love.reading.struggle`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** D1 (divisional), doshas (natal), reading clock L1-L3 (dasha)

**Algorithm:**

1. board.struggle with planets L7, Ve, DK, Mo, the UL lord and houses 7,5,8,12
2. Sa, Ma, Ra, Ke on or aspecting 7, Ve or UL; Kalathra and Manglik rows; L7 in 6/8/12; Ve debilitated without a cancellation; release from the reading clock

**Selected when:** board is love; about houses 7, 5, 8, 12; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards of L7, Ve, DK, Mo<br>house · D1 h7,5,8,12<br>yoga · Kalathra, Manglik rows<br>activation · reading clock L1-L3 running | planet_card<br>house_card<br>yoga_row<br>activation_row | `none` | — | board_struggle.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/love.ts loveStrugglePanel`  
**Agents:** `love.reading_panel`

### Love reading: this year (board.year filtered to love) — `love.reading.year`

**Built** · board: Love board · accuracy: area_checks:love

**Reads:** Tithi Pravesha (annual), varsha (annual)

**Algorithm:**

1. board.year on house 7, Venus, the natal L7 and the UL sign; Vivaha and Preethi sahams when stored
2. The year is the running Tithi Pravesha (tp_start ≤ now < tp_end; before the return of this year the previous year's TP); short clock = the TP year dasha when bounded; Varsha Mudda confirms only

**Selected when:** board is love; about houses 7; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · the running TP D1 year (tp_start ≤ now < tp_end) and its year dasha when bounded; VP D1 Mudda as confirmation | annual_row | `none` | — | board_year.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/love.ts loveYearPanel; src/reading/annual/tithiPravesha.ts runningTithiPravesha`  
**Agents:** `love.reading_panel`

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

### Research Love Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year relationship zoom-in — `research.love_dashboard_qa`

**Built** · board: Love board · accuracy: staff

**Reads:** facts (natal), dignities (natal), aspects (natal), avasthas (natal), yogas (natal), doshas (natal), strength.shadbala (natal), sav (ashtakavarga), charakaraka (jaimini), arudhas (jaimini), argala (jaimini), janma (nakshatra), cusp nak (nakshatra), D1 (divisional), D9 (divisional), D10 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D2 (divisional), D4 (divisional), D7 (divisional), D60 (divisional), Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), Transit contacts (transit), Sade Sati (transit), muhurta (panchang)

**Algorithm:**

1. Hydrate synthetic age-bracket or persona kundlis into isolated research_* staging tables and run the production Love board (buildBoard LOVE, resolveAreaShades, buildCalmPlaybook)
2. Evaluate 7H/5H/11H/2H/4H/8H/12H across D1, D9 (Navamsa), and D7 (Saptamsa) with Venus, Moon, L7, Darakaraka (DK), Upapada Lagna (UL), and Vivaha/Preethi/Mitra Sahams
3. Zoom in temporally across November Lead, Thanksgiving Week (Nov 23-29), December Core, and New Year Transition (Dec 28-Jan 5) for relationship harmony, family boundaries, and reconnection windows
4. Record the 10-step technical trace and audit via the 8-gate Independent Technical Verifier Agent

**Selected when:** board is love; subject is marriage relationship or children; about houses 2, 4, 5, 7, 8, 11, 12; in D1, D9, D7, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 houses 1..12<br>planet · D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 every planet<br>yoga · all yogas, doshas and cancellations<br>point · AK, AmK, DK, AL, UL, SL, HL, GL, K64M, K64L, KD22, BB<br>star · Moon star, lagna star, tara table, gandanta and pending karma<br>activation · every served system covering Nov-Jan and ±30 years (levels 1..4)<br>annual · TP and VP of the current and next year with year dashas and sahams<br>transit · Sa, Ju, Ra, Ke slow transits, sade sati, and daily tara/chandra bala overlay | house_card<br>planet_card<br>yoga_row<br>point_row<br>star_profile<br>activation_row<br>annual_row<br>transit_row | `none` | — | research_love_dashboard.v1 | `research.technical_verifier` |

**Source:** docs/admin/09 §4.1; docs/reading-engine/45 §8.2; 46 §B.12; 54 §3  
**Code:** `src/reading/research/loveDashboardQa.ts buildLoveResearchDashboard; selfDashboardQa.ts hydrateResearchSubject`  
**Agents:** `research.love_dashboard_builder`

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

### Research Work Dashboard deep-dive & Nov/Thanksgiving/Dec/New Year career zoom-in — `research.work_dashboard_qa`

**Built** · board: Work board · accuracy: staff

**Reads:** facts (natal), dignities (natal), aspects (natal), avasthas (natal), yogas (natal), doshas (natal), strength.shadbala (natal), sav (ashtakavarga), charakaraka (jaimini), arudhas (jaimini), argala (jaimini), janma (nakshatra), cusp nak (nakshatra), D1 (divisional), D9 (divisional), D10 (divisional), D20 (divisional), D24 (divisional), D12 (divisional), D2 (divisional), D4 (divisional), D7 (divisional), D60 (divisional), Vimshottari (dasha), Yogini (dasha), Tithi Ashtottari (dasha), Narayana (dasha), Chara (dasha), karaka (dasha), Tithi Pravesha (annual), varsha (annual), tithi pravesha dasha (annual), Transit contacts (transit), Sade Sati (transit), muhurta (panchang)

**Algorithm:**

1. Hydrate synthetic age-bracket or persona kundlis into isolated research_* staging tables and run the Work/Career research board (buildBoard WORK_RESEARCH_CONFIG, resolveAreaShades, buildCalmPlaybook)
2. Evaluate 10H/6H/11H/2H/1H/9H/3H across D1, D10 (Dasamsa), D9 (Navamsa), D2 (Hora), and D24 (Siddhamsa) with L10, Sun, Saturn, Mercury, Jupiter, Amatyakaraka (AmK), Arudha Lagna (AL), and Karma/Samartha/Artha Sahams
3. Zoom in temporally across November Lead, Thanksgiving Week (Nov 23-29), December Core, and New Year Transition (Dec 28-Jan 5) for Q4 deliverable closure, workload pacing, and Q1 career launch
4. Record the 10-step technical trace and audit via the 8-gate Independent Technical Verifier Agent

**Selected when:** board is work; subject is career work or income wealth; about houses 1, 2, 3, 6, 9, 10, 11; in D1, D10, D9, D2, D24

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 houses 1..12<br>planet · D1,D9,D10,D20,D24,D12,D2,D4,D7,D60 every planet<br>yoga · all yogas, doshas and cancellations<br>point · AK, AmK, DK, AL, UL, SL, HL, GL, K64M, K64L, KD22, BB<br>star · Moon star, lagna star, tara table, gandanta and pending karma<br>activation · every served system covering Nov-Jan and ±30 years (levels 1..4)<br>annual · TP and VP of the current and next year with year dashas and sahams<br>transit · Sa, Ju, Ra, Ke slow transits, sade sati, and daily tara/chandra bala overlay | house_card<br>planet_card<br>yoga_row<br>point_row<br>star_profile<br>activation_row<br>annual_row<br>transit_row | `none` | — | research_work_dashboard.v1 | `research.technical_verifier` |

**Source:** docs/admin/09 §4.1; docs/reading-engine/42 §B.4; 43 §2-§8; 55 §2  
**Code:** `src/reading/research/workDashboardQa.ts buildWorkResearchDashboard; selfDashboardQa.ts hydrateResearchSubject`  
**Agents:** `research.work_dashboard_builder`

### This year's chart (annual family) — `work.annual_family`

**Built** · board: Work board · accuracy: staff

**Reads:** Tithi Pravesha (annual), tithi pravesha dasha (annual), mudda (annual), patyayini (annual), sahams (annual), D10 (divisional)

**Algorithm:**

1. Tithi Pravesha led (doc 66 §4.10): runningTithiPravesha picks the TP D1 row whose return moment has passed (tp_start ≤ the person's local now < tp_end; before the return of this year the previous year's TP is in force; never the calendar birthday, never the Varsha year in its place)
2. Grade the year chart's houses 10, 6 and 1 (lord in the house or kendra/trikona without debility supports; in a dusthana or debilitated tests)
3. Read the houses of the rajya and karma sahams (kendra supports, dusthana tests) and the TP year dasha lord covering the month, only when the engine bounds that dasha to the year
4. Cast one vote (support, test or neutral) as the annual family of the present tone

**Selected when:** board is work; subject is career work; about houses 10, 6, 1, 2, 11; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · the running TP year (tp_start ≤ now < tp_end), D1 and D10, houses 10,6,1,2,11; rajya and karma sahams; TP year dasha running this month when bounded to the year | annual_row | `none` | — | family_vote.v1 | `work.present_tone` |

**Source:** docs/reading-engine/43 §8.1 (family 5); 46 §B.6; 53 §4.5  
**Code:** `src/reading/area/career.ts workAnnualVote, presentState; careerService.ts getCareer; src/reading/annual/tithiPravesha.ts runningTithiPravesha`  
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

### Work reading: the code auditor over the cards (board.auditor, Work instance) — `work.reading.audit`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** dossier rows (natal)

**Algorithm:**

1. Every card line: at most 22 words, a range, claim ids that exist and were not vetoed, evidence keys that resolve to stored rows

**Selected when:** board is work; about houses 10; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · the cards and claims of the build | findings_in | `none` | — | code_audit.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/audit.ts auditCards`  
**Agents:** `work.reading_panel`

### Work reading: your chapters for work (board.chapters filtered to the work houses) — `work.reading.chapters`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** reading clock L1-L2 (dasha), confirming clocks L1 (dasha)

**Algorithm:**

1. board.chapters with houses 10,6,11,2,9,3,5,7 and planets L10, Sa, Me, Su, Ju, AmK
2. Per chapter: the work houses the lord activates; A10 held by the chapter sign on a sign clock; the faculty, never a job event

**Selected when:** board is work; about houses 10, 6, 11, 2, 9, 3, 5, 7; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · reading clock L1-L2 and confirming clocks L1, houses 10,6,11,2,9,3,5,7<br>planet · D1 cards of the chapter lords | activation_row<br>planet_card | `none` | — | board_chapters.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/work.ts workChaptersPanel`  
**Agents:** `work.reading_panel`

### Work reading: the reading clock and confirming clocks (Work instance) — `work.reading.clock`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** kundli_activation (dasha)

**Algorithm:**

1. kundli.preferred_dasha when present in kundli_activation; else the first conditional dasha present; else vimshottari
2. Confirming clocks in configured order from what is stored

**Selected when:** board is work; about houses 10; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| activation · distinct (system, family) at level 1 | activation_row | `none` | — | self_clock.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/clock.ts resolveClock`  
**Agents:** `work.reading_panel`

### Work reading: your work life, in short (three sentences from the Work panels and chapters) — `work.reading.diagnosis`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** panel claims (natal)

**Algorithm:**

1. Built last from the claims of the Work fact panels and work.reading.chapters
2. What the person is built to do and how they stand; the central tension (strongest knot on 10, L10, Sa or AmK, or the heaviest running affliction); where work stands now, dated

**Selected when:** board is work; about houses 10; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · claims of work.reading.vocation, standing, ground, gain, chapters | findings_in | `none` | — | board_diagnosis.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/work.ts workDiagnosisPanel`  
**Agents:** `work.reading_panel`

### Work reading: what it pays (11th, 2nd, D2, D10 11th, dhana yogas of the work lords) — `work.reading.gain`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** D1 (divisional), D2 (divisional), D10 (divisional), yogas (natal)

**Algorithm:**

1. houseFrame D1 h11, h2; D2 h1 when stored; D10 h11; planetChain L11, L2; A11, A2; dhana yogas touching L10, L11, L2
2. No amounts

**Selected when:** board is work; about houses 11, 2; in D1, D2, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h11,2; D2 h1; D10 h11<br>planet · D1 cards of L11, L2<br>point · A11, A2<br>yoga · dhana rows touching L10, L11, L2 | house_card<br>planet_card<br>point_row<br>yoga_row | `none` | — | board_panel.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/work.ts gainPanel`  
**Agents:** `work.reading_panel`

### Work reading: where the work is now (6th, 3rd, 7th, 12th, D10 6th and 3rd) — `work.reading.ground`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** D1 (divisional), D10 (divisional)

**Algorithm:**

1. houseFrame D1 h6, h3, h7, h12; D10 h6, h3; planetChain L6, L3; A6, A3
2. Never a job-end prediction (career map windows only)

**Selected when:** board is work; about houses 6, 3, 7, 12; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h6,3,7,12; D10 h6,3<br>planet · D1 cards of L6, L3<br>point · A6, A3 | house_card<br>planet_card<br>point_row | `none` | — | board_panel.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/work.ts groundPanel`  
**Agents:** `work.reading_panel`

### Work reading: AI family sub-agents, Work Lineman, and Work Oracle synthesis — `work.reading.oracle`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** panel claims (natal), D1 (divisional), D9 (divisional), D10 (divisional), D2 (divisional), reading clock (dasha), Tithi Pravesha (annual), sky overlay (transit)

**Algorithm:**

1. Reuses the five shared chart family sub-agent findings (family.rasi, family.varga, family.dasha, family.year, family.sky) from reading_findings_cache across Self, Love, and Work
2. Compiles the family sub-agent findings, the eight deterministic Work panel claims, and the whole-chart purview rules through the Work Lineman AI agent (lineman.work) into a unified Work brief
3. Synthesizes the personalized Work reading through the Work Oracle synthesizer (work.reading_oracle), stores the output in technique_outputs, and validates every cited evidence key against the stored chart keys under the $1.00 spend guard

**Selected when:** board is work; about houses 10, 6, 11, 2, 9, 3, 5, 7; in D1, D9, D10, D2

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 and divisional house cards 1..12<br>planet · D1 and divisional planet cards with avasthas and dasha_charter<br>yoga · D1 yogas, doshas, and cancellations<br>point · D1/D9 chara karakas, arudha padas, and Lunar Astro points<br>star · Moon star, lagna star, gandanta, and pending karma houses<br>annual · running Tithi Pravesha and Varsha annual charts<br>activation · reading clock L1-L3 and confirming clocks L1 | house_card<br>planet_card<br>yoga_row<br>point_row<br>star_profile<br>annual_row<br>activation_row | `src/reading/prompts/oracle/self.md` | FACTS, TODAY | self_reading.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46; docs/reading-engine/63 §4.1  
**Code:** `src/reading/self/oracle.ts runSelfOracle`  
**Agents:** `work.reading_oracle`, `family.rasi`, `family.varga`, `family.dasha`, `family.year`, `family.sky`, `lineman.work`

### Work reading: the whole-chart purview check (board.purview, Work instance) — `work.reading.purview`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** D1 (divisional), D9 (divisional), D10 (divisional), yogas (natal), reading clock (dasha)

**Algorithm:**

1. Runs over the full digest and the reading clock after the Work panels: 10th lord standing, cancellations, combustion and retrograde, vargottama, gandanta, dasha applicability, MD-AD 6/8 and 2/12, Arudha/Rajyapada/Ghatika, and the stored sky

**Selected when:** board is work; about houses 10, 6, 11; in D1, D9, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| findings · claims of every Work panel<br>planet · D1 and D9 cards of L10, L6, L11, AmK, Sa, Su, Me, Ju<br>yoga · cancellation rows<br>activation · reading clock running | findings_in<br>planet_card<br>yoga_row<br>activation_row | `none` | — | purview.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/purview.ts runPurview, applyPurview`  
**Agents:** `work.reading_panel`

### Work reading: how you are seen (AL, A10, Sun, 10th lord, D10 lagna) — `work.reading.standing`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** D1 (divisional), D10 (divisional), arudhas (jaimini)

**Algorithm:**

1. houseFrame D1 h10, h1 and the AL house; D10 frame of the AL house; planetChain Su, L10
2. Recognition as a fact here, as a window only in the career map

**Selected when:** board is work; about houses 10, 1; in D1, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h10,1, AL house; D10 AL house<br>planet · D1 cards of Su, L10<br>point · AL, A10, D10 lagna | house_card<br>planet_card<br>point_row | `none` | — | board_panel.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/work.ts standingPanel`  
**Agents:** `work.reading_panel`

### Work reading: what tests it (board.struggle filtered to work) — `work.reading.struggle`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** D1 (divisional), avasthas (natal), reading clock L1-L3 (dasha)

**Algorithm:**

1. board.struggle with planets L10, L6, Sa, AmK, Su and houses 10,6,11,2
2. L10 in 6/8/12; Sa debilitated or mrita; Ra or Ke on 10 or the AL; never the layoff, firing or resignation signatures

**Selected when:** board is work; about houses 10, 6, 11, 2; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| planet · D1 cards of L10, L6, Sa, AmK, Su<br>house · D1 h10,6,11,2<br>activation · reading clock L1-L3 running | planet_card<br>house_card<br>activation_row | `none` | — | board_struggle.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/work.ts workStrugglePanel`  
**Agents:** `work.reading_panel`

### Work reading: what you are built to do (10th, its lord, D10, AmK, the four karakas, karakamsa) — `work.reading.vocation`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** D1 (divisional), D9 (divisional), D10 (divisional), charakaraka (jaimini)

**Algorithm:**

1. houseFrame D1 h10, h3, h5; D10 h1, h10; planetChain L10 (D1, D9, D10), the AmK, Sa, Me, Su, Ju and planets in D1 h10 and D10 h10
2. Karakamsa and its 10th for the Jaimini vocation rule; ranked, never a single profession as a verdict

**Selected when:** board is work; about houses 10, 3, 5; in D1, D9, D10

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 h10,3,5; D10 h1,10<br>planet · D1, D9, D10 cards of L10, AmK, Sa, Me, Su, Ju<br>point · AmK, A10, D9 AK | house_card<br>planet_card<br>point_row | `none` | — | board_panel.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/work.ts vocationPanel`  
**Agents:** `work.reading_panel`

### Work reading: this year (board.year filtered to work) — `work.reading.year`

**Built** · board: Work board · accuracy: area_checks:work

**Reads:** Tithi Pravesha (annual), varsha (annual)

**Algorithm:**

1. board.year on house 10, the natal L10, Saturn and A10; Karma and Labha sahams when stored
2. The year is the running Tithi Pravesha (tp_start ≤ now < tp_end; before the return of this year the previous year's TP); short clock = the TP year dasha when bounded; Varsha Mudda confirms only

**Selected when:** board is work; about houses 10; in D1

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| annual · the running TP D1 year (tp_start ≤ now < tp_end) and its year dasha when bounded; VP D1 Mudda as confirmation | annual_row | `none` | — | board_year.v1 | — |

**Source:** docs/reading-engine/59; BPHS (bhava, karakas); Jaimini (DK, UL, AmK, A10, karakamsa); docs 42-46  
**Code:** `src/reading/self/panels/work.ts workYearPanel; src/reading/annual/tithiPravesha.ts runningTithiPravesha`  
**Agents:** `work.reading_panel`

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
3. planet D<n>.<planet>: sign, house, degree, star, pada and star lord, dignity, retro, combust, war, dispositor and its house (dignities.dN); dispositor chain and starChain (avasthas lunar_astro), avasthas and avasthaMultipliers (avasthas.dN for D1, D9, D10, D16, D24), sunProximity (D1: avasthas.proximity_audit), dashaCharter 5-vector charter & 9x9 Antardasha fruition map (D1: avasthas.dasha_charter), shadbala ratio and rank, natural and functional nature and houses owned (D1: facts.bodies, benefic_malefic; elsewhere the houses whose engine lord is the planet), aspects_to and aspected_by (aspects.dN), conjunctions (same sign). Vargas served only as placement rows (varga.dN without dignities.dN) get planet cards with sign, degree, star, pada, and any stored avasthas.dN, and no house cards: the engine states no house table for them
4. yoga D<n>.<id>: the present yogas and doshas (yogas, yogas.dN, doshas) and the dossier yogas, one row per name, class from the dossier where it names one
5. point <varga>.<id>: chara karakas placed by their planet's card in each varga; A1..A12 with AL and UL, surya_arudhas (S1..S12), chandra_arudhas (C1..C12), and the special points (SL, HL, GK, MD) of arudhas.dN; badhaka (D1: benefic_malefic.badhaka); Lunar Astro sensitive points K64M, K64L, KD22, BB (D1: avasthas.lunar_astro); the dossier's special lagnas and the sphutas (D1); each with the lord of its sign and the lord's house from that chart's house table
6. annual TP<year>.D<n> and VP<year>.D<n> for every stored year chart: lagna and house cards (as above, from the year chart tables); for D1 the year dashas (Tithi Pravesha: tithi_pravesha_dasha per stored system; Varsha: Mudda, Patyayini) and, for Varsha, the sahams in houses plus muntha, yearLord, and tajakaYogas when annual.tajaka@year=Y is stored
7. star profile: Moon star and its lord, lagna star, the tara of every star from the Moon star, gandanta flags (facts.nakshatra_profile; the D1 Moon card when there is no dossier), and pendingKarmaHouses (avasthas.lunar_astro.pending_karma)
8. Writes the rows and the activation calendar in one transaction (old rows deleted, batches of 500), invalidates cached technique_outputs and area_builds for the kundli, and stamps kundlis.digest_status ready with digest_version and digest_built_at, only while the status is still building; failed with the error type on an error, leaving the old rows
9. It selects, counts, joins and dates; it never derives a sign, a lord, an aspect, a dignity, a yoga or a house (doc 46 §C.3; tests/unit/reading/digest/noAstrologyInNode.test.ts)

**Special:** About 400 stored rows read and 700–900 digest rows written per research kundli. Run by the kundli-digest event and the kundli-digest-sweep (pending, stale, failed, another version, or stuck building); a registration pull that stores new rows marks a ready digest stale

**Selected when:** board is chat, you, love, work, lucky, timeline

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · dignities.dN, aspects.dN, argala.dN, arudhas.dN, house_counts.dN; D1 also ashtakavarga, benefic_malefic.badhaka, facts.houses; D1 and the vargas with dignities.dN<br>planet · dignities.dN, aspects.dN, avasthas.dN (avasthas, avasthaMultipliers, dispositor chains, D1 sunProximity & dashaCharter); D1 also strength.shadbala, benefic_malefic, facts.bodies; varga.dN placement rows for the other vargas<br>yoga · yogas, yogas.dN, doshas, facts.yogas<br>point · karaka.chara, arudhas(.dN) (bhava/surya/chandra arudhas & special points), benefic_malefic.badhaka, avasthas.lunar_astro (K64M, K64L, KD22, BB), facts.special_lagnas, sphutas<br>annual · annual.{tithi_pravesha,varsha}@year=Y (D1, D2, D7, D9, D10), annual.{tithi_pravesha_dasha,mudda,patyayini,sahams,tajaka}@year=Y, every stored year<br>star · facts.nakshatra_profile, avasthas.lunar_astro.pending_karma | house_card<br>planet_card<br>yoga_row<br>point_row<br>annual_row<br>star_profile | `none` | — | kundli_digest.v1 | — |

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
6. The current year is the running Tithi Pravesha (packs/digestSource.ts annualFromDigest and oracle/digestSlices.ts through runningTithiPravesha: the TP whose return moment has passed, tp_start <= now < tp_end; before the return of this year the previous year's TP); Varsha and Mudda only confirm (prompts/annual.md carries the rule)

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
**Code:** `src/reading/clarify/planner.ts; service.ts; monitor.ts`  
**Agents:** `reading.clarify`, `reading.clarify_monitor`

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

### Your life at a glance and long-term Mahadasha charter — `life.dashboard`

**Built** · board: Timeline · accuracy: none

**Reads:** digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit)

**Algorithm:**

1. Needs the digest: when it is not ready the answer is preparing and the kundli is queued (digest_status pending unless building)
2. Per area run the promise scale (life.promise_scale), the timing (life.timing_agreement), and the long-term Mahadasha & Antardasha charter (life.mahadasha_charter)
3. Shown only when the area has a pressure now (a test line in the running periods or the sky) or a dated window
4. Issue: the heaviest current test line as a plain sentence with its end date, then one confirming question worded from the person's stored facts (work.status, love.status, family.children)
5. Cause: the planets of the current test lines and the withholding planets, the running periods that touch the area, and one plain sentence
6. Solution: two practical steps per area, the date to hold until, the best window to act in, and traditional support from the chart's strongest functional benefic (a weekday and a gesture)
7. Rule now: the running Vimshottari sub-period; its lord testing gives hold-and-prepare with what happens if broken, otherwise act on what is ready
8. Charter: the remaining largest Mahadasha (10-18+ yrs) broken down by per-area life charter and chronological Antardasha sub-periods
9. Stored per kundli per day in area_builds (area life); template sentences only, no model

**Selected when:** board is timeline; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1, D9, D2, D3, D4, D7, D10, D12, D20, D24, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 houses of the area; D9 and the owning varga, primary house<br>planet · D1 karakas of the area; the primary house lord in D9 and the owning varga<br>yoga · D1 yogas on the area houses or their lords<br>activation · every family, levels 1-2, today to +15 years, the area houses<br>annual · TP and VP of each year a window touches, D1 card of the primary house<br>transit · stored natal-overlay double_transit windows and Saturn/Rahu/Ketu rows (read only; none fetched) | house_card<br>planet_card<br>yoga_row<br>activation_row<br>annual_row<br>transit_row | `none` | — | life_reading.v2 | — |

**Source:** docs/reading-engine/34 §1, §5 Part 1; 54 §4; 55 §4  
**Code:** `src/reading/life/compose.ts composeDashboard; service.ts getLifeReading`  
**Agents:** `life.dashboard`

### Remaining largest Mahadasha (10-18+ yrs) and Antardasha life charter — `life.mahadasha_charter`

**Built** · board: Timeline · accuracy: none

**Reads:** digest.house (natal), digest.planet (natal), digest.yoga (natal), D9 (divisional), owning varga (divisional), kundli_activation (dasha), digest.annual (annual), transit_snapshot.double_transit (transit)

**Algorithm:**

1. Selects the running Vimshottari Mahadasha when it has at least LIFE_CHARTER_MIN_REMAINING_YEARS (default 10) years remaining; otherwise selects the first upcoming Mahadasha in LIFE_CHARTER_HORIZON_YEARS (default 20) with >= minYears starting within minYears of today (or the next Mahadasha if longer than the running remaining span) and carries all pre-primary Mahadashas as a chronological transition bridge
2. Builds the Mahadasha touch map from the D1 planet card, dashaCharter, StarProfile.pendingKarmaHouses, and D1 Lunar Astro points K64M/K64L/KD22/BB (houses owned, house occupied, star-lord house, dispositor house, co-owned houses, graha/rasi drishti, pending-karma houses, and active yogas)
3. Synthesizes per-area life charters (anchor, growth, guarded) combining natal D1 and divisional (D9 + owning varga) promise with the Mahadasha touch weights and the area peak/watch Antardasha windows
4. Enumerates every chronological Vimshottari Antardasha (level 2) in the Mahadasha and scores the 13 life areas per sub-period across 5 pillars: D1 + varga promise, 9x9 Antardasha-from-Mahadasha fruition (trikona, kendra, dhana, upachaya, dusthana 6/8/12, star-lord/dispositor/co-lord links) plus avasthaMultipliers delivery scaling, multi-dasha family agreement, annual TP/VP year charts, and stored transit gates (including Bhrigu Bindu and Khara transit tags)
5. Emits plain-language chapter headline, charter summary, per-area charters, and chronological Antardasha cards with chart terms isolated inside structured evidence

**Selected when:** board is timeline; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1, D9, D2, D3, D4, D7, D10, D12, D20, D24, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 houses of the area; D9 and the owning varga, primary house<br>planet · D1 karakas of the area; the primary house lord in D9 and the owning varga<br>yoga · D1 yogas on the area houses or their lords<br>activation · every family, levels 1-2, today to +15 years, the area houses<br>annual · TP and VP of each year a window touches, D1 card of the primary house<br>transit · stored natal-overlay double_transit windows and Saturn/Rahu/Ketu rows (read only; none fetched) | house_card<br>planet_card<br>yoga_row<br>activation_row<br>annual_row<br>transit_row | `none` | — | life_charter.v1 | `life.dashboard` |

**Source:** docs/reading-engine/34 §3-§5; 55 §4  
**Code:** `src/reading/life/charter.ts buildMahadashaCharter`  
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

**Special:** The antardasha lord's 6/8/12 place from the mahadasha lord is read from the D1 planet card's dashaCharter.fruition map (avasthas.dasha_charter.antardasha_fruition_matrix)

**Selected when:** board is timeline; about houses 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12; in D1, D9, D2, D3, D4, D7, D10, D12, D20, D24, D30

**Contract:**

| Reads | As | Prompt | User turn | Output | Synthesizer |
|---|---|---|---|---|---|
| house · D1 houses of the area; D9 and the owning varga, primary house<br>planet · D1 karakas of the area; the primary house lord in D9 and the owning varga<br>yoga · D1 yogas on the area houses or their lords<br>activation · periods running today, levels 1-2 | house_card<br>planet_card<br>yoga_row<br>activation_row | `none` | — | life_promise.v1 | `life.dashboard` |

**Source:** docs/reading-engine/34 §2, §3; 54 §4; 55 §4.1  
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
| `dasha.deep_pull` | Deep dasha levels puller | engine_pull | digest / activation | engine:dasha | — |
| `digest.activation` | Activation calendar builder | code | digest / activation | — | — |
| `digest.annual_set` | Annual set puller | engine_pull | digest / annual | engine:annual | — |
| `digest.build` | Kundli digest builder | code | digest / build | — | — |
| `family.dasha` | Multi-clock dasha & fruition family sub-agent | llm | self / family | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `family.rasi` | Rasi (D1) family sub-agent | llm | self / family | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `family.sky` | Slow sky transit & SAV family sub-agent | llm | self / family | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `family.varga` | Divisional vargas (D2-D60) family sub-agent | llm | self / family | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `family.year` | Annual return (Tithi Pravesha & Varshaphal) family sub-agent | llm | self / family | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `life.dashboard` | Life reading dashboard | code | life / dashboard | — | — |
| `lineman.love` | Love reading lineman agent | llm | love / lineman | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `lineman.self` | Self reading lineman agent | llm | self / lineman | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `lineman.work` | Work reading lineman agent | llm | work / lineman | gemini-3.1-flash-lite | $0.250000 / $1.500000 |
| `love.reading_oracle` | Love reading oracle | llm | love / reading | gemini-3.8-flash | $0.750000 / $3.750000 |
| `love.reading_panel` | Love reading panel | code | love / reading | — | — |
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
| `reading.clarify_monitor` | Clarify counterfactual monitor | code | reading / clarify_monitor | — | — |
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
| `research.love_dashboard_builder` | Research Love Dashboard QA builder | code | area / research_love | — | — |
| `research.self_dashboard_builder` | Research Self Dashboard QA builder | code | area / research_self | — | — |
| `research.technical_verifier` | Independent Technical Verifier Agent | code | area / research_verifier | — | — |
| `research.work_dashboard_builder` | Research Work Dashboard QA builder | code | area / research_work | — | — |
| `self.oracle.v2` | You board v2 Oracle | llm | self / v2 | gemini-3.8-flash | $0.750000 / $3.750000 |
| `self.oracle.v3` | You board v3 Oracle | llm | self / v3 | gemini-3.8-flash | $0.750000 / $3.750000 |
| `self.personalizer` | You board v2 Personalizer | llm | self / v2 | gemini-3.8-flash | $0.750000 / $3.750000 |
| `self.reading_oracle` | You reading oracle | llm | self / reading | gemini-3.8-flash | $0.750000 / $3.750000 |
| `self.reading_panel` | You reading panel | code | self / reading | — | — |
| `self.sub` | You board v2 sub-techniques | code | self / v2 | — | — |
| `work.reading_oracle` | Work reading oracle | llm | work / reading | gemini-3.8-flash | $0.750000 / $3.750000 |
| `work.reading_panel` | Work reading panel | code | work / reading | — | — |

## How to regenerate

Run `npx tsx scripts/write-techniques-doc.ts` to seed `technique_registry` and `agent_registry` (when `DATABASE_URL` is set) and regenerate `docs/admin/05-techniques-catalogue.md`.
