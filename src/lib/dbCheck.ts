/**
 * Startup DB connection check. Used by server and can be reused by tests.
 * Throws if DATABASE_URL is missing or the database is unreachable.
 */
import { prisma } from './prisma.js';

export async function checkDatabaseConnection(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    if (/Environment variable not found: DATABASE_URL/.test(msg)) {
      throw new Error(
        'DATABASE_URL is not set. Add it to .env (see .env.example). Cannot start without a database.'
      );
    }
    throw new Error(`Database connection failed: ${msg}`);
  }
}
