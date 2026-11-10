/**
 * Layer 2 of doc 70 §4.1: one reader per clock. Every reader gets the one cached prefix (the common system prompt plus
 * natal.core, sky.window, year.tp and frame) and, uncached, the role instructions and its own `clock.<system>` slice
 * only, so it cannot lean on another clock's answer. The Tithi Pravesha year is read as its own clock.
 *
 * The validator keeps a cell only when its span is a frame span, every evidence key is in that reader's slice or the
 * shared prefix, it cites at least one dated row of its own clock overlapping the span, its matter is one of the cited
 * rows' own `matters`, its strength is 1..3, its sentence has 1..25 words, and its tone does not contradict the engine
 * tone of the cited rows as the slice line carries it (`tone=`, the one row-to-tone selection in `sub/rowTone.ts`: the
 * engine's polarity with `presses` heavy only at PRESSES_MIN_BAD_FLAGS stored bad flags; rows of more than one tone
 * allow only `mixed`). A bad cell is dropped and recorded; the sheet keeps the rest.
 *
 * Readers run in parallel, 45 s each, under a spend guard. Each sheet is stored with `withTechniqueOutput` (technique
 * `reading.clock.sheet`). Nothing here throws.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { usageCostUsd } from '../llm/models.js';
import { markAgentUsed } from '../self/v2/cache.js';
import { normaliseEvidenceKey, promptHash, promptText, shortHash } from '../self/v2/slices.js';
import type { YearFrameV3 } from '../self/v3/types.js';
import { cmp, parseRowLines, type SliceRowRef } from '../slices/render.js';
import type { RenderedSlice } from '../slices/types.js';
import {
  CLOCK_AGENT,
  CLOCK_READER_PROMPT,
  CLOCK_SHEET_TECHNIQUE,
  READER_SYSTEM_PROMPT,
  type CellStrength,
  type ClockAgentTiming,
  type ClockCell,
  type ClockIssue,
  type ClockLayerSlices,
  type ClockSheet,
  type ClockTone,
} from './types.js';

export const CLOCK_READER_TIMEOUT_MS = 45_000;
export const CLOCK_READER_MAX_OUTPUT_TOKENS = 8_192;
export const CELL_MAX_WORDS = 25;
const TONES: readonly ClockTone[] = ['heavy', 'mixed', 'light'];

export interface ClockCallDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  /** spent before this layer (USD) */
  spentUsd?: number;
  maxSpendUsd: number;
  now: Date;
  /** run the agents again even when a stored output covers today */
  force?: boolean;
  /** test seam: the per-call limit (default 45 s) */
  timeoutMs?: number;
}

export interface ClockCallContext {
  userId: string;
  kundliId: string;
  asOf: string;
}

/** The one cached prefix every reading agent shares: natal.core, sky.window, year.tp and frame, in that order. */
export interface SharedPrefix {
  text: string;
  keys: string[];
  hash: string;
  rows: Map<string, SliceRowRef>;
}

export function sharedPrefix(s: ClockLayerSlices['shared']): SharedPrefix {
  const parts = [s.natal, s.sky, s.year, s.frame].filter((x): x is RenderedSlice => Boolean(x));
  const text = parts.map((p) => p.text).join('\n\n');
  const keys = [...new Set(parts.flatMap((p) => p.keys))].sort(cmp);
  const rows = new Map<string, SliceRowRef>();
  for (const p of parts) for (const [k, r] of parseRowLines(p.text)) if (!rows.has(k)) rows.set(k, r);
  return { text, keys, hash: shortHash(`${parts.map((p) => `${p.id}:${p.hash}`).join('|')}`), rows };
}

export const systemOfSlice = (s: Pick<RenderedSlice, 'id'>): string => s.id.replace(/^clock\./, '');

export function clockReaderSchema(spanIds: readonly string[], matters: readonly string[]): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      cells: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            span: { type: 'STRING', enum: [...spanIds] },
            matter: matters.length ? { type: 'STRING', enum: [...matters] } : { type: 'STRING' },
            tone: { type: 'STRING', enum: [...TONES] },
            sentence: { type: 'STRING', description: `one sentence, at most ${CELL_MAX_WORDS} words` },
            strength: { type: 'INTEGER', description: '1, 2 or 3' },
            evidence: { type: 'ARRAY', items: { type: 'STRING' }, description: 'evidence keys from the input, without braces' },
          },
          required: ['span', 'matter', 'tone', 'sentence', 'strength', 'evidence'],
        },
      },
    },
    required: ['cells'],
  };
}

export function readerInstruction(system: string, slice: RenderedSlice): string {
  return [promptText(CLOCK_READER_PROMPT), `YOUR CLOCK: ${system}`, slice.text, 'Return the JSON document only.'].join('\n\n');
}

export const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
const S = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
export const keysOf = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string').map((k) => normaliseEvidenceKey(k.trim().replace(/^\{|\}$/g, ''))).filter(Boolean))] : [];
const overlaps = (r: { from: string; to: string }, s: { from: string; to: string }): boolean => r.from < s.to && s.from < r.to;

export interface ReaderCheckContext {
  system: string;
  spans: ReadonlyArray<{ id: string; from: string; to: string }>;
  /** keys of the reader's own slice and of the shared prefix */
  allowedKeys: ReadonlySet<string>;
  /** the dated rows of this reader's clock slice */
  clockRows: ReadonlyMap<string, SliceRowRef>;
  /** every dated row the reader saw (its slice and the shared prefix) */
  rows: ReadonlyMap<string, SliceRowRef>;
}

/** Validates the raw cells of one sheet: keeps the good ones, records why each bad one was dropped. Pure. */
export function validateClockSheet(rawCells: readonly unknown[], c: ReaderCheckContext): { cells: ClockCell[]; issues: ClockIssue[] } {
  const cells: ClockCell[] = [];
  const issues: ClockIssue[] = [];
  const seen = new Set<string>();
  const spanById = new Map(c.spans.map((s) => [s.id, s]));
  for (const raw of rawCells) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const span = S(o.span);
    const matter = S(o.matter);
    const id = `${span || '?'}/${matter || '?'}`;
    const drop = (check: ClockIssue['check'], message: string) => issues.push({ stage: 'clock', system: c.system, cell: id, check, message: `${c.system} ${id}: ${message}`.slice(0, 300) });
    const fs = spanById.get(span);
    if (!fs) {
      drop('unknown_span', `span ${span || 'none'} is not a frame span`);
      continue;
    }
    const evidence = keysOf(o.evidence);
    const unknown = evidence.filter((k) => !c.allowedKeys.has(k));
    if (unknown.length) {
      drop('unknown_evidence_key', `keys not in this reader's input: ${unknown.slice(0, 4).join(', ')}`);
      continue;
    }
    const own = evidence.map((k) => c.clockRows.get(k)).filter((r): r is SliceRowRef => Boolean(r));
    if (!own.length) {
      drop('no_clock_row', 'cites no dated row of its own clock');
      continue;
    }
    if (!own.some((r) => overlaps(r, fs))) {
      drop('row_outside_span', `none of its clock rows overlaps ${fs.from}..${fs.to}`);
      continue;
    }
    const cited = evidence.map((k) => c.rows.get(k) ?? c.clockRows.get(k)).filter((r): r is SliceRowRef => Boolean(r));
    if (!matter || !cited.some((r) => r.matters.includes(matter))) {
      drop('matter_not_in_rows', `matter ${matter || 'none'} is not a matter of the cited rows`);
      continue;
    }
    const tone = S(o.tone) as ClockTone;
    const rowTones = [...new Set(cited.map((r) => r.tone))];
    const allowed: ClockTone[] = rowTones.length === 1 ? rowTones : ['mixed'];
    if (!TONES.includes(tone) || !allowed.includes(tone)) {
      drop('tone_contradicts_polarity', `tone ${tone || 'none'} against the cited rows (${rowTones.join(', ')}); allowed ${allowed.join(', ')}`);
      continue;
    }
    const strength = Number(o.strength);
    if (![1, 2, 3].includes(strength)) {
      drop('bad_strength', `strength ${String(o.strength)} is not 1..3`);
      continue;
    }
    const sentence = S(o.sentence);
    if (!sentence || words(sentence) > CELL_MAX_WORDS) {
      drop('bad_sentence', sentence ? `${words(sentence)} words (max ${CELL_MAX_WORDS})` : 'no sentence');
      continue;
    }
    if (seen.has(id)) {
      drop('duplicate_cell', 'written twice; first kept');
      continue;
    }
    seen.add(id);
    cells.push({ span, matter, tone, sentence, strength: strength as CellStrength, evidence });
  }
  const order = new Map(c.spans.map((s, i) => [s.id, i]));
  cells.sort((a, b) => (order.get(a.span) ?? 0) - (order.get(b.span) ?? 0) || cmp(a.matter, b.matter));
  return { cells, issues };
}

export const sheetHash = (system: string, cells: readonly ClockCell[]): string =>
  shortHash(`${system}\n${JSON.stringify(cells.map((x) => [x.span, x.matter, x.tone, x.strength, x.sentence, [...x.evidence].sort(cmp)]))}`);

export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function clockTiming(agent: ClockAgentTiming['agent'], call: string, model: string, res: GeminiResult | null, ms: number, status: ClockAgentTiming['status']): ClockAgentTiming {
  const u = res?.usage;
  const promptTokens = u?.promptTokens ?? 0;
  const cachedTokens = u?.cachedTokens ?? 0;
  const outputTokens = u?.outputTokens ?? 0;
  const thoughtTokens = u?.thoughtTokens ?? 0;
  return {
    agent,
    call,
    status,
    ms: Math.round(ms * 100) / 100,
    promptTokens,
    cachedTokens,
    outputTokens,
    thoughtTokens,
    costUsd: res ? round6(usageCostUsd({ model, promptTokens, cachedTokens, outputTokens, thoughtTokens })) : 0,
  };
}

/** A promise that rejects after `ms` (the model client has its own limit; this one holds whatever the client does). */
export function withLimit<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export interface ClockReadResult {
  sheet: ClockSheet;
  timing: ClockAgentTiming;
  cached: boolean;
}

export interface ReadOneInput {
  ctx: ClockCallContext;
  frame: YearFrameV3;
  prefix: SharedPrefix;
  /** the `clock.<system>` slice */
  slice: RenderedSlice;
  model: string;
  /** the frame slice's hash: part of the store key */
  frameHash: string;
  /** true when the spend guard says no more calls */
  overBudget: boolean;
}

/** The store key of one sheet: the clock, the frame, the shared prefix, its own slice, the prompts and the model. */
export const sheetStoreKey = (system: string, i: Pick<ReadOneInput, 'frameHash' | 'prefix' | 'slice' | 'model'>): string =>
  `${CLOCK_SHEET_TECHNIQUE}|sys=${system}|frame=${i.frameHash}|pre=${i.prefix.hash}|slice=${i.slice.hash}|p=${promptHash(READER_SYSTEM_PROMPT)}.${promptHash(CLOCK_READER_PROMPT)}|m=${i.model}`;

/** the span covering today (else the first): a sheet is reused until it ends (doc 70 §4.1 "Validity") */
export function nowSpanOf(frame: YearFrameV3): { from: Date; to: Date } | null {
  const s = frame.spans.find((x) => x.place === 'now') ?? frame.spans[0];
  return s ? { from: new Date(`${s.from}T00:00:00Z`), to: new Date(`${s.to}T00:00:00Z`) } : null;
}

/** One clock reader: call, validate, store. Never throws. */
export async function readOneClock(deps: ClockCallDeps, i: ReadOneInput): Promise<ClockReadResult> {
  const system = systemOfSlice(i.slice);
  const call = `clock.${system}`;
  const base = { system, model: i.model, sliceHash: i.slice.hash, prefixHash: i.prefix.hash };
  const empty = (status: ClockSheet['status'], issues: ClockIssue[]): ClockSheet => ({ ...base, status, cells: [], issues, hash: sheetHash(system, []) });
  if (i.overBudget) {
    return {
      sheet: empty('skipped', [{ stage: 'clock', system, cell: null, check: 'budget', message: `${system}: not read, the spend cap ${deps.maxSpendUsd} is reached` }]),
      timing: clockTiming(CLOCK_AGENT, call, i.model, null, 0, 'skipped'),
      cached: false,
    };
  }
  const clockRows = parseRowLines(i.slice.text);
  const rows = new Map(i.prefix.rows);
  for (const [k, r] of clockRows) if (!rows.has(k)) rows.set(k, r);
  const matters = [...new Set([...clockRows.values()].flatMap((r) => r.matters))].sort(cmp);
  const spans = i.frame.spans.map((s) => ({ id: s.id, from: s.from, to: s.to }));
  const check = { system, spans, allowedKeys: new Set([...i.prefix.keys, ...i.slice.keys]), clockRows, rows };
  let timing: ClockAgentTiming = clockTiming(CLOCK_AGENT, call, i.model, null, 0, 'cached');
  const limit = deps.timeoutMs ?? CLOCK_READER_TIMEOUT_MS;
  const owner = { userId: i.ctx.userId, kundliId: i.ctx.kundliId };

  const make = async (): Promise<{ value: ClockSheet; skipStore: boolean; summary: Record<string, unknown> }> => {
    const t0 = performance.now();
    try {
      const res = await withAgentRun(
        deps.prisma,
        CLOCK_AGENT,
        {
          userId: i.ctx.userId,
          kundliId: i.ctx.kundliId,
          technique: CLOCK_SHEET_TECHNIQUE,
          task: `reading.clock ${system} ${i.ctx.asOf}`,
          input: { system, spans: spans.length, keys: check.allowedKeys.size, rows: clockRows.size },
          charts: [{ type: 'pressure_inventory', variant: `system=${system}` }],
        },
        async () => {
          const g = await withLimit(
            deps.callGemini({
              model: i.model,
              node: `reading.clock.${system}`,
              system: promptText(READER_SYSTEM_PROMPT),
              parts: [i.prefix.text, readerInstruction(system, i.slice)],
              thinking: 'low',
              maxOutputTokens: CLOCK_READER_MAX_OUTPUT_TOKENS,
              timeoutMs: limit,
              cachePrefix: true,
              cacheOwner: owner,
              responseSchema: clockReaderSchema(spans.map((s) => s.id), matters),
            }),
            limit,
            `reading.clock ${system}`,
          );
          return {
            value: g,
            usage: { model: i.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 },
            output: { chars: g.text.length },
          };
        },
      );
      markAgentUsed({ cacheOwner: owner }, deps.informUsed);
      const cut = res.finishReason === 'MAX_TOKENS';
      const parsed = cut ? null : (parseJson(res.text) as { cells?: unknown } | null);
      const list = parsed && Array.isArray(parsed.cells) ? (parsed.cells as unknown[]) : null;
      if (!list) {
        timing = clockTiming(CLOCK_AGENT, call, i.model, res, performance.now() - t0, 'failed');
        const sheet = empty('failed', [{ stage: 'clock', system, cell: null, check: cut ? 'truncated' : 'json_schema', message: `${system}: no sheet document` }]);
        return { value: sheet, skipStore: true, summary: { cells: 0, dropped: 0 } };
      }
      const v = validateClockSheet(list, check);
      const status: ClockSheet['status'] = !v.cells.length ? 'failed' : v.issues.length ? 'partial' : 'ok';
      timing = clockTiming(CLOCK_AGENT, call, i.model, res, performance.now() - t0, status === 'failed' ? 'failed' : 'ok');
      const sheet: ClockSheet = { ...base, status, cells: v.cells, issues: v.issues, hash: sheetHash(system, v.cells) };
      return { value: sheet, skipStore: status === 'failed', summary: { cells: v.cells.length, dropped: v.issues.length } };
    } catch (e) {
      const msg = String((e as Error).message ?? e).slice(0, 160);
      timing = clockTiming(CLOCK_AGENT, call, i.model, null, performance.now() - t0, 'failed');
      return { value: empty('failed', [{ stage: 'clock', system, cell: null, check: /timed out/.test(msg) ? 'timeout' : 'call_failed', message: `${system}: ${msg}` }]), skipStore: true, summary: { cells: 0 } };
    }
  };

  const nowSpan = nowSpanOf(i.frame);
  try {
    const stored = await withTechniqueOutput<ClockSheet>(
      deps.prisma,
      {
        technique: CLOCK_SHEET_TECHNIQUE,
        kundliId: i.ctx.kundliId,
        digestVersion: sheetStoreKey(system, i),
        context: { now: deps.now, runningPeriod: nowSpan },
        agentId: CLOCK_AGENT,
        userId: i.ctx.userId,
        charts: [{ type: 'pressure_inventory', variant: `system=${system}` }],
        forceRefresh: Boolean(deps.force),
      },
      make,
    );
    return { sheet: stored.value, timing: stored.cached ? clockTiming(CLOCK_AGENT, call, i.model, null, 0, 'cached') : timing, cached: stored.cached };
  } catch (e) {
    // the store itself failed after make(): the sheet is lost for this build, never the build
    return {
      sheet: empty('failed', [{ stage: 'clock', system, cell: null, check: 'call_failed', message: `${system}: ${String((e as Error).message ?? e).slice(0, 160)}` }]),
      timing,
      cached: false,
    };
  }
}

/** Every clock reader at once (one per `clock.<system>` slice, the year included). Never throws. */
export async function readClocks(deps: ClockCallDeps, ctx: ClockCallContext, frame: YearFrameV3, slices: ClockLayerSlices, model: string): Promise<ClockReadResult[]> {
  const prefix = sharedPrefix(slices.shared);
  const overBudget = (deps.spentUsd ?? 0) >= deps.maxSpendUsd;
  return Promise.all(slices.clocks.map((slice) => readOneClock(deps, { ctx, frame, prefix, slice, model, frameHash: slices.shared.frame.hash, overBudget })));
}
