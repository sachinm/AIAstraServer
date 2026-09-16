/**
 * Gemini chat – REST `streamGenerateContent` with system prompt from DB and the same Kundli packaging as Groq.
 * Uses Gemini explicit cachedContents when a valid DynamoDB pointer exists.
 */
import type { PrismaClient } from '@prisma/client';
import { Agent, fetch as undiciFetch } from 'undici';
import { loadSystemPrompt } from './kundliService.js';
import { fetchLatestKundliForUser } from '../../kundli-rag.js';
import { buildUserMessageWithKundli } from './groqChatService.js';
import type { ChatWithGroqResult } from './groqChatService.js';
import {
  getGeminiMaxOutputTokens,
  getGeminiTemperature,
  getGeminiTopP,
  getGeminiStreamGenerateContentUrl,
  getGeminiUndiciBodyTimeoutMs,
  getGeminiUndiciHeadersTimeoutMs,
  getChatKundliContextMode,
} from '../config/env.js';
import {
  ensureGeminiCacheForUser,
  GEMINI_CONCISE_ANSWER_APPENDIX,
  isGeminiCacheEnabled,
  resolveGeminiCacheNameForChat,
} from './geminiCacheService.js';

const GEMINI_CHAT_SYSTEM_PROMPT_NAME = 'pvr_oracle';

/** Reused undici Agent so connections pool; timeouts read from env on first use. */
let geminiUndiciAgent: Agent | undefined;

function getGeminiUndiciAgent(): Agent {
  if (!geminiUndiciAgent) {
    geminiUndiciAgent = new Agent({
      headersTimeout: getGeminiUndiciHeadersTimeoutMs(),
      bodyTimeout: getGeminiUndiciBodyTimeoutMs(),
    });
  }
  return geminiUndiciAgent;
}

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is required when CHAT_LLM_PROVIDER=gemini');
  return key;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }>; role?: string };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: Record<string, unknown>;
  error?: { message?: string; code?: number; status?: string };
}

function extractAnswerText(parsed: GeminiGenerateContentResponse): string {
  const block = parsed.promptFeedback?.blockReason;
  if (block) {
    return `Response blocked (${block}).`;
  }
  const parts = parsed.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    return 'No response generated.';
  }
  const text = parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim();
  return text || 'No response generated.';
}

/** Text delta in one streamed `GenerateContentResponse` chunk (Gemini sends incremental parts). */
function extractStreamDelta(parsed: GeminiGenerateContentResponse): string {
  if (parsed.promptFeedback?.blockReason) return '';
  const parts = parsed.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
}

function throwIfGeminiApiError(parsed: GeminiGenerateContentResponse): void {
  const err = parsed.error;
  if (!err) return;
  const msg =
    typeof err.message === 'string'
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message?: string }).message)
        : 'Gemini API error';
  throw new Error(msg || 'Gemini API error');
}

/**
 * Consumes Gemini `streamGenerateContent?alt=sse` body: SSE events with `data: {json}`.
 */
async function consumeGeminiSseStream(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void
): Promise<{ answerText: string; lastChunk: GeminiGenerateContentResponse | null; rawPreview: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let lastChunk: GeminiGenerateContentResponse | null = null;
  const rawSnippets: string[] = [];
  const maxPreviewChars = 4000;

  const handleJsonLine = (jsonStr: string): void => {
    const trimmed = jsonStr.trim();
    if (!trimmed || trimmed === '[DONE]') return;
    let parsed: GeminiGenerateContentResponse;
    try {
      parsed = JSON.parse(trimmed) as GeminiGenerateContentResponse;
    } catch {
      return;
    }
    throwIfGeminiApiError(parsed);
    lastChunk = parsed;
    const block = parsed.promptFeedback?.blockReason;
    if (block) {
      accumulated = `Response blocked (${block}).`;
      return;
    }
    const delta = extractStreamDelta(parsed);
    if (delta) {
      accumulated += delta;
      onDelta?.(delta);
    }
    if (rawSnippets.join('').length < maxPreviewChars) {
      rawSnippets.push(trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}…` : trimmed);
    }
  };

  const processEventBlock = (block: string): void => {
    for (const line of block.split('\n')) {
      const t = line.trimEnd();
      if (!t.startsWith('data:')) continue;
      handleJsonLine(t.slice(5).trimStart());
    }
  };

  const flushBuffer = (): void => {
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const event = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      processEventBlock(event);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        flushBuffer();
      }
      if (done) {
        buffer += decoder.decode();
        flushBuffer();
        if (buffer.trim()) processEventBlock(buffer);
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const trimmedAnswer = accumulated.trim();
  const answerText =
    trimmedAnswer ||
    (lastChunk ? extractAnswerText(lastChunk) : '') ||
    'No response generated.';

  return {
    answerText,
    lastChunk,
    rawPreview:
      rawSnippets.join('\n').length > maxPreviewChars
        ? `${rawSnippets.join('\n').slice(0, maxPreviewChars)}…[truncated]`
        : rawSnippets.join('\n'),
  };
}

/**
 * One chat turn via Gemini `streamGenerateContent` (SSE); accumulates deltas into `answerText`
 * for GraphQL (same shape as Groq streaming).
 */
export async function chatWithGemini(
  prisma: PrismaClient,
  userId: string,
  userQuestion: string,
  options?: { onDelta?: (delta: string) => void }
): Promise<ChatWithGroqResult> {
  const t0 = Date.now();
  let tAfterPrompt = t0;
  let tAfterKundli = t0;
  let tAfterCache = t0;

  const maxOutputTokens = getGeminiMaxOutputTokens();
  const temperature = getGeminiTemperature();
  const topP = getGeminiTopP();

  let cacheName: string | null = null;
  if (isGeminiCacheEnabled()) {
    try {
      cacheName = await resolveGeminiCacheNameForChat(prisma, userId);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: 'geminiCache resolve failed',
          error: (err as Error).message,
        })
      );
      cacheName = null;
    }
  }
  tAfterCache = Date.now();

  let requestBody: Record<string, unknown>;
  let kundliCharCount = 0;
  let usedCache = false;

  if (cacheName) {
    usedCache = true;
    tAfterPrompt = tAfterCache;
    tAfterKundli = tAfterCache;
    requestBody = {
      cachedContent: cacheName,
      contents: [{ role: 'user', parts: [{ text: userQuestion.trim() }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        topP,
      },
    };
  } else {
    const systemPromptBase = await loadSystemPrompt(prisma, GEMINI_CHAT_SYSTEM_PROMPT_NAME);
    tAfterPrompt = Date.now();
    const systemPrompt = `${String(systemPromptBase ?? '').trimEnd()}\n\n${GEMINI_CONCISE_ANSWER_APPENDIX}`;

    const kundliRow = await fetchLatestKundliForUser(prisma, userId);
    tAfterKundli = Date.now();
    const { kundliUserContents, userQuestion: questionText } = buildUserMessageWithKundli(
      {
        biodata: kundliRow.biodata,
        d1: kundliRow.d1,
        d2: kundliRow.d2,
        d4: kundliRow.d4,
        d7: kundliRow.d7,
        d9: kundliRow.d9,
        d10: kundliRow.d10,
        charakaraka: kundliRow.charakaraka,
        vimsottari_dasa: kundliRow.vimsottari_dasa,
        narayana_dasa: kundliRow.narayana_dasa,
      },
      userQuestion
    );

    kundliCharCount = kundliUserContents.reduce((n, s) => n + s.length, 0);

    const contents = [
      ...kundliUserContents.map((text) => ({
        role: 'user' as const,
        parts: [{ text }],
      })),
      { role: 'user' as const, parts: [{ text: questionText }] },
    ];

    requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens,
        topP,
      },
    };

    if (isGeminiCacheEnabled()) {
      void ensureGeminiCacheForUser(prisma, userId);
    }
  }

  const streamPath = getGeminiStreamGenerateContentUrl();
  const requestPayload: Record<string, unknown> = {
    provider: 'gemini',
    url: streamPath,
    stream: true,
    alt: 'sse',
    usedCache,
    ...(usedCache ? { cachedContent: cacheName } : {}),
    ...requestBody,
  };

  const apiKey = getGeminiApiKey();
  const url = `${streamPath}?alt=sse&key=${encodeURIComponent(apiKey)}`;

  const tBeforeGemini = Date.now();
  const res = await undiciFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    dispatcher: getGeminiUndiciAgent(),
  });

  if (!res.ok) {
    const errText = await res.text();
    let parsed: GeminiGenerateContentResponse = {};
    try {
      parsed = errText ? (JSON.parse(errText) as GeminiGenerateContentResponse) : {};
    } catch {
      /* plain-text error body */
    }
    const msg =
      parsed.error?.message ||
      (errText && errText.length < 2000 ? errText : null) ||
      `HTTP ${res.status}`;
    throw new Error(msg || `Gemini request failed with status ${res.status}`);
  }

  if (!res.body) {
    throw new Error('Gemini stream response has no body');
  }

  const { answerText, lastChunk, rawPreview } = await consumeGeminiSseStream(
    res.body as ReadableStream<Uint8Array>,
    options?.onDelta
  );
  const tEnd = Date.now();
  const finishReason = lastChunk?.candidates?.[0]?.finishReason ?? null;

  // Timing only — never log API keys, prompts, or Kundli payloads.
  console.log(
    JSON.stringify({
      msg: 'chatWithGemini timing',
      kundliContext: getChatKundliContextMode(),
      usedCache,
      promptLoadMs: tAfterPrompt - t0,
      kundliFetchMs: tAfterKundli - tAfterPrompt,
      cacheResolveMs: tAfterCache - t0,
      geminiCallMs: tEnd - tBeforeGemini,
      totalMs: tEnd - t0,
      kundliCharCountApprox: kundliCharCount,
      maxOutputTokens,
      temperature,
      topP,
      finishReason,
    })
  );

  const responsePayload: Record<string, unknown> = {
    provider: 'gemini',
    streamed: true,
    content: answerText,
    finish_reason: finishReason,
    usage: lastChunk?.usageMetadata ?? null,
    raw_preview: rawPreview,
    used_cache: usedCache,
  };

  return { answerText, requestPayload, responsePayload };
}
