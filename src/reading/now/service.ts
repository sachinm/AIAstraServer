/**
 * The Now card (docs/reading-engine/72): today on the Self, Love and Work boards, free to the person.
 *
 * `getNow` (the route) reads today's Now for the person's kundli; when there is none it makes it, once (single flight
 * per kundli): the day's data (`pullNow`, stored as the `now` slice in `kundli_slices`, the day in its header), then one
 * model call that writes the three faces, checked, stored in `technique_outputs` (`now.card`) keyed by the slice hash, the
 * profile hash and the prompt hash, valid for the day. No quota: the Now card never takes a question. Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import { READER_SYSTEM_PROMPT } from '../clocks/types.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { loadProfilePack } from '../person/profile.js';
import { roleWordsFor, textProblem, type TextCheckContext } from '../self/v2/personalizerValidate.js';
import { seniorStageWordsFor } from '../self/v2/profileFit.js';
import { claimKey, normaliseEvidenceKey, profileLines, promptHash, promptText, shortHash } from '../self/v2/slices.js';
import type { ProfilePack } from '../self/v2types.js';
import { parseJson } from '../self/v3/oracle.js';
import { v3DateFrame } from '../self/v3/personalizer.js';
import { readSlices, writeSlices } from '../slices/store.js';
import type { RenderedSlice } from '../slices/types.js';
import { NOW_SLICE_ID, pullNow, renderNowSlice, type NowData, type NowPullDeps } from './pull.js';

export const NOW_TECHNIQUE = 'self.now';
export const NOW_AGENT = 'self.now';
export const NOW_PROMPT = 'cards/now';
export const NOW_BOARDS = ['self', 'love', 'work'] as const;
export type NowBoard = (typeof NOW_BOARDS)[number];
export const NOW_TIMEOUT_MS = 60_000;
const LINE_MAX = 20;
const ASKS_MAX = 30;
const STEP_MAX = 35;

export interface NowFace {
  line: string;
  asks: string;
  step: string;
  turns: { date: string; key: string } | null;
  agree: { agree: number; of: number } | null;
}

export interface NowReading {
  asOf: string;
  faces: Record<NowBoard, NowFace>;
  sliceHash: string;
}

export interface NowView {
  status: 'ready' | 'no_kundli' | 'unavailable';
  asOf: string;
  faces: Partial<Record<NowBoard, NowFace>>;
  /** the clocks read today and their deepest running period's end (for Chart details) */
  clocks: Array<{ system: string; deepest: { level: number; to: string } | null }>;
}

export interface NowDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  model: string;
  now?: () => Date;
  /** the reading clocks of the kundli (default: the stored reading clock set, without the year) */
  clocks?: (prisma: PrismaClient, kundliId: string) => Promise<string[]>;
  pull?: Partial<NowPullDeps>;
  latestKundliId?: (prisma: PrismaClient, userId: string) => Promise<string | null>;
  profile?: (prisma: PrismaClient, userId: string, asOf: string) => Promise<ProfilePack>;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const S = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

export function nowSchema(): Record<string, unknown> {
  const str = (description: string) => ({ type: 'STRING', description });
  const face = {
    type: 'OBJECT',
    properties: {
      line: str(`at most ${LINE_MAX} words`),
      asks: str(`at most ${ASKS_MAX} words`),
      step: str('If <cue>, then <action>.'),
      turns: { type: 'OBJECT', properties: { date: str('YYYY-MM-DD copied from NOW'), key: str('the period key') }, required: ['date', 'key'] },
      agree: { type: 'OBJECT', properties: { agree: { type: 'INTEGER' }, of: { type: 'INTEGER' } }, required: ['agree', 'of'] },
      evidence: { type: 'ARRAY', items: { type: 'STRING' } },
    },
    required: ['line', 'asks', 'step', 'turns', 'agree', 'evidence'],
  };
  return { type: 'OBJECT', properties: { self: face, love: face, work: face }, required: [...NOW_BOARDS] };
}

/** Checks one face against the day's slice and the person. Pure. */
export function checkNowFace(raw: unknown, c: { keys: ReadonlySet<string>; periodEnds: ReadonlyMap<string, string>; text: TextCheckContext; clocksRead: number }): { face: NowFace | null; problems: string[] } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const problems: string[] = [];
  const text = (label: string, t: string, max: number) => {
    if (!t) return problems.push(`${label}: empty`);
    if (words(t) > max) problems.push(`${label}: ${words(t)} words, at most ${max}`);
    const why = textProblem(t, c.text);
    if (why) problems.push(`${label}: ${why}`);
  };
  const line = S(o.line);
  const asks = S(o.asks);
  const step = S(o.step);
  text('line', line, LINE_MAX);
  text('asks', asks, ASKS_MAX);
  text('step', step, STEP_MAX);
  if (step && !/^if\b.+\bthen\b/i.test(step)) problems.push('step: not an if-then sentence');
  const ev = (Array.isArray(o.evidence) ? o.evidence : []).map((k) => normaliseEvidenceKey(S(k).replace(/^\{|\}$/g, ''))).filter(Boolean);
  const unknown = ev.filter((k) => !c.keys.has(k));
  if (ev.length < 2) problems.push('evidence: fewer than two keys');
  if (unknown.length) problems.push(`evidence: keys not in NOW (${unknown.slice(0, 3).join(', ')})`);
  let turns: NowFace['turns'] = null;
  const t = (o.turns ?? {}) as Record<string, unknown>;
  const tk = normaliseEvidenceKey(S(t.key).replace(/^\{|\}$/g, ''));
  if (S(t.date) || tk) {
    if (c.periodEnds.get(tk) !== S(t.date)) problems.push(`turns: ${S(t.date)} is not the end of ${tk || 'a period'} in NOW`);
    else turns = { date: S(t.date), key: tk };
  }
  const a = (o.agree ?? {}) as Record<string, unknown>;
  const agree = Number.isInteger(a.agree) && Number.isInteger(a.of) && (a.of as number) === c.clocksRead && (a.agree as number) >= 0 && (a.agree as number) <= (a.of as number) ? { agree: a.agree as number, of: a.of as number } : null;
  return problems.length ? { face: null, problems } : { face: { line, asks, step, turns, agree }, problems };
}

function personBlock(p: ProfilePack): string {
  return [
    '# THE PERSON',
    ...profileLines(p),
    `declined (never mention): ${p.declined.length ? p.declined.join(', ') : 'none'}`,
    `last answers: ${p.lastConfirms.map((c) => `${claimKey(c.claimId)}=${c.answer}`).join(', ') || 'none'}`,
  ].join('\n');
}

/** The day's `now` slice: stored for today, or pulled and stored. */
export async function loadNowSlice(deps: NowDeps, kundliId: string, asOf: string): Promise<{ slice: RenderedSlice | null; data: NowData | null; gaps: string[] }> {
  const stored = await readSlices(deps.prisma, kundliId, [NOW_SLICE_ID]).catch(() => ({}) as Record<string, never>);
  const s = (stored as Record<string, RenderedSlice | undefined>)[NOW_SLICE_ID];
  if (s && s.text.startsWith(`# NOW (${asOf})`)) return { slice: s, data: null, gaps: [] };
  const clocks = await (deps.clocks ?? defaultClocks)(deps.prisma, kundliId).catch(() => [] as string[]);
  if (!clocks.length) return { slice: null, data: null, gaps: ['now: no reading clocks for this kundli'] };
  const kundliRequest = deps.pull?.kundliRequest ?? (async (id: string) => (await import('../chartData/store.js')).prismaChartDataRepo(deps.prisma).kundliRequest(id));
  const data = await pullNow({ kundliRequest, fetcher: deps.pull?.fetcher }, kundliId, asOf, clocks);
  const read = data.clocks.filter((c) => c.periods.length).length;
  if (!read && !data.transit) return { slice: null, data, gaps: data.gaps };
  const slice = renderNowSlice(data);
  await writeSlices(deps.prisma, kundliId, [slice]).catch((e) => data.gaps.push(`now: slice not stored (${(e as Error).message?.slice(0, 120)})`));
  return { slice, data, gaps: data.gaps };
}

async function defaultClocks(prisma: PrismaClient, kundliId: string): Promise<string[]> {
  const { loadReadingClockSet } = await import('../self/sub/pressure.js');
  return (await loadReadingClockSet(prisma, kundliId)).pulled;
}

/** The periods' ends by key, and the clocks read, from the slice text (selection on what the slice states). */
export function sliceFacts(slice: RenderedSlice): { periodEnds: Map<string, string>; clocks: NowView['clocks']; clocksRead: number } {
  const periodEnds = new Map<string, string>();
  const clocks: NowView['clocks'] = [];
  let cur: NowView['clocks'][number] | null = null;
  for (const line of slice.text.split('\n')) {
    const h = /^## CLOCK (\S+)/.exec(line);
    if (h) {
      cur = { system: h[1]!, deepest: null };
      clocks.push(cur);
      continue;
    }
    if (line.startsWith('## SKY')) cur = null;
    const r = /^\{([^}]+)\} L(\d+) \S+ (\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/.exec(line);
    if (r && cur) {
      periodEnds.set(normaliseEvidenceKey(r[1]!), r[4]!);
      const level = Number(r[2]);
      if (!cur.deepest || level > cur.deepest.level) cur.deepest = { level, to: r[4]! };
    }
  }
  return { periodEnds, clocks, clocksRead: clocks.filter((c) => c.deepest).length };
}

const inflight = new Map<string, Promise<NowView>>();

/** Today's Now for the person (made once a day, free). Never throws. */
export async function getNow(deps: NowDeps, userId: string): Promise<NowView> {
  const asOf = dayOf((deps.now ?? (() => new Date()))());
  const kundliId = await (deps.latestKundliId ?? defaultLatestKundliId)(deps.prisma, userId).catch(() => null);
  if (!kundliId) return { status: 'no_kundli', asOf, faces: {}, clocks: [] };
  const key = `${kundliId}|${asOf}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = makeNow(deps, userId, kundliId, asOf).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function defaultLatestKundliId(prisma: PrismaClient, userId: string): Promise<string | null> {
  const k = await prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
  return k?.id ?? null;
}

async function makeNow(deps: NowDeps, userId: string, kundliId: string, asOf: string): Promise<NowView> {
  try {
    const { slice, gaps } = await loadNowSlice(deps, kundliId, asOf);
    if (!slice) {
      console.warn('[now] no data:', gaps.slice(0, 3).join('; '));
      return { status: 'unavailable', asOf, faces: {}, clocks: [] };
    }
    const facts = sliceFacts(slice);
    const profile = await (deps.profile ?? loadProfilePack)(deps.prisma, userId, asOf);
    const textCheck: TextCheckContext = { gender: profile.gender, dates: v3DateFrame([asOf, ...facts.periodEnds.values()]), roleWords: roleWordsFor(profile.facts), stageWords: seniorStageWordsFor(profile) };
    const keys = new Set(slice.keys.map(normaliseEvidenceKey));
    const storeKey = shortHash([slice.hash, profile.hash, promptHash(NOW_PROMPT), promptHash(READER_SYSTEM_PROMPT)].join('|'));
    const tomorrow = new Date(`${asOf}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const stored = await withTechniqueOutput<NowReading | null>(
      deps.prisma,
      { technique: NOW_TECHNIQUE, kundliId, digestVersion: storeKey, context: { now: new Date(`${asOf}T12:00:00Z`), runningPeriod: { from: new Date(`${asOf}T00:00:00Z`), to: tomorrow } }, agentId: NOW_AGENT, userId, charts: [{ type: 'transit', variant: `now;${asOf}` }] },
      async () => {
        const person = personBlock(profile);
        const ask = async (repair: string): Promise<Record<string, unknown> | null> => {
          const res = await withAgentRun(
            deps.prisma,
            NOW_AGENT,
            { userId, kundliId, technique: NOW_TECHNIQUE, task: `now ${asOf}`, input: { slice: slice.hash, keys: keys.size }, charts: [{ type: 'transit', variant: `now;${asOf}` }] },
            async () => {
              const g = await deps.callGemini({
                model: deps.model,
                node: repair ? 'now.card.repair' : 'now.card',
                system: promptText(READER_SYSTEM_PROMPT),
                parts: [[promptText(NOW_PROMPT), slice.text].join('\n\n'), [person, `TODAY: ${asOf}`, repair, 'Return the JSON document only.'].filter(Boolean).join('\n\n')],
                thinking: 'low',
                maxOutputTokens: 4_000,
                timeoutMs: NOW_TIMEOUT_MS,
                responseSchema: nowSchema(),
              });
              return { value: g, usage: { model: deps.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 }, output: { chars: g.text.length } };
            },
          );
          return res.finishReason === 'MAX_TOKENS' ? null : (parseJson(res.text) as Record<string, unknown> | null);
        };
        const check = (doc: Record<string, unknown> | null) => {
          const faces: Partial<Record<NowBoard, NowFace>> = {};
          const problems: Partial<Record<NowBoard, string[]>> = {};
          for (const b of NOW_BOARDS) {
            const r = checkNowFace(doc?.[b], { keys, periodEnds: facts.periodEnds, text: textCheck, clocksRead: facts.clocksRead });
            if (r.face) faces[b] = r.face;
            else problems[b] = doc ? r.problems : ['no document'];
          }
          return { faces, problems };
        };
        let got = check(await ask('').catch(() => null));
        const failed = Object.keys(got.problems) as NowBoard[];
        if (failed.length) {
          const note = ['REPAIR: these faces failed the checks. Write all three again; fix exactly this and keep the others the same:', ...failed.map((b) => `- ${b}: ${(got.problems[b] ?? []).slice(0, 4).join('; ')}`)].join('\n');
          const second = check(await ask(note).catch(() => null));
          got = { faces: { ...second.faces, ...got.faces }, problems: second.problems };
        }
        const complete = NOW_BOARDS.every((b) => got.faces[b]);
        const value: NowReading | null = Object.keys(got.faces).length ? { asOf, faces: got.faces as Record<NowBoard, NowFace>, sliceHash: slice.hash } : null;
        return { value, skipStore: !complete, summary: { faces: Object.keys(got.faces).length } };
      },
    );
    return { status: stored.value ? 'ready' : 'unavailable', asOf, faces: stored.value?.faces ?? {}, clocks: facts.clocks };
  } catch (e) {
    console.error('[now]', (e as Error).message);
    return { status: 'unavailable', asOf, faces: {}, clocks: [] };
  }
}
