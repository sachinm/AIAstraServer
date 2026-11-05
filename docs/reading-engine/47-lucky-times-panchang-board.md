# 47 — Lucky times: the daily panchang and good-and-bad windows, per place, with a personal layer, on a calendar

Status: **technique and build plan, 2026-11-05 (Fable).** No code written. Sachin's brief: a dashboard of lucky times
this week (and for which part of life), lucky times each day, abhijit muhurta and today's panchang; the data built in
the engine (it is generic, the same for everyone at a place, and differs only by latitude, longitude and time zone);
first the four US time zones and India, November 2026 daily; then a calendar-style board (Outlook or Apple Calendar)
for desktop, iPad and iPhone, guided by what Drik Panchang, Astrotalk, align27, Co-Star and JHora do. Facts checked
today in the engine repo and the server; market research the same day (sources at the end).

## 0. Answer first

1. **The engine already serves the day table.** The `muhurta` type takes a place and a date range (no birth data) and
   returns, per day: sunrise and sunset, abhijit, rahu kaal, yamaganda, gulika, dur muhurta, brahma muhurta, godhuli,
   vijaya, nishita, amrita gadiya, varjyam, the 30 muhurtas, the 24 horas and the noon panchanga (tithi, nakshatra,
   yoga, karana, weekday, hora lord, each with its end time). It handles daylight saving per date through `tz_name`.
   **November 2026 for five places can be pulled today with five calls and no engine change** (§5 Phase 0).
2. **What the engine must add** (one small pass, §3.3): moonrise and moonset, choghadiya and amrit kaal, the lunar month
   and samvatsara, a second tithi or star in the same day, chandrashtama, festivals and vrathas, udaya lagna, and
   resolving `tz_name` from its own cities file so callers need not pass it. All of these exist as functions in the
   engine; none is served.
3. **Shared per place, like the sky.** A day table depends only on the date and the place, so it is stored once per
   place and date (`day_tables`, keyed like `transit_range_skies`) and read by everyone there. Only three things are
   personal: tara bala, chandra bala and the Moon's house from the person's Moon, which come from one engine call per
   person per month and are stored as an overlay.
4. **Places first:** New York (Eastern), Chicago (Central), Denver (Mountain), San Jose (Pacific, the existing preset)
   and Pune (India, the existing preset), each with its IANA zone. Any latitude and longitude later, through the same
   key.
5. **Lucky times for which part of life** come from two published tables (hora lord → activities, choghadiya →
   activities, Drik Panchang's) crossed with the person's day: a window is *good for work* when a Sun or Jupiter hora
   or a Labh or Shubh choghadiya falls inside a good muhurta, outside every avoid band, on a day whose tara and chandra
   bala are good for the person, or whose Moon sits in the person's 10th. The same for love (Venus; 5th and 7th), money
   (Jupiter, Mercury; 2nd and 11th), travel (Moon, Venus; 3rd, 9th, 12th), study (Mercury, Jupiter; 4th, 5th), health
   routines (Sun, Moon; 1st, 6th: facts only).
6. **The board is a calendar.** Today (a Now card with the running window and a countdown, the day banner, the timed
   windows), Week (a time grid with solid *go* bands and hatched *avoid* bands, a today line) and Month (dots on the
   phone, bars on the iPad and desktop). Words follow doc 45: digested, no Sanskrit on the first screen, the Sanskrit
   name and the rule under "Why". The analogy of busy-and-free from Outlook and Apple Calendar is the visual grammar.
7. **Nobody labels windows by life area on a timeline** (align27 comes closest with its moments and rituals; Drik and
   Astrotalk list the windows without a person; Co-Star has no panchang at all). That is the product's edge.
8. **Recommendation:** pull November 2026 now with the served type, build the shared table and the personal overlay,
   ship the Today and Week views behind a flag, then open the engine pass for the missing pieces (§6).

## 1. Start: the system as it is (facts checked 2026-11-05)

| Fact | Where |
|---|---|
| The engine serves `muhurta` and `daily_grade` from `src/jhora/daily_export.py` (`run_daily`, `_run_muhurta`, `_day_windows`, `_panchanga`). `muhurta` needs only a place and `params.from/to`; the natal fields are optional and add `tara`, `chandra_bala`, `grade` at noon. `daily_grade` requires natal fields, spans up to 732 days, adds planets with their natal houses and events. `muhurta` is capped at 92 days (about 800 KB). | engine `daily_export.py`, `docs/daily-types.md`, test `test_api_muhurta_needs_no_birth_or_natal` |
| Per-date daylight saving: `_offset_hours(day, tz, tz_name)` takes the offset at local noon of each date and builds one `Place` per day; a test checks Los Angeles on 2026-10-31 and 11-01 (−7 then −8). Night windows that cross a change read an hour off the wall clock that night. | engine `daily_export.py`, `test_muhurta_sunrise_follows_the_offset_change` |
| The API takes `tz` as a fixed number and an IANA `tz_name` only inside `params` for the two daily types. `_resolve_place` knows 11 Indian cities and otherwise asks Nominatim for *today's* offset. The engine's own `data/world_cities_with_tz.csv` (about 162 k rows with IANA zones) is not used by the API. | engine `api.py:170-199`, `export._resolve_place`, `utils.get_location` |
| Functions that exist in `drik.py` and are not served: `moonrise`, `moonset`, `gauri_choghadiya`, `amrit_kaalam`, `lunar_month`, `lunar_month_date`, `samvatsara`, `ritu`, `chandrashtama`, `udhaya_lagna_muhurtha`, `panchaka_rahitha`, `pushkara/aadal/vidaal_yoga`, `disha_shool`, the vaasas, `anandhaadhi_yoga`, `thaaraabalam`, `chandrabalam`, `special_thaara`; `vratha.special_vratha_dates` for festivals. | engine `panchanga/drik.py`, `vratha.py` |
| `panchanga_at` returns the noon tithi, star, yoga and karana with start and end hours but drops a second tithi or star that begins the same day; `drik.nakshatra`'s start is wrong when the star began the previous day (the export works around it with `_star_span`). | engine `prashna_export.panchanga_at`, `daily_export._star_span` |
| The server has a shared sky cache per place (`transit_range_skies`, `transit_instants`, `kundli_transit_overlays`, doc 35) with presets `sanjose` (37.341, −121.894, tz −8) and `pune` (18.52, 73.857, 5.5) in `scripts/extend-transit-sky.ts`; `tz` is a fixed offset there too. | `prisma/schema.prisma:293-310`, `scripts/extend-transit-sky.ts:14-17` |
| `daily_grade` and `muhurta` are in the server catalog as moving types with no fetcher; `store.ts` refuses moving types. | `src/reading/chartData/catalog.ts`, `store.ts` (filed in TODOS 2026-11-05) |
| The web app has no today, calendar or panchang view; the Charts page shows the *birth* panchanga only. | doc 45 §1 |
| Running the engine locally: Python 3.12, `requirements.lambda.txt`, ephemeris bundled under `src/jhora/data/ephe`; `uvicorn jhora.api:app --port 8765` or a direct call to `run_export_by_type(... export_type='muhurta' ...)` as the tests do. No script writes a month of panchanga to a file. | engine `Dockerfile`, `pyproject.toml`, `tests/test_doc34_daily.py` |

**Symptom for the person today:** nothing in the app tells them whether this afternoon is a good time to sign, ask,
travel or rest, and nothing shows the day's panchang.

## 2. End goal

A person opens **Lucky times** and sees, in under a second from cache: the window running right now and how long it
lasts; today's good windows, each labelled with what it is good for (work, love, money, travel, study, rest) and the
avoid bands; the day's panchang in plain words with the Sanskrit under "Why"; the week as a calendar with go and avoid
bands; the month as dots. The data is identical for everyone at the same place and personalised by three facts from
their chart. On the phone it reads like Apple Calendar; on a desktop like Outlook's week. Everything is traceable to an
engine row, with the place, zone and offset shown. What can no longer go wrong: a wrong zone or a daylight-saving slip,
a window invented in Node, or a "lucky" label with no rule behind it.

## 3. Technique

### 3.1 The day table (generic, per place)

From the engine's `muhurta` rows (served) and the additions of §3.3:

| Block | Fields | Shown as |
|---|---|---|
| Sun and Moon | sunrise, sunset, moonrise*, moonset* | the day banner's edges; the Moon icon |
| Panchanga | tithi (name, paksha, until), nakshatra (name, pada, lord, until), yoga (until), karana (until), weekday, lunar month*, samvatsara*, ritu* | the banner, plain words ("Waxing Moon, day 11" with "Ekadashi" under Why); a second tithi or star in the day as "then …"* |
| Good windows | brahma muhurta, abhijit, vijaya (day and night), godhuli, nishita, amrita gadiya, amrit kaal*; the 15 day and 15 night muhurtas marked good | solid *go* blocks |
| Avoid bands | rahu kaal, yamaganda, gulika kaal, dur muhurta (one or two), varjyam (one or two for Moola), vaar vela / kaal vela / kaal ratri* | hatched *avoid* blocks; they override a good window they overlap |
| Horas | 24, with the lord | the thin hour strip; the lord gives the life area |
| Choghadiya* | 8 day, 8 night: Amrit, Shubh, Labh, Char (good), Rog, Kaal, Udveg (bad) | a second thin strip; the type gives the life area |
| Festivals and vrathas* | ekadashi, pradosham, amavasya, purnima, sankranti, chaturthi, shivaratri, named festivals | the all-day label |
| Udaya lagna*, chandrashtama sign*, panchaka* | | under Why; chandrashtama feeds the personal layer |

\* = §3.3 engine additions.

### 3.2 The personal layer (three facts, one engine call per person per month)

| Fact | Engine field | Rule shown |
|---|---|---|
| **Tara bala**: the day's star counted from the person's birth star, nine taras | `muhurta` with natal → `days[].tara` (or `daily_grade.tara`) | Sampat, Kshema, Sadhaka, Mitra, Param Mitra: good; Janma: intense; Vipat, Pratyari, Naidhana: avoid big starts. Drik's wording, so a reader can check it anywhere |
| **Chandra bala**: the Moon's sign counted from the person's Moon | `days[].chandra_bala` | 1, 3, 6, 7, 10, 11 good; 4, 8, 12 bad (8 = chandrashtama, about 2½ days); 2, 5, 9 mixed |
| **The Moon's house today** from the person's lagna and Moon | `daily_grade.planets.Mo.natal_house`, `house_from_moon` | the *theme*: 10 → work; 7 and 5 → love; 2 and 11 → money; 3, 9, 12 → travel; 4 and 5 → study and home; 1 and 6 → body and routine (facts only) |
| Day grade | `days[].grade` (the engine's combination of the two balas) | the day colour: good / steady / careful |

Never computed in Node: the three facts are read from the engine's rows, stored in `kundli_day_overlays`, and only
selected and counted here.

### 3.3 Engine additions (one pass; functions exist, types do not)

| Addition | Function | Served how |
|---|---|---|
| Moonrise, moonset | `drik.moonrise`, `drik.moonset` | new keys in `muhurta` days |
| Choghadiya (16) and amrit kaal | `drik.gauri_choghadiya`, `drik.amrit_kaalam` | `days[].choghadiya[]`, `days[].amrit_kaal[]` |
| Lunar month (adhika/nija), samvatsara, ritu, saka and vikrama years | `drik.lunar_month_date`, `drik.samvatsara`, `drik.ritu`, `drik.elapsed_year` | `days[].calendar{}` |
| A second tithi, star, yoga or karana in the day; values at sunrise as well as noon | the extra tuple `drik.tithi`/`nakshatra`/`yogam` already return; `panchanga_at` drops it | `days[].panchanga_at_sunrise`, `days[].changes[]` ("Ekadashi until 14:12, then Dwadashi") |
| Chandrashtama sign, udaya lagna table, panchaka rahita, pushkara/aadal/vidaal yoga, disha shool, vaasas, anandadi yoga | `drik.chandrashtama`, `udhaya_lagna_muhurtha`, `panchaka_rahitha`, `pushkara_yoga`, `aadal_yoga`, `vidaal_yoga`, `disha_shool`, `shiva_vaasa`, `agni_vaasa`, `yogini_vaasa`, `anandhaadhi_yoga` | `days[].extras{}` (behind a `params.extras=true` switch to keep the default payload small) |
| Festivals and vrathas for the span | `vratha.special_vratha_dates(place, from, to, type)` for the keys in §1, plus `sankranti_dates` | `days[].observances[]` |
| Vaar vela, kaal vela, kaal ratri | derived from choghadiya and weekday (Prokerala's rule) | flags on the choghadiya rows |
| `tz_name` from the place | look up `data/world_cities_with_tz.csv` (nearest city) in `_resolve_place` when no `tz_name` is given | the API's own; the server still passes `tz_name` for the presets |
| Span | keep 92 days; the server pulls by quarter | |

Each addition gets a row in `docs/daily-types.md`, a unit test against Drik Panchang's published values for one day in
each of the five places (the research agent verified Drik's grammar today), and a `calc_version` bump so the server
refetches.

### 3.4 Lucky times by life area (the rule table, config with its source)

| Area | Hora lords that suit it | Choghadiya | Personal boost | Avoid |
|---|---|---|---|---|
| **Work** (sign, ask, present, start) | Sun (authority), Jupiter (finance, growth), Mercury (trade, paperwork) | Labh, Shubh, Amrit | Moon in the person's 10th or 11th; tara good | Saturn hora for anything quick; Rog, Kaal, Udveg; every avoid band |
| **Love** (ask, meet, talk it through) | Venus, Moon, Jupiter | Amrit, Shubh, Char | Moon in 5th or 7th; chandra bala good | Mars hora; Udveg; Moon in 8th from the person's Moon |
| **Money** (pay, invest, negotiate) | Jupiter, Mercury | Labh, Amrit | Moon in 2nd or 11th | Kaal (except long-term saving, Drik's note); Rahu kaal |
| **Travel** (set out) | Moon, Venus, Mercury | Char, Amrit | Moon in 3rd, 9th or 12th; disha shool not in that direction* | Varjyam, Yamaganda; Rog |
| **Study** (learn, exam, write) | Mercury, Jupiter | Shubh, Labh | Moon in 4th or 5th | Rahu kaal, Gulika |
| **Home and rest** (routine, repair, rest) | Moon, Saturn (steady work) | Shubh, Amrit; Saturn hora for long chores | Moon in 4th | Dur muhurta for anything new |
| **Body and routine** (facts only) | Sun, Moon | Amrit, Shubh | Moon in 1st or 6th; brahma muhurta | Chandrashtama days for anything demanding |

Sources: Drik Panchang's choghadiya and hora tutorials (hora lord meanings: Sun "vigorous", Moon "gentle", Mars
"aggressive", Mercury "quick", Jupiter "fruitful", Venus "beneficial", Saturn "sluggish"); Prokerala's vela rule. The
sources differ on the hora lists, so the table names one source per cell and the app's Why sheet cites it.

**Scoring a window for an area** (code over stored rows):

```
window = each hora ∩ choghadiya ∩ muhurta cell inside the day, cut by every avoid band (a cut-out, never a fade)
score(area) = +2 good muhurta (abhijit, amrit kaal, brahma, vijaya) · +2 hora suits · +1 choghadiya suits
            · +1 Moon in the area's houses · +1 tara good · +1 chandra bala good
            · −∞ inside an avoid band · −2 chandrashtama · −1 Janma tara (intense)
lucky times this week (area) = the top three windows by score across the seven days, at least one per day when any
scores ≥ 4; a day with none says "No strong window; the morning before {rahu kaal} is the quiet choice"
```

### 3.5 The places and the month

| Key | Place | Lat, lon | Zone | Note |
|---|---|---|---|---|
| `newyork` | New York, US | 40.7128, −74.0060 | America/New_York | Eastern |
| `chicago` | Chicago, US | 41.8781, −87.6298 | America/Chicago | Central |
| `denver` | Denver, US | 39.7392, −104.9903 | America/Denver | Mountain |
| `sanjose` | San Jose, US | 37.341, −121.894 | America/Los_Angeles | Pacific; the existing sky preset |
| `pune` | Pune, IN | 18.52, 73.857 | Asia/Kolkata | India; the existing sky preset (Delhi added when asked) |

November 2026: US daylight saving ended on Sunday 1 Nov 2026 at 02:00, so every November row is standard time; the one
caveat is the night of 31 Oct → 1 Nov, outside the month. Five calls of 30 days each, well under the 92-day cap, about
270 KB per place. The pull goes through the deploy session (engine credentials) or the Lambda from the server with the
existing client.

## 4. Deliverable

| Area | Items |
|---|---|
| Engine | the additions of §3.3 in `daily_export.py` and `docs/daily-types.md`, tests per place; `calc_version` 2 for `muhurta` |
| Server, data | migration `day_tables` (place_key, date, tz_name, utc_offset_hours, calc_version, engine_commit, payload jsonb; unique on place_key + date + ayanamsa) and `kundli_day_overlays` (kundli_id, date, tara, chandra_bala, grade, moon_natal_house, moon_from_moon, calc_version); `scripts/pull-day-tables.ts --place <key> --from --to`; `scripts/pull-day-overlay.ts --kundli --month`; the `muhurta` fetcher (no astrology) |
| Server, engine module | `src/reading/luckyTimes/{areas.config.ts,windows.ts,week.ts,panchangWords.ts}` and routes `src/routes/luckyRoutes.ts`; `noAstrologyInNode` test extended |
| Web | the **Lucky times** tab: `TodayView`, `WeekView`, `MonthView`, `NowCard`, `DayBanner`, `WindowBlock`, `WhySheet`, `PlacePicker`; tokens from doc 45; i18n strings |
| Docs | this plan; TODOS rows for the engine findings (the `nakshatra` start bug, the noon-only panchanga, the Nominatim offset) |

## 5. How it works when done

### 5.1 Backend

1. **Shared pull** (`scripts/pull-day-tables.ts`, run by the deploy session or a nightly job from the 1st of each month
   for the next 92 days): for each place preset, `POST /api/export-horoscope { type: 'muhurta', lat, lon, tz, params: { from, to, tz_name } }`,
   one call per place per quarter, 120 s timeout, the existing throttle; upsert one `day_tables` row per day; skip rows
   whose `calc_version` matches. Five places × 4 quarters = 20 calls a year.
2. **Personal overlay** (`ensureDayOverlay(kundliId, month)`): one `muhurta` call with `params.natal_*` for the month
   (or `daily_grade` when the Moon's natal house is wanted, which it is), upsert `kundli_day_overlays`; triggered on the
   first open of the tab for a month and by the registration queue for the current month; at most one call per person
   per month; a failure leaves the generic view with "Your personal layer is being prepared".
3. **Read** (`GET /api/lucky/day|week|month`): join `day_tables` for the person's place key and dates with their overlay
   rows; compute windows and area scores (§3.4) in code; cache the result per (place, date, kundli, calc_version) for
   the day; under 50 ms from cache.
4. **Place**: the person's current place (`user_current_location`, already stored for chat) mapped to the nearest preset
   within 150 km; otherwise "Pick a city" with the five presets (v1). Later: any lat/lon creates a new place key and a
   pull on demand (one call for the current quarter, 10–20 s, shown as "Preparing your city").

### 5.2 API

| Endpoint | Request | Response |
|---|---|---|
| `GET /api/lucky/day` | `?date=&place=` | `{ place:{key,name,tz_name,offset}, banner:{sun,moon,panchanga[],observances[],day_colour,personal?}, now:{window,ends_in}, windows:[{from,to,kind:go|avoid|neutral,label,areas[],score_by_area,why[]}], horas[], choghadiya[], why_sources[] }` |
| `GET /api/lucky/week` | `?start=&place=` | seven `day` payloads reduced (banner + windows) plus `lucky:[{area, windows:[{date,from,to,score,why[]}]}]` |
| `GET /api/lucky/month` | `?month=&place=` | per day: `day_colour`, `best_area`, `observances[]`, `personal.grade?` |
| `POST /api/lucky/place` | `{ key }` or `{ lat, lon }` | 204; v1 accepts the five keys only |
| `GET /api/lucky/export.ics` | `?from=&to=&areas=` | an ICS of go windows by area (Phase 3) |

Errors: 404 when the place has no table for the date (the client shows "Not prepared for this date yet"), 202 while a
personal overlay is being pulled, 400 for a date outside the stored span.

### 5.3 Frontend experience

| Screen | Phone (375) | iPad and desktop |
|---|---|---|
| **Today** (default) | Now card (the running window, "good for money and study, 38 min left", or "Avoid until 15:10: rahu kaal"); the day banner (date, place, sunrise–sunset, the Moon, two plain lines of panchang, day colour); a vertical list of windows in time order, go blocks solid, avoid blocks hatched, each with area chips; "Why" opens a sheet with the Sanskrit names and the rule; place picker in the header | the same, with the week's seven day banners as a strip above |
| **Week** | a 7-column compact grid, 06:00–22:00 default, go and avoid bands, a red today line, tap a band for its sheet; below it "Lucky times this week" grouped by area (three rows each) | Outlook-style week grid, full day height, the area list in a right pane |
| **Month** | iOS-style: a coloured dot per day (day colour), observance marks; tap a day → Today | bars per day: the best window per area; tap → Day |
| **Why** | per window: the muhurta, hora and choghadiya names, the tara and chandra bala, the source line | same |
| States | not prepared (the place has no table yet: "Preparing your city", poll 3 s up to 30 s); generic only (overlay pending: a small line, no blocking); ready; failed ("Showing the generic day") | |

Words: "Lucky times", "Good for", "Better to wait", "Quiet choice"; no Sanskrit outside Why; never "guaranteed";
health rows are facts only. Day colours are words first (good / steady / careful) and colour second.

## 6. Architecture

```
Engine Lambda (muhurta v2, daily_grade) ──pull per place per quarter──> day_tables (shared, keyed by place + date)
                                        ──one call per person per month──> kundli_day_overlays
Web Lucky times ──GET──> /api/lucky/* ──> luckyTimes/windows.ts (select, cut, count; no astrology) ──> cache per day
Place presets (5) ──> place_key ──> the same key as the shared sky (doc 35) for later reuse of transit rows
```

Boundaries: every time, name and bala comes from the engine row; Node cuts windows by avoid bands and sums the area
scores from the config table; the config table carries its source per cell.

## 7. Ingredients

| Need | Who |
|---|---|
| Five `muhurta` pulls for Nov 2026 (and the quarter) | deploy session (engine credentials), or the server's client once the fetcher exists |
| Engine pass for §3.3 | Sachin opens it (this brief names the work); then an agent in the engine repo with its tests |
| Migrations on the test database | agent, standing OK |
| Drik Panchang reference values for one day per place (for the tests) | agent (read from the public page; cited) |
| `VITE_LUCKY_ENABLED`, `LUCKY_ENABLED` on staging | deploy session |
| A decision on the tab name ("Lucky times" or "Good times") and on the free tier | Sachin |

## 8. Action steps in sequence

1. Migration `day_tables` and `kundli_day_overlays`; the `muhurta` and `daily_grade` fetchers (moving-type path in
   `store.ts` is bypassed by a dedicated client call, no astrology). Parallel with 2.
2. `scripts/pull-day-tables.ts` with the five presets; pull Nov 2026 (deploy session) and check one day per place against
   Drik Panchang's page (sunrise, rahu kaal, abhijit, tithi "upto"). Depends on 1.
3. `areas.config.ts` (§3.4 with sources), `windows.ts` (cut and score), `week.ts`, `panchangWords.ts`; unit tests on the
   pulled rows; the `noAstrologyInNode` test extended to this module.
4. Routes and cache; `GET day|week|month`.
5. Web: Today, Week, Month, Now card, Why sheet, place picker; the banned-word test over the strings; screenshots at
   375, 820 and 1280.
6. Personal overlay: `pull-day-overlay.ts` and `ensureDayOverlay`; the Moon-house theme; "Lucky times this week" by
   area. Depends on 3.
7. Engine pass (§3.3), after Sachin opens it; `calc_version` 2; refetch; the banner gains moonrise, lunar month,
   observances and "then …" changes; choghadiya strip appears.
8. Phase 3: ICS export, a Now widget, any-place pulls on demand, more places.

## 9. Development phases

| Phase | Steps | Ships | Check that closes it | Deferred |
|---|---|---|---|---|
| 0 Data | 1, 2 | Nov 2026 for five places in `day_tables` | 150 rows; one day per place matches Drik's sunrise, rahu kaal and abhijit within a minute | |
| 1 Board, generic | 3, 4, 5 | Today, Week, Month from the shared table, behind a flag | screenshots at three widths; no banned words; every window traceable to a row | personal layer |
| 2 Personal | 6 | tara, chandra bala, Moon-house theme; "Lucky times this week" by area | one person's month shows different area picks from the generic view, with Why | |
| 3 Engine pass | 7 | moonrise, choghadiya, calendar names, observances, second tithi, chandrashtama | tests per place; the banner complete | |
| 4 Extras | 8 | ICS, widget, any place | | |

## 10. Recommendation

Pull the month now with the served type and build the board on it; open the engine pass for the missing pieces in
parallel; keep the data shared per place and the person's layer to three facts. Treat the calendar's busy-and-free
grammar as the design, and the life-area labels as the feature nobody else has.

| Option | Verdict |
|---|---|
| **Shared day table per place from the served `muhurta` type, personal overlay from one call per month, calendar board (chosen)** | Nothing to build in the engine before the first screen; 20 engine calls a year for five places |
| Compute the panchang in Node from the ephemeris | Rejected: the engine-only rule |
| Per-person daily calls (`daily_grade` for everyone, every day) | Rejected: thousands of calls for data that is the same per place |
| A text panchang page like Drik or Astrotalk | Rejected: a wall of Sanskrit; not what the person asked for |
| Choghadiya-only "traffic light" like align27's day colour | Rejected as the whole: it is one strip of ours; we keep the windows and the areas |
| Wait for the engine pass before any screen | Rejected: the served rows already give the Today and Week views |

## 11. Open points for Sachin

1. Open the engine pass for §3.3 (small, well-defined; functions exist).
2. The tab name: **Lucky times** (your words) or **Good times**; I recommend Lucky times.
3. Free or paid: generic Today free; Week by area and the personal layer paid (fits the market norms of doc 45 §2).
4. Delhi beside Pune for India, or Pune alone, for the first pull.

## Sources

- Drik Panchang day page, choghadiya, hora, chandrabalam and tarabalam pages: https://www.drikpanchang.com/panchang/day-panchang.html , https://www.drikpanchang.com/muhurat/choghadiya.html , https://www.drikpanchang.com/muhurat/hora.html , https://www.drikpanchang.com/panchang/chandrabalam/chandrabalam-timings.html , https://www.drikpanchang.com/panchang/tarabalam/tarabalam-timings.html ; choghadiya tutorial https://www.drikpanchang.com/tutorials/muhurat/daily/choghadiya-muhurat.html
- Astrotalk panchang, choghadiya and hora: https://astrotalk.com/panchang , https://www.astrotalk.com/panchang/choghadiya , https://www.astrotalk.com/panchang/hora
- align27 (day colour, moments, planner, calendar sync): https://align27.com/ , https://apps.apple.com/app/id1364184571
- Co-Star (no panchang; day-at-a-glance only): https://www.costarastrology.com/faq
- JHora features (panchanga per day, horas, moonrise): https://www.vedicastrologer.org/jh/features.htm
- Prokerala choghadiya and panchang (vela rule): https://www.prokerala.com/astrology/choghadiya.php , https://www.prokerala.com/astrology/panchang/2026-november-05.html
- AstroSage choghadiya colours: https://www.astrosage.com/chogadia.asp ; mPanchang: https://www.mpanchang.com/muhurat/choghadiya/
- Calendar conventions: iOS 18 month densities https://www.macrumors.com/2024/06/18/ios-18-whats-new-in-the-calendar-app/ ; Apple Calendar week https://support.apple.com/en-hk/guide/calendar/icl26668/mac ; Outlook views https://support.microsoft.com/en-us/office/welcome-to-your-calendar-6fb9225d-9f9d-456d-8c81-8437bfcd3ebf ; Fantastical availability glyphs https://flexibits.com/fantastical-windows/help/calendar-views
- Hora meanings (second source): https://dekhopanchang.com/hora
