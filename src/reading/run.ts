/**
 * Reading engine entry point. One call per chat question:
 *
 *   intake (rules, ~0 ms; model only when unsure)  ‖  dossier + transit chart prefetch
 *     → evidence pack(s) (no LLM)
 *     → flow=single: ONE streamed call            flow=graph: parallel specialists → reconcile → streamed synthesis
 *
 * Latency and caching design:
 *  - the database/engine reads start before intake and overlap it;
 *  - the intent is emitted to the client the moment intake finishes (first visible progress in milliseconds);
 *  - the model prompt is [system: persona+method — identical for everyone] [user part 1: the user's base chart — identical for
 *    every question they ask] [user part 2: subject/horizon evidence + format + question], so Gemini's implicit prefix cache
 *    hits across questions and across users' system prompts; `cachedTokens` per call shows whether it did;
 *  - in-process caches for dossier, transit chart, DB persona, so a warm Lambda serves a question with zero lookups.
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { readingFlow, readingSynthMaxTokens, readingSynthThinking, readingUseDbPersona } from './config.js';
import { startPrefetch, type ReadingData } from './data/store.js';
import { buildReadingGraph, type NodeError } from './graph.js';
import { streamGemini } from './llm/gemini.js';
import { modelFor, PRICE_TABLE_VERSION, totalCostUsd } from './llm/models.js';
import { runIntake, SELF_HARM_RESPONSE } from './nodes/intake.js';
import { isFastLane } from './nodes/specialists.js';
import type { ReconcileResult } from './nodes/reconcile.js';
import { FRAMES, horizonRange } from './packs/frames.js';
import { buildEvidencePack, hashPack, hashText, mergeSubjectPacks, renderBase, renderSubject, type EvidencePack } from './packs/selector.js';
import { PROMPTS, PROMPT_VERSION } from './prompts/generated.js';
import type { Intent, ReadingEmitter, Usage } from './types.js';

export class ReadingUnavailableError extends Error {
  constructor(public reason: 'dossier_missing' | 'disabled', message?: string) {
    super(message ?? reason);
    this.name = 'ReadingUnavailableError';
  }
}

export interface RunReadingOptions {
  onDelta?: (delta: string) => void;
  onEvent?: ReadingEmitter;
  asOf?: string;
  flow?: 'single' | 'graph';
  history?: string | null;
  /** Test seam: replaces the data prefetch */
  dataLoader?: (asOf: string) => Promise<ReadingData | null>;
  onFactsMissing?: (kundliId: string) => void;
  onStale?: (kundliId: string) => void;
}

export interface ReadingRunRecord {
  runId: string;
  flow: 'single' | 'graph' | 'safety';
  status: 'done' | 'failed';
  question: string;
  intent: Intent;
  intakeSource: string;
  factsVersion: number | null;
  dossierHash: string | null;
  transitSnapshotId: string | null;
  packHashes: Record<string, string>;
  findings: unknown;
  windows: unknown;
  agreement: unknown;
  answer: string;
  models: Record<string, string>;
  usage: Usage[];
  costUsd: number;
  timingsMs: Record<string, number>;
  cache: Record<string, unknown>;
  droppedClaims: number;
  errors: NodeError[];
  promptVersion: string;
}

export interface ReadingResult {
  answerText: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
  record: ReadingRunRecord;
}

let personaCache: { at: number; text: string } | null = null;

async function personaText(prisma: PrismaClient): Promise<string> {
  if (!readingUseDbPersona()) return PROMPTS['persona']!;
  if (personaCache && Date.now() - personaCache.at < 5 * 60_000) return personaCache.text;
  const row = await prisma.systemPrompt.findFirst({ where: { name: 'pvr_oracle', is_active: true }, select: { prompt: true } });
  const text = row?.prompt?.trim() || PROMPTS['persona']!;
  personaCache = { at: Date.now(), text };
  return text;
}

/** Identical bytes for every user and question (cacheable prefix). */
export async function buildSystem(prisma: PrismaClient): Promise<string> {
  return `${await personaText(prisma)}\n\n${PROMPTS['method']}`;
}

function horizonLabel(intent: Intent): string {
  return typeof intent.horizon === 'string' ? intent.horizon : `${intent.horizon.from} to ${intent.horizon.to}`;
}

function keyFactsCard(pack: EvidencePack, intent: Intent): string {
  const s = pack.sections as any;
  const base = s.base;
  const frame = s.frame?.as_of ? s.frame : Object.values(s.frame ?? {})[0] ?? {};
  const lines = [
    `Lagna ${base.lagna}; Moon ${base.moon}; birth ${base.birth?.date} ${base.birth?.time}`,
    `Running: ${frame.running?.md ?? '?'}-${frame.running?.ad ?? '?'}-${frame.running?.pd ?? '?'} (MD to ${frame.running?.md_end ?? '?'}, AD to ${frame.running?.ad_end ?? '?'}, PD to ${frame.running?.pd_end ?? '?'})`,
    `Horizon: ${horizonLabel(intent)}`,
  ];
  for (const h of pack.keyFrame.houses.slice(0, 6)) {
    const hh = base.houses?.[String(h)];
    if (hh) lines.push(`House ${h}: ${hh.sign}, lord ${hh.lord} in house ${hh.lord_h}, occupants ${(hh.occ ?? []).join('/') || 'none'}`);
  }
  return lines.join('\n');
}

function tailFor(intent: Intent, question: string, asOf: string): string {
  const parts = [`TODAY: ${asOf}`, `UNDERSTOOD AS: ${intent.clarifyText}`, PROMPTS[`formats/${intent.format}`]!];
  if (intent.safety === 'medical') parts.push('The question touches health: give the astrological indication only and say plainly that it is not medical advice.');
  if (intent.safety === 'legal') parts.push('The question touches legal matters: give the astrological indication only and say plainly that it is not legal advice.');
  parts.push(`QUESTION: ${question}`);
  return parts.join('\n\n');
}

function summarizeIntent(intent: Intent) {
  return {
    subjects: intent.subjects.map((s) => ({ id: s.id, label: FRAMES[s.id].label })),
    horizon: intent.horizon,
    horizonLabel: horizonLabel(intent),
    questionType: intent.questionType,
    format: intent.format,
    planets: intent.mentionsPlanets,
    confidence: intent.confidence,
    text: intent.clarifyText,
  };
}

export async function runReading(prisma: PrismaClient, userId: string, question: string, opts: RunReadingOptions = {}): Promise<ReadingResult> {
  const tStart = Date.now();
  const emit: ReadingEmitter = opts.onEvent ?? (() => undefined);
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const flowWanted = opts.flow ?? readingFlow();
  const runId = randomUUID();
  const timings: Record<string, number> = {};
  const usages: Usage[] = [];
  const errors: NodeError[] = [];

  // 1. start the data reads now so they overlap intake
  const dataPromise = opts.dataLoader
    ? opts.dataLoader(asOf).catch(() => null)
    : startPrefetch(prisma, userId, { asOf, onFactsMissing: opts.onFactsMissing, onStale: opts.onStale });

  // 2. intake
  emit({ type: 'stage', name: 'intake', status: 'start' });
  const intake = await runIntake(question, asOf, { history: opts.history });
  const intent = intake.intent;
  timings.intake = intake.ms;
  if (intake.usage) usages.push(intake.usage);
  emit({ type: 'stage', name: 'intake', status: 'done', ms: intake.ms });
  emit({ type: 'intent', runId, intent: summarizeIntent(intent), source: intake.source });

  const baseRecord = {
    runId,
    question,
    intent,
    intakeSource: intake.source,
    promptVersion: PROMPT_VERSION,
  };

  if (intent.safety === 'self_harm') {
    opts.onDelta?.(SELF_HARM_RESPONSE);
    const record: ReadingRunRecord = {
      ...baseRecord, flow: 'safety', status: 'done', factsVersion: null, dossierHash: null, transitSnapshotId: null, packHashes: {}, findings: null, windows: null,
      agreement: null, answer: SELF_HARM_RESPONSE, models: {}, usage: usages, costUsd: 0, timingsMs: { ...timings, total: Date.now() - tStart }, cache: {}, droppedClaims: 0, errors,
    };
    return { answerText: SELF_HARM_RESPONSE, requestPayload: { provider: 'gemini', engine: 'reading', flow: 'safety', safety: 'self_harm', run_id: runId }, responsePayload: { provider: 'gemini', streamed: true, content: SELF_HARM_RESPONSE, safety: 'self_harm' }, record };
  }

  // 3. data
  const tData = Date.now();
  const data = await dataPromise;
  timings.dataWait = Date.now() - tData;
  if (!data) throw new ReadingUnavailableError('dossier_missing', 'chart facts are not available yet');

  // 4. evidence packs
  emit({ type: 'stage', name: 'prepare', status: 'start' });
  const tPack = Date.now();
  const subjects = intent.subjects.slice(0, 3);
  const packs: Record<string, EvidencePack> = {};
  for (const s of subjects) {
    packs[s.id] = buildEvidencePack({ dossier: data.dossier, transits: data.transits, subject: s.id, asOf, intent });
  }
  const merged = mergeSubjectPacks(subjects.map((s) => packs[s.id]!));
  timings.pack = Date.now() - tPack;
  emit({ type: 'stage', name: 'prepare', status: 'done', ms: timings.pack, detail: { approxTokens: merged.stats.approxTokens, transits: data.transits ? 'ready' : 'unavailable' } });

  const system = await buildSystem(prisma);
  const synthModel = modelFor('synth');
  const baseText = renderBase(merged);
  const packHashes: Record<string, string> = { merged: hashPack(merged), base: hashText(baseText) };
  for (const s of subjects) packHashes[s.id] = hashPack(packs[s.id]!);

  const flow = flowWanted === 'graph' && !isFastLane(intent) ? 'graph' : 'single';
  const tail = tailFor(intent, question, asOf);
  const thinking = readingSynthThinking();
  const maxOutputTokens = readingSynthMaxTokens();

  let answer = '';
  let finishReason: string | null = null;
  let ttftMs: number | null = null;
  let stoppedForLoop = false;
  let findings: unknown = null;
  let windows: unknown = null;
  let agreement: unknown = null;
  let droppedClaims = 0;

  const streamSingle = async (): Promise<void> => {
    const tSynth = Date.now();
    emit({ type: 'stage', name: 'synthesize', status: 'start' });
    const r = await streamGemini(
      { model: synthModel, node: 'synthesize', system, parts: [baseText, renderSubject(merged, 'single'), tail], thinking, maxOutputTokens, temperature: 0.4, timeoutMs: 120_000 },
      opts.onDelta
    );
    usages.push(r.usage);
    answer = r.text;
    finishReason = r.finishReason;
    ttftMs = r.ttftMs;
    stoppedForLoop = r.stoppedForLoop;
    timings.synthesize = Date.now() - tSynth;
    emit({ type: 'stage', name: 'synthesize', status: 'done', ms: timings.synthesize });
  };

  if (flow === 'single') {
    await streamSingle();
  } else {
    const keyFacts = keyFactsCard(merged, intent);
    const tGraph = Date.now();
    const graph = buildReadingGraph({
      intent, question, asOf, system, packs, keyFacts, emit,
      synthesize: async (brief: string, rec: ReconcileResult, errs: NodeError[]) => {
        const missing = errs.length ? `\n\nMISSING LAYERS (say so in one line): ${errs.map((e) => e.node).join(', ')}` : '';
        const r = await streamGemini(
          { model: synthModel, node: 'synthesize', system, parts: [`SPECIALIST FINDINGS (already tied to chart facts):\n${brief}${missing}`, `${PROMPTS['synth']}\n\n${tail}`], thinking, maxOutputTokens, temperature: 0.4, timeoutMs: 120_000 },
          opts.onDelta
        );
        void rec;
        return { text: r.text, usage: r.usage, ttftMs: r.ttftMs, finishReason: r.finishReason, stoppedForLoop: r.stoppedForLoop };
      },
    });
    const out = await graph.invoke({});
    timings.graph = Date.now() - tGraph;
    Object.assign(timings, out.timings);
    usages.push(...out.usage);
    errors.push(...out.errors);
    answer = out.answer;
    finishReason = out.finishReason;
    ttftMs = out.ttftMs;
    stoppedForLoop = out.stoppedForLoop;
    if (out.reconciled) {
      findings = out.reconciled.findings;
      windows = out.reconciled.windows;
      agreement = out.reconciled.agreement;
      droppedClaims = out.reconciled.droppedClaims;
    }
    if (!out.findings.length) {
      // every analyst failed: still answer, from the pack, in one streamed call
      errors.push({ node: 'graph', message: 'all specialists failed; answered from the evidence pack' });
      if (!answer) await streamSingle();
    }
  }

  timings.total = Date.now() - tStart;
  if (ttftMs !== null) timings.firstTokenFromStart = tStart ? Date.now() - tStart - ((timings.synthesize ?? 0) - ttftMs) : 0;
  const cachedTokens = usages.reduce((n, u) => n + u.cachedTokens, 0);
  const promptTokens = usages.reduce((n, u) => n + u.promptTokens, 0);
  const costUsd = totalCostUsd(usages);

  const models: Record<string, string> = { synth: synthModel };
  if (flow === 'graph') models.specialist = modelFor('specialist');
  if (intake.usage) models.intake = modelFor('intake');

  const record: ReadingRunRecord = {
    ...baseRecord, flow, status: 'done', factsVersion: data.factsVersion, dossierHash: data.dossierHash, transitSnapshotId: data.transitSnapshotId, packHashes, findings, windows, agreement,
    answer, models, usage: usages, costUsd, timingsMs: timings,
    cache: { promptTokens, cachedTokens, cachedShare: promptTokens ? Math.round((cachedTokens / promptTokens) * 100) / 100 : 0, dossier: data.timings.dossierCache, transits: data.timings.transitsCache, priceTable: PRICE_TABLE_VERSION },
    droppedClaims, errors, promptVersion: PROMPT_VERSION,
  };

  // Log hashes and sizes, never the chart (kundli data is PII).
  console.log(JSON.stringify({ msg: 'reading timing', runId, flow, intake: intake.source, ...timings, ttftMs, cachedTokens, promptTokens, costUsd, finishReason, stoppedForLoop, droppedClaims, packTokens: merged.stats.approxTokens, errors: errors.length }));

  const requestPayload: Record<string, unknown> = {
    provider: 'gemini',
    engine: 'reading',
    flow,
    run_id: runId,
    models,
    prompt_version: PROMPT_VERSION,
    as_of: asOf,
    intent,
    pack: { hashes: packHashes, approx_tokens: merged.stats.approxTokens, transits: data.transits ? 'ready' : 'unavailable', missing: merged.missing },
    facts: { version: data.factsVersion, dossier_hash: data.dossierHash, source: data.source },
    question_chars: question.length,
    used_cache: cachedTokens > 0,
  };
  const responsePayload: Record<string, unknown> = {
    provider: 'gemini',
    streamed: true,
    content: answer,
    finish_reason: finishReason,
    loop_stopped: stoppedForLoop,
    usage: usages,
    timings_ms: timings,
    cost_usd: costUsd,
    grounding: { dropped_claims: droppedClaims },
    errors,
  };
  return { answerText: answer || 'No response generated.', requestPayload, responsePayload, record };
}
