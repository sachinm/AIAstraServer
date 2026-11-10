/**
 * The dasha-deep worker (docs/reading-engine/67, Sachin 2026-11-09): its own Lambda (`aiastra-dasha-deep-worker`, same
 * image as the API) pulls the deep dasha levels (4..DASHA_DEEP_MAX_LEVEL, default 4) for ONE kundli in focus, inside a
 * window around as_of (default −90 d … +365 d), and rewrites that kundli's level 4–6 `kundli_activation` rows. The API
 * request path never pulls these levels; it only invokes this worker (src/workers/dashaDeepFocus.ts).
 *
 * Event: { type: 'dasha-deep-pull', kundliId, userId?, reason: 'focus' | 'sweep' | 'manual', asOf?, token }
 *   - token: KUNDLI_SYNC_EVENT_TOKEN, like every `/events` body (the path is reachable by anything that can call the function)
 *   - arrives as a direct invoke (`handler` below) or, through the Lambda Web Adapter, as POST /events (server.ts), which
 *     runs it only when DASHA_DEEP_WORKER=1 (the worker function), never on the API function.
 *
 * One run: read the marker row (`kundli_data` dasha.deep@marker); skip when its window covers as_of … as_of + 30 d and it
 * was pulled less than 7 days ago (24 h when the engine answered no deep level, e.g. before the engine release); take the
 * marker as a lock (the chart-data row claim, 11 min lease) so two focus events never pull twice; call the engine once per
 * dasha system with { max_level, deep_from, deep_to } (≤ 2 in flight, the export client's spacing, 50 s per call); build
 * the deep rows with the lifelong house rule (engine fields only); replace the level 4–6 rows of the systems that answered
 * in one transaction; write the marker (window, per-system ms / rows / levels / error). Never throws to the caller.
 * Nothing here computes astrology: every date, lord and sign is the engine's.
 */
import type { PrismaClient } from '@prisma/client';
import {
  getDashaDeepConcurrency,
  getDashaDeepDaysAhead,
  getDashaDeepDaysBack,
  getDashaDeepMaxLevel,
  getDashaDeepSystems,
  getKundliSyncEventToken,
} from '../config/env.js';
import { timingSafeEqual } from 'node:crypto';
import { fetchEngineExport } from '../lib/astroKundliClient.js';
import { queueLog, queueLogError } from '../lib/queueLogger.js';
import { DASHA_DEEP_TYPE, type ChartDataType } from '../reading/chartData/catalog.js';
import { normalizeDasha } from '../reading/chartData/dashaShape.js';
import type { ChartDataRepo, RadhaFetcher, StoredRow } from '../reading/chartData/store.js';
import { buildDeepActivationRows, LIFELONG_MAX_LEVEL, type ActivationLevel, type ActivationRowInput } from '../reading/digest/activation.js';
import type { ActivationBand } from '../reading/digest/activationWrite.js';
import type { DigestRowInput } from '../reading/digest/types.js';

export const DASHA_DEEP_EVENT_TYPE = 'dasha-deep-pull';
export const DASHA_DEEP_AYANAMSA = 'LAHIRI';
export const MARKER_VARIANT = 'marker';
export const FOCUS_VARIANT = 'focus';
/** The window must still reach this far past as_of, or the marker is stale */
export const DEEP_COVER_DAYS = 30;
/** A pull older than this is refreshed */
export const DEEP_MAX_AGE_DAYS = 7;
/** When no system answered a level deeper than 3 (the engine before its release), look again after this long */
export const DEEP_NO_ENGINE_RETRY_HOURS = 24;
/** After a failed run, the next focus waits this long */
export const DEEP_FAILED_RETRY_HOURS = 1;
/** The marker lock: longer than a whole run (≈ 40 systems × ≤ 50 s / 2 in flight is the worst case; the Lambda timeout is 600 s) */
export const DEEP_LEASE_MS = 11 * 60_000;
/** One engine call; the engine's own limit is 60 s */
export const DEEP_CALL_TIMEOUT_MS = 50_000;

const DAY = 86_400_000;
const HOUR = 3_600_000;
const KUNDLI_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DashaDeepReason = 'focus' | 'sweep' | 'manual';

export interface DashaDeepEvent {
  type: typeof DASHA_DEEP_EVENT_TYPE;
  kundliId: string;
  userId?: string;
  reason: DashaDeepReason;
  asOf?: string;
}

function tokenOk(given: unknown): boolean {
  const want = getKundliSyncEventToken();
  if (!want || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The event body (top level or in an EventBridge `detail`), or null: anything else, or a wrong / missing token. */
export function parseDashaDeepEvent(body: unknown): DashaDeepEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const e = (b.type === DASHA_DEEP_EVENT_TYPE ? b : b.detail && typeof b.detail === 'object' ? (b.detail as Record<string, unknown>) : null) as Record<string, unknown> | null;
  if (!e || e.type !== DASHA_DEEP_EVENT_TYPE || !tokenOk(e.token)) return null;
  if (typeof e.kundliId !== 'string' || !KUNDLI_ID_RE.test(e.kundliId)) return null;
  const reason: DashaDeepReason = e.reason === 'sweep' || e.reason === 'manual' ? e.reason : 'focus';
  return {
    type: DASHA_DEEP_EVENT_TYPE,
    kundliId: e.kundliId,
    reason,
    ...(typeof e.userId === 'string' && KUNDLI_ID_RE.test(e.userId) ? { userId: e.userId } : {}),
    ...(typeof e.asOf === 'string' && DATE_RE.test(e.asOf) ? { asOf: e.asOf } : {}),
  };
}

/** The event the API sends (token from KUNDLI_SYNC_EVENT_TOKEN). */
export function dashaDeepEventPayload(e: Omit<DashaDeepEvent, 'type'>): Record<string, unknown> {
  return { type: DASHA_DEEP_EVENT_TYPE, ...e, token: getKundliSyncEventToken() ?? '' };
}

const addDays = (iso: string, days: number): string => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** The deep window around as_of: [as_of − DASHA_DEEP_DAYS_BACK, as_of + DASHA_DEEP_DAYS_AHEAD]. Calendar arithmetic only. */
export function deepWindow(asOf: string, back = getDashaDeepDaysBack(), ahead = getDashaDeepDaysAhead()): { from: string; to: string } {
  return { from: addDays(asOf, -back), to: addDays(asOf, ahead) };
}

export interface DeepSystemStat {
  system: string;
  ms: number;
  rows: number;
  /** the depth the engine said it returned (`levels`), or null */
  levels: number | null;
  error?: string;
}

export interface DeepMarkerPayload {
  as_of: string;
  deep_from: string;
  deep_to: string;
  max_level: number;
  /** true when at least one system answered a level deeper than 3 */
  engine_deep: boolean;
  pulled_at: string;
  reason: DashaDeepReason;
  rows: number;
  systems: DeepSystemStat[];
}

const ms = (d: Date | null | undefined): number => (d ? d.getTime() : 0);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export type FreshVerdict = { fresh: true; why: 'fresh' | 'backoff' | 'no_engine' } | { fresh: false; why: 'none' | 'window' | 'age' | 'level' | 'retry' };

/** Whether the stored marker still serves as_of (no pull needed). Pure. */
export function deepFreshness(marker: StoredRow | undefined, asOf: string, now: number, maxLevel: number): FreshVerdict {
  if (!marker) return { fresh: false, why: 'none' };
  if (marker.status === 'failed') return now - ms(marker.fetchedAt) < DEEP_FAILED_RETRY_HOURS * HOUR ? { fresh: true, why: 'backoff' } : { fresh: false, why: 'retry' };
  if (marker.status !== 'ready' || !isObj(marker.payload)) return { fresh: false, why: 'none' };
  const p = marker.payload as Partial<DeepMarkerPayload>;
  const age = now - ms(marker.fetchedAt);
  if (p.engine_deep === false) return age < DEEP_NO_ENGINE_RETRY_HOURS * HOUR ? { fresh: true, why: 'no_engine' } : { fresh: false, why: 'age' };
  if (typeof p.max_level !== 'number' || p.max_level < maxLevel) return { fresh: false, why: 'level' };
  if (typeof p.deep_from !== 'string' || typeof p.deep_to !== 'string' || p.deep_from > asOf || p.deep_to < addDays(asOf, DEEP_COVER_DAYS)) return { fresh: false, why: 'window' };
  if (age >= DEEP_MAX_AGE_DAYS * DAY) return { fresh: false, why: 'age' };
  return { fresh: true, why: 'fresh' };
}

/** The dasha systems to pull deep: every served `dasha.<name>` of the merged catalogue (not `applicable`, `.l3` or `deep`), narrowed by DASHA_DEEP_SYSTEMS. */
export function deepSystems(types: readonly ChartDataType[], only: string[] | 'all' = getDashaDeepSystems()): string[] {
  const names = new Set<string>();
  for (const t of types) {
    const m = /^dasha\.([a-z_]+)$/.exec(t.id);
    if (!m || !t.served || t.id === 'dasha.applicable' || t.id === DASHA_DEEP_TYPE) continue;
    names.add(m[1]!);
  }
  const all = [...names].sort();
  return only === 'all' ? all : all.filter((n) => only.includes(n));
}

export interface DeepInputs {
  /** `house_counts`, `dasha.applicable`, `panchanga.birth` (kundli_data, natal rows) */
  items: Record<string, unknown>;
  /** the D1 planet and house cards (kundli_digest) */
  digestRows: DigestRowInput[];
}

export interface DashaDeepDeps {
  repo: Pick<ChartDataRepo, 'readRows' | 'claim' | 'complete' | 'kundliRequest'>;
  /** the merged chart catalogue (served flags) */
  loadTypes: () => Promise<readonly ChartDataType[]>;
  loadInputs: (kundliId: string) => Promise<DeepInputs>;
  writeBand: (kundliId: string, rows: ActivationRowInput[], band: ActivationBand) => Promise<{ deleted: number; inserted: number }>;
  /** the engine call (default: the throttled export client) */
  fetcher?: RadhaFetcher;
  now?: () => number;
  concurrency?: number;
  maxLevel?: 4 | 5 | 6;
  systems?: string[] | 'all';
}

export type DashaDeepOutcome =
  | { kundliId: string; status: 'skipped'; why: string }
  | { kundliId: string; status: 'pulled'; rows: number; deleted: number; ok: number; failed: number; engineDeep: boolean; ms: number; window: { from: string; to: string } }
  | { kundliId: string; status: 'failed'; error: string; ms: number };

function withTimeout<T>(p: Promise<T>, limitMs: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} timed out after ${limitMs} ms`)), limitMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function pool<T>(items: readonly T[], n: number, run: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, n), items.length) }, async () => {
      while (i < items.length) await run(items[i++]!);
    }),
  );
}

const defaultFetcher: RadhaFetcher = (req, radhaType, extra) => fetchEngineExport(req.params, radhaType, { ...(req.coords ?? {}), ...extra });

/** One kundli's deep pull. Never throws. */
export async function runDashaDeepPull(deps: DashaDeepDeps, event: DashaDeepEvent): Promise<DashaDeepOutcome> {
  const now = deps.now ?? Date.now;
  const t0 = now();
  const kundliId = event.kundliId;
  const asOf = event.asOf ?? new Date(t0).toISOString().slice(0, 10);
  const maxLevel = deps.maxLevel ?? getDashaDeepMaxLevel();
  const key = { dataType: DASHA_DEEP_TYPE, variant: MARKER_VARIANT };
  let owned = false;
  let previous: StoredRow | undefined;
  try {
    previous = (await deps.repo.readRows(kundliId, [key], DASHA_DEEP_AYANAMSA)).find((r) => r.variant === MARKER_VARIANT);
    const verdict = deepFreshness(previous, asOf, t0, maxLevel);
    // a manual run always pulls (still under the lock)
    if (verdict.fresh && event.reason !== 'manual') return { kundliId, status: 'skipped', why: verdict.why };
    const window = deepWindow(asOf);
    const params = { as_of: asOf, max_level: maxLevel, deep_from: window.from, deep_to: window.to };
    owned = await deps.repo.claim(kundliId, key, params, DASHA_DEEP_AYANAMSA, DEEP_LEASE_MS);
    if (!owned) return { kundliId, status: 'skipped', why: 'locked' };

    const req = await deps.repo.kundliRequest(kundliId);
    if (!req) throw new Error('kundli or birth details not found');
    const systems = deepSystems(await deps.loadTypes(), deps.systems ?? getDashaDeepSystems());
    if (!systems.length) throw new Error('no served dasha system to pull');
    const inputs = await deps.loadInputs(kundliId);
    const fetcher = deps.fetcher ?? defaultFetcher;

    const stats: DeepSystemStat[] = [];
    const rows: ActivationRowInput[] = [];
    await pool(systems, deps.concurrency ?? getDashaDeepConcurrency(), async (system) => {
      const s0 = now();
      try {
        // the engine reads options only from inside `params`
        const raw = await withTimeout(Promise.resolve(fetcher(req, `dasha.${system}`, { params: { max_level: maxLevel, deep_from: window.from, deep_to: window.to } })), DEEP_CALL_TIMEOUT_MS, `dasha.${system}`);
        const n = normalizeDasha(raw, { system });
        if (!n) throw new Error('engine response is not a dasha tree');
        const mine = buildDeepActivationRows([{ system, payload: raw }], inputs.items, inputs.digestRows, { from: window.from, to: window.to, maxLevel: maxLevel as ActivationLevel });
        rows.push(...mine);
        stats.push({ system, ms: now() - s0, rows: mine.length, levels: Number.isFinite(n.levels) ? n.levels : null });
      } catch (err) {
        stats.push({ system, ms: now() - s0, rows: 0, levels: null, error: String((err as Error).message ?? err).slice(0, 200) });
      }
    });
    stats.sort((a, b) => a.system.localeCompare(b.system));
    const ok = stats.filter((s) => !s.error).map((s) => s.system);
    const engineDeep = stats.some((s) => !s.error && (s.levels ?? 0) > LIFELONG_MAX_LEVEL);
    // replace the deep band (4..6) of the systems that answered; a failed system keeps what it had
    const written = ok.length ? await deps.writeBand(kundliId, rows, { minLevel: (LIFELONG_MAX_LEVEL + 1) as ActivationLevel, maxLevel: 6, systems: ok }) : { deleted: 0, inserted: 0 };
    const payload: DeepMarkerPayload = { as_of: asOf, deep_from: window.from, deep_to: window.to, max_level: maxLevel, engine_deep: engineDeep, pulled_at: new Date(now()).toISOString(), reason: event.reason, rows: written.inserted, systems: stats };
    if (ok.length) {
      await deps.repo.complete(kundliId, key, DASHA_DEEP_AYANAMSA, { status: 'ready', payload, calcVersion: null, validTo: new Date(`${window.to}T00:00:00Z`), params });
    } else {
      await deps.repo.complete(kundliId, key, DASHA_DEEP_AYANAMSA, { status: 'failed', error: `every system failed: ${stats[0]?.error ?? 'unknown'}`.slice(0, 500), calcVersion: null, validTo: previous?.validTo ?? null });
    }
    owned = false;
    const elapsed = now() - t0;
    queueLog({ event: 'dasha_deep_pull', kundli_id: kundliId, reason: event.reason, max_level: maxLevel, systems: stats.length, ok: ok.length, failed: stats.length - ok.length, rows: written.inserted, deleted: written.deleted, engine_deep: engineDeep, ms: elapsed, per_system: stats.map((s) => ({ s: s.system, ms: s.ms, rows: s.rows, lv: s.levels, ...(s.error ? { err: s.error.slice(0, 80) } : {}) })) });
    if (!ok.length) return { kundliId, status: 'failed', error: 'every system failed', ms: elapsed };
    return { kundliId, status: 'pulled', rows: written.inserted, deleted: written.deleted, ok: ok.length, failed: stats.length - ok.length, engineDeep, ms: elapsed, window };
  } catch (err) {
    const error = String((err as Error).message ?? err).slice(0, 300);
    queueLogError({ event: 'dasha_deep_pull_failed', kundli_id: kundliId, reason: event.reason, error });
    if (owned) {
      // release the lock with the error; the stored window (and the rows) stay as they were
      await deps.repo.complete(kundliId, key, DASHA_DEEP_AYANAMSA, { status: 'failed', error, calcVersion: null, validTo: previous?.validTo ?? null }).catch(() => undefined);
    }
    return { kundliId, status: 'failed', error, ms: now() - t0 };
  }
}

/** Production wiring over Prisma. */
export async function prismaDashaDeepDeps(prisma: PrismaClient): Promise<DashaDeepDeps> {
  const { loadMergedChartTypes, prismaChartDataRepo } = await import('../reading/chartData/store.js');
  const { replaceActivationBand } = await import('../reading/digest/activationWrite.js');
  const repo = prismaChartDataRepo(prisma);
  return {
    repo,
    loadTypes: () => loadMergedChartTypes(repo),
    writeBand: (kundliId, rows, band) => replaceActivationBand(prisma, kundliId, rows, band),
    loadInputs: async (kundliId) => {
      const [data, digest] = await Promise.all([
        prisma.kundliData.findMany({
          where: { kundli_id: kundliId, status: 'ready', ayanamsa: DASHA_DEEP_AYANAMSA, variant: '', data_type: { in: ['house_counts', 'dasha.applicable', 'panchanga.birth'] } },
          select: { data_type: true, payload: true },
        }),
        prisma.kundliDigest.findMany({ where: { kundli_id: kundliId, section: { in: ['planet', 'house'] } }, select: { section: true, key: true, row: true, source: true } }),
      ]);
      const items: Record<string, unknown> = {};
      for (const r of data) if (r.payload != null) items[r.data_type] = r.payload;
      return { items, digestRows: digest as unknown as DigestRowInput[] };
    },
  };
}

/** The `/events` and direct-invoke entry: the pull, logged as an agent run. Never throws. */
export async function handleDashaDeepEvent(event: DashaDeepEvent, deps: { prisma: PrismaClient; deep?: DashaDeepDeps }): Promise<DashaDeepOutcome> {
  try {
    const d = deps.deep ?? (await prismaDashaDeepDeps(deps.prisma));
    const { withAgentRun } = await import('../agents/registry.js');
    return await withAgentRun(deps.prisma, 'dasha.deep_pull', { task: 'dasha-deep-pull', technique: 'digest.activation', kundliId: event.kundliId, input: { reason: event.reason, max_level: d.maxLevel ?? getDashaDeepMaxLevel() } }, async () => {
      const o = await runDashaDeepPull(d, event);
      return {
        value: o,
        output: { status: o.status, rows: o.status === 'pulled' ? o.rows : 0, systems_ok: o.status === 'pulled' ? o.ok : 0, systems_failed: o.status === 'pulled' ? o.failed : 0, ms: o.status === 'skipped' ? 0 : o.ms, writes: [`kundli_activation:${o.status === 'pulled' ? o.rows : 0}`] },
      };
    });
  } catch (err) {
    const error = String((err as Error).message ?? err).slice(0, 300);
    queueLogError({ event: 'dasha_deep_event_failed', kundli_id: event.kundliId, error });
    return { kundliId: event.kundliId, status: 'failed', error, ms: 0 };
  }
}

/**
 * Lambda handler for a zip / runtime-interface deployment (`dist/src/workers/dashaDeep.handler`). The container image
 * runs behind the Lambda Web Adapter, which hands the same event to POST /events instead (server.ts); both end here.
 */
export async function handler(event: unknown): Promise<DashaDeepOutcome | { status: 'ignored' }> {
  const e = parseDashaDeepEvent(event);
  if (!e) return { status: 'ignored' };
  const { prisma } = await import('../lib/prisma.js');
  return handleDashaDeepEvent(e, { prisma });
}
