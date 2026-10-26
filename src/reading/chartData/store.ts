/**
 * The only way anything on the server reaches Radha for chart data (docs/reading-engine/20 §5, review 21 §2).
 *
 * ensureChartData(kundliId, ['varga.d60', 'dasha.yogini', 'annual.varsha@2027']):
 *   1. reads the kundli_data rows for exactly those keys (never the whole person);
 *   2. falls back to the legacy kundlis column for types that had one (and writes it through as a 'legacy' row);
 *   3. for each missing or stale item that Radha serves, claims the row (the row is the lock, so two agents or two
 *      Lambda instances never fetch the same item), calls Radha once for that item, and stores the result;
 *   4. waits for items another caller is fetching, up to the lease.
 * Nothing here computes astrology. When the M7 tables are missing (migration not applied) it degrades to legacy
 * columns + uncached Radha calls instead of failing.
 */
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { authToAstroKundliParams, fetchEngineExport, type AstroKundliRequestParams } from '../../lib/astroKundliClient.js';
import { BUILTIN_CHART_TYPES, mergeChartTypes, type ChartDataType, type ChartTypeRow } from './catalog.js';

export type ItemStatus = 'ready' | 'missing' | 'failed' | 'unsupported';
export type ItemSource = 'db' | 'legacy' | 'radha' | null;

export interface ChartItem {
  key: string;
  id: string;
  variant: string;
  status: ItemStatus;
  source: ItemSource;
  payload: unknown;
  error?: string;
}

export interface RowKey {
  dataType: string;
  variant: string;
}

export interface StoredRow extends RowKey {
  params: Record<string, unknown>;
  calcVersion: string | null;
  payload: unknown;
  status: 'ready' | 'fetching' | 'failed' | 'unsupported';
  error: string | null;
  fetchStartedAt: Date | null;
  fetchedAt: Date | null;
  validTo: Date | null;
}

export interface FetchResult {
  status: 'ready' | 'failed' | 'unsupported';
  payload?: unknown;
  error?: string;
  calcVersion: string | null;
  validTo?: Date | null;
}

export interface KundliRequest {
  params: AstroKundliRequestParams;
  coords: { lat: number; lon: number; tz: number } | null;
}

/** Storage seam: Prisma in production, in-memory in tests. */
export interface ChartDataRepo {
  loadTypes(): Promise<ChartTypeRow[]>;
  readRows(kundliId: string, keys: RowKey[], ayanamsa: string): Promise<StoredRow[]>;
  readLegacy(kundliId: string, columns: string[]): Promise<Record<string, unknown>>;
  /** Atomically mark the row 'fetching' if it is absent, not fetching, or its lease expired. True = caller owns it. */
  claim(kundliId: string, key: RowKey, params: Record<string, unknown>, ayanamsa: string, leaseMs: number): Promise<boolean>;
  complete(kundliId: string, key: RowKey, ayanamsa: string, result: FetchResult): Promise<void>;
  kundliRequest(kundliId: string): Promise<KundliRequest | null>;
}

export type RadhaFetcher = (req: KundliRequest, radhaType: string, extra: Record<string, unknown>) => Promise<unknown>;

export interface EnsureOptions {
  ayanamsa?: string;
  /** Max Radha calls in flight for this request (default CHART_DATA_FETCH_CONCURRENCY or 2) */
  concurrency?: number;
  /** How long a 'fetching' row is owned before others may take it (default 90 s, above the Radha timeout) */
  leaseMs?: number;
  /** Don't call Radha; return what is stored (e.g. inside a latency-critical path) */
  noFetch?: boolean;
  now?: () => number;
  /** Poll interval while waiting for another caller's fetch */
  pollMs?: number;
}

export interface EnsureDeps {
  repo: ChartDataRepo;
  fetcher?: RadhaFetcher;
}

const FAILED_RETRY_MS = 5 * 60_000;
const UNSUPPORTED_RETRY_MS = 24 * 3_600_000;

function concurrencyDefault(): number {
  const n = Number(process.env.CHART_DATA_FETCH_CONCURRENCY);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2;
}

/** 'annual.varsha@2027' -> { id: 'annual.varsha', variant: 'year=2027', params: { year: 2027 } } */
export function parseKey(key: string, types: ReadonlyMap<string, ChartDataType>): { id: string; variant: string; params: Record<string, unknown>; type?: ChartDataType; error?: string } {
  const [id, arg] = key.split('@', 2) as [string, string | undefined];
  const type = types.get(id);
  if (!type) return { id, variant: '', params: {}, error: `unknown chart data type: ${id}` };
  if (type.variantKind === 'year') {
    const year = Number(arg);
    if (!arg || !Number.isInteger(year) || year < 1800 || year > 2300) return { id, variant: '', params: {}, type, error: `${id} needs a year: ${id}@<year>` };
    return { id, variant: `year=${year}`, params: { year }, type };
  }
  if (arg) return { id, variant: '', params: {}, type, error: `${id} takes no variant` };
  return { id, variant: '', params: {}, type };
}

export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === 'P2021' || e?.code === '42P01' || /does not exist/i.test(e?.message ?? '');
}

/** Radha answers 'Invalid export type: x' for types this build does not serve. */
export function isUnsupportedError(err: unknown): boolean {
  return /invalid export type|unsupported/i.test((err as Error)?.message ?? '');
}

export function needsFetch(row: StoredRow | undefined, type: ChartDataType, now: number, leaseMs: number): boolean {
  if (!row) return true;
  switch (row.status) {
    case 'ready':
      if (type.calcVersion != null && row.calcVersion !== type.calcVersion) return true;
      return Boolean(row.validTo && row.validTo.getTime() <= now);
    case 'fetching':
      return !row.fetchStartedAt || now - row.fetchStartedAt.getTime() > leaseMs;
    case 'failed':
      return !row.fetchedAt || now - row.fetchedAt.getTime() > FAILED_RETRY_MS;
    case 'unsupported':
      return type.served && (!row.fetchedAt || now - row.fetchedAt.getTime() > UNSUPPORTED_RETRY_MS);
  }
}

function toItem(key: string, id: string, variant: string, row: StoredRow | undefined): ChartItem {
  if (!row) return { key, id, variant, status: 'missing', source: null, payload: null };
  if (row.status === 'ready') return { key, id, variant, status: 'ready', source: 'db', payload: row.payload };
  if (row.status === 'fetching') return { key, id, variant, status: 'missing', source: null, payload: null, error: 'still fetching' };
  return { key, id, variant, status: row.status, source: null, payload: null, ...(row.error ? { error: row.error } : {}) };
}

async function pool<T>(items: T[], n: number, run: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await run(items[i++]!);
    })
  );
}

let typesCache: { at: number; types: Map<string, ChartDataType> } | null = null;
export function clearChartDataCaches(): void {
  typesCache = null;
}

async function loadTypes(repo: ChartDataRepo, now: number): Promise<Map<string, ChartDataType>> {
  if (typesCache && now - typesCache.at < 5 * 60_000) return typesCache.types;
  let merged: ChartDataType[];
  try {
    merged = mergeChartTypes(await repo.loadTypes());
  } catch (err) {
    if (!isMissingTable(err)) console.warn(JSON.stringify({ msg: 'chart_data_types read failed; using built-in catalog', error: (err as Error).message?.slice(0, 200) }));
    merged = [...BUILTIN_CHART_TYPES];
  }
  const types = new Map(merged.map((t) => [t.id, t]));
  typesCache = { at: now, types };
  return types;
}

/** The merged catalog (built-in list under the `chart_data_types` rows), cached for 5 minutes like ensureChartData's own read. */
export async function loadMergedChartTypes(repo: ChartDataRepo, now: number = Date.now()): Promise<ChartDataType[]> {
  return [...(await loadTypes(repo, now)).values()];
}

/** `moving` types (transit) depend on the moment asked for and are never stored per person. */
export function movingTypeError(id: string): string {
  return `${id} is a moving type and is not stored per person; call fetchTransit(kundliId, { at, divisionalChartFactor, withNatal }) from src/reading/chartData/transit.ts`;
}

export async function ensureChartData(deps: EnsureDeps, kundliId: string, keys: string[], opts: EnsureOptions = {}): Promise<Record<string, ChartItem>> {
  const now = opts.now ?? Date.now;
  const ayanamsa = opts.ayanamsa ?? 'LAHIRI';
  const leaseMs = opts.leaseMs ?? 90_000;
  const pollMs = opts.pollMs ?? 500;
  const { repo } = deps;
  const fetcher = deps.fetcher ?? defaultFetcher;
  const types = await loadTypes(repo, now());

  const out: Record<string, ChartItem> = {};
  const wanted: { key: string; id: string; variant: string; params: Record<string, unknown>; type: ChartDataType }[] = [];
  for (const key of [...new Set(keys)]) {
    const p = parseKey(key, types);
    if (p.error || !p.type) out[key] = { key, id: p.id, variant: p.variant, status: 'failed', source: null, payload: null, error: p.error };
    else if (p.type.changeClass === 'moving') out[key] = { key, id: p.id, variant: p.variant, status: 'failed', source: null, payload: null, error: movingTypeError(p.id) };
    else wanted.push({ key, id: p.id, variant: p.variant, params: p.params, type: p.type });
  }
  if (!wanted.length) return out;

  let degraded = false;
  let rows: StoredRow[] = [];
  try {
    rows = await repo.readRows(kundliId, wanted.map((w) => ({ dataType: w.id, variant: w.variant })), ayanamsa);
  } catch (err) {
    if (!isMissingTable(err)) throw err;
    degraded = true;
  }
  const rowOf = (w: { id: string; variant: string }) => rows.find((r) => r.dataType === w.id && r.variant === w.variant);

  // legacy columns for items with no row
  const legacyNeeded = wanted.filter((w) => !rowOf(w) && w.type.legacyColumn && w.variant === '');
  const legacy = legacyNeeded.length ? await repo.readLegacy(kundliId, legacyNeeded.map((w) => w.type.legacyColumn!)) : {};

  const toFetch: typeof wanted = [];
  const waiting: typeof wanted = [];
  for (const w of wanted) {
    const row = rowOf(w);
    const legacyValue = !row && w.type.legacyColumn ? legacy[w.type.legacyColumn] : undefined;
    if (legacyValue != null) {
      out[w.key] = { key: w.key, id: w.id, variant: w.variant, status: 'ready', source: 'legacy', payload: legacyValue };
      if (!degraded) {
        // write through so the next read is a row (best effort)
        void repo
          .complete(kundliId, { dataType: w.id, variant: '' }, ayanamsa, { status: 'ready', payload: legacyValue, calcVersion: 'legacy' })
          .catch(() => undefined);
      }
      continue;
    }
    const stale = needsFetch(row, w.type, now(), leaseMs);
    if (row?.status === 'fetching' && !stale && !opts.noFetch) {
      waiting.push(w); // another caller owns the fetch
      continue;
    }
    if (!stale || !w.type.served || opts.noFetch) {
      out[w.key] = !w.type.served && !row
        ? { key: w.key, id: w.id, variant: w.variant, status: 'unsupported', source: null, payload: null, error: 'Radha does not serve this type yet' }
        : toItem(w.key, w.id, w.variant, row);
      // a stale-but-ready row is still returned when we may not fetch
      continue;
    }
    toFetch.push(w);
  }
  const req = toFetch.length ? await repo.kundliRequest(kundliId) : null;
  if (toFetch.length && !req) {
    for (const w of toFetch) out[w.key] = { key: w.key, id: w.id, variant: w.variant, status: 'failed', source: null, payload: null, error: 'kundli or birth details not found' };
    toFetch.length = 0;
  }

  await pool(toFetch, opts.concurrency ?? concurrencyDefault(), async (w) => {
    const key = { dataType: w.id, variant: w.variant };
    if (!degraded) {
      let owned = false;
      try {
        owned = await repo.claim(kundliId, key, w.params, ayanamsa, leaseMs);
      } catch (err) {
        if (!isMissingTable(err)) throw err;
        degraded = true;
        owned = true;
      }
      if (!owned) {
        waiting.push(w);
        return;
      }
    }
    let result: FetchResult;
    try {
      const payload = await fetcher(req!, w.type.radhaType, w.params);
      result = { status: 'ready', payload, calcVersion: w.type.calcVersion };
    } catch (err) {
      result = { status: isUnsupportedError(err) ? 'unsupported' : 'failed', error: (err as Error).message?.slice(0, 500), calcVersion: w.type.calcVersion };
    }
    if (!degraded) await repo.complete(kundliId, key, ayanamsa, result);
    out[w.key] =
      result.status === 'ready'
        ? { key: w.key, id: w.id, variant: w.variant, status: 'ready', source: 'radha', payload: result.payload }
        : { key: w.key, id: w.id, variant: w.variant, status: result.status, source: null, payload: null, error: result.error };
  });

  // someone else is fetching these: wait for their rows, up to the lease
  if (waiting.length) {
    const deadline = now() + leaseMs;
    let pending = waiting;
    while (pending.length && now() < deadline) {
      await new Promise((r) => setTimeout(r, pollMs));
      const fresh = await repo.readRows(kundliId, pending.map((w) => ({ dataType: w.id, variant: w.variant })), ayanamsa);
      pending = pending.filter((w) => {
        const row = fresh.find((r) => r.dataType === w.id && r.variant === w.variant);
        if (row && row.status !== 'fetching') {
          out[w.key] = toItem(w.key, w.id, w.variant, row);
          return false;
        }
        return true;
      });
    }
    for (const w of pending) out[w.key] = { key: w.key, id: w.id, variant: w.variant, status: 'missing', source: null, payload: null, error: 'still fetching' };
  }
  return out;
}

const defaultFetcher: RadhaFetcher = (req, radhaType, extra) =>
  fetchEngineExport(req.params, radhaType, { ...(req.coords ?? {}), ...extra });

export function payloadHash(payload: unknown): string {
  return createHash('md5').update(JSON.stringify(payload ?? null)).digest('hex');
}

/** Prisma implementation of the repository. */
export function prismaChartDataRepo(prisma: PrismaClient): ChartDataRepo {
  return {
    async loadTypes() {
      return (await prisma.chartDataType.findMany()) as unknown as ChartTypeRow[];
    },
    async readRows(kundliId, keys, ayanamsa) {
      if (!keys.length) return [];
      const rows = await prisma.kundliData.findMany({
        where: { kundli_id: kundliId, ayanamsa, OR: keys.map((k) => ({ data_type: k.dataType, variant: k.variant })) },
      });
      return rows.map((r) => ({
        dataType: r.data_type,
        variant: r.variant,
        params: (r.params ?? {}) as Record<string, unknown>,
        calcVersion: r.calc_version,
        payload: r.payload,
        status: r.status as StoredRow['status'],
        error: r.error,
        fetchStartedAt: r.fetch_started_at,
        fetchedAt: r.fetched_at,
        validTo: r.valid_to,
      }));
    },
    async readLegacy(kundliId, columns) {
      const select = Object.fromEntries(columns.map((c) => [c, true])) as Prisma.KundliSelect;
      const row = (await prisma.kundli.findUnique({ where: { id: kundliId }, select })) as Record<string, unknown> | null;
      return row ?? {};
    },
    async claim(kundliId, key, params, ayanamsa, leaseMs) {
      const leaseSeconds = Math.ceil(leaseMs / 1000);
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO "kundli_data" ("kundli_id", "data_type", "variant", "params", "ayanamsa", "status", "fetch_started_at")
        VALUES (${kundliId}, ${key.dataType}, ${key.variant}, ${JSON.stringify(params)}::jsonb, ${ayanamsa}, 'fetching', now())
        ON CONFLICT ("kundli_id", "data_type", "variant", "ayanamsa") DO UPDATE
          SET "status" = 'fetching', "fetch_started_at" = now(), "error" = NULL
          WHERE "kundli_data"."status" <> 'fetching'
             OR "kundli_data"."fetch_started_at" IS NULL
             OR "kundli_data"."fetch_started_at" < now() - make_interval(secs => ${leaseSeconds})
        RETURNING "id"`;
      return rows.length > 0;
    },
    async complete(kundliId, key, ayanamsa, result) {
      const ready = result.status === 'ready';
      const data = {
        status: result.status,
        calc_version: result.calcVersion,
        error: ready ? null : (result.error ?? null),
        fetched_at: new Date(),
        valid_to: result.validTo ?? null,
        ...(ready ? { payload: result.payload as Prisma.InputJsonValue, payload_hash: payloadHash(result.payload) } : {}),
      };
      await prisma.kundliData.upsert({
        where: { kundli_data_key: { kundli_id: kundliId, data_type: key.dataType, variant: key.variant, ayanamsa } },
        create: { kundli_id: kundliId, data_type: key.dataType, variant: key.variant, ayanamsa, ...data },
        update: data,
      });
    },
    async kundliRequest(kundliId) {
      const k = await prisma.kundli.findUnique({ where: { id: kundliId }, include: { user: true } });
      if (!k?.user) return null;
      try {
        const params = authToAstroKundliParams({ date_of_birth: k.user.date_of_birth, place_of_birth: k.user.place_of_birth, time_of_birth: k.user.time_of_birth });
        const coords = k.lat != null && k.lon != null && k.tz != null ? { lat: k.lat, lon: k.lon, tz: k.tz } : null;
        return { params, coords };
      } catch {
        return null;
      }
    },
  };
}
