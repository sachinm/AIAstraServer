import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../graphql/context.js';
import { comparePassword, generateAccountPassword, hashPassword } from '../lib/hash.js';
import { encrypt } from '../lib/encrypt.js';
import { DEFAULT_SIGNUP_ROLE } from '../auth/roles.js';
import { sendLoginCode, verifyLoginCode } from '../auth/emailCode.js';
import { validateLoginInput, validateSignUpInput } from '../lib/validators.js';
import { enqueueKundliSync, processKundliSyncQueue } from './kundliQueueService.js';
import { ensureGeminiCacheForUser } from './geminiCacheService.js';
import { assertTurnstileIfConfigured } from './turnstileService.js';
import type { z } from 'zod';
import type { signUpSchema } from '../lib/validators.js';

const DEFAULT_EXPIRY = '7d';

/** Shown for any password login failure (no user enumeration). */
export const LOGIN_FAILED_OBFUSCATED =
  'Unable to sign in. Check your email and password and try again.';

/** Same response whether or not the email exists. */
export const MAGIC_LINK_REQUEST_MESSAGE =
  "If that email is registered, you'll receive a message with an 8-character code. The code expires in 5 minutes.";

export const MAGIC_LINK_LOGIN_FAILED =
  'Unable to sign in. Check your code and try again.';

export const SIGNUP_CODE_MESSAGE =
  'Account created. Enter the 8-character code we emailed you to finish signing in.';

export type LoginResult =
  | { success: true; token: string; user: string; role: string }
  | { success: false; message: string };

/** Signup does not sign the user in: they confirm the emailed code first (loginWithMagicLink). */
export type SignUpResult =
  | { success: true; message: string }
  | { success: false; message: string };

/**
 * Validate credentials and return user id and role. Returns null if invalid.
 * Accepts username OR email as the identifier.
 */
export async function validateLogin(
  usernameOrEmail: string,
  password: string
): Promise<{ id: string; role: string | null } | null> {
  const user = await prisma.auth.findFirst({
    where: {
      OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    },
    select: { id: true, role: true, password: true },
  });
  if (!user) return null;
  const ok = await comparePassword(password, user.password);
  if (!ok) return null;
  return { id: user.id, role: user.role };
}

/**
 * Issue a JWT for the given user (opaque: only sub and role).
 */
export function issueToken(userId: string, role = 'user'): string {
  const secret = getJwtSecret();
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: DEFAULT_EXPIRY });
}

/**
 * Password login (legacy). The web app no longer offers it, and accounts created by signup hold a
 * random password that is never disclosed, so they cannot use it.
 */
export async function login(
  username: string,
  password: string,
  turnstileToken?: string | null,
  remoteIp?: string | null
): Promise<LoginResult> {
  const gate = await assertTurnstileIfConfigured(turnstileToken, remoteIp);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const parsed = validateLoginInput({ username, password });
  if (!parsed.success) {
    return { success: false, message: LOGIN_FAILED_OBFUSCATED };
  }
  const { username: u, password: p } = parsed.data;
  const user = await validateLogin(u, p);
  if (!user) {
    return { success: false, message: LOGIN_FAILED_OBFUSCATED };
  }
  await enqueueKundliSync(prisma, user.id).catch((err) => {
    console.error('enqueueKundliSync after login failed:', (err as Error).message);
  });
  processKundliSyncQueue(prisma).catch((err) => {
    console.error('processKundliSyncQueue after login failed:', (err as Error).message);
  });
  ensureGeminiCacheForUser(prisma, user.id).catch((err) => {
    console.error('ensureGeminiCacheForUser after login failed:', (err as Error).message);
  });
  const token = issueToken(user.id, user.role ?? 'user');
  return {
    success: true,
    token,
    user: user.id,
    role: user.role ?? 'user',
  };
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
 * Complete email-code login with the 8-character code from email.
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
 * confirms the address by entering it. Any `password` in the input is ignored.
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

  const existing = await prisma.auth.findFirst({
    where: {
      OR: [{ username }, { email: { equals: email, mode: 'insensitive' } }],
    },
  });
  if (existing) {
    return { success: false, message: 'Username or email already exists' };
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

  // Email verification code; Cognito replaces this later (see src/auth/emailCode.ts).
  await sendLoginCode(email);

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
