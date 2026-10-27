/**
 * Registration v2 through the real GraphQL schema: startSignup -> verifySignupCode -> completeProfile,
 * with the local provider and with a fake Cognito pool. Prisma (auth + kundli), mail, Turnstile and the
 * kundli/Gemini jobs are in-memory fakes. Nothing touches AWS, a database or the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createYoga } from 'graphql-yoga';
import jwt from 'jsonwebtoken';
import {
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  CodeMismatchException,
  UserNotConfirmedException,
  UserNotFoundException,
  UsernameExistsException,
  NotAuthorizedException,
} from '@aws-sdk/client-cognito-identity-provider';

const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
  kundlis: [] as Array<Record<string, any>>,
  mails: [] as Array<{ to: string; code: string }>,
  enqueued: [] as string[],
  nextId: 1,
}));

function matches(row: Record<string, any>, where: Record<string, any>): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (cond && typeof cond === 'object' && 'equals' in cond) {
      if (String(row[key] ?? '').toLowerCase() !== String(cond.equals).toLowerCase()) return false;
    } else if (cond && typeof cond === 'object' && 'in' in cond) {
      if (!cond.in.includes(row[key])) return false;
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
    findMany: async ({ where }: any) => db.rows.filter((x) => matches(x, where)).map((x) => ({ ...x })),
    create: async ({ data }: any) => {
      const row = {
        id: `user-${db.nextId++}`,
        role: 'novice',
        profile_complete: true,
        email_verified_at: null,
        referral_code: null,
        referred_by_user_id: null,
        cognito_session: null,
        cognito_session_expires_at: null,
        ...data,
      };
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
    groupBy: async () => {
      const counts = new Map<string, number>();
      for (const r of db.rows) {
        if (r.referred_by_user_id) counts.set(r.referred_by_user_id, (counts.get(r.referred_by_user_id) ?? 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([id, n]) => ({ referred_by_user_id: id, _count: { _all: n } }));
    },
  };
  const kundli = {
    findFirst: async ({ where }: any) => db.kundlis.find((k) => k.user_id === where.user_id) ?? null,
  };
  return { prisma: { auth, kundli } };
});
vi.mock('../../../src/services/emailService.js', () => ({
  sendMagicLinkEmail: async (to: string, code: string) => {
    db.mails.push({ to, code });
  },
}));
vi.mock('../../../src/services/turnstileService.js', () => ({
  assertTurnstileIfConfigured: async () => ({ ok: true }),
}));
vi.mock('../../../src/services/kundliQueueService.js', async () => {
  const actual = await vi.importActual<any>('../../../src/services/kundliQueueService.js');
  return {
    ...actual,
    enqueueKundliSync: async (_db: unknown, userId: string) => {
      db.enqueued.push(userId);
    },
    processKundliSyncQueue: async () => undefined,
  };
});
vi.mock('../../../src/services/geminiCacheService.js', () => ({
  ensureGeminiCacheForUser: async () => undefined,
}));
process.env.JWT_SECRET = 'unit-test-jwt-secret-at-least-32-characters';
vi.mock('../../../src/lib/encrypt.js', () => ({
  encrypt: (plain: string | null) => (plain ? `enc:${plain}` : null),
}));

import { schema } from '../../../src/graphql/schema.js';
import { buildContext } from '../../../src/graphql/context.js';
import { createCognitoAuth, setCognitoAuthForTests } from '../../../src/auth/cognitoClient.js';
import { normalizePlaceForAstroKundli } from '../../../src/lib/astroKundliClient.js';
import { validateSignUpInput } from '../../../src/lib/validators.js';
import { signup } from '../../../src/services/authService.js';

const exc = (Cls: new (o: any) => Error) => new Cls({ message: 'x', $metadata: {} });

class FakePool {
  inbox: Array<{ to: string; kind: 'confirm' | 'otp'; code: string }> = [];
  users = new Map<string, { confirmed: boolean; code: string }>();
  private n = 0;
  lastCode(email: string) {
    const m = [...this.inbox].reverse().find((x) => x.to === email.toLowerCase());
    if (!m) throw new Error(`no email for ${email}`);
    return m.code;
  }
  async send(command: any): Promise<any> {
    const input = command.input;
    const key = String(input.Username ?? input.AuthParameters?.USERNAME ?? input.ChallengeResponses?.USERNAME ?? '').toLowerCase();
    const u = this.users.get(key);
    if (command instanceof SignUpCommand) {
      if (u) throw exc(UsernameExistsException);
      const code = String(100000 + ++this.n);
      this.users.set(key, { confirmed: false, code });
      this.inbox.push({ to: key, kind: 'confirm', code });
      return { UserConfirmed: false, UserSub: `sub-${this.n}` };
    }
    if (command instanceof ConfirmSignUpCommand) {
      if (!u) throw exc(UserNotFoundException);
      if (u.confirmed) throw exc(NotAuthorizedException);
      if (input.ConfirmationCode !== u.code) throw exc(CodeMismatchException);
      u.confirmed = true;
      return {};
    }
    if (command instanceof ResendConfirmationCodeCommand) {
      if (!u) throw exc(UserNotFoundException);
      u.code = String(100000 + ++this.n);
      this.inbox.push({ to: key, kind: 'confirm', code: u.code });
      return {};
    }
    if (command instanceof InitiateAuthCommand) {
      if (!u) throw exc(UserNotFoundException);
      if (!u.confirmed) throw exc(UserNotConfirmedException);
      u.code = String(10000000 + ++this.n);
      this.inbox.push({ to: key, kind: 'otp', code: u.code });
      return { ChallengeName: 'EMAIL_OTP', Session: `s-${this.n}` };
    }
    if (command instanceof RespondToAuthChallengeCommand) {
      if (input.ChallengeResponses.EMAIL_OTP_CODE !== u?.code) throw exc(CodeMismatchException);
      return {
        AuthenticationResult: { AccessToken: 'a', IdToken: 'i', RefreshToken: 'r', ExpiresIn: 3600, TokenType: 'Bearer' },
      };
    }
    throw new Error('unexpected command');
  }
}

const yoga = createYoga({ schema, context: buildContext, maskedErrors: false, logging: false });

async function gql(query: string, variables: Record<string, unknown> = {}, token?: string) {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.5',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as { data?: any; errors?: Array<{ message: string }> };
}

const START = `mutation($input: StartSignupInput!) { startSignup(input: $input) { success code message } }`;
const VERIFY = `mutation($email: String!, $code: String!) { verifySignupCode(email: $email, code: $code) { success message token user role } }`;
const COMPLETE = `mutation($input: CompleteProfileInput!) { completeProfile(input: $input) { success message referral_code } }`;
const REQUEST = `mutation($email: String!) { requestMagicLink(email: $email) { success } }`;
const LOGIN = `mutation($email: String!, $code: String!) { loginWithMagicLink(email: $email, code: $code) { success token } }`;
const ME = `{ me { id email name profile_complete email_verified kundli_status } }`;
const STATS = `{ referralStats { success error rows { user_id referred_count referral_code } } }`;

const page2 = {
  date_of_birth: '1990-01-15',
  time_of_birth: '10:30',
  country_code: 'IN',
  city: 'New Delhi',
  gender: 'female',
};

const start = async (email = 'asha@example.com', name = 'Asha Rao') =>
  (await gql(START, { input: { name, email } })).data.startSignup;
const verify = async (email: string, code: string) => (await gql(VERIFY, { email, code })).data.verifySignupCode;
const complete = async (token: string, input: Record<string, unknown> = page2) =>
  (await gql(COMPLETE, { input }, token)).data.completeProfile;

function localCode(email: string): string {
  const m = [...db.mails].reverse().find((x) => x.to === email);
  if (!m) throw new Error('no mail');
  return m.code;
}

beforeEach(() => {
  db.rows.length = 0;
  db.kundlis.length = 0;
  db.mails.length = 0;
  db.enqueued.length = 0;
  db.nextId = 1;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setCognitoAuthForTests(null);
});

const providers: Array<{ name: string; setup: () => FakePool | null; codeFor: (e: string, p: FakePool | null) => string }> = [
  { name: 'local provider', setup: () => null, codeFor: (e) => localCode(e) },
  {
    name: 'cognito (fake pool)',
    setup: () => {
      const pool = new FakePool();
      setCognitoAuthForTests(createCognitoAuth({ userPoolId: 'p', clientId: 'c', region: 'us-east-1' }, pool));
      vi.stubEnv('AUTH_PROVIDER', 'cognito');
      return pool;
    },
    codeFor: (e, p) => p!.lastCode(e),
  },
];

for (const prov of providers) {
  describe(`registration v2 with ${prov.name}`, () => {
    let pool: FakePool | null;
    beforeEach(() => {
      pool = prov.setup();
    });

    it('start, verify (signs in), complete: happy path', async () => {
      const s = await start();
      expect(s).toMatchObject({ success: true, code: null });

      expect(db.rows[0]).toMatchObject({ name: 'Asha Rao', profile_complete: false, email_verified_at: null });
      expect(db.enqueued).toEqual([]);

      const v = await verify('asha@example.com', prov.codeFor('asha@example.com', pool));
      expect(v.success).toBe(true);
      expect(v.token).toBeTruthy();
      expect(db.rows[0].email_verified_at).toBeInstanceOf(Date);
      expect(db.enqueued).toEqual([]);

      const me1 = (await gql(ME, {}, v.token)).data.me;
      expect(me1).toMatchObject({ profile_complete: false, email_verified: true, kundli_status: 'pending', name: 'Asha Rao' });

      const c = await complete(v.token);
      expect(c.success).toBe(true);
      expect(c.referral_code).toMatch(/^[A-Z2-9]{8}$/);
      expect(db.rows[0]).toMatchObject({
        profile_complete: true,
        country_code: 'IN',
        city: 'New Delhi',
        gender: 'female',
        date_of_birth: 'enc:1990-01-15',
        time_of_birth: 'enc:10:30:00',
        place_of_birth: 'enc:New Delhi,IN',
      });
      expect(db.enqueued).toEqual([db.rows[0].id]);
      expect((await gql(ME, {}, v.token)).data.me.profile_complete).toBe(true);
    });

    it('a wrong code gets the generic failure and no token', async () => {
      await start();
      const v = await verify('asha@example.com', '000000');
      expect(v).toMatchObject({ success: false, token: null });
      expect(v.message).toBe('Unable to sign in. Check your code and try again.');
      expect(db.rows[0].email_verified_at).toBeNull();
    });

    it('a verified email is EMAIL_EXISTS', async () => {
      await start();
      await verify('asha@example.com', prov.codeFor('asha@example.com', pool));
      const again = await start('ASHA@example.com', 'Someone Else');
      expect(again).toEqual({
        success: false,
        code: 'EMAIL_EXISTS',
        message: 'This email is already registered. Please sign in instead.',
      });
      expect(db.rows).toHaveLength(1);
    });

    it('an unverified pending account is reused and gets a fresh code', async () => {
      await start('asha@example.com', 'Asha');
      const first = prov.codeFor('asha@example.com', pool);
      const again = await start('asha@example.com', 'Asha Rao');
      expect(again).toMatchObject({ success: true, code: null });
      expect(db.rows).toHaveLength(1);
      expect(db.rows[0].name).toBe('Asha Rao');
      const second = prov.codeFor('asha@example.com', pool);
      expect(second).not.toBe(first);
      expect((await verify('asha@example.com', second)).success).toBe(true);
    });

    it('resume: verified but left before page 2, signs in again and still lands on page 2', async () => {
      await start();
      expect((await verify('asha@example.com', prov.codeFor('asha@example.com', pool))).success).toBe(true);

      expect((await gql(REQUEST, { email: 'asha@example.com' })).data.requestMagicLink.success).toBe(true);
      const login = (await gql(LOGIN, { email: 'asha@example.com', code: prov.codeFor('asha@example.com', pool) })).data
        .loginWithMagicLink;
      expect(login.success).toBe(true);
      const me = (await gql(ME, {}, login.token)).data.me;
      expect(me).toMatchObject({ profile_complete: false, email_verified: true });
      expect(db.enqueued).toEqual([]);
      expect((await complete(login.token)).success).toBe(true);
      expect(db.enqueued).toHaveLength(1);
    });
  });
}

describe('completeProfile validation', () => {
  async function verifiedToken(email = 'asha@example.com') {
    await start(email);
    const v = await verify(email, localCode(email));
    return v.token as string;
  }

  const bad: Array<[string, Record<string, unknown>]> = [
    ['a future date', { date_of_birth: '2999-01-01' }],
    ['a date before 1900', { date_of_birth: '1899-12-31' }],
    ['a non-calendar date', { date_of_birth: '2001-02-30' }],
    ['time 24:00', { time_of_birth: '24:00' }],
    ['a 12-hour time', { time_of_birth: '9:30 PM' }],
    ['an unassigned country code', { country_code: 'XX' }],
    ['a country name instead of a code', { country_code: 'India' }],
    ['a bad gender', { gender: 'other' }],
    ['a missing city', { city: '' }],
    ['a blank city', { city: '   ' }],
    ['a city over 100 chars', { city: 'x'.repeat(101) }],
  ];
  for (const [label, patch] of bad) {
    it(`rejects ${label} and stores nothing`, async () => {
      const token = await verifiedToken();
      const r = await complete(token, { ...page2, ...patch });
      expect(r.success).toBe(false);
      expect(r.referral_code).toBeNull();
      expect(db.rows[0].profile_complete).toBe(false);
      expect(db.enqueued).toEqual([]);
    });
  }

  it('has no age field (GraphQL rejects it)', async () => {
    const token = await verifiedToken();
    const res = await gql(COMPLETE, { input: { ...page2, age: 30 } }, token);
    expect(res.errors?.length).toBeGreaterThan(0);
  });

  it('requires a session', async () => {
    const r = (await gql(COMPLETE, { input: page2 })).data.completeProfile;
    expect(r).toMatchObject({ success: false, message: 'Not authenticated' });
  });

  it('accepts the three genders, lower-case country codes and 1900-01-01', async () => {
    for (const [i, gender] of (['male', 'female', 'prefer_not_to_say'] as const).entries()) {
      const email = `g${i}@example.com`;
      const token = await verifiedToken(email);
      const r = await complete(token, { ...page2, gender, country_code: 'in', date_of_birth: '1900-01-01' });
      expect(r.success).toBe(true);
      expect(db.rows.find((x) => x.email === email)).toMatchObject({ gender, country_code: 'IN' });
    }
  });

  it('is idempotent: a second save changes nothing and returns the same referral code', async () => {
    const token = await verifiedToken();
    const a = await complete(token);
    const b = await complete(token, { ...page2, city: 'Mumbai' });
    expect(b.success).toBe(true);
    expect(b.referral_code).toBe(a.referral_code);
    expect(db.rows[0].city).toBe('New Delhi');
    expect(db.enqueued).toHaveLength(1);
  });

  it('place_of_birth is exactly what normalizePlaceForAstroKundli parses', async () => {
    const cases: Array<[string, string, string]> = [
      ['New Delhi', 'IN', 'New_Delhi,IN'],
      ['Austin, Texas', 'us', 'Austin_Texas,US'],
      ['  San   Jose ', 'US', 'San_Jose,US'],
      ['Pune', 'IN', 'Pune,IN'],
    ];
    for (const [i, [city, cc, parsed]] of cases.entries()) {
      const email = `p${i}@example.com`;
      const token = await verifiedToken(email);
      await complete(token, { ...page2, city, country_code: cc });
      const stored = (db.rows.find((x) => x.email === email)!.place_of_birth as string).replace(/^enc:/, '');
      expect(stored).toMatch(/^[^,]+,[A-Z]{2}$/);
      expect(normalizePlaceForAstroKundli(stored)).toBe(parsed);
    }
  }, 30000);
});

describe('referrals', () => {
  async function finish(email: string, extra: Record<string, unknown> = {}) {
    await start(email);
    const v = await verify(email, localCode(email));
    const c = await complete(v.token, { ...page2, ...extra });
    return { token: v.token as string, ...c };
  }
  const row = (email: string) => db.rows.find((r) => r.email === email)!;

  it('a valid code of another user is recorded; unknown and malformed codes are ignored without error', async () => {
    const owner = await finish('owner@example.com');

    const a = await finish('a@example.com', { referral_code: owner.referral_code.toLowerCase() });
    expect(a.success).toBe(true);
    expect(row('a@example.com').referred_by_user_id).toBe(row('owner@example.com').id);

    const b = await finish('b@example.com', { referral_code: 'ZZZZ9999' });
    const plain = await finish('c@example.com');
    expect(b.success).toBe(true);
    expect(b.message).toBe(plain.message); // same answer: valid codes are not revealed
    expect(row('b@example.com').referred_by_user_id).toBeNull();

    const m = await finish('m@example.com', { referral_code: 'bad!' });
    expect(m.success).toBe(true);
    expect(row('m@example.com').referred_by_user_id).toBeNull();
  });

  it('a user cannot refer themselves', async () => {
    await start('self@example.com');
    const v = await verify('self@example.com', localCode('self@example.com'));
    db.rows[0].referral_code = 'ABCD2345';
    const c = await complete(v.token, { ...page2, referral_code: 'ABCD2345' });
    expect(c.success).toBe(true);
    expect(db.rows[0].referred_by_user_id).toBeNull();
  });

  it('referralStats is admin only and counts per referrer', async () => {
    const owner = await finish('owner@example.com');
    await finish('a@example.com', { referral_code: owner.referral_code });
    await finish('b@example.com', { referral_code: owner.referral_code });

    expect((await gql(STATS, {}, owner.token)).data.referralStats.success).toBe(false);

    db.rows.push({ id: 'admin-1', email: 'admin@example.com', role: 'admin' });
    const adminToken = jwt.sign({ sub: 'admin-1', role: 'admin' }, process.env.JWT_SECRET!);
    const stats = (await gql(STATS, {}, adminToken)).data.referralStats;
    expect(stats.success).toBe(true);
    expect(stats.rows).toEqual([
      { user_id: row('owner@example.com').id, referred_count: 2, referral_code: owner.referral_code },
    ]);
  });
});

describe('deprecated one-shot signup', () => {
  const old = {
    username: 'asha',
    email: 'asha@example.com',
    date_of_birth: '1990-01-15',
    place_of_birth: 'Pune, India',
    time_of_birth: '10:30:00',
    gender: 'F',
  };

  it('still works, folding gender into the allowed values', async () => {
    expect((await signup(old, null, null)).success).toBe(true);
    expect(db.rows[0].gender).toBe('female');
  });

  it('rejects age', async () => {
    expect(validateSignUpInput({ ...old, age: 33 }).success).toBe(false);
    expect(await signup({ ...old, age: 33 }, null, null)).toMatchObject({ success: false, message: 'Invalid input' });
    expect(db.rows).toHaveLength(0);
  });

  it('is marked deprecated in the schema', async () => {
    const res = await gql(`{ __type(name: "Mutation") { fields { name description } } }`);
    const f = res.data.__type.fields.find((x: any) => x.name === 'signup');
    expect(f.description).toMatch(/^DEPRECATED/);
  });
});

describe('myTimeline', () => {
  it('is disabled (and empty) while TIMELINE_ENABLED is off', async () => {
    await start();
    const v = await verify('asha@example.com', localCode('asha@example.com'));
    const res = await gql(`{ myTimeline { enabled kundli_id events build } }`, {}, v.token);
    expect(res.data.myTimeline).toEqual({ enabled: false, kundli_id: null, events: null, build: null });
  });
});
