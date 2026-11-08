/**
 * Terms of Use acceptance (docs/auth/otp-consent-contract.md). One checkbox: "I am 18 or older and agree to the Terms of
 * Use, including that I won't copy, record, or reproduce anything I see in the app." The no-reproduction rule is a
 * clause in the Terms; ticking the box accepts the Terms at CURRENT_TERMS_VERSION and confirms the age.
 *
 * Enforcement is off by default so old web builds keep signing in: REQUIRE_TERMS_ON_SIGNIN=1 (loginWithMagicLink) and
 * REQUIRE_TERMS_ON_SIGNUP=1 (startSignup, verifySignupCode). Acceptance is recorded whenever it is sent, enforced or not.
 */
import type { PrismaClient } from '@prisma/client';
import { recordAccountEvent, type RequestFacts } from '../audit/accountEvents.js';

/** Bump when the Terms of Use text changes; the web shows it from the `currentTerms` query. */
export const CURRENT_TERMS_VERSION = '2026-11-08';

export const TERMS_REQUIRED_CODE = 'terms_required';
export const TERMS_OUTDATED_CODE = 'terms_outdated';
export const TERMS_REQUIRED_MESSAGE =
  'Please confirm you are 18 or older and agree to the Terms of Use to continue.';
export const TERMS_OUTDATED_MESSAGE =
  'Our Terms of Use have changed. Please review them and tick the box again.';

export type TermsFlow = 'sign_in' | 'sign_up';

export interface TermsArgs {
  termsAccepted?: boolean | null;
  termsVersion?: string | null;
}

const on = (v: string | undefined): boolean => v === '1' || v?.toLowerCase() === 'true';

export function termsRequired(flow: TermsFlow): boolean {
  return on(flow === 'sign_in' ? process.env.REQUIRE_TERMS_ON_SIGNIN?.trim() : process.env.REQUIRE_TERMS_ON_SIGNUP?.trim());
}

export function currentTermsInfo(): { version: string; requiredOnSignIn: boolean; requiredOnSignUp: boolean } {
  return {
    version: CURRENT_TERMS_VERSION,
    requiredOnSignIn: termsRequired('sign_in'),
    requiredOnSignUp: termsRequired('sign_up'),
  };
}

/** The version to record, or null when nothing was accepted. Clipped so a client cannot store a long string. */
export function acceptedVersion(args: TermsArgs): string | null {
  if (args.termsAccepted !== true) return null;
  const v = typeof args.termsVersion === 'string' ? args.termsVersion.trim().slice(0, 32) : '';
  return v || null;
}

export type TermsCheck =
  | { ok: true; version: string | null }
  | { ok: false; code: typeof TERMS_REQUIRED_CODE | typeof TERMS_OUTDATED_CODE; message: string };

/**
 * Run before the emailed code is checked, so a refusal does not use up the code. When enforcement is off this always
 * passes and returns whatever version was accepted (possibly stale, possibly null).
 */
export function checkTerms(flow: TermsFlow, args: TermsArgs): TermsCheck {
  const version = acceptedVersion(args);
  if (!termsRequired(flow)) return { ok: true, version };
  if (!version) return { ok: false, code: TERMS_REQUIRED_CODE, message: TERMS_REQUIRED_MESSAGE };
  if (version !== CURRENT_TERMS_VERSION) {
    return { ok: false, code: TERMS_OUTDATED_CODE, message: TERMS_OUTDATED_MESSAGE };
  }
  return { ok: true, version };
}

type Db = Pick<PrismaClient, 'auth' | 'accountEvent'>;

/**
 * Store the acceptance on the auth row and log a `terms_accept` account event. Never throws: a failed write (for
 * example before migration 20261108120000_auth_terms_acceptance is applied) is logged without user values.
 */
export async function recordTermsAcceptance(
  prisma: Db | null | undefined,
  userId: string,
  version: string,
  flow: TermsFlow,
  request: RequestFacts | null,
  now: Date = new Date()
): Promise<void> {
  if (!prisma) return;
  try {
    await prisma.auth.update({
      where: { id: userId },
      data: { terms_version: version, terms_accepted_at: now, age_confirmed_at: now },
      select: { id: true },
    });
  } catch (err) {
    console.error('[terms] acceptance not stored:', (err as Error).message);
  }
  await recordAccountEvent(prisma, {
    userId,
    action: 'terms_accept',
    outcome: 'ok',
    fields: ['terms_version', 'terms_accepted_at', 'age_confirmed_at'],
    after: { terms_version: version, flow, current: version === CURRENT_TERMS_VERSION },
    request,
  });
}
