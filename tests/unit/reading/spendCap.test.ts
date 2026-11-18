/**
 * One operation, one budget (Sachin, 2026-11-18; docs/billing/README.md "Spend cap per operation"): the env cap, the
 * counter the single and graph flows use, and the oracle flow's question cap tied to the same env var.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getReadingSpendCapUsd } from '../../../src/config/env.js';
import { readingCostCaps } from '../../../src/reading/config.js';
import { OperationBudget } from '../../../src/reading/llm/spendCap.js';
import { CostGuard, CostRefusedError } from '../../../src/reading/oracle/costGuard.js';

const ENV = ['READING_SPEND_CAP_USD', 'READING_COST_CAP_QUERY_USD'] as const;
afterEach(() => {
  for (const k of ENV) delete process.env[k];
});

describe('READING_SPEND_CAP_USD', () => {
  it('defaults to 0.45 and is clamped to 0.05..5', () => {
    expect(getReadingSpendCapUsd()).toBe(0.45);
    process.env.READING_SPEND_CAP_USD = '0.6';
    expect(getReadingSpendCapUsd()).toBe(0.6);
    process.env.READING_SPEND_CAP_USD = '0.001';
    expect(getReadingSpendCapUsd()).toBe(0.05);
    process.env.READING_SPEND_CAP_USD = '50';
    expect(getReadingSpendCapUsd()).toBe(5);
    process.env.READING_SPEND_CAP_USD = 'not a number';
    expect(getReadingSpendCapUsd()).toBe(0.45);
  });

  it("the oracle flow's question cap is the same cap; READING_COST_CAP_QUERY_USD can only lower it", () => {
    expect(readingCostCaps().query).toBe(0.45);
    process.env.READING_SPEND_CAP_USD = '0.6';
    expect(readingCostCaps().query).toBe(0.6);
    process.env.READING_COST_CAP_QUERY_USD = '0.2';
    expect(readingCostCaps().query).toBe(0.2);
    process.env.READING_COST_CAP_QUERY_USD = '3';
    expect(readingCostCaps().query).toBe(0.6);
    expect(new CostGuard().caps.query).toBe(0.6);
  });
});

describe('OperationBudget', () => {
  const usage = (outputTokens: number) => ({ model: 'gemini-2.5-flash', promptTokens: 0, cachedTokens: 0, outputTokens, thoughtTokens: 0 });

  it('counts each bill as it returns and refuses the next call only once the cap is reached; one log line', () => {
    const lines: Array<Record<string, unknown>> = [];
    const b = new OperationBudget('reading.ask', 0.01, '2026-11-18', (l) => lines.push(l));
    expect(b.allows('a')).toBe(true);
    b.add(usage(1000));
    expect(b.spentUsd()).toBeGreaterThan(0);
    expect(b.spentUsd()).toBeLessThan(0.01);
    expect(b.allows('b')).toBe(true);
    b.add(usage(1_000_000));
    expect(b.allows('c')).toBe(false);
    expect(() => b.require('synthesize')).toThrow(CostRefusedError);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ msg: 'reading spend cap', op: 'reading.ask', node: 'c', capUsd: 0.01 });
    expect(lines[0]!.spentUsd).toBe(b.spentUsd());
  });

  it('a missing usage report adds nothing; the default cap is READING_SPEND_CAP_USD', () => {
    process.env.READING_SPEND_CAP_USD = '0.3';
    const b = new OperationBudget('reading.ask', undefined, undefined, () => undefined);
    b.add(null);
    b.add(undefined);
    expect(b.spentUsd()).toBe(0);
    expect(b.capUsd).toBe(0.3);
  });
});
