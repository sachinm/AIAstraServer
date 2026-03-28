/**
 * Groq chat service – calls Groq API (openai/gpt-oss-120b) with system prompt from DB
 * and user's Kundli data (biodata, d1, d7, d9, d10, charakaraka, vimsottari_dasa, narayana_dasa) with clear markup.
 * Uses groq-sdk directly; LangGraph/ChatGroq can be re-enabled when @langchain/core exports
 * utils/standard_schema (see ERR_PACKAGE_PATH_NOT_EXPORTED with @langchain/groq).
 */
import Groq from 'groq-sdk';
import type { PrismaClient } from '@prisma/client';
import { loadSystemPrompt } from './kundliService.js';
import { fetchLatestKundliForUser } from '../../kundli-rag.js';

const GROQ_CHAT_SYSTEM_PROMPT_NAME = 'pvr_oracle';
const GROQ_MODEL = 'openai/gpt-oss-120b';

/** Kundli fields we send to the LLM with clear labels (matches schema.prisma Kundli model) */
const KUNDLI_FIELD_LABELS: Record<string, string> = {
  biodata: 'Birth/place/time metadata (date, time, place, timezone, ayanamsa)',
  d1: 'D-1 Rashi chart (planets, houses, lagna)',
  d7: 'D-7 Saptamsa chart',
  d9: 'D-9 Navamsa chart',
  d10: 'D-10 Dasamsa chart',
  charakaraka: 'Chara Karaka (planetary significators)',
  vimsottari_dasa: 'Vimsottari Dasa periods',
  narayana_dasa: 'Narayana Dasa periods',
};

/** Short title per field for the "This is the person's ..." prefix in each user message. Exported for tests. */
export const KUNDLI_FIELD_TITLES: Record<string, string> = {
  biodata: "birth/place/time metadata (biodata)",
  d1: "D-1 chart (Rashi chart)",
  d7: "D-7 chart (Saptamsa)",
  d9: "D-9 chart (Navamsa)",
  d10: "D-10 chart (Dasamsa)",
  charakaraka: "Chara Karaka",
  vimsottari_dasa: "Vimsottari Dasa",
  narayana_dasa: "Narayana Dasa",
};

/**
 * Build one user message content string for a single Kundli field: title, then JSON (or placeholder), then newline.
 * When hasValue is false (null/undefined), still include the field so it appears in the requestPayload like other fields.
 */
function formatFieldContent(key: string, value: unknown, hasValue: boolean): string {
  const title = KUNDLI_FIELD_TITLES[key] ?? key;
  const body = hasValue
    ? (typeof value === 'string' ? value : JSON.stringify(value, null, 2))
    : '(no data available)';
  return `This is the ${title} of the person:\n${body}\n`;
}

export interface BuildUserMessageWithKundliResult {
  /** One {"role": "user", "content": "..."} content string per present Kundli field */
  kundliUserContents: string[];
  userQuestion: string;
}

/**
 * Build separate user-message contents for each Kundli field (with title + JSON + newline),
 * plus the user's question. Each field is intended to be sent as its own
 * {"role": "user", "content": "..."} so the LLM sees clearly separated data points.
 */
export function buildUserMessageWithKundli(
  kundli: {
    biodata: unknown;
    d1: unknown;
    d7?: unknown;
    d9: unknown;
    d10: unknown;
    charakaraka: unknown;
    vimsottari_dasa: unknown;
    narayana_dasa?: unknown;
  },
  userQuestion: string
): BuildUserMessageWithKundliResult {
  type KundliKey = keyof typeof KUNDLI_FIELD_LABELS;
  const fields: KundliKey[] = [
    'biodata',
    'd1',
    'd7',
    'd9',
    'd10',
    'charakaraka',
    'vimsottari_dasa',
    'narayana_dasa',
  ];

  const kundliUserContents: string[] = [];
  for (const key of fields) {
    const value = (kundli as Record<KundliKey, unknown>)[key];
    const hasValue = value !== null && value !== undefined;
    kundliUserContents.push(formatFieldContent(key, value, hasValue));
  }

  return {
    kundliUserContents,
    userQuestion: userQuestion.trim(),
  };
}

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error('GROQ_API_KEY is required for chat');
  return new Groq({ apiKey });
}

export interface ChatWithGroqResult {
  answerText: string;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown>;
}

/**
 * Run one chat turn: load system prompt, load user's latest Kundli,
 * package kundli + question into user message, call Groq (stream: true), consume and return
 * answer text plus request/response payloads for logging (e.g. ChatLog).
 */
export async function chatWithGroq(
  prisma: PrismaClient,
  userId: string,
  userQuestion: string,
  options?: { onDelta?: (delta: string) => void }
): Promise<ChatWithGroqResult> {
  const systemPrompt = await loadSystemPrompt(prisma, GROQ_CHAT_SYSTEM_PROMPT_NAME);
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

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...kundliUserContents.map((content) => ({ role: 'user' as const, content })),
    { role: 'user', content: questionText },
  ];

  const client = getGroqClient();
  const stream = await client.chat.completions.create({
    messages,
    model: GROQ_MODEL,
    temperature: 1,
    max_completion_tokens: 8192,
    top_p: 1,
    stream: true,
    reasoning_effort: 'medium',
    stop: null,
  });

  const requestPayload: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    temperature: 1,
    max_completion_tokens: 8192,
    top_p: 1,
    stream: true,
    reasoning_effort: 'medium',
  };

  let fullContent = '';
  let lastChunk: { choices?: Array<{ finish_reason?: string }>; usage?: unknown } | null = null;
  for await (const chunk of stream) {
    lastChunk = chunk as { choices?: Array<{ finish_reason?: string }>; usage?: unknown };
    const delta = (chunk as { choices?: Array<{ delta?: { content?: string } }> })?.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') {
      fullContent += delta;
      options?.onDelta?.(delta);
    }
  }

  const answerText = fullContent.trim() || 'No response generated.';

  const responsePayload: Record<string, unknown> = {
    streamed: true,
    content: answerText,
    finish_reason: lastChunk?.choices?.[0]?.finish_reason ?? null,
    usage: lastChunk?.usage ?? null,
  };

  return { answerText, requestPayload, responsePayload };
}
