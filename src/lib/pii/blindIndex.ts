/**
 * Blind index for the two sealed columns that are looked up by value (docs/privacy/01 §4.1.2): `auth.email` and
 * `auth.username`. Stored in `email_bidx` / `username_bidx` (added by M26) as HMAC-SHA256(bidx key, lower(trim(value))),
 * hex. The key never leaves the provider (KMS GenerateMac in B3; a derived local key in development).
 */
import { requirePiiKeys, type PiiKeyProvider } from './keys.js';

export function normalizeForIndex(value: string): string {
  return value.trim().toLowerCase();
}

export async function blindIndex(value: string, keys: PiiKeyProvider = requirePiiKeys()): Promise<string> {
  return (await keys.mac(normalizeForIndex(value))).toString('hex');
}
