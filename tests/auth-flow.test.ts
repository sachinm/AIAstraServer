/**
 * Auth flow tests: signup, login, and that sensitive fields are never returned.
 * Requires DATABASE_URL and JWT_SECRET in env for DB tests. Uses real Prisma/DB.
 * "me resolver" test runs without DB (mocked context).
 */
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import {
  login,
  signup,
  LOGIN_FAILED_OBFUSCATED,
} from '../src/services/authService.js';
import { prisma } from '../src/lib/prisma.js';
import { hashIdentifier } from '../src/lib/identifierHash.js';

const unique = () =>
  `testuser_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const hasDb =
  !!process.env.DATABASE_URL && !process.env.DATABASE_URL_IS_PLACEHOLDER;

function auditRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://api.example.com/graphql', {
    headers: {
      'user-agent': 'vitest',
      'cf-connecting-ip': '203.0.113.50',
      ...headers,
    },
  });
}

describe('Auth flow', () => {
  let testUserId: string | null = null;

  beforeAll(() => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? 'test-jwt-secret-min-32-characters-long';
  });

  afterAll(async () => {
    if (testUserId && hasDb) {
      try {
        await prisma.loginAttempt.deleteMany({ where: { user_id: testUserId } });
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

    const loginResult = await login(
      username,
      password,
      null,
      auditRequest()
    );
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

    const result = await login(username, 'wrongpassword', null, auditRequest());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toBe(LOGIN_FAILED_OBFUSCATED);
    }
    expect(
      result.success ? result.token : undefined
    ).toBeUndefined();

    const attempts = await prisma.loginAttempt.findMany({
      where: { user_id: row!.id },
      orderBy: { occurred_at: 'desc' },
      take: 1,
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.outcome).toBe('failure');
    expect(attempts[0]?.failure_reason).toBe('invalid_credentials');
    expect(attempts[0]?.auth_method).toBe('password');
    expect(attempts[0]?.client_ip).toBe('203.0.113.50');
    expect(attempts[0]?.identifier_hash).toBe(
      hashIdentifier(username, 'username')
    );
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
