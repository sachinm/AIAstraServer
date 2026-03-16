import crypto from 'crypto';

const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;
const PREFIX = 'enc:';

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || typeof raw !== 'string') return null;
  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    buf = Buffer.from(raw, 'hex');
  } else {
    buf = Buffer.from(raw, 'base64');
  }
  if (buf.length < KEY_LEN) return null;
  return buf.slice(0, KEY_LEN);
}

/**
 * Encrypt a string for storage. Returns "enc:" + base64(iv + authTag + ciphertext), or null if ENCRYPTION_KEY not set.
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }
  const key = getKey();
  if (!key) return String(plaintext);
  const str = String(plaintext);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, enc]).toString('base64');
}

/**
 * Decrypt a value produced by encrypt(), or return as-is if not encrypted.
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') {
    return null;
  }
  const str = String(ciphertext);
  if (!str.startsWith(PREFIX)) return str;
  const key = getKey();
  if (!key) return str;
  const buf = Buffer.from(str.slice(PREFIX.length), 'base64');
  if (buf.length < IV_LEN + AUTH_TAG_LEN) return str;
  try {
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(enc) + decipher.final('utf8');
  } catch {
    return str;
  }
}
