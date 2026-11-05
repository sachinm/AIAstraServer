/**
 * Hashes over personal values (docs/privacy/02 §4.1.5 "Source hash"): `kundli_facts.source_hash` and `dossier_hash`,
 * `kundli_data.payload_hash`, the pack and dossier hashes, the transit `source_hash`.
 *
 * They are always computed over opened (plain) values, so sealing a row never changes its hash and never looks like a
 * birth change that triggers a rebuild. With a person's hash key (HKDF(DEK, "hash-v1"), from `hashKeyFor`) the hash is an
 * HMAC, so a dump cannot confirm a guessed birth date by hashing it. Without one (no key_ref yet: plain mode until B3)
 * it is the same unkeyed digest as before, so existing rows keep their hashes; the B4 backfill rewrites them keyed in the
 * same transaction as the seal.
 */
import { createHash, createHmac, hkdfSync } from 'node:crypto';
import { requirePiiKeys, type PiiKeyProvider } from './keys.js';

export interface PiiHashOptions {
  /** the person's hash key; null/undefined = the unkeyed digest */
  key?: Buffer | null;
  /** hex characters kept (default: all) */
  len?: number;
  /** unkeyed digest algorithm, as each site used before (default sha256); keyed hashes are always HMAC-SHA256 */
  alg?: 'sha256' | 'md5';
}

export function piiHash(text: string, opts: PiiHashOptions = {}): string {
  const hex = opts.key
    ? createHmac('sha256', opts.key).update(text, 'utf8').digest('hex')
    : createHash(opts.alg ?? 'sha256').update(text, 'utf8').digest('hex');
  return opts.len ? hex.slice(0, opts.len) : hex;
}

/** The person's hash key: HKDF(DEK, "hash-v1"). */
export async function hashKeyFor(keyRef: string, keys: PiiKeyProvider = requirePiiKeys()): Promise<Buffer> {
  const dek = await keys.dataKey(keyRef);
  return Buffer.from(hkdfSync('sha256', dek, Buffer.alloc(0), Buffer.from('hash-v1'), 32));
}
