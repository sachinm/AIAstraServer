/**
 * Amazon Bedrock (Converse API) for the small, cheap calls of the reading engine — today the clarifier.
 *
 * Default model: `openai.gpt-oss-120b-1:0` (open-weight reasoning model, on demand in us-east-1), reasoning effort "low".
 * Meta's strongest option on Bedrock here is Llama 4 Maverick (`us.meta.llama4-maverick-17b-instruct-v1:0`, US inference
 * profile; no reasoning-effort field). Meta "Muse" is not offered on Bedrock in this account/region (checked 2026-10-25).
 * Configure with READING_MODEL_CLARIFY=bedrock:<modelId or inference profile id> and BEDROCK_REGION (default us-east-1).
 * The Lambda role needs `bedrock:InvokeModel` on that model (Terraform draft, not applied here).
 *
 * Rules that matter for cost and quota (docs: amazon-bedrock skill):
 *  - maxTokens is ALWAYS set explicitly (an unset value reserves the model maximum against the quota);
 *  - ValidationException / AccessDeniedException are not retried; throttling gets one SDK retry;
 *  - a hard timeout keeps the clarifier sub-second budget honest; callers fall back to rules on any error.
 */
import { BedrockRuntimeClient, ConverseCommand, type ConverseCommandOutput } from '@aws-sdk/client-bedrock-runtime';
import type { Usage } from '../types.js';

export const DEFAULT_CLARIFY_MODEL = 'openai.gpt-oss-120b-1:0';

/** Only gpt-oss models accept `reasoning_effort`; other providers reject unknown fields. */
export const supportsReasoningEffort = (model: string): boolean => /(^|.)openai.gpt-oss/.test(model);

let client: BedrockRuntimeClient | null = null;
function bedrock(): BedrockRuntimeClient {
  // one warm client per instance (keeps the TLS connection to the Bedrock endpoint alive between invocations)
  if (!client) client = new BedrockRuntimeClient({ region: process.env.BEDROCK_REGION?.trim() || 'us-east-1', maxAttempts: 2, retryMode: 'adaptive' });
  return client;
}

/** Test seam. */
export function setBedrockClientForTests(c: { send: (cmd: ConverseCommand) => Promise<Partial<ConverseCommandOutput>> } | null): void {
  client = c as unknown as BedrockRuntimeClient | null;
}

export interface BedrockJsonCall {
  model: string;
  node: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
  /** gpt-oss / reasoning models: low | medium | high. Ignored by models without reasoning. */
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/** Pulls the first JSON object out of a model reply (reasoning models may wrap it in prose or code fences). */
export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf('{');
  if (start < 0) throw new Error('no JSON object in model reply');
  let depth = 0;
  let inStr = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return JSON.parse(body.slice(start, i + 1));
  }
  throw new Error('unterminated JSON object in model reply');
}

/** One Converse call that must return a JSON object. Throws on timeout, refusal or unparseable output. */
export async function callBedrockJson(call: BedrockJsonCall): Promise<{ json: unknown; usage: Usage }> {
  const t0 = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), call.timeoutMs);
  try {
    const out = await bedrock().send(
      new ConverseCommand({
        modelId: call.model,
        system: [{ text: call.system }],
        messages: [{ role: 'user', content: [{ text: call.user }] }],
        inferenceConfig: { maxTokens: call.maxTokens, temperature: 0 },
        ...(call.reasoningEffort && supportsReasoningEffort(call.model) ? { additionalModelRequestFields: { reasoning_effort: call.reasoningEffort } } : {}),
      }),
      { abortSignal: ac.signal }
    );
    const blocks = out.output?.message?.content ?? [];
    const text = blocks.map((b) => ('text' in b && typeof b.text === 'string' ? b.text : '')).join('');
    const json = extractJsonObject(text);
    const usage: Usage = {
      node: call.node,
      model: `bedrock:${call.model}`,
      promptTokens: out.usage?.inputTokens ?? 0,
      cachedTokens: out.usage?.cacheReadInputTokens ?? 0,
      outputTokens: out.usage?.outputTokens ?? 0,
      thoughtTokens: 0,
      ms: Date.now() - t0,
    };
    return { json, usage };
  } finally {
    clearTimeout(timer);
  }
}

/** "bedrock:openai.gpt-oss-20b-1:0" -> provider + model; "off" disables the model step. */
export function clarifyModelConfig(): { provider: 'bedrock' | 'off'; model: string } {
  const raw = process.env.READING_MODEL_CLARIFY?.trim();
  if (!raw) return { provider: 'off', model: DEFAULT_CLARIFY_MODEL };
  if (raw === 'off') return { provider: 'off', model: DEFAULT_CLARIFY_MODEL };
  if (raw.startsWith('bedrock:')) return { provider: 'bedrock', model: raw.slice('bedrock:'.length) || DEFAULT_CLARIFY_MODEL };
  return { provider: 'bedrock', model: raw };
}
