/**
 * The clock layer's cache (doc 70 Phase 3 replay fixes, 2026-11-10): the readers' sheets and the agreed ledger, stored
 * once per kundli, so a second open the same day reads one row and makes no reader or concordance call.
 *
 * Stored in the slice store (`kundli_slices`, M48) as the row `layer.clock`: `hash` is the cache key, `text` the entry as
 * JSON (sealed like every slice text). The key carries everything the layer's output depends on: the as-of day, the
 * clock set, the model, the hash of every slice the readers read (the shared prefix and each `clock.<system>`), the frame,
 * the three prompts' hashes and the reader input version. Any change misses.
 *
 * M48 is not applied on staging yet: with no table (Prisma P2021, "does not exist") or no store in the client (test
 * fakes), read returns null and write does nothing, without a warning. The per-sheet and ledger rows in
 * `technique_outputs` (reader.ts, concordance.ts) still serve a warm open there. Nothing here throws.
 */
import type { PrismaClient } from '@prisma/client';
import { promptHash, shortHash } from '../self/v2/slices.js';
import { cmp } from '../slices/render.js';
import { CLOCK_READER_PROMPT, CONCORDANCE_PROMPT, READER_SYSTEM_PROMPT, type AgreedLedger, type ClockSheet } from './types.js';

export const LAYER_CACHE_SLICE_ID = 'layer.clock';
/** bump when the layer's output changes for the same inputs (a validator or a count rule) */
export const LAYER_CACHE_VERSION = 1;
/** The readers' and the concordance's input version (how the slices are cut and the count is rendered). 1 = as built in Phase 3. */
export const READER_INPUT_VERSION = 1;

export interface LayerCacheKeyInput {
  asOf: string;
  model: string;
  /** hash of the shared prefix (natal.core, sky.window, year.tp, frame) */
  prefixHash: string;
  frameHash: string;
  /** every `clock.<system>` slice read, as stored (before any cut) */
  clockSlices: ReadonlyArray<{ id: string; hash: string }>;
  /** defaults to the hashes of the three prompts the layer runs on */
  promptVersion?: string;
}

/** the prompts' part of the key: the common reader system prompt, the clock reader's and the concordance's */
export const layerPromptVersion = (): string => [READER_SYSTEM_PROMPT, CLOCK_READER_PROMPT, CONCORDANCE_PROMPT].map(promptHash).join('.');

/** the clock set, as the key names it: the systems read, sorted */
export const clockSetHash = (clockSlices: LayerCacheKeyInput['clockSlices']): string => shortHash(clockSlices.map((s) => s.id).sort(cmp).join(','));

export function layerCacheKey(i: LayerCacheKeyInput): string {
  const slices = [...i.clockSlices].sort((a, b) => cmp(a.id, b.id)).map((s) => `${s.id}:${s.hash}`).join('|');
  return [
    `v${LAYER_CACHE_VERSION}`,
    `in${READER_INPUT_VERSION}`,
    i.asOf,
    `set=${clockSetHash(i.clockSlices)}`,
    `m=${i.model}`,
    `pre=${i.prefixHash}`,
    `frame=${i.frameHash}`,
    `slices=${shortHash(slices)}`,
    `p=${i.promptVersion ?? layerPromptVersion()}`,
  ].join('|');
}

export interface LayerCacheEntry {
  v: number;
  key: string;
  asOf: string;
  status: 'ok' | 'partial';
  sheets: ClockSheet[];
  ledger: AgreedLedger;
}

type Row = { slice_id?: string; text?: string; hash?: string };
type Store = {
  kundliSlice?: {
    findMany?: (q: { where: { kundli_id: string; slice_id: { in: string[] } } }) => Promise<Row[]>;
    upsert?: (q: { where: { kundli_slice_key: { kundli_id: string; slice_id: string } }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
  };
};

/** P2021 (table missing) or the same in words: M48 not applied, a quiet no-op */
export const isMissingTable = (e: unknown): boolean => {
  const o = e as { code?: string; message?: string } | null;
  return o?.code === 'P2021' || /does not exist/i.test(String(o?.message ?? ''));
};

let warned = false;
const warnOnce = (what: string, e: unknown) => {
  if (warned || isMissingTable(e)) return;
  warned = true;
  console.warn(JSON.stringify({ msg: `clock layer cache ${what} failed`, error: String((e as Error)?.message ?? e).slice(0, 200) }));
};

/** The stored entry for this key, or null (no row, another key, unreadable, no table). */
export async function readLayerCache(prisma: PrismaClient, kundliId: string, key: string): Promise<LayerCacheEntry | null> {
  const store = (prisma as unknown as Store | null)?.kundliSlice;
  if (!store?.findMany) return null;
  try {
    const rows = await store.findMany({ where: { kundli_id: kundliId, slice_id: { in: [LAYER_CACHE_SLICE_ID] } } });
    const row = rows.find((r) => r.slice_id === LAYER_CACHE_SLICE_ID);
    if (!row || row.hash !== key || typeof row.text !== 'string') return null;
    const e = JSON.parse(row.text) as LayerCacheEntry;
    if (e?.key !== key || e.v !== LAYER_CACHE_VERSION || !Array.isArray(e.sheets) || !e.ledger || !Array.isArray(e.ledger.cells)) return null;
    return e;
  } catch (e) {
    warnOnce('read', e);
    return null;
  }
}

/** Stores the entry under its key (one row per kundli, replaced). Returns whether it was written. */
export async function writeLayerCache(prisma: PrismaClient, kundliId: string, entry: LayerCacheEntry, now: Date = new Date()): Promise<boolean> {
  const store = (prisma as unknown as Store | null)?.kundliSlice;
  if (!store?.upsert) return false;
  const text = JSON.stringify(entry);
  const data = { text, keys: [], est_tokens: 0, sources: [], hash: entry.key, built_at: now };
  try {
    await store.upsert({ where: { kundli_slice_key: { kundli_id: kundliId, slice_id: LAYER_CACHE_SLICE_ID } }, create: { kundli_id: kundliId, slice_id: LAYER_CACHE_SLICE_ID, ...data }, update: data });
    return true;
  } catch (e) {
    warnOnce('write', e);
    return false;
  }
}

/** tests */
export function resetLayerCacheWarning(): void {
  warned = false;
}
