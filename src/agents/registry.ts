/**
 * The agent registry and run log (docs/reading-engine/49 §4.1). Every agent, whether it calls a model, pulls from the
 * engine or is plain code, has one row in `agent_registry` (module, sub-module, model, price per 1M tokens) and one row
 * in `agent_runs` per run (who it ran for, the task, start, end, tokens, estimated cost). The admin module reads both.
 *
 * Writing a run never breaks the request: a failed insert is logged once and swallowed.
 */
import type { PrismaClient } from '@prisma/client';
import { clarifyModelConfig } from '../reading/llm/bedrock.js';
import { modelFor, PRICE_TABLE_VERSION, priceFor, usageCostUsd, type ModelRole } from '../reading/llm/models.js';
import { techniqueById } from '../techniques/catalog.js';
import { categoryOfSubject } from '../techniques/categories.js';

export type AgentKind = 'engine_pull' | 'code' | 'llm';

export interface AgentDef {
  id: string;
  title: string;
  kind: AgentKind;
  module: string;
  subModule?: string;
  description: string;
  /** llm agents: the model role whose env-driven model id is current (src/reading/llm/models.ts) */
  role?: ModelRole;
  /** engine_pull agents: the engine type it calls */
  engineType?: string;
  /** llm agents that do not run on a reading role's model (clarify runs on Bedrock): the provider and the current model */
  provider?: 'gemini' | 'bedrock';
  currentModel?: () => string;
}

/** The reading roles (doc 41) are registered so their model and price show beside the new agents. */
const READING_ROLES: Array<{ role: ModelRole; title: string; description: string }> = [
  { role: 'intake', title: 'Intake', description: 'Reads the question into an intent before any reader runs' },
  { role: 'specialist', title: 'Specialist reader', description: 'Graph-flow specialist over one slice of the chart' },
  { role: 'synth', title: 'Synthesizer', description: 'Writes the answer from the specialists' },
  { role: 'fast', title: 'Fast path', description: 'Short answers without the full graph' },
  { role: 'reader', title: 'Oracle reader', description: 'Narrow reader over stored tables (doc 39)' },
  { role: 'oracle', title: 'Oracle', description: 'Assembles the reading from the readers (doc 39)' },
  { role: 'validator', title: 'Validator', description: 'Checks the Oracle against the readers (doc 39)' },
];

/**
 * The General Reading's graph analysts (trace.ts GRAPH_ANALYSTS), each its own agent so its spans join the registry
 * (docs/admin/03 §4.1). They run on the specialist model.
 */
const GRAPH_ANALYSTS: Array<{ name: string; title: string; description: string }> = [
  { name: 'promise', title: 'Promise analyst', description: 'Reads the natal promise of the subject: base, frame, detail, vargas, arudhas' },
  { name: 'dasha', title: 'Dasha analyst', description: 'Reads the Vimshottari periods in the horizon and their lords in the frame vargas' },
  { name: 'transit', title: 'Transit analyst', description: 'Reads the selected transit rows and natal-degree contacts in the horizon' },
  { name: 'nakshatra', title: 'Nakshatra analyst', description: 'Reads the stars of the frame planets, the running lords and the transits' },
  { name: 'annual', title: 'Annual chart analyst', description: 'Reads the Tithi Pravesha year chart and its dasha when the graph has it' },
  { name: 'prashna', title: 'Question chart analyst', description: 'Reads the chart of the question moment when the graph has it' },
];

/**
 * The deterministic readers of the General Reading over the digest (src/reading/codeReaders/readers.ts; doc 53 §4.4
 * step 5): code, no model. Their spans are `code:<name>` (trace.ts).
 */
const CODE_READERS: Array<{ name: string; title: string; description: string }> = [
  { name: 'varga_dynamics', title: 'Divisional chart agreement', description: "Compares the frame house lords' dignity and the occupants of D1 with the frame's vargas, from the digest; no model" },
  { name: 'strength_yoga', title: 'Strength and yoga reader', description: "Lists the present yogas and doshas touching the frame, the SAV of the frame houses and the shadbala of the frame lords, from the digest; no model" },
  { name: 'jaimini', title: 'Jaimini reader', description: "Places the chara karakas and arudhas of the frame by house class and reads the argala on the frame houses, from the digest; no model" },
  { name: 'person', title: 'Person reader', description: "Reads the person's house in D1 and the relationship varga and the karaka's card, from the digest; no model" },
];

export const AGENTS: AgentDef[] = [
  ...READING_ROLES.map((r) => ({ id: `reading.${r.role}`, title: r.title, kind: 'llm' as const, module: 'reading', subModule: r.role, description: r.description, role: r.role })),
  ...GRAPH_ANALYSTS.map((a) => ({ id: `reading.analyst.${a.name}`, title: a.title, kind: 'llm' as const, module: 'reading', subModule: 'analyst', description: a.description, role: 'specialist' as const })),
  ...CODE_READERS.map((a) => ({ id: `reading.code.${a.name}`, title: a.title, kind: 'code' as const, module: 'reading', subModule: 'code_reader', description: a.description })),
  {
    id: 'reading.clarify',
    title: 'Clarify',
    kind: 'llm',
    module: 'reading',
    subModule: 'clarify',
    description: 'Phrases and resolves the clarifying question on Gemini Flash-Lite or Bedrock (clarify/planner.ts)',
    provider: 'bedrock',
    currentModel: () => {
      const cfg = clarifyModelConfig();
      return cfg.provider === 'gemini' ? cfg.model : `bedrock:${cfg.model}`;
    },
  },
  {
    id: 'reading.clarify_monitor',
    title: 'Clarify counterfactual monitor',
    kind: 'code',
    module: 'reading',
    subModule: 'clarify_monitor',
    description: 'Evaluates post-reading Clarify counterfactuals (ask-right, phrasing, handoff, would-asking-have-helped) deterministically (clarify/monitor.ts)',
  },
  {
    id: 'reading.step',
    title: 'Reading step',
    kind: 'code',
    module: 'reading',
    subModule: 'step',
    description: 'Any other stage of a reading (pack building, joins, journal): code, no model',
  },
  {
    id: 'lucky.day_tables',
    title: 'Day tables puller',
    kind: 'engine_pull',
    module: 'lucky_times',
    subModule: 'data',
    engineType: 'muhurta',
    description: 'Pulls the shared per-place day table (panchang, kalams, horas, muhurtas) for missing days in the range',
  },
  {
    id: 'lucky.day_overlay',
    title: 'Personal day overlay puller',
    kind: 'engine_pull',
    module: 'lucky_times',
    subModule: 'personal',
    engineType: 'muhurta',
    description: "Pulls the person's tara and chandra bala per day for a month (one engine call with natal fields)",
  },
  {
    id: 'area.career_inputs',
    title: 'Career inputs loader',
    kind: 'engine_pull',
    module: 'area',
    subModule: 'career',
    engineType: 'transit_contacts',
    description: 'Loads the stored dashas and house table and pulls transit contacts for 24 months back to 24 ahead',
  },
  {
    id: 'area.career_map',
    title: 'Career map builder',
    kind: 'code',
    module: 'area',
    subModule: 'career',
    description: 'Builds the career map from the timeline grid: present tone, windows by sub-area, horizons, security, Looking back',
  },
  {
    id: 'digest.build',
    title: 'Kundli digest builder',
    kind: 'code',
    module: 'digest',
    subModule: 'build',
    description: 'Builds the kundli digest (house and planet cards per varga, yogas, points, annual charts, star profile) and the activation calendar from stored engine rows; no model',
  },
  {
    id: 'digest.annual_set',
    title: 'Annual set puller',
    kind: 'engine_pull',
    module: 'digest',
    subModule: 'annual',
    engineType: 'annual',
    description: 'Pulls the missing Tithi Pravesha and Varsha year charts (D1, D9, D10), year dashas and sahams for ten years back and ahead, a capped number per run',
  },
  {
    id: 'digest.activation',
    title: 'Activation calendar builder',
    kind: 'code',
    module: 'digest',
    subModule: 'activation',
    description: 'Writes one row per stored dasha period, birth to thirty years ahead, with the D1 houses it activates; runs inside the digest build',
  },
  {
    id: 'area.self_board',
    title: 'You board builder',
    kind: 'code',
    module: 'area',
    subModule: 'self',
    description: 'Builds the You board from the stored digest and activation calendar: supports, pressures with release dates, protections, windows ahead by sub-area, the year chart, tone, Looking back',
  },
  {
    id: 'self.reading_panel',
    title: 'You reading panel',
    kind: 'code',
    module: 'self',
    subModule: 'reading',
    description: 'Runs one panel technique of the You reading (self.reading.*) over the stored digest and activation calendar: shared slicers, word tables, chapter confirmation by other clocks (docs/reading-engine/58)',
  },
  {
    id: 'self.reading_oracle',
    title: 'You reading oracle',
    kind: 'llm',
    module: 'self',
    subModule: 'reading',
    role: 'oracle',
    description: 'Writes the You reading in prose from the panel claims through the Self reader (R15) and the Self Oracle prompt; off unless SELF_READING_MODEL=1 (docs/reading-engine/58 §4.1)',
  },
  {
    id: 'area.love_board',
    title: 'Love board builder',
    kind: 'code',
    module: 'area',
    subModule: 'love',
    description: 'Builds the Love board from the stored digest and activation calendar: supports, pressures with release dates, protections, windows ahead by sub-area, the year chart, tone, Looking back',
  },
  {
    id: 'life.dashboard',
    title: 'Life reading dashboard',
    kind: 'code',
    module: 'life',
    subModule: 'dashboard',
    description: 'Builds the life reading (doc 34, doc 55) from the stored digest and activation calendar: the promise scale per area, cross-system timing windows, the rule for now, and the remaining largest Mahadasha (10-18+ yrs) & Antardasha life charter',
  },
  {
    id: 'lucky.scenario_windows',
    title: 'Scenario windows builder',
    kind: 'code',
    module: 'lucky_times',
    subModule: 'scenarios',
    description: "Builds one scenario's calendar layer (best windows per day) from stored day rows; no model",
  },
  {
    id: 'research.self_dashboard_builder',
    title: 'Research Self Dashboard QA builder',
    kind: 'code',
    module: 'area',
    subModule: 'research_self',
    description: 'Hydrates synthetic age-bracket (18-60) and persona kundlis in research_* staging tables and builds the 12-house/10-varga Self Dashboard, Nov/Thanksgiving/Dec/New Year weekly & daily zoom-in, and 10-step technical trace; no model',
  },
  {
    id: 'research.love_dashboard_builder',
    title: 'Research Love Dashboard QA builder',
    kind: 'code',
    module: 'area',
    subModule: 'research_love',
    description: 'Hydrates synthetic age-bracket and persona kundlis in research_* staging tables and builds the 12-house/10-varga Love & Relationships Dashboard, Nov/Thanksgiving/Dec/New Year weekly & daily zoom-in, and 10-step technical trace; no model',
  },
  {
    id: 'research.work_dashboard_builder',
    title: 'Research Work Dashboard QA builder',
    kind: 'code',
    module: 'area',
    subModule: 'research_work',
    description: 'Hydrates synthetic age-bracket and persona kundlis in research_* staging tables and builds the 12-house/10-varga Work & Career Dashboard, Nov/Thanksgiving/Dec/New Year weekly & daily zoom-in, and 10-step technical trace; no model',
  },
  {
    id: 'research.technical_verifier',
    title: 'Independent Technical Verifier Agent',
    kind: 'code',
    module: 'area',
    subModule: 'research_verifier',
    description: 'Independently audits a hydrated Self Dashboard run against the stored digest, divisional vargas, multi-clock dashas, Ashtakavarga, Nakshatras, and SOUL.md governance across 8 classical dimensions; no model',
  },
];

export function agentById(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

/** The registry row for a definition, with the model and price as of today. */
export function registryRow(a: AgentDef, on?: string) {
  const model = a.currentModel ? a.currentModel() : a.role ? modelFor(a.role) : a.kind === 'engine_pull' ? `engine:${a.engineType ?? ''}` : null;
  const price = a.kind === 'llm' && model ? priceFor(model, on) : undefined;
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    module: a.module,
    sub_module: a.subModule ?? null,
    provider: a.kind === 'llm' ? (a.provider ?? 'gemini') : a.kind === 'engine_pull' ? 'engine' : 'none',
    model,
    price_in: price ? price.in : null,
    price_out: price ? price.out : null,
    price_cached: price ? price.cached : null,
    price_version: a.kind === 'llm' ? PRICE_TABLE_VERSION : null,
    description: a.description,
    enabled: true,
  };
}

let seeded = false;
let warned = false;

/** One statement for the whole seed (one round trip), so it finishes inside a Lambda cold start. */
const AGENT_SEED_SQL = `INSERT INTO agent_registry (id, title, kind, module, sub_module, provider, model, price_in, price_out, price_cached, price_version, description, enabled, updated_at)
  SELECT x.id, x.title, x.kind, x.module, x.sub_module, x.provider, x.model, x.price_in, x.price_out, x.price_cached, x.price_version, x.description, coalesce(x.enabled, true), now()
    FROM jsonb_to_recordset($1::jsonb) AS x(id text, title text, kind text, module text, sub_module text, provider text, model text,
         price_in numeric, price_out numeric, price_cached numeric, price_version text, description text, enabled boolean)
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, kind = EXCLUDED.kind, module = EXCLUDED.module, sub_module = EXCLUDED.sub_module,
    provider = EXCLUDED.provider, model = EXCLUDED.model, price_in = EXCLUDED.price_in, price_out = EXCLUDED.price_out,
    price_cached = EXCLUDED.price_cached, price_version = EXCLUDED.price_version, description = EXCLUDED.description,
    enabled = EXCLUDED.enabled, updated_at = now()`;

type RawCapable = { $executeRawUnsafe?: (sql: string, ...values: unknown[]) => Promise<number> };

/**
 * Upserts every definition into `agent_registry`. Idempotent; awaited at boot (server.ts, before listen) and before the
 * first run. With a real client it is one statement; a client without raw SQL (the test fakes) falls back to one upsert
 * per row. Logs once and never throws.
 */
export async function seedAgentRegistry(prisma: PrismaClient): Promise<number> {
  if (!prisma) return 0;
  const raw = (prisma as unknown as RawCapable).$executeRawUnsafe;
  if (typeof raw === 'function') {
    try {
      await raw.call(prisma, AGENT_SEED_SQL, JSON.stringify(AGENTS.map((a) => registryRow(a))));
      seeded = true;
      return AGENTS.length;
    } catch (e) {
      if (!warned) console.warn(`[agents] registry seed failed: ${(e as Error).message}`);
      warned = true;
      return 0;
    }
  }
  if (typeof (prisma as unknown as { agentRegistry?: { upsert?: unknown } }).agentRegistry?.upsert !== 'function') {
    return 0;
  }
  let n = 0;
  for (const a of AGENTS) {
    const row = registryRow(a);
    try {
      await prisma.agentRegistry.upsert({ where: { id: row.id }, create: row, update: { ...row, updated_at: new Date() } });
      n += 1;
    } catch (e) {
      if (!warned) console.warn(`[agents] registry seed failed: ${(e as Error).message}`);
      warned = true;
      return n;
    }
  }
  seeded = true;
  return n;
}

/** One engine payload a run read (docs/admin/03 §4.1): its catalogue type, and the range or month it covered. */
export interface ChartUsed {
  type: string;
  variant?: string | null;
  calc_version?: string | null;
}

export interface RunContext {
  userId?: string | null;
  task: string;
  /** counts, ids, tones and scores only: never birth details, a name, a typed place or question text */
  input?: Record<string, unknown>;
  /** catalogue id (src/techniques/catalog.ts); category and board default from it */
  technique?: string;
  category?: string;
  board?: string;
  kundliId?: string | null;
  subject?: string | null;
  charts?: ChartUsed[];
}

export interface RunUsage {
  model?: string;
  promptTokens?: number;
  cachedTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
}

export interface RunResult<T> {
  value: T;
  output?: Record<string, unknown>;
  usage?: RunUsage;
  status?: 'ok' | 'cached' | 'skipped';
  /** charts known only once the run has read them; added to the context's */
  charts?: ChartUsed[];
}

/** Columns added by M29; a database without them gets the row without them. */
export const M29_AGENT_RUN_COLUMNS = ['technique_id', 'category', 'board', 'kundli_id', 'subject', 'charts_used'] as const;
const M29_RETRY_MS = 5 * 60_000;
let m29MissingUntil = 0;
const unknownTechniques = new Set<string>();

const isMissingColumn = (err: unknown): boolean => {
  const e = err as { code?: string; message?: string; meta?: { code?: string } } | null;
  if (e?.code === 'P2022' || e?.code === '42703' || e?.meta?.code === '42703') return true;
  const msg = e?.message ?? '';
  return /column .* does not exist/i.test(msg) || M29_AGENT_RUN_COLUMNS.some((c) => msg.includes(`Unknown argument \`${c}\``));
};

function chartsOf(...lists: Array<ChartUsed[] | undefined>): ChartUsed[] | null {
  const out: ChartUsed[] = [];
  const seen = new Set<string>();
  for (const l of lists) {
    for (const ch of l ?? []) {
      if (!ch || typeof ch.type !== 'string' || !ch.type) continue;
      const row: ChartUsed = { type: ch.type.slice(0, 80), ...(ch.variant != null ? { variant: String(ch.variant).slice(0, 80) } : {}), ...(ch.calc_version != null ? { calc_version: String(ch.calc_version).slice(0, 40) } : {}) };
      const key = `${row.type}|${row.variant ?? ''}|${row.calc_version ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out.length ? out : null;
}

/** The M29 tags of a run: technique, category and board (defaulted from the catalogue), kundli, subject, charts read. */
export function runTags(ctx: RunContext, resultCharts?: ChartUsed[]) {
  const t = ctx.technique ? techniqueById(ctx.technique) : undefined;
  if (ctx.technique && !t && !unknownTechniques.has(ctx.technique)) {
    unknownTechniques.add(ctx.technique);
    console.warn(`[agents] unknown technique ${ctx.technique}; the run is written with it as given`);
  }
  return {
    technique_id: ctx.technique ?? null,
    category: ctx.category ?? t?.category ?? (ctx.subject ? categoryOfSubject(ctx.subject) : null),
    board: ctx.board ?? t?.board ?? null,
    kundli_id: ctx.kundliId ?? null,
    subject: ctx.subject ?? null,
    charts_used: chartsOf(ctx.charts, resultCharts),
  };
}

/**
 * Runs `fn` as agent `agentId` and writes one `agent_runs` row with its timings, tokens and cost. Errors from `fn` are
 * logged as a failed run and rethrown; errors writing the row are swallowed.
 */
export async function withAgentRun<T>(prisma: PrismaClient, agentId: string, ctx: RunContext, fn: () => Promise<RunResult<T>>): Promise<T> {
  const def = agentById(agentId);
  if (!def) throw new Error(`unknown agent ${agentId}`);
  if (!seeded) await seedAgentRegistry(prisma);
  const started = new Date();
  let result: RunResult<T> | undefined;
  let error: unknown;
  try {
    result = await fn();
    return result.value;
  } catch (e) {
    error = e;
    throw e;
  } finally {
    if (!prisma || typeof (prisma as unknown as { agentRun?: { create?: unknown } }).agentRun?.create !== 'function') {
      // Test fakes without agentRun table skip run persistence cleanly.
    } else {
    const ended = new Date();
    const u = result?.usage ?? {};
    const model = u.model ?? registryRow(def).model ?? null;
    const tokens = {
      prompt_tokens: u.promptTokens ?? 0,
      cached_tokens: u.cachedTokens ?? 0,
      output_tokens: u.outputTokens ?? 0,
      thought_tokens: u.thoughtTokens ?? 0,
    };
    const cost =
      model && priceFor(model)
        ? usageCostUsd({ model, promptTokens: tokens.prompt_tokens, cachedTokens: tokens.cached_tokens, outputTokens: tokens.output_tokens, thoughtTokens: tokens.thought_tokens })
        : def.kind === 'llm'
          ? null
          : 0;
    const tags = runTags(ctx, result?.charts);
    const write = (withTags: boolean) =>
      prisma.agentRun.create({
        data: {
          agent_id: def.id,
          user_id: ctx.userId ?? null,
          module: def.module,
          sub_module: def.subModule ?? null,
          task: ctx.task.slice(0, 200),
          status: error ? 'failed' : (result?.status ?? 'ok'),
          error: error ? String((error as Error).message ?? error).slice(0, 500) : null,
          input_summary: (ctx.input ?? undefined) as object | undefined,
          output_summary: (result?.output ?? undefined) as object | undefined,
          model,
          started_at: started,
          ended_at: ended,
          ms: ended.getTime() - started.getTime(),
          ...tokens,
          est_cost_usd: cost,
          ...(withTags ? { ...tags, charts_used: (tags.charts_used ?? undefined) as object | undefined } : {}),
        },
      });
    try {
      if (Date.now() < m29MissingUntil) await write(false);
      else {
        try {
          await write(true);
        } catch (e) {
          if (!isMissingColumn(e)) throw e;
          m29MissingUntil = Date.now() + M29_RETRY_MS;
          console.warn('[agents] run tag columns missing (migration M29 not applied); writing runs without them');
          await write(false);
        }
      }
    } catch (e) {
      if (!warned) console.warn(`[agents] run log failed: ${(e as Error).message}`);
      warned = true;
    }
    }
  }
}

/** tests */
export function resetAgentRegistryState(): void {
  seeded = false;
  warned = false;
  m29MissingUntil = 0;
  unknownTechniques.clear();
}
