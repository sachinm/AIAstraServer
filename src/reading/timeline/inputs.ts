/**
 * What a past-timeline build reads (docs/reading-engine/27 §B.3): the dossier, the dasha catalogue items and the
 * `transit_contacts` ranges. All of it comes from Radha: natal types through the chart-data catalogue
 * (`ensureChartData`, stored in kundli_data), contacts through `fetchTransitContacts` (moving, never stored).
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type { Dossier } from '../facts/types.js';
import { asContactsPayload, CONTACT_PLANETS, fetchTransitContacts, type TransitContactsPayload } from '../chartData/transitContacts.js';
import { DASHA_APPLICABLE_TYPE, DASHA_TYPE_IDS } from './dashas.js';
import { addDaysIso, addMonthsIso } from './months.js';

export interface TimelineInputs {
  kundliId: string;
  asOf: string;
  dossier: Dossier;
  /** catalogue id -> Radha payload (dasha.* and dasha.applicable) */
  items: Record<string, unknown>;
  contacts: TransitContactsPayload[];
  /** what could not be read, for the report */
  notes: string[];
}

/** Catalogue ids a past build asks for */
export const TIMELINE_ITEM_IDS: readonly string[] = [...Object.values(DASHA_TYPE_IDS), DASHA_APPLICABLE_TYPE];

/** Radha's transit_contacts takes at most 3660 days per call; split [from, to] into ranges of `maxDays` */
export function contactRanges(from: string, to: string, maxDays = 3600): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  let s = from;
  while (s <= to) {
    const e = addDaysIso(s, maxDays) < to ? addDaysIso(s, maxDays) : to;
    out.push({ from: s, to: e });
    s = addDaysIso(e, 1);
  }
  return out;
}

/** The grid's date range: the first day of the month 18 years before `asOf` to the last day of `asOf`'s month */
export function pastRange(asOf: string, years: number): { from: string; to: string } {
  const from = `${addMonthsIso(asOf, -12 * years).slice(0, 7)}-01`;
  const to = addDaysIso(`${addMonthsIso(`${asOf.slice(0, 7)}-01`, 1)}`, -1);
  return { from, to };
}

/**
 * A golden chart from `evals/fixtures/<chart>/`: `facts.v1.json`, and Radha's exports saved under `catalog/`
 * (`dasha.<name>.json`, `dasha.applicable.json`, `transit_contacts.<from>_<to>.json`).
 */
export function fixtureInputs(dir: string, asOf: string, kundliId = `fixture-${path.basename(dir)}`): TimelineInputs {
  const read = (f: string): unknown => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  const dossier = read('facts.v1.json') as Dossier;
  const items: Record<string, unknown> = {};
  const contacts: TransitContactsPayload[] = [];
  const notes: string[] = [];
  const catalogDir = path.join(dir, 'catalog');
  let files: string[] = [];
  try {
    files = readdirSync(catalogDir);
  } catch {
    notes.push('no catalog/ folder: dashas from the dossier only, no transit contacts');
  }
  for (const f of files) {
    const id = f.replace(/\.json$/, '');
    if (TIMELINE_ITEM_IDS.includes(id)) items[id] = read(path.join('catalog', f));
    else if (id.startsWith('transit_contacts.')) {
      const p = asContactsPayload(read(path.join('catalog', f)));
      if (p) contacts.push(p);
      else notes.push(`${f}: not a transit_contacts payload`);
    }
  }
  return { kundliId, asOf, dossier, items, contacts, notes };
}

export interface KundliInputOptions {
  /** Let ensureChartData call Radha for missing items (it then writes kundli_data rows). Default false: read only. */
  fetch?: boolean;
  years?: number;
}

/**
 * A stored kundli: the dossier from kundli_facts, the dasha items through ensureChartData (noFetch unless `fetch`),
 * and the contacts for the past range from Radha (moving type; one call per <= 3600 days). A failure of any one part
 * is a note, not an error.
 */
export async function kundliInputs(prisma: PrismaClient, kundliId: string, asOf: string, opts: KundliInputOptions = {}): Promise<TimelineInputs | null> {
  const [{ FACTS_VERSION }, { ensureChartData, prismaChartDataRepo }] = await Promise.all([import('../data/store.js'), import('../chartData/store.js')]);
  const facts = await prisma.kundliFacts.findUnique({ where: { kundli_id_facts_version: { kundli_id: kundliId, facts_version: FACTS_VERSION } }, select: { dossier: true } });
  if (!facts?.dossier) return null;
  const notes: string[] = [];
  const repo = prismaChartDataRepo(prisma);
  const got = await ensureChartData({ repo }, kundliId, [...TIMELINE_ITEM_IDS], { noFetch: !opts.fetch });
  const items: Record<string, unknown> = {};
  for (const [id, item] of Object.entries(got)) {
    if (item.status === 'ready') items[id] = item.payload;
    else notes.push(`${id}: ${item.status}${item.error ? ` (${item.error.slice(0, 80)})` : ''}`);
  }
  const contacts: TransitContactsPayload[] = [];
  const range = pastRange(asOf, opts.years ?? 18);
  for (const r of contactRanges(range.from, range.to)) {
    try {
      contacts.push(await fetchTransitContacts(kundliId, { ...r, planets: CONTACT_PLANETS.filter((p) => p !== 'Ma') }, { repo }));
    } catch (err) {
      notes.push(`transit_contacts ${r.from}..${r.to}: ${String((err as Error)?.message ?? err).slice(0, 80)}`);
    }
  }
  return { kundliId, asOf, dossier: facts.dossier as unknown as Dossier, items, contacts, notes };
}
