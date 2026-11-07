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
import { callBedrockJson, clarifyModelConfig, extractJsonObject } from '../llm/bedrock.js';
import { callGemini } from '../llm/gemini.js';
import type { CacheOwner } from '../llm/promptCache.js';
import { MAX_QUESTIONS, parseHorizonValue, type Ask, type ClarifyState, type PrashnaEligibility } from './machine.js';
import { detectTopic } from '../policy/declined.js';
import { CRITERION_ASTROLOGICAL_PURPOSE, getAgentPrompt, renderPromptTemplate } from '../prompts/registry.js';

export const CLARIFY_MODEL_TIMEOUT_MS = 900;

const CLARIFY_CACHE_MAX = 200;
const CLARIFY_CACHE_TTL_MS = 45 * 60_000;
const clarifyCache = new Map<string, { at: number; owner?: CacheOwner; json: unknown; usage: Usage }>();

export function clearClarifyCache(): void {
  clarifyCache.clear();
}

/** Evicts in-memory clarify response cache entries belonging to an individual (`userId`/`kundliId`). */
export function evictClarifyCacheForIndividual(owner: CacheOwner): number {
  if (!owner.userId && !owner.kundliId) return 0;
  let deleted = 0;
  for (const [k, v] of clarifyCache.entries()) {
    if ((owner.userId && v.owner?.userId === owner.userId) || (owner.kundliId && v.owner?.kundliId === owner.kundliId)) {
      clarifyCache.delete(k);
      deleted += 1;
    }
  }
  return deleted;
}

/** Builds the stable digested chart/fact context prefix for Clarify calls so `parts[0]` is cacheable per individual. */
export function buildClarifyContextPrefix(s: Pick<ClarifyState, 'asOf' | 'card' | 'facts' | 'birthPlace' | 'location'>): string {
  const lines = [`CLARIFY CONTEXT AS OF: ${s.asOf}`];
  if (s.card?.md) {
    lines.push(`RUNNING DASHA: ${s.card.md}-${s.card.ad ?? '?'}${s.card.pd ? `-${s.card.pd}` : ''} (AD until ${s.card.adEnd ?? '?'})`);
  }
  if (s.facts && Object.keys(s.facts).length > 0) {
    const sorted = Object.entries(s.facts).sort(([a], [b]) => a.localeCompare(b));
    lines.push(`CONFIRMED PROFILE FACTS: ${JSON.stringify(Object.fromEntries(sorted))}`);
  }
  if (s.location?.place) lines.push(`CURRENT LOCATION: ${s.location.place}`);
  else if (s.birthPlace) lines.push(`BIRTH PLACE: ${s.birthPlace}`);
  return lines.join('\n');
}

async function callClarifyJson(call: {
  provider: 'bedrock' | 'gemini';
  model: string;
  node: string;
  system: string;
  contextPrefix?: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  cacheOwner?: CacheOwner;
}): Promise<{ json: unknown; usage: Usage }> {
  const cacheKey = `${call.provider}|${call.model}|${call.node}|${call.system}|${call.contextPrefix ?? ''}|${call.user}`;
  const cached = clarifyCache.get(cacheKey);
  if (cached && Date.now() - cached.at <= CLARIFY_CACHE_TTL_MS) {
    clarifyCache.delete(cacheKey);
    clarifyCache.set(cacheKey, cached);
    return { json: structuredClone(cached.json), usage: { ...cached.usage, cachedTokens: cached.usage.promptTokens, ms: 0 } };
  }
  if (call.provider === 'gemini') {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`clarify gemini timeout after ${call.timeoutMs}ms`)), call.timeoutMs);
      });
      const parts = call.contextPrefix ? [call.contextPrefix, call.user] : [call.user];
      const { text, usage } = await Promise.race([
        callGemini({
          model: call.model,
          node: call.node,
          system: call.system,
          parts,
          cachePrefix: Boolean(call.contextPrefix),
          ...(call.cacheOwner ? { cacheOwner: call.cacheOwner } : {}),
          maxOutputTokens: call.maxTokens,
          timeoutMs: call.timeoutMs,
          temperature: 0,
          thinking: 'off',
        }),
        timeoutPromise,
      ]);
      const json = extractJsonObject(text);
      if (clarifyCache.size >= CLARIFY_CACHE_MAX) clarifyCache.delete(clarifyCache.keys().next().value as string);
      clarifyCache.set(cacheKey, { at: Date.now(), ...(call.cacheOwner ? { owner: call.cacheOwner } : {}), json: structuredClone(json), usage });
      return { json, usage };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const out = await callBedrockJson({
    model: call.model,
    node: call.node,
    system: call.system,
    user: call.contextPrefix ? `${call.contextPrefix}\n\n${call.user}` : call.user,
    maxTokens: call.maxTokens,
    timeoutMs: call.timeoutMs,
    reasoningEffort: 'low',
  });
  if (clarifyCache.size >= CLARIFY_CACHE_MAX) clarifyCache.delete(clarifyCache.keys().next().value as string);
  clarifyCache.set(cacheKey, { at: Date.now(), ...(call.cacheOwner ? { owner: call.cacheOwner } : {}), json: structuredClone(out.json), usage: out.usage });
  return out;
}

/** Rephrase the rule question for the pending criterion using the DB-versioned Clarify Agent system & user prompts. */
export async function phraseAsk(
  s: ClarifyState,
  ask: Ask,
  prisma?: PrismaClient | null,
  cacheOwner?: CacheOwner,
): Promise<{ ask: Ask; usage: Usage | null; driver?: 'ai' | 'machine_fallback' | 'rules' }> {
  const cfg = clarifyModelConfig();
  if (cfg.provider === 'off') return { ask, usage: null, driver: 'rules' };
  // these two are already as short and plain as they can be; keep the exact wording
  if (ask.criterion === 'sibling' || ask.criterion === 'location' || ask.criterion === 'child_age') {
    return { ask, usage: null, driver: 'rules' };
  }
  try {
    const system = getAgentPrompt('clarify.system', prisma);
    const userTemplate = getAgentPrompt('clarify.phrase_user', prisma);
    const runningPeriod = s.card?.md ? `Running dasha period: ${s.card.md}-${s.card.ad} until ${s.card.adEnd}.` : '';
    const knownFacts = s.facts && Object.keys(s.facts).length > 0 ? ` Known profile facts: ${JSON.stringify(s.facts)}.` : '';
    const astrologicalPurpose =
      (CRITERION_ASTROLOGICAL_PURPOSE[ask.criterion] ??
        'Clarify the specific parameter needed by the Vedic astrology Oracle.') + knownFacts;
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
    const { json, usage } = await callClarifyJson({
      provider: cfg.provider,
      model: cfg.model,
      node: 'clarify.phrase',
      system,
      contextPrefix: buildClarifyContextPrefix(s),
      user,
      maxTokens: 300,
      timeoutMs: CLARIFY_MODEL_TIMEOUT_MS,
      ...(cacheOwner ? { cacheOwner } : {}),
    });
    const q = typeof (json as { question?: unknown }).question === 'string' ? (json as { question: string }).question.trim() : '';
    const words = q.split(/\s+/).filter(Boolean).length;
    // model output passes the same gate as user text: any listed topic (remedies, death, harm …) falls back to the rule question
    if (!q || words > 28 || detectTopic(q) || /\b(rupees|dollars|lakhs|crores|pyjhora|radha|jhora)\b/i.test(q)) {
      return { ask, usage, driver: 'machine_fallback' };
    }
    return { ask: { ...ask, question: q }, usage, driver: 'ai' };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'clarify phrase model failed; using rule question', error: (err as Error).message.slice(0, 200) }));
    return { ask, usage: null, driver: 'machine_fallback' };
  }
}

/**
 * AI-first Clarify turn planner with `machine.ts` deterministic safety gate & fallback.
 * When `READING_MODEL_CLARIFY` is active (`gemini:...` or `bedrock:...`), the AI Clarify agent phrases and directs
 * the clarifying question for the open astrological criterion while respecting known `person_facts` (`s.facts`).
 * When the AI fails, times out, or is disabled (`off`), `machine.ts` rules run as the instant fallback and record
 * `driver: 'machine_fallback' | 'rules'` in `s.decisionLog`.
 */
export async function planAiClarifyTurn(
  s: ClarifyState,
  prisma?: PrismaClient | null,
  cacheOwner?: CacheOwner,
): Promise<{ state: ClarifyState; ask: Ask | null; usage: Usage | null; driver: 'ai' | 'machine_fallback' | 'rules' }> {
  if (s.status !== 'ASKING' || !s.pending) {
    return { state: s, ask: null, usage: null, driver: s.driver ?? 'rules' };
  }
  const { ask, usage, driver = 'rules' } = await phraseAsk(s, s.pending, prisma, cacheOwner);
  const turns = s.turns.map((t, idx) => (idx === s.turns.length - 1 ? { ...t, ask } : t));
  const decisionLog = (s.decisionLog ?? []).map((entry, idx, arr) => {
    if (idx === arr.length - 1 && entry.action === 'asked' && entry.criterion === ask.criterion) {
      const nextDriver: 'ai' | 'rules' | 'machine_fallback' | 'safety_gate' =
        entry.driver === 'safety_gate' ? 'safety_gate' : driver;
      return {
        ...entry,
        driver: nextDriver,
        reason: driver === 'ai' ? 'ai_clarify_directed' : driver === 'machine_fallback' ? 'machine_fallback_after_ai' : entry.reason,
      };
    }
    return entry;
  });
  const nextState: ClarifyState = {
    ...s,
    pending: ask,
    turns,
    decisionLog,
    driver,
  };
  return { state: nextState, ask, usage, driver };
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
  cacheOwner?: CacheOwner,
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
    const { json, usage } = await callClarifyJson({
      provider: cfg.provider,
      model: cfg.model,
      node: 'clarify.resolve',
      system,
      contextPrefix: buildClarifyContextPrefix(s),
      user,
      maxTokens: 300,
      timeoutMs: CLARIFY_MODEL_TIMEOUT_MS,
      ...(cacheOwner ? { cacheOwner } : {}),
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
  cacheOwner?: CacheOwner,
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
    const { json, usage } = await callClarifyJson({
      provider: cfg.provider,
      model: cfg.model,
      node: 'clarify.prashna',
      system,
      contextPrefix: buildClarifyContextPrefix(s),
      user,
      maxTokens: 100,
      timeoutMs: CLARIFY_MODEL_TIMEOUT_MS,
      ...(cacheOwner ? { cacheOwner } : {}),
    });
    const v = (json as { eligible?: unknown }).eligible;
    if (typeof v !== 'boolean') return { result: rules, usage };
    return { result: { eligible: v, rule: v ? 'eligible' : 'not_eligible', source: 'model', why: rules.why }, usage };
  } catch (err) {
    console.warn(JSON.stringify({ msg: 'clarify prashna model failed; rules only', error: (err as Error).message.slice(0, 200) }));
    return { result: rules, usage: null };
  }
}
