/**
 * Card chat fixtures (docs/reading-engine/85): a frame, slices and ledger from stored-row fixtures (the same shape the
 * card runner reads, as in tests/unit/reading/cards/cards.test.ts), a stored card row keyed on that prefix and ledger, and
 * board bodies for You, Love and Work as the board reads return them. No database, no model.
 */
import type { AgreedLedger, LedgerCell } from '../../../../src/reading/clocks/types.js';
import { sharedPrefix } from '../../../../src/reading/clocks/reader.js';
import { pickClockLayerSlices } from '../../../../src/reading/clocks/run.js';
import { LAYER_CACHE_SLICE_ID } from '../../../../src/reading/clocks/layerCache.js';
import type { StoredCardReading } from '../../../../src/reading/cards/types.js';
import { ledgerGroundingHash } from '../../../../src/reading/cardChat/resolve.js';
import type { CardChatResolveDeps } from '../../../../src/reading/cardChat/resolve.js';
import type { PressureInventoryDetail, PressureRowDetail } from '../../../../src/reading/self/sub/pressure.js';
import type { ProfilePack } from '../../../../src/reading/self/v2types.js';
import type { OracleCardV3, SelfV3CardContent } from '../../../../src/reading/self/v3/types.js';
import { buildYearFrameV3 } from '../../../../src/reading/self/v3/yearFrame.js';
import { natalCoreFromPrefix } from '../../../../src/reading/slices/prepare.js';
import { renderSliceSet } from '../../../../src/reading/slices/render.js';
import type { RenderedSlice } from '../../../../src/reading/slices/types.js';

export const ASOF = '2026-11-10';
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
export const frame = buildYearFrameV3({ asOf: ASOF, clock: { primary: 'vimsottari', confirming: [], applicable: [], notApplicable: [] }, primary, others: [{ system: 'narayana', inventory: nar }, { system: 'yogini', inventory: yog }], year: null, minClocks: 3 });
export const slices: RenderedSlice[] = [
  natalCoreFromPrefix('# NATAL\n{planet:D1.Mo} {house:D1.h6}', 'd1'),
  ...renderSliceSet({ frame, inventories: [{ system: 'vimsottari', inventory: primary }, { system: 'narayana', inventory: nar }, { system: 'yogini', inventory: yog }] }),
];
export const prefix = sharedPrefix(pickClockLayerSlices(slices).picked!.shared);

const cell = (span: string, tone: 'heavy' | 'light'): LedgerCell => ({
  id: `ledger:${span}/work_load_and_health`,
  span,
  matter: 'work_load_and_health',
  status: 'confirmed',
  tone,
  agree: 3,
  of: 4,
  clocks: [],
  sentence: `The clocks agree: ${tone}.`,
  sides: null,
  evidence: ['pressure:dasha:vimsottari/3/Sa@2026-10-01'],
});
export const ledger: AgreedLedger = {
  frameHash: 'f',
  sheetHashes: {},
  cells: [...frame.spans.map((s) => cell(s.id, s.tone === 'heavy' ? 'heavy' : 'light')), { ...cell('s1', 'heavy'), id: 'ledger:s1/partnership', matter: 'partnership' }],
  pairs: [],
  byStatus: { confirmed: frame.spans.length + 1, leaning: 0, single: 0, contested: 0 },
};

/** a row of a matter slice the Oracle cites (not in the shared prefix) */
export const CITED_ROW_KEY = 'pressure:dasha:vimsottari/3/Sa@2026-10-01';

export const oracle = (card: string): OracleCardV3 =>
  ({
    card,
    headline: 'A heavy stretch, then room to build.',
    spans: frame.spans.map((s) => ({ span: s.id, tone: s.tone, mode: s.tone === 'heavy' ? 'get_through' : 'build', asks: 'Hold the load.', obstacle: 'Late work.', evidence: [`ledger:${s.id}/work_load_and_health`, CITED_ROW_KEY], agreement: 'three of four agree' })),
    confirm: { claimId: `${card}.tired_spring`, text: 'You felt worn out in spring 2026.', from: '2026-03-01', to: '2026-05-31' },
    gift: 'stamina',
    knot: 'overwork',
    pattern: null,
    certainty: 'likely',
    evidence: ['planet:D1.Mo'],
  }) as OracleCardV3;

export const content: SelfV3CardContent = {
  line: 'Guard your evenings until 1 Jan 2027.',
  spans: [
    { span: 's1', from: '2026-10-01', to: '2027-01-01', tone: 'heavy', mode: 'get_through', asks: 'Guard your evenings.', obstacle: 'Working late.', step: 'If it is past ten, then stop and rest.', held: true, agreement: { agree: 3, of: 4 } },
    { span: 's2', from: '2027-01-01', to: '2028-01-10', tone: 'light', mode: 'build', asks: 'Build steady habits.', obstacle: 'Old routines.', step: 'If a morning is free, then walk.', held: true, agreement: { agree: 3, of: 4 } },
  ],
  confirm: { claimId: 'body.tired_spring', text: 'Did you feel worn out in spring 2026?' },
  pattern: null,
  ladder: null,
  agreement: { agree: 3, of: 4 },
};

export const PERIODS = [
  { id: 'p1', name: 'Heavy stretch', label: 'Heavy stretch · 1 Oct 2026 – 1 Jan 2027', from: '2026-10-01', to: '2027-01-01', headline: 'Guard your evenings.', text: ['Working late.', 'If it is past ten, then stop and rest.'], tone: 'heavy', current: true, passed: false, span: 's1' },
  { id: 'p2', name: 'Lighter stretch', label: 'Lighter stretch · 1 Jan 2027 – 10 Jan 2028', from: '2027-01-01', to: '2028-01-10', headline: 'Build steady habits.', text: ['Old routines.', 'If a morning is free, then walk.'], tone: 'light', current: false, passed: false, span: 's2' },
];
export const KEY_DATES = [
  { date: '2027-01-01', label: 'Heavy stretch ends', tone: 'heavy', passed: false },
  { date: '2028-01-10', label: 'Lighter stretch ends', tone: 'light', passed: false },
];

/** one card view as the board read returns it (features applied) */
export function view(id: string, title: string, over: Record<string, unknown> = {}) {
  return { id, title, subtitle: `What ${title} answers`, locked: null, features: { 'feature.card_chat': { locked: false } }, periods: PERIODS, keyDates: KEY_DATES, v3: content, v2: null, ...over };
}

/** a board body as getSelfV3 / getBoardV3 return it (only the fields the resolver reads) */
export function body(cards: Array<ReturnType<typeof view>>, layout: string[]) {
  return { status: 'ok', clock: { system: 'vimsottari' }, layout: { cards: layout }, cards } as never;
}

export const storedKey = (card: string, pre = prefix.hash) => `self.card|card=${card}|clock=vimsottari|frame=x|ledger=y|pre=${pre}|profile=-|portrait=-|sections=-|confirm=-|p=z|`;

export function stored(card: string, pre = prefix.hash): StoredCardReading {
  return { key: storedKey(card, pre), card: card as never, content, oracle: oracle(card), personal: { card: card as never, line: content.line, spans: [], confirm: null, pattern: null, ladder: null }, ledgerHash: ledgerGroundingHash(ledger), frameHash: 'x' };
}

/** the stored slices the context reads: the shared prefix, the clock layer entry, the card's matter slice */
export function storedSlices(): Record<string, RenderedSlice> {
  const by: Record<string, RenderedSlice> = {};
  for (const s of slices) by[s.id] = s;
  by[LAYER_CACHE_SLICE_ID] = { id: LAYER_CACHE_SLICE_ID, text: JSON.stringify({ v: 1, key: 'k', asOf: ASOF, status: 'ok', sheets: [], ledger }), keys: [], estTokens: 0, sources: [], hash: 'k' };
  // a cited row not in the shared prefix
  by['matter.work_load_and_health'] = { ...(by['matter.work_load_and_health'] ?? { id: 'matter.work_load_and_health', keys: [], estTokens: 0, sources: [], hash: 'm' }), text: `# MATTER work_load_and_health\n{${CITED_ROW_KEY}} kind=dasha 2026-10-01..2027-01-01 tone=heavy\n{pressure:other} kind=dasha 2027-01-01..2028-01-10 tone=light` };
  return by;
}

export const profile: ProfilePack = { ageBand: '36_45', ageYears: 40, gender: null, role: 'public', facts: { work: { status: 'employed' } }, declined: [], lastConfirms: [], mood: null, hash: 'ph' } as unknown as ProfilePack;

/** resolver seams over the fixture bodies */
export function resolveSeams(bodies: { self?: unknown; love?: unknown; work?: unknown }, over: Partial<CardChatResolveDeps> = {}): Omit<CardChatResolveDeps, 'prisma'> {
  return {
    now: () => new Date(`${ASOF}T12:00:00Z`),
    boards: ['love', 'work'],
    readSelf: async () => bodies.self as never,
    readBoard: async (_p, _u, b) => bodies[b] as never,
    kundliOf: async (_p, userId) => (userId === 'u1' ? 'k1' : null),
    readStored: async (_p, _k, _c, id) => stored(id),
    readSlices: async () => storedSlices() as never,
    loadProfile: async () => profile,
    ...over,
  };
}
