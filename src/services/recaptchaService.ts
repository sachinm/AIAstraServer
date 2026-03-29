/**
 * Server-side verification of Google reCAPTCHA v2/v3 tokens (siteverify).
 * When RECAPTCHA_SECRET_KEY is unset, {@link assertRecaptchaIfConfigured} allows the request.
 */

import { getRecaptchaMinScore, getRecaptchaSecret } from '../config/env.js';

type SiteVerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
};

export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  const secret = getRecaptchaSecret();
  if (!secret) return true;

  const body = new URLSearchParams({ secret, response: token });
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) return false;

  const data = (await res.json()) as SiteVerifyResponse;
  if (!data.success) return false;

  const minScore = getRecaptchaMinScore();
  if (data.score !== undefined && data.score < minScore) return false;

  return true;
}

export type RecaptchaGateResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * If RECAPTCHA_SECRET_KEY is set, requires a non-empty token that passes siteverify.
 */
export async function assertRecaptchaIfConfigured(
  token: string | null | undefined
): Promise<RecaptchaGateResult> {
  const secret = getRecaptchaSecret();
  if (!secret) return { ok: true };

  if (!token || typeof token !== 'string' || token.length < 20) {
    return {
      ok: false,
      message: 'Human verification required. Please try again.',
    };
  }

  const ok = await verifyRecaptchaToken(token);
  if (!ok) {
    return {
      ok: false,
      message: 'Verification failed. Please try again.',
    };
  }

  return { ok: true };
}
