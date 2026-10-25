/**
 * Email one-time code login: the ONLY place that creates, stores, sends and checks login codes.
 *
 * Provider is chosen by env AUTH_PROVIDER, read on every call:
 *  - local (default): the server's own 8-character code (hashed in auth.magic_link_code_hash, 5 minute TTL,
 *    single use), emailed by emailService. This is the legacy behaviour, kept unchanged (legacyEmailCode).
 *  - cognito: Amazon Cognito emails and checks the code (signup confirmation and sign-in EMAIL_OTP). The server
 *    still issues its own session JWT afterwards; callers in authService do not change.
 *
 * Rollback is AUTH_PROVIDER=local. Plan: docs/grokbots/plan-cognito-auth/README.md.
 */
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { generateMagicLinkCode, normalizeMagicLinkCode } from '../lib/magicLinkCode.js';
import { sendMagicLinkEmail } from '../services/emailService.js';
import { getCognitoAuth } from './cognitoClient.js';

export type AuthProvider = 'local' | 'cognito';
export type AccountRef = { id: string; role: string | null };

const CODE_TTL_MS = 5 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isWellFormedEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function getAuthProvider(): AuthProvider {
  const raw = process.env.AUTH_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === 'local') return 'local';
  if (raw === 'cognito') return 'cognito';
  console.warn(`Unknown AUTH_PROVIDER "${raw}"; using local`);
  return 'local';
}

// ---------------------------------------------------------------------------------------------------------
// local provider (legacy): server-made 8-character code
// ---------------------------------------------------------------------------------------------------------

/**
 * Create a fresh code for the account with this email (if any), store its hash, and email the plain code.
 * Never reveals whether the email exists; send failures are logged, not thrown.
 */
async function legacySendLoginCode(emailRaw: string): Promise<void> {
  const email = emailRaw.trim();
  if (!isWellFormedEmail(email)) return;

  const user = await prisma.auth.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
  if (!user) return;

  const plain = generateMagicLinkCode();
  const hash = await hashPassword(plain);
  await prisma.auth.update({
    where: { id: user.id },
    data: {
      magic_link_code_hash: hash,
      magic_link_expires_at: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  try {
    await sendMagicLinkEmail(user.email, plain);
  } catch (err) {
    console.error('Login code email send failed:', (err as Error).message);
  }
}

/**
 * Check a code for this email. On success the code is consumed and the account { id, role } is returned.
 * Returns null for any failure (unknown email, wrong or expired code, malformed input).
 */
async function legacyVerifyLoginCode(
  emailRaw: string,
  codeRaw: string
): Promise<AccountRef | null> {
  const email = emailRaw.trim();
  const code = normalizeMagicLinkCode(codeRaw);
  if (!isWellFormedEmail(email) || code.length !== 8) return null;

  const user = await prisma.auth.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      id: true,
      role: true,
      magic_link_code_hash: true,
      magic_link_expires_at: true,
    },
  });
  if (!user?.magic_link_code_hash || !user.magic_link_expires_at) return null;
  if (new Date() > user.magic_link_expires_at) return null;

  const match = await comparePassword(code, user.magic_link_code_hash);
  if (!match) return null;

  await prisma.auth.update({
    where: { id: user.id },
    data: { magic_link_code_hash: null, magic_link_expires_at: null },
  });
  return { id: user.id, role: user.role };
}

export const legacyEmailCode = {
  sendLoginCode: legacySendLoginCode,
  verifyLoginCode: legacyVerifyLoginCode,
};

// ---------------------------------------------------------------------------------------------------------
// cognito provider
// ---------------------------------------------------------------------------------------------------------

/**
 * InitiateAuth returns a Session that must come back with the code, but request and verify are two separate
 * GraphQL calls (possibly on different Lambda instances) and the API has no place to hand it to the browser.
 * It is parked in the account's existing auth.magic_link_code_hash / magic_link_expires_at columns with this
 * prefix (no migration). A prefixed value can never match a bcrypt hash, so the local provider ignores it.
 */
const SESSION_PREFIX = 'cognito-otp:';
/** Cognito enforces its own session validity (app client AuthSessionValidity, 3 to 15 minutes). */
const SESSION_MAX_MS = 15 * 60 * 1000;
/** Sign-in codes are digits; signup confirmation codes are digits too. Tolerate spaces and dashes. */
const COGNITO_CODE_RE = /^\d{4,10}$/;

function normalizeCognitoCode(codeRaw: string): string {
  return codeRaw.replace(/[\s-]/g, '');
}

async function findAccountByEmail(email: string) {
  return prisma.auth.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      role: true,
      magic_link_code_hash: true,
      magic_link_expires_at: true,
    },
  });
}

async function cognitoSendLoginCode(emailRaw: string): Promise<void> {
  const email = emailRaw.trim();
  if (!isWellFormedEmail(email)) return;

  // Only accounts we hold are sent to Cognito: unknown emails are a silent no-op, like the local provider.
  const user = await findAccountByEmail(email);
  if (!user) return;

  try {
    const cognito = getCognitoAuth();
    const started = await cognito.startEmailOtp(user.email);
    switch (started.status) {
      case 'code_sent':
        await prisma.auth.update({
          where: { id: user.id },
          data: {
            magic_link_code_hash: `${SESSION_PREFIX}${started.session}`,
            magic_link_expires_at: new Date(Date.now() + SESSION_MAX_MS),
          },
        });
        return;
      case 'not_confirmed':
        // Signed up but never entered the confirmation code: send a fresh one. verify will ConfirmSignUp.
        await clearStoredSession(user.id, user.magic_link_code_hash);
        await cognito.resendConfirmationCode(user.email);
        return;
      case 'not_found':
        console.warn('Cognito has no user for an existing account (run the user migration)');
        return;
      case 'unsupported':
        console.error(
          `Cognito did not start EMAIL_OTP (challenge: ${started.challengeName ?? 'none'}); check the user pool first factors`
        );
        return;
    }
  } catch (err) {
    console.error('Cognito login code request failed:', (err as Error).message);
  }
}

async function clearStoredSession(userId: string, current: string | null | undefined): Promise<void> {
  if (!current?.startsWith(SESSION_PREFIX)) return;
  await prisma.auth.update({
    where: { id: userId },
    data: { magic_link_code_hash: null, magic_link_expires_at: null },
  });
}

async function cognitoVerifyLoginCode(
  emailRaw: string,
  codeRaw: string
): Promise<AccountRef | null> {
  const email = emailRaw.trim();
  const code = normalizeCognitoCode(codeRaw);
  if (!isWellFormedEmail(email) || !COGNITO_CODE_RE.test(code)) return null;

  const user = await findAccountByEmail(email);
  if (!user) return null; // creates nothing: an account row must already exist

  try {
    const cognito = getCognitoAuth();
    const stored = user.magic_link_code_hash;
    const hasSession =
      Boolean(stored?.startsWith(SESSION_PREFIX)) &&
      Boolean(user.magic_link_expires_at) &&
      new Date() <= (user.magic_link_expires_at as Date);

    if (hasSession) {
      // Sign-in code. A wrong code keeps the session so the user can retry (Cognito limits attempts).
      const answered = await cognito.answerEmailOtp(
        user.email,
        code,
        (stored as string).slice(SESSION_PREFIX.length)
      );
      if (answered.status !== 'ok') return null;
      await prisma.auth.update({
        where: { id: user.id },
        data: { magic_link_code_hash: null, magic_link_expires_at: null },
      });
      return { id: user.id, role: user.role };
    }

    // No sign-in session: this is the signup confirmation code. ConfirmSignUp fails for confirmed users.
    const confirmed = await cognito.confirmSignUp(user.email, code);
    if (confirmed.status !== 'confirmed') return null;
    return { id: user.id, role: user.role };
  } catch (err) {
    console.error('Cognito login code check failed:', (err as Error).message);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------
// public API (provider switch)
// ---------------------------------------------------------------------------------------------------------

/**
 * Email a fresh login code to the account with this email (if any). Never reveals whether the email exists;
 * send failures are logged, not thrown.
 */
export async function sendLoginCode(emailRaw: string): Promise<void> {
  return getAuthProvider() === 'cognito'
    ? cognitoSendLoginCode(emailRaw)
    : legacySendLoginCode(emailRaw);
}

/**
 * Check a code for this email. On success the account { id, role } is returned (the caller issues the session).
 * Returns null for any failure (unknown email, wrong or expired code, malformed input).
 */
export async function verifyLoginCode(
  emailRaw: string,
  codeRaw: string
): Promise<AccountRef | null> {
  return getAuthProvider() === 'cognito'
    ? cognitoVerifyLoginCode(emailRaw, codeRaw)
    : legacyVerifyLoginCode(emailRaw, codeRaw);
}

export type SignupIdentityResult = { ok: true } | { ok: false; reason: 'exists' | 'failed' };

/**
 * Signup step 1, before the auth row is written. local: nothing to do. cognito: create the Cognito user
 * (SignUp without a password; Cognito emails the confirmation code). 'exists' means the email is already
 * registered in Cognito.
 */
export async function createSignupIdentity(
  emailRaw: string,
  name?: string | null
): Promise<SignupIdentityResult> {
  if (getAuthProvider() !== 'cognito') return { ok: true };
  try {
    const out = await getCognitoAuth().signUpWithEmail(emailRaw.trim(), {
      name,
      randomPassword: process.env.COGNITO_SIGNUP_RANDOM_PASSWORD === '1',
    });
    return out.status === 'exists' ? { ok: false, reason: 'exists' } : { ok: true };
  } catch (err) {
    console.error('Cognito sign-up failed:', (err as Error).message);
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Signup step 2, after the auth row is written: make sure the new user has a confirmation code.
 * local: email the server-made code. cognito: Cognito already emailed it during createSignupIdentity.
 */
export async function sendSignupCode(emailRaw: string): Promise<void> {
  if (getAuthProvider() === 'cognito') return;
  await legacySendLoginCode(emailRaw);
}
