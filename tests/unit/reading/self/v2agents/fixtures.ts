/**
 * Fixtures for the Self v2 agents tests: a digest view with the fields the family packs read, a full build context
 * (S1–S10), eleven area briefs, fake sub-techniques, a Map-backed Prisma and a Gemini mock that answers by node.
 * Every model call is mocked; nothing here reaches a provider.
 */
import type { PrismaClient } from '@prisma/client';
import type { GeminiCallOptions, GeminiResult } from '../../../../../src/reading/llm/gemini.js';
import type { ActivationRow } from '../../../../../src/reading/digest/activation.js';
import type { DigestView, HouseCard, PlanetCard, PointRow, YogaRow } from '../../../../../src/reading/digest/types.js';
import type { AreaBrief, ProfilePack, SelfBuildContext, SelfV2AreaId, WindowRef } from '../../../../../src/reading/self/v2types.js';
import type { SelfV2SubResult } from '../../../../../src/reading/self/sub/index.js';
import type { SelfV2Subs } from '../../../../../src/reading/self/v2/build.js';

export const ASOF = '2026-11-09';
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const LORDS = ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'];
const PLANETS = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];

function house(varga: string, h: number): HouseCard {
  return {
    varga,
    house: h,
    sign: SIGNS[h - 1]!,
    lord: LORDS[h - 1]!,
    lordHouse: ((h + 3) % 12) + 1,
    lordSign: 'Capricorn',
    lordDignity: 'friend',
    coLord: null,
    occupants: h === 10 ? [{ planet: 'Sa', dignity: 'own', nature: 'malefic' }] : [],
    aspectedGraha: ['Ju'],
    aspectedRasi: ['Sa'],
    argala: { primary: ['Ju'], secondary: [], obstructed: [] },
    sav: 28 + (h % 5),
    class: [1, 4, 7, 10].includes(h) ? ['kendra'] : ['trikona'],
    cuspStar: null,
    arudha: null,
  } as unknown as HouseCard;
}

function planet(varga: string, p: string, i: number): PlanetCard {
  return {
    varga,
    planet: p,
    sign: SIGNS[i]!,
    house: i + 1,
    degree: 3.5 + i,
    star: 'Ashwini',
    pada: 1,
    starLord: 'Ke',
    dignity: 'neutral',
    retro: false,
    combust: false,
    war: false,
    dispositor: LORDS[i]!,
    dispositorHouse: ((i + 4) % 12) + 1,
    chain: [p, LORDS[i]!],
    avasthas: { baladi: 'yuva' },
    shadbalaRatio: 1.1,
    shadbalaRank: i + 1,
    natural: 'benefic',
    functional: 'neutral',
    owns: [((i + 1) % 12) + 1],
    aspectsTo: [((i + 7) % 12) + 1],
    aspectedBy: ['Ju'],
    conjunctions: [],
    starChain: ['Ke'],
  } as unknown as PlanetCard;
}

export function makeView(version = 'dv-1'): DigestView {
  const vargas = ['D1', 'D9', 'D10', 'D30'];
  const points: PointRow[] = ['AK', 'AmK', 'AL', 'UL', 'HL', 'GL', 'SL'].map((id, i) => ({ id, varga: 'D1', sign: SIGNS[i]!, house: i + 1, lord: LORDS[i]!, lordHouse: 2, planet: id === 'AK' ? 'Su' : undefined }) as unknown as PointRow);
  const yogas: YogaRow[] = [
    { id: 'gajakesari', name: 'Gajakesari Yoga', planets: ['Ju', 'Mo'], houses: [1, 4], class: 'yoga', source: 'engine' },
    { id: 'kemadruma', name: 'Kemadruma Dosha', planets: ['Mo'], houses: [4], class: 'dosha', source: 'engine' },
  ] as unknown as YogaRow[];
  return {
    kundliId: 'k-v2',
    status: 'ready',
    version,
    builtAt: null,
    house: (v: string, h: number) => (vargas.includes(v) ? house(v, h) : null),
    houses: (v: string) => (vargas.includes(v) ? Array.from({ length: 12 }, (_, i) => house(v, i + 1)) : []),
    planet: (v: string, p: string) => (vargas.includes(v) && PLANETS.includes(p) ? planet(v, p, PLANETS.indexOf(p)) : null),
    planets: (v: string) => (vargas.includes(v) ? PLANETS.map((p, i) => planet(v, p, i)) : []),
    vargas: () => vargas,
    yogas: () => yogas,
    points: (v?: string) => (v && v !== 'D1' ? [] : points),
    annual: () => [],
    star: () => null,
    sourceOf: () => [],
  } as unknown as DigestView;
}

export const ACTIVATION: ActivationRow[] = [
  { system: 'vimsottari', family: 'vimshottari', level: 1, lord: 'Ra', sign: null, from: '2018-03-01', to: '2036-03-01', houses: [10], parentLord: null },
  { system: 'vimsottari', family: 'vimshottari', level: 2, lord: 'Ve', sign: null, from: '2025-11-16', to: '2028-11-16', houses: [6], parentLord: 'Ra' },
  { system: 'vimsottari', family: 'vimshottari', level: 3, lord: 'Sa', sign: null, from: '2026-09-01', to: '2027-02-20', houses: [10], parentLord: 'Ve' },
];

const win = (rowId: string, from: string, to: string, polarity: WindowRef['polarity'] = 'presses'): WindowRef => ({ rowId, matters: ['career_and_standing'], polarity, strength: 2, from, to });

export function makeProfile(over: Partial<ProfilePack> = {}): ProfilePack {
  return {
    ageBand: '36_45',
    ageYears: 41,
    gender: null,
    role: 'public',
    facts: { work: { status: 'employed' } },
    declined: [],
    lastConfirms: [{ claimId: 'stuck.work_load', answer: 'yes', at: '2026-10-01T00:00:00Z' }],
    mood: null,
    hash: 'profile-hash-1',
    ...over,
  };
}

export function makeCtx(over: { profile?: ProfilePack; userId?: string; kundliId?: string } = {}): SelfBuildContext {
  const strip = Array.from({ length: 30 }, (_, i) => win(`sky-${i}`, `2026-0${(i % 9) + 1}-01`, `2027-0${(i % 9) + 1}-01`, i % 3 === 0 ? 'supports' : 'presses'));
  const heaviest = win('sat-10', '2025-03-29', '2027-06-03');
  return {
    userId: over.userId ?? 'u-v2',
    kundliId: over.kundliId ?? 'k-v2',
    asOf: ASOF,
    stamps: { digestVersion: 'dv-1', clock: 'vimsottari', mainPeriod: '2018-03-01', subPeriod: '2025-11-16', subSubPeriod: '2026-09-01', skyWeek: '2026-W45', year: '2026', profileHash: (over.profile ?? makeProfile()).hash, confirmHash: 'c1' },
    sub: {
      clock: { primary: 'vimsottari', reason: 'default', confirming: ['narayana'], applicable: ['vimsottari', 'narayana'], notApplicable: [] },
      periods: {
        system: 'vimsottari',
        previous: { level: 1, lord: 'Mo', from: '2008-03-01', to: '2018-03-01', evidence: 'activation:vimsottari/1/Mo@2008-03-01' },
        running: { level: 1, lord: 'Ra', from: '2018-03-01', to: '2036-03-01', evidence: 'activation:vimsottari/1/Ra@2018-03-01' },
        next: { level: 1, lord: 'Ju', from: '2036-03-01', to: '2052-03-01', evidence: 'activation:vimsottari/1/Ju@2036-03-01' },
        runningSub: { level: 2, lord: 'Ve', from: '2025-11-16', to: '2028-11-16', evidence: 'activation:vimsottari/2/Ve@2025-11-16' },
        runningSubSub: { level: 3, lord: 'Sa', from: '2026-09-01', to: '2027-02-20', evidence: 'activation:vimsottari/3/Sa@2026-09-01' },
        subRelation: '6/8',
        boundaries: [{ date: '2027-02-20', level: 3 }, { date: '2028-11-16', level: 2 }],
      },
      windows: {
        asOf: ASOF,
        strip,
        heaviestNow: heaviest,
        easesAt: '2027-06-03',
        nextSupportFrom: '2027-02-20',
        startedLast12m: [win('ju-12', '2026-06-02', '2027-06-25', 'supports')],
        endingNext6m: [win('ma-6', '2026-10-01', '2027-01-15')],
        byMatter: { career_and_standing: [heaviest] },
        degraded: false,
      },
      promise: {
        entries: [
          { id: 'p1', matter: 'career_and_standing', kind: 'gift', source: { yogaId: 'gajakesari' }, who: ['authority_and_boss'], strength: 3, evidence: ['yoga:D1.gajakesari', 'planet:D1.Ju'] },
          { id: 'p2', matter: 'home_and_peace', kind: 'knot', source: { yogaId: 'kemadruma' }, who: ['home_and_mother'], strength: 2, evidence: ['yoga:D1.kemadruma'] },
          { id: 'p3', matter: 'home_and_peace', kind: 'grace', source: { planet: 'Ju' }, who: ['self'], strength: 2, cancels: 'p2', evidence: ['planet:D1.Ju'] },
        ],
      },
      risk: {
        rows: [
          { id: 'r1', matter: 'career_and_standing', what: 'load_without_credit', from: { planet: 'Sa', house: 10, windowId: 'sat-10' }, who: ['authority_and_boss'], since: '2025-03-29', until: '2027-06-03', polarity: 'presses', strength: 3, holds: ['p1'], evidence: ['planet:D1.Sa', 'house:D1.h10'] },
          { id: 'r2', matter: 'home_and_peace', what: 'restless_mind', from: { yogaId: 'kemadruma' }, who: ['home_and_mother'], since: null, until: null, polarity: 'mixed', strength: 2, holds: ['p3'], evidence: ['yoga:D1.kemadruma'] },
        ],
        top3: ['r1', 'r2'],
      },
      mind: { feeling: ['planet:D1.Mo'], thinking: ['planet:D1.Me'], peace: ['house:D1.h4'], judgement: ['house:D1.h5'], candidatePatterns: [{ placement: 'Moon alone', evidence: ['yoga:D1.kemadruma'] }] },
      body: { footing: ['house:D1.h1'], wear: ['house:D1.h6'], shape: ['planet:D1.Su'], liveLords: [{ lord: 'Sa', houses: [10, 11], until: '2027-02-20', evidence: 'activation:vimsottari/3/Sa@2026-09-01' }], liveTransits: [heaviest], sensitive: false },
      presence: { bearing: ['house:D1.h1'], style: ['planet:D1.Ve'], adornment: ['house:D1.h2'], face: ['house:D1.h2'], publicVsPrivate: ['point:D1.AL'], bestWindow: { from: '2008-03-01', to: '2018-03-01', evidence: 'activation:vimsottari/1/Mo@2008-03-01' }, liveCare: { lord: 'Ve', until: '2028-11-16', evidence: 'activation:vimsottari/2/Ve@2025-11-16' } },
      year: { from: '2026-10-21', to: '2027-11-09', yearLagna: 'annual:TP2026.D1', yearLord: 'annual:TP2026.D1', shortClock: null, noCoverage: false },
      profile: over.profile ?? makeProfile(),
    },
  };
}

const AREA_IDS: SelfV2AreaId[] = ['diagnosis', 'stuck', 'chapter', 'chapters', 'lagna', 'mind', 'drive', 'presence', 'body', 'yogas', 'year'];

export function makeBriefs(): AreaBrief[] {
  return AREA_IDS.map((areaId) => ({
    areaId,
    horizon: 'live_plus_standing',
    claims: [
      { id: `${areaId}.main`, fact: `${areaId}_fact`, evidence: ['planet:D1.Sa'], range: { from: '2025-11-16', to: '2028-11-16' } },
      { id: `${areaId}.natal`, fact: `${areaId}_natal`, evidence: ['house:D1.h1'], range: 'always' },
      ...(areaId === 'stuck' ? [{ id: 'stuck.work_load', fact: 'work_load', evidence: ['house:D1.h10'], range: { from: '2025-03-29', to: '2027-06-03' } }] : []),
    ],
    dates: [{ from: '2025-11-16', to: '2028-11-16', label: 'sub period' }],
    ledgerRows: areaId === 'stuck' ? ['r1'] : [],
    promiseEntries: areaId === 'yogas' ? ['p1', 'p2', 'p3'] : [],
    refreshStamp: 'dv-1|2025-11-16',
  }));
}

export function makeSubs(over: { ctx?: SelfBuildContext; preparing?: boolean } = {}): SelfV2Subs & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async runSelfSubTechniques(): Promise<SelfV2SubResult | { status: 'preparing' }> {
      calls.push('runSelfSubTechniques');
      if (over.preparing) return { status: 'preparing' };
      return { ctx: over.ctx ?? makeCtx(), loaded: { view: makeView(), activation: ACTIVATION, sky: null, preferred: null }, gaps: [], ms: { s1: 1 } };
    },
    buildAreaBriefs() {
      calls.push('buildAreaBriefs');
      return makeBriefs();
    },
  };
}

/** One Oracle area as the model would return it. */
export function oracleArea(id: SelfV2AreaId, extraEvidence: string[] = []): Record<string, unknown> {
  return {
    id,
    headline: `Your ${id} asks for steady work now.`,
    paragraphs: [`The running Rahu period puts weight on ${id} through Saturn in the 10th {planet:D1.Sa}.`, `Venus as the sub lord, 6/8 from Rahu, makes ${id} cost effort until 2028-11-16 {activation:vimsottari/2/Ve@2025-11-16}.`],
    dates: [{ from: '2025-11-16', to: '2028-11-16', label: 'Venus sub-period' }],
    actions: [{ from: '2026-11-09', to: '2027-02-20', text: `Finish one ${id} task.` }],
    certainty: id === 'diagnosis' || id === 'stuck' || id === 'chapter' ? 'strong' : 'likely',
    evidence: ['planet:D1.Sa', `claim:${id}.main`, ...extraEvidence],
    validUntil: '2027-02-20',
  };
}

/** The JSON one Oracle call returns for its areas. */
export function oracleCallJson(areas: readonly SelfV2AreaId[]): string {
  const patterns = areas.includes('stuck') ? [{ areaId: 'stuck', behaviour: 'You take on load nobody asked you to carry.', mechanism: 'Saturn in the 10th from Rahu {planet:D1.Sa}', since: '2025-03-29', until: '2027-06-03', evidence: ['risk:r1', 'planet:D1.Sa'] }] : [];
  return JSON.stringify({ areas: areas.map((a) => oracleArea(a, a === 'stuck' ? ['claim:stuck.work_load', 'risk:r1'] : [])), validUntil: '2027-02-20', patterns });
}

/** The Personalizer's JSON for the given areas: clean cards, one sentence per source. */
export function personalJson(areas: readonly string[], over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    hero: { tone: 'demanding', sentence: 'Work asks more of you until 20 Feb 2027.', sub: '', questionClaimId: 'claim:stuck.work_load', questionText: 'Has work felt heavier lately?', withheld: false },
    cards: areas.map((a) => ({
      areaId: a,
      headline: 'Work asks more of you than it gives for now.',
      body: ['You carry more at work than you are thanked for. It eases after 20 Feb 2027.', 'Finish one thing a week.'],
      patterns: [{ text: 'You say yes before you ask what it costs.', kind: 'watch', since: '', until: '', source: `${a}.p1` }],
      ladder: { best: 'Do the work and let the credit come late.', practical: 'Put what you agreed in writing.', drift: 'Let it ride and you stay tired.', floor: 'Protect your sleep first.' },
      dates: [{ from: '2025-11-16', to: '2028-11-16', label: 'A heavier stretch at work' }],
      sources: [`${a}.p1`, `${a}.p1`, `${a}.p2`, 'planet:D1.Sa'],
    })),
    ...over,
  });
}

export function geminiResult(text: string, usage: Partial<GeminiResult['usage']> = {}): GeminiResult {
  return {
    text,
    usage: { node: 'x', model: 'm', promptTokens: 5000, cachedTokens: 4000, outputTokens: 800, thoughtTokens: 0, ms: 5, ...usage },
    finishReason: 'STOP',
    ttftMs: 5,
    stoppedForLoop: false,
  };
}

/** A Gemini mock that answers by node and records each call's node in `log`. */
export function makeGemini(log: string[], opts: { failOracle?: string; personal?: (areas: string[]) => string; cost?: Partial<GeminiResult['usage']> } = {}) {
  return async (o: GeminiCallOptions): Promise<GeminiResult> => {
    log.push(`call:${o.node}`);
    if (o.node.startsWith('family.')) return geminiResult(`- ${o.node} finding {planet:D1.Sa}\nVALID_UNTIL: always`, opts.cost);
    if (o.node.startsWith('self.oracle.v2.')) {
      const call = o.node.slice('self.oracle.v2.'.length);
      if (opts.failOracle === call) throw new Error('mock timeout');
      const areas = { a: ['diagnosis', 'stuck', 'chapter', 'chapters'], b: ['lagna', 'mind', 'drive', 'presence'], c: ['body', 'yogas', 'year'] }[call.slice(-1) as 'a' | 'b' | 'c'] as SelfV2AreaId[];
      return geminiResult(oracleCallJson(areas), opts.cost);
    }
    if (o.node === 'self.personalizer') {
      const areas = ((o.responseSchema as { properties: { cards: { items: { properties: { areaId: { enum: string[] } } } } } }).properties.cards.items.properties.areaId.enum);
      return geminiResult(opts.personal ? opts.personal(areas) : personalJson(areas), opts.cost);
    }
    throw new Error(`unexpected node ${o.node}`);
  };
}

/** A Map-backed Prisma: technique_outputs, area_builds and llm_cache_entries. */
export function makePrisma() {
  const outputs = new Map<string, Record<string, unknown>>();
  const builds = new Map<string, Record<string, unknown>>();
  const cacheRows = new Map<string, Record<string, unknown>>();
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (k === 'OR') return (v as Array<Record<string, unknown>>).some((w) => matches(row, w));
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        const cond = v as Record<string, unknown>;
        if ('startsWith' in cond) return String(row[k] ?? '').startsWith(String(cond.startsWith));
        if ('gt' in cond) return (row[k] as Date) > (cond.gt as Date);
        if ('lt' in cond) return (row[k] as Date) < (cond.lt as Date);
        if ('lte' in cond) return (row[k] as Date) <= (cond.lte as Date);
        return true;
      }
      return row[k] === v;
    });
  let seq = 0;
  const prisma = {
    techniqueOutput: {
      findUnique: async ({ where }: { where: { cache_key: string } }) => outputs.get(where.cache_key) ?? null,
      upsert: async ({ where, create, update }: { where: { cache_key: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const prev = outputs.get(where.cache_key);
        const next = prev ? { ...prev, ...update } : { ...create, created_at: new Date(Date.now() + seq++) };
        outputs.set(where.cache_key, next);
        return next;
      },
      updateMany: async () => ({ count: 1 }),
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        [...outputs.values()].filter((r) => matches(r, where)).sort((a, b) => (b.created_at as Date).getTime() - (a.created_at as Date).getTime())[0] ?? null,
    },
    areaBuild: {
      upsert: async ({ where, create, update }: { where: { kundli_id_area_as_of: { kundli_id: string; area: string; as_of: Date } }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const k = `${where.kundli_id_area_as_of.kundli_id}|${where.kundli_id_area_as_of.area}`;
        builds.set(k, { ...(builds.get(k) ?? create), ...update });
      },
      findFirst: async ({ where }: { where: { kundli_id: string; area: string } }) => builds.get(`${where.kundli_id}|${where.area}`) ?? null,
    },
    llmCacheEntry: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...cacheRows.values()].find((r) => matches(r, where)) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) => [...cacheRows.values()].filter((r) => matches(r, where)),
      upsert: async ({ where, create, update }: { where: { name: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        cacheRows.set(where.name, cacheRows.has(where.name) ? { ...cacheRows.get(where.name), ...update } : { ...create });
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        for (const [k, r] of cacheRows) if (matches(r, where)) cacheRows.set(k, { ...r, ...data });
      },
    },
  };
  return { prisma: prisma as unknown as PrismaClient, outputs, builds, cacheRows };
}
