/**
 * The technique output store (docs/reading-engine/56 §4.1, M36): stores a technique's digested output for one kundli
 * over the date range (`[valid_from, valid_to)`) in which its inputs cannot change.
 *
 * When a caller requests the technique inside that validity window:
 * 1. The stored output is returned immediately without rehashing the digest or sky tables.
 * 2. The processing agent (code or LLM) is skipped (`agent_runs.status = 'cached'`).
 * 3. `hit_count` and `last_hit_at` are updated in the background.
 *
 * When no row covers `now`, `make()` runs, and the output is written with `ON CONFLICT (cache_key) DO NOTHING` so
 * concurrent makers both succeed and one row wins. A failed store read or write never fails the caller: it logs once
 * and falls through to `make()`.
 */
import type { PrismaClient } from '@prisma/client';
import { agentById, withAgentRun, type ChartUsed } from '../agents/registry.js';
import { TECHNIQUES, techniqueById, type TechniqueDef } from './catalog.js';
import {
  techniqueCacheKey,
  validityConfig,
  validityWindow,
  windowCovers,
  type DateSpan,
  type Freshness,
  type ValidityConfig,
  type ValidityContext,
  type ValidityWindow,
} from './pieces.js';

export interface StoredTechniqueOutputRow {
  cache_key: string;
  technique_id: string;
  kundli_id: string;
  digest_version: string;
  freshness: Freshness | string;
  valid_from: Date | string;
  valid_to: Date | string | null;
  output: unknown;
  output_schema: string;
  made_by_agent: string | null;
  made_ms: number;
  created_at?: Date | string;
  hit_count?: number;
  last_hit_at?: Date | string | null;
}

export interface TechniqueOutputDelegate {
  findUnique?: (args: { where: { cache_key: string } }) => Promise<StoredTechniqueOutputRow | null>;
  create?: (args: { data: StoredTechniqueOutputRow }) => Promise<StoredTechniqueOutputRow>;
  upsert?: (args: {
    where: { cache_key: string };
    create: StoredTechniqueOutputRow;
    update: Record<string, unknown>;
  }) => Promise<StoredTechniqueOutputRow>;
  updateMany?: (args: {
    where: { cache_key: string };
    data: { hit_count?: { increment: number }; last_hit_at?: Date };
  }) => Promise<{ count: number }>;
  deleteMany?: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
}

type StoreCapablePrisma = PrismaClient & {
  techniqueOutput?: TechniqueOutputDelegate;
  $queryRawUnsafe?: <R = unknown>(sql: string, ...values: unknown[]) => Promise<R>;
  $executeRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number>;
};

export interface TechniqueOutputCallInput {
  /** A catalogue definition or its id (`work.present_tone`, `general.jaimini`, `self.board` …). */
  technique: TechniqueDef | string;
  kundliId: string;
  digestVersion: string;
  /** Clock and running dasha/year/day spans used to compute the validity window. */
  context: ValidityContext;
  /** Required when the technique's scope is `'question'`: a hash of the question (never raw question text). */
  questionHash?: string;
  /** Optional override for the agent id recorded in `technique_outputs.made_by_agent` and cached `agent_runs`. */
  agentId?: string | null;
  /** Optional user id for the `agent_runs` row written on a cache hit. */
  userId?: string | null;
  /** Optional subject for the `agent_runs` row written on a cache hit. */
  subject?: string | null;
  /** Optional charts list for the `agent_runs` row written on a cache hit. */
  charts?: ChartUsed[];
  /** Whether to write a `status = 'cached'` row to `agent_runs` when the store hits and skips the agent (default true). */
  logCachedRun?: boolean;
  /** Optional config override (defaults to `validityConfig()` from env). */
  config?: ValidityConfig;
  /** Optional catalogue override for tests. */
  techniques?: readonly TechniqueDef[];
  /** Optional cache version override. */
  cacheVersion?: string;
}

export interface TechniqueMakeResult<T> {
  value: T;
  /** Optional summary counts/tones for the `agent_runs` log when needed; never personal data. */
  summary?: Record<string, unknown>;
  /** Optional refined validity context discovered during `make()` (e.g. `runningPeriod` from `kundli_activation`). */
  context?: Partial<ValidityContext>;
  /** When true (e.g. upstream chart facts are not ready yet), do not write the result to `technique_outputs`. */
  skipStore?: boolean;
}

/**
 * Finds the shortest running dasha period span covering `now` from `kundli_activation` rows (`from` / `to` YYYY-MM-DD or ISO).
 */
export function shortestRunningPeriodSpan(
  rows: ReadonlyArray<{ from: string | Date; to: string | Date }>,
  now: Date,
): DateSpan | null {
  let best: DateSpan | null = null;
  let bestMs = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    const from = r.from instanceof Date ? r.from : new Date(r.from.length === 10 ? `${r.from}T00:00:00Z` : r.from);
    const to = r.to instanceof Date ? r.to : new Date(r.to.length === 10 ? `${r.to}T00:00:00Z` : r.to);
    const span: DateSpan = { from, to };
    if (!windowCovers(span, now)) continue;
    const ms = to.getTime() - from.getTime();
    if (ms > 0 && ms < bestMs) {
      bestMs = ms;
      best = span;
    }
  }
  return best;
}

/**
 * Finds the running annual chart span (TP preferred, else VP) covering `now` from a digest view's `annual()` rows.
 */
export function runningYearSpan(
  view:
    | {
        annual: () => ReadonlyArray<{
          kind: 'TP' | 'VP';
          dashas: ReadonlyArray<{ periods: ReadonlyArray<{ from: string; to: string }> }>;
        }>;
      }
    | null
    | undefined,
  now: Date,
): DateSpan | null {
  if (!view) return null;
  const candidates: Array<{ kind: 'TP' | 'VP'; span: DateSpan }> = [];
  for (const row of view.annual()) {
    const periods = row.dashas.flatMap((d) => d.periods);
    if (!periods.length) continue;
    const fromIso = periods.map((p) => p.from).sort()[0]!;
    const toIso = periods.map((p) => p.to).sort().at(-1)!;
    const from = new Date(fromIso.length === 10 ? `${fromIso}T00:00:00Z` : fromIso);
    const to = new Date(toIso.length === 10 ? `${toIso}T00:00:00Z` : toIso);
    const span: DateSpan = { from, to };
    if (windowCovers(span, now)) {
      candidates.push({ kind: row.kind, span });
    }
  }
  const picked = candidates.find((c) => c.kind === 'TP') ?? candidates[0];
  return picked?.span ?? null;
}

export interface TechniqueOutputResult<T> {
  value: T;
  /** True when the stored output covered `context.now` and the processing agent was skipped. */
  cached: boolean;
  cacheKey: string | null;
  window: ValidityWindow;
}

let storeWarned = false;

function warnOnce(label: string, err: unknown): void {
  if (storeWarned) return;
  storeWarned = true;
  console.warn(`[techniques] output store ${label} failed: ${(err as Error)?.message ?? String(err)}`);
}

function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function resolveTechnique(t: TechniqueDef | string, list: readonly TechniqueDef[]): TechniqueDef {
  if (typeof t !== 'string') return t;
  const found = list === TECHNIQUES ? techniqueById(t) : list.find((x) => x.id === t);
  if (!found) throw new Error(`unknown technique ${t}`);
  return found;
}

async function readStoredRow(prisma: StoreCapablePrisma, cacheKey: string): Promise<StoredTechniqueOutputRow | null> {
  if (prisma.techniqueOutput?.findUnique) {
    return prisma.techniqueOutput.findUnique({ where: { cache_key: cacheKey } });
  }
  if (typeof prisma.$queryRawUnsafe === 'function') {
    const rows = await prisma.$queryRawUnsafe<StoredTechniqueOutputRow[]>(
      `SELECT "cache_key", "technique_id", "kundli_id", "digest_version", "freshness", "valid_from", "valid_to", "output", "output_schema", "made_by_agent", "made_ms", "created_at", "hit_count", "last_hit_at"
         FROM "technique_outputs"
        WHERE "cache_key" = $1
        LIMIT 1`,
      cacheKey,
    );
    return rows[0] ?? null;
  }
  return null;
}

async function bumpHit(prisma: StoreCapablePrisma, cacheKey: string, now: Date): Promise<void> {
  try {
    if (prisma.techniqueOutput?.updateMany) {
      await prisma.techniqueOutput.updateMany({
        where: { cache_key: cacheKey },
        data: { hit_count: { increment: 1 }, last_hit_at: now },
      });
      return;
    }
    if (typeof prisma.$executeRawUnsafe === 'function') {
      await prisma.$executeRawUnsafe(
        `UPDATE "technique_outputs" SET "hit_count" = "hit_count" + 1, "last_hit_at" = $2 WHERE "cache_key" = $1`,
        cacheKey,
        now,
      );
    }
  } catch (e) {
    warnOnce('hit update', e);
  }
}

async function insertStoredRow(
  prisma: StoreCapablePrisma,
  row: StoredTechniqueOutputRow,
  replaceExisting = false,
): Promise<void> {
  if (prisma.techniqueOutput?.upsert) {
    await prisma.techniqueOutput.upsert({
      where: { cache_key: row.cache_key },
      create: row,
      update: replaceExisting
        ? {
            valid_from: row.valid_from,
            valid_to: row.valid_to,
            output: row.output,
            output_schema: row.output_schema,
            made_by_agent: row.made_by_agent,
            made_ms: row.made_ms,
            hit_count: 0,
            last_hit_at: null,
          }
        : {},
    });
    return;
  }
  if (prisma.techniqueOutput?.create) {
    if (replaceExisting && prisma.techniqueOutput.deleteMany) {
      await prisma.techniqueOutput.deleteMany({ where: { cache_key: row.cache_key } });
    }
    try {
      await prisma.techniqueOutput.create({ data: row });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002' || code === '23505') return;
      throw e;
    }
    return;
  }
  if (typeof prisma.$executeRawUnsafe === 'function') {
    const conflictClause = replaceExisting
      ? `ON CONFLICT ("cache_key") DO UPDATE SET
           "valid_from" = EXCLUDED."valid_from",
           "valid_to" = EXCLUDED."valid_to",
           "output" = EXCLUDED."output",
           "output_schema" = EXCLUDED."output_schema",
           "made_by_agent" = EXCLUDED."made_by_agent",
           "made_ms" = EXCLUDED."made_ms",
           "created_at" = NOW(),
           "hit_count" = 0,
           "last_hit_at" = NULL`
      : `ON CONFLICT ("cache_key") DO NOTHING`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "technique_outputs" ("cache_key", "technique_id", "kundli_id", "digest_version", "freshness", "valid_from", "valid_to", "output", "output_schema", "made_by_agent", "made_ms")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
       ${conflictClause}`,
      row.cache_key,
      row.technique_id,
      row.kundli_id,
      row.digest_version,
      row.freshness,
      row.valid_from,
      row.valid_to,
      JSON.stringify(row.output ?? null),
      row.output_schema,
      row.made_by_agent,
      row.made_ms,
    );
  }
}

/**
 * Read-through date-range cache for a technique's digested output (docs/reading-engine/56 §4.1).
 *
 * - Computes the technique's `ValidityWindow` (`[from, to)`) from the freshness of the pieces it reads.
 * - Looks up `technique_outputs` by `cache_key`.
 * - When a stored row exists and its date range covers `context.now`, returns the stored output immediately,
 *   bumps `hit_count`, writes an `agent_runs` row with `status = 'cached'`, and **skips calling `make()`**.
 * - Otherwise runs `make()`, stores the output for `[window.from, window.to)`, and returns it with `cached: false`.
 */
export async function withTechniqueOutput<T>(
  prisma: PrismaClient,
  input: TechniqueOutputCallInput,
  make: () => Promise<T | TechniqueMakeResult<T>>,
): Promise<TechniqueOutputResult<T>> {
  const list = input.techniques ?? TECHNIQUES;
  const def = resolveTechnique(input.technique, list);
  const cfg = input.config ?? validityConfig();
  const window = validityWindow(def, input.context, cfg, list);
  const cacheKey = techniqueCacheKey({
    technique: def,
    kundliId: input.kundliId,
    digestVersion: input.digestVersion,
    window,
    questionHash: input.questionHash,
    cacheVersion: input.cacheVersion,
  });

  const store = prisma as StoreCapablePrisma;
  const chosenAgent = input.agentId !== undefined ? input.agentId : (def.agents[0] ?? null);
  let expiredExisting = false;

  if (cacheKey !== null) {
    const readStarted = Date.now();
    try {
      const existing = await readStoredRow(store, cacheKey);
      if (existing) {
        const storedSpan = {
          from: asDate(existing.valid_from),
          to: existing.valid_to ? asDate(existing.valid_to) : null,
        };
        if (windowCovers(storedSpan, input.context.now)) {
          void bumpHit(store, cacheKey, input.context.now);
          const hitWindow: ValidityWindow = {
            freshness: window.freshness,
            scope: window.scope,
            from: storedSpan.from,
            to: storedSpan.to,
          };
          if (input.logCachedRun !== false && chosenAgent && agentById(chosenAgent)) {
            await withAgentRun(
              prisma,
              chosenAgent,
              {
                userId: input.userId ?? null,
                task: `${def.id} (window cache hit)`,
                technique: def.id,
                kundliId: input.kundliId,
                subject: input.subject ?? null,
                charts: input.charts,
                input: {
                  freshness: window.freshness,
                  valid_from: storedSpan.from.toISOString(),
                  valid_to: storedSpan.to ? storedSpan.to.toISOString() : null,
                },
              },
              async () => ({
                value: existing.output as T,
                status: 'cached',
                output: {
                  cache_hit: true,
                  freshness: window.freshness,
                  read_ms: Math.max(0, Date.now() - readStarted),
                },
              }),
            );
          }
          return {
            value: existing.output as T,
            cached: true,
            cacheKey,
            window: hitWindow,
          };
        }
        expiredExisting = true;
      }
    } catch (e) {
      warnOnce('read', e);
    }
  }

  const makeStarted = Date.now();
  const rawResult = await make();
  const madeMs = Math.max(0, Date.now() - makeStarted);
  const isWrapped =
    rawResult !== null && typeof rawResult === 'object' && 'value' in (rawResult as Record<string, unknown>);
  const wrapped = isWrapped ? (rawResult as TechniqueMakeResult<T>) : null;
  const value = wrapped ? wrapped.value : (rawResult as T);

  let effectiveWindow = window;
  if (wrapped?.context) {
    const refined = validityWindow(def, { ...input.context, ...wrapped.context }, cfg, list);
    const from = new Date(Math.max(window.from.getTime(), refined.from.getTime()));
    const to =
      window.to && refined.to
        ? new Date(Math.min(window.to.getTime(), refined.to.getTime()))
        : (refined.to ?? window.to);
    if (to === null || to.getTime() > from.getTime()) {
      effectiveWindow = {
        freshness: window.freshness,
        scope: window.scope,
        from,
        to,
      };
    }
  }

  if (cacheKey !== null && !wrapped?.skipStore) {
    try {
      await insertStoredRow(
        store,
        {
          cache_key: cacheKey,
          technique_id: def.id,
          kundli_id: input.kundliId,
          digest_version: input.digestVersion,
          freshness: effectiveWindow.freshness,
          valid_from: effectiveWindow.from,
          valid_to: effectiveWindow.to,
          output: value,
          output_schema: def.contract.output,
          made_by_agent: chosenAgent,
          made_ms: madeMs,
        },
        expiredExisting,
      );
    } catch (e) {
      warnOnce('write', e);
    }
  }

  return {
    value,
    cached: false,
    cacheKey,
    window: effectiveWindow,
  };
}

/**
 * Deletes all stored technique outputs for a kundli (called when its digest is rebuilt).
 */
export async function deleteKundliTechniqueOutputs(prisma: PrismaClient, kundliId: string): Promise<number> {
  const store = prisma as StoreCapablePrisma;
  try {
    if (store.techniqueOutput?.deleteMany) {
      const res = await store.techniqueOutput.deleteMany({ where: { kundli_id: kundliId } });
      return res.count;
    }
    if (typeof store.$executeRawUnsafe === 'function') {
      return await store.$executeRawUnsafe(`DELETE FROM "technique_outputs" WHERE "kundli_id" = $1`, kundliId);
    }
  } catch (e) {
    warnOnce('delete', e);
  }
  return 0;
}

const DAY_MS = 24 * 3_600_000;

/**
 * Daily sweep (`cache:sweep`, docs/reading-engine/56 §4.1): deletes expired rows whose `valid_to < now - 1 day`,
 * bounded to `limit` rows per run (default 5,000).
 */
export async function sweepTechniqueOutputs(prisma: PrismaClient, now: Date = new Date(), limit = 5_000): Promise<number> {
  const store = prisma as StoreCapablePrisma;
  const cutoff = new Date(now.getTime() - DAY_MS);
  const cap = Math.max(1, Math.min(50_000, Math.trunc(limit)));
  try {
    if (typeof store.$executeRawUnsafe === 'function') {
      return await store.$executeRawUnsafe(
        `DELETE FROM "technique_outputs"
          WHERE "cache_key" IN (
            SELECT "cache_key" FROM "technique_outputs"
             WHERE "valid_to" IS NOT NULL AND "valid_to" < $1
             ORDER BY "valid_to" ASC
             LIMIT $2
          )`,
        cutoff,
        cap,
      );
    }
    if (store.techniqueOutput?.deleteMany) {
      const res = await store.techniqueOutput.deleteMany({
        where: { valid_to: { not: null, lt: cutoff } },
      });
      return Math.min(res.count, cap);
    }
  } catch (e) {
    warnOnce('sweep', e);
  }
  return 0;
}

/** Reset warning state in unit tests. */
export function resetTechniqueOutputStoreState(): void {
  storeWarned = false;
}

