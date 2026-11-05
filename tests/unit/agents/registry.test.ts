import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTS, registryRow, resetAgentRegistryState, seedAgentRegistry, withAgentRun } from '../../../src/agents/registry.js';
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
