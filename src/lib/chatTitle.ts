/** Max length for `Chat.name` when derived from the first user question (matches web `chatThreadUtils`). */
export const CHAT_TITLE_MAX_LEN = 50;

/** First `CHAT_TITLE_MAX_LEN` characters of the trimmed question; empty string if no usable text. */
export function deriveChatTitleFromQuestion(question: string): string {
  const t = question.trim();
  if (!t) return '';
  return t.length <= CHAT_TITLE_MAX_LEN ? t : t.slice(0, CHAT_TITLE_MAX_LEN);
}
