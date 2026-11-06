import { describe, expect, it } from 'vitest';
import { loadG1TimelineInputs, G1_AS_OF } from '../../../helpers/readingFixtures.js';
import { buildTimelineSpan, buildPastTimeline } from '../../../../src/reading/timeline/pipeline.js';
import { careerMap, presentState, securityGrade, FAMILIES } from '../../../../src/reading/area/career.js';
import { careerSpan, fitsStatus } from '../../../../src/reading/area/careerService.js';
import type { MonthCell } from '../../../../src/reading/timeline/converge.js';
import type { PastBuild } from '../../../../src/reading/timeline/pipeline.js';

const inputs = loadG1TimelineInputs();
const span = careerSpan(G1_AS_OF);
const build = buildTimelineSpan(inputs, span, { env: { TIMELINE_ENABLED: '1' } });

describe('the span build', () => {
  it('covers 24 months back to 24 months ahead of the month of asOf', () => {
    expect(span).toEqual({ from: '2024-10-01', to: '2028-10-31' });
    expect(build.grid.months[0]).toBe('2024-10');
    expect(build.grid.months.at(-1)).toBe('2028-10');
    expect(build.grid.months).toHaveLength(49);
  });
  it('agrees with the past build month by month on the activations it shares', () => {
    const past = buildPastTimeline(inputs, { env: { TIMELINE_ENABLED: '1' } });
    const shared = (b: PastBuild) => b.activations.filter((a) => a.from >= '2025-01-01' && a.to <= '2026-06-01' && a.system === 'S1').map((a) => `${a.marker}:${a.planet}:${a.from}:${a.polarity}`).sort();
    expect(shared(build)).toEqual(shared(past));
  });
});

describe('the career map on G1', () => {
  const map = careerMap(build, G1_AS_OF);
  it('states a tone, a confidence and five family votes', () => {
    expect(['demanding', 'easing', 'steady', 'closing', 'open']).toContain(map.present.tone);
    expect(['confirmed', 'likely', 'split']).toContain(map.present.confidence);
    expect(map.present.votes.map((v) => v.family)).toEqual(FAMILIES.map((f) => f.id));
    expect(map.present.available).toBeGreaterThan(0);
  });
  it('lists only windows that end after the start of this month, sorted by start', () => {
    for (const w of map.ahead) expect(w.to >= '2026-10-01').toBe(true);
    const froms = map.ahead.map((w) => w.from);
    expect([...froms].sort()).toEqual(froms);
  });
  it('labels every window with a known sub-area and a side', () => {
    for (const w of map.ahead) {
      expect(['get_job', 'job_change', 'promotion', 'job_security', 'abroad', 'pay', 'business']).toContain(w.subarea);
      expect(w.side === 'test').toBe(w.subarea === 'job_security');
    }
  });
  it('has four horizons, and the far rungs show only moderate or stronger windows', () => {
    expect(map.horizons.map((h) => h.months)).toEqual([1, 3, 6, 12]);
    for (const h of map.horizons.filter((x) => x.months >= 6)) for (const w of [h.best, h.hardest]) if (w) expect(['moderate', 'high']).toContain(w.band);
  });
  it('grades security for 13 months from now', () => {
    expect(map.security).toHaveLength(13);
    expect(map.security[0]!.month).toBe('2026-10');
  });
  it('picks at most three Looking-back moments inside the last 12 months', () => {
    expect(map.back.length).toBeLessThanOrEqual(3);
    for (const b of map.back) expect(b.month >= '2025-10' && b.month < '2026-10').toBe(true);
  });
});

/** Synthetic cells to pin the tone rules of doc 43 §8. */
function cell(month: string, o: Partial<MonthCell> & { sys?: Record<string, [number, number, string?]> }): MonthCell {
  const systems: MonthCell['systems'] = {};
  for (const [s, [sup, tst, p]] of Object.entries(o.sys ?? {})) systems[s as 'S1'] = { support: sup, test: tst, planet: p ?? 'Ju', evidence: [] };
  return { month, marker: 'career', band: 'quiet', testing: false, supportScore: 0, testScore: 0, support: { D: 0, T: 0, E: 1, score: 0 }, test: { D: 0, T: 0, E: 1, score: 0 }, families: [], agent: null, channel: null, ...o, systems } as MonthCell;
}
const fakeBuild = {
  systems: ['S1', 'S2', 'S3', 'S4', 'S6', 'S6D', 'S7'],
  activations: ['S1', 'S2', 'S3', 'S4', 'S6', 'S7'].map((s) => ({ system: s })),
  foundation: { houses: { 9: { lord: 'Me' }, 5: { lord: 'Ve' }, 6: { lord: 'Ma' }, 8: { lord: 'Sa' }, 12: { lord: 'Mo' } }, specialLagnas: {} },
} as unknown as PastBuild;

describe('tone rules', () => {
  const SUP = { S1: [3, 0], S4: [2, 0], S6: [2, 0], S7: [0.5, 0] } as Record<string, [number, number]>;
  const TST = { S1: [0, 3, 'Ve'], S4: [0, 2], S6: [0, 2, 'Sa'], S7: [0, 0.5] } as Record<string, [number, number, string?]>;
  it('open: a moderate support band now with three families agreeing; confirmed when the main clock agrees', () => {
    const cells = ['2026-09', '2026-10', '2026-11', '2026-12'].map((m) => cell(m, { band: 'moderate', sys: SUP }));
    const p = presentState(fakeBuild, cells, 1);
    expect(p.tone).toBe('open');
    expect(p.confidence).toBe('confirmed');
    expect(p.window_end).toBe('2026-12-31');
  });
  it('closing: support ends this month and a test follows', () => {
    const cells = [cell('2026-09', { band: 'moderate', sys: SUP }), cell('2026-10', { band: 'moderate', sys: SUP }), cell('2026-11', { band: 'moderate', testing: true, sys: TST }), cell('2026-12', { band: 'moderate', testing: true, sys: TST })];
    expect(presentState(fakeBuild, cells, 1).tone).toBe('closing');
  });
  it('demanding: a risk-graded test with an end lord, and the ease date is the first month after the test run', () => {
    const cells = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'].map((m, i) => cell(m, i < 3 ? { band: 'moderate', testing: true, sys: TST } : { band: 'possible' }));
    const p = presentState(fakeBuild, cells, 1);
    expect(p.security).toBe('risk');
    expect(p.tone).toBe('demanding');
    expect(p.ease_date).toBe('2026-12-01');
  });
  it('easing: the test run ends now and nothing hard follows', () => {
    const cells = ['2026-09', '2026-10', '2026-11', '2026-12'].map((m, i) => cell(m, i < 2 ? { band: 'moderate', testing: true, sys: TST } : { band: 'quiet' }));
    expect(presentState(fakeBuild, cells, 1).tone).toBe('easing');
  });
  it('steady: nothing moderate either way', () => {
    const cells = ['2026-09', '2026-10', '2026-11'].map((m) => cell(m, { band: 'possible' }));
    expect(presentState(fakeBuild, cells, 1).tone).toBe('steady');
  });
  it('split when the families disagree', () => {
    const MIX = { S1: [3, 0], S4: [0, 2], S6: [0, 2, 'Sa'], S7: [0.5, 0] } as Record<string, [number, number, string?]>;
    const cells = ['2026-09', '2026-10', '2026-11'].map((m) => cell(m, { band: 'possible', sys: MIX }));
    expect(presentState(fakeBuild, cells, 1).confidence).toBe('split');
  });
});

describe('security grades (doc 43 §6–§7)', () => {
  const ends = new Set(['Ve', 'Sa']);
  it('clear and protected under a moderate support band', () => expect(securityGrade(cell('2026-10', { band: 'moderate' }), ends)).toBe('clear_protected'));
  it('watch for a test without an end lord', () => expect(securityGrade(cell('2026-10', { band: 'moderate', testing: true, sys: { S1: [0, 2, 'Ju'] } }), ends)).toBe('watch'));
  it('risk and high risk with an end lord', () => {
    expect(securityGrade(cell('2026-10', { band: 'moderate', testing: true, sys: { S1: [0, 2, 'Ve'] } }), ends)).toBe('risk');
    expect(securityGrade(cell('2026-10', { band: 'high', testing: true, sys: { S1: [0, 2, 'Ve'] } }), ends)).toBe('high_risk');
  });
});

describe('sub-areas follow the person (doc 45 rule 13)', () => {
  it('getting a job only for someone between jobs or studying', () => {
    expect(fitsStatus('get_job', 'yes')).toBe(false);
    expect(fitsStatus('get_job', 'between_jobs')).toBe(true);
    expect(fitsStatus('get_job', null)).toBe(false);
  });
  it('promotion and job security not for an owner or someone between jobs', () => {
    expect(fitsStatus('promotion', 'own_business')).toBe(false);
    expect(fitsStatus('job_security', 'between_jobs')).toBe(false);
    expect(fitsStatus('promotion', 'yes')).toBe(true);
  });
});

describe('digest-backed work families (work.d10_check, work.annual_family, work.conditional_family, work.karaka_family)', () => {
  it('casts annual, conditional and karaka votes and checks D1/D10 agreement when a digest is provided', () => {
    const cells = ['2026-09', '2026-10', '2026-11'].map((m) => cell(m, { band: 'moderate', sys: { S1: [3, 0, 'Ju'], S4: [2, 0] } }));
    const view = {
      house: (v: string, h: number) => (v === 'D1' && h === 10 ? { lord: 'Ju', lordDignity: 'exalted', class: ['kendra'] } : v === 'D10' && h === 10 ? { lord: 'Ju', lordDignity: 'own', class: ['kendra'] } : null),
      planet: (_v: string, p: string) => (p === 'Ju' || p === 'Me' || p === 'Ve' ? { dignity: 'exalted', house: 10, functional: 'benefic', owns: [10] } : null),
      points: () => [{ id: 'AmK', varga: 'D1', sign: 'Sg', house: 10, lord: 'Ve', lordHouse: 10 }],
      annual: () => [{ kind: 'TP' as const, year: 2026, varga: 'D1', lagna: 'Ar', houses: [{ varga: 'D1', house: 10, sign: 'Cp', lord: 'Ju', lordHouse: 10, lordSign: 'Cp', lordDignity: 'exalted', coLord: null, occupants: [], aspectedGraha: [], aspectedRasi: [], argala: null, sav: null, class: ['kendra'], cuspStar: null, arudha: null }], dashas: [{ system: 'mudda', periods: [{ level: 1, lord: 'Ju', from: '2026-01-01', to: '2026-12-31' }] }], sahams: [{ name: 'rajya', sign: 'Ar', house: 10 }] }],
    } as any;
    const activation = [
      { system: 'shodashottari', family: 'conditional', level: 1, lord: 'Me', sign: null, from: '2026-01-01', to: '2027-01-01', houses: [10] },
      { system: 'karaka', family: 'karaka', level: 1, lord: 'Ve', sign: null, from: '2026-01-01', to: '2027-01-01', houses: [10] },
    ] as any;
    const p = presentState(fakeBuild, cells, 1, { view, activation });
    expect(p.votes.find((f) => f.family === 'annual')?.vote).toBe('support');
    expect(p.votes.find((f) => f.family === 'conditional')?.vote).toBe('support');
    expect(p.votes.find((f) => f.family === 'karaka')?.vote).toBe('support');
  });
});
