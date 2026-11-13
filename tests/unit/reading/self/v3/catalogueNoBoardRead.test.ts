/**
 * GET /api/self/v3/catalogue reads the chart id, the registry, the suggested set and the card states only (TODOS
 * 2026-11-12): the board read (stored build, clock, refresh, layout) is not run and no build is queued.
 */
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerSelfV3Routes } from '../../../../../src/routes/selfV3Routes.js';
import { getSelfV3Catalogue } from '../../../../../src/reading/self/v3/service.js';
import { fakeRequireUser } from '../../../../helpers/fakeAuth.js';

const NOW = new Date('2026-11-09T12:00:00Z');

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Only the chart lookup and the card-state row exist; any other model or call throws, so a board read cannot hide. */
function narrowPrisma(calls: string[], stateDoc: unknown = null) {
  const only: any = {
    kundli: {
      findFirst: async ({ where }: any) => {
        calls.push('kundli.findFirst');
        return where.user_id === 'u1' ? { id: 'k1' } : null;
      },
    },
    areaBuild: {
      findUnique: async () => {
        calls.push('areaBuild.findUnique');
        return stateDoc ? { status: 'ready', result: stateDoc } : null;
      },
    },
  };
  return new Proxy(only, {
    get: (t, k: string) => {
      if (k in t) return t[k];
      if (k === 'then') return undefined;
      throw new Error(`catalogue touched prisma.${k}`);
    },
  });
}

function seams(calls: string[]) {
  return {
    now: () => NOW,
    readLatest: async () => {
      calls.push('readLatest');
      throw new Error('board read');
    },
    systemsPresent: async () => {
      calls.push('systemsPresent');
      return [];
    },
    queueBuild: async () => {
      calls.push('queueBuild');
      return 'invoked' as const;
    },
    queueDigest: async () => {
      calls.push('queueDigest');
    },
    readV3Cards: async () => {
      calls.push('readV3Cards');
      return null;
    },
    readCardReadings: async () => {
      calls.push('readCardReadings');
      return {};
    },
    progressMarkers: async () => {
      calls.push('progressMarkers');
      return { queue: { state: 'none' as const, startedAt: null }, v2: { status: null, stage: null, stageAt: null } };
    },
    buildMarker: async () => {
      calls.push('buildMarker');
      return 'none' as const;
    },
    refreshDates: async () => {
      calls.push('refreshDates');
      return null;
    },
  };
}

const BOARD_AND_QUEUE = ['readLatest', 'systemsPresent', 'queueBuild', 'queueDigest', 'readV3Cards', 'readCardReadings', 'progressMarkers', 'buildMarker', 'refreshDates'];

describe('getSelfV3Catalogue', () => {
  it('lists every registry card with no board read and no build queued; the only prisma calls are the chart id', async () => {
    const calls: string[] = [];
    const cards = await getSelfV3Catalogue({ prisma: narrowPrisma(calls), ...seams(calls), cardsRead: false }, 'u1');
    expect(cards!.length).toBeGreaterThan(11);
    expect(cards!.filter((c) => c.available)).toHaveLength(11);
    expect(cards!.filter((c) => c.suggested)).toHaveLength(8);
    expect(cards!.every((c) => c.firstLine === null && c.state === 'not_read')).toBe(true);
    expect(calls).toEqual(['kundli.findFirst']);
    for (const name of BOARD_AND_QUEUE) expect(calls).not.toContain(name);
  });

  it('a person with no chart gets null, still with no board read or queue', async () => {
    const calls: string[] = [];
    expect(await getSelfV3Catalogue({ prisma: narrowPrisma(calls), ...seams(calls) }, 'u9')).toBeNull();
    expect(calls).toEqual(['kundli.findFirst']);
  });

  it("uses deps.suggest for the suggested set and today's card-state row for each state", async () => {
    const calls: string[] = [];
    const at = NOW.toISOString();
    const doc = { cards: { body: { state: 'queued', at }, mind: { state: 'done', at }, year: { state: 'failed', at } }, spentUsd: 0, stage: 'cards', clocks: [], capReached: false, preparing: false };
    const cards = await getSelfV3Catalogue({ prisma: narrowPrisma(calls, doc), ...seams(calls), cardsRead: true, suggest: async () => ['body', 'mind'] }, 'u1');
    const by = Object.fromEntries(cards!.map((c) => [c.id, c]));
    expect(cards!.filter((c) => c.suggested).map((c) => c.id).sort()).toEqual(['body', 'mind']);
    expect(by.body!.state).toBe('queued');
    expect(by.mind!.state).toBe('ready');
    expect(by.year!.state).toBe('failed');
    expect(calls).toEqual(['kundli.findFirst', 'areaBuild.findUnique']);
    for (const name of BOARD_AND_QUEUE) expect(calls).not.toContain(name);
  });
});

describe('GET /api/self/v3/catalogue route', () => {
  const calls: string[] = [];
  let server: ReturnType<express.Express['listen']>;
  let base = '';
  beforeAll(() => {
    const app = express();
    registerSelfV3Routes(app, {
      prisma: narrowPrisma(calls),
      enabled: true,
      requireUser: fakeRequireUser((req) => (req.headers['x-user'] as string) ?? null),
      v3: { ...seams(calls), cardsRead: false },
    });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => server.close());

  it('200 tiles for the caller; the board read and the build queue are not called', async () => {
    calls.length = 0;
    const r = await fetch(`${base}/api/self/v3/catalogue`, { headers: { 'x-user': 'u1' } });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.cards.length).toBeGreaterThan(11);
    expect(body.cards[0].rail).toBeUndefined();
    expect(calls).toEqual(['kundli.findFirst']);
  });

  it('404 no_kundli without a chart; 401 signed out', async () => {
    calls.length = 0;
    const r = await fetch(`${base}/api/self/v3/catalogue`, { headers: { 'x-user': 'u9' } });
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'no_kundli' });
    expect((await fetch(`${base}/api/self/v3/catalogue`)).status).toBe(401);
    expect(calls.filter((c) => BOARD_AND_QUEUE.includes(c))).toEqual([]);
  });
});
