/**
 * Oracle validator failures are stored and acted on (Sachin 2026-11-09): the per-area outcome after one repair pass,
 * every finding structured and written to `reading_validation_failures`, the fallback to the last good reading (stale)
 * or withheld, the serve-and-charge rule, the GET /api/self/v2 `stale` status and `quality`, and the Personalizer's
 * drops stored the same way. Every model call is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeminiCallOptions } from '../../../../../src/reading/llm/gemini.js';
import { clearPendingIndividualRecycles } from '../../../../../src/reading/llm/cacheSweep.js';
import { clearReaderMemo } from '../../../../../src/reading/oracle/prewarm.js';
import { runSelfV2Build } from '../../../../../src/reading/self/v2/build.js';
import { issuesFromGaps, oracleCheckOf, personalizerCheckOf, qualityOf, recordValidationIssues, servesPage } from '../../../../../src/reading/self/v2/failures.js';
import { expectedOracleAreas, repairInstruction, runOracleV2 } from '../../../../../src/reading/self/v2/oracle.js';
import { buildSelfV2Slices } from '../../../../../src/reading/self/v2/slices.js';
import { readSelfV2Latest } from '../../../../../src/reading/self/v2/store.js';
import { buildSelfV2Response } from '../../../../../src/reading/self/v2api/response.js';
import type { ClockResolutionV2 } from '../../../../../src/reading/self/clock.js';
import type { SelfV2AreaId } from '../../../../../src/reading/self/v2types.js';
import { ACTIVATION, geminiResult, makeBriefs, makeCtx, makeGemini, makePrisma, makeProfile, makeSubs, makeView, oracleArea, oracleCallJson, personalJson } from './fixtures.js';

const ENV = {
  READING_EXPLICIT_CACHE: '1',
  READING_MODEL_READER: 'gemini-3.1-flash-lite',
  READING_MODEL_ORACLE: 'gemini-3.8-flash',
  SELF_PERSONALIZER_MODEL: 'gemini-3.1-flash-lite',
  SELF_READING_MAX_SPEND_USD: '1',
} as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  clearReaderMemo();
  clearPendingIndividualRecycles();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  for (const k of Object.keys(ENV)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  clearReaderMemo();
  clearPendingIndividualRecycles();
  vi.restoreAllMocks();
});

const setup = (ctx = makeCtx()) => {
  const s = buildSelfV2Slices(ctx, { view: makeView(), activation: ACTIVATION, sky: null, preferred: null }, makeBriefs());
  return { ctx, slice: s.oracle };
};
const deps = (callGemini: (o: GeminiCallOptions) => Promise<ReturnType<typeof geminiResult>>) => ({ prisma: makePrisma().prisma, callGemini, informUsed: vi.fn(), maxSpendUsd: 1 });
/** the JSON of one call with one area replaced */
const withArea = (areas: SelfV2AreaId[], id: SelfV2AreaId, area: Record<string, unknown> | null) => {
  const doc = JSON.parse(oracleCallJson(areas)) as { areas: Array<Record<string, unknown>> };
  doc.areas = doc.areas.flatMap((a) => (a.id === id ? (area ? [area] : []) : [a]));
  return JSON.stringify(doc);
};

describe('Oracle: one repair pass, per-area status, structured findings', () => {
  it('a call that throws: its areas are re-asked once, over the same prefix, and marked repaired', async () => {
    const { ctx, slice } = setup();
    const log: string[] = [];
    const seen: GeminiCallOptions[] = [];
    const gem = makeGemini(log, { failOracle: 'oracle.b' });
    const r = await runOracleV2(deps(async (o) => (seen.push(o), gem(o))), ctx, slice);
    expect(r.status).toBe('ok');
    expect(r.repairRan).toBe(true);
    expect(log.filter((x) => x.startsWith('repair:'))).toEqual(['repair:lagna,mind,drive,presence']);
    const repair = seen.find((o) => o.node === 'self.oracle.v2.oracle.repair')!;
    expect(repair.parts[0]).toBe(slice.prefix);
    expect(repair.parts[1]).toBe(slice.suffix);
    expect(repair.cachePrefix).toBe(true);
    expect(repair.parts[2]).toMatch(/^REPAIR: .*lagna, mind, drive, presence/);
    expect(repair.parts[2]).toMatch(/Fix these:\n- lagna: oracle\.b: mock timeout/);
    expect(r.areaStatus).toMatchObject({ diagnosis: 'ok', lagna: 'repaired', mind: 'repaired', drive: 'repaired', presence: 'repaired', body: 'ok', year: 'ok' });
    expect(r.issues!.filter((i) => i.check === 'call_failed').map((i) => [i.area, i.callId, i.areaStatus])).toEqual([
      ['lagna', 'oracle.b', 'repaired'],
      ['mind', 'oracle.b', 'repaired'],
      ['drive', 'oracle.b', 'repaired'],
      ['presence', 'oracle.b', 'repaired'],
    ]);
    // the repair call is counted in the cost and the timings
    expect(r.calls.map((c) => c.call)).toEqual(['oracle.a', 'oracle.b', 'oracle.c', 'oracle.repair']);
    expect(r.spentUsd).toBeCloseTo(r.calls.reduce((n, c) => n + c.costUsd, 0), 6);
  });

  it('an area the validator withholds (unknown evidence key) is repaired with the reason in the fix list', async () => {
    const { ctx, slice } = setup();
    const bad = { ...oracleArea('chapter'), paragraphs: ['Saturn presses the chapter {planet:D1.ZZ}.'] };
    const seen: GeminiCallOptions[] = [];
    const gem = makeGemini([], { oracle: (call, areas) => (call === 'oracle.a' ? withArea(areas, 'chapter', bad) : oracleCallJson(areas)) });
    const r = await runOracleV2(deps(async (o) => (seen.push(o), gem(o))), ctx, slice);
    expect(r.areaStatus!.chapter).toBe('repaired');
    expect(r.status).toBe('ok');
    const fix = seen.find((o) => o.node.endsWith('oracle.repair'))!.parts[2]!;
    expect(fix).toMatch(/- chapter: a paragraph cited an unknown key \(planet:D1\.ZZ\); withheld \(no paragraph survived\)/);
    const checks = r.issues!.filter((i) => i.area === 'chapter').map((i) => i.check);
    expect(checks).toEqual(expect.arrayContaining(['unknown_evidence_key', 'withheld']));
    expect(r.issues!.find((i) => i.check === 'unknown_evidence_key')).toMatchObject({ stage: 'oracle', callId: 'oracle.a', areaStatus: 'repaired' });
  });

  it('a missing area and a cut (MAX_TOKENS) call are named as such', async () => {
    const { ctx, slice } = setup();
    const gem = makeGemini([], { oracle: (call, areas) => (call === 'oracle.c' ? withArea(areas, 'yogas', null) : oracleCallJson(areas)) });
    const r = await runOracleV2(
      deps(async (o) => (o.node === 'self.oracle.v2.oracle.a' ? { ...geminiResult('{"areas":[{"id":"diag'), finishReason: 'MAX_TOKENS' } : gem(o))),
      ctx,
      slice,
    );
    expect(r.issues!.find((i) => i.area === 'yogas')).toMatchObject({ check: 'missing_area', callId: 'oracle.c' });
    expect(r.issues!.filter((i) => i.check === 'truncated').map((i) => i.area)).toEqual(['diagnosis', 'stuck', 'chapter', 'chapters']);
    expect(r.areaStatus).toMatchObject({ yogas: 'repaired', diagnosis: 'repaired' });
  });

  it('never more than one repair: an area that fails again stays failed, and the document is partial with the good areas', async () => {
    const { ctx, slice } = setup();
    const log: string[] = [];
    const bad = { ...oracleArea('mind'), headline: '' };
    const gem = makeGemini(log, { oracle: (call, areas) => (call === 'oracle.b' ? withArea(areas, 'mind', bad) : oracleCallJson(areas)), repair: (areas) => JSON.stringify({ areas: areas.map(() => bad), validUntil: 'always', patterns: [] }) });
    const r = await runOracleV2(deps(gem), ctx, slice);
    expect(log.filter((x) => x === 'call:self.oracle.v2.oracle.repair')).toHaveLength(1);
    expect(r.status).toBe('partial');
    expect(r.areaStatus!.mind).toBe('failed');
    expect(Object.keys(r.output!.doc.areas)).not.toContain('mind');
    expect(Object.keys(r.output!.doc.areas)).toHaveLength(10);
    expect(r.issues!.filter((i) => i.area === 'mind' && i.callId === 'oracle.repair').map((i) => i.check)).toContain('withheld');
    expect(r.issues!.filter((i) => i.area === 'mind').every((i) => i.areaStatus === 'failed')).toBe(true);
  });

  it('a dropped date stays on an ok area as a date_not_stored finding; no repair runs when every area stands', async () => {
    const { ctx, slice } = setup();
    const log: string[] = [];
    const dated = { ...oracleArea('body'), dates: [{ from: '2026-12-12', to: '2026-12-13', label: 'made-up relief' }] };
    const r = await runOracleV2(deps(makeGemini(log, { oracle: (call, areas) => (call === 'oracle.c' ? withArea(areas, 'body', dated) : oracleCallJson(areas)) })), ctx, slice);
    expect(r.repairRan).toBe(false);
    expect(log.some((x) => x.includes('repair'))).toBe(false);
    expect(r.issues!.find((i) => i.check === 'date_not_stored')).toMatchObject({ area: 'body', areaStatus: 'ok', callId: 'oracle.c' });
  });

  it('the year area is expected only when a year row covers today', () => {
    const ctx = makeCtx();
    expect(expectedOracleAreas(ctx)).toContain('year');
    expect(expectedOracleAreas({ ...ctx, sub: { ...ctx.sub, year: { ...ctx.sub.year!, noCoverage: true } } })).not.toContain('year');
  });

  it('a spend over the cap is budget_exceeded with a budget finding', async () => {
    const { ctx, slice } = setup();
    const r = await runOracleV2({ ...deps(makeGemini([])), maxSpendUsd: 0.000001 }, ctx, slice);
    expect(r.status).toBe('budget_exceeded');
    expect(r.issues!.at(-1)).toMatchObject({ check: 'budget', area: null });
  });

  it('the fix list is short: at most four reasons per area, "not returned" when there is none', () => {
    const t = repairInstruction(['stuck', 'body'], { stuck: ['stuck: a', 'stuck: b', 'stuck: c', 'stuck: d', 'stuck: e'] });
    expect(t).toMatch(/- stuck: a; b; c; d\n/);
    expect(t).toMatch(/- body: not returned/);
    expect(t).toMatch(/Patterns: up to 3 in all, only for stuck/);
  });
});

describe('findings in words → checks, rows and the serve rule', () => {
  it('reads the Oracle validator and the Personalizer validator findings into checks', () => {
    expect(oracleCheckOf('stuck: a paragraph cited an unknown key (x)')).toBe('unknown_evidence_key');
    expect(oracleCheckOf('stuck: evidence keys not in the brief dropped (x)')).toBe('unknown_evidence_key');
    expect(oracleCheckOf('body: date 2026-12-12..2026-12-13 (x) is not a stored span')).toBe('date_not_stored');
    expect(oracleCheckOf('body: action 2026-11-09..2026-12-01 does not start today or on a stored edge and end on one')).toBe('date_not_stored');
    expect(oracleCheckOf('mind: headline over 22 words, withheld')).toBe('cap');
    expect(oracleCheckOf('mind: withheld (no headline survived)')).toBe('withheld');
    expect(oracleCheckOf('stuck: pattern span a..b is not a stored span; its dates dropped')).toBe('pattern');
    expect(personalizerCheckOf('stuck: a body sentence dropped (chart term (Saturn))')).toBe('chart_term');
    expect(personalizerCheckOf('stuck: headline dropped (no source in the Oracle document)')).toBe('no_source');
    expect(personalizerCheckOf('stuck: a body sentence dropped (year 2031 is not in the Oracle document)')).toBe('date');
    expect(personalizerCheckOf('body: a body sentence dropped (diet or medicine advice (meals))')).toBe('diet_advice');
    expect(personalizerCheckOf('hero: question dropped (claim claim:x is not in the Oracle document)')).toBe('question');
    expect(personalizerCheckOf('stuck: illustration dropped (a month name (March))')).toBe('illustration');
    expect(issuesFromGaps('personalizer', ['hero: sub line dropped (gendered word with no stated gender (she))', 'overall x'], 'self.personalizer')).toEqual([
      { stage: 'personalizer', area: 'hero', check: 'gendered', message: 'hero: sub line dropped (gendered word with no stated gender (she))', callId: 'self.personalizer' },
      { stage: 'personalizer', area: null, check: 'other', message: 'overall x', callId: 'self.personalizer' },
    ]);
  });

  it('serves the page only with the hero and at least 8 of 11 areas ok or repaired', () => {
    const q = qualityOf({ diagnosis: 'ok', stuck: 'ok', chapter: 'ok', chapters: 'ok', lagna: 'ok', mind: 'repaired', drive: 'repaired', presence: 'ok', body: 'failed', yogas: 'failed', year: 'failed' });
    expect(q.okAreas).toHaveLength(6);
    expect(q.repaired).toEqual(['mind', 'drive']);
    expect(servesPage(q, true)).toBe(true);
    expect(servesPage(q, false)).toBe(false);
    expect(servesPage({ ...q, repaired: ['mind'] }, true)).toBe(false);
  });

  it('writes one row per finding and never throws (a client without the table writes nothing)', async () => {
    const db = makePrisma();
    const meta = { userId: 'u', kundliId: 'k', board: 'self', buildId: 'b1', model: 'gemini-3.8-flash', promptHash: 'ph' };
    const n = await recordValidationIssues(db.prisma, meta, [{ stage: 'oracle', area: 'mind', check: 'withheld', message: 'mind: withheld (no headline survived)', callId: 'oracle.b', areaStatus: 'failed' }]);
    expect(n).toBe(1);
    expect(db.failures[0]).toEqual({ user_id: 'u', kundli_id: 'k', board: 'self', build_id: 'b1', stage: 'oracle', area: 'mind', check: 'withheld', message: 'mind: withheld (no headline survived)', area_status: 'failed', model: 'gemini-3.8-flash', prompt_hash: 'ph', call_id: 'oracle.b' });
    expect(await recordValidationIssues({} as never, meta, [{ stage: 'oracle', area: null, check: 'budget', message: 'x', callId: null }])).toBe(0);
    const throwing = { readingValidationFailure: { createMany: async () => Promise.reject(new Error('no table')) } } as never;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await recordValidationIssues(throwing, meta, [{ stage: 'oracle', area: null, check: 'budget', message: 'x', callId: null }])).toBe(0);
  });
});

const CLOCK: ClockResolutionV2 = { primary: 'vimsottari', reason: 'default', applicable: ['vimsottari'], notApplicable: [] } as unknown as ClockResolutionV2;
const view = async (db: ReturnType<typeof makePrisma>) =>
  buildSelfV2Response({ status: 'ok', latest: await readSelfV2Latest(db.prisma, 'k-v2', 'vimsottari'), clock: CLOCK, profile: makeProfile() });

describe('the build: store failures, fall back to the last good area, charge only a build that serves the page', () => {
  const NOW = () => new Date('2026-11-09T12:00:00Z');
  const buildDeps = (db: ReturnType<typeof makePrisma>, log: string[], opts: Parameters<typeof makeGemini>[1] = {}) => ({
    prisma: db.prisma,
    callGemini: makeGemini(log, opts),
    ensureCache: vi.fn(async () => 'cachedContents/mock'),
    informUsed: vi.fn(),
    now: NOW,
  });
  const args = (over: Record<string, unknown> = {}) => ({ userId: 'u-v2', kundliId: 'k-v2', asOf: '2026-11-09', subs: makeSubs(), ...over });

  it('fewer than 8 areas after the repair: partial, nothing stored, the marker failed, the failures stored', async () => {
    const db = makePrisma();
    const log: string[] = [];
    // call a (4 areas) throws and its repair throws too: 7 of 11 left
    const r = await runSelfV2Build(buildDeps(db, log, { failOracle: 'oracle.a', failRepair: true }), args());
    expect(r.status).toBe('partial');
    expect(r.quality).toEqual({ okAreas: ['lagna', 'mind', 'drive', 'presence', 'body', 'yogas', 'year'], repaired: [], failed: ['diagnosis', 'stuck', 'chapter', 'chapters'] });
    expect(r.stored).toEqual({ oracle: false, cards: false });
    expect(log).not.toContain('call:self.personalizer');
    expect([...db.builds.values()][0]).toMatchObject({ status: 'failed' });
    expect(db.failures.filter((f) => f.stage === 'oracle' && f.check === 'call_failed')).toHaveLength(8); // 4 areas × (first call + repair)
    expect(new Set(db.failures.map((f) => f.build_id))).toEqual(new Set([r.buildId]));
    expect(db.failures.filter((f) => f.check === 'call_failed').every((f) => f.model === 'gemini-3.8-flash' && typeof f.prompt_hash === 'string' && f.area_status === 'failed')).toBe(true);
    const body = await view(db);
    expect(body.quality).toBeNull(); // nothing was stored: the page keeps what it had
  });

  it('8 areas after the repair and no earlier reading: served (ok, stored, charged); the failed areas are withheld', async () => {
    const db = makePrisma();
    const r = await runSelfV2Build(buildDeps(db, [], { failOracle: 'oracle.c', failRepair: true }), args());
    expect(r.status).toBe('ok');
    expect(r.stored).toEqual({ oracle: true, cards: true });
    expect(r.quality!.failed).toEqual(['body', 'yogas', 'year']);
    expect(r.cards!.stale).toBeUndefined();
    expect(r.gaps.join('\n')).toMatch(/no earlier reading \(withheld\): body, yogas, year/);
    const body = await view(db);
    expect(body.quality).toEqual({ okAreas: expect.any(Array), repaired: [], failed: ['body', 'yogas', 'year'] });
    expect(body.areas.find((a) => a.id === 'body')).toMatchObject({ status: 'withheld', card: null });
    expect(body.areas.find((a) => a.id === 'diagnosis')!.status).toBe('ok');
  });

  it('with an earlier good reading: the failed areas show its cards, marked stale, with its Chart details', async () => {
    const db = makePrisma();
    const first = await runSelfV2Build(buildDeps(db, []), args());
    expect(first.status).toBe('ok');
    const second = await runSelfV2Build({ ...buildDeps(db, [], { failOracle: 'oracle.c', failRepair: true }), force: true }, args({ refreshDay: '2026-11-09' }));
    expect(second.status).toBe('ok');
    expect(Object.keys(second.cards!.stale ?? {}).sort()).toEqual(['body', 'year', 'yogas']);
    expect(second.cards!.cardStatus.body).toBe('stale');
    const body = await view(db);
    const b = body.areas.find((a) => a.id === 'body')!;
    expect(b.status).toBe('stale');
    expect(b.card!.headline).toBe('Work asks more of you than it gives for now.');
    expect(b.details.headline).toBe('Your body asks for steady work now.');
    expect(body.areas.find((a) => a.id === 'diagnosis')!.status).toBe('ok');
    expect(body.quality!.failed).toEqual(['body', 'yogas', 'year']);
  });

  it('repaired areas serve the page and are counted in the cost', async () => {
    const db = makePrisma();
    const r = await runSelfV2Build(buildDeps(db, [], { failOracle: 'oracle.b' }), args());
    expect(r.status).toBe('ok');
    expect(r.quality!.repaired).toEqual(['lagna', 'mind', 'drive', 'presence']);
    expect(r.agents.map((a) => a.call)).toContain('oracle.repair');
    expect(r.ms.oracleRepair).toBeGreaterThanOrEqual(0);
    expect((await view(db)).quality!.repaired).toHaveLength(4);
  });

  it('no hero: the build does not serve the page (partial, not stored, question given back)', async () => {
    const db = makePrisma();
    const noHero = (areas: string[]) => personalJson(areas, { hero: { tone: 'mixed', sentence: '', sub: '', questionClaimId: '', questionText: '', withheld: true } });
    const r = await runSelfV2Build(buildDeps(db, [], { personal: noHero }), args());
    expect(r.status).toBe('partial');
    expect(r.stored.cards).toBe(false);
    expect([...db.builds.values()][0]).toMatchObject({ status: 'failed', error: 'build does not serve the page' });
  });

  it('the Personalizer validator drops are stored per card and check (no repair for them)', async () => {
    const db = makePrisma();
    const log: string[] = [];
    const chart = (areas: string[]) => {
      const doc = JSON.parse(personalJson(areas)) as { cards: Array<Record<string, unknown>> };
      doc.cards[0]!.body = ['Saturn presses your work now. It eases after 20 Feb 2027.', 'Finish one thing a week.'];
      return JSON.stringify(doc);
    };
    const r = await runSelfV2Build(buildDeps(db, log, { personal: chart }), args());
    expect(r.status).toBe('ok');
    expect(log.filter((x) => x === 'call:self.personalizer')).toHaveLength(1);
    const rows = db.failures.filter((f) => f.stage === 'personalizer');
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ area: 'diagnosis', check: 'chart_term', call_id: 'self.personalizer', model: 'gemini-3.1-flash-lite', area_status: null })]));
    expect(r.cards!.issues!.some((i) => i.check === 'chart_term')).toBe(true);
  });
});
