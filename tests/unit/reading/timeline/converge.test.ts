import { describe, expect, it } from 'vitest';
import { isTimelineEnabled, TIMELINE_DEFAULTS, timelineConfig, timelineSystems } from '../../../../src/reading/timeline/config.js';
import { cellFor, converge, runsIn, type ConvergeOptions } from '../../../../src/reading/timeline/converge.js';
import { buildFoundation } from '../../../../src/reading/timeline/foundation.js';
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
  level: 'ad',
  evidence: [`dasha.x.periods[0]`],
  ...over,
});

describe('timeline config (doc 27 §B.5, §B.6)', () => {
  it('is off unless TIMELINE_ENABLED is set', () => {
    expect(isTimelineEnabled({})).toBe(false);
    expect(isTimelineEnabled({ TIMELINE_ENABLED: '1' })).toBe(true);
  });

  it('takes TIMELINE_WEIGHTS as a flat map or a partial config, ignoring junk', () => {
    expect(timelineConfig({ TIMELINE_WEIGHTS: '{"S1":2.5}' }).weights.systems.S1).toBe(2.5);
    const c = timelineConfig({ TIMELINE_WEIGHTS: '{"weights":{"S4":3},"rules":{"mdCounts":false},"bands":{"high":{"score":9}}}' });
    expect(c.weights.systems.S4).toBe(3);
    expect(c.rules.mdCounts).toBe(false);
    expect(c.bands.high).toEqual({ systems: 3, score: 9 });
    expect(timelineConfig({ TIMELINE_WEIGHTS: 'not json' })).toEqual(TIMELINE_DEFAULTS);
    expect(timelineConfig({ TIMELINE_WEIGHTS: '{"S1":-1}' }).weights.systems.S1).toBe(3);
  });

  it('defaults to doc 27 weights and literal rules', () => {
    expect(TIMELINE_DEFAULTS.weights.systems).toEqual({ S1: 3, S2: 1.5, S3: 1.5, S4: 2, S6: 1.5, S7: 1 });
    expect(TIMELINE_DEFAULTS.rules).toEqual({ secondaryHouseStrength: 2, mdCounts: true });
  });

  it('reads TIMELINE_SYSTEMS', () => {
    expect(timelineSystems({ TIMELINE_SYSTEMS: 's1, S4,S5' })).toEqual(['S1', 'S4']);
    expect(timelineSystems({})).toHaveLength(6);
  });
});

describe('convergence (doc 27 §A.4)', () => {
  it('three systems with score >= 7 are High; agent and channel by weighted strength', () => {
    const c = cellFor('2020-06', 'career', [act('S1', 2), act('S2', 2, { planet: 'Me' }), act('S4', 1, { planet: 'Ju' })], opts);
    expect(c.supportScore).toBe(3 * 2 + 1.5 * 2 + 2 * 1);
    expect(c.band).toBe('high');
    expect(c.agent).toBe('Sa');
    expect(c.channel).toBe('Me');
  });

  it('two systems at 4.5 are Moderate, one system Possible, below that Quiet', () => {
    expect(cellFor('2020-06', 'career', [act('S1', 1), act('S2', 1)], opts).band).toBe('moderate');
    expect(cellFor('2020-06', 'career', [act('S1', 1)], opts).band).toBe('possible');
    expect(cellFor('2020-06', 'career', [act('S2', 1)], opts).band).toBe('quiet');
  });

  it('S7 adds to the score but is not an independent system', () => {
    const c = cellFor('2020-06', 'career', [act('S1', 2), act('S7', 1, { level: 'modifier' })], opts);
    expect(c.supportScore).toBe(7);
    expect(c.supportSystems).toEqual(['S1']);
    expect(c.band).toBe('possible');
  });

  it('adverse activations make a testing cell when they band at least as high', () => {
    const c = cellFor('2020-06', 'career', [act('S1', 2, { polarity: -1 }), act('S4', 1, { polarity: -1 }), act('S2', 1)], opts);
    expect(c.testScore).toBe(8);
    expect(c.testing).toBe(true);
    expect(c.band).toBe('moderate');
  });

  it('S3 runs at half weight when Ashtottari does not apply', () => {
    expect(cellFor('2020-06', 'career', [act('S3', 2)], { ...opts, s3Applicable: false }).supportScore).toBe(1.5);
  });

  it('transit items add up, capped, while a dasha system counts its strongest activation once', () => {
    const items = [1, 2, 3].map((i) => act('S6', 1.5, { level: 'contact', item: `i${i}` }));
    expect(cellFor('2020-06', 'career', items, opts).systems.S6!.support).toBe(3);
    expect(cellFor('2020-06', 'career', [act('S1', 1), act('S1', 2)], opts).systems.S1!.support).toBe(2);
  });

  it('dasha periods run in a month when they cover the 15th; contacts on any overlap', () => {
    expect(runsIn(act('S1', 1, { from: '2020-06-16', to: '2020-08-01' }), '2020-06')).toBe(false);
    expect(runsIn(act('S6', 1, { level: 'contact', from: '2020-06-28', to: '2020-07-02' }), '2020-06')).toBe(true);
  });

  it('merges months into windows and collapses quiet months', () => {
    const acts = [act('S1', 2, { from: '2020-01-01', to: '2020-04-01' }), act('S2', 2, { from: '2020-01-01', to: '2020-04-01' }), act('S4', 1, { from: '2020-01-01', to: '2020-04-01' })];
    const g = converge(acts, ['2019-12', '2020-01', '2020-02', '2020-03', '2020-04'], opts);
    const w = g.windows.filter((x) => x.marker === 'career');
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ fromMonth: '2020-01', toMonth: '2020-03', from: '2020-01-01', to: '2020-04-01', months: 3, band: 'high' });
    expect(g.quiet.map((q) => [q.fromMonth, q.toMonth])).toEqual([
      ['2019-12', '2019-12'],
      ['2020-04', '2020-04'],
    ]);
  });
});
