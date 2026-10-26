import { describe, expect, it } from 'vitest';
import { isTimelineEnabled, TIMELINE_DEFAULTS, timelineConfig, timelineSystems } from '../../../../src/reading/timeline/config.js';
import { converge, edgeFactor, edgeStarts, rankBands, runsIn, scoreSide, type ConvergeOptions } from '../../../../src/reading/timeline/converge.js';
import { buildFoundation } from '../../../../src/reading/timeline/foundation.js';
import { monthsBetween } from '../../../../src/reading/timeline/months.js';
import type { Activation, SystemId } from '../../../../src/reading/timeline/types.js';
import { loadG1Dossier } from '../../../helpers/readingFixtures.js';

const foundation = buildFoundation(loadG1Dossier());
const opts: ConvergeOptions = { config: TIMELINE_DEFAULTS, weights: TIMELINE_DEFAULTS.weights, s3Applicable: true, foundation, stack: { rows: [], sources: {}, missing: [] } };

const act = (system: SystemId, strength: number, over: Partial<Activation> = {}): Activation => ({
  system,
  marker: 'career',
  planet: 'Sa',
  strength,
  polarity: 1,
  from: '2020-01-01',
  to: '2021-01-01',
  level: system === 'S6' ? 'contact' : system === 'S6D' ? 'double' : system === 'S7' ? 'modifier' : 'ad',
  evidence: ['dasha.x.periods[0]'],
  ...over,
});

describe('timeline config (doc 29)', () => {
  it('is off unless TIMELINE_ENABLED is set', () => {
    expect(isTimelineEnabled({})).toBe(false);
    expect(isTimelineEnabled({ TIMELINE_ENABLED: '1' })).toBe(true);
  });

  it('defaults to the doc 29 priors', () => {
    expect(TIMELINE_DEFAULTS.weights.systems).toEqual({ S1: 3, S2: 1, S3: 1, S4: 2, S6: 2, S6D: 3, S7: 1 });
    expect(TIMELINE_DEFAULTS.bands).toEqual({ high: 0.08, moderate: 0.2, possible: 0.35 });
    expect(TIMELINE_DEFAULTS.sigCap).toBe(3);
  });

  it('takes TIMELINE_WEIGHTS as a flat map or a partial config, ignoring junk', () => {
    expect(timelineConfig({ TIMELINE_WEIGHTS: '{"S1":2.5}' }).weights.systems.S1).toBe(2.5);
    const c = timelineConfig({ TIMELINE_WEIGHTS: '{"weights":{"S6D":2},"bands":{"high":0.1,"moderate":7},"sigCap":4}' });
    expect(c.weights.systems.S6D).toBe(2);
    expect(c.bands).toEqual({ high: 0.1, moderate: 0.2, possible: 0.35 });
    expect(c.sigCap).toBe(4);
    expect(timelineConfig({ TIMELINE_WEIGHTS: 'not json' })).toEqual(TIMELINE_DEFAULTS);
  });

  it('reads TIMELINE_SYSTEMS', () => {
    expect(timelineSystems({ TIMELINE_SYSTEMS: 's1, S6d,S5' })).toEqual(['S1', 'S6D']);
    expect(timelineSystems({})).toHaveLength(7);
  });
});

describe('gates (doc 29 §3.2-§3.5)', () => {
  it('D1 = AD signification, +1 when the MD lord signifies at 2+, +1 with a PD', () => {
    const r = scoreSide('2020-06', 'career', [act('S1', 2), act('S1', 3, { level: 'md', planet: 'Me' }), act('S1', 1, { level: 'pd', planet: 'Ve' })], 1, opts, 1);
    expect(r.gates.D).toBe(3 * 4);
  });

  it('a period with a trigger scores E x (D + T); either alone scores half', () => {
    const both = scoreSide('2020-06', 'career', [act('S1', 2), act('S6', 2)], 1, opts, 1.5);
    expect(both.gates).toEqual({ D: 6, T: 4, E: 1.5, score: 15 });
    expect(scoreSide('2020-06', 'career', [act('S1', 2)], 1, opts, 1).gates.score).toBe(3);
    expect(scoreSide('2020-06', 'career', [act('S6', 2)], 1, opts, 1).gates.score).toBe(2);
  });

  it('confirmers count only when Vimshottari or Narayana signify at 2+, and one planet votes once', () => {
    expect(scoreSide('2020-06', 'career', [act('S1', 1), act('S2', 3, { planet: 'Me' })], 1, opts, 1).gates.D).toBe(3);
    expect(scoreSide('2020-06', 'career', [act('S1', 2), act('S2', 3, { planet: 'Me' })], 1, opts, 1).gates.D).toBe(6 + 3);
    // Yogini runs Saturn too: no second vote
    expect(scoreSide('2020-06', 'career', [act('S1', 2), act('S2', 3, { planet: 'Sa' })], 1, opts, 1).gates.D).toBe(6);
  });

  it('S3 at half weight when Ashtottari does not apply; S7 only adds to an open period', () => {
    expect(scoreSide('2020-06', 'career', [act('S4', 2), act('S3', 2, { planet: 'Me' })], 1, { ...opts, s3Applicable: false }, 1).gates.D).toBe(4 + 1);
    expect(scoreSide('2020-06', 'career', [act('S7', 0.5)], 1, opts, 1).gates.D).toBe(0);
    expect(scoreSide('2020-06', 'career', [act('S1', 2), act('S7', 0.5)], 1, opts, 1).gates.D).toBe(6.5);
  });

  it('double transit and contacts add into T', () => {
    expect(scoreSide('2020-06', 'career', [act('S6D', 3), act('S6', 1.5)], 1, opts, 1).gates.T).toBe(9 + 3);
  });

  it('the edge gate: a signifying AD/PD starting this month or the month before', () => {
    const starts = edgeStarts([act('S1', 2, { from: '2020-03-10' }), act('S1', 1, { from: '2020-07-01' }), act('S1', 3, { level: 'md', from: '2020-09-01' })]);
    expect(edgeFactor('2020-03', starts.get('career'), TIMELINE_DEFAULTS)).toBe(1.5);
    expect(edgeFactor('2020-04', starts.get('career'), TIMELINE_DEFAULTS)).toBe(1.25);
    expect(edgeFactor('2020-07', starts.get('career'), TIMELINE_DEFAULTS)).toBe(1);
    expect(edgeFactor('2020-09', starts.get('career'), TIMELINE_DEFAULTS)).toBe(1);
  });

  it('dasha periods run in a month when they cover the 15th; transit activations on any overlap', () => {
    expect(runsIn(act('S1', 1, { from: '2020-06-16', to: '2020-08-01' }), '2020-06')).toBe(false);
    expect(runsIn(act('S6', 1, { from: '2020-06-01', to: '2020-07-01' }), '2020-06')).toBe(true);
  });
});

describe('ranked bands (doc 29 §4)', () => {
  const months = monthsBetween('2020-01-01', '2021-12-01').slice(0, 25);
  it('fixes the density: top 8 % High only with both gates, 20 % Moderate, 35 % Possible', () => {
    const cells = Array.from({ length: 25 }, (_, i) => ({ score: 25 - i, D: 1, T: i === 0 ? 0 : 1, month: months[i] ?? `2030-${i}` }));
    const bands = rankBands(cells, TIMELINE_DEFAULTS.bands);
    expect(bands.slice(0, 9)).toEqual(['moderate', 'high', 'moderate', 'moderate', 'moderate', 'possible', 'possible', 'possible', 'possible']);
    expect(bands.filter((b) => b === 'quiet')).toHaveLength(16);
  });

  it('a zero score is never banded', () => {
    expect(rankBands([{ score: 0, D: 0, T: 0, month: '2020-01' }], TIMELINE_DEFAULTS.bands)).toEqual(['quiet']);
  });

  it('converge: windows merge consecutive months of one band; testing when the adverse band out-ranks', () => {
    const ms = monthsBetween('2020-01-01', '2021-12-01');
    const acts = [act('S1', 3, { from: '2020-03-01', to: '2020-05-01' }), act('S6', 2, { from: '2020-03-01', to: '2020-05-01' }), act('S1', 3, { polarity: -1, from: '2021-02-01', to: '2021-03-01' }), act('S6', 2, { polarity: -1, from: '2021-02-01', to: '2021-03-01' })];
    const g = converge(acts, ms, opts);
    const w = g.windows.filter((x) => x.marker === 'career');
    expect(w.map((x) => [x.fromMonth, x.toMonth, x.band, x.testing])).toEqual([
      ['2020-03', '2020-04', 'high', false],
      ['2021-02', '2021-02', 'high', true],
    ]);
    expect(g.cells.career[2]!.families).toEqual(['dasha', 'transit']);
    expect(g.cells.career[2]!.agent).toBe('Sa');
  });
});
