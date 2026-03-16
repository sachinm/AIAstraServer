import bcrypt from 'bcryptjs';

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
