/**
 * Check stored day tables against a published reference (docs/reading-engine/47 Phase 0 close): for each place in the
 * reference file, read the `day_tables` row for that date and print the engine's value beside the reference with the
 * difference in minutes. Plain clock arithmetic on the engine's strings; nothing astrological is computed here.
 *
 *   npx tsx scripts/check-day-tables.ts [--ref evals/fixtures/day-tables/drik-reference-2026-11-05.json] [--tolerance 2]
 *
 * Exit code 1 when any exact field (sunrise, sunset, rahu kaal, yamaganda, gulika, abhijit, dur muhurta, brahma
 * muhurta) differs by more than the tolerance. Tithi, nakshatra and yoga ends are reported but not failed: the
 * reference page rounds some of them to the hour.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { DAY_TABLE_PLACES, dayTablePlaceKey } from '../src/reading/luckyTimes/places.js';

interface Clock {
  time?: string;
  day_offset?: number;
  hours?: number;
}
interface Window {
  start?: string | Clock;
  end?: string | Clock;
}
interface DayRow {
  sunrise?: string;
  sunset?: string;
  abhijit?: Window;
  rahu_kalam?: Window;
  yamagandam?: Window;
  gulikai?: Window;
  durmuhurtam?: Window[];
  brahma_muhurta?: Window;
  amrita_gadiya?: Array<Window & { star?: string }>;
  varjyam?: Array<Window & { star?: string }>;
  panchanga_at_noon?: {
    tithi?: { name?: string; end_hours?: number };
    nakshatra?: { name?: string; end_hours?: number };
    yoga?: { name?: string; end_hours?: number };
  };
}
interface RefPlace {
  sunrise: string;
  sunset: string;
  tithi: { name: string; upto: string };
  nakshatra: { name: string; upto: string };
  yoga: { name: string; upto: string };
  rahu_kalam: [string, string];
  yamaganda: [string, string];
  gulikai: [string, string];
  abhijit: [string, string];
  dur_muhurtam: Array<[string, string]>;
  varjyam: Array<[string, string]>;
  amrit_kalam: Array<[string, string]>;
  brahma_muhurta: [string, string];
}
interface RefFile {
  date: string;
  places: Record<string, RefPlace>;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** "HH:MM" or "HH:MM:SS" or "HH:MM+1" -> minutes from local midnight of the date (+1 adds a day). */
function refMinutes(s: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?(\+1)?$/.exec(s.trim());
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? 1440 : 0);
}

/** The engine's time: a "HH:MM:SS" string or a CLOCK {time, day_offset, hours}. */
function engineMinutes(v: string | Clock | undefined): number {
  if (v == null) return NaN;
  if (typeof v === 'string') return refMinutes(v);
  if (typeof v.hours === 'number') return Math.round(v.hours * 60);
  if (typeof v.time === 'string') return refMinutes(v.time) + (v.day_offset ?? 0) * 1440;
  return NaN;
}

function fmt(min: number): string {
  if (!Number.isFinite(min)) return '—';
  const d = Math.floor(min / 1440);
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${d > 0 ? `+${d}` : ''}`;
}

async function main(): Promise<void> {
  const refPath = arg('ref') ?? 'evals/fixtures/day-tables/drik-reference-2026-11-05.json';
  const tolerance = Number(arg('tolerance') ?? 2);
  const ref = JSON.parse(await readFile(refPath, 'utf8')) as RefFile;
  const { prisma } = await import('../src/lib/prisma.js');
  let failures = 0;

  for (const [key, r] of Object.entries(ref.places)) {
    const place = DAY_TABLE_PLACES[key];
    if (!place) {
      console.log(`${key}: not a known place preset, skipped`);
      continue;
    }
    const row = await prisma.dayTable.findUnique({
      where: { place_key_date_ayanamsa: { place_key: dayTablePlaceKey(place), date: new Date(`${ref.date}T00:00:00Z`), ayanamsa: 'LAHIRI' } },
    });
    if (!row) {
      console.log(`${key} ${ref.date}: no row in day_tables (pull it first)`);
      failures += 1;
      continue;
    }
    const d = row.payload as DayRow;
    console.log(`\n${place.name} ${ref.date} (engine calc_version ${row.calc_version ?? '?'}, offset ${row.utc_offset_hours})`);
    console.log(`  ${'field'.padEnd(16)} ${'engine'.padEnd(14)} ${'reference'.padEnd(14)} diff`);

    const exact: Array<[string, number, number]> = [
      ['sunrise', engineMinutes(d.sunrise), refMinutes(r.sunrise)],
      ['sunset', engineMinutes(d.sunset), refMinutes(r.sunset)],
      ['rahu kaal from', engineMinutes(d.rahu_kalam?.start), refMinutes(r.rahu_kalam[0])],
      ['rahu kaal to', engineMinutes(d.rahu_kalam?.end), refMinutes(r.rahu_kalam[1])],
      ['yamaganda from', engineMinutes(d.yamagandam?.start), refMinutes(r.yamaganda[0])],
      ['gulika from', engineMinutes(d.gulikai?.start), refMinutes(r.gulikai[0])],
      ['abhijit from', engineMinutes(d.abhijit?.start), refMinutes(r.abhijit[0])],
      ['abhijit to', engineMinutes(d.abhijit?.end), refMinutes(r.abhijit[1])],
      ['dur muhurta from', engineMinutes(d.durmuhurtam?.[0]?.start), refMinutes(r.dur_muhurtam[0]?.[0] ?? '')],
      ['brahma from', engineMinutes(d.brahma_muhurta?.start), refMinutes(r.brahma_muhurta[0])],
      ['brahma to', engineMinutes(d.brahma_muhurta?.end), refMinutes(r.brahma_muhurta[1])],
    ];
    for (const [name, e, x] of exact) {
      const diff = e - x;
      const bad = !Number.isFinite(diff) || Math.abs(diff) > tolerance;
      if (bad) failures += 1;
      console.log(`  ${name.padEnd(16)} ${fmt(e).padEnd(14)} ${fmt(x).padEnd(14)} ${Number.isFinite(diff) ? `${diff > 0 ? '+' : ''}${diff} min` : 'missing'}${bad ? '  <-- check' : ''}`);
    }

    const soft: Array<[string, string | undefined, number | undefined, string, string]> = [
      ['tithi', d.panchanga_at_noon?.tithi?.name, d.panchanga_at_noon?.tithi?.end_hours, r.tithi.name, r.tithi.upto],
      ['nakshatra', d.panchanga_at_noon?.nakshatra?.name, d.panchanga_at_noon?.nakshatra?.end_hours, r.nakshatra.name, r.nakshatra.upto],
      ['yoga', d.panchanga_at_noon?.yoga?.name, d.panchanga_at_noon?.yoga?.end_hours, r.yoga.name, r.yoga.upto],
    ];
    for (const [name, eName, eEnd, xName, xUpto] of soft) {
      const e = typeof eEnd === 'number' ? Math.round(eEnd * 60) : NaN;
      const x = refMinutes(xUpto);
      console.log(`  ${name.padEnd(16)} ${`${eName ?? '—'} ${fmt(e)}`.padEnd(29)} ${`${xName} ${fmt(x)}`.padEnd(29)} ${Number.isFinite(e - x) ? `${e - x > 0 ? '+' : ''}${e - x} min` : ''}  (noon value; reported only)`);
    }
    const varj = (d.varjyam ?? []).map((w) => `${fmt(engineMinutes(w.start))}–${fmt(engineMinutes(w.end))}`).join(', ') || '—';
    const amrit = (d.amrita_gadiya ?? []).map((w) => `${fmt(engineMinutes(w.start))}–${fmt(engineMinutes(w.end))}`).join(', ') || '—';
    console.log(`  ${'varjyam'.padEnd(16)} ${varj.padEnd(29)} ${r.varjyam.map((w) => `${w[0]}–${w[1]}`).join(', ')}  (reported only)`);
    console.log(`  ${'amrita gadiya'.padEnd(16)} ${amrit.padEnd(29)} ${r.amrit_kalam.map((w) => `${w[0]}–${w[1]}`).join(', ')}  (reference: amrit kalam; reported only)`);
  }

  await prisma.$disconnect();
  console.log(failures ? `\n${failures} exact field(s) outside ±${tolerance} min` : `\nAll exact fields within ±${tolerance} min`);
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
