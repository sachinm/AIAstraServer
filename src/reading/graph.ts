/**
 * LangGraph assembly for the multi-agent flow: prepare-less (packs are built by the caller) fan-out of specialist analysts
 * in parallel with `Send`, then reconcile (no LLM), then the streamed synthesizer. LangGraph provides state, the parallel
 * fan-out and per-node hooks; model calls go through our own REST wrapper.
 *
 *   START → fanOut ──Send──▶ analyst × N (parallel, 12 s budget each) ──▶ reconcile ──▶ synthesize ──▶ END
 *
 * A failed analyst never fails the run: its error is recorded and the brief says the layer is missing.
 */
import { Annotation, END, Send, START, StateGraph } from '@langchain/langgraph';
import type { Intent, ReadingEmitter, Usage } from './types.js';
import type { EvidencePack } from './packs/selector.js';
import { reconcile, type ReconcileResult } from './nodes/reconcile.js';
import type { CacheOwner } from './llm/promptCache.js';
import { analystsFor, runSpecialist, type Finding, type SpecialistAnalyst } from './nodes/specialists.js';
import type { Dossier } from './facts/types.js';
import type { TransitChart } from './transits/types.js';
import { horizonRange } from './packs/frames.js';
import { readingSpecialistTimeoutMs } from './config.js';
import { findingsCache, findingCacheKey } from './nodes/findingsCache.js';

export interface NodeError {
  node: string;
  message: string;
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

export function buildReadingGraph(deps: GraphDeps) {
  const specialist = deps.specialistImpl ?? runSpecialist;
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
    return sends.slice(0, 10);
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
      const key = deps.dossierHash ? findingCacheKey({ dossierHash: deps.dossierHash, analyst: name, subject: input.subject, horizon: deps.intent.horizon, asOf: deps.asOf }) : null;
      const cached = key ? findingsCache.get(key) : undefined;
      if (cached) {
        const ms = Date.now() - t0;
        deps.emit({ type: 'stage', name, status: 'done', ms, subject: input.subject, cached: true });
        return { findings: [{ ...cached, status: 'cached' as const }], timings: { [`${name}:${input.subject}`]: ms } };
      }
      const call = () =>
        specialist({ analyst: input.analyst, subject: input.subject as Finding['subject'], pack: pack!, intent: deps.intent, question: deps.question, system: deps.system, asOf: deps.asOf, cacheOwner: deps.cacheOwner });
      const withTimeout = <T>(p: Promise<T>): Promise<T> =>
        Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${name} exceeded ${readingSpecialistTimeoutMs()} ms`)), readingSpecialistTimeoutMs()))]);
      try {
        if (!pack) throw new Error(`no pack for subject ${input.subject}`);
        let out;
        try {
          out = await withTimeout(call());
        } catch (err) {
          if (!required) throw err; // optional agents never hold the join
          out = await withTimeout(call()); // required agents retry once
        }
        const ms = Date.now() - t0;
        if (key) findingsCache.set(key, out.finding);
        deps.emit({ type: 'stage', name, status: 'done', ms, subject: input.subject });
        return { findings: [out.finding], usage: [out.usage], timings: { [`${name}:${input.subject}`]: ms } };
      } catch (err) {
        const ms = Date.now() - t0;
        const isPrimary = input.subject === deps.intent.subjects[0]?.id;
        deps.emit({ type: 'stage', name, status: required ? 'failed' : 'skipped', ms, subject: input.subject });
        return {
          errors: [{ node: `${name}:${input.subject}`, message: (err as Error).message.slice(0, 300) }],
          ...(required && isPrimary ? { failed: [name] } : {}),
          timings: { [`${name}:${input.subject}`]: ms },
        };
      }
    })
    .addNode('reconcile', async (s: typeof State.State) => {
      const t0 = Date.now();
      deps.emit({ type: 'stage', name: 'reconcile', status: 'start' });
      const rec = reconcile({ findings: s.findings, packs: deps.packs, intent: deps.intent, asOf: deps.asOf, keyFacts: deps.keyFacts, question: deps.question, dossier: deps.dossier, transits: deps.transits, failed: s.failed });
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
