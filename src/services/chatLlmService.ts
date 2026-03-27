/**
 * Routes GraphQL chat to Groq or Gemini based on CHAT_LLM_PROVIDER.
 */
import type { PrismaClient } from '@prisma/client';
import { getChatLlmProvider } from '../config/env.js';
import { chatWithGroq, type ChatWithGroqResult } from './groqChatService.js';
import { chatWithGemini } from './geminiChatService.js';

export type ChatTurnResult = ChatWithGroqResult;

export async function chatWithConfiguredProvider(
  prisma: PrismaClient,
  userId: string,
  question: string
): Promise<ChatTurnResult> {
  const provider = getChatLlmProvider();
  if (provider === 'gemini') {
    return chatWithGemini(prisma, userId, question);
  }
  return chatWithGroq(prisma, userId, question);
}
