import crypto from 'crypto';

/** Unambiguous uppercase alphanumeric (8 chars). */
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateMagicLinkCode(): string {
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += CHARSET[crypto.randomInt(0, CHARSET.length)];
  }
  return out;
}

export function normalizeMagicLinkCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}
