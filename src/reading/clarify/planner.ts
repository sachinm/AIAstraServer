/**
 * Optional model step of the clarifier (Bedrock, open-weight model; see src/reading/llm/bedrock.ts).
 *
 * The rules in machine.ts stay in charge of WHAT is asked (criterion order, two-question cap, defaults, never re-asking
 * a filled slot). The model only does what rules do badly:
 *   1. phrase the next question conversationally and chart-aware (≤ 18 words), keeping the rule chips;
 *   2. resolve a free-text answer the rules could not parse ("after my sister's wedding in spring").
 * Budget 900 ms; any error, timeout or invalid output falls back to the rules result unchanged.
 */
import type { Usage } from '../types.js';
import { BUCKETS, BUCKET_IDS } from '../buckets/taxonomy.js';
import { callBedrockJson, clarifyModelConfig } from '../llm/bedrock.js';
import { parseHorizonValue, type Ask, type ClarifyState, type PrashnaEligibility } from './machine.js';
import { detectTopic } from '../policy/declined.js';

export const CLARIFY_MODEL_TIMEOUT_MS = 900;

const SYSTEM = [
  'You help a Vedic astrology app turn a vague question into an exact one. You never answer the question and never give astrology.',
  'Reply with ONE JSON object only, no prose.',
  'Rules: ask about exactly one criterion; at most 18 words; friendly and plain English; do not repeat what the person already said;',
  'if a running dasha period is given you may mention it; never mention death, remedies, lottery numbers or money amounts.',
].join(' ');

/** Rephrase the rule question for the pending criterion. Keeps the rule chips (the client needs stable values). */
export async function phraseAsk(s: ClarifyState, ask: Ask): Promise<{ ask: Ask; usage: Usage | null }> {
  const cfg = clarifyModelConfig();
  if (cfg.provider === 'off') return { ask, usage: null };
  // these two are already as short and plain as they can be; keep the exact wording
  if (ask.criterion === 'sibling' || ask.criterion === 'location') return { ask, usage: null };
  try {
    const card = s.card?.md ? `Running period: ${s.card.md}-${s.card.ad} until ${s.card.adEnd}.` : '';
    const user = [
      `Original question: "${s.question.slice(0, 300)}"`,
      `Life area: ${BUCKETS[s.bucket].displayName}.`,
      card,
      `Criterion to ask about: ${ask.criterion}. Options the app will show: ${ask.chips.map((c) => c.label).join(' | ')}.`,
      `Draft question: "${ask.question}"`,
      'Return {"question": "<your question, max 18 words>"}',
    ].filter(Boolean).join('\n');
    const { json, usage } = await callBedrockJson({ model: cfg.model, node: 'clarify.phrase', system: SYSTEM, user, maxTokens: 300, timeoutMs: CLARIFY_MODEL_TIMEOUT_MS, reasoningEffort: 'low' });
    const q = typeof (json as { question?: unknown }).question === 'string' ? (json as { question: string }).question.trim() : '';
    const words = q.split(/\s+/).filter(Boolean).length;
    // model output passes the same gate as user text: any listed topic (remedies, death, harm …) falls back to the rule question
    if (!q || words > 22 || detectTopic(q) || /\b(rupees|dollars|lakhs|crores)\b/i.test(q)) return { ask, usage };
    return { ask: { ...ask, question: q }, usage };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'clarify phrase model failed; using rule question', error: (err as Error).message.slice(0, 200) }));
    return { ask, usage: null };
  }
}

/**
 * Resolve free text for a criterion into one of the closed values the machine accepts
 * (a horizon id or range, a bucket id, a sub-bucket id, a person). Returns null when the model cannot.
 */
export async function resolveFreeText(s: ClarifyState, criterion: string, text: string): Promise<{ value: string | null; usage: Usage | null }> {
  const cfg = clarifyModelConfig();
  if (cfg.provider === 'off') return { value: null, usage: null };
  // a place is stored as typed; nothing for a model to map
  if (criterion === 'location') return { value: null, usage: null };
  const options =
    criterion === 'sibling'
      ? 'elder | younger | all'
      : criterion === 'horizon'
      ? `one of now | 3m | 6m | 1y | 3y | life, or range:YYYY-MM-DD:YYYY-MM-DD (today is ${s.asOf})`
      : criterion === 'bucket'
        ? BUCKET_IDS.filter((b) => b !== 'unknown').join(' | ')
        : criterion === 'sub_bucket'
          ? BUCKETS[s.bucket].subBuckets.map((x) => x.id).join(' | ')
          : 'me | partner | spouse | child | son | daughter | mother | father | parent | brother | sister | friend | other';
  try {
    const user = `Question: "${s.question.slice(0, 300)}"\nThe app asked about: ${criterion}.\nThe person replied: "${text.slice(0, 300)}"\nMap the reply to ${options}. Return {"value": "<value>"} or {"value": null} if it does not say.`;
    const { json, usage } = await callBedrockJson({ model: cfg.model, node: 'clarify.resolve', system: SYSTEM, user, maxTokens: 300, timeoutMs: CLARIFY_MODEL_TIMEOUT_MS, reasoningEffort: 'low' });
    const v = (json as { value?: unknown }).value;
    if (typeof v !== 'string') return { value: null, usage };
    if (criterion === 'horizon' && !parseHorizonValue(v, s.asOf)) return { value: null, usage };
    return { value: v, usage };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'clarify resolve model failed; rules only', error: (err as Error).message.slice(0, 200) }));
    return { value: null, usage: null };
  }
}

/**
 * Prashna eligibility when the rules are unsure (doc 28 §5): is the confirmed question a yes/no, "should I", "will it
 * happen" or "right now" decision? The model only answers true or false; any error, timeout or other output keeps the
 * rules' "not eligible". Never called for a question the rules ruled out (declined, role-gated, policy, timing).
 */
export async function judgePrashna(s: ClarifyState, rules: PrashnaEligibility): Promise<{ result: PrashnaEligibility; usage: Usage | null }> {
  if (rules.rule !== 'unsure') return { result: rules, usage: null };
  const cfg = clarifyModelConfig();
  if (cfg.provider === 'off') return { result: rules, usage: null };
  try {
    const user = [
      `Question: "${s.question.slice(0, 300)}"`,
      'Is this a yes-or-no question, a "should I" decision, a "will this happen" question, or a question about acting right now?',
      'Return {"eligible": true} or {"eligible": false}.',
    ].join(' ');
    const { json, usage } = await callBedrockJson({ model: cfg.model, node: 'clarify.prashna', system: SYSTEM, user, maxTokens: 100, timeoutMs: CLARIFY_MODEL_TIMEOUT_MS, reasoningEffort: 'low' });
    const v = (json as { eligible?: unknown }).eligible;
    if (typeof v !== 'boolean') return { result: rules, usage };
    return { result: { eligible: v, rule: v ? 'eligible' : 'not_eligible', source: 'model', why: rules.why }, usage };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'clarify prashna model failed; rules only', error: (err as Error).message.slice(0, 200) }));
    return { result: rules, usage: null };
  }
}
