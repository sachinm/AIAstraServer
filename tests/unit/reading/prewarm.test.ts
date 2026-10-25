import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { classifyRules } from '../../../src/reading/buckets/classifier.js';
import { startClarify } from '../../../src/reading/clarify/machine.js';
import { prewarmNatalLayers, prewarmWithCap } from '../../../src/reading/clarify/prewarm.js';
import { findingsCache } from '../../../src/reading/nodes/findingsCache.js';
import { clearReadingCaches } from '../../../src/reading/data/store.js';
import type { Finding, SpecialistAnalyst } from '../../../src/reading/nodes/specialists.js';
import { G1_AS_OF } from '../../helpers/readingFixtures.js';

const prisma = { readingPrompt: { findFirst: vi.fn().mockResolvedValue(null) }, systemPrompt: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
const state = (q: string) => startClarify(q, G1_AS_OF, classifyRules(q, G1_AS_OF), { mode: 'when_missing', threshold: 0.7, card: null });
const fakeSpecialist = vi.fn(async ({ analyst, subject }: { analyst: SpecialistAnalyst; subject: string }) => ({
  finding: { analyst, subject, verdict: 'strong', layerScore: 2, status: 'ok', claims: [], windows: [], caveats: [], keyFacts: [] } as unknown as Finding,
  usage: { node: analyst, model: 'fake', promptTokens: 1, cachedTokens: 0, outputTokens: 1, thoughtTokens: 0, ms: 1 },
}));

describe('clarify prewarm (Track B)', () => {
  beforeEach(() => {
    process.env.READING_FACTS_SOURCE = 'fixture';
    process.env.READING_FLOW = 'graph';
    findingsCache.clear();
    clearReadingCaches();
    fakeSpecialist.mockClear();
  });
  afterEach(() => {
    delete process.env.READING_FACTS_SOURCE;
    delete process.env.READING_FLOW;
  });

  it('runs the natal promise layer for the bucket frame while the clarifier waits, and caches it', async () => {
    const r = await prewarmNatalLayers(prisma, 'u1', state('When will I get married?'), { specialist: fakeSpecialist as never });
    expect(r.ran).toEqual(['promise']);
    expect(fakeSpecialist.mock.calls[0]![0]).toMatchObject({ analyst: 'promise', subject: 'marriage_relationship' });
    const again = await prewarmNatalLayers(prisma, 'u1', state('When will I get married?'), { specialist: fakeSpecialist as never });
    expect(again).toEqual({ ran: [], cached: ['promise'] });
  });

  it('does nothing on the single flow or for a question with no area', async () => {
    process.env.READING_FLOW = 'single';
    expect(await prewarmNatalLayers(prisma, 'u1', state('When will I get married?'), { specialist: fakeSpecialist as never })).toEqual({ ran: [], cached: [] });
    process.env.READING_FLOW = 'graph';
    expect(await prewarmNatalLayers(prisma, 'u1', state('Hello'), { specialist: fakeSpecialist as never })).toEqual({ ran: [], cached: [] });
    expect(fakeSpecialist).not.toHaveBeenCalled();
  });

  it('never throws and the cap bounds the wait', async () => {
    const failing = vi.fn(async () => {
      throw new Error('model down');
    });
    await expect(prewarmNatalLayers(prisma, 'u1', state('When will I get married?'), { specialist: failing as never })).resolves.toEqual({ ran: [], cached: [] });
    const t0 = Date.now();
    await prewarmWithCap(new Promise(() => undefined), 50);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
