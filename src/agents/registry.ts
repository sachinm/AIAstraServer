/**
 * The agent registry and run log (docs/reading-engine/49 §4.1). Every agent, whether it calls a model, pulls from the
 * engine or is plain code, has one row in `agent_registry` (module, sub-module, model, price per 1M tokens) and one row
 * in `agent_runs` per run (who it ran for, the task, start, end, tokens, estimated cost). The admin module reads both.
 *
 * Writing a run never breaks the request: a failed insert is logged once and swallowed.
 */
import type { PrismaClient } from '@prisma/client';
import { modelFor, PRICE_TABLE_VERSION, priceFor, usageCostUsd, type ModelRole } from '../reading/llm/models.js';

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

export const AGENTS: AgentDef[] = [
  ...READING_ROLES.map((r) => ({ id: `reading.${r.role}`, title: r.title, kind: 'llm' as const, module: 'reading', subModule: r.role, description: r.description, role: r.role })),
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
    id: 'lucky.scenario_windows',
    title: 'Scenario windows builder',
    kind: 'code',
    module: 'lucky_times',
    subModule: 'scenarios',
    description: "Builds one scenario's calendar layer (best windows per day) from stored day rows; no model",
  },
];

export function agentById(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

/** The registry row for a definition, with the model and price as of today. */
export function registryRow(a: AgentDef, on?: string) {
  const model = a.role ? modelFor(a.role) : a.kind === 'engine_pull' ? `engine:${a.engineType ?? ''}` : null;
  const price = a.role && model ? priceFor(model, on) : undefined;
  return {
    id: a.id,
    title: a.title,
    kind: a.kind,
    module: a.module,
    sub_module: a.subModule ?? null,
    provider: a.kind === 'llm' ? 'gemini' : a.kind === 'engine_pull' ? 'engine' : 'none',
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

/** Upserts every definition into `agent_registry`. Idempotent; called at boot and before the first run. */
export async function seedAgentRegistry(prisma: PrismaClient): Promise<number> {
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

export interface RunContext {
  userId?: string | null;
  task: string;
  input?: Record<string, unknown>;
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
    try {
      await prisma.agentRun.create({
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
        },
      });
    } catch (e) {
      if (!warned) console.warn(`[agents] run log failed: ${(e as Error).message}`);
      warned = true;
    }
  }
}

/** tests */
export function resetAgentRegistryState(): void {
  seeded = false;
  warned = false;
}
