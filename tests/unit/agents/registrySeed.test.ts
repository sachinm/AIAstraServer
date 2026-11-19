/**
 * TODOS 72-hour sweep (2026-11-19): the registry seeds timed out at cold start and waited on row locks for minutes.
 * Now they run off the request path (once per process, delayed, retried with backoff, logged once), and write only the
 * rows that differ from the table (a read first; nothing differs, nothing is written). Fakes only: no database.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AGENT_DIFF_SQL, AGENTS, resetAgentRegistryState, seedAgentRegistry, seedAgentRegistryInBackground, withAgentRun } from '../../../src/agents/registry.js';
import { runSeedInBackground } from '../../../src/lib/registrySeed.js';
import { resetTechniqueSeedState, seedTechniqueRegistry, TECHNIQUE_DIFF_SQL, TECHNIQUES } from '../../../src/techniques/catalog.js';

beforeEach(() => {
  resetAgentRegistryState();
  resetTechniqueSeedState();
});

const quiet = () => {
  const lines: Array<['log' | 'warn', string]> = [];
  return { lines, log: { log: (m: string) => lines.push(['log', m]), warn: (m: string) => lines.push(['warn', m]) } };
};

/** a raw-SQL client: the diff read answers `changed`, writes are recorded */
function rawClient(changed: (payload: Array<{ id: string }>) => string[], opts: { failWrite?: boolean; failRead?: boolean } = {}) {
  const reads: string[] = [];
  const writes: Array<{ sql: string; ids: string[] }> = [];
  const client = {
    $queryRawUnsafe: async (sql: string, payload: string) => {
      reads.push(sql);
      if (opts.failRead) throw new Error('canceling statement due to lock timeout');
      return changed(JSON.parse(payload)).map((id) => ({ id }));
    },
    $executeRawUnsafe: async (sql: string, payload?: string) => {
      if (opts.failWrite) throw new Error('lock timeout');
      writes.push({ sql, ids: payload ? (JSON.parse(payload) as Array<{ id: string }>).map((r) => r.id) : [] });
      return 1;
    },
  };
  return { client: client as never, reads, writes };
}

describe('seed writes only what differs', () => {
  it('agents: nothing differs → one read, no write; the same definitions again in this process → no read either', async () => {
    const c = rawClient(() => []);
    expect(await seedAgentRegistry(c.client)).toBe(AGENTS.length);
    expect(c.reads).toEqual([AGENT_DIFF_SQL]);
    expect(c.writes).toEqual([]);
    expect(await seedAgentRegistry(c.client)).toBe(AGENTS.length);
    expect(c.reads).toHaveLength(1);
  });
  it('agents: only the changed rows are written', async () => {
    const c = rawClient((rows) => [rows[0]!.id, rows[2]!.id]);
    expect(await seedAgentRegistry(c.client)).toBe(AGENTS.length);
    expect(c.writes).toHaveLength(1);
    expect(c.writes[0]!.sql).toMatch(/INSERT INTO agent_registry/);
    expect(c.writes[0]!.ids).toEqual([AGENTS[0]!.id, AGENTS[2]!.id]);
  });
  it('techniques: the diff compares the seeded columns only (never enabled or verification_status) and writes the changed rows', async () => {
    expect(TECHNIQUE_DIFF_SQL).not.toMatch(/enabled|verification_status/);
    const c = rawClient((rows) => [rows.at(-1)!.id]);
    expect(await seedTechniqueRegistry(c.client)).toBe(TECHNIQUES.length);
    expect(c.writes.map((w) => w.ids)).toEqual([[TECHNIQUES.at(-1)!.id]]);
    const none = rawClient(() => []);
    resetTechniqueSeedState();
    expect(await seedTechniqueRegistry(none.client)).toBe(TECHNIQUES.length);
    expect(none.writes).toEqual([]);
  });
  it('a failing read or write returns 0 and never throws', async () => {
    expect(await seedAgentRegistry(rawClient(() => [], { failRead: true }).client)).toBe(0);
    resetAgentRegistryState();
    expect(await seedAgentRegistry(rawClient(() => ['x'], { failWrite: true }).client)).toBe(0);
    expect(await seedTechniqueRegistry(rawClient(() => ['x'], { failWrite: true }).client)).toBe(0);
  });
});

describe('runSeedInBackground', () => {
  it('waits the delay, retries with backoff, and logs success once', async () => {
    const waits: number[] = [];
    const q = quiet();
    let tries = 0;
    const n = await runSeedInBackground('agents', async () => (++tries < 3 ? 0 : 7), { delayMs: 50, backoffMs: [10, 20], sleep: async (ms) => void waits.push(ms), log: q.log });
    expect(n).toBe(7);
    expect(waits).toEqual([50, 10, 20]);
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0]![0]).toBe('log');
    expect(JSON.parse(q.lines[0]![1])).toMatchObject({ msg: '[seed] agents registry seeded', rows: 7, tries: 3 });
  });
  it('every try failing (or throwing) resolves 0 and logs one warning; it never rejects', async () => {
    const q = quiet();
    const n = await runSeedInBackground('techniques', async () => { throw new Error('pool timeout'); }, { delayMs: 0, backoffMs: [0, 0], sleep: async () => undefined, log: q.log });
    expect(n).toBe(0);
    expect(q.lines.map((l) => l[0])).toEqual(['warn']);
    expect(JSON.parse(q.lines[0]![1])).toMatchObject({ msg: '[seed] techniques registry seed failed', tries: 3, error: 'pool timeout' });
  });
});

describe('a seed never sits on the request path', () => {
  it('withAgentRun answers at once while the seed waits, and a failing seed does not fail the request', async () => {
    let seedCalls = 0;
    const runs: unknown[] = [];
    const prisma = {
      $queryRawUnsafe: async () => {
        seedCalls += 1;
        throw new Error('timed out fetching a new connection from the pool');
      },
      $executeRawUnsafe: async () => {
        seedCalls += 1;
        throw new Error('timed out fetching a new connection from the pool');
      },
      agentRun: { create: async ({ data }: { data: unknown }) => (runs.push(data), data) },
    } as never;
    const t0 = Date.now();
    await expect(withAgentRun(prisma, 'lucky.scenario_windows', { task: 'x' }, async () => ({ value: 'ok' }))).resolves.toBe('ok');
    expect(Date.now() - t0).toBeLessThan(500);
    // the seed has not touched the database during the request (it starts after its delay)
    expect(seedCalls).toBe(0);
    expect(runs).toHaveLength(1);
    // the same background job every caller gets: it fails (every try) and resolves 0, never rejecting
    const job = seedAgentRegistryInBackground(prisma, { delayMs: 0, backoffMs: [0, 0], sleep: async () => undefined });
    expect(job).toBe(seedAgentRegistryInBackground(prisma));
  }, 10_000);

  it('a failing background seed resolves 0 (one log line) and a later request still answers', async () => {
    const q = quiet();
    const prisma = {
      $queryRawUnsafe: async () => { throw new Error('relation "agent_registry" does not exist'); },
      $executeRawUnsafe: async () => 1,
      agentRun: { create: async ({ data }: { data: unknown }) => data },
    } as never;
    expect(await seedAgentRegistryInBackground(prisma, { delayMs: 0, backoffMs: [0], sleep: async () => undefined, log: q.log })).toBe(0);
    expect(q.lines.filter((l) => l[0] === 'warn')).toHaveLength(1);
    await expect(withAgentRun(prisma, 'lucky.scenario_windows', { task: 'y' }, async () => ({ value: 2 }))).resolves.toBe(2);
  });
});
