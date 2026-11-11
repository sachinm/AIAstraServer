import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runClockLayer, type ClockLayerDeps } from '../../../../src/reading/clocks/run.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import { renderSliceSet } from '../../../../src/reading/slices/index.js';
import { fakeConcordance, fakeReader, result } from './fakes.js';
import { ASOF, frame, inventories, natal } from '../slices/fixtures.js';

const prisma = new Proxy({}, { get: () => undefined }) as never;
const ctx = { userId: 'u1', kundliId: 'k1', asOf: ASOF };
describe('runClockLayer end to end (fake model, fake cache, no database)', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.READING_EXPLICIT_CACHE = '1';
    process.env.READING_CLOCK_LAYER = '1';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  function deps(over: Partial<ClockLayerDeps> = {}) {
    const calls: GeminiCallOptions[] = [];
    const warmed: Array<{ model: string; system: string | undefined; prefix: string }> = [];
    const used: unknown[] = [];
    const d: ClockLayerDeps = {
      prisma,
      callGemini: async (o) => {
        calls.push(o);
        return result(o.node === 'reading.concordance' ? fakeConcordance(o.parts[1]!) : fakeReader(o.parts[1]!));
      },
      ensureCache: (async (model: string, system: string | undefined, prefix: string) => (warmed.push({ model, system, prefix }), 'cachedContents/fake')) as never,
      informUsed: ((o: unknown) => used.push(o)) as never,
      maxSpendUsd: 1,
      now: new Date(`${ASOF}T12:00:00Z`),
      model: 'gemini-3.8-flash',
      ...over,
    };
    return { d, calls, warmed, used };
  }
  const slices = () => renderSliceSet({ frame: frame(), inventories: inventories(), natal: natal() });

  it('warms one cache, reads each clock alone, counts, writes the ledger', async () => {
    const { d, calls, warmed, used } = deps();
    const r = await runClockLayer(d, { ctx, frame: frame(), slices: slices() });

    // one cache region: the common system prompt + the shared prefix, the same bytes in every call
    expect(warmed).toHaveLength(1);
    expect(r.warmed[0]!.name).toBe('cachedContents/fake');
    expect(new Set(calls.map((c) => c.parts[0])).size).toBe(1);
    expect(new Set(calls.map((c) => c.system)).size).toBe(1);
    expect(calls[0]!.parts[0]).toBe(warmed[0]!.prefix);
    expect(calls.every((c) => c.cachePrefix && c.cacheOwner?.kundliId === 'k1')).toBe(true);

    // one reader per clock, the year as its own clock; each sees its own clock slice only
    const readers = calls.filter((c) => c.node.startsWith('reading.clock.'));
    expect(readers.map((c) => c.node).sort()).toEqual(['reading.clock.narayana', 'reading.clock.tithi_pravesha', 'reading.clock.vimsottari', 'reading.clock.yogini']);
    for (const c of readers) {
      const own = c.node.replace('reading.clock.', '');
      for (const other of ['narayana', 'vimsottari', 'yogini'].filter((x) => x !== own)) expect(c.parts[1], `${own} sees ${other}`).not.toContain(`dasha:${other}/`);
      expect(c.timeoutMs).toBe(45_000);
    }
    expect(calls.filter((c) => c.node === 'reading.concordance')).toHaveLength(1);
    expect(used).toHaveLength(5);

    // the borrowed cell is dropped: an unknown key in the other sheets, a second s1/career cell in narayana's own
    expect(r.sheets.map((s) => [s.system, s.status])).toEqual([
      ['narayana', 'partial'],
      ['vimsottari', 'partial'],
      ['yogini', 'partial'],
      ['tithi_pravesha', 'partial'],
    ]);
    expect(r.issues.filter((i) => i.stage === 'clock').map((i) => `${i.system}:${i.check}`).sort()).toEqual(['narayana:duplicate_cell', 'tithi_pravesha:unknown_evidence_key', 'vimsottari:unknown_evidence_key', 'yogini:unknown_evidence_key']);

    // s1 career: every clock presses → confirmed heavy 4/4; s3 career: two light, one heavy → contested
    const cell = (id: string) => r.ledger!.cells.find((c) => c.id === id)!;
    expect(cell('ledger:s1/career_and_standing')).toMatchObject({ status: 'confirmed', tone: 'heavy', agree: 4, of: 4, sentence: 'The clocks agree: heavy.' });
    expect(cell('ledger:s3/career_and_standing')).toMatchObject({ status: 'contested', tone: null });
    expect(cell('ledger:s3/career_and_standing').sides!.map((s) => [s.tone, s.clocks])).toEqual([
      ['heavy', ['yogini']],
      ['light', ['narayana', 'vimsottari']],
    ]);
    // the agent tried to raise a single cell: the count holds
    expect(cell('ledger:s1/self_and_body')).toMatchObject({ status: 'single', sentence: null });
    expect(r.issues.some((i) => i.stage === 'concordance' && i.check === 'unknown_cell')).toBe(true);
    expect(r.pairs.find((p) => p.a === 'narayana' && p.b === 'vimsottari')).toMatchObject({ agree: expect.any(Number), both: expect.any(Number) });
    expect(r.timings).toHaveLength(5);
    expect(r.spentUsd).toBeGreaterThan(0);
    expect(r.status).toBe('partial');
  });

  it('is off without the flag, and makes no call', async () => {
    delete process.env.READING_CLOCK_LAYER;
    const { d, calls, warmed } = deps();
    const r = await runClockLayer(d, { ctx, frame: frame(), slices: slices() });
    expect(r.status).toBe('off');
    expect(calls).toHaveLength(0);
    expect(warmed).toHaveLength(0);
  });

  it('a reader that hangs is cut at its limit and never throws; with too few sheets no ledger is written', async () => {
    const { d, calls } = deps({
      timeoutMs: 20,
      callGemini: async (o) => {
        calls.push(o);
        if (o.node !== 'reading.clock.vimsottari') return new Promise<GeminiResult>(() => undefined);
        return result(fakeReader(o.parts[1]!));
      },
    });
    const r = await runClockLayer(d, { ctx, frame: frame(), slices: slices() });
    expect(r.status).toBe('too_few_clocks');
    expect(r.sheets.filter((s) => s.status === 'failed')).toHaveLength(3);
    expect(r.issues.filter((i) => i.check === 'timeout')).toHaveLength(3);
    expect(r.ledger).toBeNull();
    expect(calls.some((c) => c.node === 'reading.concordance')).toBe(false);
  });

  it('over the spend cap no reader is called', async () => {
    const { d, calls } = deps({ spentUsd: 2, maxSpendUsd: 1 });
    const r = await runClockLayer(d, { ctx, frame: frame(), slices: slices() });
    expect(calls).toHaveLength(0);
    expect(r.sheets.every((s) => s.status === 'skipped')).toBe(true);
    expect(r.status).toBe('budget_exceeded');
  });

  it('a model that throws or returns no JSON fails that sheet only', async () => {
    const { d } = deps({
      callGemini: async (o) => {
        if (o.node === 'reading.clock.yogini') throw new Error('boom');
        if (o.node === 'reading.clock.narayana') return result('not json');
        return result(o.node === 'reading.concordance' ? fakeConcordance(o.parts[1]!) : fakeReader(o.parts[1]!));
      },
    });
    const r = await runClockLayer(d, { ctx, frame: frame(), slices: slices() });
    expect(r.sheets.find((s) => s.system === 'yogini')!.issues[0]!.check).toBe('call_failed');
    expect(r.sheets.find((s) => s.system === 'narayana')!.issues[0]!.check).toBe('json_schema');
    expect(r.status).toBe('too_few_clocks');
  });

  it('missing shared slices stop the layer before any call', async () => {
    const { d, calls } = deps();
    const r = await runClockLayer(d, { ctx, frame: frame(), slices: slices().filter((s) => s.id !== 'frame') });
    expect(r.status).toBe('missing_slices');
    expect(calls).toHaveLength(0);
  });
  it('background words: returns on the count (no words, statuses final), then the words settle with the call and the cost', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    const { d, calls } = deps({
      words: 'background',
      callGemini: async (o) => {
        calls.push(o);
        if (o.node === 'reading.concordance') await held;
        return result(o.node === 'reading.concordance' ? fakeConcordance(o.parts[1]!) : fakeReader(o.parts[1]!));
      },
    });
    const r = await runClockLayer(d, { ctx, frame: frame(), slices: slices() });
    expect(r.ledger).not.toBeNull();
    expect(r.ledger!.cells.every((c) => c.sentence === null && c.sides === null)).toBe(true);
    expect(r.timings.filter((t) => t.call === 'concordance')).toHaveLength(0);
    expect(r.words).not.toBeNull();
    release();
    const w = await r.words!;
    expect(w.timing!.status).toBe('ok');
    expect(w.spentUsd).toBeGreaterThan(0);
    expect(w.ledger.cells.map((c) => [c.id, c.status, c.tone, c.agree, c.of, c.evidence])).toEqual(r.ledger!.cells.map((c) => [c.id, c.status, c.tone, c.agree, c.of, c.evidence]));
    expect(w.ledger.cells.find((c) => c.id === 'ledger:s1/career_and_standing')!.sentence).toBe('The clocks agree: heavy.');
  });
});
