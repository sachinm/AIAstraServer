import { describe, expect, it } from 'vitest';
import { calibrate, runsOf } from '../../../../src/reading/timeline/calibrate.js';
import { TIMELINE_DEFAULTS } from '../../../../src/reading/timeline/config.js';
import { converge, type ConvergeOptions } from '../../../../src/reading/timeline/converge.js';
import { buildFoundation } from '../../../../src/reading/timeline/foundation.js';
import { eventMonths, parseLedger, type LifeEvent } from '../../../../src/reading/timeline/ledger.js';
import { matchLedger, randomHitProbability } from '../../../../src/reading/timeline/match.js';
import { monthsBetween } from '../../../../src/reading/timeline/months.js';
import type { Activation, SystemId } from '../../../../src/reading/timeline/types.js';
import { loadG1Dossier, loadG1Ledger } from '../../../helpers/readingFixtures.js';

const foundation = buildFoundation(loadG1Dossier());
const opts: ConvergeOptions = { config: TIMELINE_DEFAULTS, weights: TIMELINE_DEFAULTS.weights, s3Applicable: false, foundation, stack: { rows: [], sources: {}, missing: [] } };
const months = monthsBetween('2020-01-01', '2021-12-01'); // 24 months

const act = (system: SystemId, from: string, to: string, strength = 2): Activation => ({ system, marker: 'career', planet: 'Sa', strength, polarity: 1, from, to, level: 'ad', evidence: ['dasha.x.periods[0]'] });
// career High in 2020-03..2020-05 (S1+S2+S4); S3 active only in 2021-10
const acts = [act('S1', '2020-03-01', '2020-06-01'), act('S2', '2020-03-01', '2020-06-01'), act('S4', '2020-03-01', '2020-06-01', 1), act('S3', '2021-10-01', '2021-11-01')];
const grid = converge(acts, months, opts);
const ev = (id: string, date: string, category = 'job.start', date_precision: LifeEvent['date_precision'] = 'day'): LifeEvent => ({ id, category, date, date_precision });

describe('ledger', () => {
  it('parses the made-up G1 ledger and drops malformed rows', () => {
    expect(loadG1Ledger()).toHaveLength(12);
    const { events, dropped } = parseLedger([{ id: 'a', category: 'job.start', date: '2020-01-02' }, { id: 'b', category: 'Job Start', date: '2020-01-02' }, { id: 'c', category: 'job', date: 'soon' }]);
    expect(events.map((e) => e.id)).toEqual(['a']);
    expect(dropped).toBe(2);
  });

  it('a year-precision event spans its twelve months', () => {
    expect(eventMonths(ev('y', '2013-01-01', 'travel.long', 'year'))).toHaveLength(12);
  });
});

describe('match (doc 27 §A.7)', () => {
  it('random baseline probability', () => {
    expect(randomHitProbability(10, 0, 3)).toBe(0);
    expect(randomHitProbability(10, 10, 1)).toBe(1);
    expect(randomHitProbability(10, 1, 3)).toBeCloseTo(0.3);
  });

  it('hit within ±1 month, near within ±3, else miss; unmapped and out-of-range are not scored', () => {
    const { matches, summary } = matchLedger(grid, [ev('in', '2020-04-10'), ev('edge', '2020-06-20'), ev('near', '2020-08-01'), ev('far', '2021-06-01'), ev('x', '2020-04-01', 'pets.new'), ev('old', '2015-01-01')], TIMELINE_DEFAULTS);
    expect(matches.map((m) => m.result)).toEqual(['hit', 'hit', 'near', 'miss', 'unmapped', 'out_of_range']);
    expect(matches[0]!.window).toMatchObject({ marker: 'career', fromMonth: '2020-03', toMonth: '2020-05' });
    expect(summary).toMatchObject({ scored: 4, hits: 2, near: 1, misses: 1, hitRate: 0.5 });
    // 3 flagged months of 24, zone of 3 months: 1 - (21*20*19)/(24*23*22)
    expect(matches[0]!.baseline).toBeCloseTo(1 - (21 * 20 * 19) / (24 * 23 * 22));
  });
});

describe('calibrate (doc 27 §A.7, §B.5)', () => {
  it('finds runs of months', () => {
    expect(runsOf(['2020-03', '2020-01', '2020-02', '2020-05'])).toEqual([['2020-01', '2020-02', '2020-03'], ['2020-05']]);
  });

  const events = [ev('a', '2020-04-10'), ev('b', '2021-06-01')];
  const cal = calibrate({ grid, activations: acts, events, systems: ['S1', 'S2', 'S3', 'S4'], config: TIMELINE_DEFAULTS, s3Applicable: false });
  const row = (s: string, m: string) => cal.rows.find((r) => r.system === s && r.marker === m)!;

  it('precision and recall per system and marker, with the random baseline', () => {
    expect(row('S1', 'career')).toMatchObject({ n: 2, windows: 1, windowsWithEvent: 1, precision: 1, hits: 1, recall: 0.5 });
    expect(row('S1', 'career').baselineRecall).toBeGreaterThan(0);
    expect(row('ALL', '*')).toMatchObject({ n: 2, hits: 1 });
  });

  it('weight = default x clamp(0.5 + precision, 0.5, 1.5); markers without events keep the default', () => {
    expect(row('S1', 'career').weight).toBe(4.5);
    expect(row('S1', 'money')).toMatchObject({ n: 0, multiplier: 1, weight: 3 });
    expect(cal.weights.byMarker!.career!.S1).toBe(4.5);
    expect(cal.weights.byMarker!.money).toBeUndefined();
  });

  it('drops a conditional system that neither applies nor beats the baseline', () => {
    const s3 = row('S3', '*');
    expect(s3.recall).toBe(0);
    expect(s3.dropped).toBe(true);
    expect(cal.weights.systems.S3).toBe(0);
  });
});
