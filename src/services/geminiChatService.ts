/**
 * Gemini chat – REST `generateContent` with system prompt from DB and the same Kundli packaging as Groq.
 */
import type { PrismaClient } from '@prisma/client';
import { loadSystemPrompt } from './kundliService.js';
import { fetchLatestKundliForUser } from '../../kundli-rag.js';
import { buildUserMessageWithKundli } from './groqChatService.js';
import type { ChatWithGroqResult } from './groqChatService.js';
import { getGeminiGenerateContentUrl, getGeminiMaxOutputTokens } from '../config/env.js';

const GEMINI_CHAT_SYSTEM_PROMPT_NAME = 'pvr_oracle';

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

/**
 * One chat turn via Gemini generateContent (non-streaming).
 */
export async function chatWithGemini(
  prisma: PrismaClient,
  userId: string,
  userQuestion: string
): Promise<ChatWithGroqResult> {
  const systemPrompt = await loadSystemPrompt(prisma, GEMINI_CHAT_SYSTEM_PROMPT_NAME);
  const kundliRow = await fetchLatestKundliForUser(prisma, userId);
  const { kundliUserContents, userQuestion: questionText } = buildUserMessageWithKundli(
    {
      biodata: kundliRow.biodata,
      d1: kundliRow.d1,
      d7: kundliRow.d7,
      d9: kundliRow.d9,
      d10: kundliRow.d10,
      charakaraka: kundliRow.charakaraka,
      vimsottari_dasa: kundliRow.vimsottari_dasa,
      narayana_dasa: kundliRow.narayana_dasa,
    },
    userQuestion
  );

  const contents = [
    ...kundliUserContents.map((text) => ({
      role: 'user' as const,
      parts: [{ text }],
    })),
    { role: 'user' as const, parts: [{ text: questionText }] },
  ];

  const maxOutputTokens = getGeminiMaxOutputTokens();

  const requestBody: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 1,
      maxOutputTokens,
      topP: 1,
    },
  };

  const requestPayload: Record<string, unknown> = {
    provider: 'gemini',
    url: getGeminiGenerateContentUrl(),
    ...requestBody,
  };

  const apiKey = getGeminiApiKey();
  const url = `${getGeminiGenerateContentUrl()}?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const rawText = await res.text();
  let parsed: GeminiGenerateContentResponse;
  try {
    parsed = rawText ? (JSON.parse(rawText) as GeminiGenerateContentResponse) : {};
  } catch {
    throw new Error(`Gemini response is not JSON (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const msg =
      parsed.error?.message ||
      (typeof parsed.error === 'object' && parsed.error && 'message' in parsed.error
        ? String((parsed.error as { message?: string }).message)
        : `HTTP ${res.status}`);
    throw new Error(msg || `Gemini request failed with status ${res.status}`);
  }

  const answerText = extractAnswerText(parsed);

  const responsePayload: Record<string, unknown> = {
    provider: 'gemini',
    streamed: false,
    content: answerText,
    finish_reason: parsed.candidates?.[0]?.finishReason ?? null,
    usage: parsed.usageMetadata ?? null,
    raw_preview: rawText.length > 4000 ? `${rawText.slice(0, 4000)}...[truncated]` : rawText,
  };

  return { answerText, requestPayload, responsePayload };
}
