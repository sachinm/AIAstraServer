import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildClarifyContextPrefix, clearClarifyCache, evictClarifyCacheForIndividual } from '../../../src/reading/clarify/planner.js';
import type { ActivationRow } from '../../../src/reading/digest/activation.js';
import type { AnnualRow, DigestView, HouseCard, PlanetCard, PointRow, StarProfile, YogaRow } from '../../../src/reading/digest/types.js';
import {
  evictFindingsCacheForIndividual,
  findingsCache,
  loadDbSpecialistFinding,
  saveDbSpecialistFinding,
} from '../../../src/reading/nodes/findingsCache.js';
import { clearChartBundles, type ChartRowSource } from '../../../src/reading/oracle/chartBundle.js';
import { CostGuard } from '../../../src/reading/oracle/costGuard.js';
import { buildTablesFromDigest, SUBAGENT_DIGEST_SPECS, type SubAgentId } from '../../../src/reading/oracle/digestSlices.js';
import { prepareReaders } from '../../../src/reading/oracle/prepare.js';
import { clearReaderMemo, getReaderMemo, loadDbReaderCache, saveDbReaderCache } from '../../../src/reading/oracle/prewarm.js';
import { fetchPlan, READERS, type ReaderId } from '../../../src/reading/oracle/readers.js';
import { clearValidatorCache, evictValidatorCacheForIndividual, validateAnswer } from '../../../src/reading/oracle/validator.js';
import { buildEvidencePack } from '../../../src/reading/packs/selector.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

function makeFakeDigest(kundliId = 'k-digest-1'): DigestView {
  const housesByVarga: Record<string, HouseCard[]> = {
    D1: Array.from({ length: 12 }, (_, idx) => ({
      varga: 'D1',
      house: idx + 1,
      sign: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][idx]!,
      lord: ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'][idx]!,
      lordHouse: ((idx + 3) % 12) + 1,
      lordSign: 'Leo',
      lordDignity: 'Exalted',
      coLord: null,
      occupants: idx === 9 ? [{ planet: 'Sa', dignity: 'Exalted', nature: 'benefic' }] : [],
      aspectedGraha: ['Sa'],
      aspectedRasi: ['Ju'],
      argala: { primary: ['Ju'], secondary: [], obstructed: [] },
      sav: 30,
      class: idx === 0 || idx === 3 || idx === 6 || idx === 9 ? ['kendra'] : ['trikona'],
      cuspStar: { name: 'Ashwini', lord: 'Ke', pada: 1 },
      arudha: idx === 9 ? 'Virgo' : null,
    })),
    D9: [
      {
        varga: 'D9',
        house: 1,
        sign: 'Aries',
        lord: 'Ma',
        lordHouse: 1,
        lordSign: 'Aries',
        lordDignity: 'Own',
        coLord: null,
        occupants: [],
        aspectedGraha: [],
        aspectedRasi: [],
        argala: null,
        sav: null,
        class: ['kendra'],
        cuspStar: null,
        arudha: null,
      },
    ],
    D10: [
      {
        varga: 'D10',
        house: 10,
        sign: 'Capricorn',
        lord: 'Sa',
        lordHouse: 10,
        lordSign: 'Capricorn',
        lordDignity: 'Own',
        coLord: null,
        occupants: [{ planet: 'Sa', dignity: 'Own', nature: 'neutral' }],
        aspectedGraha: [],
        aspectedRasi: [],
        argala: null,
        sav: null,
        class: ['kendra'],
        cuspStar: null,
        arudha: 'Capricorn',
      },
    ],
    D30: [
      {
        varga: 'D30',
        house: 1,
        sign: 'Pisces',
        lord: 'Ju',
        lordHouse: 1,
        lordSign: 'Pisces',
        lordDignity: 'Own',
        coLord: null,
        occupants: [],
        aspectedGraha: [],
        aspectedRasi: [],
        argala: null,
        sav: null,
        class: ['kendra'],
        cuspStar: null,
        arudha: null,
      },
    ],
  };

  const planetsByVarga: Record<string, PlanetCard[]> = {
    D1: [
      {
        varga: 'D1',
        planet: 'Sa',
        sign: 'Libra',
        house: 10,
        degree: 21.5,
        star: 'Swati',
        pada: 2,
        starLord: 'Ra',
        dignity: 'Exalted',
        retro: false,
        combust: false,
        war: false,
        dispositor: 'Ve',
        dispositorHouse: 7,
        chain: ['Sa', 'Ve'],
        avasthas: { baladi: 'Yuva', jagradadi: 'Jagrat' },
        avasthaMultipliers: { baladi: 1, jagradadi: 1, effective: 1, ripeness: 'full' },
        shadbalaRatio: 1.45,
        shadbalaRank: 1,
        natural: 'malefic',
        functional: 'yogakaraka',
        owns: [10, 11],
        aspectsTo: [12, 4, 7],
        aspectedBy: ['Ju'],
        conjunctions: [],
      },
      {
        varga: 'D1',
        planet: 'Mo',
        sign: 'Taurus',
        house: 2,
        degree: 14.2,
        star: 'Rohini',
        pada: 2,
        starLord: 'Mo',
        dignity: 'Exalted',
        retro: false,
        combust: false,
        war: false,
        dispositor: 'Ve',
        dispositorHouse: 7,
        chain: ['Mo', 'Ve'],
        avasthas: { baladi: 'Yuva' },
        shadbalaRatio: 1.25,
        shadbalaRank: 2,
        natural: 'benefic',
        functional: 'benefic',
        owns: [4],
        aspectsTo: [8],
        aspectedBy: [],
        conjunctions: [],
      },
    ],
    D9: [],
    D10: [],
    D30: [],
  };

  const yogas: YogaRow[] = [
    { id: 'sasa_yoga', name: 'Sasa Mahapurusha Yoga', planets: ['Sa'], houses: [10], class: 'raja', source: 'BPHS' },
    { id: 'kemadruma_dosha', name: 'Kemadruma Dosha', planets: ['Mo'], houses: [2], class: 'dosha', source: 'BPHS' },
  ];

  const points: PointRow[] = [
    { id: 'AK', varga: 'D1', sign: 'Libra', house: 10, lord: 'Sa', lordHouse: 10 },
    { id: 'AmK', varga: 'D1', sign: 'Taurus', house: 2, lord: 'Mo', lordHouse: 2 },
    { id: 'AL', varga: 'D1', sign: 'Capricorn', house: 10, lord: 'Sa', lordHouse: 10 },
    { id: 'UL', varga: 'D1', sign: 'Libra', house: 7, lord: 'Ve', lordHouse: 7 },
    { id: 'A10', varga: 'D1', sign: 'Virgo', house: 6, lord: 'Me', lordHouse: 6 },
    { id: 'A10', varga: 'D10', sign: 'Capricorn', house: 10, lord: 'Sa', lordHouse: 10 },
  ];

  const annualRows: AnnualRow[] = [
    {
      kind: 'TP',
      year: 2026,
      varga: 'D1',
      lagna: 'Capricorn',
      houses: housesByVarga.D1!,
      dashas: [{ system: 'tithi_ashtottari', periods: [{ lord: 'Sa', from: '2026-01-01', to: '2026-12-31' }] }],
      sahams: [{ name: 'Karma Saham', sign: 'Capricorn', house: 10 }],
      muntha: { sign: 'Capricorn', house: 10 },
      yearLord: 'Sa',
      tajakaYogas: [{ id: 'ikkabala', present: true }],
    },
    {
      kind: 'VP',
      year: 2026,
      varga: 'D1',
      lagna: 'Capricorn',
      houses: housesByVarga.D1!,
      dashas: [{ system: 'mudda', periods: [{ lord: 'Sa', from: '2026-01-01', to: '2026-12-31' }] }],
      sahams: [{ name: 'Rajya Saham', sign: 'Libra', house: 7 }],
      muntha: { sign: 'Capricorn', house: 10 },
      yearLord: 'Sa',
    },
  ];

  const star: StarProfile = {
    moonStar: 'Rohini',
    moonStarLord: 'Mo',
    lagnaStar: 'Ashwini',
    taras: [{ star: 'Rohini', tara: 'Janma' }],
    gandanta: [],
    pendingKarmaHouses: [10],
  };

  return {
    kundliId,
    status: 'ready',
    version: 'd1.2026-11-06',
    builtAt: '2026-11-06T00:00:00.000Z',
    house: (v, h) => housesByVarga[v]?.find((x) => x.house === h) ?? null,
    houses: (v) => housesByVarga[v] ?? [],
    planet: (v, p) => planetsByVarga[v]?.find((x) => x.planet === p) ?? null,
    planets: (v) => planetsByVarga[v] ?? [],
    vargas: () => Object.keys(housesByVarga),
    yogas: () => yogas,
    points: (v) => (v ? points.filter((p) => p.varga === v) : points),
    annual: (y) => (y ? annualRows.filter((r) => r.year === y) : annualRows),
    star: () => star,
    sourceOf: () => [],
  };
}

const FAKE_ACTIVATION: ActivationRow[] = [
  { system: 'vimsottari', family: 'vimshottari', level: 1, lord: 'Sa', sign: null, from: '2019-01-01', to: '2038-01-01', houses: [10, 11], parentLord: null },
  { system: 'vimsottari', family: 'vimshottari', level: 2, lord: 'Ke', sign: null, from: '2026-08-22', to: '2027-09-07', houses: [10], parentLord: 'Sa' },
  { system: 'narayana', family: 'rasi', level: 1, lord: 'Sa', sign: 'Capricorn', from: '2025-01-01', to: '2030-01-01', houses: [10], parentLord: null },
  { system: 'chara', family: 'rasi', level: 1, lord: 'Sa', sign: 'Capricorn', from: '2025-01-01', to: '2030-01-01', houses: [10], parentLord: null },
  { system: 'yogini', family: 'yogini', level: 1, lord: 'Sa', sign: null, from: '2025-01-01', to: '2030-01-01', houses: [10], parentLord: null },
  { system: 'tithi_ashtottari', family: 'tithi_ashtottari', level: 1, lord: 'Sa', sign: null, from: '2025-01-01', to: '2030-01-01', houses: [10], parentLord: null },
  { system: 'dwisatpathi', family: 'conditional', level: 1, lord: 'Sa', sign: null, from: '2025-01-01', to: '2030-01-01', houses: [10], parentLord: null },
];

describe('per-sub-agent digest slicing and caching', () => {
  beforeEach(() => {
    clearChartBundles();
    clearReaderMemo();
    clearValidatorCache();
    clearClarifyCache();
    findingsCache.clear();
  });

  it('registers explicit digest specs and cache policies for every sub-agent type', () => {
    const expectedIds: SubAgentId[] = [
      'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14',
      'P1', 'P2', 'P3',
      'specialist:promise', 'specialist:dasha', 'specialist:transit', 'specialist:nakshatra', 'specialist:annual', 'specialist:prashna',
      'oracle', 'addendum', 'synthesize', 'clarify', 'validator', 'intake',
      'code:jaimini', 'code:avastha', 'code:nakshatra', 'code:varga', 'code:annual', 'code:person',
    ];
    for (const id of expectedIds) {
      const spec = SUBAGENT_DIGEST_SPECS[id];
      expect(spec, `missing spec for ${id}`).toBeDefined();
      expect(spec.id).toBe(id);
    }
    for (const id of Object.keys(READERS) as ReaderId[]) {
      expect(SUBAGENT_DIGEST_SPECS[id].cachePromptPrefix).toBe(true);
      expect(SUBAGENT_DIGEST_SPECS[id].cacheOutput).toBe('reading_findings_cache');
    }
    for (const id of ['code:jaimini', 'code:avastha', 'code:nakshatra', 'code:varga', 'code:annual', 'code:person'] as SubAgentId[]) {
      expect(SUBAGENT_DIGEST_SPECS[id].cacheOutput).toBe('technique_outputs');
    }
  });

  it('slices all reader tables from DigestView + ActivationRow[] with zero raw kundli_data queries', async () => {
    const digest = makeFakeDigest('k-digested');
    const allReaderIds = Object.keys(READERS) as ReaderId[];
    const wantedTypes = fetchPlan(allReaderIds, { vargas: ['varga.d10', 'varga.d9', 'varga.d30'], person: null });

    const sliced = buildTablesFromDigest(digest, wantedTypes, { asOf: G1_AS_OF, activation: FAKE_ACTIVATION });
    expect(sliced.missing).toEqual([]);
    expect(sliced.tables['varga.d1']).toBeDefined();
    expect(sliced.tables['varga.d9']).toBeDefined();
    expect(sliced.tables['varga.d10']).toBeDefined();
    expect(sliced.tables['varga.d30']).toBeDefined();
    expect(sliced.tables['dasha.vimsottari']).toBeDefined();
    expect(sliced.tables['annual.tithi_pravesha']).toBeDefined();
    expect(sliced.tables['sphutas']).toBeDefined();

    const rows: ChartRowSource & { calls: string[][] } = {
      calls: [],
      read: async (_k, types) => {
        rows.calls.push(types);
        return [];
      },
    };
    const dossier = loadG1Dossier();
    const transits = loadG1Transits();
    const intent = {
      subjects: [{ id: 'career_work' as const, weight: 1 }],
      horizon: '1y' as const,
      questionType: 'describe' as const,
      format: 'narrative' as const,
      mentionsPlanets: [],
      focusPoints: [],
      followUps: [],
      confidence: 1,
      clarifyText: 'Career over the next year',
      safety: 'ok' as const,
    };
    const pack = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent, digest, activation: FAKE_ACTIVATION });

    const prep = await prepareReaders({
      rows,
      kundliId: 'k-digested',
      intent,
      question: 'How is my career over the next year?',
      asOf: G1_AS_OF,
      pack,
      model: 'gemini-3.1-flash-lite',
      digest,
      activation: FAKE_ACTIVATION,
    });

    // Because the digest + activation covered every table in the plan, rows.read was never called!
    expect(rows.calls).toHaveLength(0);
    expect(prep.missingTypes).toEqual([]);
    expect(prep.coreText).toMatch(/^CHART CORE: /);
    expect(prep.requests.size).toBeGreaterThan(0);
  });

  it('caches and reuses reader (R01..R14, P1..P3) and specialist findings in reading_findings_cache with usage tracking', async () => {
    const dbStore = new Map<string, Record<string, unknown>>();
    const fakePrisma = {
      readingFindingsCache: {
        findUnique: vi.fn(async ({ where }: { where: { cache_key: string } }) => dbStore.get(where.cache_key) ?? null),
        upsert: vi.fn(async ({ where, create, update }: { where: { cache_key: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
          const prev = dbStore.get(where.cache_key);
          const next = prev ? { ...prev, ...update } : { ...create };
          dbStore.set(where.cache_key, next);
          return next;
        }),
        updateMany: vi.fn(async ({ where, data }: { where: { cache_key: string }; data: Record<string, unknown> }) => {
          const row = dbStore.get(where.cache_key);
          if (row) {
            row.hit_count = ((row.hit_count as number) ?? 0) + 1;
            row.last_used_at = data.last_used_at;
            if (data.user_id) row.user_id = data.user_id;
          }
          return { count: row ? 1 : 0 };
        }),
      },
    } as unknown as PrismaClient;

    // 1. Save R14 finding
    const heldR14 = {
      finding: {
        verdict: 'moderate' as const,
        layerScore: 1,
        digest: 'Remedy digest',
        claims: [{ text: 'Strengthen Saturn through discipline.', evidence: ['dignities.planets.Sa.dignity'], polarity: 'supports' as const, weight: 2 as const, tradition: 'parashara' as const, about: 'self' as const, topic: 'Saturn', kind: 'grace' as const }],
        windows: [],
        quotes: [],
        gaps: [],
        disagree: '',
        actors: [],
        graces: [],
        pointers: [],
        sensitive: '',
        form: '',
        culprits: [],
        contributors: [],
        caveats: [],
      },
      usage: { node: 'R14', model: 'gemini-3.1-flash-lite', promptTokens: 500, cachedTokens: 400, outputTokens: 80, thoughtTokens: 0, ms: 50 },
    };

    await saveDbReaderCache(fakePrisma, {
      cacheKey: 'r14-key-1',
      kundliId: 'k1',
      userId: 'u1',
      readerId: 'R14',
      packHash: 'ph1',
      horizonKey: '2026-10-24..2027-10-24',
      promptVersion: 'v1',
      natal: false,
      held: heldR14,
      used: true,
    });

    expect(dbStore.get('r14-key-1')?.user_id).toBe('u1');
    expect(dbStore.get('r14-key-1')?.hit_count).toBe(1);
    expect(dbStore.get('r14-key-1')?.last_used_at).toBeInstanceOf(Date);

    // Simulate cold Lambda instance by clearing in-memory memo
    clearReaderMemo();
    const loadedR14 = await loadDbReaderCache(fakePrisma, 'r14-key-1', { userId: 'u1', kundliId: 'k1' });
    expect(loadedR14?.finding.digest).toBe('Remedy digest');
    expect(dbStore.get('r14-key-1')?.hit_count).toBe(2);
    expect(getReaderMemo('r14-key-1')?.finding.digest).toBe('Remedy digest');

    // 2. Save & load Graph specialist finding
    const specFinding = {
      analyst: 'promise' as const,
      subject: 'career_work' as const,
      verdict: 'strong' as const,
      layerScore: 3,
      claims: [],
      windows: [],
      keyFacts: [],
      caveats: [],
    };
    await saveDbSpecialistFinding(fakePrisma, {
      cacheKey: 'spec-promise-1',
      kundliId: 'k1',
      userId: 'u1',
      analyst: 'promise',
      packHash: 'dh1',
      horizonKey: 'natal',
      finding: specFinding,
    });
    expect(dbStore.get('spec-promise-1')?.reader_id).toBe('specialist:promise');

    findingsCache.clear();
    const loadedSpec = await loadDbSpecialistFinding(fakePrisma, 'spec-promise-1', { userId: 'u1', kundliId: 'k1' });
    expect(loadedSpec?.verdict).toBe('strong');
    expect(dbStore.get('spec-promise-1')?.hit_count).toBe(2);
    expect(evictFindingsCacheForIndividual({ userId: 'u1', kundliId: 'k1' })).toBe(1);
  });

  it('builds stable clarify context prefix and evicts validator/clarify caches per individual', async () => {
    const prefix = buildClarifyContextPrefix({
      asOf: '2026-11-06',
      card: { md: 'Saturn', ad: 'Ketu', pd: 'Venus', adEnd: '2027-09-07' },
      facts: { 'work.status': 'employed', 'rel.status': 'married' },
      location: { place: 'San Francisco, US', tz: 'America/Los_Angeles' },
      birthPlace: 'Mumbai, IN',
    });
    expect(prefix).toContain('CLARIFY CONTEXT AS OF: 2026-11-06');
    expect(prefix).toContain('RUNNING DASHA: Saturn-Ketu-Venus');
    expect(prefix).toContain('"rel.status":"married"');
    expect(prefix).toContain('CURRENT LOCATION: San Francisco, US');

    // Validator rule + cache eviction check
    const guard = new CostGuard({ on: G1_AS_OF });
    const v = await validateAnswer({
      answer: 'Your career shifts strongly in March 2027 when the sub-period changes.',
      question: 'When will my career change?',
      intent: {
        subjects: [{ id: 'career_work', weight: 1 }],
        horizon: '1y',
        questionType: 'timing',
        format: 'narrative',
        mentionsPlanets: [],
        focusPoints: [],
        followUps: [],
        confidence: 1,
        clarifyText: 'Career timing',
        safety: 'ok',
      },
      finishReason: 'STOP',
      stoppedForLoop: false,
      failedRequired: [],
      model: 'gemini-3.1-flash-lite',
      useModel: false,
      guard,
      cacheOwner: { userId: 'u1', kundliId: 'k1' },
    });
    expect(v.answered).toBe(true);
    expect(evictValidatorCacheForIndividual({ userId: 'u1', kundliId: 'k1' })).toBe(0);
    expect(evictClarifyCacheForIndividual({ userId: 'u1', kundliId: 'k1' })).toBe(0);
  });
});
