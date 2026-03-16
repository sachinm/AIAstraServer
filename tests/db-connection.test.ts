/**
 * Integration test: Supabase/Prisma connection.
 * Requires DATABASE_URL in env (e.g. from .env). Run: npm test
 * Skips when DATABASE_URL is not set.
 */
import { describe, it, expect } from 'vitest';
import { checkDatabaseConnection } from '../src/lib/dbCheck.js';
import { prisma } from '../src/lib/prisma.js';

const hasDb =
  !!process.env.DATABASE_URL && !process.env.DATABASE_URL_IS_PLACEHOLDER;

describe('DB connection', () => {
  it('can run a raw query', async () => {
    if (!hasDb) return;
    const result = await prisma.$queryRaw`SELECT 1 as num`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect((result as { num: number }[])[0]).toEqual({ num: 1 });
  });

  it('can connect to database (ping)', async () => {
    if (!hasDb) return;
    await expect(checkDatabaseConnection()).resolves.toBeUndefined();
  });
});
