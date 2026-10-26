/**
 * End-to-end journey with AUTH_PROVIDER=cognito, through the real GraphQL schema, resolvers, authService,
 * emailCode and cognitoClient, against an in-memory fake Cognito pool and an in-memory auth table.
 *
 * Faked: Prisma (auth table only), the Cognito SDK `send` (a stricter pool than cognitoEmailCode.test.ts: it
 * expires codes and sessions on a clock and kills a sign-in session after 3 wrong codes), the mail service,
 * Turnstile and the kundli/Gemini background jobs. Nothing calls AWS, a database or the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createYoga } from 'graphql-yoga';
import {
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  CodeMismatchException,
  ExpiredCodeException,
  NotAuthorizedException,
  UserNotConfirmedException,
  UserNotFoundException,
  UsernameExistsException,
  TooManyRequestsException,
  InvalidParameterException,
} from '@aws-sdk/client-cognito-identity-provider';

const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
  nextId: 1,
  serverMails: [] as Array<{ to: string; code: string }>,
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

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    auth: {
      findFirst: async ({ where }: { where: Record<string, any> }) => {
        const row = db.rows.find((r) => matches(r, where));
        return row ? { ...row } : null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = {
          id: `user-${db.nextId++}`,
          role: 'novice',
          cognito_session: null,
          cognito_session_expires_at: null,
          ...data,
        };
        db.rows.push(row);
        return { ...row };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const i = db.rows.findIndex((r) => r.id === where.id);
        if (i >= 0) db.rows.splice(i, 1);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const row = db.rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row ? { ...row } : null;
      },
    },
  },
}));
vi.mock('../../../src/services/emailService.js', () => ({
  sendMagicLinkEmail: async (to: string, code: string) => {
    db.serverMails.push({ to, code });
  },
}));
vi.mock('../../../src/services/turnstileService.js', () => ({
  assertTurnstileIfConfigured: async () => ({ ok: true }),
}));
vi.mock('../../../src/services/kundliQueueService.js', () => ({
  enqueueKundliSync: async () => undefined,
  processKundliSyncQueue: async () => undefined,
}));
vi.mock('../../../src/services/geminiCacheService.js', () => ({
  ensureGeminiCacheForUser: async () => undefined,
}));

import { schema } from '../../../src/graphql/schema.js';
import { buildContext } from '../../../src/graphql/context.js';
import { createCognitoAuth, setCognitoAuthForTests } from '../../../src/auth/cognitoClient.js';

const exc = (Cls: new (o: any) => Error) => new Cls({ message: 'x', $metadata: {} });

const SESSION_VALIDITY_MS = 3 * 60 * 1000; // Cognito AuthSessionValidity (3 to 15 minutes)
const CONFIRM_CODE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_WRONG_OTP = 3;

type PoolUser = {
  confirmed: boolean;
  confirmCode: string;
  confirmCodeAt: number;
  otp: string | null;
  session: string | null;
  sessionAt: number;
  wrong: number;
};

/** A passwordless Cognito pool at the SDK `send` level, with an inbox of every email it "sends". */
class FakePool {
  calls: Array<{ type: string; input: any }> = [];
  inbox: Array<{ to: string; kind: 'confirm' | 'otp'; code: string }> = [];
  users = new Map<string, PoolUser>();
  failSignUpWith: Error | null = null;
  signUpCreatesThenFails = false; // user is created but the response is lost (timeout after success)
  private n = 0;

  count(type: string) {
    return this.calls.filter((c) => c.type === type).length;
  }
  lastCode(email: string, kind: 'confirm' | 'otp'): string {
    const m = [...this.inbox].reverse().find((x) => x.to === email.toLowerCase() && x.kind === kind);
    if (!m) throw new Error(`no ${kind} email for ${email}`);
    return m.code;
  }
  private mail(email: string, kind: 'confirm' | 'otp', code: string) {
    this.inbox.push({ to: email, kind, code });
  }
  private newUser(key: string) {
    const code = String(100000 + ++this.n);
    this.users.set(key, {
      confirmed: false,
      confirmCode: code,
      confirmCodeAt: Date.now(),
      otp: null,
      session: null,
      sessionAt: 0,
      wrong: 0,
    });
    this.mail(key, 'confirm', code);
  }
  addConfirmedUser(email: string) {
    this.users.set(email.toLowerCase(), {
      confirmed: true,
      confirmCode: '',
      confirmCodeAt: 0,
      otp: null,
      session: null,
      sessionAt: 0,
      wrong: 0,
    });
  }

  async send(command: any): Promise<any> {
    const input = command.input;
    const key = String(
      input.Username ?? input.AuthParameters?.USERNAME ?? input.ChallengeResponses?.USERNAME ?? ''
    ).toLowerCase();
    const u = this.users.get(key);

    if (command instanceof SignUpCommand) {
      this.calls.push({ type: 'SignUp', input });
      if (this.failSignUpWith) throw this.failSignUpWith;
      if (u) throw exc(UsernameExistsException);
      this.newUser(key);
      if (this.signUpCreatesThenFails) throw exc(TooManyRequestsException);
      return { UserConfirmed: false, UserSub: `sub-${this.n}` };
    }
    if (command instanceof ConfirmSignUpCommand) {
      this.calls.push({ type: 'ConfirmSignUp', input });
      if (!u) throw exc(UserNotFoundException);
      if (u.confirmed) throw exc(NotAuthorizedException);
      if (Date.now() - u.confirmCodeAt > CONFIRM_CODE_TTL_MS) throw exc(ExpiredCodeException);
      if (input.ConfirmationCode !== u.confirmCode) throw exc(CodeMismatchException);
      u.confirmed = true;
      return {};
    }
    if (command instanceof ResendConfirmationCodeCommand) {
      this.calls.push({ type: 'ResendConfirmationCode', input });
      if (!u) throw exc(UserNotFoundException);
      if (u.confirmed) throw exc(InvalidParameterException);
      u.confirmCode = String(100000 + ++this.n);
      u.confirmCodeAt = Date.now();
      this.mail(key, 'confirm', u.confirmCode);
      return {};
    }
    if (command instanceof InitiateAuthCommand) {
      this.calls.push({ type: 'InitiateAuth', input });
      if (!u) throw exc(UserNotFoundException);
      if (!u.confirmed) throw exc(UserNotConfirmedException);
      u.otp = String(10000000 + ++this.n);
      u.session = `session-${this.n}`;
      u.sessionAt = Date.now();
      u.wrong = 0;
      this.mail(key, 'otp', u.otp);
      return { ChallengeName: 'EMAIL_OTP', Session: u.session };
    }
    if (command instanceof RespondToAuthChallengeCommand) {
      this.calls.push({ type: 'RespondToAuthChallenge', input });
      if (!u || !u.session || input.Session !== u.session) throw exc(NotAuthorizedException);
      if (Date.now() - u.sessionAt > SESSION_VALIDITY_MS) {
        u.session = null;
        throw exc(NotAuthorizedException);
      }
      if (input.ChallengeResponses.EMAIL_OTP_CODE !== u.otp) {
        if (++u.wrong >= MAX_WRONG_OTP) u.session = null;
        throw exc(CodeMismatchException);
      }
      u.otp = null;
      u.session = null;
      return {
        AuthenticationResult: {
          IdToken: 'id.jwt',
          AccessToken: 'access.jwt',
          RefreshToken: 'refresh',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };
    }
    throw new Error(`unexpected command ${command?.constructor?.name}`);
  }
}

// ---- GraphQL helpers: the real schema, called the way the web app calls it ------------------------------------

const SIGNUP = `mutation($input: SignUpInput!) { signup(input: $input) { success message code token user role } }`;
const REQUEST = `mutation($email: String!) { requestMagicLink(email: $email) { success message } }`;
const LOGIN = `mutation($email: String!, $code: String!) { loginWithMagicLink(email: $email, code: $code) { success message token user role } }`;

function request(headers: Record<string, string> = {}) {
  return new Request('http://localhost/graphql', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.5', ...headers },
  });
}

const yoga = createYoga({ schema, context: buildContext, maskedErrors: false, logging: false });

/** POST to the real GraphQL endpoint handler, the way the web app does. */
async function gql(query: string, variables: Record<string, unknown>) {
  const res = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.5' },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: any; errors?: unknown };
  expect(body.errors).toBeUndefined();
  return body.data;
}

const signupApi = async (input: Record<string, unknown>) => (await gql(SIGNUP, { input })).signup;
const requestApi = async (email: string) => (await gql(REQUEST, { email })).requestMagicLink;
const loginApi = async (email: string, code: string) => (await gql(LOGIN, { email, code })).loginWithMagicLink;

const profile = {
  username: 'asha',
  email: 'asha@example.com',
  date_of_birth: '1990-01-15',
  place_of_birth: 'Pune, India',
  time_of_birth: '10:30:00',
  gender: 'F',
};

let pool: FakePool;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-25T10:00:00Z'));
  db.rows.length = 0;
  db.serverMails.length = 0;
  db.nextId = 1;
  pool = new FakePool();
  setCognitoAuthForTests(
    createCognitoAuth({ userPoolId: 'pool', clientId: 'client-1', region: 'us-east-1' }, pool)
  );
  vi.stubEnv('AUTH_PROVIDER', 'cognito');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setCognitoAuthForTests(null);
});

const advance = (ms: number) => vi.setSystemTime(new Date(Date.now() + ms));

/** A signed-up and confirmed user (signup then the emailed confirmation code). */
async function signedUpAndConfirmed() {
  await signupApi(profile);
  const done = await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'));
  expect(done.success).toBe(true);
}

// ---------------------------------------------------------------------------------------------------------------

describe('(1) signup with email only', () => {
  it('writes the row with a random password hash first, then the Cognito user, and a confirmation code is sent', async () => {
    const order: string[] = [];
    const realSend = pool.send.bind(pool);
    pool.send = async (c: any) => {
      order.push(`cognito:${c.constructor.name}@rows=${db.rows.length}`);
      return realSend(c);
    };

    const res = await signupApi(profile);
    expect(res).toMatchObject({ success: true, code: null, token: null, user: null });
    expect(res.message).toContain('Enter the code we emailed you');

    // database row first, Cognito second
    expect(order).toEqual(['cognito:SignUpCommand@rows=1']);
    expect(db.rows).toHaveLength(1);
    const row = db.rows[0];
    expect(row.email).toBe('asha@example.com');
    expect(row.role).toBe('novice');
    expect(row.signup_ip).toBe('203.0.113.5');
    expect(row.password).toMatch(/^\$2[aby]\$/); // bcrypt hash of a random secret nobody sees
    expect(row.cognito_session).toBeNull();

    // the Cognito user was created with the email, no password, and the confirmation code was emailed by Cognito
    const input = pool.calls[0].input;
    expect(input.Username).toBe('asha@example.com');
    expect(input.Password).toBeUndefined();
    expect(pool.users.get('asha@example.com')!.confirmed).toBe(false);
    expect(pool.inbox).toEqual([{ to: 'asha@example.com', kind: 'confirm', code: expect.stringMatching(/^\d{6}$/) }]);
    expect(db.serverMails).toHaveLength(0); // the server sends no mail of its own
  });

  it('two signups with different random passwords store different hashes', async () => {
    await signupApi(profile);
    await signupApi({ ...profile, username: 'bina', email: 'bina@example.com' });
    expect(db.rows[0].password).not.toBe(db.rows[1].password);
  });

  it('ignores a password sent in the input', async () => {
    await signupApi({ ...profile, password: 'hunter2hunter2' });
    expect(pool.calls[0].input.Password).toBeUndefined();
  });
});

describe('(2) duplicate email', () => {
  it('returns EMAIL_EXISTS (any letter case), creates nothing new and does not call Cognito again', async () => {
    await signupApi(profile);
    const again = await signupApi({ ...profile, username: 'asha2', email: 'ASHA@Example.com' });
    expect(again).toMatchObject({ success: false, code: 'EMAIL_EXISTS' });
    expect(again.message).toContain('already registered');
    expect(db.rows).toHaveLength(1);
    expect(pool.count('SignUp')).toBe(1);
    expect(pool.inbox).toHaveLength(1);
  });
});

describe('(3) signup confirmation code signs the user in', () => {
  it('issues a session JWT that the API accepts', async () => {
    await signupApi(profile);
    const res = await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'));
    expect(res).toMatchObject({ success: true, user: 'user-1', role: 'novice' });
    const decoded = jwt.verify(res.token, process.env.JWT_SECRET as string) as { sub: string; role: string };
    expect(decoded).toMatchObject({ sub: 'user-1', role: 'novice' });
    const ctx = buildContext({ request: request({ Authorization: `Bearer ${res.token}` }) });
    expect(ctx).toMatchObject({ userId: 'user-1', role: 'novice' });
    expect(pool.users.get('asha@example.com')!.confirmed).toBe(true);
    expect(pool.count('ConfirmSignUp')).toBe(1);
  });

  it('a confirmation code works once: the same code cannot be replayed', async () => {
    await signupApi(profile);
    const code = pool.lastCode(profile.email, 'confirm');
    expect((await loginApi(profile.email, code)).success).toBe(true);
    expect((await loginApi(profile.email, code)).success).toBe(false);
  });
});

describe('(4) second login: request code, EMAIL_OTP challenge, 8-digit code', () => {
  it('signs in with the 8-digit code Cognito emailed', async () => {
    await signedUpAndConfirmed();
    pool.calls.length = 0;

    const asked = await requestApi(profile.email);
    expect(asked.success).toBe(true);
    expect(pool.calls[0].input).toMatchObject({
      AuthFlow: 'USER_AUTH',
      AuthParameters: { USERNAME: 'asha@example.com', PREFERRED_CHALLENGE: 'EMAIL_OTP' },
    });
    const parked = db.rows[0].cognito_session as string;
    expect(parked).toMatch(/^session-/);

    const code = pool.lastCode(profile.email, 'otp');
    expect(code).toMatch(/^\d{8}$/);
    const res = await loginApi(profile.email, code);
    expect(res).toMatchObject({ success: true, user: 'user-1', role: 'novice' });
    expect(jwt.verify(res.token, process.env.JWT_SECRET as string)).toMatchObject({ sub: 'user-1' });
    expect(pool.calls.at(-1)!.input).toMatchObject({
      ChallengeName: 'EMAIL_OTP',
      Session: parked,
      ChallengeResponses: { USERNAME: 'asha@example.com', EMAIL_OTP_CODE: code },
    });
    expect(db.rows[0].cognito_session).toBeNull(); // the parked session is cleared after use
    expect(db.serverMails).toHaveLength(0);
  });

  it('works from another email letter case and with spaces typed in the code', async () => {
    await signedUpAndConfirmed();
    await requestApi('  ASHA@example.COM ');
    const code = pool.lastCode(profile.email, 'otp');
    const res = await loginApi('Asha@Example.com', `${code.slice(0, 4)} ${code.slice(4)}`);
    expect(res.success).toBe(true);
  });

  it('a sign-in code cannot be replayed', async () => {
    await signedUpAndConfirmed();
    await requestApi(profile.email);
    const code = pool.lastCode(profile.email, 'otp');
    expect((await loginApi(profile.email, code)).success).toBe(true);
    expect((await loginApi(profile.email, code)).success).toBe(false);
  });
});

describe('(5) wrong code, expired session, resend', () => {
  const FAILED = 'Unable to sign in. Check your code and try again.';

  it('a wrong code fails with the stable message and the right code still works afterwards', async () => {
    await signedUpAndConfirmed();
    await requestApi(profile.email);
    const bad = await loginApi(profile.email, '00000000');
    expect(bad).toMatchObject({ success: false, message: FAILED, token: null, user: null });
    expect((await loginApi(profile.email, pool.lastCode(profile.email, 'otp'))).success).toBe(true);
  });

  it('a wrong signup confirmation code fails and the right one still works', async () => {
    await signupApi(profile);
    expect(await loginApi(profile.email, '000000')).toMatchObject({ success: false, message: FAILED });
    expect((await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'))).success).toBe(true);
  });

  it('malformed codes fail without calling Cognito', async () => {
    await signedUpAndConfirmed();
    await requestApi(profile.email);
    pool.calls.length = 0;
    for (const code of ['', 'abc', '12', '1234567890123']) {
      expect((await loginApi(profile.email, code)).success).toBe(false);
    }
    expect(pool.calls).toHaveLength(0);
  });

  it('after the third wrong code the session is dead, even the right code fails, and a new code recovers', async () => {
    await signedUpAndConfirmed();
    await requestApi(profile.email);
    const first = pool.lastCode(profile.email, 'otp');
    for (let i = 0; i < 3; i++) expect((await loginApi(profile.email, '00000000')).success).toBe(false);
    expect((await loginApi(profile.email, first)).success).toBe(false);

    await requestApi(profile.email); // "Send a new code"
    const fresh = pool.lastCode(profile.email, 'otp');
    expect(fresh).not.toBe(first);
    expect((await loginApi(profile.email, fresh)).success).toBe(true);
  });

  it('an expired session fails (Cognito side, 3 minutes), and requesting a new code recovers', async () => {
    await signedUpAndConfirmed();
    await requestApi(profile.email);
    const stale = pool.lastCode(profile.email, 'otp');
    advance(4 * 60 * 1000);
    expect((await loginApi(profile.email, stale)).success).toBe(false);

    await requestApi(profile.email);
    expect((await loginApi(profile.email, pool.lastCode(profile.email, 'otp'))).success).toBe(true);
  });

  it('a parked session older than the server limit (15 minutes) is not used at all', async () => {
    await signedUpAndConfirmed();
    await requestApi(profile.email);
    const code = pool.lastCode(profile.email, 'otp');
    pool.calls.length = 0;
    advance(16 * 60 * 1000);
    expect((await loginApi(profile.email, code)).success).toBe(false);
    expect(pool.count('RespondToAuthChallenge')).toBe(0);
  });

  it('resend after sign-in request: the new code works and the previous one no longer does', async () => {
    await signedUpAndConfirmed();
    await requestApi(profile.email);
    const first = pool.lastCode(profile.email, 'otp');
    await requestApi(profile.email);
    const second = pool.lastCode(profile.email, 'otp');
    expect(second).not.toBe(first);
    expect((await loginApi(profile.email, first)).success).toBe(false);
    expect((await loginApi(profile.email, second)).success).toBe(true);
  });

  it('resend during signup: a fresh confirmation code is emailed and replaces the old one', async () => {
    await signupApi(profile);
    const first = pool.lastCode(profile.email, 'confirm');
    const asked = await requestApi(profile.email); // "Send a new code" on the code screen
    expect(asked.success).toBe(true);
    expect(pool.count('ResendConfirmationCode')).toBe(1);
    expect(pool.count('SignUp')).toBe(1); // not signed up twice
    const second = pool.lastCode(profile.email, 'confirm');
    expect(second).not.toBe(first);
    expect((await loginApi(profile.email, first)).success).toBe(false);
    expect((await loginApi(profile.email, second)).success).toBe(true);
  });

  it('an expired signup confirmation code fails, and a resend recovers', async () => {
    await signupApi(profile);
    advance(25 * 60 * 60 * 1000);
    expect((await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'))).success).toBe(false);
    await requestApi(profile.email);
    expect((await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'))).success).toBe(true);
  });

  it('a Cognito outage on request or verify gives the normal responses, never an error', async () => {
    await signedUpAndConfirmed();
    const down = async () => {
      throw exc(TooManyRequestsException);
    };
    pool.send = down;
    expect(await requestApi(profile.email)).toMatchObject({ success: true });
    expect(await loginApi(profile.email, '12345678')).toMatchObject({ success: false, message: FAILED });
  });
});

describe('(6) an old account that exists only in Postgres', () => {
  const addLegacy = () =>
    db.rows.push({
      id: 'old-1',
      username: 'asha',
      email: 'asha@example.com',
      role: 'astrologer',
      password: '$2a$10$legacyhashlegacyhashlegacyhashlegacyhashlegacyhash',
      cognito_session: null,
      cognito_session_expires_at: null,
    });

  it('gets its Cognito user on the first code request and signs in with that first code', async () => {
    addLegacy();
    expect(pool.users.size).toBe(0);

    const asked = await requestApi(profile.email);
    expect(asked.success).toBe(true);
    expect(pool.calls.map((c) => c.type)).toEqual(['InitiateAuth', 'SignUp']);
    expect(pool.calls[1].input.Password).toBeUndefined();
    expect(pool.users.get('asha@example.com')!.confirmed).toBe(false);
    expect(db.rows).toHaveLength(1); // no second row

    const first = await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'));
    expect(first).toMatchObject({ success: true, user: 'old-1', role: 'astrologer' });
    expect(db.rows[0].password).toBe('$2a$10$legacyhashlegacyhashlegacyhashlegacyhashlegacyhash'); // untouched
  });

  it('from the second login on it uses the normal EMAIL_OTP path and is not signed up again', async () => {
    addLegacy();
    await requestApi(profile.email);
    await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'));

    await requestApi(profile.email);
    expect(pool.count('SignUp')).toBe(1);
    const otp = pool.lastCode(profile.email, 'otp');
    expect(otp).toMatch(/^\d{8}$/);
    expect(await loginApi(profile.email, otp)).toMatchObject({ success: true, user: 'old-1' });
  });

  it('asking twice before entering the code resends it instead of signing up twice', async () => {
    addLegacy();
    await requestApi(profile.email);
    await requestApi(profile.email);
    expect(pool.count('SignUp')).toBe(1);
    expect(pool.count('ResendConfirmationCode')).toBe(1);
    expect((await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'))).success).toBe(true);
  });
});

describe('(7) unknown email', () => {
  it('gets the identical response as a known email, creates no account, no Cognito user and sends no mail', async () => {
    await signedUpAndConfirmed();
    pool.calls.length = 0;
    const known = await requestApi(profile.email);
    const callsForKnown = pool.calls.length;
    pool.calls.length = 0;
    const rowsBefore = db.rows.length;
    const usersBefore = pool.users.size;
    const mailsBefore = pool.inbox.length;

    const unknown = await requestApi('nobody@example.com');
    expect(unknown).toEqual(known);
    expect(callsForKnown).toBeGreaterThan(0);
    expect(pool.calls).toHaveLength(0);
    expect(db.rows).toHaveLength(rowsBefore);
    expect(pool.users.size).toBe(usersBefore);
    expect(pool.inbox).toHaveLength(mailsBefore);
    expect(db.serverMails).toHaveLength(0);
  });

  it('a code for an unknown email fails with the same message as a wrong code and creates nothing', async () => {
    await signedUpAndConfirmed();
    await requestApi(profile.email);
    const wrong = await loginApi(profile.email, '00000000');
    pool.calls.length = 0;
    const unknown = await loginApi('nobody@example.com', '00000000');
    expect(unknown).toEqual(wrong);
    expect(pool.calls).toHaveLength(0);
    expect(db.rows).toHaveLength(1);
    expect(pool.users.has('nobody@example.com')).toBe(false);
  });

  it('a malformed email gets the same response too', async () => {
    const a = await requestApi('nobody@example.com');
    const b = await requestApi('not-an-email');
    expect(b).toEqual(a);
    expect(pool.calls).toHaveLength(0);
  });

  it('a Cognito user without a database row cannot sign in (no account is created)', async () => {
    pool.addConfirmedUser('ghost@example.com');
    await requestApi('ghost@example.com');
    expect(pool.calls).toHaveLength(0);
    expect((await loginApi('ghost@example.com', '12345678')).success).toBe(false);
    expect(db.rows).toHaveLength(0);
  });
});

describe('(8) a Cognito failure at signup', () => {
  it('leaves no database row, answers SIGNUP_RETRY, and an immediate retry succeeds', async () => {
    pool.failSignUpWith = exc(TooManyRequestsException);
    const res = await signupApi(profile);
    expect(res).toMatchObject({ success: false, code: 'SIGNUP_RETRY' });
    expect(res.message).toContain('try again');
    expect(db.rows).toHaveLength(0);
    expect(pool.users.size).toBe(0);

    pool.failSignUpWith = null;
    const retry = await signupApi(profile);
    expect(retry).toMatchObject({ success: true });
    expect(db.rows).toHaveLength(1);
    expect((await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'))).success).toBe(true);
  });

  it('a lost response after Cognito created the user (row rolled back) does not lock the person out on retry', async () => {
    pool.signUpCreatesThenFails = true;
    const first = await signupApi(profile);
    expect(first).toMatchObject({ success: false, code: 'SIGNUP_RETRY' });
    expect(db.rows).toHaveLength(0);
    expect(pool.users.has('asha@example.com')).toBe(true); // orphan in Cognito

    pool.signUpCreatesThenFails = false;
    const retry = await signupApi(profile); // must not say EMAIL_EXISTS: nothing is registered on our side
    expect(retry).toMatchObject({ success: true });
    expect(db.rows).toHaveLength(1);
    // the orphan never confirmed, so it got a fresh confirmation code and that code signs the person in
    expect(pool.count('ResendConfirmationCode')).toBe(1);
    const res = await loginApi(profile.email, pool.lastCode(profile.email, 'confirm'));
    expect(res).toMatchObject({ success: true, user: db.rows[0].id });
  });

  it('a failed cleanup delete still answers SIGNUP_RETRY', async () => {
    pool.failSignUpWith = exc(TooManyRequestsException);
    const { prisma } = await import('../../../src/lib/prisma.js');
    const realDelete = prisma.auth.delete;
    (prisma.auth as any).delete = async () => {
      throw new Error('delete failed');
    };
    try {
      const res = await signupApi(profile);
      expect(res).toMatchObject({ success: false, code: 'SIGNUP_RETRY' });
    } finally {
      (prisma.auth as any).delete = realDelete;
    }
  });
});

describe('local provider is untouched by all of this', () => {
  it('AUTH_PROVIDER=local signs up and in with the server code and never calls Cognito', async () => {
    vi.stubEnv('AUTH_PROVIDER', 'local');
    await signupApi(profile);
    expect(db.serverMails).toHaveLength(1);
    expect(db.serverMails[0].code).toHaveLength(8);
    const res = await loginApi(profile.email, db.serverMails[0].code);
    expect(res.success).toBe(true);
    expect(pool.calls).toHaveLength(0);
  });
});
