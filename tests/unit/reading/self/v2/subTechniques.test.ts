/**
 * Self v2 step 1b (docs/reading-engine/66 §4.8): the ten sub-techniques over the research calibration kundli's stored
 * rows, the eleven area briefs plus the hero, gaps instead of defaults, the ledger rows' shape, no database in areas, and
 * the catalogue rows.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { digestView } from '../../../../../src/reading/digest/load.js';
import type { ActivationRow } from '../../../../../src/reading/digest/activation.js';
import type { TransitRangePayload } from '../../../../../src/reading/chartData/transitRange.js';
import { gaps } from '../../../../../src/reading/self/slices.js';
import { runSelfSubTechniques, type SelfV2SubResult } from '../../../../../src/reading/self/sub/index.js';
import { subClock } from '../../../../../src/reading/self/sub/clock.js';
import { resolveClockV2 } from '../../../../../src/reading/self/clock.js';
import { subPeriods } from '../../../../../src/reading/self/sub/periods.js';
import { subWindows } from '../../../../../src/reading/self/sub/windows.js';
import { subPromise } from '../../../../../src/reading/self/sub/promise.js';
import { subRisk } from '../../../../../src/reading/self/sub/risk.js';
import { subYear } from '../../../../../src/reading/self/sub/year.js';
import { subBodyFacts } from '../../../../../src/reading/self/sub/body.js';
import { isoWeek } from '../../../../../src/reading/self/sub/config.js';
import type { SubEnv } from '../../../../../src/reading/self/sub/common.js';
import { buildAreaBriefs } from '../../../../../src/reading/self/areas/index.js';
import { SELF_V2_AREAS, type PromiseLedger, type WindowSetDetail } from '../../../../../src/reading/self/v2types.js';
import { RISK_WHAT, SELF_MATTERS, SELF_PEOPLE } from '../../../../../src/reading/self/v2words.js';
import { TECHNIQUES, techniqueById } from '../../../../../src/techniques/catalog.js';
import { contractProblems } from '../../../../../src/techniques/contracts.js';

const FIX = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../fixtures/self/research-calibration.json'), 'utf8')) as {
  digest: Array<{ section: string; key: string; row: unknown }>;
  activation: ActivationRow[];
  systems: Array<{ system: string; family: string }>;
};
const ASOF = '2026-11-07';
const view = digestView('k1', FIX.digest as never, { status: 'ready', version: 'd1.test' });

const SKY: TransitRangePayload = {
  from: '2026-11-02',
  to: '2027-11-02',
  planets: ['Sa', 'Ju', 'Mo'],
  natal: { lagna_sign: 'Pisces', lagna_sign_index: 11, moon_sign: 'Scorpio', moon_sign_index: 7 },
  ingresses: [
    { planet: 'Sa', sign: 'Pisces', sign_index: 11, from: '2025-03-29', to: '2027-06-03', starts_before_range: true, retro_on_entry: false, house_from_lagna: 1, house_from_moon: 5 },
    { planet: 'Ju', sign: 'Cancer', sign_index: 3, from: '2026-06-02', to: '2027-06-26', retro_on_entry: false, house_from_lagna: 5, house_from_moon: 9 },
    { planet: 'Mo', sign: 'Aries', sign_index: 0, from: '2026-11-06', to: '2026-11-08', retro_on_entry: false, house_from_lagna: 2, house_from_moon: 6 },
  ],
  stations: [],
  lunations: [],
  eclipses: [],
  sade_sati: [],
  dhaiya: [],
};

function fakePrisma(): PrismaClient {
  return {
    kundli: { findUnique: async () => ({ preferred_dasha: 'dwisatpathi' }) },
    auth: { findUnique: async () => ({ date_of_birth: '1990-05-01', gender: null, role: 'novice' }) },
    personFact: { findMany: async () => [{ key: 'work.status', value: 'employed', confirmed_at: null }] },
  } as unknown as PrismaClient;
}

async function run(over: { view?: typeof view; sky?: TransitRangePayload | null; asOf?: string } = {}): Promise<SelfV2SubResult> {
  const out = await runSelfSubTechniques(
    {
      prisma: fakePrisma(),
      loadDigest: async () => over.view ?? view,
      systemsPresent: async () => FIX.systems,
      activationFor: async (_p, _k, q) => FIX.activation.filter((r) => !q.systems || q.systems.includes(r.system)),
      loadTransit: async () => (over.sky === undefined ? SKY : over.sky),
    },
    { userId: 'u1', kundliId: 'k1', asOf: over.asOf ?? ASOF },
  );
  if ('status' in out) throw new Error('preparing');
  return out;
}

const envOf = (v = view, asOf = ASOF, sky: TransitRangePayload | null = SKY): SubEnv => ({ view: v, activation: FIX.activation, sky, asOf, g: gaps() });
const clock = subClock('dwisatpathi', FIX.systems, gaps());
/** a copy of the digest with one D1 planet card changed */
const withCard = (planet: string, patch: Record<string, unknown>) =>
  digestView('k1', FIX.digest.map((r) => (r.section === 'planet' && r.key === `D1.${planet}` ? { ...r, row: { ...(r.row as object), ...patch } } : r)) as never, { status: 'ready', version: 'd1.test' });

describe('runSelfSubTechniques (Layer 0 once, S1 → S2..S10 → S5, S7)', () => {
  it('fills every sub slot, the stamps and a timing per step', async () => {
    const r = await run();
    expect(Object.keys(r.ctx.sub).sort()).toEqual(['body', 'clock', 'mind', 'periods', 'presence', 'profile', 'promise', 'risk', 'windows', 'year']);
    expect(r.ctx.stamps).toMatchObject({
      digestVersion: 'd1.test',
      clock: 'dwisatpathi',
      mainPeriod: 'activation:dwisatpathi/1/Ra@2019-02-16',
      subPeriod: 'activation:dwisatpathi/2/Ve@2025-11-16',
      subSubPeriod: 'activation:dwisatpathi/3/Me@2026-09-20',
      skyWeek: isoWeek('2026-11-02'),
      year: '2026-09-03..2027-09-22',
    });
    expect(r.ctx.stamps.profileHash).toMatch(/^[0-9a-f]{16}$/);
    expect(r.ctx.stamps.confirmHash).toMatch(/^[0-9a-f]{16}$/);
    for (const s of ['load', 'clock', 'activation', 'periods', 'windows', 'promise', 'mindFacts', 'presenceFacts', 'year', 'profile', 'risk', 'bodyFacts', 'total']) expect(r.ms[s], s).toBeTypeOf('number');
    expect(r.loaded.preferred).toBe('dwisatpathi');
  });

  it('returns preparing when the digest is not ready', async () => {
    const out = await runSelfSubTechniques({ prisma: fakePrisma(), loadDigest: async () => null }, { userId: 'u1', kundliId: 'k1', asOf: ASOF });
    expect(out).toEqual({ status: 'preparing' });
  });

  it('S1 clock: the preference, the confirming clocks, applicability from the engine family', async () => {
    const { clock: c } = (await run()).ctx.sub;
    expect(c!.primary).toBe('dwisatpathi');
    expect(c!.reason).toBe('preferred');
    expect(c!.confirming).toContain('vimsottari');
    expect(c!.applicable).toContain('dwisatpathi');
    // the build's clock is the page's clock (GET /api/self/v2 resolves with resolveClockV2): never a clock the page cannot read
    expect(c!.notApplicable.map((x) => x.system)).toEqual(resolveClockV2('dwisatpathi', FIX.systems, null).notApplicable.map((x) => x.system));
    expect(subClock(null, FIX.systems, gaps()).reason).toBe('conditional_applies');
  });

  it('S1 clock: a stored preference the page no longer allows is not built on (c584c0a3 kaala, 2026-11-10)', () => {
    const present = [
      { system: 'kaala', family: 'other' },
      { system: 'dwisatpathi', family: 'conditional' },
      { system: 'vimsottari', family: 'nakshatra' },
    ];
    const g = gaps();
    const c = subClock('kaala', present, g);
    expect(c.primary).toBe(resolveClockV2('kaala', present, null).primary);
    expect(c.primary).not.toBe('kaala');
  });

  it('S2 periods: main, sub and sub-sub with evidence keys and the charter relation', async () => {
    const p = (await run()).ctx.sub.periods!;
    expect([p.previous?.lord, p.running.lord, p.next?.lord]).toEqual(['Sa', 'Ra', 'Su']);
    expect(p.runningSub).toMatchObject({ lord: 'Ve', from: '2025-11-16', to: '2027-01-01', evidence: 'activation:dwisatpathi/2/Ve@2025-11-16' });
    expect(p.runningSubSub?.lord).toBe('Me');
    expect(p.subRelation).toBe('2/12');
    expect(p.boundaries.some((b) => b.date === '2027-01-01' && b.level === 2)).toBe(true);
  });

  it('S3 windows: degraded, polarity from the engine functional label, since/until only where stored', async () => {
    const w = (await run()).ctx.sub.windows as WindowSetDetail;
    expect(w.degraded).toBe(true);
    expect(w.heaviestNow).toMatchObject({ rowId: 'activation:dwisatpathi/2/Ve@2025-11-16', polarity: 'presses', strength: 2 });
    expect(w.easesAt).toBe('2027-01-01');
    expect(w.nextSupportFrom).toBe('2026-11-11');
    expect(w.rows.some((x) => x.kind === 'transit' && x.planet === 'Mo')).toBe(false);
    const sat = w.rows.find((x) => x.rowId.startsWith('sky:ingress/Sa'))!;
    expect(sat).toMatchObject({ kind: 'transit', polarity: 'mixed', houses: [1], matters: ['self_and_body'], sinceKnown: false });
    expect(w.strip.every((x) => x.rowId && x.from && x.to)).toBe(true);
    expect(w.byMatter.self_and_body?.length).toBeGreaterThan(0);
  });

  it('S4 promise: gifts, knots and graces from stored classes, one Kala Sarpa, evidence keys', async () => {
    const p = (await run()).ctx.sub.promise!;
    expect(p.entries.filter((e) => /kala_sarpa/.test(e.id))).toHaveLength(1);
    const nb = p.entries.find((e) => e.id === 'promise:facts_neecha_bhanga')!;
    expect(nb).toMatchObject({ kind: 'grace', matter: 'luck_and_belief', who: ['father_and_teachers'] });
    expect(nb.evidence).toEqual(['yoga:D1.facts_neecha_bhanga', 'planet:D1.Mo', 'planet:D1.Ma']);
    expect(p.entries.some((e) => e.kind === 'gift')).toBe(true);
    expect(p.entries.every((e) => e.evidence.length > 0)).toBe(true);
  });

  it('S5 risk: live pressing windows with matter, what, from, who, since, until, holds; top3', async () => {
    const r = (await run()).ctx.sub.risk!;
    expect(r.rows.length).toBeGreaterThan(0);
    for (const row of r.rows) {
      expect(row.matter).toBeTruthy();
      expect(Object.values(RISK_WHAT)).toContain(row.what);
      expect(row.from.windowId).toBeTruthy();
      expect(Array.isArray(row.who)).toBe(true);
      expect(row.since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(row.until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Array.isArray(row.holds)).toBe(true);
      expect(row.evidence.length).toBeGreaterThan(0);
    }
    const ra = r.rows.find((x) => x.from.planet === 'Ra')!;
    expect(ra).toMatchObject({ matter: 'ideas_and_children', what: 'restless_speculation', who: ['children', 'friends_and_elder_siblings'], from: { yogaId: 'kala_sarpa' } });
    expect(r.top3[0]).toBe('risk:activation:dwisatpathi/2/Ve@2025-11-16');
  });

  it('S5 holds: a grace naming the planet or cancelling the knot', () => {
    const windows: WindowSetDetail = {
      asOf: ASOF, strip: [], heaviestNow: null, easesAt: null, nextSupportFrom: null, startedLast12m: [], endingNext6m: [], byMatter: {}, degraded: true,
      rows: [{ rowId: 'w1', kind: 'dasha', level: 2, planet: 'Sa', houses: [7], houseFromMoon: null, matters: ['partnership'], polarity: 'presses', strength: 3, from: '2026-01-01', to: '2027-01-01', sinceKnown: true, untilKnown: false, evidence: ['w1'] }],
    };
    const promise: PromiseLedger = {
      entries: [
        { id: 'promise:k', matter: 'partnership', kind: 'knot', source: { yogaId: 'k' }, who: [], strength: 2, evidence: ['yoga:D1.k', 'planet:D1.Sa'] },
        { id: 'promise:k.exceptions', matter: 'partnership', kind: 'grace', source: { yogaId: 'k' }, who: [], strength: 2, cancels: 'promise:k', evidence: ['yoga:D1.k'] },
      ],
    };
    const r = subRisk(ASOF, null, windows, promise, gaps());
    expect(r.rows[0]).toMatchObject({ what: 'burden_and_delay', who: ['partners_and_clients'], since: '2026-01-01', until: null, holds: ['promise:k.exceptions'], from: { yogaId: 'k', house: 7 } });
  });

  it('S6 mind, S7 body, S8 presence: evidence keys only, the engine sensitive flag absent → false and a gap', async () => {
    const r = await run();
    const m = r.ctx.sub.mind!;
    expect(m.feeling).toContain('planet:D1.Mo');
    expect(m.thinking).toContain('planet:D1.Me');
    expect(m.peace).toContain('house:D1.h4');
    expect(m.candidatePatterns.map((c) => c.placement)).toContain('Ra.h5');
    const b = r.ctx.sub.body!;
    expect(b.footing).toEqual(['house:D1.h1', 'planet:D1.Ju', 'planet:D1.Su']);
    expect(b.sensitive).toBe(false);
    expect(r.gaps.join('\n')).toMatch(/no sensitive-passage flag/);
    expect(b.liveLords.find((l) => l.lord === 'Ve')).toMatchObject({ houses: [6, 8], until: '2027-01-01' });
    expect(b.liveTransits.map((t) => t.rowId)).toEqual(['sky:ingress/Sa/Pisces@2025-03-29']);
    const p = r.ctx.sub.presence!;
    expect(p.adornment).toContain('planet:D1.Ve');
    expect(p.publicVsPrivate).toContain('point:D1.AL');
    expect(p.bestWindow).toMatchObject({ from: '2024-10-01', to: '2025-11-16', evidence: 'activation:dwisatpathi/2/Ju@2024-10-01' });
    expect(p.liveCare).toMatchObject({ lord: 'Ve', until: '2027-01-01' });
  });

  it('S9 year: the Tithi Pravesha year whose return has passed; Mudda only confirms; noCoverage when none covers asOf', async () => {
    const y = (await run()).ctx.sub.year!;
    expect(y).toMatchObject({ from: '2026-09-03', to: '2027-09-22', noCoverage: false, yearLord: null, yearLagna: 'annual:TP2026.D1#lagna', tpStart: '2026-09-03 04:12:00' });
    // the fixture's TP year dasha is a lifetime dasha (engine fix pending): no TP short clock, and never Mudda in its place
    expect(y.shortClock).toBeNull();
    expect(y.confirmClock?.evidence).toBe('annual:VP2026.D1#mudda');
    const none = subYear(envOf(view, '2031-01-01'));
    expect(none).toMatchObject({ noCoverage: true, shortClock: null, yearLagna: null, yearLord: null });
  });

  it('S10 profile: the pack with its band and facts', async () => {
    const p = (await run()).ctx.sub.profile!;
    expect(p.ageBand).toBe('36_45');
    expect(p.gender).toBeNull();
    expect(p.facts.work).toEqual({ status: 'employed' });
  });
});

describe('a missing engine field is a gap, never a default', () => {
  it('no functional label → polarity mixed and a gap; no charter → subRelation null and a gap', () => {
    const v = withCard('Ve', { functional: null });
    const env = envOf(v);
    const w = subWindows(env, clock);
    expect(w.rows.find((x) => x.planet === 'Ve' && x.kind === 'dasha')!.polarity).toBe('mixed');
    expect(env.g.list).toContain('windows: planet:D1.Ve.functional missing; polarity mixed');
    const env2 = envOf(withCard('Ra', { dashaCharter: null }));
    const p = subPeriods(env2, clock)!;
    expect(p.subRelation).toBeNull();
    expect(env2.g.list.join()).toMatch(/dashaCharter\.fruition\.Ve missing/);
  });
  it('no D30 card → body shape keeps only what is stored and names the gap; no sky → no transit rows and a gap', () => {
    const env = envOf(view, ASOF, null);
    const w = subWindows(env, clock);
    expect(w.rows.every((x) => x.kind === 'dasha')).toBe(true);
    const b = subBodyFacts(env, clock, w);
    expect(b.shape).toEqual(['planet:D1.Mo']);
    expect(b.liveTransits).toEqual([]);
    expect(env.g.list).toEqual(expect.arrayContaining(['body: house:D30.h1 missing', 'windows: no stored sky overlay covers asOf; transit rows absent']));
  });
  it('a yoga with no stored houses is left out with a gap', () => {
    const env = envOf(digestView('k1', [...FIX.digest, { section: 'yoga', key: 'D1.x_raja', row: { id: 'x_raja', name: 'X Raja Yoga', planets: ['Ju'], houses: [], class: 'raja', source: 'yogas' } }] as never));
    const p = subPromise(env);
    expect(p.entries.some((e) => e.id === 'promise:x_raja')).toBe(false);
    expect(env.g.list).toContain('promise: yoga:D1.x_raja has no stored houses');
  });
});

describe('areas (Layer 2)', () => {
  it('one brief per SELF_V2_AREAS entry, in order, with facts, evidence and a stamp, and no prose', async () => {
    const r = await run();
    const briefs = buildAreaBriefs(r.ctx);
    expect(briefs.map((b) => b.areaId)).toEqual(SELF_V2_AREAS.map((a) => a.id));
    for (const b of briefs) {
      expect(b.refreshStamp.startsWith('clock=dwisatpathi|'), b.areaId).toBe(true);
      for (const c of b.claims) {
        expect(c.fact, `${b.areaId} ${c.fact}`).not.toMatch(/\s/);
        expect(c.evidence.length).toBeGreaterThan(0);
      }
      for (const d of b.dates) expect(d.label).not.toMatch(/\s/);
    }
    const by = Object.fromEntries(briefs.map((b) => [b.areaId, b]));
    expect(by.now!.ledgerRows).toEqual(r.ctx.sub.risk!.top3);
    expect(by.now!.dates.map((d) => d.label)).toEqual(expect.arrayContaining(['eases', 'next_support']));
    expect(by.yogas!.promiseEntries.length).toBe(r.ctx.sub.promise!.entries.length);
    expect(by.chapter!.claims.some((c) => c.fact === 'relation:2/12')).toBe(true);
    expect(by.presence!.claims.some((c) => c.fact === 'best_window')).toBe(true);
    expect(by.year!.claims.some((c) => c.fact === 'year_lagna')).toBe(true);
    expect(by.year!.claims.some((c) => c.fact.startsWith('confirm_clock:'))).toBe(true);
    expect(by.year!.claims.some((c) => c.fact.startsWith('short_clock:'))).toBe(false);
    expect(by.stuck!.ledgerRows.length).toBe(r.ctx.sub.risk!.rows.length);
  });
  it('a year with no coverage gives an empty year brief', async () => {
    const r = await run();
    const ctx = { ...r.ctx, sub: { ...r.ctx.sub, year: { from: ASOF, to: ASOF, yearLagna: null, yearLord: null, shortClock: null, noCoverage: true } } };
    expect(buildAreaBriefs(ctx).find((b) => b.areaId === 'year')!.claims).toEqual([]);
  });
  it('no area module imports prisma, the digest loader or the sub-technique runner', () => {
    const dir = path.resolve(__dirname, '../../../../../src/reading/self/areas');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(13);
    for (const f of files) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
      for (const i of imports) expect(i, `${f} imports ${i}`).not.toMatch(/prisma|digest\/load|digest\/activation|\/sub\/|service/);
      expect(src, f).not.toMatch(/\bprisma\./);
    }
  });
});

describe('words tables and registration', () => {
  it('SELF.matters covers twelve houses; SELF.people names no people for the 8th and 12th', () => {
    expect(Object.keys(SELF_MATTERS)).toHaveLength(12);
    expect(SELF_PEOPLE[8]).toBeUndefined();
    expect(SELF_PEOPLE[12]).toBeUndefined();
    expect(SELF_PEOPLE[7]).toBe('partners_and_clients');
    expect(RISK_WHAT.Sa).toBe('burden_and_delay');
  });
  it('a TECHNIQUES row per sub-technique and per area, each a sound code contract', () => {
    const ids = [
      ...['clock', 'periods', 'windows', 'promise', 'risk', 'mind_facts', 'body_facts', 'presence_facts', 'year', 'profile'].map((n) => `self.sub.${n}`),
      ...SELF_V2_AREAS.map((a) => `self.v2.${a.id}`),
    ];
    for (const id of ids) {
      const t = techniqueById(id);
      expect(t, id).toBeDefined();
      expect(t!.contract.system).toBe('none');
      expect(contractProblems(t!)).toEqual([]);
    }
    // the agents lane's block (self.v2.oracle, personalizer, hero) follows this one
    const AGENT_ROWS = ['self.v2.oracle', 'self.v2.personalizer', 'self.v2.hero', 'self.v3.cards'];
    expect(TECHNIQUES.filter((t) => !AGENT_ROWS.includes(t.id)).slice(-ids.length).map((t) => t.id)).toEqual(ids);
  });
  it('the sub-technique run summaries carry no personal keys', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../../../src/reading/self/sub/index.ts'), 'utf8');
    const keys = [...src.matchAll(/\b(input|output)\s*:\s*\{([^}]*)\}/g)].flatMap((m) => [...m[2]!.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((x) => x[1]!));
    const summaries = [...src.matchAll(/=>\s*\(\{([\s\S]*?)\}\)/g)].flatMap((m) => [...m[1]!.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((x) => x[1]!));
    for (const k of [...keys, ...summaries]) expect(k).not.toMatch(/email|name|birth|dob|place|lat|lon|question/i);
  });
});
