/**
 * Sealing one value (docs/privacy/01 §4.1.2).
 *
 *  - AES-256-GCM, random 12-byte IV, AAD = `table.column.key_ref`, so a sealed value cannot be moved to another column
 *    or another person.
 *  - Text: `pii2:<key_ref>:<iv>:<ciphertext+tag>` (base64url). Over 4 KB the plaintext is gzipped first: `pii2z:...`.
 *  - JSON columns keep their type and hold `{ "$pii": "pii2:..." }`, so sealed and plain rows coexist.
 *  - Reads accept plaintext, legacy `enc:` (src/lib/encrypt.ts format, only with ENCRYPTION_KEY) and `pii2:`. A value
 *    that cannot be opened throws PII_UNAVAILABLE; ciphertext is never returned as if it were the value.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { isKeyRef, PiiUnavailableError, requirePiiKeys, type PiiKeyProvider } from './keys.js';

export const PII_PREFIX = 'pii2:';
export const PII_GZIP_PREFIX = 'pii2z:';
export const LEGACY_PREFIX = 'enc:';
export const GZIP_OVER_BYTES = 4096;

const IV_LEN = 12;
const TAG_LEN = 16;

export interface SealContext {
  table: string;
  column: string;
}

export type SealedJson = { $pii: string };

const aad = (ctx: SealContext, keyRef: string): Buffer => Buffer.from(`${ctx.table}.${ctx.column}.${keyRef}`, 'utf8');

export function isSealedText(v: unknown): v is string {
  return typeof v === 'string' && (v.startsWith(PII_PREFIX) || v.startsWith(PII_GZIP_PREFIX));
}

export function isSealedJson(v: unknown): v is SealedJson {
  return Boolean(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 1 && isSealedText((v as SealedJson).$pii));
}

export function isLegacyText(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith(LEGACY_PREFIX);
}

/** True for any value that is not plain: `pii2:`, `pii2z:`, `{ $pii }` or legacy `enc:`. */
export function isSealed(v: unknown): boolean {
  return isSealedText(v) || isSealedJson(v) || isLegacyText(v);
}

/** The key_ref inside a sealed value, or null. */
export function keyRefOf(v: unknown): string | null {
  const s = isSealedJson(v) ? v.$pii : isSealedText(v) ? v : null;
  if (!s) return null;
  const parts = s.split(':');
  return parts.length === 4 && isKeyRef(parts[1]!) ? parts[1]! : null;
}

/** Seals one string under a data key already in hand. */
export function sealTextWithKey(plain: string, ctx: SealContext, keyRef: string, dek: Buffer): string {
  const raw = Buffer.from(plain, 'utf8');
  const zipped = raw.length > GZIP_OVER_BYTES;
  const body = zipped ? gzipSync(raw) : raw;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  cipher.setAAD(aad(ctx, keyRef));
  const ct = Buffer.concat([cipher.update(body), cipher.final(), cipher.getAuthTag()]);
  return `${zipped ? PII_GZIP_PREFIX : PII_PREFIX}${keyRef}:${iv.toString('base64url')}:${ct.toString('base64url')}`;
}

/** Opens one `pii2:`/`pii2z:` string under a data key already in hand. Throws PII_UNAVAILABLE on any failure. */
export function openTextWithKey(sealed: string, ctx: SealContext, dek: Buffer): string {
  const zipped = sealed.startsWith(PII_GZIP_PREFIX);
  const parts = sealed.slice(zipped ? PII_GZIP_PREFIX.length : PII_PREFIX.length).split(':');
  if (parts.length !== 3 || !isKeyRef(parts[0]!)) throw new PiiUnavailableError('malformed sealed value');
  const [keyRef, ivB64, ctB64] = parts as [string, string, string];
  try {
    const iv = Buffer.from(ivB64, 'base64url');
    const all = Buffer.from(ctB64, 'base64url');
    if (iv.length !== IV_LEN || all.length < TAG_LEN) throw new Error('short');
    const decipher = createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAAD(aad(ctx, keyRef));
    decipher.setAuthTag(all.subarray(all.length - TAG_LEN));
    const body = Buffer.concat([decipher.update(all.subarray(0, all.length - TAG_LEN)), decipher.final()]);
    return (zipped ? gunzipSync(body) : body).toString('utf8');
  } catch {
    throw new PiiUnavailableError(`cannot open ${ctx.table}.${ctx.column}`);
  }
}

/** Seals a string, or a JSON value as `{ $pii }`, for one person. */
export async function sealValue(value: unknown, ctx: SealContext & { kind: 'text' | 'json' }, keyRef: string, keys: PiiKeyProvider = requirePiiKeys()): Promise<unknown> {
  if (value === null || value === undefined) return value;
  if (isSealed(value)) return value; // idempotent: the backfill skips values already sealed
  const dek = await keys.dataKey(keyRef);
  if (ctx.kind === 'json') return { $pii: sealTextWithKey(JSON.stringify(value), ctx, keyRef, dek) } satisfies SealedJson;
  if (typeof value !== 'string') throw new PiiUnavailableError(`${ctx.table}.${ctx.column} is a text column`);
  return sealTextWithKey(value, ctx, keyRef, dek);
}

/**
 * Opens a stored value: sealed values are opened (the key_ref comes from the value itself), legacy `enc:` values are
 * decrypted with ENCRYPTION_KEY, plain values are returned as they are (read-both, docs/privacy/02 §4.1.4).
 */
export async function openValue(value: unknown, ctx: SealContext & { kind: 'text' | 'json' }, keys?: PiiKeyProvider | null): Promise<unknown> {
  if (isSealedJson(value) || isSealedText(value)) {
    const s = isSealedJson(value) ? value.$pii : (value as string);
    const keyRef = keyRefOf(s);
    if (!keyRef) throw new PiiUnavailableError('malformed sealed value');
    const provider = keys ?? requirePiiKeys();
    const text = openTextWithKey(s, ctx, await provider.dataKey(keyRef));
    if (ctx.kind === 'json') {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        throw new PiiUnavailableError(`cannot open ${ctx.table}.${ctx.column}`);
      }
    }
    return text;
  }
  if (isLegacyText(value)) return openLegacy(value);
  return value;
}

function legacyKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buf.length >= 32 ? buf.subarray(0, 32) : null;
}

/**
 * Legacy `enc:` values from src/lib/encrypt.ts (base64 iv + tag + ciphertext under ENCRYPTION_KEY). Unlike the old
 * decrypt(), a missing key or a failed open throws instead of handing back the ciphertext. Removed in B5.
 */
export function openLegacy(value: string): string {
  const key = legacyKey();
  if (!key) throw new PiiUnavailableError('legacy enc: value and no ENCRYPTION_KEY');
  const buf = Buffer.from(value.slice(LEGACY_PREFIX.length), 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new PiiUnavailableError('malformed legacy value');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, IV_LEN));
    decipher.setAuthTag(buf.subarray(IV_LEN, IV_LEN + TAG_LEN));
    return Buffer.concat([decipher.update(buf.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString('utf8');
  } catch {
    throw new PiiUnavailableError('cannot open legacy value');
  }
}
