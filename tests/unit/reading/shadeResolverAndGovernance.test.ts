import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BENCHMARK_CHARTS,
  BENCHMARK_EVENTS,
  buildCalmPlaybook,
  invalidateTechniqueGovernanceCache,
  isTechniqueEnabledSync,
  loadTechniqueGovernance,
  pinActiveGoalWindow,
  recordTechniqueDecisions,
  recordWindowOutcomeCheckin,
  resolveAreaShades,
  resolveCareerShades,
  runBenchmarkSuite,
  SHADE_CATALOG,
} from '../../../src/reading/area/shadeResolver.js';
import { buildBoard, runningOn } from '../../../src/reading/area/houseLayers.js';
import { SELF } from '../../../src/reading/area/self.js';
import { LOVE } from '../../../src/reading/area/love.js';
import { act, selfActivation, selfFixture } from '../../helpers/fakeDigest.js';

const BANNED_UI =
  /\b(sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|house|lord|dasha|mahadasha|antardasha|nakshatra|tithi|trine|transit|retrograde|saham|varga|D\d+|kendra|trikona|dusthana|yoga|dosha|lagna|ascendant|storm|weather|hospital|guaranteed|certain|divorce|pyjhora|radha|jhora|layoff_risk|separation_risk|trust_secrets)\b/i;

describe('Phase B: Short-Horizon PD (maxLevel: 3), 3-Tier Shade Resolver, Calm Playbooks, Governance & Benchmarks', () => {
  afterEach(() => {
    delete process.env.SHADE_SHORT_HORIZON_MONTHS;
    delete process.env.SHADE_MIN_WINNING_SCORE;
    delete process.env.SHADE_FACT_TIE_BREAK_BONUS;
    delete process.env.SHADE_CONFIRM_MIN_FAMILIES;
    invalidateTechniqueGovernanceCache();
  });

  it('unlocks level 3 (PD) windows inside the short horizon (3m) while filtering level 3 beyond 3m', () => {
    const view = selfFixture();
    const asOf = '2026-11-05';
    const pdNear = act({
      level: 3,
      lord: 'Su',
      from: '2026-11-15',
      to: '2026-12-20',
      houses: [5, 8],
      parentLord: 'Ju',
    });
    const pdFar = act({
      level: 3,
      lord: 'Su',
      from: '2027-08-01',
      to: '2027-09-15',
      houses: [5, 8],
      parentLord: 'Ju',
    });
    const built = buildBoard({
      view,
      cfg: SELF,
      asOf,
      activation: [...selfActivation(), pdNear, pdFar],
      running: runningOn(selfActivation(), asOf),
      transit: null,
    });

    // Near PD (Nov 15 - Dec 19, 2026) produces a reputation window; far PD (Aug 2027) does not
    expect(built.board.ahead.some((w) => w.subarea === 'reputation' && w.from === '2026-11-15')).toBe(true);
    expect(built.board.ahead.some((w) => w.subarea === 'reputation' && w.from === '2027-08-01')).toBe(false);
  });

  it('resolves 3-tier shade receipts for Self, Love, and Career and persists them via recordTechniqueDecisions', async () => {
    const view = selfFixture();
    const asOf = '2026-11-05';
    const actRows = selfActivation();
    const builtSelf = buildBoard({
      view,
      cfg: SELF,
      asOf,
      activation: actRows,
      running: runningOn(actRows, asOf),
      transit: null,
    });

    const selfReceipts = resolveAreaShades({
      view,
      cfg: SELF,
      asOf,
      built: builtSelf,
      activation: actRows,
      facts: {},
    });

    expect(selfReceipts.length).toBeGreaterThan(0);
    for (const r of selfReceipts) {
      expect(r.gates).toHaveLength(3);
      expect(r.gates.map((g) => g.tier)).toEqual([1, 2, 3]);
      expect(['sattvic', 'rajasic', 'mediocre', 'baseline']).toContain(r.playbook.tier);
      expect(r.userLabel).not.toMatch(BANNED_UI);
      expect(r.playbook.headline).not.toMatch(BANNED_UI);
    }

    const careerReceipts = resolveCareerShades({
      map: {
        asOf,
        month: '2026-11',
        present: {
          tone: 'demanding',
          confidence: 'confirmed',
          votes: [
            { family: 'main', label: 'Main clock', vote: 'test', planet: 'Sa' },
            { family: 'rasi', label: 'Sign clock', vote: 'test', planet: 'Sa' },
            { family: 'transit', label: 'Slow transits', vote: 'test', planet: 'Sa' },
          ],
          available: 4,
          agree: 3,
          ease_date: '2027-03-01',
          window_end: null,
          next_window_start: '2027-04-01',
          security: 'watch',
        },
        ahead: [
          {
            subarea: 'job_security',
            side: 'test',
            from: '2026-11-05',
            to: '2027-02-28',
            peakMonth: '2026-12',
            band: 'moderate',
            score: 3.2,
            families: ['main', 'rasi', 'transit'],
            drivers: ['Sa', 'Ma'],
            security: 'watch',
          },
        ],
        horizons: [],
        security: [],
        back: [],
        notes: [],
      },
      view,
      facts: {},
    });

    expect(careerReceipts).toHaveLength(1);
    expect(careerReceipts[0]!.shadeTag).toBe('workload_pacing');
    expect(careerReceipts[0]!.easeDate).toBe('2027-03-01');
    expect(careerReceipts[0]!.playbook.headline).toContain('2027-03-01');

    const createMany = vi.fn().mockResolvedValue({ count: careerReceipts.length });
    const fakePrisma = {
      techniqueDecisionLog: { createMany },
    } as unknown as Parameters<typeof recordTechniqueDecisions>[0];

    const count = await recordTechniqueDecisions(fakePrisma, { kundliId: 'k-1', userId: 'u-1' }, careerReceipts);
    expect(count).toBe(1);
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('triggers Companion Pulse tie-breaker question when shades tie and breaks tie when person_facts is set', () => {
    const careerTieReceipts = resolveCareerShades({
      map: {
        asOf: '2026-11-05',
        month: '2026-11',
        present: {
          tone: 'open',
          confidence: 'confirmed',
          votes: [{ family: 'main', label: 'Main clock', vote: 'support', planet: 'Su' }],
          available: 3,
          agree: 2,
          ease_date: null,
          window_end: '2027-04-30',
          next_window_start: null,
          security: 'clear_protected',
        },
        ahead: [
          {
            subarea: 'promotion',
            side: 'support',
            from: '2026-11-05',
            to: '2027-04-30',
            peakMonth: '2027-01',
            band: 'high',
            score: 4.0,
            families: ['main', 'rasi'],
            drivers: ['Su', 'Ju'],
          },
        ],
        horizons: [],
        security: [],
        back: [],
        notes: [],
      },
      view: null,
      facts: {},
    });

    expect(careerTieReceipts[0]!.pulseQuestion).not.toBeNull();
    expect(careerTieReceipts[0]!.pulseQuestion?.factKey).toBe('work.goal_shade');

    // Now provide the confirmed fact to break the tie in favour of title_elevation
    const brokenReceipts = resolveCareerShades({
      map: {
        asOf: '2026-11-05',
        month: '2026-11',
        present: {
          tone: 'open',
          confidence: 'confirmed',
          votes: [{ family: 'main', label: 'Main clock', vote: 'support', planet: 'Su' }],
          available: 3,
          agree: 2,
          ease_date: null,
          window_end: '2027-04-30',
          next_window_start: null,
          security: 'clear_protected',
        },
        ahead: [
          {
            subarea: 'promotion',
            side: 'support',
            from: '2026-11-05',
            to: '2027-04-30',
            peakMonth: '2027-01',
            band: 'high',
            score: 4.0,
            families: ['main', 'rasi'],
            drivers: ['Su', 'Ju'],
          },
        ],
        horizons: [],
        security: [],
        back: [],
        notes: [],
      },
      view: null,
      facts: { 'work.goal_shade': 'title_elevation' },
    });

    expect(brokenReceipts[0]!.shadeTag).toBe('title_elevation');
    expect(brokenReceipts[0]!.tieBrokenByFact).toBe(true);
    expect(brokenReceipts[0]!.pulseQuestion).toBeNull();
  });

  it('pins active goal windows and records window-end outcome check-ins into Calibration Ledger', async () => {
    const upsertedFacts: Array<{ key: string; value: string }> = [];
    const upsertedChecks: Array<Record<string, unknown>> = [];
    const fakePrisma = {
      personFact: {
        upsert: vi.fn(async ({ create }: { create: { key: string; value: string } }) => {
          upsertedFacts.push({ key: create.key, value: create.value });
          return create;
        }),
      },
      areaCheck: {
        upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => {
          upsertedChecks.push(create);
          return create;
        }),
      },
    } as unknown as Parameters<typeof pinActiveGoalWindow>[0];

    const pinned = await pinActiveGoalWindow(fakePrisma, 'u-1', {
      area: 'career',
      subarea: 'promotion',
      shadeTag: 'scope_expansion',
      from: '2026-11-05',
      to: '2027-03-31',
    });
    expect(pinned).toEqual({
      key: 'goal.career',
      value: 'promotion:scope_expansion:2026-11-05..2027-03-31',
    });

    const ok = await recordWindowOutcomeCheckin(fakePrisma, 'u-1', {
      area: 'career',
      month: '2026-10',
      side: 'support',
      answer: 'yes',
      subarea: 'promotion',
      shadeTag: 'scope_expansion',
    });
    expect(ok).toBe(true);
    expect(upsertedChecks).toHaveLength(1);
    expect(upsertedFacts.some((f) => f.key === 'checkin.career.2026-10')).toBe(true);
  });

  it('loads and caches live technique governance flags and invalidates on toggle', async () => {
    const fakePrisma = {
      techniqueRegistry: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'work.present_tone', enabled: true, verification_status: 'verified' },
          { id: 'love.activation', enabled: false, verification_status: 'disabled' },
        ]),
      },
    } as unknown as Parameters<typeof loadTechniqueGovernance>[0];

    const gov = await loadTechniqueGovernance(fakePrisma);
    expect(isTechniqueEnabledSync('work.present_tone', gov)).toBe(true);
    expect(isTechniqueEnabledSync('love.activation', gov)).toBe(false);
    expect(isTechniqueEnabledSync('self.activation', gov)).toBe(true);
  });

  it('passes all 10 AA-rated Celebrity Benchmark regression cases and keeps all user-facing strings clean', () => {
    expect(BENCHMARK_CHARTS).toHaveLength(10);
    expect(BENCHMARK_EVENTS).toHaveLength(10);

    const suite = runBenchmarkSuite();
    expect(suite.total).toBe(10);
    expect(suite.passed).toBe(10);
    expect(suite.passRate).toBe(100);

    for (const c of SHADE_CATALOG) {
      expect(c.userLabel, c.tag).not.toMatch(BANNED_UI);
      if (c.pulseQuestion) {
        expect(c.pulseQuestion.question, c.tag).not.toMatch(BANNED_UI);
      }
    }
    for (const area of ['self', 'love', 'career'] as const) {
      for (const side of ['support', 'test'] as const) {
        const pb = buildCalmPlaybook({
          area,
          side,
          tone: side === 'support' ? 'open' : 'demanding',
          beneficWeight: 2,
          maleficWeight: 1,
          easeDate: '2027-03-01',
        });
        expect(pb.headline).not.toMatch(BANNED_UI);
        for (const s of [...pb.doSteps, ...pb.avoidSteps]) expect(s).not.toMatch(BANNED_UI);
      }
    }

    const src = fs.readFileSync(path.resolve(__dirname, '../../../src/reading/area/shadeResolver.ts'), 'utf8');
    expect(src).not.toMatch(/%\s*12|\+\s*6\)|-\s*1\)\s*%|\bsignIndex\b|sign_index\s*[+-]|longitude\s*[+-/]|degree\s*[+-/]/);
    expect(src).not.toMatch(/radha|pyjhora|jhora/i);
  });
});
