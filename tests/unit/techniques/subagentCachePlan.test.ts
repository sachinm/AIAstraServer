import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { classifyRules } from '../../../src/reading/buckets/classifier.js';
import { prewarmNatalLayers } from '../../../src/reading/clarify/prewarm.js';
import { startClarify } from '../../../src/reading/clarify/machine.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import type { ActivationRow } from '../../../src/reading/digest/activation.js';
import type { AnnualRow, DigestView, HouseCard, PlanetCard, PointRow, StarProfile, YogaRow } from '../../../src/reading/digest/types.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import { G1_AS_OF } from '../../helpers/readingFixtures.js';
import { TECHNIQUES } from '../../../src/techniques/catalog.js';
import {
  allTechniqueSubAgentCachePlans,
  buildTechniquePreRunCacheBundle,
  subAgentsForTechnique,
  summarizeTechniqueSubAgentCachePlans,
  techniqueSubAgentCachePlan,
} from '../../../src/techniques/subagentCachePlan.js';

function makeFixtureDigest(kundliId = 'k-test-123'): DigestView {
  const housesByVarga: Record<string, HouseCard[]> = {
    D1: Array.from({ length: 12 }, (_, idx) => ({
      varga: 'D1',
      house: idx + 1,
      sign: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][idx]!,
      lord: ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'][idx]!,
      lordHouse: ((idx + 3) % 12) + 1,
      lordSign: 'Capricorn',
      lordDignity: 'Exalted',
      coLord: null,
      occupants: idx === 9 ? [{ planet: 'Sa', dignity: 'Own', nature: 'benefic' }] : [],
      aspectedGraha: ['Ju'],
      aspectedRasi: ['Sa'],
      argala: { primary: ['Ju'], secondary: [], obstructed: [] },
      sav: 32,
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
  };

  const planetsByVarga: Record<string, PlanetCard[]> = {
    D1: [
      {
        varga: 'D1',
        planet: 'Sa',
        sign: 'Capricorn',
        house: 10,
        degree: 21.5,
        star: 'Shravana',
        pada: 2,
        starLord: 'Mo',
        dignity: 'Own',
        retro: false,
        combust: false,
        war: false,
        dispositor: 'Sa',
        dispositorHouse: 10,
        chain: ['Sa'],
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
  };

  const yogas: YogaRow[] = [
    { id: 'sasa_yoga', name: 'Sasa Mahapurusha Yoga', planets: ['Sa'], houses: [10], class: 'raja', source: 'BPHS' },
  ];

  const points: PointRow[] = [
    { id: 'AK', varga: 'D1', sign: 'Capricorn', house: 10, lord: 'Sa', lordHouse: 10 },
    { id: 'AL', varga: 'D1', sign: 'Capricorn', house: 10, lord: 'Sa', lordHouse: 10 },
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

function makeFixtureActivation(): ActivationRow[] {
  return [
    {
      system: 'vimsottari',
      family: 'vimshottari',
      level: 1,
      lord: 'Sa',
      sign: null,
      from: '2019-01-01',
      to: '2038-01-01',
      houses: [10, 11],
      parentLord: null,
    },
    {
      system: 'vimsottari',
      family: 'vimshottari',
      level: 2,
      lord: 'Ke',
      sign: null,
      from: '2026-08-22',
      to: '2027-09-07',
      houses: [10],
      parentLord: 'Sa',
    },
  ];
}

describe('subagentCachePlan — decoupled technique pieces to LLM cache upload & sub-agent prewarm', () => {
  it('produces a complete plan for every technique in TECHNIQUES', () => {
    const plans = allTechniqueSubAgentCachePlans();
    expect(plans.length).toBe(TECHNIQUES.length);

    for (const plan of plans) {
      expect(plan.techniqueId).toBeTruthy();
      expect(plan.recipe.id).toBe(plan.techniqueId);
      expect(plan.recipe.readers.length).toBeGreaterThan(0);
      expect(plan.outputCache.outputPiece).toMatch(/^output:/);
      expect(plan.processes.preRunDataPreparation.length).toBeGreaterThan(0);
      expect(plan.processes.preRunCacheUploadAndWarm.length).toBeGreaterThan(0);
      expect(plan.processes.liveRequestExecution.length).toBeGreaterThan(0);
      expect(plan.processes.invalidationAndRecycleSweep.length).toBeGreaterThan(0);
    }
  });

  it('maps General Reading LLM analysts and Oracle readers to Gemini cachedContents + reading_findings_cache', () => {
    const promisePlan = techniqueSubAgentCachePlan('general.promise')!;
    expect(promisePlan.subAgents).toEqual(['specialist:promise']);
    expect(promisePlan.llmCacheUpload.usesLlmCache).toBe(true);
    expect(promisePlan.llmCacheUpload.cacheStore).toBe('gemini_cached_contents+llm_cache_entries');
    expect(promisePlan.llmCacheUpload.systemPromptPiece).toBe('prompt:src/reading/prompts/v2/promise.md');
    expect(promisePlan.llmCacheUpload.cachedPrefixReaderPieces).toEqual([
      'reader:house/house_card',
      'reader:planet/planet_card',
      'reader:point/point_row',
      'reader:yoga/yoga_row',
    ]);
    expect(promisePlan.outputCache.primaryTable).toBe('reading_findings_cache');
    expect(promisePlan.outputCache.freshness).toBe('natal');
    expect(promisePlan.outputCache.recycledEvery45m).toBe(true);

    const readerPlan = techniqueSubAgentCachePlan('general.reader')!;
    expect(readerPlan.subAgents).toHaveLength(17); // R01..R14 + P1..P3
    expect(readerPlan.llmCacheUpload.usesLlmCache).toBe(true);
    expect(readerPlan.llmCacheUpload.systemPromptPiece).toBe('prompt:src/reading/prompts/readers/_shared.md');
    expect(readerPlan.outputCache.primaryTable).toBe('reading_findings_cache');
    expect(readerPlan.outputCache.recycledEvery45m).toBe(true);
  });

  it('maps deterministic General Reading code readers to technique_outputs + paired Oracle readers', () => {
    for (const id of ['general.varga_dynamics', 'general.jaimini', 'general.strength_yoga', 'general.person']) {
      const plan = techniqueSubAgentCachePlan(id)!;
      expect(plan.llmCacheUpload.usesLlmCache).toBe(false);
      expect(plan.llmCacheUpload.cacheStore).toBe('none_deterministic_code');
      expect(plan.outputCache.primaryTable).toBe('reading_findings_cache+technique_outputs');
      expect(plan.outputCache.freshness).toBe('natal');
      expect(plan.subAgents.some((s) => s.startsWith('code:'))).toBe(true);
    }
    expect(subAgentsForTechnique('general.strength_yoga')).toEqual(['code:strength_yoga', 'code:avastha', 'R05', 'R06']);
  });

  it('maps Self, Love, Work, Lucky, Life, and Digest techniques to zero-LLM deterministic stores', () => {
    const selfPromise = techniqueSubAgentCachePlan('self.promise')!;
    expect(selfPromise.llmCacheUpload.usesLlmCache).toBe(false);
    expect(selfPromise.outputCache.primaryTable).toBe('technique_outputs');
    expect(selfPromise.outputCache.freshness).toBe('natal');

    const workTone = techniqueSubAgentCachePlan('work.present_tone')!;
    expect(workTone.llmCacheUpload.usesLlmCache).toBe(false);
    expect(workTone.outputCache.primaryTable).toBe('technique_outputs');
    expect(workTone.outputCache.freshness).toBe('transit');

    const luckyDayTables = techniqueSubAgentCachePlan('lucky.day_tables')!;
    expect(luckyDayTables.outputCache.primaryTable).toBe('day_tables+kundli_day_overlays');
    expect(luckyDayTables.outputCache.freshness).toBe('daily');
    expect(luckyDayTables.outputCache.recycledEvery45m).toBe(false); // shared sky across users

    const luckyOverlay = techniqueSubAgentCachePlan('lucky.personal_overlay')!;
    expect(luckyOverlay.outputCache.primaryTable).toBe('day_tables+kundli_day_overlays');
    expect(luckyOverlay.outputCache.recycledEvery45m).toBe(true); // personal per-kundli overlay

    const digestBuild = techniqueSubAgentCachePlan('digest.build')!;
    expect(digestBuild.outputCache.primaryTable).toBe('kundli_digest+kundli_activation');
  });

  it('materializes pre-run sub-agent cache bundles directly from DigestView + ActivationRow[] with zero DB queries', () => {
    const digest = makeFixtureDigest();
    const activation = makeFixtureActivation();
    const now = new Date('2026-11-06T13:15:00Z');

    const promiseBundle = buildTechniquePreRunCacheBundle({
      techniqueId: 'general.promise',
      digest,
      activation,
      context: { now },
    });
    expect(promiseBundle.plan.techniqueId).toBe('general.promise');
    expect(promiseBundle.window.freshness).toBe('natal');
    expect(promiseBundle.subAgentSlices).toHaveLength(1);
    const slice = promiseBundle.subAgentSlices[0]!;
    expect(slice.subAgentId).toBe('specialist:promise');
    expect(slice.coreText).toContain('CHART CORE');
    expect(slice.tables['varga.d1']).toBeDefined();
    expect(slice.tables['dignities']).toBeDefined();
    expect(slice.tables['yogas']).toBeDefined();
    expect(slice.missing).toEqual([]);

    const readerBundle = buildTechniquePreRunCacheBundle({
      techniqueId: 'general.reader',
      digest,
      activation,
      context: { now },
    });
    expect(readerBundle.subAgentSlices).toHaveLength(17);
    const r08 = readerBundle.subAgentSlices.find((s) => s.subAgentId === 'R08')!;
    expect(r08.tables['dasha.vimsottari']).toBeDefined();
    expect(r08.missing).toEqual([]);

    const prashnaBundle = buildTechniquePreRunCacheBundle({
      techniqueId: 'general.prashna',
      digest,
      activation,
      context: { now },
      prashna: { lagna: 'Aries', houses: [] },
      transitRows: [{ planet: 'Sa', sign: 'Pisces', house: 12 }],
    });
    expect(prashnaBundle.subAgentSlices).toHaveLength(1);
    expect(prashnaBundle.subAgentSlices[0]!.subAgentId).toBe('specialist:prashna');
    expect(prashnaBundle.subAgentSlices[0]!.missing).toEqual([]);
  });

  it('summarizes LLM-cached vs deterministic code techniques accurately', () => {
    const summary = summarizeTechniqueSubAgentCachePlans();
    expect(summary.totalTechniques).toBe(TECHNIQUES.length);
    expect(summary.llmCachedTechniques).toEqual(
      expect.arrayContaining([
        'general.promise',
        'general.dasha',
        'general.transit',
        'general.nakshatra',
        'general.annual',
        'general.prashna',
        'general.reader',
        'general.oracle',
      ]),
    );
    expect(summary.systemPromptOnlyTechniques).toEqual(
      expect.arrayContaining(['general.intake', 'general.clarify', 'general.validator']),
    );
    expect(summary.subAgentSpecCount).toBeGreaterThanOrEqual(32);
  });

  it('persists prewarmed natal specialist findings to reading_findings_cache across Lambda instances', async () => {
    process.env.READING_FACTS_SOURCE = 'fixture';
    process.env.READING_FLOW = 'graph';
    findingsCache.clear();
    clearReadingCaches();

    const savedRows: unknown[] = [];
    const prisma = {
      readingPrompt: { findFirst: vi.fn().mockResolvedValue(null) },
      systemPrompt: { findFirst: vi.fn().mockResolvedValue(null) },
      readingFindingsCache: {
        findUnique: vi.fn(async () => null),
        upsert: vi.fn(async (args: unknown) => {
          savedRows.push(args);
          return {};
        }),
      },
    } as unknown as PrismaClient;

    const q = 'Should I change my job next year?';
    const state = startClarify(q, G1_AS_OF, classifyRules(q, G1_AS_OF), {
      mode: 'when_missing',
      threshold: 0.7,
      card: null,
    });
    const fakeSpecialist = vi.fn(async ({ analyst, subject }: { analyst: string; subject: string }) => ({
      finding: {
        analyst: analyst as 'promise',
        subject: subject as 'career_work',
        verdict: 'strong',
        layerScore: 2,
        status: 'ok',
        claims: [],
        windows: [],
        caveats: [],
        keyFacts: [],
      },
      usage: { node: analyst, model: 'fake', promptTokens: 1, cachedTokens: 0, outputTokens: 1, thoughtTokens: 0, ms: 1 },
    }));

    const res = await prewarmNatalLayers(prisma, 'user-prewarm-1', state, {
      specialist: fakeSpecialist as never,
    });
    expect(res.ran).toEqual(['promise']);
    expect(savedRows).toHaveLength(1);
    delete process.env.READING_FACTS_SOURCE;
    delete process.env.READING_FLOW;
  });
});
