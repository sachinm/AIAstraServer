import { describe, expect, it } from 'vitest';
import { FRAMES, SUBJECT_IDS, horizonRange } from '../../../src/reading/packs/frames.js';
import {
  ANALYST_SECTIONS,
  buildEvidencePack,
  hashPack,
  listEvidenceIds,
  mergeSubjectPacks,
  renderBase,
  renderPack,
  renderSubject,
  resolveEvidence,
} from '../../../src/reading/packs/selector.js';
import { selectTransits } from '../../../src/reading/packs/transitTable.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const dossier = loadG1Dossier();
const transits = loadG1Transits();
const mk = (subject: (typeof SUBJECT_IDS)[number], horizon: any = '1y', mentions: string[] = []) =>
  buildEvidencePack({ dossier, transits, subject, asOf: G1_AS_OF, intent: { horizon, mentionsPlanets: mentions, focusPoints: [] } });

describe('frames', () => {
  it('has a frame for every subject with at least one house and consistent ids', () => {
    for (const id of SUBJECT_IDS) {
      expect(FRAMES[id].id).toBe(id);
      expect(FRAMES[id].houses.length).toBeGreaterThan(0);
    }
  });
  it('maps horizons to ranges from as_of', () => {
    expect(horizonRange('3m', '2026-10-24')).toMatchObject({ from: '2026-10-24', to: '2027-01-24', months: 3 });
    expect(horizonRange('1y', '2026-10-24').to).toBe('2027-10-24');
    expect(horizonRange({ from: '2026-10-24', to: '2026-12-31' }, '2026-10-24').months).toBe(2);
  });
});

describe('buildEvidencePack: career_work on G1', () => {
  const pack = mk('career_work', '1y');
  it('frames the 10th, 6th and 1st with their lords and the D-10', () => {
    expect(pack.keyFrame.houses).toEqual([10, 6, 1]);
    expect(pack.keyFrame.vargas).toEqual(['D10']);
    const s = pack.sections as any;
    expect(s.detail.houses['10'].lord).toBe('Me');
    expect(s.frame.chara.AmK).toBe('Mo');
    expect(s.varga.D10.lagna_lord).toBeDefined();
    expect(s.varga.D10.d1_lords['10'].lord).toBe('Me');
    expect(typeof s.varga.D10.d1_lords['10'].varga_house).toBe('number');
  });
  it('always carries the whole D-1 skeleton', () => {
    const s = pack.sections as any;
    expect(Object.keys(s.base.houses)).toHaveLength(12);
    expect(Object.keys(s.base.bodies)).toEqual(expect.arrayContaining(['La', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']));
  });
  it('puts current MD/AD/PD in the header and dated periods in the horizon', () => {
    const s = pack.sections as any;
    expect(s.frame.running.md).toBe('Sa');
    expect(s.frame.running.ad).toBe('Ke');
    const keys = Object.keys(s.dasha.periods);
    expect(keys.length).toBeGreaterThan(3);
    for (const k of keys) expect(s.dasha.periods[k].to >= '2026-10-24' && s.dasha.periods[k].from <= '2027-10-24').toBe(true);
    expect(s.dasha.lords.Sa).toBeDefined();
  });
  it('is byte-identical across two builds (stable prefix)', () => {
    expect(renderPack(mk('career_work', '1y'))).toBe(renderPack(mk('career_work', '1y')));
    expect(hashPack(mk('career_work', '1y'))).toBe(hashPack(mk('career_work', '1y')));
  });
  it('keeps the per-user stable sections ahead of the horizon-dependent ones', () => {
    const text = renderPack(pack);
    const order = ['"base"', '"frame"', '"detail"', '"varga"', '"dasha"', '"transits"'].map((k) => text.indexOf(k));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it('stays within the single-subject token budget', () => {
    expect(pack.stats.approxTokens).toBeGreaterThan(3000);
    expect(pack.stats.approxTokens).toBeLessThan(13000);
  });
  it('shares the stable sections between two horizons', () => {
    const a = pack.sections as any;
    const b = mk('career_work', '6m').sections as any;
    expect(JSON.stringify(a.base)).toBe(JSON.stringify(b.base));
    expect(JSON.stringify(a.detail)).toBe(JSON.stringify(b.detail));
    expect(JSON.stringify(a.varga)).toBe(JSON.stringify(b.varga));
  });
});

describe('cacheable base prefix', () => {
  it('is byte-identical across subjects and horizons for the same chart', () => {
    const a = renderBase(mk('career_work', '1y'));
    expect(renderBase(mk('property_home', '3y'))).toBe(a);
    expect(renderBase(mk('marriage_relationship', '6m', ['Ju']))).toBe(a);
  });
  it('is large enough to be worth caching with the system prompt (>= ~1.5k tokens) and excludes subject data', () => {
    const a = renderBase(mk('career_work', '1y'));
    expect(a.length / 3.6).toBeGreaterThan(1500);
    expect(a).not.toContain('d1_lords');
    expect(a).not.toContain('"horizon"');
  });
  it('renderSubject plus renderBase carry every section once', () => {
    const p = mk('career_work', '1y');
    expect(Object.keys(JSON.parse(renderBase(p)))).toEqual(['base']);
    expect(Object.keys(JSON.parse(renderSubject(p)))).toEqual(['frame', 'detail', 'varga', 'arudha', 'dasha', 'transits']);
  });
});

describe('subject-specific varga selection (D-1 bias fix)', () => {
  it('property_home uses D-4, marriage D-9, income D-2', () => {
    expect(Object.keys((mk('property_home').sections as any).varga)).toEqual(['D4']);
    expect(Object.keys((mk('marriage_relationship').sections as any).varga)).toEqual(['D9']);
    expect(Object.keys((mk('income_wealth').sections as any).varga)).toEqual(['D2']);
  });
  it('health carries the D-30 caveat', () => {
    expect((mk('health_body').sections as any).frame.caveat).toMatch(/D-30/);
  });
  it('lottery carries the gain-window caveat', () => {
    expect((mk('speculation_lottery').sections as any).frame.caveat).toMatch(/no outcome is promised/);
  });
});

describe('evidence ids', () => {
  const pack = mk('property_home', '3y');
  it('resolve to values inside the pack', () => {
    expect(resolveEvidence(pack, 'detail.houses.4.lord')).toBeDefined();
    expect(resolveEvidence(pack, 'varga.D4.d1_lords.4.varga_house')).toBeTypeOf('number');
    expect(resolveEvidence(pack, 'detail.houses.4.nope')).toBeUndefined();
    expect(resolveEvidence(pack, 'varga.D10.lagna')).toBeUndefined();
  });
  it('lists leaf ids that all resolve', () => {
    const ids = listEvidenceIds(pack);
    expect(ids.length).toBeGreaterThan(200);
    for (const id of ids.slice(0, 400)) expect(resolveEvidence(pack, id)).not.toBeUndefined();
  });
});

describe('analyst section routing', () => {
  const pack = mk('career_work', '1y');
  it('gives each analyst only its sections', () => {
    const present = (a: keyof typeof ANALYST_SECTIONS) => ANALYST_SECTIONS[a].filter((s) => (pack.sections as any)[s] !== undefined);
    expect(Object.keys(JSON.parse(renderPack(pack, 'promise')))).toEqual(present('promise'));
    const tr = JSON.parse(renderPack(pack, 'transit'));
    expect(tr.transits).toBeDefined();
    expect(tr.varga).toBeUndefined();
    expect(JSON.parse(renderPack(pack, 'promise')).transits).toBeUndefined();
  });
  it('analyst renders are smaller than the single-call render', () => {
    expect(renderPack(pack, 'promise').length).toBeLessThan(renderPack(pack, 'single').length);
  });
});

describe('mergeSubjectPacks', () => {
  it('keeps one d1 and nests subject sections', () => {
    const merged = mergeSubjectPacks([mk('career_work'), mk('income_wealth')]);
    const s = merged.sections as any;
    expect(s.base.houses).toBeDefined();
    expect(Object.keys(s.detail)).toEqual(['career_work', 'income_wealth']);
    expect(Object.keys(s.frame)).toEqual(['career_work', 'income_wealth']);
    expect(merged.keyFrame.houses).toEqual(expect.arrayContaining([10, 2, 11]));
  });
});

describe('selectTransits', () => {
  it('Q5: finds Ketu over natal Jupiter even beyond a 6-month horizon', () => {
    const t = selectTransits({ chart: transits, frameHouses: [1, 9, 10], interestingNatal: ['Ju', 'Me'], horizon: horizonRange('6m', G1_AS_OF), mentionsPlanets: ['Ke', 'Ju'] });
    const hit = t.focus_hits.find((h) => h.planet === 'Ke' && h.over_natal.includes('Ju'));
    expect(hit).toBeDefined();
    expect(hit!.from).toBe('2028-06-24');
    expect(hit!.in_horizon).toBe(false);
    expect(t.rows['Ke_2026-10-24']).toBeDefined();
  });
  it('clips rows to the horizon and keeps slow planets plus Mars for short horizons', () => {
    const t = selectTransits({ chart: transits, frameHouses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], interestingNatal: ['Me'], horizon: horizonRange('3m', G1_AS_OF) });
    for (const r of Object.values(t.rows)) {
      expect(r.from >= '2026-10-24').toBe(true);
      expect(r.to <= '2027-01-24').toBe(true);
    }
    expect(Object.values(t.rows).some((r) => r.planet === 'Sa')).toBe(true);
    expect(Object.values(t.rows).some((r) => r.planet === 'Ma')).toBe(true);
  });
  it('restricts double transit to frame houses', () => {
    const t = selectTransits({ chart: transits, frameHouses: [7], interestingNatal: [], horizon: horizonRange('1y', G1_AS_OF) });
    expect(t.double_transit.length).toBeGreaterThan(0);
    for (const d of t.double_transit) expect(d.houses).toEqual([7]);
  });
  it('reports no Sade Sati for G1 in the next year', () => {
    const t = selectTransits({ chart: transits, frameHouses: [10], interestingNatal: [], horizon: horizonRange('1y', G1_AS_OF) });
    expect(t.sade_sati.now).toBeNull();
    expect(t.sade_sati.periods).toEqual([]);
  });
});
