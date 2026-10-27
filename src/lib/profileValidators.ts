import { z } from 'zod';
import { isIsoCountryCode } from './countries.js';

export const GENDERS = ['male', 'female', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

/** Map any free-text gender (old clients, admin edits) onto the three stored values. */
export function normalizeGender(raw: string | null | undefined): Gender | null {
  if (raw === null || raw === undefined) return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t === 'male' || t === 'm' || t === 'man') return 'male';
  if (t === 'female' || t === 'f' || t === 'woman') return 'female';
  return 'prefer_not_to_say';
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const REFERRAL_RE = /^[A-Z2-9]{8}$/;

/** True for a real calendar date in ISO form, from 1900-01-01 up to and including today (UTC). */
export function isValidBirthDate(value: string, now: Date = new Date()): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false;
  if (y < 1900) return false;
  return value <= now.toISOString().slice(0, 10);
}

export const completeProfileSchema = z
  .object({
    date_of_birth: z.string().trim(),
    time_of_birth: z.string().trim(),
    country_code: z.string().trim(),
    city: z.string().trim().min(1, 'City is required').max(100, 'City is too long'),
    gender: z.string().trim(),
    referral_code: z.string().trim().max(64).optional().nullable(),
  })
  .strict();

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

export type ValidProfile = {
  date_of_birth: string;
  time_of_birth: string;
  country_code: string;
  city: string;
  gender: Gender;
  referral_code: string | null;
};

/** Returns the cleaned profile, or the first problem as a user-facing message. */
export function validateCompleteProfile(
  input: unknown,
  now: Date = new Date()
): { ok: true; data: ValidProfile } | { ok: false; message: string } {
  const parsed = completeProfileSchema.safeParse(input);
  if (!parsed.success) {
    const city = parsed.error.issues.find((i) => i.path[0] === 'city');
    return { ok: false, message: city ? city.message : 'Invalid input' };
  }
  const v = parsed.data;
  if (!isValidBirthDate(v.date_of_birth, now)) {
    return { ok: false, message: 'Enter a valid date of birth (YYYY-MM-DD, from 1900, not in the future).' };
  }
  if (!TIME_RE.test(v.time_of_birth)) {
    return { ok: false, message: 'Enter the time of birth as HH:MM in 24-hour time.' };
  }
  if (!/^[A-Za-z]{2}$/.test(v.country_code) || !isIsoCountryCode(v.country_code)) {
    return { ok: false, message: 'Choose a valid country.' };
  }
  if (!(GENDERS as readonly string[]).includes(v.gender)) {
    return { ok: false, message: 'Choose a gender option.' };
  }
  const referral = v.referral_code ? v.referral_code.toUpperCase() : '';
  return {
    ok: true,
    data: {
      date_of_birth: v.date_of_birth,
      time_of_birth: v.time_of_birth,
      country_code: v.country_code.toUpperCase(),
      city: v.city.replace(/\s+/g, ' '),
      gender: v.gender as Gender,
      // a malformed code can never match a user, so it is dropped here without error
      referral_code: REFERRAL_RE.test(referral) ? referral : null,
    },
  };
}

/**
 * "City,CC" exactly as normalizePlaceForAstroKundli parses it: one comma, a two-letter code last.
 * Commas inside the city become spaces so "Austin, Texas" cannot add a second comma.
 */
export function buildPlaceOfBirth(city: string, countryCode: string): string {
  const clean = city.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  return `${clean},${countryCode.toUpperCase()}`;
}
