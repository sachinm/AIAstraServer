import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

/**
 * Hash a plaintext password for storage. Use before prisma.auth.create/update.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare plaintext password with stored hash. Use in login.
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Strong random secret for accounts that never log in with a password (email code is the only login).
 * It is hashed and stored, never returned or shown to anyone.
 */
export function generateAccountPassword(): string {
  return crypto.randomBytes(32).toString('base64url');
}
