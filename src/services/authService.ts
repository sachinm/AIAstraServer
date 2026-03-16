import type { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../graphql/context.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { encrypt } from '../lib/encrypt.js';
import { validateLoginInput, validateSignUpInput } from '../lib/validators.js';
import { enqueueKundliSync, processKundliSyncQueue } from './kundliQueueService.js';
import type { z } from 'zod';
import type { signUpSchema } from '../lib/validators.js';

const DEFAULT_EXPIRY = '7d';

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
export async function login(username: string, password: string): Promise<LoginResult> {
  const parsed = validateLoginInput({ username, password });
  if (!parsed.success) {
    return { success: false, message: 'Invalid input' };
  }
  const { username: u, password: p } = parsed.data;
  const user = await validateLogin(u, p);
  if (!user) {
    return { success: false, message: 'Invalid username or password' };
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

/**
 * Signup: create user. Returns { success, token, user } or { success: false, message }.
 */
export async function signup(input: unknown): Promise<SignUpResult> {
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
