/**
 * The clock layer end to end (docs/reading-engine/70 §4.1 layers 2–3 and "Cache"): warm the one cache (the common system
 * prompt plus natal.core, sky.window, year.tp and frame), run one reader per clock in parallel, count, run the
 * concordance, and return the sheets, the count, the pair table, the ledger, the agent timings and the issues.
 *
 * Behind READING_CLOCK_LAYER=1 (`isReadingClockLayerEnabled`). Not wired into the live build yet (doc 70 Phase 3 does
 * that). Never throws.
 */
import { isReadingClockLayerEnabled } from '../../config/env.js';
import type { ensurePromptCache } from '../llm/promptCache.js';
import { modelFor } from '../llm/models.js';
import { warmPrefixes } from '../self/v2/cache.js';
import { promptText } from '../self/v2/slices.js';
import type { PreparedAgentSlice, WarmedRegion } from '../self/v2types.js';
import type { YearFrameV3 } from '../self/v3/types.js';
import { TP_SYSTEM } from '../self/v3/yearFrame.js';
import type { RenderedSlice } from '../slices/types.js';
import { runConcordance } from './concordance.js';
import { readClocks, sharedPrefix, systemOfSlice, type ClockCallContext, type ClockCallDeps } from './reader.js';
import {
  CLOCK_AGENT,
  READER_SYSTEM_PROMPT,
  type AgreedLedger,
  type ClockAgentTiming,
  type ClockIssue,
  type ClockLayerSlices,
  type ClockSheet,
  type ConcordanceCount,
  type PairRow,
} from './types.js';

/** fewer readable sheets than this and no ledger is written (doc 70 §4.1 Layer 0: "at least three clocks") */
export const CLOCK_LAYER_MIN_SHEETS = 3;

export interface ClockLayerDeps extends ClockCallDeps {
  /** test seam: defaults to `ensurePromptCache` (through `warmPrefixes`) */
  ensureCache?: typeof ensurePromptCache;
  /** overrides the READING_CLOCK_LAYER flag */
  enabled?: boolean;
  /** overrides CLOCK_LAYER_MIN_SHEETS */
  minSheets?: number;
  /** the model every call of the layer runs on (one model, so one cache region serves them all); default the oracle role's */
  model?: string;
}

export interface ClockLayerInput {
  ctx: ClockCallContext;
  frame: YearFrameV3;
  /** the stored or freshly rendered slices, by id or as a list; `clock.<system>` slices are read in the order given */
  slices: Readonly<Record<string, RenderedSlice>> | readonly RenderedSlice[];
}

export type ClockLayerStatus = 'off' | 'ok' | 'partial' | 'too_few_clocks' | 'missing_slices' | 'budget_exceeded';

export interface ClockLayerResult {
  status: ClockLayerStatus;
  model: string;
  prefixHash: string | null;
  warmed: WarmedRegion[];
  sheets: ClockSheet[];
  count: ConcordanceCount | null;
  pairs: PairRow[];
  ledger: AgreedLedger | null;
  timings: ClockAgentTiming[];
  issues: ClockIssue[];
  spentUsd: number;
  ms: { warm: number; readers: number; concordance: number; total: number };
}

/** Picks the shared slices and the clock slices (the year last when not placed) out of what the build read. */
export function pickClockLayerSlices(slices: ClockLayerInput['slices']): { picked: ClockLayerSlices | null; missing: string[] } {
  const list = Array.isArray(slices) ? (slices as readonly RenderedSlice[]) : Object.values(slices as Record<string, RenderedSlice>);
  const by = new Map(list.map((s) => [s.id, s]));
  const missing = ['sky.window', 'year.tp', 'frame'].filter((id) => !by.has(id));
  const clocks = list.filter((s) => s.id.startsWith('clock.'));
  if (!clocks.length) missing.push('clock.*');
  if (missing.length) return { picked: null, missing };
  const year = clocks.filter((s) => systemOfSlice(s) === TP_SYSTEM);
  const others = clocks.filter((s) => systemOfSlice(s) !== TP_SYSTEM);
  return {
    picked: { shared: { natal: by.get('natal.core') ?? null, sky: by.get('sky.window')!, year: by.get('year.tp')!, frame: by.get('frame')! }, clocks: [...others, ...year] },
    missing: by.has('natal.core') ? [] : ['natal.core'],
  };
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export async function runClockLayer(deps: ClockLayerDeps, input: ClockLayerInput): Promise<ClockLayerResult> {
  const t0 = performance.now();
  const model = deps.model ?? modelFor('oracle');
  const result: ClockLayerResult = {
    status: 'off',
    model,
    prefixHash: null,
    warmed: [],
    sheets: [],
    count: null,
    pairs: [],
    ledger: null,
    timings: [],
    issues: [],
    spentUsd: deps.spentUsd ?? 0,
    ms: { warm: 0, readers: 0, concordance: 0, total: 0 },
  };
  const done = (status: ClockLayerStatus): ClockLayerResult => {
    result.status = status;
    result.spentUsd = round6((deps.spentUsd ?? 0) + result.timings.reduce((n, x) => n + x.costUsd, 0));
    result.ms.total = Math.round(performance.now() - t0);
    return result;
  };
  try {
    if (!(deps.enabled ?? isReadingClockLayerEnabled())) return done('off');
    const { picked, missing } = pickClockLayerSlices(input.slices);
    if (!picked) {
      result.issues.push({ stage: 'clock', system: null, cell: null, check: 'call_failed', message: `slices missing: ${missing.join(', ')}` });
      return done('missing_slices');
    }
    if (missing.length) result.issues.push({ stage: 'clock', system: null, cell: null, check: 'call_failed', message: `slices missing (read without): ${missing.join(', ')}` });
    const min = deps.minSheets ?? CLOCK_LAYER_MIN_SHEETS;
    if (picked.clocks.length < min) {
      result.issues.push({ stage: 'clock', system: null, cell: null, check: 'call_failed', message: `${picked.clocks.length} clock slices; at least ${min} are needed` });
      return done('too_few_clocks');
    }

    // 1. one cache for every agent of the layer: the common system prompt + the shared prefix
    const prefix = sharedPrefix(picked.shared);
    result.prefixHash = prefix.hash;
    const system = promptText(READER_SYSTEM_PROMPT);
    const warmSlice = {
      agent: CLOCK_AGENT,
      prefix: prefix.text,
      suffix: '',
      prefixHash: prefix.hash,
      cacheOwner: { userId: input.ctx.userId, kundliId: input.ctx.kundliId },
      model,
      system,
      estTokens: { prefix: Math.ceil(prefix.text.length / 2.2), suffix: 0 },
      keys: prefix.keys,
    } as unknown as PreparedAgentSlice;
    const tw = performance.now();
    result.warmed = await warmPrefixes([warmSlice], { ensureCache: deps.ensureCache });
    result.ms.warm = Math.round(performance.now() - tw);

    // 2. the readers, all at once
    const tr = performance.now();
    const reads = await readClocks(deps, input.ctx, input.frame, picked, model);
    result.ms.readers = Math.round(performance.now() - tr);
    for (const r of reads) {
      result.sheets.push(r.sheet);
      result.timings.push(r.timing);
      result.issues.push(...r.sheet.issues);
    }
    const spent = () => round6((deps.spentUsd ?? 0) + result.timings.reduce((n, x) => n + x.costUsd, 0));
    const readable = result.sheets.filter((s) => s.cells.length);
    if (readable.length < min) {
      result.issues.push({ stage: 'concordance', system: null, cell: null, check: 'call_failed', message: `${readable.length} sheets kept cells; at least ${min} are needed for a ledger` });
      return done(spent() > deps.maxSpendUsd ? 'budget_exceeded' : 'too_few_clocks');
    }

    // 3. count and the concordance call
    const tc = performance.now();
    const c = await runConcordance(deps, {
      ctx: input.ctx,
      frame: input.frame,
      prefix,
      sheets: result.sheets,
      model,
      frameHash: picked.shared.frame.hash,
      overBudget: spent() >= deps.maxSpendUsd,
    });
    result.ms.concordance = Math.round(performance.now() - tc);
    result.count = c.count;
    result.pairs = c.count.pairs;
    result.ledger = c.ledger;
    if (c.timing) result.timings.push(c.timing);
    result.issues.push(...c.issues);
    if (spent() > deps.maxSpendUsd) {
      result.issues.push({ stage: 'concordance', system: null, cell: null, check: 'budget', message: `spent ${spent()} over the cap ${deps.maxSpendUsd}` });
      return done('budget_exceeded');
    }
    const clean = result.sheets.every((s) => s.status === 'ok') && !c.issues.length;
    return done(clean ? 'ok' : 'partial');
  } catch (e) {
    result.issues.push({ stage: 'clock', system: null, cell: null, check: 'call_failed', message: `clock layer: ${String((e as Error).message ?? e).slice(0, 200)}` });
    return done('partial');
  }
}
