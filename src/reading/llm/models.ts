/**
 * Model matrix (docs/reading-engine/05-cost-latency-caching.md §1). Every id is env-driven so the matrix changes
 * without a deploy. Until Sachin confirms paid Gemini billing, every role defaults to the configured chat model
 * (`GEMINI_FLASH_MODEL_ID`, live: gemini-2.5-flash).
 */
import { getGeminiChatModelId } from '../../config/env.js';
import type { Usage } from '../types.js';

export type ModelRole = 'intake' | 'specialist' | 'synth' | 'fast';

const ENV_KEY: Record<ModelRole, string> = {
  intake: 'READING_MODEL_INTAKE',
  specialist: 'READING_MODEL_SPECIALIST',
  synth: 'READING_MODEL_SYNTH',
  fast: 'READING_MODEL_FAST',
};

export function modelFor(role: ModelRole): string {
  const v = process.env[ENV_KEY[role]]?.trim();
  if (v) return v;
  if (role === 'fast') {
    const synth = process.env[ENV_KEY.synth]?.trim();
    if (synth) return synth;
  }
  return getGeminiChatModelId();
}

/** USD per 1M tokens (paid tier). Versioned with the matrix in file 05; unknown models cost 0 and are flagged. */
export const PRICE_TABLE_VERSION = '2026-10-24';
export const PRICES: Record<string, { in: number; out: number; cached: number }> = {
  'gemini-2.5-flash': { in: 0.3, out: 2.5, cached: 0.03 },
  'gemini-2.5-flash-lite': { in: 0.1, out: 0.4, cached: 0.01 },
  'gemini-2.0-flash': { in: 0.1, out: 0.4, cached: 0.025 },
  'gemini-3.1-flash-lite': { in: 0.25, out: 1.5, cached: 0.025 },
  'gemini-3.5-flash-lite': { in: 0.3, out: 2.5, cached: 0.03 },
  'gemini-3.8-flash': { in: 0.75, out: 3.75, cached: 0.075 },
  'gemini-3.1-pro-preview': { in: 2.0, out: 12.0, cached: 0.2 },
  'gemini-4-argon': { in: 2.0, out: 10.0, cached: 0.1 },
};

export function usageCostUsd(u: Pick<Usage, 'model' | 'promptTokens' | 'cachedTokens' | 'outputTokens' | 'thoughtTokens'>): number {
  const p = PRICES[u.model];
  if (!p) return 0;
  const uncached = Math.max(0, u.promptTokens - u.cachedTokens);
  return (uncached * p.in + u.cachedTokens * p.cached + (u.outputTokens + u.thoughtTokens) * p.out) / 1_000_000;
}

export function totalCostUsd(usages: Usage[]): number {
  return Math.round(usages.reduce((n, u) => n + usageCostUsd(u), 0) * 1_000_000) / 1_000_000;
}
