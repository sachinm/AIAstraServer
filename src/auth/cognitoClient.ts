/**
 * Thin wrapper over @aws-sdk/client-cognito-identity-provider for passwordless email sign-up and sign-in.
 * Plan: docs/grokbots/plan-cognito-auth/README.md.
 *
 * Assumes a user pool on the Essentials (or Plus) feature plan with EMAIL_OTP allowed as a first factor and
 * an app client WITHOUT a secret that allows ALLOW_USER_AUTH. Every call here is a public (unauthenticated)
 * user-pool API addressed by ClientId, so the Lambda role needs no cognito-idp permissions.
 *
 * Sign-up approach: SignUp (public API) with NO Password. This is the documented path for a pool whose
 * allowed first factors include EMAIL_OTP: users can register without a password, Cognito emails a
 * confirmation code, and ConfirmSignUp marks the email verified. AdminCreateUser would need IAM permissions
 * and a second confirm step, so it is not used. If a pool is not passwordless-enabled, set
 * COGNITO_SIGNUP_RANDOM_PASSWORD=1 and a strong random password the user never sees is sent instead.
 *
 * Sign-in approach: InitiateAuth with AuthFlow USER_AUTH + PREFERRED_CHALLENGE EMAIL_OTP (Cognito emails the
 * code and returns ChallengeName EMAIL_OTP), then RespondToAuthChallenge with EMAIL_OTP_CODE.
 *
 * Config (env): COGNITO_CLIENT_ID (required), COGNITO_REGION (default us-east-1), COGNITO_USER_POOL_ID
 * (read for completeness and for the token verifier; the calls here address the pool through the client id).
 * No secrets are read or stored.
 */
import crypto from 'crypto';
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export interface CognitoConfig {
  userPoolId: string | null;
  clientId: string;
  region: string;
}

/** Anything with the SDK client's `send`; tests pass a fake. */
export interface CognitoSender {
  send(command: any): Promise<any>;
}

export interface CognitoTokens {
  idToken: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string | null;
}

export type SignUpOutcome =
  | { status: 'created'; userConfirmed: boolean; userSub: string | null }
  | { status: 'exists' };

export type StartOtpOutcome =
  | { status: 'code_sent'; session: string }
  | { status: 'not_confirmed' }
  | { status: 'not_found' }
  | { status: 'unsupported'; challengeName: string | null };

export type AnswerOtpOutcome = { status: 'ok'; tokens: CognitoTokens } | { status: 'invalid' };

export type ConfirmSignUpOutcome = { status: 'confirmed' } | { status: 'invalid' };

export interface CognitoAuth {
  /** SignUp by email (no password). Cognito emails the confirmation code. */
  signUpWithEmail(
    email: string,
    opts?: { name?: string | null; randomPassword?: boolean }
  ): Promise<SignUpOutcome>;
  /** ConfirmSignUp with the emailed code: marks the email verified. */
  confirmSignUp(email: string, code: string): Promise<ConfirmSignUpOutcome>;
  /** Email a fresh confirmation code to a user who never finished sign-up. */
  resendConfirmationCode(email: string): Promise<void>;
  /** InitiateAuth USER_AUTH + PREFERRED_CHALLENGE EMAIL_OTP: Cognito emails the sign-in code. */
  startEmailOtp(email: string): Promise<StartOtpOutcome>;
  /** RespondToAuthChallenge EMAIL_OTP: returns Cognito tokens when the code is right. */
  answerEmailOtp(email: string, code: string, session: string): Promise<AnswerOtpOutcome>;
}

export function readCognitoConfig(env: NodeJS.ProcessEnv = process.env): CognitoConfig {
  const clientId = env.COGNITO_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error('COGNITO_CLIENT_ID is required when AUTH_PROVIDER=cognito');
  }
  return {
    userPoolId: env.COGNITO_USER_POOL_ID?.trim() || null,
    clientId,
    region: env.COGNITO_REGION?.trim() || 'us-east-1',
  };
}

function errName(err: unknown): string {
  return (err as { name?: string } | null)?.name ?? '';
}

/** Failures that mean "this user or code is not valid", as opposed to throttling or a broken setup. */
const BAD_CREDENTIAL_ERRORS = new Set([
  'CodeMismatchException',
  'ExpiredCodeException',
  'NotAuthorizedException',
  'UserNotFoundException',
  'UserNotConfirmedException',
  'InvalidParameterException',
  'AliasExistsException',
]);

/** A strong random password that meets the default Cognito policy; never shown to anyone. */
function randomStrongPassword(): string {
  return `Aa1!${crypto.randomBytes(24).toString('base64url')}`;
}

function toTokens(result: {
  IdToken?: string;
  AccessToken?: string;
  RefreshToken?: string;
  ExpiresIn?: number;
  TokenType?: string;
}): CognitoTokens {
  return {
    idToken: result.IdToken ?? null,
    accessToken: result.AccessToken ?? null,
    refreshToken: result.RefreshToken ?? null,
    expiresIn: result.ExpiresIn ?? null,
    tokenType: result.TokenType ?? null,
  };
}

export function createCognitoAuth(config: CognitoConfig, sender?: CognitoSender): CognitoAuth {
  const client: CognitoSender =
    sender ?? new CognitoIdentityProviderClient({ region: config.region });
  const ClientId = config.clientId;

  return {
    async signUpWithEmail(email, opts = {}) {
      const attrs = [{ Name: 'email', Value: email }];
      if (opts.name?.trim()) attrs.push({ Name: 'name', Value: opts.name.trim() });
      try {
        const out = await client.send(
          new SignUpCommand({
            ClientId,
            Username: email,
            ...(opts.randomPassword ? { Password: randomStrongPassword() } : {}),
            UserAttributes: attrs,
          })
        );
        return {
          status: 'created',
          userConfirmed: Boolean(out?.UserConfirmed),
          userSub: out?.UserSub ?? null,
        };
      } catch (err) {
        if (errName(err) === 'UsernameExistsException') return { status: 'exists' };
        throw err;
      }
    },

    async confirmSignUp(email, code) {
      try {
        await client.send(
          new ConfirmSignUpCommand({ ClientId, Username: email, ConfirmationCode: code })
        );
        return { status: 'confirmed' };
      } catch (err) {
        if (BAD_CREDENTIAL_ERRORS.has(errName(err))) return { status: 'invalid' };
        throw err;
      }
    },

    async resendConfirmationCode(email) {
      await client.send(new ResendConfirmationCodeCommand({ ClientId, Username: email }));
    },

    async startEmailOtp(email) {
      try {
        const out = await client.send(
          new InitiateAuthCommand({
            ClientId,
            AuthFlow: 'USER_AUTH',
            AuthParameters: { USERNAME: email, PREFERRED_CHALLENGE: 'EMAIL_OTP' },
          })
        );
        if (out?.ChallengeName === 'EMAIL_OTP' && out.Session) {
          return { status: 'code_sent', session: out.Session };
        }
        return { status: 'unsupported', challengeName: out?.ChallengeName ?? null };
      } catch (err) {
        const name = errName(err);
        if (name === 'UserNotConfirmedException') return { status: 'not_confirmed' };
        if (name === 'UserNotFoundException') return { status: 'not_found' };
        throw err;
      }
    },

    async answerEmailOtp(email, code, session) {
      try {
        const out = await client.send(
          new RespondToAuthChallengeCommand({
            ClientId,
            ChallengeName: 'EMAIL_OTP',
            Session: session,
            ChallengeResponses: { USERNAME: email, EMAIL_OTP_CODE: code },
          })
        );
        if (out?.AuthenticationResult) {
          return { status: 'ok', tokens: toTokens(out.AuthenticationResult) };
        }
        // Another challenge (e.g. MFA) or no result: not a completed sign-in.
        return { status: 'invalid' };
      } catch (err) {
        if (BAD_CREDENTIAL_ERRORS.has(errName(err))) return { status: 'invalid' };
        throw err;
      }
    },
  };
}

let cached: CognitoAuth | null = null;
let override: CognitoAuth | null = null;

/** The process-wide client built from env on first use. */
export function getCognitoAuth(): CognitoAuth {
  if (override) return override;
  if (!cached) cached = createCognitoAuth(readCognitoConfig());
  return cached;
}

/** Tests: inject a fake (or pass null to go back to the env-built client). */
export function setCognitoAuthForTests(auth: CognitoAuth | null): void {
  override = auth;
  cached = null;
}
