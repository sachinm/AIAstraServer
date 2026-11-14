/**
 * Log lines carry operational facts only, never a person's values (docs/privacy/02 B0.1).
 * `redactForLog` is the last line of defence for free text that must be logged (an error message): it masks
 * the shapes personal values take (emails, dates, times, coordinates, tokens) and cuts the text short. Place
 * names cannot be recognised by shape, so callers log a kind or a status instead of text that may hold one.
 */

import { createHash } from 'node:crypto';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;
const API_KEY_PARAM = /([?&]key=)[^&\s"'`]+/gi;
const API_KEY_HEADER = /(x-goog-api-key['":\s=]+)[^\s"',}]+/gi;
const ISO_DATE = /\b\d{4}-\d{1,2}-\d{1,2}(?:[T ]\d{1,2}:[\d:.]+Z?)?\b/g;
const SLASH_DATE = /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g;
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
const COORD = /-?\b\d{1,3}\.\d{3,}\b/g;
const LONG_DIGITS = /\b\d{6,}\b/g;

export function redactForLog(text: unknown, max = 200): string {
  const s = typeof text === 'string' ? text : text instanceof Error ? text.message : String(text ?? '');
  return s
    .replace(API_KEY_PARAM, '$1[redacted]')
    .replace(API_KEY_HEADER, '$1[redacted]')
    .replace(EMAIL, '[email]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'Bearer [token]')
    .replace(ISO_DATE, '[date]')
    .replace(SLASH_DATE, '[date]')
    .replace(TIME, '[time]')
    .replace(COORD, '[num]')
    .replace(LONG_DIGITS, '[num]')
    .slice(0, max);
}

/** Redact error messages/strings destined for `app_error_events` (strips URL query tokens, PII, keys). */
export function redactErrorText(text: unknown, max = 500): string {
  return redactForLog(text, max).replace(/\r\n/g, '\n').trim();
}

/** Extract and redact up to `maxFrames` stack/component-stack lines for Admin error debugging. */
export function redactStackPreview(stackOrErr: unknown, maxFrames = 8): string | null {
  const raw =
    typeof stackOrErr === 'string'
      ? stackOrErr
      : stackOrErr instanceof Error && typeof stackOrErr.stack === 'string'
        ? stackOrErr.stack
        : '';
  if (!raw.trim()) return null;
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => /^\s*(?:at |in |Caused by:|[A-Za-z0-9_$.]+@)/.test(l))
    .slice(0, maxFrames)
    .map((l) => redactErrorText(l.replace(/\?[^\s):]+/g, ''), 220))
    .filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

/** Deterministic 16-char fingerprint to group recurring errors across Admin Views without PII. */
export function computeStackFingerprint(parts: {
  source: string;
  category: string;
  errorCode?: string | null;
  topFrame?: string | null;
  message?: string | null;
}): string {
  const normFrame = (parts.topFrame ?? '').split('\n')[0]?.replace(/:\d+:\d+/g, '') ?? '';
  const normMsg = (parts.message ?? '').slice(0, 80);
  const seed = `${parts.source}|${parts.category}|${parts.errorCode ?? ''}|${normFrame || normMsg}`;
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

/** Mask last octet/segment of client IP so security/error records avoid storing raw personal IPs. */
export function maskIpAddress(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== 'string') return null;
  const trimmed = ip.trim().slice(0, 64);
  if (!trimmed) return null;
  const v4Match = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(trimmed);
  if (v4Match) return `${v4Match[1]}.xxx`;
  if (trimmed.includes(':')) {
    const segs = trimmed.split(':');
    return segs.slice(0, Math.min(4, segs.length)).join(':') + '::xxxx';
  }
  return trimmed;
}

/** `a***@example.com` style, for the dev-only mail log. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '[email]';
  return `${email[0]}***${email.slice(at)}`;
}

/** Stack frames without the message line, so an error's location can be logged without its text. */
export function stackFrames(err: unknown, frames = 6): string {
  const stack = err instanceof Error && typeof err.stack === 'string' ? err.stack : '';
  return stack
    .split('\n')
    .filter((l) => /^\s+at /.test(l))
    .slice(0, frames)
    .map((l) => l.trim())
    .join(' | ');
}

/** The GraphQL request facts worth logging: the operation's name, never its variables or query text. */
export function graphqlLogFields(body: unknown): { operationName: string | null; hasVariables: boolean } {
  const b = body && typeof body === 'object' ? (body as { operationName?: unknown; query?: unknown; variables?: unknown }) : {};
  let operationName = typeof b.operationName === 'string' && b.operationName ? b.operationName : null;
  if (!operationName && typeof b.query === 'string') {
    // `query Me { ... }` / `mutation SignIn(...)`: the declared name only
    const m = /^\s*(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(b.query);
    operationName = m ? m[1] : null;
  }
  return { operationName: operationName ? operationName.slice(0, 64) : null, hasVariables: Boolean(b.variables && typeof b.variables === 'object' && Object.keys(b.variables).length) };
}
