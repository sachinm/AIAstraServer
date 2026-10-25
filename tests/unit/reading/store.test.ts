import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchTransitChartMock } = vi.hoisted(() => ({ fetchTransitChartMock: vi.fn() }));
vi.mock('../../../src/reading/data/engineClient.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/reading/data/engineClient.js')>();
  return { ...actual, fetchTransitChart: fetchTransitChartMock };
});

import { EngineUnsupportedError } from '../../../src/reading/data/engineClient.js';
import { clearReadingCaches, loadReadingData } from '../../../src/reading/data/store.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

function makePrisma(over: { facts?: unknown; transitRow?: unknown } = {}) {
  const dossier = loadG1Dossier();
  const findFacts = vi.fn().mockResolvedValue(over.facts === undefined ? { dossier, dossier_hash: 'h1', facts_version: 1 } : over.facts);
  const findTransit = vi.fn().mockResolvedValue(over.transitRow === undefined ? { id: 'ts1', snapshot: loadG1Transits() } : over.transitRow);
  const createTransit = vi.fn().mockResolvedValue({ id: 'ts-new' });
  const prisma = {
    kundli: { findFirst: vi.fn().mockResolvedValue({ id: 'k1', lat: 28.9, lon: 77.0, tz: 5.5 }) },
    kundliFacts: { findUnique: findFacts },
    transitSnapshot: { findFirst: findTransit, create: createTransit },
    auth: { findUnique: vi.fn().mockResolvedValue({ date_of_birth: '2002-04-27', place_of_birth: 'South Grafton, India', time_of_birth: '17:05:00' }) },
  } as unknown as PrismaClient;
  return { prisma, findFacts, findTransit, createTransit };
}

beforeEach(() => {
  clearReadingCaches();
  fetchTransitChartMock.mockReset();
  delete process.env.READING_FACTS_SOURCE;
  process.env.READING_CACHE_TTL_MS = '60000';
});
afterEach(() => {
  delete process.env.READING_CACHE_TTL_MS;
});

describe('loadReadingData (db source)', () => {
  it('returns the dossier and the stored transit chart, and caches both in process', async () => {
    const m = makePrisma();
    const first = await loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF });
    expect(first).not.toBeNull();
    expect(first!.timings.dossierCache).toBe('miss');
    expect(first!.transits).not.toBeNull();
    expect(first!.transitSnapshotId).toBe('ts1');
    const second = await loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF });
    expect(second!.timings.dossierCache).toBe('hit');
    expect(second!.timings.transitsCache).toBe('hit');
    expect(m.findFacts).toHaveBeenCalledTimes(1);
    expect(m.findTransit).toHaveBeenCalledTimes(1);
  });

  it('returns null and reports when there is no dossier yet', async () => {
    const m = makePrisma({ facts: null });
    const missing = vi.fn();
    const r = await loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF, onFactsMissing: missing });
    expect(r).toBeNull();
    expect(missing).toHaveBeenCalledWith('k1');
  });

  it('rejects a stored dossier that fails the schema and asks for a rebuild', async () => {
    const bad = { ...loadG1Dossier(), v: 2 };
    const m = makePrisma({ facts: { dossier: bad, dossier_hash: 'x', facts_version: 1 } });
    const missing = vi.fn();
    expect(await loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF, onFactsMissing: missing })).toBeNull();
    expect(missing).toHaveBeenCalled();
  });

  it('re-selects the running dasha for today when the dossier was built earlier', async () => {
    const m = makePrisma();
    const r = await loadReadingData(m.prisma, 'u1', { asOf: '2027-10-01' });
    expect(r!.dossier.as_of).toBe('2027-10-01');
    expect(r!.dossier.dasha.vimshottari.current.ad).toBe('Ve');
  });

  it('builds the transit chart lazily on a miss, stores it and serves it from memory afterwards', async () => {
    const m = makePrisma({ transitRow: null });
    fetchTransitChartMock.mockResolvedValue(loadG1Transits());
    const first = await loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF });
    expect(first!.timings.transitsCache).toBe('built');
    expect(m.createTransit).toHaveBeenCalledTimes(1);
    expect(m.createTransit.mock.calls[0]![0].data.kundli_id).toBe('k1');
    const second = await loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF });
    expect(second!.timings.transitsCache).toBe('hit');
    expect(fetchTransitChartMock).toHaveBeenCalledTimes(1);
  });

  it('degrades to no transits (not an error) when the engine does not serve them yet', async () => {
    const m = makePrisma({ transitRow: null });
    fetchTransitChartMock.mockRejectedValue(new EngineUnsupportedError('engine does not serve type=transits yet'));
    const r = await loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF });
    expect(r).not.toBeNull();
    expect(r!.transits).toBeNull();
    expect(r!.timings.transitsCache).toBe('none');
  });

  it('shares one in-flight transit build between concurrent questions', async () => {
    const m = makePrisma({ transitRow: null });
    fetchTransitChartMock.mockImplementation(() => new Promise((res) => setTimeout(() => res(loadG1Transits()), 50)));
    await Promise.all([loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF }), loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF })]);
    expect(fetchTransitChartMock).toHaveBeenCalledTimes(1);
  });

  it('returns null for a user with no kundli', async () => {
    const m = makePrisma();
    (m.prisma.kundli.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await loadReadingData(m.prisma, 'u1', { asOf: G1_AS_OF })).toBeNull();
  });
});

describe('loadReadingData (fixture source)', () => {
  it('serves the golden chart without touching the database', async () => {
    process.env.READING_FACTS_SOURCE = 'fixture';
    const r = await loadReadingData({} as PrismaClient, 'anyone', { asOf: G1_AS_OF });
    expect(r!.source).toBe('fixture');
    expect(r!.transits).not.toBeNull();
  });
});
