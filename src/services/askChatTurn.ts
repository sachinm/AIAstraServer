/**
 * Shared validation and persistence for GraphQL `ask` and REST `/api/chat/ask-stream`.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ChatTurnResult } from './chatLlmService.js';

export type AskPreconditionResult = { ok: true } | { ok: false; error: string };

export async function validateAskForUser(
  db: PrismaClient,
  userId: string
): Promise<AskPreconditionResult> {
  const user = await db.auth.findUnique({
    where: { id: userId },
    select: { id: true, kundli_added: true },
  });
  if (!user) return { ok: false, error: 'User not found' };
  if (!user.kundli_added) {
    return {
      ok: false,
      error:
        'Your chart is still being prepared. Chat will be available once your Kundli data has finished syncing from AstroKundli.',
    };
  }
  return { ok: true };
}

/**
 * Resolves or creates the active chat, saves the message and ChatLog (same rules as GraphQL `ask`).
 * @param clientDeliverySse - `true` when this turn used POST `/api/chat/ask-stream` (matches web `VITE_CHAT_STREAM` on); `false` for GraphQL `ask`.
 */
export async function persistAskTurn(
  db: PrismaClient,
  userId: string,
  chatId: string | null | undefined,
  question: string,
  chatResult: ChatTurnResult,
  clientDeliverySse: boolean
): Promise<{ chatId: string }> {
  let chat: { id: string } | null = null;
  if (chatId?.trim()) {
    chat = await db.chat.findFirst({
      where: { id: chatId.trim(), user_id: userId },
      select: { id: true },
    });
  }
  if (!chat) {
    await db.chat.updateMany({
      where: { user_id: userId },
      data: { is_active: false },
    });
    chat = await db.chat.create({
      data: { user_id: userId, is_active: true },
      select: { id: true },
    });
  }
  const message = await db.message.create({
    data: {
      chat_id: chat.id,
      question,
      ai_answer: chatResult.answerText,
    },
  });
  await db.chatLog.create({
    data: {
      chat_id: chat.id,
      message_id: message.id,
      request_payload: chatResult.requestPayload as Prisma.InputJsonValue,
      response_payload: chatResult.responsePayload as Prisma.InputJsonValue,
      client_delivery_sse: clientDeliverySse,
    },
  });
  const thinkingTrimmed = chatResult.thinkingText?.trim();
  if (thinkingTrimmed) {
    await db.chatLogThinking.create({
      data: {
        chat_id: chat.id,
        message_id: message.id,
        content: thinkingTrimmed,
      },
    });
  }
  return { chatId: chat.id };
}
