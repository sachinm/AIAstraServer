/**
 * AUTH_PROVIDER switch and the Cognito email-OTP adapter, against a fake Cognito (no AWS calls).
 * Prisma, email sending, Turnstile and background jobs are in-memory fakes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
} from '@aws-sdk/client-cognito-identity-provider';

const fake = vi.hoisted(() => ({
  rows: [] as Array<Record<string, any>>,
  sent: [] as Array<{ to: string; code: string }>,
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

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: {
    auth: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, any> }) => {
        const row = fake.rows.find((r) => matches(r, where));
        return row ? { ...row } : null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `user-${fake.nextId++}`, role: 'novice', ...data };
        fake.rows.push(row);
        return { ...row };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const row = fake.rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row ? { ...row } : null;
      }),
    },
  },
}));

vi.mock('../../../src/services/emailService.js', () => ({
  sendMagicLinkEmail: vi.fn(async (to: string, code: string) => {
    fake.sent.push({ to, code });
  }),
}));
vi.mock('../../../src/services/turnstileService.js', () => ({
  assertTurnstileIfConfigured: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../../src/services/kundliQueueService.js', () => ({
  enqueueKundliSync: vi.fn(async () => undefined),
  processKundliSyncQueue: vi.fn(async () => undefined),
}));
vi.mock('../../../src/services/geminiCacheService.js', () => ({
  ensureGeminiCacheForUser: vi.fn(async () => undefined),
}));
vi.mock('../../../src/graphql/context.js', () => ({
  getJwtSecret: () => 'unit-test-jwt-secret',
}));
vi.mock('../../../src/lib/encrypt.js', () => ({
  encrypt: (plain: string) => `enc:${plain}`,
}));

import {
  createCognitoAuth,
  readCognitoConfig,
  setCognitoAuthForTests,
} from '../../../src/auth/cognitoClient.js';
import {
  getAuthProvider,
  sendLoginCode,
  verifyLoginCode,
  legacyEmailCode,
} from '../../../src/auth/emailCode.js';
import {
  signup,
  loginWithMagicLink,
  requestMagicLink,
  EMAIL_EXISTS_CODE,
  EMAIL_EXISTS_MESSAGE,
  MAGIC_LINK_REQUEST_MESSAGE,
  MAGIC_LINK_LOGIN_FAILED,
} from '../../../src/services/authService.js';

const exc = (Cls: new (o: any) => Error) => new Cls({ message: 'x', $metadata: {} });

/** A small in-memory stand-in for a passwordless Cognito pool, at the SDK `send` level. */
class FakeCognito {
  calls: Array<{ type: string; input: any }> = [];
  users = new Map<string, { confirmed: boolean; confirmCode: string; otp: string | null; session: string | null }>();
  failSignUpWith: Error | null = null;
  private n = 0;

  count(type: string) {
    return this.calls.filter((c) => c.type === type).length;
  }
  /** Code Cognito would have emailed: confirmation code or the current sign-in code. */
  codeFor(email: string, kind: 'confirm' | 'otp'): string {
    const u = this.users.get(email.toLowerCase())!;
    return kind === 'confirm' ? u.confirmCode : (u.otp as string);
  }
  addConfirmedUser(email: string) {
    this.users.set(email.toLowerCase(), { confirmed: true, confirmCode: '', otp: null, session: null });
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
      this.users.set(key, { confirmed: false, confirmCode: String(100000 + ++this.n), otp: null, session: null });
      return { UserConfirmed: false, UserSub: `sub-${this.n}` };
    }
    if (command instanceof ConfirmSignUpCommand) {
      this.calls.push({ type: 'ConfirmSignUp', input });
      if (!u) throw exc(UserNotFoundException);
      if (u.confirmed) throw exc(NotAuthorizedException);
      if (input.ConfirmationCode !== u.confirmCode) throw exc(CodeMismatchException);
      u.confirmed = true;
      return {};
    }
    if (command instanceof ResendConfirmationCodeCommand) {
      this.calls.push({ type: 'ResendConfirmationCode', input });
      if (!u) throw exc(UserNotFoundException);
      u.confirmCode = String(100000 + ++this.n);
      return {};
    }
    if (command instanceof InitiateAuthCommand) {
      this.calls.push({ type: 'InitiateAuth', input });
      if (!u) throw exc(UserNotFoundException);
      if (!u.confirmed) throw exc(UserNotConfirmedException);
      u.otp = String(10000000 + ++this.n);
      u.session = `session-${this.n}`;
      return { ChallengeName: 'EMAIL_OTP', Session: u.session };
    }
    if (command instanceof RespondToAuthChallengeCommand) {
      this.calls.push({ type: 'RespondToAuthChallenge', input });
      if (!u || !u.session || input.Session !== u.session) throw exc(NotAuthorizedException);
      if (input.ChallengeResponses.EMAIL_OTP_CODE !== u.otp) throw exc(CodeMismatchException);
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

const birth = {
  username: 'asha',
  email: 'asha@example.com',
  date_of_birth: '1990-01-15',
  place_of_birth: 'Pune, India',
  time_of_birth: '10:30:00',
  gender: 'F',
};

let cognito: FakeCognito;

beforeEach(() => {
  fake.rows.length = 0;
  fake.sent.length = 0;
  fake.nextId = 1;
  cognito = new FakeCognito();
  setCognitoAuthForTests(
    createCognitoAuth({ userPoolId: 'pool', clientId: 'client-1', region: 'us-east-1' }, cognito)
  );
  vi.stubEnv('AUTH_PROVIDER', 'cognito');
});

afterEach(() => {
  vi.unstubAllEnvs();
  setCognitoAuthForTests(null);
});

function addAccount(email = 'asha@example.com', role = 'novice') {
  fake.rows.push({ id: 'acct-1', email, role, magic_link_code_hash: null, magic_link_expires_at: null });
  cognito.addConfirmedUser(email);
}

describe('cognito config', () => {
  it('defaults the region and requires a client id', () => {
    expect(readCognitoConfig({ COGNITO_CLIENT_ID: 'c1' } as any)).toEqual({
      userPoolId: null,
      clientId: 'c1',
      region: 'us-east-1',
    });
    expect(
      readCognitoConfig({ COGNITO_CLIENT_ID: 'c1', COGNITO_USER_POOL_ID: 'p', COGNITO_REGION: 'eu-west-1' } as any)
    ).toMatchObject({ userPoolId: 'p', region: 'eu-west-1' });
    expect(() => readCognitoConfig({} as any)).toThrow(/COGNITO_CLIENT_ID/);
  });
});

describe('provider switch', () => {
  it('defaults to local and unknown values fall back to local', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubEnv('AUTH_PROVIDER', '');
    expect(getAuthProvider()).toBe('local');
    vi.stubEnv('AUTH_PROVIDER', 'LOCAL');
    expect(getAuthProvider()).toBe('local');
    vi.stubEnv('AUTH_PROVIDER', 'nonsense');
    expect(getAuthProvider()).toBe('local');
    vi.stubEnv('AUTH_PROVIDER', ' Cognito ');
    expect(getAuthProvider()).toBe('cognito');
    warn.mockRestore();
  });

  it('local sends the server code by email and never calls Cognito', async () => {
    vi.stubEnv('AUTH_PROVIDER', 'local');
    addAccount();
    await sendLoginCode('asha@example.com');
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0].code).toHaveLength(8);
    expect(cognito.calls).toHaveLength(0);
    expect(await verifyLoginCode('asha@example.com', fake.sent[0].code)).toEqual({ id: 'acct-1', role: 'novice' });
  });

  it('cognito calls Cognito and sends no server email', async () => {
    addAccount();
    await sendLoginCode('asha@example.com');
    expect(cognito.count('InitiateAuth')).toBe(1);
    expect(fake.sent).toHaveLength(0);
  });

  it('exposes the legacy implementation directly', async () => {
    addAccount();
    await legacyEmailCode.sendLoginCode('asha@example.com');
    expect(fake.sent).toHaveLength(1);
    expect(cognito.calls).toHaveLength(0);
  });
});

describe('sendLoginCode (cognito)', () => {
  it('calls InitiateAuth with USER_AUTH and PREFERRED_CHALLENGE EMAIL_OTP', async () => {
    addAccount();
    await sendLoginCode('  Asha@Example.com ');
    const call = cognito.calls.find((c) => c.type === 'InitiateAuth')!;
    expect(call.input).toMatchObject({
      ClientId: 'client-1',
      AuthFlow: 'USER_AUTH',
      AuthParameters: { USERNAME: 'asha@example.com', PREFERRED_CHALLENGE: 'EMAIL_OTP' },
    });
    expect(fake.rows[0].magic_link_code_hash).toBe('cognito-otp:session-1');
    expect(fake.rows[0].magic_link_expires_at).toBeInstanceOf(Date);
  });

  it('does nothing for an unknown email and for malformed input', async () => {
    await sendLoginCode('nobody@example.com');
    await sendLoginCode('not-an-email');
    expect(cognito.calls).toHaveLength(0);
  });

  it('sends a fresh confirmation code to a user who never confirmed sign-up', async () => {
    fake.rows.push({
      id: 'acct-1',
      email: 'asha@example.com',
      role: 'novice',
      magic_link_code_hash: null,
      magic_link_expires_at: null,
    });
    await cognito.send(new SignUpCommand({ ClientId: 'client-1', Username: 'asha@example.com' }));
    cognito.calls.length = 0;
    await sendLoginCode('asha@example.com');
    expect(cognito.count('ResendConfirmationCode')).toBe(1);
    expect(fake.rows[0].magic_link_code_hash).toBeNull();
  });

  it('swallows Cognito failures (throttling) without throwing', async () => {
    addAccount();
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    cognito.send = async () => {
      throw exc(TooManyRequestsException);
    };
    await expect(sendLoginCode('asha@example.com')).resolves.toBeUndefined();
    err.mockRestore();
  });
});

describe('verifyLoginCode (cognito)', () => {
  it('returns the account for the right code and answers EMAIL_OTP with the session', async () => {
    addAccount('Asha@Example.com', 'admin');
    await sendLoginCode('asha@example.com');
    const code = cognito.codeFor('asha@example.com', 'otp');
    const result = await verifyLoginCode('ASHA@example.com', ` ${code} `);
    expect(result).toEqual({ id: 'acct-1', role: 'admin' });
    const call = cognito.calls.find((c) => c.type === 'RespondToAuthChallenge')!;
    expect(call.input).toMatchObject({
      ChallengeName: 'EMAIL_OTP',
      Session: 'session-1',
      ChallengeResponses: { USERNAME: 'Asha@Example.com', EMAIL_OTP_CODE: code },
    });
    expect(fake.rows[0].magic_link_code_hash).toBeNull();
  });

  it('is single use: replaying the same code fails', async () => {
    addAccount();
    await sendLoginCode('asha@example.com');
    const code = cognito.codeFor('asha@example.com', 'otp');
    expect(await verifyLoginCode('asha@example.com', code)).not.toBeNull();
    expect(await verifyLoginCode('asha@example.com', code)).toBeNull();
  });

  it('returns null for a wrong code and still accepts the right one afterwards', async () => {
    addAccount();
    await sendLoginCode('asha@example.com');
    expect(await verifyLoginCode('asha@example.com', '00000000')).toBeNull();
    expect(await verifyLoginCode('asha@example.com', cognito.codeFor('asha@example.com', 'otp'))).not.toBeNull();
  });

  it('returns null when Cognito reports the code expired', async () => {
    addAccount();
    await sendLoginCode('asha@example.com');
    const code = cognito.codeFor('asha@example.com', 'otp');
    const real = cognito.send.bind(cognito);
    cognito.send = async (c: any) => {
      if (c instanceof RespondToAuthChallengeCommand) throw exc(ExpiredCodeException);
      return real(c);
    };
    expect(await verifyLoginCode('asha@example.com', code)).toBeNull();
  });

  it('does not use a parked session past its expiry', async () => {
    addAccount();
    await sendLoginCode('asha@example.com');
    const code = cognito.codeFor('asha@example.com', 'otp');
    fake.rows[0].magic_link_expires_at = new Date(Date.now() - 1000);
    expect(await verifyLoginCode('asha@example.com', code)).toBeNull();
    expect(cognito.count('RespondToAuthChallenge')).toBe(0);
  });

  it('returns null for an unknown email and creates nothing', async () => {
    expect(await verifyLoginCode('nobody@example.com', '12345678')).toBeNull();
    expect(fake.rows).toHaveLength(0);
    expect(cognito.calls).toHaveLength(0);
  });

  it('returns null for malformed codes without calling Cognito', async () => {
    addAccount();
    await sendLoginCode('asha@example.com');
    cognito.calls.length = 0;
    expect(await verifyLoginCode('asha@example.com', 'abc')).toBeNull();
    expect(await verifyLoginCode('asha@example.com', '')).toBeNull();
    expect(await verifyLoginCode('bad', '12345678')).toBeNull();
    expect(cognito.calls).toHaveLength(0);
  });

  it('returns null (not a throw) when Cognito is unreachable', async () => {
    addAccount();
    await sendLoginCode('asha@example.com');
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    cognito.send = async () => {
      throw exc(TooManyRequestsException);
    };
    expect(await verifyLoginCode('asha@example.com', '12345678')).toBeNull();
    err.mockRestore();
  });

  it('a confirmed user with no sign-in session cannot pass a code through ConfirmSignUp', async () => {
    addAccount();
    expect(await verifyLoginCode('asha@example.com', '123456')).toBeNull();
  });
});

describe('signup (cognito)', () => {
  it('creates the Cognito user once, without a password, and the auth row', async () => {
    const result = await signup(birth, null, '203.0.113.5');
    expect(result.success).toBe(true);
    expect(cognito.count('SignUp')).toBe(1);
    const input = cognito.calls[0].input;
    expect(input.Username).toBe('asha@example.com');
    expect(input.Password).toBeUndefined();
    expect(input.UserAttributes).toEqual([
      { Name: 'email', Value: 'asha@example.com' },
      { Name: 'name', Value: 'asha' },
    ]);
    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0].password).toMatch(/^\$2[aby]\$/);
    // Cognito sent the confirmation code; the server sent none.
    expect(fake.sent).toHaveLength(0);
  });

  it('can send a random password for a pool that is not passwordless', async () => {
    vi.stubEnv('COGNITO_SIGNUP_RANDOM_PASSWORD', '1');
    await signup(birth, null, null);
    expect(String(cognito.calls[0].input.Password).length).toBeGreaterThanOrEqual(24);
  });

  it('refuses a duplicate email with EMAIL_EXISTS and does not call Cognito again', async () => {
    await signup(birth, null, null);
    const again = await signup({ ...birth, username: 'asha2', email: 'ASHA@example.com' }, null, null);
    expect(again).toEqual({ success: false, code: EMAIL_EXISTS_CODE, message: EMAIL_EXISTS_MESSAGE });
    expect(cognito.count('SignUp')).toBe(1);
    expect(fake.rows).toHaveLength(1);
  });

  it('returns EMAIL_EXISTS when the email exists in Cognito only, and writes no row', async () => {
    cognito.addConfirmedUser('asha@example.com');
    const result = await signup(birth, null, null);
    expect(result).toEqual({ success: false, code: EMAIL_EXISTS_CODE, message: EMAIL_EXISTS_MESSAGE });
    expect(fake.rows).toHaveLength(0);
  });

  it('returns a plain failure and writes no row when Cognito rejects the sign-up', async () => {
    cognito.failSignUpWith = exc(TooManyRequestsException);
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await signup(birth, null, null);
    expect(result.success).toBe(false);
    expect((result as any).code).toBeUndefined();
    expect(fake.rows).toHaveLength(0);
    err.mockRestore();
  });

  it('confirming the emailed code signs the new user in (ConfirmSignUp)', async () => {
    await signup(birth, null, null);
    const code = cognito.codeFor('asha@example.com', 'confirm');
    const login = await loginWithMagicLink('asha@example.com', code, null, null);
    expect(login.success).toBe(true);
    expect(login).toMatchObject({ user: 'user-1', role: 'novice' });
    expect(cognito.count('ConfirmSignUp')).toBe(1);
    // and the next sign-in uses the EMAIL_OTP path
    await requestMagicLink('asha@example.com', null, null);
    expect(cognito.count('InitiateAuth')).toBe(1);
  });

  it('a wrong signup code fails with the stable message', async () => {
    await signup(birth, null, null);
    const login = await loginWithMagicLink('asha@example.com', '000000', null, null);
    expect(login).toEqual({ success: false, message: MAGIC_LINK_LOGIN_FAILED });
  });
});

describe('stable responses (cognito)', () => {
  it('requestMagicLink answers identically for known and unknown emails', async () => {
    addAccount();
    const known = await requestMagicLink('asha@example.com', null, null);
    const unknown = await requestMagicLink('nobody@example.com', null, null);
    expect(known).toEqual({ success: true, message: MAGIC_LINK_REQUEST_MESSAGE });
    expect(unknown).toEqual(known);
  });

  it('full sign-in: request, then login with the Cognito code', async () => {
    addAccount();
    await requestMagicLink('asha@example.com', null, null);
    const login = await loginWithMagicLink(
      'asha@example.com',
      cognito.codeFor('asha@example.com', 'otp'),
      null,
      null
    );
    expect(login).toMatchObject({ success: true, user: 'acct-1', role: 'novice' });
    expect((login as any).token).toBeTruthy();
  });
});

describe('cognito client wrapper', () => {
  it('returns Cognito tokens from RespondToAuthChallenge', async () => {
    cognito.addConfirmedUser('asha@example.com');
    const auth = createCognitoAuth({ userPoolId: null, clientId: 'client-1', region: 'us-east-1' }, cognito);
    const started = await auth.startEmailOtp('asha@example.com');
    expect(started).toEqual({ status: 'code_sent', session: 'session-1' });
    const answered = await auth.answerEmailOtp(
      'asha@example.com',
      cognito.codeFor('asha@example.com', 'otp'),
      'session-1'
    );
    expect(answered).toEqual({
      status: 'ok',
      tokens: {
        idToken: 'id.jwt',
        accessToken: 'access.jwt',
        refreshToken: 'refresh',
        expiresIn: 3600,
        tokenType: 'Bearer',
      },
    });
  });

  it('maps unknown and unconfirmed users', async () => {
    const auth = createCognitoAuth({ userPoolId: null, clientId: 'client-1', region: 'us-east-1' }, cognito);
    expect(await auth.startEmailOtp('nobody@example.com')).toEqual({ status: 'not_found' });
    await auth.signUpWithEmail('new@example.com');
    expect(await auth.startEmailOtp('new@example.com')).toEqual({ status: 'not_confirmed' });
    expect(await auth.signUpWithEmail('new@example.com')).toEqual({ status: 'exists' });
  });
});
