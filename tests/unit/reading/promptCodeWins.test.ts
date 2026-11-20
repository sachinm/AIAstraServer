/**
 * docs/techniques/09 (2026-11-19): a rewritten prompt must reach staging. The stored `system_prompts` row overrides the
 * code text only while it was seeded from the same code text (a live database edit); a changed code text wins, in the
 * seed (the row is updated, its old text archived by the trigger) and in memory (whatever the seed did).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { BUILTIN_AGENT_PROMPTS, clearAgentPromptCache, loadAgentPrompts, pickPromptText, promptCodeHash } from '../../../src/reading/prompts/registry.js';
import { PROMPTS } from '../../../src/reading/prompts/generated.js';

const NAME = 'cards/oracle';
const code = BUILTIN_AGENT_PROMPTS[NAME]!.prompt;
afterEach(() => {
  PROMPTS[NAME] = code;
  clearAgentPromptCache();
});

describe('pickPromptText', () => {
  it('a row seeded from the same code text keeps its live edit', () => {
    expect(pickPromptText('new code', { prompt: 'edited live', code_hash: promptCodeHash('new code') })).toBe('edited live');
  });
  it('a row seeded from older code text, or with no hash, gives way to the code', () => {
    expect(pickPromptText('new code', { prompt: 'old code', code_hash: promptCodeHash('old code') })).toBe('new code');
    expect(pickPromptText('new code', { prompt: 'old code', code_hash: null })).toBe('new code');
  });
  it('a prompt that lives only in the database is the row', () => {
    expect(pickPromptText(undefined, { prompt: 'db only', code_hash: null })).toBe('db only');
  });
  it('the hash ignores line endings and outer space', () => {
    expect(promptCodeHash('a\r\nb\n')).toBe(promptCodeHash('a\nb'));
  });
});

describe('the seed and the load', () => {
  function fakePrisma(rows: Array<{ name: string; prompt: string; version: number; code_hash: string | null }>) {
    const sql: Array<{ q: string; args: unknown[] }> = [];
    return {
      sql,
      prisma: {
        $executeRawUnsafe: async (q: string, ...args: unknown[]) => (sql.push({ q, args }), 0),
        $queryRawUnsafe: async () => rows,
      } as never,
    };
  }

  it('the seed sends the code hash and updates the text when the hash differs', async () => {
    const { prisma, sql } = fakePrisma([]);
    await loadAgentPrompts(prisma);
    const upserts = sql.filter((x) => x.q.includes('INSERT INTO system_prompts'));
    expect(upserts.length).toBe(Object.keys(BUILTIN_AGENT_PROMPTS).length);
    expect(upserts[0]!.q).toContain('prompt = CASE WHEN system_prompts.code_hash IS DISTINCT FROM EXCLUDED.code_hash THEN EXCLUDED.prompt');
    const mine = upserts.find((x) => x.args[0] === NAME)!;
    expect(mine.args[5]).toBe(promptCodeHash(code));
    expect(sql.some((x) => x.q.includes('ADD COLUMN IF NOT EXISTS code_hash'))).toBe(true);
  });

  it('in memory: a stale stored row never overrides a changed code prompt; a live edit of the same code does', async () => {
    let { prisma } = fakePrisma([{ name: NAME, prompt: 'stale text from an older release', version: 3, code_hash: promptCodeHash('older code') }]);
    const map = await loadAgentPrompts(prisma);
    expect(map.get(NAME)!.prompt).toBe(code.trim());
    expect(PROMPTS[NAME]).toBe(code.trim());
    clearAgentPromptCache();
    ({ prisma } = fakePrisma([{ name: NAME, prompt: 'a live edit', version: 4, code_hash: promptCodeHash(code) }]));
    expect((await loadAgentPrompts(prisma)).get(NAME)!.prompt).toBe('a live edit');
  });
});
