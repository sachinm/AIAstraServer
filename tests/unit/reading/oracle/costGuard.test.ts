import { describe, expect, it } from 'vitest';
import { CostGuard, CostRefusedError, MIN_OUTPUT_TOKENS } from '../../../../src/reading/oracle/costGuard.js';
import { priceFor, usageCostUsd } from '../../../../src/reading/llm/models.js';

const LITE = 'gemini-3.1-flash-lite';
const FLASH = 'gemini-3.8-flash';
const on = '2026-11-01';
const caps = { fanout: 0.05, oracle: 0.25, query: 0.3 };
const usage = (promptTokens: number, outputTokens: number, cachedTokens = 0, thoughtTokens = 0) => ({ promptTokens, cachedTokens, outputTokens, thoughtTokens });

describe('dated prices', () => {
  it('3.8 Flash doubles on 2027-01-01 and Argon on 2026-12-01', () => {
    expect(priceFor(FLASH, '2026-12-31')).toEqual({ in: 0.75, out: 3.75, cached: 0.075 });
    expect(priceFor(FLASH, '2027-01-01')).toEqual({ in: 1.5, out: 7.5, cached: 0.15 });
    expect(priceFor('gemini-4-argon', '2026-11-30')?.out).toBe(10);
    expect(priceFor('gemini-4-argon', '2026-12-01')?.out).toBe(20);
    expect(priceFor(LITE, '2030-01-01')?.in).toBe(0.25);
  });

  it('usageCostUsd prices by the date given', () => {
    const u = { model: FLASH, ...usage(1_000_000, 0) };
    expect(usageCostUsd(u, '2026-11-01')).toBeCloseTo(0.75);
    expect(usageCostUsd(u, '2027-02-01')).toBeCloseTo(1.5);
  });
});

describe('CostGuard', () => {
  it('leaves a call alone when it fits', () => {
    const g = new CostGuard({ on, caps });
    const r = g.reserve({ stage: 'fanout', node: 'R01', model: LITE, promptTokens: 10_000, maxOutputTokens: 1_100 });
    expect(r.maxOutputTokens).toBe(1_100);
  });

  it('parallel reservations can never exceed the fan-out cap, even if every one bills its worst case', () => {
    const g = new CostGuard({ on, caps });
    const held = [];
    let refused = 0;
    for (let i = 0; i < 40; i++) {
      try {
        held.push(g.reserve({ stage: 'fanout', node: `R${i}`, model: LITE, promptTokens: 10_000, maxOutputTokens: 1_100 }));
      } catch (e) {
        expect(e).toBeInstanceOf(CostRefusedError);
        refused += 1;
      }
    }
    expect(refused).toBeGreaterThan(0);
    for (const r of held) g.settle(r, usage(10_000, r.maxOutputTokens));
    expect(g.spent('fanout')).toBeLessThanOrEqual(0.05);
  });

  it('settling returns unused money at once', () => {
    const g = new CostGuard({ on, caps });
    const before = g.remaining('fanout');
    const r = g.reserve({ stage: 'fanout', node: 'R01', model: LITE, promptTokens: 10_000, maxOutputTokens: 1_100 });
    expect(g.remaining('fanout')).toBeLessThan(before);
    g.settle(r, usage(10_000, 100));
    expect(before - g.remaining('fanout')).toBeCloseTo((10_000 * 0.25 + 100 * 1.5) / 1e6, 6);
  });

  it('lowers the output limit before refusing', () => {
    const g = new CostGuard({ on, caps: { fanout: 0.004, oracle: 0.25, query: 0.3 } });
    const r = g.reserve({ stage: 'fanout', node: 'R01', model: LITE, promptTokens: 10_000, maxOutputTokens: 5_000 });
    expect(r.maxOutputTokens).toBeLessThan(5_000);
    expect(r.maxOutputTokens).toBeGreaterThanOrEqual(MIN_OUTPUT_TOKENS);
  });

  it('refuses when even the minimum cannot be paid', () => {
    const g = new CostGuard({ on, caps: { fanout: 0.001, oracle: 0.25, query: 0.3 } });
    expect(() => g.reserve({ stage: 'fanout', node: 'R01', model: LITE, promptTokens: 10_000, maxOutputTokens: 1_100 })).toThrow(CostRefusedError);
    expect(g.summary().refused).toBe(1);
  });

  it('refuses an unknown model instead of pricing it at 0', () => {
    const g = new CostGuard({ on, caps });
    try {
      g.reserve({ stage: 'oracle', node: 'oracle', model: 'made-up', promptTokens: 1, maxOutputTokens: 1_000 });
      expect.unreachable();
    } catch (e) {
      expect((e as CostRefusedError).reason).toBe('unknown_model');
    }
  });

  it('holds money back for the Oracle so readers cannot use it all', () => {
    const tight = { fanout: 0.3, oracle: 0.25, query: 0.05 };
    const g = new CostGuard({ on, caps: tight, oracleHoldUsd: 0.03 });
    expect(g.remaining('fanout')).toBeCloseTo(0.02);
    const r = g.reserve({ stage: 'oracle', node: 'oracle', model: FLASH, promptTokens: 7_000, maxOutputTokens: 900 });
    expect(r.maxOutputTokens).toBe(900);
  });

  it('counts a failed attempt, because it was billed, and spend seeded from prewarm', () => {
    const g = new CostGuard({ on, caps });
    g.record({ node: 'R02', stage: 'fanout', model: LITE, usd: 0.01 });
    const r = g.reserve({ stage: 'fanout', node: 'R02', model: LITE, promptTokens: 1_000, maxOutputTokens: 500 });
    g.settle(r, usage(1_000, 500));
    expect(g.spent('fanout')).toBeCloseTo(0.01 + (1_000 * 0.25 + 500 * 1.5) / 1e6, 6);
    expect(g.remaining('fanout')).toBeCloseTo(0.05 - g.spent('fanout'));
  });

  it('the query cap binds across stages', () => {
    const g = new CostGuard({ on, caps: { fanout: 0.05, oracle: 0.25, query: 0.06 } });
    g.record({ node: 'x', stage: 'fanout', model: LITE, usd: 0.04 });
    expect(g.remaining('oracle')).toBeCloseTo(0.02);
    expect(g.remaining('support')).toBeLessThan(0.02);
  });

  it('a cached prompt bills at the cached rate', () => {
    const g = new CostGuard({ on, caps });
    const r = g.reserve({ stage: 'fanout', node: 'R01', model: LITE, promptTokens: 10_000, maxOutputTokens: 1_000 });
    const usd = g.settle(r, usage(10_000, 1_000, 7_000));
    expect(usd).toBeCloseTo((3_000 * 0.25 + 7_000 * 0.025 + 1_000 * 1.5) / 1e6, 8);
  });
});
