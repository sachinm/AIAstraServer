/**
 * Gathers the stored Radha tables one question needs (docs/reading-engine/39 §4.1): one query for selected types, never
 * the whole kundli (142 rows and about 2.1M characters per person), and an in-process cache so the load started while the
 * clarifier talks is what the reading uses. Reads `kundli_data` only. A missing type is reported, never fetched here and
 * never computed: fetching belongs to the chart-build owner (docs/reading-engine/38).
 */
import type { PrismaClient } from '@prisma/client';
import { readingCacheTtlMs } from '../config.js';

/** Identical for every reader of one person: the cached prefix of every reader call. Clears Gemini's 4,096-token minimum. */
export const CORE_TYPES = ['panchanga.birth', 'varga.d1', 'dignities', 'benefic_malefic', 'relations', 'ashtakavarga', 'strength.shadbala', 'karaka.chara', 'arudhas'] as const;

const isAnnual = (type: string): boolean => type.startsWith('annual.');

export interface ChartRow {
  data_type: string;
  variant: string;
  payload: unknown;
}

/** Reads rows. A seam so tests count queries and never need a database. */
export interface ChartRowSource {
  read(kundliId: string, types: string[]): Promise<ChartRow[]>;
}

export function prismaChartRows(prisma: PrismaClient): ChartRowSource {
  return {
    read: (kundliId, types) =>
      prisma.kundliData.findMany({
        where: { kundli_id: kundliId, status: 'ready', data_type: { in: types } },
        select: { data_type: true, variant: true, payload: true },
      }) as Promise<ChartRow[]>,
  };
}

export interface ChartBundle {
  kundliId: string;
  /** type id → the stored payload (annual types: the row for the year running on `asOf`) */
  tables: Record<string, unknown>;
  /** asked for and not stored */
  missing: string[];
  ms: number;
  /** how many rows came from this instance's cache and how many from the database */
  fromCache: number;
  fromDb: number;
}

interface CacheEntry {
  at: number;
  /** every row read for the type: annual types hold several years */
  rows: Map<string, ChartRow[]>;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<void>>();

export function clearChartBundles(): void {
  cache.clear();
  inflight.clear();
}

/** The row of an annual type whose `valid_from`/`valid_to` (fields Radha gave) hold the date, preferring the default dasha system. */
function annualRow(rows: ChartRow[], asOf: string): ChartRow | undefined {
  const holds = rows.filter((r) => {
    const p = r.payload as { valid_from?: unknown; valid_to?: unknown } | null;
    return typeof p?.valid_from === 'string' && typeof p?.valid_to === 'string' && p.valid_from.slice(0, 10) <= asOf && asOf <= p.valid_to.slice(0, 10);
  });
  return holds.find((r) => !r.variant.includes(';') || r.variant.includes('system=tithi_ashtottari')) ?? holds[0];
}

/**
 * The planned tables of one kundli. Types already cached are not read again, so a reading after prewarm makes no query.
 * Concurrent loads of the same types share one query. Never throws: a failed read reports the types as missing.
 */
export async function loadChartBundle(source: ChartRowSource, kundliId: string, types: readonly string[], asOf: string): Promise<ChartBundle> {
  const t0 = Date.now();
  let entry = cache.get(kundliId);
  if (entry && Date.now() - entry.at >= readingCacheTtlMs()) {
    cache.delete(kundliId);
    entry = undefined;
  }
  const wanted = [...new Set(types)];
  const toRead = wanted.filter((t) => !entry?.rows.has(t));
  const fromCache = wanted.length - toRead.length;
  if (toRead.length) {
    const key = `${kundliId}|${[...toRead].sort().join(',')}`;
    let pending = inflight.get(key);
    if (!pending) {
      pending = source
        .read(kundliId, toRead)
        .then((rows) => {
          const e = cache.get(kundliId) ?? { at: Date.now(), rows: new Map<string, ChartRow[]>() };
          for (const t of toRead) e.rows.set(t, rows.filter((r) => r.data_type === t));
          cache.set(kundliId, e);
        })
        .catch((err) => {
          console.warn(JSON.stringify({ msg: 'chart bundle read failed', types: toRead.length, error: (err as Error).message.slice(0, 200) }));
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    await pending;
  }
  const rows = cache.get(kundliId)?.rows;
  const tables: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const t of wanted) {
    const found = rows?.get(t) ?? [];
    const row = isAnnual(t) ? annualRow(found, asOf) : found.find((r) => r.variant === '');
    if (row && row.payload !== null && row.payload !== undefined) tables[t] = row.payload;
    else missing.push(t);
  }
  return { kundliId, tables, missing, ms: Date.now() - t0, fromCache, fromDb: toRead.length };
}
