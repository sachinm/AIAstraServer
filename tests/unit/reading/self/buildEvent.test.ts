/**
 * The reading build as a background event (docs/reading-engine/64 §4): the token-guarded event, one build at a time per
 * kundli and board through the `area_builds` marker, a failed build not retried for half an hour, a stuck one run again.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILD_STUCK_MS,
  FAILED_COOLDOWN_MS,
  handleSelfReadingBuildEvent,
  parseSelfReadingBuildEvent,
  queueSelfReadingBuild,
  readBuildMarker,
  runSelfReadingBuild,
  selfReadingBuildEventPayload,
} from '../../../../src/reading/self/buildEvent.js';
import type { SelfReadingResult } from '../../../../src/reading/self/service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function fakePrisma() {
  const markers = new Map<string, any>();
  const key = (w: any) => `${w.kundli_id}|${w.area}|${w.as_of.toISOString()}`;
  const prisma: any = {
    kundli: { findFirst: async ({ where }: any) => (where.user_id === 'u1' ? { id: 'k1' } : null) },
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
  return { prisma, markers };
}

const NOW = new Date('2026-11-08T21:17:00Z');
const okReading = (oracleStatus: 'ok' | 'failed' | 'pending' | 'off'): SelfReadingResult =>
  ({ status: 'ok', built_at: '2026-11-08', cached: false, reading: { panels: [], oracle: { status: oracleStatus } } }) as unknown as SelfReadingResult;

afterEach(() => {
  delete process.env.KUNDLI_DIGEST_EVENT_TOKEN;
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
});

describe('self-reading-build event', () => {
  it('is parsed only with the token, a user id and a known board', () => {
    expect(parseSelfReadingBuildEvent({ source: 'self-reading-build', userId: 'u1', board: 'self', token: 'x' })).toBeNull();
    process.env.KUNDLI_DIGEST_EVENT_TOKEN = 'secret';
    expect(parseSelfReadingBuildEvent({ source: 'self-reading-build', userId: 'u1', board: 'self', token: 'wrong' })).toBeNull();
    expect(parseSelfReadingBuildEvent({ source: 'self-reading-build', userId: 'u1', board: 'money', token: 'secret' })).toBeNull();
    expect(parseSelfReadingBuildEvent({ source: 'self-reading-build', userId: 'u1', board: 'self', token: 'secret' })).toEqual({ userId: 'u1', board: 'self' });
    expect(parseSelfReadingBuildEvent({ 'detail-type': 'self-reading-build', detail: { userId: 'u1', board: 'love', token: 'secret' } })).toEqual({ userId: 'u1', board: 'love' });
    expect(parseSelfReadingBuildEvent(selfReadingBuildEventPayload('u1', 'work'))).toEqual({ userId: 'u1', board: 'work' });
    expect(parseSelfReadingBuildEvent({ source: 'kundli-digest', kundliId: 'k1', token: 'secret' })).toBeNull();
  });

  it('queues one build, marks it building, and a second poll does not queue again', async () => {
    const f = fakePrisma();
    const invokes: unknown[] = [];
    const deps = { prisma: f.prisma, invoke: async (p: unknown) => { invokes.push(p); }, now: () => NOW };
    expect(await readBuildMarker(f.prisma, 'k1', 'self', NOW)).toBe('none');
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'self')).toBe('invoked');
    expect(invokes).toHaveLength(1);
    expect(invokes[0]).toMatchObject({ source: 'self-reading-build', userId: 'u1', board: 'self' });
    expect(await readBuildMarker(f.prisma, 'k1', 'self', NOW)).toBe('building');
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'self')).toBe('already_building');
    expect(invokes).toHaveLength(1);
    // another board of the same person is its own marker
    expect(await queueSelfReadingBuild(deps, 'u1', 'k1', 'love')).toBe('invoked');
    expect(invokes).toHaveLength(2);
  });

  it('a build stuck for ten minutes is run again; a failed invoke marks the build failed', async () => {
    const f = fakePrisma();
    const invokes: unknown[] = [];
    await queueSelfReadingBuild({ prisma: f.prisma, invoke: async (p: unknown) => { invokes.push(p); }, now: () => NOW }, 'u1', 'k1', 'self');
    const later = new Date(NOW.getTime() + BUILD_STUCK_MS + 1);
    expect(await readBuildMarker(f.prisma, 'k1', 'self', later)).toBe('stuck');
    expect(await queueSelfReadingBuild({ prisma: f.prisma, invoke: async () => { throw new Error('lambda down'); }, now: () => later }, 'u1', 'k1', 'self')).toBe('skipped');
    expect(await readBuildMarker(f.prisma, 'k1', 'self', later)).toBe('failed_recently');
  });

  it('runs the build to the end and marks ready; a failed Oracle marks failed and is not queued again for half an hour', async () => {
    const f = fakePrisma();
    const built = await runSelfReadingBuild({ prisma: f.prisma, build: async () => okReading('ok'), now: () => NOW }, 'u1', 'k1', 'self');
    expect(built?.status).toBe('ok');
    expect(await readBuildMarker(f.prisma, 'k1', 'self', NOW)).toBe('ready');

    const g = fakePrisma();
    await runSelfReadingBuild({ prisma: g.prisma, build: async () => okReading('failed'), now: () => NOW }, 'u1', 'k1', 'self');
    expect(await readBuildMarker(g.prisma, 'k1', 'self', NOW)).toBe('failed_recently');
    expect(await queueSelfReadingBuild({ prisma: g.prisma, invoke: async () => undefined, now: () => NOW }, 'u1', 'k1', 'self')).toBe('failed_recently');
    const afterCooldown = new Date(NOW.getTime() + FAILED_COOLDOWN_MS + 1);
    expect(await readBuildMarker(g.prisma, 'k1', 'self', afterCooldown)).toBe('failed');
    expect(await queueSelfReadingBuild({ prisma: g.prisma, invoke: async () => undefined, now: () => afterCooldown }, 'u1', 'k1', 'self')).toBe('invoked');
  });

  it('off Lambda the build runs in process; a thrown build is recorded as failed', async () => {
    const f = fakePrisma();
    let ran = 0;
    const outcome = await queueSelfReadingBuild({ prisma: f.prisma, build: async () => { ran += 1; return okReading('ok'); }, now: () => NOW }, 'u1', 'k1', 'self');
    expect(outcome).toBe('in_process');
    await new Promise((r) => setTimeout(r, 10));
    expect(ran).toBe(1);
    expect(await readBuildMarker(f.prisma, 'k1', 'self', NOW)).toBe('ready');

    const g = fakePrisma();
    const r = await runSelfReadingBuild({ prisma: g.prisma, build: async () => { throw new Error('boom'); }, now: () => NOW }, 'u1', 'k1', 'self');
    expect(r).toBeNull();
    expect(await readBuildMarker(g.prisma, 'k1', 'self', NOW)).toBe('failed_recently');
  });

  it('the /events handler finds the person\'s kundli and reports the Oracle status', async () => {
    const f = fakePrisma();
    expect(await handleSelfReadingBuildEvent({ userId: 'u9', board: 'self' }, { prisma: f.prisma })).toEqual({ status: 'no_kundli', oracle: 'off' });
    expect(await handleSelfReadingBuildEvent({ userId: 'u1', board: 'self' }, { prisma: f.prisma, build: async () => okReading('ok'), now: () => NOW })).toEqual({ status: 'ok', oracle: 'ok' });
  });
});

describe('a fresh synthesis takes one question (docs/billing/02)', () => {
  const reading = (status: 'ok' | 'failed' | 'pending', cached = false): SelfReadingResult =>
    ({ status: 'ok', built_at: '2026-11-08', cached: false, reading: { asOf: '2026-11-08', panels: [], oracle: { status, cached } } }) as unknown as SelfReadingResult;

  it('charges the board for the day when the Oracle wrote it now, and nothing for a stored, failed or thrown build', async () => {
    const chargeBoard = vi.fn(async () => 'charged' as const);
    const gate = { chargeBoard };
    const f = fakePrisma();
    await runSelfReadingBuild({ prisma: f.prisma, gate, build: async () => reading('ok'), now: () => NOW }, 'u1', 'k1', 'love');
    expect(chargeBoard).toHaveBeenCalledTimes(1);
    expect(chargeBoard).toHaveBeenCalledWith('u1', 'love', '2026-11-08');
    await runSelfReadingBuild({ prisma: f.prisma, gate, build: async () => reading('ok', true), now: () => NOW }, 'u1', 'k1', 'self');
    await runSelfReadingBuild({ prisma: f.prisma, gate, build: async () => reading('failed'), now: () => NOW }, 'u1', 'k1', 'self');
    await runSelfReadingBuild({ prisma: f.prisma, gate, build: async () => reading('pending'), now: () => NOW }, 'u1', 'k1', 'self');
    await runSelfReadingBuild({ prisma: f.prisma, gate, build: async () => { throw new Error('boom'); }, now: () => NOW }, 'u1', 'k1', 'self');
    expect(chargeBoard).toHaveBeenCalledTimes(1);
  });
});
