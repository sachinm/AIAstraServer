/**
 * The card's conversation thread (docs/reading-engine/85 §4 steps 1 and 5): a row of `chats` with `card_ref =
 * '<board>:<cardId>'` (migration 20261118200000_chats_card_ref), listed under the board's category with the card's
 * title as its name. The newest such chat is the thread, whatever its `is_active` (an ordinary new chat deactivates every
 * other chat). Each message is stored as `[<card title> · <period label>] <question>`.
 *
 * Until the migration is applied (and the Prisma client regenerated), `card_ref` is unknown to the database: reads give
 * an empty thread and a new thread is created without it, so nothing here fails the chat. Prisma is reached through a
 * narrow cast for the same reason. Never throws on read.
 */
import type { PrismaClient } from '@prisma/client';
import { CARD_CHAT_HISTORY_TURNS, CARD_CHAT_THREAD_MAX, type CardChatBoard, type CardChatHistoryTurn, type CardChatThread, type CardChatThreadMessage } from './types.js';

export const cardRefOf = (board: CardChatBoard, id: string): string => `${board}:${id}`;

/** `[<title> · <period>] <question>` (the period part only when a period was on screen) */
export function storedCardQuestion(title: string, periodLabel: string | null, question: string): string {
  return `[${title}${periodLabel ? ` · ${periodLabel}` : ''}] ${question}`;
}

/** The person's question and the period label back out of a stored message; a plain question is kept whole. */
export function parseStoredCardQuestion(stored: string, title: string): { question: string; periodLabel: string | null } {
  const head = `[${title}`;
  if (!stored.startsWith(head)) return { question: stored, periodLabel: null };
  const end = stored.indexOf('] ', head.length);
  if (end < 0) return { question: stored, periodLabel: null };
  const inner = stored.slice(head.length, end);
  const periodLabel = inner.startsWith(' · ') ? inner.slice(3) : null;
  return { question: stored.slice(end + 2), periodLabel };
}

type ChatRow = { id: string; card_ref?: string | null };
export type ThreadPrisma = {
  chat: {
    findFirst: (q: unknown) => Promise<ChatRow | null>;
    create: (q: unknown) => Promise<{ id: string }>;
  };
  message: {
    findMany: (q: unknown) => Promise<Array<{ question: string; ai_answer: string; created_at: Date }>>;
  };
};

const P = (prisma: PrismaClient): ThreadPrisma => prisma as unknown as ThreadPrisma;

/** the newest thread of this card for the person (ignoring is_active); null when none or the column is missing */
export async function findCardThreadId(prisma: PrismaClient, userId: string, cardRef: string): Promise<string | null> {
  try {
    const row = await P(prisma).chat.findFirst({ where: { user_id: userId, card_ref: cardRef }, orderBy: { created_at: 'desc' }, select: { id: true } });
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** true when `chatId` is the person's thread of this card */
export async function isCardThread(prisma: PrismaClient, userId: string, chatId: string, cardRef: string): Promise<boolean> {
  try {
    const row = await P(prisma).chat.findFirst({ where: { id: chatId, user_id: userId, card_ref: cardRef }, select: { id: true } });
    return Boolean(row);
  } catch {
    return false;
  }
}

/** The thread for the open: the newest chat of the card and its last CARD_CHAT_THREAD_MAX messages, oldest first. */
export async function loadCardThread(prisma: PrismaClient, userId: string, cardRef: string, title: string, max = CARD_CHAT_THREAD_MAX): Promise<CardChatThread> {
  const chatId = await findCardThreadId(prisma, userId, cardRef);
  if (!chatId) return { chatId: null, messages: [] };
  try {
    const rows = await P(prisma).message.findMany({ where: { chat_id: chatId }, orderBy: { created_at: 'desc' }, take: max, select: { question: true, ai_answer: true, created_at: true } });
    const messages: CardChatThreadMessage[] = rows.reverse().map((r) => {
      const q = parseStoredCardQuestion(r.question, title);
      return { question: q.question, answer: r.ai_answer, at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at), periodLabel: q.periodLabel };
    });
    return { chatId, messages };
  } catch {
    return { chatId, messages: [] };
  }
}

/** The last exchanges of a thread for the reader (questions without the stored prefix). */
export function historyOf(thread: CardChatThread, turns = CARD_CHAT_HISTORY_TURNS): CardChatHistoryTurn[] {
  return thread.messages.slice(-turns).map((m) => ({ question: m.question, answer: m.answer }));
}

/**
 * The chat a card turn is saved to: `chatId` when it is this card's thread, else (unless `newThread`) the card's newest
 * thread, else a new one: category, card_ref and the card's title, `is_active` false, and the person's other chats left
 * as they are. A database without the column gets the chat without `card_ref`.
 */
export async function cardThreadFor(
  prisma: PrismaClient,
  userId: string,
  o: { chatId?: string | null; cardRef: string; category: string; title: string; newThread?: boolean },
): Promise<string> {
  if (o.chatId?.trim() && (await isCardThread(prisma, userId, o.chatId.trim(), o.cardRef))) return o.chatId.trim();
  if (!o.newThread) {
    const found = await findCardThreadId(prisma, userId, o.cardRef);
    if (found) return found;
  }
  const data = { user_id: userId, is_active: false, category: o.category, name: o.title.slice(0, 50) };
  try {
    return (await P(prisma).chat.create({ data: { ...data, card_ref: o.cardRef }, select: { id: true } })).id;
  } catch (e) {
    console.warn(JSON.stringify({ msg: '[cardchat] thread create with card_ref failed; created without it', error: String((e as Error)?.message ?? e).slice(0, 160) }));
    return (await P(prisma).chat.create({ data, select: { id: true } })).id;
  }
}
