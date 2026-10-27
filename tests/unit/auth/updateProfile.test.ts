/**
 * Profile page update: birth-field changes rebuild the chart (derived rows deleted, Gemini caches deleted, fresh
 * sync queued); name/gender-only changes do not. In-memory fakes only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = vi.hoisted(() => ({ log: [] as string[] }));

vi.mock('../../../src/reading/llm/promptCache.js', () => ({
  deleteUserCaches: async (id: string) => {
    calls.log.push(`deleteUserCaches:${id}`);
    return { deleted: 0, failed: 0 };
  },
}));
vi.mock('../../../src/services/kundliQueueService.js', () => ({
  enqueueKundliSync: async (_db: unknown, id: string) => {
    calls.log.push(`enqueue:${id}`);
  },
  processKundliSyncQueue: async () => undefined,
}));
vi.mock('../../../src/services/geminiCacheService.js', () => ({ ensureGeminiCacheForUser: async () => undefined }));

import { updateProfile } from '../../../src/services/profileService.js';
import { Prisma } from '@prisma/client';

function makeDb(over: Record<string, unknown> = {}) {
  const user: Record<string, any> = {
    id: 'u1',
    name: 'Asha Rao',
    gender: 'female',
    date_of_birth: '1990-01-15',
    time_of_birth: '10:30:00',
    country_code: 'IN',
    city: 'Pune',
    profile_complete: true,
    ...over,
  };
  const db = {
    user,
    auth: {
      findFirst: async () => ({ ...user }),
      update: async ({ data }: any) => {
        calls.log.push('auth.update');
        Object.assign(user, data);
      },
    },
    kundliData: { deleteMany: async () => void calls.log.push('kundliData.deleteMany') },
    kundliFacts: { deleteMany: async () => void calls.log.push('kundliFacts.deleteMany') },
    kundli: {
      updateMany: async ({ data }: any) => {
        calls.log.push('kundli.updateMany');
        db.lastKundliUpdate = data;
      },
    },
    lastKundliUpdate: null as any,
  };
  return db as any;
}

beforeEach(() => {
  calls.log.length = 0;
});

describe('updateProfile', () => {
  it('name and gender only: saved, nothing rebuilt, caches kept', async () => {
    const db = makeDb();
    const r = await updateProfile(db, 'u1', { name: 'Asha R', gender: 'prefer_not_to_say' });
    expect(r).toMatchObject({ success: true, rebuild: false });
    expect(db.user).toMatchObject({ name: 'Asha R', gender: 'prefer_not_to_say', city: 'Pune' });
    expect(calls.log).toEqual(['auth.update']);
  });

  it('re-sending identical birth values is not a change', async () => {
    const db = makeDb();
    const r = await updateProfile(db, 'u1', { date_of_birth: '1990-01-15', time_of_birth: '10:30', country_code: 'in', city: 'Pune' });
    expect(r.success && r.rebuild).toBe(false);
    expect(calls.log).toEqual(['auth.update']);
  });

  for (const [label, patch] of [
    ['date of birth', { date_of_birth: '1991-02-03' }],
    ['time of birth', { time_of_birth: '22:05' }],
    ['country', { country_code: 'US' }],
    ['city', { city: 'Mumbai' }],
  ] as Array<[string, Record<string, string>]>) {
    it(`a ${label} change rebuilds: derived rows deleted, caches deleted, sync queued`, async () => {
      const db = makeDb();
      const r = await updateProfile(db, 'u1', patch);
      expect(r).toMatchObject({ success: true, rebuild: true });
      expect(calls.log).toEqual([
        'auth.update',
        'kundliData.deleteMany',
        'kundliFacts.deleteMany',
        'kundli.updateMany',
        'deleteUserCaches:u1',
        'enqueue:u1',
      ]);
      expect(db.lastKundliUpdate).toMatchObject({
        queue_status: 'pending',
        facts_status: 'pending',
        d1: Prisma.DbNull,
        biodata: Prisma.DbNull,
        lat: null,
      });
      expect(db.user.kundli_added).toBe(false);
    });
  }

  it('rewrites place_of_birth in the City,CC form when the place changes', async () => {
    const db = makeDb();
    await updateProfile(db, 'u1', { city: 'New Delhi' });
    expect(db.user.place_of_birth).toBe('New Delhi,IN');
    expect(db.user.city).toBe('New Delhi');
  });

  it('validates like completeProfile and changes nothing on error', async () => {
    for (const patch of [
      { date_of_birth: '2999-01-01' },
      { time_of_birth: '25:00' },
      { country_code: 'ZZZ' },
      { city: '' },
      { gender: 'other' },
      { name: '   ' },
    ]) {
      const db = makeDb();
      const r = await updateProfile(db, 'u1', patch);
      expect(r.success).toBe(false);
      expect(calls.log).toEqual([]);
    }
  });

  it('refuses a user whose profile is not complete yet', async () => {
    const r = await updateProfile(makeDb({ profile_complete: false }), 'u1', { name: 'X' });
    expect(r).toMatchObject({ success: false, message: 'Complete your profile first.' });
  });
});
