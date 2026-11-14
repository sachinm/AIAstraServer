/**
 * Tests for cross-Lambda DB-backed OTP 5-strike lockout (SEC-01) and GraphQL fail-closed authUnavailable guard.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSchema, createYoga } from 'graphql-yoga';
import jwt from 'jsonwebtoken';
import { hashPassword } from '../../../src/lib/hash.js';
import { lockGuardPlugin } from '../../../src/graphql/lockGuard.js';
import { buildContext } from '../../../src/graphql/context.js';
import { resetRequestAuthForTests } from '../../../src/auth/requestAuth.js';

const mockState = vi.hoisted(() => ({
  row: null as Record<string, any> | null,
  appErrors: [] as Array<{ data: Record<string, any> }>,
  accountEvents: [] as Array<{ data: Record<string, any> }>,
}));

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    auth: {
      findFirst: vi.fn(async () => (mockState.row ? { ...mockState.row } : null)),
      update: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        if (mockState.row) Object.assign(mockState.row, data);
        return mockState.row ? { ...mockState.row } : null;
      }),
    },
    appErrorEvent: {
      create: vi.fn(async (args: { data: Record<string, any> }) => {
        mockState.appErrors.push(args);
        return args.data;
      }),
    },
    accountEvent: {
      create: vi.fn(async (args: { data: Record<string, any> }) => {
        mockState.accountEvents.push(args);
        return args.data;
      }),
    },
  },
}));

vi.mock('../../../src/services/emailService.js', () => ({
  sendMagicLinkEmail: vi.fn(async () => undefined),
}));

import { popLastOtpFailure, sendLoginCode, verifyLoginCode } from '../../../src/auth/emailCode.js';
import { sendMagicLinkEmail } from '../../../src/services/emailService.js';

describe('OTP brute-force DB lockout (SEC-01)', () => {
  const prevProvider = process.env.AUTH_PROVIDER;
  const prevMax = process.env.OTP_MAX_FAILED_ATTEMPTS;
  const prevMins = process.env.OTP_LOCKOUT_MINUTES;

  afterEach(() => {
    mockState.row = null;
    mockState.appErrors = [];
    mockState.accountEvents = [];
    process.env.AUTH_PROVIDER = prevProvider;
    process.env.OTP_MAX_FAILED_ATTEMPTS = prevMax;
    process.env.OTP_LOCKOUT_MINUTES = prevMins;
    vi.clearAllMocks();
  });

  it('locks the account after 5 consecutive wrong codes across requests, refuses valid codes while locked, and emits telemetry', async () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.OTP_MAX_FAILED_ATTEMPTS = '5';
    process.env.OTP_LOCKOUT_MINUTES = '15';

    const goodCode = 'ABCD2345';
    const hash = await hashPassword(goodCode);
    mockState.row = {
      id: 'user-otp-1',
      email: 'seeker@example.com',
      role: 'user',
      locked_at: null,
      magic_link_code_hash: hash,
      magic_link_expires_at: new Date(Date.now() + 300_000),
      failed_otp_attempts: 0,
      otp_locked_until: null,
    };

    for (let i = 1; i <= 4; i++) {
      const r = await verifyLoginCode('seeker@example.com', 'ZZZZ9999');
      expect(r).toBeNull();
      expect(mockState.row.failed_otp_attempts).toBe(i);
      expect(mockState.row.otp_locked_until).toBeNull();
      expect(popLastOtpFailure('seeker@example.com')).toBe('wrong_code');
    }

    // 5th failure triggers DB lock + clears pending hashes + emits app_error_events & account_events
    const fifth = await verifyLoginCode('seeker@example.com', 'ZZZZ9999');
    expect(fifth).toBeNull();
    expect(mockState.row.failed_otp_attempts).toBe(5);
    expect(mockState.row.otp_locked_until).toBeInstanceOf(Date);
    expect((mockState.row.otp_locked_until as Date).getTime()).toBeGreaterThan(Date.now());
    expect(mockState.row.magic_link_code_hash).toBeNull();
    expect(popLastOtpFailure('seeker@example.com')).toBe('otp_locked');

    await new Promise((r) => setTimeout(r, 15));
    expect(mockState.appErrors.some((e) => e.data.category === 'otp_locked' && e.data.error_code === 'OTP_LOCKED')).toBe(true);
    expect(mockState.accountEvents.some((e) => e.data.action === 'otp_locked' && e.data.outcome === 'refused')).toBe(true);

    // Sending a fresh OTP while locked is silently refused
    await sendLoginCode('seeker@example.com');
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();

    // Even the previously valid code is rejected while otp_locked_until is in the future
    mockState.row.magic_link_code_hash = hash;
    mockState.row.magic_link_expires_at = new Date(Date.now() + 300_000);
    const blocked = await verifyLoginCode('seeker@example.com', goodCode);
    expect(blocked).toBeNull();
    expect(popLastOtpFailure('seeker@example.com')).toBe('otp_locked');
  });

  it('resets failed_otp_attempts to 0 when a valid OTP succeeds before lockout', async () => {
    process.env.AUTH_PROVIDER = 'local';
    process.env.OTP_MAX_FAILED_ATTEMPTS = '5';
    const goodCode = 'WXYZ6789';
    const hash = await hashPassword(goodCode);
    mockState.row = {
      id: 'user-otp-2',
      email: 'valid@example.com',
      role: 'user',
      locked_at: null,
      magic_link_code_hash: hash,
      magic_link_expires_at: new Date(Date.now() + 300_000),
      failed_otp_attempts: 3,
      otp_locked_until: null,
    };

    const ok = await verifyLoginCode('valid@example.com', goodCode);
    expect(ok).toEqual({ id: 'user-otp-2', role: 'user', locked: false });
    expect(mockState.row.failed_otp_attempts).toBe(0);
    expect(mockState.row.otp_locked_until).toBeNull();
  });
});

describe('GraphQL buildContext + lockGuardPlugin fail-closed on DB error', () => {
  it('propagates authUnavailable and stops GraphQL execution with 503 AUTH_UNAVAILABLE', async () => {
    resetRequestAuthForTests();
    const secret = 'fail-closed-graphql-secret-key-32ch';
    const token = jwt.sign({ sub: 'u-db-down', role: 'user' }, secret);

    const schema = createSchema({
      typeDefs: `type Query { me: String! }`,
      resolvers: { Query: { me: () => 'should-not-run' } },
    });

    const yoga = createYoga({
      schema: schema as never,
      plugins: [lockGuardPlugin()],
      context: ({ request }) =>
        buildContext(
          { request },
          {
            secret,
            readRow: async () => {
              throw Object.assign(new Error('ETIMEDOUT'), { code: 'P1001' });
            },
          }
        ),
      maskedErrors: false,
    });

    const res = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Astra-Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ query: '{ me }' }),
    });
    const body = (await res.json()) as { data?: unknown; errors?: Array<{ extensions?: { code?: string; http?: { status?: number } } }> };
    expect(res.status).toBe(503);
    expect(body.errors?.[0]?.extensions?.code).toBe('AUTH_UNAVAILABLE');
  });
});
