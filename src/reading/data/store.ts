/**
 * Reads what the pyjhora Lambda produced: the dossier (kundli_facts) and the per-kundli transit chart
 * (transit_snapshots). Both are cached in-process (warm Lambda containers reuse them) and the dossier is
 * re-selected for today's running dasha. Nothing here computes astrology.
 *
 * Latency design: `startPrefetch` is called before intake so the database read overlaps classification; a miss on the
 * transit chart is built lazily through the engine with a hard timeout and degrades to "no transits" rather than failing.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { authToAstroKundliParams } from '../../lib/astroKundliClient.js';
import { isUnsupportedError, loadMergedChartTypes, prismaChartDataRepo } from '../chartData/store.js';
import { CONTACT_PLANETS, fetchTransitContacts, TRANSIT_CONTACTS_TYPE, type TransitContactsPayload } from '../chartData/transitContacts.js';
import { readingCacheTtlMs, readingEngineTimeoutMs, readingFactsSource, readingFixtureDir } from '../config.js';
import { refreshCurrent } from '../facts/current.js';
import type { Dossier } from '../facts/types.js';
import { hashText } from '../packs/selector.js';
import { validateFacts, validateTransits } from '../schema/validate.js';
import type { TransitChart } from '../transits/types.js';
import { EngineContractError, EngineUnsupportedError, fetchTransitChart } from './engineClient.js';

export const FACTS_VERSION = 1;
export const TRANSIT_SNAPSHOT_VERSION = 1;

export interface ReadingData {
  source: 'db' | 'fixture';
  kundliId: string;
  dossier: Dossier;
  dossierHash: string;
  factsVersion: number;
  transits: TransitChart | null;
  transitSnapshotId: string | null;
  staleDossier: boolean;
  timings: { dossierMs: number; transitsMs: number; dossierCache: 'hit' | 'miss'; transitsCache: 'hit' | 'miss' | 'built' | 'none' };
  notes: string[];
}

interface Timed<T> {
  at: number;
  value: T;
}
const dossierCache = new Map<string, Timed<{ dossier: Dossier; hash: string; factsVersion: number }>>();
const transitCache = new Map<string, Timed<{ chart: TransitChart; id: string | null }>>();
const inflightTransit = new Map<string, Promise<{ chart: TransitChart; id: string | null } | null>>();
const contactsCache = new Map<string, Timed<TransitContactsPayload>>();
const inflightContacts = new Map<string, Promise<ContactsLookup>>();
/** Contacts are fetched once per kundli and day for the longest standard horizon (3y); each pack clips to its own. */
const CONTACTS_MONTHS = 36;
/** user -> latest kundli (id + stored coordinates); saves one database round trip per question on a warm instance */
const kundliByUser = new Map<string, Timed<{ id: string; lat: number | null; lon: number | null; tz: number | null }>>();

export function clearReadingCaches(): void {
  dossierCache.clear();
  transitCache.clear();
  kundliByUser.clear();
  inflightTransit.clear();
  contactsCache.clear();
  inflightContacts.clear();
}

const fresh = <T>(t: Timed<T> | undefined): T | null => (t && Date.now() - t.at < readingCacheTtlMs() ? t.value : null);
const addMonths = (iso: string, n: number): string => {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

function loadFixture<T>(name: string): T {
  const file = path.resolve(process.cwd(), readingFixtureDir(), name);
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export interface LoadOptions {
  asOf: string;
  /** Build the transit chart through the engine on a miss (default true) */
  buildTransitsOnMiss?: boolean;
  onFactsMissing?: (kundliId: string) => void;
  onStale?: (kundliId: string) => void;
}

/** Latest kundli with ready facts for this user; null when the dossier is not available (caller falls back). */
export async function loadReadingData(prisma: PrismaClient, userId: string, opts: LoadOptions): Promise<ReadingData | null> {
  const notes: string[] = [];
  if (readingFactsSource() === 'fixture') {
    const t0 = Date.now();
    const dossierRaw = loadFixture<unknown>('facts.v1.json');
    const v = validateFacts(dossierRaw);
    if (!v.ok) throw new EngineContractError(`fixture facts invalid: ${v.error}`);
    const tr = validateTransits(loadFixture<unknown>('transits.v1.json'));
    const { dossier } = refreshCurrent(v.value!, opts.asOf);
    return {
      source: 'fixture',
      kundliId: 'fixture-G1',
      dossier,
      dossierHash: hashText(JSON.stringify(v.value)),
      factsVersion: FACTS_VERSION,
      transits: tr.ok ? tr.value! : null,
      transitSnapshotId: null,
      staleDossier: false,
      timings: { dossierMs: Date.now() - t0, transitsMs: 0, dossierCache: 'miss', transitsCache: 'none' },
      notes: ['fixture'],
    };
  }

  let kundli = fresh(kundliByUser.get(userId));
  if (!kundli) {
    kundli = await prisma.kundli.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: { id: true, lat: true, lon: true, tz: true },
    });
    if (!kundli) return null;
    kundliByUser.set(userId, { at: Date.now(), value: kundli });
  }
  const k = kundli;

  const t0 = Date.now();
  let cached = fresh(dossierCache.get(kundli.id));
  const dossierCacheState: 'hit' | 'miss' = cached ? 'hit' : 'miss';
  // The stored transit chart is read in parallel with the dossier (no engine build here; that waits until the dossier exists).
  const transitLookup = loadTransitChart(prisma, userId, k, opts.asOf, false);
  if (!cached) {
    const row = await prisma.kundliFacts.findUnique({
      where: { kundli_id_facts_version: { kundli_id: k.id, facts_version: FACTS_VERSION } },
      select: { dossier: true, dossier_hash: true, facts_version: true },
    });
    if (!row) {
      void transitLookup.catch(() => undefined);
      opts.onFactsMissing?.(k.id);
      return null;
    }
    const v = validateFacts(row.dossier);
    if (!v.ok) {
      notes.push(`stored dossier invalid: ${v.error}`);
      void transitLookup.catch(() => undefined);
      opts.onFactsMissing?.(k.id);
      return null;
    }
    cached = { dossier: v.value!, hash: row.dossier_hash, factsVersion: row.facts_version };
    dossierCache.set(k.id, { at: Date.now(), value: cached });
  }
  const dossierMs = Date.now() - t0;
  const { dossier, stale } = refreshCurrent(cached.dossier, opts.asOf);
  if (stale) opts.onStale?.(k.id);
  // natal-degree contacts run beside the transit chart; this promise never rejects
  const contactsLookup = loadTransitContacts(prisma, k.id, opts.asOf);

  const t1 = Date.now();
  let tr = await transitLookup;
  if (!tr && opts.buildTransitsOnMiss !== false) tr = await loadTransitChart(prisma, userId, k, opts.asOf, true);
  const contacts = await contactsLookup;
  if (contacts.note) notes.push(contacts.note);
  // a copy: the cached chart stays as stored. null = fetch failed (the pack adds the caveat); skipped = not served yet
  if (tr && !contacts.skipped) tr = { ...tr, chart: { ...tr.chart, contacts: contacts.payload } };
  return {
    source: 'db',
    kundliId: k.id,
    dossier,
    dossierHash: cached.hash,
    factsVersion: cached.factsVersion,
    transits: tr?.chart ?? null,
    transitSnapshotId: tr?.id ?? null,
    staleDossier: stale,
    timings: { dossierMs, transitsMs: Date.now() - t1, dossierCache: dossierCacheState, transitsCache: tr ? tr.state : 'none' },
    notes,
  };
}

async function loadTransitChart(
  prisma: PrismaClient,
  userId: string,
  kundli: { id: string; lat: number | null; lon: number | null; tz: number | null },
  asOf: string,
  build: boolean
): Promise<{ chart: TransitChart; id: string | null; state: 'hit' | 'miss' | 'built' } | null> {
  const key = `${kundli.id}:${asOf}`;
  const hit = fresh(transitCache.get(key));
  if (hit) return { ...hit, state: 'hit' };

  const horizonEnd = addMonths(asOf, 12);
  const row = await prisma.transitSnapshot.findFirst({
    where: {
      kundli_id: kundli.id,
      snapshot_version: TRANSIT_SNAPSHOT_VERSION,
      from_date: { lte: new Date(asOf + 'T00:00:00Z') },
      to_date: { gte: new Date(horizonEnd + 'T00:00:00Z') },
    },
    orderBy: { built_at: 'desc' },
    select: { id: true, snapshot: true },
  });
  if (row) {
    const v = validateTransits(row.snapshot);
    if (v.ok) {
      // the stored chart was built on an earlier day; "now"/sade-sati-now are read by date from its rows
      const value = { chart: v.value!, id: row.id };
      transitCache.set(key, { at: Date.now(), value });
      return { ...value, state: 'miss' };
    }
  }
  if (!build) return null;

  let pending = inflightTransit.get(key);
  if (!pending) {
    pending = buildTransitChart(prisma, userId, kundli, asOf).finally(() => inflightTransit.delete(key));
    inflightTransit.set(key, pending);
  }
  const built = await pending;
  return built ? { ...built, state: 'built' } : null;
}

async function buildTransitChart(
  prisma: PrismaClient,
  userId: string,
  kundli: { id: string; lat: number | null; lon: number | null; tz: number | null },
  asOf: string
): Promise<{ chart: TransitChart; id: string | null } | null> {
  const timeout = readingEngineTimeoutMs();
  try {
    const auth = await prisma.auth.findUnique({ where: { id: userId }, select: { date_of_birth: true, place_of_birth: true, time_of_birth: true } });
    if (!auth) return null;
    authToAstroKundliParams(auth); // throws early on unparseable birth data
    const chart = await Promise.race([
      fetchTransitChart({ auth, coords: kundli }, { from: asOf, to: addMonths(asOf, 24), asOf }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`transit build exceeded ${timeout}ms`)), timeout)),
    ]);
    const saved = await prisma.transitSnapshot.create({
      data: {
        kundli_id: kundli.id,
        from_date: new Date(chart.from + 'T00:00:00Z'),
        to_date: new Date(chart.to + 'T00:00:00Z'),
        ayanamsa: chart.ayanamsa ?? 'LAHIRI',
        snapshot_version: TRANSIT_SNAPSHOT_VERSION,
        snapshot: chart as unknown as object,
      },
      select: { id: true },
    });
    const value = { chart, id: saved.id };
    transitCache.set(`${kundli.id}:${asOf}`, { at: Date.now(), value });
    return value;
  } catch (err) {
    const quiet = err instanceof EngineUnsupportedError;
    console[quiet ? 'info' : 'warn'](JSON.stringify({ msg: 'reading transit chart unavailable', kundliIdPrefix: kundli.id.slice(0, 8), error: (err as Error).message.slice(0, 300) }));
    return null;
  }
}

interface ContactsLookup {
  payload: TransitContactsPayload | null;
  /** true when Radha does not serve the type yet: nothing was asked, so there is nothing to report */
  skipped: boolean;
  note?: string;
}

/**
 * Radha's `transit_contacts` for today .. today + 3y (moving type: fetched, never stored per person; cached in-process
 * like the transit chart). Only asked when the merged catalog says Radha serves it. Never throws: a failure or a timeout
 * returns payload null and a note, and the reading goes on without contacts.
 */
export async function loadTransitContacts(prisma: PrismaClient, kundliId: string, asOf: string): Promise<ContactsLookup> {
  const key = `${kundliId}:${asOf}`;
  const hit = fresh(contactsCache.get(key));
  if (hit) return { payload: hit, skipped: false };
  let pending = inflightContacts.get(key);
  if (!pending) {
    pending = fetchContactsOnce(prisma, kundliId, asOf).finally(() => inflightContacts.delete(key));
    inflightContacts.set(key, pending);
  }
  return pending;
}

async function fetchContactsOnce(prisma: PrismaClient, kundliId: string, asOf: string): Promise<ContactsLookup> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const repo = prismaChartDataRepo(prisma);
    const served = (await loadMergedChartTypes(repo)).some((t) => t.id === TRANSIT_CONTACTS_TYPE && t.served);
    if (!served) return { payload: null, skipped: true };
    const timeout = readingEngineTimeoutMs();
    const payload = await Promise.race([
      fetchTransitContacts(kundliId, { from: asOf, to: addMonths(asOf, CONTACTS_MONTHS), planets: [...CONTACT_PLANETS] }, { repo }),
      new Promise<never>((_, rej) => {
        timer = setTimeout(() => rej(new Error(`transit contacts exceeded ${timeout}ms`)), timeout);
      }),
    ]);
    contactsCache.set(`${kundliId}:${asOf}`, { at: Date.now(), value: payload });
    return { payload, skipped: false };
  } catch (err) {
    const error = (err as Error)?.message?.slice(0, 300) ?? String(err);
    console[isUnsupportedError(err) ? 'info' : 'warn'](JSON.stringify({ msg: 'reading transit contacts unavailable', kundliIdPrefix: kundliId.slice(0, 8), error }));
    return { payload: null, skipped: false, note: `transit contacts unavailable: ${error.slice(0, 120)}` };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Start both reads now so they overlap intake. The promise never rejects. */
export function startPrefetch(prisma: PrismaClient, userId: string, opts: LoadOptions): Promise<ReadingData | null> {
  return loadReadingData(prisma, userId, opts).catch((err) => {
    console.warn(JSON.stringify({ msg: 'reading data load failed', error: (err as Error).message.slice(0, 300) }));
    return null;
  });
}
