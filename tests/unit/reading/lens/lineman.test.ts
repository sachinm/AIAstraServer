/**
 * docs/techniques/09 §3.1, §8 step 7: the lens linemen. One call per lens over the natal prefix, the family findings,
 * the clock sheets WITH their sentences, the gate statuses and the recipe; the thread keyed and source-tagged; stored.
 * Fake model; no paid call, no database.
 */
import { describe, expect, it } from 'vitest';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import { checkThread, linemanAgentOf, linemanRequest, renderThread, runLensLineman, type LensLinemanInput } from '../../../../src/reading/lens/lineman.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';

const ok = (text: string): GeminiResult => ({ text, usage: { node: 'n', model: 'm', promptTokens: 1000, cachedTokens: 900, outputTokens: 300, thoughtTokens: 0, ms: 1 }, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false });

const input = (): LensLinemanInput => ({
  ctx: { userId: 'u1', kundliId: 'k1', asOf: '2026-11-19', digestVersion: 'd1' },
  lens: 'love.marriage',
  matters: ['partnership'],
  cards: ['Marriage timing'],
  prefix: { text: '# NATAL\n{house:D1.h7} sign=Vi', dated: 'TODAY: 2026-11-19', keys: ['house:D1.h7'], hash: 'ph' },
  findings: [{ family: 'family.varga', text: '- 7th lord in D9 {planet:D9.Me}' }],
  sheets: [
    { system: 'vimsottari', status: 'ok', cells: [{ span: 's1', matter: 'partnership', tone: 'mixed', sentence: 'The Saturn sub-period weighs on the seventh.', strength: 2, evidence: ['pressure:dasha:vimsottari/2/Sa@2026-06-01'] }], issues: [], model: 'm', sliceHash: 'x', prefixHash: 'ph', hash: 'h' },
    { system: 'yogini', status: 'ok', cells: [{ span: 's1', matter: 'partnership', tone: 'heavy', sentence: 'Flagged clock.', strength: 2, evidence: ['pressure:dasha:yogini/1/Ma@2026-01-01'] }], issues: [], model: 'm', sliceHash: 'x', prefixHash: 'ph', hash: 'h' },
  ],
  ledger: { frameHash: 'f', sheetHashes: {}, cells: [{ id: 'ledger:s1/partnership', span: 's1', matter: 'partnership', status: 'leaning', tone: 'mixed', agree: 2, of: 3, clocks: [], sentence: null, sides: null, evidence: [] }], pairs: [], byStatus: { confirmed: 0, leaning: 1, single: 0, contested: 0 } },
  frame: { asOf: '2026-11-19', to: '2027-11-19', clock: 'vimsottari', spans: [{ id: 's1', from: '2026-10-01', to: '2027-01-01', place: 'now' } as never], saturn: [], clocksRead: [], clocksSkipped: [], degraded: false },
  systemsText: '# VERIFIED SYSTEMS READ FROM STORED PERIODS\n{activation:sudasa/1/Le@2020-01-01} system=sudasa L1 sign=Le',
  systemsKeys: ['activation:sudasa/1/Le@2020-01-01'],
  verified: ['vimsottari', 'sudasa'],
  model: 'gemini-3.8-flash',
});

describe('lens lineman', () => {
  it('the request carries the findings, the verified clocks sentences (never a flagged one), the gate and the recipe', () => {
    const r = linemanRequest(input());
    expect(r.text).toContain('The Saturn sub-period weighs on the seventh.');
    expect(r.text).not.toContain('Flagged clock.');
    expect(r.text).toContain('{ledger:s1/partnership} status=leaning');
    expect(r.text).toContain('7th lord in D9 {planet:D9.Me}');
    expect(r.text).toContain('LENS RECIPE');
    expect(r.keys).toEqual(expect.arrayContaining(['planet:D9.Me', 'activation:sudasa/1/Le@2020-01-01', 'ledger:s1/partnership', 'house:D1.h7']));
    expect(PROMPTS['lens/lineman']).toContain('LENS LINEMAN');
  });

  it('a link with no key from the input is dropped; the thread is ordered promise → trigger', () => {
    const v = checkThread(
      { links: [{ step: 'trigger', text: 'Jupiter transit', keys: ['house:D1.h7'], source: 'chart' }, { step: 'promise', text: '7th lord in D9', keys: ['planet:D9.Me'], source: 'family' }, { step: 'year', text: 'made up', keys: ['planet:D60.Xx'], source: 'chart' }] },
      new Set(['house:D1.h7', 'planet:D9.Me']),
    );
    expect(v.links.map((l) => l.step)).toEqual(['promise', 'trigger']);
    expect(v.dropped).toHaveLength(1);
    expect(renderThread({ lens: 'love.marriage', links: v.links })).toContain('- [promise; family] 7th lord in D9 {planet:D9.Me}');
  });

  it('one call on the board lineman of the lens, natal prefix cached and the dated block uncached; the thread comes back keyed', async () => {
    const seen: GeminiCallOptions[] = [];
    const callGemini = async (o: GeminiCallOptions) => (seen.push(o), ok(JSON.stringify({ links: [{ step: 'promise', text: 'The seventh from D9.', keys: ['planet:D9.Me'], source: 'family' }] })));
    const r = await runLensLineman({ prisma: {} as never, callGemini, now: new Date('2026-11-19T12:00:00Z') }, input());
    expect(seen).toHaveLength(1);
    expect(seen[0]!.node).toBe('lineman.love.love.marriage');
    expect(seen[0]!.parts[0]).toBe('# NATAL\n{house:D1.h7} sign=Vi');
    expect(seen[0]!.parts[1]!.startsWith('TODAY: 2026-11-19')).toBe(true);
    expect(seen[0]!.maxOutputTokens).toBe(10_000);
    expect(seen[0]!.cachePrefix).toBe(true);
    expect(r.thread).toMatchObject({ lens: 'love.marriage', keys: ['planet:D9.Me'] });
    expect(linemanAgentOf('work.business')).toBe('lineman.work');
    expect(linemanAgentOf('self.mind')).toBe('lineman.self');
  });

  it('a failed call gives no thread and never throws', async () => {
    const r = await runLensLineman({ prisma: {} as never, callGemini: async () => Promise.reject(new Error('down')), now: new Date() }, input());
    expect(r.thread).toBeNull();
    expect(r.issues[0]!.check).toBe('call_failed');
  });
});
