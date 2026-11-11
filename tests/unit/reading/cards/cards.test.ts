/**
 * Doc 70 Phase 3: a reading per card (§4.1 layers 4–5, §7 steps 6–7). Briefs for the 21 Self cards, the card Oracle's
 * ledger checks, the queue (one call per card, in parallel, one cached prefix, the board titles, the spend cap, a
 * failed card alone) and the per-card state. Fake model and an in-memory store; no paid call, no database.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AgreedLedger, LedgerCell } from '../../../../src/reading/clocks/types.js';
import { sharedPrefix } from '../../../../src/reading/clocks/reader.js';
import { pickClockLayerSlices } from '../../../../src/reading/clocks/run.js';
import { boardReadingView, cardStateOf, readCardsState } from '../../../../src/reading/cards/state.js';
import { CARD_ORACLE_MAX_OUTPUT_TOKENS, checkAgainstLedger, precheckCard, readCardOracle, renderCardLedger } from '../../../../src/reading/cards/oracle.js';
import { cardOrder, readCards, type CardsRunInput } from '../../../../src/reading/cards/run.js';
import { emptyCardsState } from '../../../../src/reading/cards/types.js';
import type { GeminiCallOptions, GeminiResult } from '../../../../src/reading/llm/gemini.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import type { PressureInventoryDetail, PressureRowDetail } from '../../../../src/reading/self/sub/pressure.js';
import type { SelfBuildContext } from '../../../../src/reading/self/v2types.js';
import { isCardOffered, offeredCards, READABLE_CARDS, SELF_CARDS } from '../../../../src/reading/self/v3/cards.js';
import type { OracleCardV3, SelfCardId } from '../../../../src/reading/self/v3/types.js';
import { buildYearFrameV3 } from '../../../../src/reading/self/v3/yearFrame.js';
import { natalCoreFromPrefix } from '../../../../src/reading/slices/prepare.js';
import { renderSliceSet } from '../../../../src/reading/slices/render.js';

const ASOF = '2026-11-10';
const MATTERS = new Set(['self_and_body', 'money_in_hand', 'effort_and_courage', 'home_and_peace', 'ideas_and_children', 'work_load_and_health', 'partnership', 'sudden_and_hidden', 'luck_and_belief', 'career_and_standing', 'gains_and_network', 'loss_rest_and_distance']);

describe('the 21 Self cards', () => {
  it('every readable card has a brief, matters from the engine keys, and no engine name in any card prompt', () => {
    expect(READABLE_CARDS).toHaveLength(21);
    for (const id of READABLE_CARDS) {
      const brief = PROMPTS[`cards/self/${id}`];
      expect(brief, id).toBeTruthy();
      expect(brief).toContain(`CARD: \`${id}\``);
      const def = SELF_CARDS.find((c) => c.id === id)!;
      expect(def.matters.length, id).toBeGreaterThan(0);
      for (const m of def.matters) expect(MATTERS.has(m), `${id} ${m}`).toBe(true);
    }
    for (const [k, v] of Object.entries(PROMPTS)) if (k.startsWith('cards/')) expect(v, k).not.toMatch(/radha|pyjhora|jhora/i);
  });
  it('the Phase C cards are offered only while the per-card reading is on', () => {
    expect(offeredCards(false)).toHaveLength(11);
    expect(offeredCards(true)).toHaveLength(21);
    expect(isCardOffered(SELF_CARDS.find((c) => c.id === 'sleep')!, false)).toBe(false);
    expect(isCardOffered(SELF_CARDS.find((c) => c.id === 'constitution')!, true)).toBe(false);
  });
  it('the queue order: asked-for first, then the board, then the rest only with the flag', () => {
    const o = cardOrder(['body', 'mind', 'stuck', 'lagna', 'year'], ['sleep'], false);
    expect(o.first).toEqual(['sleep', 'body', 'mind', 'stuck', 'lagna', 'year']);
    expect(o.rest).toEqual([]);
    const r = cardOrder(['body', 'mind', 'stuck', 'lagna', 'year'], [], true);
    expect(r.rest).toHaveLength(16);
    expect(r.rest).not.toContain('constitution');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Fixtures: a frame from stored rows, a ledger, the slices and the shared prefix
// ---------------------------------------------------------------------------------------------------------------------

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

describe('the card Oracle checks against the ledger', () => {
  const card = (over: Partial<OracleCardV3['spans'][number]> = {}): OracleCardV3 =>
    ({ card: 'body', headline: 'x', spans: frame.spans.map((s) => ({ span: s.id, tone: s.tone, mode: s.tone === 'heavy' ? 'get_through' : 'build', asks: 'a', obstacle: 'o', evidence: [`ledger:${s.id}/work_load_and_health`], agreement: '', ...over })), confirm: null, gift: 'g', knot: 'k', pattern: null, certainty: 'likely', evidence: [] }) as OracleCardV3;
  it('a span that cites none of its cells, and build without agreed ground, are rejected', () => {
    expect(checkAgainstLedger(card(), frame, ledger.cells)).toEqual([]);
    expect(checkAgainstLedger(card({ evidence: ['planet:D1.Mo'] }), frame, ledger.cells).join(' ')).toMatch(/cites none of this card's ledger cells/);
    const single = ledger.cells.map((c) => ({ ...c, status: 'single' as const }));
    const lightSpan = frame.spans.find((s) => s.tone !== 'heavy')!;
    const probs = checkAgainstLedger(card(), { ...frame, spans: frame.spans.map((s) => (s.id === lightSpan.id ? { ...s, tone: 'mixed' as const } : s)) }, single);
    expect(probs.join(' ')).toMatch(new RegExp(`span ${lightSpan.id}: build needs`));
  });
  it('renders the ledger cells with their counted status', () => {
    expect(renderCardLedger(ledger.cells).text).toContain(`{ledger:s1/work_load_and_health} status=confirmed tone=heavy agree=3/4`);
  });
});

describe('readCards with a fake model', () => {
  afterEach(() => {
    delete process.env.CARDS_READ_REST;
  });

  it('one Oracle and one Personalizer call per card, all at once, one cached prefix, the board named; state done', async () => {
    const prisma = memPrisma();
    const calls: GeminiCallOptions[] = [];
    let open = 0;
    let maxOpen = 0;
    const callGemini = async (o: GeminiCallOptions) => {
      calls.push(o);
      maxOpen = Math.max(maxOpen, ++open);
      await new Promise((r) => setTimeout(r, 5));
      open--;
      const text = o.parts.join('\n');
      if (o.node.startsWith('self.card.oracle')) {
        const id = /THIS CALL: write only the card `(\w+)`/.exec(text)![1]!;
        return ok(JSON.stringify({ cards: [goodOracle(id)] }));
      }
      const id = /## WRITE[^\n]*\n- (\w+):/.exec(text)![1]!;
      return ok(JSON.stringify({ cards: [personal(id)] }));
    };
    const r = await readCards({ prisma, callGemini: callGemini as never, now: new Date(`${ASOF}T12:00:00Z`), capUsd: 1, readRest: false }, input(BOARD));
    expect(r.issues.filter((x) => x.check !== 'other')).toEqual([]);
    expect(Object.keys(r.cards).sort()).toEqual([...BOARD].sort());
    const oracles = calls.filter((c) => c.node.startsWith('self.card.oracle'));
    expect(oracles).toHaveLength(5);
    expect(calls.filter((c) => c.node.startsWith('self.personalizer'))).toHaveLength(5);
    expect(maxOpen).toBeGreaterThanOrEqual(5);
    expect(new Set(oracles.map((c) => c.parts[0])).size).toBe(1);
    expect(oracles[0]!.parts[0]).toBe(prefix.text);
    expect(oracles.every((c) => c.cachePrefix && c.cacheOwner?.kundliId === 'k1')).toBe(true);
    expect(oracles[0]!.parts[1]).toContain('THE BOARD');
    expect(oracles[0]!.parts[1]).toContain('Fitness & strength');
    expect(oracles[0]!.parts[1]).not.toMatch(/radha|pyjhora/i);
    const body = r.cards.body!;
    expect(body.spans[0]!.agreement).toEqual({ agree: frame.spans[0]!.agree, of: frame.spans[0]!.of });
    expect(body.spans[0]!.clocks!.map((c) => c.system)).toEqual(frame.spans[0]!.clocks.map((c) => c.system));
    const doc = await readCardsState(prisma, 'k1', new Date(`${ASOF}T12:00:00Z`));
    for (const id of BOARD) expect(doc.cards[id]?.state).toBe('done');
    expect(doc.spentUsd).toBeGreaterThan(0);
  });

  it('a failed card fails alone, after one repair; the others stand', async () => {
    const prisma = memPrisma();
    const nodes: string[] = [];
    const callGemini = async (o: GeminiCallOptions) => {
      nodes.push(o.node);
      const text = o.parts.join('\n');
      if (o.node.startsWith('self.card.oracle')) {
        const id = /THIS CALL: write only the card `(\w+)`/.exec(text)![1]!;
        if (id === 'stuck') throw new Error('model down');
        return ok(JSON.stringify({ cards: [goodOracle(id)] }));
      }
      const id = /## WRITE[^\n]*\n- (\w+):/.exec(text)![1]!;
      return ok(JSON.stringify({ cards: [personal(id)] }));
    };
    const r = await readCards({ prisma, callGemini: callGemini as never, now: new Date(`${ASOF}T12:00:00Z`), capUsd: 1, readRest: false }, input(BOARD));
    expect(Object.keys(r.cards)).toHaveLength(4);
    expect(nodes.filter((n) => n.startsWith('self.card.oracle.stuck'))).toEqual(['self.card.oracle.stuck', 'self.card.oracle.stuck.repair']);
    const doc = await readCardsState(prisma, 'k1', new Date(`${ASOF}T12:00:00Z`));
    expect(doc.cards.stuck?.state).toBe('failed');
    expect(cardStateOf(doc, 'stuck', false, new Date(`${ASOF}T12:00:00Z`))).toBe('failed');
    expect(cardStateOf(doc, 'body', true, new Date(`${ASOF}T12:00:00Z`))).toBe('ready');
  });

  it('the spend cap stops the queue: the rest stay not read, no call is made for them', async () => {
    const prisma = memPrisma();
    let n = 0;
    const callGemini = async (o: GeminiCallOptions) => {
      n++;
      const text = o.parts.join('\n');
      if (o.node.startsWith('self.card.oracle')) return ok(JSON.stringify({ cards: [goodOracle(/THIS CALL: write only the card `(\w+)`/.exec(text)![1]!)] }));
      return ok(JSON.stringify({ cards: [personal(/## WRITE[^\n]*\n- (\w+):/.exec(text)![1]!)] }));
    };
    const r = await readCards({ prisma, callGemini: callGemini as never, now: new Date(`${ASOF}T12:00:00Z`), capUsd: 0.000001, readRest: true, boardParallel: 1 }, input(BOARD));
    expect(r.capReached).toBe(true);
    expect(Object.keys(r.cards)).toHaveLength(1);
    expect(n).toBe(2);
    expect(r.results.filter((x) => x.status === 'skipped_cap').length).toBe(r.order.length - 1);
    const doc = await readCardsState(prisma, 'k1', new Date(`${ASOF}T12:00:00Z`));
    expect(doc.capReached).toBe(true);
    expect(cardStateOf(doc, 'fitness', false, new Date(`${ASOF}T12:00:00Z`))).toBe('not_read');
  });
});

describe('per-card state for the page', () => {
  const now = new Date('2026-11-10T12:00:00Z');
  it('queued and reading show while fresh; a stuck one reads failed; a stored reading is ready', () => {
    const d = emptyCardsState();
    d.cards.body = { state: 'reading', at: '2026-11-10T11:59:00Z' };
    d.cards.mind = { state: 'queued', at: '2026-11-10T11:00:00Z' };
    d.cards.stuck = { state: 'failed', at: '2026-11-10T11:00:00Z' };
    expect(cardStateOf(d, 'body', false, now)).toBe('reading');
    expect(cardStateOf(d, 'mind', false, now)).toBe('failed');
    expect(cardStateOf(d, 'stuck', true, now)).toBe('ready');
    expect(cardStateOf(d, 'year', false, now)).toBe('not_read');
    d.stage = 'cards';
    const v = boardReadingView(d, ['body', 'mind', 'stuck'], { stuck: {} as never }, now, true);
    expect(v).toMatchObject({ enabled: true, stage: 'cards', done: 1, total: 3 });
  });
});

describe('the card Oracle input and the pre-check (doc 70 Phase 3 replay fixes)', () => {
  const groundedLedger: AgreedLedger = { ...ledger, cells: ledger.cells.map((c) => ({ ...c, evidence: ['pressure:dasha:vimsottari/3/Sa@2026-10-01', 'pressure:dasha:vimsottari/3/Ju@2027-01-01'] })) };
  const oracleInput = (over: Record<string, unknown> = {}) => ({
    ctx,
    card: 'body' as SelfCardId,
    matters: ['work_load_and_health'] as never,
    board: ['Body & energy'],
    frame,
    frameText: 'YEAR FRAME',
    frameKeys: [],
    prefix: { text: prefix.text, keys: prefix.keys },
    ledger: groundedLedger,
    matterSlices: slices.filter((s) => s.id === 'matter.work_load_and_health'),
    dates: new Set([ASOF, ...frame.spans.flatMap((s) => [s.from, s.to])]),
    answers: '',
    model: 'gemini-3.8-flash',
    cacheOwner: { userId: 'u1', kundliId: 'k1' },
    ...over,
  });

  it('the matter rows: each row once, only rows overlapping the frame, rows of the shared prefix by key; a 4 k output cap', async () => {
    const seen: GeminiCallOptions[] = [];
    const callGemini = async (o: GeminiCallOptions) => (seen.push(o), ok(JSON.stringify({ cards: [goodOracle('body')] })));
    const r = await readCardOracle({ prisma: memPrisma(), callGemini: callGemini as never }, oracleInput() as never);
    expect(r.status).toBe('ok');
    const part = seen[0]!.parts[1]!;
    const block = part.slice(part.indexOf('MATTER ROWS ('), part.lastIndexOf("PERSON'S ANSWERS"));
    const from = frame.spans[0]!.from;
    for (const m of block.matchAll(/^\{(pressure:[^}]+)\} .*?(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/gm)) {
      expect(m[3]! > from, m[1]).toBe(true);
      expect(prefix.keys).not.toContain(m[1]);
    }
    // the annual row is in the shared prefix: named by key, not written again
    expect(block).toContain('## in the shared data above');
    expect(block).toContain('{pressure:annual:TP2026}');
    expect(block).not.toMatch(/^\{pressure:annual:TP2026\} kind=/m);
    expect(seen[0]!.maxOutputTokens).toBe(CARD_ORACLE_MAX_OUTPUT_TOKENS);
  });

  it("a key never given to the card is dropped in code: no repair call (the replay's chapter)", async () => {
    const nodes: string[] = [];
    const bad = goodOracle('body') as { spans: Array<{ evidence: string[] }>; evidence: string[] };
    bad.spans[0]!.evidence.push('pressure:dasha:chathuraaseethi_sama/2/Ma@2025-11-03');
    bad.evidence.push('pressure:dasha:chathuraaseethi_sama/2/Ma@2025-11-03');
    const callGemini = async (o: GeminiCallOptions) => (nodes.push(o.node), ok(JSON.stringify({ cards: [bad] })));
    const r = await readCardOracle({ prisma: memPrisma(), callGemini: callGemini as never }, oracleInput() as never);
    expect(r.status).toBe('ok');
    expect(nodes).toEqual(['self.card.oracle.body']);
    expect(r.card!.spans[0]!.evidence).not.toContain('pressure:dasha:chathuraaseethi_sama/2/Ma@2025-11-03');
    expect(r.issues.some((x) => /precheck: span s1: dropped key/.test(x.message))).toBe(true);
  });

  it("a span citing a row its cell rests on, but not the cell, gets the cell in code: no repair call (the replay's mind)", async () => {
    const nodes: string[] = [];
    const bare = goodOracle('body') as { spans: Array<{ span: string; evidence: string[] }> };
    for (const sp of bare.spans) sp.evidence = ['pressure:dasha:vimsottari/3/Sa@2026-10-01'];
    const callGemini = async (o: GeminiCallOptions) => (nodes.push(o.node), ok(JSON.stringify({ cards: [bare] })));
    const r = await readCardOracle({ prisma: memPrisma(), callGemini: callGemini as never }, oracleInput() as never);
    expect(r.status).toBe('ok');
    expect(nodes).toEqual(['self.card.oracle.body']);
    for (const sp of r.card!.spans) expect(sp.evidence).toContain(`ledger:${sp.span}/work_load_and_health`);
  });

  it('the pre-check never grounds a span on a planet or house key alone, and never strips a span to nothing', () => {
    const cells = groundedLedger.cells.map((c) => ({ ...c, evidence: [...c.evidence, 'planet:D1.Mo'] }));
    const raw = { spans: [{ span: 's1', evidence: ['planet:D1.Mo'] }, { span: 's2', evidence: ['made:up'] }], evidence: ['made:up'] };
    const r = precheckCard(raw, { allowed: new Set(['planet:D1.Mo']), cells });
    const spans = (r.raw as typeof raw).spans;
    expect(spans[0]!.evidence).toEqual(['planet:D1.Mo']);
    expect(spans[1]!.evidence).toEqual(['made:up']);
    expect((r.raw as typeof raw).evidence).toEqual([]);
    // the validator still rejects both spans, so the repair call stays the path for them
    expect(raw.spans[1]!.evidence).toEqual(['made:up']);
  });

  it('a card with no grounding at all still goes to one repair call', async () => {
    const nodes: string[] = [];
    const bare = goodOracle('body') as { spans: Array<{ evidence: string[] }> };
    for (const sp of bare.spans) sp.evidence = ['planet:D1.Mo'];
    const callGemini = async (o: GeminiCallOptions) => (nodes.push(o.node), ok(JSON.stringify({ cards: [nodes.length > 1 ? goodOracle('body') : bare] })));
    const r = await readCardOracle({ prisma: memPrisma(), callGemini: callGemini as never }, oracleInput() as never);
    expect(nodes).toEqual(['self.card.oracle.body', 'self.card.oracle.body.repair']);
    expect(r.status).toBe('repaired');
  });
});

describe('cards in groups on one cached pack (doc 71)', () => {
  const groupReply = (o: GeminiCallOptions, bad: ReadonlySet<string> = new Set()) => {
    const req = o.fullCache?.suffix[0] ?? o.parts[1]!;
    const ids = [...req.matchAll(/^- (\w+): matters/gm)].map((m) => m[1]!);
    // a card cites only its own ledger cells (the fixture ledger holds work_load_and_health only); others cite the natal key
    const own = (id: string) => {
      const o = goodOracle(id);
      if ((SELF_CARDS.find((c) => c.id === id)?.matters as readonly string[] | undefined)?.includes('work_load_and_health')) return o;
      return { ...o, spans: (o.spans as Array<Record<string, unknown>>).map((x) => ({ ...x, evidence: ['planet:D1.Mo'] })) };
    };
    return ok(JSON.stringify({ cards: ids.map((id) => ({ card: id, oracle: own(id), face: bad.has(id) && !req.startsWith('REPAIR') ? { ...personal(id), line: 'Saturn presses on you.' } : personal(id) })) }));
  };

  it('the pack holds every card brief, each matter row once, and the same bytes on every call', async () => {
    const { buildCardPack } = await import('../../../../src/reading/cards/group.js');
    const cards = [...BOARD, 'mind', 'sleep'] as SelfCardId[];
    const base = { ctx, cards, frame, frameText: 'FRAME', frameKeys: [], prefix: { text: prefix.text, keys: prefix.keys }, ledger, slices, portrait: null, answers: '' };
    const a = buildCardPack(base);
    const b = buildCardPack(base);
    expect(a.text).toBe(b.text);
    expect(a.hash).toBe(b.hash);
    for (const id of cards) expect(a.text).toContain(`## CARD BRIEF ${id}`);
    const rowLines = a.text.split('\n').filter((l) => /^\s*-?\s*\{dasha:/.test(l));
    expect(new Set(rowLines).size).toBe(rowLines.length);
    expect(a.system).toContain('ROLE: CARD GROUP');
    expect(a.system).toContain('ROLE: PERSONALIZER');
    expect(a.text).not.toMatch(/radha|pyjhora/i);
  });

  it('the board goes first in groups of three, the rest after in groups of six; one pack, cached once', async () => {
    const prisma = memPrisma();
    const calls: GeminiCallOptions[] = [];
    const ensured: string[] = [];
    let boardDoneAt = -1;
    const callGemini = async (o: GeminiCallOptions) => {
      calls.push(o);
      await new Promise((r) => setTimeout(r, 5));
      if (o.node.startsWith('self.card.group.board')) boardDoneAt = calls.length;
      return groupReply(o);
    };
    const r = await readCards(
      { prisma, callGemini: callGemini as never, now: new Date(`${ASOF}T12:00:00Z`), capUsd: 5, readRest: true, groupPack: true, groupSizeBoard: 3, groupSizeRest: 6, ensureCache: (async (_m: string, _s: string, base: string) => (ensured.push(base), 'cachedContents/x')) as never },
      input(BOARD),
    );
    expect(r.issues.filter((x) => x.check !== 'other')).toEqual([]);
    expect(Object.keys(r.cards).length).toBe(r.order.length);
    const board = calls.filter((c) => c.node.startsWith('self.card.group.board'));
    const rest = calls.filter((c) => c.node.startsWith('self.card.group.rest'));
    expect(board).toHaveLength(2);
    expect(rest).toHaveLength(Math.ceil((r.order.length - BOARD.length) / 6));
    expect(calls.indexOf(rest[0]!)).toBeGreaterThanOrEqual(boardDoneAt - 1);
    expect(new Set(calls.map((c) => c.fullCache!.prefix)).size).toBe(1);
    expect(ensured).toHaveLength(1);
    expect(calls.every((c) => !c.node.startsWith('self.personalizer') && !c.node.startsWith('self.card.oracle'))).toBe(true);
    const boardIds = board.flatMap((c) => [...c.fullCache!.suffix[0]!.matchAll(/^- (\w+): matters/gm)].map((m) => m[1]));
    expect(boardIds.sort()).toEqual([...BOARD].sort());
  });

  it('a card whose face fails the checks is asked again once, alone with its reasons', async () => {
    const prisma = memPrisma();
    const calls: GeminiCallOptions[] = [];
    const callGemini = async (o: GeminiCallOptions) => (calls.push(o), groupReply(o, new Set(['fitness'])));
    const r = await readCards({ prisma, callGemini: callGemini as never, now: new Date(`${ASOF}T12:00:00Z`), capUsd: 5, readRest: false, groupPack: true, ensureCache: (async () => null) as never }, input(BOARD));
    expect(Object.keys(r.cards).sort()).toEqual([...BOARD].sort());
    const repair = calls.filter((c) => c.node.endsWith('.repair'));
    expect(repair).toHaveLength(1);
    expect(repair[0]!.fullCache!.suffix[0]).toMatch(/^REPAIR[\s\S]*- fitness: face:/);
    expect(repair[0]!.fullCache!.suffix[0]).not.toMatch(/^- body: matters/m);
  });

  it('cards whose store lookups arrive far apart still go out together (the 2026-11-11 replay sent each alone)', async () => {
    const base = memPrisma() as unknown as { areaBuild: { findUnique: (a: unknown) => Promise<unknown>; upsert: (a: unknown) => Promise<unknown> } };
    let k = 0;
    const slow = { findUnique: async (a: unknown) => (await new Promise((r) => setTimeout(r, 40 * (k++ % 5))), base.areaBuild.findUnique(a)), upsert: base.areaBuild.upsert };
    const prisma = new Proxy({}, { get: (_t, p) => (p === 'areaBuild' ? slow : undefined) }) as never;
    const calls: GeminiCallOptions[] = [];
    const callGemini = async (o: GeminiCallOptions) => (calls.push(o), groupReply(o));
    const r = await readCards({ prisma, callGemini: callGemini as never, now: new Date(`${ASOF}T12:00:00Z`), capUsd: 5, readRest: true, groupPack: true, groupSizeBoard: 1, groupSizeRest: 6, ensureCache: (async () => null) as never }, input(BOARD));
    expect(Object.keys(r.cards).length).toBe(r.order.length);
    expect(calls.filter((c) => c.node.startsWith('self.card.group.board'))).toHaveLength(BOARD.length);
    expect(calls.filter((c) => c.node.startsWith('self.card.group.rest'))).toHaveLength(Math.ceil((r.order.length - BOARD.length) / 6));
  });
});
