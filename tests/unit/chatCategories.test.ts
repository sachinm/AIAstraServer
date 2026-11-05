import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CHAT_CATEGORIES, CHAT_CATEGORY_LABELS, chatCategory } from '../../src/chat/categories.js';

describe('conversation categories (docs/reading-engine/51)', () => {
  it('General Reading is the default and the fallback for anything unknown', () => {
    expect(chatCategory(undefined)).toBe('general');
    expect(chatCategory('astronaut')).toBe('general');
    expect(chatCategory('work')).toBe('work');
    expect(CHAT_CATEGORY_LABELS.general).toBe('General Reading');
    for (const c of CHAT_CATEGORIES) expect(CHAT_CATEGORY_LABELS[c]).toBeTruthy();
  });
  it('GraphQL exposes the category on Chat and accepts it on createChat', () => {
    const s = fs.readFileSync('src/graphql/schema.ts', 'utf8');
    expect(s).toMatch(/type Chat \{[^}]*category: String/);
    expect(s).toContain('createChat(category: String): ChatResult!');
    expect(s).toContain('category: chatCategory(args?.category)');
  });
  it('threads can be pinned to the top: pinned on Chat, setChatPinned owned by the user', () => {
    const s = fs.readFileSync('src/graphql/schema.ts', 'utf8');
    expect(s).toMatch(/type Chat \{[^}]*pinned: Boolean/);
    expect(s).toContain('setChatPinned(chatId: ID!, pinned: Boolean!): ChatResult!');
    expect(s).toContain("db.chat.findFirst({ where: { id: chatId, user_id: userId } })");
  });
});
