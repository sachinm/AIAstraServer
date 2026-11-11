/**
 * Cheap input checks run BEFORE the single-use Turnstile token is verified, and those early refusals carry
 * `turnstileConsumed: false` so the web page keeps the token. Everything is mocked: no database, mail or network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const gate = vi.hoisted(() => ({ calls: 0, ok: true }));

vi.mock('../../../src/services/turnstileService.js', () => ({
  assertTurnstileIfConfigured: async () => {
    gate.calls += 1;
    return gate.ok ? { ok: true } : { ok: false, message: 'Verification failed. Please try again.' };
  },
}));
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { auth: { findFirst: async () => null, create: async () => ({ id: 'u1' }), update: async () => ({}), delete: async () => ({}) } },
}));
vi.mock('../../../src/auth/emailCode.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/auth/emailCode.js')>('../../../src/auth/emailCode.js');
  return {
    ...actual,
    sendLoginCode: async () => undefined,
    sendSignupCode: async () => undefined,
    verifyLoginCode: async () => null,
    createSignupIdentity: async () => ({ ok: true, reusedExisting: false }),
  };
});
vi.mock('../../../src/services/kundliQueueService.js', () => ({ enqueueKundliSync: async () => undefined }));
vi.mock('../../../src/services/kundliSyncWorker.js', () => ({ scheduleKundliSync: async () => undefined }));
vi.mock('../../../src/services/geminiCacheService.js', () => ({ ensureGeminiCacheForUser: async () => undefined }));

import {
  requestMagicLink,
  loginWithMagicLink,
  startSignup,
  signup,
  MAGIC_LINK_LOGIN_FAILED,
} from '../../../src/services/authService.js';

const TOKEN = 'x'.repeat(40);

beforeEach(() => {
  gate.calls = 0;
  gate.ok = true;
  delete process.env.AUTH_PROVIDER;
});
afterEach(() => {
  delete process.env.AUTH_PROVIDER;
});

describe('requestMagicLink', () => {
  it('verifies Turnstile for a good email and does not mark the token unspent on a gate failure', async () => {
    gate.ok = false;
    const r = await requestMagicLink('a@b.com', TOKEN, null);
    expect(gate.calls).toBe(1);
    expect(r.success).toBe(false);
    expect('turnstileConsumed' in r).toBe(false);
  });
});

describe('loginWithMagicLink', () => {
  it('refuses a malformed email before Turnstile', async () => {
    const r = await loginWithMagicLink('nope', 'ABCD2345', TOKEN, null);
    expect(r).toMatchObject({ success: false, turnstileConsumed: false });
    expect(gate.calls).toBe(0);
  });
  it('refuses a short code (local provider) with the usual message and without Turnstile', async () => {
    const r = await loginWithMagicLink('a@b.com', 'ABC', TOKEN, null);
    expect(r).toMatchObject({ success: false, message: MAGIC_LINK_LOGIN_FAILED, turnstileConsumed: false });
    expect(gate.calls).toBe(0);
  });
  it('refuses a non-numeric code under cognito without Turnstile', async () => {
    process.env.AUTH_PROVIDER = 'cognito';
    const r = await loginWithMagicLink('a@b.com', 'abcdef', TOKEN, null);
    expect(r).toMatchObject({ success: false, turnstileConsumed: false });
    expect(gate.calls).toBe(0);
  });
  it('reaches Turnstile with a well-formed email and code; a wrong code is a spent token (no marker)', async () => {
    const r = await loginWithMagicLink('a@b.com', 'ABCD2345', TOKEN, null);
    expect(gate.calls).toBe(1);
    expect(r.success).toBe(false);
    expect('turnstileConsumed' in r).toBe(false);
  });
  it('a failed Turnstile check carries no marker', async () => {
    gate.ok = false;
    const r = await loginWithMagicLink('a@b.com', '12345678', TOKEN, null);
    expect(gate.calls).toBe(1);
    expect('turnstileConsumed' in r).toBe(false);
  });
});

describe('startSignup', () => {
  it('refuses missing fields before Turnstile', async () => {
    const r = await startSignup({ name: '', email: 'bad' }, TOKEN, null);
    expect(r).toMatchObject({ success: false, message: 'Invalid input', turnstileConsumed: false });
    expect(gate.calls).toBe(0);
  });
  it('checks Turnstile for valid input and marks nothing on a gate failure', async () => {
    gate.ok = false;
    const r = await startSignup({ name: 'Asha', email: 'a@b.com' }, TOKEN, null);
    expect(gate.calls).toBe(1);
    expect('turnstileConsumed' in r).toBe(false);
  });
});

describe('signup (deprecated one-shot)', () => {
  it('refuses invalid input before Turnstile', async () => {
    const r = await signup({}, TOKEN, null);
    expect(r).toMatchObject({ success: false, message: 'Invalid input', turnstileConsumed: false });
    expect(gate.calls).toBe(0);
  });
});
