# 35. Transit ephemeris cache: the sky stored once, shared by every kundli

Status: migration `20261031100000_transit_ephemeris_cache` applied to the live database 2026-10-31. Nothing reads this path yet.

## The rule this implements

Sachin, 2026-10-31: transit data "never expires and applies to each kundli the same way", so it must not be pulled again
for every kundli. And on houses: "always Radha returns it". Node never derives a house, not even as a sign-index lookup.

## What is shared and what is not

| Data | Depends on | Stored in |
| --- | --- | --- |
| Planet positions at an instant | instant, place (for the lagna), divisional factors, ayanamsa | `transit_instants` |
| Sign stays, stations, lunations, eclipses over a span | span, planets, place, flags, ayanamsa | `transit_range_skies` |
| `house_from_lagna`, `house_from_moon`, `natal_house`, contacts, sade sati, dhaiya | the kundli | `kundli_transit_overlays` |

The first two rows have no person in them. The third row is computed by Radha against the natal chart and stored per
kundli, so a repeat of the same span does not call Radha either.

## Tables (migration `20261031100000_transit_ephemeris_cache`)

- `transit_instants`: unique on (`place_key`, `at_utc`, `factors_key`, `ayanamsa`). Payload has no natal fields.
- `transit_range_skies`: unique on (`place_key`, `from_date`, `to_date`, `planets_key`, `flags_key`, `ayanamsa`). Payload
  has no natal block.
- `kundli_transit_overlays`: unique on (`kundli_id`, `kind`, `params_key`), `kind` is `range` or `contacts`. Deleted with
  the kundli.

All three carry `calc_version` and `source_hash`, so a later Radha change that alters an answer can be seen. The migration
only creates new tables, and re-running it is a no-op.

Keys: the place is two-decimal coordinates plus UTC offset (the same rounding as `chartData/place.ts`). The instant is a
UTC timestamp, so 12:00 at -08:00 and 20:00Z are one row. A bare local time is refused because it would be ambiguous.
Factors are sorted and deduplicated, so `[9, 1]` and `[1, 9]` are one row.

## Read path (`src/reading/transits/ephemerisCache.ts`)

- `getTransitSnapshot(at, place, factors)`: cache hit, or one Radha call at the place with no natal fields, then store.
- `getSharedRange(opts, place, anyKundliId)`: the same for a range. Radha's `transit_range` needs a kundli to name the
  place, so everything belonging to that person is stripped before it is stored.
- `getKundliOverlay(kundliId, kind, span, fetchFromRadha)`: the kundli's own Radha answer, stored once.
- `housesFromOverlay(overlay, planet, date)`: the houses Radha returned for the sign stay covering that date. It reads a
  returned value and does no arithmetic. Null when the range does not cover the date.

Concurrent askers for the same key inside one process share one Radha call. If the tables are not there, the path logs
once and calls Radha directly. A failed Radha call is never stored.

## Known limits

1. Snapshots and ranges are stripped differently. `stripNatal` (snapshots) removes `natal` and `natal_*`, and keeps
   `house_from_lagna` because in a snapshot cast at a place that is the transit chart's own lagna, not a person's. It is
   not a natal house, and no reader should present it as one. `stripRangeToSky` (ranges) also removes `house_from_lagna`,
   `house_from_moon`, `sade_sati`, `dhaiya` and every `*_houses` list, which in a range are all the person's.
2. `housesFromOverlay` answers per sign stay. That is right for the slow planets a range covers. A daily Moon house needs
   Radha's `step=day` rows. The deployed catalog lists `step` (month, day), but `transitRangeParams` does not pass it and
   `rangeKey` has no step.
3. The lagna in a snapshot depends on the place, so a snapshot is shared per place, not worldwide. Planet longitudes do
   not depend on the place, but they are stored with the place key rather than split out, to keep one payload per Radha
   answer.

## Backfill

`ingestSnapshot(at, place, factors, payload)` seeds a payload pulled earlier and strips natal fields on insert. On
2026-10-31, 337 rows were seeded from the `sachin` notes folder: 60 monthly 2026 to 2030 at Pune with factors 1, 9, 30, and
277 daily Oct 2026 to Jul 2027 at San Jose with factor 1. A further pull of daily Aug 2027 to Dec 2028 and monthly 2031 to
2037 stopped around 2028-09 when the session restarted; rerunning it skips stored rows.

## What needs Sachin's OK

1. Wiring this path into a reader. Nothing uses it yet.
