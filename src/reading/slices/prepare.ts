/**
 * Where slices are made and read (docs/reading-engine/70 §4.1 Layer 1, §7 step 3).
 *
 * - At sync (`writeSlicesAtSync`), right after the clock set's inventories are pulled: the stored inventories are read
 *   once, a frame is cut from them (the spine's edges, the stored Tithi Pravesha year row covering today), and the slice
 *   set is rendered and written. No natal slice here: `natal.core` needs the digest packs, which the build holds.
 * - In the build (`prepareSlices`): the stored slices are read; a stored slice whose hash equals the one the build's own
 *   rows give is used as stored, any other is replaced by the fresh one and written back (the frame moves with today
 *   and the build knows the year chart keys, so a slice written at sync can be a day old). The build hands the clock
 *   layer what this returns, never raw rows.
 *
 * Selection, joins and formatting only (see render.ts). Neither function throws.
 */
import type { PrismaClient } from '@prisma/client';
import type { ReadingClockSet } from '../self/clock.js';
import type { PressureInventoryDetail } from '../self/sub/pressure.js';
import type { YearFrame } from '../self/v2types.js';
import type { YearFrameV3 } from '../self/v3/types.js';
import { buildYearFrameV3, loadStoredInventory } from '../self/v3/yearFrame.js';
import { cmp, renderSliceSet, type SliceInventory } from './render.js';
import { readSlices, writeSlices } from './store.js';
import type { RenderedSlice, StoredSlice } from './types.js';
import { estProviderTokens, shortHash } from '../self/v2/slices.js';

export interface SliceSetReport {
  /** ids used as stored (hash unchanged) */
  read: string[];
  /** ids rendered fresh and written (or that failed to write) */
  written: string[];
  failed: Array<{ id: string; error: string }>;
}

/** The year the frame's edge comes from at sync: the stored level-1 annual row covering today (selection only). */
export function storedYearAt(inv: PressureInventoryDetail | null, asOf: string): YearFrame | null {
  const r = inv?.rows.find((x) => x.kind === 'annual' && (x.level ?? 1) === 1 && x.from <= asOf && asOf < x.to) ?? null;
  return r ? { from: r.from, to: r.to, yearLagna: null, yearLord: null, shortClock: null, noCoverage: false } : null;
}

export interface SyncSliceDeps {
  load?: (prisma: PrismaClient, kundliId: string, system: string) => Promise<PressureInventoryDetail | null>;
  write?: typeof writeSlices;
}

export interface SyncSliceResult extends SliceSetReport {
  frame: YearFrameV3 | null;
  slices: number;
  gaps: string[];
}

/** At sync: render the slice set from the stored inventories of the clock set and write what changed. Never throws. */
export async function writeSlicesAtSync(prisma: PrismaClient, kundliId: string, asOf: string, set: Pick<ReadingClockSet, 'spine' | 'pulled'>, deps: SyncSliceDeps = {}): Promise<SyncSliceResult> {
  const out: SyncSliceResult = { frame: null, slices: 0, read: [], written: [], failed: [], gaps: [] };
  try {
    const load = deps.load ?? loadStoredInventory;
    const stored = await Promise.all(set.pulled.map(async (system) => ({ system, inventory: await load(prisma, kundliId, system).catch(() => null) })));
    const invs: SliceInventory[] = stored.filter((x): x is SliceInventory => Boolean(x.inventory));
    const primary = invs.find((x) => x.system === set.spine)?.inventory ?? null;
    if (!primary) {
      out.gaps.push(`slices: no stored inventory for the spine clock ${set.spine}`);
      return out;
    }
    const frame = buildYearFrameV3({
      asOf,
      clock: { primary: set.spine, confirming: [], applicable: [], notApplicable: [] },
      primary,
      others: stored.filter((x) => x.system !== set.spine),
      year: storedYearAt(primary, asOf),
    });
    out.frame = frame;
    if (!frame.spans.length) {
      out.gaps.push('slices: no frame could be cut from the stored rows');
      return out;
    }
    const slices = renderSliceSet({ frame, inventories: invs });
    out.slices = slices.length;
    const w = await (deps.write ?? writeSlices)(prisma, kundliId, slices);
    out.written = w.written;
    out.read = w.unchanged;
    out.failed = w.failed;
    return out;
  } catch (e) {
    out.gaps.push(`slices: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
    return out;
  }
}

/** `natal.core` from the build's natal prefix (the v2 Oracle prefix: the D1 and divisional packs and the promise ledger). */
export function natalCoreFromPrefix(prefix: string, version: string): RenderedSlice {
  const keys = [...new Set([...prefix.matchAll(/\{([^{}\s]+)\}/g)].map((m) => m[1]!))].sort(cmp);
  const hash = shortHash(`natal.core\n${prefix}\n${keys.join(' ')}`);
  return { id: 'natal.core', text: prefix, keys, estTokens: estProviderTokens(prefix), sources: [{ dataType: 'kundli_digest', variant: version, calcVersion: version, hash: shortHash(prefix) }], hash };
}

export interface PrepareSlicesDeps {
  read?: typeof readSlices;
  write?: typeof writeSlices;
}

/**
 * In the build: the stored slice when its hash equals the fresh one, else the fresh one, written back. Returns the
 * slices in the fresh set's order. Never throws (a store that cannot be read or written leaves the fresh slices).
 */
export async function prepareSlices(prisma: PrismaClient, kundliId: string, fresh: readonly RenderedSlice[], deps: PrepareSlicesDeps = {}): Promise<{ slices: RenderedSlice[]; report: SliceSetReport }> {
  const report: SliceSetReport = { read: [], written: [], failed: [] };
  let stored: Record<string, StoredSlice> = {};
  try {
    stored = await (deps.read ?? readSlices)(prisma, kundliId, fresh.map((s) => s.id));
  } catch {
    stored = {};
  }
  const slices: RenderedSlice[] = [];
  const changed: RenderedSlice[] = [];
  for (const s of fresh) {
    const st = stored[s.id];
    if (st && st.hash === s.hash) {
      report.read.push(s.id);
      slices.push({ id: st.id, text: st.text, keys: st.keys, estTokens: st.estTokens, sources: st.sources, hash: st.hash });
    } else {
      changed.push(s);
      slices.push(s);
    }
  }
  if (changed.length) {
    try {
      const w = await (deps.write ?? writeSlices)(prisma, kundliId, changed);
      report.written = [...w.written, ...w.unchanged];
      report.failed = w.failed;
    } catch (e) {
      report.failed = changed.map((s) => ({ id: s.id, error: String((e as Error)?.message ?? e).slice(0, 200) }));
    }
  }
  return { slices, report };
}
