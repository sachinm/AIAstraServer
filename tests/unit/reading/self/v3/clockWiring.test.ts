/**
 * Doc 70 Phase 3 wiring (§7 step 3, §4.1 layers 1–3): slices written at sync, the build reads them (writing back only
 * what changed), the clock layer runs from the v3 step when READING_CLOCK_LAYER=1, and a ledger status never exceeds
 * the count. Fakes only: no engine, model, cache endpoint or database.
 */
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { GeminiCallOptions, GeminiResult } from '../../../../../src/reading/llm/gemini.js';
import { runSelfV3Cards } from '../../../../../src/reading/self/v3/build.js';
import type { PreparedAgentSlice, SelfBuildContext } from '../../../../../src/reading/self/v2types.js';
import { prepareSlices, writeSlicesAtSync, natalCoreFromPrefix } from '../../../../../src/reading/slices/prepare.js';
import { parseRowLines, type RenderedSlice, type StoredSlice } from '../../../../../src/reading/slices/index.js';
import { ASOF, inventories } from '../../slices/fixtures.js';
import type { PressureInventoryDetail, PressureRowDetail } from '../../../../../src/reading/self/sub/pressure.js';

const noPrisma = new Proxy({}, { get: () => undefined }) as unknown as PrismaClient;

/** an in-memory kundli_slices store */
function sliceStore() {
  const rows = new Map<string, StoredSlice>();
  const write = vi.fn(async (_p: PrismaClient, _k: string, slices: readonly RenderedSlice[]) => {
    const out = { written: [] as string[], unchanged: [] as string[], failed: [] as Array<{ id: string; error: string }> };
    for (const s of slices) {
      if (rows.get(s.id)?.hash === s.hash) out.unchanged.push(s.id);
      else {
        rows.set(s.id, { ...s, builtAt: '2026-11-09T00:00:00Z' });
        out.written.push(s.id);
      }
    }
    return out;
  });
  const read = vi.fn(async (_p: PrismaClient, _k: string, ids?: readonly string[]) => Object.fromEntries([...rows].filter(([id]) => !ids || ids.includes(id))));
  return { rows, write, read };
}

describe('slices at sync', () => {
  it('renders the set from the stored inventories of the clock set and writes it; a second run writes nothing', async () => {
    const invs = new Map(inventories().map((x) => [x.system, x.inventory]));
    const store = sliceStore();
    const set = { spine: 'vimsottari', pulled: ['vimsottari', 'narayana', 'yogini'] };
    const load = async (_p: PrismaClient, _k: string, s: string) => invs.get(s) ?? null;
    const a = await writeSlicesAtSync(noPrisma, 'k1', ASOF, set, { load, write: store.write });
    expect(a.gaps).toEqual([]);
    expect(a.frame!.spans.length).toBeGreaterThan(0);
    expect(a.written).toEqual(expect.arrayContaining(['sky.window', 'year.tp', 'frame', 'clock.vimsottari', 'clock.narayana', 'clock.yogini', 'clock.tithi_pravesha']));
    expect(a.written.some((id) => id.startsWith('matter.'))).toBe(true);
    const b = await writeSlicesAtSync(noPrisma, 'k1', ASOF, set, { load, write: store.write });
    expect(b.written).toEqual([]);
    expect(b.read).toHaveLength(a.written.length);
  });

  it('no stored spine inventory: a gap, nothing written', async () => {
    const store = sliceStore();
    const r = await writeSlicesAtSync(noPrisma, 'k1', ASOF, { spine: 'dwisatpathi', pulled: ['dwisatpathi'] }, { load: async () => null, write: store.write });
    expect(r.gaps[0]).toMatch(/no stored inventory for the spine/);
    expect(store.write).not.toHaveBeenCalled();
  });
});

describe('the build reads slices', () => {
  it('uses a stored slice whose hash matches; writes back only the changed ones', async () => {
    const store = sliceStore();
    const a = natalCoreFromPrefix('# NATAL\n{planet:D1.Mo}', 'd1');
    const b = natalCoreFromPrefix('# NATAL\n{planet:D1.Su}', 'd1');
    const other: RenderedSlice = { ...a, id: 'frame', hash: 'h-frame' };
    await store.write(noPrisma, 'k1', [a, other]);
    store.write.mockClear();
    const r = await prepareSlices(noPrisma, 'k1', [b, other], { read: store.read, write: store.write });
    expect(r.report.read).toEqual(['frame']);
    expect(r.report.written).toEqual(['natal.core']);
    expect(r.slices.map((s) => s.hash)).toEqual([b.hash, 'h-frame']);
    expect(a.keys).toEqual(['planet:D1.Mo']);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The v3 step with the clock layer on (real slices, real reader validators, real count; fake model)
// ---------------------------------------------------------------------------------------------------------------------

const row = (id: string, kind: PressureRowDetail['kind'], level: number | undefined, polarity: PressureRowDetail['polarity'], from: string, to: string, matters: string[]): PressureRowDetail =>
  ({ id, kind, ...(level ? { level } : {}), planet: 'X', housesTouched: [6], matters, polarity, strength: 2, from, to, evidence: [id], houseFromMoon: null, reasons: polarity === 'presses' ? ['functional_malefic', 'in_dusthana', 'kashta_over_ishta'] : [] }) as PressureRowDetail;
const inv = (clock: string, rows: PressureRowDetail[]): PressureInventoryDetail => ({ kundliId: 'k1', clock, asOf: ASOF, from: '2023-11-09', to: '2029-11-09', rows, boundaries: [], calcVersion: '2' });
const M = ['work_load_and_health'];
const primary = inv('dwisatpathi', [
  row('dasha:dwisatpathi/3/Sa@2026-10-01', 'dasha', 3, 'presses', '2026-10-01', '2027-01-01', M),
  row('dasha:dwisatpathi/3/Ju@2027-01-01', 'dasha', 3, 'supports', '2027-01-01', '2028-01-10', M),
  row('annual:TP2026', 'annual', 1, 'presses', '2026-09-20', '2027-09-09', M),
]);
const vim = inv('vimsottari', [row('dasha:vimsottari/3/Ma@2026-09-01', 'dasha', 3, 'presses', '2026-09-01', '2027-03-01', M), row('dasha:vimsottari/3/Ve@2027-03-01', 'dasha', 3, 'supports', '2027-03-01', '2028-03-01', M)]);
const nar = inv('narayana', [row('dasha:narayana/3/Le@2026-08-01', 'dasha', 3, 'presses', '2026-08-01', '2027-02-01', M), row('dasha:narayana/3/Vi@2027-02-01', 'dasha', 3, 'mixed', '2027-02-01', '2028-02-01', M)]);
const clock = { primary: 'dwisatpathi', confirming: ['vimsottari', 'narayana'], applicable: [], notApplicable: [] } as never;
const ctx = {
  userId: 'u1',
  kundliId: 'k1',
  asOf: ASOF,
  stamps: { digestVersion: 'd1', clock: 'dwisatpathi', mainPeriod: null, subPeriod: null, subSubPeriod: null, skyWeek: null, year: null, profileHash: 'ph', confirmHash: null },
  sub: { clock, year: { from: '2026-09-20', to: '2027-09-09', yearLagna: null, yearLord: null, shortClock: null, noCoverage: false }, profile: { ageBand: '36_45', ageYears: 40, gender: null, role: 'public', facts: {}, declined: [], lastConfirms: [], mood: null, hash: 'ph' } },
} as unknown as SelfBuildContext;
const slice: PreparedAgentSlice = { agent: 'self.oracle', prefix: '# NATAL SLICE\n{planet:D1.Mo}', suffix: '', prefixHash: 'pre', cacheOwner: { userId: 'u1', kundliId: 'k1' }, model: 'gemini-test', system: 'v2', estTokens: { prefix: 10, suffix: 0 }, keys: ['planet:D1.Mo'] };
const ok = (text: string): GeminiResult => ({ text, usage: { promptTokens: 100, cachedTokens: 90, outputTokens: 20, thoughtTokens: 0 } as never, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false });

/** reads its own clock slice honestly (the graded tone per span and matter) */
function reader(parts: string[]): string {
  const spans = [...parts[0]!.matchAll(/^(s\d+) (\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2}) place=/gm)].map((m) => ({ id: m[1]!, from: m[2]!, to: m[3]! }));
  const own = parts[1]!.slice(parts[1]!.indexOf('# CLOCK'));
  const rows = [...parseRowLines(own).values()];
  const cells = spans.flatMap((s) => {
    const hit = rows.filter((r) => r.from < s.to && s.from < r.to);
    const tones = [...new Set(hit.map((r) => r.tone))];
    return hit.length ? [{ span: s.id, matter: M[0], tone: tones.length === 1 ? tones[0] : 'mixed', sentence: 'It reads so.', strength: 2, evidence: hit.map((r) => r.key) }] : [];
  });
  return JSON.stringify({ cells });
}

/** a concordance agent that claims every cell confirmed heavy */
function boastful(part: string): string {
  const ids = [...part.matchAll(/^(ledger:\S+) status=/gm)].map((m) => m[1]!);
  return JSON.stringify({ cells: ids.map((id) => ({ id, status: 'confirmed', tone: 'heavy', sentence: 'All agree.', sides: [], evidence: [] })) });
}

describe('the v3 step with READING_CLOCK_LAYER on', () => {
  it('writes the slices, runs one reader per clock and the concordance; no ledger status exceeds the count', async () => {
    const store = sliceStore();
    const nodes: string[] = [];
    const callGemini = async (o: GeminiCallOptions) => {
      nodes.push(o.node);
      if (o.node.startsWith('reading.clock.')) return ok(reader(o.parts));
      if (o.node === 'reading.concordance') return ok(boastful(o.parts[1]!));
      return ok(JSON.stringify({ cards: [] }));
    };
    const r = await runSelfV3Cards(
      {
        prisma: noPrisma,
        callGemini: callGemini as never,
        ensureCache: (async () => 'cachedContents/fake') as never,
        maxSpendUsd: 1,
        now: new Date(`${ASOF}T12:00:00Z`),
        clockLayer: true,
        loadInventory: async (_p, _k, s) => (s === 'vimsottari' ? vim : s === 'narayana' ? nar : null),
        loadClockSet: async () => ({ spine: 'dwisatpathi', clocks: ['vimsottari', 'narayana', 'tithi_pravesha', 'dwisatpathi'], pulled: ['vimsottari', 'narayana', 'dwisatpathi'], conditional: 'dwisatpathi', skipped: [] }),
        loadSections: async () => ({}),
        prepareSlices: (p, k, fresh) => prepareSlices(p, k, fresh, { read: store.read, write: store.write }),
      },
      { ctx, pressure: primary, oracleSlice: slice, portrait: null, buildId: 'b1' },
    );
    expect(store.rows.has('natal.core')).toBe(true);
    expect(store.rows.has('clock.narayana')).toBe(true);
    expect(r.slices!.written.length).toBe(r.slices!.count);
    expect(nodes.filter((n) => n.startsWith('reading.clock.')).sort()).toEqual(['reading.clock.dwisatpathi', 'reading.clock.narayana', 'reading.clock.tithi_pravesha', 'reading.clock.vimsottari']);
    expect(nodes).toContain('reading.concordance');
    expect(r.ledger).toBeTruthy();
    for (const c of r.ledger!.cells) {
      if (c.status === 'confirmed') expect(c.agree).toBeGreaterThanOrEqual(3);
      if (c.status === 'leaning') expect(c.agree).toBe(2);
      if (c.status === 'single') expect(c.sentence).toBeNull();
      expect(c.agree).toBeLessThanOrEqual(c.of);
    }
    expect(r.ledger!.cells.some((c) => c.status !== 'confirmed')).toBe(true);
    expect(r.clockLayer!.sheets).toHaveLength(4);
    // a second build reads every slice as stored
    store.write.mockClear();
    const r2 = await runSelfV3Cards(
      { prisma: noPrisma, callGemini: callGemini as never, ensureCache: (async () => 'cachedContents/fake') as never, maxSpendUsd: 1, now: new Date(`${ASOF}T12:00:00Z`), clockLayer: true, loadInventory: async (_p, _k, s) => (s === 'vimsottari' ? vim : s === 'narayana' ? nar : null), loadClockSet: async () => ({ spine: 'dwisatpathi', clocks: [], pulled: ['vimsottari', 'narayana', 'dwisatpathi'], conditional: null, skipped: [] }), loadSections: async () => ({}), prepareSlices: (p, k, fresh) => prepareSlices(p, k, fresh, { read: store.read, write: store.write }) },
      { ctx, pressure: primary, oracleSlice: slice, portrait: null, buildId: 'b2' },
    );
    expect(r2.slices!.read.length).toBe(r2.slices!.count);
    expect(store.write).not.toHaveBeenCalled();
  });

  it('is off without the flag: no slice, no reader', async () => {
    const nodes: string[] = [];
    const r = await runSelfV3Cards(
      { prisma: noPrisma, callGemini: (async (o: GeminiCallOptions) => (nodes.push(o.node), ok(JSON.stringify({ cards: [] })))) as never, ensureCache: (async () => null) as never, maxSpendUsd: 1, now: new Date(), clockLayer: false, loadInventory: async () => vim, loadSections: async () => ({}) },
      { ctx, pressure: primary, oracleSlice: slice, portrait: null, buildId: 'b3' },
    );
    expect(r.slices).toBeUndefined();
    expect(nodes.some((n) => n.startsWith('reading.'))).toBe(false);
  });
});

describe('the v3 step with the per-card reading on (doc 70 Phase 3)', () => {
  const base = (over: Record<string, unknown>) => ({
    prisma: noPrisma,
    ensureCache: (async () => 'cachedContents/fake') as never,
    maxSpendUsd: 1,
    now: new Date(`${ASOF}T12:00:00Z`),
    cardsRead: true,
    loadInventory: async (_p: PrismaClient, _k: string, s: string) => (s === 'vimsottari' ? vim : s === 'narayana' ? nar : null),
    loadClockSet: async () => ({ spine: 'dwisatpathi', clocks: [], pulled: ['vimsottari', 'narayana', 'dwisatpathi'], conditional: null, skipped: [] }),
    loadSections: async () => ({}),
    prepareSlices: (p: PrismaClient, k: string, fresh: readonly RenderedSlice[]) => prepareSlices(p, k, fresh, { read: async () => ({}), write: async (_p, _k, s) => ({ written: s.map((x) => x.id), unchanged: [], failed: [] }) }),
    ...over,
  });

  it('a board under five cards reads nothing: no clock reader, no card, no Oracle', async () => {
    const nodes: string[] = [];
    const r = await runSelfV3Cards(base({ callGemini: (async (o: GeminiCallOptions) => (nodes.push(o.node), ok('{}'))) as never, loadBoard: async () => ({ cards: ['body', 'mind', 'stuck'], sections: {} }) }) as never, {
      ctx,
      pressure: primary,
      oracleSlice: slice,
      portrait: null,
      buildId: 'b4',
    });
    expect(r.status).toBe('skipped');
    expect(r.gaps.join(' ')).toMatch(/holds 3 cards/);
    expect(nodes).toEqual([]);
  });

  it('a board of five: the clock layer, then one run per card on the ledger; the three-call Oracle is not run', async () => {
    const nodes: string[] = [];
    const seen: Array<{ board: readonly string[]; ledger: unknown; prefix: string }> = [];
    const callGemini = async (o: GeminiCallOptions) => {
      nodes.push(o.node);
      if (o.node.startsWith('reading.clock.')) return ok(reader(o.parts));
      if (o.node === 'reading.concordance') return ok(boastful(o.parts[1]!));
      return ok(JSON.stringify({ cards: [] }));
    };
    const r = await runSelfV3Cards(
      base({
        callGemini: callGemini as never,
        loadBoard: async () => ({ cards: ['body', 'mind', 'stuck', 'sleep', 'year'], sections: {} }),
        readCards: async (_d: unknown, i: { board: readonly string[]; ledger: unknown; prefix: { text: string } }) => {
          seen.push({ board: i.board, ledger: i.ledger, prefix: i.prefix.text });
          return { results: [{ card: 'body', status: 'ok', content: null, timings: [], issues: [], costUsd: 0 }], cards: { body: { line: 'x', spans: [], confirm: null, pattern: null, ladder: null, agreement: null } }, timings: [], issues: [], spentUsd: 0, capReached: false, order: ['body'] };
        },
      }) as never,
      { ctx, pressure: primary, oracleSlice: slice, portrait: null, buildId: 'b5' },
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]!.board).toEqual(['body', 'mind', 'stuck', 'sleep', 'year']);
    expect(seen[0]!.ledger).toBeTruthy();
    expect(seen[0]!.prefix).toContain('# FRAME');
    expect(nodes.some((n) => n.startsWith('self.oracle.v3'))).toBe(false);
    expect(r.cards.body).toBeTruthy();
    expect(r.status).toBe('ok');
  });
  it('the cards start on the counted ledger while the concordance is still writing; its words are folded in after', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    const order: string[] = [];
    const callGemini = async (o: GeminiCallOptions) => {
      if (o.node.startsWith('reading.clock.')) return ok(reader(o.parts));
      if (o.node === 'reading.concordance') {
        order.push('concordance asked');
        await held;
        order.push('concordance answered');
        return ok(boastful(o.parts[1]!));
      }
      return ok(JSON.stringify({ cards: [] }));
    };
    let ledgerSeen: { cells: Array<{ status: string; tone: string | null; agree: number; of: number; sentence: string | null; evidence: string[] }> } | null = null;
    const r = await runSelfV3Cards(
      base({
        callGemini: callGemini as never,
        loadBoard: async () => ({ cards: ['body', 'mind', 'stuck', 'sleep', 'year'], sections: {} }),
        readCards: async (_d: unknown, i: { ledger: typeof ledgerSeen }) => {
          order.push('cards');
          ledgerSeen = i.ledger;
          release();
          return { results: [{ card: 'body', status: 'ok', content: null, timings: [], issues: [], costUsd: 0 }], cards: { body: { line: 'x', spans: [], confirm: null, pattern: null, ladder: null, agreement: null } }, timings: [], issues: [], spentUsd: 0, capReached: false, order: ['body'] };
        },
      }) as never,
      { ctx, pressure: primary, oracleSlice: slice, portrait: null, buildId: 'b6' },
    );
    expect(order).toEqual(['concordance asked', 'cards', 'concordance answered']);
    // the cards' ledger: counted in code, no words yet, every confirmed cell with three or more clocks and its keys
    expect(ledgerSeen!.cells.length).toBeGreaterThan(0);
    for (const c of ledgerSeen!.cells) {
      expect(c.sentence).toBeNull();
      if (c.status === 'confirmed') expect(c.agree).toBeGreaterThanOrEqual(3);
      if (c.status === 'confirmed' || c.status === 'leaning') expect(c.evidence.length).toBeGreaterThan(0);
    }
    // the result holds the worded ledger, the concordance's call, and the same counted statuses
    expect(r.agents.some((a) => (a as { call?: string }).call === 'concordance')).toBe(true);
    expect(r.ledger!.cells.map((c) => [c.id, c.status, c.tone, c.agree, c.of])).toEqual((ledgerSeen as unknown as { cells: Array<{ id: string; status: string; tone: string | null; agree: number; of: number }> }).cells.map((c) => [c.id, c.status, c.tone, c.agree, c.of]));
    expect(r.status).toBe('ok');
  });
});
