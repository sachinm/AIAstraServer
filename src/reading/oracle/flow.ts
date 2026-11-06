/**
 * The oracle flow (docs/reading-engine/39): readers on the stored tables → journal in memory → brief → Oracle → validator →
 * at most one round back through the readers for a missing part. The journal writes to its table after this returns, once the
 * caller has saved the run (services/askChatTurn.ts). LangGraph holds state, the parallel fan-out and the conditional loop;
 * model calls go through our REST wrapper.
 *
 *   START ─Send─▶ reader × N ─▶ oracle ─▶ validate ─┬─▶ END
 *                                                   └─▶ loop (up to 2 readers + an addendum) ─▶ END
 *
 * No reader can hold the answer past the join deadline, and no model call is made without a reservation from the cost guard.
 * The answer is already on screen when the validator runs, so the loop adds to it and never replaces it.
 */
import { Annotation, END, Send, START, StateGraph } from '@langchain/langgraph';
import { streamGemini } from '../llm/gemini.js';
import { modelFor } from '../llm/models.js';
import type { CacheOwner } from '../llm/promptCache.js';
import { isTimeoutError } from '../llm/gemini.js';
import type { Agreement, Window } from '../nodes/reconcile.js';
import type { EvidencePack } from '../packs/selector.js';
import { PROMPTS } from '../prompts/generated.js';
import type { Intent, ReadingEmitter, Usage } from '../types.js';
import { buildBrief, groundReader, type GroundedReader, type OracleBrief } from './brief.js';
import type { ChartRowSource } from './chartBundle.js';
import { CostGuard, CostRefusedError } from './costGuard.js';
import { ReadingJournal } from './journal.js';
import { prepareReaders, startReaderCache } from './prepare.js';
import { getReaderMemo, setReaderMemo, type PrewarmedSet } from './prewarm.js';
import { joinDeadlineMs, LOOP_READERS, READERS, readerTimeoutMs, type ReaderId } from './readers.js';
import { buildReaderRequest, ReaderFailure, runReader, type ReaderRequest, type ReaderResult } from './runReader.js';
import { approxTokens } from './slices.js';
import { validateAnswer, type MissingPart, type Validation } from './validator.js';
import { readingValidatorModel } from '../config.js';
import { PROMPT_VERSION } from '../prompts/generated.js';
import { currentTrace } from '../metrics/trace.js';
import { toReaderOutput, type CodeFinding } from '../codeReaders/readers.js';
import type { CodeReaderId } from './brief.js';

/** A failed required reader retries only if it failed fast and this much of the join is left. */
const RETRY_MIN_LEFT_MS = 3_500;
const RETRY_FAILED_WITHIN_MS = 2_000;
/** Below this, a reader would be cut off: it is skipped rather than started. */
const MIN_START_MS = 800;
const LOOP_READER_MS = 3_000;
const LOOP_READER_TOKENS = 800;
const ADDENDUM_MS = 6_000;
const ADDENDUM_TOKENS = 500;
/** Past this the question has waited long enough: no loop. */
const LOOP_LATEST_MS = 45_000;

/** Time and token budget of the Oracle per tier. The word target controls the time; the token limit only stops a runaway answer. */
export function oracleBudget(tier: number, prewarmed: boolean): { maxOutputTokens: number; timeoutMs: number; wordTarget: number | null } {
  if (tier === 1) return { maxOutputTokens: 5_000, timeoutMs: 60_000, wordTarget: 2_500 };
  // answer length is what brings a direct question inside 10 s (doc 39 §5); after prewarm the template's own cap is allowed
  return { maxOutputTokens: 1_800, timeoutMs: 25_000, wordTarget: prewarmed ? null : 280 };
}

const ENGINE_NAMES = /\b(?:AIAstra_Radha|pyjhora|jhora)\b/gi;
/** The internal engine names never reach the person. `Radha` alone goes too, unless the person used the name themselves. */
export function scrubEngineNames(text: string, question: string): string {
  const out = text.replace(ENGINE_NAMES, 'the calculation engine');
  return /\bRadha\b/.test(question) ? out : out.replace(/\bRadha\b/g, 'the calculation engine');
}

export interface OracleFlowDeps {
  rows: ChartRowSource;
  kundliId: string;
  userId: string;
  runId: string;
  intent: Intent;
  question: string;
  asOf: string;
  /** persona + method: same bytes for everyone */
  system: string;
  pack: EvidencePack;
  /** the answer shape, safety lines and the question */
  tail: string;
  calendar?: string;
  thinking: 'off' | 'low' | 'medium' | 'high';
  includeThoughts: boolean;
  emit: ReadingEmitter;
  onDelta?: (delta: string) => void;
  onThought?: (delta: string) => void;
  cacheOwner: CacheOwner;
  transitAt?: unknown;
  prashna?: unknown;
  prewarmed?: PrewarmedSet;
  guard?: CostGuard;
  /** the readers the selected techniques allow (src/techniques/use.ts); absent = every reader of the tier */
  allowedReaders?: readonly ReaderId[] | null;
  /** the deterministic readers' findings on the digest (codeReaders/readers.ts): code, no model, already run */
  codeFindings?: CodeFinding[];
  /** the technique ids of the query once the tier's readers are known, for the trace (doc 53 §4.3) */
  techniqueIds?: (readers: ReaderId[], tier: number) => string[] | null;
  /** Test seams */
  readerImpl?: typeof runReader;
  now?: () => number;
  joinMs?: number;
}

export interface OracleFlowResult {
  answer: string;
  finishReason: string | null;
  ttftMs: number | null;
  stoppedForLoop: boolean;
  usage: Usage[];
  errors: Array<{ node: string; message: string; reason?: string }>;
  findings: unknown;
  windows: Window[];
  agreement: Agreement[];
  droppedClaims: number;
  timings: Record<string, number>;
  journal: ReadingJournal;
  guard: CostGuard;
  validation: Validation | null;
  tier: number;
  readers: ReaderId[];
  brief: OracleBrief | null;
  thoughts: string;
}

type Failure = { id: ReaderId; required: boolean; reason: string };

const State = Annotation.Root({
  results: Annotation<ReaderResult[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  failures: Annotation<Failure[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  usage: Annotation<Usage[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  timings: Annotation<Record<string, number>>({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
  brief: Annotation<OracleBrief | null>({ reducer: (_a, b) => b, default: () => null }),
  answer: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  finishReason: Annotation<string | null>({ reducer: (_a, b) => b, default: () => null }),
  ttftMs: Annotation<number | null>({ reducer: (_a, b) => b, default: () => null }),
  stoppedForLoop: Annotation<boolean>({ reducer: (_a, b) => b, default: () => false }),
  validation: Annotation<Validation | null>({ reducer: (_a, b) => b, default: () => null }),
});

const digestOf = (r: ReaderResult['finding']) => ({ verdict: r.verdict, layerScore: r.layerScore, how: r.digest, gaps: r.gaps, disagree: r.disagree, caveats: r.caveats });
const highlightsOf = (r: ReaderResult['finding']) => ({ claims: r.claims, windows: r.windows, quotes: r.quotes, actors: r.actors, graces: r.graces, pointers: r.pointers, form: r.form, culprits: r.culprits, contributors: r.contributors, sensitive: r.sensitive });

export async function runOracleFlow(d: OracleFlowDeps): Promise<OracleFlowResult> {
  const now = d.now ?? Date.now;
  const started = now();
  const guard = d.guard ?? new CostGuard({ on: d.asOf });
  if (d.prewarmed?.spentUsd) guard.record({ node: 'prewarm', stage: 'fanout', model: modelFor('reader'), usd: d.prewarmed.spentUsd });
  const model = modelFor('reader');
  const oracleModel = modelFor('oracle');
  const impl = d.readerImpl ?? runReader;
  const errors: OracleFlowResult['errors'] = [];
  let thoughts = '';

  const prep = await prepareReaders({ rows: d.rows, kundliId: d.kundliId, intent: d.intent, question: d.question, asOf: d.asOf, pack: d.pack, model, transitAt: d.transitAt, prashna: d.prashna, allowedReaders: d.allowedReaders ?? null });
  // the tier (readers.ts tierFor, or the plan-B route's own) and the route are chosen in prepareReaders
  const tier = prep.plan.tier;
  let techniques: string[] | null | undefined;
  try {
    techniques = d.techniqueIds?.(prep.plan.ids, tier);
  } catch {
    techniques = undefined;
  }
  currentTrace()?.label({ tier, route: prep.route?.route ?? null, ...(techniques !== undefined ? { techniques } : {}) });
  const journal = new ReadingJournal({ runId: d.runId, userId: d.userId, question: d.question, tier: prep.plan.tier, promptVersion: PROMPT_VERSION, asOf: d.asOf });
  // the deterministic readers ran in code before the flow: they join the brief like a reader, and the journal and the
  // trace show them (no model, no cost)
  const codeReaders = (d.codeFindings ?? []).map((f) => ({ id: `code:${f.analyst}` as CodeReaderId, subject: f.subject, finding: toReaderOutput(f) }));
  const codeSections: Record<string, unknown> = d.pack.sections.digest !== undefined ? { digest: d.pack.sections.digest } : {};
  for (const r of codeReaders) {
    // a span for the Day review only: the client is not sent a stage it has no label for
    currentTrace()?.observe({ type: 'stage', name: r.id, status: 'done', ms: 0, subject: r.subject });
    journal.record({ agent: r.id, agentKind: 'reader', round: 1, subject: r.subject, model: null, promptName: null, dataKeys: Object.keys(codeSections), digest: digestOf(r.finding), highlights: highlightsOf(r.finding), status: 'ok', source: 'live', usage: null, ms: 0 });
  }
  const bundleMs = prep.bundleMs;
  void startReaderCache(prep, model, d.cacheOwner, guard);

  const fanIds = [...prep.requests.keys()];
  const joinAt = started + (d.joinMs ?? joinDeadlineMs(prep.plan.tier, fanIds, model));
  const prewarmHits = fanIds.filter((id) => d.prewarmed?.entries.has(prep.requests.get(id)!.cacheKey)).length;
  // every reader already answered, here or on another instance: the Oracle starts at once and keeps its full length
  const allHeld = fanIds.length > 0 && fanIds.every((id) => d.prewarmed?.entries.has(prep.requests.get(id)!.cacheKey) || getReaderMemo(prep.requests.get(id)!.cacheKey));

  /** One attempt, stopped at its budget and at the join. */
  const attempt = async (req: ReaderRequest): Promise<ReaderResult> => {
    const left = joinAt - now();
    if (left < MIN_START_MS) throw new ReaderFailure(`${req.id}: no time left before the join`, 'timeout', null);
    const budget = Math.min(readerTimeoutMs(req.def, model), left);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(new Error(`${req.id} exceeded ${budget} ms`)), budget);
    try {
      return await Promise.race([
        impl(req, { model, guard, cacheOwner: d.cacheOwner, signal: ctl.signal, timeoutMs: budget, tier }),
        new Promise<never>((_, rej) => ctl.signal.addEventListener('abort', () => rej(new ReaderFailure(`${req.id} exceeded ${budget} ms`, 'timeout', null)), { once: true })),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  const journalOk = (req: ReaderRequest, r: Pick<ReaderResult, 'finding' | 'usage'>, ms: number, source: 'live' | 'prewarm' | 'cache', round: number): void => {
    journal.record({ agent: req.id, agentKind: 'reader', round, subject: req.subject, model, promptName: req.def.promptKey, promptSent: req.promptSent, dataKeys: req.dataKeys, dataHash: req.dataHash, digest: digestOf(r.finding), highlights: highlightsOf(r.finding), status: source === 'live' ? 'ok' : 'cached', source, usage: source === 'cache' ? null : r.usage, ms });
  };
  const journalFail = (req: ReaderRequest, reason: string, usage: Usage | null, ms: number, round: number, required: boolean): void => {
    journal.record({ agent: req.id, agentKind: 'reader', round, subject: req.subject, model, promptName: req.def.promptKey, promptSent: req.promptSent, dataKeys: req.dataKeys, dataHash: req.dataHash, status: required ? 'failed' : 'skipped', failureReason: reason, source: 'live', usage, ms });
  };

  const makeBrief = (results: ReaderResult[], failures: Failure[], sections: Record<string, Record<string, unknown>>): { brief: OracleBrief; grounded: GroundedReader[] } => {
    const grounded = [...results.map((r) => groundReader(r.id, r.subject, r.finding, sections[r.id] ?? {})), ...codeReaders.map((r) => groundReader(r.id, r.subject, r.finding, codeSections))];
    const allSections = Object.assign({}, d.pack.sections, ...Object.values(sections));
    const brief = buildBrief({ readers: grounded, failed: failures, missingTypes: prep.missingTypes, pack: { ...d.pack, sections: allSections }, intent: d.intent, question: d.question, asOf: d.asOf, tier: prep.plan.tier, ...(prep.route ? { note: prep.route.note } : {}) });
    return { brief, grounded };
  };
  const sectionsById = (): Record<string, Record<string, unknown>> => Object.fromEntries([...prep.requests.entries()].map(([id, r]) => [id, r.sections]));
  const scrub = (delta: string): string => scrubEngineNames(delta, d.question);
  let lastGrounded: GroundedReader[] = [];

  const graph = new StateGraph(State)
    .addNode('reader', async (input: { id: ReaderId }) => {
      const req = prep.requests.get(input.id)!;
      const required = prep.plan.required.has(input.id);
      const t0 = now();
      d.emit({ type: 'stage', name: input.id, status: 'start', subject: req.subject, label: req.def.label });
      // already read during clarify, on any instance, or earlier on this one
      const pre = d.prewarmed?.entries.get(req.cacheKey);
      const memo = pre ? undefined : getReaderMemo(req.cacheKey);
      const held = pre ?? memo;
      if (held) {
        d.emit({ type: 'stage', name: input.id, status: 'done', ms: now() - t0, subject: req.subject, cached: true });
        journalOk(req, held, now() - t0, pre ? 'prewarm' : 'cache', 1);
        return { results: [{ id: input.id, subject: req.subject, finding: held.finding, usage: held.usage, repaired: false }], timings: { [input.id]: now() - t0 } };
      }
      let retried = false;
      const end = (reason: string, usage: Usage | null, message: string) => {
        const ms = now() - t0;
        errors.push({ node: input.id, message: message.slice(0, 200), reason });
        journalFail(req, reason, usage, ms, 1, required);
        d.emit({ type: 'stage', name: input.id, status: required ? 'failed' : 'skipped', ms, subject: req.subject, reason, retried, capped: required });
        console.warn(JSON.stringify({ msg: 'reading reader failed', runId: d.runId, reader: input.id, required, reason, retried, model, ms }));
        return { failures: [{ id: input.id, required, reason }], ...(usage ? { usage: [usage] } : {}), timings: { [input.id]: ms } };
      };
      const asFailure = (err: unknown): ReaderFailure => (err instanceof ReaderFailure ? err : new ReaderFailure((err as Error)?.message ?? String(err), isTimeoutError(err) ? 'timeout' : 'model_error', null));
      const spent: Usage[] = [];
      try {
        let out: ReaderResult;
        const t1 = now();
        try {
          out = await attempt(req);
        } catch (err) {
          const f = asFailure(err);
          if (f.usage) spent.push(f.usage);
          // no timed-out retries: they repeat the same slow work and would hold the join
          const canRetry = required && f.reason !== 'timeout' && f.reason !== 'budget' && now() - t1 < RETRY_FAILED_WITHIN_MS && joinAt - now() >= RETRY_MIN_LEFT_MS;
          if (!canRetry) throw f;
          retried = true;
          d.emit({ type: 'stage', name: input.id, status: 'retrying', ms: now() - t0, subject: req.subject, reason: f.reason, attempt: 2 });
          out = await attempt(req);
        }
        const ms = now() - t0;
        if (!out.repaired) setReaderMemo(req.cacheKey, { finding: out.finding, usage: out.usage });
        journalOk(req, out, ms, 'live', 1);
        d.emit({ type: 'stage', name: input.id, status: 'done', ms, subject: req.subject, ...(retried ? { retried: true } : {}) });
        return { results: [out], usage: [...spent, out.usage], timings: { [input.id]: ms } };
      } catch (err) {
        const f = asFailure(err);
        if (f.usage && !spent.includes(f.usage)) spent.push(f.usage);
        const r = end(f.reason, f.usage, f.message);
        return { ...r, usage: spent };
      }
    })
    .addNode('oracle', async (s: typeof State.State) => {
      const t0 = now();
      d.emit({ type: 'stage', name: 'journal', status: 'done', ms: 0, detail: { held: journal.all().length } });
      let results = s.results;
      const sections = sectionsById();
      let { brief, grounded } = makeBrief(results, s.failures, sections);
      // the remedy reader reads the grounded findings, so it runs here (off by default)
      if (prep.plan.ids.includes('R14')) {
        const findingsText = `FINDINGS:\n${brief.statements.slice(0, 12).map((x) => `- ${x.text}`).join('\n')}`;
        const req = buildReaderRequest({ id: 'R14', subject: prep.subject, slice: prep.slice, intent: d.intent, question: d.question, asOf: d.asOf, model, keyFrame: d.pack.keyFrame, findingsText });
        sections.R14 = req.sections;
        try {
          const out = await impl(req, { model, guard, cacheOwner: d.cacheOwner, timeoutMs: READERS.R14.timeoutMs, tier });
          journalOk(req, out, now() - t0, 'live', 1);
          results = [...results, out];
          ({ brief, grounded } = makeBrief(results, s.failures, sections));
          brief = { ...brief, text: `${brief.text}\nWHAT TO DO:\n${out.finding.claims.map((c) => `- ${c.text}`).join('\n')}` };
        } catch (err) {
          errors.push({ node: 'R14', message: (err as Error).message.slice(0, 200) });
        }
      }
      lastGrounded = grounded;
      const budget = oracleBudget(prep.plan.tier, allHeld);
      const brevity = budget.wordTarget ? `LENGTH: at most ${budget.wordTarget} words, even if the answer shape allows more.` : '';
      const system = `${d.system}\n\n${PROMPTS['oracle/system']}`;
      const parts = [`BRIEF\n${brief.text}`, ...(d.calendar ? [d.calendar] : []), [brevity, d.tail].filter(Boolean).join('\n\n')];
      d.emit({ type: 'stage', name: 'oracle', status: 'start' });
      let reservation;
      try {
        reservation = guard.reserve({ stage: 'oracle', node: 'oracle', model: oracleModel, promptTokens: approxTokens(system) + approxTokens(parts.join('\n')), maxOutputTokens: budget.maxOutputTokens });
      } catch (err) {
        journal.record({ agent: 'oracle', agentKind: 'oracle', round: 1, model: oracleModel, promptName: 'oracle/system', status: 'failed', failureReason: 'budget', source: 'live', ms: now() - t0 });
        throw err;
      }
      try {
        const r = await streamGemini(
          { model: oracleModel, node: 'oracle', system, parts, thinking: d.thinking === 'off' ? 'low' : d.thinking, includeThoughts: d.includeThoughts, maxOutputTokens: reservation.maxOutputTokens, temperature: 0.4, timeoutMs: budget.timeoutMs },
          (delta) => d.onDelta?.(scrub(delta)),
          d.onThought
            ? (delta) => {
                thoughts += delta;
                d.onThought?.(delta);
              }
            : undefined
        );
        guard.settle(reservation, r.usage);
        const ms = now() - t0;
        journal.record({ agent: 'oracle', agentKind: 'oracle', round: 1, model: oracleModel, promptName: 'oracle/system', promptSent: parts[parts.length - 1], dataKeys: ['brief'], digest: { words: scrub(r.text).split(/\s+/).length, finishReason: r.finishReason, layersCounted: brief.statements.length, droppedClaims: brief.droppedClaims, droppedQuotes: brief.droppedQuotes, briefChars: brief.text.length }, highlights: { answer: scrub(r.text) }, status: 'ok', source: 'live', usage: r.usage, ms });
        d.emit({ type: 'stage', name: 'oracle', status: 'done', ms });
        return { answer: scrub(r.text), usage: [r.usage], finishReason: r.finishReason, ttftMs: r.ttftMs, stoppedForLoop: r.stoppedForLoop, brief, timings: { oracle: ms, oracleStart: t0 - started } };
      } catch (err) {
        guard.settleUnknown(reservation);
        journal.record({ agent: 'oracle', agentKind: 'oracle', round: 1, model: oracleModel, promptName: 'oracle/system', status: 'failed', failureReason: isTimeoutError(err) ? 'timeout' : 'model_error', source: 'live', ms: now() - t0 });
        throw err;
      }
    })
    .addNode('validate', async (s: typeof State.State) => {
      d.emit({ type: 'stage', name: 'validate', status: 'start' });
      const v = await validateAnswer({
        answer: s.answer,
        question: d.question,
        intent: d.intent,
        finishReason: s.finishReason,
        stoppedForLoop: s.stoppedForLoop,
        failedRequired: s.failures.filter((f) => f.required).map((f) => f.id),
        model: modelFor('validator'),
        useModel: readingValidatorModel(),
        guard,
      });
      journal.record({ agent: 'validator', agentKind: 'validator', round: 1, model: v.source === 'model' ? modelFor('validator') : null, promptName: 'oracle/validator', digest: { answered: v.answered, source: v.source, flags: v.flags }, highlights: { missing: v.missing }, status: 'ok', source: 'live', usage: v.usage ?? null, ms: v.ms });
      d.emit({ type: 'stage', name: 'validate', status: 'done', ms: v.ms });
      d.emit({ type: 'validation', answered: v.answered, source: v.source, missing: v.missing.map((m) => m.part) });
      return { validation: v, timings: { validate: v.ms }, ...(v.usage ? { usage: [v.usage] } : {}) };
    })
    .addNode('loop', async (s: typeof State.State) => {
      const t0 = now();
      const part = s.validation!.missing[0] as MissingPart;
      const ids = (part.readers.length ? part.readers : (['R08', 'R10'] as ReaderId[])).filter((x) => LOOP_READERS.includes(x)).slice(0, 2);
      d.emit({ type: 'addendum', status: 'start', part: part.part });
      const focus = `${part.part}: ${part.missing}`;
      const settled = await Promise.all(
        ids.map(async (id) => {
          const req = buildReaderRequest({ id, subject: prep.subject, slice: prep.slice, intent: d.intent, question: d.question, asOf: d.asOf, model, keyFrame: d.pack.keyFrame, focus });
          const tr = now();
          try {
            const out = await impl(req, { model, guard, cacheOwner: d.cacheOwner, timeoutMs: LOOP_READER_MS, maxOutputTokens: LOOP_READER_TOKENS, tier });
            journalOk(req, out, now() - tr, 'live', 2);
            return { req, out };
          } catch (err) {
            const f = err instanceof ReaderFailure ? err : null;
            journalFail(req, f?.reason ?? 'model_error', f?.usage ?? null, now() - tr, 2, false);
            return null;
          }
        })
      );
      const usages: Usage[] = [];
      const got = settled.filter((x): x is NonNullable<typeof x> => x !== null);
      for (const g of got) usages.push(g.out.usage);
      const grounded = got.map((g) => groundReader(g.out.id, g.out.subject, g.out.finding, g.req.sections));
      const claims = grounded.flatMap((g) => g.finding.claims.map((c) => c.text));
      if (!claims.length) {
        d.emit({ type: 'addendum', status: 'done', part: part.part });
        return { usage: usages, timings: { loop: now() - t0 } };
      }
      lastGrounded = [...lastGrounded, ...grounded];
      const windows = grounded.flatMap((g) => g.finding.windows.map((w) => `${w.from} to ${w.to}: ${w.label}${w.fruit ? `, ${w.fruit}` : ''}`));
      const system = `${d.system}\n\n${PROMPTS['oracle/addendum']}`;
      const parts = [`THE PART: ${part.part}. WHAT IS MISSING: ${part.missing}`, `NEW FINDINGS:\n${claims.map((c) => `- ${c}`).join('\n')}${windows.length ? `\nDATES:\n${windows.map((w) => `- ${w}`).join('\n')}` : ''}`, `THE ANSWER ALREADY GIVEN:\n${s.answer}`, `QUESTION: ${d.question}`];
      let answer = s.answer;
      try {
        const reservation = guard.reserve({ stage: 'oracle', node: 'addendum', model: oracleModel, promptTokens: approxTokens(system) + approxTokens(parts.join('\n')), maxOutputTokens: ADDENDUM_TOKENS });
        const lead = '\n\n';
        d.onDelta?.(lead);
        const r = await streamGemini({ model: oracleModel, node: 'addendum', system, parts, thinking: 'low', maxOutputTokens: reservation.maxOutputTokens, temperature: 0.4, timeoutMs: ADDENDUM_MS }, (delta) => d.onDelta?.(scrub(delta)));
        guard.settle(reservation, r.usage);
        usages.push(r.usage);
        answer = `${s.answer}${lead}${scrub(r.text)}`;
        journal.record({ agent: 'oracle', agentKind: 'oracle', round: 2, model: oracleModel, promptName: 'oracle/addendum', promptSent: parts[0], highlights: { addendum: scrub(r.text) }, status: 'ok', source: 'live', usage: r.usage, ms: now() - t0 });
      } catch (err) {
        if (!(err instanceof CostRefusedError)) errors.push({ node: 'addendum', message: (err as Error).message.slice(0, 200) });
      }
      d.emit({ type: 'addendum', status: 'done', part: part.part });
      return { answer, usage: usages, timings: { loop: now() - t0 } };
    })
    .addConditionalEdges(START, () => (fanIds.length ? fanIds.map((id) => new Send('reader', { id })) : 'oracle'), ['reader', 'oracle'])
    .addEdge('reader', 'oracle')
    .addEdge('oracle', 'validate')
    .addConditionalEdges(
      'validate',
      (s: typeof State.State) => {
        const v = s.validation;
        if (!v || !v.missing.length || s.stoppedForLoop) return END;
        if (now() - started > LOOP_LATEST_MS) return END;
        // the loop must be able to pay for one reader and the addendum
        if (guard.remaining('fanout') < 0.002 || guard.remaining('oracle') < 0.003) return END;
        return 'loop';
      },
      ['loop', END]
    )
    .addEdge('loop', END)
    .compile();

  let out: typeof State.State;
  try {
    out = await graph.invoke({});
  } catch (err) {
    // no answer to attach the journal to: what happened still gets written
    (err as { journal?: ReadingJournal }).journal = journal;
    throw err;
  }
  return {
    answer: out.answer,
    finishReason: out.finishReason,
    ttftMs: out.ttftMs,
    stoppedForLoop: out.stoppedForLoop,
    usage: out.usage,
    errors,
    findings: lastGrounded.map((g) => ({ reader: g.id, subject: g.subject, verdict: g.finding.verdict, layerScore: g.finding.layerScore, claims: g.finding.claims, windows: g.finding.windows, quotes: g.finding.quotes, gaps: g.finding.gaps })),
    windows: out.brief?.reconciled.windows ?? [],
    agreement: out.brief?.reconciled.agreement ?? [],
    droppedClaims: out.brief?.droppedClaims ?? 0,
    timings: { ...out.timings, bundle: bundleMs, prewarmHits, readersPlanned: fanIds.length },
    journal,
    guard,
    validation: out.validation,
    tier: prep.plan.tier,
    readers: prep.plan.ids,
    brief: out.brief,
    thoughts,
  };
}
