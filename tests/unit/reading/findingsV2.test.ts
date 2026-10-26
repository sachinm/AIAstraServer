import { afterEach, describe, expect, it } from 'vitest';
import { readingFindingsV2 } from '../../../src/reading/config.js';
import { renderBrief } from '../../../src/reading/nodes/convergence.js';
import { reconcile } from '../../../src/reading/nodes/reconcile.js';
import { findingZ, FINDING_RESPONSE_SCHEMA_V2, type Finding } from '../../../src/reading/nodes/specialists.js';
import { buildEvidencePack } from '../../../src/reading/packs/selector.js';
import { PROMPTS } from '../../../src/reading/prompts/generated.js';
import type { Intent } from '../../../src/reading/types.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();
const pack = () => buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent: { horizon: '1y', mentionsPlanets: [], focusPoints: [] } });

afterEach(() => {
  delete process.env.READING_FINDINGS;
});

describe('READING_FINDINGS=v2', () => {
  it('is off unless set to v2', () => {
    expect(readingFindingsV2()).toBe(false);
    process.env.READING_FINDINGS = 'v2';
    expect(readingFindingsV2()).toBe(true);
  });

  it('ships the five rewritten prompts', () => {
    for (const k of ['promise', 'dasha', 'transit', 'nakshatra', 'synth']) expect(PROMPTS[`v2/${k}`]?.length).toBeGreaterThan(200);
    expect(PROMPTS['v2/promise']).toMatch(/culprits/);
    expect(PROMPTS['v2/dasha']).toMatch(/fruit/);
  });

  it('parses the new fields tolerantly and keeps v1 answers valid', () => {
    const v1 = findingZ.parse({ verdict: 'strong', layerScore: 2, claims: [], windows: [], caveats: [], keyFacts: [] });
    expect(v1.culprits).toEqual([]);
    expect(v1.form).toBe('');
    const v2 = findingZ.parse({
      verdict: 'mixed', layerScore: 9, claims: [{ text: 'Saturn aspects the 10th', evidence: ['detail.houses.10.lord'], polarity: 'obstructs', weight: 0, tradition: 'parashara' }],
      windows: [{ from: '2026-11-01', to: '2027-01-01', label: 'x', polarity: 'favourable', evidence: [], lord: 'Ve', cls: 'bogus', fruit: 'y'.repeat(300) }],
      caveats: [], keyFacts: [], form: 'service work', culprits: ['Sa', 'Sa', 'XX', 'Ra'], contributors: ['Ju'],
    });
    expect(v2.layerScore).toBe(0);
    expect(v2.claims[0]!.weight).toBe(2);
    expect(v2.windows[0]!.cls).toBe('neutral');
    expect(v2.windows[0]!.fruit.length).toBe(160);
    expect(v2.culprits).toEqual(['Sa', 'Ra']);
    expect(FINDING_RESPONSE_SCHEMA_V2.required).toContain('culprits');
  });

  it('adds star lords, the dasha lord record and the transit legend to the pack only under v2', () => {
    const v1 = pack();
    expect((v1.sections.base as any).nakshatra.star_lords).toBeUndefined();
    expect((v1.sections.transits as any)?.legend).toBeUndefined();
    process.env.READING_FINDINGS = 'v2';
    const p = pack();
    expect((p.sections.base as any).nakshatra.star_lords).toBeDefined();
    const lords = (p.sections.dasha as any).lords as Record<string, { h?: number; owns?: number[] }>;
    expect(Object.values(lords).some((l) => typeof l.h === 'number' && Array.isArray(l.owns))).toBe(true);
    if (p.sections.transits) expect((p.sections.transits as any).legend).toMatch(/influences_houses/);
  });

  it('puts form, culprits, contributors and window fruit into the brief', () => {
    process.env.READING_FINDINGS = 'v2';
    const p = pack();
    const d = (p.sections.dasha as any).periods as Record<string, { from: string; to: string }>;
    const [key, row] = Object.entries(d)[0]!;
    const base: Omit<Finding, 'analyst'> = { subject: 'career_work', verdict: 'moderate', layerScore: 1, status: 'ok', claims: [], windows: [], caveats: [], keyFacts: [] };
    const findings: Finding[] = [
      { ...base, analyst: 'promise', form: 'work through advisory roles', culprits: ['Sa'], contributors: ['Ju', 'Sa'], claims: [{ text: 'D-10 lagna is supportive', evidence: ['varga.D10.lagna'], polarity: 'supports', weight: 2, tradition: 'parashara' }] },
      { ...base, analyst: 'dasha', culprits: ['Sa', 'Zz' as string], contributors: ['Ve'], windows: [{ from: row.from, to: row.to, label: 'period', polarity: 'favourable', evidence: [`dasha.periods.${key}.from`], lord: 'Ve', cls: 'deliverer', fruit: 'gives 10th-house results' }] },
    ];
    const intent = { subjects: [{ id: 'career_work', weight: 1 }], horizon: '1y', focusPoints: [], mentionsPlanets: [], questionType: 'timing', format: 'T2' } as unknown as Intent;
    const r = reconcile({ findings, packs: { career_work: p }, intent, asOf: G1_AS_OF, keyFacts: '' });
    expect(r.synthBrief.form).toBe('work through advisory roles');
    expect(r.synthBrief.culprits).toEqual([{ planet: 'Sa', layers: ['promise', 'dasha'] }]);
    expect(r.synthBrief.contributors?.map((c) => c.planet)).toEqual(['Ju', 'Ve']);
    const text = renderBrief(r.synthBrief);
    expect(text).toMatch(/FORM: work through advisory roles/);
    expect(text).toMatch(/CULPRITS: Sa \(promise, dasha\)/);
    expect(text).toMatch(/\| gives 10th-house results/);
    expect(r.agreement[0]!.dasha).toBe('deliverer');
  });
});
