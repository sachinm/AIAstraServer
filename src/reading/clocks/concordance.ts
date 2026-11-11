/**
 * Layer 3 of doc 70 §4.1: the count (code) and the agreed ledger (one model call).
 *
 * The count joins the sheets by (span, matter) and counts identical tone words. Nothing astrological is decided here:
 * the tones are the readers', bounded by the engine's polarity in the reader validator; the status is arithmetic on
 * identical words. No agent can raise a status: the ledger takes status and tone from the count, and the concordance
 * agent only writes words on top.
 *
 * Status rules (doc 70 §4.1 table), and the cases the table leaves open, decided here:
 * - confirmed: three or more clocks give the same tone, and no other tone has as many. Dissent does not lower it
 *   (3 heavy + 1 light is confirmed heavy with `opposed = 1`): the doc's rule is "3 or more clocks give the same tone".
 *   One dissenting clock is the limit: with two or more on the opposite tone (3 heavy + 2 light) the cell is contested.
 *   A tie of two tones at three or more is not an agreement: 3 heavy + 3 light is contested.
 * - contested: otherwise, when one clock says heavy and another says light ("heavy against light").
 *   So 2 heavy + 1 light is contested, never leaning.
 * - leaning: otherwise, when exactly two clocks share one tone and no other tone has two. "None opposes" means no heavy
 *   against light; mixed opposes nothing, so 2 heavy + 1 mixed is leaning heavy, and 2 mixed + 1 heavy is leaning mixed.
 * - single: everything else: one clock read the cell, or no two clocks agree (heavy + mixed), or two pairs of different
 *   tones (2 heavy + 2 mixed). Nothing in it can be stated; it can only be asked about. Its tone is the one clock's when
 *   one clock read it, else null.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { markAgentUsed } from '../self/v2/cache.js';
import { promptHash, promptText, shortHash } from '../self/v2/slices.js';
import type { YearFrameV3 } from '../self/v3/types.js';
import { cmp } from '../slices/render.js';
import { clockTiming, keysOf, nowSpanOf, parseJson, withLimit, words, type ClockCallContext, type ClockCallDeps, type SharedPrefix } from './reader.js';
import {
  CONCORDANCE_AGENT,
  CONCORDANCE_PROMPT,
  CONCORDANCE_TECHNIQUE,
  READER_SYSTEM_PROMPT,
  type AgreedLedger,
  type ClockAgentTiming,
  type ClockIssue,
  type ClockSheet,
  type ClockTone,
  type ConcordanceCount,
  type ConcordanceStatus,
  type ContestSide,
  type CountCell,
  type LedgerCell,
  type PairRow,
} from './types.js';

export const CONCORDANCE_TIMEOUT_MS = 60_000;
/** the replay wrote 7,551 tokens for 34 cells with keys; words only are about 60 per cell, so 6 k leaves room for thought */
export const CONCORDANCE_MAX_OUTPUT_TOKENS = 6_144;
export const LEDGER_MAX_WORDS = 30;
const TONES: readonly ClockTone[] = ['heavy', 'mixed', 'light'];
const WRITTEN: readonly ConcordanceStatus[] = ['confirmed', 'leaning', 'contested'];

export const ledgerCellId = (span: string, matter: string): string => `ledger:${span}/${matter}`;

/** The status of one cell from its tone tally (the rules in the header). Pure. */
export function statusOf(tally: Record<ClockTone, number>): { status: ConcordanceStatus; tone: ClockTone | null } {
  const of = tally.heavy + tally.mixed + tally.light;
  const top = Math.max(tally.heavy, tally.mixed, tally.light);
  const atTop = TONES.filter((t) => tally[t] === top);
  const lead = atTop[0]!;
  const against = lead === 'heavy' ? tally.light : lead === 'light' ? tally.heavy : 0;
  if (top >= 3 && atTop.length === 1 && against <= 1) return { status: 'confirmed', tone: lead };
  if (tally.heavy > 0 && tally.light > 0) return { status: 'contested', tone: null };
  if (top === 2 && atTop.length === 1) return { status: 'leaning', tone: atTop[0]! };
  return { status: 'single', tone: of === 1 ? atTop[0]! : null };
}

const OPPOSITE: Record<ClockTone, ClockTone | null> = { heavy: 'light', light: 'heavy', mixed: null };

/**
 * (a) The count: sheets joined by (span, matter), identical tones counted, a status per cell, and the pair table (for
 * each two clocks, the cells both read and the cells they agree on). Only sheets that kept cells take part. Pure.
 */
export function countConcordance(sheets: readonly ClockSheet[], spanOrder: readonly string[] = []): ConcordanceCount {
  const used = sheets.filter((s) => s.cells.length && (s.status === 'ok' || s.status === 'partial'));
  const systems = used.map((s) => s.system);
  const byCell = new Map<string, CountCell>();
  for (const sh of used) {
    for (const c of sh.cells) {
      const id = ledgerCellId(c.span, c.matter);
      let cell = byCell.get(id);
      if (!cell) {
        cell = { id, span: c.span, matter: c.matter, status: 'single', tone: null, tally: { heavy: 0, mixed: 0, light: 0 }, agree: 0, of: 0, opposed: 0, clocks: [] };
        byCell.set(id, cell);
      }
      if (cell.clocks.some((x) => x.system === sh.system)) continue;
      cell.tally[c.tone] += 1;
      cell.of += 1;
      cell.clocks.push({ system: sh.system, tone: c.tone, strength: c.strength, sentence: c.sentence, evidence: [...c.evidence] });
    }
  }
  const order = new Map(spanOrder.map((s, i) => [s, i]));
  const cells = [...byCell.values()].sort((a, b) => (order.get(a.span) ?? 99) - (order.get(b.span) ?? 99) || cmp(a.span, b.span) || cmp(a.matter, b.matter));
  const byStatus: Record<ConcordanceStatus, number> = { confirmed: 0, leaning: 0, single: 0, contested: 0 };
  for (const c of cells) {
    const s = statusOf(c.tally);
    c.status = s.status;
    c.tone = s.tone;
    c.agree = s.tone && s.status !== 'single' ? c.tally[s.tone] : s.status === 'single' && c.of === 1 ? 1 : 0;
    const opp = s.tone ? OPPOSITE[s.tone] : null;
    c.opposed = opp && (s.status === 'confirmed' || s.status === 'leaning') ? c.tally[opp] : 0;
    byStatus[c.status] += 1;
  }
  const pairs: PairRow[] = [];
  for (let i = 0; i < systems.length; i++) {
    for (let j = i + 1; j < systems.length; j++) {
      const a = systems[i]!;
      const b = systems[j]!;
      let both = 0;
      let agree = 0;
      for (const c of cells) {
        const ta = c.clocks.find((x) => x.system === a)?.tone;
        const tb = c.clocks.find((x) => x.system === b)?.tone;
        if (!ta || !tb) continue;
        both += 1;
        if (ta === tb) agree += 1;
      }
      pairs.push({ a, b, both, agree });
    }
  }
  return { systems, cells, pairs, byStatus };
}

// ---------------------------------------------------------------------------------------------------------------------
// (b) the concordance call: the input, the schema, the validator
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The counted cells the agent writes on (confirmed, leaning, contested), trimmed to what a sentence needs (doc 70 Phase 3
 * replay fixes: the replay's concordance read 11 k uncached tokens and wrote 7.5 k, most of it evidence keys copied
 * back): per confirmed or leaning cell, the sentences of the clocks that gave the agreed tone and the others by tone
 * only; per contested cell, every clock's tone and sentence. No evidence keys (the ledger keeps the counted ones), no
 * strengths, no pair table (code keeps it).
 */
export function renderCount(count: ConcordanceCount): string {
  const L = [`# COUNTED CELLS (${count.systems.length} clocks read: ${count.systems.join(', ')}; status and tone are final)`];
  for (const c of count.cells.filter((x) => WRITTEN.includes(x.status))) {
    L.push(`${c.id} status=${c.status} tone=${c.tone ?? 'none'} tally=heavy:${c.tally.heavy},mixed:${c.tally.mixed},light:${c.tally.light}`);
    const speak = c.status === 'contested' ? c.clocks : c.clocks.filter((k) => k.tone === c.tone);
    for (const k of speak) L.push(`  ${k.system}: ${k.tone} "${k.sentence}"`);
    const apart = c.status === 'contested' ? [] : c.clocks.filter((k) => k.tone !== c.tone);
    if (apart.length) L.push(`  apart: ${apart.map((k) => `${k.system}=${k.tone}`).join(', ')}`);
  }
  if (!count.cells.some((x) => WRITTEN.includes(x.status))) L.push('(no cell to write)');
  return L.join('\n');
}

/** The words only: the id, a sentence (confirmed, leaning) or the sides (contested). Status, tone and keys stay the count's. */
export function concordanceSchema(ids: readonly string[], systems: readonly string[]): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      cells: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING', enum: [...ids] },
            sentence: { type: 'STRING', description: `confirmed or leaning: one settled sentence, at most ${LEDGER_MAX_WORDS} words; contested: empty` },
            sides: {
              type: 'ARRAY',
              description: 'contested only: one entry per tone given; empty otherwise',
              items: {
                type: 'OBJECT',
                properties: {
                  tone: { type: 'STRING', enum: [...TONES] },
                  clocks: { type: 'ARRAY', items: systems.length ? { type: 'STRING', enum: [...systems] } : { type: 'STRING' } },
                  restsOn: { type: 'STRING', description: 'one sentence: what this side rests on' },
                },
                required: ['tone', 'clocks', 'restsOn'],
              },
            },
          },
          required: ['id', 'sentence', 'sides'],
        },
      },
    },
    required: ['cells'],
  };
}

const S = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** the ledger from the count alone: every cell, status and tone as counted, no words yet */
export function ledgerFromCount(count: ConcordanceCount, frameHash: string, sheetHashes: Record<string, string>): AgreedLedger {
  return {
    frameHash,
    sheetHashes,
    pairs: count.pairs.map((p) => ({ ...p })),
    byStatus: { ...count.byStatus },
    cells: count.cells.map((c) => ({
      id: c.id,
      span: c.span,
      matter: c.matter,
      status: c.status,
      tone: c.tone,
      agree: c.agree,
      of: c.of,
      clocks: c.clocks.map((k) => ({ system: k.system, tone: k.tone })),
      sentence: null,
      sides: null,
      evidence: [...new Set((c.tone ? c.clocks.filter((k) => k.tone === c.tone) : c.clocks).flatMap((k) => k.evidence))].sort(cmp),
    })),
  };
}

/**
 * Validates the agent's cells against the count and writes the valid words into the ledger. The agent may not change a
 * status or a tone, may not add a cell (a single cell included), and cites only keys from that cell's clock lines; a
 * contested cell names, per side, only clocks that gave that tone, with a heavy and a light side. A bad cell keeps the
 * count's status and tone with no words. Pure.
 */
export function validateLedger(rawCells: readonly unknown[], count: ConcordanceCount, base: AgreedLedger): { ledger: AgreedLedger; issues: ClockIssue[] } {
  const issues: ClockIssue[] = [];
  const counted = new Map(count.cells.map((c) => [c.id, c]));
  const cells = new Map<string, LedgerCell>(base.cells.map((c) => [c.id, { ...c, clocks: c.clocks.map((k) => ({ ...k })), evidence: [...c.evidence] }]));
  const done = new Set<string>();
  for (const raw of rawCells) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const id = S(o.id);
    const drop = (check: ClockIssue['check'], message: string) => issues.push({ stage: 'concordance', system: null, cell: id || null, check, message: `${id || '?'}: ${message}`.slice(0, 300) });
    const c = counted.get(id);
    if (!c || !WRITTEN.includes(c.status)) {
      drop('unknown_cell', c ? `a ${c.status} cell is not written` : 'not a counted cell');
      continue;
    }
    if (done.has(id)) {
      drop('duplicate_cell', 'written twice; first kept');
      continue;
    }
    done.add(id);
    // the schema no longer asks for status, tone or keys; an answer that still gives them must give the count's
    const status = S(o.status);
    if (status && status !== c.status) {
      drop('status_changed', `status ${status} is not the count's ${c.status}`);
      continue;
    }
    const toneRaw = S(o.tone);
    if (toneRaw && (toneRaw === 'none' ? null : toneRaw) !== c.tone) {
      drop('tone_changed', `tone ${toneRaw} is not the count's ${c.tone ?? 'none'}`);
      continue;
    }
    const allowed = new Set(c.clocks.flatMap((k) => k.evidence));
    const evidence = keysOf(o.evidence);
    const unknown = evidence.filter((k) => !allowed.has(k));
    if (unknown.length) {
      drop('unknown_evidence_key', `keys not in this cell's sheets: ${unknown.slice(0, 4).join(', ')}`);
      continue;
    }
    const out = cells.get(id)!;
    if (c.status === 'contested') {
      const rawSides = Array.isArray(o.sides) ? (o.sides as Array<Record<string, unknown>>) : [];
      const sides: ContestSide[] = [];
      let bad = '';
      for (const sd of rawSides) {
        const t = S(sd.tone) as ClockTone;
        const clocks = Array.isArray(sd.clocks) ? [...new Set(sd.clocks.filter((x): x is string => typeof x === 'string').map((x) => x.trim()))] : [];
        const restsOn = S(sd.restsOn);
        const gave = new Set(c.clocks.filter((k) => k.tone === t).map((k) => k.system));
        if (!TONES.includes(t) || !gave.size) bad ||= `side tone ${t || 'none'} was given by no clock`;
        else if (!clocks.length || clocks.some((x) => !gave.has(x))) bad ||= `side ${t} names clocks that did not give it`;
        else if (!restsOn || words(restsOn) > LEDGER_MAX_WORDS) bad ||= `side ${t} rests on nothing, or too long`;
        else if (sides.some((x) => x.tone === t)) bad ||= `side ${t} twice`;
        else sides.push({ tone: t, clocks: clocks.sort((a, b) => count.systems.indexOf(a) - count.systems.indexOf(b)), restsOn });
      }
      if (!bad && !(sides.some((x) => x.tone === 'heavy') && sides.some((x) => x.tone === 'light'))) bad = 'a contested cell needs a heavy side and a light side';
      if (bad) {
        drop('bad_sides', bad);
        continue;
      }
      out.sides = sides.sort((a, b) => TONES.indexOf(a.tone) - TONES.indexOf(b.tone));
      out.sentence = null;
    } else {
      const sentence = S(o.sentence);
      if (!sentence || words(sentence) > LEDGER_MAX_WORDS) {
        drop('bad_sentence', sentence ? `${words(sentence)} words (max ${LEDGER_MAX_WORDS})` : 'no sentence');
        continue;
      }
      out.sentence = sentence;
    }
    // the cell keeps the counted evidence (every agreeing clock's keys): the words never change what a card stands on
  }
  for (const c of count.cells) {
    if (WRITTEN.includes(c.status) && !done.has(c.id)) issues.push({ stage: 'concordance', system: null, cell: c.id, check: 'missing_cell', message: `${c.id}: not written` });
  }
  return { ledger: { ...base, cells: base.cells.map((c) => cells.get(c.id)!) }, issues };
}

// ---------------------------------------------------------------------------------------------------------------------
// The call and the store
// ---------------------------------------------------------------------------------------------------------------------

export interface ConcordanceInput {
  ctx: ClockCallContext;
  frame: YearFrameV3;
  prefix: SharedPrefix;
  sheets: readonly ClockSheet[];
  model: string;
  frameHash: string;
  overBudget: boolean;
}

export interface ConcordanceResult {
  count: ConcordanceCount;
  ledger: AgreedLedger;
  issues: ClockIssue[];
  timing: ClockAgentTiming | null;
  cached: boolean;
}

export const sheetHashesOf = (sheets: readonly ClockSheet[]): Record<string, string> =>
  Object.fromEntries(sheets.filter((s) => s.cells.length).map((s) => [s.system, s.hash]).sort((a, b) => cmp(a[0]!, b[0]!)));

/** The ledger's store key: the frame, the sheets, the shared prefix, the prompts and the model. */
export const ledgerStoreKey = (i: Pick<ConcordanceInput, 'frameHash' | 'prefix' | 'model'>, sheetHashes: Record<string, string>): string =>
  `${CONCORDANCE_TECHNIQUE}|frame=${i.frameHash}|sheets=${shortHash(JSON.stringify(sheetHashes))}|pre=${i.prefix.hash}|p=${promptHash(READER_SYSTEM_PROMPT)}.${promptHash(CONCORDANCE_PROMPT)}|m=${i.model}`;

/** Counts, then one call writes the ledger's words, validated against the count, stored. Never throws. */
export async function runConcordance(deps: ClockCallDeps, i: ConcordanceInput): Promise<ConcordanceResult> {
  const count = countConcordance(i.sheets, i.frame.spans.map((s) => s.id));
  const hashes = sheetHashesOf(i.sheets);
  const base = ledgerFromCount(count, i.frameHash, hashes);
  const toWrite = count.cells.filter((c) => WRITTEN.includes(c.status));
  if (!toWrite.length) return { count, ledger: base, issues: [], timing: null, cached: false };
  if (i.overBudget) {
    return { count, ledger: base, issues: [{ stage: 'concordance', system: null, cell: null, check: 'budget', message: `concordance not run: the spend cap ${deps.maxSpendUsd} is reached` }], timing: clockTiming(CONCORDANCE_AGENT, 'concordance', i.model, null, 0, 'skipped'), cached: false };
  }
  const owner = { userId: i.ctx.userId, kundliId: i.ctx.kundliId };
  const limit = deps.timeoutMs ?? CONCORDANCE_TIMEOUT_MS;
  let timing: ClockAgentTiming = clockTiming(CONCORDANCE_AGENT, 'concordance', i.model, null, 0, 'cached');
  let issues: ClockIssue[] = [];

  const make = async (): Promise<{ value: AgreedLedger; skipStore: boolean; summary: Record<string, unknown> }> => {
    const t0 = performance.now();
    try {
      const res = await withAgentRun(
        deps.prisma,
        CONCORDANCE_AGENT,
        {
          userId: i.ctx.userId,
          kundliId: i.ctx.kundliId,
          technique: CONCORDANCE_TECHNIQUE,
          task: `reading.concordance ${i.ctx.asOf}`,
          input: { clocks: count.systems.length, cells: count.cells.length, ...count.byStatus },
          charts: count.systems.map((s) => ({ type: 'pressure_inventory', variant: `system=${s}` })),
        },
        async () => {
          const g = await withLimit(
            deps.callGemini({
              model: i.model,
              node: 'reading.concordance',
              system: promptText(READER_SYSTEM_PROMPT),
              parts: [i.prefix.text, [promptText(CONCORDANCE_PROMPT), renderCount(count), 'Return the JSON document only.'].join('\n\n')],
              // the count is final and the words are short: the least thinking the model allows
              thinking: 'minimal',
              maxOutputTokens: CONCORDANCE_MAX_OUTPUT_TOKENS,
              timeoutMs: limit,
              cachePrefix: true,
              cacheOwner: owner,
              responseSchema: concordanceSchema(toWrite.map((c) => c.id), count.systems),
            }),
            limit,
            'reading.concordance',
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
        timing = clockTiming(CONCORDANCE_AGENT, 'concordance', i.model, res, performance.now() - t0, 'failed');
        issues = [{ stage: 'concordance', system: null, cell: null, check: cut ? 'truncated' : 'json_schema', message: 'concordance: no ledger document' }];
        return { value: base, skipStore: true, summary: { written: 0 } };
      }
      const v = validateLedger(list, count, base);
      issues = v.issues;
      const written = v.ledger.cells.filter((c) => c.sentence || c.sides).length;
      timing = clockTiming(CONCORDANCE_AGENT, 'concordance', i.model, res, performance.now() - t0, written ? 'ok' : 'failed');
      return { value: v.ledger, skipStore: !written, summary: { written, dropped: v.issues.length, ...count.byStatus } };
    } catch (e) {
      const msg = String((e as Error).message ?? e).slice(0, 160);
      timing = clockTiming(CONCORDANCE_AGENT, 'concordance', i.model, null, performance.now() - t0, 'failed');
      issues = [{ stage: 'concordance', system: null, cell: null, check: /timed out/.test(msg) ? 'timeout' : 'call_failed', message: `concordance: ${msg}` }];
      return { value: base, skipStore: true, summary: { written: 0 } };
    }
  };

  try {
    const stored = await withTechniqueOutput<AgreedLedger>(
      deps.prisma,
      {
        technique: CONCORDANCE_TECHNIQUE,
        kundliId: i.ctx.kundliId,
        digestVersion: ledgerStoreKey(i, hashes),
        context: { now: deps.now, runningPeriod: nowSpanOf(i.frame) },
        agentId: CONCORDANCE_AGENT,
        userId: i.ctx.userId,
        charts: count.systems.map((s) => ({ type: 'pressure_inventory', variant: `system=${s}` })),
        forceRefresh: Boolean(deps.force),
      },
      make,
    );
    return { count, ledger: stored.value, issues: stored.cached ? [] : issues, timing: stored.cached ? clockTiming(CONCORDANCE_AGENT, 'concordance', i.model, null, 0, 'cached') : timing, cached: stored.cached };
  } catch (e) {
    return { count, ledger: base, issues: [...issues, { stage: 'concordance', system: null, cell: null, check: 'call_failed', message: `concordance store: ${String((e as Error).message ?? e).slice(0, 160)}` }], timing, cached: false };
  }
}
