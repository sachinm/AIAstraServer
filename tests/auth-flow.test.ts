/**
 * Auth flow tests: signup, login, and that sensitive fields are never returned.
 * Requires DATABASE_URL and JWT_SECRET in env for DB tests. Uses real Prisma/DB.
 * "me resolver" test runs without DB (mocked context).
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { login, signup } from '../src/services/authService.js';
import { prisma } from '../src/lib/prisma.js';

const unique = () =>
  `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const hasDb =
  !!process.env.DATABASE_URL && !process.env.DATABASE_URL_IS_PLACEHOLDER;

describe('Auth flow', () => {
  let testUserId: string | null = null;

  beforeAll(() => {
    delete process.env.RECAPTCHA_SECRET_KEY;
  });

  afterAll(async () => {
    if (testUserId && hasDb) {
      try {
        await prisma.auth.delete({ where: { id: testUserId } });
      } catch (_) {}
    }
  });

  it('signup then login returns token and user', async () => {
    if (!hasDb) return;
    const username = unique();
    const email = `${username}@test.local`;
    const password = 'testpass123';

    const signupResult = await signup({
      username,
      password,
      email,
      date_of_birth: '1990-01-15',
      place_of_birth: 'Test City',
      time_of_birth: '10:30',
    });

    expect(signupResult.success).toBe(true);
    if (signupResult.success) {
      expect(signupResult.token).toBeDefined();
      expect(signupResult.user).toBeDefined();
      expect(signupResult.role).toBeDefined();
      testUserId = signupResult.user;
    }

    const loginResult = await login(username, password);
    expect(loginResult.success).toBe(true);
    if (loginResult.success && signupResult.success) {
      expect(loginResult.token).toBeDefined();
      expect(loginResult.user).toBe(signupResult.user);
    }
  });

  it('login with wrong password fails', async () => {
    if (!hasDb) return;
    const username = unique();
    const email = `${username}@test.local`;
    await signup({
      username,
      password: 'rightpass123',
      email,
      date_of_birth: '1990-01-01',
    });
    const row = await prisma.auth.findFirst({ where: { username } });
    if (row) testUserId = row.id;

    const result = await login(username, 'wrongpassword');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBeDefined();
    }
    expect(
      result.success ? result.token : undefined
    ).toBeUndefined();
  });

  it('me resolver never returns password or PII fields', async () => {
    const { resolvers } = await import('../src/graphql/schema.js');
    const db = {
      auth: {
        findUnique: async () => ({
          id: 'fake-id',
          username: 'u',
          email: 'e@e.com',
          role: 'user',
          password: 'secret',
          date_of_birth: '1990-01-01',
          place_of_birth: 'City',
          time_of_birth: '12:00',
        }),
      },
    } as unknown as typeof prisma;
    const result = await resolvers.Query!.me!(null, {}, {
      userId: 'fake-id',
      prisma: db,
      role: 'user',
      request: {} as Request,
    });

    expect(result).toBeDefined();
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('username');
    expect(result).toHaveProperty('email');
    expect(result).toHaveProperty('role');
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('date_of_birth');
    expect(result).not.toHaveProperty('place_of_birth');
    expect(result).not.toHaveProperty('time_of_birth');
  });
});
