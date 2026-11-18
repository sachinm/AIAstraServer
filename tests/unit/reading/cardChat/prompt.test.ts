/**
 * docs/reading-engine/85 §7 step 3: the card-chat call. Its input holds the card-chat role, the card brief, the card on
 * screen for the period (the preamble's text), how it was read (Oracle card, ledger cells, cited rows) and at most the
 * last two exchanges; it reads the same cached prefix as the card's own Oracle call (one cache key); it stays under the
 * per-operation spend cap; engine names are redacted in place as the answer streams. Fake model; no paid call.
 */
import { describe, expect, it } from 'vitest';
import { readCardOracle } from '../../../../src/reading/cards/oracle.js';
import { answerCardQuestion, cardChatCacheKey, CardChatSpendCapError, outputBudget, redactingStream } from '../../../../src/reading/cardChat/answer.js';
import { capHistory, cardChatParts } from '../../../../src/reading/cardChat/prompt.js';
import { resolveCardContext } from '../../../../src/reading/cardChat/resolve.js';
import { CARD_CHAT_HISTORY_MAX_CHARS } from '../../../../src/reading/cardChat/types.js';
import type { CardChatContext } from '../../../../src/reading/cardChat/types.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import { prefixKey } from '../../../../src/reading/llm/promptCache.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import { ASOF, body, frame, ledger, oracle, PERIODS, prefix, resolveSeams, slices, view } from './fixtures.js';

const prisma = {} as never;
const MODEL = 'gemini-3.8-flash';
const selfBody = body([view('body', 'Body & energy'), view('mind', 'How you think')], ['body', 'mind']);

async function ctxFor(over: Partial<Parameters<typeof resolveSeams>[1]> = {}, period = true): Promise<CardChatContext> {
  const r = await resolveCardContext({ prisma, ...resolveSeams({ self: selfBody }, over) }, 'u1', { board: 'self', id: 'body', ...(period ? { from: PERIODS[0]!.from, to: PERIODS[0]!.to } : {}) });
  if (!r.ok) throw new Error(r.error);
  return r.context;
}

const result = (text: string): GeminiResult => ({ text, usage: { node: 'n', model: MODEL, promptTokens: 9000, cachedTokens: 8000, outputTokens: 120, thoughtTokens: 0, ms: 5 }, finishReason: 'STOP', ttftMs: 5, stoppedForLoop: false });

describe('the card-chat input', () => {
  it('holds the role, the brief, the card on screen for the period, how it was read and the question', async () => {
    const ctx = await ctxFor();
    const p = cardChatParts(ctx, 'Why am I so tired at night?', []);
    expect(p.system).toBe(PROMPTS['common/reader-system']);
    expect(p.prefix).toBe(prefix.text);
    expect(p.suffix).toContain(PROMPTS['cards/chat']!.slice(0, 80));
    expect(p.suffix).toContain(`CARD BRIEF\n${PROMPTS['cards/self/body']}`);
    expect(p.suffix).toContain(`period on screen: ${PERIODS[0]!.label}`);
    for (const l of ctx.card.preamble.lines) expect(p.suffix).toContain(l);
    expect(p.suffix).toContain(ctx.card.preamble.confirm!);
    expect(p.suffix).toContain('(answer: not given yet)');
    expect(p.suffix).toContain(`headline: ${oracle('body').headline}`);
    expect(p.suffix).toMatch(/\{ledger:s1\/work_load_and_health\} status=confirmed/);
    expect(p.suffix).toContain('OTHER CARDS ON THIS BOARD (for pointers only): How you think (`mind`)');
    expect(p.suffix).toContain('work status:');
    expect(p.suffix.trimEnd()).toMatch(/QUESTION: Why am I so tired at night\?\n\nTHIS CALL: answer the question about this card in plain prose/);
    expect(p.suffix).toContain('THIS CONVERSATION SO FAR: this is the first question');
  });

  it('the last two exchanges only, capped; engine names redacted in the uncached part only', async () => {
    const ctx = await ctxFor();
    const history = [1, 2, 3].map((n) => ({ question: `question ${n}`, answer: `answer ${n} ${'z'.repeat(900)}` }));
    const turns = capHistory(history);
    expect(turns.map((t) => t.question)).toEqual(['question 2', 'question 3']);
    expect(turns.reduce((n, t) => n + t.question.length + t.answer.length, 0)).toBeLessThanOrEqual(CARD_CHAT_HISTORY_MAX_CHARS);
    const p = cardChatParts({ ...ctx, card: { ...ctx.card, content: { ...ctx.card.content!, line: 'From pyjhora rows.' } } }, 'q', history);
    expect(p.suffix).not.toContain('question 1');
    expect(p.suffix).toContain('Q: question 3');
    expect(p.suffix).not.toMatch(/pyjhora/i);
    expect(p.prefix).toBe(prefix.text);
  });
});

describe('one cache key with the card own call', () => {
  it('system, parts[0], model and cache owner are those the card Oracle call sends', async () => {
    const ctx = await ctxFor();
    const seen: GeminiCallOptions[] = [];
    await answerCardQuestion({ prisma, model: MODEL, stream: async (o, onDelta) => (seen.push(o), onDelta?.('Rest after ten. '), result('Rest after ten. ')) }, 'u1', ctx, 'q', []);
    const chat = seen[0]!;
    expect(chat.cachePrefix).toBe(true);
    expect(chat.cacheOwner).toEqual({ userId: 'u1', kundliId: 'k1' });
    expect(chat.parts).toHaveLength(2);

    const oracleCalls: GeminiCallOptions[] = [];
    await readCardOracle(
      { prisma: new Proxy({}, { get: () => undefined }) as never, callGemini: (async (o: GeminiCallOptions) => (oracleCalls.push(o), result('{}'))) as never },
      {
        ctx: { userId: 'u1', kundliId: 'k1', asOf: ASOF, stamps: { digestVersion: 'd1' }, sub: { profile: { ageYears: 40 } } },
        card: 'body',
        matters: ['work_load_and_health'],
        board: ['Body & energy'],
        frame,
        frameText: 'YEAR FRAME',
        frameKeys: [],
        prefix: { text: prefix.text, keys: prefix.keys },
        ledger,
        matterSlices: slices.filter((s) => s.id === 'matter.work_load_and_health'),
        dates: new Set([ASOF]),
        answers: '',
        model: MODEL,
        cacheOwner: { userId: 'u1', kundliId: 'k1' },
      } as never,
    );
    const card = oracleCalls[0]!;
    expect(chat.system).toBe(card.system);
    expect(chat.parts[0]).toBe(card.parts[0]);
    expect(chat.model).toBe(card.model);
    expect(chat.cacheOwner).toEqual(card.cacheOwner);
    expect(prefixKey(chat.model, chat.system, chat.parts[0]!)).toBe(prefixKey(card.model, card.system, card.parts[0]!));
    expect(cardChatCacheKey(MODEL, chat.system!, chat.parts[0]!)).toBe(prefixKey(card.model, card.system, card.parts[0]!));
  });

  it('without a stored prefix the call goes out uncached, in one part', async () => {
    const ctx = await ctxFor({ readSlices: async () => ({}) as never });
    const seen: GeminiCallOptions[] = [];
    const a = await answerCardQuestion({ prisma, model: MODEL, stream: async (o) => (seen.push(o), result('ok')) }, 'u1', ctx, 'q', []);
    expect(seen[0]!.parts).toHaveLength(1);
    expect(seen[0]!.cachePrefix).toBeUndefined();
    expect(a.cacheKey).toBeNull();
  });
});

describe('spend cap and redaction', () => {
  it('the output cap is lowered to fit the per-operation cap; a call that cannot fit is not made', async () => {
    expect(outputBudget(MODEL, 10_000, 0.45).maxOutputTokens).toBe(2048);
    const tight = outputBudget(MODEL, 10_000, 0.01);
    expect(tight.maxOutputTokens).toBeLessThan(2048);
    expect(tight.worstUsd).toBeLessThanOrEqual(0.01 + 1e-9);
    const ctx = await ctxFor();
    let calls = 0;
    await expect(answerCardQuestion({ prisma, model: MODEL, capUsd: 0.0001, stream: async () => (calls++, result('x')) }, 'u1', ctx, 'q', [])).rejects.toBeInstanceOf(CardChatSpendCapError);
    expect(calls).toBe(0);
    const a = await answerCardQuestion({ prisma, model: MODEL, stream: async () => result('ok') }, 'u1', ctx, 'q', []);
    expect(a.costUsd).toBeGreaterThan(0);
    expect(a.costUsd).toBeLessThan(0.45);
  });

  it('a name split across deltas is still redacted; nothing else is touched', () => {
    const out: string[] = [];
    const s = redactingStream((x) => out.push(x));
    for (const d of ['Read by py', 'jhora today', ', not a word list. ', 'Done']) s.push(d);
    s.end();
    expect(out.join('')).toBe('Read by traditional calculations today, not a word list. Done');
    expect(s.text()).toBe(out.join(''));
  });
});
