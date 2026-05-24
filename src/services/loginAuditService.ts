import { prisma } from '../lib/prisma.js';
import {
  hashIdentifier,
  identifierTypeFor,
  isEmailIdentifier,
  type IdentifierType,
} from '../lib/identifierHash.js';
import { collectRequestAuditMeta } from '../lib/requestMeta.js';

export type LoginAuthMethod =
  | 'password'
  | 'magic_link_request'
  | 'magic_link_verify';

export type LoginOutcome = 'success' | 'failure';

export type LoginFailureReason =
  | 'turnstile_failed'
  | 'validation_error'
  | 'invalid_credentials'
  | 'magic_link_invalid';

export interface RecordLoginAttemptInput {
  request?: Request | null;
  authMethod: LoginAuthMethod;
  outcome: LoginOutcome;
  failureReason?: LoginFailureReason | null;
  identifier?: string | null;
  userId?: string | null;
  turnstileOk?: boolean | null;
}

/**
 * Resolve auth row by login identifier (email case-insensitive, username exact).
 */
export async function resolveAuthUserByIdentifier(
  identifier: string
): Promise<{ id: string } | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (isEmailIdentifier(trimmed)) {
    return prisma.auth.findFirst({
      where: { email: { equals: trimmed, mode: 'insensitive' } },
      select: { id: true },
    });
  }

  return prisma.auth.findFirst({
    where: { username: trimmed },
    select: { id: true },
  });
}

function identifierFields(identifier?: string | null): {
  identifierType: IdentifierType | null;
  identifierHash: string | null;
} {
  if (!identifier?.trim()) {
    return { identifierType: null, identifierHash: null };
  }
  const type = identifierTypeFor(identifier);
  return {
    identifierType: type,
    identifierHash: hashIdentifier(identifier, type),
  };
}

/**
 * Persist a login audit row. Failures are logged and never block auth.
 */
export async function recordLoginAttempt(
  input: RecordLoginAttemptInput
): Promise<void> {
  const meta = collectRequestAuditMeta(input.request);
  const { identifierType, identifierHash } = identifierFields(input.identifier);

  await prisma.loginAttempt.create({
    data: {
      outcome: input.outcome,
      failure_reason: input.failureReason ?? null,
      auth_method: input.authMethod,
      user_id: input.userId ?? null,
      identifier_type: identifierType,
      identifier_hash: identifierHash,
      client_ip: meta.clientIp,
      user_agent: meta.userAgent,
      accept_language: meta.acceptLanguage,
      origin: meta.origin,
      country_code: meta.countryCode,
      device_class: meta.deviceClass,
      browser: meta.browser,
      os: meta.os,
      turnstile_ok: input.turnstileOk ?? null,
      request_id: meta.requestId,
    },
  });
}

export function recordLoginAttemptSafe(input: RecordLoginAttemptInput): void {
  recordLoginAttempt(input).catch((err) => {
    console.error('recordLoginAttempt failed:', (err as Error).message);
  });
}
