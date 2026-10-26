/**
 * Life timeline, phase P1 (docs/reading-engine/27 §B.7): build the 18-year past grid blind, match a ledger, print the
 * calibration table next to a random monthly baseline. Deterministic, no model calls, no database writes.
 *
 *   TIMELINE_ENABLED=1 npx tsx scripts/timeline-past.ts                        # golden chart G1 + its made-up ledger
 *   TIMELINE_ENABLED=1 npx tsx scripts/timeline-past.ts --fixture G1 --as-of 2026-10-24 --ledger path/to/ledger.json
 *   TIMELINE_ENABLED=1 npx tsx scripts/timeline-past.ts --kundli <id>          # stored kundli + its life_events (read only)
 *   ... --kundli <id> --fetch                                                  # let ensureChartData call Radha for missing items
 *   ... --json out.json                                                        # also write the full result
 *
 * With --kundli the database must be configured (DATABASE_URL); dasha items are read from kundli_data (noFetch unless
 * --fetch) and transit_contacts are fetched from Radha (moving type, never stored).
 */
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTimelineEnabled } from '../src/reading/timeline/config.js';
import { fixtureInputs, kundliInputs, type TimelineInputs } from '../src/reading/timeline/inputs.js';
import { parseLedger, type LifeEvent } from '../src/reading/timeline/ledger.js';
import { MARKER_IDS, MARKERS } from '../src/reading/timeline/markers.js';
import { verifyPast } from '../src/reading/timeline/pipeline.js';
import { SYSTEM_LABELS } from '../src/reading/timeline/types.js';
import type { CalibrationRow } from '../src/reading/timeline/calibrate.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n: string): string | undefined => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (n: string): boolean => process.argv.includes(n);

const pct = (v: number | null): string => (v == null ? '   -' : `${Math.round(v * 100)}%`.padStart(4));
const num = (v: number | null, d = 2): string => (v == null ? '-' : v.toFixed(d));

async function main(): Promise<void> {
  if (!isTimelineEnabled()) {
    console.error('The life timeline is off. Run with TIMELINE_ENABLED=1.');
    process.exit(2);
  }
  const asOf = arg('--as-of') ?? '2026-10-24';
  const kundliId = arg('--kundli');
  let inputs: TimelineInputs | null;
  let events: LifeEvent[];
  let ledgerNote: string;
  if (kundliId) {
    const { prisma } = await import('../src/lib/prisma.js');
    const { readLedger } = await import('../src/reading/timeline/store.js');
    inputs = await kundliInputs(prisma, kundliId, asOf, { fetch: flag('--fetch') });
    if (!inputs) throw new Error('no dossier (kundli_facts) for that kundli');
    const ledger = arg('--ledger') ? parseLedger(JSON.parse(readFileSync(arg('--ledger')!, 'utf8'))).events : null;
    const stored = ledger ? null : await readLedger(prisma, kundliId);
    events = ledger ?? (stored?.status === 'found' ? stored.events : []);
    ledgerNote = ledger ? `ledger file ${arg('--ledger')}` : stored?.status === 'found' ? 'life_events table' : 'life_events unavailable (migration not applied?)';
    await prisma.$disconnect();
  } else {
    const chart = arg('--fixture') ?? 'G1';
    const dir = path.join(root, 'evals/fixtures', chart);
    inputs = fixtureInputs(dir, asOf);
    const ledgerPath = arg('--ledger') ?? path.join(dir, 'ledger.made-up.v1.json');
    const parsed = parseLedger(JSON.parse(readFileSync(ledgerPath, 'utf8')));
    events = parsed.events;
    ledgerNote = `${path.relative(root, ledgerPath)}${parsed.dropped ? ` (${parsed.dropped} malformed rows dropped)` : ''}`;
  }

  const t0 = Date.now();
  const v = verifyPast(inputs, events);
  const ms = Date.now() - t0;
  const b = v.build;

  console.log(`\nLife timeline P1 — past grid (blind cast), ${b.kundliId}, as of ${b.asOf}`);
  console.log(`Range ${b.range.from} .. ${b.range.to}: ${b.grid.months.length} months, monthly grain. Built in ${ms} ms, no model calls.`);
  console.log(`Systems: ${b.systems.map((s) => `${s} ${SYSTEM_LABELS[s]}`).join(', ')}`);
  console.log(`Dasha sources: ${Object.entries(b.stack.sources).map(([k, s]) => `${k}=${s}`).join(', ')}${b.stack.missing.length ? `; missing ${b.stack.missing.join(', ')}` : ''}`);
  console.log(`S3 weight: ${b.s3Applicable ? `full (${b.s3ApplicableEvidence})` : 'half (dasha.applicable does not list Ashtottari)'}; activations: ${b.activations.length}; transit contacts: ${inputs.contacts.reduce((s, p) => s + p.contacts.length, 0)}`);
  for (const n of b.notes) console.log(`  note: ${n}`);

  console.log('\nGrid by marker (months; testing = adverse windows)');
  console.log(`  ${'marker'.padEnd(18)} ${'high'.padStart(5)} ${'mod'.padStart(5)} ${'poss'.padStart(5)} ${'test'.padStart(5)} ${'quiet'.padStart(6)} ${'windows'.padStart(8)}`);
  for (const m of MARKER_IDS) {
    const cells = b.grid.cells[m];
    const count = (f: (c: (typeof cells)[number]) => boolean): string => String(cells.filter(f).length).padStart(5);
    const windows = b.grid.windows.filter((w) => w.marker === m && w.band !== 'possible').length;
    console.log(`  ${m.padEnd(18)} ${count((c) => c.band === 'high')} ${count((c) => c.band === 'moderate')} ${count((c) => c.band === 'possible')} ${count((c) => c.testing)} ${String(cells.filter((c) => c.band === 'quiet').length).padStart(6)} ${String(windows).padStart(8)}`);
  }
  console.log(`  quiet strips (every marker quiet): ${b.grid.quiet.length}${b.grid.quiet.length ? ` — e.g. ${b.grid.quiet[0]!.fromMonth}..${b.grid.quiet[0]!.toMonth} ${b.grid.quiet[0]!.lords}` : ''}`);

  console.log(`\nLedger: ${events.length} events from ${ledgerNote}`);
  for (const m of v.matches) {
    const w = m.window;
    const where = w ? `${w.band}${w.testing ? '/testing' : ''} ${w.fromMonth}..${w.toMonth} agent ${w.agent ?? '-'} channel ${w.channel ?? '-'}` : '';
    console.log(`  ${m.event.date} ${m.event.date_precision.padEnd(5)} ${m.event.category.padEnd(30)} ${String(m.marker ?? '-').padEnd(18)} ${m.result.padEnd(12)} d=${m.distance ?? '-'} rnd=${pct(m.baseline)} ${where}`);
  }
  const s = v.summary;
  console.log(`\nBlind-cast hit rate: ${s.hits}/${s.scored} = ${pct(s.hitRate)} (near ${s.near}, miss ${s.misses}); random monthly baseline at the same density: ${pct(s.baselineHitRate)}`);

  const header = `  ${'system'.padEnd(22)} ${'n'.padStart(3)} ${'win'.padStart(4)} ${'prec'.padStart(5)} ${'recall'.padStart(6)} ${'random'.padStart(6)} ${'lift'.padStart(5)} ${'cover'.padStart(5)} ${'weight'.padStart(13)}`;
  const line = (r: CalibrationRow): string => {
    const name = r.system === 'ALL' ? 'ALL (moderate+high)' : `${r.system} ${SYSTEM_LABELS[r.system]}`;
    const def = r.system === 'ALL' ? null : b.config.weights.systems[r.system];
    const weight = def == null ? '' : `${num(def, 2)} -> ${num(r.weight, 2)}${r.dropped ? ' drop' : ''}`;
    return `  ${name.padEnd(22)} ${String(r.n).padStart(3)} ${String(r.windows).padStart(4)} ${pct(r.precision).padStart(5)} ${pct(r.recall).padStart(6)} ${pct(r.baselineRecall).padStart(6)} ${num(r.lift).padStart(5)} ${pct(r.coverage).padStart(5)} ${weight.padStart(13)}`;
  };
  console.log('\nCalibration (pooled over markers with ledger events; ±1 month; weight = default x clamp(0.5 + precision, 0.5, 1.5))');
  console.log(header);
  for (const r of v.calibration.rows.filter((r) => r.marker === '*')) console.log(line(r));

  const withEvents = MARKER_IDS.filter((m) => v.calibration.rows.some((r) => r.marker === m && r.n > 0));
  console.log('\nRecall per system and marker (hits/events; random baseline in brackets)');
  console.log(`  ${'system'.padEnd(22)} ${withEvents.map((m) => m.slice(0, 14).padStart(16)).join('')}`);
  for (const sys of [...b.systems, 'ALL' as const]) {
    const cells = withEvents.map((m) => {
      const r = v.calibration.rows.find((x) => x.system === sys && x.marker === m)!;
      return `${r.hits}/${r.n} (${pct(r.baselineRecall).trim()})`.padStart(16);
    });
    console.log(`  ${(sys === 'ALL' ? 'ALL (moderate+high)' : `${sys} ${SYSTEM_LABELS[sys]}`).padEnd(22)} ${cells.join('')}`);
  }
  console.log(`\nMarkers: ${MARKER_IDS.map((m) => `${m} = ${MARKERS[m].label}`).join('; ')}`);

  const out = arg('--json');
  if (out) {
    writeFileSync(out, JSON.stringify({ summary: v.summary, calibration: v.calibration, matches: v.matches.map((m) => ({ ...m, window: m.window && { ...m.window, systems: undefined } })), windows: b.grid.windows, quiet: b.grid.quiet, notes: b.notes }, null, 2));
    console.log(`\nwrote ${out}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
