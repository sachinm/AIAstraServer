import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPendingIndividualRecycles } from '../../../../../src/reading/llm/cacheSweep.js';
import { clearReaderMemo } from '../../../../../src/reading/oracle/prewarm.js';
import { runSelfV2Build } from '../../../../../src/reading/self/v2/build.js';
import { readSelfV2Latest } from '../../../../../src/reading/self/v2/store.js';
import { geminiResult, makeCtx, makeGemini, makePrisma, makeProfile, makeSubs } from './fixtures.js';

const ENV = {
  READING_EXPLICIT_CACHE: '1',
  READING_MODEL_READER: 'gemini-3.1-flash-lite',
  READING_MODEL_ORACLE: 'gemini-3.8-flash',
  SELF_PERSONALIZER_MODEL: 'gemini-3.1-flash-lite',
  SELF_READING_MAX_SPEND_USD: '1',
} as const;
const NOW = () => new Date('2026-11-09T12:00:00Z');
const agentRows = (db: ReturnType<typeof makePrisma>) => [...db.outputs.values()].filter((x) => x.technique_id === 'self.v2.oracle' || x.technique_id === 'self.v2.personalizer').length;

describe('runSelfV2Build: the order of a build (doc 66 §4.8 steps 0–8), every model call mocked', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    clearReaderMemo();
    clearPendingIndividualRecycles();
  });
  afterEach(() => {
    for (const k of Object.keys(ENV)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    clearReaderMemo();
    clearPendingIndividualRecycles();
  });

  const deps = (log: string[], over: Record<string, unknown> = {}) => {
    const db = makePrisma();
    const ensureCache = vi.fn(async (_m: string, _s: string | undefined, prefix: string) => {
      log.push(`warm:${prefix.slice(0, 24)}`);
      return 'cachedContents/mock';
    });
    return { db, deps: { prisma: db.prisma, callGemini: makeGemini(log), ensureCache, informUsed: vi.fn(), now: NOW, onStep: (s: string) => log.push(`step:${s}`), ...over } };
  };

  it('warms every prefix before the first agent call, then families → Oracle ×3 → validate → store → Personalizer → store', async () => {
    const log: string[] = [];
    const { db, deps: d } = deps(log);
    const subs = makeSubs();
    const r = await runSelfV2Build(d, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs });
    expect(r.status).toBe('ok');
    expect(subs.calls).toEqual(['runSelfSubTechniques', 'buildAreaBriefs']);

    const steps = log.filter((x) => x.startsWith('step:')).map((x) => x.slice(5));
    expect(steps).toEqual(['subs', 'briefs', 'slices', 'warm', 'families', 'oracle', 'oracle.validated', 'warm.personalizer', 'personalizer', 'personalizer.validated']);

    const firstCall = log.findIndex((x) => x.startsWith('call:'));
    const warmsBefore = log.slice(0, firstCall).filter((x) => x.startsWith('warm:'));
    expect(warmsBefore).toHaveLength(6); // five families + the Oracle
    expect(log.slice(firstCall).filter((x) => x.startsWith('call:family.'))).toHaveLength(5);
    const oracleCalls = log.filter((x) => x.startsWith('call:self.oracle.v2.'));
    expect(oracleCalls).toHaveLength(3);
    // the Oracle runs after every family reader; the Personalizer's prefix is warmed before its call
    expect(log.indexOf(oracleCalls[0]!)).toBeGreaterThan(Math.max(...log.map((x, i) => (x.startsWith('call:family.') ? i : -1))));
    const pWarm = log.lastIndexOf('step:warm.personalizer');
    expect(log[pWarm + 1]).toMatch(/^warm:/);
    expect(log.indexOf('call:self.personalizer')).toBeGreaterThan(pWarm + 1);
    expect(d.informUsed).toHaveBeenCalledTimes(5 + 3 + 1);

    // timings and tokens per agent
    expect(r.agents.map((a) => a.call)).toEqual(expect.arrayContaining(['family.rasi', 'oracle.a', 'oracle.b', 'oracle.c', 'self.personalizer']));
    expect(r.agents.every((a) => a.promptTokens === 5000 && a.cachedTokens === 4000)).toBe(true);
    expect(r.slices.find((s) => s.agent === 'self.oracle')!.prefixTokens).toBeGreaterThanOrEqual(1024);

    // stored under the two keys, and read back as the API reads it
    expect(r.stored).toEqual({ oracle: true, cards: true });
    expect(r.keys.oracle).toMatch(/^self\.v2\.oracle\|dv-1\|clock=vimsottari\|.*\|p=[0-9a-f]{24}$/);
    expect(r.keys.cards).toMatch(/^self\.v2\.cards\|clock=vimsottari\|o=[0-9a-f]{24}\|profile=profile-hash-1\|portrait=[0-9a-f]{24}\|p=[0-9a-f]{24}$/);
    const ids = [...db.outputs.values()].map((x) => String(x.technique_id));
    expect(ids.filter((x) => x === 'self.v2.oracle' || x === 'self.v2.personalizer').sort()).toEqual(['self.v2.oracle', 'self.v2.personalizer']);
    // step 2: the ten sub-technique outputs and the eleven area briefs, keyed by the stamps
    const SUBS = ['self.sub.body_facts', 'self.sub.clock', 'self.sub.mind_facts', 'self.sub.periods', 'self.sub.presence_facts', 'self.sub.profile', 'self.sub.promise', 'self.sub.risk', 'self.sub.windows', 'self.sub.year'];
    // every sub output and every area brief is keyed by the stamps and written (no per-question catalogue row is left)
    expect(r.layers.unkeyed).toEqual([]);
    expect(r.layers.stored.filter((x) => x.startsWith('self.sub.')).sort()).toEqual(SUBS);
    expect(ids.filter((x) => x.startsWith('self.sub.')).sort()).toEqual(SUBS);
    expect(r.layers.failed).toEqual([]);
    expect(r.layers.stored.filter((x) => /^self.v2./.test(x))).toHaveLength(11);
    expect(r.gaps.join(' ')).not.toMatch(/no store key/);
    const latest = await readSelfV2Latest(db.prisma, 'k-v2');
    expect(latest.status).toBe('ok');
    expect(Object.keys(latest.cards!.cards)).toHaveLength(11);
    expect(latest.cards!.hero.question).toEqual({ claimId: 'claim:stuck.work_load', text: 'Has work felt heavier lately?' });
    expect((latest.oracle!.doc.areas as Record<string, { evidence: string[] }>).stuck!.evidence).toContain('claim:stuck.work_load');
    expect(latest.briefs).toHaveLength(11);
    expect(latest.builtAt).toMatch(/^\d{4}-/);
    expect(db.builds.get('k-v2|self.v2')!.status).toBe('ready');
  });

  it('a second build with unchanged stamps stores nothing new and re-runs no agent', async () => {
    const log: string[] = [];
    const { db, deps: d } = deps(log);
    const r1 = await runSelfV2Build(d, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs() });
    const rows = db.outputs.size;
    log.length = 0;
    const r2 = await runSelfV2Build(d, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs() });
    expect(r2.status).toBe('ok');
    expect(log.filter((x) => x.startsWith('call:'))).toEqual([]);
    expect(r2.oracle!.cached).toBe(true);
    expect(r2.cards!.cached).toBe(true);
    expect(r2.stored).toEqual({ oracle: false, cards: false });
    expect(r2.layers.stored).toEqual([]);
    expect(r2.layers.cached.sort()).toEqual([...r1.layers.stored].sort());
    expect(db.outputs.size).toBe(rows);
  });

  it('a stamp that fires re-keys only the outputs it can change', async () => {
    const log: string[] = [];
    const { db, deps: d } = deps(log);
    await runSelfV2Build(d, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs() });
    const base = makeCtx();
    const next = { ...base, stamps: { ...base.stamps, subSubPeriod: '2027-02-20' } };
    const r2 = await runSelfV2Build({ ...d, prisma: db.prisma }, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs({ ctx: next }) });
    // sub-sub period: windows, risk, body facts, periods and the areas that refresh on it; the natal ones are hits
    expect(r2.layers.stored.sort()).toEqual(['self.sub.body_facts', 'self.sub.periods', 'self.sub.risk', 'self.sub.windows'].sort());
    expect(r2.layers.cached).toEqual(expect.arrayContaining(['self.sub.promise', 'self.v2.yogas', 'self.v2.lagna']));
  });

  it('a profile-only rebuild serves the stored Oracle (no family or Oracle call) and re-runs only the Personalizer', async () => {
    const log: string[] = [];
    const { db, deps: d } = deps(log);
    await runSelfV2Build(d, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs() });
    log.length = 0;
    const ctx2 = makeCtx({ profile: makeProfile({ gender: 'man', hash: 'profile-hash-2' }) });
    const r2 = await runSelfV2Build({ ...d, prisma: db.prisma }, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs({ ctx: ctx2 }) });
    expect(r2.status).toBe('ok');
    expect(r2.oracle!.cached).toBe(true);
    expect(log.filter((x) => x.startsWith('call:'))).toEqual(['call:self.personalizer']);
    expect(r2.keys.cards).toContain('profile=profile-hash-2');
    expect(r2.stored).toEqual({ oracle: false, cards: true });
  });

  it('budget_exceeded is not stored', async () => {
    process.env.SELF_READING_MAX_SPEND_USD = '0.000001';
    const log: string[] = [];
    const { db, deps: d } = deps(log);
    const r = await runSelfV2Build(d, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs() });
    expect(r.status).toBe('budget_exceeded');
    expect(r.stored).toEqual({ oracle: false, cards: false });
    expect(agentRows(db)).toBe(0);
    expect(log.some((x) => x.startsWith('call:self.oracle.v2.'))).toBe(false);
    const latest = await readSelfV2Latest(db.prisma, 'k-v2');
    expect(latest).toMatchObject({ status: 'failed', cards: null, oracle: null });
  });

  it('a failed Oracle is not stored and no Personalizer runs', async () => {
    const log: string[] = [];
    const { db, deps: d } = deps(log, {
      callGemini: async (o: { node: string }) => {
        log.push(`call:${o.node}`);
        return geminiResult(o.node.startsWith('family.') ? '- finding {planet:D1.Sa}' : 'not json');
      },
    });
    const r = await runSelfV2Build(d, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs() });
    expect(r.status).toBe('failed');
    expect(r.oracle!.status).toBe('failed');
    expect(agentRows(db)).toBe(0);
    expect(log).not.toContain('call:self.personalizer');
  });

  it('answers preparing, with no model call, while the sub-techniques wait on the engine', async () => {
    const log: string[] = [];
    const { db, deps: d } = deps(log);
    const r = await runSelfV2Build(d, { userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs({ preparing: true }) });
    expect(r.status).toBe('preparing');
    expect(log.filter((x) => x.startsWith('call:') || x.startsWith('warm:'))).toEqual([]);
    expect(db.outputs.size).toBe(0);
    expect((await readSelfV2Latest(db.prisma, 'k-v2')).status).toBe('pending');
  });
});
