/**
 * The technique output store (docs/reading-engine/56 §4.1, M37): stores a technique's digested output for one kundli
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
import { AGENTS, agentById, withAgentRun, type ChartUsed } from '../agents/registry.js';
import { openRow, sealParam } from '../lib/pii/rawSql.js';
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
  findFirst?: (args: {
    where: { technique_id: string; kundli_id: string; digest_version?: { contains: string } };
    orderBy: { created_at: 'desc' };
  }) => Promise<StoredTechniqueOutputRow | null>;
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
  /** When true, skip reading any cached row, run `make()`, and overwrite the stored row in `technique_outputs`. */
  forceRefresh?: boolean;
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

const MAX_ANNUAL_SPAN_MS = 400 * 24 * 3_600_000;
const ONE_YEAR_MS = 365 * 24 * 3_600_000;

/**
 * Finds the running annual chart span (~1 solar year; TP preferred when year-sized, else VP/Mudda) covering `now`
 * from a digest view's `annual()` rows. Multi-decade dashas attached to TP rows (e.g. 108-year `tithi_ashtottari`)
 * never inflate the annual validity window beyond 1 year.
 */
export function runningYearSpan(
  view:
    | {
        annual: () => ReadonlyArray<{
          kind: 'TP' | 'VP';
          dashas: ReadonlyArray<{ system?: string; periods: ReadonlyArray<{ from: string; to: string }> }>;
        }>;
      }
    | null
    | undefined,
  now: Date,
): DateSpan | null {
  if (!view) return null;
  const yearSized: Array<{ kind: 'TP' | 'VP'; isMudda: boolean; span: DateSpan }> = [];
  const oversized: Array<{ kind: 'TP' | 'VP'; span: DateSpan }> = [];
  const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

  for (const row of view.annual()) {
    for (const d of row.dashas) {
      if (!d.periods.length) continue;
      const fromIso = d.periods.map((p) => p.from).sort()[0]!;
      const toIso = d.periods.map((p) => p.to).sort().at(-1)!;
      const from = toDate(fromIso);
      const to = toDate(toIso);
      const span: DateSpan = { from, to };
      if (!windowCovers(span, now)) continue;
      const spanMs = to.getTime() - from.getTime();
      if (spanMs > 0 && spanMs <= MAX_ANNUAL_SPAN_MS) {
        yearSized.push({ kind: row.kind, isMudda: d.system === 'mudda', span });
      } else if (spanMs > MAX_ANNUAL_SPAN_MS) {
        const activePeriod = d.periods
          .map((p) => ({ from: toDate(p.from), to: toDate(p.to) }))
          .find((p) => windowCovers(p, now));
        const clampedFrom =
          activePeriod && now.getTime() - activePeriod.from.getTime() <= ONE_YEAR_MS ? activePeriod.from : now;
        const clampedTo = new Date(Math.min(to.getTime(), clampedFrom.getTime() + ONE_YEAR_MS));
        oversized.push({ kind: row.kind, span: { from: clampedFrom, to: clampedTo } });
      }
    }
  }

  const picked =
    yearSized.find((c) => c.kind === 'TP') ??
    yearSized.find((c) => c.isMudda) ??
    yearSized[0] ??
    oversized.find((c) => c.kind === 'TP') ??
    oversized[0];
  return picked?.span ?? null;
}

export interface TechniqueOutputResult<T> {
  value: T;
  /** True when the stored output covered `context.now` and the processing agent was skipped. */
  cached: boolean;
  cacheKey: string | null;
  window: ValidityWindow;
  /** when this output was made: the stored row's `created_at` on a hit, the call's time when made now */
  madeAt: Date;
}

let storeWarned = false;
let techniqueOutputUsedHook: ((owner: { userId?: string | null; kundliId?: string | null }) => void) | null = null;

export function setTechniqueOutputUsedHook(
  fn: ((owner: { userId?: string | null; kundliId?: string | null }) => void) | null,
): void {
  techniqueOutputUsedHook = fn;
}

function notifyTechniqueUsed(userId?: string | null, kundliId?: string | null): void {
  if ((userId || kundliId) && techniqueOutputUsedHook) {
    try {
      techniqueOutputUsedHook({ userId: userId ?? null, kundliId: kundliId ?? null });
    } catch {
      // never break technique output store
    }
  }
}

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
    if (!rows[0]) return null;
    const opened = await openRow('technique_outputs', rows[0] as unknown as Record<string, unknown>);
    return opened as unknown as StoredTechniqueOutputRow;
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
    const sealedOutput = await sealParam('technique_outputs', 'output', row.output ?? null, { kundliId: row.kundli_id });
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
      JSON.stringify(sealedOutput),
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
  let expiredExisting = Boolean(input.forceRefresh);

  if (cacheKey !== null && !input.forceRefresh) {
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
          notifyTechniqueUsed(input.userId, input.kundliId);
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
            madeAt: existing.created_at ? asDate(existing.created_at) : input.context.now,
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
      notifyTechniqueUsed(input.userId, input.kundliId);
    } catch (e) {
      warnOnce('write', e);
    }
  }

  return {
    value,
    cached: false,
    cacheKey,
    window: effectiveWindow,
    madeAt: input.context.now,
  };
}

/**
 * The newest stored output of a technique for a kundli, whatever its window or key (docs/billing/03: a board keeps
 * showing its last reading until the person asks for a fresh one). `digestContains` narrows the key (a board, a scope).
 * Null when none is stored or the store cannot be read.
 */
export async function latestStoredOutput<T>(
  prisma: PrismaClient,
  q: { techniqueId: string; kundliId: string; digestContains?: string },
): Promise<{ value: T; madeAt: Date; validTo: Date | null } | null> {
  const store = prisma as StoreCapablePrisma;
  try {
    const row = await store.techniqueOutput?.findFirst?.({
      where: { technique_id: q.techniqueId, kundli_id: q.kundliId, ...(q.digestContains ? { digest_version: { contains: q.digestContains } } : {}) },
      orderBy: { created_at: 'desc' },
    });
    if (!row) return null;
    return { value: row.output as T, madeAt: row.created_at ? asDate(row.created_at) : asDate(row.valid_from), validTo: row.valid_to ? asDate(row.valid_to) : null };
  } catch (e) {
    warnOnce('read', e);
    return null;
  }
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

export const LLM_TECHNIQUE_AGENT_IDS: readonly string[] = Object.freeze(
  AGENTS.filter((a) => a.kind === 'llm').map((a) => a.id),
);

/**
 * Returns true when a stored `technique_outputs` row is protected from the 45-minute idle recycler:
 * - Permanent natal outputs (`freshness === 'natal'` or `valid_to === null`) never change until digest rebuild.
 * - Unexpired (`valid_to > now`) LLM outputs (`made_by_kind === 'llm'` or `made_by_agent` in `LLM_TECHNIQUE_AGENT_IDS`)
 *   and `board.bundle*` outputs stay valid until their `valid_to` window ends.
 */
export function isProtectedTechniqueOutputRow(
  row: Partial<StoredTechniqueOutputRow> & { made_by_kind?: string | null },
  now: Date = new Date(),
): boolean {
  if (row.freshness === 'natal') return true;
  if ('valid_to' in row && row.valid_to === null) return true;
  const validTo = row.valid_to ? asDate(row.valid_to) : null;
  if (validTo && validTo.getTime() <= now.getTime()) return false;
  if ((row.technique_id ?? '').startsWith('board.bundle')) return true;
  if (row.made_by_kind === 'llm') return true;
  if (row.made_by_agent && LLM_TECHNIQUE_AGENT_IDS.includes(row.made_by_agent)) return true;
  return false;
}

/**
 * Recycles stored technique outputs for a single kundli that have already been used (`hit_count > 0` or `last_hit_at IS NOT NULL`,
 * when `onlyUsed !== false`) and are idle longer than `idleMs` (or immediately when `idleMs` is 0 / omitted).
 * Permanent natal rows (`freshness = 'natal'` / `valid_to IS NULL`) and unexpired LLM / `board.bundle*` rows are preserved.
 */
export async function recycleIndividualTechniqueOutputs(
  prisma: PrismaClient | null | undefined,
  owner: { kundliId?: string | null },
  opts: { onlyUsed?: boolean; idleMs?: number; now?: Date } = {},
): Promise<number> {
  if (!prisma || !owner.kundliId) return 0;
  const store = prisma as StoreCapablePrisma;
  const now = opts.now ?? new Date();
  const onlyUsed = opts.onlyUsed ?? true;
  const idleBefore = opts.idleMs && opts.idleMs > 0 ? new Date(now.getTime() - opts.idleMs) : undefined;
  const nonProtectedClause = [
    { freshness: { not: 'natal' } },
    { valid_to: { not: null } },
    {
      OR: [
        { valid_to: { lte: now } },
        {
          AND: [
            { NOT: { technique_id: { startsWith: 'board.bundle' } } },
            { OR: [{ made_by_agent: null }, { made_by_agent: { notIn: [...LLM_TECHNIQUE_AGENT_IDS] } }] },
          ],
        },
      ],
    },
  ];
  try {
    if (store.techniqueOutput?.deleteMany) {
      const where: Record<string, unknown> = { kundli_id: owner.kundliId };
      if (onlyUsed) {
        where.AND = [
          { OR: [{ hit_count: { gt: 0 } }, { last_hit_at: { not: null } }] },
          ...(idleBefore
            ? [{ OR: [{ last_hit_at: { lte: idleBefore } }, { AND: [{ last_hit_at: null }, { created_at: { lte: idleBefore } }] }] }]
            : []),
          ...nonProtectedClause,
        ];
      } else if (idleBefore) {
        where.AND = [
          { OR: [{ last_hit_at: { lte: idleBefore } }, { AND: [{ last_hit_at: null }, { created_at: { lte: idleBefore } }] }] },
          ...nonProtectedClause,
        ];
      } else {
        where.AND = [...nonProtectedClause];
      }
      const res = await store.techniqueOutput.deleteMany({ where });
      return res.count;
    }
    if (typeof store.$executeRawUnsafe === 'function') {
      const cutoff = idleBefore ?? now;
      return await store.$executeRawUnsafe(
        onlyUsed
          ? `DELETE FROM "technique_outputs"
              WHERE "kundli_id" = $1
                AND ("hit_count" > 0 OR "last_hit_at" IS NOT NULL)
                AND COALESCE("last_hit_at", "created_at") <= $2
                AND "freshness" <> 'natal'
                AND "valid_to" IS NOT NULL
                AND (
                  "valid_to" <= $3
                  OR (
                    "technique_id" NOT LIKE 'board.bundle%'
                    AND ("made_by_agent" IS NULL OR NOT ("made_by_agent" = ANY($4::text[])))
                  )
                )`
          : `DELETE FROM "technique_outputs"
              WHERE "kundli_id" = $1
                AND COALESCE("last_hit_at", "created_at") <= $2
                AND "freshness" <> 'natal'
                AND "valid_to" IS NOT NULL
                AND (
                  "valid_to" <= $3
                  OR (
                    "technique_id" NOT LIKE 'board.bundle%'
                    AND ("made_by_agent" IS NULL OR NOT ("made_by_agent" = ANY($4::text[])))
                  )
                )`,
        owner.kundliId,
        cutoff,
        now,
        [...LLM_TECHNIQUE_AGENT_IDS],
      );
    }
  } catch (e) {
    warnOnce('recycle', e);
  }
  return 0;
}

const DAY_MS = 24 * 3_600_000;

/**
 * Sweep (`cache:sweep`, docs/reading-engine/56 §4.1): deletes expired rows whose `valid_to < now - 1 day`,
 * and when `opts.recycleUsedAfterMs` is set, also recycles already-used rows (`hit_count > 0` or `last_hit_at IS NOT NULL`)
 * idle longer than `recycleUsedAfterMs` (45 minutes), bounded to `limit` rows per run (default 5,000).
 * Permanent natal rows (`freshness = 'natal'` / `valid_to IS NULL`) and unexpired LLM / `board.bundle*` rows are preserved.
 */
export async function sweepTechniqueOutputs(
  prisma: PrismaClient,
  now: Date = new Date(),
  limit = 5_000,
  opts: { recycleUsedAfterMs?: number } = {},
): Promise<number> {
  const store = prisma as StoreCapablePrisma;
  const cutoff = new Date(now.getTime() - DAY_MS);
  const cap = Math.max(1, Math.min(50_000, Math.trunc(limit)));
  const usedIdleBefore =
    opts.recycleUsedAfterMs && opts.recycleUsedAfterMs > 0 ? new Date(now.getTime() - opts.recycleUsedAfterMs) : null;
  try {
    if (typeof store.$executeRawUnsafe === 'function') {
      if (usedIdleBefore) {
        return await store.$executeRawUnsafe(
          `DELETE FROM "technique_outputs"
            WHERE "cache_key" IN (
              SELECT "cache_key" FROM "technique_outputs"
               WHERE ("valid_to" IS NOT NULL AND "valid_to" < $1)
                  OR (
                    ("hit_count" > 0 OR "last_hit_at" IS NOT NULL)
                    AND COALESCE("last_hit_at", "created_at") <= $3
                    AND "freshness" <> 'natal'
                    AND "valid_to" IS NOT NULL
                    AND (
                      "valid_to" <= $4
                      OR (
                        "technique_id" NOT LIKE 'board.bundle%'
                        AND ("made_by_agent" IS NULL OR NOT ("made_by_agent" = ANY($5::text[])))
                      )
                    )
                  )
               ORDER BY COALESCE("valid_to", "last_hit_at", "created_at") ASC
               LIMIT $2
            )`,
          cutoff,
          cap,
          usedIdleBefore,
          now,
          [...LLM_TECHNIQUE_AGENT_IDS],
        );
      }
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
        where: usedIdleBefore
          ? {
              OR: [
                { valid_to: { not: null, lt: cutoff } },
                {
                  AND: [
                    { OR: [{ hit_count: { gt: 0 } }, { last_hit_at: { not: null } }] },
                    { OR: [{ last_hit_at: { lte: usedIdleBefore } }, { AND: [{ last_hit_at: null }, { created_at: { lte: usedIdleBefore } }] }] },
                    { freshness: { not: 'natal' } },
                    { valid_to: { not: null } },
                    {
                      OR: [
                        { valid_to: { lte: now } },
                        {
                          AND: [
                            { NOT: { technique_id: { startsWith: 'board.bundle' } } },
                            { OR: [{ made_by_agent: null }, { made_by_agent: { notIn: [...LLM_TECHNIQUE_AGENT_IDS] } }] },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            }
          : { valid_to: { not: null, lt: cutoff } },
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

