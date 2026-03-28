/**
 * Routes GraphQL chat to Groq or Gemini based on CHAT_LLM_PROVIDER.
 */
import type { PrismaClient } from '@prisma/client';
import { getChatLlmProvider } from '../config/env.js';
import { chatWithGroq, type ChatWithGroqResult } from './groqChatService.js';
import { chatWithGemini } from './geminiChatService.js';

export type ChatTurnResult = ChatWithGroqResult;

export type ChatWithLlmOptions = {
  /** Fired for each streamed answer token (Gemini LangGraph + Groq stream). */
  onDelta?: (delta: string) => void;
  /** Gemini 2.5 thinking chunks when `thinkingConfig.includeThoughts` is enabled. */
  onThoughtDelta?: (delta: string) => void;
};

export async function chatWithConfiguredProvider(
  prisma: PrismaClient,
  userId: string,
  question: string,
  options?: ChatWithLlmOptions
): Promise<ChatTurnResult> {
  const provider = getChatLlmProvider();
  if (provider === 'gemini') {
    return chatWithGemini(prisma, userId, question, options);
  }
  return chatWithGroq(prisma, userId, question, options);
}
