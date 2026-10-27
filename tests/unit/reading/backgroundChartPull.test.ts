/**
 * Background chart pull (docs/reading-engine/31): worker events, async self-invoke, in-process fallback, lease, budget
 * re-invoke and the sweep. In-memory chart-data repo + fake Radha + a small fake Prisma + a mocked Lambda client.
 */
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

const lambda = vi.hoisted(() => ({ send: vi.fn(), inputs: [] as Array<Record<string, unknown>> }));
vi.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: class {
    send = lambda.send;
  },
  InvokeCommand: class {
    constructor(public input: Record<string, unknown>) {
      lambda.inputs.push(input);
    }
  },
}));
vi.mock('../../../src/services/geminiCacheService.js', () => ({ ensureGeminiCacheForUser: vi.fn(async () => undefined) }));
vi.mock('../../../src/reading/data/factsBuilder.js', () => ({ scheduleFactsBuild: vi.fn() }));
const queue = vi.hoisted(() => ({ processKundliSyncQueue: vi.fn(async () => undefined) }));
vi.mock('../../../src/services/kundliQueueService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/kundliQueueService.js')>()),
  processKundliSyncQueue: queue.processKundliSyncQueue,
}));

import {
  acquireLease,
  findIncompleteKundlis,
  handleKundliSyncEvent,
  parseKundliSyncEvent,
  runKundliSync,
  runKundliSyncSweep,
  scheduleKundliSync,
  sweepWantList,
} from '../../../src/services/kundliSyncWorker.js';
import { ensureGeminiCacheForUser } from '../../../src/services/geminiCacheService.js';
import { BUILTIN_CHART_TYPES, type ChartTypeRow } from '../../../src/reading/chartData/catalog.js';
import { registrationPlan } from '../../../src/reading/chartData/registration.js';
import { clearChartDataCaches, type ChartDataRepo, type FetchResult, type RowKey, type StoredRow } from '../../../src/reading/chartData/store.js';
import { KUNDLI_JSON_FIELDS } from '../../../src/lib/astroKundliClient.js';

const ENV_KEYS = ['KUNDLI_SYNC_EVENT_TOKEN', 'AWS_LAMBDA_FUNCTION_NAME', 'KUNDLI_QUEUE_LOG_FILE', 'READING_FACTS_BUILD', 'KUNDLI_QUEUE_MAX_FETCHES_PER_USER'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  delete process.env.KUNDLI_SYNC_EVENT_TOKEN;
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  delete process.env.KUNDLI_QUEUE_MAX_FETCHES_PER_USER;
  process.env.KUNDLI_QUEUE_LOG_FILE = path.join(os.tmpdir(), 'aiastra-kundli-sync-test.log');
  process.env.READING_FACTS_BUILD = '0';
  lambda.send.mockReset();
  lambda.inputs.length = 0;
  queue.processKundliSyncQueue.mockClear();
  vi.mocked(ensureGeminiCacheForUser).mockClear();
  clearChartDataCaches();
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const syncEvent = (kundliId: unknown, token?: string) => ({ source: 'aiastra', 'detail-type': 'kundli-sync', detail: { kundliId, ...(token ? { token } : {}) } });
const sweepEvent = (token?: string) => ({ source: 'aws.events', 'detail-type': 'Scheduled Event', detail: { task: 'kundli-sync-sweep', ...(token ? { token } : {}) } });

describe('parseKundliSyncEvent', () => {
  it('recognises a kundli-sync event and a sweep event', () => {
    expect(parseKundliSyncEvent(syncEvent('2b1f-aa'))).toEqual({ kind: 'sync', kundliId: '2b1f-aa' });
    expect(parseKundliSyncEvent(sweepEvent())).toEqual({ kind: 'sweep' });
    expect(parseKundliSyncEvent({ detail: { task: 'kundli-sync-sweep' } })).toEqual({ kind: 'sweep' });
  });

  it('ignores the cache sweeper, other events, and malformed bodies', () => {
    expect(parseKundliSyncEvent({ source: 'aws.events', 'detail-type': 'Scheduled Event', detail: { task: 'llm-cache-sweep' } })).toBeNull();
    expect(parseKundliSyncEvent({ source: 'other', 'detail-type': 'kundli-sync', detail: { kundliId: 'k1' } })).toBeNull();
    expect(parseKundliSyncEvent(syncEvent(42))).toBeNull();
    expect(parseKundliSyncEvent(syncEvent("k1'; drop table"))).toBeNull();
    expect(parseKundliSyncEvent(null)).toBeNull();
    expect(parseKundliSyncEvent('x')).toBeNull();
  });

  it('checks detail.token against KUNDLI_SYNC_EVENT_TOKEN when set', () => {
    process.env.KUNDLI_SYNC_EVENT_TOKEN = 'sekret';
    expect(parseKundliSyncEvent(syncEvent('k1', 'sekret'))).toEqual({ kind: 'sync', kundliId: 'k1' });
    expect(parseKundliSyncEvent(syncEvent('k1', 'wrong!'))).toBeNull();
    expect(parseKundliSyncEvent(syncEvent('k1'))).toBeNull();
    expect(parseKundliSyncEvent(sweepEvent('sekret'))).toEqual({ kind: 'sweep' });
    expect(parseKundliSyncEvent(sweepEvent())).toBeNull();
  });
});

describe('scheduleKundliSync', () => {
  const prisma = {} as PrismaClient;

  it('on Lambda: invokes the same function asynchronously with the kundli-sync event and does not run in process', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'aiastra-server-api';
    process.env.KUNDLI_SYNC_EVENT_TOKEN = 'tok';
    lambda.send.mockResolvedValue({ StatusCode: 202 });
    expect(await scheduleKundliSync('k1', { prisma })).toBe('invoked');
    expect(lambda.inputs).toHaveLength(1);
    const input = lambda.inputs[0]!;
    expect(input.FunctionName).toBe('aiastra-server-api');
    expect(input.InvocationType).toBe('Event');
    const payload = JSON.parse(Buffer.from(input.Payload as Uint8Array).toString('utf8'));
    expect(payload).toEqual({ source: 'aiastra', 'detail-type': 'kundli-sync', detail: { kundliId: 'k1', token: 'tok' } });
    // the payload it sends is one the worker accepts
    expect(parseKundliSyncEvent(payload)).toEqual({ kind: 'sync', kundliId: 'k1' });
    expect(queue.processKundliSyncQueue).not.toHaveBeenCalled();
  });

  it('falls back to the in-process queue run when the invoke fails', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'aiastra-server-api';
    lambda.send.mockRejectedValue(new Error('AccessDeniedException'));
    expect(await scheduleKundliSync('k1', { prisma })).toBe('in_process');
    expect(queue.processKundliSyncQueue).toHaveBeenCalledWith(prisma, undefined);
  });

  it('falls back in process when not on Lambda (no invoke) or without a kundli id', async () => {
    expect(await scheduleKundliSync('k1', { prisma })).toBe('in_process');
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'aiastra-server-api';
    expect(await scheduleKundliSync(undefined, { prisma })).toBe('in_process');
    expect(lambda.send).not.toHaveBeenCalled();
    expect(queue.processKundliSyncQueue).toHaveBeenCalledTimes(2);
  });

  it('does not wait for the in-process pull', async () => {
    queue.processKundliSyncQueue.mockImplementationOnce(() => new Promise<undefined>(() => undefined)); // never settles
    expect(await scheduleKundliSync('k1', { prisma })).toBe('in_process');
  });
});

// ---------------------------------------------------------------- worker runs over an in-memory kundli + repo

function makeKundli(over: Record<string, unknown> = {}) {
  return {
    id: 'k1',
    user_id: 'u1',
    queue_status: 'pending',
    queue_started_at: null as Date | null,
    queue_completed_at: null as Date | null,
    last_sync_error: null as string | null,
    created_at: new Date(),
    lat: 28.6,
    lon: 77.2,
    tz: 5.5,
    ...Object.fromEntries(KUNDLI_JSON_FIELDS.map((f) => [f, null])),
    ...over,
    user: { date_of_birth: '1990-01-01', place_of_birth: 'Delhi, India', time_of_birth: '10:00:00' },
  } as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function fakePrisma(kundli: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const sameTime = (a: unknown, b: unknown) => a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  const prisma = {
    kundli: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(kundli, data)),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, any>; data: Record<string, unknown> }) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (where.id !== kundli.id) return { count: 0 };
        let ok = true;
        if ('queue_started_at' in where) ok = sameTime(kundli.queue_started_at, where.queue_started_at);
        if (where.OR) {
          const cur = kundli.queue_started_at as Date | null;
          ok = (where.OR as Array<Record<string, any>>).some((c) => // eslint-disable-line @typescript-eslint/no-explicit-any
            c.queue_started_at === null ? cur === null : Boolean(cur && cur.getTime() < (c.queue_started_at.lt as Date).getTime())
          );
        }
        if (!ok) return { count: 0 };
        Object.assign(kundli, data);
        return { count: 1 };
      }),
      findUnique: vi.fn(async (args: { select?: Record<string, boolean>; include?: unknown }) =>
        args.select ? Object.fromEntries(Object.keys(args.select).map((k) => [k, kundli[k]])) : { ...kundli }
      ),
    },
    auth: { update: vi.fn(async () => ({})) },
  } as unknown as PrismaClient;
  return prisma;
}

function memRepo(kundli: Record<string, any>, catalogRows: ChartTypeRow[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows = new Map<string, StoredRow>();
  const k = (key: RowKey) => `${key.dataType}|${key.variant}`;
  const repo: ChartDataRepo = {
    async loadTypes() {
      return catalogRows;
    },
    async readRows(_id, keys) {
      return keys.map((x) => rows.get(k(x))).filter((r): r is StoredRow => Boolean(r));
    },
    async readLegacy(_id, columns) {
      return Object.fromEntries(columns.map((c) => [c, kundli[c] ?? null]));
    },
    async claim(_id, key, params) {
      const r = rows.get(k(key));
      if (r && r.status === 'fetching') return false;
      rows.set(k(key), { ...(r ?? { payload: null, calcVersion: null, error: null, fetchedAt: null, validTo: null }), ...key, params, status: 'fetching', fetchStartedAt: new Date() } as StoredRow);
      return true;
    },
    async complete(_id, key, _ay, result: FetchResult) {
      const prev = rows.get(k(key));
      rows.set(k(key), { ...key, params: prev?.params ?? {}, calcVersion: result.calcVersion, payload: result.status === 'ready' ? result.payload : null, status: result.status, error: result.error ?? null, fetchStartedAt: null, fetchedAt: new Date(), validTo: result.validTo ?? null });
    },
    async kundliRequest() {
      return { params: { dob: '1990-01-01', tob: '10:00:00', place: 'Delhi,IN', ayanamsa: 'LAHIRI' }, coords: { lat: 28.6, lon: 77.2, tz: 5.5 } };
    },
  };
  return repo;
}

function catalogRow(id: string, over: Partial<ChartTypeRow>): ChartTypeRow {
  const t = BUILTIN_CHART_TYPES.find((x) => x.id === id)!;
  return { id, family: t.family, radha_type: t.radhaType, change_class: t.changeClass, tier: t.tier, variant_kind: t.variantKind, served: t.served, calc_version: t.calcVersion, legacy_column: t.legacyColumn ?? null, sort_order: t.sortOrder, label: t.label, enabled: true, ...over };
}

/** Four natal types beyond the built-in ten, so there is a rest after the gate. */
const EXTRA = ['varga.d60', 'ashtakavarga', 'yogas', 'arudhas'].map((id) => catalogRow(id, { served: true, calc_version: '1', tier: 'on_demand' }));

/** Virtual clock: every Radha call takes one second. */
function clockedFetcher() {
  const clock = { t: 1_000_000 };
  const calls: string[] = [];
  vi.spyOn(Date, 'now').mockImplementation(() => clock.t);
  const fetcher = vi.fn(async (_req: unknown, radhaType: string) => {
    calls.push(radhaType);
    clock.t += 1_000;
    return { chart: radhaType };
  });
  return { clock, calls, fetcher };
}

describe('runKundliSync', () => {
  it('skips a kundli whose lease another worker holds (no pull, no Radha call)', async () => {
    const { fetcher } = clockedFetcher();
    const kundli = makeKundli({ queue_started_at: new Date(Date.now() - 60_000) });
    const prisma = fakePrisma(kundli);
    const out = await runKundliSync({ prisma, queue: { chart: { repo: memRepo(kundli, EXTRA), fetcher } }, maxMs: 12 * 60_000 }, 'k1');
    expect(out).toEqual({ kundliId: 'k1', status: 'skipped', reason: 'lease held' });
    expect(fetcher).not.toHaveBeenCalled();
    expect(prisma.kundli.findUnique).not.toHaveBeenCalled();
  });

  it('takes an expired lease, and acquireLease is a conditional update', async () => {
    const kundli = makeKundli({ queue_started_at: new Date(Date.now() - 60 * 60_000) });
    const prisma = fakePrisma(kundli);
    const at = await acquireLease(prisma, 'k1', Date.now(), 15 * 60_000);
    expect(at).toBeInstanceOf(Date);
    expect(await acquireLease(prisma, 'k1', Date.now(), 15 * 60_000)).toBeNull();
    const where = vi.mocked(prisma.kundli.updateMany).mock.calls[0]![0]!.where as Record<string, unknown>;
    expect(where.OR).toHaveLength(2);
  });

  it('pulls everything, completes the row and releases the lease', async () => {
    const kundli = makeKundli();
    const prisma = fakePrisma(kundli);
    const { fetcher, calls } = clockedFetcher();
    const invoke = vi.fn(async () => true);
    const out = await runKundliSync({ prisma, queue: { chart: { repo: memRepo(kundli, EXTRA), fetcher } }, maxMs: 12 * 60_000, invoke }, 'k1');
    expect(out).toMatchObject({ status: 'ran', gateComplete: true, more: false, reinvoked: false });
    expect(calls).toHaveLength(14);
    expect(kundli.queue_status).toBe('completed');
    expect(kundli.queue_started_at).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('stops at the budget, re-invokes itself, and the next run resumes from the first missing item', async () => {
    const kundli = makeKundli();
    const prisma = fakePrisma(kundli);
    const repo = memRepo(kundli, EXTRA);
    const { fetcher, calls } = clockedFetcher();
    const invoke = vi.fn(async () => true);
    // ten gate calls (10 s), then the rest one by one: 11 s and 12 s start before the 11.5 s deadline is checked again
    const first = await runKundliSync({ prisma, queue: { chart: { repo, fetcher } }, maxMs: 11_500, invoke }, 'k1');
    expect(first).toMatchObject({ status: 'ran', gateComplete: true, more: true, reinvoked: true });
    expect(invoke).toHaveBeenCalledWith('k1');
    expect(calls).toHaveLength(12);
    expect(kundli.queue_status).toBe('completed'); // chat opened after the gate
    expect(kundli.queue_started_at).toBeNull(); // lease released for the re-invoked run
    expect(ensureGeminiCacheForUser).toHaveBeenCalledTimes(1);

    const second = await runKundliSync({ prisma, queue: { chart: { repo, fetcher } }, maxMs: 11_500, invoke }, 'k1');
    expect(second).toMatchObject({ status: 'ran', gateComplete: true, more: false });
    expect(calls).toHaveLength(14);
    expect(new Set(calls).size).toBe(14); // nothing fetched twice: the gate and the first two rest items were read
    expect(invoke).toHaveBeenCalledTimes(1);
    // a resumed run of a completed row does not repeat the completion side effects
    expect(ensureGeminiCacheForUser).toHaveBeenCalledTimes(1);
  });

  it('handleKundliSyncEvent routes a sync event to the worker', async () => {
    const kundli = makeKundli();
    const prisma = fakePrisma(kundli);
    const { fetcher } = clockedFetcher();
    const out = await handleKundliSyncEvent({ kind: 'sync', kundliId: 'k1' }, { prisma, queue: { chart: { repo: memRepo(kundli, []), fetcher } }, maxMs: 600_000 });
    expect(out).toMatchObject({ kundliId: 'k1', status: 'ran', gateComplete: true });
  });
});

describe('sweep', () => {
  it('asks for the oldest incomplete kundlis, bounded, with the registration set as the want list', async () => {
    const queryRaw = vi.fn(async () => [{ id: 'old' }, { id: 'newer' }]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const plan = registrationPlan(BUILTIN_CHART_TYPES);
    expect(await findIncompleteKundlis(prisma, plan, 5, 15 * 60_000)).toEqual(['old', 'newer']);
    const [strings, ...values] = queryRaw.mock.calls[0]! as unknown as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join('?');
    expect(sql).toMatch(/ORDER BY \(k\."last_sync_error" IS NOT NULL\), k\."created_at" ASC\s+LIMIT \?$/);
    expect(sql).toContain('"queue_started_at" IS NULL');
    expect(values.at(-1)).toBe(5);
    const want = sweepWantList(plan);
    expect(values).toContainEqual(want.ids);
    expect(want.ids).toEqual(plan.requested.map((t) => t.id));
    expect(want.variants.every((v) => v === '' || v === 'current')).toBe(true);
  });

  it('processes the candidates in the order found, one after another, under one budget', async () => {
    const kundlis = { old: makeKundli({ id: 'old' }), newer: makeKundli({ id: 'newer' }) };
    const order: string[] = [];
    const prismaFor = (id: 'old' | 'newer') => fakePrisma(kundlis[id]);
    const pOld = prismaFor('old');
    const pNew = prismaFor('newer');
    // one fake prisma that dispatches on the kundli id
    const prisma = {
      kundli: {
        update: vi.fn(async (a: { where: { id: string } }) => ((a.where.id === 'old' ? pOld : pNew).kundli.update as any)(a)), // eslint-disable-line @typescript-eslint/no-explicit-any
        updateMany: vi.fn(async (a: { where: { id: string } }) => {
          order.push(a.where.id);
          return ((a.where.id === 'old' ? pOld : pNew).kundli.updateMany as any)(a); // eslint-disable-line @typescript-eslint/no-explicit-any
        }),
        findUnique: vi.fn(async (a: { where: { id: string } }) => ((a.where.id === 'old' ? pOld : pNew).kundli.findUnique as any)(a)), // eslint-disable-line @typescript-eslint/no-explicit-any
      },
      auth: { update: vi.fn(async () => ({})) },
    } as unknown as PrismaClient;
    const { fetcher } = clockedFetcher();
    const find = vi.fn(async () => ['old', 'newer']);
    const out = await runKundliSyncSweep({ prisma, queue: { chart: { repo: memRepo(kundlis.old, []), fetcher } }, maxMs: 600_000, find, batch: 2 });
    expect(find).toHaveBeenCalledWith(prisma, expect.anything(), 2, expect.any(Number));
    expect(out.outcomes.map((o) => o.kundliId)).toEqual(['old', 'newer']);
    expect(order.filter((_, i) => i % 2 === 0)).toEqual(['old', 'newer']); // acquire (then release) per kundli, in order
    expect(out.stoppedForBudget).toBe(false);
  });

  it('stops before the next kundli once the budget is spent', async () => {
    const kundli = makeKundli();
    const prisma = fakePrisma(kundli);
    const { fetcher } = clockedFetcher();
    const out = await runKundliSyncSweep({ prisma, queue: { chart: { repo: memRepo(kundli, []), fetcher } }, maxMs: 5_000, find: async () => ['k1', 'k2'], invoke: async () => true });
    expect(out.outcomes).toHaveLength(1);
    expect(out.stoppedForBudget).toBe(true);
  });
});
