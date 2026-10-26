/**
 * Registration pulls everything Radha serves (docs/reading-engine/23 §4): every served natal and annual type, first tier
 * first, never `moving`; annual items for the current year under `year=<year_used>`; expired annual and changed
 * calc_version re-fetched on the next login; ready rows skipped; one Radha call at a time.
 * In-memory chart-data repo + fake Radha fetcher + a small fake Prisma; no network, no database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

vi.mock('../../../src/services/geminiCacheService.js', () => ({ ensureGeminiCacheForUser: vi.fn(async () => undefined) }));
vi.mock('../../../src/reading/data/factsBuilder.js', () => ({ scheduleFactsBuild: vi.fn() }));
vi.mock('../../../src/lib/queueLogger.js', () => ({ queueLog: vi.fn(), queueLogError: vi.fn() }));

import { processKundliSyncQueue } from '../../../src/services/kundliQueueService.js';
import { queueLog } from '../../../src/lib/queueLogger.js';
import { BUILTIN_CHART_TYPES, mergeChartTypes, type ChartDataType, type ChartTypeRow } from '../../../src/reading/chartData/catalog.js';
import { fetchRegistrationItems, registrationPlan, registrationSet } from '../../../src/reading/chartData/registration.js';
import {
  CURRENT_VARIANT,
  clearChartDataCaches,
  ensureAnnualCurrent,
  ensureChartData,
  localDateAt,
  radhaLocalToDate,
  type ChartDataRepo,
  type FetchResult,
  type KundliRequest,
  type RowKey,
  type StoredRow,
} from '../../../src/reading/chartData/store.js';
import { KUNDLI_JSON_FIELDS } from '../../../src/lib/astroKundliClient.js';

const TZ = 5.5;
const HOUR = 3_600_000;

function makeKundli() {
  const row = {
    id: 'k1',
    user_id: 'u1',
    queue_status: 'pending',
    queue_completed_at: null as Date | null,
    last_sync_error: null as string | null,
    created_at: new Date(),
    ...Object.fromEntries(KUNDLI_JSON_FIELDS.map((f) => [f, null])),
    user: { date_of_birth: '1990-01-01', place_of_birth: 'Delhi, India', time_of_birth: '10:00:00' },
  };
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

/** In-memory repo with the claim semantics of the SQL; the catalog rows can be swapped between runs. */
function memRepo(kundli: FakeKundli, catalog: { rows: ChartTypeRow[] }) {
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const repo: ChartDataRepo & { rows: typeof rows } = {
    rows,
    async loadTypes() {
      return catalog.rows;
    },
    async readRows(_id, keys) {
      return keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r));
    },
    async readLegacy(_id, columns) {
      return Object.fromEntries(columns.map((c) => [c, (kundli as Record<string, unknown>)[c] ?? null]));
    },
    async claim(_id, key, params, _ay, leaseMs) {
      const r = rows.get(k(key));
      if (r && r.status === 'fetching' && r.fetchStartedAt && Date.now() - r.fetchStartedAt.getTime() <= leaseMs) return false;
      rows.set(k(key), { ...(r ?? { payload: null, calcVersion: null, error: null, fetchedAt: null, validTo: null }), ...key, params, status: 'fetching', fetchStartedAt: new Date() } as StoredRow);
      return true;
    },
    async complete(_id, key, _ay, result: FetchResult) {
      const prev = rows.get(k(key));
      rows.set(k(key), {
        ...key,
        params: result.params ?? prev?.params ?? {},
        calcVersion: result.calcVersion,
        payload: result.status === 'ready' ? result.payload : (prev?.payload ?? null),
        status: result.status,
        error: result.error ?? null,
        fetchStartedAt: prev?.fetchStartedAt ?? null,
        fetchedAt: new Date(),
        validTo: result.validTo ?? null,
      });
    },
    async kundliRequest(): Promise<KundliRequest> {
      return { params: { dob: '1990-01-01', tob: '10:00:00', place: 'Delhi,IN', ayanamsa: 'LAHIRI' }, coords: { lat: 28.6, lon: 77.2, tz: TZ } };
    },
  };
  return repo;
}

function row(t: ChartDataType, over: Partial<ChartTypeRow> = {}): ChartTypeRow {
  return {
    id: t.id,
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

/** The catalog after `chart-catalog:sync` against a Radha that serves everything (dasha.brahma excepted), transit too. */
function fullyServed(over: Record<string, Partial<ChartTypeRow>> = {}): ChartTypeRow[] {
  return BUILTIN_CHART_TYPES.map((t) => row(t, { served: t.id !== 'dasha.brahma', calc_version: '1', ...over[t.id] }));
}

/** Place-local 'YYYY-MM-DD HH:MM:SS' for an instant (what Radha sends for valid_to). */
function localString(ms: number): string {
  return new Date(ms + TZ * HOUR).toISOString().slice(0, 19).replace('T', ' ');
}

/** Wire name + varga, so per-varga arudhas/argala entries are told apart. */
const wire = (t: ChartDataType) => `${t.radhaType}${t.fixedParams?.varga ? `:${String(t.fixedParams.varga)}` : ''}`;

/** Fake Radha: records each call, the extra fields, the peak in flight; annual types answer with year_used/valid_to. */
function fakeRadha(opts: { year?: number; validToMs?: number; onCall?: (radhaType: string) => void; fail?: (radhaType: string) => boolean } = {}) {
  const calls: string[] = [];
  const extras: Record<string, Record<string, unknown>> = {};
  let inFlight = 0;
  let peak = 0;
  const state = { year: opts.year ?? 2026, validToMs: opts.validToMs ?? Date.now() + 200 * 24 * HOUR };
  const fetcher = vi.fn(async (_req: KundliRequest, radhaType: string, extra: Record<string, unknown>) => {
    const varga = (extra.params as { varga?: unknown } | undefined)?.varga;
    const name = `${radhaType}${varga ? `:${String(varga)}` : ''}`;
    calls.push(name);
    extras[name] = extra;
    opts.onCall?.(radhaType);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 1));
    inFlight -= 1;
    if (opts.fail?.(radhaType)) throw new Error('HTTP 502');
    if (radhaType.startsWith('annual.')) return { year_used: state.year, rule: 'after_birthday_current_year', valid_to: localString(state.validToMs), type: radhaType };
    return { chart: name };
  });
  return { fetcher, calls, extras, state, peak: () => peak };
}

const ENV_KEYS = ['KUNDLI_QUEUE_MAX_FETCHES_PER_USER', 'READING_FACTS_BUILD'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  delete process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
  process.env.READING_FACTS_BUILD = '0';
  clearChartDataCaches();
  vi.mocked(queueLog).mockClear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const ANNUAL = ['annual.tithi_pravesha', 'annual.tithi_pravesha_dasha', 'annual.varsha', 'annual.mudda', 'annual.patyayini', 'annual.sahams'];

describe('registration set (full pull)', () => {
  const types = mergeChartTypes(fullyServed());
  const plan = registrationPlan(types);

  it('is every served natal and annual type, first tier, then registration, then the rest by sort_order; never moving', () => {
    const tiers = plan.requested.map((t) => t.tier);
    expect(tiers.indexOf('registration')).toBe(tiers.lastIndexOf('first') + 1);
    expect(tiers.indexOf('on_demand')).toBe(tiers.lastIndexOf('registration') + 1);
    for (const tier of ['first', 'registration', 'on_demand'] as const) {
      const orders = plan.requested.filter((t) => t.tier === tier).map((t) => t.sortOrder);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
    }
    expect(plan.requested.some((t) => t.changeClass === 'moving')).toBe(false);
    expect(plan.requested.map((t) => t.id)).not.toContain('transit');
    expect(plan.requested.map((t) => t.id)).not.toContain('transit_contacts');
    expect(plan.requested.map((t) => t.id)).toEqual(expect.arrayContaining(ANNUAL));
    expect(plan.skipped.map((t) => t.id)).toEqual(['dasha.brahma']);
    // the whole catalog minus the moving types (transit, transit_contacts) and dasha.brahma
    expect(plan.requested.length).toBe(BUILTIN_CHART_TYPES.length - 3);
  });

  it('the gate ends at the last type the completion rule needs (first tier + legacy columns)', () => {
    expect(plan.gate.at(-1)!.id).toBe('dasha.narayana');
    for (const t of plan.requested.filter((x) => x.tier === 'first' || x.legacyColumn)) expect(plan.gate).toContain(t);
    expect([...plan.gate, ...plan.rest]).toEqual(plan.requested);
  });

  it('a moving type stays out even when a catalog row puts it in the first tier', () => {
    const odd = mergeChartTypes(fullyServed({ transit: { tier: 'first' } }));
    expect(registrationSet(odd).requested.map((t) => t.id)).not.toContain('transit');
  });

  it('only the built-in served types (no catalog sync yet) give the old ten-item set and no rest', () => {
    const p = registrationPlan(BUILTIN_CHART_TYPES);
    expect(p.requested.map((t) => t.radhaType)).toEqual(['biodata', 'd1', 'd9', 'vimsottari_dasa', 'charakaraka', 'd2', 'd4', 'd7', 'd10', 'narayana_dasa']);
    expect(p.rest).toEqual([]);
  });
});

describe('ensureAnnualCurrent', () => {
  const catalog = { rows: fullyServed() };

  it('asks Radha with at = today at the birth place and stores the answer under year=<year_used> with valid_to', async () => {
    const kundli = makeKundli();
    const repo = memRepo(kundli, catalog);
    const now = Date.UTC(2026, 9, 25, 20, 0, 0); // 01:30 on the 26th in UTC+5:30
    const validToMs = Date.UTC(2027, 2, 1, 4, 30, 0);
    const radha = fakeRadha({ year: 2026, validToMs });
    const out = await ensureAnnualCurrent({ repo, fetcher: radha.fetcher }, 'k1', ['annual.varsha'], { now: () => now, concurrency: 1 });

    expect(radha.extras['annual.varsha']).toEqual({ at: '2026-10-26' });
    expect(out['annual.varsha']).toMatchObject({ status: 'ready', source: 'radha', variant: 'year=2026' });
    const yearRow = repo.rows.get('annual.varsha|year=2026')!;
    expect(yearRow).toMatchObject({ status: 'ready', calcVersion: '1', params: { year: 2026, at: '2026-10-26' } });
    expect(yearRow.validTo!.getTime()).toBe(validToMs);
    expect(repo.rows.get(`annual.varsha|${CURRENT_VARIANT}`)).toMatchObject({ status: 'ready', payload: { year_used: 2026, variant: 'year=2026' } });

    // the same year row is what an explicit annual.varsha@2026 reads (no Radha call)
    const explicit = await ensureChartData({ repo, fetcher: radha.fetcher }, 'k1', ['annual.varsha@2026'], { now: () => now });
    expect(explicit['annual.varsha@2026']).toMatchObject({ status: 'ready', source: 'db' });
    expect(radha.calls).toEqual(['annual.varsha']);
  });

  it('reads the stored year until valid_to passes, then fetches the new year and keeps the old one', async () => {
    const kundli = makeKundli();
    const repo = memRepo(kundli, catalog);
    const t0 = Date.UTC(2026, 9, 25, 6, 0, 0);
    const validToMs = t0 + 30 * 24 * HOUR;
    const radha = fakeRadha({ year: 2026, validToMs });
    const deps = { repo, fetcher: radha.fetcher };

    await ensureAnnualCurrent(deps, 'k1', ['annual.mudda'], { now: () => t0 });
    const again = await ensureAnnualCurrent(deps, 'k1', ['annual.mudda'], { now: () => t0 + 29 * 24 * HOUR });
    expect(again['annual.mudda']).toMatchObject({ status: 'ready', source: 'db', variant: 'year=2026' });
    expect(radha.calls).toEqual(['annual.mudda']);

    radha.state.year = 2027;
    radha.state.validToMs = validToMs + 365 * 24 * HOUR;
    const after = await ensureAnnualCurrent(deps, 'k1', ['annual.mudda'], { now: () => validToMs + HOUR });
    expect(after['annual.mudda']).toMatchObject({ status: 'ready', source: 'radha', variant: 'year=2027' });
    expect(radha.calls).toEqual(['annual.mudda', 'annual.mudda']);
    expect(repo.rows.get('annual.mudda|year=2026')?.status).toBe('ready');
    expect(repo.rows.get('annual.mudda|year=2027')?.status).toBe('ready');
    // a past year's row is a fixed chart: asking for it explicitly after its valid_to makes no Radha call
    const old = await ensureChartData(deps, 'k1', ['annual.mudda@2026'], { now: () => validToMs + 2 * HOUR });
    expect(old['annual.mudda@2026']).toMatchObject({ status: 'ready', source: 'db' });
    expect(radha.calls).toHaveLength(2);
  });

  it('re-fetches when the type calc_version changes', async () => {
    const kundli = makeKundli();
    const cat = { rows: fullyServed() };
    const repo = memRepo(kundli, cat);
    const radha = fakeRadha();
    await ensureAnnualCurrent({ repo, fetcher: radha.fetcher }, 'k1', ['annual.sahams']);
    cat.rows = fullyServed({ 'annual.sahams': { calc_version: '2' } });
    clearChartDataCaches();
    await ensureAnnualCurrent({ repo, fetcher: radha.fetcher }, 'k1', ['annual.sahams']);
    expect(radha.calls).toEqual(['annual.sahams', 'annual.sahams']);
    expect(repo.rows.get(`annual.sahams|${CURRENT_VARIANT}`)?.calcVersion).toBe('2');
  });

  it('fails cleanly when Radha sends no year_used, and refuses non-annual or unserved types without a call', async () => {
    const kundli = makeKundli();
    const repo = memRepo(kundli, { rows: fullyServed({ 'annual.patyayini': { served: false } }) });
    const fetcher = vi.fn(async () => ({ nothing: true }));
    const out = await ensureAnnualCurrent({ repo, fetcher }, 'k1', ['annual.varsha', 'annual.patyayini', 'varga.d1', 'transit']);
    expect(out['annual.varsha']).toMatchObject({ status: 'failed' });
    expect(out['annual.varsha']!.error).toMatch(/year_used/);
    expect(repo.rows.get(`annual.varsha|${CURRENT_VARIANT}`)?.status).toBe('failed');
    expect(out['annual.patyayini']).toMatchObject({ status: 'unsupported' });
    expect(out['varga.d1']).toMatchObject({ status: 'failed' });
    expect(out['transit']).toMatchObject({ status: 'failed' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reads Radha local times with the place offset', () => {
    expect(radhaLocalToDate('2027-03-01 10:00:00', 5.5)!.toISOString()).toBe('2027-03-01T04:30:00.000Z');
    expect(radhaLocalToDate('2027-03-01 10:00:00', null)!.toISOString()).toBe('2027-03-01T10:00:00.000Z');
    expect(radhaLocalToDate('soon', 5.5)).toBeNull();
    expect(localDateAt(Date.UTC(2026, 9, 25, 20, 0, 0), -7)).toBe('2026-10-25');
  });
});

describe('processKundliSyncQueue: full pull at registration', () => {
  it('fetches the full set in order, first tier first, one call at a time, never transit; annual under year_used', async () => {
    const kundli = makeKundli();
    const { prisma, authUpdate } = fakePrisma(kundli);
    const catalog = { rows: fullyServed() };
    const repo = memRepo(kundli, catalog);
    const plan = registrationPlan(mergeChartTypes(catalog.rows));
    const statusAtCall: Record<string, string> = {};
    const radha = fakeRadha({ year: 2026, onCall: (t) => (statusAtCall[t] ??= kundli.queue_status) });

    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: radha.fetcher } });

    expect(radha.calls).toEqual(plan.requested.map(wire));
    expect(radha.calls.slice(0, plan.firstTier.length)).toEqual(plan.firstTier.map(wire));
    expect(radha.calls).not.toContain('transit');
    expect(radha.peak()).toBe(1);
    for (const id of ANNUAL) {
      expect(repo.rows.get(`${id}|year=2026`)?.status).toBe('ready');
      expect(repo.rows.get(`${id}|${CURRENT_VARIANT}`)?.validTo).toBeInstanceOf(Date);
    }
    expect([...repo.rows.keys()].some((k) => k.startsWith('transit|'))).toBe(false);
    // chat opened after the gate: the rest was fetched with the kundli already completed
    expect(statusAtCall['narayana_dasa']).toBe('in_progress');
    expect(statusAtCall['yogas']).toBe('completed');
    expect(statusAtCall['annual.varsha']).toBe('completed');
    expect(kundli.queue_status).toBe('completed');
    expect(authUpdate).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { kundli_added: true } });
    // per-user summary with item count and wall time
    const summary = vi.mocked(queueLog).mock.calls.map(([p]) => p).find((p) => p.event === 'kundli_full_pull');
    expect(summary).toMatchObject({ kundli_id: 'k1', total_items: plan.requested.length, fetched_from_radha: plan.requested.length, ready: plan.requested.length, failed: 0 });
    expect(typeof summary!.wall_ms).toBe('number');
  });

  it('skips rows already ready and resumes where an earlier run stopped', async () => {
    const kundli = makeKundli();
    const { prisma } = fakePrisma(kundli);
    const catalog = { rows: fullyServed() };
    const repo = memRepo(kundli, catalog);
    const plan = registrationPlan(mergeChartTypes(catalog.rows));
    // an earlier run stored the gate and the first ten of the rest, then stopped (e.g. the Lambda was frozen)
    await fetchRegistrationItems({ repo, fetcher: fakeRadha().fetcher }, 'k1', [...plan.gate, ...plan.rest.slice(0, 10)], { concurrency: 1 });
    expect(repo.rows.get(`${plan.rest[9]!.id}|`)?.status).toBe('ready');

    const second = fakeRadha();
    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: second.fetcher } });
    expect(second.calls).toEqual(plan.rest.slice(10).map(wire));
    expect(kundli.queue_status).toBe('completed');
  });

  it('next login: nothing fetched when all is stored; expired annual rows and a changed calc_version are re-fetched', async () => {
    const kundli = makeKundli();
    const { prisma } = fakePrisma(kundli);
    const catalog = { rows: fullyServed() };
    const repo = memRepo(kundli, catalog);
    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: fakeRadha({ year: 2026 }).fetcher } });

    kundli.queue_status = 'pending';
    const idle = fakeRadha();
    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: idle.fetcher } });
    expect(idle.calls).toEqual([]);

    // the birthday passed (S-4) and Radha bumped Narayana to calc_version 3
    for (const id of ANNUAL) repo.rows.get(`${id}|${CURRENT_VARIANT}`)!.validTo = new Date(Date.now() - 1000);
    catalog.rows = fullyServed({ 'dasha.narayana': { calc_version: '3' } });
    clearChartDataCaches();
    kundli.queue_status = 'pending';
    const next = fakeRadha({ year: 2027 });
    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: next.fetcher } });
    expect(next.calls).toEqual(['narayana_dasa', ...registrationPlan(mergeChartTypes(catalog.rows)).rest.filter((t) => t.changeClass === 'annual').map(wire)]);
    for (const id of ANNUAL) {
      expect(repo.rows.get(`${id}|year=2027`)?.status).toBe('ready');
      expect(repo.rows.get(`${id}|${CURRENT_VARIANT}`)?.payload).toMatchObject({ year_used: 2027 });
    }
    expect(repo.rows.get('dasha.narayana|')?.calcVersion).toBe('3');
    expect(next.peak()).toBe(1);
  });

  it('does not pull the rest while the gate is incomplete', async () => {
    const kundli = makeKundli();
    const { prisma } = fakePrisma(kundli);
    const repo = memRepo(kundli, { rows: fullyServed() });
    const radha = fakeRadha({ fail: (t) => t === 'd9' });
    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: radha.fetcher } });
    expect(kundli.queue_status).toBe('pending');
    expect(radha.calls).not.toContain('yogas');
    expect(radha.calls).not.toContain('annual.varsha');
  });

  it('a rest item that fails is logged and stored as failed; the kundli stays completed', async () => {
    const kundli = makeKundli();
    const { prisma } = fakePrisma(kundli);
    const repo = memRepo(kundli, { rows: fullyServed() });
    const radha = fakeRadha({ fail: (t) => t === 'yogas' || t === 'annual.mudda' });
    await processKundliSyncQueue(prisma, { chart: { repo, fetcher: radha.fetcher } });
    expect(kundli.queue_status).toBe('completed');
    expect(repo.rows.get('yogas|')?.status).toBe('failed');
    expect(repo.rows.get(`annual.mudda|${CURRENT_VARIANT}`)?.status).toBe('failed');
    expect(repo.rows.get('annual.varsha|year=2026')?.status).toBe('ready');
  });
});
