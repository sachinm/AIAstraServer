/** Owner alerts: gating, formatting, throttle, timeout and failure handling. The sender is a fake. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deliverOwnerAlert,
  formatIp,
  formatOwnerAlert,
  notifyOwner,
  ownerAlertRecipients,
  resetOwnerAlertThrottle,
  SIGN_IN_THROTTLE_MS,
  type OwnerAlertFacts,
} from '../../../src/notify/ownerAlerts.js';

const facts = (over: Partial<OwnerAlertFacts> = {}): OwnerAlertFacts => ({
  userId: 'u1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  ip: '198.51.100.7',
  ipSource: 'viewer',
  userAgent: 'Mozilla/5.0',
  country: 'IN',
  outcome: 'ok',
  at: new Date('2026-11-08T18:30:00Z'),
  ...over,
});

const okSender = () => vi.fn(async () => true);

beforeEach(() => {
  vi.stubEnv('OWNER_ALERTS_ENABLED', '1');
  vi.stubEnv('OWNER_ALERT_EMAILS', 'send.owner@example.com');
  resetOwnerAlertThrottle();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('gating', () => {
  it('needs both OWNER_ALERTS_ENABLED=1 and a recipient', async () => {
    vi.stubEnv('OWNER_ALERTS_ENABLED', '');
    expect(ownerAlertRecipients()).toEqual([]);
    const send = okSender();
    expect(await deliverOwnerAlert('sign_up', facts(), send)).toBe('off');
    vi.stubEnv('OWNER_ALERTS_ENABLED', '1');
    vi.stubEnv('OWNER_ALERT_EMAILS', '');
    expect(await deliverOwnerAlert('sign_up', facts(), send)).toBe('off');
    expect(send).not.toHaveBeenCalled();
  });

  it('parses a comma list and drops junk', () => {
    vi.stubEnv('OWNER_ALERT_EMAILS', ' a@x.com, ,not-an-email, b@y.org ');
    expect(ownerAlertRecipients()).toEqual(['a@x.com', 'b@y.org']);
  });

  it('skips @test.local addresses', async () => {
    const send = okSender();
    expect(await deliverOwnerAlert('sign_up', facts({ email: 'qa1@TEST.local' }), send)).toBe('test_address');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports not_configured when no mail transport is set', async () => {
    expect(await deliverOwnerAlert('sign_up', facts(), vi.fn(async () => false))).toBe('not_configured');
  });
});

describe('formatting', () => {
  it('subject and body carry name, email, IP, UA, country and Pacific time', () => {
    const { subject, text } = formatOwnerAlert('sign_up', facts());
    expect(subject).toBe('New sign-up: Asha Rao (asha@example.com)');
    expect(text).toContain('Email:      asha@example.com');
    expect(text).toContain('IP:         198.51.100.7');
    expect(text).not.toContain('unverified');
    expect(text).toContain('Country:    IN');
    expect(text).toContain('User agent: Mozilla/5.0');
    expect(text).toMatch(/Nov 8, 2026.*10:30:00\s?AM PST \(America\/Los_Angeles\)/);
  });

  it('marks an IP that did not come from CloudFront as unverified', () => {
    expect(formatIp('203.0.113.9', 'xff_first')).toBe('203.0.113.9 (unverified, xff_first)');
    expect(formatIp('203.0.113.9', 'xff_right')).toBe('203.0.113.9 (unverified, xff_right)');
    expect(formatIp(null, null)).toBe('unknown');
  });

  it('a name with line breaks cannot add mail headers; a missing name says so', () => {
    expect(formatOwnerAlert('sign_in', facts({ name: 'Eve\r\nBcc: x@y.com' })).subject).toBe(
      'Sign-in: Eve Bcc: x@y.com (asha@example.com)'
    );
    expect(formatOwnerAlert('sign_in', facts({ name: null })).subject).toBe('Sign-in: (no name) (asha@example.com)');
  });
});

describe('throttle', () => {
  it('one sign-in email per user per 10 minutes; other users and sign-ups are not held back', async () => {
    const send = okSender();
    const t0 = new Date('2026-11-08T18:00:00Z');
    expect(await deliverOwnerAlert('sign_in', facts({ at: t0 }), send)).toBe('sent');
    expect(await deliverOwnerAlert('sign_in', facts({ at: new Date(t0.getTime() + 60_000) }), send)).toBe('throttled');
    expect(await deliverOwnerAlert('sign_in', facts({ userId: 'u2', at: t0 }), send)).toBe('sent');
    expect(await deliverOwnerAlert('sign_up', facts({ at: t0 }), send)).toBe('sent');
    expect(await deliverOwnerAlert('sign_up', facts({ at: t0 }), send)).toBe('sent');
    expect(
      await deliverOwnerAlert('sign_in', facts({ at: new Date(t0.getTime() + SIGN_IN_THROTTLE_MS) }), send)
    ).toBe('sent');
    expect(send).toHaveBeenCalledTimes(5);
  });
});

describe('failures', () => {
  it('a send error is logged once without the address and never thrown', async () => {
    const send = vi.fn(async () => {
      throw new Error('Resend error 422: bad to send.owner@example.com');
    });
    expect(await deliverOwnerAlert('sign_up', facts(), send)).toBe('failed');
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(String((console.error as any).mock.calls[0][1])).not.toContain('@example.com');
  });

  it('gives up after 5 s', async () => {
    vi.useFakeTimers();
    const send = vi.fn(() => new Promise<boolean>(() => undefined));
    const p = deliverOwnerAlert('sign_up', facts(), send);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBe('failed');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5000 }));
  });

  it('notifyOwner returns at once even when the send hangs', () => {
    const send = vi.fn(() => new Promise<boolean>(() => undefined));
    expect(notifyOwner('sign_up', facts(), send)).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
  });
});
