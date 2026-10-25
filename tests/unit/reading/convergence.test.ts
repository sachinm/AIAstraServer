import { beforeEach, describe, expect, it } from 'vitest';
import { applyDeciders, convergence, fortuneTier, nowAndNext, renderBrief } from '../../../src/reading/nodes/convergence.js';
import { findingCacheKey, findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import type { Finding } from '../../../src/reading/nodes/specialists.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const req = { transitRequired: true, missingRequired: [] as never[] };

describe('convergence rule (file 11 §1)', () => {
  it('strong when promise, timing and trigger all support', () => {
    expect(convergence({ L1: 2, L2: 1, L3: 2 }, req)).toMatchObject({ level: 'strong', agreement: 'converge', score: 3 * 2 + 2 * 1 + 2 * 2 });
  });
  it('a denied promise is not indicated whatever the transits say', () => {
    expect(convergence({ L1: -2, L2: 3, L3: 3 }, req).level).toBe('not_indicated');
  });
  it('moderate when two of three support and none is hard negative', () => {
    expect(convergence({ L1: 2, L2: 1, L3: 0 }, req).level).toBe('moderate');
    expect(convergence({ L1: 2, L2: 1, L3: -2 }, req).level).toBe('weak');
  });
  it('weak when only one supports', () => {
    expect(convergence({ L1: 1, L2: 0, L3: 0 }, req).level).toBe('weak');
  });
  it('mixed when the promise holds but timing and trigger point opposite ways', () => {
    expect(convergence({ L1: 1, L2: -1, L3: -1 }, req).level).toBe('weak');
    expect(convergence({ L1: 0, L2: -1, L3: -1 }, req).level).toBe('not_indicated');
  });
  it('a missing required layer caps the verdict at weak', () => {
    const v = convergence({ L1: 3, L2: 3, L3: 3 }, { transitRequired: true, missingRequired: ['L3'] as never[] });
    expect(v.level).toBe('weak');
    expect(v.caps[0]).toMatch(/missing L3/);
  });
  it('transit is not required for long horizons', () => {
    expect(convergence({ L1: 2, L2: 2 }, { transitRequired: false, missingRequired: [] }).level).toBe('strong');
  });
  it('agreement: converge, partial, diverge', () => {
    expect(convergence({ L1: 1, L2: 1, L3: 1 }, req).agreement).toBe('converge');
    expect(convergence({ L1: 1, L2: 1, L3: -1 }, req).agreement).toBe('partial');
    expect(convergence({ L1: 1, L2: -1 }, req).agreement).toBe('partial');
  });
});

const claim = (polarity: 'supports' | 'obstructs', evidence: string[], weight = 2) => ({ text: 'x x x', evidence, polarity, weight, tradition: 'parashara' as const });
const promise = (claims: ReturnType<typeof claim>[], verdict: Finding['verdict'] = 'mixed', layerScore = 0): Finding => ({ analyst: 'promise', subject: 'marriage_relationship', verdict, layerScore, claims, windows: [], caveats: [], keyFacts: [] });

describe('deciders (file 11 §3)', () => {
  it('a split promise is settled by the D-9 deciders for marriage', () => {
    const f = promise([claim('obstructs', ['detail.houses.7.occupants']), claim('supports', ['varga.D9.d1_lords.7.varga_house'])]);
    const r = applyDeciders(f, 'marriage_relationship');
    expect(r.L1).toBeGreaterThan(0);
    expect(r.used).toContain('varga.D9.d1_lords.7.varga_house');
  });
  it('a clear promise keeps its own layer score', () => {
    const f = promise([claim('supports', ['detail.houses.7.lord'])], 'strong', 3);
    expect(applyDeciders(f, 'marriage_relationship')).toEqual({ L1: 3, used: [] });
  });
});

describe('fortune tier and now/next (fields only)', () => {
  const d = loadG1Dossier();
  const t = loadG1Transits();
  it('reads the 9th house, Jupiter, the running periods and the transits into a tier', () => {
    const f = fortuneTier(d, t, G1_AS_OF);
    expect(['rising', 'steady', 'testing', 'heavy']).toContain(f.tier);
    expect(f.until).toBe('2027-09-07');
    expect(Object.keys(f.inputs).sort()).toEqual(['dasha', 'jupiter', 'ninth', 'transit']);
  });
  it('now is the running AD; next is the following AD from the dated list', () => {
    const nn = nowAndNext(d, G1_AS_OF);
    expect(nn.now).toMatchObject({ md: 'Sa', ad: 'Ke', until: '2027-09-07' });
    expect(nn.next?.from).toBe('2027-09-07');
    expect(nn.next).toEqual({ from: '2027-09-07', to: '2030-03-20', mdAd: 'Sa-Ve' });
  });
  it('the rendered brief names template, verdict, layers, now, next and windows', () => {
    const text = renderBrief({
      template: 'T2', subjects: ['marriage_relationship'], horizon: '1y', question: 'q', verdict: { level: 'moderate', agreement: 'partial', score: 7, caps: [] }, layers: { L1: 2, L2: 1 },
      deciders: null, now: { md: 'Sa', ad: 'Ke', until: '2027-09-07' }, next: null, windows: [{ from: '2026-11-01', to: '2027-01-31', label: 'Ve AD', polarity: 'favourable', source: 'combined' }],
      keyFacts: ['7th lord Jupiter in 10th'], caveats: [], fortune: { tier: 'steady', until: '2027-09-07' }, traditions: ['parashara', 'jaimini'],
    });
    expect(text).toMatch(/^TEMPLATE: T2/);
    expect(text).toMatch(/VERDICT: moderate \(agreement partial\)/);
    expect(text).toMatch(/LAYERS: L1=2 L2=1/);
    expect(text).toMatch(/NOW: Sa-Ke until 2027-09-07/);
    expect(text).toMatch(/- 2026-11-01 to 2027-01-31 \| favourable/);
    expect(text).toMatch(/TRADITIONS APPLIED: parashara, jaimini/);
  });
});

describe('findings cache', () => {
  beforeEach(() => findingsCache.clear());
  it('natal layers ignore the period; timing layers do not', () => {
    const base = { dossierHash: 'h', subject: 'career_work', asOf: G1_AS_OF };
    expect(findingCacheKey({ ...base, analyst: 'promise', horizon: '6m' })).toBe(findingCacheKey({ ...base, analyst: 'promise', horizon: '3y' }));
    expect(findingCacheKey({ ...base, analyst: 'dasha', horizon: '6m' })).not.toBe(findingCacheKey({ ...base, analyst: 'dasha', horizon: '3y' }));
    expect(findingCacheKey({ ...base, analyst: 'promise', horizon: '6m' })).not.toBe(findingCacheKey({ ...base, dossierHash: 'h2', analyst: 'promise', horizon: '6m' }));
  });
  it('stores, hits and counts', () => {
    findingsCache.set('k', promise([]));
    expect(findingsCache.get('k')).toBeTruthy();
    expect(findingsCache.get('missing')).toBeUndefined();
    expect(findingsCache.hits).toBe(1);
    expect(findingsCache.misses).toBe(1);
  });
});
