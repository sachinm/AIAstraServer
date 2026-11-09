/**
 * Engine › Dashboard loads (docs/admin/12): the latest builds of one person's board as the admin shows them, each with
 * the techniques that ran, every agent and sub-agent run under it (status, time, tokens, cost, error) and what each
 * agent reported (the family findings, the lineman's brief, the Oracle's answer, the panels' lines). Read-only: every
 * row comes from `reading_dossiers`, `agent_runs` and the `area_builds` build marker; nothing is computed or re-run.
 *
 *   GET /api/admin-lab/loads/:userId?board=self|love|work&limit=1..30
 *     → 200 { userId, board, marker, loads: [...], unassignedRuns: [...] } | 400 bad_board | 404 no_kundli
 *
 * Agent runs are grouped under a build by time: a run belongs to the first dossier written at or after it ended; runs
 * after the newest dossier are `unassignedRuns` (a build still running, or one that died before writing its dossier,
 * which is exactly the case the page exists to show). Birth fields are stripped from every response.
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { stripBirthFields } from '../reading/self/dossier.js';
import { readBuildMarker, markerArea } from '../reading/self/buildEvent.js';
import type { ReadingBoardId } from '../reading/self/types.js';

const BOARDS: readonly ReadingBoardId[] = ['self', 'love', 'work'];
/** runs are read from this long before the oldest listed build, so a build's first stages are never cut off */
const RUN_LEAD_MS = 20 * 60_000;
/** a run that ended this close to a dossier's write still belongs to it (the write follows the last stage by seconds) */
const RUN_SLACK_MS = 5_000;
const MAX_RUNS = 600;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);
const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);
const day = (v: unknown): string | null => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'string' ? v.slice(0, 10) : null);

export interface LoadRun {
  id: string;
  agentId: string;
  techniqueId: string | null;
  task: string;
  status: string;
  error: string | null;
  ms: number;
  model: string | null;
  promptTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  costUsd: number | null;
  startedAt: string;
  endedAt: string;
  input: unknown;
  output: unknown;
  charts: unknown;
}

export interface LoadOracleStage {
  agentId: string;
  status: string;
  cached: boolean;
  ms: number | null;
  promptTokens: number | null;
  cachedTokens: number | null;
  outputTokens: number | null;
  thoughtTokens: number | null;
  costUsd: number | null;
  summary: string | null;
}

export interface LoadOracle {
  status: string;
  model: string | null;
  promptName: string | null;
  promptVersion: string | null;
  ms: number | null;
  costUsd: number | null;
  tokens: { prompt: number; cached: number; output: number; thought: number } | null;
  error: string | null;
  dropped: number | null;
  validator: { verdict: string; issues: string[] } | null;
  stages: LoadOracleStage[];
  /** the Oracle's narrative, as stored (validated and redacted by the build) */
  text: string | null;
  linemanFindings: string | null;
  familyFindings: Record<string, string>;
  /** PANEL_SYNTHESIS lines parsed per panel */
  panelLines: Record<string, number>;
  plans: number;
  cached: boolean;
}

export interface LoadPanel {
  id: string;
  title: string;
  status: string;
  lines: number;
  aiLines: number;
  cached: boolean;
  ms: number | null;
  plan: boolean;
  lead: string | null;
  lineTexts: string[];
}

export interface LoadBuild {
  id: string;
  createdAt: string | null;
  asOf: string | null;
  validTo: string | null;
  trigger: string;
  scope: string;
  clock: string | null;
  digestVersion: string | null;
  verdict: string | null;
  costUsd: number | null;
  steps: Record<string, number>;
  techniques: Array<{ id: string; status: string | null; cached: boolean; ms: number | null }>;
  gaps: string[];
  panels: LoadPanel[];
  oracle: LoadOracle | null;
  runs: LoadRun[];
}

export interface LoadsResponse {
  userId: string;
  board: ReadingBoardId;
  marker: { state: string; status: string | null; startedAt: string | null; error: string | null } | null;
  loads: LoadBuild[];
  unassignedRuns: LoadRun[];
}

export function oracleOf(raw: unknown, runs: LoadRun[]): LoadOracle | null {
  const o = obj(raw);
  if (!o.status) return null;
  const stages = arr(o.stages).map((s) => {
    const x = obj(s);
    return {
      agentId: str(x.agentId) ?? '',
      status: str(x.status) ?? (x.cached === true ? 'cached' : 'ok'),
      cached: x.cached === true,
      ms: num(x.ms),
      promptTokens: num(x.promptTokens ?? x.inputTokens),
      cachedTokens: num(x.cachedTokens),
      outputTokens: num(x.outputTokens),
      thoughtTokens: num(x.thoughtTokens),
      costUsd: num(x.costUsd),
      summary: str(x.summary),
    };
  });
  const tok = obj(o.tokens);
  const validator = obj(o.validator);
  // a failed Oracle stores no error text of its own; the failing agent run under this build carries it
  const failedRun = runs.find((r) => r.status === 'failed' && (r.agentId.endsWith('.reading_oracle') || r.agentId.startsWith('lineman.') || r.agentId.startsWith('family.')));
  const panelLines: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(o.panelLines))) panelLines[k] = arr(v).length;
  const familyFindings: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(o.familyFindings))) if (typeof v === 'string') familyFindings[k] = v;
  return {
    status: String(o.status),
    model: str(o.model),
    promptName: str(o.promptName),
    promptVersion: str(o.promptVersion),
    ms: num(o.ms),
    costUsd: num(o.costUsd ?? o.spentUsd),
    tokens: o.tokens ? { prompt: num(tok.prompt) ?? 0, cached: num(tok.cached) ?? 0, output: num(tok.output) ?? 0, thought: num(tok.thought) ?? 0 } : null,
    error: str(o.error) ?? failedRun?.error ?? null,
    dropped: num(o.dropped),
    validator: o.validator ? { verdict: str(validator.verdict) ?? 'ok', issues: arr(validator.issues).filter((x): x is string => typeof x === 'string') } : null,
    stages,
    text: str(o.text) ?? str(o.output),
    linemanFindings: str(o.linemanFindings),
    familyFindings,
    panelLines,
    plans: Object.keys(obj(o.panelPlans)).length,
    cached: o.cached === true,
  };
}

export function panelsOf(raw: unknown): LoadPanel[] {
  return arr(raw).map((p) => {
    const x = obj(p);
    const lines = arr(x.lines).map(obj);
    return {
      id: str(x.id) ?? '',
      title: str(x.title) ?? '',
      status: str(x.status) ?? 'ok',
      lines: lines.length,
      aiLines: lines.filter((l) => /\.ai\.\d+$/.test(str(l.id) ?? '')).length,
      cached: x.cached === true,
      ms: num(x.ms),
      plan: !!x.plan && typeof x.plan === 'object',
      lead: str(x.lead),
      lineTexts: lines.map((l) => str(l.text) ?? '').filter(Boolean),
    };
  });
}

export function runOf(r: Obj): LoadRun {
  return {
    id: str(r.id) ?? '',
    agentId: str(r.agent_id) ?? '',
    techniqueId: str(r.technique_id),
    task: str(r.task) ?? '',
    status: str(r.status) ?? '',
    error: str(r.error),
    ms: num(r.ms) ?? 0,
    model: str(r.model),
    promptTokens: num(r.prompt_tokens) ?? 0,
    cachedTokens: num(r.cached_tokens) ?? 0,
    outputTokens: num(r.output_tokens) ?? 0,
    thoughtTokens: num(r.thought_tokens) ?? 0,
    costUsd: num(r.est_cost_usd),
    startedAt: iso(r.started_at) ?? '',
    endedAt: iso(r.ended_at) ?? iso(r.started_at) ?? '',
    input: r.input_summary ?? null,
    output: r.output_summary ?? null,
    charts: r.charts_used ?? null,
  };
}

/**
 * Groups runs under dossiers by time. `dossiers` newest first; `runs` in any order. A run belongs to the first dossier
 * written at or after (its end − slack); runs after the newest dossier are unassigned.
 */
export function groupRuns<D extends { id: string; createdAt: string | null }>(dossiers: D[], runs: LoadRun[]): { byDossier: Map<string, LoadRun[]>; unassigned: LoadRun[] } {
  const asc = [...dossiers].filter((d) => d.createdAt).sort((a, b) => a.createdAt!.localeCompare(b.createdAt!));
  const byDossier = new Map<string, LoadRun[]>(asc.map((d) => [d.id, []]));
  const unassigned: LoadRun[] = [];
  for (const run of [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const end = Date.parse(run.endedAt || run.startedAt) - RUN_SLACK_MS;
    const home = asc.find((d) => Date.parse(d.createdAt!) >= end);
    if (home) byDossier.get(home.id)!.push(run);
    else unassigned.push(run);
  }
  return { byDossier, unassigned };
}

export function loadsHandler(deps: { prisma: PrismaClient; now?: () => Date }): express.RequestHandler {
  return async (req, res) => {
    const userId = String(req.params.userId ?? '');
    const board = String(req.query.board ?? 'self') as ReadingBoardId;
    if (!BOARDS.includes(board)) return res.status(400).json({ error: 'bad_board' });
    const limitRaw = Number(req.query.limit ?? 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(30, Math.max(1, Math.floor(limitRaw))) : 10;
    try {
      const kundli = await deps.prisma.kundli.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' }, select: { id: true } });
      if (!kundli) return res.status(404).json({ error: 'no_kundli' });
      const now = (deps.now ?? (() => new Date()))();
      const rows = await deps.prisma.readingDossier.findMany({
        where: { kundli_id: kundli.id, board },
        orderBy: { created_at: 'desc' },
        take: limit,
        select: { id: true, created_at: true, as_of: true, valid_to: true, trigger: true, clock: true, digest_version: true, audit: true, oracle: true, cost_usd: true, panels: true, techniques: true, gaps: true },
      });
      const oldest = rows.length ? rows[rows.length - 1]!.created_at : now;
      const since = new Date(new Date(oldest).getTime() - RUN_LEAD_MS);
      const runRows = await deps.prisma.agentRun.findMany({
        where: { kundli_id: kundli.id, started_at: { gte: since } },
        orderBy: { started_at: 'asc' },
        take: MAX_RUNS,
        select: {
          id: true, agent_id: true, technique_id: true, task: true, status: true, error: true, ms: true, model: true,
          prompt_tokens: true, cached_tokens: true, output_tokens: true, thought_tokens: true, est_cost_usd: true,
          started_at: true, ended_at: true, input_summary: true, output_summary: true, charts_used: true,
        },
      });
      const runs = runRows.map((r) => runOf({ ...(r as unknown as Obj), est_cost_usd: r.est_cost_usd === null ? null : Number(r.est_cost_usd) }));
      const heads = rows.map((d) => ({ id: d.id, createdAt: iso(d.created_at) }));
      const { byDossier, unassigned } = groupRuns(heads, runs);
      const loads: LoadBuild[] = rows.map((d) => {
        const audit = obj(d.audit);
        const steps: Record<string, number> = {};
        for (const [k, v] of Object.entries(obj(audit.steps))) {
          const n = num(v);
          if (n !== null) steps[k] = n;
        }
        const mine = byDossier.get(d.id) ?? [];
        return {
          id: d.id,
          createdAt: iso(d.created_at),
          asOf: day(d.as_of),
          validTo: day(d.valid_to),
          trigger: d.trigger,
          scope: str(audit.scope) ?? 'all',
          clock: d.clock,
          digestVersion: d.digest_version,
          verdict: str(audit.verdict),
          costUsd: d.cost_usd === null || d.cost_usd === undefined ? null : Number(d.cost_usd),
          steps,
          techniques: arr(d.techniques).map((t) => {
            const x = obj(t);
            return { id: str(x.id) ?? '', status: str(x.status), cached: x.cached === true, ms: num(x.ms) };
          }),
          gaps: arr(d.gaps).filter((g): g is string => typeof g === 'string'),
          panels: panelsOf(d.panels),
          oracle: oracleOf(d.oracle, mine),
          runs: mine,
        };
      });
      const markerState = await readBuildMarker(deps.prisma, kundli.id, board, now);
      let marker: LoadsResponse['marker'] = null;
      if (markerState !== 'none') {
        const row = await (deps.prisma as unknown as { areaBuild?: { findUnique?: (q: unknown) => Promise<{ status: string; result: unknown; error: string | null } | null> } }).areaBuild
          ?.findUnique?.({ where: { kundli_id_area_as_of: { kundli_id: kundli.id, area: markerArea(board), as_of: new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`) } } })
          .catch(() => null);
        marker = { state: markerState, status: row?.status ?? null, startedAt: str(obj(row?.result).started_at), error: row?.error ?? null };
      }
      const out: LoadsResponse = { userId, board, marker, loads, unassignedRuns: unassigned };
      return res.json(stripBirthFields(out));
    } catch (e) {
      console.error('[admin-lab] loads', (e as Error).message);
      return res.status(503).json({ error: 'loads_unavailable' });
    }
  };
}
