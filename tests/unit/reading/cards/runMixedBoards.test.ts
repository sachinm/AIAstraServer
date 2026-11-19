/**
 * docs/dashboards/10 §7 S4, S10: one pack across boards. A run with three Self cards on the board and two queued Love
 * cards makes one pack cache, holds every brief once and stores five readings; a failed Love card fails alone. Also the
 * store's id filter (S3). Fake model and in-memory stores; no paid call, no database.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgreedLedger, LedgerCell } from '../../../../src/reading/clocks/types.js';
import { sharedPrefix } from '../../../../src/reading/clocks/reader.js';
import { pickClockLayerSlices } from '../../../../src/reading/clocks/run.js';
import { readCards, type CardsRunInput } from '../../../../src/reading/cards/run.js';
import { updateCardsState } from '../../../../src/reading/cards/state.js';
import { settleLensRefreshes } from '../../../../src/reading/boards/lensRefreshSettle.js';
import { readCardReadings } from '../../../../src/reading/cards/store.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import type { PressureInventoryDetail, PressureRowDetail } from '../../../../src/reading/self/sub/pressure.js';
import type { SelfBuildContext } from '../../../../src/reading/self/v2types.js';
import type { CardId, SelfCardId } from '../../../../src/reading/self/v3/types.js';
import { buildYearFrameV3 } from '../../../../src/reading/self/v3/yearFrame.js';
import { natalCoreFromPrefix } from '../../../../src/reading/slices/prepare.js';
import { renderSliceSet } from '../../../../src/reading/slices/render.js';

const ASOF = '2026-11-10';
const M = ['work_load_and_health'];
const row = (id: string, kind: PressureRowDetail['kind'], level: number | undefined, polarity: PressureRowDetail['polarity'], from: string, to: string): PressureRowDetail =>
  ({ id, kind, ...(level ? { level } : {}), planet: 'X', housesTouched: [6], matters: M, polarity, strength: 2, from, to, evidence: [id], houseFromMoon: null, reasons: polarity === 'presses' ? ['functional_malefic', 'in_dusthana', 'kashta_over_ishta'] : [] }) as PressureRowDetail;
const inv = (clock: string, rows: PressureRowDetail[]): PressureInventoryDetail => ({ kundliId: 'k1', clock, asOf: ASOF, from: '2023-11-10', to: '2029-11-10', rows, boundaries: [], calcVersion: '2' });
const primary = inv('vimsottari', [
  row('dasha:vimsottari/3/Sa@2026-10-01', 'dasha', 3, 'presses', '2026-10-01', '2027-01-01'),
  row('dasha:vimsottari/3/Ju@2027-01-01', 'dasha', 3, 'supports', '2027-01-01', '2028-01-10'),
  row('annual:TP2026', 'annual', 1, 'presses', '2026-09-20', '2027-09-09'),
]);
const nar = inv('narayana', [row('dasha:narayana/3/Le@2026-08-01', 'dasha', 3, 'presses', '2026-08-01', '2027-01-01'), row('dasha:narayana/3/Vi@2027-01-01', 'dasha', 3, 'supports', '2027-01-01', '2028-02-01')]);
const yog = inv('yogini', [row('dasha:yogini/3/Ma@2026-08-01', 'dasha', 3, 'presses', '2026-08-01', '2027-01-01'), row('dasha:yogini/3/Ve@2027-01-01', 'dasha', 3, 'supports', '2027-01-01', '2028-02-01')]);
const frame = buildYearFrameV3({ asOf: ASOF, clock: { primary: 'vimsottari', confirming: [], applicable: [], notApplicable: [] }, primary, others: [{ system: 'narayana', inventory: nar }, { system: 'yogini', inventory: yog }], year: null, minClocks: 3 });
const slices = [natalCoreFromPrefix('# NATAL\n{planet:D1.Mo} {house:D1.h6}', 'd1'), ...renderSliceSet({ frame, inventories: [{ system: 'vimsottari', inventory: primary }, { system: 'narayana', inventory: nar }, { system: 'yogini', inventory: yog }] })];
const prefix = sharedPrefix(pickClockLayerSlices(slices).picked!.shared);
const cell = (span: string, tone: 'heavy' | 'light', status: LedgerCell['status'] = 'confirmed'): LedgerCell => ({
  id: `ledger:${span}/work_load_and_health`,
  span,
  matter: 'work_load_and_health',
  status,
  tone,
  agree: 3,
  of: 4,
  clocks: [],
  sentence: `The clocks agree: ${tone}.`,
  sides: null,
  evidence: [],
});
const ledger: AgreedLedger = { frameHash: 'f', sheetHashes: {}, cells: frame.spans.map((s) => cell(s.id, s.tone === 'heavy' ? 'heavy' : 'light')), pairs: [], byStatus: { confirmed: frame.spans.length, leaning: 0, single: 0, contested: 0 } };

const ctx = {
  userId: 'u1',
  kundliId: 'k1',
  asOf: ASOF,
  stamps: { digestVersion: 'd1', clock: 'vimsottari', mainPeriod: null, subPeriod: null, subSubPeriod: null, skyWeek: null, year: null, profileHash: 'ph', confirmHash: null },
  sub: { profile: { ageBand: '36_45', ageYears: 40, gender: null, role: 'public', facts: {}, declined: [], lastConfirms: [], mood: null, hash: 'ph' } },
} as unknown as SelfBuildContext;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const words = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

function goodOracle(id: string): Record<string, unknown> {
  return {
    card: id,
    headline: 'A heavy stretch, then room to build.',
    spans: frame.spans.map((s) => ({ span: s.id, tone: s.tone, mode: s.tone === 'heavy' ? 'get_through' : 'build', asks: 'Hold the load.', obstacle: 'Late work.', evidence: [`ledger:${s.id}/work_load_and_health`], agreement: 'three of four agree' })),
    confirm: { claimId: '', text: '', from: '', to: '' },
    gift: 'stamina',
    knot: 'overwork',
    pattern: { text: '', since: '', until: '', evidence: [] },
    certainty: 'likely',
    evidence: ['planet:D1.Mo'],
  };
}
function personal(id: string): Record<string, unknown> {
  return {
    card: id,
    line: `Guard your evenings until ${words(frame.spans[0]!.to)}.`,
    spans: frame.spans.map((s) => ({ span: s.id, asks: 'Guard your evenings.', obstacle: 'Working late.', step: 'If it is past ten, then stop and rest.' })),
    confirm: '',
    pattern: '',
    ladder: { best: '', practical: '', drift: '', floor: '' },
  };
}
const ok = (text: string): GeminiResult => ({ text, usage: { promptTokens: 1000, cachedTokens: 900, outputTokens: 100, thoughtTokens: 0 } as never, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false });

/** in-memory area_builds for the state doc */
function memPrisma() {
  const rows = new Map<string, { status: string; result: unknown }>();
  const k = (w: { kundli_id_area_as_of: { kundli_id: string; area: string; as_of: Date } }) => `${w.kundli_id_area_as_of.kundli_id}|${w.kundli_id_area_as_of.area}|${w.kundli_id_area_as_of.as_of.toISOString()}`;
  const areaBuild = {
    findUnique: async ({ where }: { where: Parameters<typeof k>[0] }) => rows.get(k(where)) ?? null,
    upsert: async ({ where, create, update }: { where: Parameters<typeof k>[0]; create: { status: string; result: unknown }; update: { result: unknown } }) => {
      rows.set(k(where), rows.has(k(where)) ? { ...rows.get(k(where))!, ...update } : { status: create.status, result: create.result });
    },
  };
  return new Proxy({}, { get: (_t, p) => (p === 'areaBuild' ? areaBuild : undefined) }) as never;
}

function input(board: SelfCardId[]): CardsRunInput {
  return { ctx, frame, ledger, prefix: { text: prefix.text, keys: prefix.keys, hash: prefix.hash }, slices, board, portrait: null, sections: {}, dates: new Set([ASOF, ...frame.spans.flatMap((s) => [s.from, s.to])]), answers: '', model: 'gemini-3.8-flash', spentBeforeUsd: 0 };
}

const BOARD: SelfCardId[] = ['body', 'fitness', 'blood', 'stuck', 'diagnosis'];

const SELF3: SelfCardId[] = ['body', 'stuck', 'diagnosis'];
const LOVE2: CardId[] = ['dating_pulse', 'dating_delays_blocks'];
const saved = process.env.BOARDS_V3;
beforeEach(() => {
  process.env.BOARDS_V3 = 'love,work';
});
afterEach(() => {
  if (saved === undefined) delete process.env.BOARDS_V3;
  else process.env.BOARDS_V3 = saved;
});

/** every card cites its own ledger cells when it reads work_load_and_health, else the natal key */
const groupReply = (o: GeminiCallOptions, bad: ReadonlySet<string> = new Set()) => {
  const req = o.fullCache?.suffix[0] ?? o.parts[1]!;
  const ids = [...req.matchAll(/^- (\w+): matters/gm)].map((m) => m[1]!);
  const own = (id: string) => {
    const o2 = goodOracle(id);
    if (/- \w+: matters [^\n]*work_load_and_health/.test(req.split('\n').find((l) => l.startsWith(`- ${id}:`)) ?? '')) return o2;
    return { ...o2, spans: (o2.spans as Array<Record<string, unknown>>).map((x) => ({ ...x, evidence: ['planet:D1.Mo'] })) };
  };
  return ok(JSON.stringify({ cards: ids.filter((id) => !bad.has(id)).map((id) => ({ card: id, oracle: own(id), face: personal(id) })) }));
};

describe('one pack across boards (S4)', () => {
  it('3 Self cards and 2 queued Love cards: one pack cache, every brief once, 5 readings stored', async () => {
    const prisma = memPrisma();
    const now = new Date(`${ASOF}T12:00:00Z`);
    await updateCardsState(prisma, 'u1', 'k1', now, (d) => {
      for (const id of LOVE2) d.cards[id] = { state: 'queued', at: now.toISOString() };
    });
    const calls: GeminiCallOptions[] = [];
    const ensured: string[] = [];
    const r = await readCards(
      { prisma, callGemini: (async (o: GeminiCallOptions) => (calls.push(o), groupReply(o))) as never, now, capUsd: 5, readRest: false, groupPack: true, groupSizeBoard: 1, ensureCache: (async (_m: string, _s: string, b: string) => (ensured.push(b), 'cachedContents/x')) as never },
      { ...input(SELF3), packCards: [...LOVE2, 'friends_core_allies'] },
    );
    expect(ensured).toHaveLength(1);
    expect(new Set(calls.map((c) => c.fullCache!.prefix)).size).toBe(1);
    expect(Object.keys(r.cards).sort()).toEqual([...SELF3, ...LOVE2].sort());
    for (const id of [...SELF3, ...LOVE2, 'friends_core_allies']) expect(ensured[0]!.split(`## CARD BRIEF ${id}\n`).length - 1, id).toBe(1);
    expect(ensured[0]).toContain('Board: Love');
    // a pack-only card (not queued) is never read
    expect(r.order).not.toContain('friends_core_allies');
  });

  it('a Love card that fails fails alone; the Self cards stand', async () => {
    const prisma = memPrisma();
    const now = new Date(`${ASOF}T12:00:00Z`);
    await updateCardsState(prisma, 'u1', 'k1', now, (d) => {
      d.cards.dating_pulse = { state: 'queued', at: now.toISOString() };
    });
    const r = await readCards(
      { prisma, callGemini: (async (o: GeminiCallOptions) => groupReply(o, new Set(['dating_pulse']))) as never, now, capUsd: 5, readRest: false, groupPack: true, groupSizeBoard: 1, ensureCache: (async () => null) as never },
      input(SELF3),
    );
    expect(Object.keys(r.cards).sort()).toEqual([...SELF3].sort());
    expect(r.results.find((x) => x.card === 'dating_pulse')?.status).toBe('failed');
  });

  it('with BOARDS_V3 unset a queued Love card is not read and the pack is the Self pack', async () => {
    delete process.env.BOARDS_V3;
    const prisma = memPrisma();
    const now = new Date(`${ASOF}T12:00:00Z`);
    await updateCardsState(prisma, 'u1', 'k1', now, (d) => {
      d.cards.dating_pulse = { state: 'queued', at: now.toISOString() };
    });
    const ensured: string[] = [];
    const r = await readCards(
      { prisma, callGemini: (async (o: GeminiCallOptions) => groupReply(o)) as never, now, capUsd: 5, readRest: false, groupPack: true, ensureCache: (async (_m: string, _s: string, b: string) => (ensured.push(b), null)) as never },
      { ...input(SELF3), packCards: LOVE2 },
    );
    expect(r.order).toEqual(SELF3);
    expect(ensured[0]).not.toContain('dating_pulse');
  });
});

describe('a paid lens refresh forces its cards (docs/billing/03 per-lens refresh)', () => {
  /** memPrisma plus an in-memory technique_outputs keyed by cache_key */
  function storePrisma() {
    const base = memPrisma() as unknown as { areaBuild: unknown };
    const rows = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const techniqueOutput = {
      findUnique: async ({ where }: { where: { cache_key: string } }) => rows.get(where.cache_key) ?? null,
      upsert: async ({ where, create, update }: { where: { cache_key: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        rows.set(where.cache_key, rows.has(where.cache_key) ? { ...rows.get(where.cache_key), ...update } : { ...create });
      },
    };
    return new Proxy({}, { get: (_t, p) => (p === 'areaBuild' ? base.areaBuild : p === 'techniqueOutput' ? techniqueOutput : undefined) }) as never;
  }

  it('a queued card with an unchanged key is served from the store; with a force mark it is read again', async () => {
    const prisma = storePrisma();
    const now = new Date(`${ASOF}T12:00:00Z`);
    const calls: GeminiCallOptions[] = [];
    const run = () =>
      readCards(
        { prisma, callGemini: (async (o: GeminiCallOptions) => (calls.push(o), groupReply(o))) as never, now, capUsd: 5, readRest: false, groupPack: true, groupSizeBoard: 1, ensureCache: (async () => null) as never },
        input([]),
      );
    const queue = (force: boolean) =>
      updateCardsState(prisma, 'u1', 'k1', now, (d) => {
        d.cards.dating_pulse = { state: 'queued', at: now.toISOString() };
        if (force) d.force = { dating_pulse: now.toISOString() };
      });
    await queue(false);
    expect((await run()).results.find((x) => x.card === 'dating_pulse')?.status).toBe('ok');
    const first = calls.length;
    expect(first).toBeGreaterThan(0);
    // queued again (an open, a layout save): the same key is served, no call
    await queue(false);
    expect((await run()).results.find((x) => x.card === 'dating_pulse')?.status).toBe('cached');
    expect(calls.length).toBe(first);
    // a paid lens refresh: read again
    await queue(true);
    expect((await run()).results.find((x) => x.card === 'dating_pulse')?.status).toBe('ok');
    expect(calls.length).toBeGreaterThan(first);
  });

  it('the chain: a forced lens card read by the runner, then the build-end settle commits the question', async () => {
    const prisma = storePrisma();
    const now = new Date(`${ASOF}T12:00:00Z`);
    await updateCardsState(prisma, 'u1', 'k1', now, (d) => {
      d.cards.dating_pulse = { state: 'queued', at: now.toISOString() };
      d.force = { dating_pulse: now.toISOString() };
      d.lensRefresh = { 'love:dating': { at: now.toISOString(), cards: ['dating_pulse'] } };
    });
    const later = new Date(now.getTime() + 60_000);
    await readCards({ prisma, callGemini: (async (o: GeminiCallOptions) => groupReply(o)) as never, now: later, capUsd: 5, readRest: false, groupPack: true, groupSizeBoard: 1, ensureCache: (async () => null) as never }, input([]));
    const settled: unknown[][] = [];
    await settleLensRefreshes(prisma, 'u1', 'k1', new Date(later.getTime() + 60_000), { settleLensRefresh: async (...a: unknown[]) => void settled.push(a) } as never);
    expect(settled).toEqual([['u1', 'love', 'dating', ASOF, true]]);
  });
});

describe('the store id filter (S3)', () => {
  it('reads only the named cards, four rows each, newest wins', async () => {
    let seen: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    const prisma = {
      techniqueOutput: {
        findMany: async (q: unknown) => {
          seen = q;
          return [
            { output: { card: 'dating_pulse', content: { line: 'new' } }, created_at: new Date() },
            { output: { card: 'dating_pulse', content: { line: 'old' } }, created_at: new Date(0) },
          ];
        },
      },
    } as never;
    const out = await readCardReadings(prisma, 'k1', 'vimsottari', ['dating_pulse', 'job_pulse']);
    expect(out).toEqual({ dating_pulse: { line: 'new', chart: null } });
    expect(seen.take).toBe(8);
    expect(seen.where.OR).toEqual([{ digest_version: { startsWith: 'self.card|card=dating_pulse|' } }, { digest_version: { startsWith: 'self.card|card=job_pulse|' } }]);
    expect(seen.where.digest_version).toEqual({ contains: '|clock=vimsottari|' });
    expect(await readCardReadings(prisma, 'k1', 'vimsottari', [])).toEqual({});
  });
});
