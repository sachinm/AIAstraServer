/**
 * LangGraph assembly for the multi-agent flow: prepare-less (packs are built by the caller) fan-out of specialist analysts
 * in parallel with `Send`, then reconcile (no LLM), then the streamed synthesizer. LangGraph provides state, the parallel
 * fan-out and per-node hooks; model calls go through our own REST wrapper.
 *
 *   START → fanOut ──Send──▶ analyst × N (parallel, time budget each: specialistBudget) ──▶ reconcile ──▶ synthesize ──▶ END
 *
 * A failed analyst never fails the run: its error is recorded and the brief says the layer is missing.
 *
 * Doc 28 §5 layers, each read from data fetched for this question (deps.layers) and added to the first subject's pack:
 * - `annual` (optional, horizon within about 12 months): the Tithi Pravesh chart and Tithi Ashtottari year dasha;
 * - `prashna` (optional, prashna-eligible confirmed questions only): the chart cast at the confirmation moment;
 * - the transit specialist of a date-specific question also reads D-1, D-9 and D-10 at the asked date (`transit_at`).
 * Optional layers are time-boxed and never retried; no data means `skipped` with reason `no_data`. Their findings are
 * not cached (they depend on data outside the dossier hash).
 */
import { Annotation, END, Send, START, StateGraph } from '@langchain/langgraph';
import type { Intent, ReadingEmitter, Usage } from './types.js';
import type { EvidencePack } from './packs/selector.js';
import { reconcile, type ReconcileResult } from './nodes/reconcile.js';
import type { CacheOwner } from './llm/promptCache.js';
import {
  analystsFor,
  failureHttpStatus,
  failureReason,
  runSpecialist,
  specialistBudget,
  SpecialistNoDataError,
  SpecialistTimeoutError,
  type Finding,
  type SpecialistAnalyst,
  type SpecialistFailureReason,
} from './nodes/specialists.js';
import type { Dossier } from './facts/types.js';
import type { TransitChart } from './transits/types.js';
import { horizonRange } from './packs/frames.js';
import { modelFor } from './llm/models.js';
import { safeErrorText } from './llm/gemini.js';
import { findingsCache, findingCacheKey } from './nodes/findingsCache.js';
import { annualApplies, OPTIONAL_LAYERS, prashnaApplies, transitAskedAt } from './nodes/specialists.js';
import type { LayerLoaders } from './layers/loaders.js';
import { annualSection, prashnaSection, transitAtSection } from './layers/sections.js';
import type { PackSection } from './packs/selector.js';

export interface NodeError {
  node: string;
  message: string;
  /** specialists only: why the layer is missing */
  reason?: SpecialistFailureReason;
}

export interface GraphDeps {
  intent: Intent;
  question: string;
  asOf: string;
  system: string;
  /** Per-subject packs (specialists read the pack of their own subject) */
  packs: Record<string, EvidencePack>;
  keyFacts: string;
  emit: ReadingEmitter;
  /** Writes the final answer; streams tokens through the caller's onDelta. Receives the reconciled brief. */
  synthesize: (brief: string, rec: ReconcileResult, errors: NodeError[]) => Promise<{ text: string; usage: Usage; ttftMs: number | null; finishReason: string | null; stoppedForLoop: boolean }>;
  /** Test seam: replaces the model call of a specialist */
  specialistImpl?: typeof runSpecialist;
  /** Chart data for the fortune tier and the now/next slots of the brief (reads fields only) */
  dossier?: Dossier | null;
  transits?: TransitChart | null;
  /** Key of the findings cache (same dossier + analyst + subject + period + prompts → same findings) */
  dossierHash?: string | null;
  /** owner of the specialists' explicit prompt cache */
  cacheOwner?: CacheOwner;
  /** the reading run id, for the failure logs (and the prashna cast row) */
  runId?: string;
  /** Data for the doc 28 layers; a layer without a loader is not offered */
  layers?: LayerLoaders;
}

const State = Annotation.Root({
  findings: Annotation<Finding[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  usage: Annotation<Usage[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  errors: Annotation<NodeError[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  /** analysts of the primary subject that failed after their retry (required) */
  failed: Annotation<string[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  timings: Annotation<Record<string, number>>({ reducer: (a, b) => ({ ...a, ...b }), default: () => ({}) }),
  reconciled: Annotation<ReconcileResult | null>({ reducer: (_a, b) => b, default: () => null }),
  answer: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  finishReason: Annotation<string | null>({ reducer: (_a, b) => b, default: () => null }),
  ttftMs: Annotation<number | null>({ reducer: (_a, b) => b, default: () => null }),
  stoppedForLoop: Annotation<boolean>({ reducer: (_a, b) => b, default: () => false }),
});

type WorkerInput = { analyst: SpecialistAnalyst; subject: string };

/** Rejects with a timeout error once `ms` pass; the loader keeps running but its result is ignored. */
async function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<never>((_, rej) => (timer = setTimeout(() => rej(new SpecialistTimeoutError(`${what} data exceeded ${ms} ms`)), ms)))]);
  } finally {
    clearTimeout(timer);
  }
}

/** The optional doc 28 layers this run offers (data loader present and the question qualifies). */
export function optionalLayersFor(deps: Pick<GraphDeps, 'intent' | 'asOf' | 'question' | 'layers'>): Array<(typeof OPTIONAL_LAYERS)[number]> {
  const out: Array<(typeof OPTIONAL_LAYERS)[number]> = [];
  if (deps.layers?.annual && annualApplies(deps.intent, deps.asOf)) out.push('annual');
  if (deps.layers?.prashna && prashnaApplies(deps.intent, deps.question)) out.push('prashna');
  return out;
}

export function buildReadingGraph(deps: GraphDeps) {
  const specialist = deps.specialistImpl ?? runSpecialist;
  // sections added to a subject's pack during this run (the grounding gate in reconcile must see them)
  const added: Record<string, Partial<Record<PackSection, unknown>>> = {};
  const first = deps.intent.subjects[0]?.id;
  const askedAt = transitAskedAt(deps.intent, deps.asOf);
  const once = <T>(f: () => Promise<T>): (() => Promise<T>) => {
    let p: Promise<T> | undefined;
    return () => (p ??= f());
  };
  const hzRange = horizonRange(deps.intent.horizon, deps.asOf);
  const loadAnnual = once(async () => {
    const raw = await deps.layers!.annual!();
    return raw ? annualSection({ ...raw, asOf: deps.asOf, horizon: hzRange, dossier: deps.dossier }) : null;
  });
  const loadPrashna = once(async () => {
    const raw = await deps.layers!.prashna!({ at: deps.intent.prashna!.askedAt, place: deps.intent.questionPlace ?? null, runId: deps.runId ?? null });
    const frameHouses = first ? deps.packs[first]?.keyFrame.houses ?? [] : [];
    return raw ? prashnaSection({ payload: raw.payload, frameHouses, placeSource: raw.placeSource, dossier: deps.dossier }) : null;
  });
  // one Radha call per run, shared by the transit specialists of every subject
  const loadTransitAt = once(async () => {
    const raw = askedAt && deps.layers?.transitAt ? await deps.layers.transitAt(askedAt).catch(() => null) : null;
    return raw ? transitAtSection({ payload: raw, at: askedAt! }) : null;
  });
  const fanOut = (): Send[] => {
    const sends: Send[] = [];
    const analysts = analystsFor(deps.intent);
    for (const s of deps.intent.subjects) {
      for (const a of analysts) {
        // the nakshatra pass is person-centric: one per run, on the first subject
        if (a === 'nakshatra' && s.id !== deps.intent.subjects[0]!.id) continue;
        sends.push(new Send('analyst', { analyst: a, subject: s.id } satisfies WorkerInput));
      }
    }
    const out = sends.slice(0, 10);
    // the year chart and the question chart are person-centric: one each per run, on the first subject
    if (first) for (const a of optionalLayersFor(deps)) out.push(new Send('analyst', { analyst: a, subject: first } satisfies WorkerInput));
    return out;
  };

  const graph = new StateGraph(State)
    .addNode('analyst', async (input: WorkerInput) => {
      const t0 = Date.now();
      const name = input.analyst;
      deps.emit({ type: 'stage', name, status: 'start', subject: input.subject });
      const pack = deps.packs[input.subject];
      // required agents (file 11 §6): promise and dasha always, transit when the period is 3 years or less
      const hz = horizonRange(deps.intent.horizon, deps.asOf);
      const longHorizon = Number(hz.to.slice(0, 4)) - Number(hz.from.slice(0, 4)) > 3;
      const required = name === 'promise' || name === 'dasha' || (name === 'transit' && !longHorizon);
      const optionalLayer = name === 'annual' || name === 'prashna';
      // findings that read data outside the dossier are not cached: the annual and prashna layers, and a dated transit
      const datedTransit = name === 'transit' && !!askedAt && !!deps.layers?.transitAt;
      const key = deps.dossierHash && !optionalLayer && !datedTransit ? findingCacheKey({ dossierHash: deps.dossierHash, analyst: name, subject: input.subject, horizon: deps.intent.horizon, asOf: deps.asOf }) : null;
      const cached = key ? findingsCache.get(key) : undefined;
      if (cached) {
        const ms = Date.now() - t0;
        deps.emit({ type: 'stage', name, status: 'done', ms, subject: input.subject, cached: true });
        return { findings: [{ ...cached, status: 'cached' as const }], timings: { [`${name}:${input.subject}`]: ms } };
      }
      // a failed required agent on the first subject caps the verdict (reconcile reads `failed`)
      const capped = required && input.subject === deps.intent.subjects[0]?.id;
      const model = modelFor('specialist');
      const budget = specialistBudget(model);
      let usePack = pack;
      const call = (signal: AbortSignal) =>
        specialist({ analyst: input.analyst, subject: input.subject as Finding['subject'], pack: usePack!, intent: deps.intent, question: deps.question, system: deps.system, asOf: deps.asOf, cacheOwner: deps.cacheOwner, signal });
      // one attempt inside the time budget; on time-out the model call is aborted, not left running
      const attempt = async () => {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, rej) => {
          timer = setTimeout(() => {
            const e = new SpecialistTimeoutError(`${name} exceeded ${budget.timeoutMs} ms`);
            controller.abort(e);
            rej(e);
          }, budget.timeoutMs);
        });
        try {
          return await Promise.race([call(controller.signal), timeout]);
        } finally {
          clearTimeout(timer);
        }
      };
      // a rejected answer was still billed: keep the usage of every failed attempt so the run's cost is complete
      const spent: Usage[] = [];
      const seen = new Set<unknown>();
      const keepUsage = (err: unknown): void => {
        if (seen.has(err)) return;
        seen.add(err);
        const u = (err as { usage?: Usage } | null)?.usage;
        if (u) spent.push(u);
      };
      // structured, no prompt or model text: what failed, why, on which model, how long and how many tokens
      const logFailure = (err: unknown, n: number, startedAt: number, final: boolean): SpecialistFailureReason => {
        const reason = failureReason(err);
        const u = (err as { usage?: Usage } | null)?.usage;
        console.warn(JSON.stringify({
          msg: 'reading specialist failed', runId: deps.runId ?? null, analyst: name, subject: input.subject, attempt: n, final, required, capped: final && capped,
          reason, model, latencyMs: Date.now() - startedAt, timeoutMs: budget.timeoutMs, maxOutputTokens: budget.maxOutputTokens, thinks: budget.thinks,
          finishReason: (err as { finishReason?: string | null } | null)?.finishReason ?? null, httpStatus: failureHttpStatus(err),
          promptTokens: u?.promptTokens ?? null, cachedTokens: u?.cachedTokens ?? null, outputTokens: u?.outputTokens ?? null, thoughtTokens: u?.thoughtTokens ?? null,
          error: safeErrorText(err),
        }));
        return reason;
      };
      let retried = false;
      try {
        if (!pack) throw new SpecialistNoDataError(`no pack for subject ${input.subject}`);
        // doc 28 layers: read this question's data first, inside the same time budget; nothing to read = no_data
        const attach = (sec: PackSection, value: unknown) => {
          usePack = { ...usePack!, sections: { ...usePack!.sections, [sec]: value } };
          (added[input.subject] ??= {})[sec] = value;
        };
        if (optionalLayer) {
          const section = await within(name === 'annual' ? loadAnnual() : loadPrashna(), budget.timeoutMs, name);
          if (!section) throw new SpecialistNoDataError(`no ${name} data`);
          attach(name, section);
        } else if (datedTransit) {
          const section = await within(loadTransitAt(), budget.timeoutMs, 'transit_at').catch(() => null);
          if (section) attach('transit_at', section);
        }
        let out;
        const t1 = Date.now();
        try {
          out = await attempt();
        } catch (err) {
          keepUsage(err);
          const reason = logFailure(err, 1, t1, !required);
          if (!required) throw err; // optional agents never hold the join
          // required agents retry once; the client shows the retry
          retried = true;
          deps.emit({ type: 'stage', name, status: 'retrying', ms: Date.now() - t0, subject: input.subject, reason, attempt: 2 });
          const t2 = Date.now();
          try {
            out = await attempt();
          } catch (err2) {
            keepUsage(err2);
            logFailure(err2, 2, t2, true);
            throw err2;
          }
        }
        const ms = Date.now() - t0;
        // a cut-off (repaired) finding is used for this reading but not cached for the next one
        if (key && !out.repaired) findingsCache.set(key, out.finding);
        deps.emit({ type: 'stage', name, status: 'done', ms, subject: input.subject, ...(retried ? { retried: true } : {}), ...(optionalLayer ? { retried: false, capped: false } : {}) });
        return { findings: [out.finding], usage: [...spent, out.usage], timings: { [`${name}:${input.subject}`]: ms } };
      } catch (err) {
        keepUsage(err);
        const ms = Date.now() - t0;
        const reason = failureReason(err);
        if (reason === 'no_data') logFailure(err, 1, t0, true);
        deps.emit({ type: 'stage', name, status: required ? 'failed' : 'skipped', ms, subject: input.subject, reason, retried, capped });
        return {
          errors: [{ node: `${name}:${input.subject}`, message: safeErrorText(err, 300), reason }],
          ...(capped ? { failed: [name] } : {}),
          usage: spent,
          timings: { [`${name}:${input.subject}`]: ms },
        };
      }
    })
    .addNode('reconcile', async (s: typeof State.State) => {
      const t0 = Date.now();
      deps.emit({ type: 'stage', name: 'reconcile', status: 'start' });
      const packs = Object.fromEntries(Object.entries(deps.packs).map(([k, p]) => [k, added[k] ? { ...p, sections: { ...p.sections, ...added[k] } } : p]));
      const rec = reconcile({ findings: s.findings, packs, intent: deps.intent, asOf: deps.asOf, keyFacts: deps.keyFacts, question: deps.question, dossier: deps.dossier, transits: deps.transits, failed: s.failed });
      const ms = Date.now() - t0;
      deps.emit({ type: 'stage', name: 'reconcile', status: 'done', ms });
      if (rec.windows.length) deps.emit({ type: 'windows', windows: rec.windows.slice(0, 10).map((w) => ({ from: w.from, to: w.to, polarity: w.polarity, label: w.label })) });
      return { reconciled: rec, timings: { reconcile: ms } };
    })
    .addNode('synthesize', async (s: typeof State.State) => {
      const t0 = Date.now();
      deps.emit({ type: 'stage', name: 'synthesize', status: 'start' });
      const rec = s.reconciled!;
      const out = await deps.synthesize(rec.brief, rec, s.errors);
      const ms = Date.now() - t0;
      deps.emit({ type: 'stage', name: 'synthesize', status: 'done', ms });
      return { answer: out.text, usage: [out.usage], timings: { synthesize: ms }, finishReason: out.finishReason, ttftMs: out.ttftMs, stoppedForLoop: out.stoppedForLoop };
    })
    .addConditionalEdges(START, fanOut, ['analyst'])
    .addEdge('analyst', 'reconcile')
    .addEdge('reconcile', 'synthesize')
    .addEdge('synthesize', END)
    .compile();
  return graph;
}

export type ReadingGraphState = typeof State.State;
