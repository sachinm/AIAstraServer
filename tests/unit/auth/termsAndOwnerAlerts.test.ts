/**
 * Terms acceptance (docs/auth/otp-consent-contract.md) and owner alerts, through the real GraphQL schema with the local
 * code provider. Prisma, mail and Turnstile are in-memory fakes; nothing touches a database or the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createYoga } from 'graphql-yoga';

const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
  events: [] as Array<Record<string, any>>,
  mails: [] as Array<{ to: string; code: string }>,
  alerts: [] as Array<{ to: string[]; subject: string; text: string }>,
  alertFails: false,
  nextId: 1,
}));

function matches(row: Record<string, any>, where: Record<string, any>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (cond && typeof cond === 'object' && 'equals' in cond) {
      if (String(row[key] ?? '').toLowerCase() !== String(cond.equals).toLowerCase()) return false;
    } else if (row[key] !== cond) {
      return false;
    }
  }
  return true;
}

vi.mock('../../../src/lib/prisma.js', () => {
  const auth = {
    findFirst: async ({ where }: any) => {
      const r = db.rows.find((x) => matches(x, where));
      return r ? { ...r } : null;
    },
    findUnique: async ({ where }: any) => {
      const r = db.rows.find((x) => matches(x, where));
      return r ? { ...r } : null;
    },
    create: async ({ data }: any) => {
      const row = { id: `user-${db.nextId++}`, role: 'novice', profile_complete: true, email_verified_at: null, ...data };
      db.rows.push(row);
      return { ...row };
    },
    delete: async ({ where }: any) => {
      const i = db.rows.findIndex((r) => r.id === where.id);
      if (i >= 0) db.rows.splice(i, 1);
    },
    update: async ({ where, data }: any) => {
      const row = db.rows.find((r) => r.id === where.id);
      if (row) Object.assign(row, data);
      return row ? { ...row } : null;
    },
  };
  const accountEvent = {
    create: async ({ data }: any) => {
      db.events.push(data);
      return data;
    },
  };
  const kundli = { findFirst: async () => null };
  return { prisma: { auth, accountEvent, kundli } };
});
vi.mock('../../../src/services/emailService.js', () => ({
  sendMagicLinkEmail: async (to: string, code: string) => {
    db.mails.push({ to, code });
  },
  sendPlainEmail: async (mail: { to: string[]; subject: string; text: string }) => {
    if (db.alertFails) throw new Error('Resend error 500: boom for owner@example.com');
    db.alerts.push(mail);
    return true;
  },
}));
vi.mock('../../../src/services/turnstileService.js', () => ({
  assertTurnstileIfConfigured: async () => ({ ok: true }),
}));
vi.mock('../../../src/services/kundliQueueService.js', async () => {
  const actual = await vi.importActual<any>('../../../src/services/kundliQueueService.js');
  return { ...actual, enqueueKundliSync: async () => undefined, processKundliSyncQueue: async () => undefined };
});
vi.mock('../../../src/services/geminiCacheService.js', () => ({ ensureGeminiCacheForUser: async () => undefined }));
process.env.JWT_SECRET = 'unit-test-jwt-secret-at-least-32-characters';
vi.mock('../../../src/lib/encrypt.js', () => ({
  encrypt: (plain: string | null) => (plain ? `enc:${plain}` : null),
  decrypt: (c: string | null) => (c ? c.replace(/^enc:/, '') : null),
}));

import { schema } from '../../../src/graphql/schema.js';
import { buildContext } from '../../../src/graphql/context.js';
import { resetRequestAuthForTests } from '../../../src/auth/requestAuth.js';
import { setCognitoAuthForTests } from '../../../src/auth/cognitoClient.js';
import { CURRENT_TERMS_VERSION } from '../../../src/auth/terms.js';
import { resetOwnerAlertThrottle } from '../../../src/notify/ownerAlerts.js';

const yoga = createYoga({ schema, context: buildContext, maskedErrors: false, logging: false });

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.5',
      'user-agent': 'Mozilla/5.0 Test',
      'cloudfront-viewer-country': 'US',
    },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as { data?: any; errors?: Array<{ message: string }> };
}

const TERMS = `{ currentTerms { version requiredOnSignIn requiredOnSignUp } }`;
const START = `mutation($input: StartSignupInput!) { startSignup(input: $input) { success code message } }`;
const VERIFY = `mutation($email: String!, $code: String!, $termsAccepted: Boolean, $termsVersion: String) {
  verifySignupCode(email: $email, code: $code, termsAccepted: $termsAccepted, termsVersion: $termsVersion) { success code message token user } }`;
const REQUEST = `mutation($email: String!) { requestMagicLink(email: $email) { success } }`;
const LOGIN = `mutation($email: String!, $code: String!, $termsAccepted: Boolean, $termsVersion: String) {
  loginWithMagicLink(email: $email, code: $code, termsAccepted: $termsAccepted, termsVersion: $termsVersion) { success code message token user } }`;

const EMAIL = 'asha@example.com';
const accept = { termsAccepted: true, termsVersion: CURRENT_TERMS_VERSION };

function lastCode(email: string): string {
  const m = [...db.mails].reverse().find((x) => x.to === email);
  if (!m) throw new Error('no mail');
  return m.code;
}

/** A verified account, with no terms recorded and no alerts sent. */
async function verifiedAccount(email = EMAIL, name = 'Asha Rao') {
  await gql(START, { input: { name, email } });
  const v = (await gql(VERIFY, { email, code: lastCode(email) })).data.verifySignupCode;
  expect(v.success).toBe(true);
  db.events.length = 0;
  db.alerts.length = 0;
  resetOwnerAlertThrottle();
  return v.user as string;
}

async function signIn(vars: Record<string, unknown> = {}, email = EMAIL) {
  await gql(REQUEST, { email });
  return (await gql(LOGIN, { email, code: lastCode(email), ...vars })).data.loginWithMagicLink;
}

beforeEach(() => {
  vi.stubEnv('AUTH_PROVIDER', 'local');
  vi.stubEnv('COGNITO_USER_POOL_ID', '');
  vi.stubEnv('COGNITO_CLIENT_ID', '');
  vi.stubEnv('REQUIRE_TERMS_ON_SIGNIN', '');
  vi.stubEnv('REQUIRE_TERMS_ON_SIGNUP', '');
  vi.stubEnv('OWNER_ALERTS_ENABLED', '');
  vi.stubEnv('OWNER_ALERT_EMAILS', '');
  setCognitoAuthForTests(null);
  resetRequestAuthForTests();
  resetOwnerAlertThrottle();
  db.rows.length = 0;
  db.events.length = 0;
  db.mails.length = 0;
  db.alerts.length = 0;
  db.alertFails = false;
  db.nextId = 1;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('currentTerms', () => {
  it('is public and reports the version and both flags', async () => {
    expect((await gql(TERMS)).data.currentTerms).toEqual({
      version: CURRENT_TERMS_VERSION,
      requiredOnSignIn: false,
      requiredOnSignUp: false,
    });
    vi.stubEnv('REQUIRE_TERMS_ON_SIGNIN', '1');
    expect((await gql(TERMS)).data.currentTerms.requiredOnSignIn).toBe(true);
  });
});

describe('terms on sign-in', () => {
  it('enforcement off: an old client without the box still signs in, and nothing is recorded', async () => {
    const id = await verifiedAccount();
    const r = await signIn();
    expect(r).toMatchObject({ success: true, code: null });
    expect(db.rows.find((x) => x.id === id)!.terms_version).toBeUndefined();
    expect(db.events.some((e) => e.action === 'terms_accept')).toBe(false);
  });

  it('enforcement on, box missing: terms_required, and the same code works once the box is ticked', async () => {
    const id = await verifiedAccount();
    vi.stubEnv('REQUIRE_TERMS_ON_SIGNIN', '1');
    await gql(REQUEST, { email: EMAIL });
    const code = lastCode(EMAIL);
    const refused = (await gql(LOGIN, { email: EMAIL, code })).data.loginWithMagicLink;
    expect(refused).toMatchObject({ success: false, code: 'terms_required', token: null });
    expect(refused.message).toMatch(/18 or older/);
    const unticked = (await gql(LOGIN, { email: EMAIL, code, termsAccepted: false, termsVersion: CURRENT_TERMS_VERSION }))
      .data.loginWithMagicLink;
    expect(unticked.code).toBe('terms_required');
    expect(db.events.find((e) => e.action === 'sign_in')).toMatchObject({ outcome: 'refused', note: 'terms_required' });

    const ok = (await gql(LOGIN, { email: EMAIL, code, ...accept })).data.loginWithMagicLink;
    expect(ok).toMatchObject({ success: true, user: id });
    await flush();
    const row = db.rows.find((x) => x.id === id)!;
    expect(row.terms_version).toBe(CURRENT_TERMS_VERSION);
    expect(row.terms_accepted_at).toBeInstanceOf(Date);
    expect(row.age_confirmed_at).toBeInstanceOf(Date);
    expect(db.events.find((e) => e.action === 'terms_accept')).toMatchObject({
      user_id: id,
      after: { terms_version: CURRENT_TERMS_VERSION, flow: 'sign_in', current: true },
    });
  });

  it('enforcement on, old version: terms_outdated', async () => {
    await verifiedAccount();
    vi.stubEnv('REQUIRE_TERMS_ON_SIGNIN', '1');
    const r = await signIn({ termsAccepted: true, termsVersion: '2020-01-01' });
    expect(r).toMatchObject({ success: false, code: 'terms_outdated', token: null });
  });

  it('enforcement off, old version sent: signs in and records the version that was shown', async () => {
    const id = await verifiedAccount();
    const r = await signIn({ termsAccepted: true, termsVersion: '2020-01-01' });
    expect(r.success).toBe(true);
    await flush();
    expect(db.rows.find((x) => x.id === id)!.terms_version).toBe('2020-01-01');
    expect(db.events.find((e) => e.action === 'terms_accept')!.after).toMatchObject({ current: false });
  });
});

describe('terms on sign-up', () => {
  it('enforcement on: startSignup without the box is refused and creates nothing', async () => {
    vi.stubEnv('REQUIRE_TERMS_ON_SIGNUP', '1');
    const s = (await gql(START, { input: { name: 'Asha Rao', email: EMAIL } })).data.startSignup;
    expect(s).toMatchObject({ success: false, code: 'terms_required' });
    expect(db.rows).toHaveLength(0);
    expect(db.mails).toHaveLength(0);
  });

  it('records the version on page 1 and again when the code is verified', async () => {
    vi.stubEnv('REQUIRE_TERMS_ON_SIGNUP', '1');
    const s = (await gql(START, { input: { name: 'Asha Rao', email: EMAIL, ...accept } })).data.startSignup;
    expect(s.success).toBe(true);
    await flush();
    expect(db.rows[0]).toMatchObject({ terms_version: CURRENT_TERMS_VERSION });
    const missing = (await gql(VERIFY, { email: EMAIL, code: lastCode(EMAIL) })).data.verifySignupCode;
    expect(missing).toMatchObject({ success: false, code: 'terms_required' });
    const v = (await gql(VERIFY, { email: EMAIL, code: lastCode(EMAIL), ...accept })).data.verifySignupCode;
    expect(v.success).toBe(true);
    await flush();
    expect(db.events.filter((e) => e.action === 'terms_accept').map((e) => e.after.flow)).toEqual(['sign_up', 'sign_up']);
  });
});

describe('owner alerts', () => {
  const enable = () => {
    vi.stubEnv('OWNER_ALERTS_ENABLED', '1');
    vi.stubEnv('OWNER_ALERT_EMAILS', 'owner@example.com, second@example.com');
  };

  it('off by default: no alert on sign-up or sign-in', async () => {
    await verifiedAccount();
    await signIn();
    await flush();
    expect(db.alerts).toHaveLength(0);
  });

  it('a verified sign-up sends one alert with name, email, IP, user agent and country (not on sign_up_started)', async () => {
    enable();
    await gql(START, { input: { name: 'Asha Rao', email: EMAIL } });
    await flush();
    expect(db.alerts).toHaveLength(0);
    await gql(VERIFY, { email: EMAIL, code: lastCode(EMAIL) });
    await vi.waitFor(() => expect(db.alerts).toHaveLength(1));
    const a = db.alerts[0]!;
    expect(a.to).toEqual(['owner@example.com', 'second@example.com']);
    expect(a.subject).toBe('New sign-up: Asha Rao (asha@example.com)');
    expect(a.text).toContain('203.0.113.5 (unverified, xff_first)');
    expect(a.text).toContain('Mozilla/5.0 Test');
    expect(a.text).toContain('Country:    US');
    expect(a.text).toContain('America/Los_Angeles');
    expect(a.text).not.toMatch(new RegExp(lastCode(EMAIL)));
  });

  it('sign-in alerts are limited to one per person per 10 minutes', async () => {
    await verifiedAccount();
    enable();
    await signIn();
    await vi.waitFor(() => expect(db.alerts).toHaveLength(1));
    expect(db.alerts[0]!.subject).toBe('Sign-in: Asha Rao (asha@example.com)');
    await signIn();
    await flush();
    expect(db.alerts).toHaveLength(1);
  });

  it('a mail failure does not fail the sign-in', async () => {
    await verifiedAccount();
    enable();
    db.alertFails = true;
    const r = await signIn();
    expect(r).toMatchObject({ success: true });
    expect(r.token).toBeTruthy();
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledWith('[owner-alert] sign_in not sent:', expect.any(String)));
    const logged = (console.error as any).mock.calls.find((c: unknown[]) => c[0] === '[owner-alert] sign_in not sent:');
    expect(logged[1]).not.toContain('owner@example.com');
  });

  it('a failed sign-in sends nothing', async () => {
    await verifiedAccount();
    enable();
    await gql(REQUEST, { email: EMAIL });
    await gql(LOGIN, { email: EMAIL, code: '000000' });
    await flush();
    expect(db.alerts).toHaveLength(0);
  });
});
