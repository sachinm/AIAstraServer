/**
 * The account-change log (Sachin, 2026-11-05): what a person changes about their account, from where and when. This is
 * a different kind of record from `analytics_events` (clicks around the app) and from `admin_actions` (what staff do).
 *
 * Every row carries what the request tells us about who made it: the IP the proxy saw, the whole forwarded chain, the
 * user agent, the language the browser asked for, the viewer's country (CloudFront), the request id, the path and the
 * method. Values of birth details, names and emails are never stored: `fields` lists the names of what changed, and
 * `before` / `after` are only passed by callers for values that are not personal (plan codes, language, region).
 *
 * Recording never throws and never delays the answer: a failed write is logged without any user value and dropped.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type express from 'express';
import { resolveClientIp, type ClientIpSource } from '../lib/requestMeta.js';

export type AccountActor = 'self' | 'staff' | 'payment_gateway' | 'system';
export type AccountOutcome = 'ok' | 'refused' | 'failed';

export interface RequestFacts {
  ip: string | null;
  /** how far `ip` can be trusted (src/lib/requestMeta.ts); stored as `after.ip_source` on the row */
  ip_source?: ClientIpSource | null;
  ip_chain: string | null;
  user_agent: string | null;
  accept_language: string | null;
  country: string | null;
  request_id: string | null;
  path: string | null;
  method: string | null;
}

export interface AccountEventInput {
  userId: string | null;
  actor?: AccountActor;
  /** profile_update, plan_choice, plan_payment, sign_in, sign_up, facts_update, photo_upload, photo_remove, ... */
  action: string;
  outcome?: AccountOutcome;
  /** names of the things that changed, never their values */
  fields?: string[];
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** a short reason code or tag, never free text from the person */
  note?: string | null;
  request?: RequestFacts | null;
}

const clip = (v: string | null | undefined, n: number): string | null => (v ? v.slice(0, n) : null);

type HeaderGet = (name: string) => string | null | undefined;

function factsFrom(get: HeaderGet, path: string | null, method: string | null): RequestFacts {
  const forwarded = get('x-forwarded-for');
  const client = resolveClientIp(get);
  return {
    ip: clip(client.ip, 45),
    ip_source: client.source,
    ip_chain: clip(forwarded ?? null, 200),
    user_agent: clip(get('user-agent'), 300),
    accept_language: clip(get('accept-language'), 100),
    country: clip(get('cloudfront-viewer-country') || get('cf-ipcountry') || null, 8),
    request_id: clip(get('x-amzn-trace-id') || get('x-request-id') || get('x-amz-cf-id') || null, 120),
    path,
    method,
  };
}

/** From a Fetch API request (GraphQL). */
export function factsFromFetch(request: Request | undefined | null): RequestFacts | null {
  if (!request) return null;
  let path: string | null = null;
  try {
    path = new URL(request.url).pathname;
  } catch {
    path = null;
  }
  return factsFrom((n) => request.headers.get(n), path, request.method ?? null);
}

/** From an Express request (the REST routes). */
export function factsFromExpress(req: express.Request): RequestFacts {
  return factsFrom(
    (n) => {
      const v = req.headers[n];
      return Array.isArray(v) ? v.join(', ') : v;
    },
    clip(req.path, 200),
    req.method ?? null
  );
}

/** A short one-way tag for an email that failed to sign in, so a run of attempts can be linked without storing the address. */
export function subjectTag(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
}

type Db = Pick<PrismaClient, 'accountEvent'>;

export async function recordAccountEvent(prisma: Db | null | undefined, e: AccountEventInput): Promise<void> {
  if (!prisma || typeof (prisma as { accountEvent?: { create?: unknown } }).accountEvent?.create !== 'function') return;
  try {
    const r = e.request;
    // the IP's source rides in `after` (no column for it): cheap, and no migration needed before it ships
    const after = r?.ip_source ? { ...(e.after ?? {}), ip_source: r.ip_source } : e.after;
    await prisma.accountEvent.create({
      data: {
        user_id: e.userId,
        actor: e.actor ?? 'self',
        action: e.action,
        outcome: e.outcome ?? 'ok',
        fields: e.fields ?? [],
        before: (e.before ?? undefined) as never,
        after: (after ?? undefined) as never,
        note: clip(e.note, 120),
        ip: r?.ip ?? null,
        ip_chain: r?.ip_chain ?? null,
        user_agent: r?.user_agent ?? null,
        accept_language: r?.accept_language ?? null,
        country: r?.country ?? null,
        request_id: r?.request_id ?? null,
        path: r?.path ?? null,
        method: r?.method ?? null,
      },
    });
  } catch (err) {
    console.error('[account-event] not recorded:', (err as Error).message);
  }
}
