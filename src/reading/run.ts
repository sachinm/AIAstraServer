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
 *  - in-process caches for dossier, transit chart, DB persona, so a warm Lambda serves a question with zero lookups;
 *  - with READING_EXPLICIT_CACHE=1 and READING_CACHE_LAYOUT=full, one explicit cache per user, model and day holds the
 *    system, every role's instructions and the user's whole evidence (packs/fullPrefix.ts); every reader and the writer
 *    send only their role id, frame, question and per-question data. Creation is kicked off here (and at clarify start)
 *    and never awaited; until it is live, calls go out in the base layout.
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { currentLocationLine, PrismaUserLocationStore } from '../services/userLocation.js';
import { buildCalendar, calendarBlock } from './calendar/calendar.js';
import { readingCalendar, readingFindingsV2, readingFlow, readingIncludeThoughts, readingSynthMaxTokens, readingSynthThinking, readingUseDbPersona } from './config.js';
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
import { loadAgentPrompts } from './prompts/registry.js';
import type { Intent, ReadingEmitter, Usage } from './types.js';
import { guidanceFor } from './coach/content.js';
import { prismaLayerLoaders, type LayerLoaders } from './layers/loaders.js';
import { answerShapeRef, fullCacheLayoutActive, fullContextFor, singleSuffix, writerSuffix, type FullContext } from './packs/fullPrefix.js';
import { ensurePromptCache } from './llm/promptCache.js';
import { prismaChartRows } from './oracle/chartBundle.js';
import { runOracleFlow } from './oracle/flow.js';
import { prismaJournalWriter, type ReadingJournal } from './oracle/journal.js';
import { loadPrewarmed } from './oracle/prewarm.js';
import { inferRealWant } from './clarify/realWant.js';
import { runClarifyMonitor } from './clarify/monitor.js';
import type { ClarifyState } from './clarify/machine.js';
import { prashnaApplies, transitAskedAt } from './nodes/specialists.js';
import { prashnaSection, transitAtSection } from './layers/sections.js';
import { currentTrace, failureLabel, withRunTrace } from './metrics/trace.js';
import { slotsOf, techniquesForQuestion, type TechniqueUse, type TechniqueUseOptions } from '../techniques/use.js';
import { confirmedFacts, DECLINED } from '../profile/facts.js';
import { loadDigest } from './digest/load.js';
import { activationFor, type ActivationRow } from './digest/activation.js';
import type { DigestView } from './digest/types.js';
import { personIn } from './oracle/readers.js';
import { runCodeReaders, runCodeReadersCached, toFinding, type CodeFinding } from './codeReaders/readers.js';

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
  flow?: 'single' | 'graph' | 'oracle';
  history?: string | null;
  /** Test seam: replaces the data prefetch */
  dataLoader?: (asOf: string) => Promise<ReadingData | null>;
  onFactsMissing?: (kundliId: string) => void;
  onStale?: (kundliId: string) => void;
  /** Confirmed intent from the clarifier: intake is skipped */
  intent?: Intent;
  /** The clarify run this reading came from, so the metrics can join them */
  clarifyRunId?: string;
  /** Where the question is asked (client location, rounded), kept on the intent for the prashna */
  questionPlace?: { lat: number; lon: number; tz: number };
  /** Data for the doc 28 layers (annual, prashna, transit at an asked date); default Radha through Prisma, none with a dataLoader */
  layers?: LayerLoaders;
  /** Test seam for the oracle flow: replaces the stored-table read */
  chartRows?: import('./oracle/chartBundle.js').ChartRowSource;
  /** Test seam: the person's confirmed facts (person_facts); default read through Prisma, none with a dataLoader */
  facts?: Record<string, string>;
  /** Test seam: the kundli's digest (null = not ready); default loadDigest through Prisma, none with a dataLoader */
  digest?: DigestView | null;
  /** Test seam: activation calendar rows for the reading's horizon; default activationFor through Prisma when digest is ready */
  activation?: readonly ActivationRow[] | null;
}

/** The dated layers wait at most this long: past it the reading goes on without them. */
const ORACLE_LAYER_WAIT_MS = 1_500;
const withinLayer = <T>(p: Promise<T | null> | undefined): Promise<T | null> => (p ? Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ORACLE_LAYER_WAIT_MS))]) : Promise.resolve(null));

/** Longest thinking text stored per run. */
export const MAX_STORED_THINKING_CHARS = 60_000;

export interface ReadingRunRecord {
  runId: string;
  flow: 'single' | 'graph' | 'oracle' | 'safety';
  /** Oracle flow: every agent's response, held in memory until the turn is saved */
  journal?: ReadingJournal;
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
  /** Gemini's thought summaries for the answer call, kept next to the answer to study the reasoning. Null when none. */
  thinking: string | null;
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
  await loadAgentPrompts(prisma);
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
  const fmtAspects = (a: any): string => {
    const g: string[] = Array.isArray(a?.graha) ? a.graha : [];
    const r: string[] = Array.isArray(a?.rasi) ? a.rasi : [];
    return g.length || r.length ? `${g.length + r.length} aspects (graha: ${g.join('/') || 'none'}; rasi: ${r.join('/') || 'none'})` : 'no aspects';
  };
  const planetLines = new Set<string>();
  for (const h of pack.keyFrame.houses.slice(0, 6)) {
    const hh = base.houses?.[String(h)];
    if (!hh) continue;
    lines.push(`House ${h}: ${hh.sign}, lord ${hh.lord} in house ${hh.lord_h}, occupants ${(hh.occ ?? []).join('/') || 'none'}; aspected by ${fmtAspects(hh.aspected_by)}`);
    for (const code of [hh.lord, ...(hh.occ ?? [])]) if (typeof code === 'string') planetLines.add(code);
  }
  // Depth for the writer (docs/reading-engine/24): for each frame lord and occupant, its strength, its dispositor,
  // its benefic/malefic nature and the aspects on it, so culprits and contributors can be named from facts.
  for (const code of planetLines) {
    const b = base.bodies?.[code];
    if (!b) continue;
    const parts = [`${code}: ${b.sign ?? '?'} house ${b.h ?? '?'}`];
    if (b.dig) parts.push(`dignity ${b.dig}`);
    if (b.nature) parts.push(`nature ${b.nature}`);
    if (b.sign_lord) parts.push(`dispositor ${b.sign_lord}`);
    if (b.star_lord) parts.push(`star lord ${b.star_lord}`);
    if (b.shadbala) parts.push(`shadbala ${b.shadbala.rupas} rupas (ratio ${b.shadbala.ratio}, rank ${b.shadbala.rank})`);
    if (b.conj?.length) parts.push(`conjunct ${b.conj.join('/')}`);
    if (b.retro) parts.push('retrograde');
    if (b.combust) parts.push('combust');
    parts.push(`aspected by ${fmtAspects(b.aspected_by)}`);
    lines.push(parts.join(', '));
  }
  return lines.join('\n');
}

/** The person_facts keys the FACTS line never carries: the wizard's own bookkeeping, and the place (the location line says it). */
const FACTS_NOT_SENT = /^(wizard\.|place\.)/;

/**
 * The FACTS line of the tail (docs/reading-engine/53 §4.4, 48): what the person has confirmed about themselves, so the
 * answer speaks to their situation and asks none of it again. Labels and values only (`work.status: between_jobs`);
 * null when there is nothing to say.
 */
export function factsLine(facts: Record<string, string> | null | undefined): string | null {
  const rows = Object.entries(facts ?? {})
    .filter(([k, v]) => !FACTS_NOT_SENT.test(k) && v && v !== DECLINED)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}: ${v}`);
  return rows.length ? `FACTS (what the person has told us; speak to this situation and do not ask it again): ${rows.join('; ')}` : null;
}

/** `shapeByRef`: the full cache layout holds every template, so the tail only names the one to use. */
export function tailFor(intent: Intent, question: string, asOf: string, shapeByRef = false, facts?: Record<string, string> | null): string {
  // the bucket classifier picks one of the ten templates (docs/reading-engine/09); the older format prompts remain the fallback
  const template = intent.classification?.template;
  const shape = shapeByRef
    ? answerShapeRef(intent)
    : template && PROMPTS[`templates/${template}`] ? `${PROMPTS['templates/_rules']}\n\n${PROMPTS[`templates/${template}`]}` : PROMPTS[`formats/${intent.format}`]!;
  const parts = [`TODAY: ${asOf}`, `UNDERSTOOD AS: ${intent.clarifyText}`, shape];
  if (intent.safety === 'medical') parts.push('The question touches health: give the astrological indication only and say plainly that it is not medical advice.');
  if (intent.safety === 'legal') parts.push('The question touches legal matters: give the astrological indication only and say plainly that it is not legal advice.');
  // where the person lives now: the writer may say dates are for this place; nothing astrological changes
  const location = currentLocationLine(intent.currentLocation);
  if (location) parts.push(location);
  const known = factsLine(facts);
  if (known) parts.push(known);
  parts.push(`QUESTION: ${question}`);
  return parts.join('\n\n');
}

/**
 * The catalogue techniques this question uses (docs/reading-engine/53 §4.3; 54 §5 techniquesForQuestion), for the trace:
 * the confirmed intent, its slots and the companion memory matched against the selectors, narrowed to what the flow
 * runs. Labels only; a failure means no label, never a failed reading.
 */
export function selectedTechniques(intent: Intent, facts: Record<string, string>, o: TechniqueUseOptions): string[] | null {
  try {
    return techniquesForQuestion(intent, facts, o).ids;
  } catch {
    return null;
  }
}

/** How long a question waits for the digest: past it the dossier path answers (doc 53 §4.7: digest reads time out at 2 s). */
const DIGEST_WAIT_MS = 1_500;

/** The ready digest of a kundli, or null when it is not ready, fails or takes longer than `ms`. Never throws. */
async function digestWithin(prisma: PrismaClient, kundliId: string, ms: number): Promise<DigestView | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([loadDigest(prisma, kundliId).catch(() => null), new Promise<null>((r) => (timer = setTimeout(() => r(null), ms)))]);
  } finally {
    clearTimeout(timer);
  }
}

/** Activation calendar rows overlapping [from, to) within `ms`, or null on failure/timeout. Never throws. */
async function activationWithin(prisma: PrismaClient, kundliId: string, hz: { from: string; to: string }, ms: number): Promise<ActivationRow[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([activationFor(prisma, kundliId, { from: hz.from, to: hz.to }).catch(() => null), new Promise<null>((r) => (timer = setTimeout(() => r(null), ms)))]);
  } finally {
    clearTimeout(timer);
  }
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
    // bucket-first classification: lets the UI draw the template frame before the first token (file 09 §6)
    ...(intent.classification
      ? {
          bucket: intent.classification.bucket,
          subBucket: intent.classification.subBucket,
          template: intent.classification.template,
          missing: intent.classification.missing,
          ...(guidanceFor(intent.classification.bucket, intent.classification.unanswerable) ? { guidance: guidanceFor(intent.classification.bucket, intent.classification.unanswerable)!.text } : {}),
        }
      : {}),
  };
}

export function runReading(prisma: PrismaClient, userId: string, question: string, opts: RunReadingOptions = {}): Promise<ReadingResult> {
  const runId = randomUUID();
  return withRunTrace(
    prisma,
    { runId, userId, kind: 'reading', flow: opts.flow ?? readingFlow(), question, clarifyRunId: opts.clarifyRunId ?? null },
    (trace) =>
      answerQuestion(prisma, userId, question, runId, {
        ...opts,
        onEvent: (event) => {
          trace.observe(event);
          opts.onEvent?.(event);
        },
      }),
    (r) => ({ status: r.record.status, flow: r.record.flow, ttftMs: r.record.timingsMs.firstTokenFromStart ?? null }),
    (err) => (err instanceof ReadingUnavailableError ? { status: 'unavailable', error: err.reason } : { status: 'failed', error: failureLabel(err) })
  );
}

async function answerQuestion(prisma: PrismaClient, userId: string, question: string, runId: string, opts: RunReadingOptions): Promise<ReadingResult> {
  const tStart = Date.now();
  const emit: ReadingEmitter = opts.onEvent ?? (() => undefined);
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);
  const flowWanted = opts.flow ?? readingFlow();
  const timings: Record<string, number> = {};
  const usages: Usage[] = [];
  const errors: NodeError[] = [];

  // 1. start the data reads now so they overlap intake
  const dataPromise = opts.dataLoader
    ? opts.dataLoader(asOf).catch(() => null)
    : startPrefetch(prisma, userId, { asOf, onFactsMissing: opts.onFactsMissing, onStale: opts.onStale });
  // where the person lives now (M13 table), read alongside intake; a missing table or a slow read just means none
  const locationPromise = opts.dataLoader || opts.intent?.currentLocation ? Promise.resolve(null) : new PrismaUserLocationStore(prisma).get(userId).catch(() => null);
  // the companion memory (person_facts, doc 48): read alongside intake; it selects techniques and rides in the tail as FACTS
  const factsPromise: Promise<Record<string, string>> = opts.facts ? Promise.resolve(opts.facts) : opts.dataLoader ? Promise.resolve({}) : confirmedFacts(prisma, userId).catch(() => ({}));

  // 2. intake
  emit({ type: 'stage', name: 'intake', status: 'start' });
  const intake = opts.intent ? { intent: opts.intent, usage: null, source: 'confirmed' as const, ms: 0 } : await runIntake(question, asOf, { history: opts.history });
  const intent = intake.intent;
  const loc = await locationPromise;
  if (!intent.currentLocation && loc?.status === 'found') intent.currentLocation = loc.location;
  if (opts.questionPlace && !intent.questionPlace) intent.questionPlace = opts.questionPlace;
  timings.intake = intake.ms;
  if (intake.usage) usages.push(intake.usage);
  emit({ type: 'stage', name: 'intake', status: 'done', ms: intake.ms });
  // technique labels for the metrics (docs/admin/01 §4.1.6); `subjects` is narrowed below to what actually fans out, and
  // `techniques` is written once the flow and the digest are known
  currentTrace()?.label({ bucket: intent.classification?.bucket ?? null, template: intent.classification?.template ?? null, subjects: intent.subjects.length });
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
      agreement: null, answer: SELF_HARM_RESPONSE, thinking: null, models: {}, usage: usages, costUsd: 0, timingsMs: { ...timings, total: Date.now() - tStart }, cache: {}, droppedClaims: 0, errors,
    };
    return { answerText: SELF_HARM_RESPONSE, requestPayload: { provider: 'gemini', engine: 'reading', flow: 'safety', safety: 'self_harm', run_id: runId }, responsePayload: { provider: 'gemini', streamed: true, content: SELF_HARM_RESPONSE, safety: 'self_harm' }, record };
  }

  // 3. data
  const tData = Date.now();
  const data = await dataPromise;
  timings.dataWait = Date.now() - tData;
  if (!data) throw new ReadingUnavailableError('dossier_missing', 'chart facts are not available yet');

  // the oracle flow reads one subject per query: the other parts follow as readings of their own, each with its own budget
  const oracleFlow = flowWanted === 'oracle' && !isFastLane(intent);
  if (oracleFlow && intent.subjects.length > 1) {
    intent.nextSubjects = [...new Set([...(intent.nextSubjects ?? []), ...intent.subjects.slice(1).map((s) => s.id)])];
    intent.subjects = intent.subjects.slice(0, 1);
  }
  if (oracleFlow && !intent.clarified) intent.clarified = { turns: [], assumed: {}, exactQuery: null, realWant: inferRealWant(question, intent.classification?.bucket) };

  // the digest (doc 53 §4.2): read once per question when the kundli's status is ready; otherwise, or past the wait, the
  // dossier path answers as before
  const tDigest = Date.now();
  const digest: DigestView | null =
    opts.digest !== undefined
      ? opts.digest
      : opts.dataLoader
        ? null
        : await digestWithin(prisma, data.kundliId, DIGEST_WAIT_MS);
  const activation: readonly ActivationRow[] | null =
    opts.activation !== undefined
      ? opts.activation
      : !digest || opts.dataLoader
        ? null
        : await activationWithin(prisma, data.kundliId, horizonRange(intent.horizon, asOf), DIGEST_WAIT_MS);
  timings.digest = Date.now() - tDigest;
  const facts = await factsPromise;

  // 4. evidence packs
  emit({ type: 'stage', name: 'prepare', status: 'start' });
  const tPack = Date.now();
  const subjects = intent.subjects.slice(0, 3);
  currentTrace()?.label({ subjects: subjects.length });
  const packs: Record<string, EvidencePack> = {};
  const slotPerson =
    intent.classification?.slots?.subject_person?.value ??
    intent.classification?.slots?.other_person?.value ??
    null;
  const named = personIn(question, slotPerson);
  for (const s of subjects) {
    packs[s.id] = buildEvidencePack({ dossier: data.dossier, transits: data.transits, subject: s.id, asOf, intent, ...(digest ? { digest, person: named, ...(activation ? { activation } : {}) } : {}) });
  }
  const merged = mergeSubjectPacks(subjects.map((s) => packs[s.id]!));
  timings.pack = Date.now() - tPack;
  emit({ type: 'stage', name: 'prepare', status: 'done', ms: timings.pack, detail: { approxTokens: merged.stats.approxTokens, transits: data.transits ? 'ready' : 'unavailable' } });

  const system = await buildSystem(prisma);
  const synthModel = modelFor('synth');
  const baseText = renderBase(merged);
  const packHashes: Record<string, string> = { merged: hashPack(merged), base: hashText(baseText) };
  for (const s of subjects) packHashes[s.id] = hashPack(packs[s.id]!);

  const flow: ReadingRunRecord['flow'] = oracleFlow ? 'oracle' : flowWanted === 'graph' && !isFastLane(intent) ? 'graph' : 'single';
  // techniques in use (doc 54 §5): which analysts, readers and deterministic readers run, from the selectors
  const useOpts: TechniqueUseOptions = { flow, digestReady: !!digest, slots: slotsOf(intent, { otherPerson: !!named }), asOf, question };
  let uses: TechniqueUse | null = null;
  try {
    uses = techniquesForQuestion(intent, facts, useOpts);
  } catch {
    uses = null;
  }
  currentTrace()?.label({ techniques: uses?.ids ?? null });
  // the deterministic readers: code over each subject's digest section, no model; their findings join the brief
  const codeFindings: CodeFinding[] = [];
  if (digest && uses && flow !== 'single') {
    const canPersistTechniqueOutputs = Boolean(
      (prisma as unknown as { techniqueOutput?: unknown; $queryRawUnsafe?: unknown })?.techniqueOutput ||
        (prisma as unknown as { $queryRawUnsafe?: unknown })?.$queryRawUnsafe,
    );
    for (const s of subjects) {
      const det = uses.bySubject[s.id]?.deterministic ?? [];
      if (canPersistTechniqueOutputs) {
        const cached = await runCodeReadersCached(prisma, packs[s.id]!, det, {
          kundliId: data.kundliId,
          digestVersion: String(digest.version),
          userId,
          facts,
          slotPerson,
        });
        codeFindings.push(...cached);
      } else {
        codeFindings.push(...runCodeReaders(packs[s.id]!, det, { kundliId: data.kundliId, facts, slotPerson }));
      }
    }
    for (const f of codeFindings) if (flow === 'graph') currentTrace()?.observe({ type: 'stage', name: `code:${f.analyst}`, status: 'done', ms: 0, subject: f.subject });
  }
  const tail = tailFor(intent, question, asOf, false, facts);
  // dated edges inside the horizon, read from the pack (no computation); READING_CALENDAR=0 turns it off
  const calendar = readingCalendar() ? calendarBlock(buildCalendar(merged, intent, asOf, { lunations: data.transits?.lunations })) : '';
  const v2 = readingFindingsV2();
  // v2 (doc 25 §2.5f): short templates (T1, T9, T10) need little thinking; an explicit READING_SYNTH_THINKING wins
  const shortTemplate = ['T1', 'T9', 'T10'].includes(intent.classification?.template ?? '');
  const thinking = v2 && shortTemplate && !process.env.READING_SYNTH_THINKING?.trim() ? 'low' : readingSynthThinking();
  // thought summaries: kept on the run record (reading_runs.thinking) only. They mention chart details, so they are
  // not streamed to the browser (docs/privacy/02 B0.2) and never written to the application logs.
  const showThoughts = readingIncludeThoughts();
  let thinkingText = '';
  const onThought = showThoughts
    ? (delta: string) => {
        if (thinkingText.length < MAX_STORED_THINKING_CHARS) thinkingText = (thinkingText + delta).slice(0, MAX_STORED_THINKING_CHARS);
      }
    : undefined;
  const maxOutputTokens = readingSynthMaxTokens();
  const cacheOwner = { userId, kundliId: data.kundliId };
  // full cache layout: build (or reuse) the day's prefix and start its caches now, without waiting; calls made before a
  // cache is live go out in the base layout
  const full: FullContext | undefined = !oracleFlow && fullCacheLayoutActive()
    ? fullContextFor(data, asOf, system, digest)
    : undefined;
  if (full) {
    const models = new Set([synthModel, ...(flow === 'graph' ? [modelFor('specialist')] : [])]);
    for (const m of models) void ensurePromptCache(m, full.system, full.prefix, cacheOwner).catch(() => null);
  }
  const shapeTail = full ? tailFor(intent, question, asOf, true, facts) : tail;

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
    timings.synthStart = tSynth - tStart;
    emit({ type: 'stage', name: 'synthesize', status: 'start' });
    const fullCache = full ? { system: full.system, prefix: full.prefix, suffix: [singleSuffix({ packs: subjects.map((s) => packs[s.id]!), full, calendar, tail: shapeTail })] } : undefined;
    const r = await streamGemini(
      { model: synthModel, node: 'synthesize', system, parts: [baseText, renderSubject(merged, 'single'), ...(calendar ? [calendar] : []), tail], cachePrefix: !full, ...(fullCache ? { fullCache } : {}), cacheOwner, thinking, includeThoughts: showThoughts, maxOutputTokens, temperature: 0.4, timeoutMs: 120_000 },
      opts.onDelta,
      onThought
    );
    usages.push(r.usage);
    answer = r.text;
    finishReason = r.finishReason;
    ttftMs = r.ttftMs;
    stoppedForLoop = r.stoppedForLoop;
    timings.synthesize = Date.now() - tSynth;
    emit({ type: 'stage', name: 'synthesize', status: 'done', ms: timings.synthesize });
  };

  let journal: ReadingJournal | undefined;
  let oracleCost: ReturnType<import('./oracle/costGuard.js').CostGuard['summary']> | undefined;
  let oracleExtras: Record<string, unknown> = {};
  if (flow === 'oracle') {
    const layers = opts.layers ?? (opts.dataLoader ? undefined : prismaLayerLoaders(prisma, { userId, kundliId: data.kundliId }));
    const askedAt = transitAskedAt(intent, asOf);
    const [rawAt, rawPrashna] = await Promise.all([
      withinLayer(askedAt && layers?.transitAt ? layers.transitAt(askedAt) : undefined),
      withinLayer(layers?.prashna && prashnaApplies(intent, question) ? layers.prashna({ at: intent.prashna!.askedAt, place: intent.questionPlace ?? null, runId }) : undefined),
    ]);
    const first = subjects[0]!.id;
    const prewarmed = await loadPrewarmed(prisma, userId, intent.clarified?.runId);
    const flowStart = Date.now() - tStart;
    try {
      const out = await runOracleFlow({
        rows: opts.chartRows ?? prismaChartRows(prisma),
        kundliId: data.kundliId,
        userId,
        runId,
        intent,
        question,
        asOf,
        system,
        pack: packs[first]!,
        tail,
        calendar,
        thinking: 'low',
        includeThoughts: showThoughts,
        emit,
        ...(opts.onDelta ? { onDelta: opts.onDelta } : {}),
        ...(onThought ? { onThought } : {}),
        cacheOwner,
        ...(rawAt && askedAt ? { transitAt: transitAtSection({ payload: rawAt, at: askedAt }) } : {}),
        ...(rawPrashna ? { prashna: prashnaSection({ payload: (rawPrashna as { payload: unknown }).payload, frameHouses: packs[first]!.keyFrame.houses, placeSource: (rawPrashna as { placeSource: 'current' | 'birth' }).placeSource, dossier: data.dossier }) } : {}),
        ...(prewarmed ? { prewarmed } : {}),
        ...(uses ? { allowedReaders: uses.readers } : {}),
        ...(codeFindings.length ? { codeFindings: codeFindings.filter((f) => f.subject === first) } : {}),
        ...(Object.keys(facts).length ? { facts } : {}),
        ...(digest ? { digest, ...(activation ? { activation } : {}) } : {}),
        prisma,
        techniqueIds: (readers, tier) => selectedTechniques(intent, facts, { ...useOpts, tier, readers }),
      });
      answer = out.answer;
      finishReason = out.finishReason;
      ttftMs = out.ttftMs;
      stoppedForLoop = out.stoppedForLoop;
      usages.push(...out.usage);
      errors.push(...(out.errors as NodeError[]));
      findings = out.findings;
      windows = out.windows;
      agreement = out.agreement;
      droppedClaims = out.droppedClaims;
      journal = out.journal;
      oracleCost = out.guard.summary();
      oracleExtras = { tier: out.tier, readers: out.readers, validation: out.validation ? { answered: out.validation.answered, source: out.validation.source, missing: out.validation.missing.map((m) => m.part), flags: out.validation.flags } : null };
      Object.assign(timings, out.timings);
      timings.synthStart = flowStart + (out.timings.oracleStart ?? 0);
      if (out.thoughts) thinkingText = out.thoughts.slice(0, MAX_STORED_THINKING_CHARS);
    } catch (err) {
      // the answer failed, and nothing will save the turn: what the agents did is still written
      const held = (err as { journal?: ReadingJournal }).journal;
      if (held) await held.flush(prismaJournalWriter(prisma));
      throw err;
    }
  } else if (flow === 'single') {
    await streamSingle();
  } else {
    const keyFacts = keyFactsCard(merged, intent);
    const tGraph = Date.now();
    const graph = buildReadingGraph({
      intent, question, asOf, system, packs, keyFacts, emit,
      dossier: data.dossier, transits: data.transits, dossierHash: data.dossierHash, cacheOwner, runId, prisma, ...(full ? { full } : {}),
      ...(Object.keys(facts).length ? { facts } : {}),
      ...(uses ? { analystsBySubject: Object.fromEntries(subjects.map((s) => [s.id, uses!.bySubject[s.id]?.analysts ?? []])) } : {}),
      ...(codeFindings.length ? { codeFindings: codeFindings.map(toFinding) } : {}),
      layers: opts.layers ?? (opts.dataLoader ? undefined : prismaLayerLoaders(prisma, { userId, kundliId: data.kundliId })),
      synthesize: async (brief: string, rec: ReconcileResult, errs: NodeError[]) => {
        const missing = errs.length ? `\n\nMISSING LAYERS (say so in one line): ${errs.map((e) => e.node).join(', ')}` : '';
        timings.synthStart = Date.now() - tStart;
        const findingsText = `SPECIALIST FINDINGS (already tied to chart facts):\n${brief}${missing}`;
        // full layout: the writer prompt and templates are in the cache; the call sends findings, calendar and tail only
        const fullCache = full ? { system: full.system, prefix: full.prefix, suffix: [writerSuffix({ findings: findingsText, calendar, tail: shapeTail })] } : undefined;
        const r = await streamGemini(
          { model: synthModel, node: 'synthesize', system, parts: [`${findingsText}${calendar ? `\n\n${calendar}` : ''}`, `${PROMPTS[v2 ? 'v2/synth' : 'synth']}\n\n${tail}`], cachePrefix: !full, cacheOwner, ...(fullCache ? { fullCache } : {}), thinking, includeThoughts: showThoughts, maxOutputTokens, temperature: 0.4, timeoutMs: 120_000 },
          opts.onDelta,
          onThought
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

  // The other parts of a multi-part question: the client reads them one after another, each as its own reading.
  const nextParts = (intent.nextSubjects ?? []).filter((id) => FRAMES[id]);
  if (nextParts.length) emit({ type: 'next', parts: nextParts.map((id) => ({ id, label: FRAMES[id].label })) });

  timings.total = Date.now() - tStart;
  if (ttftMs !== null && timings.synthStart !== undefined) timings.firstTokenFromStart = timings.synthStart + ttftMs;
  const cachedTokens = usages.reduce((n, u) => n + u.cachedTokens, 0);
  const promptTokens = usages.reduce((n, u) => n + u.promptTokens, 0);
  // the oracle flow's guard also counts prewarm, cache storage and calls with no usage report
  const costUsd = oracleCost ? oracleCost.usd : totalCostUsd(usages);
  const cachedShare = promptTokens ? Math.round((cachedTokens / promptTokens) * 100) / 100 : 0;
  // per model call: what was sent and how much of it came from a cache (no prompt text)
  const calls = usages.map((u) => ({ node: u.node, model: u.model, promptTokens: u.promptTokens, cachedTokens: u.cachedTokens }));

  const models: Record<string, string> = { synth: synthModel };
  if (flow === 'graph') models.specialist = modelFor('specialist');
  if (flow === 'oracle') Object.assign(models, { synth: modelFor('oracle'), reader: modelFor('reader'), validator: modelFor('validator') });
  if (intake.usage) models.intake = modelFor('intake');

  const record: ReadingRunRecord = {
    ...baseRecord, flow, status: 'done', factsVersion: data.factsVersion, dossierHash: data.dossierHash, transitSnapshotId: data.transitSnapshotId, packHashes, findings, windows, agreement,
    answer, thinking: thinkingText || null, models, usage: usages, costUsd, timingsMs: timings,
    ...(journal ? { journal } : {}),
    cache: {
      ...(oracleCost ? { cost: oracleCost, ...oracleExtras } : {}),
      promptTokens, cachedTokens, cachedShare, layout: full ? 'full' : 'base', ...(full ? { fullPrefixHash: full.hash, fullPrefixApproxTokens: full.approxTokens } : {}),
      dossier: data.timings.dossierCache, transits: data.timings.transitsCache, priceTable: PRICE_TABLE_VERSION,
    },
    droppedClaims, errors, promptVersion: PROMPT_VERSION,
  };

  // Log hashes and sizes, never the chart (kundli data is PII).
  console.log(JSON.stringify({ msg: 'reading timing', runId, flow, intake: intake.source, ...timings, ttftMs, cachedTokens, promptTokens, cachedShare, cacheLayout: full ? 'full' : 'base', calls, costUsd, finishReason, stoppedForLoop, droppedClaims, packTokens: merged.stats.approxTokens, errors: errors.length }));

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
  const clarifyRunId = opts.clarifyRunId ?? intent.clarified?.runId ?? null;
  let clarifyState: ClarifyState | null = null;
  if (clarifyRunId) {
    const rrModel = (prisma as unknown as { readingRun?: { findFirst?: (args: unknown) => Promise<{ intent?: unknown } | null> } }).readingRun;
    const cRow = await rrModel?.findFirst?.({ where: { id: clarifyRunId, user_id: userId }, select: { intent: true } }).catch(() => null);
    clarifyState = ((cRow?.intent as { clarify?: ClarifyState } | null)?.clarify) ?? null;
  }
  const tablesWritten: Array<{ table: string; count: number }> = [
    { table: 'reading_runs', count: 1 },
    { table: 'reading_traces', count: 1 },
    { table: 'reading_agent_spans', count: Math.max(1, usages.length) },
    ...(journal && journal.all().length > 0 ? [{ table: 'reading_agent_responses', count: journal.all().length }] : []),
  ];
  currentTrace()?.label({ tables_written: tablesWritten });
  await runClarifyMonitor(prisma, userId, clarifyState, { ...record, kundliId: data.kundliId }, facts).catch(() => null);
  return { answerText: answer || 'No response generated.', requestPayload, responsePayload, record };
}
