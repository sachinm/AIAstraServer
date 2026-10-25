import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A plain delegating function, not a spy: this vitest version flags a spy whose implementation throws or rejects after
// the test body ends, even when the code under test handles it. Call counts are kept by hand.
const engine = vi.hoisted(() => ({ impl: null as null | ((...a: unknown[]) => Promise<unknown>), calls: 0 }));
vi.mock('../../../src/reading/data/engineClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/reading/data/engineClient.js')>();
  return {
    ...actual,
    fetchFacts: (...a: unknown[]) => {
      engine.calls += 1;
      return engine.impl!(...a);
    },
  };
});

import { EngineUnsupportedError } from '../../../src/reading/data/engineClient.js';
import { buildFactsForKundli, projectNatalPoints, sourceHash } from '../../../src/reading/data/factsBuilder.js';
import { loadG1Dossier } from '../../helpers/readingFixtures.js';

function makePrisma(existing: { source_hash: string } | null = null) {
  const kundliUpdate = vi.fn().mockResolvedValue({});
  const upsert = vi.fn().mockResolvedValue({});
  const prisma = {
    kundli: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'k1', lat: null, lon: null, tz: null, facts_status: 'pending',
        user: { date_of_birth: '2002-04-27', place_of_birth: 'South Grafton, India', time_of_birth: '17:05:00' },
      }),
      update: kundliUpdate,
    },
    kundliFacts: { findUnique: vi.fn().mockResolvedValue(existing), upsert },
    $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
  } as unknown as PrismaClient;
  return { prisma, kundliUpdate, upsert };
}

const SAME_SOURCE = () => sourceHash(['2002-04-27', '17:05:00', 'South Grafton, India', 1]);

beforeEach(() => {
  engine.calls = 0;
  engine.impl = async () => loadG1Dossier();
});

describe('buildFactsForKundli', () => {
  it('stores the dossier, natal points and the coordinates the engine resolved', async () => {
    const m = makePrisma();
    const r = await buildFactsForKundli(m.prisma, 'k1');
    expect(r.status).toBe('ready');
    expect(m.upsert).toHaveBeenCalledTimes(1);
    const arg = m.upsert.mock.calls[0]![0];
    expect(arg.create.facts_version).toBe(1);
    expect(arg.create.dossier_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(arg.create.natal_points.points.Ju.sign).toBe(2);
    const lastUpdate = m.kundliUpdate.mock.calls.at(-1)![0];
    expect(lastUpdate.data).toMatchObject({ facts_status: 'ready', lat: 28.9167, lon: 77.0167, tz: 5.5 });
  });

  it('skips when the stored dossier was built from the same birth data', async () => {
    const m = makePrisma({ source_hash: SAME_SOURCE() });
    const r = await buildFactsForKundli(m.prisma, 'k1');
    expect(r).toMatchObject({ status: 'skipped', reason: 'up to date' });
    expect(engine.calls).toBe(0);
  });

  it('rebuilds when forced', async () => {
    const m = makePrisma({ source_hash: SAME_SOURCE() });
    expect((await buildFactsForKundli(m.prisma, 'k1', { force: true })).status).toBe('ready');
    expect(engine.calls).toBe(1);
  });

  it('marks the kundli failed (unsupported) when the engine does not serve facts yet, without throwing', async () => {
    engine.impl = async () => {
      throw new EngineUnsupportedError('engine does not serve type=facts yet');
    };
    const m = makePrisma();
    const r = await buildFactsForKundli(m.prisma, 'k1');
    expect(r).toMatchObject({ status: 'failed', unsupported: true });
    expect(m.upsert).not.toHaveBeenCalled();
    expect(m.kundliUpdate.mock.calls.at(-1)![0].data).toEqual({ facts_status: 'failed' });
  });

  it('records other engine errors as failed but not unsupported', async () => {
    engine.impl = async () => {
      throw new Error('Lambda timed out');
    };
    const m = makePrisma();
    const r = await buildFactsForKundli(m.prisma, 'k1');
    expect(r).toMatchObject({ status: 'failed', unsupported: false });
  });

  it('collapses concurrent builds of the same kundli into one engine call', async () => {
    engine.impl = () => new Promise((res) => setTimeout(() => res(loadG1Dossier()), 40));
    const m = makePrisma();
    await Promise.all([buildFactsForKundli(m.prisma, 'k1'), buildFactsForKundli(m.prisma, 'k1')]);
    expect(engine.calls).toBe(1);
  });
});

describe('projectNatalPoints', () => {
  it('is a pure projection of longitudes, signs and arudha signs', () => {
    const d = loadG1Dossier();
    const np = projectNatalPoints(d as never) as { points: Record<string, { lon: number }>; arudha_signs: Record<string, number> };
    expect(np.points.Ju!.lon).toBe(d.bodies.Ju!.lon);
    expect(np.arudha_signs.AL).toBe(d.arudhas.AL!.sign);
  });
});
