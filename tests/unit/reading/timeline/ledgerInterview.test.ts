import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startFakeGemini, type FakeGemini } from '../../../helpers/fakeGemini.js';
import { detectDeclined } from '../../../../src/reading/policy/declined.js';
import { INTERVIEW_SCHEMA, INTERVIEW_SYSTEM, extractLedgerProposals } from '../../../../src/reading/timeline/interview.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';

const TODAY = new Date('2026-10-26T12:00:00Z');
const usage = { node: 'timeline_interview', model: 'm', promptTokens: 1, cachedTokens: 0, outputTokens: 1, thoughtTokens: 0, ms: 1 } as unknown as GeminiResult['usage'];
const answer = (events: unknown[]) => vi.fn(async (_o: GeminiCallOptions): Promise<GeminiResult> => ({ text: JSON.stringify({ events }), usage, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false }));
/** the built-in declined list, as an ordinary user (no health role) */
const gate = async (text: string) => detectDeclined(text);

describe('extractLedgerProposals (faked model)', () => {
  it('turns the account into checked proposals and stores nothing', async () => {
    const call = answer([
      { category: 'residence.move', date: '2014-06', date_precision: 'month', place: 'Pune', attributes: { direction: 'SE', country: '' } },
      { category: 'vehicle.purchase', date: '2014', date_precision: 'year', place: '', attributes: { colour: 'white', make: 'Honda' } },
    ]);
    const r = await extractLedgerProposals('In June 2014 I moved to Pune. That year I bought a white Honda.', { year: 2014 }, { gate, call, today: TODAY });
    expect(r).toMatchObject({
      status: 'ok',
      dropped: 0,
      proposals: [
        { proposalId: 'p1', category: 'residence.move', date: '2014-06-01', date_precision: 'month', place: 'Pune', attributes: { direction: 'SE' } },
        { proposalId: 'p2', category: 'vehicle.purchase', date: '2014-01-01', date_precision: 'year', place: null, attributes: { colour: 'white', make: 'Honda' } },
      ],
    });
    const o = call.mock.calls[0]![0];
    expect(o.temperature).toBe(0.1);
    expect(o.responseSchema).toBe(INTERVIEW_SCHEMA);
    expect(o.parts[0]).toContain('describing the year 2014');
    expect(o.system).toMatch(/Facts only/);
    expect(o.system).toMatch(/Never record amounts of money/);
  });

  it('drops judgement words and amounts from attributes, and rows that fail the checks', async () => {
    const call = answer([
      { category: 'business.end', date: '2017', date_precision: 'year', place: '', attributes: { outcome: 'failed badly', field: 'textiles' } },
      { category: 'money.loss', date: '2018', date_precision: 'year', place: '', attributes: { outcome: 'lost 5 lakhs' } },
      { category: 'job.start', date: '2030-01-01', date_precision: 'day' },
      { category: 'astrology.reading', date: '2015', date_precision: 'year' },
      { category: 'job.start', date: '2015', date_precision: 'day' },
      'not an object',
    ]);
    const r = await extractLedgerProposals('Business closed in 2017; money lost in 2018.', {}, { gate, call, today: TODAY });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.proposals.map((p) => [p.category, p.attributes])).toEqual([
      ['business.end', { field: 'textiles' }],
      ['money.loss', {}],
    ]);
    expect(r.dropped).toBe(4);
  });

  it('declined text never reaches the model', async () => {
    const call = answer([]);
    const r = await extractLedgerProposals('How do I poison someone?', {}, { gate, call, today: TODAY });
    expect(r.status).toBe('declined');
    expect(call).not.toHaveBeenCalled();
    // role-gated health is declined for a user without the role
    const h = await extractLedgerProposals('I had surgery in 2019.', {}, { gate, call, today: TODAY });
    expect(h.status).toBe('declined');
    expect(call).not.toHaveBeenCalled();
  });

  it('the gate runs again on what the model proposed', async () => {
    const call = answer([
      { category: 'health.surgery', date: '2019', date_precision: 'year' },
      { category: 'job.start', date: '2019-03', date_precision: 'month', attributes: { field: 'computing' } },
    ]);
    const seen: string[] = [];
    const r = await extractLedgerProposals('In 2019 I started a new job in computing.', {}, { gate: async (t) => (seen.push(t), detectDeclined(t)), call, today: TODAY });
    expect(r).toMatchObject({ status: 'ok', dropped: 1, proposals: [{ category: 'job.start' }] });
    expect(seen.length).toBe(3);
  });

  it('rejects empty and oversized text; a failing model is unavailable', async () => {
    expect(await extractLedgerProposals('  ', {}, { gate })).toEqual({ status: 'invalid', error: 'text_required' });
    expect(await extractLedgerProposals('x'.repeat(2001), {}, { gate })).toEqual({ status: 'invalid', error: 'text_too_long' });
    const call = vi.fn(async () => {
      throw new Error('boom');
    });
    expect(await extractLedgerProposals('I moved in 2014.', {}, { gate, call, today: TODAY })).toEqual({ status: 'unavailable' });
  });

  it('the schema constrains categories to the ledger list', () => {
    const items = (INTERVIEW_SCHEMA.properties as any).events.items;
    expect(items.properties.category.enum).toContain('family.father.illness');
    expect(items.required).toEqual(['category', 'date', 'date_precision']);
    expect(INTERVIEW_SYSTEM).toContain('English only');
  });
});

describe('extractLedgerProposals over the Gemini REST wrapper (fake server)', () => {
  let fake: FakeGemini;
  const env0 = { ...process.env };
  beforeAll(async () => {
    fake = await startFakeGemini({ ledgerEvents: { events: [{ category: 'education.graduation', date: '2012-05-20', date_precision: 'day', place: 'Mumbai', attributes: { field: 'engineering' } }] } });
    process.env.GEMINI_API_KEY = 'k';
    process.env.GEMINI_API_URL = fake.url;
  });
  afterAll(async () => {
    await fake.close();
    for (const k of Object.keys(process.env)) if (!(k in env0)) delete process.env[k];
    Object.assign(process.env, env0);
  });

  it('sends a schema-constrained low-temperature request and parses the answer', async () => {
    const r = await extractLedgerProposals('I graduated in engineering in Mumbai on 20 May 2012.', {}, { gate, today: TODAY });
    expect(r).toMatchObject({ status: 'ok', proposals: [{ category: 'education.graduation', date: '2012-05-20', place: 'Mumbai', attributes: { field: 'engineering' } }] });
    const body = fake.requests[0]!.body;
    expect(body.generationConfig.temperature).toBe(0.1);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.properties.events).toBeTruthy();
    expect(body.systemInstruction.parts[0].text).toContain('Facts only');
  });
});
