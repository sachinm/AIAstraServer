/**
 * Model matrix (docs/reading-engine/05-cost-latency-caching.md §1). Every id is env-driven so the matrix changes
 * without a deploy. Until Sachin confirms paid Gemini billing, every role defaults to the configured chat model
 * (`GEMINI_FLASH_MODEL_ID`, live: gemini-2.5-flash).
 */
import { getGeminiChatModelId } from '../../config/env.js';
import type { Usage } from '../types.js';

export type ModelRole = 'intake' | 'specialist' | 'synth' | 'fast' | 'reader' | 'oracle' | 'validator';

const ENV_KEY: Record<ModelRole, string> = {
  intake: 'READING_MODEL_INTAKE',
  specialist: 'READING_MODEL_SPECIALIST',
  synth: 'READING_MODEL_SYNTH',
  fast: 'READING_MODEL_FAST',
  reader: 'READING_MODEL_READER',
  oracle: 'READING_MODEL_ORACLE',
  validator: 'READING_MODEL_VALIDATOR',
};

/** The oracle flow's roles fall back to the role that does the same work in the graph flow. */
const FALLBACK_ROLE: Partial<Record<ModelRole, ModelRole>> = { reader: 'specialist', validator: 'specialist', oracle: 'synth' };

export function modelFor(role: ModelRole): string {
  const v = process.env[ENV_KEY[role]]?.trim();
  if (v) return v;
  const next = FALLBACK_ROLE[role];
  if (next) return modelFor(next);
  if (role === 'fast') {
    const synth = process.env[ENV_KEY.synth]?.trim();
    if (synth) return synth;
  }
  return getGeminiChatModelId();
}

/** USD per 1M tokens (paid tier). Versioned with the matrix in file 05; unknown models cost 0 and are flagged. */
export const PRICE_TABLE_VERSION = '2026-11-01';
export const PRICES: Record<string, { in: number; out: number; cached: number }> = {
  'gemini-2.5-pro': { in: 1.25, out: 10.0, cached: 0.125 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5, cached: 0.03 },
  'gemini-2.5-flash-lite': { in: 0.1, out: 0.4, cached: 0.01 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4, cached: 0.025 },
  'gemini-3.1-flash-lite': { in: 0.25, out: 1.5, cached: 0.025 },
  'gemini-3.5-flash-lite': { in: 0.3, out: 2.5, cached: 0.03 },
  'gemini-3.8-flash': { in: 0.75, out: 3.75, cached: 0.075 },
  'gemini-3.6-flash': { in: 0.75, out: 3.75, cached: 0.075 },
  'gemini-3.1-pro-preview': { in: 2.0, out: 12.0, cached: 0.2 },
  'gemini-4-argon': { in: 2.0, out: 10.0, cached: 0.1 },
};

/** Announced repricings (ai.google.dev/gemini-api/docs/pricing, read 2026-11-01), newest first; the first whose date has passed wins. */
export const PRICE_CHANGES: Record<string, Array<{ from: string; in: number; out: number; cached: number }>> = {
  'gemini-3.8-flash': [{ from: '2027-01-01', in: 1.5, out: 7.5, cached: 0.15 }],
  'gemini-3.6-flash': [{ from: '2027-01-01', in: 1.5, out: 7.5, cached: 0.15 }],
  'gemini-4-argon': [{ from: '2026-12-01', in: 4.0, out: 20.0, cached: 0.2 }],
};

/** USD per 1M tokens for a model on a date (YYYY-MM-DD, default today). Undefined when the model is not in the table. */
export function priceFor(model: string, on: string = new Date().toISOString().slice(0, 10)): { in: number; out: number; cached: number } | undefined {
  const p = PRICES[model];
  if (!p) return undefined;
  const change = PRICE_CHANGES[model]?.find((c) => c.from <= on);
  return change ? { in: change.in, out: change.out, cached: change.cached } : p;
}

export function usageCostUsd(u: Pick<Usage, 'model' | 'promptTokens' | 'cachedTokens' | 'outputTokens' | 'thoughtTokens'>, on?: string): number {
  const p = priceFor(u.model, on);
  if (!p) return 0;
  const uncached = Math.max(0, u.promptTokens - u.cachedTokens);
  return (uncached * p.in + u.cachedTokens * p.cached + (u.outputTokens + u.thoughtTokens) * p.out) / 1_000_000;
}

export function totalCostUsd(usages: Usage[]): number {
  return Math.round(usages.reduce((n, u) => n + usageCostUsd(u), 0) * 1_000_000) / 1_000_000;
}
