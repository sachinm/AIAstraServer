import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The streaming call goes through undici; feed it a fake SSE body.
const fetchMock = vi.fn();
vi.mock('undici', () => ({
  Agent: class {},
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

import { buildRequestBody, chunkThought, streamGemini, thinkingConfigFor } from '../../../src/reading/llm/gemini.js';
import { readingIncludeThoughts } from '../../../src/reading/config.js';

function sseResponse(events: unknown[]): unknown {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    text: async () => text,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

const chunk = (text: string, thought = false) => ({ candidates: [{ content: { parts: [{ text, ...(thought ? { thought: true } : {}) }] } }] });

describe('thought summaries', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalFlag = process.env.READING_INCLUDE_THOUGHTS;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    fetchMock.mockReset();
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.READING_INCLUDE_THOUGHTS;
    else process.env.READING_INCLUDE_THOUGHTS = originalFlag;
  });

  it('does not ask for thoughts unless the caller opts in', () => {
    expect(thinkingConfigFor('gemini-3.8-flash', 'low')).toMatchObject({ includeThoughts: false });
    expect(thinkingConfigFor('gemini-2.5-flash', 'low')).toMatchObject({ includeThoughts: false });
  });

  it('asks for thoughts on 3.x and on 2.x with a non-zero budget', () => {
    expect(thinkingConfigFor('gemini-3.8-flash', 'low', true)).toEqual({ thinkingLevel: 'low', includeThoughts: true });
    expect(thinkingConfigFor('gemini-2.5-flash', 'low', true)).toEqual({ thinkingBudget: 512, includeThoughts: true });
  });

  it('never asks for thoughts when a 2.x model has a zero thinking budget', () => {
    expect(thinkingConfigFor('gemini-2.5-flash', 'off', true)).toEqual({ thinkingBudget: 0, includeThoughts: false });
  });

  it('puts the flag in the request body only when the option is set', () => {
    const base = { model: 'gemini-3.8-flash', node: 'synthesize', parts: ['a', 'b'] };
    const off = buildRequestBody(base) as { generationConfig: { thinkingConfig: { includeThoughts: boolean } } };
    const on = buildRequestBody({ ...base, includeThoughts: true }) as { generationConfig: { thinkingConfig: { includeThoughts: boolean } } };
    expect(off.generationConfig.thinkingConfig.includeThoughts).toBe(false);
    expect(on.generationConfig.thinkingConfig.includeThoughts).toBe(true);
  });

  it('chunkThought returns only the thought parts', () => {
    expect(chunkThought({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'answer' }] } }] })).toBe('thinking…');
    expect(chunkThought(chunk('just an answer'))).toBe('');
  });

  it('streams thoughts to onThought and keeps them out of the answer', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([chunk('Checking the 10th lord. ', true), chunk('Weighing the dasha. ', true), chunk('Your career '), { ...chunk('looks steady.'), usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 6 } }])
    );
    const deltas: string[] = [];
    const thoughts: string[] = [];
    const r = await streamGemini(
      { model: 'gemini-3.8-flash', node: 'synthesize', parts: ['base', 'tail'], includeThoughts: true },
      (d) => deltas.push(d),
      (t) => thoughts.push(t)
    );
    expect(thoughts.join('')).toBe('Checking the 10th lord. Weighing the dasha. ');
    expect(deltas.join('')).toBe('Your career looks steady.');
    expect(r.text).toBe('Your career looks steady.');
    expect(r.text).not.toMatch(/Checking|Weighing/);
    expect(r.usage.thoughtTokens).toBe(6);
  });

  it('time to first token counts the answer, not the thoughts', async () => {
    fetchMock.mockResolvedValue(sseResponse([chunk('thinking', true), chunk('answer')]));
    const r = await streamGemini({ model: 'gemini-3.8-flash', node: 'synthesize', parts: ['base', 'tail'], includeThoughts: true }, undefined, () => undefined);
    expect(r.ttftMs).not.toBeNull();
    expect(r.text).toBe('answer');
  });

  it('ignores thought parts when no thought listener is given', async () => {
    fetchMock.mockResolvedValue(sseResponse([chunk('thinking', true), chunk('answer')]));
    const r = await streamGemini({ model: 'gemini-3.8-flash', node: 'synthesize', parts: ['base', 'tail'] });
    expect(r.text).toBe('answer');
  });

  it('READING_INCLUDE_THOUGHTS defaults on and can be turned off', () => {
    delete process.env.READING_INCLUDE_THOUGHTS;
    expect(readingIncludeThoughts()).toBe(true);
    for (const v of ['0', 'false', 'off']) {
      process.env.READING_INCLUDE_THOUGHTS = v;
      expect(readingIncludeThoughts()).toBe(false);
    }
  });
});
