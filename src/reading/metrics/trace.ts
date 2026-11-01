/**
 * Timing and cost for every agent of one query (docs/reading-engine/41). Holds no prompt, chart or model text.
 *
 * Agents do not write to the database. They add spans here, and this file writes them in small batches on one queue, so a
 * fan-out of 17 readers takes one connection, not 17, and never waits on a write. The trace row goes in when the query
 * starts, which is what shows a query still in flight. A write failure never reaches the reading.
 *
 * Two kinds of span: `stage` (the agent from start to finish, from the stage events every flow already emits) and
 * `model_call` (one model request, from the Gemini and Bedrock wrappers). The context travels through AsyncLocalStorage, so
 * the flows need no change to be measured.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { readingMetricsEnabled } from '../config.js';
import { priceFor, usageCostUsd } from '../llm/models.js';
import type { ReadingEvent, Usage } from '../types.js';

export type TraceKind = 'reading' | 'clarify' | 'prewarm';
export type AgentKind = 'reader' | 'specialist' | 'oracle' | 'validator' | 'intake' | 'clarify' | 'step';
export type SpanLevel = 'stage' | 'model_call';

/** Spans wait this long so a burst of finishing readers becomes one insert. */
const FLUSH_DELAY_MS = 300;
/** The most a query waits for its metrics at the end. */
const FINISH_WAIT_MS = 2_000;
/** After a failure that will repeat on every write (table not there yet), try again after this long. */
const STORE_RETRY_MS = 5 * 60_000;

const GRAPH_ANALYSTS = new Set(['promise', 'dasha', 'transit', 'nakshatra', 'annual', 'prashna']);

export function agentKindOf(name: string): AgentKind {
  if (/^[RP]\d+$/.test(name)) return 'reader';
  // the graph flow's stage is `dasha`, and its model call `specialist:dasha`
  if (name.startsWith('specialist:') || GRAPH_ANALYSTS.has(name)) return 'specialist';
  if (name === 'oracle' || name === 'synth' || name === 'synthesize' || name === 'addendum') return 'oracle';
  if (name === 'validate' || name === 'validator') return 'validator';
  if (name === 'intake' || name === 'classify') return 'intake';
  if (name.startsWith('clarify')) return 'clarify';
  return 'step';
}

/** Why a call failed, from its type only: an error message can quote the prompt. */
export function failureLabel(err: unknown): string {
  const e = err as { name?: string; status?: number; message?: string } | null;
  if (typeof e?.status === 'number') return `http_${e.status}`;
  if (e?.name === 'AbortError' || e?.name === 'TimeoutError' || /abort|time(d)? ?out/i.test(e?.message ?? '')) return 'timeout';
  return e?.name ?? 'error';
}

export interface SpanRow {
  id: string;
  run_id: string;
  agent: string;
  agent_kind: AgentKind;
  level: SpanLevel;
  model: string | null;
  status: string;
  failure_reason: string | null;
  started_at: Date;
  ended_at: Date;
  ms: number;
  ttft_ms: number | null;
  steps: Record<string, number> | null;
  prompt_tokens: number;
  cached_tokens: number;
  output_tokens: number;
  thought_tokens: number;
  /** null when the model has no price, so an unpriced call never reads as free */
  est_cost_usd: number | null;
}

export interface TraceIdentity {
  runId: string;
  userId: string;
  kind: TraceKind;
  flow?: string | null;
  /** Null for clarify: declined topics are decided inside it and must not keep their text. */
  question?: string | null;
  clarifyRunId?: string | null;
}

export interface FinishSummary {
  status: string;
  flow?: string | null;
  ttftMs?: number | null;
  error?: string | null;
  clarifyRunId?: string | null;
}

export interface TraceStore {
  startRun(row: Prisma.ReadingTraceUncheckedCreateInput): Promise<unknown>;
  addSpans(rows: SpanRow[]): Promise<unknown>;
  finishRun(runId: string, data: Prisma.ReadingTraceUncheckedUpdateManyInput): Promise<unknown>;
}

export function prismaTraceStore(db: Pick<PrismaClient, 'readingTrace' | 'readingAgentSpan'>): TraceStore {
  return {
    startRun: (row) => db.readingTrace.create({ data: row }),
    addSpans: (rows) => db.readingAgentSpan.createMany({ data: rows as unknown as Prisma.ReadingAgentSpanCreateManyInput[] }),
    finishRun: (runId, data) => db.readingTrace.updateMany({ where: { run_id: runId }, data }),
  };
}

let storeOffUntil = 0;
export function resetTraceStoreForTests(): void {
  storeOffUntil = 0;
}

/** The migration is not applied, or the client has no such model: no point trying again on every span. */
function isPermanent(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return err instanceof TypeError || e?.code === 'P2021' || e?.code === '42P01' || /does not exist/i.test(e?.message ?? '');
}

const costOf = (u: Usage, on: string): number | null => (priceFor(u.model, on) ? usageCostUsd(u, on) : null);
const round6 = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;

export class RunTrace {
  private buffer: SpanRow[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private open = new Map<string, { name: string; startedAt: number }>();
  private readonly startedAt: number;
  private readonly on: string;
  private totals = { prompt: 0, cached: 0, output: 0, thought: 0, usd: 0, calls: 0, unpriced: 0 };
  private spawned = new Set<string>();
  private failed = new Set<string>();

  constructor(
    readonly id: TraceIdentity,
    private readonly store: TraceStore,
    private readonly now: () => number = Date.now
  ) {
    this.startedAt = this.now();
    this.on = new Date(this.startedAt).toISOString().slice(0, 10);
    this.enqueue(() =>
      store.startRun({ run_id: id.runId, user_id: id.userId, kind: id.kind, flow: id.flow ?? null, question: id.question ?? null, clarify_run_id: id.clarifyRunId ?? null, status: 'processing', started_at: new Date(this.startedAt) })
    );
  }

  private enqueue(write: () => Promise<unknown>): void {
    this.chain = this.chain.then(async () => {
      if (Date.now() < storeOffUntil) return;
      try {
        await write();
      } catch (err) {
        if (isPermanent(err)) storeOffUntil = Date.now() + STORE_RETRY_MS;
        console.warn(JSON.stringify({ msg: 'reading metrics write failed', runId: this.id.runId, code: (err as { code?: string }).code ?? (err as Error).name }));
      }
    });
  }

  private flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.buffer.length) return;
    const rows = this.buffer;
    this.buffer = [];
    this.enqueue(() => this.store.addSpans(rows));
  }

  private push(row: SpanRow): void {
    this.buffer.push(row);
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), FLUSH_DELAY_MS);
      this.timer.unref?.();
    }
  }

  private noteAgent(name: string, kind: AgentKind): void {
    if (kind === 'reader' || kind === 'specialist') this.spawned.add(name.replace(/^specialist:/, ''));
  }

  /** One model request, ended either way. Called by the model wrappers. */
  addModelCall(a: { agent: string; model: string; startedAt: number; status: 'ok' | 'failed'; failureReason?: string; usage?: Usage; ttftMs?: number | null; steps?: Record<string, number> }): void {
    const end = this.now();
    const kind = agentKindOf(a.agent);
    this.noteAgent(a.agent, kind);
    const u = a.usage;
    const usd = u ? costOf(u, this.on) : null;
    if (u) {
      this.totals.prompt += u.promptTokens;
      this.totals.cached += u.cachedTokens;
      this.totals.output += u.outputTokens;
      this.totals.thought += u.thoughtTokens;
      if (usd === null) this.totals.unpriced += 1;
      else this.totals.usd += usd;
    }
    this.totals.calls += 1;
    this.push({
      id: randomUUID(),
      run_id: this.id.runId,
      agent: a.agent,
      agent_kind: kind,
      level: 'model_call',
      model: a.model,
      status: a.status,
      failure_reason: a.failureReason ?? null,
      started_at: new Date(a.startedAt),
      ended_at: new Date(end),
      ms: end - a.startedAt,
      ttft_ms: a.ttftMs ?? null,
      steps: a.steps ?? null,
      prompt_tokens: u?.promptTokens ?? 0,
      cached_tokens: u?.cachedTokens ?? 0,
      output_tokens: u?.outputTokens ?? 0,
      thought_tokens: u?.thoughtTokens ?? 0,
      est_cost_usd: usd === null ? null : round6(usd),
    });
  }

  private addStage(name: string, startedAt: number, status: string, failureReason: string | null): void {
    const end = this.now();
    const kind = agentKindOf(name);
    this.noteAgent(name, kind);
    if ((kind === 'reader' || kind === 'specialist') && status !== 'ok' && status !== 'cached') this.failed.add(name);
    this.push({ id: randomUUID(), run_id: this.id.runId, agent: name, agent_kind: kind, level: 'stage', model: null, status, failure_reason: failureReason, started_at: new Date(startedAt), ended_at: new Date(end), ms: end - startedAt, ttft_ms: null, steps: null, prompt_tokens: 0, cached_tokens: 0, output_tokens: 0, thought_tokens: 0, est_cost_usd: null });
  }

  /** Reads the stage events every flow already emits. */
  observe(e: ReadingEvent): void {
    if (e.type !== 'stage' || typeof e.name !== 'string') return;
    const key = `${e.name}|${typeof e.subject === 'string' ? e.subject : ''}`;
    const status = e.status as string;
    if (status === 'start') {
      this.open.set(key, { name: e.name, startedAt: this.now() });
      return;
    }
    if (status === 'retrying') return;
    const began = this.open.get(key);
    this.open.delete(key);
    // a stage reported only when done (the journal) has no start: its own `ms`, if any, gives one
    const startedAt = began?.startedAt ?? this.now() - (typeof e.ms === 'number' ? e.ms : 0);
    const finished = status === 'done' ? (e.cached ? 'cached' : 'ok') : status;
    this.addStage(e.name, startedAt, finished, typeof e.reason === 'string' ? e.reason : null);
  }

  /** Writes what is left and closes the trace. Waits at most FINISH_WAIT_MS, and never throws. */
  async finish(s: FinishSummary): Promise<void> {
    for (const o of this.open.values()) this.addStage(o.name, o.startedAt, 'unfinished', null);
    this.open.clear();
    this.flush();
    const end = this.now();
    this.enqueue(() =>
      this.store.finishRun(this.id.runId, {
        status: s.status,
        ...(s.flow !== undefined ? { flow: s.flow } : {}),
        ...(s.clarifyRunId !== undefined ? { clarify_run_id: s.clarifyRunId } : {}),
        ttft_ms: s.ttftMs ?? null,
        error: s.error ?? null,
        ms: end - this.startedAt,
        ended_at: new Date(end),
        agents_spawned: this.spawned.size,
        agents_failed: this.failed.size,
        model_calls: this.totals.calls,
        prompt_tokens: this.totals.prompt,
        cached_tokens: this.totals.cached,
        output_tokens: this.totals.output,
        thought_tokens: this.totals.thought,
        est_cost_usd: round6(this.totals.usd),
        unpriced_calls: this.totals.unpriced,
      })
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([this.chain, new Promise((resolve) => { timer = setTimeout(resolve, FINISH_WAIT_MS); })]);
    clearTimeout(timer);
  }
}

const active = new AsyncLocalStorage<RunTrace>();

export function currentTrace(): RunTrace | undefined {
  return active.getStore();
}

const NO_STORE: TraceStore = { startRun: async () => undefined, addSpans: async () => undefined, finishRun: async () => undefined };

/**
 * Runs `work` under a new trace and closes it however `work` ends. `summary` turns the result into the closing fields, and
 * `onError` the failure; the error itself is always rethrown to the caller.
 */
export async function withRunTrace<T>(
  db: Pick<PrismaClient, 'readingTrace' | 'readingAgentSpan'>,
  id: TraceIdentity,
  work: (trace: RunTrace) => Promise<T>,
  summary: (result: T) => FinishSummary = () => ({ status: 'done' }),
  onError: (err: unknown) => FinishSummary = (err) => ({ status: 'failed', error: failureLabel(err) })
): Promise<T> {
  const trace = new RunTrace(id, readingMetricsEnabled() ? prismaTraceStore(db) : NO_STORE);
  try {
    const result = await active.run(trace, () => work(trace));
    await trace.finish(summary(result));
    return result;
  } catch (err) {
    await trace.finish(onError(err));
    throw err;
  }
}

/** Wraps one model request. With no trace running (a script, a test) it only runs the request. */
export async function traceModelCall<T extends { usage: Usage; ttftMs?: number | null; timing?: Record<string, number> }>(agent: string, model: string, call: () => Promise<T>): Promise<T> {
  const trace = currentTrace();
  if (!trace) return call();
  const startedAt = Date.now();
  try {
    const r = await call();
    trace.addModelCall({ agent, model: r.usage.model, startedAt, status: 'ok', usage: r.usage, ...(r.ttftMs !== undefined ? { ttftMs: r.ttftMs } : {}), ...(r.timing ? { steps: r.timing } : {}) });
    return r;
  } catch (err) {
    trace.addModelCall({ agent, model, startedAt, status: 'failed', failureReason: failureLabel(err) });
    throw err;
  }
}
