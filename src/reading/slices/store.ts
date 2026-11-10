/**
 * The slice store (`kundli_slices`, M48; docs/reading-engine/70 §4.1 Layer 1). One row per kundli per slice id, written
 * right after a pull and read by the build, which never renders raw rows. A slice whose hash has not changed is not
 * written again. `text` and `keys` are sealed by the Prisma extension (SEALED_MODELS.KundliSlice).
 *
 * Neither function throws: a store that cannot be reached (no table yet, a test fake) is reported, never fatal.
 */
import type { PrismaClient } from '@prisma/client';
import type { RenderedSlice, SliceId, SliceSource, StoredSlice } from './types.js';

type SliceRow = {
  kundli_id: string;
  slice_id: string;
  text: string;
  keys: unknown;
  est_tokens: number;
  sources: unknown;
  hash: string;
  built_at: Date | string;
};

type SlicePrisma = {
  kundliSlice?: {
    findMany?: (q: { where: { kundli_id: string; slice_id?: { in: string[] } }; select?: Record<string, boolean> }) => Promise<Array<Partial<SliceRow>>>;
    upsert?: (q: {
      where: { kundli_slice_key: { kundli_id: string; slice_id: string } };
      create: Omit<SliceRow, 'built_at'> & { built_at: Date };
      update: Omit<SliceRow, 'kundli_id' | 'slice_id' | 'built_at'> & { built_at: Date };
    }) => Promise<unknown>;
  };
};

export interface WriteSlicesResult {
  written: SliceId[];
  unchanged: SliceId[];
  failed: Array<{ id: SliceId; error: string }>;
}

/** Writes every slice whose hash differs from the stored one (all of them when the stored hashes cannot be read). */
export async function writeSlices(prisma: PrismaClient, kundliId: string, slices: readonly RenderedSlice[], now: Date = new Date()): Promise<WriteSlicesResult> {
  const p = prisma as unknown as SlicePrisma;
  const out: WriteSlicesResult = { written: [], unchanged: [], failed: [] };
  if (!p.kundliSlice?.upsert) {
    out.failed.push(...slices.map((s) => ({ id: s.id, error: 'no kundli_slices store in this context' })));
    return out;
  }
  const stored = new Map<string, string>();
  try {
    const rows = (await p.kundliSlice.findMany?.({ where: { kundli_id: kundliId, slice_id: { in: slices.map((s) => s.id) } }, select: { slice_id: true, hash: true } })) ?? [];
    for (const r of rows) if (r.slice_id && r.hash) stored.set(r.slice_id, r.hash);
  } catch {
    // write everything
  }
  await Promise.all(
    slices.map(async (s) => {
      if (stored.get(s.id) === s.hash) {
        out.unchanged.push(s.id);
        return;
      }
      const data = { text: s.text, keys: s.keys, est_tokens: s.estTokens, sources: s.sources, hash: s.hash, built_at: now };
      try {
        await p.kundliSlice!.upsert!({ where: { kundli_slice_key: { kundli_id: kundliId, slice_id: s.id } }, create: { kundli_id: kundliId, slice_id: s.id, ...data }, update: data });
        out.written.push(s.id);
      } catch (e) {
        out.failed.push({ id: s.id, error: String((e as Error).message ?? e).slice(0, 200) });
      }
    }),
  );
  const order = new Map(slices.map((s, i) => [s.id, i]));
  const byOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  out.written.sort(byOrder);
  out.unchanged.sort(byOrder);
  return out;
}

/** The stored slices of a kundli by id (all of them, or the ids asked for). Empty when none or unreadable. */
export async function readSlices(prisma: PrismaClient, kundliId: string, ids?: readonly SliceId[]): Promise<Record<SliceId, StoredSlice>> {
  const p = prisma as unknown as SlicePrisma;
  const out: Record<SliceId, StoredSlice> = {};
  if (!p.kundliSlice?.findMany) return out;
  try {
    const rows = await p.kundliSlice.findMany({ where: { kundli_id: kundliId, ...(ids ? { slice_id: { in: [...ids] } } : {}) } });
    for (const r of rows) {
      if (!r.slice_id || typeof r.text !== 'string' || !r.hash) continue;
      out[r.slice_id] = {
        id: r.slice_id,
        text: r.text,
        keys: Array.isArray(r.keys) ? (r.keys as unknown[]).filter((k): k is string => typeof k === 'string') : [],
        estTokens: Number(r.est_tokens ?? 0),
        sources: Array.isArray(r.sources) ? (r.sources as SliceSource[]) : [],
        hash: r.hash,
        builtAt: r.built_at instanceof Date ? r.built_at.toISOString() : String(r.built_at ?? ''),
      };
    }
  } catch (e) {
    console.warn(JSON.stringify({ msg: 'kundli slices read failed', error: (e as Error).message?.slice(0, 200) }));
  }
  return out;
}
