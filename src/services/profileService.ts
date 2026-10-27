/**
 * Registration v2, page 2: save the birth details, mint the user's own referral code, record who referred
 * them, and queue the kundli sync. Page 1 lives in authService (startSignup / verifySignupCode).
 */
import crypto from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { decrypt, encrypt } from '../lib/encrypt.js';
import { deleteUserCaches } from '../reading/llm/promptCache.js';
import { buildPlaceOfBirth, normalizeGender, validateCompleteProfile } from '../lib/profileValidators.js';
import { enqueueKundliSync } from './kundliQueueService.js';
import { scheduleKundliSync } from './kundliSyncWorker.js';
import { ensureGeminiCacheForUser } from './geminiCacheService.js';

export type CompleteProfileResult =
  | { success: true; message: string; referral_code: string }
  | { success: false; message: string; referral_code: null };

const REFERRAL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'.replace(/[01]/g, '');
const REFERRAL_LENGTH = 8;
const MAX_CODE_TRIES = 6;

export function generateReferralCode(): string {
  let out = '';
  for (let i = 0; i < REFERRAL_LENGTH; i++) out += REFERRAL_ALPHABET[crypto.randomInt(REFERRAL_ALPHABET.length)];
  return out;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2002';
}

/** Give the user a referral code if they have none; retries on the rare unique collision. */
async function ensureReferralCode(db: PrismaClient, userId: string, current: string | null): Promise<string> {
  if (current) return current;
  for (let i = 0; i < MAX_CODE_TRIES; i++) {
    const code = generateReferralCode();
    try {
      await db.auth.update({ where: { id: userId }, data: { referral_code: code } });
      return code;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error('Could not allocate a referral code');
}

export async function completeProfile(
  db: PrismaClient,
  userId: string,
  input: unknown
): Promise<CompleteProfileResult> {
  const fail = (message: string): CompleteProfileResult => ({ success: false, message, referral_code: null });

  const user = await db.auth.findFirst({
    where: { id: userId },
    select: { id: true, email_verified_at: true, profile_complete: true, referral_code: true, referred_by_user_id: true },
  });
  if (!user) return fail('Not authenticated');
  if (!user.email_verified_at) return fail('Verify your email first.');

  if (user.profile_complete) {
    // a retry after a lost response: nothing is overwritten
    const code = await ensureReferralCode(db, userId, user.referral_code);
    return { success: true, message: 'Your profile is already complete.', referral_code: code };
  }

  const valid = validateCompleteProfile(input);
  if (!valid.ok) return fail(valid.message);
  const p = valid.data;

  // Referral: only another user's code counts. Unknown codes are ignored without a word (no oracle).
  let referredBy: string | null = user.referred_by_user_id ?? null;
  if (!referredBy && p.referral_code) {
    const owner = await db.auth.findFirst({ where: { referral_code: p.referral_code }, select: { id: true } });
    if (owner && owner.id !== userId) referredBy = owner.id;
  }

  const place = buildPlaceOfBirth(p.city, p.country_code);
  const time = `${p.time_of_birth}:00`;
  await db.auth.update({
    where: { id: userId },
    data: {
      date_of_birth: encrypt(p.date_of_birth) ?? p.date_of_birth,
      time_of_birth: encrypt(time) ?? time,
      place_of_birth: encrypt(place) ?? place,
      country_code: p.country_code,
      city: p.city,
      gender: p.gender,
      profile_complete: true,
      ...(referredBy ? { referred_by_user_id: referredBy } : {}),
    },
  });
  const referralCode = await ensureReferralCode(db, userId, user.referral_code);

  const kundliId = await enqueueKundliSync(db, userId).catch((err) => {
    console.error('enqueueKundliSync after completeProfile failed:', (err as Error).message);
    return undefined;
  });
  // background pull in its own Lambda invocation (docs/reading-engine/31); in-process when not on Lambda
  await scheduleKundliSync(kundliId, { prisma: db });
  ensureGeminiCacheForUser(db, userId).catch((err) => {
    console.error('ensureGeminiCacheForUser after completeProfile failed:', (err as Error).message);
  });

  return { success: true, message: 'Profile saved. Your chart is being prepared.', referral_code: referralCode };
}

export type ReferralStatRow = {
  user_id: string;
  email: string | null;
  name: string | null;
  referral_code: string | null;
  referred_count: number;
};

/** Referred users per referrer, highest first, top 50. */
export async function referralStats(db: PrismaClient): Promise<ReferralStatRow[]> {
  const groups = await db.auth.groupBy({
    by: ['referred_by_user_id'],
    where: { referred_by_user_id: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { referred_by_user_id: 'desc' } },
    take: 50,
  });
  const ids = groups.map((g) => g.referred_by_user_id).filter((x): x is string => Boolean(x));
  if (!ids.length) return [];
  const owners = await db.auth.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, name: true, username: true, referral_code: true },
  });
  const byId = new Map(owners.map((o) => [o.id, o]));
  return groups.map((g) => {
    const o = byId.get(g.referred_by_user_id as string);
    return {
      user_id: g.referred_by_user_id as string,
      email: o?.email ?? null,
      name: o?.name ?? o?.username ?? null,
      referral_code: o?.referral_code ?? null,
      referred_count: g._count._all,
    };
  });
}

export type UpdateProfileInput = {
  name?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  time_of_birth?: string | null;
  country_code?: string | null;
  city?: string | null;
};

export type UpdateProfileResult =
  | { success: true; message: string; rebuild: boolean }
  | { success: false; message: string; rebuild: false };

/**
 * Profile page: partial update of name, gender and the birth details, validated exactly like completeProfile.
 * A change to any birth field (date, time, country, city) invalidates everything computed from the old chart:
 * the user's kundli_data and facts are deleted, the legacy kundli columns and coordinates are cleared, the
 * Gemini prompt caches are deleted, and a fresh full kundli sync is queued (me.kundli_status goes back to
 * pending). A name or gender change alone rebuilds nothing.
 */
export async function updateProfile(
  db: PrismaClient,
  userId: string,
  input: UpdateProfileInput
): Promise<UpdateProfileResult> {
  const fail = (message: string): UpdateProfileResult => ({ success: false, message, rebuild: false });

  const user = await db.auth.findFirst({
    where: { id: userId },
    select: {
      id: true, name: true, gender: true, date_of_birth: true, time_of_birth: true,
      country_code: true, city: true, profile_complete: true,
    },
  });
  if (!user) return fail('Not authenticated');
  if (user.profile_complete === false) return fail('Complete your profile first.');

  const given = (v: string | null | undefined): v is string => typeof v === 'string';

  let name: string | null = user.name ?? null;
  if (given(input.name)) {
    const n = input.name.trim();
    if (!n || n.length > 128) return fail('Enter your name (up to 128 characters).');
    name = n;
  }

  const current = {
    date_of_birth: decrypt(user.date_of_birth) ?? user.date_of_birth ?? '',
    time_of_birth: (decrypt(user.time_of_birth) ?? user.time_of_birth ?? '').slice(0, 5),
    country_code: user.country_code ?? '',
    city: user.city ?? '',
    gender: user.gender ?? '',
  };
  const merged = {
    date_of_birth: given(input.date_of_birth) ? input.date_of_birth : current.date_of_birth,
    time_of_birth: given(input.time_of_birth) ? input.time_of_birth : current.time_of_birth,
    country_code: given(input.country_code) ? input.country_code : current.country_code,
    city: given(input.city) ? input.city : current.city,
    gender: given(input.gender) ? input.gender : current.gender,
  };
  const valid = validateCompleteProfile(merged);
  if (!valid.ok) return fail(valid.message);
  const p = valid.data;

  const birthChanged =
    p.date_of_birth !== current.date_of_birth ||
    p.time_of_birth !== current.time_of_birth ||
    p.country_code !== current.country_code.toUpperCase() ||
    p.city !== current.city;

  const data: Record<string, unknown> = { gender: p.gender };
  if (name) Object.assign(data, { name, username: name });
  if (birthChanged) {
    const place = buildPlaceOfBirth(p.city, p.country_code);
    const time = `${p.time_of_birth}:00`;
    Object.assign(data, {
      date_of_birth: encrypt(p.date_of_birth) ?? p.date_of_birth,
      time_of_birth: encrypt(time) ?? time,
      place_of_birth: encrypt(place) ?? place,
      country_code: p.country_code,
      city: p.city,
      kundli_added: false,
    });
  }
  await db.auth.update({ where: { id: userId }, data });
  if (!birthChanged) return { success: true, message: 'Profile updated.', rebuild: false };

  await db.kundliData.deleteMany({ where: { kundli: { user_id: userId } } });
  await db.kundliFacts.deleteMany({ where: { kundli: { user_id: userId } } });
  const clear = Prisma.DbNull;
  await db.kundli.updateMany({
    where: { user_id: userId },
    data: {
      biodata: clear, d1: clear, d2: clear, d4: clear, d7: clear, d9: clear, d10: clear,
      charakaraka: clear, vimsottari_dasa: clear, narayana_dasa: clear, other_readings: clear,
      lat: null, lon: null, tz: null, place_resolved: null,
      facts_status: 'pending', queue_status: 'pending', queue_started_at: null, queue_completed_at: null,
      last_sync_error: null,
    },
  });
  await deleteUserCaches(userId).catch((err) => {
    console.error('deleteUserCaches after updateProfile failed:', (err as Error).message);
  });
  const kundliId = await enqueueKundliSync(db, userId).catch((err) => {
    console.error('enqueueKundliSync after updateProfile failed:', (err as Error).message);
    return undefined;
  });
  // background pull in its own Lambda invocation (docs/reading-engine/31); in-process when not on Lambda
  await scheduleKundliSync(kundliId, { prisma: db });
  return { success: true, message: 'Profile updated. Your chart is being rebuilt.', rebuild: true };
}

export type OwnProfileFields = {
  gender: 'male' | 'female' | 'prefer_not_to_say' | null;
  date_of_birth: string | null;
  time_of_birth: string | null;
  country_code: string | null;
  city: string | null;
};

/**
 * The signed-in user's own birth fields for `me` (Profile page). Decrypts like the rest of the code; returns
 * date_of_birth as YYYY-MM-DD and time_of_birth as HH:MM (24-hour), null when unset (pending signups store an
 * empty DOB) or unreadable. Never used for other users.
 */
export function ownProfileFields(row: {
  gender?: string | null;
  date_of_birth?: string | null;
  time_of_birth?: string | null;
  country_code?: string | null;
  city?: string | null;
}): OwnProfileFields {
  const dobRaw = decrypt(row.date_of_birth ?? null)?.trim() ?? '';
  const dobMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dobRaw);
  const tobRaw = decrypt(row.time_of_birth ?? null)?.trim() ?? '';
  const tobMatch = /^(\d{1,2}):(\d{2})/.exec(tobRaw);
  let tob: string | null = null;
  if (tobMatch && Number(tobMatch[1]) < 24 && Number(tobMatch[2]) < 60) {
    tob = `${tobMatch[1].padStart(2, '0')}:${tobMatch[2]}`;
  }
  return {
    gender: normalizeGender(row.gender),
    date_of_birth: dobMatch ? `${dobMatch[1]}-${dobMatch[2]}-${dobMatch[3]}` : null,
    time_of_birth: tob,
    country_code: row.country_code?.trim() ? row.country_code.trim().toUpperCase() : null,
    city: row.city?.trim() ? row.city.trim() : null,
  };
}
