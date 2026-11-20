/**
 * The Self v2 Oracle (docs/reading-engine/66 §4.1, §4.8 step 5–6): three parallel calls of three to four areas each over
 * the same cached prefix (the natal slice + the promise ledger), each forced to JSON by a `responseSchema` built from its
 * area ids, merged into one `OracleV2Output` and validated with the doc 65 area validator (every evidence key in the
 * input, every date inside a window S2/S3/S9 carry, caps, no paragraph in two areas). `claim:` keys survive: the brief's
 * claim ids are allowed keys as `claim:<id>`, so the validator keeps them in `evidence` (docs/TODOS.md "Claim ids are
 * lost on the way to the card", fixed for the v2 path). Patterns (≤ 3, areas mind and stuck) are validated here.
 *
 * One repair pass (2026-11-09): areas that fail are re-asked once, in one call over the same cached prefix, with the
 * validator's reasons. The build stores an `ok` result, or a `partial` one whose good areas serve the page
 * (failures.ts `servesPage`); `failed` and `budget_exceeded` are returned for the Lab and never stored.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../../agents/registry.js';
import { getSelfOracleMaxOutputTokens } from '../../../config/env.js';
import type { GeminiCallOptions, GeminiResult } from '../../llm/gemini.js';
import { usageCostUsd } from '../../llm/models.js';
import { cleanAreaText, oracleAreaSchema, parseAreaDoc, validateAreaDoc } from '../areaDoc.js';
import { inStoredWindow } from '../audit.js';
import type { BoardPanelId } from '../types.js';
import type {
  AreaBrief,
  OracleAreaStatus,
  OraclePattern,
  OracleV2Output,
  PreparedAgentSlice,
  SelfBuildContext,
  SelfV2AgentTiming,
  SelfV2AreaId,
  SelfV2OracleResult,
  ValidationIssue,
  WindowRef,
} from '../v2types.js';
import { issuesFromGaps } from './failures.js';
import { markAgentUsed } from './cache.js';
import { normaliseEvidenceKey, promptHash, SELF_V2_ORACLE_PROMPT } from './slices.js';
import { timingOf } from '../agentTiming.js';
import { storedWindowsOf } from '../storedWindows.js';

// moved out unchanged (plan "retire the v2 Self reading", server step 1); re-exported so every import keeps working
export { reportedThoughtTokens, timingOf } from '../agentTiming.js';
export { storedWindowsOf, type StoredFrame } from '../storedWindows.js';

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

/** Every evidence key of a call's raw areas and patterns with one prefix (`risk:risk:x` → `risk:x`), inline keys too. */
export function normaliseCallKeys(p: ParsedCall): ParsedCall {
  const keys = (v: unknown) => (Array.isArray(v) ? v.map((k) => (typeof k === 'string' ? normaliseEvidenceKey(k.trim()) : k)) : v);
  const inline = (t: unknown) => (typeof t === 'string' ? t.replace(/\{([^{}]+)\}/g, (_m, k: string) => `{${normaliseEvidenceKey(k.trim())}}`) : t);
  const fix = (o: unknown) => {
    if (!o || typeof o !== 'object') return o;
    const r = { ...(o as Record<string, unknown>) };
    if ('evidence' in r) r.evidence = keys(r.evidence);
    if (Array.isArray(r.paragraphs)) r.paragraphs = r.paragraphs.map(inline);
    return r;
  };
  return { ...p, areas: p.areas.map(fix), patterns: p.patterns.map(fix) };
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

/**
 * ≤ 3 patterns for mind and stuck, each with evidence from the input and dates inside a stored window; with `spans`, a
 * pattern dated at both ends must name a stored span exactly (otherwise its dates are dropped, the pattern kept).
 */
export function validatePatterns(
  raw: readonly unknown[],
  allowedKeys: ReadonlySet<string>,
  frame: { boundaries: ReadonlySet<string>; windows: ReadonlyArray<{ from: string; to: string }>; spans?: ReadonlySet<string> },
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
    let since = dateOk(String(o.since ?? '').trim());
    let until = dateOk(String(o.until ?? '').trim());
    if (since && until && frame.spans && !frame.spans.has(`${since}|${until}`)) {
      gaps.push(`${areaId}: pattern span ${since}..${until} is not a stored span; its dates dropped`);
      since = null;
      until = null;
    }
    patterns.push({ areaId, behaviour, mechanism, since, until, evidence });
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

/** The calls' ids, for a finding on an area (the call that wrote it). */
export const callOfArea = (area: string | null): string | null => (area ? (ORACLE_V2_CALLS.find((c) => (c.areas as readonly string[]).includes(area))?.call ?? null) : null);

/** The areas this build's Oracle must return: all eleven, but `year` only when a year row covers today (the prompt's rule). */
export function expectedOracleAreas(ctx: SelfBuildContext): SelfV2AreaId[] {
  const year = ctx.sub.year;
  return ORACLE_V2_AREAS.filter((a) => a !== 'year' || Boolean(year && !year.noCoverage));
}

/** at most this many reasons per area in the repair call's "fix these" list */
export const REPAIR_REASONS_MAX = 4;

/**
 * The repair call's instruction (one pass, 2026-11-09): only the failed areas, with the validator's reasons as a short
 * "fix these" list. Same system prompt, prefix and suffix as the three calls, so the cached prefix serves it.
 */
export function repairInstruction(areas: readonly SelfV2AreaId[], reasons: Readonly<Partial<Record<SelfV2AreaId, readonly string[]>>>): string {
  const pat = PATTERN_AREAS.filter((a) => areas.includes(a));
  const lines = areas.map((a) => {
    const rs = [...new Set(reasons[a] ?? [])].slice(0, REPAIR_REASONS_MAX).map((r) => (r.startsWith(`${a}: `) ? r.slice(a.length + 2) : r));
    return `- ${a}: ${rs.length ? rs.join('; ') : 'not returned'}`;
  });
  return [
    `REPAIR: your earlier answer for these areas did not pass the checks: ${areas.join(', ')}. Write only these areas again, fixing what is listed; every other rule still holds.`,
    'Fix these:',
    ...lines,
    pat.length ? `Patterns: up to ${PATTERNS_MAX} in all, only for ${pat.join(' and ')}.` : 'No patterns in this call (return none).',
    'Return the JSON document only.',
  ].join('\n');
}

type CallOutcome = {
  call: string;
  areas: readonly SelfV2AreaId[];
  parsed: ParsedCall | null;
  timing: SelfV2AgentTiming;
  error: string | null;
  /** why the call gave no document: it threw, it was cut at the cap, or its JSON did not parse */
  check: 'call_failed' | 'truncated' | 'json_schema' | null;
};

const idOf = (x: unknown): string => String((x as { id?: unknown } | null)?.id ?? '');

/**
 * Runs the three Oracle calls in parallel over one warm prefix, merges and validates; when expected areas fail (a call
 * threw or returned no document, the validator withheld an area, or the model left one out), one repair call re-asks
 * the Oracle for only those areas with the validator's reasons, and the document is validated again. Never more than
 * one repair. Never throws: no area standing is `failed`, some areas still failing is `partial` (with the good areas
 * in `output`), a spend over the cap is `budget_exceeded`. Every finding is returned structured in `issues`, with each
 * area's final status in `areaStatus`.
 */
export async function runOracleV2(
  deps: OracleV2Deps,
  ctx: SelfBuildContext,
  slice: PreparedAgentSlice,
  briefs: readonly Pick<AreaBrief, 'dates'>[] = [],
): Promise<Omit<SelfV2OracleResult, 'familyFindings' | 'cached'>> {
  const pHash = promptHash(SELF_V2_ORACLE_PROMPT);
  const model = slice.model;
  const allowed = new Set(slice.keys.map(normaliseEvidenceKey));
  const ask = async (call: string, areas: readonly SelfV2AreaId[], instruction: string): Promise<CallOutcome> => {
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
            parts: [slice.prefix, slice.suffix, instruction],
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
            output: { chars: g.text.length, cachedTokens: g.usage?.cachedTokens ?? 0, thoughtsReported: g.usage?.thoughtTokensReported ?? null },
          };
        },
      );
      markAgentUsed(slice, deps.informUsed);
      const cut = res.finishReason === 'MAX_TOKENS';
      // a document cut at the output cap is never read, even when a partial JSON would parse
      const p = cut ? null : parseCall(res.text);
      const parsed = p ? normaliseCallKeys(p) : null;
      return {
        call,
        areas,
        parsed,
        timing: timingOf('self.oracle', call, model, res, performance.now() - t0, parsed ? 'ok' : 'failed'),
        error: parsed ? null : `no area document (finish ${res.finishReason ?? 'unknown'}, ${res.text.length} chars)`,
        check: parsed ? null : cut ? 'truncated' : 'json_schema',
      };
    } catch (e) {
      return { call, areas, parsed: null, timing: timingOf('self.oracle', call, model, null, performance.now() - t0, 'failed'), error: String((e as Error).message ?? e).slice(0, 200), check: 'call_failed' };
    }
  };
  const callIssues = (r: CallOutcome): ValidationIssue[] =>
    r.error ? r.areas.map((a) => ({ stage: 'oracle' as const, area: a, check: r.check ?? 'call_failed', message: `${a}: ${r.call}: ${r.error}`.slice(0, 300), callId: r.call })) : [];

  // one operation, one budget (docs/billing/README.md "Spend cap per operation"): no call starts once the run's spend
  // reached its cap; a call already paid for is used, never thrown away
  if ((deps.spentUsd ?? 0) >= deps.maxSpendUsd) {
    const msg = `spent ${round6(deps.spentUsd ?? 0)} of the cap ${deps.maxSpendUsd}; the Oracle was not called`;
    return { promptName: SELF_V2_ORACLE_PROMPT, promptHash: pHash, model, calls: [], spentUsd: round6(deps.spentUsd ?? 0), status: 'budget_exceeded', output: null, gaps: [msg], withheld: [], issues: [{ stage: 'oracle', area: null, check: 'budget', message: msg, callId: null }], repairRan: false };
  }
  const results = await Promise.all(ORACLE_V2_CALLS.map(({ call, areas }) => ask(call, areas, callInstruction(areas))));
  const calls = results.map((r) => r.timing);
  const gaps = results.filter((r) => r.error).map((r) => `${r.call} (${r.areas.join(', ')}): ${r.error}`);
  const issues: ValidationIssue[] = results.flatMap(callIssues);
  const spent = () => round6((deps.spentUsd ?? 0) + calls.reduce((n, c) => n + c.costUsd, 0));
  const base = () => ({ promptName: SELF_V2_ORACLE_PROMPT, promptHash: pHash, model, calls, spentUsd: spent() }) as const;
  let repairRan = false;

  const frame = storedWindowsOf(ctx, briefs);
  const validate = (merged: ParsedCall) => ({
    v: validateAreaDoc(merged, {
      panelIds: asPanelIds(ORACLE_V2_AREAS),
      allowedKeys: allowed,
      boundaries: frame.boundaries,
      windows: frame.windows,
      asOf: ctx.asOf,
      spans: frame.spans,
      endpoints: frame.endpoints,
    }),
    pv: validatePatterns(merged.patterns, allowed, frame),
  });
  const first = validate(mergeOracleCalls(results.map((r) => r.parsed)));
  const expected = expectedOracleAreas(ctx);
  const has = (doc: OracleV2Output['doc'], a: string) => Boolean((doc.areas as Record<string, unknown>)[a]);
  const failedCalls = new Set<string>(results.filter((r) => !r.parsed).flatMap((r) => r.areas));
  const firstGaps = [...first.v.gaps, ...first.pv.gaps];
  gaps.push(...firstGaps);
  issues.push(...issuesFromGaps('oracle', firstGaps, null).map((i) => ({ ...i, callId: callOfArea(i.area) })));
  const failed = expected.filter((a) => !has(first.v.doc, a));
  for (const a of failed) {
    if (failedCalls.has(a) || (first.v.withheld as readonly string[]).includes(a)) continue;
    const msg = `${a}: not returned by ${callOfArea(a) ?? 'the Oracle'}`;
    gaps.push(msg);
    issues.push({ stage: 'oracle', area: a, check: 'missing_area', message: msg, callId: callOfArea(a) });
  }

  let final = first;
  // the repair is one more call: it starts only while the run is under its cap
  if (failed.length && spent() >= deps.maxSpendUsd) {
    const msg = `repair not run: spent ${spent()} of the cap ${deps.maxSpendUsd}`;
    gaps.push(msg);
    issues.push({ stage: 'oracle', area: null, check: 'budget', message: msg, callId: null });
  } else if (failed.length) {
    repairRan = true;
    const failedSet = new Set<string>(failed);
    const reasons: Partial<Record<SelfV2AreaId, string[]>> = {};
    for (const i of issues) if (i.area && failedSet.has(i.area)) (reasons[i.area as SelfV2AreaId] ??= []).push(i.message);
    const rep = await ask('oracle.repair', failed, repairInstruction(failed, reasons));
    calls.push(rep.timing);
    if (rep.error) gaps.push(`oracle.repair (${failed.join(', ')}): ${rep.error}`);
    issues.push(...callIssues(rep));
    if (rep.parsed) {
      // the first pass's good areas stand as they were; the repair's areas take the failed areas' place
      const keep = results.flatMap((r) => (r.parsed ? [{ ...r.parsed, areas: r.parsed.areas.filter((x) => !failedSet.has(idOf(x))) }] : []));
      const repaired = { ...rep.parsed, areas: rep.parsed.areas.filter((x) => failedSet.has(idOf(x))) };
      const second = validate(mergeOracleCalls([...keep, repaired]));
      const repairGaps = [...second.v.gaps, ...second.pv.gaps].filter((g) => failedSet.has(/^([a-z_]+):/.exec(g)?.[1] ?? ''));
      gaps.push(...repairGaps.map((g) => `repair: ${g}`));
      issues.push(...issuesFromGaps('oracle', repairGaps, 'oracle.repair'));
      for (const a of failed) {
        if (has(second.v.doc, a) || repaired.areas.some((x) => idOf(x) === a)) continue;
        const msg = `${a}: not returned by the repair call`;
        gaps.push(msg);
        issues.push({ stage: 'oracle', area: a, check: 'missing_area', message: msg, callId: 'oracle.repair' });
      }
      final = second;
    }
  }

  const areaStatus: Partial<Record<SelfV2AreaId, OracleAreaStatus>> = {};
  for (const a of expected) areaStatus[a] = !failed.includes(a) ? 'ok' : has(final.v.doc, a) ? 'repaired' : 'failed';
  for (const a of ORACLE_V2_AREAS) if (!areaStatus[a] && has(final.v.doc, a)) areaStatus[a] = 'ok';
  for (const i of issues) if (i.area && areaStatus[i.area as SelfV2AreaId]) i.areaStatus = areaStatus[i.area as SelfV2AreaId];

  const anyArea = Object.keys(final.v.doc.areas).length > 0;
  const output: OracleV2Output | null = anyArea ? { doc: final.v.doc, patterns: final.pv.patterns } : null;
  const status = !anyArea ? 'failed' : expected.some((a) => areaStatus[a] === 'failed') ? 'partial' : 'ok';
  const withheld = (final.v.withheld as readonly string[]).filter((a) => areaStatus[a as SelfV2AreaId] !== 'repaired');
  return { ...base(), status, output, gaps, withheld: [...withheld], areaStatus, issues, repairRan };
}
