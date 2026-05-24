import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  hashIdentifier,
  identifierTypeFor,
  isEmailIdentifier,
  normalizeIdentifierForHash,
} from '../../src/lib/identifierHash.js';

describe('identifierHash', () => {
  const originalPepper = process.env.IDENTIFIER_HASH_PEPPER;
  const originalJwt = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long';
    delete process.env.IDENTIFIER_HASH_PEPPER;
  });

  afterEach(() => {
    if (originalPepper === undefined) {
      delete process.env.IDENTIFIER_HASH_PEPPER;
    } else {
      process.env.IDENTIFIER_HASH_PEPPER = originalPepper;
    }
    if (originalJwt === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwt;
    }
  });

  it('detects email identifiers', () => {
    expect(isEmailIdentifier('user@example.com')).toBe(true);
    expect(isEmailIdentifier('not-an-email')).toBe(false);
  });

  it('normalizes email case for hashing', () => {
    expect(normalizeIdentifierForHash('User@Example.com', 'email')).toBe(
      'user@example.com'
    );
  });

  it('produces stable hashes for the same identifier', () => {
    const a = hashIdentifier('user@example.com', 'email');
    const b = hashIdentifier('User@Example.com', 'email');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('uses identifierTypeFor', () => {
    expect(identifierTypeFor('user@example.com')).toBe('email');
    expect(identifierTypeFor('astro_user')).toBe('username');
  });
});
