/**
 * The lens linemen (docs/techniques/09 §3, §3.1 "Linemen of subject", §8 step 7): one call per lens with cards on the
 * board (`lineman.self`, `lineman.love`, `lineman.work`, revived). Each reads the natal prefix (cached, shared with the
 * clock readers and the cards), the seven family findings, the clock sheets WITH their sentences, the gate's statuses
 * for the lens's matters and the lens recipe, and writes the lens thread: for this lens's subject, promise → period →
 * year → star → trigger, each link keyed and source-tagged. The thread is stored (`technique_outputs`
 * `reading.lens.thread`) and read by every card Oracle of the lens. Nothing a reader wrote is dropped on the way up.
 *
 * Allotment (doc 09 §3.1): the oracle model, thinking medium, ceiling 10,000 (continued, never cut), 90 s. A failed or
 * empty thread never fails a card: the card reads without one. Never throws.
 */
import type { PrismaClient } from '@prisma/client';
import { withAgentRun } from '../../agents/registry.js';
import { getLensLinemanMaxOutputTokens, getLensLinemanTimeoutMs } from '../../config/env.js';
import { withTechniqueOutput } from '../../techniques/outputStore.js';
import { canonicalJson } from '../../techniques/pieces.js';
import { clockSentencesFor, type LensThreadRef } from '../cards/storyInputs.js';
import { GENERIC_RECIPE, keysInText } from '../cards/oracle.js';
import { recipeText, type LensId } from '../cards/routing.js';
import type { AgreedLedger, ClockSheet } from '../clocks/types.js';
import { READER_SYSTEM_PROMPT } from '../clocks/types.js';
import { callWithContinuation, parseContinuedJson } from '../llm/continue.js';
import type { GeminiCallOptions, GeminiResult } from '../llm/gemini.js';
import { markAgentUsed } from '../self/v2/cache.js';
import { timingOf } from '../self/v2/oracle.js';
import { redactEngineText } from '../self/v2/personalizerValidate.js';
import { normaliseEvidenceKey, promptHash, promptText, shortHash } from '../self/v2/slices.js';
import type { SelfV2AgentTiming, ValidationIssue } from '../self/v2types.js';
import type { YearFrameV3 } from '../self/v3/types.js';

export const LENS_THREAD_TECHNIQUE = 'reading.lens.thread';
export const LENS_LINEMAN_PROMPT = 'lens/lineman';
export const THREAD_STEPS = ['promise', 'period', 'year', 'star', 'trigger'] as const;
export type ThreadStep = (typeof THREAD_STEPS)[number];
export const THREAD_SOURCES = ['family', 'clock', 'ledger', 'recipe', 'chart'] as const;

export interface ThreadLink {
  step: ThreadStep;
  text: string;
  keys: string[];
  source: (typeof THREAD_SOURCES)[number];
}

export interface LensThread {
  lens: string;
  links: ThreadLink[];
}

/** the board agent that writes a lens's thread */
export const linemanAgentOf = (lens: string): 'lineman.self' | 'lineman.love' | 'lineman.work' => (lens.startsWith('love.') ? 'lineman.love' : lens.startsWith('work.') ? 'lineman.work' : 'lineman.self');

export function lensThreadSchema(): Record<string, unknown> {
  return {
    type: 'OBJECT',
    properties: {
      links: {
        type: 'ARRAY',
        description: 'the lens thread in order: promise, period, year, star, trigger (one or more links each)',
        items: {
          type: 'OBJECT',
          properties: {
            step: { type: 'STRING', enum: [...THREAD_STEPS] },
            text: { type: 'STRING', description: 'what this link finds for the lens subject, in chart terms, with the rule behind it' },
            keys: { type: 'ARRAY', items: { type: 'STRING' }, description: 'evidence keys from the input, without braces' },
            source: { type: 'STRING', enum: [...THREAD_SOURCES] },
          },
          required: ['step', 'text', 'keys', 'source'],
          propertyOrdering: ['step', 'source', 'keys', 'text'],
        },
      },
    },
    required: ['links'],
  };
}

export interface LensLinemanInput {
  ctx: { userId: string; kundliId: string; asOf: string; digestVersion: string };
  lens: string;
  /** the matters of the lens's cards on this board (the clock sentences and gate statuses it reads) */
  matters: readonly string[];
  /** the cards of the lens on the board (titles), for scope */
  cards: readonly string[];
  prefix: { text: string; dated?: string; keys: readonly string[]; hash: string };
  findings: ReadonlyArray<{ family: string; text: string }>;
  sheets: readonly ClockSheet[];
  ledger: AgreedLedger | null;
  frame: YearFrameV3;
  /** the verified systems block (`systems.ts` renderShownPeriods) and the counted system names */
  systemsText: string;
  systemsKeys: readonly string[];
  verified: readonly string[];
  model: string;
}

export interface LensLinemanDeps {
  prisma: PrismaClient;
  callGemini: (o: GeminiCallOptions) => Promise<GeminiResult>;
  informUsed?: Parameters<typeof markAgentUsed>[1];
  now: Date;
  force?: boolean;
}

export interface LensLinemanResult {
  thread: LensThreadRef | null;
  timings: SelfV2AgentTiming[];
  issues: ValidationIssue[];
  cached: boolean;
}

/** The gate's statuses for the lens's matters, one line per ledger cell (the count is final). */
export function gateLines(ledger: AgreedLedger | null, matters: readonly string[]): string {
  if (!ledger) return '(no ledger)';
  const want = new Set(matters);
  const L = ledger.cells.filter((c) => want.has(c.matter)).map((c) => `{${c.id}} status=${c.status} tone=${c.tone ?? 'none'} agree=${c.agree}/${c.of} clocks=${c.clocks.map((k) => `${k.system}:${k.tone}`).join(',')}`);
  return L.length ? L.join('\n') : '(no cells for these matters)';
}

/** The request's uncached part. Pure. */
export function linemanRequest(i: LensLinemanInput): { text: string; keys: string[] } {
  const findingKeys = i.findings.flatMap((f) => keysInText(f.text));
  const ledgerKeys = (i.ledger?.cells ?? []).filter((c) => i.matters.includes(c.matter)).flatMap((c) => [c.id, ...c.evidence]);
  const sheetKeys = i.sheets.flatMap((s) => s.cells.filter((c) => i.matters.includes(c.matter)).flatMap((c) => c.evidence));
  const recipe = recipeText(i.lens as LensId) ?? GENERIC_RECIPE;
  const text = [
    promptText(LENS_LINEMAN_PROMPT),
    `THE LENS: ${i.lens} (cards on the board: ${i.cards.join('; ') || 'none'}); its matters: ${i.matters.join(', ')}`,
    `LENS RECIPE\n${recipe}`,
    `VERIFIED SYSTEMS (read only these): ${i.verified.join(', ') || 'none'}`,
    ...(i.systemsText ? [i.systemsText] : []),
    `FAMILY FINDINGS\n${i.findings.map((f) => `## ${f.family}\n${f.text}`).join('\n') || '(none stored)'}`,
    `CLOCK SENTENCES (each verified clock's reader, by span and matter)\n${clockSentencesFor(i.sheets, i.matters, new Set(i.verified)) || '(none)'}`,
    `GATE (the counted statuses of these matters; final)\n${gateLines(i.ledger, i.matters)}`,
    'Return the JSON document only.',
  ].join('\n\n');
  return { text, keys: [...new Set([...i.prefix.keys, ...i.systemsKeys, ...findingKeys, ...ledgerKeys, ...sheetKeys].map(normaliseEvidenceKey))] };
}

/** Validates a thread: known steps in order, each link with text and at least one key the input carried. Pure. */
export function checkThread(raw: unknown, allowed: ReadonlySet<string>): { links: ThreadLink[]; dropped: string[] } {
  const o = (raw ?? {}) as { links?: unknown };
  const links: ThreadLink[] = [];
  const dropped: string[] = [];
  for (const l of Array.isArray(o.links) ? (o.links as Array<Record<string, unknown>>) : []) {
    const step = String(l?.step ?? '') as ThreadStep;
    const text = typeof l?.text === 'string' ? redactEngineText(l.text.trim()) : '';
    const keys = (Array.isArray(l?.keys) ? (l.keys as unknown[]) : []).filter((k): k is string => typeof k === 'string').map((k) => normaliseEvidenceKey(k.trim().replace(/^\{|\}$/g, '')));
    const known = keys.filter((k) => allowed.has(k));
    if (!THREAD_STEPS.includes(step) || !text) {
      dropped.push(`link without a step or text (${step || '?'})`);
      continue;
    }
    if (!known.length) {
      dropped.push(`${step}: no key from the input (${keys.slice(0, 3).join(', ') || 'none'})`);
      continue;
    }
    const source = (THREAD_SOURCES as readonly string[]).includes(String(l.source)) ? (l.source as ThreadLink['source']) : 'chart';
    links.push({ step, text, keys: known, source });
  }
  links.sort((a, b) => THREAD_STEPS.indexOf(a.step) - THREAD_STEPS.indexOf(b.step));
  return { links, dropped };
}

/** the thread as the card Oracle reads it: one keyed, tagged line per link, in order */
export function renderThread(t: LensThread): string {
  return t.links.map((l) => `- [${l.step}; ${l.source}] ${l.text} ${l.keys.map((k) => `{${k}}`).join(' ')}`).join('\n');
}

/** One lens's thread: read the stored one for this key, else call, validate, store. Never throws. */
export async function runLensLineman(deps: LensLinemanDeps, i: LensLinemanInput): Promise<LensLinemanResult> {
  const timings: SelfV2AgentTiming[] = [];
  const issues: ValidationIssue[] = [];
  const agent = linemanAgentOf(i.lens);
  const req = linemanRequest(i);
  const allowed = new Set(req.keys);
  const limit = getLensLinemanTimeoutMs();
  const key = `${LENS_THREAD_TECHNIQUE}|lens=${i.lens}|pre=${i.prefix.hash}|in=${shortHash(canonicalJson([req.text]))}|p=${promptHash(READER_SYSTEM_PROMPT)}.${promptHash(LENS_LINEMAN_PROMPT)}|m=${i.model}`;
  const now = i.frame.spans.find((s) => s.place === 'now') ?? i.frame.spans[0];
  const owner = { userId: i.ctx.userId, kundliId: i.ctx.kundliId };
  try {
    const stored = await withTechniqueOutput<LensThread | null>(
      deps.prisma,
      {
        technique: LENS_THREAD_TECHNIQUE,
        kundliId: i.ctx.kundliId,
        digestVersion: key,
        context: { now: deps.now, ...(now ? { runningPeriod: { from: new Date(`${now.from}T00:00:00Z`), to: new Date(`${now.to}T00:00:00Z`) } } : {}) },
        agentId: agent,
        userId: i.ctx.userId,
        charts: [{ type: 'kundli_digest', variant: i.ctx.digestVersion }],
        forceRefresh: Boolean(deps.force),
      },
      async () => {
        const t0 = performance.now();
        try {
          const res = await withAgentRun(
            deps.prisma,
            agent,
            {
              userId: i.ctx.userId,
              kundliId: i.ctx.kundliId,
              technique: LENS_THREAD_TECHNIQUE,
              task: `${agent} ${i.lens} ${i.ctx.asOf}`,
              input: { lens: i.lens, matters: i.matters.length, findings: i.findings.length, sheets: i.sheets.length, keys: allowed.size },
              charts: [{ type: 'kundli_digest', variant: i.ctx.digestVersion }],
            },
            async () => {
              const g = await callWithContinuation(
                deps.callGemini,
                {
                  model: i.model,
                  node: `${agent}.${i.lens}`,
                  system: promptText(READER_SYSTEM_PROMPT),
                  parts: [i.prefix.text, [i.prefix.dated ?? '', req.text].filter(Boolean).join('\n\n')],
                  thinking: 'medium',
                  maxOutputTokens: getLensLinemanMaxOutputTokens(),
                  timeoutMs: limit,
                  cachePrefix: true,
                  cacheOwner: owner,
                  responseSchema: lensThreadSchema(),
                },
                { deadlineMs: limit },
              );
              return { value: g, usage: { model: i.model, promptTokens: g.usage?.promptTokens ?? 0, cachedTokens: g.usage?.cachedTokens ?? 0, outputTokens: g.usage?.outputTokens ?? 0, thoughtTokens: g.usage?.thoughtTokens ?? 0 }, output: { chars: g.text.length, continued: g.continued } };
            },
          );
          markAgentUsed({ cacheOwner: owner }, deps.informUsed);
          const v = checkThread(parseContinuedJson(res.text), allowed);
          for (const d of v.dropped) issues.push({ stage: 'oracle', area: null, check: 'other', message: `${agent} ${i.lens}: ${d}`.slice(0, 300), callId: agent });
          timings.push(timingOf('self.oracle', `${agent}.${i.lens}`, i.model, res, performance.now() - t0, v.links.length ? 'ok' : 'failed'));
          if (!v.links.length) return { value: null, skipStore: true, summary: { lens: i.lens, links: 0 } };
          return { value: { lens: i.lens, links: v.links }, skipStore: false, summary: { lens: i.lens, links: v.links.length, dropped: v.dropped.length } };
        } catch (e) {
          timings.push(timingOf('self.oracle', `${agent}.${i.lens}`, i.model, null, performance.now() - t0, 'failed'));
          issues.push({ stage: 'oracle', area: null, check: 'call_failed', message: `${agent} ${i.lens}: ${String((e as Error).message ?? e).slice(0, 160)}`, callId: agent });
          return { value: null, skipStore: true, summary: { lens: i.lens, links: 0 } };
        }
      },
    );
    const t = stored.value;
    if (!t?.links?.length) return { thread: null, timings, issues, cached: stored.cached };
    const text = renderThread(t);
    return { thread: { lens: t.lens, text, keys: [...new Set(t.links.flatMap((l) => l.keys))], hash: shortHash(text) }, timings, issues, cached: stored.cached };
  } catch (e) {
    issues.push({ stage: 'oracle', area: null, check: 'call_failed', message: `${agent} ${i.lens}: ${String((e as Error).message ?? e).slice(0, 160)}`, callId: null });
    return { thread: null, timings, issues, cached: false };
  }
}
