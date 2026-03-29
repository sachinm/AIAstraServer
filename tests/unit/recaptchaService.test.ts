import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertRecaptchaIfConfigured } from '../../src/services/recaptchaService.js';

describe('assertRecaptchaIfConfigured', () => {
  const originalSecret = process.env.RECAPTCHA_SECRET_KEY;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalSecret === undefined) {
      delete process.env.RECAPTCHA_SECRET_KEY;
    } else {
      process.env.RECAPTCHA_SECRET_KEY = originalSecret;
    }
  });

  it('allows request when RECAPTCHA_SECRET_KEY is unset', async () => {
    delete process.env.RECAPTCHA_SECRET_KEY;
    const r = await assertRecaptchaIfConfigured(undefined);
    expect(r).toEqual({ ok: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects empty token when secret is set', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    const r = await assertRecaptchaIfConfigured('');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/verification/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts when siteverify returns success with score above default', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.9 }),
    } as Response);

    const r = await assertRecaptchaIfConfigured('a'.repeat(25));
    expect(r).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects when score is below RECAPTCHA_MIN_SCORE', async () => {
    process.env.RECAPTCHA_SECRET_KEY = 'test-secret';
    process.env.RECAPTCHA_MIN_SCORE = '0.9';
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, score: 0.2 }),
    } as Response);

    const r = await assertRecaptchaIfConfigured('a'.repeat(25));
    expect(r.ok).toBe(false);
    delete process.env.RECAPTCHA_MIN_SCORE;
  });
});
