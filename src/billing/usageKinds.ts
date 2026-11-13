/**
 * What a month's questions were spent on, from each `question_usage.key` (docs/billing/README.md). A read-only grouping
 * for the usage ring; it charges nothing.
 */

export type UsageKind = 'chat' | 'cardchat' | 'board_refresh' | 'other';

export type UsageBreakdown = Record<UsageKind, number>;

/** `reserve()` with no key stores a random UUID: the chat ask path. */
const BARE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function usageKind(key: string): UsageKind {
  if (key.startsWith('clarify:') || BARE_UUID.test(key)) return 'chat';
  if (key.startsWith('cardchat:')) return 'cardchat';
  // boardRefreshKey (`board:<board>:refresh:<day>`) and clockChargeKey (`board:self:<day>:clock:<system>`)
  if (key.startsWith('board:')) return 'board_refresh';
  return 'other';
}

export function breakdownOf(keys: string[]): UsageBreakdown {
  const out: UsageBreakdown = { chat: 0, cardchat: 0, board_refresh: 0, other: 0 };
  for (const key of keys) out[usageKind(key)] += 1;
  return out;
}
