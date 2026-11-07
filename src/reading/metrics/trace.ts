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
 *
 * Every span carries a registry id (`agent_id`, src/agents/registry.ts), a technique id (src/techniques/catalog.ts) and a
 * category (Self, Love, Work, General) from its subject, so the admin can group them (docs/admin/03 §4.1).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { readingMetricsEnabled } from '../config.js';
import { priceFor, usageCostUsd } from '../llm/models.js';
import type { ReadingEvent, Usage } from '../types.js';
import { categoryOfSubject, type TechniqueCategory } from '../../techniques/categories.js';

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
/** The deterministic readers over the digest (codeReaders/readers.ts CODE_ANALYSTS): spans named `code:<name>`, code steps with their own registry row and technique. */
const CODE_READERS = new Set(['varga_dynamics', 'strength_yoga', 'jaimini', 'person']);
const codeReaderOf = (name: string): string | null => (name.startsWith('code:') && CODE_READERS.has(name.slice(5)) ? name.slice(5) : null);

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

/** The analyst a graph stage or call belongs to (`dasha`, `specialist:dasha` → `dasha`), or null. */
function analystOf(name: string): string | null {
  const bare = name.replace(/^specialist:/, '');
  return GRAPH_ANALYSTS.has(bare) ? bare : null;
}

/**
 * The agent_registry id of a span (docs/admin/03 §4.1): graph analysts `reading.analyst.<name>`, oracle readers
 * `reading.reader`, the oracle, synthesizer and addendum `reading.oracle`, then `reading.validator`, `reading.intake`,
 * `reading.clarify`; every other step `reading.step`.
 */
export function agentIdOf(name: string, kind: AgentKind = agentKindOf(name)): string {
  switch (kind) {
    case 'specialist': {
      const a = analystOf(name);
      return a ? `reading.analyst.${a}` : 'reading.specialist';
    }
    case 'reader':
      return 'reading.reader';
    case 'oracle':
      return 'reading.oracle';
    case 'validator':
      return 'reading.validator';
    case 'intake':
      return 'reading.intake';
    case 'clarify':
      return 'reading.clarify';
    default: {
      const c = codeReaderOf(name);
      return c ? `reading.code.${c}` : 'reading.step';
    }
  }
}

/** The catalogue technique of a span: `general.<analyst>`, `general.reader`, and the General rows of the other roles; null for a step. */
export function techniqueIdOf(name: string, kind: AgentKind = agentKindOf(name)): string | null {
  switch (kind) {
    case 'specialist': {
      const a = analystOf(name);
      return a ? `general.${a}` : null;
    }
    case 'reader':
      return 'general.reader';
    case 'oracle':
      return 'general.oracle';
    case 'validator':
      return 'general.validator';
    case 'intake':
      return 'general.intake';
    case 'clarify':
      return 'general.clarify';
    default: {
      const c = codeReaderOf(name);
      return c ? `general.${c}` : null;
    }
  }
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
  /** the subject a stage or call ran for (graph analysts fan out per subject), from the `name|subject` stage key */
  subject: string | null;
  /** the oracle flow's reader tier (readers.ts tierFor / planB.ts); null elsewhere */
  tier: number | null;
  /** M29: agent_registry id (agentIdOf) */
  agent_id: string;
  /** M29: catalogue technique (techniqueIdOf); null for a plain step */
  technique_id: string | null;
  /** M29: self | love | work | general, from the span's subject or the query's single subject */
  category: TechniqueCategory;
}

/** Technique labels of one query (docs/admin/01 §4.1.6), written with the totals at `finish`. */
export interface TraceLabels {
  /** buckets/taxonomy.ts id, from intent.classification */
  bucket?: string | null;
  /** T1..T10 */
  template?: string | null;
  /** oracle flow tier, 1..5 */
  tier?: number | null;
  /** planB.ts route: pressure | mood | luck | will_it_happen */
  route?: string | null;
  /** how many subjects fanned out */
  subjects?: number | null;
  /** M31: the catalogue technique ids the clarify context selected (src/techniques/contracts.ts techniqueIdsFor) */
  techniques?: string[] | null;
  /** M35 (docs/admin/06): tables written during this query */
  tables_written?: Array<{ table: string; count: number }> | null;
  /** M35 (docs/admin/06): post-reading deterministic Clarify Monitor verdict */
  clarify_monitor?: unknown;
}

/** Optional per-call detail for traceModelCall. */
export interface ModelCallTags {
  subject?: string | null;
  tier?: number | null;
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

/** Columns added by M24 (labels on traces, subject and tier on spans). */
const M24_TRACE_COLUMNS = ['bucket', 'template', 'tier', 'route', 'subjects'] as const;
const M24_SPAN_COLUMNS = ['subject', 'tier'] as const;
/** Columns added by M29 on spans (registry id, technique, category). */
const M29_SPAN_COLUMNS = ['agent_id', 'technique_id', 'category'] as const;
/** Column added by M31 on traces (the techniques a query selected, docs/reading-engine/53 §4.3). */
const M31_TRACE_COLUMNS = ['techniques'] as const;
/** Columns added by M35 on traces (tables_written, clarify_monitor, docs/admin/06). */
const M35_TRACE_COLUMNS = ['tables_written', 'clarify_monitor'] as const;

const isMissingColumn = (err: unknown): boolean => {
  const e = err as { code?: string; meta?: { code?: string } } | null;
  return e?.code === 'P2022' || e?.code === '42703' || e?.meta?.code === '42703';
};

function without<T extends object>(row: T, keys: readonly string[]): T {
  const out = { ...row } as Record<string, unknown>;
  for (const k of keys) delete out[k];
  return out as T;
}

/** Set when a write finds M24's (or M29's, or M31's, or M35's) columns missing: writes leave them out until then, and try them again after. */
let m24MissingUntil = 0;
let m29MissingUntil = 0;
let m31MissingUntil = 0;
let m35MissingUntil = 0;

type Stage = { strip: readonly string[]; mark?: () => void };

export function prismaTraceStore(db: Pick<PrismaClient, 'readingTrace' | 'readingAgentSpan'>): TraceStore {
  /**
   * Writes with every column; when the database lacks the newest ones, drops them stage by stage (spans: M29, then M24;
   * traces: M35, then M31, then M24) and writes the rest, so recording goes on.
   */
  const tolerant = async <R>(stages: Stage[], start: number, write: (strip: readonly string[]) => Promise<R>): Promise<R> => {
    for (let i = start; ; i++) {
      try {
        return await write(stages[i]!.strip);
      } catch (err) {
        if (!isMissingColumn(err) || i + 1 >= stages.length) throw err;
        stages[i + 1]!.mark?.();
      }
    }
  };
  const markM29 = () => {
    m29MissingUntil = Date.now() + STORE_RETRY_MS;
    console.warn(JSON.stringify({ msg: 'reading metrics: tag columns missing (migration M29 not applied); writing without them' }));
  };
  const markM24 = () => {
    m24MissingUntil = Date.now() + STORE_RETRY_MS;
    console.warn(JSON.stringify({ msg: 'reading metrics: label columns missing (migration M24 not applied); writing without them' }));
  };
  const markM31 = () => {
    m31MissingUntil = Date.now() + STORE_RETRY_MS;
    console.warn(JSON.stringify({ msg: 'reading metrics: techniques column missing (migration M31 not applied); writing without it' }));
  };
  const markM35 = () => {
    m35MissingUntil = Date.now() + STORE_RETRY_MS;
    console.warn(JSON.stringify({ msg: 'reading metrics: M35 trace columns missing (migration M35 not applied); writing without them' }));
  };
  const spanStages: Stage[] = [{ strip: [] }, { strip: M29_SPAN_COLUMNS, mark: markM29 }, { strip: [...M29_SPAN_COLUMNS, ...M24_SPAN_COLUMNS], mark: markM24 }];
  const traceStages: Stage[] = [
    { strip: [] },
    { strip: M35_TRACE_COLUMNS, mark: markM35 },
    { strip: [...M35_TRACE_COLUMNS, ...M31_TRACE_COLUMNS], mark: markM31 },
    { strip: [...M35_TRACE_COLUMNS, ...M31_TRACE_COLUMNS, ...M24_TRACE_COLUMNS], mark: markM24 },
  ];
  return {
    startRun: (row) => db.readingTrace.create({ data: row }),
    addSpans: (rows) => {
      const now = Date.now();
      const start = now < m24MissingUntil ? 2 : now < m29MissingUntil ? 1 : 0;
      return tolerant(spanStages, start, (strip) => db.readingAgentSpan.createMany({ data: (strip.length ? rows.map((r) => without(r, strip)) : rows) as unknown as Prisma.ReadingAgentSpanCreateManyInput[] }));
    },
    finishRun: (runId, data) => {
      const now = Date.now();
      const start = now < m24MissingUntil ? 3 : now < m31MissingUntil ? 2 : now < m35MissingUntil ? 1 : 0;
      return tolerant(traceStages, start, (strip) => db.readingTrace.updateMany({ where: { run_id: runId }, data: strip.length ? without(data, strip) : data }));
    },
  };
}

let storeOffUntil = 0;
export function resetTraceStoreForTests(): void {
  storeOffUntil = 0;
  m24MissingUntil = 0;
  m29MissingUntil = 0;
  m31MissingUntil = 0;
  m35MissingUntil = 0;
}

/**
 * The migration is not applied, or the client has no such model: no point trying again on every span. Covers a missing
 * table (P2021 / 42P01) and a missing column (P2022 / 42703). M24's own columns are first retried without them in
 * prismaTraceStore, so only a column that is still missing after that turns the store off.
 */
export function isPermanent(err: unknown): boolean {
  const e = err as { code?: string; message?: string; meta?: { code?: string } } | null;
  const codes = [e?.code ?? '', e?.meta?.code ?? ''];
  return err instanceof TypeError || codes.some((c) => ['P2021', 'P2022', '42P01', '42703'].includes(c)) || /does not exist/i.test(e?.message ?? '');
}

const LABEL_KEYS = ['bucket', 'template', 'tier', 'route', 'subjects', 'techniques', 'tables_written', 'clarify_monitor'] as const;

const costOf = (u: Usage, on: string): number | null => (priceFor(u.model, on) ? usageCostUsd(u, on) : null);
const round6 = (n: number): number => Math.round(n * 1_000_000) / 1_000_000;

function rollupAgentKey(name: string, kind: AgentKind): string {
  if (kind === 'reader') return `reader:${name}`;
  if (kind === 'specialist') return `specialist:${name.replace(/^specialist:/, '')}`;
  return agentIdOf(name, kind);
}

export class RunTrace {
  private buffer: SpanRow[] = [];
  private chain: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private open = new Map<string, { name: string; subject: string | null; startedAt: number }>();
  private readonly startedAt: number;
  private readonly on: string;
  private totals = { prompt: 0, cached: 0, output: 0, thought: 0, usd: 0, calls: 0, unpriced: 0 };
  private spawned = new Set<string>();
  private failed = new Set<string>();
  private labels: TraceLabels = {};
  /** distinct subjects seen on this query's spans: a span without one takes the query's subject when there is only one */
  private subjects = new Set<string>();
  /** Rollup of child model_call tokens/cost/model per (agent_id, subject) so stage spans carry their model and token totals. */
  private stageRollup = new Map<
    string,
    {
      model: string;
      prompt: number;
      cached: number;
      output: number;
      thought: number;
      usd: number;
      hasPrice: boolean;
      ttftMs: number | null;
    }
  >();

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

  /** Adds technique labels; a later value for the same label wins. Written once, with the totals, at `finish`. */
  label(l: TraceLabels): void {
    for (const k of LABEL_KEYS) if (l[k] !== undefined) (this.labels as Record<string, unknown>)[k] = l[k];
  }

  /** A reader's or the Oracle's span carries the query's tier unless the call named its own. */
  private tierFor(kind: AgentKind, explicit: number | null | undefined): number | null {
    if (explicit !== undefined && explicit !== null) return explicit;
    return kind === 'reader' || kind === 'oracle' ? (this.labels.tier ?? null) : null;
  }

  private noteAgent(name: string, kind: AgentKind): void {
    if (kind === 'reader' || kind === 'specialist') this.spawned.add(name.replace(/^specialist:/, ''));
  }

  /** The M29 tags of a span: registry id, technique, and the category of its subject (or the query's single subject). */
  private tags(name: string, kind: AgentKind, subject: string | null): Pick<SpanRow, 'agent_id' | 'technique_id' | 'category'> {
    if (subject) this.subjects.add(subject);
    const only = this.subjects.size === 1 ? [...this.subjects][0]! : null;
    return { agent_id: agentIdOf(name, kind), technique_id: techniqueIdOf(name, kind), category: categoryOfSubject(subject ?? only) };
  }

  /** One model request, ended either way. Called by the model wrappers. */
  addModelCall(a: { agent: string; model: string; startedAt: number; status: 'ok' | 'failed'; failureReason?: string; usage?: Usage; ttftMs?: number | null; steps?: Record<string, number>; subject?: string | null; tier?: number | null }): void {
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
    const tags = this.tags(a.agent, kind, a.subject ?? null);
    const rollupKey = `${rollupAgentKey(a.agent, kind)}|${a.subject ?? ''}`;
    const prev = this.stageRollup.get(rollupKey) ?? {
      model: a.model,
      prompt: 0,
      cached: 0,
      output: 0,
      thought: 0,
      usd: 0,
      hasPrice: false,
      ttftMs: null,
    };
    prev.model = a.model || prev.model;
    prev.prompt += u?.promptTokens ?? 0;
    prev.cached += u?.cachedTokens ?? 0;
    prev.output += u?.outputTokens ?? 0;
    prev.thought += u?.thoughtTokens ?? 0;
    if (usd !== null) {
      prev.usd += usd;
      prev.hasPrice = true;
    }
    if (prev.ttftMs === null && a.ttftMs != null) prev.ttftMs = a.ttftMs;
    this.stageRollup.set(rollupKey, prev);
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
      subject: a.subject ?? null,
      tier: this.tierFor(kind, a.tier),
      ...tags,
    });
  }

  private addStage(name: string, subject: string | null, startedAt: number, status: string, failureReason: string | null): void {
    const end = this.now();
    const kind = agentKindOf(name);
    this.noteAgent(name, kind);
    if ((kind === 'reader' || kind === 'specialist') && status !== 'ok' && status !== 'cached') this.failed.add(name);
    const tags = this.tags(name, kind, subject);
    const rk = rollupAgentKey(name, kind);
    const rollup = this.stageRollup.get(`${rk}|${subject ?? ''}`) ?? this.stageRollup.get(`${rk}|`);
    this.push({
      id: randomUUID(),
      run_id: this.id.runId,
      agent: name,
      agent_kind: kind,
      level: 'stage',
      model: rollup?.model ?? null,
      status,
      failure_reason: failureReason,
      started_at: new Date(startedAt),
      ended_at: new Date(end),
      ms: end - startedAt,
      ttft_ms: rollup?.ttftMs ?? null,
      steps: null,
      prompt_tokens: rollup?.prompt ?? 0,
      cached_tokens: rollup?.cached ?? 0,
      output_tokens: rollup?.output ?? 0,
      thought_tokens: rollup?.thought ?? 0,
      est_cost_usd: rollup?.hasPrice ? round6(rollup.usd) : null,
      subject,
      tier: this.tierFor(kind, null),
      ...tags,
    });
  }

  /** Reads the stage events every flow already emits. */
  observe(e: ReadingEvent): void {
    if (e.type !== 'stage' || typeof e.name !== 'string') return;
    const subject = typeof e.subject === 'string' && e.subject ? e.subject : null;
    const key = `${e.name}|${subject ?? ''}`;
    const status = e.status as string;
    if (status === 'start') {
      this.open.set(key, { name: e.name, subject, startedAt: this.now() });
      return;
    }
    if (status === 'retrying') return;
    const began = this.open.get(key);
    this.open.delete(key);
    // a stage reported only when done (the journal) has no start: its own `ms`, if any, gives one
    const startedAt = began?.startedAt ?? this.now() - (typeof e.ms === 'number' ? e.ms : 0);
    const finished = status === 'done' ? (e.cached ? 'cached' : 'ok') : status;
    this.addStage(e.name, subject, startedAt, finished, typeof e.reason === 'string' ? e.reason : null);
  }

  /** Only the labels that were set, so a trace that never labelled writes no label column at all. */
  private labelColumns(): Pick<Prisma.ReadingTraceUncheckedUpdateManyInput, (typeof LABEL_KEYS)[number]> {
    const out: Record<string, unknown> = {};
    for (const k of LABEL_KEYS) if (this.labels[k] !== undefined) out[k] = this.labels[k];
    return out;
  }

  /** Writes what is left and closes the trace. Waits at most FINISH_WAIT_MS, and never throws. */
  async finish(s: FinishSummary): Promise<void> {
    for (const o of this.open.values()) this.addStage(o.name, o.subject, o.startedAt, 'unfinished', null);
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
        ...this.labelColumns(),
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
export async function traceModelCall<T extends { usage: Usage; ttftMs?: number | null; timing?: Record<string, number> }>(agent: string, model: string, call: () => Promise<T>, tags: ModelCallTags = {}): Promise<T> {
  const trace = currentTrace();
  if (!trace) return call();
  const startedAt = Date.now();
  const extra = { subject: tags.subject ?? null, tier: tags.tier ?? null };
  try {
    const r = await call();
    trace.addModelCall({ agent, model: r.usage.model, startedAt, status: 'ok', usage: r.usage, ...(r.ttftMs !== undefined ? { ttftMs: r.ttftMs } : {}), ...(r.timing ? { steps: r.timing } : {}), ...extra });
    return r;
  } catch (err) {
    trace.addModelCall({ agent, model, startedAt, status: 'failed', failureReason: failureLabel(err), ...extra });
    throw err;
  }
}
