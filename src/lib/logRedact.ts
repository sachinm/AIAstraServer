/**
 * Log lines carry operational facts only, never a person's values (docs/privacy/02 B0.1).
 * `redactForLog` is the last line of defence for free text that must be logged (an error message): it masks
 * the shapes personal values take (emails, dates, times, coordinates, tokens) and cuts the text short. Place
 * names cannot be recognised by shape, so callers log a kind or a status instead of text that may hold one.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;
const ISO_DATE = /\b\d{4}-\d{1,2}-\d{1,2}(?:[T ]\d{1,2}:[\d:.]+Z?)?\b/g;
const SLASH_DATE = /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g;
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?\b/g;
const COORD = /-?\b\d{1,3}\.\d{3,}\b/g;
const LONG_DIGITS = /\b\d{6,}\b/g;

export function redactForLog(text: unknown, max = 200): string {
  const s = typeof text === 'string' ? text : text instanceof Error ? text.message : String(text ?? '');
  return s
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
