import { createHmac } from 'crypto';
import { getIdentifierHashPepper } from '../config/env.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type IdentifierType = 'email' | 'username';

export function isEmailIdentifier(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function normalizeIdentifierForHash(
  value: string,
  type: IdentifierType
): string {
  const trimmed = value.trim();
  return type === 'email' ? trimmed.toLowerCase() : trimmed;
}

export function identifierTypeFor(value: string): IdentifierType {
  return isEmailIdentifier(value) ? 'email' : 'username';
}

export function hashIdentifier(value: string, type: IdentifierType): string {
  const normalized = normalizeIdentifierForHash(value, type);
  return createHmac('sha256', getIdentifierHashPepper())
    .update(normalized)
    .digest('hex');
}
