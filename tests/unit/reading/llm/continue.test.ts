/**
 * docs/techniques/09 §3.5 and AGENTS.md "Reading depth is a release gate" rule 4: a call that stops at its output
 * ceiling is continued, never discarded. Fakes only: no model is called.
 */
import { describe, expect, it } from 'vitest';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import { callWithContinuation, closeJson, CONTINUE_MARK, joinContinuation, parseContinuedJson } from '../../../../src/reading/llm/continue.js';

const res = (text: string, finishReason: string, out = 100): GeminiResult => ({ text, finishReason, usage: { node: 'n', model: 'm', promptTokens: 1000, cachedTokens: 900, outputTokens: out, thoughtTokens: 10, ms: 5 }, ttftMs: 1, stoppedForLoop: false });

const base: GeminiCallOptions = { model: 'm', node: 'self.card.oracle.drive', system: 'S', parts: ['PREFIX', 'ASK'], responseSchema: { type: 'OBJECT' }, maxOutputTokens: 10_000, timeoutMs: 150_000 };

describe('callWithContinuation', () => {
  it('a finished call is returned as it is, no continuation', async () => {
    const calls: GeminiCallOptions[] = [];
    const r = await callWithContinuation(async (o) => (calls.push(o), res('{"a":1}', 'STOP')), base);
    expect(calls).toHaveLength(1);
    expect(r).toMatchObject({ text: '{"a":1}', continued: 0, stillCut: false });
  });

  it('a JSON answer cut inside its last prose field is continued without the schema, joined, and parses', async () => {
    const calls: GeminiCallOptions[] = [];
    const answers = [res('{"headline":"h","story":"The maha dasha of Saturn opens the story', 'MAX_TOKENS', 10_000), res(' and the sub-period of Mercury carries it."}', 'STOP', 40)];
    const r = await callWithContinuation(async (o) => (calls.push(o), answers.shift()!), base);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.responseSchema).toBeUndefined();
    expect(calls[1]!.parts[0]).toBe('PREFIX');
    expect(calls[1]!.parts.at(-1)).toContain(CONTINUE_MARK);
    expect(calls[1]!.parts.at(-1)).toContain('opens the story');
    expect(calls[1]!.node).toBe('self.card.oracle.drive.continue1');
    expect(r.continued).toBe(1);
    expect(r.stillCut).toBe(false);
    expect(r.usage.outputTokens).toBe(10_040);
    expect(r.usage.promptTokens).toBe(2000);
    expect(parseContinuedJson(r.text)).toEqual({ headline: 'h', story: 'The maha dasha of Saturn opens the story and the sub-period of Mercury carries it.' });
  });

  it('stops after maxRounds and keeps everything written, closed tolerantly', async () => {
    let n = 0;
    const r = await callWithContinuation(async () => res(n++ === 0 ? '{"story":"one' : ' more', 'MAX_TOKENS'), base, { maxRounds: 2 });
    expect(r).toMatchObject({ continued: 2, stillCut: true });
    expect(parseContinuedJson(r.text)).toEqual({ story: 'one more more' });
  });

  it('never runs past the deadline', async () => {
    let t = 0;
    const r = await callWithContinuation(async () => ((t += 148_000), res('{"story":"x', 'MAX_TOKENS')), base, { deadlineMs: 150_000, now: () => t });
    expect(r.continued).toBe(0);
    expect(r.stillCut).toBe(true);
  });

  it('a continuation that throws keeps what was written; the first call error is thrown as before', async () => {
    let n = 0;
    const r = await callWithContinuation(async () => {
      if (n++ === 0) return res('{"story":"kept', 'MAX_TOKENS');
      throw new Error('quota');
    }, base);
    expect(r.stillCut).toBe(true);
    expect(parseContinuedJson(r.text)).toEqual({ story: 'kept' });
    await expect(callWithContinuation(async () => Promise.reject(new Error('down')), base)).rejects.toThrow('down');
  });
});

describe('joining and closing', () => {
  it('drops a fence and a repeated overlap at the seam', () => {
    expect(joinContinuation('the story of the maha dasha', '```json\nof the maha dasha and the year')).toBe('the story of the maha dasha and the year');
  });
  it('closes a cut JSON document: open string, dangling key, open arrays and objects', () => {
    expect(JSON.parse(closeJson('{"a":[1,2,{"b":"x'))).toEqual({ a: [1, 2, { b: 'x' }] });
    expect(JSON.parse(closeJson('{"a":1,"b":'))).toEqual({ a: 1 });
    expect(JSON.parse(closeJson('{"b":'))).toEqual({ b: null });
    expect(JSON.parse(closeJson('{"a":1,'))).toEqual({ a: 1 });
    expect(closeJson('{"a":1}')).toBe('{"a":1}');
  });
});
