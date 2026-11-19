/**
 * docs/dashboards/14: Love and Work cards read their own boards' techniques. The pack of a Self-only run is unchanged;
 * a run with Love (Work) cards carries `# BOARD TECHNIQUES: LOVE` (`WORK`) with citable keys; the prompts name each
 * card's board; the optional `why` never refuses a card. Fake digest, no model, no database.
 */
import { describe, expect, it } from 'vitest';
import type { AgreedLedger, LedgerCell } from '../../../../src/reading/clocks/types.js';
import { sharedPrefix } from '../../../../src/reading/clocks/reader.js';
import { pickClockLayerSlices } from '../../../../src/reading/clocks/run.js';
import { buildCardPack, cardPackSystem, groupRequest, groupSchema } from '../../../../src/reading/cards/group.js';
import { cardInstruction, precheckCard } from '../../../../src/reading/cards/oracle.js';
import { cardBoardLabel } from '../../../../src/reading/cards/registry.js';
import { CARD_TECHNIQUES, cardTechniqueKeys, renderBoardTechniques, techniqueBoardsOf, techniqueStamp} from '../../../../src/reading/cards/techniques.js';
import { BOARD_V3_CARDS } from '../../../../src/reading/boards/v3Cards.js';
import { LOVE } from '../../../../src/reading/area/love.js';
import { WORK } from '../../../../src/reading/area/work.js';
import type { ActivationRow } from '../../../../src/reading/digest/activation.js';
import type { DigestView, HouseCard, PlanetCard } from '../../../../src/reading/digest/types.js';
import { PROMPTS } from '../../../../src/reading/prompts/generated.js';
import type { PressureInventoryDetail, PressureRowDetail } from '../../../../src/reading/self/sub/pressure.js';
import type { SelfBuildContext } from '../../../../src/reading/self/v2types.js';
import { checkOracleCard } from '../../../../src/reading/self/v3/oracle.js';
import { checkPersonalCard, personalizerV3Schema, personalizerV3Suffix } from '../../../../src/reading/self/v3/personalizer.js';
import { cardContent } from '../../../../src/reading/self/v3/store.js';
import type { CardId, OracleCardV3 } from '../../../../src/reading/self/v3/types.js';
import { buildYearFrameV3 } from '../../../../src/reading/self/v3/yearFrame.js';
import { natalCoreFromPrefix } from '../../../../src/reading/slices/prepare.js';
import { renderSliceSet } from '../../../../src/reading/slices/render.js';

// ------------------------------------------------------------------------------------------------- a frame and a ledger
const ASOF = '2026-11-10';
const M = ['work_load_and_health'];
const row = (id: string, level: number | undefined, polarity: PressureRowDetail['polarity'], from: string, to: string): PressureRowDetail =>
  ({ id, kind: 'dasha', ...(level ? { level } : {}), planet: 'X', housesTouched: [6], matters: M, polarity, strength: 2, from, to, evidence: [id], houseFromMoon: null, reasons: [] }) as PressureRowDetail;
const inv = (clock: string, rows: PressureRowDetail[]): PressureInventoryDetail => ({ kundliId: 'k1', clock, asOf: ASOF, from: '2023-11-10', to: '2029-11-10', rows, boundaries: [], calcVersion: '2' });
const primary = inv('vimsottari', [row('dasha:vimsottari/3/Sa@2026-10-01', 3, 'presses', '2026-10-01', '2027-01-01'), row('dasha:vimsottari/3/Ju@2027-01-01', 3, 'supports', '2027-01-01', '2028-01-10')]);
const nar = inv('narayana', [row('dasha:narayana/3/Le@2026-08-01', 3, 'presses', '2026-08-01', '2027-01-01'), row('dasha:narayana/3/Vi@2027-01-01', 3, 'supports', '2027-01-01', '2028-02-01')]);
const yog = inv('yogini', [row('dasha:yogini/3/Ma@2026-08-01', 3, 'presses', '2026-08-01', '2027-01-01'), row('dasha:yogini/3/Ve@2027-01-01', 3, 'supports', '2027-01-01', '2028-02-01')]);
const frame = buildYearFrameV3({ asOf: ASOF, clock: { primary: 'vimsottari', confirming: [], applicable: [], notApplicable: [] }, primary, others: [{ system: 'narayana', inventory: nar }, { system: 'yogini', inventory: yog }], year: null, minClocks: 3 });
const slices = [natalCoreFromPrefix('# NATAL\n{planet:D1.Mo} {house:D1.h6}', 'd1'), ...renderSliceSet({ frame, inventories: [{ system: 'vimsottari', inventory: primary }, { system: 'narayana', inventory: nar }, { system: 'yogini', inventory: yog }] })];
const prefix = sharedPrefix(pickClockLayerSlices(slices).picked!.shared);
const cell = (span: string, tone: 'heavy' | 'light'): LedgerCell => ({ id: `ledger:${span}/work_load_and_health`, span, matter: 'work_load_and_health', status: 'confirmed', tone, agree: 3, of: 4, clocks: [], sentence: `The clocks agree: ${tone}.`, sides: null, evidence: [] });
const ledger: AgreedLedger = { frameHash: 'f', sheetHashes: {}, cells: frame.spans.map((s) => cell(s.id, s.tone === 'heavy' ? 'heavy' : 'light')), pairs: [], byStatus: { confirmed: frame.spans.length, leaning: 0, single: 0, contested: 0 } };
const ctx = {
  userId: 'u1',
  kundliId: 'k1',
  asOf: ASOF,
  stamps: { digestVersion: 'd1', clock: 'vimsottari', mainPeriod: null, subPeriod: null, subSubPeriod: null, skyWeek: null, year: null, profileHash: 'ph', confirmHash: null },
  sub: { profile: { ageBand: '36_45', ageYears: 40, gender: null, role: 'public', facts: {}, declined: [], lastConfirms: [], mood: null, hash: 'ph' } },
} as unknown as SelfBuildContext;

// ------------------------------------------------------------------------------------------------- a fake digest
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const LORDS = ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'];
const CLASS: Record<number, string[]> = { 1: ['kendra', 'trikona'], 4: ['kendra'], 5: ['trikona'], 6: ['dusthana'], 7: ['kendra'], 8: ['dusthana'], 9: ['trikona'], 10: ['kendra'], 12: ['dusthana'] };
const house = (varga: string, h: number): HouseCard => ({
  varga,
  house: h,
  sign: SIGNS[h - 1]!,
  lord: LORDS[h - 1]!,
  lordHouse: h === 7 ? 10 : h === 10 ? 8 : h,
  lordSign: null,
  lordDignity: h === 7 && varga === 'D9' ? 'own' : h === 10 ? 'debilitated' : null,
  coLord: null,
  occupants: h === 7 ? [{ planet: 'Ju', dignity: 'friend', nature: 'benefic' }] : h === 6 ? [{ planet: 'Sa', dignity: null, nature: 'malefic' }] : [],
  aspectedGraha: h === 5 ? ['Ju'] : [],
  aspectedRasi: [],
  argala: null,
  sav: h === 11 ? 30 : 25,
  class: CLASS[h] ?? [],
  cuspStar: null,
  arudha: null,
});
const planet = (varga: string, p: string): PlanetCard =>
  ({ varga, planet: p, sign: 'Leo', house: 5, star: null, dignity: p === 'Ve' ? 'exalted' : null, functional: p === 'Ju' || p === 'Ve' ? 'benefic' : p === 'Sa' ? 'malefic' : null, retro: false, conjunctions: [], aspectedBy: [], owns: [], avasthas: {}, shadbalaRatio: null, dispositor: null, combust: false, war: false }) as unknown as PlanetCard;
const VARGAS = ['D1', 'D7', 'D9', 'D10', 'D60'];
const view = {
  kundliId: 'k1',
  status: 'ready',
  version: 'd1',
  builtAt: null,
  house: (v: string, h: number) => (VARGAS.includes(v) ? house(v, h) : null),
  houses: (v: string) => (VARGAS.includes(v) ? Array.from({ length: 12 }, (_, i) => house(v, i + 1)) : []),
  planet: (v: string, p: string) => (VARGAS.includes(v) ? planet(v, p) : null),
  planets: (v: string) => ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'].map((p) => planet(v, p)),
  vargas: () => VARGAS,
  yogas: () => [],
  points: (v?: string) => [
    { id: 'UL', varga: 'D1', sign: 'Aries', house: 2, lord: 'Ma', lordHouse: 9 },
    { id: 'DK', varga: 'D1', sign: 'Virgo', house: 7, lord: 'Me', lordHouse: 8, planet: 'Ju' },
    { id: 'AmK', varga: 'D1', sign: 'Scorpio', house: 9, lord: 'Ma', lordHouse: 1, planet: 'Mo' },
  ].filter((x) => !v || x.varga === v),
  annual: () => [],
  star: () => null,
  sourceOf: () => [],
} as unknown as DigestView;
const act = (system: string, family: ActivationRow['family'], level: 1 | 2, lord: string, from: string, to: string, houses: number[]): ActivationRow => ({ system, family, level, lord, sign: null, from, to, houses, parentLord: null });
const activation = [
  act('vimsottari', 'vimshottari', 1, 'Ju', '2020-01-01', '2036-01-01', [7, 5]),
  act('vimsottari', 'vimshottari', 2, 'Ve', '2026-06-01', '2027-03-01', [7, 2]),
  act('vimsottari', 'vimshottari', 2, 'Sa', '2027-03-01', '2029-01-01', [10, 11, 6]),
  act('shoola', 'other' as ActivationRow['family'], 2, 'Ve', '2026-06-01', '2027-03-01', [7]),
];
const running = activation.filter((r) => r.from <= ASOF && ASOF < r.to);
const range = { from: frame.spans[0]!.from, to: frame.spans.at(-1)!.to };
const love = renderBoardTechniques('love', { view, asOf: ASOF, activation, running, transit: null, ageYears: 40, range });
const work = renderBoardTechniques('work', { view, asOf: ASOF, activation, running, transit: null, ageYears: 40, range, careerMap: null });
const techniques = { love, work };

const SELF = ['body', 'stuck', 'diagnosis'] as CardId[];
const DATING = ['dating_pulse', 'dating_meeting_timing', 'dating_delays_blocks'] as CardId[];
const JOB = ['job_pulse', 'job_promotion_recognition'] as CardId[];
const base = { ctx, frame, frameText: 'FRAME', frameKeys: [], prefix: { text: prefix.text, keys: prefix.keys }, ledger, slices, portrait: null, answers: '' };

describe('the board technique sections (docs/dashboards/14)', () => {
  it('Love: the eight layers, karakas, UL and DK, sahams, D9/D7 charts and each sub-area, each row keyed; no engine name', () => {
    expect(love.text.startsWith('# BOARD TECHNIQUES: LOVE')).toBe(true);
    for (const k of ['love:tone/now', 'love:karaka/DK', 'love:karaka/Ve', 'love:point/UL', 'love:chart/D9.h7', 'love:chart/D7.h7', 'love:saham/vivaha']) expect(love.keys, k).toContain(k);
    for (const s of LOVE.subareas) expect(love.keys).toContain(`love:sub/${s.id}`);
    for (const l of ['PROMISE', 'AFFLICTION', 'PROTECTION', 'ACTIVATION', 'TRANSIT', 'ANNUAL', 'VARGA', 'NAKSHATRA']) expect(love.text).toContain(`## ${l}`);
    expect(love.keys.some((k) => k.startsWith('love:promise/'))).toBe(true);
    expect(love.keys.some((k) => k.startsWith('love:activation/vimsottari.L2.Ve.2026-06-01'))).toBe(true);
    // a clock outside the section's clocks is not listed
    expect(love.keys.some((k) => k.includes('shoola'))).toBe(false);
    expect(love.dates).toContain('2026-06-01');
    expect(new Set(love.keys).size).toBe(love.keys.length);
    expect(love.text).not.toMatch(/radha|pyjhora/i);
  });
  it('Work: the career layers, the D1/D10 check of the running lords, the family votes and the Work map row', () => {
    expect(work.text.startsWith('# BOARD TECHNIQUES: WORK')).toBe(true);
    for (const s of WORK.subareas) expect(work.keys).toContain(`work:sub/${s.id}`);
    for (const k of ['work:karaka/L10', 'work:karaka/AmK', 'work:chart/D10.h10', 'work:check/d10.Ju', 'work:family/annual', 'work:map/present']) expect(work.keys, k).toContain(k);
  });
  it('the same input renders the same bytes', () => {
    const again = renderBoardTechniques('love', { view, asOf: ASOF, activation: [...activation].reverse(), running, transit: null, ageYears: 40, range });
    expect(again.text).toBe(love.text);
  });
  it('every v3 card has a mapping onto sub-areas its board config knows', () => {
    for (const c of BOARD_V3_CARDS) {
      const srcs = CARD_TECHNIQUES[c.id];
      expect(srcs?.length, c.id).toBeGreaterThan(0);
      for (const s of srcs) for (const sub of s.subareas) expect((s.board === 'love' ? LOVE : WORK).subareas.map((x) => x.id), `${c.id} ${sub}`).toContain(sub);
    }
    expect(techniqueBoardsOf(['body', 'mind'])).toEqual([]);
    expect(techniqueBoardsOf(['dating_pulse'])).toEqual(['love']);
    expect(techniqueBoardsOf(['allies_networking_allies'])).toEqual(['love', 'work']);
    expect(techniqueBoardsOf(['allies_pulse'])).toEqual(['work']);
    expect(cardTechniqueKeys('dating_pulse', techniques)[0]!.keys).toContain('love:sub/meet');
    expect(cardTechniqueKeys('dating_pulse', techniques)[0]!.keys).not.toContain('love:sub/family_accept');
  });
});

describe('the card pack with board techniques', () => {
  it('a Self-only run: the pack is byte for byte the pack without techniques', () => {
    const before = buildCardPack({ ...base, cards: SELF });
    const after = buildCardPack({ ...base, cards: SELF, techniques });
    expect(after.text).toBe(before.text);
    expect(after.hash).toBe(before.hash);
    expect(after.text).not.toContain('BOARD TECHNIQUES');
    for (const id of SELF) expect([...after.allowed[id]!].sort()).toEqual([...before.allowed[id]!].sort());
    expect(techniqueStamp('body', techniques)).toBe('');
  });
  it('a Love run carries the Love section once and its keys under CARD CELLS; Love cards may cite them, Self cards may not', () => {
    const p = buildCardPack({ ...base, cards: [...SELF, ...DATING], techniques });
    expect(p.text.split('# BOARD TECHNIQUES: LOVE').length).toBe(2);
    expect(p.text).not.toContain('# BOARD TECHNIQUES: WORK');
    const cells = p.text.split('## CARD CELLS dating_pulse\n')[1]!.split('\n\n')[0]!;
    expect(cells).toMatch(/^techniques LOVE \(read first/m);
    expect(cells).toContain('{love:sub/meet}');
    expect(p.text.split('## CARD CELLS body\n')[1]!.split('\n\n')[0]!).not.toContain('techniques');
    expect(p.allowed.dating_pulse!.has('love:sub/meet')).toBe(true);
    expect(p.allowed.dating_pulse!.has('love:point/UL')).toBe(true);
    expect(p.allowed.body!.has('love:sub/meet')).toBe(false);
    // the card order does not change the bytes
    expect(buildCardPack({ ...base, cards: [...DATING, ...SELF].reverse(), techniques }).text).toBe(p.text);
    expect(techniqueStamp('dating_pulse', techniques)).toMatch(/^\.t[0-9a-f]{12}$/);
  });
  it('a Work run carries the Work section and not the Love one', () => {
    const p = buildCardPack({ ...base, cards: [...SELF, ...JOB], techniques });
    expect(p.text).toContain('# BOARD TECHNIQUES: WORK');
    expect(p.text).not.toContain('# BOARD TECHNIQUES: LOVE');
    expect(p.allowed.job_pulse!.has('work:sub/promotion')).toBe(true);
  });
  it('Love evidence keys validate: the pre-check keeps them and the Oracle check accepts them', () => {
    const p = buildCardPack({ ...base, cards: [...DATING], techniques });
    const allowed = p.allowed.dating_pulse!;
    const raw = {
      card: 'dating_pulse',
      headline: 'A warm stretch after a slow one.',
      spans: frame.spans.map((s) => ({ span: s.id, tone: s.tone, mode: s.tone === 'heavy' ? 'get_through' : 'build', asks: 'Go gently.', obstacle: 'Doubt.', evidence: ['love:sub/meet', 'love:point/UL'], agreement: 'three of four' })),
      confirm: { claimId: '', text: '', from: '', to: '' },
      gift: 'warmth',
      knot: 'delay',
      pattern: { text: '', since: '', until: '', evidence: [] },
      certainty: 'likely',
      evidence: ['love:karaka/DK', 'love:sub/romance'],
    };
    const pre = precheckCard(raw, { allowed, cells: p.cells.dating_pulse ?? [] });
    expect(pre.notes.filter((n) => n.includes('dropped'))).toEqual([]);
    const r = checkOracleCard(pre.raw, { frame, allowedKeys: allowed, dates: new Set(frame.spans.flatMap((s) => [s.from, s.to])), expected: ['dating_pulse'] });
    expect(r.problems).toEqual([]);
    expect(r.card?.evidence).toContain('love:karaka/DK');
  });
  it('the one-card path gives a Love card its section and its board, and a Self card neither section', () => {
    const one = (card: CardId) =>
      cardInstruction({ ctx, card, matters: ['work_load_and_health'], board: [], frame, frameText: 'FRAME', frameKeys: [], prefix: { text: prefix.text, keys: prefix.keys }, ledger, matterSlices: [], dates: new Set(), answers: '', model: 'm', cacheOwner: { userId: 'u1', kundliId: 'k1' }, techniques }, []);
    const l = one('dating_pulse');
    expect(l.text).toContain('BOARD: this card is on the Love, lens Dating board');
    expect(l.text).toContain('# BOARD TECHNIQUES: LOVE');
    expect(l.keys).toContain('love:sub/meet');
    const s = one('body');
    expect(s.text).toContain('BOARD: this card is on the Self board');
    expect(s.text).not.toContain('# BOARD TECHNIQUES');
  });
});

describe('the prompts name the card\'s board', () => {
  it('no prompt says every card is a Self card; the requests name each board', () => {
    expect(PROMPTS['cards/oracle']).not.toContain("this person's Self board");
    expect(PROMPTS['cards/group']).not.toContain("this person's Self board");
    expect(PROMPTS['personalizer/self-v3']).not.toMatch(/^You are the Personalizer of the Self board/);
    for (const k of ['cards/oracle', 'cards/group', 'personalizer/self-v3']) expect(PROMPTS[k], k).toMatch(/Self, Love or Work/);
    expect(cardPackSystem()).toContain('BOARD TECHNIQUES: LOVE');
    const req = groupRequest(ASOF, ['body', 'dating_pulse', 'job_pulse', 'allies_pulse'] as CardId[], [], {});
    expect(req).toContain('- body: board Self; matters');
    expect(req).toContain('- dating_pulse: board Love, lens Dating; matters');
    expect(req).toContain('- job_pulse: board Work, lens Your job; matters');
    expect(req).toContain('- allies_pulse: board Love, lens Allies at work; matters');
    expect(cardBoardLabel('friends_core_allies')).toBe('board Love, lens Friends');
    const suf = personalizerV3Suffix(ASOF, [{ card: 'dating_pulse', spans: [] } as unknown as OracleCardV3], new Map(), { profile: ctx.sub.profile!, portrait: null, sections: {} } as never);
    expect(suf).toContain('- dating_pulse: board Love, lens Dating; sections');
    for (const k of ['cards/oracle', 'cards/group', 'personalizer/self-v3']) expect(PROMPTS[k], k).not.toMatch(/radha|pyjhora/i);
  });
});

describe('the plain why (doc 13 phase 5)', () => {
  const oracle: OracleCardV3 = {
    card: 'dating_pulse',
    headline: 'h',
    spans: frame.spans.map((s) => ({ span: s.id, tone: s.tone, mode: s.tone === 'heavy' ? 'get_through' : 'build', asks: 'a', obstacle: 'o', evidence: ['k'], agreement: 'x' })),
    confirm: null,
    gift: 'g',
    knot: 'k',
    pattern: null,
    certainty: 'likely',
    evidence: ['k'],
  } as unknown as OracleCardV3;
  const face = { line: 'Go gently until 1 Jan 2027.', spans: frame.spans.map((s) => ({ span: s.id, asks: 'a', obstacle: 'o', step: 'If x, then y.' })), confirm: '', pattern: '', ladder: { best: '', practical: '', drift: '', floor: '' } };
  const tc = { gender: null, dates: { days: new Set<string>(), months: new Set<string>(), years: new Set<string>(), pairs: new Set<string>() } } as never;
  it('the schemas offer why and do not require it', () => {
    const items = (personalizerV3Schema(['dating_pulse'] as CardId[]) as { properties: { cards: { items: { properties: Record<string, unknown>; required: string[] } } } }).properties.cards.items;
    expect(items.properties.why).toBeTruthy();
    expect(items.required).not.toContain('why');
    const g = (groupSchema(['dating_pulse'] as CardId[], frame.spans.map((s) => s.id)) as { properties: { cards: { items: { properties: { face: { properties: Record<string, unknown>; required: string[] } } } } } }).properties.cards.items.properties.face;
    expect(g.properties.why).toBeTruthy();
    expect(g.required).not.toContain('why');
  });
  it('a missing or empty why still serves the card; a written one reaches content.why', () => {
    const none = checkPersonalCard({ ...face, card: 'dating_pulse' }, oracle, tc, ['line', 'year', 'stretch', 'confirm']);
    expect(none.card).not.toBeNull();
    expect(none.card!.why).toBeUndefined();
    const empty = checkPersonalCard({ ...face, card: 'dating_pulse', why: '' }, oracle, tc, ['line', 'year', 'stretch', 'confirm']);
    expect(empty.card).not.toBeNull();
    const withWhy = checkPersonalCard({ ...face, card: 'dating_pulse', why: 'Your close bonds are well supported this year, so warmth comes easier.' }, oracle, tc, ['line', 'year', 'stretch', 'confirm']);
    expect(withWhy.card!.why).toBe('Your close bonds are well supported this year, so warmth comes easier.');
    expect(cardContent(oracle as never, withWhy.card!, frame)!.why).toBe('Your close bonds are well supported this year, so warmth comes easier.');
    expect(cardContent(oracle as never, none.card!, frame)!.why).toBeUndefined();
  });
});


