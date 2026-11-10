import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runClockLayer, type ClockLayerDeps } from '../../../../src/reading/clocks/run.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import { TONE_OF } from '../../../../src/reading/self/v3/yearFrame.js';
import { parseRowLines, renderSliceSet } from '../../../../src/reading/slices/index.js';
import { ASOF, frame, inventories, natal } from '../slices/fixtures.js';

const prisma = new Proxy({}, { get: () => undefined }) as never;
const ctx = { userId: 'u1', kundliId: 'k1', asOf: ASOF };
const result = (text: string): GeminiResult => ({ text, usage: { promptTokens: 1000, cachedTokens: 900, outputTokens: 200, thoughtTokens: 0 } as never, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false });

/** A reader that reads its own clock slice honestly: per span and matter, the tone of its rows (mixed when they differ). */
function fakeReader(part: string): string {
  const own = /# CLOCK (\S+)/.exec(part)![1]!;
  const rows = parseRowLines(part.slice(part.indexOf(`# CLOCK ${own}`)));
  const cells: unknown[] = [];
  for (const s of frame().spans) {
    const by = new Map<string, Array<{ key: string; polarity: keyof typeof TONE_OF }>>();
    for (const r of rows.values()) {
      if (!(r.from < s.to && s.from < r.to)) continue;
      for (const m of r.matters) by.set(m, [...(by.get(m) ?? []), { key: r.key, polarity: r.polarity }]);
    }
    for (const [matter, rs] of by) {
      const tones = [...new Set(rs.map((x) => TONE_OF[x.polarity]))];
      cells.push({ span: s.id, matter, tone: tones.length === 1 ? tones[0] : 'mixed', sentence: `${own} reads ${matter}.`, strength: 2, evidence: rs.map((x) => x.key) });
    }
  }
  // one cell citing a row of another clock: the validator must drop it
  cells.push({ span: 's1', matter: 'career_and_standing', tone: 'heavy', sentence: 'Borrowed.', strength: 2, evidence: ['pressure:dasha:narayana/1/Le@2025-01-01'] });
  return JSON.stringify({ cells });
}

/** A concordance agent that writes every counted cell, and tries to raise a single cell to confirmed. */
function fakeConcordance(part: string): string {
  const cells: unknown[] = [];
  const lines = part.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^(ledger:\S+) status=(\w+) tone=(\w+)/.exec(lines[i]!);
    if (!m) continue;
    const clocks: Array<{ system: string; tone: string; keys: string[] }> = [];
    for (let j = i + 1; j < lines.length && lines[j]!.startsWith('  '); j++) {
      const c = /^ {2}(\S+): (\w+) .* evidence (.*)$/.exec(lines[j]!)!;
      clocks.push({ system: c[1]!, tone: c[2]!, keys: [...c[3]!.matchAll(/\{([^}]+)\}/g)].map((x) => x[1]!) });
    }
    if (m[2] === 'contested') {
      const sides = ['heavy', 'mixed', 'light'].map((t) => ({ tone: t, clocks: clocks.filter((c) => c.tone === t).map((c) => c.system), restsOn: `the ${t} periods` })).filter((s) => s.clocks.length);
      cells.push({ id: m[1], status: 'contested', tone: 'none', sentence: '', sides, evidence: clocks[0]!.keys });
    } else cells.push({ id: m[1], status: m[2], tone: m[3], sentence: `The clocks agree: ${m[3]}.`, sides: [], evidence: clocks[0]!.keys });
  }
  cells.push({ id: 'ledger:s1/self_and_body', status: 'confirmed', tone: 'mixed', sentence: 'Raised.', sides: [], evidence: [] });
  return JSON.stringify({ cells });
}

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
});
