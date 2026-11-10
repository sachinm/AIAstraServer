/**
 * The v3 Oracle (docs/reading-engine/68 §4.5 items 4–5, §4.8): three parallel calls over the same cached natal prefix as
 * v2, each writing span-led cards for the cards it names. The suffix is the year frame (spans, tones, agreement, rows),
 * the Saturn passage, the clocks not read and the person's answers. One repair call re-asks failed cards once.
 *
 * The validator keeps a card only when every frame span is answered once with the frame's own tone copied, the mode
 * fits the tone (a heavy span is never `build`, a light one never `get_through`), every evidence key is in the input,
 * every date is a frame date, and the card names a knot as well as a gift. A bad `confirm` or `pattern` is dropped, not
 * the card.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../../agents/registry.js';
import { getSelfOracleMaxOutputTokens } from '../../../config/env.js';
import type { GeminiCallOptions, GeminiResult } from '../../llm/gemini.js';
import { AREA_CERTAINTIES, type AreaCertainty } from '../areaDoc.js';
import { daysIn } from '../v2/personalizerValidate.js';
import { markAgentUsed } from '../v2/cache.js';
import { timingOf } from '../v2/oracle.js';
import { normaliseEvidenceKey, promptHash } from '../v2/slices.js';
import type { PreparedAgentSlice, SelfBuildContext, SelfV2AgentTiming, ValidationIssue } from '../v2types.js';
import type { OracleCardV3, OracleSpanV3, OracleV3Output, SelfCardId, SpanMode, SpanTone, YearFrameV3 } from './types.js';

export const SELF_V3_ORACLE_PROMPT = 'oracle/self-cards-v3';
export const ORACLE_V3_TIMEOUT_MS = 120_000;
export const PATTERN_CARDS: readonly SelfCardId[] = ['mind', 'stuck'];

/** three calls over one prefix; the person's own cards go in whichever call holds them (all three run at once) */
export const ORACLE_V3_CALLS: ReadonlyArray<{ call: 'v3.oracle.a' | 'v3.oracle.b' | 'v3.oracle.c'; cards: readonly SelfCardId[] }> = [
  { call: 'v3.oracle.a', cards: ['body', 'mind', 'stuck', 'diagnosis'] },
  { call: 'v3.oracle.b', cards: ['lagna', 'drive', 'presence', 'yogas'] },
  { call: 'v3.oracle.c', cards: ['chapter', 'chapters', 'year'] },
];

const TONES: readonly SpanTone[] = ['heavy', 'mixed', 'light'];
const MODES: readonly SpanMode[] = ['get_through', 'build'];

export function oracleV3Schema(cards: readonly SelfCardId[], spanIds: readonly string[]): Record<string, unknown> {
  const str = (description: string) => ({ type: 'STRING', description });
  const keys = { type: 'ARRAY', items: { type: 'STRING' }, description: 'evidence keys from the input, without braces' };
  return {
    type: 'OBJECT',
    properties: {
      cards: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            card: { type: 'STRING', enum: [...cards] },
            headline: str('one sentence with a date from the frame'),
            spans: {
              type: 'ARRAY',
              description: 'one entry per YEAR FRAME span, in order',
              items: {
                type: 'OBJECT',
                properties: {
                  span: { type: 'STRING', enum: [...spanIds] },
                  tone: { type: 'STRING', enum: [...TONES] },
                  mode: { type: 'STRING', enum: [...MODES] },
                  asks: str('what this stretch asks, in chart terms'),
                  obstacle: str('the likely obstacle'),
                  evidence: keys,
                  agreement: str('which clocks agree and which do not'),
                },
                required: ['span', 'tone', 'mode', 'asks', 'obstacle', 'evidence', 'agreement'],
              },
            },
            confirm: {
              type: 'OBJECT',
              properties: { claimId: str('<card>.<short_tag>'), text: str('a dated statement about a past span the person can deny; empty when none'), from: str('YYYY-MM-DD'), to: str('YYYY-MM-DD') },
              required: ['claimId', 'text', 'from', 'to'],
            },
            gift: str('one gift'),
            knot: str('one knot'),
            pattern: {
              type: 'OBJECT',
              properties: { text: str('a repeating behaviour; empty when none or not a mind/stuck card'), since: str('YYYY-MM-DD or empty'), until: str('YYYY-MM-DD or empty'), evidence: keys },
              required: ['text', 'since', 'until', 'evidence'],
            },
            certainty: { type: 'STRING', enum: [...AREA_CERTAINTIES] },
            evidence: keys,
          },
          required: ['card', 'headline', 'spans', 'confirm', 'gift', 'knot', 'pattern', 'certainty', 'evidence'],
        },
      },
    },
    required: ['cards'],
  };
}

export function callInstructionV3(cards: readonly SelfCardId[], answers: string): string {
  return [`PERSON'S ANSWERS: ${answers || 'none'}`, `THIS CALL: write only these cards: ${cards.join(', ')}. Return the JSON document only.`].join('\n');
}

export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export interface OracleV3CheckContext {
  frame: YearFrameV3;
  allowedKeys: ReadonlySet<string>;
  /** every date a card may name (frame dates plus the stored windows the prefix carries) */
  dates: ReadonlySet<string>;
  expected: readonly SelfCardId[];
}

const S = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const keysOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((k) => normaliseEvidenceKey(k.trim().replace(/^\{|\}$/g, ''))) : []);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates one raw card. Returns the card, or the reasons it fails; soft drops (confirm, pattern) go in `notes`. */
export function checkOracleCard(raw: unknown, c: OracleV3CheckContext): { card: OracleCardV3 | null; problems: string[]; notes: string[] } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const id = S(o.card) as SelfCardId;
  const problems: string[] = [];
  const notes: string[] = [];
  const badKeys = (ks: string[]) => ks.filter((k) => !c.allowedKeys.has(k));
  const badDays = (text: string) => daysIn(text).filter((d) => !c.dates.has(d));
  const headline = S(o.headline);
  if (!headline) problems.push('no headline');
  for (const d of badDays(headline)) problems.push(`headline date ${d} not in the frame`);

  const want = c.frame.spans;
  const got = Array.isArray(o.spans) ? (o.spans as Array<Record<string, unknown>>) : [];
  const spans: OracleSpanV3[] = [];
  for (const fs of want) {
    const hits = got.filter((g) => S(g.span) === fs.id);
    if (hits.length !== 1) {
      problems.push(`span ${fs.id}: ${hits.length ? 'answered twice' : 'missing'}`);
      continue;
    }
    const g = hits[0]!;
    const tone = S(g.tone) as SpanTone;
    const mode = S(g.mode) as SpanMode;
    if (tone !== fs.tone) problems.push(`span ${fs.id}: tone ${tone || 'none'} is not the frame's ${fs.tone}`);
    if (!MODES.includes(mode)) problems.push(`span ${fs.id}: no mode`);
    if (fs.tone === 'heavy' && mode === 'build') problems.push(`span ${fs.id}: a heavy span is never build`);
    if (fs.tone === 'light' && mode === 'get_through') problems.push(`span ${fs.id}: a light span is never get_through`);
    const asks = S(g.asks);
    const obstacle = S(g.obstacle);
    if (!asks || !obstacle) problems.push(`span ${fs.id}: asks or obstacle empty`);
    const evidence = keysOf(g.evidence);
    if (!evidence.length) problems.push(`span ${fs.id}: no evidence`);
    for (const k of badKeys(evidence)) problems.push(`span ${fs.id}: unknown evidence key ${k}`);
    for (const d of [...badDays(asks), ...badDays(obstacle)]) problems.push(`span ${fs.id}: date ${d} not in the frame`);
    spans.push({ span: fs.id, tone: fs.tone, mode, asks, obstacle, evidence, agreement: S(g.agreement) });
  }
  if (got.length > want.length) problems.push(`${got.length - want.length} spans not in the frame`);

  const gift = S(o.gift);
  const knot = S(o.knot);
  if (!knot) problems.push('no knot (a card that only flatters is rejected)');
  if (!gift) problems.push('no gift');

  const evidence = keysOf(o.evidence);
  for (const k of badKeys(evidence)) problems.push(`unknown evidence key ${k}`);
  const certaintyRaw = S(o.certainty) as AreaCertainty;
  const certainty: AreaCertainty = AREA_CERTAINTIES.includes(certaintyRaw) ? certaintyRaw : 'possible';

  let confirm: OracleCardV3['confirm'] = null;
  const cf = (o.confirm ?? {}) as Record<string, unknown>;
  if (S(cf.text)) {
    const claimId = S(cf.claimId);
    const from = S(cf.from);
    const to = S(cf.to);
    if (!new RegExp(`^${id}\\.[a-z0-9_]{1,40}$`).test(claimId)) notes.push(`confirm dropped: claim id ${claimId || 'none'} is not ${id}.<tag>`);
    else if (!DATE.test(from) || !DATE.test(to) || !c.dates.has(from) || !c.dates.has(to)) notes.push(`confirm dropped: ${from}..${to} not frame dates`);
    else if (from > c.frame.asOf) notes.push('confirm dropped: it is about the future');
    else if (badDays(S(cf.text)).length) notes.push('confirm dropped: a date in its text is not in the frame');
    else confirm = { claimId, text: S(cf.text), from, to: to > c.frame.asOf ? c.frame.asOf : to };
  }

  let pattern: OracleCardV3['pattern'] = null;
  const pt = (o.pattern ?? {}) as Record<string, unknown>;
  if (S(pt.text)) {
    const since = S(pt.since) || null;
    const until = S(pt.until) || null;
    const pk = keysOf(pt.evidence);
    if (!PATTERN_CARDS.includes(id)) notes.push(`pattern dropped: ${id} carries none`);
    else if ((since && !c.dates.has(since)) || (until && !c.dates.has(until))) notes.push('pattern dropped: a date not in the frame');
    else if (!pk.length || badKeys(pk).length) notes.push('pattern dropped: evidence missing or unknown');
    else pattern = { text: S(pt.text), since, until, evidence: pk };
  }

  if (problems.length) return { card: null, problems, notes };
  return { card: { card: id, headline, spans, confirm, gift, knot, pattern, certainty, evidence }, problems, notes };
}

export function validateOracleV3(rawCards: readonly unknown[], c: OracleV3CheckContext): { output: OracleV3Output; failed: Partial<Record<SelfCardId, string[]>>; notes: string[] } {
  const out: OracleV3Output = { cards: {} };
  const failed: Partial<Record<SelfCardId, string[]>> = {};
  const notes: string[] = [];
  for (const raw of rawCards) {
    const id = S((raw as { card?: unknown } | null)?.card) as SelfCardId;
    if (!c.expected.includes(id)) {
      notes.push(`card ${id || '?'} not asked for: ignored`);
      continue;
    }
    if (out.cards[id]) {
      notes.push(`${id}: returned twice, first kept`);
      continue;
    }
    const r = checkOracleCard(raw, c);
    notes.push(...r.notes.map((n) => `${id}: ${n}`));
    if (r.card) {
      out.cards[id] = r.card;
      delete failed[id];
    } else failed[id] = r.problems;
  }
  for (const id of c.expected) if (!out.cards[id] && !failed[id]) failed[id] = ['not returned'];
  return { output: out, failed, notes };
}

export interface OracleV3Deps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  spentUsd?: number;
  maxSpendUsd: number;
}

export interface OracleV3Result {
  status: 'ok' | 'partial' | 'failed' | 'budget_exceeded';
  output: OracleV3Output | null;
  cardStatus: Partial<Record<SelfCardId, 'ok' | 'repaired' | 'failed'>>;
  issues: ValidationIssue[];
  calls: SelfV2AgentTiming[];
  model: string;
  promptHash: string;
  spentUsd: number;
  repairRan: boolean;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Runs the three calls, validates, repairs failed cards once. Never throws. */
export async function runOracleV3(deps: OracleV3Deps, ctx: SelfBuildContext, slice: PreparedAgentSlice, frame: YearFrameV3, dates: ReadonlySet<string>, answers: string): Promise<OracleV3Result> {
  const model = slice.model;
  const pHash = promptHash(SELF_V3_ORACLE_PROMPT);
  const allowed = new Set(slice.keys.map(normaliseEvidenceKey));
  const spanIds = frame.spans.map((s) => s.id);
  const calls: SelfV2AgentTiming[] = [];
  const issues: ValidationIssue[] = [];
  const ask = async (call: string, cards: readonly SelfCardId[], extra = ''): Promise<unknown[] | null> => {
    const t0 = performance.now();
    try {
      const res = await withAgentRun(
        deps.prisma,
        'self.oracle.v3',
        {
          userId: ctx.userId,
          kundliId: ctx.kundliId,
          technique: 'self.v3.cards',
          task: `self.v3.oracle ${call} ${ctx.asOf}`,
          input: { cards: cards.length, spans: spanIds.length, keys: allowed.size },
          charts: [{ type: 'kundli_digest', variant: ctx.stamps.digestVersion }, { type: 'pressure_inventory', variant: `system=${frame.clock}` }],
        },
        async () => {
          const g = await deps.callGemini({
            model,
            node: `self.oracle.v3.${call}`,
            system: slice.system,
            parts: [slice.prefix, slice.suffix, [extra, callInstructionV3(cards, answers)].filter(Boolean).join('\n\n')],
            thinking: 'low',
            maxOutputTokens: getSelfOracleMaxOutputTokens(),
            timeoutMs: ORACLE_V3_TIMEOUT_MS,
            cachePrefix: true,
            cacheOwner: slice.cacheOwner,
            responseSchema: oracleV3Schema(cards, spanIds),
          });
          return {
            value: g,
            usage: { model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 },
            output: { chars: g.text.length },
          };
        },
      );
      markAgentUsed(slice, deps.informUsed);
      const cut = res.finishReason === 'MAX_TOKENS';
      const parsed = cut ? null : (parseJson(res.text) as { cards?: unknown } | null);
      const list = parsed && Array.isArray(parsed.cards) ? (parsed.cards as unknown[]) : null;
      calls.push(timingOf('self.oracle', call, model, res, performance.now() - t0, list ? 'ok' : 'failed'));
      if (!list) for (const a of cards) issues.push({ stage: 'oracle', area: a, check: cut ? 'truncated' : 'json_schema', message: `${a}: ${call}: no card document`, callId: call });
      return list;
    } catch (e) {
      calls.push(timingOf('self.oracle', call, model, null, performance.now() - t0, 'failed'));
      for (const a of cards) issues.push({ stage: 'oracle', area: a, check: 'call_failed', message: `${a}: ${call}: ${String((e as Error).message ?? e).slice(0, 160)}`, callId: call });
      return null;
    }
  };
  const spent = () => round6((deps.spentUsd ?? 0) + calls.reduce((n, x) => n + x.costUsd, 0));
  const expected = ORACLE_V3_CALLS.flatMap((x) => x.cards);
  const base = { model, promptHash: pHash, calls };

  const lists = await Promise.all(ORACLE_V3_CALLS.map(({ call, cards }) => ask(call, cards)));
  if (spent() > deps.maxSpendUsd) {
    issues.push({ stage: 'oracle', area: null, check: 'budget', message: `spent ${spent()} over the cap ${deps.maxSpendUsd}`, callId: null });
    return { ...base, status: 'budget_exceeded', output: null, cardStatus: {}, issues, spentUsd: spent(), repairRan: false };
  }
  const check = { frame, allowedKeys: allowed, dates, expected };
  const first = validateOracleV3(lists.flatMap((l) => l ?? []), check);
  const pushFailures = (failed: Partial<Record<SelfCardId, string[]>>, callId: string | null) => {
    for (const [id, reasons] of Object.entries(failed)) for (const r of reasons ?? []) issues.push({ stage: 'oracle', area: id, check: r.includes('evidence') ? 'unknown_evidence_key' : r.includes('date') ? 'date_not_stored' : r === 'not returned' ? 'missing_area' : 'other', message: `${id}: ${r}`.slice(0, 300), callId });
  };
  pushFailures(first.failed, null);
  for (const n of first.notes) issues.push({ stage: 'oracle', area: n.split(':')[0] ?? null, check: 'other', message: n.slice(0, 300), callId: null });

  const output = first.output;
  const failedIds = Object.keys(first.failed) as SelfCardId[];
  const cardStatus: OracleV3Result['cardStatus'] = {};
  for (const id of expected) cardStatus[id] = output.cards[id] ? 'ok' : 'failed';
  let repairRan = false;
  if (failedIds.length) {
    repairRan = true;
    const reasons = failedIds.map((id) => `- ${id}: ${(first.failed[id] ?? []).slice(0, 4).join('; ')}`).join('\n');
    const list = await ask('v3.oracle.repair', failedIds, `REPAIR: these cards failed the validator. Write them again and fix exactly this:\n${reasons}`);
    const second = validateOracleV3(list ?? [], { ...check, expected: failedIds });
    pushFailures(second.failed, 'v3.oracle.repair');
    for (const id of failedIds) {
      if (second.output.cards[id]) {
        output.cards[id] = second.output.cards[id];
        cardStatus[id] = 'repaired';
      }
    }
  }
  for (const i of issues) if (i.area && cardStatus[i.area as SelfCardId]) i.areaStatus = cardStatus[i.area as SelfCardId];
  const n = Object.keys(output.cards).length;
  const status: OracleV3Result['status'] = spent() > deps.maxSpendUsd ? 'budget_exceeded' : !n ? 'failed' : expected.some((id) => cardStatus[id] === 'failed') ? 'partial' : 'ok';
  return { ...base, status, output: n ? output : null, cardStatus, issues, spentUsd: spent(), repairRan };
}
