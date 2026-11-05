import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  clearPastReadingMemoryStore,
  computeScorecard,
  generatePastLifeReadingReport,
  getPastLifeReading,
  ratePastLifePrediction,
} from '../../../../src/reading/timeline/pastReadingFlow.js';
import { registerTimelineRoutes } from '../../../../src/routes/timelineRoutes.js';
import { fakeRequireUser } from '../../../helpers/fakeAuth.js';

beforeEach(() => clearPastReadingMemoryStore());

function createMockPrisma(declinedTopics: string[] = []): PrismaClient {
  return {
    kundli: {
      findFirst: async ({ where }: { where: { id?: string; user_id: string } }) =>
        where.user_id ? { id: where.id ?? 'k-sachin', user_id: where.user_id } : null,
    },
    auth: {
      findUnique: async () => ({ role: 'user' }),
    },
    declinedTopic: {
      findMany: async () => declinedTopics.map((topic) => ({ topic, match_terms: [topic] })),
    },
  } as unknown as PrismaClient;
}

describe('pastReadingFlow multi-agentic 18-year retrospective engine', () => {
  it('generates a complete 4-epoch 18-year retrospective with blind predictions across all 6 life domains and >= 3 proofs each', async () => {
    const prisma = createMockPrisma();
    const report = await generatePastLifeReadingReport(prisma, 'u-sachin', 'k-sachin', {
      asOf: '2026-12-31',
      years: 18,
    });

    expect(report.windowStart.startsWith('2008')).toBe(true);
    expect(report.windowEnd.startsWith('2026')).toBe(true);
    expect(report.charterOverview.primaryConditionalDasha).toContain('Dwisaptati Sama Dasha');
    expect(report.epochs).toHaveLength(4);
    expect(report.predictions.length).toBeGreaterThanOrEqual(8);

    const domains = new Set(report.predictions.map((p) => p.domain));
    expect(domains).toEqual(
      new Set([
        'career_wealth',
        'education_college',
        'relationships_family',
        'relocation_vehicles',
        'health_psychology',
        'micro_signature',
      ])
    );

    for (const pred of report.predictions) {
      expect(pred.astrologicalBasis.dashas.length).toBeGreaterThanOrEqual(2);
      expect(pred.astrologicalBasis.vargasAndArudhas.length).toBeGreaterThanOrEqual(1);
      expect(pred.feelingAndPsychology.length).toBeGreaterThan(20);
      expect(pred.rating).toBe('unrated');
    }

    expect(report.claimVerificationAudit.disambiguatedEntities).toHaveLength(3);
    expect(report.jupiterBehavioralPlaybook.tiers.sattvicOptimal).toContain('Sattvic');
    expect(report.jupiterBehavioralPlaybook.windows2026To2029.length).toBeGreaterThanOrEqual(8);
    expect(report.venusBehavioralPlaybook.whyRaVe2025To2026WasPoorestAndEclipsed).toContain('Mar 3, 2026');
    expect(report.venusBehavioralPlaybook.fourFamilyChartsSavingGrace).toContain('Sister-in-Law');
    expect(report.marsSaturnBehavioralPlaybook.roadmap1MonthTo15Years.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(report)).not.toMatch(/\b(Radha|pyjhora|AIAstra_Radha|jhora)\b/i);

    const cached = await getPastLifeReading(prisma, 'u-sachin', 'k-sachin');
    expect(cached?.kundliId).toBe('k-sachin');
  });

  it('rates predictions and computes accuracy scorecard and diagnostic audit notes', async () => {
    const prisma = createMockPrisma();
    const initial = await generatePastLifeReadingReport(prisma, 'u-rate', 'k-rate');
    const firstId = initial.predictions[0]!.id;
    const secondId = initial.predictions[1]!.id;

    const r1 = await ratePastLifePrediction(prisma, 'u-rate', 'k-rate', {
      predictionId: firstId,
      rating: 'exact_hit',
      actualRealityNote: 'Happened exactly in that window.',
      whyMissedOrWorkedNote: 'Dwisaptati + Narayana + Tithi Pravesha converged.',
    });
    expect(r1.status).toBe('ok');

    const r2 = await ratePastLifePrediction(prisma, 'u-rate', 'k-rate', {
      predictionId: secondId,
      rating: 'partial_hit',
      actualRealityNote: 'Right event, 2 months later.',
      whyMissedOrWorkedNote: 'Retrograde Saturn delayed delivery until direct station.',
    });
    expect(r2.status).toBe('ok');
    if (r2.status === 'ok') {
      expect(r2.report.scorecard.rated).toBe(2);
      expect(r2.report.scorecard.exactHits).toBe(1);
      expect(r2.report.scorecard.partialHits).toBe(1);
      expect(r2.report.scorecard.accuracyScorePct).toBe(75);
      expect(computeScorecard(r2.report.predictions).accuracyScorePct).toBe(75);
    }
  });
});

describe('timeline past-reading HTTP routes', () => {
  let server: ReturnType<express.Express['listen']>;
  let base = '';

  beforeAll(async () => {
    const fakePrisma = createMockPrisma();
    const app = express();
    app.use(express.json());
    registerTimelineRoutes(app, {
      prisma: fakePrisma,
      requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) || null),
      enabled: true,
    });
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('serves GET /api/timeline/past-reading (404 before generation, 200 after), POST /api/timeline/past-reading/generate, and POST /api/timeline/past-reading/rate', async () => {
    const initialGet = await fetch(`${base}/api/timeline/past-reading?kundliId=k-http`, {
      headers: { 'x-user': 'u-http' },
    });
    expect(initialGet.status).toBe(404);

    const genRes = await fetch(`${base}/api/timeline/past-reading/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user': 'u-http' },
      body: JSON.stringify({ kundliId: 'k-http', years: 18 }),
    });
    expect(genRes.status).toBe(200);
    const genJson = (await genRes.json()) as any;
    expect(genJson.report.kundliId).toBe('k-http');
    expect(genJson.report.predictions.length).toBeGreaterThanOrEqual(10);

    const getRes = await fetch(`${base}/api/timeline/past-reading?kundliId=k-http`, {
      headers: { 'x-user': 'u-http' },
    });
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as any;
    expect(getJson.report.kundliId).toBe('k-http');

    const predId = getJson.report.predictions[0].id as string;
    const rateRes = await fetch(`${base}/api/timeline/past-reading/rate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user': 'u-http' },
      body: JSON.stringify({
        kundliId: 'k-http',
        predictionId: predId,
        rating: 'exact_hit',
        actualRealityNote: 'Verified college and friend archetype.',
        whyMissedOrWorkedNote: 'D24 + 11th house Ketu-Saturn.',
      }),
    });
    expect(rateRes.status).toBe(200);
    const rateJson = (await rateRes.json()) as any;
    expect(rateJson.report.scorecard.exactHits).toBe(1);
    expect(rateJson.report.scorecard.accuracyScorePct).toBe(100);
  });
});
