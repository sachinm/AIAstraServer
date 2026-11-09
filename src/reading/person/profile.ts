/**
 * The person profile pack (docs/reading-engine/66 §4.2, sub-technique `self.sub.profile`): who the reading is written
 * for. Built from what the person typed or tapped: the birth date (age is calendar arithmetic, not astrology), the stated
 * gender, the account role, the wizard's facts, the confirm answers and today's mood. The Personalizer receives the
 * band, never the exact age.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { DECLINED, SELF_CONFIRM_PREFIX } from '../../profile/facts.js';
import type { AgeBand, ConfirmRecord, Mood, ProfileFacts, ProfilePack, ReaderRole, StatedGender } from '../self/v2types.js';

/** lower bounds of the bands after `under_25`, from env `SELF_AGE_BANDS` (default "25,36,46,61") */
export function getSelfAgeBandBounds(): [number, number, number, number] {
  const raw = process.env.SELF_AGE_BANDS;
  const fallback: [number, number, number, number] = [25, 36, 46, 61];
  if (!raw) return fallback;
  const n = raw.split(',').map((x) => Number(x.trim()));
  if (n.length !== 4 || n.some((x) => !Number.isInteger(x) || x < 1 || x > 120)) return fallback;
  for (let i = 1; i < 4; i++) if (n[i]! <= n[i - 1]!) return fallback;
  return n as [number, number, number, number];
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** whole years between an ISO birth date and `asOf` (both YYYY-MM-DD); null when either is invalid or birth is after asOf */
export function ageInYears(birthDate: string | null | undefined, asOf: string): number | null {
  if (!birthDate) return null;
  const b = ISO.exec(birthDate.trim());
  const a = ISO.exec(asOf);
  if (!b || !a) return null;
  const [by, bm, bd] = [Number(b[1]), Number(b[2]), Number(b[3])];
  const [ay, am, ad] = [Number(a[1]), Number(a[2]), Number(a[3])];
  const check = new Date(Date.UTC(by, bm - 1, bd));
  if (check.getUTCFullYear() !== by || check.getUTCMonth() !== bm - 1 || check.getUTCDate() !== bd) return null;
  let years = ay - by;
  if (am < bm || (am === bm && ad < bd)) years -= 1;
  return years >= 0 ? years : null;
}

export function ageBandOf(years: number | null, bounds = getSelfAgeBandBounds()): AgeBand | null {
  if (years === null) return null;
  const [b25, b36, b46, b61] = bounds;
  if (years < b25) return 'under_25';
  if (years < b36) return '25_35';
  if (years < b46) return '36_45';
  if (years < b61) return '46_60';
  return '60_plus';
}

/** `auth.gender` values are male | female | prefer_not_to_say (src/lib/profileValidators.ts); anything else is not stated */
export function statedGender(raw: string | null | undefined): StatedGender | null {
  const t = (raw ?? '').trim().toLowerCase();
  if (t === 'female') return 'woman';
  if (t === 'male') return 'man';
  return null;
}

const PRACTITIONER_ROLES = new Set(['student', 'astrologer', 'researcher']);
export function readerRole(role: string | null | undefined): ReaderRole {
  return PRACTITIONER_ROLES.has((role ?? '').trim().toLowerCase()) ? 'practitioner' : 'public';
}

const MOODS: readonly Mood[] = ['heavy', 'mixed', 'fine'];
/** the hero's mood tap is stored for the day as `<mood>:<YYYY-MM-DD>`; it counts only on that day */
export function moodFor(raw: string | null | undefined, asOf: string): Mood | null {
  if (!raw) return null;
  const [m, d] = raw.split(':');
  return d === asOf && (MOODS as readonly string[]).includes(m ?? '') ? (m as Mood) : null;
}

export interface ProfileSource {
  birthDate: string | null;
  gender: string | null;
  role: string | null;
  /** person_facts, key → { value, confirmed_at } */
  facts: Record<string, { value: string; confirmed_at?: string | null }>;
}

const CONFIRMS_KEPT = 5;

/** pure: the pack from its sources (tests call this; `loadProfilePack` reads the sources) */
export function buildProfilePack(src: ProfileSource, asOf: string): ProfilePack {
  const ageYears = ageInYears(src.birthDate, asOf);
  const gender = statedGender(src.gender);
  const role = readerRole(src.role);

  const declined: string[] = [];
  const val = (key: string): string | undefined => {
    const v = src.facts[key]?.value;
    if (v === undefined) return undefined;
    if (v === DECLINED) {
      declined.push(key);
      return undefined;
    }
    return v;
  };

  const facts: ProfileFacts = {};
  const workStatus = val('work.status');
  const workLevel = val('work.level');
  if (workStatus || workLevel) facts.work = { ...(workStatus ? { status: workStatus } : {}), ...(workLevel ? { level: workLevel } : {}) };
  const love = val('love.status');
  if (love) facts.love = love;
  const children = val('family.children');
  if (children) facts.children = children;
  const focus = val('self.focus');
  if (focus) facts.focus = focus.split(',').map((x) => x.trim()).filter(Boolean);
  const place = val('place.current');
  if (place) facts.place = place;

  const lastConfirms: ConfirmRecord[] = Object.entries(src.facts)
    .filter(([k]) => k.startsWith(SELF_CONFIRM_PREFIX))
    .map(([k, v]) => ({ claimId: k.slice(SELF_CONFIRM_PREFIX.length), answer: v.value as ConfirmRecord['answer'], at: v.confirmed_at ?? null }))
    .filter((c) => ['yes', 'partly', 'no', 'skip'].includes(c.answer))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '') || a.claimId.localeCompare(b.claimId))
    .slice(0, CONFIRMS_KEPT);

  const mood = moodFor(src.facts['self.mood']?.value, asOf);
  const ageBand = ageBandOf(ageYears);
  declined.sort();

  const hashed = { ageBand, gender, role, facts, declined, lastConfirms: lastConfirms.map((c) => [c.claimId, c.answer]), mood };
  const hash = createHash('sha256').update(JSON.stringify(hashed)).digest('hex').slice(0, 16);

  return { ageBand, ageYears, gender, role, facts, declined, lastConfirms, mood, hash };
}

/** reads `auth` and `person_facts` for one user; two queries */
export async function loadProfilePack(prisma: PrismaClient, userId: string, asOf: string): Promise<ProfilePack> {
  const [auth, rows] = await Promise.all([
    prisma.auth.findUnique({ where: { id: userId }, select: { date_of_birth: true, gender: true, role: true } }),
    prisma.personFact.findMany({ where: { user_id: userId }, select: { key: true, value: true, confirmed_at: true } }),
  ]);
  const facts: ProfileSource['facts'] = {};
  for (const r of rows) facts[r.key] = { value: r.value, confirmed_at: r.confirmed_at?.toISOString() ?? null };
  return buildProfilePack({ birthDate: auth?.date_of_birth ?? null, gender: auth?.gender ?? null, role: auth?.role ?? null, facts }, asOf);
}
