/**
 * Model step of the clarifier (Bedrock, open-weight model; see src/reading/llm/bedrock.ts).
 *
 * All system prompts and user prompt templates for the Clarify Agent (`clarify.system`, `clarify.phrase_user`,
 * `clarify.resolve_user`, `clarify.prashna_user`) live in the versioned `system_prompts` database table
 * (seeded and cached via `src/reading/prompts/registry.ts`) so they can be edited in PostgreSQL without a code push.
 *
 * Grounded in the fundamentals of Vedic astrology — the charter, mission, and promise of each Graha, Nakshatra,
 * Dasha (Vimshottari MD/AD/PD, Chara/Narayana Dasha), Divisional Varga (D-1/D-9/D-10/D-2/D-4/D-7), Bhava/Arudha,
 * and Gochara transit — the Clarify Agent guides the user in 1 to 5 clarifying questions to confirm:
 *   1. Timeframe (`horizon`)
 *   2. Specific question / sub-domain (`sub_bucket` & `bucket`)
 *   3. People involved / concerned (`subject_person`, `other_person`, `sibling`)
 *   4. Current location (`location`)
 */
import type { PrismaClient } from '@prisma/client';
import type { Usage } from '../types.js';
import { BUCKETS, BUCKET_IDS } from '../buckets/taxonomy.js';
import { callBedrockJson, clarifyModelConfig } from '../llm/bedrock.js';
import { MAX_QUESTIONS, parseHorizonValue, type Ask, type ClarifyState, type PrashnaEligibility } from './machine.js';
import { detectTopic } from '../policy/declined.js';
import { CRITERION_ASTROLOGICAL_PURPOSE, getAgentPrompt, renderPromptTemplate } from '../prompts/registry.js';

export const CLARIFY_MODEL_TIMEOUT_MS = 900;

/** Rephrase the rule question for the pending criterion using the DB-versioned Clarify Agent system & user prompts. */
export async function phraseAsk(s: ClarifyState, ask: Ask, prisma?: PrismaClient | null): Promise<{ ask: Ask; usage: Usage | null }> {
  const cfg = clarifyModelConfig();
  if (cfg.provider === 'off') return { ask, usage: null };
  // these two are already as short and plain as they can be; keep the exact wording
  if (ask.criterion === 'sibling' || ask.criterion === 'location') return { ask, usage: null };
  try {
    const system = getAgentPrompt('clarify.system', prisma);
    const userTemplate = getAgentPrompt('clarify.phrase_user', prisma);
    const runningPeriod = s.card?.md ? `Running dasha period: ${s.card.md}-${s.card.ad} until ${s.card.adEnd}.` : '';
    const astrologicalPurpose =
      CRITERION_ASTROLOGICAL_PURPOSE[ask.criterion] ??
      'Clarify the specific parameter needed by the Vedic astrology Oracle.';
    const user = renderPromptTemplate(userTemplate, {
      question: s.question.slice(0, 300),
      life_area: BUCKETS[s.bucket].displayName,
      running_period: runningPeriod,
      turn_number: String(Math.max(1, s.turns.length)),
      max_questions: String(MAX_QUESTIONS),
      criterion: ask.criterion,
      astrological_purpose: astrologicalPurpose,
      options: ask.chips.map((c) => c.label).join(' | '),
      draft_question: ask.question,
    });
    const { json, usage } = await callBedrockJson({
      model: cfg.model,
      node: 'clarify.phrase',
      system,
      user,
      maxTokens: 300,
      timeoutMs: CLARIFY_MODEL_TIMEOUT_MS,
      reasoningEffort: 'low',
    });
    const q = typeof (json as { question?: unknown }).question === 'string' ? (json as { question: string }).question.trim() : '';
    const words = q.split(/\s+/).filter(Boolean).length;
    // model output passes the same gate as user text: any listed topic (remedies, death, harm …) falls back to the rule question
    if (!q || words > 28 || detectTopic(q) || /\b(rupees|dollars|lakhs|crores)\b/i.test(q)) return { ask, usage };
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
export async function resolveFreeText(
  s: ClarifyState,
  criterion: string,
  text: string,
  prisma?: PrismaClient | null,
): Promise<{ value: string | null; usage: Usage | null }> {
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
    const system = getAgentPrompt('clarify.system', prisma);
    const userTemplate = getAgentPrompt('clarify.resolve_user', prisma);
    const astrologicalPurpose =
      CRITERION_ASTROLOGICAL_PURPOSE[criterion] ?? 'Map the user reply to the corresponding astrological slot.';
    const user = renderPromptTemplate(userTemplate, {
      question: s.question.slice(0, 300),
      criterion,
      astrological_purpose: astrologicalPurpose,
      reply: text.slice(0, 300),
      options,
    });
    const { json, usage } = await callBedrockJson({
      model: cfg.model,
      node: 'clarify.resolve',
      system,
      user,
      maxTokens: 300,
      timeoutMs: CLARIFY_MODEL_TIMEOUT_MS,
      reasoningEffort: 'low',
    });
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
export async function judgePrashna(
  s: ClarifyState,
  rules: PrashnaEligibility,
  prisma?: PrismaClient | null,
): Promise<{ result: PrashnaEligibility; usage: Usage | null }> {
  if (rules.rule !== 'unsure') return { result: rules, usage: null };
  const cfg = clarifyModelConfig();
  if (cfg.provider === 'off') return { result: rules, usage: null };
  try {
    const system = getAgentPrompt('clarify.system', prisma);
    const userTemplate = getAgentPrompt('clarify.prashna_user', prisma);
    const user = renderPromptTemplate(userTemplate, {
      question: s.question.slice(0, 300),
    });
    const { json, usage } = await callBedrockJson({
      model: cfg.model,
      node: 'clarify.prashna',
      system,
      user,
      maxTokens: 100,
      timeoutMs: CLARIFY_MODEL_TIMEOUT_MS,
      reasoningEffort: 'low',
    });
    const v = (json as { eligible?: unknown }).eligible;
    if (typeof v !== 'boolean') return { result: rules, usage };
    return { result: { eligible: v, rule: v ? 'eligible' : 'not_eligible', source: 'model', why: rules.why }, usage };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'clarify prashna model failed; rules only', error: (err as Error).message.slice(0, 200) }));
    return { result: rules, usage: null };
  }
}
