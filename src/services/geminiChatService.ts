/**
 * Gemini chat via @langchain/google-genai (streamGenerateContent under the hood).
 * Streams answer tokens and optional Gemini 2.5 “thinking” parts for SSE clients.
 */
import type { PrismaClient } from '@prisma/client';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, isAIMessageChunk } from '@langchain/core/messages';
import type { AIMessageChunk, BaseMessageChunk } from '@langchain/core/messages';
import { loadSystemPrompt } from './kundliService.js';
import { fetchLatestKundliForUser } from '../../kundli-rag.js';
import { buildUserMessageWithKundli } from './groqChatService.js';
import type { ChatWithGroqResult } from './groqChatService.js';
import {
  getGeminiChatModelId,
  getGeminiGoogleGenAiClientOptions,
  getGeminiMaxOutputTokens,
  isGeminiIncludeThoughtsEnabled,
  getGeminiThinkingBudget,
} from '../config/env.js';
import { logChatThinking } from './chatThinkingLog.js';

const GEMINI_CHAT_SYSTEM_PROMPT_NAME = 'pvr_oracle';

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is required when CHAT_LLM_PROVIDER=gemini');
  return key;
}

/** Text + thought from streamed {@link AIMessageChunk} content (same shapes as final message). */
function extractTextAndThoughtFromAiMessageLike(msg: AIMessageChunk): { text: string; thought: string } {
  let text = '';
  let thought = '';
  const c = msg.content;
  if (typeof c === 'string' && c) {
    text = c;
  } else if (Array.isArray(c)) {
    for (const block of c) {
      if (!block || typeof block !== 'object') continue;
      const b = block as { type?: string; thinking?: string; text?: string };
      if (b.type === 'thinking' && typeof b.thinking === 'string') thought += b.thinking;
      else if (b.type === 'text' && typeof b.text === 'string') text += b.text;
    }
  }
  const fallbackText = typeof msg.text === 'string' ? msg.text : '';
  if (!text && fallbackText) text = fallbackText;
  return { text, thought };
}

function buildChatModel(): ChatGoogleGenerativeAI {
  const { baseUrl, apiVersion } = getGeminiGoogleGenAiClientOptions();
  const includeThoughts = isGeminiIncludeThoughtsEnabled();
  const thinkingBudget = getGeminiThinkingBudget();

  return new ChatGoogleGenerativeAI({
    model: getGeminiChatModelId(),
    apiKey: getGeminiApiKey(),
    baseUrl,
    apiVersion,
    temperature: 1,
    maxOutputTokens: getGeminiMaxOutputTokens(),
    topP: 1,
    streaming: true,
    ...(includeThoughts
      ? {
          thinkingConfig: {
            includeThoughts: true,
            thinkingBudget,
          },
        }
      : {}),
  });
}

/**
 * One chat turn: system prompt + Kundli-packaged messages, direct model stream
 * (token + optional thinking deltas for SSE).
 */
export async function chatWithGemini(
  prisma: PrismaClient,
  userId: string,
  userQuestion: string,
  options?: { onDelta?: (delta: string) => void; onThoughtDelta?: (delta: string) => void }
): Promise<ChatWithGroqResult> {
  const includeThoughts = isGeminiIncludeThoughtsEnabled();
  logChatThinking('turn_start', {
    model: getGeminiChatModelId(),
    includeThoughts,
    thinkingBudget: includeThoughts ? getGeminiThinkingBudget() : null,
  });

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

  const messages = [
    new SystemMessage({ content: systemPrompt }),
    ...kundliUserContents.map((text) => new HumanMessage({ content: text })),
    new HumanMessage({ content: questionText }),
  ];

  const model = buildChatModel();

  let answerText = '';
  let thinkingText = '';
  let lastUsage: Record<string, unknown> | null = null;
  let thoughtChunkCount = 0;
  let tokenChunkCount = 0;

  const stream = await model.stream(messages);
  for await (const chunk of stream) {
    if (!isAIMessageChunk(chunk as BaseMessageChunk)) continue;
    const msg = chunk as AIMessageChunk;
    if (msg.usage_metadata && typeof msg.usage_metadata === 'object') {
      lastUsage = msg.usage_metadata as Record<string, unknown>;
    }
    const { text, thought } = extractTextAndThoughtFromAiMessageLike(msg);
    if (thought) {
      thinkingText += thought;
      thoughtChunkCount += 1;
      logChatThinking('stream_thought_delta', {
        chunkIndex: thoughtChunkCount,
        deltaChars: thought.length,
        totalChars: thinkingText.length,
      });
      options?.onThoughtDelta?.(thought);
    }
    if (text) {
      answerText += text;
      tokenChunkCount += 1;
      options?.onDelta?.(text);
    }
  }

  const answerTextOut = answerText.trim() || 'No response generated.';
  const thinkingOut = thinkingText.trim();

  logChatThinking('turn_end', {
    answerChars: answerTextOut.length,
    thinkingChars: thinkingOut.length,
    thoughtChunks: thoughtChunkCount,
    tokenChunks: tokenChunkCount,
    usage: lastUsage,
  });

  const requestPayload: Record<string, unknown> = {
    provider: 'gemini',
    transport: 'stream',
    model: getGeminiChatModelId(),
    thinking: includeThoughts
      ? { includeThoughts: true, thinkingBudget: getGeminiThinkingBudget() }
      : { disabled: true },
    message_count: messages.length,
    generation: {
      temperature: 1,
      maxOutputTokens: getGeminiMaxOutputTokens(),
      topP: 1,
    },
  };

  const responsePayload: Record<string, unknown> = {
    provider: 'gemini',
    streamed: true,
    content: answerTextOut,
    thinking: thinkingOut || undefined,
    finish_reason: null,
    usage: lastUsage,
    stream_stats: {
      thought_chunks: thoughtChunkCount,
      token_chunks: tokenChunkCount,
    },
  };

  return {
    answerText: answerTextOut,
    thinkingText: thinkingOut || undefined,
    requestPayload,
    responsePayload,
  };
}
