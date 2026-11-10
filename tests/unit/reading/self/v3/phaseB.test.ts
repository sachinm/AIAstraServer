/**
 * Self board v3 Phase B (docs/reading-engine/68 §4.5 items 2–6, §4.8): the year frame from stored rows, the Oracle and
 * Personalizer validators, and the whole step with a fake model client (no paid call).
 */
import { describe, expect, it } from 'vitest';
import type { PressureInventoryDetail, PressureRowDetail } from '../../../../../src/reading/self/sub/pressure.js';
import { runSelfV3Cards } from '../../../../../src/reading/self/v3/build.js';
import { checkOracleCard, validateOracleV3, ORACLE_V3_CALLS } from '../../../../../src/reading/self/v3/oracle.js';
import { checkPersonalCard, v3DateFrame } from '../../../../../src/reading/self/v3/personalizer.js';
import { cardContent } from '../../../../../src/reading/self/v3/store.js';
import type { OracleCardV3, SelfCardId } from '../../../../../src/reading/self/v3/types.js';
import { buildYearFrameV3, frameDates, renderYearFrame } from '../../../../../src/reading/self/v3/yearFrame.js';
import type { PreparedAgentSlice, SelfBuildContext } from '../../../../../src/reading/self/v2types.js';

const ASOF = '2026-11-09';
const row = (id: string, kind: PressureRowDetail['kind'], level: number | undefined, polarity: PressureRowDetail['polarity'], from: string, to: string, extra: Partial<PressureRowDetail> = {}): PressureRowDetail =>
  ({ id, kind, ...(level ? { level } : {}), planet: 'X', housesTouched: [6], matters: ['work_load_and_health'], polarity, strength: 2, from, to, evidence: [id], houseFromMoon: null, ...extra }) as PressureRowDetail;

function inventory(clock: string, rows: PressureRowDetail[]): PressureInventoryDetail {
  return { kundliId: 'k1', clock, asOf: ASOF, from: '2023-11-09', to: '2029-11-09', rows, boundaries: [], calcVersion: '2' };
}

const primary = inventory('dwisaptati', [
  row('md', 'dasha', 1, 'mixed', '2020-01-01', '2030-01-01'),
  row('ad1', 'dasha', 2, 'presses', '2026-05-18', '2027-01-01'),
  row('ad2', 'dasha', 2, 'supports', '2027-01-01', '2028-03-01'),
  row('pd1', 'dasha', 3, 'presses', '2026-10-01', '2026-12-05'),
  row('pd2', 'dasha', 3, 'presses', '2026-12-05', '2027-01-01'),
  row('pd3', 'dasha', 3, 'supports', '2027-01-01', '2027-06-03'),
  row('pd4', 'dasha', 3, 'mixed', '2027-06-03', '2027-10-04'),
  row('pd5', 'dasha', 3, 'supports', '2027-10-04', '2028-01-10'),
  row('tp26', 'annual', 1, 'mixed', '2026-09-20', '2027-09-09'),
  row('tp26.2', 'annual', 2, 'presses', '2026-09-20', '2027-02-01'),
  row('tp27', 'annual', 1, 'supports', '2027-09-09', '2028-08-28'),
  row('ss', 'sade_sati', undefined, 'presses', '2025-03-29', '2027-06-03', { houseFromMoon: 12 }),
  row('tr', 'transit', undefined, 'presses', '2026-11-01', '2027-02-01', { strength: 3 }),
]);
const vim = inventory('vimsottari', [row('v1', 'dasha', 3, 'presses', '2026-09-01', '2027-03-01'), row('v2', 'dasha', 3, 'supports', '2027-03-01', '2028-03-01')]);
const clock = { primary: 'dwisaptati', confirming: ['vimsottari', 'narayana'], applicable: ['dwisaptati', 'vimsottari'], notApplicable: [{ system: 'shodasottari', reason: 'x', cause: 'not_applicable' }] } as never;
const year = { from: '2026-09-20', to: '2027-09-09', yearLagna: null, yearLord: null, shortClock: null, noCoverage: false };

const frame = buildYearFrameV3({ asOf: ASOF, clock, primary, others: [{ system: 'vimsottari', inventory: vim }, { system: 'narayana', inventory: null }], year });

describe('year frame', () => {
  it('cuts on stored level-3 edges and the year edge, merges same-tone neighbours, every edge stored', () => {
    // the year edge (2027-09-09) cuts the mixed stretch, then the two mixed halves merge back (same copied tone)
    expect(frame.spans.map((s) => [s.from, s.to, s.tone])).toEqual([
      ['2026-10-01', '2027-01-01', 'heavy'],
      ['2027-01-01', '2027-06-03', 'light'],
      ['2027-06-03', '2027-10-04', 'mixed'],
      ['2027-10-04', '2028-01-10', 'light'],
    ]);
    const stored = new Set(primary.rows.flatMap((r) => [r.from, r.to]));
    for (const s of frame.spans) {
      expect(stored.has(s.from)).toBe(true);
      expect(stored.has(s.to)).toBe(true);
    }
    expect(frame.spans.length).toBeGreaterThanOrEqual(3);
    expect(frame.spans.length).toBeLessThanOrEqual(6);
  });
  it('places now, next and later', () => {
    expect(frame.spans.map((s) => s.place)).toEqual(['now', 'next', 'later', 'later']);
  });
  it('counts agreement across the year chart and the stored clocks; skips the unstored and inapplicable', () => {
    const s1 = frame.spans[0]!;
    expect(s1.clocks.map((c) => [c.system, c.tone])).toEqual([
      ['dwisaptati', 'heavy'],
      ['tithi_pravesha', 'heavy'],
      ['vimsottari', 'heavy'],
    ]);
    expect([s1.agree, s1.of]).toEqual([3, 3]);
    expect(frame.clocksSkipped).toEqual(expect.arrayContaining([{ system: 'narayana', reason: 'no stored tone' }, { system: 'shodasottari', reason: 'does not apply to this chart' }]));
  });
  it('carries the Saturn passage with its house from the Moon, and the strongest rows first', () => {
    expect(frame.saturn).toEqual([{ from: '2025-03-29', to: '2027-06-03', houseFromMoon: 12, evidence: 'pressure:ss' }]);
    expect(frame.spans[0]!.rows[0]!.id).toBe('pressure:tr');
  });
  it('no stored inventory for the reading clock: no spans, degraded', () => {
    const f = buildYearFrameV3({ asOf: ASOF, clock, primary: null, others: [], year });
    expect(f.spans).toEqual([]);
    expect(f.degraded).toBe(true);
  });
  it('renders every key in braces and lists the frame dates', () => {
    const r = renderYearFrame(frame, 'Main clock');
    expect(r.text).toContain('s1 2026-10-01..2027-01-01 place=now tone=heavy agree=3/3');
    expect(r.keys).toEqual(expect.arrayContaining(['pressure:pd1', 'pressure:ss']));
    expect(frameDates(frame).has(ASOF)).toBe(true);
  });
});

const allowed = new Set(['pressure:pd1', 'pressure:pd3', 'pressure:pd4', 'pressure:tr', 'pressure:ss', 'planet:D1.Mo', 'pressure:pd5', 'pressure:tp27']);
const dates = new Set([...frameDates(frame), '2026-05-18']);
const spanFor = (id: string, tone: string, mode: string) => ({ span: id, tone, mode, asks: 'hold the evenings', obstacle: 'late work', evidence: ['pressure:pd1'], agreement: 'three of three agree' });
const goodOracle = (card: SelfCardId): Record<string, unknown> => ({
  card,
  headline: 'Rest is thin until 1 Jan 2027.',
  spans: frame.spans.map((s) => spanFor(s.id, s.tone, s.tone === 'heavy' ? 'get_through' : 'build')),
  confirm: { claimId: `${card}.rest`, text: 'Since 1 Oct 2026 sleep has been shorter.', from: '2026-10-01', to: '2026-11-09' },
  gift: 'stamina',
  knot: 'overwork',
  pattern: { text: '', since: '', until: '', evidence: [] },
  certainty: 'likely',
  evidence: ['planet:D1.Mo'],
});
const ctxCheck = { frame, allowedKeys: allowed, dates, expected: ['body', 'mind'] as SelfCardId[] };

describe('Oracle v3 validator', () => {
  it('keeps a good card with its confirm', () => {
    const r = checkOracleCard(goodOracle('body'), ctxCheck);
    expect(r.problems).toEqual([]);
    expect(r.card?.confirm).toMatchObject({ claimId: 'body.rest', from: '2026-10-01', to: '2026-11-09' });
  });
  it('rejects a heavy span written as build, a copied tone that differs, a missing span, an unknown key, no knot', () => {
    const bad = goodOracle('body');
    const spans = bad.spans as Array<Record<string, unknown>>;
    spans[0]!.mode = 'build';
    spans[1]!.tone = 'heavy';
    spans.pop();
    (bad as { evidence: string[] }).evidence = ['planet:D1.Zz'];
    bad.knot = '';
    const r = checkOracleCard(bad, ctxCheck);
    expect(r.card).toBeNull();
    expect(r.problems.join(' | ')).toMatch(/never build/);
    expect(r.problems.join(' | ')).toMatch(/not the frame's/);
    expect(r.problems.join(' | ')).toMatch(/missing/);
    expect(r.problems.join(' | ')).toMatch(/unknown evidence key planet:D1.Zz/);
    expect(r.problems.join(' | ')).toMatch(/no knot/);
  });
  it('drops a future confirm and a pattern on a card that carries none, keeping the card', () => {
    const c = goodOracle('body');
    c.confirm = { claimId: 'body.rest', text: 'x', from: '2027-01-01', to: '2027-06-03' };
    c.pattern = { text: 'works late', since: '', until: '', evidence: ['pressure:pd1'] };
    const r = checkOracleCard(c, ctxCheck);
    expect(r.card?.confirm).toBeNull();
    expect(r.card?.pattern).toBeNull();
    expect(r.notes.join(' ')).toMatch(/future/);
  });
  it('a date in the text that is not a frame date fails the card', () => {
    const c = goodOracle('body');
    c.headline = 'Rest is thin until 3 Mar 2027.';
    expect(checkOracleCard(c, ctxCheck).problems.join(' ')).toMatch(/2027-03-03/);
  });
  it('validateOracleV3 marks the cards not returned', () => {
    const r = validateOracleV3([goodOracle('body'), goodOracle('body')], ctxCheck);
    expect(Object.keys(r.output.cards)).toEqual(['body']);
    expect(r.failed.mind).toEqual(['not returned']);
  });
});

describe('Personalizer v3 validator', () => {
  const oracle = checkOracleCard(goodOracle('mind'), { ...ctxCheck }).card as OracleCardV3;
  const c = { gender: null, dates: v3DateFrame(dates) };
  const personal = (over: Record<string, unknown> = {}) => ({
    card: 'mind',
    line: 'Your evenings need guarding until 1 Jan 2027.',
    spans: frame.spans.map((s) => ({ span: s.id, asks: 'Guard your evenings.', obstacle: 'Working late to catch up.', step: 'If it is past ten, then write tomorrow’s first task and stop.' })),
    confirm: 'Since 1 Oct 2026, have you been sleeping less?',
    pattern: '',
    ladder: { best: '', practical: '', drift: '', floor: '' },
    ...over,
  });
  it('keeps a good card and its confirm question; pattern and ladder stay off', () => {
    const r = checkPersonalCard(personal(), oracle, c, ['line', 'year', 'stretch', 'confirm']);
    expect(r.problems).toEqual([]);
    expect(r.card).toMatchObject({ confirm: 'Since 1 Oct 2026, have you been sleeping less?', pattern: null, ladder: null });
  });
  it('withholds the card on a chart term, an engine name, a step that is not if-then, or a long line', () => {
    const p = personal({ line: 'Saturn presses your evenings until 1 Jan 2027 and so on and on and on and on and on and on and on.' });
    (p.spans as Array<Record<string, string>>)[0]!.step = 'Stop working late.';
    const r = checkPersonalCard(p, oracle, c, ['line', 'year']);
    expect(r.card).toBeNull();
    expect(r.problems.join(' | ')).toMatch(/line: \d+ words/);
    expect(r.problems.join(' | ')).toMatch(/not an if-then/);
  });
  it('a gendered word with no stated gender withholds the card', () => {
    const r = checkPersonalCard(personal({ line: 'She guards her evenings until 1 Jan 2027.' }), oracle, c, ['line', 'year']);
    expect(r.problems.join(' ')).toMatch(/gendered/);
  });
  it('writes the ladder only when the section is on', () => {
    const lad = { best: 'Keep two quiet evenings a week.', practical: 'Agree a stop time with yourself.', drift: 'You catch up but tire.', floor: 'Sleep seven hours on work nights.' };
    expect(checkPersonalCard(personal({ ladder: lad }), oracle, c, ['line', 'year', 'ladder']).card?.ladder).toEqual(lad);
    expect(checkPersonalCard(personal({ ladder: lad }), oracle, c, ['line', 'year']).card?.ladder).toBeNull();
  });
  it('cardContent joins the Oracle, the person and the frame', () => {
    const p = checkPersonalCard(personal(), oracle, c, ['line', 'year']).card!;
    const content = cardContent(oracle, p, frame)!;
    expect(content.spans[0]).toMatchObject({ span: 's1', from: '2026-10-01', to: '2027-01-01', tone: 'heavy', mode: 'get_through' });
    expect(content.confirm).toEqual({ claimId: 'mind.rest', text: 'Since 1 Oct 2026, have you been sleeping less?' });
    expect(content.agreement).toEqual({ agree: 3, of: 3 });
  });
});

describe('the v3 step with a fake model', () => {
  const ctx = {
    userId: 'u1',
    kundliId: 'k1',
    asOf: ASOF,
    stamps: { digestVersion: 'd1', clock: 'dwisaptati', mainPeriod: null, subPeriod: null, subSubPeriod: null, skyWeek: null, year: null, profileHash: 'ph', confirmHash: null },
    sub: {
      clock,
      year,
      profile: { ageBand: '36_45', ageYears: 40, gender: null, role: 'public', facts: {}, declined: [], lastConfirms: [], mood: null, hash: 'ph' },
    },
  } as unknown as SelfBuildContext;
  const slice: PreparedAgentSlice = {
    agent: 'self.oracle',
    prefix: '# NATAL SLICE\n{planet:D1.Mo}',
    suffix: '',
    prefixHash: 'pre',
    cacheOwner: { userId: 'u1', kundliId: 'k1' },
    model: 'gemini-test',
    system: 'v2',
    estTokens: { prefix: 10, suffix: 0 },
    keys: ['planet:D1.Mo'],
  };
  const prisma = new Proxy({}, { get: () => undefined }) as never;

  it('builds every card from three Oracle calls and three Personalizer calls, nothing stored without a store', async () => {
    const nodes: string[] = [];
    const callGemini = async (o: { node: string; parts: string[] }) => {
      nodes.push(o.node);
      const ids = /write only these cards: ([a-z, ]+)\./.exec(o.parts.join('\n'))?.[1]?.split(', ') ?? /## WRITE[^\n]*\n((?:- .*\n?)*)/.exec(o.parts.join('\n'))?.[1]?.split('\n').filter(Boolean).map((l) => l.slice(2).split(':')[0]!) ?? [];
      const isOracle = o.node.includes('oracle');
      const cards = ids.map((id) =>
        isOracle
          ? goodOracle(id as SelfCardId)
          : {
              card: id,
              line: 'Your evenings need guarding until 1 Jan 2027.',
              spans: frame.spans.map((s) => ({ span: s.id, asks: 'Guard your evenings.', obstacle: 'Working late.', step: 'If it is past ten, then stop and rest.' })),
              confirm: 'Since 1 Oct 2026, have you been sleeping less?',
              pattern: '',
              ladder: { best: '', practical: '', drift: '', floor: '' },
            },
      );
      return { text: JSON.stringify({ cards }), usage: { promptTokens: 100, cachedTokens: 0, outputTokens: 50, thoughtTokens: 0 }, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false } as never;
    };
    const r = await runSelfV3Cards(
      { prisma, callGemini: callGemini as never, ensureCache: (async () => null) as never, maxSpendUsd: 1, now: new Date('2026-11-09T12:00:00Z'), loadInventory: async (_p, _k, s) => (s === 'vimsottari' ? vim : null), loadSections: async () => ({}) },
      { ctx, pressure: primary, oracleSlice: slice, portrait: null, buildId: 'b1' },
    );
    expect(r.gaps.filter((g) => !g.startsWith('v3: frame degraded'))).toEqual([]);
    expect(r.status).toBe('ok');
    expect(Object.keys(r.cards).sort()).toEqual(ORACLE_V3_CALLS.flatMap((c) => c.cards).sort());
    expect(nodes.filter((n) => n.includes('oracle'))).toHaveLength(3);
    expect(nodes.filter((n) => n.includes('personalizer'))).toHaveLength(3);
    expect(r.cards.body?.spans).toHaveLength(frame.spans.length);
    expect(r.key).toMatch(/^self\.v3\.cards\|clock=dwisaptati\|/);
    expect(r.cards.body?.confirm).toEqual({ claimId: 'body.rest', text: 'Since 1 Oct 2026, have you been sleeping less?' });
    expect(r.issues).toEqual([]);
  });

  it('no stored inventory: skipped, no model call', async () => {
    let calls = 0;
    const r = await runSelfV3Cards(
      { prisma, callGemini: (async () => (calls++, {})) as never, ensureCache: (async () => null) as never, maxSpendUsd: 1, now: new Date(), loadInventory: async () => null, loadSections: async () => ({}) },
      { ctx, pressure: null, oracleSlice: slice, portrait: null, buildId: 'b1' },
    );
    expect(r.status).toBe('skipped');
    expect(calls).toBe(0);
  });
});
