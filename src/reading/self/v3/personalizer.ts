/**
 * The v3 Personalizer (docs/reading-engine/68 §4.5 item 6, §4.8): one call per Oracle call, in parallel, each over the
 * Oracle cards of that call (the cached prefix) and the person (the suffix). It writes the face of each card: the line,
 * and per span asks, obstacle and one if-then step. Spans, tones and modes stay the Oracle's.
 *
 * The validator reuses v2's text checks (engine names, internal ids, chart terms, medical words, the body card's diet and
 * medicine words, role and stage words, gendered words with no stated gender, dates not in the Oracle cards). A card
 * whose line or any span fails is withheld (the v2 card stays on the board); a bad `confirm`, `pattern` or `ladder` is
 * dropped alone.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../../agents/registry.js';
import { getPersonalizerVoiceVersion, isPersonalizerVoiceByGenderEnabled } from '../../../config/env.js';
import type { GeminiCallOptions, GeminiResult } from '../../llm/gemini.js';
import { markAgentUsed } from '../v2/cache.js';
import { timingOf } from '../v2/oracle.js';
import { portraitLines } from '../v2/portrait.js';
import { bodyAdviceWords, roleWordsFor, textProblem, type DateFrame, type TextCheckContext } from '../v2/personalizerValidate.js';
import { seniorStageWordsFor } from '../v2/profileFit.js';
import { claimKey, profileLines, promptHash, promptText } from '../v2/slices.js';
import type { LadderSteps, PersonPortrait, PersonalizerInput, SelfBuildContext, SelfV2AgentTiming, StatedGender, ValidationIssue } from '../v2types.js';
import { parseJson } from './oracle.js';
import type { OracleCardV3, OracleV3Output, PersonalCardV3, SelfCardId, SelfSectionId } from './types.js';

export const SELF_V3_PERSONALIZER_PROMPT = 'personalizer/self-v3';
export const PERSONALIZER_V3_TIMEOUT_MS = 60_000;
export const LINE_MAX_WORDS = 20;
export const ASKS_MAX_WORDS = 30;
export const OBSTACLE_MAX_WORDS = 20;
export const STEP_MAX_WORDS = 35;

/** The voice prompt (prompts/personalizer/voice.md): three blocks, `## woman`, `## man` and `## neutral`, under shared guardrails. */
export const PERSONALIZER_VOICE_PROMPT = 'personalizer/voice';
export type PersonalizerVoice = 'woman' | 'man' | 'neutral';

/**
 * The voice for a stated gender: `woman` or `man` when it was stated, else `neutral` (not stated, non-binary, prefer not
 * to say, anything unknown). `enabled` is env `PERSONALIZER_VOICE_BY_GENDER`; off gives `neutral` for everyone.
 */
export function personalizerVoiceOf(gender: StatedGender | string | null | undefined, enabled: boolean = isPersonalizerVoiceByGenderEnabled()): PersonalizerVoice {
  if (!enabled) return 'neutral';
  return gender === 'woman' || gender === 'man' ? gender : 'neutral';
}

/** The voice file split into its guardrails (everything above the first block) and its blocks. */
export function parseVoiceBlocks(text: string): { guard: string; blocks: Partial<Record<PersonalizerVoice, string>> } {
  const guard: string[] = [];
  const found: Record<string, string[]> = {};
  let cur = guard;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = /^## (woman|man|neutral)\s*$/.exec(line);
    if (m) {
      cur = [`## ${m[1]}`];
      found[m[1]!] = cur;
    } else cur.push(line);
  }
  const blocks: Partial<Record<PersonalizerVoice, string>> = {};
  for (const [k, v] of Object.entries(found)) blocks[k as PersonalizerVoice] = v.join('\n').trim();
  return { guard: guard.join('\n').trim(), blocks };
}

/** The voice text for one voice: the shared guardrails, then that voice's block only; '' when the file lacks the block. */
export function personalizerVoiceBlock(voice: PersonalizerVoice, text: string = promptText(PERSONALIZER_VOICE_PROMPT)): string {
  const { guard, blocks } = parseVoiceBlocks(text);
  const block = blocks[voice];
  return block ? `${guard}\n\n${block}` : '';
}

/**
 * The voice part of the cached prefix (`parts[0]`): the version, then the guardrails and the block for this person. It
 * depends on the voice and its version only, never on the span, the day or the person, so the prefix stays stable per voice.
 */
export function personalizerVoicePrefix(gender: StatedGender | string | null | undefined): string {
  const voice = personalizerVoiceOf(gender);
  const block = personalizerVoiceBlock(voice);
  return block ? `# VOICE ${getPersonalizerVoiceVersion()}: ${voice}\n${block}` : '';
}

/** The voice's part of a card cache key: version, voice and the voice file's hash (a changed voice never serves an old card). */
export function personalizerVoiceToken(gender: StatedGender | string | null | undefined): string {
  return `${getPersonalizerVoiceVersion()}.${personalizerVoiceOf(gender)}.${promptHash(PERSONALIZER_VOICE_PROMPT)}`;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const S = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function renderOracleCards(cards: readonly OracleCardV3[]): string {
  const L: string[] = ['# ORACLE CARDS'];
  for (const c of cards) {
    L.push(`## ${c.card}`, `headline: ${c.headline}`, `certainty: ${c.certainty}`, `gift: ${c.gift}`, `knot: ${c.knot}`);
    for (const s of c.spans) L.push(`- span ${s.span} ${s.mode} tone=${s.tone}: asks: ${s.asks} | obstacle: ${s.obstacle} | agreement: ${s.agreement}`);
    L.push(`confirm: ${c.confirm ? `${c.confirm.claimId} ${c.confirm.from}..${c.confirm.to}: ${c.confirm.text}` : 'none'}`);
    L.push(`pattern: ${c.pattern ? `${c.pattern.since ?? 'n/a'}..${c.pattern.until ?? 'n/a'}: ${c.pattern.text}` : 'none'}`);
  }
  return L.join('\n');
}

/** the span dates per card, for the suffix (the prefix carries span ids only, so it stays stable across days) */
function spanDates(cards: readonly OracleCardV3[], dates: ReadonlyMap<string, { from: string; to: string }>): string[] {
  const ids = [...new Set(cards.flatMap((c) => c.spans.map((s) => s.span)))];
  return ids.map((id) => `- ${id}: ${dates.get(id)?.from ?? '?'} to ${dates.get(id)?.to ?? '?'}`);
}

export interface PersonalizerV3Input {
  profile: PersonalizerInput['profile'];
  portrait: PersonPortrait | null;
  sections: Partial<Record<SelfCardId, readonly SelfSectionId[]>>;
}

export function personalizerV3Suffix(asOf: string, cards: readonly OracleCardV3[], spans: ReadonlyMap<string, { from: string; to: string }>, input: PersonalizerV3Input): string {
  const p = input.profile;
  return [
    `TODAY: ${asOf}`,
    '## SPAN DATES',
    ...spanDates(cards, spans),
    '## THE PERSON',
    ...profileLines(p),
    `declined (never mention): ${p.declined.length ? p.declined.join(', ') : 'none'}`,
    `last answers: ${p.lastConfirms.map((c) => `${claimKey(c.claimId)}=${c.answer}`).join(', ') || 'none'}`,
    `mood today: ${p.mood ?? 'not given'}`,
    ...(input.portrait ? portraitLines(input.portrait) : ['## PORTRAIT: not built for this call; write from THE PERSON only']),
    '## WRITE: one card for each of these, with the sections the person switched on',
    ...cards.map((c) => `- ${c.card}: sections ${(input.sections[c.card] ?? ['line', 'year', 'stretch', 'confirm']).join(', ')}`),
  ].join('\n');
}

export function personalizerV3Schema(cards: readonly SelfCardId[]): Record<string, unknown> {
  const str = (description: string) => ({ type: 'STRING', description });
  return {
    type: 'OBJECT',
    properties: {
      cards: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            card: { type: 'STRING', enum: [...cards] },
            line: str(`at most ${LINE_MAX_WORDS} words, one sentence with a date`),
            spans: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: { span: str('the span id'), asks: str(`at most ${ASKS_MAX_WORDS} words`), obstacle: str(`at most ${OBSTACLE_MAX_WORDS} words`), step: str('If <cue>, then <action>.') },
                required: ['span', 'asks', 'obstacle', 'step'],
              },
            },
            confirm: str('the confirm as a yes/no question, or empty'),
            pattern: str('only when the pattern section is on, else empty'),
            ladder: {
              type: 'OBJECT',
              properties: { best: str(''), practical: str(''), drift: str(''), floor: str('') },
              required: ['best', 'practical', 'drift', 'floor'],
            },
          },
          required: ['card', 'line', 'spans', 'confirm', 'pattern', 'ladder'],
        },
      },
    },
    required: ['cards'],
  };
}

/** Every date the Oracle cards and the frame carry: the only dates a card face may name. */
export function v3DateFrame(dates: Iterable<string>): DateFrame {
  const f: DateFrame = { days: new Set(), months: new Set(), years: new Set(), pairs: new Set() };
  for (const d of dates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    f.days.add(d);
    f.months.add(d.slice(0, 7));
    f.years.add(d.slice(0, 4));
  }
  return f;
}

export function checkPersonalCard(raw: unknown, oracle: OracleCardV3, c: TextCheckContext, sections: readonly SelfSectionId[]): { card: PersonalCardV3 | null; problems: string[]; notes: string[] } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const problems: string[] = [];
  const notes: string[] = [];
  const ctx: TextCheckContext = oracle.card === 'body' ? { ...c, cardWords: bodyAdviceWords() } : c;
  const text = (label: string, t: string, max: number) => {
    if (!t) return problems.push(`${label}: empty`);
    if (words(t) > max) problems.push(`${label}: ${words(t)} words, at most ${max}`);
    const why = textProblem(t, ctx);
    if (why) problems.push(`${label}: ${why}`);
  };
  const line = S(o.line);
  text('line', line, LINE_MAX_WORDS);
  const got = Array.isArray(o.spans) ? (o.spans as Array<Record<string, unknown>>) : [];
  const spans: PersonalCardV3['spans'] = [];
  for (const os of oracle.spans) {
    const g = got.find((x) => S(x.span) === os.span);
    if (!g) {
      problems.push(`span ${os.span}: missing`);
      continue;
    }
    const asks = S(g.asks);
    const obstacle = S(g.obstacle);
    const step = S(g.step);
    text(`span ${os.span} asks`, asks, ASKS_MAX_WORDS);
    text(`span ${os.span} obstacle`, obstacle, OBSTACLE_MAX_WORDS);
    text(`span ${os.span} step`, step, STEP_MAX_WORDS);
    if (step && !/^if\b.+\bthen\b/i.test(step)) problems.push(`span ${os.span} step: not an if-then sentence`);
    spans.push({ span: os.span, asks, obstacle, step });
  }

  let confirm: string | null = S(o.confirm) || null;
  if (confirm && !oracle.confirm) {
    notes.push('confirm dropped: the Oracle gave none');
    confirm = null;
  } else if (confirm) {
    const why = textProblem(confirm, ctx);
    if (why || !confirm.endsWith('?')) {
      notes.push(`confirm dropped: ${why ?? 'not a question'}`);
      confirm = null;
    }
  }
  let pattern: string | null = S(o.pattern) || null;
  if (pattern && (!sections.includes('pattern') || !oracle.pattern)) pattern = null;
  else if (pattern) {
    const why = textProblem(pattern, ctx);
    if (why) {
      notes.push(`pattern dropped: ${why}`);
      pattern = null;
    }
  }
  let ladder: LadderSteps | null = null;
  const ld = (o.ladder ?? {}) as Record<string, unknown>;
  if (sections.includes('ladder')) {
    const steps = { best: S(ld.best), practical: S(ld.practical), drift: S(ld.drift), floor: S(ld.floor) };
    const bad = Object.entries(steps).find(([, v]) => !v || textProblem(v, ctx));
    if (bad) notes.push(`ladder dropped: ${bad[0]} ${bad[1] ? textProblem(bad[1], ctx) : 'empty'}`);
    else ladder = steps;
  }
  if (problems.length) return { card: null, problems, notes };
  return { card: { card: oracle.card, line, spans, confirm, pattern, ladder }, problems, notes };
}

export interface PersonalizerV3Deps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  /** the agent and technique the run is logged under (default `self.personalizer`, `self.v3.cards`) */
  agentId?: string;
  technique?: string;
}

export interface PersonalizerV3Result {
  cards: Partial<Record<SelfCardId, PersonalCardV3>>;
  withheld: SelfCardId[];
  issues: ValidationIssue[];
  calls: SelfV2AgentTiming[];
  model: string;
  promptHash: string;
}

export interface PersonalizerV3Call {
  call: string;
  cards: OracleCardV3[];
  system: string;
  model: string;
  prefix: string;
  suffix: string;
  cacheOwner: { userId: string; kundliId: string };
}

/** one call over the given Oracle cards; `extra` (a repair note) goes after the person */
export function personalizerV3Call(
  ctx: SelfBuildContext,
  call: string,
  cards: OracleCardV3[],
  spans: ReadonlyMap<string, { from: string; to: string }>,
  input: PersonalizerV3Input,
  system: string,
  model: string,
  extra = '',
): PersonalizerV3Call {
  const suffix = personalizerV3Suffix(ctx.asOf, cards, spans, input);
  // the voice leads the stable prefix: the same bytes for every call of the same voice, then the Oracle cards of this call
  const prefix = [personalizerVoicePrefix(input.profile.gender), renderOracleCards(cards)].filter(Boolean).join('\n\n');
  return { call, cards, system, model, prefix, suffix: extra ? `${suffix}\n\n${extra}` : suffix, cacheOwner: { userId: ctx.userId, kundliId: ctx.kundliId } };
}

export function personalizerV3Calls(
  ctx: SelfBuildContext,
  groups: ReadonlyArray<{ call: string; cards: readonly SelfCardId[] }>,
  oracle: OracleV3Output,
  spans: ReadonlyMap<string, { from: string; to: string }>,
  input: PersonalizerV3Input,
  system: string,
  model: string,
): PersonalizerV3Call[] {
  return groups.flatMap((g) => {
    const cards = g.cards.map((id) => oracle.cards[id]).filter((c): c is OracleCardV3 => Boolean(c));
    if (!cards.length) return [];
    return [personalizerV3Call(ctx, g.call.replace('oracle', 'personalizer'), cards, spans, input, system, model)];
  });
}

/** the repair note: the cards the validator dropped and exactly why (at most four reasons each) */
export function personalizerRepairNote(reasons: Readonly<Partial<Record<SelfCardId, readonly string[]>>>): string {
  return [
    'REPAIR: these cards failed the checks. Write them again and fix exactly this; keep everything else the same:',
    ...Object.entries(reasons).map(([id, r]) => `- ${id}: ${(r ?? []).slice(0, 4).join('; ')}`),
  ].join('\n');
}

/**
 * Runs the calls in parallel and validates each card; then, when `repair` is given, re-asks the dropped cards once in
 * one call with the reasons (replay 2026-11-09: 7 of 11 cards dropped on one word each). Never throws.
 */
export async function runPersonalizerV3(
  deps: PersonalizerV3Deps,
  ctx: SelfBuildContext,
  calls: readonly PersonalizerV3Call[],
  input: PersonalizerV3Input,
  dates: Iterable<string>,
  repair?: (cards: OracleCardV3[], note: string) => PersonalizerV3Call,
): Promise<PersonalizerV3Result> {
  const model = calls[0]?.model ?? '';
  const pHash = promptHash(SELF_V3_PERSONALIZER_PROMPT);
  const timings: SelfV2AgentTiming[] = [];
  const issues: ValidationIssue[] = [];
  const out: PersonalizerV3Result['cards'] = {};
  const withheld: SelfCardId[] = [];
  const check: TextCheckContext = { gender: input.profile.gender, dates: v3DateFrame(dates), roleWords: roleWordsFor(input.profile.facts), stageWords: seniorStageWordsFor(input.profile) };
  const dropped: Partial<Record<SelfCardId, string[]>> = {};
  const runOne = async (c: PersonalizerV3Call) => {
      const t0 = performance.now();
      const ids = c.cards.map((x) => x.card);
      let list: unknown[] | null = null;
      try {
        const res = await withAgentRun(
          deps.prisma,
          deps.agentId ?? 'self.personalizer',
          { userId: ctx.userId, kundliId: ctx.kundliId, technique: deps.technique ?? 'self.v3.cards', task: `self.v3.personalizer ${c.call} ${ctx.asOf}`, input: { cards: ids.length }, charts: [{ type: 'technique_output', variant: 'self.v3.oracle' }] },
          async () => {
            const g = await deps.callGemini({
              model: c.model,
              node: `self.personalizer.v3.${c.call}`,
              system: c.system,
              parts: [c.prefix, c.suffix],
              thinking: 'low',
              timeoutMs: PERSONALIZER_V3_TIMEOUT_MS,
              cachePrefix: true,
              cacheOwner: c.cacheOwner,
              responseSchema: personalizerV3Schema(ids),
            });
            return { value: g, usage: { model: c.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 }, output: { chars: g.text.length } };
          },
        );
        markAgentUsed({ cacheOwner: c.cacheOwner }, deps.informUsed);
        const parsed = res.finishReason === 'MAX_TOKENS' ? null : (parseJson(res.text) as { cards?: unknown } | null);
        list = parsed && Array.isArray(parsed.cards) ? (parsed.cards as unknown[]) : null;
        timings.push(timingOf('self.personalizer', c.call, c.model, res, performance.now() - t0, list ? 'ok' : 'failed'));
        if (!list) issues.push({ stage: 'personalizer', area: null, check: res.finishReason === 'MAX_TOKENS' ? 'truncated' : 'json_schema', message: `${c.call}: no card document`, callId: c.call });
      } catch (e) {
        timings.push(timingOf('self.personalizer', c.call, c.model, null, performance.now() - t0, 'failed'));
        issues.push({ stage: 'personalizer', area: null, check: 'call_failed', message: `${c.call}: ${String((e as Error).message ?? e).slice(0, 160)}`, callId: c.call });
      }
      for (const oc of c.cards) {
        const raw = (list ?? []).find((x) => S((x as { card?: unknown } | null)?.card) === oc.card);
        if (!raw) {
          withheld.push(oc.card);
          if (list) issues.push({ stage: 'personalizer', area: oc.card, check: 'missing_area', message: `${oc.card}: not returned`, callId: c.call });
          continue;
        }
        const r = checkPersonalCard(raw, oc, check, input.sections[oc.card] ?? ['line', 'year', 'stretch', 'confirm']);
        for (const n of r.notes) issues.push({ stage: 'personalizer', area: oc.card, check: 'other', message: `${oc.card}: ${n}`.slice(0, 300), callId: c.call });
        if (r.card) out[oc.card] = r.card;
        else {
          withheld.push(oc.card);
          dropped[oc.card] = r.problems;
          for (const p of r.problems) issues.push({ stage: 'personalizer', area: oc.card, check: /chart term/.test(p) ? 'chart_term' : /medical/.test(p) ? 'medical' : /role word/.test(p) ? 'role_word' : /date|month|year/.test(p) ? 'date' : /gendered/.test(p) ? 'gendered' : /engine/.test(p) ? 'engine_name' : /words, at most/.test(p) ? 'cap' : 'other', message: `${oc.card}: ${p}`.slice(0, 300), callId: c.call });
        }
      }
  };
  await Promise.all(calls.map(runOne));
  const failed = calls.flatMap((c) => c.cards).filter((oc) => dropped[oc.card]);
  if (repair && failed.length) {
    for (const oc of failed) withheld.splice(withheld.indexOf(oc.card), 1);
    const reasons: Partial<Record<SelfCardId, string[]>> = {};
    for (const oc of failed) reasons[oc.card] = dropped[oc.card]!;
    for (const k of Object.keys(dropped)) delete dropped[k as SelfCardId];
    await runOne(repair(failed, personalizerRepairNote(reasons)));
  }
  return { cards: out, withheld, issues, calls: timings, model, promptHash: pHash };
}
