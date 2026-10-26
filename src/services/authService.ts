import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../graphql/context.js';
import { generateAccountPassword, hashPassword } from '../lib/hash.js';
import { encrypt } from '../lib/encrypt.js';
import { DEFAULT_SIGNUP_ROLE } from '../auth/roles.js';
import {
  sendLoginCode,
  verifyLoginCode,
  createSignupIdentity,
  sendSignupCode,
} from '../auth/emailCode.js';
import { validateSignUpInput } from '../lib/validators.js';
import { enqueueKundliSync, processKundliSyncQueue } from './kundliQueueService.js';
import { ensureGeminiCacheForUser } from './geminiCacheService.js';
import { assertTurnstileIfConfigured } from './turnstileService.js';
import type { z } from 'zod';
import type { signUpSchema } from '../lib/validators.js';

const DEFAULT_EXPIRY = '7d';

/** Same response whether or not the email exists. */
export const MAGIC_LINK_REQUEST_MESSAGE =
  "If that email is registered, we've sent it a code. Enter the code we emailed you. It expires in a few minutes.";

export const MAGIC_LINK_LOGIN_FAILED =
  'Unable to sign in. Check your code and try again.';

export const SIGNUP_CODE_MESSAGE =
  'Account created. Enter the code we emailed you. It expires in a few minutes.';

export type LoginResult =
  | { success: true; token: string; user: string; role: string }
  | { success: false; message: string };

/** Stable code for a signup refused because the email is already registered. */
export const EMAIL_EXISTS_CODE = 'EMAIL_EXISTS';
/** Stable code for a signup that failed on our side and left nothing behind: the client may simply retry. */
export const SIGNUP_RETRY_CODE = 'SIGNUP_RETRY';
export const SIGNUP_RETRY_MESSAGE =
  'We could not create your account just now. Please try again in a moment.';
export const EMAIL_EXISTS_MESSAGE =
  'This email is already registered. Please sign in instead.';

/** Signup does not sign the user in: they confirm the emailed code first (loginWithMagicLink). */
export type SignUpResult =
  | { success: true; message: string }
  | { success: false; message: string; code?: typeof EMAIL_EXISTS_CODE | typeof SIGNUP_RETRY_CODE };

/**
 * Issue a JWT for the given user (opaque: only sub and role).
 */
export function issueToken(userId: string, role = 'user'): string {
  const secret = getJwtSecret();
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: DEFAULT_EXPIRY });
}

export type SignUpInput = z.infer<typeof signUpSchema>;

export type MagicLinkRequestResult =
  | { success: true; message: string }
  | { success: false; message: string };

/**
 * Request a login code by email. Always returns the same user-visible message when successful path.
 */
export async function requestMagicLink(
  emailRaw: string,
  turnstileToken?: string | null,
  remoteIp?: string | null
): Promise<MagicLinkRequestResult> {
  const gate = await assertTurnstileIfConfigured(turnstileToken, remoteIp);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  await sendLoginCode(emailRaw);
  return { success: true, message: MAGIC_LINK_REQUEST_MESSAGE };
}

/**
 * Complete email-code login with the code from email.
 */
export async function loginWithMagicLink(
  emailRaw: string,
  codeRaw: string,
  turnstileToken?: string | null,
  remoteIp?: string | null
): Promise<LoginResult> {
  const gate = await assertTurnstileIfConfigured(turnstileToken, remoteIp);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const user = await verifyLoginCode(emailRaw, codeRaw);
  if (!user) {
    return { success: false, message: MAGIC_LINK_LOGIN_FAILED };
  }

  await enqueueKundliSync(prisma, user.id).catch((err) => {
    console.error(
      'enqueueKundliSync after magic link login failed:',
      (err as Error).message
    );
  });
  processKundliSyncQueue(prisma).catch((err) => {
    console.error(
      'processKundliSyncQueue after magic link login failed:',
      (err as Error).message
    );
  });
  ensureGeminiCacheForUser(prisma, user.id).catch((err) => {
    console.error('ensureGeminiCacheForUser after magic link login failed:', (err as Error).message);
  });

  const token = issueToken(user.id, user.role ?? 'user');
  return {
    success: true,
    token,
    user: user.id,
    role: user.role ?? 'user',
  };
}

/**
 * Signup: create the account from email and profile fields only. A random password is generated,
 * hashed and stored (never returned, never used for login). A login code is emailed so the new user
 * confirms the address by entering it (Cognito sends it when AUTH_PROVIDER=cognito). Any `password` in the input is ignored.
 */
export async function signup(
  input: unknown,
  turnstileToken?: string | null,
  clientIp?: string | null
): Promise<SignUpResult> {
  const gate = await assertTurnstileIfConfigured(turnstileToken, clientIp);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const parsed = validateSignUpInput(input);
  if (!parsed.success) {
    return { success: false, message: 'Invalid input' };
  }

  const {
    username,
    date_of_birth,
    place_of_birth,
    time_of_birth,
    email,
    gender,
  } = parsed.data;

  const emailTaken = await prisma.auth.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (emailTaken) {
    return { success: false, code: EMAIL_EXISTS_CODE, message: EMAIL_EXISTS_MESSAGE };
  }

  const usernameTaken = await prisma.auth.findFirst({
    where: { username },
    select: { id: true },
  });
  if (usernameTaken) {
    return { success: false, message: 'Username already exists' };
  }

  const hashedPassword = await hashPassword(generateAccountPassword());

  const dateOfBirthEnc = encrypt(date_of_birth);
  const placeOfBirthEnc = place_of_birth ? encrypt(place_of_birth) : null;
  const timeOfBirthEnc = time_of_birth ? encrypt(time_of_birth) : null;

  const created = await prisma.auth.create({
    data: {
      username,
      password: hashedPassword,
      date_of_birth: dateOfBirthEnc ?? date_of_birth,
      place_of_birth: placeOfBirthEnc ?? place_of_birth ?? null,
      time_of_birth: timeOfBirthEnc ?? time_of_birth ?? null,
      email,
      gender: gender ?? null,
      signup_ip: clientIp?.trim() || null,
      // general public registers as novice (src/auth/roles.ts)
      role: DEFAULT_SIGNUP_ROLE,
    },
  });

  // AUTH_PROVIDER=cognito: the row exists first (we own it), then the Cognito user is created and emails the
  // confirmation code. If Cognito refuses, the row is deleted so nothing is left behind on either side and a
  // retry does not report "email taken". local: createSignupIdentity is a no-op.
  const identity = await createSignupIdentity(email, username);
  if (!identity.ok) {
    await prisma.auth.delete({ where: { id: created.id } }).catch((err) => {
      console.error('signup rollback (delete auth row) failed:', (err as Error).message);
    });
    if (identity.reason === 'exists') {
      return { success: false, code: EMAIL_EXISTS_CODE, message: EMAIL_EXISTS_MESSAGE };
    }
    return { success: false, code: SIGNUP_RETRY_CODE, message: SIGNUP_RETRY_MESSAGE };
  }

  // Email verification code (local provider only; Cognito already sent it, see src/auth/emailCode.ts).
  await sendSignupCode(email);

  await enqueueKundliSync(prisma, created.id).catch((err) => {
    console.error('enqueueKundliSync after signup failed:', (err as Error).message);
  });
  processKundliSyncQueue(prisma).catch((err) => {
    console.error('processKundliSyncQueue after signup failed:', (err as Error).message);
  });
  ensureGeminiCacheForUser(prisma, created.id).catch((err) => {
    console.error('ensureGeminiCacheForUser after signup failed:', (err as Error).message);
  });
  return { success: true, message: SIGNUP_CODE_MESSAGE };
}
