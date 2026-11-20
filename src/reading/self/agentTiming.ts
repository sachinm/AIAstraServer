/**
 * One agent call's timing, tokens and cost as the build result and the Lab carry it. Moved unchanged from
 * `self/v2/oracle.ts` (plan "retire the v2 Self reading", server step 1); the old path re-exports.
 */
import type { GeminiResult } from '../llm/gemini.js';
import { usageCostUsd } from '../llm/models.js';
import type { SelfV2AgentTiming } from './v2types.js';

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function timingOf(agent: SelfV2AgentTiming['agent'], call: string, model: string, res: GeminiResult | null, ms: number, status: SelfV2AgentTiming['status']): SelfV2AgentTiming {
  const u = res?.usage;
  const promptTokens = u?.promptTokens ?? 0;
  const cachedTokens = u?.cachedTokens ?? 0;
  const outputTokens = u?.outputTokens ?? 0;
  const thoughtTokens = u?.thoughtTokens ?? 0;
  return {
    agent,
    call,
    status,
    ms: Math.round(ms * 100) / 100,
    promptTokens,
    cachedTokens,
    outputTokens,
    thoughtTokens,
    costUsd: res ? round6(usageCostUsd({ model, promptTokens, cachedTokens, outputTokens, thoughtTokens })) : 0,
    // run 2: a provider usage without a thought count is "not reported" (the Lab shows it so), never a measured 0
    ...(u && u.thoughtTokensReported !== undefined ? { thoughtTokensReported: u.thoughtTokensReported } : {}),
  };
}

/** The thought count as the Lab and the reports show it: null when the provider did not report one (run 2, failure 10). */
export const reportedThoughtTokens = (t: Pick<SelfV2AgentTiming, 'thoughtTokens' | 'thoughtTokensReported'>): number | null =>
  t.thoughtTokensReported === false ? null : t.thoughtTokens;

