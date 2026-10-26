/**
 * S-5: the kundli queue fetches the registration set through ensureChartData (docs/reading-engine/22 §7).
 * In-memory chart-data repo + fake Radha fetcher + a small fake Prisma; no network, no database.
 */
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('../../src/services/geminiCacheService.js', () => ({ ensureGeminiCacheForUser: vi.fn(async () => undefined) }));
vi.mock('../../src/reading/data/factsBuilder.js', () => ({ scheduleFactsBuild: vi.fn() }));

import { processKundliSyncQueue } from '../../src/services/kundliQueueService.js';
import { BUILTIN_CHART_TYPES, type ChartTypeRow } from '../../src/reading/chartData/catalog.js';
import { fetchRegistrationSet, registrationSet } from '../../src/reading/chartData/registration.js';
import { clearChartDataCaches, type ChartDataRepo, type FetchResult, type KundliRequest, type RowKey, type StoredRow } from '../../src/reading/chartData/store.js';
import { KUNDLI_JSON_FIELDS } from '../../src/lib/astroKundliClient.js';
import { getKundliQueueMaxFetchesPerUser } from '../../src/config/env.js';

const fixture = (name: string): unknown => JSON.parse(readFileSync(path.resolve('tests/fixtures/dasha', name), 'utf8'));

const LEGACY_COLUMNS = Object.fromEntries(KUNDLI_JSON_FIELDS.map((f) => [f, null])) as Record<string, unknown>;

/** The kundlis row the fake Prisma and the repo's readLegacy share. */
function makeKundli(columns: Record<string, unknown> = {}) {
  const row = {
    id: 'k1',
    user_id: 'u1',
    queue_status: 'pending',
    queue_completed_at: null as Date | null,
    last_sync_error: null as string | null,
    created_at: new Date(),
    lat: 28.6,
    lon: 77.2,
    tz: 5.5,
    ...LEGACY_COLUMNS,
    ...columns,
    user: { date_of_birth: '1990-01-01', place_of_birth: 'Delhi, India', time_of_birth: '10:00:00' },
  };
  // the legacy JSON columns are read by name
  return row as typeof row & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
type FakeKundli = ReturnType<typeof makeKundli>;

function fakePrisma(kundli: FakeKundli) {
  const authUpdate = vi.fn(async () => ({}));
  const prisma = {
    kundli: {
      findMany: vi.fn(async () => (kundli.queue_status === 'pending' ? [kundli] : [])),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(kundli, data)),
      findUnique: vi.fn(async ({ select }: { select: Record<string, boolean> }) => Object.fromEntries(Object.keys(select).map((k) => [k, (kundli as Record<string, unknown>)[k]]))),
    },
    auth: { update: authUpdate },
  } as unknown as PrismaClient;
  return { prisma, authUpdate };
}

/** In-memory repo with the claim semantics of the SQL (chartData.test.ts style). */
function memRepo(kundli: FakeKundli, catalogRows: ChartTypeRow[] = []) {
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const repo: ChartDataRepo & { rows: typeof rows } = {
    rows,
    async loadTypes() {
      return catalogRows;
    },
    async readRows(_id, keys) {
      return keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r));
    },
    async readLegacy(_id, columns) {
      return Object.fromEntries(columns.map((c) => [c, (kundli as Record<string, unknown>)[c] ?? null]));
    },
    async claim(_id, key, params) {
      const r = rows.get(k(key));
      if (r && r.status === 'fetching') return false;
      rows.set(k(key), { ...(r ?? { payload: null, calcVersion: null, error: null, fetchedAt: null, validTo: null }), ...key, params, status: 'fetching', fetchStartedAt: new Date() } as StoredRow);
      return true;
    },
    async complete(_id, key, _ay, result: FetchResult) {
      const prev = rows.get(k(key));
      rows.set(k(key), {
        ...key,
        params: prev?.params ?? {},
        calcVersion: result.calcVersion,
        payload: result.status === 'ready' ? result.payload : (prev?.payload ?? null),
        status: result.status,
        error: result.error ?? null,
        fetchStartedAt: prev?.fetchStartedAt ?? null,
        fetchedAt: new Date(),
        validTo: result.validTo ?? null,
      });
    },
    async kundliRequest() {
      return { params: { dob: '1990-01-01', tob: '10:00:00', place: 'Delhi,IN', ayanamsa: 'LAHIRI' }, coords: { lat: 28.6, lon: 77.2, tz: 5.5 } };
    },
  };
  return repo;
}

function catalogRow(id: string, over: Partial<ChartTypeRow>): ChartTypeRow {
  const t = BUILTIN_CHART_TYPES.find((x) => x.id === id)!;
  return {
    id,
    family: t.family,
    radha_type: t.radhaType,
    change_class: t.changeClass,
    tier: t.tier,
    variant_kind: t.variantKind,
    served: t.served,
    calc_version: t.calcVersion,
    legacy_column: t.legacyColumn ?? null,
    sort_order: t.sortOrder,
    label: t.label,
    enabled: true,
    ...over,
  };
}

/** Fake Radha: records the order of calls and the peak number in flight. */
function fakeFetcher(over: Record<string, () => unknown> = {}) {
  const calls: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const fetcher = vi.fn(async (_req: KundliRequest, radhaType: string) => {
    calls.push(radhaType);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 2));
    inFlight -= 1;
    const make = over[radhaType];
    return make ? make() : { chart: radhaType };
  });
  return { fetcher, calls, peak: () => peak };
}

const ENV_KEYS = ['KUNDLI_QUEUE_MAX_FETCHES_PER_USER', 'KUNDLI_QUEUE_LOG_FILE', 'READING_FACTS_BUILD'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  delete process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
  process.env.KUNDLI_QUEUE_LOG_FILE = path.join(os.tmpdir(), 'aiastra-kundli-queue-test.log');
  process.env.READING_FACTS_BUILD = '0';
  clearChartDataCaches();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

/** Radha types of the built-in served registration set, first tier first, each tier by sort_order */
const BUILTIN_ORDER = ['biodata', 'd1', 'd9', 'vimsottari_dasa', 'charakaraka', 'd2', 'd4', 'd7', 'd10', 'narayana_dasa'];

describe('registrationSet', () => {
  it('is the served first + registration types in sort_order; unserved ones are listed as skipped', () => {
    const { requested, skipped } = registrationSet(BUILTIN_CHART_TYPES);
    expect(requested.map((t) => t.radhaType)).toEqual(BUILTIN_ORDER);
    expect(requested.slice(0, 5).every((t) => t.tier === 'first')).toBe(true);
    expect(skipped.map((t) => t.id)).toEqual(expect.arrayContaining(['arudhas', 'varga.d60', 'ashtakavarga', 'yogas']));
    expect(skipped.every((t) => !t.served)).toBe(true);
    expect([...requested, ...skipped].some((t) => t.variantKind === 'year')).toBe(false);
  });

  it('follows the merged catalog: a newly served type joins in sort order, an unserved one drops out', async () => {
    const kundli = makeKundli();
    const repo = memRepo(kundli, [catalogRow('varga.d60', { served: true, calc_version: '1' }), catalogRow('varga.d7', { served: false })]);
    const { fetcher, calls } = fakeFetcher();
    const out = await fetchRegistrationSet({ repo, fetcher }, 'k1', { concurrency: 1 });
    expect(calls).toEqual(['biodata', 'd1', 'd9', 'vimsottari_dasa', 'charakaraka', 'd2', 'd4', 'd10', 'd60', 'narayana_dasa']);
    expect(out.skipped.map((t) => t.id)).toContain('varga.d7');
    expect(out.firstTierReady).toBe(true);
  });
});

describe('processKundliSyncQueue (S-5)', () => {
  it('fetches the registration set in sort_order one at a time, never an unserved type, and completes', async () => {
    expect(getKundliQueueMaxFetchesPerUser()).toBe(1); // default stays 1 per user
    const kundli = makeKundli();
    const { prisma, authUpdate } = fakePrisma(kundli);
    const repo = memRepo(kundli);
    const { fetcher, calls, peak } = fakeFetcher();

    await processKundliSyncQueue(prisma, { chart: { repo, fetcher } });

    expect(calls).toEqual(BUILTIN_ORDER);
    expect(peak()).toBe(1);
    for (const never of ['arudhas', 'd3', 'd12', 'd30', 'd60', 'ashtakavarga', 'yogas', 'strength.shadbala']) expect(calls).not.toContain(never);
    // legacy columns are filled from what was fetched, so old readers keep working
    for (const field of KUNDLI_JSON_FIELDS) expect(kundli[field]).toEqual({ chart: field });
    // and every item is also a kundli_data row
    expect([...repo.rows.keys()].sort()).toEqual(
      ['dasha.narayana|', 'dasha.vimsottari|', 'karaka.chara|', 'panchanga.birth|', 'varga.d1|', 'varga.d10|', 'varga.d2|', 'varga.d4|', 'varga.d7|', 'varga.d9|'].sort()
    );
    expect(kundli.queue_status).toBe('completed');
    expect(authUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { kundli_added: true } });
  });

  it('KUNDLI_QUEUE_MAX_FETCHES_PER_USER still caps parallel Radha calls', async () => {
    process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER = '3';
    const kundli = makeKundli();
    const { prisma } = fakePrisma(kundli);
    const { fetcher, peak } = fakeFetcher();
    await processKundliSyncQueue(prisma, { chart: { repo: memRepo(kundli), fetcher } });
    expect(peak()).toBeGreaterThan(1);
    expect(peak()).toBeLessThanOrEqual(3);
  });

  it('stores a new-shape dasha with the catalog calc_version in the column and the row, and does not refetch it next login', async () => {
    const v2 = fixture('vimsottari.v2.json');
    const catalog = [catalogRow('dasha.vimsottari', { calc_version: '2' }), catalogRow('dasha.narayana', { calc_version: '2' })];
    const kundli = makeKundli();
    const { prisma } = fakePrisma(kundli);
    const repo = memRepo(kundli, catalog);
    const first = fakeFetcher({ vimsottari_dasa: () => v2, narayana_dasa: () => fixture('narayana.v2.json') });

    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: first.fetcher } });

    expect(kundli.queue_status).toBe('completed');
    expect(kundli.vimsottari_dasa).toEqual(v2);
    expect(repo.rows.get('dasha.vimsottari|')).toMatchObject({ status: 'ready', calcVersion: '2', payload: v2 });

    // next login: queue goes pending again, everything is stored, Radha is not called
    kundli.queue_status = 'pending';
    clearChartDataCaches();
    const second = fakeFetcher();
    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: second.fetcher } });
    expect(second.calls).toEqual([]);
    expect(kundli.queue_status).toBe('completed');
  });

  it('keeps the legacy completion rule: an unserved legacy type leaves its column empty and the kundli pending', async () => {
    const kundli = makeKundli();
    const { prisma, authUpdate } = fakePrisma(kundli);
    const repo = memRepo(kundli, [catalogRow('varga.d7', { served: false })]);
    const { fetcher, calls } = fakeFetcher();

    await processKundliSyncQueue(prisma, { chart: { repo, fetcher } });

    expect(calls).not.toContain('d7');
    expect(kundli.d7).toBeNull();
    expect(kundli.d1).toEqual({ chart: 'd1' });
    expect(kundli.queue_status).toBe('pending');
    expect(kundli.last_sync_error).toMatch(/Partial sync/);
    expect(authUpdate).not.toHaveBeenCalled();
  });

  it('does not complete while a served first-tier type is not ready, and still keeps what it fetched', async () => {
    const kundli = makeKundli();
    const { prisma, authUpdate } = fakePrisma(kundli);
    const repo = memRepo(kundli);
    const { fetcher } = fakeFetcher({
      d9: () => {
        throw new Error('HTTP 502');
      },
    });

    await processKundliSyncQueue(prisma, { chart: { repo, fetcher } });

    expect(kundli.queue_status).toBe('pending');
    expect(kundli.d9).toBeNull();
    expect(kundli.d1).toEqual({ chart: 'd1' });
    expect(repo.rows.get('varga.d9|')?.status).toBe('failed');
    expect(authUpdate).not.toHaveBeenCalled();
  });

  it('completes when only a non-first, non-legacy registration type fails', async () => {
    const kundli = makeKundli();
    const { prisma } = fakePrisma(kundli);
    const repo = memRepo(kundli, [catalogRow('varga.d60', { served: true, calc_version: '1' })]);
    const { fetcher } = fakeFetcher({
      d60: () => {
        throw new Error('HTTP 500');
      },
    });

    await processKundliSyncQueue(prisma, { chart: { repo, fetcher } });

    expect(repo.rows.get('varga.d60|')?.status).toBe('failed');
    expect(kundli.queue_status).toBe('completed');
  });

  it('a kundli whose ten columns are already filled completes without calling Radha', async () => {
    const filled = Object.fromEntries(KUNDLI_JSON_FIELDS.map((f) => [f, { legacy: f }]));
    const kundli = makeKundli(filled);
    const { prisma } = fakePrisma(kundli);
    const { fetcher, calls } = fakeFetcher();

    await processKundliSyncQueue(prisma, { chart: { repo: memRepo(kundli), fetcher } });

    expect(calls).toEqual([]);
    expect(kundli.queue_status).toBe('completed');
    expect(kundli.d1).toEqual({ legacy: 'd1' }); // a filled column is never overwritten
  });

  it('sends unreadable birth data back to pending with the error, without calling Radha', async () => {
    const kundli = makeKundli();
    (kundli.user as { date_of_birth: unknown }).date_of_birth = null; // unreadable birth data
    const { prisma } = fakePrisma(kundli);
    const { fetcher, calls } = fakeFetcher();

    await processKundliSyncQueue(prisma, { chart: { repo: memRepo(kundli), fetcher } });

    expect(calls).toEqual([]);
    expect(kundli.queue_status).toBe('pending');
    expect(kundli.last_sync_error).toBeTruthy();
  });
});
