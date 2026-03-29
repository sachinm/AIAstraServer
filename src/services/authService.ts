import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../graphql/context.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { encrypt } from '../lib/encrypt.js';
import { validateLoginInput, validateSignUpInput } from '../lib/validators.js';
import { enqueueKundliSync, processKundliSyncQueue } from './kundliQueueService.js';
import { assertRecaptchaIfConfigured } from './recaptchaService.js';
import { sendMagicLinkEmail } from './emailService.js';
import { generateMagicLinkCode, normalizeMagicLinkCode } from '../lib/magicLinkCode.js';
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

const MAGIC_LINK_TTL_MS = 5 * 60 * 1000;

export type LoginResult =
  | { success: true; token: string; user: string; role: string }
  | { success: false; message: string };

export type SignUpResult =
  | { success: true; token: string; user: string; role: string }
  | { success: false; message: string };

/**
 * Validate credentials and return user id and role. Returns null if invalid.
 * Accepts username OR email as the identifier (frontend shows "Email or Username").
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
 * Login: validate credentials and return { success, token, user } or { success: false, message }.
 */
export async function login(
  username: string,
  password: string,
  recaptchaToken?: string | null
): Promise<LoginResult> {
  const gate = await assertRecaptchaIfConfigured(recaptchaToken);
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
 * Request a magic-link code (email). Always returns the same user-visible message when successful path.
 */
export async function requestMagicLink(
  emailRaw: string,
  recaptchaToken?: string | null
): Promise<MagicLinkRequestResult> {
  const gate = await assertRecaptchaIfConfigured(recaptchaToken);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const email = emailRaw.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return { success: true, message: MAGIC_LINK_REQUEST_MESSAGE };
  }

  const user = await prisma.auth.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });

  if (user) {
    const plain = generateMagicLinkCode();
    const hash = await hashPassword(plain);
    const expires = new Date(Date.now() + MAGIC_LINK_TTL_MS);
    await prisma.auth.update({
      where: { id: user.id },
      data: {
        magic_link_code_hash: hash,
        magic_link_expires_at: expires,
      },
    });
    try {
      await sendMagicLinkEmail(user.email, plain);
    } catch (err) {
      console.error('Magic link email send failed:', (err as Error).message);
    }
  }

  return { success: true, message: MAGIC_LINK_REQUEST_MESSAGE };
}

/**
 * Complete magic-link login with 8-character code from email.
 */
export async function loginWithMagicLink(
  emailRaw: string,
  codeRaw: string,
  recaptchaToken?: string | null
): Promise<LoginResult> {
  const gate = await assertRecaptchaIfConfigured(recaptchaToken);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const email = emailRaw.trim();
  const code = normalizeMagicLinkCode(codeRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || code.length !== 8) {
    return { success: false, message: MAGIC_LINK_LOGIN_FAILED };
  }

  const user = await prisma.auth.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: {
      id: true,
      role: true,
      magic_link_code_hash: true,
      magic_link_expires_at: true,
    },
  });

  if (!user?.magic_link_code_hash || !user.magic_link_expires_at) {
    return { success: false, message: MAGIC_LINK_LOGIN_FAILED };
  }

  if (new Date() > user.magic_link_expires_at) {
    return { success: false, message: MAGIC_LINK_LOGIN_FAILED };
  }

  const match = await comparePassword(code, user.magic_link_code_hash);
  if (!match) {
    return { success: false, message: MAGIC_LINK_LOGIN_FAILED };
  }

  await prisma.auth.update({
    where: { id: user.id },
    data: {
      magic_link_code_hash: null,
      magic_link_expires_at: null,
    },
  });

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

  const token = issueToken(user.id, user.role ?? 'user');
  return {
    success: true,
    token,
    user: user.id,
    role: user.role ?? 'user',
  };
}

/**
 * Signup: create user. Returns { success, token, user } or { success: false, message }.
 */
export async function signup(
  input: unknown,
  recaptchaToken?: string | null,
  clientIp?: string | null
): Promise<SignUpResult> {
  const gate = await assertRecaptchaIfConfigured(recaptchaToken);
  if (!gate.ok) {
    return { success: false, message: gate.message };
  }

  const parsed = validateSignUpInput(input);
  if (!parsed.success) {
    return { success: false, message: 'Invalid input' };
  }

  const {
    username,
    password,
    date_of_birth,
    place_of_birth,
    time_of_birth,
    email,
    gender,
  } = parsed.data;

  const existing = await prisma.auth.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });
  if (existing) {
    return { success: false, message: 'Username or email already exists' };
  }

  const hashedPassword = await hashPassword(password);

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
    },
  });

  await enqueueKundliSync(prisma, created.id).catch((err) => {
    console.error('enqueueKundliSync after signup failed:', (err as Error).message);
  });
  processKundliSyncQueue(prisma).catch((err) => {
    console.error('processKundliSyncQueue after signup failed:', (err as Error).message);
  });
  const token = issueToken(created.id, created.role ?? 'user');
  return {
    success: true,
    token,
    user: created.id,
    role: created.role ?? 'user',
  };
}
