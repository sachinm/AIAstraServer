/** Conversation categories (docs/reading-engine/51 §4). General Reading is one of them; the boards are the others. */
export const CHAT_CATEGORIES = ['general', 'today', 'you', 'love', 'work', 'lucky'] as const;
export type ChatCategory = (typeof CHAT_CATEGORIES)[number];

export const CHAT_CATEGORY_LABELS: Record<ChatCategory, string> = {
  general: 'General Reading',
  today: 'Today',
  you: 'You',
  love: 'Love',
  work: 'Work',
  lucky: 'Lucky times',
};

/** A category from a client value; anything unknown is General Reading. */
export function chatCategory(v: unknown): ChatCategory {
  return typeof v === 'string' && (CHAT_CATEGORIES as readonly string[]).includes(v) ? (v as ChatCategory) : 'general';
}
