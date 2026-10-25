/**
 * Email-only signup and email-code login (no password at signup, code is the only login path).
 * Prisma, email sending, Turnstile and background jobs are replaced with in-memory fakes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fake = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
  sent: [] as Array<{ to: string; code: string }>,
  nextId: 1,
}));

function matches(row: Record<string, any>, where: Record<string, any>): boolean {
  if (where.OR) return (where.OR as Array<Record<string, any>>).some((c) => matches(row, c));
  for (const [key, cond] of Object.entries(where)) {
    if (cond && typeof cond === 'object' && 'equals' in cond) {
      if (String(row[key] ?? '').toLowerCase() !== String(cond.equals).toLowerCase()) return false;
    } else if (row[key] !== cond) {
      return false;
    }
  }
  return true;
}

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    auth: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        const row = fake.rows.find((r) => matches(r, where));
        return row ? { ...row } : null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `user-${fake.nextId++}`, role: 'novice', ...data };
        fake.rows.push(row);
        return { ...row };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const row = fake.rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row ? { ...row } : null;
      }),
    },
  },
}));

vi.mock('../../../src/services/emailService.js', () => ({
  sendMagicLinkEmail: vi.fn(async (to: string, code: string) => {
    fake.sent.push({ to, code });
  }),
}));

vi.mock('../../../src/services/turnstileService.js', () => ({
  assertTurnstileIfConfigured: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../../../src/services/kundliQueueService.js', () => ({
  enqueueKundliSync: vi.fn(async () => undefined),
  processKundliSyncQueue: vi.fn(async () => undefined),
}));

vi.mock('../../../src/services/geminiCacheService.js', () => ({
  ensureGeminiCacheForUser: vi.fn(async () => undefined),
}));

vi.mock('../../../src/graphql/context.js', () => ({
  getJwtSecret: () => 'unit-test-jwt-secret',
}));

vi.mock('../../../src/lib/encrypt.js', () => ({
  encrypt: (plain: string) => `enc:${plain}`,
}));

import {
  signup,
  requestMagicLink,
  loginWithMagicLink,
  login,
  LOGIN_FAILED_OBFUSCATED,
  MAGIC_LINK_LOGIN_FAILED,
} from '../../../src/services/authService.js';
import { generateAccountPassword, comparePassword } from '../../../src/lib/hash.js';
import { validateSignUpInput } from '../../../src/lib/validators.js';

const birth = {
  username: 'asha',
  email: 'asha@example.com',
  date_of_birth: '1990-01-15',
  place_of_birth: 'Pune, India',
  time_of_birth: '10:30:00',
  gender: 'F',
};

function lastCodeFor(email: string): string {
  const mail = [...fake.sent].reverse().find((m) => m.to === email);
  if (!mail) throw new Error(`no code emailed to ${email}`);
  return mail.code;
}

beforeEach(() => {
  fake.rows.length = 0;
  fake.sent.length = 0;
  fake.nextId = 1;
});

describe('signup without a password', () => {
  it('succeeds with email and profile fields only', async () => {
    const result = await signup(birth, null, '203.0.113.5');
    expect(result.success).toBe(true);
    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0].email).toBe('asha@example.com');
    expect(fake.rows[0].date_of_birth).toBe('enc:1990-01-15');
  });

  it('does not sign the user in: no token is returned', async () => {
    const result = await signup(birth, null, null);
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('user');
  });

  it('emails a verification code to the new address', async () => {
    await signup(birth, null, null);
    expect(lastCodeFor('asha@example.com')).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('ignores a password sent by an old client', async () => {
    const result = await signup({ ...birth, password: 'chosen-by-user-1' }, null, null);
    expect(result.success).toBe(true);
    const stored = fake.rows[0].password as string;
    expect(stored).toMatch(/^\$2[aby]\$/);
    expect(await comparePassword('chosen-by-user-1', stored)).toBe(false);
  });

  it('validator strips password and does not require it', () => {
    const parsed = validateSignUpInput({ ...birth });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty('password');
  });

  it('rejects a duplicate email regardless of letter case', async () => {
    await signup(birth, null, null);
    const again = await signup({ ...birth, username: 'asha2', email: 'ASHA@example.com' }, null, null);
    expect(again).toEqual({ success: false, message: 'Username or email already exists' });
    expect(fake.rows).toHaveLength(1);
  });
});

describe('generated account password', () => {
  it('is never returned by signup', async () => {
    const result = await signup(birth, null, null);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain(fake.rows[0].password);
    expect(Object.keys(result).sort()).toEqual(['message', 'success']);
  });

  it('is a strong random secret, different every time', () => {
    const a = generateAccountPassword();
    const b = generateAccountPassword();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('cannot be used to log in with the password path', async () => {
    await signup(birth, null, null);
    const result = await login('asha', 'anything-at-all');
    expect(result).toEqual({ success: false, message: LOGIN_FAILED_OBFUSCATED });
  });
});

describe('email code login end to end', () => {
  it('signup, request a code, enter it, and get a session token', async () => {
    const signed = await signup(birth, null, null);
    expect(signed.success).toBe(true);

    const requested = await requestMagicLink('asha@example.com', null, null);
    expect(requested.success).toBe(true);

    const code = lastCodeFor('asha@example.com');
    const result = await loginWithMagicLink('asha@example.com', code.toLowerCase(), null, null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.token.split('.')).toHaveLength(3);
      expect(result.user).toBe(fake.rows[0].id);
      expect(result.role).toBe('novice');
    }
  });

  it('a code works once only', async () => {
    await signup(birth, null, null);
    const code = lastCodeFor('asha@example.com');
    expect((await loginWithMagicLink('asha@example.com', code, null, null)).success).toBe(true);
    expect(await loginWithMagicLink('asha@example.com', code, null, null)).toEqual({
      success: false,
      message: MAGIC_LINK_LOGIN_FAILED,
    });
  });

  it('a wrong code is refused', async () => {
    await signup(birth, null, null);
    const code = lastCodeFor('asha@example.com');
    const wrong = code === 'AAAAAAAA' ? 'BBBBBBBB' : 'AAAAAAAA';
    const result = await loginWithMagicLink('asha@example.com', wrong, null, null);
    expect(result.success).toBe(false);
  });

  it('an expired code is refused', async () => {
    await signup(birth, null, null);
    const code = lastCodeFor('asha@example.com');
    fake.rows[0].magic_link_expires_at = new Date(Date.now() - 1000);
    const result = await loginWithMagicLink('asha@example.com', code, null, null);
    expect(result.success).toBe(false);
  });

  it('requesting a code for an unknown email looks the same and sends nothing', async () => {
    const result = await requestMagicLink('nobody@example.com', null, null);
    expect(result.success).toBe(true);
    expect(fake.sent).toHaveLength(0);
  });
});
