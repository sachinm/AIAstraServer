/**
 * Shared validation and persistence for GraphQL `ask` and REST `/api/chat/ask-stream`.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ChatTurnResult } from './chatLlmService.js';
import { deriveChatTitleFromQuestion } from '../lib/chatTitle.js';
import type { ReadingRunRecord } from '../reading/run.js';

/** Observability row for one reading. A failure here must never fail the chat turn. */
async function persistReadingRun(db: PrismaClient, userId: string, chatId: string, messageId: string, r: ReadingRunRecord): Promise<void> {
  try {
    await db.readingRun.create({
      data: {
        id: r.runId,
        user_id: userId,
        chat_id: chatId,
        message_id: messageId,
        status: r.status,
        question: r.question,
        intent: r.intent as unknown as Prisma.InputJsonValue,
        facts_version: r.factsVersion,
        dossier_hash: r.dossierHash,
        transit_snapshot_id: r.transitSnapshotId,
        pack_hashes: r.packHashes as unknown as Prisma.InputJsonValue,
        findings: (r.findings ?? undefined) as Prisma.InputJsonValue | undefined,
        windows: (r.windows ?? undefined) as Prisma.InputJsonValue | undefined,
        agreement: (r.agreement ?? undefined) as Prisma.InputJsonValue | undefined,
        answer: r.answer,
        thinking: r.thinking,
        models: r.models as unknown as Prisma.InputJsonValue,
        usage: r.usage as unknown as Prisma.InputJsonValue,
        cost_usd: r.costUsd,
        timings_ms: r.timingsMs as unknown as Prisma.InputJsonValue,
        cache: r.cache as unknown as Prisma.InputJsonValue,
        dropped_claims: r.droppedClaims,
        errors: r.errors as unknown as Prisma.InputJsonValue,
        prompt_version: r.promptVersion,
        completed_at: new Date(),
      },
    });
  } catch (err) {
    console.error(JSON.stringify({ msg: 'reading run persist failed', runId: r.runId, error: (err as Error).message.slice(0, 300) }));
  }
}

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
): Promise<{ chatId: string; messageId: string }> {
  // deny topics never keep the text (src/reading/policy/declined.ts)
  question = chatResult.storedQuestion ?? question;
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
  const priorMessageCount = await db.message.count({
    where: { chat_id: chat.id },
  });
  const message = await db.message.create({
    data: {
      chat_id: chat.id,
      question,
      ai_answer: chatResult.answerText,
    },
  });
  if (priorMessageCount === 0) {
    const title = deriveChatTitleFromQuestion(question);
    if (title) {
      await db.chat.update({
        where: { id: chat.id },
        data: { name: title },
      });
    }
  }
  await db.chatLog.create({
    data: {
      chat_id: chat.id,
      message_id: message.id,
      request_payload: chatResult.requestPayload as Prisma.InputJsonValue,
      response_payload: chatResult.responsePayload as Prisma.InputJsonValue,
      client_delivery_sse: clientDeliverySse,
    },
  });
  if (chatResult.reading) await persistReadingRun(db, userId, chat.id, message.id, chatResult.reading);
  return { chatId: chat.id, messageId: message.id };
}
