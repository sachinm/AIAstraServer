import { describe, expect, it } from 'vitest';
import { calibrate, chartSwap, percentileOf, topMonths } from '../../../../src/reading/timeline/calibrate.js';
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

const act = (system: SystemId, from: string, to: string, strength = 2): Activation => ({ system, marker: 'career', planet: 'Sa', strength, polarity: 1, from, to, level: system === 'S6' ? 'contact' : 'ad', evidence: ['dasha.x.periods[0]'] });
// career: Vimshottari + a contact in 2020-03..2020-05 (top-ranked); Tithi Ashtottari alone in 2021-10
const acts = [act('S1', '2020-03-01', '2020-06-01'), act('S6', '2020-03-01', '2020-06-01'), act('S3', '2021-10-01', '2021-11-01')];
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

  it('hit within ±1 month of a Moderate/High month, near within ±3, else miss; unmapped and out-of-range not scored', () => {
    const { matches, summary } = matchLedger(grid, [ev('in', '2020-04-10'), ev('edge', '2020-06-20'), ev('near', '2020-08-01'), ev('far', '2021-06-01'), ev('x', '2020-04-01', 'pets.new'), ev('old', '2015-01-01')], TIMELINE_DEFAULTS);
    expect(matches.map((m) => m.result)).toEqual(['hit', 'hit', 'near', 'miss', 'unmapped', 'out_of_range']);
    expect(matches[0]!.window).toMatchObject({ marker: 'career' });
    expect(summary).toMatchObject({ scored: 4, hits: 2, near: 1, misses: 1, hitRate: 0.5 });
  });
});

describe('calibrate (doc 29 §5)', () => {
  it('percentile ranks with ties at half; top months only among positive scores', () => {
    expect(percentileOf([1, 2, 3, 4], 3)).toBeCloseTo(0.625);
    expect(percentileOf([0, 0, 0, 0], 0)).toBe(0.5);
    expect([...topMonths(['a', 'b', 'c', 'd', 'e'], [0, 5, 3, 0, 4], 0.4)]).toEqual(['b', 'e']);
    expect(topMonths(['a', 'b'], [0, 0], 1).size).toBe(0);
  });

  const events = [ev('a', '2020-04-10'), ev('b', '2021-06-01')];
  const cal = calibrate({ grid, activations: acts, events, systems: ['S1', 'S3', 'S6'], config: TIMELINE_DEFAULTS, s3Applicable: false });
  const row = (s: string, m: string) => cal.rows.find((r) => r.system === s && r.marker === m)!;

  it('mean percentile: an event in the technique\'s top months ranks high, an event in a quiet month sits at the median of zeros', () => {
    // S1 scores 3 of 24 months; the April event sits above the 21 zero months, the June 2021 one among them
    expect(row('S1', 'career').meanPercentile).toBeCloseTo(((21 + 1.5) / 24 + 10.5 / 24) / 2);
  });

  it('lift at a fixed density against random months', () => {
    const d20 = row('S1', 'career').byDensity.find((d) => d.density === 0.2)!;
    expect(d20).toMatchObject({ flagged: 3, hits: 1 });
    expect(d20.lift).toBeCloseTo(1 / d20.expected);
    expect(row('ALL', '*').n).toBe(2);
  });

  it('weight = prior x clamp(0.5 + lift/2), shrunk by n/(n+5); markers without events keep the prior', () => {
    const r = row('S1', 'career');
    const lift = r.byDensity.find((d) => d.density === 0.2)!.lift!;
    const raw = Math.min(1.5, Math.max(0.5, 0.5 + lift / 2));
    expect(r.multiplier).toBeCloseTo(1 + (raw - 1) * (2 / 7), 3);
    expect(row('S1', 'money')).toMatchObject({ n: 0, multiplier: 1, weight: 3 });
    expect(cal.weights.byMarker!.career!.S1).toBe(r.weight);
  });

  it('drops a conditional technique that neither applies nor beats random', () => {
    expect(row('S3', '*').dropped).toBe(true);
    expect(cal.weights.systems.S3).toBe(0);
  });

  it('chart swap: own grid against others', () => {
    const empty = converge([], months, opts);
    const r = chartSwap(events, grid, [empty, empty], TIMELINE_DEFAULTS);
    expect(r.own).not.toBeNull();
    expect(r.beats).toBe(r.median == null ? null : r.own! > r.median);
  });
});
