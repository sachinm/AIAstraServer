/**
 * Server-side verification of Cloudflare Turnstile tokens (siteverify).
 * When TURNSTILE_SECRET_KEY is unset, {@link assertTurnstileIfConfigured} allows the request outside
 * staging and production and refuses it there.
 */

import { getTurnstileSecret } from '../config/env.js';

/** Environments that must never run without the Turnstile secret (Lambda staging and production). */
const DEPLOYED_NODE_ENVS = new Set(['production', 'staging']);

type SiteVerifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
};

export interface TurnstileVerificationDetail {
  ok: boolean;
  errorCodes: string[];
  hostname?: string;
}

const lastTurnstileFailures = new Map<string, { at: number; reason: string; errorCodes: string[] }>();

export function popLastTurnstileFailure(ip?: string | null): { reason: string; errorCodes: string[] } | null {
  const key = ip?.trim() || 'anon';
  const entry = lastTurnstileFailures.get(key);
  if (!entry) return null;
  lastTurnstileFailures.delete(key);
  if (Date.now() - entry.at > 30_000) return null;
  return { reason: entry.reason, errorCodes: entry.errorCodes };
}

function noteTurnstileFailure(ip: string | null | undefined, reason: string, errorCodes: string[]): void {
  const key = ip?.trim() || 'anon';
  lastTurnstileFailures.delete(key);
  lastTurnstileFailures.set(key, { at: Date.now(), reason, errorCodes });
  while (lastTurnstileFailures.size > 200) {
    const oldest = lastTurnstileFailures.keys().next().value;
    if (oldest === undefined) break;
    lastTurnstileFailures.delete(oldest);
  }
}

export async function verifyTurnstileTokenWithDetails(
  token: string,
  remoteIp?: string | null
): Promise<TurnstileVerificationDetail> {
  const secret = getTurnstileSecret();
  if (!secret) return { ok: true, errorCodes: [] };

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

  if (!res.ok) return { ok: false, errorCodes: [`http_${res.status}`] };

  const data = (await res.json()) as SiteVerifyResponse;
  const errorCodes = Array.isArray(data['error-codes'])
    ? data['error-codes'].filter((c): c is string => typeof c === 'string')
    : [];
  return {
    ok: Boolean(data.success),
    errorCodes,
    ...(data.hostname ? { hostname: data.hostname } : {}),
  };
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string | null
): Promise<boolean> {
  const res = await verifyTurnstileTokenWithDetails(token, remoteIp);
  return res.ok;
}

export type TurnstileGateResult =
  | { ok: true }
  | { ok: false; message: string; reason?: string; errorCodes?: string[] };

/**
 * If TURNSTILE_SECRET_KEY is set, requires a non-empty token that passes siteverify.
 */
export async function assertTurnstileIfConfigured(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileGateResult> {
  const secret = getTurnstileSecret();
  if (!secret) {
    // Fail closed on deployed environments: a missing secret must not silently disable the human check.
    // Local dev and tests stay open so they run without Cloudflare keys.
    if (DEPLOYED_NODE_ENVS.has(process.env.NODE_ENV ?? '')) {
      console.error('TURNSTILE_SECRET_KEY is not set on a deployed environment; refusing login/signup');
      noteTurnstileFailure(remoteIp, 'missing_secret', ['missing-secret']);
      return {
        ok: false,
        message: 'Sign-in is temporarily unavailable. Please try again later.',
      };
    }
    return { ok: true };
  }

  if (!token || typeof token !== 'string' || token.length < 20) {
    noteTurnstileFailure(remoteIp, 'missing_token', ['missing-input-response']);
    return {
      ok: false,
      message: 'Human verification required. Please try again.',
    };
  }

  const v = await verifyTurnstileTokenWithDetails(token, remoteIp);
  if (!v.ok) {
    const codes = v.errorCodes.length > 0 ? v.errorCodes : ['siteverify-failed'];
    noteTurnstileFailure(remoteIp, 'siteverify_failed', codes);
    return {
      ok: false,
      message: 'Verification failed. Please try again.',
    };
  }

  return { ok: true };
}

(
  assertTurnstileIfConfigured as unknown as {
    popLastFailure?: typeof popLastTurnstileFailure;
  }
).popLastFailure = popLastTurnstileFailure;
