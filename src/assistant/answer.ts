/**
 * One question to the public assistant: fixed answers first, then the declined topics, then the model, then a check on
 * what it said. It has no account, chart or database access, so there is nothing private for it to reach.
 */
import { callBedrockJson } from '../reading/llm/bedrock.js';
import { detectDeclined, storedQuestion, type DeclinedTopic } from '../reading/policy/declined.js';
import { cleanAnswer, fixedAnswer, UNSURE } from './guard.js';
import { ASSISTANT_SYSTEM } from './prompt.js';

export const QUESTION_MAX_CHARS = 400;
const MODEL_TIMEOUT_MS = 8000;

/** Nemotron first, as Sachin asked; gpt-oss if it is refused or busy. Both are open-weight models on Bedrock. */
export function assistantModels(env: NodeJS.ProcessEnv = process.env): string[] {
  const first = env.ASSISTANT_MODEL?.trim() || 'nvidia.nemotron-super-3-120b';
  const second = env.ASSISTANT_MODEL_FALLBACK?.trim() || 'openai.gpt-oss-120b-1:0';
  return first === second ? [first] : [first, second];
}

export type Verdict = 'yes' | 'no' | 'needs_chart' | 'unsure';
export type Outcome = 'answered' | 'inside' | 'private' | 'declined' | 'scrubbed' | 'limited' | 'failed';

export interface AssistantResult {
  answer: string;
  verdict: Verdict;
  cta: boolean;
  outcome: Outcome;
  /** what the log keeps of the question: a denied topic's text is not stored */
  storedQuestion: string;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface ModelCall {
  (model: string, question: string): Promise<{ json: unknown; tokensIn: number; tokensOut: number }>;
}

const bedrockCall: ModelCall = async (model, question) => {
  const r = await callBedrockJson({
    model,
    node: 'public_assistant',
    system: ASSISTANT_SYSTEM,
    user: question,
    maxTokens: 400,
    timeoutMs: MODEL_TIMEOUT_MS,
    reasoningEffort: 'low',
  });
  return { json: r.json, tokensIn: r.usage.promptTokens, tokensOut: r.usage.outputTokens };
};

const fixed = (question: string, answer: string, verdict: Verdict, cta: boolean, outcome: Outcome, stored = question): AssistantResult => ({
  answer,
  verdict,
  cta,
  outcome,
  storedQuestion: stored,
  model: null,
  tokensIn: null,
  tokensOut: null,
});

/** The steps that need no model. Returns null when the model should try. */
export function answerWithoutModel(question: string, topics?: DeclinedTopic[]): AssistantResult | null {
  const own = fixedAnswer(question);
  if (own) return fixed(question, own.answer, 'unsure', own.kind === 'inside', own.kind);
  // asking whether it can help a child is a question about the service, so the age check for a reading does not apply
  const topic = detectDeclined(question, { topics, role: null, childAgeConfirmed: true });
  if (topic) return fixed(question, topic.reply, 'no', false, 'declined', storedQuestion(question, topic));
  return null;
}

/** The whole answer. Never throws: with no model available the person still gets a useful line. */
export async function answerQuestion(question: string, opts: { topics?: DeclinedTopic[]; call?: ModelCall; env?: NodeJS.ProcessEnv } = {}): Promise<AssistantResult> {
  const early = answerWithoutModel(question, opts.topics);
  if (early) return early;
  const call = opts.call ?? bedrockCall;
  for (const model of assistantModels(opts.env)) {
    try {
      const { json, tokensIn, tokensOut } = await call(model, question);
      const j = json as { answer?: unknown; verdict?: unknown; cta?: unknown };
      const answer = cleanAnswer(j?.answer);
      if (!answer) return { ...fixed(question, UNSURE, 'unsure', true, 'scrubbed'), model, tokensIn, tokensOut };
      const verdict: Verdict = j.verdict === 'yes' || j.verdict === 'no' || j.verdict === 'needs_chart' ? j.verdict : 'unsure';
      return { answer, verdict, cta: j.cta === true, outcome: 'answered', storedQuestion: question, model, tokensIn, tokensOut };
    } catch (err) {
      console.warn(JSON.stringify({ msg: 'assistant model failed', model, error: (err as Error).message.slice(0, 200) }));
    }
  }
  return fixed(question, UNSURE, 'unsure', true, 'failed');
}
