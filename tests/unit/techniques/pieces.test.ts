import { afterEach, describe, expect, it } from 'vitest';
import { TECHNIQUES, techniqueById, type TechniqueDef } from '../../../src/techniques/catalog.js';
import {
  FRESHNESS_ORDER,
  bucket,
  canonicalJson,
  contractHash,
  families,
  pieces,
  recipes,
  reuseReport,
  shorter,
  techniqueCacheKey,
  techniqueFreshness,
  techniqueScope,
  validityConfig,
  validityWindow,
  windowCovers,
  type ValidityConfig,
} from '../../../src/techniques/pieces.js';

const T = (id: string): TechniqueDef => {
  const t = techniqueById(id);
  if (!t) throw new Error(`no technique ${id}`);
  return t;
};

const cfg: ValidityConfig = { transitWindowHours: 2, dashaFallbackDays: 30, annualFallbackDays: 90 };
const NOW = new Date('2026-11-06T13:37:00Z');

/** A minimal code technique for synthetic cases. */
const fake = (id: string, inputs: TechniqueDef['contract']['inputs'], extra: Partial<TechniqueDef['contract']> = {}, agents = ['digest.build']): TechniqueDef => ({
  id,
  title: id,
  category: 'general',
  board: 'chat',
  status: 'built',
  charts: [],
  algorithm: ['step'],
  source: 'test',
  code: 'test',
  agents,
  accuracy: 'none',
  selectors: {},
  contract: { inputs, system: 'none', user: [], output: 'x.v1', ...extra },
});

describe('pieces from the catalogue', () => {
  const ps = pieces();

  it('names every reader, prompt, output and agent the catalogue uses, each once', () => {
    const ids = ps.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TECHNIQUES) {
      for (const i of t.contract.inputs) expect(ids, t.id).toContain(`reader:${i.section}/${i.layout}`);
      expect(ids, t.id).toContain(`output:${t.contract.output}`);
      for (const a of t.agents) expect(ids, t.id).toContain(`agent:${a}`);
      if (t.contract.system !== 'none') expect(ids, t.id).toContain(`prompt:${t.contract.system}`);
    }
  });

  it('has no prompt piece for a code technique', () => {
    expect(ps.some((p) => p.id === 'prompt:none')).toBe(false);
  });

  it('records each technique that uses a piece once, and every filter as a variant of its reader', () => {
    for (const p of ps) {
      expect(new Set(p.usedBy).size, p.id).toBe(p.usedBy.length);
      if (p.kind !== 'reader') continue;
      const fromVariants = new Set(p.variants!.flatMap((v) => v.usedBy));
      expect([...fromVariants].sort(), p.id).toEqual([...p.usedBy].sort());
    }
  });

  it('shares the house_card reader across General Reading and the Self, Love and Work boards', () => {
    const house = ps.find((p) => p.id === 'reader:house/house_card');
    expect(house).toBeDefined();
    expect(house!.categories).toEqual(expect.arrayContaining(['general', 'self', 'love', 'work']));
    expect(house!.usedBy.length).toBeGreaterThan(10);
  });
});

describe('families: one recipe, many techniques', () => {
  it('puts every technique in exactly one family', () => {
    const fams = families();
    const members = fams.flatMap((f) => f.members);
    expect(members.length).toBe(TECHNIQUES.length);
    expect(new Set(members).size).toBe(TECHNIQUES.length);
  });

  it('groups the lucky scenarios of one area into a family', () => {
    const fam = families().find((f) => f.members.includes('lucky.work.interview'));
    expect(fam).toBeDefined();
    expect(fam!.members).toContain('lucky.work.sign_contract');
    expect(fam!.members.length).toBeGreaterThan(1);
    expect(fam!.label).toMatch(/\(\d+\)$/);
  });

  it('labels a one-member family with its id', () => {
    const a = fake('solo.one', [{ section: 'house', filter: 'D1', layout: 'house_card' }]);
    const b = fake('solo.two', [{ section: 'planet', filter: 'D1', layout: 'planet_card' }]);
    const fams = families([a, b]);
    expect(fams.map((f) => f.label).sort()).toEqual(['solo.one', 'solo.two']);
  });

  it('ignores the filter when grouping: same pieces, different filters = one family', () => {
    const a = fake('x.a', [{ section: 'house', filter: 'D1 houses 1', layout: 'house_card' }]);
    const b = fake('x.b', [{ section: 'house', filter: 'D9 houses 7', layout: 'house_card' }]);
    const fams = families([a, b]);
    expect(fams).toHaveLength(1);
    expect(fams[0].label).toBe('x.* (2)');
  });
});

describe('freshness and scope', () => {
  it('orders freshness from longest to shortest lived', () => {
    expect(shorter('natal', 'transit')).toBe('transit');
    expect(shorter('daily', 'dasha')).toBe('daily');
    expect(shorter('question', 'natal')).toBe('question');
    expect(FRESHNESS_ORDER[0]).toBe('natal');
  });

  it('reads natal-only techniques as natal and kundli scoped', () => {
    expect(techniqueFreshness(T('general.jaimini'))).toBe('natal');
    expect(techniqueScope(T('general.jaimini'))).toBe('kundli');
    expect(techniqueFreshness(T('general.strength_yoga'))).toBe('natal');
    // the digest builder also reads the year charts, so it is only as fresh as they are
    expect(techniqueFreshness(T('digest.build'))).toBe('annual');
  });

  it('takes the shortest-lived input: the Work board reads transit rows', () => {
    expect(techniqueFreshness(T('work.present_tone'))).toBe('transit');
  });

  it('marks the LLM analysts as question scoped (they read the question)', () => {
    expect(techniqueScope(T('general.dasha'))).toBe('question');
    expect(techniqueScope(T('general.validator'))).toBe('question');
  });

  it('resolves a findings input from the techniques that feed the synthesizer, and to question when none do', () => {
    const up = fake('u.reader', [{ section: 'activation', filter: 'now', layout: 'activation_row' }], { synthesizer: 's.synth' });
    const syn = fake('s.synth', [{ section: 'findings', filter: 'all', layout: 'findings_in' }]);
    expect(techniqueFreshness(syn, [up, syn])).toBe('dasha');
    expect(techniqueFreshness(syn, [syn])).toBe('question');
  });

  it('does not loop on a synthesizer cycle', () => {
    const a = fake('c.a', [{ section: 'findings', filter: 'all', layout: 'findings_in' }], { synthesizer: 'c.b' });
    const b = fake('c.b', [{ section: 'findings', filter: 'all', layout: 'findings_in' }], { synthesizer: 'c.a' });
    expect(techniqueFreshness(a, [a, b])).toBe('question');
  });

  it('has a recipe per technique with feeds matching synthesizer links', () => {
    const rs = recipes();
    expect(rs).toHaveLength(TECHNIQUES.length);
    const oracle = rs.find((r) => r.id === 'general.oracle')!;
    expect(oracle.feeds).toEqual(expect.arrayContaining(['general.dasha', 'general.jaimini']));
    for (const r of rs) for (const f of r.feeds) expect(rs.find((x) => x.id === f)!.synthesizer).toBe(r.id);
  });
});

describe('validity windows', () => {
  it('leaves a natal output open-ended', () => {
    const w = validityWindow(T('general.jaimini'), { now: NOW }, cfg);
    expect(w.to).toBeNull();
    expect(windowCovers(w, NOW)).toBe(true);
  });

  it('aligns a transit output to a 2-hour epoch bucket', () => {
    const w = validityWindow(T('work.present_tone'), { now: NOW }, cfg);
    expect(w.from.toISOString()).toBe('2026-11-06T12:00:00.000Z');
    expect(w.to!.toISOString()).toBe('2026-11-06T14:00:00.000Z');
    const later = validityWindow(T('work.present_tone'), { now: new Date('2026-11-06T13:59:59Z') }, cfg);
    expect(later.from.getTime()).toBe(w.from.getTime());
    const next = validityWindow(T('work.present_tone'), { now: new Date('2026-11-06T14:00:00Z') }, cfg);
    expect(next.from.toISOString()).toBe('2026-11-06T14:00:00.000Z');
  });

  it('uses the running period when it holds now, and the fallback bucket when it does not', () => {
    const dashaOnly = fake('d.only', [{ section: 'activation', filter: 'now', layout: 'activation_row' }]);
    const period = { from: new Date('2026-03-01T00:00:00Z'), to: new Date('2027-08-01T00:00:00Z') };
    const w = validityWindow(dashaOnly, { now: NOW, runningPeriod: period }, cfg, [dashaOnly]);
    expect(w.freshness).toBe('dasha');
    expect(w.from).toEqual(period.from);
    expect(w.to).toEqual(period.to);

    const ended = { from: new Date('2025-01-01T00:00:00Z'), to: new Date('2026-01-01T00:00:00Z') };
    const fb = validityWindow(dashaOnly, { now: NOW, runningPeriod: ended }, cfg, [dashaOnly]);
    expect(fb.to!.getTime() - fb.from.getTime()).toBe(30 * 86_400_000);
    expect(windowCovers(fb, NOW)).toBe(true);

    const invalid = { from: new Date('nope'), to: new Date('2027-01-01T00:00:00Z') };
    const inv = validityWindow(dashaOnly, { now: NOW, runningPeriod: invalid }, cfg, [dashaOnly]);
    expect(inv.to!.getTime() - inv.from.getTime()).toBe(30 * 86_400_000);
  });

  it('uses the UTC day for a panchang technique without a local day', () => {
    const w = validityWindow(T('lucky.day_tables'), { now: NOW }, cfg);
    expect(w.freshness).toBe('daily');
    expect(w.from.toISOString()).toBe('2026-11-06T00:00:00.000Z');
    expect(w.to!.toISOString()).toBe('2026-11-07T00:00:00.000Z');
  });

  it('gives a question-fresh technique an empty window that covers nothing', () => {
    const w = validityWindow(T('general.prashna'), { now: NOW }, cfg);
    expect(w.freshness).toBe('question');
    expect(windowCovers(w, NOW)).toBe(false);
  });

  it('reads the env for its config', () => {
    const before = process.env.TECHNIQUE_TRANSIT_WINDOW_HOURS;
    process.env.TECHNIQUE_TRANSIT_WINDOW_HOURS = '6';
    try {
      expect(validityConfig().transitWindowHours).toBe(6);
      process.env.TECHNIQUE_TRANSIT_WINDOW_HOURS = '999';
      expect(validityConfig().transitWindowHours).toBe(24);
      process.env.TECHNIQUE_TRANSIT_WINDOW_HOURS = 'abc';
      expect(validityConfig().transitWindowHours).toBe(2);
    } finally {
      if (before === undefined) delete process.env.TECHNIQUE_TRANSIT_WINDOW_HOURS;
      else process.env.TECHNIQUE_TRANSIT_WINDOW_HOURS = before;
    }
  });

  it('buckets are half-open', () => {
    const b = bucket(new Date('2026-11-06T14:00:00Z'), 7_200_000);
    expect(windowCovers(b, b.to)).toBe(false);
    expect(windowCovers(b, b.from)).toBe(true);
  });
});

describe('cache keys', () => {
  afterEach(() => {
    delete process.env.TECHNIQUE_CACHE_VERSION;
  });

  const key = (t: TechniqueDef, now: Date, extra: Record<string, unknown> = {}) =>
    techniqueCacheKey({ technique: t, kundliId: 'k1', digestVersion: 'd3', window: validityWindow(t, { now }, cfg), ...extra });

  it('is stable inside a window and changes in the next', () => {
    const t = T('work.present_tone');
    const a = key(t, NOW);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(key(t, new Date('2026-11-06T12:00:01Z'))).toBe(a);
    expect(key(t, new Date('2026-11-06T14:00:01Z'))).not.toBe(a);
  });

  it('changes with the kundli, the digest version and the cache version', () => {
    const t = T('general.jaimini');
    const w = validityWindow(t, { now: NOW }, cfg);
    const base = techniqueCacheKey({ technique: t, kundliId: 'k1', digestVersion: 'd3', window: w });
    expect(techniqueCacheKey({ technique: t, kundliId: 'k2', digestVersion: 'd3', window: w })).not.toBe(base);
    expect(techniqueCacheKey({ technique: t, kundliId: 'k1', digestVersion: 'd4', window: w })).not.toBe(base);
    process.env.TECHNIQUE_CACHE_VERSION = '2';
    expect(techniqueCacheKey({ technique: t, kundliId: 'k1', digestVersion: 'd3', window: w })).not.toBe(base);
  });

  it('changes when the contract changes', () => {
    const t = T('general.jaimini');
    const changed: TechniqueDef = { ...t, contract: { ...t.contract, output: 'kundli_digest.v2' } };
    expect(contractHash(changed)).not.toBe(contractHash(t));
    const w = validityWindow(t, { now: NOW }, cfg);
    expect(techniqueCacheKey({ technique: changed, kundliId: 'k1', digestVersion: 'd3', window: w })).not.toBe(
      techniqueCacheKey({ technique: t, kundliId: 'k1', digestVersion: 'd3', window: w }),
    );
  });

  it('refuses a question-fresh output, a missing kundli or digest version, and a question scope without a hash', () => {
    expect(key(T('general.prashna'), NOW, { questionHash: 'q' })).toBeNull();
    const t = T('general.jaimini');
    const w = validityWindow(t, { now: NOW }, cfg);
    expect(techniqueCacheKey({ technique: t, kundliId: '', digestVersion: 'd3', window: w })).toBeNull();
    expect(techniqueCacheKey({ technique: t, kundliId: 'k1', digestVersion: '', window: w })).toBeNull();
    const dasha = T('general.dasha');
    expect(techniqueScope(dasha)).toBe('question');
    expect(key(dasha, NOW)).toBeNull();
    const withQ = key(dasha, NOW, { questionHash: 'abc' });
    expect(withQ).toMatch(/^[0-9a-f]{64}$/);
    expect(key(dasha, NOW, { questionHash: 'abd' })).not.toBe(withQ);
  });

  it('canonical JSON ignores key order', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe('reuse report', () => {
  it('adds up', () => {
    const r = reuseReport();
    expect(r.techniques).toBe(TECHNIQUES.length);
    const kinds = Object.values(r.byKind);
    expect(kinds.reduce((n, k) => n + k.total, 0)).toBe(r.pieces);
    expect(kinds.reduce((n, k) => n + k.shared, 0)).toBe(r.shared);
    expect(r.shared + r.singleUse.length).toBe(r.pieces);
    expect(Object.values(r.freshness).reduce((n, x) => n + x, 0)).toBe(TECHNIQUES.length);
    expect(r.scope.kundli + r.scope.question).toBe(TECHNIQUES.length);
    expect(r.inFamilies).toBeLessThanOrEqual(TECHNIQUES.length);
  });

  it('handles an empty catalogue', () => {
    const r = reuseReport([]);
    expect(r).toMatchObject({ techniques: 0, pieces: 0, shared: 0, families: 0, inFamilies: 0 });
    expect(pieces([])).toEqual([]);
    expect(families([])).toEqual([]);
  });
});
