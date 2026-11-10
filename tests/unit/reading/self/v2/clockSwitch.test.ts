/**
 * A clock switch during a running Self build (doc 66 §4.4; docs/TODOS.md P2 "A clock switch during a running Self build
 * does not rebuild on the new clock"): the build marker carries the clock, so PUT /api/self/v2/clock queues a build on the
 * new clock even while one runs on the old one; the old build, when it lands, leaves the newer marker alone; and the v2
 * store is read per clock, so the old clock's cards are never served as the new one's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseSelfReadingBuildEvent,
  queueSelfReadingBuild,
  readBuildMarkerDetail,
  runSelfReadingBuild,
  selfReadingBuildEventPayload,
} from '../../../../../src/reading/self/buildEvent.js';
import type { SelfReadingResult } from '../../../../../src/reading/self/service.js';
import { switchClock } from '../../../../../src/reading/self/v2api/service.js';
import { getSelfPersonalizerMaxOutputTokens } from '../../../../../src/config/env.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma() {
  const markers = new Map<string, any>();
  const key = (w: any) => `${w.kundli_id}|${w.area}|${w.as_of.toISOString()}`;
  const kundli = { id: 'k1', user_id: 'u1', preferred_dasha: 'vimsottari', digest_status: 'ready' };
  const prisma: any = {
    kundli: {
      findFirst: async () => ({ ...kundli }),
      update: async ({ data }: any) => Object.assign(kundli, data),
    },
    kundliData: { findFirst: async () => null },
    analyticsEvent: { create: async ({ data }: any) => data },
    areaBuild: {
      findUnique: async ({ where }: any) => markers.get(key(where.kundli_id_area_as_of)) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const k = key(where.kundli_id_area_as_of);
        const cur = markers.get(k);
        const next = cur ? { ...cur, ...update } : create;
        markers.set(k, next);
        return next;
      },
    },
  };
  return { prisma, markers, kundli };
}

const NOW = new Date('2026-11-09T10:00:00Z');
const ok = (): SelfReadingResult => ({ status: 'ok', built_at: '2026-11-09', cached: false, reading: { asOf: '2026-11-09', panels: [], oracle: { status: 'ok' } } }) as unknown as SelfReadingResult;

afterEach(() => {
  delete process.env.KUNDLI_DIGEST_EVENT_TOKEN;
  delete process.env.SELF_PERSONALIZER_MAX_OUTPUT_TOKENS;
});

describe('the build marker carries the clock', () => {
  it('a build on the new clock is queued while one runs on the old clock; the same clock still waits', async () => {
    const f = fakePrisma();
    const invokes: any[] = [];
    const deps = { prisma: f.prisma, invoke: async (p: any) => void invokes.push(p), now: () => NOW };
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'self', { clock: 'vimsottari' })).toBe('invoked');
    expect(await readBuildMarkerDetail(f.prisma, 'k1', 'self', NOW)).toEqual({ state: 'building', clock: 'vimsottari' });
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'self', { clock: 'vimsottari' })).toBe('already_building');
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'self', { clock: 'yogini' })).toBe('invoked');
    expect(await readBuildMarkerDetail(f.prisma, 'k1', 'self', NOW)).toEqual({ state: 'building', clock: 'yogini' });
    expect(invokes.map((p) => p.clock)).toEqual(['vimsottari', 'yogini']);
    // a build queued with no clock (GET /api/self/reading) still waits on any running build
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'self')).toBe('already_building');
  });

  it('the old clock build landing leaves the new clock marker building; the new one marks it ready', async () => {
    const f = fakePrisma();
    const deps = { prisma: f.prisma, invoke: async () => undefined, now: () => NOW };
    await queueSelfReadingBuild(deps, 'u1', 'k1', 'self', { clock: 'vimsottari' });
    await queueSelfReadingBuild(deps, 'u1', 'k1', 'self', { clock: 'yogini' });
    await runSelfReadingBuild({ prisma: f.prisma, build: async () => ok(), now: () => NOW }, 'u1', 'k1', 'self', { clock: 'vimsottari' });
    expect(await readBuildMarkerDetail(f.prisma, 'k1', 'self', NOW)).toEqual({ state: 'building', clock: 'yogini' });
    await runSelfReadingBuild({ prisma: f.prisma, build: async () => ok(), now: () => NOW }, 'u1', 'k1', 'self', { clock: 'yogini' });
    expect((await readBuildMarkerDetail(f.prisma, 'k1', 'self', NOW)).state).toBe('ready');
  });

  it('the event carries the clock', () => {
    process.env.KUNDLI_DIGEST_EVENT_TOKEN = 'secret';
    expect(parseSelfReadingBuildEvent(selfReadingBuildEventPayload('u1', 'self', { clock: 'yogini' }))).toEqual({ userId: 'u1', board: 'self', clock: 'yogini' });
    expect(parseSelfReadingBuildEvent({ source: 'self-reading-build', userId: 'u1', board: 'self', token: 'secret', clock: 'Bad Clock!' })).toEqual({ userId: 'u1', board: 'self' });
  });

  it('PUT /api/self/v2/clock queues the build on the new clock even while one runs on the old', async () => {
    const f = fakePrisma();
    const invokes: any[] = [];
    const queued: Array<string | undefined> = [];
    await queueSelfReadingBuild({ prisma: f.prisma, invoke: async () => undefined, now: () => NOW }, 'u1', 'k1', 'self', { clock: 'vimsottari' });
    const r = await switchClock(
      {
        prisma: f.prisma,
        now: () => NOW,
        systemsPresent: async () => [
          { system: 'vimsottari', family: 'vimshottari' },
          { system: 'yogini', family: 'yogini' },
        ],
        loadApplicability: async () => null,
        gate: { chargeClock: vi.fn(async () => 'charged' as const), getStatus: vi.fn(async () => null) } as never,
        queueBuild: (p, u, k, clock) => (queued.push(clock), queueSelfReadingBuild({ prisma: p, invoke: async (x) => void invokes.push(x), now: () => NOW }, u, k, 'self', clock ? { clock } : {})),
      },
      'u1',
      'yogini',
    );
    expect(r.ok && r.status).toBe(202);
    expect(queued).toEqual(['yogini']);
    expect(invokes).toHaveLength(1);
    expect(invokes[0].clock).toBe('yogini');
    expect(f.kundli.preferred_dasha).toBe('yogini');
  });
});

describe('Personalizer output cap (doc 66 §4.9)', () => {
  it('defaults to 12000 tokens (eleven cards ≈ 4.3 k plus `low` thought on the Oracle model, 2026-11-09) and stays clamped', () => {
    expect(getSelfPersonalizerMaxOutputTokens()).toBe(12000);
    process.env.SELF_PERSONALIZER_MAX_OUTPUT_TOKENS = '2500';
    expect(getSelfPersonalizerMaxOutputTokens()).toBe(2500);
    process.env.SELF_PERSONALIZER_MAX_OUTPUT_TOKENS = '99999';
    expect(getSelfPersonalizerMaxOutputTokens()).toBe(24000);
  });
});
