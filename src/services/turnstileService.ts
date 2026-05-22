/**
 * Server-side verification of Cloudflare Turnstile tokens (siteverify).
 * When TURNSTILE_SECRET_KEY is unset, {@link assertTurnstileIfConfigured} allows the request.
 */

import { getTurnstileSecret } from '../config/env.js';

type SiteVerifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
};

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null
): Promise<boolean> {
  const secret = getTurnstileSecret();
  if (!secret) return true;

  const body = new URLSearchParams({ secret, response: token });
  const ip = remoteIp?.trim();
  if (ip) body.set('remoteip', ip);

  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }
  );

  if (!res.ok) return false;

  const data = (await res.json()) as SiteVerifyResponse;
  return Boolean(data.success);
}

export type TurnstileGateResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * If TURNSTILE_SECRET_KEY is set, requires a non-empty token that passes siteverify.
 */
export async function assertTurnstileIfConfigured(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileGateResult> {
  const secret = getTurnstileSecret();
  if (!secret) return { ok: true };

  if (!token || typeof token !== 'string' || token.length < 20) {
    return {
      ok: false,
      message: 'Human verification required. Please try again.',
    };
  }

  const ok = await verifyTurnstileToken(token, remoteIp);
  if (!ok) {
    return {
      ok: false,
      message: 'Verification failed. Please try again.',
    };
  }

  return { ok: true };
}
