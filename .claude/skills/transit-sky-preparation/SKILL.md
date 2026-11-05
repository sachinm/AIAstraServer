---
name: transit-sky-preparation
description: Prepare, extend, check or repair the shared transit sky (planet positions by date, ingresses, stations, lunations, eclipses) that every reading and every user reads from. Use when a reading needs transit data for a date range that is not stored yet, when a gap or a malformed row turns up, or when someone proposes building transit charts per user.
---

# Transit sky preparation

## The rule: one sky for everyone

The sky on a date is the same for every user. A person is only added when you ask where a transit lands in their chart. So:

- **Shared, built once, never per user:** planet positions at an instant, sign stays, stations, lunations, eclipses. Stored in `transit_instants` and `transit_range_skies`. Neither table has a user or kundli column and neither may get one.
- **Per kundli, small, from the engine:** `house_from_lagna`, `house_from_moon`, `natal_house`, contacts with natal degrees, sade sati, dhaiya. Stored in `kundli_transit_overlays`. This is the only per-person transit data.
- Never build a full transit chart set for each new user. A new user costs one overlay pull per span, never a new sky.

Design and keys: `docs/reading-engine/35-transit-ephemeris-cache.md`. Code: `src/reading/transits/ephemerisCache.ts`.

## Hard rules

1. The engine (Radha) is the only source of astrological data. Node computes nothing astrological, not even a house lookup from a sign index. Keys are clock and coordinate arithmetic only.
2. Never write the engine's name in anything a user can see. This skill and the code are internal.
3. The engine calls here are not Gemini calls, but check the cost before a large pull and report the count first. No Gemini call without a yes from Sachin.
4. Pushes, Lambda deploys and live database writes go through the deploy sub-session. Run slow pulls in the background and keep working.
5. Kill any local server you started when the pull is done.

## What the shared sky holds

| Table | Key | Use |
|---|---|---|
| `transit_instants` | place key, UTC instant, factors key, ayanamsa | Daily or monthly snapshot. Current stock: San Jose noon (UTC-7 and UTC-8 keys) 2008 to 2035, Pune monthly 2025 to 2037 |
| `transit_range_skies` | place key, from, to, planets key, flags key, ayanamsa | Sign stays, stations, eclipses over a span. Current stock: 1975 to 2035 for Ju, Ke, Ra, Sa |

Place key is two-decimal coordinates plus UTC offset. The instant is a UTC timestamp, so 12:00 at -08:00 and 20:00Z are one row. A bare local time is refused. Factors are sorted and deduplicated.

The sky is shared per place, not worldwide, because the lagna in a snapshot depends on the place. Planet longitudes do not. Do not add a place for a user who lives within the same two-decimal key.

## Steps

1. **Find the gap.** Count stored instants for the place and window, and list missing dates. The dry run does this; for anything else a read-only query through Prisma raw SQL, run from inside the project folder so the client resolves. Use the table names above, not the model names.
2. **Check the shape.** Rows come in two shapes today: `{at_jd, at_local, charts:{d1:{lagna, planets}}, ...}` and a flat `{at_jd, lagna, planets, ...}`. Read both until the normalisation in `docs/TODOS.md` is done. Never assume `payload.charts.d1`.
3. **Pull only what is missing, with the jobs.** `npm run transits:sky -- --place sanjose --from 2026-01-01 --to 2028-12-31 --step day --dry-run` first (reads the cache, calls nothing), then the same without `--dry-run`. Whole calendar years, one engine call per missing year, no person in the request. `--step month` for the long view, `--step day` for the daily layer (the engine allows about two years per call). For a single instant use `getTransitSnapshot(at, place, factors)`. Both read the cache first and skip stored rows, so a pull that stopped halfway is safe to restart.
4. **Strip, then store.** `stripNatal` for snapshots, `stripRangeToSky` for ranges. If a payload still carries `natal`, `natal_*`, `house_from_moon`, `sade_sati`, `dhaiya` or a `*_houses` list, stop: it is a person's data and must not go in the shared tables.
5. **Verify.** Count rows for the window, spot-check three dates against a second source (an earlier stored row or the engine), and confirm the new rows have the same shape as the old.
6. **Report.** Window, place key, rows added, rows skipped, engine calls made, anything left undone.

## Per-user overlays

When a reading needs houses or contacts for one person, run `npm run transits:overlay -- --kundli <id> --from ... --to ... --step day --dry-run`, then without the flag. It stores the kundli's own engine answer once per kundli and span, with the daily Moon and planet houses (`natal_house`, `house_from_moon`). Never fill a gap by counting signs in Node or in a script. It is run for one kundli that needs it, never for all users.

If the engine call fails with "Could not load credentials", the machine's profile cannot invoke the engine Lambda. Do not try other credentials; hand the command to the deploy session.

## Do not

- Create a per-user transit table, a per-user transit build job, or a daily job that loops over users to rebuild the sky.
- Read a house out of a snapshot's own `house_from_lagna` and present it as the person's house. In a snapshot that is the transit chart's lagna at the place.
- Overwrite a stored row. Rows are append-only; a changed engine answer is shown by `calc_version` and `source_hash`.
