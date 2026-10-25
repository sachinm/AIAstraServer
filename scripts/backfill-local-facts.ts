/**
 * Backfill chart-facts dossiers and transit charts for existing kundlis WITHOUT the Lambda `facts`/`transits` exports.
 * The astrology is computed by pyjhora (docs/reading-engine/drafts/radha/build_from_inputs.py); this script only moves
 * data: it exports birth inputs from the database and imports the validated results.
 *
 *   npx tsx scripts/backfill-local-facts.ts --export <inputs.json> [--kundli <id>]
 *   python docs/reading-engine/drafts/radha/build_from_inputs.py <inputs.json> <out_dir> <as_of>
 *   npx tsx scripts/backfill-local-facts.ts --import <out_dir> [--dry-run]
 *
 * Coordinates come from the kundli's stored `biodata` (what pyjhora resolved at sync), so nothing geocodes again.
 */
import 'dotenv/config';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { projectNatalPoints, sourceHash } from '../src/reading/data/factsBuilder.js';
import { FACTS_VERSION, TRANSIT_SNAPSHOT_VERSION } from '../src/reading/data/store.js';
import { hashText } from '../src/reading/packs/selector.js';
import { validateFacts, validateTransits } from '../src/reading/schema/validate.js';

export interface BirthInputRow {
  kundliId: string;
  dob: string;
  tob: string;
  lat: number;
  lon: number;
  tz: number;
  place: string;
}

/** "28 N 55' 00\", 77 E 01' 00\"" -> { lat: 28.9167, lon: 77.0167 } */
export function parseDmsPlace(s: string): { lat: number; lon: number } | null {
  const re = /(\d{1,3})\s*([NSEW])\s*(\d{1,2})'\s*(\d{1,2}(?:\.\d+)?)"?/g;
  const parts: Record<string, number> = {};
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const v = Number(m[1]) + Number(m[3]) / 60 + Number(m[4]) / 3600;
    const dir = m[2]!;
    if (dir === 'N' || dir === 'S') parts.lat = dir === 'S' ? -v : v;
    else parts.lon = dir === 'W' ? -v : v;
  }
  if (parts.lat === undefined || parts.lon === undefined) return null;
  return { lat: Math.round(parts.lat * 1e4) / 1e4, lon: Math.round(parts.lon * 1e4) / 1e4 };
}

/** "5:30:00" -> 5.5, "-7:00:00" -> -7 */
export function parseTz(s: string): number | null {
  const m = /^\s*([+-])?(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s);
  if (!m) return null;
  const v = Number(m[2]) + Number(m[3]) / 60 + Number(m[4] ?? 0) / 3600;
  return Math.round((m[1] === '-' ? -v : v) * 1e4) / 1e4;
}

/**
 * The stored biodata prints the offset without a sign for western zones ("7:00:00" for California). Solar time is
 * roughly longitude / 15 hours, so pick whichever sign lies closer to it.
 */
export function signedTz(tz: number, lon: number): number {
  const solar = lon / 15;
  return Math.abs(-tz - solar) < Math.abs(tz - solar) ? -tz : tz;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function doExport(prisma: PrismaClient, out: string, only?: string): Promise<void> {
  const rows = await prisma.kundli.findMany({
    where: only ? { id: only } : {},
    select: { id: true, biodata: true, user: { select: { date_of_birth: true, time_of_birth: true, place_of_birth: true } } },
  });
  const inputs: BirthInputRow[] = [];
  const skipped: Array<{ kundliId: string; reason: string }> = [];
  for (const r of rows) {
    const b = (r.biodata ?? null) as Record<string, unknown> | null;
    const bio = (b && typeof b === 'object' && 'data' in b ? (b.data as Record<string, unknown>) : b) ?? null;
    const dob = r.user.date_of_birth?.trim();
    const tob = r.user.time_of_birth?.trim();
    if (!dob || !tob) { skipped.push({ kundliId: r.id, reason: 'birth date or time missing' }); continue; }
    if (!bio) { skipped.push({ kundliId: r.id, reason: 'kundli never synced (no biodata)' }); continue; }
    const coords = parseDmsPlace(String(bio.place ?? ''));
    const tz = parseTz(String(bio.time_zone ?? ''));
    if (!coords || tz === null) { skipped.push({ kundliId: r.id, reason: 'biodata place/time_zone unparseable' }); continue; }
    inputs.push({ kundliId: r.id, dob: dob.slice(0, 10), tob: tob.length === 5 ? `${tob}:00` : tob, lat: coords.lat, lon: coords.lon, tz: signedTz(tz, coords.lon), place: String(bio.place_name ?? r.user.place_of_birth ?? '') });
  }
  writeFileSync(out, JSON.stringify(inputs, null, 1));
  console.log(JSON.stringify({ exported: inputs.length, skipped }));
}

async function doImport(prisma: PrismaClient, dir: string, dryRun: boolean): Promise<void> {
  const ids = [...new Set(readdirSync(dir).filter((f) => f.endsWith('.facts.json')).map((f) => f.replace('.facts.json', '')))];
  const results: Array<Record<string, unknown>> = [];
  for (const id of ids) {
    const facts = validateFacts(JSON.parse(readFileSync(path.join(dir, `${id}.facts.json`), 'utf8')));
    const trPath = path.join(dir, `${id}.transits.json`);
    const tr = existsSync(trPath) ? validateTransits(JSON.parse(readFileSync(trPath, 'utf8'))) : null;
    if (!facts.ok) { results.push({ id: id.slice(0, 8), status: 'invalid_facts', error: facts.error }); continue; }
    if (tr && !tr.ok) { results.push({ id: id.slice(0, 8), status: 'invalid_transits', error: tr.error }); continue; }
    const kundli = await prisma.kundli.findUnique({ where: { id }, select: { id: true, user: { select: { date_of_birth: true, time_of_birth: true, place_of_birth: true } } } });
    if (!kundli) { results.push({ id: id.slice(0, 8), status: 'kundli_missing' }); continue; }
    const dossier = facts.value!;
    const src = sourceHash([kundli.user.date_of_birth, kundli.user.time_of_birth, kundli.user.place_of_birth, FACTS_VERSION]);
    const dossierHash = hashText(JSON.stringify(dossier));
    if (dryRun) { results.push({ id: id.slice(0, 8), status: 'valid', transits: !!tr }); continue; }
    const ops = [
      prisma.kundliFacts.upsert({
        where: { kundli_id_facts_version: { kundli_id: id, facts_version: FACTS_VERSION } },
        create: { kundli_id: id, facts_version: FACTS_VERSION, engine_commit: dossier.engine.commit, ayanamsa: dossier.engine.ayanamsa, dossier: dossier as unknown as object, natal_points: projectNatalPoints(dossier as never) as object, dossier_hash: dossierHash, source_hash: src },
        update: { engine_commit: dossier.engine.commit, ayanamsa: dossier.engine.ayanamsa, dossier: dossier as unknown as object, natal_points: projectNatalPoints(dossier as never) as object, dossier_hash: dossierHash, source_hash: src, built_at: new Date() },
      }),
      prisma.kundli.update({ where: { id }, data: { facts_status: 'ready', lat: dossier.birth.lat, lon: dossier.birth.lon, tz: dossier.birth.tz, place_resolved: dossier.birth.place || null } }),
    ];
    const chart = tr?.value;
    if (chart) {
      ops.push(
        prisma.transitSnapshot.create({
          data: { kundli_id: id, from_date: new Date(chart.from + 'T00:00:00Z'), to_date: new Date(chart.to + 'T00:00:00Z'), ayanamsa: chart.ayanamsa ?? 'LAHIRI', snapshot_version: TRANSIT_SNAPSHOT_VERSION, snapshot: chart as unknown as object },
        }) as never
      );
    }
    await prisma.$transaction(ops as never);
    results.push({ id: id.slice(0, 8), status: 'stored', transits: !!chart, dossierHash });
  }
  console.log(JSON.stringify({ imported: results.filter((r) => r.status === 'stored').length, results }, null, 1));
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const exp = arg('--export');
    const imp = arg('--import');
    if (exp) await doExport(prisma, exp, arg('--kundli'));
    else if (imp) await doImport(prisma, imp, process.argv.includes('--dry-run'));
    else throw new Error('use --export <file> or --import <dir>');
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && /backfill-local-facts/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
