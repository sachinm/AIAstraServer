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
import { analystsFor, runSpecialist, type Finding, type SpecialistAnalyst } from './nodes/specialists.js';

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
}

const State = Annotation.Root({
  findings: Annotation<Finding[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  usage: Annotation<Usage[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
  errors: Annotation<NodeError[]>({ reducer: (a, b) => a.concat(b), default: () => [] }),
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
      try {
        if (!pack) throw new Error(`no pack for subject ${input.subject}`);
        const { finding, usage } = await specialist({
          analyst: input.analyst,
          subject: input.subject as Finding['subject'],
          pack,
          intent: deps.intent,
          question: deps.question,
          system: deps.system,
          asOf: deps.asOf,
        });
        const ms = Date.now() - t0;
        deps.emit({ type: 'stage', name, status: 'done', ms, subject: input.subject });
        return { findings: [finding], usage: [usage], timings: { [`${name}:${input.subject}`]: ms } };
      } catch (err) {
        const ms = Date.now() - t0;
        deps.emit({ type: 'stage', name, status: 'failed', ms, subject: input.subject });
        return { errors: [{ node: `${name}:${input.subject}`, message: (err as Error).message.slice(0, 300) }], timings: { [`${name}:${input.subject}`]: ms } };
      }
    })
    .addNode('reconcile', async (s: typeof State.State) => {
      const t0 = Date.now();
      deps.emit({ type: 'stage', name: 'reconcile', status: 'start' });
      const rec = reconcile({ findings: s.findings, packs: deps.packs, intent: deps.intent, asOf: deps.asOf, keyFacts: deps.keyFacts });
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
