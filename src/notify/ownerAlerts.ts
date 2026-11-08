/**
 * Owner alerts (Sachin, 2026-11-08): one email to the owner each time someone signs up (code verified) and each time
 * someone signs in. The owner's own inbox, so it carries the full name, email, IP, user agent, country and time; never
 * birth data, never codes or tokens.
 *
 * Off unless OWNER_ALERTS_ENABLED=1 and OWNER_ALERT_EMAILS (comma list) is set. Fire-and-forget: `notifyOwner` returns at
 * once, the send has a 5 s budget, and a failure is logged as one line without user values. It never blocks or fails
 * the sign-in.
 *
 * Throttle: at most one sign-in email per user per 10 minutes, kept in memory per instance (each Lambda instance keeps
 * its own map, so a busy user on two warm instances can get two). Sign-ups always send. Addresses at @test.local are
 * skipped.
 */
import type { PrismaClient } from '@prisma/client';
import type { RequestFacts } from '../audit/accountEvents.js';
import type { ClientIpSource } from '../lib/requestMeta.js';
import { sendPlainEmail } from '../services/emailService.js';

export type OwnerAlertKind = 'sign_up' | 'sign_in';

export interface OwnerAlertFacts {
  userId: string;
  name: string | null;
  email: string;
  ip: string | null;
  ipSource: ClientIpSource | null;
  userAgent: string | null;
  country: string | null;
  outcome: string;
  at: Date;
}

export const OWNER_ALERT_TIMEOUT_MS = 5000;
export const SIGN_IN_THROTTLE_MS = 10 * 60 * 1000;
const THROTTLE_MAX_ENTRIES = 5000;
const SKIP_DOMAINS = ['@test.local'];
const TIME_ZONE = 'America/Los_Angeles';

export function ownerAlertRecipients(): string[] {
  if (process.env.OWNER_ALERTS_ENABLED?.trim() !== '1') return [];
  return (process.env.OWNER_ALERT_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+$/.test(s));
}

const oneLine = (v: string | null | undefined, n: number): string =>
  (v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);

export function formatPacificTime(at: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(at);
}

export function formatIp(ip: string | null, source: ClientIpSource | null): string {
  if (!ip) return 'unknown';
  return source === 'viewer' ? ip : `${ip} (unverified, ${source ?? 'unknown source'})`;
}

export function formatOwnerAlert(kind: OwnerAlertKind, f: OwnerAlertFacts): { subject: string; text: string } {
  const name = oneLine(f.name, 80) || '(no name)';
  const email = oneLine(f.email, 256);
  const title = kind === 'sign_up' ? 'New sign-up' : 'Sign-in';
  const subject = `${title}: ${name} (${email})`;
  const text = [
    `${title} on AI AdAstra`,
    '',
    `Name:       ${name}`,
    `Email:      ${email}`,
    `Outcome:    ${f.outcome}`,
    `Time:       ${formatPacificTime(f.at)} (${TIME_ZONE})`,
    `IP:         ${formatIp(f.ip, f.ipSource)}`,
    `Country:    ${oneLine(f.country, 8) || 'unknown'}`,
    `User agent: ${oneLine(f.userAgent, 300) || 'unknown'}`,
    `User id:    ${f.userId}`,
    '',
    'Sent because OWNER_ALERTS_ENABLED=1. Sign-in alerts are limited to one per person per 10 minutes.',
  ].join('\n');
  return { subject, text };
}

const lastSignInAlert = new Map<string, number>();

/** True when this sign-in may send (and marks it sent). Exported for tests. */
export function takeSignInSlot(userId: string, nowMs: number): boolean {
  const last = lastSignInAlert.get(userId);
  if (last !== undefined && nowMs - last < SIGN_IN_THROTTLE_MS) return false;
  if (lastSignInAlert.size >= THROTTLE_MAX_ENTRIES) {
    for (const [k, t] of lastSignInAlert) if (nowMs - t >= SIGN_IN_THROTTLE_MS) lastSignInAlert.delete(k);
    if (lastSignInAlert.size >= THROTTLE_MAX_ENTRIES) lastSignInAlert.clear();
  }
  lastSignInAlert.set(userId, nowMs);
  return true;
}

export function resetOwnerAlertThrottle(): void {
  lastSignInAlert.clear();
}

type Sender = typeof sendPlainEmail;

/** Why an alert was not sent, or 'sent'. Awaitable for tests; callers use notifyOwner. */
export async function deliverOwnerAlert(
  kind: OwnerAlertKind,
  facts: OwnerAlertFacts,
  send: Sender = sendPlainEmail
): Promise<'sent' | 'off' | 'test_address' | 'throttled' | 'not_configured' | 'failed'> {
  const to = ownerAlertRecipients();
  if (!to.length) return 'off';
  const email = facts.email.trim().toLowerCase();
  if (SKIP_DOMAINS.some((d) => email.endsWith(d))) return 'test_address';
  if (kind === 'sign_in' && !takeSignInSlot(facts.userId, facts.at.getTime())) return 'throttled';
  const { subject, text } = formatOwnerAlert(kind, facts);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const sent = await Promise.race([
      send({ to, subject, text, timeoutMs: OWNER_ALERT_TIMEOUT_MS }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timed out after 5 s')), OWNER_ALERT_TIMEOUT_MS);
      }),
    ]);
    if (!sent) {
      console.warn(`[owner-alert] ${kind} not sent: no RESEND_API_KEY or SMTP_HOST`);
      return 'not_configured';
    }
    return 'sent';
  } catch (err) {
    // one line, no user values (the Resend body may echo the subject, so only the first 80 chars of the message)
    console.error(`[owner-alert] ${kind} not sent:`, oneLine((err as Error)?.message, 80).replace(/\S+@\S+/g, '<email>'));
    return 'failed';
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Fire-and-forget: returns at once, never throws. */
export function notifyOwner(kind: OwnerAlertKind, facts: OwnerAlertFacts, send?: Sender): void {
  if (!ownerAlertRecipients().length) return;
  void deliverOwnerAlert(kind, facts, send).catch(() => undefined);
}

type AuthReader = Pick<PrismaClient, 'auth'>;

/**
 * Look the person up (name, email) and alert, all in the background. The auth resolvers call this after a successful
 * sign-up verify or sign-in; nothing here is awaited by the request.
 */
export function alertOwnerOfAuth(
  prisma: AuthReader | null | undefined,
  kind: OwnerAlertKind,
  userId: string,
  emailFromRequest: string,
  request: RequestFacts | null,
  send?: Sender
): void {
  if (!ownerAlertRecipients().length) return;
  const at = new Date();
  void (async () => {
    let name: string | null = null;
    let email = emailFromRequest;
    try {
      const row = await prisma?.auth?.findUnique?.({ where: { id: userId }, select: { name: true, email: true } });
      name = row?.name ?? null;
      email = row?.email || emailFromRequest;
    } catch {
      // the alert still goes out with the address the person typed
    }
    await deliverOwnerAlert(
      kind,
      {
        userId,
        name,
        email,
        ip: request?.ip ?? null,
        ipSource: request?.ip_source ?? null,
        userAgent: request?.user_agent ?? null,
        country: request?.country ?? null,
        outcome: 'ok',
        at,
      },
      send
    );
  })().catch(() => undefined);
}
