/**
 * Doc 72: the Now card. The pull keeps the periods running today and the transit charts as the engine gave them (D2-D60
 * natal houses only where the engine states the chart's natal lagna); the slice carries every key; one call writes the
 * three faces, checked; free, once a day. Fake engine and fake model; no paid call, no database.
 */
import { describe, expect, it } from 'vitest';
import { NOW_FACTORS, pullNow, renderNowSlice, runningPeriods, transitCharts } from '../../../../src/reading/now/pull.js';
import { checkNowFace, getNow, sliceFacts } from '../../../../src/reading/now/service.js';
import type { GeminiCallOptions } from '../../../../src/reading/llm/gemini.js';

const ASOF = '2026-11-11';
const row = (id: string, level: number, from: string, to: string, planet = 'Ve') => ({ id, kind: 'dasha', level, planet, houses_touched: [7, 10], matters: ['partnership'], polarity: 'mixed', strength: 1, from, to, evidence: [id] });
const inv = (system: string) => ({
  calc_version: '2',
  system,
  as_of: ASOF,
  from: ASOF,
  to: ASOF,
  levels: 5,
  boundaries: [],
  rows: [
    row(`dasha:${system}/1/Ju@2020-01-01`, 1, '2020-01-01', '2036-01-01', 'Ju'),
    row(`dasha:${system}/2/Ve@2026-01-01`, 2, '2026-01-01', '2028-09-01'),
    row(`dasha:${system}/3/Sa@2026-10-01`, 3, '2026-10-01', '2027-02-01', 'Sa'),
    row(`dasha:${system}/4/Me@2026-11-02`, 4, '2026-11-02', '2026-11-20', 'Me'),
    row(`dasha:${system}/5/Ke@2026-11-10`, 5, '2026-11-10', '2026-11-12', 'Ke'),
    row(`dasha:${system}/5/Ve@2026-11-12`, 5, '2026-11-12', '2026-11-15'),
    { ...row('transit:Sa@2025-03-29', 0, '2025-03-29', '2027-06-01', 'Sa'), kind: 'transit' },
  ],
});
const transit = (stated: boolean) => ({
  at_local: `${ASOF} 12:00:00`,
  charts: Object.fromEntries(
    NOW_FACTORS.map((f) => [
      `d${f}`,
      {
        divisional_chart_factor: f,
        lagna: { sign: 'Capricorn' },
        ...(stated || f === 1 ? { natal_lagna: { sign: 'Leo', sign_index: 4 } } : {}),
        planets: [{ name: 'Saturn', sign: 'Pisces', nakshatra: 'Revati', house_from_lagna: 3, natal_house: 8 }],
      },
    ]),
  ),
});
const req = { params: { dob: '1990-01-01', tob: '10:00', place: 'Delhi' }, coords: null } as never;

describe('the Now pull', () => {
  it('keeps the dasha periods running today, level 1 first, and drops the others', () => {
    const p = runningPeriods(inv('vimsottari').rows as never, 'vimsottari', ASOF);
    expect(p.map((x) => x.level)).toEqual([1, 2, 3, 4, 5]);
    expect(p[4]!.to).toBe('2026-11-12');
  });

  it('keeps D2-D60 natal houses only where the engine states the chart natal lagna', () => {
    const before = transitCharts(transit(false))!;
    expect(before.charts.find((c) => c.factor === 1)!.planets[0]!.natalHouse).toBe(8);
    expect(before.charts.find((c) => c.factor === 9)!.planets[0]!.natalHouse).toBeNull();
    const after = transitCharts(transit(true))!;
    expect(after.charts.find((c) => c.factor === 9)!.planets[0]!.natalHouse).toBe(8);
    expect(after.charts.map((c) => c.factor)).toEqual([...NOW_FACTORS]);
  });

  it('asks each clock at the deepest level with no years either side, and the transit in D1-D60 with the natal fields', async () => {
    const asked: Array<[string, Record<string, unknown>]> = [];
    const fetcher = async (_r: unknown, type: string, extra: Record<string, unknown>) => {
      asked.push([type, extra]);
      return type === 'transit' ? transit(false) : inv(String((extra.params as Record<string, unknown>).system));
    };
    const d = await pullNow({ kundliRequest: async () => req, fetcher: fetcher as never }, 'k1', ASOF, ['vimsottari', 'narayana', 'yogini', 'chara', 'kaala'], 5);
    const pulls = asked.filter(([t]) => t === 'pressure_inventory').map(([, e]) => e.params as Record<string, unknown>);
    expect(pulls).toHaveLength(5);
    expect(pulls.every((p) => p.levels === 5 && p.years_back === 0 && p.years_ahead === 0 && p.as_of === ASOF)).toBe(true);
    const t = asked.find(([type]) => type === 'transit')![1];
    expect(t.divisional_chart_factors).toEqual([...NOW_FACTORS]);
    expect(t.natal_dob).toBe('1990-01-01');
    expect(t.at).toBe(`${ASOF} 12:00:00`);
    expect(d.gaps.join(' ')).toMatch(/15 charts carry no per-chart natal lagna/);
    const slice = renderNowSlice(d);
    expect(slice.text.startsWith(`# NOW (${ASOF})`)).toBe(true);
    expect(slice.keys).toContain('dasha:vimsottari/5/Ke@2026-11-10');
    expect(slice.keys).toContain('now:d60.Saturn');
    expect(slice.text).not.toMatch(/radha|pyjhora/i);
    const f = sliceFacts(slice);
    expect(f.clocksRead).toBe(5);
    expect(f.clocks[0]!.deepest).toEqual({ level: 5, to: '2026-11-12' });
  });
});

describe('the Now faces', () => {
  const ctx = () => {
    const slice = renderNowSlice({ asOf: ASOF, level: 5, clocks: [{ system: 'vimsottari', periods: runningPeriods(inv('vimsottari').rows as never, 'vimsottari', ASOF), error: null }], transit: transitCharts(transit(true)), gaps: [] });
    const f = sliceFacts(slice);
    const dates = { days: new Set([ASOF, '2026-11-12']), months: new Set(['2026-11']), years: new Set(['2026']), pairs: new Set<string>() };
    return { slice, f, c: { keys: new Set(slice.keys), periodEnds: f.periodEnds, clocksRead: f.clocksRead, text: { gender: null, dates } } };
  };
  const good = {
    line: 'A short, quiet day for you; keep it simple until 12 Nov 2026.',
    asks: 'Finish one thing before starting another.',
    step: 'If a new request lands after six, then write it down for tomorrow.',
    turns: { date: '2026-11-12', key: 'dasha:vimsottari/5/Ke@2026-11-10' },
    agree: { agree: 1, of: 1 },
    evidence: ['dasha:vimsottari/5/Ke@2026-11-10', 'now:d1.Saturn'],
  };

  it('a good face passes; a chart word, a made-up end date or an unknown key fails', () => {
    const { c } = ctx();
    expect(checkNowFace(good, c).problems).toEqual([]);
    expect(checkNowFace({ ...good, line: 'Saturn weighs on you today.' }, c).problems.join(' ')).toMatch(/chart term/);
    expect(checkNowFace({ ...good, turns: { date: '2026-11-30', key: good.turns.key } }, c).problems.join(' ')).toMatch(/turns/);
    expect(checkNowFace({ ...good, evidence: ['now:d1.Saturn', 'made:up'] }, c).problems.join(' ')).toMatch(/not in NOW/);
  });

  it('one call writes the three faces; a second request the same day waits on the same work', async () => {
    const { slice } = ctx();
    const calls: GeminiCallOptions[] = [];
    const callGemini = async (o: GeminiCallOptions) => {
      calls.push(o);
      await new Promise((r) => setTimeout(r, 5));
      return { text: JSON.stringify({ self: good, love: good, work: good }), usage: { promptTokens: 100, cachedTokens: 0, outputTokens: 50, thoughtTokens: 0 }, finishReason: 'STOP', ttftMs: 1, stoppedForLoop: false } as never;
    };
    const prisma = new Proxy(
      {},
      {
        get: (_t, p) =>
          p === 'kundliSlice'
            ? { findMany: async () => [{ slice_id: 'now', text: slice.text, keys: slice.keys, est_tokens: 1, sources: [], hash: slice.hash, built_at: new Date() }], upsert: async () => ({}) }
            : undefined,
      },
    ) as never;
    const deps = {
      prisma,
      callGemini: callGemini as never,
      model: 'gemini-3.8-flash',
      now: () => new Date(`${ASOF}T09:00:00Z`),
      latestKundliId: async () => 'k1',
      profile: async () => ({ ageBand: null, ageYears: null, gender: null, role: 'public', facts: {}, declined: [], lastConfirms: [], mood: null, hash: 'ph' }) as never,
    };
    const [a, b] = await Promise.all([getNow(deps, 'u1'), getNow(deps, 'u1')]);
    expect(a.status).toBe('ready');
    expect(b).toBe(a);
    expect(Object.keys(a.faces).sort()).toEqual(['love', 'self', 'work']);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.parts[0]).toContain('# NOW (2026-11-11)');
    expect(a.clocks[0]).toEqual({ system: 'vimsottari', deepest: { level: 5, to: '2026-11-12' } });
  });
});
