/**
 * Thin Gemini REST wrapper for the reading engine (undici, no LangChain provider package).
 *
 * - Always sends `thinkingConfig` in the request body (lesson in docs/grokbots/SKILLS.md). Thought summaries are requested
 *   only when the caller sets `includeThoughts` (the streamed answer call); they go to `onThought`, never into the answer text.
 * - Maps one `thinking` setting to `thinkingBudget` (2.x models) or `thinkingLevel` (3.x and later).
 * - Captures usage (prompt, cached, output, thought tokens), time to first token and total time per call.
 * - One retry with jitter on 429/500/503; a per-call timeout through AbortController.
 * - Prompt layout is the caller's job: keep the stable prefix (system, then the user's base chart) first so Gemini's
 *   implicit prefix cache hits; `cachedTokens` shows whether it did.
 */
import { Agent, fetch as undiciFetch } from 'undici';
import { getGeminiModelsBaseUrl, getGeminiUndiciBodyTimeoutMs, getGeminiUndiciHeadersTimeoutMs } from '../../config/env.js';
import type { Usage } from '../types.js';
import { cacheNameFor, invalidateCache, type CacheOwner } from './promptCache.js';

export type Thinking = 'off' | 'low' | 'medium' | 'high';

export interface GeminiCallOptions {
  model: string;
  node: string;
  /** Stable system instruction (same bytes for every user: persona + method) */
  system?: string;
  /** User content parts in order: stable base first, then the subject-dependent part, then the question */
  parts: string[];
  /** Gemini responseSchema (OpenAPI subset, uppercase types); forces JSON output */
  responseSchema?: Record<string, unknown>;
  thinking?: Thinking;
  /** Ask Gemini for thought summaries (streamed calls only). They are shown to the user, not stored or logged. */
  includeThoughts?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** system + parts[0] form a stable prefix that may be served from the explicit prompt cache (promptCache.ts) */
  cachePrefix?: boolean;
  /** Who the cached prefix belongs to (logout deletes that user's caches) */
  cacheOwner?: CacheOwner;
}

export interface GeminiResult {
  text: string;
  usage: Usage;
  finishReason: string | null;
  ttftMs: number | null;
  stoppedForLoop: boolean;
}

let agent: Agent | undefined;
function getAgent(): Agent {
  if (!agent) {
    agent = new Agent({
      headersTimeout: getGeminiUndiciHeadersTimeoutMs(),
      bodyTimeout: getGeminiUndiciBodyTimeoutMs(),
      keepAliveTimeout: 30_000,
      connections: 16,
    });
  }
  return agent;
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is required for the reading engine');
  return key;
}

const BUDGETS: Record<Thinking, number> = { off: 0, low: 512, medium: 2048, high: 6144 };
const isLegacyThinking = (model: string): boolean => /gemini-2\./.test(model);

export function thinkingConfigFor(model: string, thinking: Thinking, includeThoughts = false): Record<string, unknown> {
  // 2.x with a zero budget has nothing to summarise; 3.x maps `off` to `low`, so it still thinks
  if (isLegacyThinking(model)) return { thinkingBudget: BUDGETS[thinking], includeThoughts: includeThoughts && thinking !== 'off' };
  return { thinkingLevel: thinking === 'off' ? 'low' : thinking, includeThoughts };
}

export function buildRequestBody(o: GeminiCallOptions, cacheName: string | null = null): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = {
    temperature: o.temperature ?? 0.4,
    topP: o.topP ?? 0.9,
    maxOutputTokens: o.maxOutputTokens ?? 4096,
    thinkingConfig: thinkingConfigFor(o.model, o.thinking ?? 'low', o.includeThoughts === true),
  };
  if (o.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = o.responseSchema;
  }
  // with an explicit cache the system instruction and the first part live in the cache; send only the rest
  const parts = cacheName ? o.parts.slice(1) : o.parts;
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: parts.map((text) => ({ text })) }],
    generationConfig,
  };
  if (cacheName) body.cachedContent = cacheName;
  else if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
  return body;
}

interface GeminiChunk {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; cachedContentTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  error?: { message?: string };
}

function chunkText(c: GeminiChunk): string {
  const parts = c.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts.filter((p) => !p.thought).map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
}

/** Thought-summary text in this chunk (parts flagged `thought`). Never part of the answer. */
export function chunkThought(c: GeminiChunk): string {
  const parts = c.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts.filter((p) => p.thought).map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
}

function toUsage(o: GeminiCallOptions, last: GeminiChunk | null, ms: number): Usage {
  const u = last?.usageMetadata ?? {};
  return {
    node: o.node,
    model: o.model,
    promptTokens: u.promptTokenCount ?? 0,
    cachedTokens: u.cachedContentTokenCount ?? 0,
    outputTokens: u.candidatesTokenCount ?? 0,
    thoughtTokens: u.thoughtsTokenCount ?? 0,
    ms,
  };
}

function detectLoop(text: string): boolean {
  if (text.length < 400) return false;
  const window = Math.min(48, Math.max(24, Math.floor(text.length / 10)));
  const needle = text.slice(-window);
  if (needle.trim().length < 20) return false;
  const hay = text.slice(Math.max(0, text.length - 2500));
  let count = 0;
  let idx = 0;
  while ((idx = hay.indexOf(needle, idx)) !== -1) {
    count += 1;
    if (count >= 4) return true;
    idx += Math.max(1, Math.floor(window / 2));
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(url: string, body: unknown, o: GeminiCallOptions): Promise<{ res: Awaited<ReturnType<typeof undiciFetch>>; abort: () => void; clear: () => void }> {
  const controller = new AbortController();
  const timeoutMs = o.timeoutMs ?? 60_000;
  const timer = setTimeout(() => controller.abort(new Error(`Gemini call timed out after ${timeoutMs}ms`)), timeoutMs);
  if (o.signal) {
    if (o.signal.aborted) controller.abort();
    else o.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const clear = () => clearTimeout(timer);
  let res = await undiciFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), dispatcher: getAgent(), signal: controller.signal });
  if ([429, 500, 503].includes(res.status)) {
    await res.text().catch(() => '');
    await sleep(400 + Math.floor(Math.random() * 500));
    res = await undiciFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), dispatcher: getAgent(), signal: controller.signal });
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    clear();
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(errText) as GeminiChunk;
      if (j.error?.message) msg = j.error.message;
    } catch {
      if (errText && errText.length < 600) msg = errText;
    }
    throw new Error(msg);
  }
  return { res, abort: () => controller.abort(), clear };
}

/** Non-streaming call (specialists, intake). Returns the full text. */
function cacheFor(o: GeminiCallOptions): string | null {
  return o.cachePrefix && o.parts.length > 1 ? cacheNameFor(o.model, o.system, o.parts[0]!, apiKey(), o.cacheOwner) : null;
}

export async function callGemini(o: GeminiCallOptions): Promise<GeminiResult> {
  const cacheName = cacheFor(o);
  try {
    return await callGeminiOnce(o, cacheName);
  } catch (err) {
    if (!cacheName) throw err;
    // the cache was rejected (expired or deleted): forget it and answer uncached
    invalidateCache(o.model, o.system, o.parts[0]!);
    return callGeminiOnce(o, null);
  }
}

async function callGeminiOnce(o: GeminiCallOptions, cacheName: string | null): Promise<GeminiResult> {
  const t0 = Date.now();
  const url = `${getGeminiModelsBaseUrl()}/${o.model}:generateContent?key=${encodeURIComponent(apiKey())}`;
  const { res, clear } = await post(url, buildRequestBody(o, cacheName), o);
  try {
    const json = (await res.json()) as GeminiChunk;
    if (json.error?.message) throw new Error(json.error.message);
    const block = json.promptFeedback?.blockReason;
    const text = block ? '' : chunkText(json);
    const ms = Date.now() - t0;
    return { text, usage: toUsage(o, json, ms), finishReason: json.candidates?.[0]?.finishReason ?? (block ? `BLOCKED_${block}` : null), ttftMs: ms, stoppedForLoop: false };
  } finally {
    clear();
  }
}

/** Streaming call (synthesizer / single-call path). Deltas go to `onDelta` as they arrive. */
export async function streamGemini(
  o: GeminiCallOptions,
  onDelta?: (delta: string) => void,
  onThought?: (delta: string) => void
): Promise<GeminiResult> {
  const t0 = Date.now();
  const url = `${getGeminiModelsBaseUrl()}/${o.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey())}`;
  const cacheName = cacheFor(o);
  let posted: Awaited<ReturnType<typeof post>>;
  try {
    posted = await post(url, buildRequestBody(o, cacheName), o);
  } catch (err) {
    if (!cacheName) throw err;
    invalidateCache(o.model, o.system, o.parts[0]!);
    posted = await post(url, buildRequestBody(o, null), o);
  }
  const { res, abort, clear } = posted;
  if (!res.body) {
    clear();
    throw new Error('Gemini stream response has no body');
  }
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let last: GeminiChunk | null = null;
  let finishReason: string | null = null;
  let ttftMs: number | null = null;
  let stoppedForLoop = false;

  const handle = (raw: string): void => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[DONE]') return;
    let c: GeminiChunk;
    try {
      c = JSON.parse(trimmed) as GeminiChunk;
    } catch {
      return;
    }
    if (c.error?.message) throw new Error(c.error.message);
    last = c;
    if (c.candidates?.[0]?.finishReason) finishReason = c.candidates[0].finishReason;
    if (c.promptFeedback?.blockReason) {
      finishReason = `BLOCKED_${c.promptFeedback.blockReason}`;
      return;
    }
    // thought summaries arrive before the answer; they never count as the first answer token
    const thought = onThought ? chunkThought(c) : '';
    if (thought) onThought?.(thought);
    const delta = chunkText(c);
    if (delta) {
      if (ttftMs === null) ttftMs = Date.now() - t0;
      text += delta;
      onDelta?.(delta);
      if (detectLoop(text)) {
        stoppedForLoop = true;
        abort();
      }
    }
  };
  const flush = (): void => {
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of block.split('\n')) {
        const t = line.trimEnd();
        if (t.startsWith('data:')) handle(t.slice(5).trimStart());
      }
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        flush();
      }
      if (done) {
        buffer += decoder.decode();
        flush();
        if (buffer.trim()) for (const line of buffer.split('\n')) if (line.trimEnd().startsWith('data:')) handle(line.trimEnd().slice(5).trimStart());
        break;
      }
    }
  } catch (err) {
    if (!stoppedForLoop) throw err;
  } finally {
    clear();
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
  const ms = Date.now() - t0;
  return { text: text.trim(), usage: toUsage(o, last, ms), finishReason, ttftMs, stoppedForLoop };
}
