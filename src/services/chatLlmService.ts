/**
 * Routes GraphQL chat to Groq or Gemini based on CHAT_LLM_PROVIDER.
 */
import type { PrismaClient } from '@prisma/client';
import { getChatLlmProvider } from '../config/env.js';
import { chatWithGroq, type ChatWithGroqResult } from './groqChatService.js';
import { chatWithGemini } from './geminiChatService.js';

export type ChatTurnResult = ChatWithGroqResult;

export type ChatWithLlmOptions = {
  /** Fired for each streamed token delta (Gemini SSE + Groq stream). */
  onDelta?: (delta: string) => void;
};

export async function chatWithConfiguredProvider(
  prisma: PrismaClient,
  userId: string,
  question: string,
  options?: ChatWithLlmOptions
): Promise<ChatTurnResult> {
  const provider = getChatLlmProvider();
  const t0 = Date.now();
  try {
    if (provider === 'gemini') {
      return await chatWithGemini(prisma, userId, question, options);
    }
    return await chatWithGroq(prisma, userId, question, options);
  } finally {
    // Router total only — no secrets, prompts, or payloads.
    console.log(
      JSON.stringify({
        msg: 'chatWithConfiguredProvider timing',
        provider,
        totalMs: Date.now() - t0,
      })
    );
  }
}
