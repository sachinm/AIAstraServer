/**
 * The Self v2 Oracle (docs/reading-engine/66 §4.1, §4.8 step 5–6): three parallel calls of three to four areas each over
 * the same cached prefix (the natal slice + the promise ledger), each forced to JSON by a `responseSchema` built from its
 * area ids, merged into one `OracleV2Output` and validated with the doc 65 area validator (every evidence key in the
 * input, every date inside a window S2/S3/S9 carry, caps, no paragraph in two areas). `claim:` keys survive: the brief's
 * claim ids are allowed keys as `claim:<id>`, so the validator keeps them in `evidence` (docs/TODOS.md "Claim ids are
 * lost on the way to the card", fixed for the v2 path). Patterns (≤ 3, areas mind and stuck) are validated here.
 *
 * Only an `ok` result is stored; `partial`, `failed` and `budget_exceeded` are returned for the Lab and never stored.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../../agents/registry.js';
import { getSelfOracleMaxOutputTokens } from '../../../config/env.js';
import type { GeminiCallOptions, GeminiResult } from '../../llm/gemini.js';
import { usageCostUsd } from '../../llm/models.js';
import { cleanAreaText, oracleAreaSchema, parseAreaDoc, validateAreaDoc } from '../areaDoc.js';
import { inStoredWindow } from '../audit.js';
import type { BoardPanelId } from '../types.js';
import type { OraclePattern, OracleV2Output, PreparedAgentSlice, SelfBuildContext, SelfV2AgentTiming, SelfV2AreaId, SelfV2OracleResult, WindowRef } from '../v2types.js';
import { markAgentUsed } from './cache.js';
import { promptHash, SELF_V2_ORACLE_PROMPT } from './slices.js';

/** the areas the Oracle writes: the eleven v2 areas (the hero is the Personalizer's) */
export const ORACLE_V2_AREAS: readonly SelfV2AreaId[] = ['diagnosis', 'stuck', 'chapter', 'chapters', 'lagna', 'mind', 'drive', 'presence', 'body', 'yogas', 'year'];

/** three calls of three to four areas over the same prefix (doc 66 §4.1 "Target after Phase C") */
export const ORACLE_V2_CALLS: ReadonlyArray<{ call: 'oracle.a' | 'oracle.b' | 'oracle.c'; areas: readonly SelfV2AreaId[] }> = [
  { call: 'oracle.a', areas: ['diagnosis', 'stuck', 'chapter', 'chapters'] },
  { call: 'oracle.b', areas: ['lagna', 'mind', 'drive', 'presence'] },
  { call: 'oracle.c', areas: ['body', 'yogas', 'year'] },
];

export const PATTERN_AREAS = ['mind', 'stuck'] as const;
export const PATTERNS_MAX = 3;
export const ORACLE_V2_TIMEOUT_MS = 120_000;

/**
 * The area validator is typed on the v1 panel ids (`BoardPanelId`); the v2 ids are plain strings to it at run time.
 * The cast is the only bridge (docs/TODOS.md, filed by this branch).
 */
const asPanelIds = (ids: readonly SelfV2AreaId[]): readonly BoardPanelId[] => ids as unknown as readonly BoardPanelId[];

/** The responseSchema of one call: the doc 65 area schema over its ids, plus `patterns` when mind or stuck is in it. */
export function oracleV2Schema(areas: readonly SelfV2AreaId[]): Record<string, unknown> {
  const base = oracleAreaSchema(asPanelIds(areas)) as { type: string; properties: Record<string, unknown>; required: string[] };
  const patternAreas = PATTERN_AREAS.filter((a) => areas.includes(a));
  if (!patternAreas.length) return base;
  return {
    ...base,
    properties: {
      ...base.properties,
      patterns: {
        type: 'ARRAY',
        description: `at most ${PATTERNS_MAX} behaviour patterns, only for the areas ${patternAreas.join(' and ')}`,
        items: {
          type: 'OBJECT',
          properties: {
            areaId: { type: 'STRING', enum: [...patternAreas] },
            behaviour: { type: 'STRING', description: 'what the person does, one plain sentence' },
            mechanism: { type: 'STRING', description: 'the chart mechanism behind it, with the classical rule' },
            since: { type: 'STRING', description: 'YYYY-MM-DD from the brief, or empty' },
            until: { type: 'STRING', description: 'YYYY-MM-DD from the brief, or empty' },
            evidence: { type: 'ARRAY', items: { type: 'STRING' }, description: 'evidence keys from the input' },
          },
          required: ['areaId', 'behaviour', 'mechanism', 'since', 'until', 'evidence'],
        },
      },
    },
    required: [...base.required, 'patterns'],
  };
}

/** The per-call instruction, after the shared suffix (the prefix and the suffix are the same for all three calls). */
export function callInstruction(areas: readonly SelfV2AreaId[]): string {
  const pat = PATTERN_AREAS.filter((a) => areas.includes(a));
  return [
    `THIS CALL: write only these areas: ${areas.join(', ')}. Another call writes the others; do not repeat their matter.`,
    pat.length ? `Patterns: up to ${PATTERNS_MAX} in all, only for ${pat.join(' and ')}.` : 'No patterns in this call (return none).',
    'Return the JSON document only.',
  ].join('\n');
}

/** The dated windows S2, S3 and S9 carry (and the S7/S8 engine spans the prompt asks about): the validator's frame. */
export function storedWindowsOf(ctx: SelfBuildContext): { boundaries: Set<string>; windows: Array<{ from: string; to: string }> } {
  const boundaries = new Set<string>();
  const windows: Array<{ from: string; to: string }> = [];
  const span = (x: { from: string; to: string } | null | undefined) => {
    if (x?.from && x.to) windows.push({ from: x.from, to: x.to });
  };
  const day = (d: string | null | undefined) => {
    if (d) boundaries.add(d);
  };
  const s = ctx.sub;
  if (s.periods) {
    for (const p of [s.periods.previous, s.periods.running, s.periods.next, s.periods.runningSub, s.periods.runningSubSub]) span(p);
    for (const b of s.periods.boundaries) day(b.date);
  }
  if (s.windows) {
    const rows: WindowRef[] = [...s.windows.strip, ...s.windows.startedLast12m, ...s.windows.endingNext6m, ...Object.values(s.windows.byMatter).flatMap((x) => x ?? [])];
    if (s.windows.heaviestNow) rows.push(s.windows.heaviestNow);
    for (const r of rows) span(r);
    day(s.windows.easesAt);
    day(s.windows.nextSupportFrom);
  }
  if (s.year && !s.year.noCoverage) {
    span(s.year);
    span(s.year.shortClock);
  }
  for (const l of s.body?.liveLords ?? []) day(l.until);
  for (const r of s.body?.liveTransits ?? []) span(r);
  span(s.presence?.bestWindow);
  day(s.presence?.liveCare?.until);
  return { boundaries, windows };
}

type ParsedCall = { areas: unknown[]; validUntil: string; patterns: unknown[] };

function parseCall(text: string): ParsedCall | null {
  const doc = parseAreaDoc(text);
  if (!doc) return null;
  let patterns: unknown[] = [];
  try {
    const raw = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text) as { patterns?: unknown };
    if (Array.isArray(raw.patterns)) patterns = raw.patterns;
  } catch {
    // the area document parsed; patterns are optional
  }
  return { ...doc, patterns };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The calls' documents as one: areas concatenated, the earliest day as the overall validUntil, patterns joined. */
export function mergeOracleCalls(parsed: ReadonlyArray<ParsedCall | null>): ParsedCall {
  const ok = parsed.filter((p): p is ParsedCall => p !== null);
  const days = ok.map((p) => p.validUntil).filter((d) => DAY_RE.test(d)).sort();
  return { areas: ok.flatMap((p) => p.areas), validUntil: days[0] ?? 'always', patterns: ok.flatMap((p) => p.patterns) };
}

/** ≤ 3 patterns for mind and stuck, each with evidence from the input and dates inside a stored window. */
export function validatePatterns(
  raw: readonly unknown[],
  allowedKeys: ReadonlySet<string>,
  frame: { boundaries: ReadonlySet<string>; windows: ReadonlyArray<{ from: string; to: string }> },
): { patterns: OraclePattern[]; gaps: string[] } {
  const gaps: string[] = [];
  const patterns: OraclePattern[] = [];
  const dateOk = (d: string): string | null => {
    if (!d) return null;
    if (!DAY_RE.test(d)) return null;
    if (!inStoredWindow(d, frame.boundaries, frame.windows)) {
      gaps.push(`pattern date ${d} is outside every stored window; dropped`);
      return null;
    }
    return d;
  };
  for (const r of raw) {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const areaId = String(o.areaId ?? '') as OraclePattern['areaId'];
    if (!(PATTERN_AREAS as readonly string[]).includes(areaId)) {
      gaps.push(`pattern for ${areaId || 'no area'} dropped (only mind and stuck)`);
      continue;
    }
    const behaviour = cleanAreaText(String(o.behaviour ?? ''));
    const mechanism = cleanAreaText(String(o.mechanism ?? ''));
    const evidence = [...new Set((Array.isArray(o.evidence) ? o.evidence : []).map((k) => String(k).trim()).filter((k) => allowedKeys.has(k)))];
    if (!behaviour || !mechanism || !evidence.length) {
      gaps.push(`${areaId}: a pattern without behaviour, mechanism or known evidence dropped`);
      continue;
    }
    patterns.push({ areaId, behaviour, mechanism, since: dateOk(String(o.since ?? '').trim()), until: dateOk(String(o.until ?? '').trim()), evidence });
    if (patterns.length === PATTERNS_MAX) break;
  }
  return { patterns, gaps };
}

/** The claim ids an area rests on, as the card and the hero question use them (the `claim:` prefix kept). */
export function claimKeysOf(out: OracleV2Output): string[] {
  return [...new Set(Object.values(out.doc.areas).flatMap((a) => (a ? a.evidence.filter((k) => k.startsWith('claim:')) : [])))];
}

export interface OracleV2Deps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  /** spend already made in this build (the family readers); the cap counts it */
  spentUsd?: number;
  maxSpendUsd: number;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function timingOf(agent: SelfV2AgentTiming['agent'], call: string, model: string, res: GeminiResult | null, ms: number, status: SelfV2AgentTiming['status']): SelfV2AgentTiming {
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

/**
 * Runs the three Oracle calls in parallel over one warm prefix, merges and validates. Never throws: a call that throws
 * or returns no document is a gap, all three failing is `failed`, a spend over the cap is `budget_exceeded`.
 */
export async function runOracleV2(deps: OracleV2Deps, ctx: SelfBuildContext, slice: PreparedAgentSlice): Promise<Omit<SelfV2OracleResult, 'familyFindings' | 'cached'>> {
  const pHash = promptHash(SELF_V2_ORACLE_PROMPT);
  const model = slice.model;
  const allowed = new Set(slice.keys);
  const results = await Promise.all(
    ORACLE_V2_CALLS.map(async ({ call, areas }) => {
      const t0 = performance.now();
      try {
        const res = await withAgentRun(
          deps.prisma,
          'self.oracle.v2',
          {
            userId: ctx.userId,
            kundliId: ctx.kundliId,
            technique: 'self.v2.oracle',
            task: `self.v2.oracle ${call} ${ctx.asOf}`,
            input: { areas: areas.length, keys: allowed.size, prefixTokens: slice.estTokens.prefix, suffixTokens: slice.estTokens.suffix },
            charts: [{ type: 'kundli_digest', variant: ctx.stamps.digestVersion }, { type: 'kundli_activation', variant: ctx.stamps.clock }],
          },
          async () => {
            const g = await deps.callGemini({
              model,
              node: `self.oracle.v2.${call}`,
              system: slice.system,
              parts: [slice.prefix, slice.suffix, callInstruction(areas)],
              thinking: 'low',
              maxOutputTokens: getSelfOracleMaxOutputTokens(),
              timeoutMs: ORACLE_V2_TIMEOUT_MS,
              cachePrefix: true,
              cacheOwner: slice.cacheOwner,
              responseSchema: oracleV2Schema(areas),
            });
            return {
              value: g,
              usage: { model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 },
              output: { chars: g.text.length, cachedTokens: g.usage?.cachedTokens ?? 0 },
            };
          },
        );
        markAgentUsed(slice, deps.informUsed);
        const parsed = parseCall(res.text);
        return { call, areas, parsed, timing: timingOf('self.oracle', call, model, res, performance.now() - t0, parsed ? 'ok' : 'failed'), error: parsed ? null : `no area document (finish ${res.finishReason ?? 'unknown'}, ${res.text.length} chars)` };
      } catch (e) {
        return { call, areas, parsed: null, timing: timingOf('self.oracle', call, model, null, performance.now() - t0, 'failed'), error: String((e as Error).message ?? e).slice(0, 200) };
      }
    }),
  );
  const calls = results.map((r) => r.timing);
  const spentUsd = round6((deps.spentUsd ?? 0) + calls.reduce((n, c) => n + c.costUsd, 0));
  const gaps = results.filter((r) => r.error).map((r) => `${r.call} (${r.areas.join(', ')}): ${r.error}`);
  const base = { promptName: SELF_V2_ORACLE_PROMPT, promptHash: pHash, model, calls, spentUsd } as const;
  if (spentUsd > deps.maxSpendUsd) return { ...base, status: 'budget_exceeded', output: null, gaps: [...gaps, `spent ${spentUsd} over the cap ${deps.maxSpendUsd}`], withheld: [] };
  if (results.every((r) => !r.parsed)) return { ...base, status: 'failed', output: null, gaps, withheld: [] };

  const merged = mergeOracleCalls(results.map((r) => r.parsed));
  const frame = storedWindowsOf(ctx);
  const validation = validateAreaDoc(merged, { panelIds: asPanelIds(ORACLE_V2_AREAS), allowedKeys: allowed, boundaries: frame.boundaries, windows: frame.windows, asOf: ctx.asOf });
  const pv = validatePatterns(merged.patterns, allowed, frame);
  const output: OracleV2Output = { doc: validation.doc, patterns: pv.patterns };
  const partial = results.some((r) => !r.parsed);
  return { ...base, status: partial ? 'partial' : 'ok', output, gaps: [...gaps, ...validation.gaps, ...pv.gaps], withheld: validation.withheld as string[] };
}
