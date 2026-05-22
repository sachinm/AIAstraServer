import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertTurnstileIfConfigured } from '../../src/services/turnstileService.js';

describe('assertTurnstileIfConfigured', () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalSecret === undefined) {
      delete process.env.TURNSTILE_SECRET_KEY;
    } else {
      process.env.TURNSTILE_SECRET_KEY = originalSecret;
    }
  });

  it('allows request when TURNSTILE_SECRET_KEY is unset', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const r = await assertTurnstileIfConfigured(undefined);
    expect(r).toEqual({ ok: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects empty token when secret is set', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    const r = await assertTurnstileIfConfigured('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/verification/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts when siteverify returns success', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    const r = await assertTurnstileIfConfigured('a'.repeat(25));
    expect(r).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects when siteverify returns success false', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response);

    const r = await assertTurnstileIfConfigured('a'.repeat(25));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/failed/i);
  });

  it('includes remoteip in siteverify when provided', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'test-secret';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await assertTurnstileIfConfigured('a'.repeat(25), '203.0.113.1');
    const call = vi.mocked(fetch).mock.calls[0];
    const body = call?.[1]?.body as URLSearchParams;
    expect(body?.get('remoteip')).toBe('203.0.113.1');
  });
});
