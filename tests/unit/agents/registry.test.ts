import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENTS, M29_AGENT_RUN_COLUMNS, registryRow, resetAgentRegistryState, seedAgentRegistry, withAgentRun } from '../../../src/agents/registry.js';
import { fakeLuckyPrisma } from '../../helpers/fakeLuckyPrisma.js';

beforeEach(() => resetAgentRegistryState());

describe('agent registry', () => {
  it('every agent has a unique id, a module and a kind', () => {
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(AGENTS.length);
    for (const a of AGENTS) {
      expect(a.module).toBeTruthy();
      expect(['engine_pull', 'code', 'llm']).toContain(a.kind);
    }
  });
  it('llm agents carry their model and price; others carry no price', () => {
    const oracle = registryRow(AGENTS.find((a) => a.id === 'reading.oracle')!);
    expect(oracle.model).toBeTruthy();
    expect(oracle.provider).toBe('gemini');
    const code = registryRow(AGENTS.find((a) => a.id === 'lucky.scenario_windows')!);
    expect(code.price_in).toBeNull();
    expect(code.provider).toBe('none');
    expect(registryRow(AGENTS.find((a) => a.id === 'lucky.day_tables')!).model).toBe('engine:muhurta');
  });
  it('seeds in one statement when the client has raw SQL', async () => {
    resetAgentRegistryState();
    const calls: Array<[string, unknown[]]> = [];
    const prisma = { $executeRawUnsafe: async (sql: string, ...v: unknown[]) => (calls.push([sql, v]), AGENTS.length) } as never;
    expect(await seedAgentRegistry(prisma)).toBe(AGENTS.length);
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toMatch(/INSERT INTO agent_registry[\s\S]*jsonb_to_recordset[\s\S]*ON CONFLICT \(id\) DO UPDATE/);
    const rows = JSON.parse(calls[0]![1][0] as string) as Array<{ id: string }>;
    expect(rows.map((r) => r.id)).toEqual(AGENTS.map((a) => a.id));
  });

  it('a failing one-statement seed logs and returns 0, never throws', async () => {
    resetAgentRegistryState();
    const prisma = { $executeRawUnsafe: async () => { throw new Error('relation missing'); } } as never;
    expect(await seedAgentRegistry(prisma)).toBe(0);
  });

  it('seeds every agent', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    expect(await seedAgentRegistry(db.prisma)).toBe(AGENTS.length);
    expect(db.registry.size).toBe(AGENTS.length);
  });
});

describe('withAgentRun', () => {
  it('logs an ok run with tokens and cost', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    const v = await withAgentRun(db.prisma, 'reading.oracle', { userId: 'u1', task: 'test' }, async () => ({
      value: 42,
      usage: { model: 'gemini-2.5-flash', promptTokens: 1_000_000, outputTokens: 0 },
    }));
    expect(v).toBe(42);
    const run = db.runs[0];
    expect(run.status).toBe('ok');
    expect(run.prompt_tokens).toBe(1_000_000);
    expect(run.est_cost_usd).toBeCloseTo(0.3, 5);
    expect(run.module).toBe('reading');
  });
  it('logs a failed run and rethrows', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    await expect(withAgentRun(db.prisma, 'lucky.day_tables', { task: 'boom' }, async () => { throw new Error('engine down'); })).rejects.toThrow('engine down');
    expect(db.runs[0].status).toBe('failed');
    expect(db.runs[0].error).toBe('engine down');
  });
  it('never breaks the request when the log write fails', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    db.prisma.agentRun.create = async () => { throw new Error('db down'); };
    await expect(withAgentRun(db.prisma, 'lucky.scenario_windows', { task: 'x' }, async () => ({ value: 'ok' }))).resolves.toBe('ok');
  });
  it('refuses an unknown agent', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    await expect(withAgentRun(db.prisma, 'nope', { task: 'x' }, async () => ({ value: 1 }))).rejects.toThrow('unknown agent');
  });
});

describe('registry additions (docs/admin/03)', () => {
  it('registers the graph analysts, clarify and the step agent beside the reading roles', () => {
    const ids = AGENTS.map((a) => a.id);
    for (const n of ['promise', 'dasha', 'transit', 'nakshatra', 'annual', 'prashna']) {
      const a = AGENTS.find((x) => x.id === `reading.analyst.${n}`)!;
      expect(a.kind).toBe('llm');
      expect(a.role).toBe('specialist');
      expect(a.subModule).toBe('analyst');
    }
    expect(ids).toEqual(expect.arrayContaining(['reading.reader', 'reading.oracle', 'reading.validator', 'reading.intake', 'reading.clarify', 'reading.step']));
    const clarify = registryRow(AGENTS.find((a) => a.id === 'reading.clarify')!);
    expect(clarify.provider).toBe('bedrock');
    expect(clarify.model).toMatch(/^bedrock:/);
    expect(registryRow(AGENTS.find((a) => a.id === 'reading.step')!).provider).toBe('none');
  });
});

describe('withAgentRun tags (M29)', () => {
  it('writes technique, category and board from the catalogue, the kundli, the subject and the charts read', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    await withAgentRun(
      db.prisma,
      'area.career_inputs',
      { userId: 'u1', task: 't', technique: 'work.present_tone', kundliId: 'k1', charts: [{ type: 'dasha.vimsottari' }] },
      async () => ({ value: 1, charts: [{ type: 'transit_contacts', variant: '2024-11-01_2028-11-30' }, { type: 'dasha.vimsottari' }] }),
    );
    const run = db.runs[0];
    expect(run.technique_id).toBe('work.present_tone');
    expect(run.category).toBe('work');
    expect(run.board).toBe('work');
    expect(run.kundli_id).toBe('k1');
    expect(run.subject).toBeNull();
    expect(run.charts_used).toEqual([{ type: 'dasha.vimsottari' }, { type: 'transit_contacts', variant: '2024-11-01_2028-11-30' }]);
  });

  it('a lucky scenario run takes its category from the scenario area', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    await withAgentRun(db.prisma, 'lucky.scenario_windows', { task: 't', technique: 'lucky.love.first_date', charts: [{ type: 'muhurta', variant: '2026-11' }] }, async () => ({ value: 1 }));
    expect(db.runs[0]).toMatchObject({ technique_id: 'lucky.love.first_date', category: 'love', board: 'lucky', charts_used: [{ type: 'muhurta', variant: '2026-11' }] });
  });

  it('an unknown technique is logged once and the run is still written', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await withAgentRun(db.prisma, 'lucky.scenario_windows', { task: 'a', technique: 'lucky.nope' }, async () => ({ value: 1 }));
    await withAgentRun(db.prisma, 'lucky.scenario_windows', { task: 'b', technique: 'lucky.nope' }, async () => ({ value: 1 }));
    expect(db.runs).toHaveLength(2);
    expect(db.runs[0].technique_id).toBe('lucky.nope');
    expect(db.runs[0].category).toBeNull();
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('unknown technique'))).toHaveLength(1);
    warn.mockRestore();
  });

  it('a subject with no technique sets the category', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    await withAgentRun(db.prisma, 'reading.oracle', { task: 'x', subject: 'marriage_relationship' }, async () => ({ value: 1 }));
    expect(db.runs[0]).toMatchObject({ subject: 'marriage_relationship', category: 'love', technique_id: null, charts_used: undefined });
  });

  it('retries once without the M29 columns when the database does not have them', async () => {
    const db = fakeLuckyPrisma({ seedSanJose: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const seen: any[] = [];
    db.prisma.agentRun.create = async ({ data }: any) => {
      seen.push(data);
      if ('technique_id' in data) throw Object.assign(new Error('The column `agent_runs.technique_id` does not exist in the current database.'), { code: 'P2022' });
      db.runs.push(data);
      return data;
    };
    await expect(withAgentRun(db.prisma, 'lucky.day_tables', { task: 'x', technique: 'lucky.day_tables' }, async () => ({ value: 'ok' }))).resolves.toBe('ok');
    expect(seen).toHaveLength(2);
    expect(db.runs).toHaveLength(1);
    for (const c of M29_AGENT_RUN_COLUMNS) expect(db.runs[0]).not.toHaveProperty(c);
    expect(db.runs[0].agent_id).toBe('lucky.day_tables');
    // the next run goes straight to the old shape
    await withAgentRun(db.prisma, 'lucky.day_tables', { task: 'y', technique: 'lucky.day_tables' }, async () => ({ value: 'ok' }));
    expect(seen).toHaveLength(3);
    expect(db.runs).toHaveLength(2);
    warn.mockRestore();
  });
});
