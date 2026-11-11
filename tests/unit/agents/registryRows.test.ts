/**
 * Every agent a run is logged as has a row source (doc 70 Phase 3 replay: `agent_runs` hit `agent_runs_agent_fkey` for
 * the clock and card agents). The source is the idempotent seed (`seedAgentRegistry`: every definition in AGENTS upserted
 * before a process's first run); no migration inserts agent rows. A run whose agent row is missing seeds again and
 * writes once more. Fake clients only; no database.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTS, isMissingAgentRow, resetAgentRegistryState, withAgentRun } from '../../../src/agents/registry.js';
import { CARD_ORACLE_AGENT, CARD_PERSONALIZER_AGENT } from '../../../src/reading/cards/types.js';
import { CLOCK_AGENT, CONCORDANCE_AGENT } from '../../../src/reading/clocks/types.js';

beforeEach(() => resetAgentRegistryState());

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('every agent id has a row source', () => {
  it('the doc 70 agents (clock readers, concordance, card Oracle, card Personalizer) are defined, so the seed writes their rows', () => {
    const ids = new Set(AGENTS.map((a) => a.id));
    for (const id of [CLOCK_AGENT, CONCORDANCE_AGENT, CARD_ORACLE_AGENT, CARD_PERSONALIZER_AGENT]) expect(ids.has(id), id).toBe(true);
  });

  it('every literal agent id passed to withAgentRun, or as agentId where runs or outputs are written, is a definition', () => {
    const ids = new Set(AGENTS.map((a) => a.id));
    const used = new Set<string>();
    for (const f of files('src')) {
      const t = readFileSync(f, 'utf8');
      // `agentId` means a registry agent only where a run or a stored output is written (the past-reading flow's
      // specialist ids are its own task briefs, not registry agents)
      if (!/withAgentRun|withTechniqueOutput|runPersonalizerV3/.test(t)) continue;
      for (const m of t.matchAll(/withAgentRun\(\s*[\w.]+,\s*'([^']+)'/g)) used.add(m[1]!);
      for (const m of t.matchAll(/\bagentId:\s*'([^']+)'/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(3);
    expect([...used].filter((id) => !ids.has(id))).toEqual([]);
  });

  it('the seed payload carries every definition, the doc 70 agents included', async () => {
    const payload: Array<{ id: string }> = [];
    const prisma = { $executeRawUnsafe: async (_sql: string, json: string) => (payload.push(...(JSON.parse(json) as Array<{ id: string }>)), 1) };
    await withAgentRun(prisma as never, CONCORDANCE_AGENT, { task: 't' }, async () => ({ value: 1 }));
    expect(payload.map((r) => r.id)).toEqual(AGENTS.map((a) => a.id));
  });
});

describe('a run whose agent row is missing', () => {
  const fkey = () => Object.assign(new Error('Foreign key constraint violated on the constraint: `agent_runs_agent_fkey`'), { code: 'P2003' });

  it('is recognised by the constraint name or by P2003 on the agent field', () => {
    expect(isMissingAgentRow(fkey())).toBe(true);
    expect(isMissingAgentRow({ code: 'P2003', meta: { field_name: 'agent_id' } })).toBe(true);
    expect(isMissingAgentRow({ code: 'P2003', meta: { field_name: 'user_id' } })).toBe(false);
    expect(isMissingAgentRow(new Error('timeout'))).toBe(false);
  });

  it('seeds again and writes the run once more', async () => {
    let seeds = 0;
    let rowsSeeded = false;
    const written: string[] = [];
    const prisma = {
      // the first seed is swallowed (as by the replay's dry proxy); the second reaches the table
      $executeRawUnsafe: async () => {
        seeds += 1;
        if (seeds > 1) rowsSeeded = true;
        return 0;
      },
      agentRun: {
        create: async ({ data }: { data: { agent_id: string } }) => {
          if (!rowsSeeded) throw fkey();
          written.push(data.agent_id);
          return {};
        },
      },
    };
    expect(await withAgentRun(prisma as never, CLOCK_AGENT, { task: 't' }, async () => ({ value: 'v' }))).toBe('v');
    expect(seeds).toBe(2);
    expect(written).toEqual([CLOCK_AGENT]);
  });

  it('a row still missing after the second seed never breaks the run', async () => {
    const prisma = { $executeRawUnsafe: async () => 0, agentRun: { create: async () => Promise.reject(fkey()) } };
    expect(await withAgentRun(prisma as never, CARD_ORACLE_AGENT, { task: 't' }, async () => ({ value: 3 }))).toBe(3);
  });
});
